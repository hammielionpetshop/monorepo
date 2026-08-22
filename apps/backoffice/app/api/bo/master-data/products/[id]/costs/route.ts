import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Big from 'big.js'
import { getAuth, requirePermission } from '@/lib/authz'
import { db, products, branches, productUomCosts, eq, and } from '@/lib/db'
import { applyPriceBulk } from '@/lib/services/price-service'

export const dynamic = 'force-dynamic'

const MAX_COST_PRICE = new Big('9999999999')
const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID produk tidak valid'),
})

// `changes` = sel yang diisi/diubah user sejak halaman dibuka, `deletes` = sel yang
// dikosongkan. HANYA sel yang benar-benar disentuh yang dikirim — bukan seluruh
// tabel harga modal produk — supaya simpan dari halaman ini tidak menimpa balik
// harga modal yang baru saja diubah orang lain lewat grid Master Data > Harga.
const putSchema = z.object({
  branchId: z.number().int().positive('branchId wajib diisi'),
  changes: z.array(z.object({
    uomId: z.number().int().positive(),
    costPrice: z.string().min(1),
  })).max(200, 'Maksimal 200 perubahan sekaligus').default([]),
  deletes: z.array(z.object({
    uomId: z.number().int().positive(),
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
        uomId: productUomCosts.uomId,
        costPrice: productUomCosts.costPrice,
      })
      .from(productUomCosts)
      .where(
        and(
          eq(productUomCosts.productId, productId),
          eq(productUomCosts.branchId, branchId)
        )
      )

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('GET /api/bo/master-data/products/[id]/costs error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data harga modal' }, { status: 500 })
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

    const costPriceByUom: Record<number, number> = {}
    for (const row of parsed.data.changes) {
      try {
        const cost = new Big(row.costPrice)
        if (!cost.round(0).eq(cost)) throw new Error('invalid')
        if (cost.lt(0)) throw new Error('invalid')
        if (cost.gt(MAX_COST_PRICE)) throw new Error('overflow')
        costPriceByUom[row.uomId] = cost.toNumber()
      } catch (error) {
        const message = error instanceof Error && error.message === 'overflow'
          ? 'Harga modal melebihi batas maksimum yang diizinkan'
          : 'Harga modal tidak valid'
        return NextResponse.json({ error: message }, { status: 400 })
      }
    }

    // Cek duplikat uomId — baik di antara changes maupun deletes, satu UOM tidak
    // boleh diisi sekaligus dikosongkan dalam request yang sama
    const seenUoms = new Set<number>()
    for (const row of [...parsed.data.changes, ...parsed.data.deletes]) {
      if (seenUoms.has(row.uomId)) {
        return NextResponse.json({ error: 'Terdapat entri harga modal duplikat untuk UOM yang sama' }, { status: 400 })
      }
      seenUoms.add(row.uomId)
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
        changes: [],
        costChanges: parsed.data.changes.map(row => ({
          productId,
          uomId: row.uomId,
          costPrice: costPriceByUom[row.uomId],
        })),
        costDeletes: parsed.data.deletes.map(row => ({
          productId,
          uomId: row.uomId,
        })),
        actor: { userId: gate.userId, source: 'MANUAL' },
      })
    } catch (e) {
      if (e instanceof Error) {
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
      throw e
    }

    return NextResponse.json({ message: 'Harga modal berhasil disimpan' })
  } catch (error: unknown) {
    console.error('PUT /api/bo/master-data/products/[id]/costs error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan harga modal' }, { status: 500 })
  }
}
