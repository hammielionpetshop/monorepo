import Big from 'big.js'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { formatWIB } from '@petshop/shared'
import { verifyAccessToken } from '@/lib/auth'
import { hasPermission } from '@/lib/authz'
import { db, branches, categories, brands, eq, asc } from '@/lib/db'
import {
  getStockValuationReport,
  parseStockValuationFilters,
  type StockValuationData,
} from '@/lib/services/report-service'
import StockValuationFilter, { type RefOption } from './_components/stock-valuation-filter'
import StockValuationTable from './_components/stock-valuation-table'

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

  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  const canViewOverview = payload ? hasPermission(payload, 'report.stock_overview.view') : false

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
        <div className="flex items-center gap-2">
          {canViewOverview && (
            <Link
              href="/reports/stock-overview"
              className="px-4 py-2 text-sm font-bold text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-all"
            >
              Ringkasan per Produk
            </Link>
          )}
          {reportData && (
            <a
              href={`/api/bo/reports/stock-valuation/export${exportQuery ? `?${exportQuery}` : ''}`}
              className="px-4 py-2 text-sm font-bold text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-all"
            >
              Export CSV
            </a>
          )}
        </div>
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
        <div>
          <div className="mb-4 rounded-lg border border-border bg-card px-6 py-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-card-foreground">
                {reportData.totalProducts} produk · {reportData.totalRows} baris produk × cabang
                {hasFilter && <span className="text-muted-foreground font-medium"> (terfilter)</span>}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dibuat pada: {formatWIB(reportData.generatedAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Nilai Stok</p>
              <p className="text-xl font-bold text-primary">{formatRupiah(reportData.totalValue)}</p>
            </div>
          </div>

          <StockValuationTable
            items={reportData.items}
            emptyMessage={
              hasFilter
                ? 'Tidak ada produk yang cocok dengan filter ini'
                : 'Tidak ada produk dengan stok tersedia saat ini'
            }
          />
        </div>
      )}
    </div>
  )
}
