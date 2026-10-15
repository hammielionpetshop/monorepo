'use client'

import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { PROMO_STATUS_LABEL, type PromoStatus } from '@/lib/promo/promo-engine'
import type { PromoReportView } from '@/lib/promo/promo-report'
import { formatDate, formatQty, formatRp, type BranchOption, type PromoReportFilters } from './types'

interface Props {
  filters: PromoReportFilters
  view: PromoReportView
  branches: BranchOption[]
}

const inputClass =
  'w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring'
const thClass = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground'
const thRight = `${thClass} text-right`
const tdClass = 'px-3 py-2 align-top'
const tdRight = `${tdClass} text-right tabular-nums whitespace-nowrap`

const STATUS_TONE: Record<PromoStatus, string> = {
  BERJALAN: 'bg-emerald-500/10 text-emerald-700',
  BELUM_MULAI: 'bg-sky-500/10 text-sky-700',
  BERAKHIR: 'bg-muted text-muted-foreground',
  NONAKTIF: 'bg-amber-500/10 text-amber-800',
}

function StatusBadge({ status }: { status: PromoStatus | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_TONE[status]}`}>
      {PROMO_STATUS_LABEL[status]}
    </span>
  )
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tone ?? 'text-foreground'}`}>{value}</div>
    </div>
  )
}

/** Pembanding qty: masa promo vs sebelum. */
function Comparison({ item }: { item: PromoReportView['promos'][number] }) {
  const c = item.comparison
  if (!c) return <span className="text-xs text-muted-foreground">—</span>
  const up = c.qtyDelta > 0
  const down = c.qtyDelta < 0
  const Icon = up ? ArrowUp : down ? ArrowDown : Minus
  const tone = up ? 'text-emerald-700' : down ? 'text-destructive' : 'text-muted-foreground'
  return (
    <div className="text-xs">
      <div className={`flex items-center justify-end gap-1 font-medium ${tone}`}>
        <Icon className="h-3.5 w-3.5" />
        <span className="tabular-nums">
          {c.qtyDelta > 0 ? '+' : ''}{formatQty(c.qtyDelta)}
          {c.qtyChangePct != null && ` (${c.qtyChangePct > 0 ? '+' : ''}${c.qtyChangePct}%)`}
        </span>
      </div>
      <div className="mt-0.5 text-right text-muted-foreground tabular-nums">
        {formatQty(c.periodQty)} vs {formatQty(c.beforeQty)} sblm
      </div>
    </div>
  )
}

export default function PromoReportClient({ filters, view, branches }: Props) {
  const { promos, totals, branches: ranking } = view

  return (
    <div className="space-y-5">
      {/* ── Saringan ── */}
      <form method="get" className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Dari tanggal</span>
          <input type="date" name="startDate" defaultValue={filters.startDate} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Sampai tanggal</span>
          <input type="date" name="endDate" defaultValue={filters.endDate} className={inputClass} />
        </label>
        {branches.length > 0 && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Cabang</span>
            <select name="branchId" defaultValue={filters.branchId} className={inputClass}>
              <option value="">Semua cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-end">
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Tampilkan
          </button>
        </div>
      </form>

      {/* ── Ringkasan ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Nota berpromo" value={formatQty(totals.noteCount)} />
        <StatCard label="Barang terjual" value={formatQty(totals.qty)} />
        <StatCard label="Omzet promo" value={formatRp(totals.omzet)} />
        <StatCard label="Total potongan" value={formatRp(totals.discount)} tone="text-amber-700" />
        <StatCard label="Laba" value={formatRp(totals.profit)} tone={totals.profit < 0 ? 'text-destructive' : 'text-emerald-700'} />
      </div>

      {/* ── Per promo ── */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Per promo</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pembanding = jumlah barang hadiah yang terjual pada periode ini dibanding periode sama panjang tepat sebelumnya.
          </p>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className={thClass}>Promo</th>
                <th className={thClass}>Status</th>
                <th className={thRight}>Nota</th>
                <th className={thRight}>Qty</th>
                <th className={thRight}>Omzet</th>
                <th className={thRight}>Potongan</th>
                <th className={thRight}>Laba</th>
                <th className={thRight}>Perubahan penjualan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {promos.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Belum ada promo pada periode ini.</td></tr>
              ) : (
                promos.map((p) => (
                  <tr key={p.promotionId}>
                    <td className={tdClass}>
                      <div className="font-medium text-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.branchNames.length > 0 ? p.branchNames.join(', ') : 'Semua cabang'}
                        {p.startsAt && <> · {formatDate(p.startsAt)}–{formatDate(p.endsAt)}</>}
                      </div>
                    </td>
                    <td className={tdClass}><StatusBadge status={p.status} /></td>
                    <td className={tdRight}>{formatQty(p.noteCount)}</td>
                    <td className={tdRight}>{formatQty(p.qty)}</td>
                    <td className={tdRight}>{formatRp(p.omzet)}</td>
                    <td className={`${tdRight} text-amber-700`}>{formatRp(p.discount)}</td>
                    <td className={`${tdRight} ${p.profit < 0 ? 'text-destructive' : ''}`}>{formatRp(p.profit)}</td>
                    <td className={tdRight}><Comparison item={p} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Peringkat toko ── */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Peringkat toko</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Cabang yang paling banyak memakai promo pada periode ini.</p>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className={thClass}>#</th>
                <th className={thClass}>Cabang</th>
                <th className={thRight}>Nota</th>
                <th className={thRight}>Qty</th>
                <th className={thRight}>Omzet</th>
                <th className={thRight}>Potongan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ranking.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Belum ada pemakaian promo.</td></tr>
              ) : (
                ranking.map((b, i) => (
                  <tr key={b.branchId}>
                    <td className={`${tdClass} tabular-nums text-muted-foreground`}>{i + 1}</td>
                    <td className={tdClass}>{b.branchName}</td>
                    <td className={tdRight}>{formatQty(b.noteCount)}</td>
                    <td className={tdRight}>{formatQty(b.qty)}</td>
                    <td className={tdRight}>{formatRp(b.omzet)}</td>
                    <td className={`${tdRight} text-amber-700`}>{formatRp(b.discount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
