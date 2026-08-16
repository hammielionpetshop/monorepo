import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { PRICE_TIERS } from '@petshop/shared'
import { getAuth, requirePermission } from '@/lib/authz'
import { db, productPrices, productUomCosts, eq, and } from '@/lib/db'
import { applyPriceBulk } from '@/lib/services/price-service'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
type PriceDataRow = { product_id: number; uom_id: number }
type CostRow = { product_id: number; uom_id: number; cost_price: number }
type CountRow = { total: string }

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

    // Baris = satuan dasar produk (selalu ada, walau belum berharga) UNION
    // satuan lain yang sudah punya harga di cabang ini. Produk tanpa harga
    // tetap tampil agar bisa diisi dari halaman ini.
    const pairsCte = sql`
      WITH filtered_products AS (
        SELECT p.id, p.name, p.base_uom_id
        FROM petshop.products p
        WHERE p.is_active = true ${whereCategory} ${whereSearch}
      ),
      pairs AS (
        SELECT fp.id AS product_id, fp.base_uom_id AS uom_id
        FROM filtered_products fp
        UNION
        SELECT fp.id, pp.uom_id
        FROM filtered_products fp
        JOIN petshop.product_prices pp
          ON pp.product_id = fp.id AND pp.branch_id = ${branchId}
      )
    `

    const [countResult, dataResult] = await Promise.all([
      db.execute(sql`${pairsCte} SELECT COUNT(*) AS total FROM pairs`),
      db.execute(sql`
        ${pairsCte}
        SELECT
          pr.product_id,
          fp.name         AS product_name,
          fp.base_uom_id,
          bu.code         AS base_uom_code,
          pr.uom_id,
          u.code          AS uom_code,
          u.name          AS uom_name,
          puc.id          AS conversion_id,
          puc.ratio       AS conversion_ratio,
          COALESCE(
            json_object_agg(pp.tier_type, pp.price ORDER BY pp.tier_type)
              FILTER (WHERE pp.tier_type IS NOT NULL),
            '{}'::json
          ) AS prices
        FROM pairs pr
        JOIN filtered_products fp ON fp.id = pr.product_id
        JOIN petshop.units_of_measure u ON u.id = pr.uom_id
        JOIN petshop.units_of_measure bu ON bu.id = fp.base_uom_id
        LEFT JOIN petshop.product_uom_conversions puc
          ON puc.product_id = pr.product_id AND puc.uom_id = pr.uom_id
        LEFT JOIN petshop.product_prices pp
          ON pp.product_id = pr.product_id AND pp.uom_id = pr.uom_id AND pp.branch_id = ${branchId}
        GROUP BY pr.product_id, fp.name, fp.base_uom_id, bu.code, pr.uom_id, u.code, u.name, puc.id, puc.ratio
        ORDER BY fp.name, (pr.uom_id <> fp.base_uom_id), u.code
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

    try {
      const result = await applyPriceBulk({
        branchId,
        changes,
        costChanges,
        actor: { userId: gate.userId, source: 'MANUAL' },
      })
      return NextResponse.json(result)
    } catch (e) {
      if (e instanceof Error) {
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
      throw e
    }
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
