import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { and, auditLogs, db, eq, inArray, stockOpnameItems, stockOpnames } from '@/lib/db'
import { computeItemVariance } from '@/lib/services/stock-opname'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        id: z.number().int().positive('ID item tidak valid'),
        physicalQty: z.number().int('Qty fisik harus bilangan bulat').min(0, 'Qty fisik tidak boleh negatif'),
        varianceReason: z.string().trim().max(500, 'Alasan maksimal 500 karakter').nullable().optional(),
      })
    )
    .min(1, 'Tidak ada item yang diubah')
    .max(500, 'Terlalu banyak item dalam satu permintaan'),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const gate = await requirePermission('stock_opname.edit_item')
    if (gate instanceof NextResponse) return gate
    const payload = gate

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

    const requested = parsed.data.items
    if (new Set(requested.map((i) => i.id)).size !== requested.length) {
      return NextResponse.json({ error: 'Terdapat item duplikat dalam permintaan' }, { status: 400 })
    }

    const updated = await db.transaction(async (tx) => {
      const soRows = await tx
        .select({
          id: stockOpnames.id,
          status: stockOpnames.status,
          branchId: stockOpnames.branchId,
          soNumber: stockOpnames.soNumber,
        })
        .from(stockOpnames)
        .where(eq(stockOpnames.id, soId))
        .for('update')
        .limit(1)

      if (soRows.length === 0) throw new Error('SO_NOT_FOUND')
      const so = soRows[0]

      if (so.status !== 'DRAFT' && so.status !== 'PENDING') throw new Error('SO_LOCKED')

      if (payload.branchScope !== 'ALL' && payload.branchId !== so.branchId) {
        throw new Error('BRANCH_FORBIDDEN')
      }

      const existing = await tx
        .select({
          id: stockOpnameItems.id,
          productId: stockOpnameItems.productId,
          uomId: stockOpnameItems.uomId,
          systemQty: stockOpnameItems.systemQty,
          physicalQty: stockOpnameItems.physicalQty,
          varianceQty: stockOpnameItems.varianceQty,
          varianceCostValue: stockOpnameItems.varianceCostValue,
          varianceReason: stockOpnameItems.varianceReason,
        })
        .from(stockOpnameItems)
        // Filter soId bukan sekadar optimasi: tanpa itu id item milik SO lain ikut termuat.
        .where(
          and(
            eq(stockOpnameItems.soId, soId),
            inArray(
              stockOpnameItems.id,
              requested.map((i) => i.id)
            )
          )
        )

      const existingById = new Map(existing.map((row) => [row.id, row]))
      for (const item of requested) {
        if (!existingById.has(item.id)) throw new Error('ITEM_NOT_FOUND')
      }

      const results: {
        id: number
        physicalQty: number
        varianceQty: number
        varianceCostValue: number
        varianceReason: string | null
      }[] = []

      for (const item of requested) {
        const prev = existingById.get(item.id)!
        const reason = item.varianceReason?.trim() ? item.varianceReason.trim() : null

        // systemQty adalah snapshot saat menghitung — dipertahankan supaya koreksi
        // qty fisik tidak menggeser baseline ke stok yang sudah bergerak sejak SO dibuat.
        const variance = await computeItemVariance(tx, so.branchId, {
          productId: prev.productId,
          uomId: prev.uomId,
          physicalQty: item.physicalQty,
          systemQtyOverride: prev.systemQty,
        })

        const unchanged =
          prev.physicalQty === variance.physicalQty && prev.varianceReason === reason
        if (unchanged) {
          results.push({
            id: prev.id,
            physicalQty: prev.physicalQty,
            varianceQty: prev.varianceQty,
            varianceCostValue: prev.varianceCostValue ?? 0,
            varianceReason: prev.varianceReason,
          })
          continue
        }

        await tx
          .update(stockOpnameItems)
          .set({
            physicalQty: variance.physicalQty,
            varianceQty: variance.varianceQty,
            varianceCostValue: variance.varianceCostValue,
            varianceReason: reason,
          })
          .where(eq(stockOpnameItems.id, prev.id))

        await tx.insert(auditLogs).values({
          branchId: so.branchId,
          userId: payload.userId,
          action: 'STOCK_OPNAME_ITEM_EDIT',
          tableName: 'stock_opname_items',
          recordId: String(prev.id),
          oldData: JSON.stringify({
            physicalQty: prev.physicalQty,
            varianceQty: prev.varianceQty,
            varianceCostValue: prev.varianceCostValue,
            varianceReason: prev.varianceReason,
          }),
          newData: JSON.stringify({
            soNumber: so.soNumber,
            physicalQty: variance.physicalQty,
            varianceQty: variance.varianceQty,
            varianceCostValue: variance.varianceCostValue,
            varianceReason: reason,
          }),
        })

        results.push({
          id: prev.id,
          physicalQty: variance.physicalQty,
          varianceQty: variance.varianceQty,
          varianceCostValue: variance.varianceCostValue,
          varianceReason: reason,
        })
      }

      return results
    })

    return NextResponse.json({ items: updated })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'SO_NOT_FOUND') {
        return NextResponse.json({ error: 'Stock opname tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'SO_LOCKED') {
        return NextResponse.json(
          { error: 'Stock opname sudah diproses, item tidak dapat diubah lagi' },
          { status: 400 }
        )
      }
      if (error.message === 'BRANCH_FORBIDDEN') {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda hanya dapat mengubah stock opname cabang Anda sendiri.' },
          { status: 403 }
        )
      }
      if (error.message === 'ITEM_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Item tidak ditemukan pada stock opname ini' },
          { status: 404 }
        )
      }
    }
    console.error('PATCH /api/bo/stock-opnames/[id]/items error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menyimpan koreksi item stock opname' },
      { status: 500 }
    )
  }
}
