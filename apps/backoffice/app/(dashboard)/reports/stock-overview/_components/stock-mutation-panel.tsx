'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { StockMutationMovements, StockMutationSummary } from './types'
import { MOVEMENT_LABEL, MUTATION_CATEGORIES, formatQty, qtyTone, type MovementKey } from './mutation-format'
import StockMutationTimelineDialog, { type TimelineTarget } from './stock-mutation-timeline-dialog'

const WIB_ISO_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function defaultRange(): { startDate: string; endDate: string } {
  const today = WIB_ISO_DATE.format(new Date())
  return { startDate: `${today.slice(0, 8)}01`, endDate: today }
}

function columnTotal(movements: StockMutationMovements, types: MovementKey[]): number {
  return types.reduce((acc, t) => acc + (movements[t] ?? 0), 0)
}

function columnTitle(movements: StockMutationMovements, types: MovementKey[], hint?: string): string | undefined {
  const parts = types
    .filter((t) => (movements[t] ?? 0) !== 0)
    .map((t) => `${MOVEMENT_LABEL[t]}: ${formatQty(movements[t]!, true)}`)
  if (parts.length <= 1) return hint
  return [hint, ...parts].filter(Boolean).join('\n')
}

function MovementCells({
  movements,
  onOpen,
}: {
  movements: StockMutationMovements
  onOpen?: (category: string) => void
}) {
  return (
    <>
      {MUTATION_CATEGORIES.map((col) => {
        const value = columnTotal(movements, col.types)
        const clickable = onOpen != null && col.types.some((t) => (movements[t] ?? 0) !== 0)
        return (
          <td
            key={col.label}
            title={columnTitle(movements, col.types, col.hint)}
            className={`px-3 py-2 text-right tabular-nums ${qtyTone(value)}`}
          >
            {clickable ? (
              <button
                type="button"
                onClick={() => onOpen(col.label)}
                className="tabular-nums underline decoration-dotted underline-offset-2 hover:decoration-solid"
              >
                {formatQty(value, true)}
              </button>
            ) : (
              formatQty(value, true)
            )}
          </td>
        )
      })}
    </>
  )
}

export default function StockMutationPanel({ productId, productName }: { productId: number; productName: string }) {
  const [range, setRange] = useState(defaultRange)
  const [data, setData] = useState<StockMutationSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<TimelineTarget | null>(null)

  const load = useCallback(async (startDate: string, endDate: string) => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ startDate, endDate })
      const res = await fetch(`/api/bo/reports/stock-overview/${productId}/mutations?${qs}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Gagal memuat ringkasan mutasi')
      setData(json)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [productId])

  useEffect(() => {
    const initial = defaultRange()
    load(initial.startDate, initial.endDate)
  }, [load])

  function apply(e: React.FormEvent) {
    e.preventDefault()
    if (!range.startDate || !range.endDate) return
    load(range.startDate, range.endDate)
  }

  const uom = data?.baseUomCode ?? ''
  const showCurrent = data?.branches.some((b) => b.closingQty !== b.currentQty) ?? false

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={apply} className="flex flex-wrap items-end gap-2 text-xs">
        <label className="flex flex-col gap-1">
          <span className="font-bold uppercase tracking-widest text-muted-foreground">Dari</span>
          <input
            type="date"
            value={range.startDate}
            max={range.endDate}
            onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))}
            className="rounded border border-border bg-background px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-bold uppercase tracking-widest text-muted-foreground">Sampai</span>
          <input
            type="date"
            value={range.endDate}
            min={range.startDate}
            onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))}
            className="rounded border border-border bg-background px-2 py-1"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50"
        >
          Terapkan
        </button>
        {loading && <Loader2 className="mb-1.5 h-4 w-4 animate-spin text-muted-foreground" />}
      </form>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {data && (
        <div className="rounded-md border border-border bg-card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/20 text-muted-foreground">
                <th className="text-left px-3 py-2 font-bold uppercase tracking-widest">Cabang</th>
                <th className="text-right px-3 py-2 font-bold uppercase tracking-widest">Stok Awal</th>
                {MUTATION_CATEGORIES.map((col) => (
                  <th
                    key={col.label}
                    title={col.hint}
                    className="text-right px-3 py-2 font-bold uppercase tracking-widest whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
                <th className="text-right px-3 py-2 font-bold uppercase tracking-widest">Stok Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.branches.length === 0 && (
                <tr>
                  <td colSpan={MUTATION_CATEGORIES.length + 3} className="px-3 py-4 text-center text-muted-foreground">
                    Belum ada stok maupun mutasi untuk produk ini.
                  </td>
                </tr>
              )}
              {data.branches.map((b) => (
                <tr key={b.branchId} className="hover:bg-muted/10">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setTimeline({ branchId: b.branchId, branchName: b.branchName, categories: [] })}
                      className="font-semibold text-primary hover:underline"
                      title="Lihat timeline mutasi cabang ini"
                    >
                      {b.branchName}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-card-foreground">{formatQty(b.openingQty)}</td>
                  <MovementCells
                    movements={b.movements}
                    onOpen={(category) =>
                      setTimeline({ branchId: b.branchId, branchName: b.branchName, categories: [category] })
                    }
                  />
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-card-foreground">
                    {formatQty(b.closingQty)}
                    {showCurrent && b.closingQty !== b.currentQty && (
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        kini {formatQty(b.currentQty)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {data.branches.length > 1 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/20 font-bold">
                  <td className="px-3 py-2 text-card-foreground">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums text-card-foreground">{formatQty(data.total.openingQty)}</td>
                  <MovementCells movements={data.total.movements} />
                  <td className="px-3 py-2 text-right tabular-nums text-card-foreground">{formatQty(data.total.closingQty)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {data && (
        <p className="text-[11px] text-muted-foreground">
          Semua angka dalam satuan dasar{uom && <> (<span className="font-semibold">{uom}</span>)</>}. Stok awal &amp; akhir
          dihitung mundur dari stok sistem saat ini dikurangi mutasi tercatat, jadi perubahan stok yang tidak tercatat
          di Mutasi Stok ikut terbawa ke stok awal. Klik nama cabang atau angka mutasi untuk melihat timeline-nya.
        </p>
      )}
      {timeline && data && (
        <StockMutationTimelineDialog
          productId={productId}
          productName={productName}
          startDate={data.startDate}
          endDate={data.endDate}
          target={timeline}
          onClose={() => setTimeline(null)}
        />
      )}
    </div>
  )
}
