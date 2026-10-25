import Big from 'big.js'
import { getProfitLossReport, type PLReportData } from '@/lib/services/report-service'
import DateFilterClient from './_components/date-filter-client'
import TierBreakdownClient from './_components/tier-breakdown-client'

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

  // Kolom & catatan Revisi Harga Beli hanya muncul bila ada revisi kiriman internal di periode itu.
  const showCostAdjustment = !!reportData && reportData.items.some((item) => !new Big(item.costAdjustment).eq(0))
  const showRevisionNote =
    showCostAdjustment || (!!reportData && reportData.items.some((item) => !new Big(item.priceRevisionRevenue).eq(0)))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Laporan Laba Rugi</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Analisis profitabilitas berdasarkan periode pilihan
        </p>
      </div>

      <DateFilterClient defaultStartDate={startDate} defaultEndDate={endDate} />

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
                  <th className="text-right px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Kerugian Rusak</th>
                  {showCostAdjustment && (
                    <th className="text-right px-6 py-4 font-bold uppercase tracking-widest text-[10px]">
                      Penyesuaian Modal (Revisi Harga Beli)
                    </th>
                  )}
                  <th className="text-right px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Laba Bersih</th>
                  <th className="text-right px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Jml Transaksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportData.items.map((item) => (
                  <tr key={item.branchId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-card-foreground">{item.branchName}</td>
                    <td className="px-6 py-4 text-right font-medium text-card-foreground">
                      {formatRupiah(item.revenue)}
                      <ReturnNote amount={item.returnAmount} />
                      <PriceRevisionNote amount={item.priceRevisionRevenue} />
                    </td>
                    <td className="px-6 py-4 text-right text-muted-foreground">
                      {formatRupiah(item.cogs)}
                      <ReturnNote amount={item.returnCogs} />
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-card-foreground">
                      {formatRupiah(item.grossProfit)}
                    </td>
                    <td className="px-6 py-4 text-right text-destructive">
                      {formatRupiah(item.damagedLoss)}
                    </td>
                    {showCostAdjustment && <CostAdjustmentCell amount={item.costAdjustment} />}
                    <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(item.netProfit)}
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
                    <ReturnNote amount={reportData.totalReturnAmount} />
                    <PriceRevisionNote amount={reportData.totalPriceRevisionRevenue} />
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-card-foreground">
                    {formatRupiah(reportData.totalCogs)}
                    <ReturnNote amount={reportData.totalReturnCogs} />
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-card-foreground">
                    {formatRupiah(reportData.totalGrossProfit)}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-destructive">
                    {formatRupiah(reportData.totalDamagedLoss)}
                  </td>
                  {showCostAdjustment && <CostAdjustmentCell amount={reportData.totalCostAdjustment} bold />}
                  <td className="px-6 py-4 text-right font-bold text-primary">
                    {formatRupiah(reportData.totalNetProfit)}
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

      {reportData && new Big(reportData.totalReturnAmount).gt(0) && (
        <p className="mt-3 text-xs text-muted-foreground">
          Pendapatan & HPP sudah dikurangi retur penjualan yang diproses dalam periode ini (berdasarkan tanggal
          retur). Retur yang dibatalkan tidak ikut.
        </p>
      )}

      {reportData && showRevisionNote && (
        <p className="mt-3 text-xs text-muted-foreground">
          Ada Revisi Harga Beli kiriman internal yang disetujui dalam periode ini. Pendapatan cabang pengirim
          sudah dikoreksi sebesar selisih harga. <b>Penyesuaian Modal (Revisi Harga Beli)</b> = modal barang
          kiriman yang sudah terjual / terpakai sebelum harganya dibetulkan; nota penjualan lama tidak diubah,
          selisihnya dicatat di sini dan sudah masuk Laba Bersih (+ menambah laba, − mengurangi laba).
        </p>
      )}

      {/* Rincian per kelas harga per cabang (dropdown) — basis baris nota, di luar tabel utama */}
      {reportData && <TierBreakdownClient scopes={reportData.tierScopes} startDate={startDate!} endDate={endDate!} />}

      {/* Info piutang — sengaja di luar tabel laba rugi karena tidak mempengaruhi laba */}
      {reportData && <ReceivablesInfo data={reportData} />}
    </div>
  )
}

function PriceRevisionNote({ amount }: { amount: string }) {
  const value = new Big(amount)
  if (value.eq(0)) return null
  return (
    <div className="text-[11px] font-normal text-destructive">
      revisi harga {value.gt(0) ? '−' : '+'}
      {formatRupiah(value.abs().toString())}
    </div>
  )
}

function CostAdjustmentCell({ amount, bold }: { amount: string; bold?: boolean }) {
  const value = new Big(amount)
  const tone = value.lt(0) ? 'text-destructive' : value.gt(0) ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
  return (
    <td className={`px-6 py-4 text-right ${bold ? 'font-bold' : ''} ${tone}`}>
      {value.gt(0) ? '+' : value.lt(0) ? '−' : ''}
      {formatRupiah(value.abs().toString())}
    </td>
  )
}

function ReturnNote({ amount }: { amount: string }) {
  if (!new Big(amount).gt(0)) return null
  return <div className="text-[11px] font-normal text-destructive">retur −{formatRupiah(amount)}</div>
}

function ReceivablesInfo({ data }: { data: PLReportData }) {
  const rows = data.items.filter(
    (i) => new Big(i.debtSales).gt(0) || new Big(i.debtCollected).gt(0)
  )
  const hasAny = new Big(data.totalDebtSales).gt(0) || new Big(data.totalDebtCollected).gt(0)
  if (!hasAny) return null

  return (
    <div className="mt-6 bg-card rounded-lg border border-border overflow-hidden shadow-xs">
      <div className="px-6 py-4 border-b border-border bg-muted/20">
        <h2 className="text-sm font-bold text-card-foreground">Informasi Piutang</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Angka di bawah <span className="font-semibold">tidak mempengaruhi</span> laba di atas. Penjualan
          hutang sudah diakui sebagai pendapatan sejak transaksi dibuat, jadi pelunasannya tidak dihitung
          sebagai omzet lagi.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 text-muted-foreground border-b border-border">
              <th className="text-left px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Cabang</th>
              <th className="text-right px-6 py-3 font-bold uppercase tracking-widest text-[10px]">
                Penjualan Hutang Periode Ini
              </th>
              <th className="text-right px-6 py-3 font-bold uppercase tracking-widest text-[10px]">
                Pelunasan Diterima Periode Ini
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((item) => (
              <tr key={item.branchId} className="hover:bg-muted/20 transition-colors">
                <td className="px-6 py-3 font-semibold text-card-foreground">{item.branchName}</td>
                <td className="px-6 py-3 text-right text-amber-600 dark:text-amber-400">
                  {formatRupiah(item.debtSales)}
                </td>
                <td className="px-6 py-3 text-right text-card-foreground">
                  {formatRupiah(item.debtCollected)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40">
              <td className="px-6 py-3 font-bold text-card-foreground">TOTAL</td>
              <td className="px-6 py-3 text-right font-bold text-amber-600 dark:text-amber-400">
                {formatRupiah(data.totalDebtSales)}
              </td>
              <td className="px-6 py-3 text-right font-bold text-card-foreground">
                {formatRupiah(data.totalDebtCollected)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-6 py-3 text-xs text-muted-foreground border-t border-border">
        Pelunasan bisa berasal dari penjualan periode sebelumnya, sehingga totalnya tidak harus sama dengan
        penjualan hutang periode ini. Pelunasan yang cabangnya belum tercatat tetap masuk ke TOTAL.
      </p>
    </div>
  )
}
