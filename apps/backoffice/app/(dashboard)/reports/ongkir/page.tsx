import { redirect } from 'next/navigation'
import { formatWIB } from '@petshop/shared'
import { getAuth, hasPermission, scopeFilter } from '@/lib/authz'
import { db, branches, serviceDeliveries, eq } from '@/lib/db'
import { listDeliveryHistory, summarizeGrooming, type DeliveryHistoryRow } from '@/lib/services/grooming-report-service'
import { wibDayStart } from '@/lib/grooming-order-http'
import { isCalendarDay } from '@/lib/discount-history'
import { NewBadge } from '@/components/ui/new-badge'

export const dynamic = 'force-dynamic'

// Laporan Riwayat Ongkir (Back Office): semua ongkos kirim + pengantar + bonus pengantar. Sumbernya sama
// dengan tab "Delivery & Antar Barang" di Riwayat Grooming & Bonus (listDeliveryHistory, summarizeGrooming),
// jadi angkanya selalu cocok. Hak akses sama: grooming.report.view (Owner/GM/Manager).

const formatRp = (v: number) => `Rp ${v.toLocaleString('id-ID')}`
const th = 'px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap'
const td = 'px-3 py-2 text-sm align-top'
const input = 'min-h-[38px] rounded-md border border-input bg-background px-3 text-sm'
const STATUS_LABEL: Record<string, string> = { DIPROSES: 'Diproses', SELESAI: 'Selesai', DIBATALKAN: 'Dibatalkan' }

function todayWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

function shiftDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default async function OngkirReportPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string; branchId?: string; courierId?: string; billing?: string }>
}) {
  const payload = await getAuth()
  if (!payload) redirect('/login')
  if (!hasPermission(payload, 'grooming.report.view')) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Anda belum punya izin melihat Riwayat Ongkir. Bila izinnya baru diberikan, keluar lalu masuk lagi.
        </div>
      </div>
    )
  }

  const isGlobal = payload.branchScope === 'ALL'
  const params = await searchParams
  const today = todayWIB()
  // Bawaan: bulan berjalan — bonus pengantar biasanya dihitung per bulan.
  const endDate = isCalendarDay(params.endDate) ? (params.endDate as string) : today
  const startRaw = isCalendarDay(params.startDate) ? (params.startDate as string) : `${endDate.slice(0, 8)}01`
  const startDate = startRaw <= endDate ? startRaw : endDate
  const branchId = isGlobal && /^\d+$/.test(params.branchId ?? '') ? Number(params.branchId) : undefined
  const courierId = /^\d+$/.test(params.courierId ?? '') ? Number(params.courierId) : undefined
  const billing = params.billing === 'CHARGED' || params.billing === 'FREE' ? params.billing : ''

  let all: DeliveryHistoryRow[] = []
  let branchOptions: { id: number; name: string }[] = []
  let error: string | null = null
  try {
    ;[all, branchOptions] = await Promise.all([
      listDeliveryHistory({
        branchScope: scopeFilter(payload, serviceDeliveries.branchId),
        branchId,
        from: wibDayStart(startDate) as Date,
        to: wibDayStart(shiftDays(endDate, 1)) as Date,
      }),
      isGlobal
        ? db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.isActive, true)).orderBy(branches.name)
        : Promise.resolve([]),
    ])
  } catch (e) {
    console.error('OngkirReportPage error:', e)
    error = 'Terjadi kesalahan saat mengambil riwayat ongkir'
  }

  const couriers = [...new Map(all.map((d) => [d.courierId, d.courierName])).entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const rows = all.filter(
    (d) =>
      (courierId == null || d.courierId === courierId) &&
      (billing === '' || (billing === 'FREE' ? d.isFreeShipping : !d.isFreeShipping)),
  )
  const summary = summarizeGrooming([], rows)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground">
          Riwayat Ongkir <NewBadge feature="/reports/ongkir" />
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {isGlobal ? 'Semua cabang. ' : 'Cabang Anda. '}
          Semua ongkos kirim beserta pengantarnya (antar barang dari kasir dan antar-jemput grooming). Bonus pengantar 50% dari ongkir
          sesudah diskon; gratis ongkir dan yang dibatalkan tanpa bonus. Kiriman truk Gudang tidak ada di sini (tanpa ongkir).
        </p>
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Dari</label>
          <input type="date" name="startDate" defaultValue={startDate} className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Sampai</label>
          <input type="date" name="endDate" defaultValue={endDate} className={input} />
        </div>
        {isGlobal && (
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Cabang</label>
            <select name="branchId" defaultValue={branchId ? String(branchId) : ''} className={input}>
              <option value="">Semua cabang</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Pengantar</label>
          <select name="courierId" defaultValue={courierId ? String(courierId) : ''} className={input}>
            <option value="">Semua</option>
            {couriers.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Ongkir</label>
          <select name="billing" defaultValue={billing} className={input}>
            <option value="">Semua</option>
            <option value="CHARGED">Ditagih</option>
            <option value="FREE">Gratis ongkir</option>
          </select>
        </div>
        <button type="submit" className="min-h-[38px] rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Tampilkan
        </button>
      </form>

      {error && <p className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          ['Jumlah antar', String(summary.delivery.count)],
          ['Ongkir ditagih', formatRp(summary.delivery.netTotal)],
          ['Gratis ongkir', `${summary.delivery.freeCount} · ${formatRp(summary.delivery.freeTotal)}`],
          ['Bonus pengantar', formatRp(summary.delivery.bonus)],
          ['Dibatalkan', String(summary.delivery.cancelledCount)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <section className="mb-6 rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-3 py-2 text-sm font-semibold">Bonus per pengantar</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className={th}>Pengantar</th>
                <th className={`${th} text-right`}>Antar</th>
                <th className={`${th} text-right`}>Ongkir sesudah diskon</th>
                <th className={`${th} text-right`}>Bonus</th>
                <th className={`${th} text-right`}>Di antaranya belum lunas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.byCourier.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">Belum ada.</td></tr>
              )}
              {summary.byCourier.map((g) => (
                <tr key={g.key}>
                  <td className={`${td} font-medium`}>{g.label}</td>
                  <td className={`${td} text-right tabular-nums`}>{g.count}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatRp(g.netTotal)}</td>
                  <td className={`${td} text-right font-semibold tabular-nums`}>{formatRp(g.bonus)}</td>
                  <td className={`${td} text-right tabular-nums text-muted-foreground`}>
                    {g.unpaidCount > 0 ? `${g.unpaidCount} · ${formatRp(g.unpaidBonus)}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-3 py-2 text-sm font-semibold">Rincian ({rows.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className={th}>Tanggal</th>
                <th className={th}>Nota / cabang</th>
                <th className={th}>Jenis / pelanggan</th>
                <th className={th}>Pengantar</th>
                <th className={`${th} text-right`}>Ongkir</th>
                <th className={`${th} text-right`}>Bonus</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">Tidak ada ongkir pada periode ini.</td></tr>
              )}
              {rows.map((d) => {
                const cancelled = d.status === 'DIBATALKAN'
                return (
                  <tr key={d.id} className={cancelled ? 'bg-muted/30 text-muted-foreground' : undefined}>
                    <td className={`${td} whitespace-nowrap`}>
                      {formatWIB(d.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className={td}>
                      <a
                        href={`/transactions?trx=${encodeURIComponent(d.trxNumber)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block font-medium text-primary hover:underline"
                        title="Buka detail nota di tab baru"
                      >
                        {d.trxNumber}
                      </a>
                      <span className="block text-xs text-muted-foreground">{d.branchName}</span>
                    </td>
                    <td className={td}>
                      <span className="block text-xs">{d.kind === 'GROOMING' ? 'Antar-jemput grooming' : 'Antar barang'}</span>
                      <span className="block font-medium">{d.ownerName ?? <span className="italic text-muted-foreground">Umum</span>}</span>
                    </td>
                    <td className={`${td} font-medium`}>{d.courierName}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {d.isFreeShipping ? (
                        <>
                          <span className="font-semibold text-amber-700">GRATIS</span>
                          <span className="block text-xs text-muted-foreground">{formatRp(d.freeValue)} ditanggung toko</span>
                        </>
                      ) : (
                        formatRp(d.netFee)
                      )}
                    </td>
                    <td className={`${td} text-right font-semibold tabular-nums`}>{cancelled ? '-' : formatRp(d.bonus)}</td>
                    <td className={td}>
                      {STATUS_LABEL[d.status] ?? d.status}
                      {!cancelled && (
                        <span className={`mt-1 block text-xs ${d.isPaid ? 'text-green-700' : 'text-red-700'}`}>
                          {d.isPaid ? 'LUNAS' : 'BELUM LUNAS'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
