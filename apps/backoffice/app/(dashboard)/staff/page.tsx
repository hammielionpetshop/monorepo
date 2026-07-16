import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

import { verifyAccessToken } from '@/lib/auth'
import { getStaffDashboard } from '@/lib/services/staff-service'

export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  GM: 'General Manager',
  MANAGER: 'Manager',
  GUDANG: 'Gudang',
  FINANCE: 'Finance',
  KASIR: 'Kasir',
}

const shiftStatusStyle: Record<string, string> = {
  OPEN: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20',
  CLOSED: 'bg-muted text-muted-foreground border border-border',
  FORCE_CLOSED: 'bg-destructive/10 text-destructive dark:text-red-400 border border-destructive/20',
}

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

function StatCard({
  title,
  value,
  subtitle,
  href,
  highlight,
}: {
  title: string
  value: string
  subtitle?: string
  href?: string
  highlight?: boolean
}) {
  const body = (
    <div
      className={`flex flex-col gap-1 rounded-lg border bg-card p-5 shadow-xs transition-colors ${
        href ? 'hover:bg-muted/30' : ''
      } ${highlight ? 'border-amber-500/40' : 'border-border'}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold text-card-foreground break-all">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground/70">{subtitle}</p>}
    </div>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

function ShiftBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600">
        BELUM BUKA
      </span>
    )
  }
  const color = shiftStatusStyle[status] ?? 'bg-muted text-muted-foreground border border-border'
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold ${color}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{children}</h2>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  )
}

export default async function StaffDashboardPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) {
    redirect('/login')
  }

  const roleLabel = ROLE_LABELS[payload.role] ?? payload.role
  const isReadOnlyPreview = payload.role === 'OWNER' || payload.role === 'GM'

  let data
  let loadError = false
  try {
    data = await getStaffDashboard(payload.role, payload.branchId)
  } catch (err) {
    console.error('StaffDashboardPage error:', err)
    loadError = true
    data = {}
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">Halo, {payload.userName}</h1>
        <p className="text-sm text-muted-foreground">
          {roleLabel}
          {payload.branchName ? ` · ${payload.branchName}` : ''}
        </p>
      </div>

      {isReadOnlyPreview && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
          Anda melihat halaman staf sebagai <strong>{roleLabel}</strong> (read-only). Data omzet & laba
          global tetap tersedia di <a className="underline" href="/dashboard">Dashboard</a>.
        </div>
      )}

      {loadError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Gagal memuat ringkasan. Silakan muat ulang halaman.
        </div>
      )}

      {data.manager && (
        <section>
          <SectionTitle>Ringkasan Cabang Anda — Hari Ini</SectionTitle>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-5 shadow-xs">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status Shift</p>
              <div className="mt-1">
                <ShiftBadge status={data.manager.shiftStatus} />
              </div>
              {data.manager.shiftId && (
                <p className="text-xs text-muted-foreground/70">Shift #{data.manager.shiftId}</p>
              )}
            </div>
            <StatCard
              title="Transaksi Hari Ini"
              value={data.manager.todayTransactions.toString()}
              subtitle="transaksi selesai"
              href="/transactions"
            />
            <StatCard title="Omzet Hari Ini" value={formatRupiah(data.manager.todayRevenue)} subtitle="cabang Anda" />
            <StatCard
              title="PO Menunggu Approval"
              value={data.manager.pendingPoApproval.toString()}
              href="/purchase-orders"
              highlight={data.manager.pendingPoApproval > 0}
            />
          </div>
        </section>
      )}

      {data.gudang && (
        <section>
          <SectionTitle>Tugas Gudang</SectionTitle>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard
              title="Stock Opname Menunggu"
              value={data.gudang.pendingOpname.toString()}
              href="/inventory/stock-opname"
              highlight={data.gudang.pendingOpname > 0}
            />
            <StatCard
              title="Transfer Berjalan"
              value={data.gudang.activeTransfers.toString()}
              href="/purchase-orders/internal"
              highlight={data.gudang.activeTransfers > 0}
            />
            <StatCard
              title="PO Menunggu Penerimaan"
              value={data.gudang.poAwaitingReceiving.toString()}
              href="/purchase-orders"
              highlight={data.gudang.poAwaitingReceiving > 0}
            />
          </div>
        </section>
      )}

      {data.finance && (
        <section>
          <SectionTitle>Tugas Finance</SectionTitle>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard
              title="Piutang Belum Lunas"
              value={data.finance.unpaidReceivables.toString()}
              href="/reports/receivables"
              highlight={data.finance.unpaidReceivables > 0}
            />
            <StatCard
              title="Hutang Internal Belum Lunas"
              value={data.finance.unpaidPayables.toString()}
              href="/purchase-orders/internal/payables"
              highlight={data.finance.unpaidPayables > 0}
            />
          </div>
        </section>
      )}

      {!data.manager && !data.gudang && !data.finance && !isReadOnlyPreview && (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground shadow-xs">
          Ringkasan untuk peran Anda akan segera tersedia.
        </div>
      )}
    </div>
  )
}
