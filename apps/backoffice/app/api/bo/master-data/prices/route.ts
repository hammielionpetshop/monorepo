import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import Big from 'big.js'
import { PRICE_TIERS } from '@petshop/shared'
import { getAuth, requirePermission } from '@/lib/authz'
import { db, productPrices, productUomCosts, eq, and } from '@/lib/db'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
type PriceDataRow = { product_id: number; uom_id: number }
type CostRow = { product_id: number; uom_id: number; cost_price: number }
type CountRow = { total: string }
const MAX_PRICE = new Big('9999999999')

const bulkPutSchema = z.object({
  branchId: z.number().int().positive('branchId wajib diisi'),
  changes: z.array(z.object({
    productId: z.number().int().positive(),
    uomId:     z.number().int().positive(),
    tierType:  z.enum(PRICE_TIERS),
    price:     z.number().int().min(0, 'Harga tidak boleh negatif'),
  })).max(500, 'Maksimal 500 perubahan sekaligus').default([]),
  costChanges: z.array(z.object({
    productId: z.number().int().positive(),
    uomId:     z.number().int().positive(),
    costPrice: z.number().int().min(0, 'Harga modal tidak boleh negatif'),
  })).max(500, 'Maksimal 500 perubahan sekaligus').default([]),
}).refine(d => d.changes.length > 0 || d.costChanges.length > 0, {
  message: 'Tidak ada perubahan yang dikirim',
})

export async function GET(req: NextRequest) {
  try {
    const payload = await getAuth()
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { searchParams } = req.nextUrl

    const branchIdParam = searchParams.get('branchId')
    if (!branchIdParam || !/^\d+$/.test(branchIdParam)) {
      return NextResponse.json({ error: 'branchId wajib diisi' }, { status: 400 })
    }
    const branchId = Number(branchIdParam)

    const categoryIdParam = searchParams.get('categoryId')
    const categoryId = categoryIdParam && /^\d+$/.test(categoryIdParam) ? Number(categoryIdParam) : null

    const search = searchParams.get('search')?.trim() ?? null
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
    const offset = (page - 1) * PAGE_SIZE

    const whereCategory = categoryId !== null
      ? sql`AND p.category_id = ${categoryId}`
      : sql``

    const whereSearch = search
      ? sql`AND p.name ILIKE ${'%' + search + '%'}`
      : sql``

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`
        SELECT COUNT(*) AS total
        FROM (
          SELECT p.id, pp.uom_id
          FROM petshop.products p
          JOIN petshop.product_prices pp
            ON pp.product_id = p.id AND pp.branch_id = ${branchId}
          WHERE true ${whereCategory} ${whereSearch}
          GROUP BY p.id, pp.uom_id
        ) sub
      `),
      db.execute(sql`
        SELECT
          p.id            AS product_id,
          p.name          AS product_name,
          p.base_uom_id,
          bu.code         AS base_uom_code,
          pp.uom_id,
          u.code          AS uom_code,
          u.name          AS uom_name,
          puc.id          AS conversion_id,
          puc.ratio       AS conversion_ratio,
          json_object_agg(pp.tier_type, pp.price ORDER BY pp.tier_type) AS prices
        FROM petshop.products p
        JOIN petshop.product_prices pp
          ON pp.product_id = p.id AND pp.branch_id = ${branchId}
        JOIN petshop.units_of_measure u ON u.id = pp.uom_id
        JOIN petshop.units_of_measure bu ON bu.id = p.base_uom_id
        LEFT JOIN petshop.product_uom_conversions puc
          ON puc.product_id = p.id AND puc.uom_id = pp.uom_id
        WHERE true ${whereCategory} ${whereSearch}
        GROUP BY p.id, p.name, p.base_uom_id, bu.code, pp.uom_id, u.code, u.name, puc.id, puc.ratio
        ORDER BY p.name, u.code
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `),
    ])

    // Fetch harga modal terpisah — fallback null jika tabel belum ada di DB
    const costMap: Record<string, number> = {}
    try {
      const costRows = await db.execute(sql`
        SELECT product_id, uom_id, cost_price
        FROM petshop.product_uom_costs
        WHERE branch_id = ${branchId}
      `) as unknown as CostRow[]
      for (const row of costRows) {
        costMap[`${row.product_id}:${row.uom_id}`] = row.cost_price
      }
    } catch {
      // Tabel belum ada — cost_price null untuk semua baris
    }

    const data = (dataResult as unknown as PriceDataRow[]).map(row => ({
      ...row,
      cost_price: costMap[`${row.product_id}:${row.uom_id}`] ?? null,
    }))

    return NextResponse.json({
      data,
      total: Number((countResult[0] as unknown as CountRow).total),
      page,
      pageSize: PAGE_SIZE,
    })
  } catch (error) {
    console.error('GET /api/bo/master-data/prices error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data harga' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const gate = await requirePermission('master.price.manage')
    if (gate instanceof NextResponse) return gate

    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    let body: unknown
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = bulkPutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    const { branchId, changes, costChanges } = parsed.data

    for (const c of changes) {
      if (new Big(c.price).gt(MAX_PRICE)) {
        return NextResponse.json({ error: 'Harga melebihi batas maksimum yang diizinkan' }, { status: 400 })
      }
    }
    for (const c of costChanges) {
      if (new Big(c.costPrice).gt(MAX_PRICE)) {
        return NextResponse.json({ error: 'Harga modal melebihi batas maksimum yang diizinkan' }, { status: 400 })
      }
    }

    await db.transaction(async (tx) => {
      if (changes.length > 0) {
        await tx
          .insert(productPrices)
          .values(changes.map(c => ({
            productId: c.productId,
            branchId,
            uomId:     c.uomId,
            tierType:  c.tierType,
            price:     c.price,
          })))
          .onConflictDoUpdate({
            target: [productPrices.productId, productPrices.branchId, productPrices.uomId, productPrices.tierType],
            set: { price: sql`excluded.price` },
          })
      }
      if (costChanges.length > 0) {
        await tx
          .insert(productUomCosts)
          .values(costChanges.map(c => ({
            productId: c.productId,
            branchId,
            uomId:     c.uomId,
            costPrice: c.costPrice,
          })))
          .onConflictDoUpdate({
            target: [productUomCosts.productId, productUomCosts.branchId, productUomCosts.uomId],
            set: { costPrice: sql`excluded.cost_price` },
          })
      }
    })

    return NextResponse.json({ updated: changes.length + costChanges.length })
  } catch (error) {
    console.error('PUT /api/bo/master-data/prices error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan harga' }, { status: 500 })
  }
}

