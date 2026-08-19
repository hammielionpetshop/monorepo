import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Big from 'big.js'
import { PRICE_TIERS } from '@petshop/shared'
import { getAuth, requirePermission } from '@/lib/authz'
import { db, products, branches, productPrices, eq, and } from '@/lib/db'
import { applyPriceBulk } from '@/lib/services/price-service'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID produk tidak valid'),
})

// `changes` = sel yang diisi/diubah user sejak halaman dibuka, `deletes` = sel yang
// dikosongkan. HANYA sel yang benar-benar disentuh yang dikirim — bukan seluruh
// tabel harga produk — supaya simpan dari halaman ini tidak menimpa balik harga
// yang baru saja diubah orang lain lewat grid Master Data > Harga di sel lain.
const putSchema = z.object({
  branchId: z.number().int().positive('branchId wajib diisi'),
  changes: z.array(z.object({
    uomId: z.number().int().positive(),
    tierType: z.enum(PRICE_TIERS),
    price: z.string().min(1),
  })).max(200, 'Maksimal 200 perubahan sekaligus').default([]),
  deletes: z.array(z.object({
    uomId: z.number().int().positive(),
    tierType: z.enum(PRICE_TIERS),
  })).max(200, 'Maksimal 200 penghapusan sekaligus').default([]),
}).refine(d => d.changes.length > 0 || d.deletes.length > 0, {
  message: 'Tidak ada perubahan yang dikirim',
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

    // Validasi harga tiap perubahan (non-negatif) + parse ke integer. Batas atas
    // & validasi konversi UOM ditangani applyPriceBulk supaya konsisten dengan grid.
    const priceByKey: Record<string, number> = {}
    for (const row of parsed.data.changes) {
      try {
        const p = new Big(row.price)
        if (p.lt(0)) throw new Error()
        priceByKey[`${row.uomId}:${row.tierType}`] = Math.round(p.toNumber())
      } catch {
        return NextResponse.json({ error: 'Harga tidak valid' }, { status: 400 })
      }
    }

    // Cek duplikat (uomId, tierType) — baik di antara changes maupun deletes,
    // satu sel tidak boleh diisi sekaligus dikosongkan dalam request yang sama
    const seenKeys = new Set<string>()
    for (const row of [...parsed.data.changes, ...parsed.data.deletes]) {
      const key = `${row.uomId}:${row.tierType}`
      if (seenKeys.has(key)) {
        return NextResponse.json({ error: 'Terdapat entri duplikat untuk UOM dan tier yang sama' }, { status: 400 })
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

    try {
      await applyPriceBulk({
        branchId: parsed.data.branchId,
        changes: parsed.data.changes.map(row => ({
          productId,
          uomId: row.uomId,
          tierType: row.tierType,
          price: priceByKey[`${row.uomId}:${row.tierType}`],
        })),
        costChanges: [],
        deletes: parsed.data.deletes.map(row => ({
          productId,
          uomId: row.uomId,
          tierType: row.tierType,
        })),
        actor: { userId: gate.userId, source: 'MANUAL' },
      })
    } catch (e) {
      if (e instanceof Error) {
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
      throw e
    }

    return NextResponse.json({ message: 'Harga berhasil disimpan' })
  } catch (error: unknown) {
    console.error('PUT /api/bo/master-data/products/[id]/prices error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan harga' }, { status: 500 })
  }
}