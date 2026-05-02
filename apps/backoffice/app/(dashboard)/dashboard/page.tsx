import { getDailySummary, type DailySummaryData } from '@/lib/services/dashboard-service'
import OfflineBranchWidget from './_components/offline-branch-widget'

export const revalidate = 60

function formatRupiah(value: string): string {
  const num = parseFloat(value)
  if (isNaN(num)) return 'Rp 0'
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

const shiftStatusLabel: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'OPEN', color: 'bg-green-100 text-green-800' },
  CLOSED: { label: 'CLOSED', color: 'bg-gray-100 text-gray-700' },
  FORCE_CLOSED: { label: 'FORCE CLOSED', color: 'bg-red-100 text-red-800' },
}

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
}

function MetricCard({ title, value, subtitle }: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold text-gray-900 break-all">{value}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  )
}

function ShiftBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-50 text-yellow-700">
        Belum Buka
      </span>
    )
  }
  const { label, color } = shiftStatusLabel[status] ?? { label: status, color: 'bg-gray-100 text-gray-700' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}

async function DashboardContent() {
  let data: DailySummaryData
  try {
    data = await getDailySummary()
  } catch (err) {
    console.error('Gagal mengambil data dashboard:', err)
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
        Gagal memuat data dashboard. Silakan muat ulang halaman.
      </div>
    )
  }

  const hasData = data.totalTransactions > 0

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Ringkasan Hari Ini
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Pendapatan"
            value={hasData ? formatRupiah(data.totalRevenue) : 'Rp 0'}
          />
          <MetricCard
            title="Jumlah Transaksi"
            value={hasData ? data.totalTransactions.toString() : '0'}
            subtitle="transaksi selesai"
          />
          <MetricCard
            title="Estimasi Laba Kotor"
            value={hasData ? formatRupiah(data.grossProfitEstimate) : 'Rp 0'}
          />
          <MetricCard
            title="Total Pengeluaran"
            value={formatRupiah(data.totalExpenses)}
          />
        </div>

        {!hasData && (
          <p className="mt-3 text-sm text-gray-400">
            Belum ada transaksi hari ini
          </p>
        )}
      </section>

      {/* Status Shift per Cabang */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Status Shift per Cabang
        </h2>
        {data.shiftStatuses.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <p className="text-sm text-gray-400">Tidak ada data cabang.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {data.shiftStatuses.map((branch) => (
              <div
                key={branch.branchId}
                className="flex items-center justify-between px-5 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{branch.branchName}</p>
                  {branch.shiftId && (
                    <p className="text-xs text-gray-400">Shift #{branch.shiftId}</p>
                  )}
                </div>
                <ShiftBadge status={branch.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Widget Status Cabang Offline */}
      <OfflineBranchWidget />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>
      <DashboardContent />
    </div>
  )
}
