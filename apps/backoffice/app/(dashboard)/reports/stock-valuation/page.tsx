import Big from 'big.js'
import { getStockValuationReport, type StockValuationData } from '@/lib/services/report-service'

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

export default async function StockValuationPage() {
  let reportData: StockValuationData | null = null
  let error: string | null = null

  try {
    reportData = await getStockValuationReport()
  } catch {
    error = 'Gagal mengambil data laporan. Silakan coba lagi.'
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Laporan Nilai Stok FIFO</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Nilai inventaris saat ini berdasarkan metode First-In First-Out
          </p>
        </div>
        {reportData && (
          <a
            href="/api/bo/reports/stock-valuation/export"
            className="px-4 py-2 text-sm font-bold text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-all"
          >
            Export CSV
          </a>
        )}
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
              {reportData.items.length} produk dengan stok aktif
            </h2>
            <p className="text-xs text-muted-foreground">
              Dibuat pada: {new Date(reportData.generatedAt).toLocaleString('id-ID')}
            </p>
          </div>

          {reportData.items.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted-foreground text-sm">
              Tidak ada produk dengan stok tersedia saat ini
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground border-b border-border">
                    <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Nama Produk</th>
                    <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">SKU</th>
                    <th className="text-left px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Cabang</th>
                    <th className="text-right px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Stok (Base UOM)</th>
                    <th className="text-right px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Nilai FIFO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reportData.items.map((item) => (
                    <tr
                      key={`${item.productId}-${item.branchId}`}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-6 py-4 font-semibold text-card-foreground">{item.productName}</td>
                      <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{item.sku ?? '-'}</td>
                      <td className="px-6 py-4 text-card-foreground">{item.branchName}</td>
                      <td className="px-6 py-4 text-right font-medium text-card-foreground">
                        {formatQty(item.totalQty)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(item.totalValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/40">
                    <td className="px-6 py-4 font-bold text-card-foreground" colSpan={4}>TOTAL</td>
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
