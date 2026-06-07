import { db, products, categories, brands, unitsOfMeasure, eq } from '@/lib/db'
import ProductClient from './_components/product-client'
import type { Product, Category, Brand, Uom } from './_components/types'

export const dynamic = 'force-dynamic'

type ProductRow = Product

export default async function ProductsPage() {
  let productsData: ProductRow[] = []
  let categoriesData: Category[] = []
  let brandsData: Brand[] = []
  let uomsData: Uom[] = []
  let error: string | null = null

  try {
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
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .leftJoin(unitsOfMeasure, eq(products.baseUomId, unitsOfMeasure.id))
      .orderBy(products.name)

    productsData = result

    const [cats, brds, uoms] = await Promise.all([
      db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(categories.name),
      db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(brands.name),
      db
        .select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code, name: unitsOfMeasure.name, isBase: unitsOfMeasure.isBase })
        .from(unitsOfMeasure)
        .orderBy(unitsOfMeasure.name),
    ])

    categoriesData = cats
    brandsData = brds
    uomsData = uoms
  } catch (e) {
    console.error('ProductsPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data'
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Master Data Produk</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kelola data produk, kategori, brand, dan UOM
          </p>
        </div>
      </div>

      <ProductClient
        products={productsData}
        categories={categoriesData}
        brands={brandsData}
        uoms={uomsData}
      />
    </div>
  )
}
