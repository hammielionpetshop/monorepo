'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import {
  DISCOUNT_SOURCES, DISCOUNT_SOURCE_LABEL,
  type DiscountHistoryRow, type DiscountHistoryView, type DiscountSource,
} from '@/lib/discount-history'
import { formatDateTime, formatRp, type BranchOption, type ReportFilters } from './types'

interface Props {
  filters: ReportFilters
  view: DiscountHistoryView
  branches: BranchOption[]
}

interface Detail {
  title: string
  subtitle: string
  rows: DiscountHistoryRow[]
  /** Diskon nota tidak punya barang — kolom qty & harga disembunyikan. */
  noteLevel: boolean
}

const inputClass =
  'w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring'
const thClass = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground'
const tdClass = 'px-3 py-2 align-top'

const SOURCE_TONE: Record<DiscountSource, string> = {
  MANUAL: 'bg-amber-500/10 text-amber-800',
  PROMO: 'bg-emerald-500/10 text-emerald-700',
  GROSIR: 'bg-sky-500/10 text-sky-700',
  NOTA: 'bg-muted text-muted-foreground',
}

function SourceBadge({ source }: { source: DiscountSource }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium ${SOURCE_TONE[source]}`}>
      {DISCOUNT_SOURCE_LABEL[source]}
    </span>
  )
}

function DetailDialog({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const total = detail.rows.reduce((sum, r) => sum + r.amount, 0)
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" role="presentation" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 md:p-6" role="dialog" aria-modal="true" aria-label={detail.title}>
        <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl border border-border bg-card text-card-foreground shadow-2xl">
          <div className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div>
              <h2 className="text-base font-semibold">{detail.title}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{detail.subtitle}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-md p-1 text-muted-foreground hover:bg-muted">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className={thClass}>Kapan</th>
                  <th className={thClass}>Nota</th>
                  <th className={thClass}>Cabang</th>
                  <th className={thClass}>Oleh</th>
                  {!detail.noteLevel && <th className={`${thClass} text-right`}>Qty × harga</th>}
                  <th className={`${thClass} text-right`}>Potongan</th>
                  <th className={thClass}>Jenis</th>
                  <th className={thClass}>Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {detail.rows.map((r) => (
                  <tr key={r.key}>
                    <td className={`${tdClass} whitespace-nowrap`}>{formatDateTime(r.createdAt)}</td>
                    <td className={tdClass}>
                      <span className="font-mono text-xs">{r.trxNumber}</span>
                      {r.customerName && <div className="text-xs text-muted-foreground">{r.customerName}</div>}
                    </td>
                    <td className={tdClass}>{r.branchName}</td>
                    <td className={tdClass}>{r.byName}</td>
                    {!detail.noteLevel && (
                      <td className={`${tdClass} whitespace-nowrap text-right tabular-nums`}>
                        {r.qty} {r.uomCode ?? ''} × {formatRp(r.unitPrice)}
                      </td>
                    )}
                    <td className={`${tdClass} whitespace-nowrap text-right font-semibold tabular-nums`}>{formatRp(r.amount)}</td>
                    <td className={tdClass}><SourceBadge source={r.source} /></td>
                    <td className={tdClass}>{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-shrink-0 items-center justify-between gap-4 border-t border-border px-6 py-3 text-sm">
            <span className="text-muted-foreground">{detail.rows.length} baris · total potongan <b className="text-foreground">{formatRp(total)}</b></span>
            <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 font-medium hover:bg-muted">
              Tutup
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default function DiscountHistoryClient({ filters, view, branches }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const { summary, products, noteLevel } = view
  const noteLevelTotal = summary.bySource.NOTA.total

  return (
    <div className="space-y-4">
      {detail && <DetailDialog detail={detail} onClose={() => setDetail(null)} />}

      {/* ── Saringan ── */}
      <form method="get" className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Dari tanggal</label>
          <input type="date" name="startDate" defaultValue={filters.startDate} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Sampai tanggal</label>
          <input type="date" name="endDate" defaultValue={filters.endDate} className={inputClass} />
        </div>
        {branches.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Cabang</label>
            <select name="branchId" defaultValue={filters.branchId} className={inputClass}>
              <option value="">Semua cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Jenis potongan</label>
          <select name="source" defaultValue={filters.source} className={inputClass}>
            <option value="">Semua jenis</option>
            {DISCOUNT_SOURCES.map((s) => (
              <option key={s} value={s}>{DISCOUNT_SOURCE_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Cari</label>
          <input name="q" defaultValue={filters.q} placeholder="nama barang / SKU / nomor nota" className={inputClass} />
        </div>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Tampilkan
          </button>
          <a href="/reports/discount-history" className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
            Bulan ini (atur ulang)
          </a>
        </div>
      </form>

      {/* ── Ringkasan ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total potongan</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{formatRp(summary.total)}</p>
          <p className="text-xs text-muted-foreground">{summary.noteCount} nota</p>
        </div>
        {DISCOUNT_SOURCES.map((s) => (
          <div key={s} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">{DISCOUNT_SOURCE_LABEL[s]}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{formatRp(summary.bySource[s].total)}</p>
            <p className="text-xs text-muted-foreground">{summary.bySource[s].count} kali</p>
          </div>
        ))}
      </div>

      {/* ── Per barang ── */}
      <section className="rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Potongan per barang ({products.length} barang)</h2>
        {products.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Tidak ada barang yang dipotong harganya pada periode dan saringan ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className={thClass}>Barang</th>
                  <th className={`${thClass} text-right`}>Berapa kali</th>
                  <th className={`${thClass} text-right`}>Total potongan</th>
                  <th className={thClass}>Jenis</th>
                  <th className={thClass}>Alasan</th>
                  <th className={thClass} />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => (
                  <tr
                    key={p.key}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setDetail({
                      title: p.productName,
                      subtitle: `${p.productSku ? `${p.productSku} · ` : ''}dipotong ${p.count} kali di ${p.noteCount} nota`,
                      rows: p.rows,
                      noteLevel: false,
                    })}
                  >
                    <td className={tdClass}>
                      <div className="font-medium">{p.productName}</div>
                      {p.productSku && <div className="text-xs text-muted-foreground">{p.productSku}</div>}
                    </td>
                    <td className={`${tdClass} text-right tabular-nums`}>{p.count}</td>
                    <td className={`${tdClass} whitespace-nowrap text-right font-semibold tabular-nums`}>{formatRp(p.total)}</td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap gap-1">
                        {p.sources.map((s) => <SourceBadge key={s} source={s} />)}
                      </div>
                    </td>
                    <td className={`${tdClass} text-muted-foreground`}>
                      {p.reasons.slice(0, 3).map((r) => (r.count > 1 ? `${r.label} (${r.count})` : r.label)).join(', ')}
                      {p.reasons.length > 3 ? `, +${p.reasons.length - 3} lainnya` : ''}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-right text-xs font-medium text-primary`}>Lihat nota</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Diskon nota (tidak per barang) ── */}
      {noteLevel.length > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Diskon nota (tidak per barang)</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {noteLevel.length} nota · {formatRp(noteLevelTotal)}. Diskon cara lama memotong total nota, bukan barang tertentu —
              jadi tidak bisa dipecah per barang dan tidak punya alasan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDetail({
              title: 'Diskon nota (tidak per barang)',
              subtitle: `${noteLevel.length} nota berdiskon total nota`,
              rows: noteLevel,
              noteLevel: true,
            })}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Lihat nota
          </button>
        </section>
      )}
    </div>
  )
}