// Hapus semua harga tier + harga modal satu produk-UOM di SATU cabang (konversi global tidak disentuh)
export async function DELETE(req: NextRequest) {
  try {
    const gate = await requirePermission('master.price.manage')
    if (gate instanceof NextResponse) return gate

    const { searchParams } = req.nextUrl
    const branchIdParam = searchParams.get('branchId')
    const productIdParam = searchParams.get('productId')
    const uomIdParam = searchParams.get('uomId')
    if (
      !branchIdParam || !/^\d+$/.test(branchIdParam) ||
      !productIdParam || !/^\d+$/.test(productIdParam) ||
      !uomIdParam || !/^\d+$/.test(uomIdParam)
    ) {
      return NextResponse.json({ error: 'branchId, productId, dan uomId wajib diisi' }, { status: 400 })
    }
    const branchId = Number(branchIdParam)
    const productId = Number(productIdParam)
    const uomId = Number(uomIdParam)

    let deletedPrices = 0
    await db.transaction(async (tx) => {
      const deleted = await tx
        .delete(productPrices)
        .where(and(
          eq(productPrices.productId, productId),
          eq(productPrices.branchId, branchId),
          eq(productPrices.uomId, uomId),
        ))
        .returning({ id: productPrices.id })
      deletedPrices = deleted.length
      await tx
        .delete(productUomCosts)
        .where(and(
          eq(productUomCosts.productId, productId),
          eq(productUomCosts.branchId, branchId),
          eq(productUomCosts.uomId, uomId),
        ))
    })

    return NextResponse.json({ deleted: deletedPrices })
  } catch (error) {
    console.error('DELETE /api/bo/master-data/prices error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menghapus harga' }, { status: 500 })
  }
}
