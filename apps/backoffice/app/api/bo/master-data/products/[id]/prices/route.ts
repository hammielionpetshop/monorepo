import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Big from 'big.js'
import { PRICE_TIERS } from '@petshop/shared'
import { getAuth, requirePermission } from '@/lib/authz'
import { db, products, branches, productPrices, eq, and } from '@/lib/db'

export const dynamic = 'force-dynamic'

const MAX_PRICE = new Big('9999999999.99')

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID produk tidak valid'),
})

const putSchema = z.object({
  branchId: z.number().int().positive('branchId wajib diisi'),
  prices: z.array(z.object({
    uomId: z.number().int().positive(),
    tierType: z.enum(PRICE_TIERS),
    price: z.string().min(1),
  })),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getAuth()
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400 })
    }
    const productId = Number(paramParsed.data.id)

    const branchIdParam = req.nextUrl.searchParams.get('branchId')
    if (!branchIdParam || !/^\d+$/.test(branchIdParam)) {
      return NextResponse.json({ error: 'branchId query parameter wajib diisi' }, { status: 400 })
    }
    const branchId = Number(branchIdParam)

    const result = await db
      .select({
        uomId: productPrices.uomId,
        tierType: productPrices.tierType,
        price: productPrices.price,
      })
      .from(productPrices)
      .where(
        and(
          eq(productPrices.productId, productId),
          eq(productPrices.branchId, branchId)
        )
      )

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('GET /api/bo/master-data/products/[id]/prices error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data harga' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requirePermission('master.price.manage')
    if (gate instanceof NextResponse) return gate

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400 })
    }
    const productId = Number(paramParsed.data.id)

    const contentType = req.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type harus application/json' }, { status: 415 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Format request tidak valid' }, { status: 400 })
    }

    const parsed = putSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    // Validasi setiap harga: non-negatif dan dalam batas kolom decimal(12,2)
    for (const row of parsed.data.prices) {
      try {
        const p = new Big(row.price)
        if (p.lt(0)) throw new Error('negative')
        if (p.gt(MAX_PRICE)) throw new Error('overflow')
      } catch (e) {
        const msg = e instanceof Error && e.message === 'overflow'
          ? 'Harga melebihi batas maksimum yang diizinkan'
          : 'Harga tidak valid'
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    }

    // Cek duplikat (uomId, tierType) dalam satu request
    const seenKeys = new Set<string>()
    for (const row of parsed.data.prices) {
      const key = `${row.uomId}:${row.tierType}`
      if (seenKeys.has(key)) {
        return NextResponse.json({ error: 'Terdapat entri harga duplikat untuk UOM dan tier yang sama' }, { status: 400 })
      }
      seenKeys.add(key)
    }

    const branch = await db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.id, parsed.data.branchId))
      .limit(1)
    if (branch.length === 0) {
      return NextResponse.json({ error: 'Cabang tidak ditemukan' }, { status: 404 })
    }

    const product = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)
    if (product.length === 0) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
    }

    await db.transaction(async (trx) => {
      await trx
        .delete(productPrices)
        .where(
          and(
            eq(productPrices.productId, productId),
            eq(productPrices.branchId, parsed.data.branchId)
          )
        )

      if (parsed.data.prices.length > 0) {
        await trx.insert(productPrices).values(
          parsed.data.prices.map(row => ({
            productId,
            branchId: parsed.data.branchId,
            uomId: row.uomId,
            tierType: row.tierType,
            price: Math.round(new Big(row.price).toNumber()),
          }))
        )
      }
    })

    return NextResponse.json({ message: 'Harga berhasil disimpan' })
  } catch (error: unknown) {
    console.error('PUT /api/bo/master-data/products/[id]/prices error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan harga' }, { status: 500 })
  }
}