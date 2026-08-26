import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { and, auditLogs, db, eq, inArray, stockOpnameItems, stockOpnames } from '@/lib/db'
import { computeItemVariance, resolveItemStatus } from '@/lib/services/stock-opname'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID tidak valid'),
})

const physicalQtySchema = z
  .number()
  .int('Qty fisik harus bilangan bulat')
  .min(0, 'Qty fisik tidak boleh negatif')
const varianceReasonSchema = z.string().trim().max(500, 'Alasan maksimal 500 karakter').nullable().optional()

// `id` = koreksi item yang sudah ada (perilaku lama). Tanpa `id` = item baru
// (dipakai input langsung SO Besar dari backoffice) — wajib productId+uomId
// supaya baris stock_opname_items bisa dibuat, dan cuma boleh untuk SO Besar
// (dicek di handler, bukan di sini, karena butuh tipe SO dari DB).
const itemSchema = z
  .object({
    id: z.number().int().positive('ID item tidak valid').optional(),
    productId: z.number().int().positive('Produk tidak valid').optional(),
    uomId: z.number().int().positive('UOM tidak valid').optional(),
    physicalQty: physicalQtySchema,
    varianceReason: varianceReasonSchema,
  })
  .superRefine((val, ctx) => {
    if (val.id === undefined && (val.productId === undefined || val.uomId === undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Item baru wajib menyertakan productId dan uomId',
      })
    }
  })

const bodySchema = z.object({
  items: z.array(itemSchema).min(1, 'Tidak ada item yang diubah').max(500, 'Terlalu banyak item dalam satu permintaan'),
})

type ExistingItemRow = {
  id: number
  productId: number
  uomId: number
  systemQty: number
  physicalQty: number
  varianceQty: number
  varianceCostValue: number | null
  varianceReason: string | null
  itemStatus: string | null
}

type ResultItem = {
  id: number
  productId: number
  uomId: number
  physicalQty: number
  varianceQty: number
  varianceCostValue: number
  varianceReason: string | null
  itemStatus: string | null
}

