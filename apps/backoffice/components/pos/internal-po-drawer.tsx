'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CartItem, CartSourceIbt, SelectedCustomer } from './cart-store'
import { formatRupiah } from './cart-store'
import { buildInternalPoCartItems, internalPoQtyStrategies, type InternalPoItem } from './internal-po-cart-items'
import { useShortcutLock } from './shortcut-lock'

interface PoListRow {
  id: number
  ibtNumber: string
  status: string
  destinationBranchName: string | null
  requestedByName: string | null
  createdAt: string
  totalValue: number
  itemCount: number
}

interface PoDetailItem extends InternalPoItem {
  productSku: string | null
}

interface PoDetail {
  id: number
  ibtNumber: string
  status: string
  destinationBranchName: string | null
  destinationCustomerId: number | null
  destinationCustomerName: string | null
  requestedByName: string | null
  notes: string | null
  items: PoDetailItem[]
}

interface InternalPoDrawerProps {
  hasActiveCart: boolean
  onClose: () => void
  onImported: (items: CartItem[], customer: SelectedCustomer | null, sourceIbt: CartSourceIbt) => void
  // Dipanggil setelah pembatalan berhasil supaya badge di kasir ikut turun.
  onCancelled: () => void
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Draft', cls: 'bg-muted text-muted-foreground' },
  PENDING_APPROVAL: { label: 'Menunggu', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
}

function statusBadge(status: string) {
  return STATUS_LABEL[status] ?? { label: status, cls: 'bg-muted text-muted-foreground' }
}

export default function InternalPoDrawer({ hasActiveCart, onClose, onImported, onCancelled }: InternalPoDrawerProps) {
  useShortcutLock()

  const [view, setView] = useState<'list' | 'detail'>('list')
  const [rows, setRows] = useState<PoListRow[]>([])
  const [detail, setDetail] = useState<PoDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shortConfirm, setShortConfirm] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/pos/internal-po')
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError((d as { error?: string }).error ?? 'Gagal mengambil daftar PO Internal')
        return
      }
      setRows((await res.json()) as PoListRow[])
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }, [])

  const openDetail = useCallback(async (id: number) => {
    setLoading(true)
    setError('')
    setView('detail')
    setDetail(null)
    try {
      const res = await fetch(`/api/pos/internal-po/${id}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError((d as { error?: string }).error ?? 'Gagal mengambil detail PO Internal')
        return
      }
      setDetail((await res.json()) as PoDetail)
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || busy) return
      if (shortConfirm) setShortConfirm(false)
      else if (view === 'detail') { setView('list'); setDetail(null) }
      else onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [busy, shortConfirm, view, onClose])

  function doImport(cartItems: CartItem[]) {
    if (!detail) return
    if (cartItems.length === 0) {
      setError('Tidak ada produk yang bisa diproses.')
      setShortConfirm(false)
      return
    }
    const customer: SelectedCustomer | null = detail.destinationCustomerId
      ? {
          id: detail.destinationCustomerId,
          name: detail.destinationCustomerName ?? 'Cabang tujuan',
          tierType: 'RETAIL',
        }
      : null
    onImported(cartItems, customer, { id: detail.id, ibtNumber: detail.ibtNumber })
    onClose()
  }

  function handleProcess() {
    if (!detail) return
    if (
      hasActiveCart &&
      !confirm('Keranjang saat ini akan diganti dengan isi PO Internal. Lanjutkan?')
    ) {
      return
    }
    const hasShort = detail.items.some((it) => it.insufficient)
    if (!hasShort) {
      doImport(buildInternalPoCartItems(detail.items, internalPoQtyStrategies.requested))
      return
    }
    setShortConfirm(true)
  }

  async function handleCancel() {
    if (!detail) return
    if (!confirm(`Batalkan PO Internal ${detail.ibtNumber}? Tindakan ini tidak bisa dibatalkan.`)) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/pos/internal-po/${detail.id}/cancel`, { method: 'PATCH' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError((d as { error?: string }).error ?? 'Gagal membatalkan PO Internal')
        return
      }
      onCancelled()
      setView('list')
      setDetail(null)
      fetchList()
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} role="presentation" />

      <div
        className="relative w-full max-w-lg bg-card border-l border-border h-full flex flex-col shadow-xl animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="PO Internal masuk"
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {view === 'detail' && (
              <button
                type="button"
                onClick={() => { setView('list'); setDetail(null); setError('') }}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg"
                aria-label="Kembali ke daftar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground truncate">
                {view === 'detail' && detail ? detail.ibtNumber : 'PO Internal Masuk'}
              </h2>
              <p className="text-sm text-muted-foreground truncate">
                {view === 'detail' && detail
                  ? `Dari ${detail.destinationBranchName ?? 'cabang lain'}`
                  : 'Permintaan stok dari cabang lain'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full"
            aria-label="Tutup"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <p className="px-6 py-3 text-sm text-destructive border-b border-border" role="alert">
            {error}
          </p>
        )}

        {/* ── Daftar ─────────────────────────────────────────────── */}
        {view === 'list' && (
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Memuat…</div>
            ) : rows.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                <p className="text-3xl mb-2">📦</p>
                <p className="text-sm">Tidak ada PO Internal masuk yang perlu diproses</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">No. / Cabang</th>
                    <th className="text-right font-medium px-2 py-2">Item</th>
                    <th className="text-right font-medium px-4 py-2">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const b = statusBadge(r.status)
                    return (
                      <tr
                        key={r.id}
                        onClick={() => openDetail(r.id)}
                        className="border-b border-border/60 cursor-pointer hover:bg-muted/40"
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-foreground">{r.ibtNumber}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${b.cls}`}>{b.label}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {r.destinationBranchName ?? '-'} ·{' '}
                            {new Date(r.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{r.itemCount}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                          {formatRupiah(String(r.totalValue))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Detail ─────────────────────────────────────────────── */}
        {view === 'detail' && (
          <>
            <div className="flex-1 overflow-y-auto">
              {loading || !detail ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Memuat…</div>
              ) : (
                <>
                  {detail.notes && (
                    <p className="px-4 py-2 text-xs text-muted-foreground border-b border-border">Catatan: {detail.notes}</p>
                  )}
                  {detail.items.some((it) => it.insufficient) && (
                    <p className="px-4 py-2 text-xs text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-900">
                      Ada produk dengan stok kurang / kosong. Bisa diproses dengan konfirmasi.
                    </p>
                  )}
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b border-border">
                      <tr>
                        <th className="text-left font-medium px-4 py-2">Produk</th>
                        <th className="text-right font-medium px-2 py-2">Diminta</th>
                        <th className="text-right font-medium px-4 py-2">Stok</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.items.map((it) => (
                        <tr key={it.id} className="border-b border-border/60 align-top">
                          <td className="px-4 py-2">
                            <div className="text-foreground">{it.productName ?? `Produk #${it.productId}`}</div>
                            {it.productSku && <div className="text-[11px] text-muted-foreground">{it.productSku}</div>}
                            {Object.keys(it.tierPrices ?? {}).length === 0 ? (
                              <div className="text-[11px] text-orange-600">Belum ada harga di cabang ini — masuk Rp 0, ubah manual</div>
                            ) : it.retailPrice == null ? (
                              <div className="text-[11px] text-orange-600">Tak ada harga retail — pakai tier lain, sesuaikan</div>
                            ) : null}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {it.qtyRequested} {it.uomCode}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">
                            <span className={it.insufficient ? 'text-destructive font-semibold' : 'text-foreground'}>
                              {it.currentQty == null ? '–' : it.currentQty} {it.uomCode}
                            </span>
                            {it.insufficient && (
                              <div className="text-[11px] text-destructive">
                                {it.currentQty == null
                                  ? 'Satuan stok tak terkonversi'
                                  : it.currentQty <= 0
                                    ? 'Stok kosong'
                                    : `Kurang ${it.qtyRequested - it.currentQty}`}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            {detail && !loading && (
              <div className="border-t border-border p-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={busy}
                  className="min-h-[48px] px-4 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 disabled:opacity-40 transition-colors"
                >
                  Batalkan
                </button>
                <button
                  type="button"
                  onClick={handleProcess}
                  disabled={busy}
                  className="flex-1 min-h-[48px] rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-40 active:scale-[0.98] transition-all"
                >
                  Proses ke Keranjang
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Dialog konfirmasi stok kurang ──────────────────────── */}
        {shortConfirm && detail && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-2xl">
              <h3 className="text-base font-bold text-foreground">Sebagian produk stoknya kurang</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Pilih cara memproses PO Internal ini ke keranjang:
              </p>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => doImport(buildInternalPoCartItems(detail.items, internalPoQtyStrategies.available))}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-accent text-left"
                >
                  Pakai stok yang ada
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    Qty item yang kurang diturunkan ke stok tersedia; yang kosong dilewati.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => doImport(buildInternalPoCartItems(detail.items, internalPoQtyStrategies.requested))}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-accent text-left"
                >
                  Oversell — pakai qty yang diminta
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    Stok cabang bisa jadi minus. Semua item ikut, apa adanya.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => doImport(buildInternalPoCartItems(detail.items, internalPoQtyStrategies.dropShort))}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-accent text-left"
                >
                  Hapus produk yang kurang/kosong
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    Hanya produk yang stoknya mencukupi yang masuk keranjang.
                  </span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShortConfirm(false)}
                className="w-full mt-3 min-h-[40px] text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
