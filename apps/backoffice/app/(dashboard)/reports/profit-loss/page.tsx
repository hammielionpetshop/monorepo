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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Laporan Laba Rugi</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Analisis profitabilitas berdasarkan periode pilihan
        </p>
      </div>

      {/* Form Input Rentang Tanggal */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <form method="GET" className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor="startDate" className="text-xs font-medium text-gray-600">
              Tanggal Mulai
            </label>
            <input
              id="startDate"
              type="date"
              name="startDate"
              defaultValue={startDate ?? ''}
              required
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="endDate" className="text-xs font-medium text-gray-600">
              Tanggal Selesai
            </label>
            <input
              id="endDate"
              type="date"
              name="endDate"
              defaultValue={endDate ?? ''}
              required
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Hasilkan Laba Rugi
          </button>
        </form>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Tabel Laporan */}
      {reportData && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              Hasil Laporan: {startDate} s/d {endDate}
            </h2>
            <a
              href={`/api/bo/reports/profit-loss/export?startDate=${startDate}&endDate=${endDate}&format=csv`}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Export CSV
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Cabang</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Pendapatan</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">HPP</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Laba Kotor</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600">Jml Transaksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reportData.items.map((item) => (
                  <tr key={item.branchId} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-900">{item.branchName}</td>
                    <td className="px-5 py-3 text-right text-gray-900">{formatRupiah(item.revenue)}</td>
                    <td className="px-5 py-3 text-right text-gray-900">{formatRupiah(item.cogs)}</td>
                    <td className="px-5 py-3 text-right text-gray-900">{formatRupiah(item.grossProfit)}</td>
                    <td className="px-5 py-3 text-right text-gray-900">{item.transactionCount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-5 py-3 font-bold text-gray-900">TOTAL</td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900">
                    {formatRupiah(reportData.totalRevenue)}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900">
                    {formatRupiah(reportData.totalCogs)}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900">
                    {formatRupiah(reportData.totalGrossProfit)}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900">
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
