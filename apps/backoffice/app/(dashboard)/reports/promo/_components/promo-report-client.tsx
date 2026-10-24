'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Minus, X } from 'lucide-react'
import { NewBadge } from '@/components/ui/new-badge'
import { PROMO_STATUS_LABEL, type PromoStatus } from '@/lib/promo/promo-engine'
import type { PromoReportView } from '@/lib/promo/promo-report'
import type { PromoNoteRow } from '@/lib/services/promo-report-service'
import { formatDate, formatDateTime, formatQty, formatRp, type BranchOption, type PromoReportFilters } from './types'

interface Props {
  filters: PromoReportFilters
  view: PromoReportView
  branches: BranchOption[]
}

/** Target pop-up daftar nota: dari baris "Per promo" (promotionId) atau "Peringkat toko" (branchId). */
interface NotesModalTarget {
  title: string
  params: Record<string, string>
}

/** Pop-up daftar nota di balik angka "Nota". Memuat sendiri lewat /api/bo/reports/promo/notes. */
function NotesModal({
  target,
  filters,
  onClose,
}: {
  target: NotesModalTarget
  filters: PromoReportFilters
  onClose: () => void
}) {
  const [rows, setRows] = useState<PromoNoteRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ac = new AbortController()
    const qs = new URLSearchParams({
      startDate: filters.startDate,
      endDate: filters.endDate,
      ...target.params,
    })
    setRows(null)
    setError(null)
    fetch(`/api/bo/reports/promo/notes?${qs.toString()}`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error ?? 'Gagal memuat daftar nota')
        }
        return res.json() as Promise<PromoNoteRow[]>
      })
      .then(setRows)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Gagal memuat daftar nota')
      })
    return () => ac.abort()
  }, [target, filters.startDate, filters.endDate])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">{target.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Nota berpromo {formatDate(filters.startDate)}–{formatDate(filters.endDate)}. Klik nomor nota untuk membuka detailnya di tab baru.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          {error ? (
            <p className="px-4 py-8 text-center text-sm text-destructive">{error}</p>
          ) : rows === null ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Memuat…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Tidak ada nota.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className={thClass}>Tanggal</th>
                  <th className={thClass}>Nota</th>
                  <th className={thClass}>Cabang</th>
                  <th className={thClass}>Pelanggan</th>
                  <th className={thRight}>Omzet</th>
                  <th className={thRight}>Potongan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.transactionId}>
                    <td className={`${tdClass} whitespace-nowrap`}>{formatDateTime(r.createdAt)}</td>
                    <td className={tdClass}>
                      <a
                        href={`/transactions?trx=${encodeURIComponent(r.trxNumber)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-primary hover:underline"
                        title="Buka detail nota di tab baru"
                      >
                        {r.trxNumber}
                      </a>
                    </td>
                    <td className={tdClass}>{r.branchName}</td>
                    <td className={tdClass}>{r.customerName ?? '—'}</td>
                    <td className={tdRight}>{formatRp(r.omzet)}</td>
                    <td className={`${tdRight} text-amber-700`}>{formatRp(r.discount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {rows && rows.length > 0 && (
          <div className="border-t border-border px-4 py-2 text-right text-xs text-muted-foreground">
            {formatQty(rows.length)} nota
          </div>
        )}
      </div>
    </div>
  )
}

/** Angka "Nota" yang bisa diklik untuk membuka pop-up daftarnya. 0 = teks biasa. */
function NoteCountButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  if (count <= 0) return <>{formatQty(count)}</>
  return (
    <button type="button" onClick={onOpen} className="font-medium text-primary hover:underline tabular-nums" title="Lihat daftar nota">
      {formatQty(count)}
    </button>
  )
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

/** Jatah kuota per cabang: terpakai / jatah (sisa). */
function Quota({ quota }: { quota: PromoReportView['promos'][number]['quota'] }) {
  if (!quota) return null
  const satuan = quota.kind === 'PCS' ? 'pcs' : 'nota'
  return (
    <div className="mt-1 text-xs text-muted-foreground">
      <span className="font-medium">Jatah {satuan}/cabang: {formatQty(quota.perBranch)}</span>
      {quota.usage.length > 0 && (
        <ul className="mt-0.5 space-y-0.5">
          {quota.usage.map((u) => (
            <li key={u.branchId} className="tabular-nums">
              {u.branchName}: terpakai {formatQty(u.used)}, sisa{' '}
              <span className={u.remaining <= 0 ? 'font-medium text-destructive' : 'font-medium text-foreground'}>
                {formatQty(u.remaining)}
              </span>
            </li>
          ))}
        </ul>
      )}
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
  const [notesTarget, setNotesTarget] = useState<NotesModalTarget | null>(null)

  const openPromoNotes = (p: PromoReportView['promos'][number]) =>
    setNotesTarget({
      title: `Nota promo — ${p.name}`,
      params: { promotionId: String(p.promotionId), ...(filters.branchId ? { branchId: filters.branchId } : {}) },
    })

  const openBranchNotes = (b: PromoReportView['branches'][number]) =>
    setNotesTarget({
      title: `Nota berpromo — ${b.branchName}`,
      params: { branchId: String(b.branchId) },
    })

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
                <th className={thRight}>Nota <NewBadge feature="fitur/promo-nota-klik" /></th>
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
                      <Quota quota={p.quota} />
                    </td>
                    <td className={tdClass}><StatusBadge status={p.status} /></td>
                    <td className={tdRight}><NoteCountButton count={p.noteCount} onOpen={() => openPromoNotes(p)} /></td>
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
                <th className={thRight}>Nota <NewBadge feature="fitur/promo-nota-klik" /></th>
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
                    <td className={tdRight}><NoteCountButton count={b.noteCount} onOpen={() => openBranchNotes(b)} /></td>
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

      {notesTarget && (
        <NotesModal target={notesTarget} filters={filters} onClose={() => setNotesTarget(null)} />
      )}
    </div>
  )
}
