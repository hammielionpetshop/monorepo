import { redirect } from 'next/navigation'
import { getAuth, hasPermission, scopeFilter } from '@/lib/authz'
import { db, branches, eq, and } from '@/lib/db'
import { NewBadge } from '@/components/ui/new-badge'
import { CASHIER_VARIANCE_SETTINGS_ROLES, monthRange } from '@/lib/cashier-variance'
import { getCashierVarianceReport, type CashierVarianceReport } from '@/lib/services/cashier-variance-service'
import CashierVarianceClient from './_components/cashier-variance-client'

export const dynamic = 'force-dynamic'

function currentMonthWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()).slice(0, 7)
}

export default async function CashierVariancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; branchId?: string }>
}) {
  const payload = await getAuth()
  if (!payload) redirect('/login')
  // Sama dengan Riwayat Shift: yang boleh melihat shift atau memverifikasi setoran.
  if (!hasPermission(payload, 'shift.read') && !hasPermission(payload, 'shift.deposit.verify')) redirect('/dashboard')

  const isGlobal = payload.branchScope === 'ALL'
  const params = await searchParams
  const month = params.month && monthRange(params.month) ? params.month : currentMonthWIB()
  const branchId = isGlobal
    ? (/^\d+$/.test(params.branchId ?? '') ? Number(params.branchId) : null)
    : payload.branchId

  const branchOptions = isGlobal
    ? await db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(and(eq(branches.isActive, true), scopeFilter(payload, branches.id)))
        .orderBy(branches.name)
    : []

  let report: CashierVarianceReport | null = null
  let error: string | null = null
  try {
    report = await getCashierVarianceReport({ month, branchId })
  } catch (e) {
    console.error('CashierVariancePage error:', e)
    error = 'Terjadi kesalahan saat memuat laporan Minus Kasir'
  }

  return (
    <div className="p-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground mb-1">
        Minus Kasir <NewBadge feature="/cashier-variance" />
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Selisih kas resmi = uang yang diterima &amp; diverifikasi finance − kas menurut sistem. Selisih dibagi ke kasir
        menurut porsi kas tunai yang diterima masing-masing di shift itu. Minus dan plus ditampilkan berdampingan.
      </p>
      <CashierVarianceClient
        report={report}
        error={error}
        month={month}
        branchId={branchId != null && isGlobal ? String(branchId) : ''}
        branches={branchOptions}
        isGlobal={isGlobal}
        canEditSettings={CASHIER_VARIANCE_SETTINGS_ROLES.includes(payload.role)}
      />
    </div>
  )
}
