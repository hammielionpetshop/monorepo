import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { verifyAccessToken } from '@/lib/auth'
import { hasPermission } from '@/lib/authz'
import { formatWIB } from '@petshop/shared'
import { db, categories, brands, asc } from '@/lib/db'
import {
  getStockOverviewReport,
  parseStockOverviewFilters,
  type StockOverviewData,
} from '@/lib/services/report-service'
import StockOverviewFilter from './_components/stock-overview-filter'
import StockOverviewClient from './_components/stock-overview-client'

function formatRupiah(value: string): string {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value))
  } catch {
    return 'Rp 0'
  }
}

export const dynamic = 'force-dynamic'

export default async function StockOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    categoryId?: string
    brandId?: string
    search?: string
    minValue?: string
    includeInactive?: string
    sort?: string
  }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload) redirect('/login')

  if (!hasPermission(payload, 'report.stock_overview.view')) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">Akses Ditolak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hanya Owner, GM, dan Manager yang dapat melihat ringkasan stok per produk.
          </p>
        </div>
      </div>
    )
  }

  const params = await searchParams
  const filters = parseStockOverviewFilters(params)
  // Manager/user branch-scope bukan 'ALL' hanya melihat cabangnya sendiri — override
  // apa pun yang ada di query, sama seperti scopeFilter() di route API lain.
  if (payload.branchScope !== 'ALL') {
    filters.branchId = payload.branchId
  }

  const [categoryRows, brandRows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name)),
    db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name)),
  ])

  let reportData: StockOverviewData | null = null
  let error: string | null = null

  try {
    reportData = await getStockOverviewReport(filters)
  } catch {
    error = 'Gagal mengambil data laporan. Silakan coba lagi.'
  }

  const hasFilter =
    filters.categoryId != null ||
    filters.brandId != null ||
    filters.search != null ||
    filters.minValue != null ||
    filters.includeInactive

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link href="/reports/stock-valuation" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-all">
          ← Laporan Nilai Stok FIFO
        </Link>
        <h1 className="text-2xl font-bold text-foreground mt-1">Ringkasan Stok per Produk</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Stok &amp; nilai FIFO diagregasi lintas cabang. Klik baris untuk lihat breakdown per cabang, lalu per batch.
        </p>
      </div>

      <div className="mb-6">
        <StockOverviewFilter
          categories={categoryRows}
          brands={brandRows}
          defaultCategoryId={params.categoryId}
          defaultBrandId={params.brandId}
          defaultSearch={params.search}
          defaultMinValue={params.minValue}
          defaultIncludeInactive={filters.includeInactive}
          defaultSort={filters.sort}
        />
      </div>

      {error && (
        <div className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      {reportData && (
        <div className="bg-card rounded-lg border border-border overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
            <h2 className="text-sm font-bold text-card-foreground">
              {reportData.totalProducts} produk
              {hasFilter && <span className="text-muted-foreground font-medium"> (terfilter)</span>}
              {Number(reportData.totalShortfallValue) > 0 && (
                <span className="text-destructive font-medium"> · Total utang stok {formatRupiah(reportData.totalShortfallValue)}</span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground">
              Dibuat pada: {formatWIB(reportData.generatedAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>

          <StockOverviewClient items={reportData.items} />

          {reportData.items.length > 0 && (
            <div className="border-t-2 border-border bg-muted/40 px-6 py-4 flex items-center justify-between">
              <span className="font-bold text-card-foreground">TOTAL</span>
              <span className="font-bold text-primary">{formatRupiah(reportData.totalValue)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
