'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Search,
  Camera,
  Loader2,
  Check,
  X,
  Trash2,
  ChevronLeft,
  ClipboardList,
  Minus,
  Plus,
  AlertTriangle,
} from 'lucide-react'
import BarcodeScanner from '@/components/pos/barcode-scanner'
import {
  applySnapshotFailure,
  applySnapshotSuccess,
  markLineForRecount,
} from './stock-opname-snapshot-state'

type Method = 'MANUAL' | 'BEST_SELLER' | 'SOLD_TODAY'
type Step = 'PILIH_METODE' | 'HITUNG' | 'REVIEW' | 'SUKSES'
type Mode = 'MANDIRI' | 'FULL'

interface ActiveFullSo {
  id: number
  soNumber: string
  notes: string | null
}

interface UomOption {
  id: number
  code: string
  isBase: boolean
}

interface Candidate {
  productId: number
  productName: string
  sku: string | null
  baseUomId: number
  baseUomCode: string | null
  uoms: UomOption[]
}

interface CountLine {
  productId: number
  productName: string
  sku: string | null
  uoms: UomOption[]
  uomId: number
  physicalQty: string
  // Token snapshot stok saat menghitung, diterbitkan server. Tanpa ini, selisih akan
  // dihitung terhadap stok saat submit — bisa berjam-jam kemudian setelah ada penjualan.
  snapshotToken: string | null
  snapshotPending: boolean
  snapshotVersion: number
}

interface VarianceItem {
  productId: number
  uomId: number
  systemQty: number
  physicalQty: number
  varianceQty: number
  varianceCostValue: number
}

