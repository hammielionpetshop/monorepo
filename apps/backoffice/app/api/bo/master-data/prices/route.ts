import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import Big from 'big.js'
import { PRICE_TIERS } from '@petshop/shared'
import { verifyAccessToken } from '@/lib/auth'
import { db, productPrices, productUomCosts } from '@/lib/db'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50
const ALLOWED_MUTATE_ROLES = ['OWNER', 'GM']
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
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
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
          pp.uom_id,
          u.code          AS uom_code,
          u.name          AS uom_name,
          json_object_agg(pp.tier_type, pp.price ORDER BY pp.tier_type) AS prices,
          MAX(puc.cost_price) AS cost_price
        FROM petshop.products p
        JOIN petshop.product_prices pp
          ON pp.product_id = p.id AND pp.branch_id = ${branchId}
        JOIN petshop.units_of_measure u ON u.id = pp.uom_id
        LEFT JOIN petshop.product_uom_costs puc
          ON puc.product_id = p.id AND puc.branch_id = ${branchId} AND puc.uom_id = pp.uom_id
        WHERE true ${whereCategory} ${whereSearch}
        GROUP BY p.id, p.name, pp.uom_id, u.code, u.name
        ORDER BY p.name, u.code
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `),
    ])

    return NextResponse.json({
      data: dataResult,
      total: Number((countResult[0] as { total: string }).total),
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
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (!ALLOWED_MUTATE_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Owner dan GM yang dapat mengubah harga.' }, { status: 403 })
    }

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
