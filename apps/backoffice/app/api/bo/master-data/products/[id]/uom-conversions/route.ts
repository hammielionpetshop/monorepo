import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import Big from 'big.js'
import { verifyAccessToken } from '@/lib/auth'
import { db, products, productUomConversions, unitsOfMeasure, eq, and } from '@/lib/db'

export const dynamic = 'force-dynamic'

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID produk tidak valid'),
})

const createSchema = z.object({
  uomId: z.number().int().positive('UOM wajib dipilih'),
  ratio: z.string().min(1, 'Ratio wajib diisi'),
  weightGram: z.string().optional().nullable(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400 })
    }
    const productId = Number(paramParsed.data.id)

    const product = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)
    if (product.length === 0) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
    }

    const result = await db
      .select({
        id: productUomConversions.id,
        uomId: productUomConversions.uomId,
        uomCode: unitsOfMeasure.code,
        uomName: unitsOfMeasure.name,
        ratio: productUomConversions.ratio,
        weightGram: productUomConversions.weightGram,
      })
      .from(productUomConversions)
      .leftJoin(unitsOfMeasure, eq(productUomConversions.uomId, unitsOfMeasure.id))
      .where(eq(productUomConversions.productId, productId))

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('GET /api/bo/master-data/products/[id]/uom-conversions error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data konversi UOM' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const { id } = await params
    const paramParsed = paramsSchema.safeParse({ id })
    if (!paramParsed.success) {
      return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400 })
    }
    const productId = Number(paramParsed.data.id)

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
    }

    // Validasi ratio > 0 dengan big.js
    let ratioBig: Big
    try {
      ratioBig = new Big(parsed.data.ratio)
      if (ratioBig.lte(0)) throw new Error()
    } catch {
      return NextResponse.json({ error: 'Ratio harus lebih dari 0' }, { status: 400 })
    }

    // Validasi weightGram jika diisi
    let weightGramStr: string | null = null
    if (parsed.data.weightGram) {
      try {
        const w = new Big(parsed.data.weightGram)
        if (w.lte(0)) throw new Error()
        weightGramStr = w.toString()
      } catch {
        return NextResponse.json({ error: 'Berat harus lebih dari 0' }, { status: 400 })
      }
    }

    const result = await db.transaction(async (trx) => {
      // Cek produk ada
      const product = await trx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1)
      if (product.length === 0) throw new Error('NOT_FOUND')

      // Cek UOM ada
      const uom = await trx
        .select({ id: unitsOfMeasure.id })
        .from(unitsOfMeasure)
        .where(eq(unitsOfMeasure.id, parsed.data.uomId))
        .limit(1)
      if (uom.length === 0) throw new Error('UOM tidak ditemukan')

      // Cek duplikat (uomId sudah ada untuk productId ini)
      const existing = await trx
        .select({ id: productUomConversions.id })
        .from(productUomConversions)
        .where(
          and(
            eq(productUomConversions.productId, productId),
            eq(productUomConversions.uomId, parsed.data.uomId)
          )
        )
        .limit(1)
      if (existing.length > 0) throw new Error('DUPLICATE_UOM')

      return await trx
        .insert(productUomConversions)
        .values({
          productId,
          uomId: parsed.data.uomId,
          ratio: ratioBig.toString(),
          weightGram: weightGramStr,
        })
        .returning()
    })

    return NextResponse.json(result[0], { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'DUPLICATE_UOM') {
        return NextResponse.json({ error: 'UOM ini sudah dikonfigurasi untuk produk ini' }, { status: 409 })
      }
      if (error.message === 'UOM tidak ditemukan') {
        return NextResponse.json({ error: 'UOM tidak ditemukan' }, { status: 400 })
      }
    }
    console.error('POST /api/bo/master-data/products/[id]/uom-conversions error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan konversi UOM' }, { status: 500 })
  }
}
