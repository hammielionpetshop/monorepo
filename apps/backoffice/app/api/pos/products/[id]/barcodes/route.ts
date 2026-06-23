import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { db, products, productBarcodes, eq, asc } from '@/lib/db'
import { assertBarcodeUnique } from '@/lib/services/barcode'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({ id: z.string().regex(/^\d+$/, 'ID produk tidak valid') })
const bodySchema = z.object({
  barcode: z.string().trim().min(1, 'Barcode wajib diisi').max(50, 'Barcode maksimal 50 karakter'),
})

async function auth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  return token ? await verifyAccessTokenCached(token) : null
}

// GET — daftar semua barcode (utama + tambahan) untuk satu produk
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await auth()
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }

  const parsed = paramsSchema.safeParse(await params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400 })
  }
  const productId = Number(parsed.data.id)

  const product = await db
    .select({ id: products.id, barcode: products.barcode })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)
  if (product.length === 0) {
    return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
  }

  const extras = await db
    .select({ id: productBarcodes.id, barcode: productBarcodes.barcode })
    .from(productBarcodes)
    .where(eq(productBarcodes.productId, productId))
    .orderBy(asc(productBarcodes.id))

  return NextResponse.json({
    primary: product[0].barcode,
    barcodes: extras,
  })
}

// POST — tambah barcode. Bila produk belum punya barcode utama, isi itu;
// jika sudah, simpan sebagai barcode tambahan.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const payload = await auth()
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }

  const parsedParams = paramsSchema.safeParse(await params)
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400 })
  }
  const productId = Number(parsedParams.data.id)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body harus berupa JSON yang valid' }, { status: 400 })
  }
  const parsedBody = bodySchema.safeParse(body)
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? 'Data tidak valid' },
      { status: 400 }
    )
  }
  const barcode = parsedBody.data.barcode.trim()

  try {
    const result = await db.transaction(async (trx) => {
      const existing = await trx
        .select({ id: products.id, barcode: products.barcode })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1)
      if (existing.length === 0) throw new Error('NOT_FOUND')

      await assertBarcodeUnique(trx, barcode, productId)

      if (!existing[0].barcode) {
        const updated = await trx
          .update(products)
          .set({ barcode, updatedAt: new Date() })
          .where(eq(products.id, productId))
          .returning({ barcode: products.barcode })
        return { target: 'primary' as const, barcode: updated[0].barcode }
      }

      const inserted = await trx
        .insert(productBarcodes)
        .values({ productId, barcode, isPrimary: false })
        .returning({ id: productBarcodes.id, barcode: productBarcodes.barcode })
      return { target: 'extra' as const, ...inserted[0] }
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'DUPLICATE_BARCODE') {
        return NextResponse.json({ error: 'Barcode sudah dipakai produk lain' }, { status: 409 })
      }
    }
    console.error('POST /api/pos/products/[id]/barcodes error:', error)
    return NextResponse.json({ error: 'Gagal menambahkan barcode' }, { status: 500 })
  }
}
