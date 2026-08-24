import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import {
  and,
  auditLogs,
  db,
  eq,
  inArray,
  products,
  stockOpnameItems,
  stockOpnames,
} from '@/lib/db'
import { applySOStockAdjustment } from '@/lib/stock-adjustment'
import { InsufficientStockError } from '@/lib/services/stock-service'

export const dynamic = 'force-dynamic'

// Stok bisa berubah antara SO Besar disubmit dan item ini diputuskan (toko tetap
// melayani penjualan) — bungkus kegagalan per item, sama seperti approve SO Harian.
class SOItemAdjustmentError extends Error {
  constructor(
    readonly productName: string,
    readonly cause: unknown
  ) {
    super('SO_ITEM_ADJUSTMENT_FAILED')
  }
}

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const bodySchema = z.object({
  decisions: z
    .array(
      z.object({
        itemId: z.number().int().positive('ID item tidak valid'),
        action: z.enum(['APPROVE', 'REJECT']),
        note: z.string().trim().max(500, 'Catatan maksimal 500 karakter').optional(),
      })
    )
    .min(1, 'Tidak ada keputusan yang dikirim')
    .max(500, 'Terlalu banyak item dalam satu permintaan'),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('stock_opname.approve')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const currentUserId = Number(payload.userId)
    if (Number.isNaN(currentUserId)) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (req.headers.get('content-type')?.includes('application/json') !== true) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const soId = Number(paramParsed.data.id)

    const parsed = bodySchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
        { status: 400 }
      )
    }

    const decisions = parsed.data.decisions
    if (new Set(decisions.map((d) => d.itemId)).size !== decisions.length) {
      return NextResponse.json({ error: 'Terdapat item duplikat dalam permintaan' }, { status: 400 })
    }
    const rejectMissingNote = decisions.find((d) => d.action === 'REJECT' && !d.note?.trim())
    if (rejectMissingNote) {
      return NextResponse.json({ error: 'Alasan wajib diisi untuk menolak item' }, { status: 400 })
    }

    const result = await db.transaction(async (tx) => {
      const soRows = await tx
        .select({
          id: stockOpnames.id,
          type: stockOpnames.type,
          status: stockOpnames.status,
          branchId: stockOpnames.branchId,
        })
        .from(stockOpnames)
        .where(eq(stockOpnames.id, soId))
        .for('update')
        .limit(1)

      if (soRows.length === 0) throw new Error('SO_NOT_FOUND')
      const so = soRows[0]

      // Approval per-item cuma berlaku untuk SO Besar — SO Harian tetap lewat
      // /approve satu-header.
      if (so.type !== 'FULL') throw new Error('NOT_FULL_SO')
      if (so.status === 'DRAFT') throw new Error('STILL_COUNTING')
      if (so.status !== 'PENDING') throw new Error('ALREADY_PROCESSED')

      if (payload.branchScope !== 'ALL' && payload.branchId !== so.branchId) {
        throw new Error('BRANCH_FORBIDDEN')
      }

      const items = await tx
        .select({
          id: stockOpnameItems.id,
          productId: stockOpnameItems.productId,
          productName: products.name,
          uomId: stockOpnameItems.uomId,
          itemStatus: stockOpnameItems.itemStatus,
          systemQty: stockOpnameItems.systemQty,
          physicalQty: stockOpnameItems.physicalQty,
          isRecounted: stockOpnameItems.isRecounted,
          recountSystemQty: stockOpnameItems.recountSystemQty,
          recountPhysicalQty: stockOpnameItems.recountPhysicalQty,
        })
        .from(stockOpnameItems)
        .innerJoin(products, eq(stockOpnameItems.productId, products.id))
        // Filter soId bukan sekadar optimasi: tanpa itu id item milik SO lain ikut termuat.
        .where(
          and(
            eq(stockOpnameItems.soId, soId),
            inArray(
              stockOpnameItems.id,
              decisions.map((d) => d.itemId)
            )
          )
        )

      const itemsById = new Map(items.map((row) => [row.id, row]))
      for (const decision of decisions) {
        const item = itemsById.get(decision.itemId)
        if (!item) throw new Error('ITEM_NOT_FOUND')
        if (item.itemStatus !== 'PENDING') throw new Error('ITEM_NOT_PENDING')
      }

      const now = new Date()
      const decided: { id: number; itemStatus: string }[] = []

      for (const decision of decisions) {
        const item = itemsById.get(decision.itemId)!
        const note = decision.note?.trim() ? decision.note.trim() : null

        if (decision.action === 'APPROVE') {
          // Kalau sudah dihitung ulang, pakai hasil hitung ulang (lebih segar) —
          // kalau belum, pakai hitungan pertama.
          const effectiveSystemQty = item.isRecounted ? item.recountSystemQty! : item.systemQty
          const effectivePhysicalQty = item.isRecounted ? item.recountPhysicalQty! : item.physicalQty

          try {
            await applySOStockAdjustment(tx, {
              productId: item.productId,
              branchId: so.branchId,
              uomId: item.uomId,
              systemQty: effectiveSystemQty,
              physicalQty: effectivePhysicalQty,
              currentUserId,
            })
          } catch (e) {
            throw new SOItemAdjustmentError(item.productName, e)
          }

          await tx
            .update(stockOpnameItems)
            .set({ itemStatus: 'APPROVED', decidedById: currentUserId, decidedAt: now, decisionNote: note })
            .where(eq(stockOpnameItems.id, item.id))

          await tx.insert(auditLogs).values({
            branchId: so.branchId,
            userId: currentUserId,
            action: 'STOCK_OPNAME_ITEM_APPROVE',
            tableName: 'stock_opname_items',
            recordId: String(item.id),
            oldData: JSON.stringify({ itemStatus: 'PENDING' }),
            newData: JSON.stringify({
              itemStatus: 'APPROVED',
              systemQty: effectiveSystemQty,
              physicalQty: effectivePhysicalQty,
            }),
          })

          decided.push({ id: item.id, itemStatus: 'APPROVED' })
        } else {
          await tx
            .update(stockOpnameItems)
            .set({ itemStatus: 'REJECTED', decidedById: currentUserId, decidedAt: now, decisionNote: note })
            .where(eq(stockOpnameItems.id, item.id))

          await tx.insert(auditLogs).values({
            branchId: so.branchId,
            userId: currentUserId,
            action: 'STOCK_OPNAME_ITEM_REJECT',
            tableName: 'stock_opname_items',
            recordId: String(item.id),
            oldData: JSON.stringify({ itemStatus: 'PENDING' }),
            newData: JSON.stringify({ itemStatus: 'REJECTED', decisionNote: note }),
          })

          decided.push({ id: item.id, itemStatus: 'REJECTED' })
        }
      }

      // Tutup SO otomatis begitu tidak ada item PENDING tersisa — approval per-item
      // menggantikan tombol "Setujui SO" untuk SO Besar.
      const remaining = await tx
        .select({ id: stockOpnameItems.id })
        .from(stockOpnameItems)
        .where(and(eq(stockOpnameItems.soId, soId), eq(stockOpnameItems.itemStatus, 'PENDING')))
        .limit(1)

      let soClosed = false
      if (remaining.length === 0) {
        await tx
          .update(stockOpnames)
          .set({ status: 'APPROVED', approvedById: currentUserId, approvedAt: now, completedAt: now })
          .where(eq(stockOpnames.id, soId))
        soClosed = true
      }

      return { decided, soClosed }
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    if (error instanceof SOItemAdjustmentError) {
      if (error.cause instanceof InsufficientStockError) {
        return NextResponse.json(
          {
            error: `Stok "${error.productName}" tidak cukup untuk penyesuaian opname — kemungkinan terjual setelah dihitung. ${error.cause.message} Lakukan hitung ulang produk ini.`,
          },
          { status: 422 }
        )
      }
      console.error(
        `PATCH /api/bo/stock-opnames/[id]/items/decide gagal pada produk "${error.productName}":`,
        error.cause
      )
      return NextResponse.json({ error: 'Terjadi kesalahan saat memproses keputusan item' }, { status: 500 })
    }

    if (error instanceof Error) {
      if (error.message === 'SO_NOT_FOUND') {
        return NextResponse.json({ error: 'Stock opname tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'NOT_FULL_SO') {
        return NextResponse.json(
          { error: 'Persetujuan per-item hanya berlaku untuk SO Besar' },
          { status: 400 }
        )
      }
      if (error.message === 'STILL_COUNTING') {
        return NextResponse.json({ error: 'Stock opname masih dihitung di POS' }, { status: 400 })
      }
      if (error.message === 'ALREADY_PROCESSED') {
        return NextResponse.json({ error: 'Stock opname sudah selesai diproses' }, { status: 400 })
      }
      if (error.message === 'BRANCH_FORBIDDEN') {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda hanya dapat memutuskan stock opname cabang Anda sendiri.' },
          { status: 403 }
        )
      }
      if (error.message === 'ITEM_NOT_FOUND') {
        return NextResponse.json({ error: 'Item tidak ditemukan pada stock opname ini' }, { status: 404 })
      }
      if (error.message === 'ITEM_NOT_PENDING') {
        return NextResponse.json(
          { error: 'Item ini sudah cocok otomatis atau sudah diputuskan sebelumnya' },
          { status: 409 }
        )
      }
    }
    console.error('PATCH /api/bo/stock-opnames/[id]/items/decide error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat memproses keputusan item' }, { status: 500 })
  }
}
