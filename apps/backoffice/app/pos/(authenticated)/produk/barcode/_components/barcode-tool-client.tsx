'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Camera, Search, Trash2, Loader2, Check, X } from 'lucide-react'
import BarcodeScanner from '@/components/pos/barcode-scanner'

interface ProductHit {
  id: number
  sku: string | null
  barcode: string | null
  name: string
}

interface BarcodeList {
  primary: string | null
  barcodes: { id: number; barcode: string }[]
}

export default function BarcodeToolClient() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductHit[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<ProductHit | null>(null)
  const [list, setList] = useState<BarcodeList | null>(null)
  const [loadingList, setLoadingList] = useState(false)

  const [newCode, setNewCode] = useState('')
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)

  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const flash = useCallback((type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
  }, [])

  // Pencarian produk (debounce)
  useEffect(() => {
    if (selected) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/pos/products?search=${encodeURIComponent(query.trim())}&limit=20`)
        const data = await res.json()
        setResults(res.ok ? (data.products ?? []) : [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, selected])

  const loadBarcodes = useCallback(async (productId: number) => {
    setLoadingList(true)
    try {
      const res = await fetch(`/api/pos/products/${productId}/barcodes`)
      const data = await res.json()
      if (res.ok) setList(data)
      else flash('err', data.error ?? 'Gagal memuat barcode')
    } catch {
      flash('err', 'Terjadi kesalahan jaringan')
    } finally {
      setLoadingList(false)
    }
  }, [flash])

  function selectProduct(p: ProductHit) {
    setSelected(p)
    setResults([])
    setQuery('')
    setList(null)
    setNewCode('')
    loadBarcodes(p.id)
  }

  function clearSelection() {
    setSelected(null)
    setList(null)
    setNewCode('')
  }

  async function saveBarcode() {
    if (!selected || !newCode.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/pos/products/${selected.id}/barcodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: newCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        flash('err', data.error ?? 'Gagal menyimpan barcode')
        return
      }
      flash('ok', data.target === 'primary' ? 'Barcode utama tersimpan' : 'Barcode tambahan tersimpan')
      setNewCode('')
      loadBarcodes(selected.id)
    } catch {
      flash('err', 'Terjadi kesalahan jaringan')
    } finally {
      setSaving(false)
    }
  }

  async function deleteBarcode(barcodeId: number) {
    if (!selected) return
    try {
      const res = await fetch(`/api/pos/products/${selected.id}/barcodes/${barcodeId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        flash('err', data.error ?? 'Gagal menghapus barcode')
        return
      }
      flash('ok', 'Barcode dihapus')
      loadBarcodes(selected.id)
    } catch {
      flash('err', 'Terjadi kesalahan jaringan')
    }
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-lg font-bold text-foreground px-1">Tambah / Scan Barcode</h1>

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

      {!selected ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari produk (nama / SKU / barcode)"
              className="w-full pl-10 pr-3 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {searching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
              <Loader2 className="w-4 h-4 animate-spin" /> Mencari…
            </div>
          )}

          <div className="space-y-2">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectProduct(p)}
                className="w-full text-left p-3 bg-card border border-border rounded-xl hover:bg-accent transition-colors min-h-[60px]"
              >
                <p className="font-medium text-foreground">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.sku ? `SKU: ${p.sku}` : 'Tanpa SKU'}
                  {p.barcode ? ` · Barcode: ${p.barcode}` : ' · Belum ada barcode'}
                </p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Produk terpilih */}
          <div className="flex items-start justify-between gap-3 p-3 bg-card border border-border rounded-xl">
            <div>
              <p className="font-semibold text-foreground">{selected.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selected.sku ? `SKU: ${selected.sku}` : 'Tanpa SKU'}
              </p>
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className="text-sm text-primary hover:underline whitespace-nowrap"
            >
              Ganti
            </button>
          </div>

          {/* Input barcode + scan */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="Kode barcode"
                inputMode="numeric"
                className="flex-1 px-3 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setScanning(true)}
                aria-label="Scan barcode"
                className="flex items-center justify-center w-14 bg-primary text-primary-foreground rounded-xl active:opacity-80"
              >
                <Camera className="w-6 h-6" />
              </button>
            </div>
            <button
              type="button"
              onClick={saveBarcode}
              disabled={saving || !newCode.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50 active:opacity-80"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              Simpan Barcode
            </button>
          </div>

          {/* Daftar barcode produk */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground px-1">Barcode terdaftar</p>
            {loadingList ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
                <Loader2 className="w-4 h-4 animate-spin" /> Memuat…
              </div>
            ) : (
              <div className="space-y-2">
                {list?.primary && (
                  <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl">
                    <span className="font-mono text-foreground">{list.primary}</span>
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Utama
                    </span>
                  </div>
                )}
                {list?.barcodes.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-3 bg-card border border-border rounded-xl"
                  >
                    <span className="font-mono text-foreground">{b.barcode}</span>
                    <button
                      type="button"
                      onClick={() => deleteBarcode(b.id)}
                      aria-label="Hapus barcode"
                      className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {!list?.primary && (list?.barcodes.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground px-1">Belum ada barcode untuk produk ini.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {scanning && (
        <BarcodeScanner
          onScan={(code) => {
            setNewCode(code)
            setScanning(false)
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  )
}
