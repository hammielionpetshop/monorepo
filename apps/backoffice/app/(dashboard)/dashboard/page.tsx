import { formatWIB } from '@petshop/shared'
import { getDailySummary, type DailySummaryData } from '@/lib/services/dashboard-service'
import OfflineBranchWidget from './_components/offline-branch-widget'
import { DashboardAutoRefresh } from './_components/dashboard-refresh'
import { RefreshButton } from './_components/refresh-button'

export const revalidate = 30

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
  OPEN: { label: 'OPEN', color: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' },
  CLOSED: { label: 'CLOSED', color: 'bg-muted text-muted-foreground border border-border' },
  FORCE_CLOSED: { label: 'FORCE CLOSED', color: 'bg-destructive/10 text-destructive dark:text-red-400 border border-destructive/20' },
}

interface MetricCardProps {
  title: string
  value: string
  subtitle?: string
}

function MetricCard({ title, value, subtitle }: MetricCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-5 flex flex-col gap-1 shadow-xs">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold text-card-foreground break-all">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground/70">{subtitle}</p>}
    </div>
  )
}

function ShiftBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
        BELUM BUKA
      </span>
    )
  }
  const { label, color } = shiftStatusLabel[status] ?? { label: status, color: 'bg-muted text-muted-foreground border border-border' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${color}`}>
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
      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
        Gagal memuat data dashboard. Silakan muat ulang halaman.
      </div>
    )
  }

  const hasData = data.totalTransactions > 0

  return (
    <div className="space-y-8">
      {/* Metric Cards */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Ringkasan Hari Ini
          </h2>
          <div className="h-px flex-1 bg-border/50" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <p className="mt-4 text-sm text-muted-foreground italic">
            Belum ada transaksi hari ini
          </p>
        )}
      </section>

      {/* Status Shift per Cabang */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Status Shift per Cabang
          </h2>
          <div className="h-px flex-1 bg-border/50" />
        </div>
        {data.shiftStatuses.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-5 text-center">
            <p className="text-sm text-muted-foreground">Tidak ada data cabang aktif.</p>
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border divide-y divide-border overflow-hidden shadow-xs">
            {data.shiftStatuses.map((branch) => (
              <div
                key={branch.branchId}
                className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-card-foreground">{branch.branchName}</p>
                  {branch.shiftId && (
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight mt-0.5">
                      Shift #{branch.shiftId}
                    </p>
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
    <div className="p-6 max-w-7xl mx-auto">
      <DashboardAutoRefresh />
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatWIB(new Date(), {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <RefreshButton />
      </div>
      <DashboardContent />
    </div>
  )
}