const METHOD_LABELS: Record<Method, { title: string; desc: string }> = {
  MANUAL: { title: 'Cari Manual', desc: 'Cari produk satu per satu' },
  BEST_SELLER: { title: 'Produk Laris', desc: '30 produk terlaris hari ini' },
  SOLD_TODAY: { title: 'Terjual Hari Ini', desc: 'Semua produk yang terjual hari ini' },
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

export default function StockOpnameClient({ mode = 'MANDIRI' }: { mode?: Mode }) {
  const [step, setStep] = useState<Step>('PILIH_METODE')
  const [method, setMethod] = useState<Method>('MANUAL')

  const [fullSo, setFullSo] = useState<ActiveFullSo | null>(null)
  const [fullChecked, setFullChecked] = useState(false)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Candidate[]>([])
  const [searching, setSearching] = useState(false)

  const [lines, setLines] = useState<CountLine[]>([])
  const [scanning, setScanning] = useState(false)

  const [variances, setVariances] = useState<VarianceItem[]>([])
  const [reasons, setReasons] = useState<Record<number, string>>({})

  const [loadingPreview, setLoadingPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [soNumber, setSoNumber] = useState<string | null>(null)

  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const flash = useCallback((type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
  }, [])

  // Deteksi SO Besar (FULL) aktif dari admin untuk cabang ini
  useEffect(() => {
    let active = true
    fetch('/api/pos/stock-opnames/active-full')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!active) return
        const so = Array.isArray(data) && data[0] ? data[0] : null
        setFullSo(so ? { id: so.id, soNumber: so.soNumber, notes: so.notes ?? null } : null)
        setFullChecked(true)
      })
      .catch(() => {
        if (active) setFullChecked(true)
      })
    return () => {
      active = false
    }
  }, [])

  const addLine = useCallback(
    (c: Candidate) => {
      setLines((prev) => {
        if (prev.some((l) => l.productId === c.productId)) {
          flash('err', `${c.productName} sudah ditambahkan`)
          return prev
        }
        return [
          ...prev,
          {
            productId: c.productId,
            productName: c.productName,
            sku: c.sku,
            uoms: c.uoms,
            uomId: c.baseUomId,
            physicalQty: '',
            snapshotToken: null,
            snapshotPending: false,
            snapshotVersion: 0,
          },
        ]
      })
    },
    [flash]
  )

  // Pencarian manual (debounce)
  useEffect(() => {
    if (step !== 'HITUNG' || method !== 'MANUAL') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `/api/pos/stock-opname/count-candidates?method=MANUAL&q=${encodeURIComponent(query.trim())}`
        )
        const data = await res.json()
        setResults(res.ok ? data : [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, step, method])

  async function chooseMethod(m: Method) {
    setMethod(m)
    setStep('HITUNG')
    setQuery('')
    setResults([])
    if (m === 'BEST_SELLER' || m === 'SOLD_TODAY') {
      setSearching(true)
      try {
        const res = await fetch(`/api/pos/stock-opname/count-candidates?method=${m}`)
        const data = await res.json()
        setResults(res.ok ? data : [])
        if (res.ok && data.length === 0) flash('err', 'Belum ada produk terjual hari ini')
      } catch {
        flash('err', 'Gagal memuat produk')
      } finally {
        setSearching(false)
      }
    }
  }

  async function handleScan(code: string) {
    setScanning(false)
    try {
      const res = await fetch(
        `/api/pos/stock-opname/count-candidates?barcode=${encodeURIComponent(code)}`
      )
      const data = await res.json()
      if (!res.ok) {
        flash('err', data.error ?? 'Produk tidak ditemukan')
        return
      }
      if (Array.isArray(data) && data[0]) {
        addLine(data[0])
        flash('ok', `${data[0].productName} ditambahkan`)
      }
    } catch {
      flash('err', 'Terjadi kesalahan jaringan')
    }
  }

  // Minta server membekukan systemQty produk ini SEKARANG (saat kasir baru saja
  // menghitungnya), lalu simpan tokennya untuk dikirim saat submit.
  const captureSnapshot = useCallback(
    async (productId: number, uomId: number, requestVersion: number) => {
      try {
        const res = await fetch('/api/pos/stock-opname/count-snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, uomId }),
        })
        if (!res.ok) throw new Error('snapshot gagal')
        const data = await res.json()
        setLines((prev) =>
          prev.map((l) =>
            // Abaikan bila UOM sudah berubah lagi — token lama tak lagi cocok
            l.productId === productId
              ? applySnapshotSuccess(l, {
                  requestVersion,
                  uomId,
                  snapshotToken: data.snapshotToken,
                })
              : l
          )
        )
      } catch {
        setLines((prev) =>
          prev.map((l) =>
            l.productId === productId ? applySnapshotFailure(l, requestVersion) : l
          )
        )
        flash('err', 'Gagal membekukan stok, ketik ulang jumlahnya untuk mencoba lagi')
      }
    },
    [flash]
  )

  const snapshotTimers = useRef<Record<number, NodeJS.Timeout>>({})

  const scheduleSnapshot = useCallback(
    (productId: number, uomId: number, requestVersion: number) => {
      clearTimeout(snapshotTimers.current[productId])
      snapshotTimers.current[productId] = setTimeout(() => {
        void captureSnapshot(productId, uomId, requestVersion)
      }, 600)
    },
    [captureSnapshot]
  )

  useEffect(() => {
    const timers = snapshotTimers.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
    }
  }, [])

  function updateLine(productId: number, patch: Partial<CountLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.productId !== productId) return l
        // Jumlah atau UOM berubah = hitungan berubah, token lama tak berlaku lagi
        const recount =
          (patch.physicalQty !== undefined && patch.physicalQty !== l.physicalQty) ||
          (patch.uomId !== undefined && patch.uomId !== l.uomId)
        if (!recount) return { ...l, ...patch }

        const result = markLineForRecount(l, patch)
        if (result.shouldSchedule && result.requestVersion !== null) {
          scheduleSnapshot(productId, result.line.uomId, result.requestVersion)
        } else {
          clearTimeout(snapshotTimers.current[productId])
          delete snapshotTimers.current[productId]
        }
        return result.line
      })
    )
  }

  function removeLine(productId: number) {
    clearTimeout(snapshotTimers.current[productId])
    delete snapshotTimers.current[productId]
    setLines((prev) => prev.filter((l) => l.productId !== productId))
  }

  async function goToReview() {
    const invalid = lines.find((l) => l.physicalQty.trim() === '' || Number(l.physicalQty) < 0)
    if (invalid) {
      flash('err', `Isi jumlah fisik untuk ${invalid.productName}`)
      return
    }

    const pending = lines.find((l) => l.snapshotPending)
    if (pending) {
      flash('err', `Tunggu sebentar, stok ${pending.productName} sedang dibekukan`)
      return
    }

    const unsnapshot = lines.find((l) => !l.snapshotToken)
    if (unsnapshot) {
      flash('err', `Stok ${unsnapshot.productName} gagal dibekukan, ketik ulang jumlahnya`)
      return
    }

    setLoadingPreview(true)
    try {
      const res = await fetch('/api/pos/stock-opname/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines.map((l) => ({
            productId: l.productId,
            uomId: l.uomId,
            physicalQty: Number(l.physicalQty),
            snapshotToken: l.snapshotToken,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        flash('err', data.error ?? 'Gagal menghitung selisih')
        return
      }
      setVariances(data.items)
      setReasons({})
      setStep('REVIEW')
    } catch {
      flash('err', 'Terjadi kesalahan jaringan')
    } finally {
      setLoadingPreview(false)
    }
  }

  async function submitSO() {
    const varianceItems = variances.filter((v) => v.varianceQty !== 0)
    const missing = varianceItems.find((v) => !(reasons[v.productId]?.trim()))
    if (missing) {
      const line = lines.find((l) => l.productId === missing.productId)
      flash('err', `Isi alasan selisih untuk ${line?.productName ?? 'produk'}`)
      return
    }
    if (mode === 'FULL' && !fullSo) {
      flash('err', 'SO Besar tidak ditemukan, muat ulang halaman')
      return
    }
    setSubmitting(true)
    try {
      const items = lines.map((l) => ({
        productId: l.productId,
        uomId: l.uomId,
        physicalQty: Number(l.physicalQty),
        varianceReason: reasons[l.productId]?.trim() || undefined,
        snapshotToken: l.snapshotToken,
      }))

      const res =
        mode === 'FULL'
          ? await fetch(`/api/pos/stock-opnames/${fullSo!.id}/add-items`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items }),
            })
          : await fetch('/api/pos/stock-opnames', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'DAILY', method, items }),
            })

      const data = await res.json()
      if (!res.ok) {
        flash('err', data.error ?? 'Gagal mengajukan stock opname')
        return
      }
      setSoNumber(mode === 'FULL' ? fullSo!.soNumber : data.so?.soNumber ?? null)
      setStep('SUKSES')
    } catch {
      flash('err', 'Terjadi kesalahan jaringan')
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setStep('PILIH_METODE')
    setMethod('MANUAL')
    setQuery('')
    setResults([])
    setLines([])
    setVariances([])
    setReasons({})
    setSoNumber(null)
  }

  const nameOf = (productId: number) =>
    lines.find((l) => l.productId === productId)?.productName ?? 'Produk'
  const uomCodeOf = (productId: number, uomId: number) =>
    lines.find((l) => l.productId === productId)?.uoms.find((u) => u.id === uomId)?.code ?? ''

  const varianceItems = variances.filter((v) => v.varianceQty !== 0)
  const matchedCount = variances.length - varianceItems.length

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2 px-1">
        {step !== 'PILIH_METODE' && step !== 'SUKSES' && (
          <button
            type="button"
            onClick={() => (step === 'REVIEW' ? setStep('HITUNG') : reset())}
            aria-label="Kembali"
            className="p-1 -ml-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-lg font-bold text-foreground">
          {mode === 'FULL' ? 'Stock Opname Besar' : 'Stock Opname'}
          {step === 'HITUNG' && ' — Hitung'}
          {step === 'REVIEW' && ' — Review Selisih'}
        </h1>
      </div>

      {msg && (
        <div
          className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
            msg.type === 'ok'
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {msg.type === 'ok' ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
          {msg.text}
        </div>
      )}

      {/* SO Besar (FULL) — status muat / kosong */}
      {mode === 'FULL' && !fullChecked && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat Stock Opname Besar…
        </div>
      )}

      {mode === 'FULL' && fullChecked && !fullSo && (
        <div className="space-y-3 text-center pt-6">
          <p className="text-sm text-muted-foreground px-2">
            Tidak ada Stock Opname Besar aktif untuk cabang ini. Admin belum memulai SO, atau sudah selesai.
          </p>
          <Link
            href="/pos/produk/stock-opname"
            className="inline-block w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold active:opacity-80"
          >
            SO Mandiri Harian
          </Link>
          <Link
            href="/pos/produk"
            className="inline-block w-full py-3 bg-card border border-border text-foreground rounded-xl font-semibold active:opacity-80"
          >
            Kembali ke Produk
          </Link>
        </div>
      )}

      {/* ---------- TAHAP: PILIH METODE ---------- */}
      {step === 'PILIH_METODE' && !(mode === 'FULL' && !fullSo) && (
        <div className="space-y-3">
          {/* Banner: SO Besar dari admin (mode FULL) */}
          {mode === 'FULL' && fullSo && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1">
              <p className="text-sm font-semibold text-foreground">
                SO Besar dari admin · <span className="font-mono">{fullSo.soNumber}</span>
              </p>
              {fullSo.notes && (
                <p className="text-xs text-muted-foreground">Catatan admin: {fullSo.notes}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Hitungan kamu disimpan ke SO ini. Bisa dilanjutkan bertahap; admin menyetujui di akhir.
              </p>
            </div>
          )}

          {/* Banner: ada SO Besar aktif (mode MANDIRI) */}
          {mode === 'MANDIRI' && fullSo && (
            <Link
              href="/pos/produk/stock-opname/besar"
              className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 active:opacity-80"
            >
              <AlertTriangle className="w-5 h-5 text-primary shrink-0" />
              <span className="text-sm text-foreground">
                Ada <span className="font-semibold">Stock Opname Besar</span> dari admin. Ketuk untuk
                mengerjakan.
              </span>
            </Link>
          )}

          <p className="text-sm text-muted-foreground px-1">
            Pilih cara memilih produk yang akan dihitung. Stok sistem disembunyikan selama penghitungan.
          </p>
          {(Object.keys(METHOD_LABELS) as Method[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => chooseMethod(m)}
              className="w-full flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:bg-accent transition-colors min-h-[72px] text-left"
            >
              <span className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                <ClipboardList className="w-6 h-6" />
              </span>
              <span className="flex flex-col">
                <span className="font-semibold text-foreground">{METHOD_LABELS[m].title}</span>
                <span className="text-sm text-muted-foreground">{METHOD_LABELS[m].desc}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ---------- TAHAP: HITUNG (BUTA) ---------- */}
      {step === 'HITUNG' && (
        <div className="space-y-4">
          {/* Cari / scan */}
          <div className="flex gap-2">
            {method === 'MANUAL' && (
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari produk (nama / SKU)"
                  className="w-full pl-10 pr-3 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setScanning(true)}
              aria-label="Scan barcode"
              className={`flex items-center justify-center gap-2 ${
                method === 'MANUAL' ? 'w-14' : 'flex-1 py-3'
              } bg-primary text-primary-foreground rounded-xl active:opacity-80`}
            >
              <Camera className="w-6 h-6" />
              {method !== 'MANUAL' && <span className="font-semibold">Scan Barcode</span>}
            </button>
          </div>

          {searching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <Loader2 className="w-4 h-4 animate-spin" /> Memuat…
            </div>
          )}

          {/* Hasil pencarian / saran */}
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((c) => {
                const added = lines.some((l) => l.productId === c.productId)
                return (
                  <button
                    key={c.productId}
                    type="button"
                    onClick={() => addLine(c)}
                    disabled={added}
                    className="w-full text-left p-3 bg-card border border-border rounded-xl hover:bg-accent transition-colors min-h-[56px] disabled:opacity-50"
                  >
                    <p className="font-medium text-foreground">{c.productName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.sku ? `SKU: ${c.sku}` : 'Tanpa SKU'}
                      {added ? ' · sudah ditambahkan' : ''}
                    </p>
                  </button>
                )
              })}
            </div>
          )}

          {/* Daftar hitung */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground px-1">
              Daftar Hitung ({lines.length})
            </p>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">
                Belum ada produk. Cari atau scan untuk menambahkan.
              </p>
            ) : (
              lines.map((l) => (
                <div key={l.productId} className="p-3 bg-card border border-border rounded-xl space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground">{l.productName}</p>
                      {l.sku && <p className="text-xs text-muted-foreground">SKU: {l.sku}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(l.productId)}
                      aria-label="Hapus"
                      className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.uoms.length > 1 ? (
                      <select
                        value={l.uomId}
                        onChange={(e) => updateLine(l.productId, { uomId: Number(e.target.value) })}
                        className="px-2 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {l.uoms.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.code}
                            {u.isBase ? ' (dasar)' : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="px-2 py-2 text-sm text-muted-foreground whitespace-nowrap">
                        {l.uoms[0]?.code}
                      </span>
                    )}
                    <div className="flex items-center gap-1 flex-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateLine(l.productId, {
                            physicalQty: String(Math.max(0, Number(l.physicalQty || 0) - 1)),
                          })
                        }
                        aria-label="Kurangi"
                        className="flex items-center justify-center w-10 h-11 bg-muted text-foreground rounded-lg active:opacity-70"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <input
                        value={l.physicalQty}
                        onChange={(e) =>
                          updateLine(l.productId, { physicalQty: e.target.value.replace(/[^0-9]/g, '') })
                        }
                        inputMode="numeric"
                        placeholder="Qty"
                        className="flex-1 w-full text-center px-2 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateLine(l.productId, {
                            physicalQty: String(Number(l.physicalQty || 0) + 1),
                          })
                        }
                        aria-label="Tambah"
                        className="flex items-center justify-center w-10 h-11 bg-muted text-foreground rounded-lg active:opacity-70"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {lines.length > 0 && (
            <button
              type="button"
              onClick={goToReview}
              disabled={loadingPreview}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50 active:opacity-80"
            >
              {loadingPreview ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Lanjut ke Review
            </button>
          )}
        </div>
      )}

      {/* ---------- TAHAP: REVIEW SELISIH ---------- */}
      {step === 'REVIEW' && (
        <div className="space-y-4">
          {matchedCount > 0 && (
            <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-green-500/10 text-green-600 dark:text-green-400">
              <Check className="w-4 h-4 shrink-0" />
              {matchedCount} item cocok dengan sistem
            </div>
          )}

          {varianceItems.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1">
              Tidak ada selisih. Semua hitungan cocok dengan stok sistem.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-muted-foreground px-1">
                {varianceItems.length} item memiliki selisih — wajib isi alasan
              </p>
              {varianceItems.map((v) => {
                const isShort = v.varianceQty < 0
                return (
                  <div
                    key={v.productId}
                    className="p-3 bg-card border border-border rounded-xl space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className={`w-4 h-4 mt-0.5 shrink-0 ${isShort ? 'text-destructive' : 'text-amber-500'}`}
                      />
                      <p className="font-medium text-foreground">{nameOf(v.productId)}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Sistem</p>
                        <p className="font-medium text-foreground">
                          {v.systemQty} {uomCodeOf(v.productId, v.uomId)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fisik</p>
                        <p className="font-medium text-foreground">
                          {v.physicalQty} {uomCodeOf(v.productId, v.uomId)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Selisih</p>
                        <p className={`font-semibold ${isShort ? 'text-destructive' : 'text-amber-600'}`}>
                          {v.varianceQty > 0 ? '+' : ''}
                          {v.varianceQty}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Nilai selisih: {formatRupiah(v.varianceCostValue)}
                    </p>
                    <textarea
                      value={reasons[v.productId] ?? ''}
                      onChange={(e) =>
                        setReasons((prev) => ({ ...prev, [v.productId]: e.target.value }))
                      }
                      placeholder="Alasan selisih (wajib)"
                      rows={2}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )
              })}
            </>
          )}

          <button
            type="button"
            onClick={submitSO}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50 active:opacity-80"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            {mode === 'FULL' ? 'Simpan ke SO Besar' : 'Ajukan Stock Opname'}
          </button>
        </div>
      )}

      {/* ---------- TAHAP: SUKSES ---------- */}
      {step === 'SUKSES' && (
        <div className="space-y-4 text-center pt-6">
          <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
            <Check className="w-8 h-8" />
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {mode === 'FULL' ? 'Hitungan tersimpan ke SO Besar' : 'Stock Opname diajukan'}
            </p>
            {soNumber && <p className="text-sm text-muted-foreground mt-1 font-mono">{soNumber}</p>}
            <p className="text-sm text-muted-foreground mt-2">
              {mode === 'FULL'
                ? 'Kamu bisa lanjut menghitung produk lain. Admin menyetujui SO ini saat sudah lengkap.'
                : 'Menunggu persetujuan admin sebelum stok disesuaikan.'}
            </p>
          </div>
          {mode === 'FULL' ? (
            <>
              <button
                type="button"
                onClick={reset}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold active:opacity-80"
              >
                Hitung Produk Lain
              </button>
              <Link
                href="/pos/produk"
                className="inline-block w-full py-3 bg-card border border-border text-foreground rounded-xl font-semibold active:opacity-80"
              >
                Selesai
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={reset}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold active:opacity-80"
            >
              Stock Opname Baru
            </button>
          )}
        </div>
      )}

      {scanning && (
        <BarcodeScanner onScan={handleScan} onClose={() => setScanning(false)} />
      )}
    </div>
  )
}