function requestKey(item: { id?: number; productId?: number; uomId?: number }) {
  return item.id !== undefined ? `id:${item.id}` : `new:${item.productId}:${item.uomId}`
}

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
    if (new Set(requested.map(requestKey)).size !== requested.length) {
      return NextResponse.json({ error: 'Terdapat item duplikat dalam permintaan' }, { status: 400 })
    }

    const existingRequested = requested.filter(
      (item): item is typeof item & { id: number } => item.id !== undefined
    )
    const newRequested = requested.filter(
      (item): item is typeof item & { productId: number; uomId: number } => item.id === undefined
    )

    const updated = await db.transaction(async (tx) => {
      const soRows = await tx
        .select({
          id: stockOpnames.id,
          status: stockOpnames.status,
          branchId: stockOpnames.branchId,
          soNumber: stockOpnames.soNumber,
          type: stockOpnames.type,
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

      if (newRequested.length > 0 && so.type !== 'FULL') {
        throw new Error('NEW_ITEM_NOT_ALLOWED')
      }

      const existingById = new Map<number, ExistingItemRow>()
      if (existingRequested.length > 0) {
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
            itemStatus: stockOpnameItems.itemStatus,
          })
          .from(stockOpnameItems)
          // Filter soId bukan sekadar optimasi: tanpa itu id item milik SO lain ikut termuat.
          .where(
            and(
              eq(stockOpnameItems.soId, soId),
              inArray(
                stockOpnameItems.id,
                existingRequested.map((i) => i.id)
              )
            )
          )
        for (const row of existing) existingById.set(row.id, row)
      }

      for (const item of existingRequested) {
        const row = existingById.get(item.id)
        if (!row) throw new Error('ITEM_NOT_FOUND')
        // Item yang sudah diputuskan (APPROVED/REJECTED) stoknya sudah disesuaikan
        // berdasarkan qty saat itu — koreksi sesudahnya akan membuat catatan menyimpang
        // dari penyesuaian yang sudah terjadi.
        if (row.itemStatus === 'APPROVED' || row.itemStatus === 'REJECTED') {
          throw new Error('ITEM_ALREADY_DECIDED')
        }
      }

      // Item baru bisa saja sudah ada (produk yang sama sudah pernah dihitung dari
      // POS sejak daftar kandidat terakhir diambil) — kalau begitu, diperlakukan
      // sebagai koreksi, bukan insert dobel.
      const existingByProductId = new Map<string, ExistingItemRow>()
      if (newRequested.length > 0) {
        const rows = await tx
          .select({
            id: stockOpnameItems.id,
            productId: stockOpnameItems.productId,
            uomId: stockOpnameItems.uomId,
            systemQty: stockOpnameItems.systemQty,
            physicalQty: stockOpnameItems.physicalQty,
            varianceQty: stockOpnameItems.varianceQty,
            varianceCostValue: stockOpnameItems.varianceCostValue,
            varianceReason: stockOpnameItems.varianceReason,
            itemStatus: stockOpnameItems.itemStatus,
          })
          .from(stockOpnameItems)
          .where(
            and(
              eq(stockOpnameItems.soId, soId),
              inArray(
                stockOpnameItems.productId,
                newRequested.map((i) => i.productId)
              )
            )
          )
        for (const row of rows) existingByProductId.set(`${row.productId}:${row.uomId}`, row)
      }

      for (const item of newRequested) {
        const row = existingByProductId.get(`${item.productId}:${item.uomId}`)
        if (row && (row.itemStatus === 'APPROVED' || row.itemStatus === 'REJECTED')) {
          throw new Error('ITEM_ALREADY_DECIDED')
        }
      }

      const results: ResultItem[] = []

      for (const item of existingRequested) {
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
        const itemStatus = resolveItemStatus(so.type, variance.varianceQty)

        const unchanged = prev.physicalQty === variance.physicalQty && prev.varianceReason === reason
        if (unchanged) {
          results.push({
            id: prev.id,
            productId: prev.productId,
            uomId: prev.uomId,
            physicalQty: prev.physicalQty,
            varianceQty: prev.varianceQty,
            varianceCostValue: prev.varianceCostValue ?? 0,
            varianceReason: prev.varianceReason,
            itemStatus: prev.itemStatus,
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
            itemStatus,
            // Qty fisik dikoreksi ulang — hasil recount sebelumnya (kalau ada) tak lagi relevan.
            isRecounted: false,
            recountPhysicalQty: null,
            recountSystemQty: null,
            recountVarianceQty: null,
            recountedById: null,
            recountedAt: null,
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
          productId: prev.productId,
          uomId: prev.uomId,
          physicalQty: variance.physicalQty,
          varianceQty: variance.varianceQty,
          varianceCostValue: variance.varianceCostValue,
          varianceReason: reason,
          itemStatus,
        })
      }

      for (const item of newRequested) {
        const reason = item.varianceReason?.trim() ? item.varianceReason.trim() : null
        const existingRow = existingByProductId.get(`${item.productId}:${item.uomId}`)

        if (existingRow) {
          // Sudah ada (mis. baru masuk dari POS) — treat sebagai koreksi, bukan insert.
          const variance = await computeItemVariance(tx, so.branchId, {
            productId: existingRow.productId,
            uomId: existingRow.uomId,
            physicalQty: item.physicalQty,
            systemQtyOverride: existingRow.systemQty,
          })
          const itemStatus = resolveItemStatus(so.type, variance.varianceQty)

          await tx
            .update(stockOpnameItems)
            .set({
              physicalQty: variance.physicalQty,
              varianceQty: variance.varianceQty,
              varianceCostValue: variance.varianceCostValue,
              varianceReason: reason,
              itemStatus,
              isRecounted: false,
              recountPhysicalQty: null,
              recountSystemQty: null,
              recountVarianceQty: null,
              recountedById: null,
              recountedAt: null,
            })
            .where(eq(stockOpnameItems.id, existingRow.id))

          results.push({
            id: existingRow.id,
            productId: existingRow.productId,
            uomId: existingRow.uomId,
            physicalQty: variance.physicalQty,
            varianceQty: variance.varianceQty,
            varianceCostValue: variance.varianceCostValue,
            varianceReason: reason,
            itemStatus,
          })
          continue
        }

        // Item benar-benar baru — baca systemQty live (bukan snapshot token seperti
        // jalur POS: input backoffice terjadi dalam satu sesi di depan layar).
        const variance = await computeItemVariance(tx, so.branchId, {
          productId: item.productId,
          uomId: item.uomId,
          physicalQty: item.physicalQty,
        })
        const itemStatus = resolveItemStatus(so.type, variance.varianceQty)

        const [inserted] = await tx
          .insert(stockOpnameItems)
          .values({
            soId,
            productId: item.productId,
            uomId: item.uomId,
            systemQty: variance.systemQty,
            physicalQty: variance.physicalQty,
            varianceQty: variance.varianceQty,
            varianceCostValue: variance.varianceCostValue,
            varianceReason: reason,
            itemStatus,
          })
          .returning({ id: stockOpnameItems.id })

        results.push({
          id: inserted.id,
          productId: item.productId,
          uomId: item.uomId,
          physicalQty: variance.physicalQty,
          varianceQty: variance.varianceQty,
          varianceCostValue: variance.varianceCostValue,
          varianceReason: reason,
          itemStatus,
        })
      }

      // Hitungan pertama masuk dari backoffice — SO yang tadinya cuma header kosong
      // sekarang siap disetujui, sama seperti saat POS mengisi item pertamanya.
      if (so.status === 'DRAFT') {
        await tx.update(stockOpnames).set({ status: 'PENDING' }).where(eq(stockOpnames.id, soId))
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
      if (error.message === 'NEW_ITEM_NOT_ALLOWED') {
        return NextResponse.json(
          { error: 'Item baru hanya dapat ditambahkan untuk SO Besar' },
          { status: 400 }
        )
      }
      if (error.message === 'ITEM_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Item tidak ditemukan pada stock opname ini' },
          { status: 404 }
        )
      }
      if (error.message === 'ITEM_ALREADY_DECIDED') {
        return NextResponse.json(
          { error: 'Item ini sudah diputuskan admin, tidak bisa dikoreksi lagi' },
          { status: 409 }
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
