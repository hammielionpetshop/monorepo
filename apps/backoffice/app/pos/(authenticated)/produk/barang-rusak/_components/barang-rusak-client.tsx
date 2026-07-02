'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PackageX, Plus, Search, Trash2, X } from 'lucide-react'
import {
  REASON_LABELS,
  type DamagedHistoryEntry,
  type DamagedReason,
  type DraftItem,
  type ProductSearchResult,
} from './types'

const REASONS: DamagedReason[] = ['RUSAK', 'EXPIRED', 'HILANG']

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function BarangRusakClient({ branchId }: { branchId: number }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const [draft, setDraft] = useState<DraftItem[]>([])
  const [reason, setReason] = useState<DamagedReason>('RUSAK')
  const [notes, setNotes] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [history, setHistory] = useState<DamagedHistoryEntry[]>([])
  const [hasActiveShift, setHasActiveShift] = useState(true)

  const searchBoxRef = useRef<HTMLDivElement>(null)

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/pos/damaged-goods')
      if (!res.ok) return
      const data = await res.json()
      setHistory(Array.isArray(data.data) ? data.data : [])
      setHasActiveShift(!!data.hasActiveShift)
    } catch {
      // abaikan — riwayat bersifat informatif
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Debounced product search
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products?q=${encodeURIComponent(q)}&branchId=${branchId}&limit=20`,
        )
        if (res.ok) {
          const data = await res.json()
          setResults(Array.isArray(data) ? data : [])
          setShowResults(true)
        }
      } catch {
        // abaikan
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, branchId])

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addProduct = (p: ProductSearchResult) => {
    setError('')
    setSuccess('')
    const baseUom = p.uoms.find((u) => u.isBase) ?? p.uoms[0]
    setDraft((prev) => {
      if (prev.some((it) => it.productId === p.id && it.uomId === (baseUom?.id ?? p.baseUomId))) {
        return prev
      }
      return [
        ...prev,
        {
          productId: p.id,
          productName: p.name,
          uomId: baseUom?.id ?? p.baseUomId,
          uomCode: baseUom?.code ?? '-',
          qty: 1,
        },
      ]
    })
    setQuery('')
    setResults([])
    setShowResults(false)
  }

  const updateQty = (index: number, qty: number) => {
    setDraft((prev) => prev.map((it, i) => (i === index ? { ...it, qty } : it)))
  }

  const removeItem = (index: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== index))
  }

  const submit = async () => {
    setError('')
    setSuccess('')
    const valid = draft.filter((it) => it.qty > 0)
    if (valid.length === 0) {
      setError('Tambahkan minimal satu item dengan qty lebih dari 0')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/pos/damaged-goods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          notes: notes.trim() || undefined,
          items: valid.map((it) => ({ productId: it.productId, uomId: it.uomId, qty: it.qty })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Gagal mencatat barang rusak')
        return
      }
      setSuccess('Barang rusak berhasil dicatat')
      setDraft([])
      setNotes('')
      setReason('RUSAK')
      loadHistory()
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  const totalHistoryLoss = history.reduce((acc, h) => acc + h.totalLossValue, 0)

  return (
    <div className="mx-auto w-full max-w-3xl p-4 space-y-5">
      <div className="flex items-center gap-2">
        <PackageX className="h-5 w-5 text-destructive" aria-hidden="true" />
        <h1 className="text-lg font-bold text-foreground">Input Barang Rusak</h1>
      </div>

      {!hasActiveShift && (
        <p className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Tidak ada shift aktif. Entri tetap tercatat, namun tidak terikat ke shift manapun.
        </p>
      )}

      {/* Form input */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        {/* Pencarian produk */}
        <div ref={searchBoxRef} className="relative">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Cari Produk</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setShowResults(true)}
              placeholder="Nama / SKU / barcode produk"
              className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px]"
            />
          </div>
          {showResults && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
              {searching && <p className="px-3 py-3 text-sm text-muted-foreground">Mencari…</p>}
              {!searching && results.length === 0 && (
                <p className="px-3 py-3 text-sm text-muted-foreground">Produk tidak ditemukan</p>
              )}
              {!searching &&
                results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {p.sku ?? '—'} · Stok: {p.stock}
                      </p>
                    </div>
                    <Plus className="h-4 w-4 flex-shrink-0 text-primary" />
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Daftar item draft */}
        {draft.length > 0 && (
          <div className="space-y-2">
            {draft.map((it, i) => {
              return (
                <div
                  key={`${it.productId}-${it.uomId}`}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{it.productName}</p>
                    <p className="text-xs text-muted-foreground">Satuan: {it.uomCode}</p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={it.qty}
                    onChange={(e) => updateQty(i, Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-center text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[40px]"
                    aria-label={`Qty ${it.productName}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Hapus item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Alasan */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Alasan</label>
          <div className="grid grid-cols-3 gap-2">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                  reason === r
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent'
                }`}
              >
                {REASON_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Catatan */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Catatan (opsional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Keterangan tambahan…"
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-destructive" role="alert">
            <X className="h-4 w-4" /> {error}
          </p>
        )}
        {success && (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400" role="status">
            {success}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={submitting || draft.length === 0}
          className="w-full rounded-lg bg-destructive py-3 text-sm font-bold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-40 min-h-[48px]"
        >
          {submitting ? 'Menyimpan…' : 'Catat Barang Rusak'}
        </button>
      </div>

      {/* Riwayat */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">
            {hasActiveShift ? 'Riwayat Shift Ini' : 'Riwayat Hari Ini'}
          </h2>
          <span className="text-sm font-bold text-destructive">{formatRupiah(totalHistoryLoss)}</span>
        </div>
        {history.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Belum ada catatan barang rusak</p>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((h) => (
              <li key={h.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {REASON_LABELS[h.reason]} · {formatTime(h.reportedAt)} · {h.reportedByName}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {h.items.map((it, idx) => (
                        <li key={idx} className="text-sm text-foreground">
                          {it.productName} — {it.qty} {it.uomCode}
                        </li>
                      ))}
                    </ul>
                    {h.notes && <p className="mt-1 text-xs italic text-muted-foreground">{h.notes}</p>}
                  </div>
                  <span className="flex-shrink-0 text-sm font-bold text-destructive">
                    {formatRupiah(h.totalLossValue)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
