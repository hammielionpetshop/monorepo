'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import {
  REASONS,
  REASON_LABELS,
  formatDateWib,
  formatRupiah,
  type PoItemOption,
  type PoOption,
  type ProductSearchResult,
  type SupplierOption,
  type SupplierReturnReason,
} from './types'

interface DraftItem {
  key: string
  productId: number
  productName: string
  uomId: number
  uomCode: string
  uoms?: { id: number; code: string }[]
  poItemId: number | null
  /** Batas qty dari PO asal; null = tanpa PO (dibatasi stok saat disetujui). */
  maxQty: number | null
  /** Harga klaim per satuan dari PO; null = ditentukan saat disetujui. */
  unitPrice: number | null
  qty: number
  photoUrl: string | null
  uploadingPhoto?: boolean
}

/**
 * Form pengajuan Retur ke Supplier — dipakai POS (kasir) dan Back Office. Pengajuan masuk
 * sebagai PENDING; stok & tagihan baru berubah setelah disetujui di Permintaan Persetujuan.
 */
export function SupplierReturnForm({
  apiBase,
  branchId,
  onSubmitted,
}: {
  /** `/api/pos/supplier-returns` atau `/api/bo/supplier-returns`. */
  apiBase: string
  branchId: number
  onSubmitted: (returnNumber: string) => void
}) {
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [supplierId, setSupplierId] = useState<number | null>(null)
  const [poOptions, setPoOptions] = useState<PoOption[]>([])
  const [loadingPos, setLoadingPos] = useState(false)
  // '' = belum dipilih, 'NONE' = tanpa PO asal, angka = id PO
  const [poChoice, setPoChoice] = useState<string>('')
  const [poItems, setPoItems] = useState<PoItemOption[]>([])
  const [loadingItems, setLoadingItems] = useState(false)

  const [draft, setDraft] = useState<DraftItem[]>([])
  const [reason, setReason] = useState<SupplierReturnReason>('EXPIRED')
  const [notes, setNotes] = useState('')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchBoxRef = useRef<HTMLDivElement>(null)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${apiBase}/options?branchId=${branchId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => setSuppliers(Array.isArray(data?.suppliers) ? data.suppliers : []))
      .catch(() => setError('Gagal memuat daftar supplier'))
  }, [apiBase, branchId])

  useEffect(() => {
    setPoOptions([])
    setPoChoice('')
    setPoItems([])
    setDraft([])
    if (!supplierId) return
    setLoadingPos(true)
    fetch(`${apiBase}/options?branchId=${branchId}&supplierId=${supplierId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => setPoOptions(Array.isArray(data?.purchaseOrders) ? data.purchaseOrders : []))
      .catch(() => setError('Gagal memuat daftar PO'))
      .finally(() => setLoadingPos(false))
  }, [apiBase, branchId, supplierId])

  useEffect(() => {
    setPoItems([])
    setDraft([])
    if (!poChoice || poChoice === 'NONE') return
    setLoadingItems(true)
    fetch(`${apiBase}/options?branchId=${branchId}&poId=${poChoice}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => setPoItems(Array.isArray(data?.items) ? data.items : []))
      .catch(() => setError('Gagal memuat barang PO'))
      .finally(() => setLoadingItems(false))
  }, [apiBase, branchId, poChoice])

  // Pencarian produk — hanya untuk retur tanpa PO asal.
  useEffect(() => {
    const q = query.trim()
    if (!q || poChoice !== 'NONE') {
      setResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(q)}&branchId=${branchId}&limit=20`)
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
  }, [query, branchId, poChoice])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setShowResults(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addPoItem = (item: PoItemOption) => {
    setError('')
    if (draft.some(d => d.poItemId === item.poItemId)) return
    setDraft(prev => [...prev, {
      key: `po-${item.poItemId}`,
      productId: item.productId,
      productName: item.productName,
      uomId: item.uomId,
      uomCode: item.uomCode,
      poItemId: item.poItemId,
      maxQty: item.returnableQty,
      unitPrice: item.claimPrice,
      qty: 1,
      photoUrl: null,
    }])
  }

  const addProduct = (p: ProductSearchResult) => {
    setError('')
    const baseUom = p.uoms.find(u => u.isBase) ?? p.uoms[0]
    const uomId = baseUom?.id ?? p.baseUomId
    setDraft(prev => prev.some(d => d.productId === p.id && d.uomId === uomId) ? prev : [...prev, {
      key: `p-${p.id}-${uomId}-${Date.now()}`,
      productId: p.id,
      productName: p.name,
      uomId,
      uomCode: baseUom?.code ?? '-',
      uoms: p.uoms.map(u => ({ id: u.id, code: u.code })),
      poItemId: null,
      maxQty: null,
      unitPrice: null,
      qty: 1,
      photoUrl: null,
    }])
    setQuery('')
    setResults([])
    setShowResults(false)
  }

  const updateItem = (key: string, patch: Partial<DraftItem>) =>
    setDraft(prev => prev.map(it => (it.key === key ? { ...it, ...patch } : it)))

  const removeItem = (key: string) => setDraft(prev => prev.filter(it => it.key !== key))

  const pickPhoto = (key: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      updateItem(key, { uploadingPhoto: true })
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/pos/uploads', { method: 'POST', body: form })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.url) {
          setError(data.error ?? 'Gagal mengunggah foto')
          updateItem(key, { uploadingPhoto: false })
          return
        }
        updateItem(key, { photoUrl: data.url, uploadingPhoto: false })
      } catch {
        setError('Terjadi kesalahan jaringan saat unggah foto')
        updateItem(key, { uploadingPhoto: false })
      }
    }
    input.click()
  }

  const estimate = useMemo(
    () => draft.reduce((acc, it) => acc + (it.unitPrice ?? 0) * it.qty, 0),
    [draft],
  )
  const hasUnpricedItems = draft.some(it => it.unitPrice === null)

  function validate(): string | null {
    if (!supplierId) return 'Pilih supplier dulu'
    if (!poChoice) return 'Pilih PO asal, atau pilih "Tanpa PO asal"'
    if (draft.length === 0) return 'Tambahkan minimal satu barang yang diretur'
    for (const it of draft) {
      if (!Number.isInteger(it.qty) || it.qty <= 0) return `Qty ${it.productName} harus lebih dari 0`
      if (it.maxQty !== null && it.qty > it.maxQty) return `Qty ${it.productName} melebihi sisa yang bisa diretur (${it.maxQty})`
      if (it.uploadingPhoto) return 'Tunggu foto selesai diunggah'
    }
    if (notes.trim().length < 5) return 'Tulis penjelasan alasan retur (minimal 5 huruf)'
    return null
  }

  function openConfirm() {
    const problem = validate()
    if (problem) return setError(problem)
    setError('')
    setConfirmOpen(true)
  }

  async function submit() {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          supplierId,
          poId: poChoice === 'NONE' ? null : Number(poChoice),
          reason,
          notes: notes.trim(),
          items: draft.map(it => ({
            productId: it.productId,
            uomId: it.uomId,
            poItemId: it.poItemId,
            qty: it.qty,
            photoUrl: it.photoUrl,
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Gagal mengajukan retur')
        setConfirmOpen(false)
        return
      }
      setConfirmOpen(false)
      setDraft([])
      setNotes('')
      setReason('EXPIRED')
      setPoChoice('')
      setSupplierId(null)
      onSubmitted(data.returnNumber ?? '')
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
      setConfirmOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  const supplierName = suppliers.find(s => s.id === supplierId)?.name ?? '-'
  const selectedPo = poOptions.find(p => String(p.id) === poChoice)

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Supplier *</label>
          <select
            value={supplierId ?? ''}
            onChange={e => setSupplierId(e.target.value ? Number(e.target.value) : null)}
            className={selectClass}
          >
            <option value="">— Pilih supplier —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">PO Asal *</label>
          <select
            value={poChoice}
            onChange={e => setPoChoice(e.target.value)}
            disabled={!supplierId || loadingPos}
            className={selectClass}
          >
            <option value="">{loadingPos ? 'Memuat PO…' : '— Pilih PO asal —'}</option>
            {poOptions.map(po => (
              <option key={po.id} value={po.id}>
                {po.poNumber} · {formatDateWib(po.createdAt)}{po.invoiceNumber ? ` · Faktur ${po.invoiceNumber}` : ''} · {formatRupiah(po.totalAmount)}
              </option>
            ))}
            <option value="NONE">Tanpa PO asal (barang lama / tidak tahu PO-nya)</option>
          </select>
          {supplierId && !loadingPos && poOptions.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">Belum ada PO selesai dari supplier ini di cabang ini.</p>
          )}
        </div>
      </div>

      {poChoice === 'NONE' && (
        <p className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-400">
          Tanpa PO asal: tidak ada tagihan PO yang dipotong — nilai retur masuk ke <b>Saldo Supplier</b> dan dipakai
          saat membayar tagihan supplier ini berikutnya. Harganya memakai modal terakhir dan bisa diubah penyetuju.
        </p>
      )}

      {selectedPo && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Barang di {selectedPo.poNumber} — klik untuk ditambahkan</p>
          {loadingItems ? (
            <p className="text-sm text-muted-foreground">Memuat barang PO…</p>
          ) : (
            <div className="max-h-60 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {poItems.map(item => {
                const disabled = item.returnableQty <= 0 || item.claimPrice === null || draft.some(d => d.poItemId === item.poItemId)
                return (
                  <button
                    key={item.poItemId}
                    type="button"
                    onClick={() => addPoItem(item)}
                    disabled={disabled}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        Diterima {item.qtyReceived} {item.uomCode}
                        {item.alreadyReturned > 0 && ` · sudah diretur ${item.alreadyReturned}`}
                        {' · '}
                        {item.claimPrice === null ? 'harga faktur belum diisi' : `${formatRupiah(item.claimPrice)}/${item.uomCode}`}
                      </p>
                    </div>
                    <Plus className="h-4 w-4 flex-shrink-0 text-primary" />
                  </button>
                )
              })}
              {poItems.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">PO ini tidak punya barang.</p>}
            </div>
          )}
        </div>
      )}

      {poChoice === 'NONE' && (
        <div ref={searchBoxRef} className="relative">
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">Cari Produk</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setShowResults(true)}
              placeholder="Nama / SKU / barcode produk"
              className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px]"
            />
          </div>
          {showResults && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
              {searching && <p className="px-3 py-3 text-sm text-muted-foreground">Mencari…</p>}
              {!searching && results.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">Produk tidak ditemukan</p>}
              {!searching && results.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.sku ?? '—'} · Stok: {p.stock}</p>
                  </div>
                  <Plus className="h-4 w-4 flex-shrink-0 text-primary" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {draft.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Barang yang diretur</p>
          {draft.map(it => (
            <div key={it.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
              {it.photoUrl ? (
                <button type="button" onClick={() => updateItem(it.key, { photoUrl: null })} className="relative flex-shrink-0" aria-label={`Hapus foto ${it.productName}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.photoUrl} alt="" className="h-10 w-10 rounded-md object-cover border border-border" />
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-white">
                    <X className="h-2.5 w-2.5" />
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => pickPhoto(it.key)}
                  disabled={it.uploadingPhoto}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:bg-accent disabled:opacity-50"
                  aria-label={`Tambah foto ${it.productName}`}
                  title="Foto bukti (disarankan)"
                >
                  {it.uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{it.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {it.unitPrice === null ? 'Harga: modal terakhir (ditentukan saat disetujui)' : `${formatRupiah(it.unitPrice)}/${it.uomCode}`}
                  {it.maxQty !== null && ` · maks ${it.maxQty}`}
                </p>
              </div>
              {it.uoms && it.uoms.length > 1 ? (
                <select
                  value={it.uomId}
                  onChange={e => {
                    const uom = it.uoms!.find(u => u.id === Number(e.target.value))
                    if (uom) updateItem(it.key, { uomId: uom.id, uomCode: uom.code })
                  }}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm min-h-[40px]"
                  aria-label={`Satuan ${it.productName}`}
                >
                  {it.uoms.map(u => <option key={u.id} value={u.id}>{u.code}</option>)}
                </select>
              ) : (
                <span className="text-sm text-muted-foreground">{it.uomCode}</span>
              )}
              <input
                type="number"
                min={1}
                max={it.maxQty ?? undefined}
                value={it.qty}
                onChange={e => updateItem(it.key, { qty: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-center text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[40px]"
                aria-label={`Qty ${it.productName}`}
              />
              <button
                type="button"
                onClick={() => removeItem(it.key)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label="Hapus barang"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Alasan *</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {REASONS.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                reason === r ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {REASON_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-muted-foreground">Penjelasan * (wajib, untuk penyetuju)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Contoh: 5 sak expired Okt 2026, ketahuan saat dibuka; supplier setuju diambil sopir Senin"
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {draft.length > 0 && (
        <p className="text-sm text-foreground">
          Perkiraan nilai retur: <span className="font-semibold">{formatRupiah(estimate)}</span>
          {hasUnpricedItems && <span className="text-muted-foreground"> + barang yang harganya ditentukan saat disetujui</span>}
        </p>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-destructive" role="alert">
          <X className="h-4 w-4" /> {error}
        </p>
      )}

      <button
        type="button"
        onClick={openConfirm}
        disabled={submitting}
        className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40 min-h-[48px]"
      >
        Ajukan Retur ke Supplier
      </button>

      {confirmOpen && (
        <RequiredChoiceDialog
          title="Ajukan retur ke supplier?"
          tone="warning"
          actions={[
            { label: 'Batal', onClick: () => setConfirmOpen(false), variant: 'secondary', disabled: submitting },
            { label: submitting ? 'Mengirim…' : 'Ya, Ajukan', onClick: submit, variant: 'primary', disabled: submitting },
          ]}
        >
          <p>
            Retur {draft.length} barang ke <b>{supplierName}</b>
            {selectedPo ? <> dari <b>{selectedPo.poNumber}</b></> : ' (tanpa PO asal)'}.
          </p>
          <p className="text-muted-foreground">
            Pengajuan menunggu persetujuan Owner/GM. Stok dan tagihan supplier <b>belum berubah</b> sampai disetujui.
          </p>
        </RequiredChoiceDialog>
      )}
    </div>
  )
}

const selectClass = 'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px] disabled:opacity-50'
