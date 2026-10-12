import { redirect } from 'next/navigation'
import { getAuth, hasPermission, scopeFilter } from '@/lib/authz'
import { db, branches, groomingOrders, serviceDeliveries, eq } from '@/lib/db'
import { listGroomers } from '@/lib/services/grooming-master-service'
import {
  listDeliveryHistory, listGroomingHistory, summarizeGrooming,
  type DeliveryHistoryRow, type GroomingHistoryRow, type GroomingSummary,
} from '@/lib/services/grooming-report-service'
import { wibDayStart } from '@/lib/grooming-order-http'
import { NewBadge } from '@/components/ui/new-badge'
import GroomingReportClient from './_components/grooming-report-client'
import type { BranchOption, GroomerOption, ReportFilters } from './_components/types'

export const dynamic = 'force-dynamic'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/** Tanggal hari ini menurut WIB, bukan menurut jam server yang berjalan di UTC. */
function todayWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

function shiftDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default async function GroomingReportPage({
  searchParams,
}: {
  searchParams: Promise<Partial<ReportFilters>>
}) {
  const payload = await getAuth()
  if (!payload) redirect('/login')
  if (!hasPermission(payload, 'grooming.report.view')) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Anda belum punya izin melihat Riwayat Grooming. Bila izinnya baru diberikan, keluar lalu masuk lagi.
        </div>
      </div>
    )
  }

  const isGlobal = payload.branchScope === 'ALL'
  const params = await searchParams
  const today = todayWIB()
  // Bawaan: bulan berjalan (tanggal 1 sampai hari ini) — bonus biasanya dihitung per bulan.
  const endDate = params.endDate && DATE_REGEX.test(params.endDate) ? params.endDate : today
  const startDate = params.startDate && DATE_REGEX.test(params.startDate) ? params.startDate : `${endDate.slice(0, 8)}01`
  const filters: ReportFilters = {
    startDate: startDate <= endDate ? startDate : endDate,
    endDate,
    branchId: isGlobal && /^\d+$/.test(params.branchId ?? '') ? (params.branchId as string) : '',
    groomerId: /^\d+$/.test(params.groomerId ?? '') ? (params.groomerId as string) : '',
    payment: params.payment === 'LUNAS' || params.payment === 'BELUM' ? params.payment : '',
    q: (params.q ?? '').trim().slice(0, 100),
  }

  let rows: GroomingHistoryRow[] = []
  let deliveries: DeliveryHistoryRow[] = []
  let summary: GroomingSummary | null = null
  let branchOptions: BranchOption[] = []
  let groomerOptions: GroomerOption[] = []
  let error: string | null = null

  try {
    const from = wibDayStart(filters.startDate) as Date
    const to = wibDayStart(shiftDays(filters.endDate, 1)) as Date
    const branchId = filters.branchId ? Number(filters.branchId) : undefined
    ;[rows, deliveries, groomerOptions] = await Promise.all([
      listGroomingHistory({
        branchScope: scopeFilter(payload, groomingOrders.branchId),
        branchId, from, to,
        groomerId: filters.groomerId ? Number(filters.groomerId) : undefined,
        payment: filters.payment === 'LUNAS' || filters.payment === 'BELUM' ? filters.payment : undefined,
        q: filters.q || undefined,
      }),
      listDeliveryHistory({ branchScope: scopeFilter(payload, serviceDeliveries.branchId), branchId, from, to }),
      listGroomers().then((list) => list.map((g) => ({ id: g.id, name: g.name, isActive: g.isActive, isGroomer: g.isGroomer }))),
    ])
    summary = summarizeGrooming(rows, deliveries)
    if (isGlobal) {
      branchOptions = await db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.isActive, true)).orderBy(branches.name)
    }
  } catch (e) {
    console.error('GroomingReportPage error:', e)
    error = 'Terjadi kesalahan saat mengambil riwayat grooming'
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">
          Riwayat Grooming &amp; Bonus <NewBadge feature="/reports/grooming" />
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isGlobal ? 'Semua cabang. ' : 'Cabang Anda. '}
          Bonus groomer 10% dari harga jasa sesudah diskon; bonus pengantar 50% dari ongkos kirim. Grooming yang dibatalkan
          atau diretur tidak dihitung. Uangnya tetap tercatat di nota — halaman ini hanya membacanya.
        </p>
      </div>
      {error || !summary ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>
      ) : (
        <GroomingReportClient
          filters={filters}
          rows={rows}
          deliveries={deliveries}
          summary={summary}
          branches={branchOptions}
          groomers={groomerOptions}
          canChangeGroomer={hasPermission(payload, 'grooming.order.change_groomer')}
        />
      )}
    </div>
  )
}
