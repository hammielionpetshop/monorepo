'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ZeroCostRow } from './types'

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`

const SOURCE_LABEL: Record<string, string> = {
  BASE: 'Modal satuan dasar',
  BIG_UOM: 'Modal satuan besar ÷ rasio',
  DEFAULT: 'Modal default produk',
  OTHER_BRANCH: 'Modal cabang lain',
}

const FLAG_LABEL: Record<string, string> = {
  MODAL_MELEBIHI_HARGA_JUAL: 'Modal ≥ harga jual',
  JAUH_DI_ATAS_BATCH_LAIN: 'Jauh di atas batch lain',
}

/**
 * Isi modal batch yang tercatat Rp 0. Usulan dihitung server; yang wajar dicentang otomatis,
 * yang mencurigakan (modal cabang lain, modal ≥ harga jual, jauh di atas batch lain) dibiarkan
 * tidak dicentang supaya diperiksa dulu. Hanya batch bermodal 0 yang pernah disentuh.
 */
export default function ZeroCostBatchPanel({ count }: { count: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ZeroCostRow[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    setOpen(true)
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/bo/reports/stock-valuation/zero-cost-batches')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal memuat data')
      const items: ZeroCostRow[] = data.items
      setRows(items)
      setSelected(new Set(items.filter((r) => r.proposal?.recommended).map((r) => r.batchId)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  async function apply() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/bo/reports/stock-valuation/zero-cost-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchIds: Array.from(selected) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal mengisi modal')
      setMessage(
        `${data.updated} batch terisi, nilai stok bertambah ${rupiah(data.totalValue)}` +
          (data.skipped > 0 ? ` · ${data.skipped} dilewati (sudah berubah / tanpa usulan)` : ''),
      )
      setRows(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengisi modal')
    } finally {
      setLoading(false)
    }
  }

  const selectable = useMemo(() => (rows ?? []).filter((r) => r.proposal), [rows])
  const selectedValue = useMemo(
    () => selectable.filter((r) => selected.has(r.batchId)).reduce((sum, r) => sum + r.qtyRemaining * r.proposal!.costPerBase, 0),
    [selectable, selected],
  )

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (count === 0 && !message) return null

  return (
    <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">
            {count > 0 ? `${count} batch stok bermodal Rp 0` : 'Modal batch sudah diperbarui'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {message ||
              'Nilai stok produk ini terhitung nol. Modal bisa dihitung otomatis dari Manajemen Harga — periksa dulu sebelum diterapkan.'}
          </p>
        </div>
        {count > 0 && !open && (
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            Hitung modal otomatis
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4">
          {error && <p className="mb-3 text-sm font-medium text-destructive">{error}</p>}
          {loading && !rows && <p className="text-sm text-muted-foreground">Memuat…</p>}

          {rows && rows.length > 0 && (
            <>
              <div className="max-h-[28rem] overflow-auto rounded-md border border-border bg-card">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted text-[10px] uppercase tracking-widest text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          aria-label="Pilih semua"
                          checked={selectable.length > 0 && selectable.every((r) => selected.has(r.batchId))}
                          onChange={(e) =>
                            setSelected(e.target.checked ? new Set(selectable.map((r) => r.batchId)) : new Set())
                          }
                        />
                      </th>
                      <th className="px-3 py-2 text-left">Produk</th>
                      <th className="px-3 py-2 text-left">Cabang</th>
                      <th className="px-3 py-2 text-right">Sisa</th>
                      <th className="px-3 py-2 text-right">Usulan modal / satuan dasar</th>
                      <th className="px-3 py-2 text-left">Asal angka</th>
                      <th className="px-3 py-2 text-right">Harga jual dasar</th>
                      <th className="px-3 py-2 text-right">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.batchId} className="border-t border-border align-top">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Pilih ${r.productName}`}
                            disabled={!r.proposal}
                            checked={selected.has(r.batchId)}
                            onChange={() => toggle(r.batchId)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-card-foreground">{r.productName}</p>
                          {r.sku && <p className="font-mono text-xs text-muted-foreground">{r.sku}</p>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{r.branchName}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {r.qtyRemaining.toLocaleString('id-ID')} {r.baseUomCode}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                          {r.proposal ? rupiah(r.proposal.costPerBase) : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {r.proposal ? (
                            <>
                              <p className="text-card-foreground">{SOURCE_LABEL[r.proposal.source]}</p>
                              <p className="text-muted-foreground">{r.proposal.detail}</p>
                              {r.proposal.flags.map((f) => (
                                <span
                                  key={f}
                                  className="mt-1 mr-1 inline-block rounded bg-destructive/10 px-1.5 py-0.5 font-semibold text-destructive"
                                >
                                  {FLAG_LABEL[f] ?? f}
                                </span>
                              ))}
                            </>
                          ) : (
                            <span className="text-muted-foreground">Belum ada modal di mana pun — isi di Manajemen Harga</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap text-muted-foreground">
                          {r.baseSellingPrice ? rupiah(r.baseSellingPrice) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {r.proposal ? rupiah(r.qtyRemaining * r.proposal.costPerBase) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-muted-foreground border border-border rounded-md hover:bg-accent"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={loading || selected.size === 0}
                  onClick={apply}
                  className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? 'Menyimpan…' : `Terapkan ${selected.size} batch · ${rupiah(selectedValue)}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
