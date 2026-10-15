import { redirect } from 'next/navigation'
import { getAuth, scopeFilter } from '@/lib/authz'
import { db, branches, transactions, eq } from '@/lib/db'
import { getPromoReport } from '@/lib/services/promo-report-service'
import { isCalendarDay } from '@/lib/discount-history'
import { wibDayStart } from '@/lib/grooming-order-http'
import type { PromoReportView } from '@/lib/promo/promo-report'
import { NewBadge } from '@/components/ui/new-badge'
import PromoReportClient from './_components/promo-report-client'
import type { BranchOption, PromoReportFilters } from './_components/types'

export const dynamic = 'force-dynamic'

// Laporan efektivitas promo — sama dengan menu Promo di Master Data.
const ALLOWED_ROLES = ['OWNER', 'GM']

/** Tanggal hari ini menurut WIB, bukan jam server (UTC). */
function todayWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

function shiftDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default async function PromoReportPage({
  searchParams,
}: {
  searchParams: Promise<Partial<PromoReportFilters>>
}) {
  const payload = await getAuth()
  if (!payload) redirect('/login')
  if (!ALLOWED_ROLES.includes(payload.role)) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Laporan Promo hanya bisa dilihat Owner dan GM.
        </div>
      </div>
    )
  }

  const isGlobal = payload.branchScope === 'ALL'
  const params = await searchParams
  const today = todayWIB()
  // Bawaan: bulan berjalan (tanggal 1 sampai hari ini).
  const endDate = isCalendarDay(params.endDate) ? params.endDate : today
  const startDate = isCalendarDay(params.startDate) ? params.startDate : `${endDate.slice(0, 8)}01`
  const filters: PromoReportFilters = {
    startDate: startDate <= endDate ? startDate : endDate,
    endDate,
    branchId: isGlobal && /^\d+$/.test(params.branchId ?? '') ? (params.branchId as string) : '',
  }

  let view: PromoReportView | null = null
  let branchOptions: BranchOption[] = []
  let error: string | null = null

  try {
    view = await getPromoReport({
      branchScope: scopeFilter(payload, transactions.branchId),
      branchId: filters.branchId ? Number(filters.branchId) : undefined,
      from: wibDayStart(filters.startDate) as Date,
      to: wibDayStart(shiftDays(filters.endDate, 1)) as Date,
    })
    if (isGlobal) {
      branchOptions = await db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.isActive, true)).orderBy(branches.name)
    }
  } catch (e) {
    console.error('PromoReportPage error:', e)
    error = 'Terjadi kesalahan saat mengambil laporan promo'
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">
          Laporan Promo <NewBadge feature="/reports/promo" />
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isGlobal ? 'Semua cabang. ' : 'Cabang Anda. '}
          Seberapa laku tiap promo: jumlah nota, barang terjual, omzet, total potongan, dan laba — dibandingkan dengan masa
          sebelum promo. Nota yang dibatalkan tidak dihitung. Halaman ini hanya membaca nota.
        </p>
      </div>
      {error || !view ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>
      ) : (
        <PromoReportClient filters={filters} view={view} branches={branchOptions} />
      )}
    </div>
  )
}
