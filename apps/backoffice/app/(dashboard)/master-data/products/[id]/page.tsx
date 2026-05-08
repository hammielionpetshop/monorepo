import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  db,
  products,
  categories,
  brands,
  unitsOfMeasure,
  productUomConversions,
  eq,
} from '@/lib/db'
import UomConversionClient from './_components/uom-conversion-client'

export const dynamic = 'force-dynamic'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const productId = Number(id)

  let error: string | null = null

  try {
    const [productResult, conversions, allUoms] = await Promise.all([
      db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          barcode: products.barcode,
          isActive: products.isActive,
          baseUomId: products.baseUomId,
          categoryName: categories.name,
          brandName: brands.name,
          uomCode: unitsOfMeasure.code,
          uomName: unitsOfMeasure.name,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(brands, eq(products.brandId, brands.id))
        .leftJoin(unitsOfMeasure, eq(products.baseUomId, unitsOfMeasure.id))
        .where(eq(products.id, productId))
        .limit(1),
      db
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
        .where(eq(productUomConversions.productId, productId)),
      db
        .select({
          id: unitsOfMeasure.id,
          code: unitsOfMeasure.code,
          name: unitsOfMeasure.name,
        })
        .from(unitsOfMeasure)
        .orderBy(unitsOfMeasure.name),
    ])

    if (productResult.length === 0) notFound()

    const product = productResult[0]

    return (
      <div className="p-6">
        {/* Back link */}
        <Link
          href="/master-data/products"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          ← Kembali ke Daftar Produk
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{product.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {product.sku && (
                <span className="text-sm text-muted-foreground">SKU: {product.sku}</span>
              )}
              <span
                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  product.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {product.isActive ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
          </div>
        </div>

        {/* Info ringkas produk */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-muted/30 rounded-lg border border-border">
          <div>
            <p className="text-xs text-muted-foreground">UOM Dasar</p>
            <p className="text-sm font-medium text-foreground">
              {product.uomName ?? '-'} ({product.uomCode ?? '-'})
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Kategori</p>
            <p className="text-sm font-medium text-foreground">{product.categoryName ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Brand</p>
            <p className="text-sm font-medium text-foreground">{product.brandName ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Barcode</p>
            <p className="text-sm font-medium text-foreground">{product.barcode ?? '-'}</p>
          </div>
        </div>

        {/* Tab — hanya Satuan saat ini (Story 7.4 akan tambah Harga) */}
        <div className="border-b border-border mb-6">
          <nav className="flex gap-0">
            <span className="px-4 py-2 text-sm font-medium text-primary border-b-2 border-primary">
              Satuan
            </span>
          </nav>
        </div>

        {/* Tab content: Satuan */}
        <UomConversionClient
          productId={product.id}
          initialConversions={conversions}
          availableUoms={allUoms}
          baseUomId={product.baseUomId}
        />
      </div>
    )
  } catch {
    error = 'Terjadi kesalahan saat mengambil data produk'
  }

  if (error) {
    return (
      <div className="p-6">
        <Link
          href="/master-data/products"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          ← Kembali ke Daftar Produk
        </Link>
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    )
  }

  return null
}
