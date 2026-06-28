import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { db, products, categories, brands, eq, and, isNull } from '@/lib/db'

export const dynamic = 'force-dynamic'

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
        name: products.name,
        categoryName: categories.name,
        brandName: brands.name,
        isActive: products.isActive,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(and(isNull(products.barcode), eq(products.isActive, true)))
      .orderBy(products.name)

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('GET /api/bo/products/without-barcode error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil daftar produk' }, { status: 500 })
  }
}
