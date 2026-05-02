import Big from 'big.js'
import { getProfitLossReport, type PLReportData } from '@/lib/services/report-service'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

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

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string }>
}) {
  const params = await searchParams
  const { startDate, endDate } = params

  let reportData: PLReportData | null = null
  let error: string | null = null

  if (startDate && endDate) {
    if (!DATE_REGEX.test(startDate) || !DATE_REGEX.test(endDate)) {
      error = 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD.'
    } else if (startDate > endDate) {
      error = 'Tanggal mulai tidak boleh lebih besar dari tanggal selesai.'
    } else {
      try {
        reportData = await getProfitLossReport({ startDate, endDate })
      } catch {
        error = 'Gagal mengambil data laporan. Silakan coba lagi.'
      }
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Laporan Laba Rugi</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Analisis profitabilitas berdasarkan periode pilihan
        </p>
      </div>

      {/* Form Input Rentang Tanggal */}
      <div className="bg-card rounded-lg border border-border p-6 mb-8 shadow-xs">
        <form method="GET" className="flex flex-wrap gap-6 items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="startDate" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Tanggal Mulai
            </label>
            <input
              id="startDate"
              type="date"
              name="startDate"
              defaultValue={startDate ?? ''}
              required
              className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="endDate" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Tanggal Selesai
            </label>
            <input
              id="endDate"
              type="date"
              name="endDate"
              defaultValue={endDate ?? ''}
              required
              className="bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-md hover:opacity-90 transition-all shadow-sm"
          >
            Hasilkan Laba Rugi
          </button>
        </form>
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
              Hasil Laporan: {startDate} s/d {endDate}
            </h2>
            <a
              href={`/api/bo/reports/profit-loss/export?startDate=${startDate}&endDate=${endDate}&format=csv`}
              className="px-3 py-1.5 text-xs font-bold text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-all"
            >
              Export CSV
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-muted-foreground border-b border-border">
                  <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Cabang</th>
                  <th className="text-right px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Pendapatan</th>
                  <th className="text-right px-6 py-4 font-bold uppercase tracking-widest text-[10px]">HPP</th>
                  <th className="text-right px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Laba Kotor</th>
                  <th className="text-right px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Jml Transaksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportData.items.map((item) => (
                  <tr key={item.branchId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-card-foreground">{item.branchName}</td>
                    <td className="px-6 py-4 text-right font-medium text-card-foreground">{formatRupiah(item.revenue)}</td>
                    <td className="px-6 py-4 text-right text-muted-foreground">{formatRupiah(item.cogs)}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(item.grossProfit)}
                    </td>
                    <td className="px-6 py-4 text-right text-card-foreground">{item.transactionCount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40">
                  <td className="px-6 py-4 font-bold text-card-foreground">TOTAL</td>
                  <td className="px-6 py-4 text-right font-bold text-card-foreground">
                    {formatRupiah(reportData.totalRevenue)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-card-foreground">
                    {formatRupiah(reportData.totalCogs)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-primary">
                    {formatRupiah(reportData.totalGrossProfit)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-card-foreground">
                    {reportData.totalTransactionCount}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
