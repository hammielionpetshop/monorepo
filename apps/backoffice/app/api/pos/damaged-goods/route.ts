import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import {
  db,
  damagedGoods,
  damagedGoodsItems,
  shifts,
  products,
  unitsOfMeasure,
  users,
  eq,
  and,
  desc,
  inArray,
  sql,
} from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'
import { getPosBranchId } from '@/lib/pos-branch'
import { StockService } from '@/lib/services/stock-service'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  reason: z.enum(['RUSAK', 'EXPIRED', 'HILANG'], { message: 'Alasan tidak valid' }),
  notes: z.string().max(500, 'Catatan maksimal 500 karakter').optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        uomId: z.number().int().positive(),
        qty: z.number().int().positive('Qty harus lebih dari 0'),
      }),
    )
    .min(1, 'Minimal satu item barang rusak'),
})

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }

  if (!req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }

  const branchId = getPosBranchId(payload, cookieStore)
  const { reason, notes, items } = parsed.data

  try {
    const [activeShift] = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(and(eq(shifts.branchId, branchId), eq(shifts.status, 'OPEN')))
      .limit(1)

    const header = await db.transaction(async (tx) => {
      let totalLossValue = 0
      const itemsToInsert: {
        productId: number
        uomId: number
        qty: number
        costPrice: number
        lossValue: number
      }[] = []

      for (const item of items) {
        // allowNegative = false → barang rusak menolak bila stok tidak cukup (tidak boleh minus)
        const deduction = await StockService.deductStock(
          tx,
          branchId,
          item.productId,
          item.uomId,
          item.qty,
          false,
        )

        const lossValue = Math.round(deduction.totalCogs)
        totalLossValue += lossValue

        itemsToInsert.push({
          productId: item.productId,
          uomId: item.uomId,
          qty: item.qty,
          costPrice: item.qty > 0 ? Math.round(lossValue / item.qty) : 0,
          lossValue,
        })
      }

      const [created] = await tx
        .insert(damagedGoods)
        .values({
          branchId,
          shiftId: activeShift?.id ?? null,
          reportedById: payload.userId,
          reason,
          notes: notes ?? null,
          totalLossValue,
          reportedAt: new Date(),
        })
        .returning()

      await tx.insert(damagedGoodsItems).values(
        itemsToInsert.map((it) => ({ ...it, damagedGoodsId: created.id })),
      )

      return created
    })

    return NextResponse.json({ success: true, data: header }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal mencatat barang rusak'
    if (/stok tidak cukup/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    console.error('[damaged-goods] POST error:', error)
    return NextResponse.json({ error: 'Gagal mencatat barang rusak' }, { status: 500 })
  }
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }

  const branchId = getPosBranchId(payload, cookieStore)

  try {
    const [activeShift] = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(and(eq(shifts.branchId, branchId), eq(shifts.status, 'OPEN')))
      .limit(1)

    // Prioritas: entri shift aktif. Bila tidak ada shift OPEN, tampilkan entri hari ini (WIB).
    const scopeFilter = activeShift
      ? eq(damagedGoods.shiftId, activeShift.id)
      : and(
          eq(damagedGoods.branchId, branchId),
          sql`(${damagedGoods.reportedAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date = (now() AT TIME ZONE 'Asia/Jakarta')::date`,
        )

    const headers = await db
      .select({
        id: damagedGoods.id,
        reason: damagedGoods.reason,
        notes: damagedGoods.notes,
        totalLossValue: damagedGoods.totalLossValue,
        reportedAt: damagedGoods.reportedAt,
        reportedByName: users.name,
      })
      .from(damagedGoods)
      .leftJoin(users, eq(damagedGoods.reportedById, users.id))
      .where(scopeFilter)
      .orderBy(desc(damagedGoods.reportedAt))
      .limit(100)

    const ids = headers.map((h) => h.id)
    const itemRows = ids.length
      ? await db
          .select({
            damagedGoodsId: damagedGoodsItems.damagedGoodsId,
            productName: products.name,
            uomCode: unitsOfMeasure.code,
            qty: damagedGoodsItems.qty,
            lossValue: damagedGoodsItems.lossValue,
          })
          .from(damagedGoodsItems)
          .leftJoin(products, eq(damagedGoodsItems.productId, products.id))
          .leftJoin(unitsOfMeasure, eq(damagedGoodsItems.uomId, unitsOfMeasure.id))
          .where(inArray(damagedGoodsItems.damagedGoodsId, ids))
      : []

    const itemsByHeader = new Map<number, { productName: string; uomCode: string; qty: number; lossValue: number }[]>()
    for (const row of itemRows) {
      const list = itemsByHeader.get(row.damagedGoodsId) ?? []
      list.push({
        productName: row.productName ?? 'Produk Dihapus',
        uomCode: row.uomCode ?? '-',
        qty: row.qty,
        lossValue: row.lossValue,
      })
      itemsByHeader.set(row.damagedGoodsId, list)
    }

    const data = headers.map((h) => ({
      id: h.id,
      reason: h.reason,
      notes: h.notes,
      totalLossValue: h.totalLossValue,
      reportedAt: h.reportedAt instanceof Date ? h.reportedAt.toISOString() : String(h.reportedAt),
      reportedByName: h.reportedByName ?? '-',
      items: itemsByHeader.get(h.id) ?? [],
    }))

    return NextResponse.json({ hasActiveShift: !!activeShift, data })
  } catch (error) {
    console.error('[damaged-goods] GET error:', error)
    return NextResponse.json({ error: 'Gagal mengambil data barang rusak' }, { status: 500 })
  }
}
