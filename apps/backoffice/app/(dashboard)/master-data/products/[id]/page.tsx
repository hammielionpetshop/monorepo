import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  db,
  products,
  categories,
  brands,
  unitsOfMeasure,
  productUomConversions,
  branches,
  eq,
} from '@/lib/db'
import ProductDetailTabs from './_components/product-detail-tabs'

export const dynamic = 'force-dynamic'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const productId = Number(id)

  // Fetch product first — outside try/catch so notFound() propagates correctly
  const productResult = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      barcode: products.barcode,
      isActive: products.isActive,
      baseUomId: products.baseUomId,
      defaultCostPrice: products.defaultCostPrice,
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
    .limit(1)

  if (productResult.length === 0) notFound()

  const product = productResult[0]

  let conversions: Awaited<ReturnType<typeof fetchConversions>> = []
  let allUoms: Awaited<ReturnType<typeof fetchAllUoms>> = []
  let allBranches: Awaited<ReturnType<typeof fetchAllBranches>> = []
  let error: string | null = null

  try {
    ;[conversions, allUoms, allBranches] = await Promise.all([
      fetchConversions(productId),
      fetchAllUoms(),
      fetchAllBranches(),
    ])
  } catch {
    error = 'Terjadi kesalahan saat mengambil data konversi UOM'
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

  const uomsForPricing = [
    { id: product.baseUomId, code: product.uomCode ?? '-', name: product.uomName ?? '-', isBase: true, ratio: 1 },
    ...conversions
      .filter((c) => c.uomId !== null && c.uomId !== product.baseUomId)
      .map((c) => ({
        id: c.uomId as number,
        code: c.uomCode ?? '-',
        name: c.uomName ?? '-',
        isBase: false,
        ratio: c.ratio ?? 1,
      })),
  ]

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4 bg-muted/30 rounded-lg border border-border">
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
        <div>
          <p className="text-xs text-muted-foreground">Harga Modal Default</p>
          <p className="text-sm font-medium text-foreground">
            {product.defaultCostPrice != null
              ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(product.defaultCostPrice)
              : 'Belum diatur'}
          </p>
        </div>
      </div>

      {/* Tabs: Satuan & Harga */}
      <ProductDetailTabs
        productId={product.id}
        initialConversions={conversions}
        availableUoms={allUoms}
        baseUomId={product.baseUomId}
        branches={allBranches}
        uomsForPricing={uomsForPricing}
      />
    </div>
  )
}

function fetchConversions(productId: number) {
  return db
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
}

function fetchAllUoms() {
  return db
    .select({
      id: unitsOfMeasure.id,
      code: unitsOfMeasure.code,
      name: unitsOfMeasure.name,
    })
    .from(unitsOfMeasure)
    .orderBy(unitsOfMeasure.name)
}

function fetchAllBranches() {
  return db
    .select({ id: branches.id, code: branches.code, name: branches.name })
    .from(branches)
    .where(eq(branches.isActive, true))
    .orderBy(branches.name)
}
