import { redirect } from 'next/navigation'

import { getAuth, hasPermission } from '@/lib/authz'
import { db, branches, eq } from '@/lib/db'
import { getStockOpnameReport, type SOReportData } from '@/lib/services/stock-opname-report'
import SOReportFilter from './_components/so-report-filter'
import SOReportTables from './_components/so-report-tables'
import { formatRupiah } from './_components/format'

export const dynamic = 'force-dynamic'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_RANGE_DAYS = 30

function wibToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

function wibDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

export default async function StockOpnameReportPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string; branchId?: string; status?: string }>
}) {
  const payload = await getAuth()
  if (!payload) redirect('/login')

  if (!hasPermission(payload, 'stock_opname.read')) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">Akses Ditolak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Anda tidak memiliki akses untuk melihat laporan stock opname.
          </p>
        </div>
      </div>
    )
  }

  const isGlobal = payload.branchScope === 'ALL'
  const branchOptions = isGlobal
    ? await db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(eq(branches.isActive, true))
        .orderBy(branches.name)
    : []

  const params = await searchParams
  const startDate = params.startDate ?? wibDaysAgo(DEFAULT_RANGE_DAYS)
  const endDate = params.endDate ?? wibToday()
  const status = params.status || null

  let reportData: SOReportData | null = null
  let error: string | null = null

  if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) {
    error = 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD.'
  } else if (startDate > endDate) {
    error = 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai.'
  } else {
    const parsedBranch = params.branchId ? Number(params.branchId) : null
    const scopedBranchId = isGlobal
      ? Number.isInteger(parsedBranch) && parsedBranch! > 0
        ? parsedBranch
        : null
      : payload.branchId
    try {
      reportData = await getStockOpnameReport({ startDate, endDate, branchId: scopedBranchId, status })
    } catch (e) {
      console.error('StockOpnameReportPage error:', e)
      error = 'Gagal mengambil data laporan stock opname. Silakan coba lagi.'
    }
  }

  const query = new URLSearchParams({ startDate, endDate })
  if (params.branchId) query.set('branchId', params.branchId)
  if (status) query.set('status', status)
  const exportQuery = query.toString()

  const summary = reportData?.summary

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Laporan Hasil Stock Opname</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Rekap hasil SO beserta akurasi hitungan dan produk yang selisihnya berulang
        </p>
      </div>

      <SOReportFilter
        defaultStartDate={startDate}
        defaultEndDate={endDate}
        defaultBranchId={params.branchId}
        defaultStatus={status ?? ''}
        branches={isGlobal ? branchOptions : undefined}
      />

      {error && (
        <div className="mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
            <div className="bg-card rounded-lg border border-border p-5 shadow-xs">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                SO Disetujui
              </p>
              <p className="text-xl font-bold text-card-foreground mt-1">{summary.approvedCount}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-5 shadow-xs">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Item Dihitung
              </p>
              <p className="text-xl font-bold text-card-foreground mt-1">{summary.itemCount}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-5 shadow-xs">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Akurasi Hitungan
              </p>
              <p className="text-xl font-bold text-card-foreground mt-1">
                {summary.accuracyPct}%
                <span className="ml-2 text-xs font-medium text-muted-foreground">
                  {summary.mismatchCount} selisih
                </span>
              </p>
            </div>
            <div className="bg-card rounded-lg border border-border p-5 shadow-xs">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Nilai Selisih
              </p>
              <p className="text-sm font-bold text-destructive mt-1">
                &minus; {formatRupiah(summary.minusValue)}
              </p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                + {formatRupiah(summary.plusValue)}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-8">
            Ringkasan di atas hanya menghitung SO berstatus <span className="font-medium">Disetujui</span>, karena
            hanya SO itu yang benar-benar mengubah stok.
            {summary.rejectedCount > 0 && ` ${summary.rejectedCount} SO ditolak`}
            {summary.rejectedCount > 0 && summary.openCount > 0 && ' dan'}
            {summary.openCount > 0 && ` ${summary.openCount} SO belum selesai`}
            {(summary.rejectedCount > 0 || summary.openCount > 0) &&
              ' tetap tampil di tabel tapi tidak ikut dijumlah.'}
          </p>
        </>
      )}

      {reportData && (
        <SOReportTables
          rows={reportData.rows}
          mismatchProducts={reportData.mismatchProducts}
          exportQuery={exportQuery}
        />
      )}
    </div>
  )
}
