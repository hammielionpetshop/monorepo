import { db, products, categories, brands, eq, and, isNull } from '@/lib/db'
import BarcodePrintClient from './_components/barcode-print-client'
import type { BarcodeProduct } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function BarcodePrintPage() {
  let productsData: BarcodeProduct[] = []
  let error: string | null = null

  try {
    productsData = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        categoryName: categories.name,
        brandName: brands.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(and(isNull(products.barcode), eq(products.isActive, true)))
      .orderBy(products.name)
  } catch (e) {
    console.error('BarcodePrintPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data produk'
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Generator &amp; Cetak Label Barcode</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Buat barcode internal (EAN-13) untuk produk yang belum punya barcode, lalu cetak labelnya massal dalam lembar.
        </p>
      </div>

      <BarcodePrintClient initialProducts={productsData} />
    </div>
  )
}
