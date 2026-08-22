import Big from 'big.js'
import { formatWIB } from '@petshop/shared'
import { db, branches, categories, brands, eq, asc } from '@/lib/db'
import {
  getStockValuationReport,
  parseStockValuationFilters,
  type StockValuationData,
} from '@/lib/services/report-service'
import StockValuationFilter, { type RefOption } from './_components/stock-valuation-filter'

function formatRupiah(value: string): string {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(new Big(value).toNumber())
  } catch {
    return 'Rp 0'
  }
}

function formatQty(value: string): string {
  try {
    return new Big(value).toFixed(2)
  } catch {
    return '0.00'
  }
}

export default async function StockValuationPage({
  searchParams,
}: {
  searchParams: Promise<{
    branchId?: string
    categoryId?: string
    brandId?: string
    search?: string
    minValue?: string
    includeInactive?: string
    sort?: string
  }>
}) {
  const params = await searchParams
  const filters = parseStockValuationFilters(params)

  const [branchRows, categoryRows, brandRows] = await Promise.all([
    db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(eq(branches.isActive, true))
      .orderBy(asc(branches.name)),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.name)),
    db
      .select({ id: brands.id, name: brands.name })
      .from(brands)
      .orderBy(asc(brands.name)),
  ])

  const branchOptions: RefOption[] = branchRows
  const categoryOptions: RefOption[] = categoryRows
  const brandOptions: RefOption[] = brandRows

  let reportData: StockValuationData | null = null
  let error: string | null = null

  try {
    reportData = await getStockValuationReport(filters)
  } catch {
    error = 'Gagal mengambil data laporan. Silakan coba lagi.'
  }

  const exportParams = new URLSearchParams()
  if (filters.branchId != null) exportParams.set('branchId', String(filters.branchId))
  if (filters.categoryId != null) exportParams.set('categoryId', String(filters.categoryId))
  if (filters.brandId != null) exportParams.set('brandId', String(filters.brandId))
  if (filters.search) exportParams.set('search', filters.search)
  if (filters.minValue != null) exportParams.set('minValue', String(filters.minValue))
  if (filters.includeInactive) exportParams.set('includeInactive', '1')
  if (filters.sort !== 'branch') exportParams.set('sort', filters.sort)
  const exportQuery = exportParams.toString()

  const hasFilter =
    filters.branchId != null ||
    filters.categoryId != null ||
    filters.brandId != null ||
    filters.search != null ||
    filters.minValue != null ||
    filters.includeInactive

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Laporan Nilai Stok FIFO</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nilai inventaris saat ini berdasarkan metode First-In First-Out
          </p>
        </div>
        {reportData && (
          <a
            href={`/api/bo/reports/stock-valuation/export${exportQuery ? `?${exportQuery}` : ''}`}
            className="px-4 py-2 text-sm font-bold text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-all"
          >
            Export CSV
          </a>
        )}
      </div>

      <div className="mb-6">
        <StockValuationFilter
          branches={branchOptions}
          categories={categoryOptions}
          brands={brandOptions}
          defaultBranchId={params.branchId}
          defaultCategoryId={params.categoryId}
          defaultBrandId={params.brandId}
          defaultSearch={params.search}
          defaultMinValue={params.minValue}
          defaultIncludeInactive={filters.includeInactive}
          defaultSort={filters.sort}
        />
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      {/* Tabel Laporan */}
      {reportData && (
        <div className="bg-card rounded-lg border border-border overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
            <h2 className="text-sm font-bold text-card-foreground">
              {reportData.totalProducts} produk · {reportData.totalRows} baris produk × cabang
              {hasFilter && <span className="text-muted-foreground font-medium"> (terfilter)</span>}
            </h2>
            <p className="text-xs text-muted-foreground">
              Dibuat pada: {formatWIB(reportData.generatedAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>

          {reportData.items.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted-foreground text-sm">
              {hasFilter
                ? 'Tidak ada produk yang cocok dengan filter ini'
                : 'Tidak ada produk dengan stok tersedia saat ini'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground border-b border-border">
                    <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">No</th>
                    <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Nama Produk</th>
                    <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">SKU</th>
                    <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Kategori</th>
                    <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Brand</th>
                    <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Cabang</th>
                    <th className="text-right px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Stok</th>
                    <th className="text-right px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Nilai Stok (FIFO)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reportData.items.map((item, index) => (
                    <tr
                      key={`${item.productId}-${item.branchId}`}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-6 py-4 text-muted-foreground">{index + 1}</td>
                      <td className="px-6 py-4 font-semibold text-card-foreground">{item.productName}</td>
                      <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{item.sku ?? '-'}</td>
                      <td className="px-6 py-4 text-muted-foreground">{item.categoryName ?? '-'}</td>
                      <td className="px-6 py-4 text-muted-foreground">{item.brandName ?? '-'}</td>
                      <td className="px-6 py-4 text-card-foreground">{item.branchName}</td>
                      <td className="px-6 py-4 text-right font-medium text-card-foreground">
                        {item.stockDisplay}
                        <span className="block text-[11px] text-muted-foreground font-normal">
                          ({formatQty(item.totalQty)})
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(item.totalValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40">
                    <td className="px-6 py-4 font-bold text-card-foreground" colSpan={7}>TOTAL</td>
                    <td className="px-6 py-4 text-right font-bold text-primary">
                      {formatRupiah(reportData.totalValue)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
