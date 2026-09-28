'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Loader2, X } from 'lucide-react'
import { formatWIB } from '@petshop/shared'
import type {
  StockMutationDailyEntry,
  StockMutationTimeline,
  StockMutationTimelineEntry,
} from './types'
import { MOVEMENT_LABEL, MUTATION_CATEGORIES, categoryOf, formatBalance, formatQty, qtyTone, type MovementKey } from './mutation-format'

type Mode = 'transaction' | 'daily'

const LINK_HREF: Record<NonNullable<StockMutationTimelineEntry['link']>['kind'], (id: string, number: string) => string> = {
  TRANSACTION: (_id, number) => `/transactions?q=${encodeURIComponent(number)}`,
  PURCHASE_ORDER: (id) => `/purchase-orders/${id}`,
  INTERNAL_TRANSFER: (id) => `/purchase-orders/internal/${id}`,
  STOCK_OPNAME: (id) => `/reports/stock-opname/${id}`,
}

function formatDateTime(value: string): string {
  return formatWIB(value, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDay(value: string): string {
  return formatWIB(`${value}T00:00:00+07:00`, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

function formatPeriod(start: string, end: string): string {
  const f = (d: string) => formatWIB(`${d}T00:00:00+07:00`, { day: '2-digit', month: 'short', year: 'numeric' })
  return start === end ? f(start) : `${f(start)} – ${f(end)}`
}

export interface TimelineTarget {
  branchId: number
  branchName: string
  categories: string[]
}

export default function StockMutationTimelineDialog({
  productId,
  productName,
  startDate,
  endDate,
  target,
  onClose,
}: {
  productId: number
  productName: string
  startDate: string
  endDate: string
  target: TimelineTarget
  onClose: () => void
}) {
  const [mode, setMode] = useState<Mode>('transaction')
  const [categories, setCategories] = useState<string[]>(target.categories)
  const [data, setData] = useState<StockMutationTimeline | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildQuery = useCallback(
    (cursor?: number) => {
      const types = MUTATION_CATEGORIES.filter((c) => categories.includes(c.label)).flatMap((c) => c.types)
      const qs = new URLSearchParams({ startDate, endDate, branchId: String(target.branchId), mode })
      if (types.length > 0) qs.set('types', types.join(','))
      if (cursor) qs.set('cursor', String(cursor))
      return `/api/bo/reports/stock-overview/${productId}/mutations/timeline?${qs}`
    },
    [categories, endDate, mode, productId, startDate, target.branchId],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(buildQuery())
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Gagal memuat timeline mutasi')
        if (!cancelled) setData(json)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [buildQuery])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  async function loadMore() {
    if (!data || data.mode !== 'transaction' || data.nextCursor == null) return
    setLoadingMore(true)
    try {
      const res = await fetch(buildQuery(data.nextCursor))
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Gagal memuat timeline mutasi')
      const next = json as StockMutationTimeline
      if (next.mode !== 'transaction') return
      setData({ ...next, entries: [...data.entries, ...next.entries] })
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoadingMore(false)
    }
  }

  function toggleCategory(label: string) {
    setCategories((prev) => (prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label]))
  }

  const uom = data?.baseUomCode ?? ''
  const filtered = categories.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Timeline mutasi ${productName}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-lg border border-border bg-background shadow-lg"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Timeline Mutasi Stok</p>
            <h2 className="mt-0.5 text-lg font-bold text-foreground">{productName}</h2>
            <p className="text-sm text-muted-foreground">
              {target.branchName} · {formatPeriod(startDate, endDate)}
              {uom && <> · satuan dasar <span className="font-semibold">{uom}</span></>}
            </p>
          </div>
          <div className="flex items-start gap-6">
            {data && (
              <div className="hidden gap-6 text-right sm:flex">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Stok Awal</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">{formatBalance(data.openingQty)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Stok Akhir</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">{formatBalance(data.closingQty)}</p>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              aria-label="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3 text-xs">
          <div className="inline-flex rounded-md border border-border bg-card p-0.5">
            {([
              ['transaction', 'Per transaksi'],
              ['daily', 'Per hari'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded px-3 py-1 font-medium transition-colors ${
                  mode === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCategories([])}
              className={`rounded-full border px-2.5 py-0.5 font-medium transition-colors ${
                !filtered ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              Semua
            </button>
            {MUTATION_CATEGORIES.map((c) => (
              <button
                key={c.label}
                type="button"
                title={c.hint}
                onClick={() => toggleCategory(c.label)}
                className={`rounded-full border px-2.5 py-0.5 font-medium transition-colors ${
                  categories.includes(c.label)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="flex-1 overflow-auto">
          {error && <div className="px-6 py-4 text-sm text-destructive">{error}</div>}
          {data?.mode === 'transaction' && (
            <TransactionTable data={data} filtered={filtered} />
          )}
          {data?.mode === 'daily' && <DailyTable data={data} />}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3 text-xs text-muted-foreground">
          <span>
            {filtered
              ? 'Saldo tetap memperhitungkan semua jenis mutasi, bukan hanya yang difilter.'
              : 'Saldo = stok awal + mutasi berurutan. Stok awal dihitung mundur dari stok sistem saat ini.'}
          </span>
          {data?.mode === 'transaction' && (
            <div className="flex items-center gap-3">
              <span>
                {data.entries.length} dari {data.total} baris
              </span>
              {data.nextCursor != null && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground hover:bg-muted/40 disabled:opacity-50"
                >
                  {loadingMore ? 'Memuat...' : 'Muat berikutnya'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BoundaryRow({ label, qty, colSpan }: { label: string; qty: number; colSpan: number }) {
  return (
    <tr className="bg-muted/20">
      <td colSpan={colSpan} className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </td>
      <td className="px-4 py-2 text-right font-bold tabular-nums text-foreground">{formatBalance(qty)}</td>
    </tr>
  )
}

function TransactionTable({
  data,
  filtered,
}: {
  data: Extract<StockMutationTimeline, { mode: 'transaction' }>
  filtered: boolean
}) {
  const reachedEnd = data.nextCursor == null
  const startsAtFirst = data.entries[0]?.seq === 1
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-background">
        <tr className="border-b border-border text-muted-foreground">
          <th className="px-4 py-2 text-left font-bold uppercase tracking-widest">Waktu</th>
          <th className="px-4 py-2 text-left font-bold uppercase tracking-widest">Jenis</th>
          <th className="px-4 py-2 text-left font-bold uppercase tracking-widest">Referensi</th>
          <th className="px-4 py-2 text-left font-bold uppercase tracking-widest">Pelaku</th>
          <th className="px-4 py-2 text-left font-bold uppercase tracking-widest">Catatan</th>
          <th className="px-4 py-2 text-right font-bold uppercase tracking-widest">Qty</th>
          <th className="px-4 py-2 text-right font-bold uppercase tracking-widest">Saldo</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {(!filtered || startsAtFirst) && <BoundaryRow label="Stok awal" qty={data.openingQty} colSpan={6} />}
        {data.entries.length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
              Tidak ada mutasi pada periode ini.
            </td>
          </tr>
        )}
        {data.entries.map((e) => (
          <tr key={e.id} className="hover:bg-muted/10">
            <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{formatDateTime(e.createdAt)}</td>
            <td className="whitespace-nowrap px-4 py-2">
              <span className="font-medium text-foreground">{MOVEMENT_LABEL[e.movementType as MovementKey] ?? e.movementType}</span>
              {categoryOf(e.movementType) && categoryOf(e.movementType) !== MOVEMENT_LABEL[e.movementType as MovementKey] && (
                <span className="block text-[10px] text-muted-foreground">{categoryOf(e.movementType)}</span>
              )}
            </td>
            <td className="whitespace-nowrap px-4 py-2 font-mono">
              {e.link ? (
                <a
                  href={LINK_HREF[e.link.kind](e.link.id, e.link.number)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {e.referenceNumber}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-card-foreground">{e.referenceNumber}</span>
              )}
            </td>
            <td className="whitespace-nowrap px-4 py-2 text-card-foreground">{e.actorName}</td>
            <td className="max-w-xs truncate px-4 py-2 text-muted-foreground" title={e.notes ?? undefined}>
              {e.notes ?? '-'}
            </td>
            <td className={`whitespace-nowrap px-4 py-2 text-right tabular-nums font-semibold ${qtyTone(e.qtyBase)}`}>
              {formatQty(e.qtyBase, true)}
              {!e.isBaseUom && (
                <span className="block text-[10px] font-normal text-muted-foreground">
                  {formatQty(e.qtyOriginal, true)} {e.uomCode}
                </span>
              )}
            </td>
            <td className={`whitespace-nowrap px-4 py-2 text-right tabular-nums font-bold ${e.balance < 0 ? 'text-destructive' : 'text-foreground'}`}>
              {formatBalance(e.balance)}
            </td>
          </tr>
        ))}
        {reachedEnd && <BoundaryRow label="Stok akhir" qty={data.closingQty} colSpan={6} />}
      </tbody>
    </table>
  )
}

function DailyTable({ data }: { data: Extract<StockMutationTimeline, { mode: 'daily' }> }) {
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-background">
        <tr className="border-b border-border text-muted-foreground">
          <th className="px-4 py-2 text-left font-bold uppercase tracking-widest">Tanggal</th>
          <th className="px-4 py-2 text-right font-bold uppercase tracking-widest">Mutasi</th>
          <th className="px-4 py-2 text-right font-bold uppercase tracking-widest">Masuk</th>
          <th className="px-4 py-2 text-right font-bold uppercase tracking-widest">Keluar</th>
          <th className="px-4 py-2 text-right font-bold uppercase tracking-widest">Saldo Akhir Hari</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        <BoundaryRow label="Stok awal" qty={data.openingQty} colSpan={4} />
        {data.entries.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
              Tidak ada mutasi pada periode ini.
            </td>
          </tr>
        )}
        {data.entries.map((d: StockMutationDailyEntry) => (
          <tr key={d.date} className="hover:bg-muted/10">
            <td className="whitespace-nowrap px-4 py-2 text-card-foreground">{formatDay(d.date)}</td>
            <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{d.movementCount}</td>
            <td className={`px-4 py-2 text-right tabular-nums font-semibold ${qtyTone(d.qtyIn)}`}>{formatQty(d.qtyIn, true)}</td>
            <td className={`px-4 py-2 text-right tabular-nums font-semibold ${qtyTone(d.qtyOut)}`}>{formatQty(d.qtyOut, true)}</td>
            <td className={`px-4 py-2 text-right tabular-nums font-bold ${d.balance < 0 ? 'text-destructive' : 'text-foreground'}`}>
              {formatBalance(d.balance)}
            </td>
          </tr>
        ))}
        <BoundaryRow label="Stok akhir" qty={data.closingQty} colSpan={4} />
      </tbody>
    </table>
  )
}
