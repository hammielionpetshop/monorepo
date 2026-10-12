import { redirect } from 'next/navigation'
import { getAuth, scopeFilter } from '@/lib/authz'
import { db, branches, transactions, eq } from '@/lib/db'
import { listDiscountHistory } from '@/lib/services/discount-history-service'
import { buildDiscountHistory, isCalendarDay, isDiscountSource, type DiscountHistoryView } from '@/lib/discount-history'
import { wibDayStart } from '@/lib/grooming-order-http'
import { NewBadge } from '@/components/ui/new-badge'
import DiscountHistoryClient from './_components/discount-history-client'
import type { BranchOption, ReportFilters } from './_components/types'

export const dynamic = 'force-dynamic'

// Laporan ini memuat siapa memberi potongan berapa — sama dengan menu di sidebar.
const ALLOWED_ROLES = ['OWNER', 'GM', 'MANAGER']

/** Tanggal hari ini menurut WIB, bukan menurut jam server yang berjalan di UTC. */
function todayWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

function shiftDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default async function DiscountHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Partial<ReportFilters>>
}) {
  const payload = await getAuth()
  if (!payload) redirect('/login')
  if (!ALLOWED_ROLES.includes(payload.role)) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Riwayat Diskon hanya bisa dilihat Owner, GM, dan Manager.
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
  const filters: ReportFilters = {
    startDate: startDate <= endDate ? startDate : endDate,
    endDate,
    branchId: isGlobal && /^\d+$/.test(params.branchId ?? '') ? (params.branchId as string) : '',
    source: isDiscountSource(params.source) ? params.source : '',
    q: (params.q ?? '').trim().slice(0, 100),
  }

  let view: DiscountHistoryView | null = null
  let branchOptions: BranchOption[] = []
  let error: string | null = null

  try {
    const rows = await listDiscountHistory({
      branchScope: scopeFilter(payload, transactions.branchId),
      branchId: filters.branchId ? Number(filters.branchId) : undefined,
      from: wibDayStart(filters.startDate) as Date,
      to: wibDayStart(shiftDays(filters.endDate, 1)) as Date,
    })
    view = buildDiscountHistory(rows, { source: isDiscountSource(filters.source) ? filters.source : '', q: filters.q })
    if (isGlobal) {
      branchOptions = await db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.isActive, true)).orderBy(branches.name)
    }
  } catch (e) {
    console.error('DiscountHistoryPage error:', e)
    error = 'Terjadi kesalahan saat mengambil riwayat diskon'
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">
          Riwayat Diskon <NewBadge feature="/reports/discount-history" />
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isGlobal ? 'Semua cabang. ' : 'Cabang Anda. '}
          Barang apa saja yang dipotong harganya, berapa, kapan, oleh siapa, dan alasannya. Klik satu barang untuk melihat
          nota-notanya. Nota yang dibatalkan tidak dihitung; gratis ongkir bukan diskon. Halaman ini hanya membaca nota.
        </p>
      </div>
      {error || !view ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>
      ) : (
        <DiscountHistoryClient filters={filters} view={view} branches={branchOptions} />
      )}
    </div>
  )
}
