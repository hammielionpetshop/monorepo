import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, products, categories, brands, unitsOfMeasure, eq } from '@/lib/db'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  name: z.string().min(1, 'Nama produk wajib diisi'),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  brandId: z.number().int().positive().optional().nullable(),
  baseUomId: z.number().int().positive({ message: 'UOM dasar wajib dipilih' }),
  weightGram: z.union([z.string(), z.number()]).optional().nullable(),
  defaultCostPrice: z.number().int().nonnegative().optional().nullable(),
})

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const result = await db
      .select({
        id: products.id,
        sku: products.sku,
        barcode: products.barcode,
        name: products.name,
        categoryId: products.categoryId,
        categoryName: categories.name,
        brandId: products.brandId,
        brandName: brands.name,
        baseUomId: products.baseUomId,
        uomCode: unitsOfMeasure.code,
        uomName: unitsOfMeasure.name,
        weightGram: products.weightGram,
        defaultCostPrice: products.defaultCostPrice,
        isActive: products.isActive,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .leftJoin(unitsOfMeasure, eq(products.baseUomId, unitsOfMeasure.id))
      .orderBy(products.name)

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('GET /api/bo/master-data/products error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil daftar produk' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Data tidak valid'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const data = parsed.data

    const newProduct = await db.transaction(async (trx) => {
      // Validasi foreign keys
      if (data.categoryId) {
        const cat = await trx.select({ id: categories.id }).from(categories).where(eq(categories.id, data.categoryId)).limit(1)
        if (cat.length === 0) throw new Error('Kategori tidak ditemukan')
      }
      if (data.brandId) {
        const br = await trx.select({ id: brands.id }).from(brands).where(eq(brands.id, data.brandId)).limit(1)
        if (br.length === 0) throw new Error('Brand tidak ditemukan')
      }
      const uom = await trx.select({ id: unitsOfMeasure.id, isBase: unitsOfMeasure.isBase }).from(unitsOfMeasure).where(eq(unitsOfMeasure.id, data.baseUomId)).limit(1)
      if (uom.length === 0) throw new Error('UOM dasar tidak ditemukan')
      if (!uom[0].isBase) throw new Error('UOM yang dipilih bukan UOM dasar')

      // Cek uniqueness SKU
      if (data.sku) {
        const existing = await trx.select({ id: products.id }).from(products).where(eq(products.sku, data.sku)).limit(1)
        if (existing.length > 0) throw new Error('DUPLICATE_SKU')
      }

      // Cek uniqueness barcode
      if (data.barcode) {
        const existing = await trx.select({ id: products.id }).from(products).where(eq(products.barcode, data.barcode)).limit(1)
        if (existing.length > 0) throw new Error('DUPLICATE_BARCODE')
      }

      const result = await trx
        .insert(products)
        .values({
          name: data.name,
          sku: data.sku || null,
          barcode: data.barcode || null,
          categoryId: data.categoryId || null,
          brandId: data.brandId || null,
          baseUomId: data.baseUomId,
          weightGram: data.weightGram != null && data.weightGram !== '' ? Number(data.weightGram) : null,
          defaultCostPrice: data.defaultCostPrice ?? null,
        })
        .returning()

      if (result.length === 0) throw new Error('Insert gagal')
      return result
    })

    return NextResponse.json(newProduct[0], { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'DUPLICATE_SKU') {
        return NextResponse.json({ error: 'SKU sudah digunakan oleh produk lain' }, { status: 409 })
      }
      if (error.message === 'DUPLICATE_BARCODE') {
        return NextResponse.json({ error: 'Barcode sudah digunakan oleh produk lain' }, { status: 409 })
      }
      if (
        error.message === 'Kategori tidak ditemukan' ||
        error.message === 'Brand tidak ditemukan' ||
        error.message === 'UOM dasar tidak ditemukan' ||
        error.message === 'UOM yang dipilih bukan UOM dasar'
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }
    console.error('POST /api/bo/master-data/products error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan produk' }, { status: 500 })
  }
}
