'use client'

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  createRef,
} from 'react'
import type { ItemRow, BranchOption, ProductSearchResult } from './types'
import ItemRowComponent from './item-row'

interface InternalOrderClientProps {
  currentBranchId: number
  otherBranches: BranchOption[]
  allBranches: BranchOption[]
  userRole: string
}

const MULTI_BRANCH_ROLES = ['OWNER', 'GM']

let nextId = 1

export default function InternalOrderClient({
  currentBranchId,
  otherBranches,
  allBranches,
  userRole,
}: InternalOrderClientProps) {
  const [sourceBranchId, setSourceBranchId] = useState<number>(currentBranchId)
  const [destinationBranchId, setDestinationBranchId] = useState<number | null>(
    otherBranches[0]?.id ?? null
  )
  const [items, setItems] = useState<ItemRow[]>([])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const qtyRefs = useRef<Map<number, React.RefObject<HTMLInputElement | null>>>(new Map())
  const dropdownItemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 3000)
      return () => clearTimeout(t)
    }
  }, [successMsg])

  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(''), 5000)
      return () => clearTimeout(t)
    }
  }, [errorMsg])

  useEffect(() => {
    const refs = dropdownItemRefs.current
    if (highlightIndex >= 0) {
      refs[highlightIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    setIsSearching(true)
    try {
      const res = await fetch(
        `/api/pos/products?search=${encodeURIComponent(q)}&limit=8`
      )
      const data = await res.json()
      setSearchResults(data.products ?? [])
      setHighlightIndex(0)
      setShowDropdown(true)
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(searchQuery), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, doSearch])

  const addProduct = useCallback(
    (product: ProductSearchResult) => {
      const baseDefaultCost = product.defaultCostPrice ?? 0

      const availableUoms: ItemRow['availableUoms'] = [
        { id: product.baseUomId, name: 'Base', ratio: 1 },
        ...product.conversions
          .filter((c) => c.uomId != null && c.ratio != null)
          .map((c) => ({
            id: c.uomId,
            name: c.uomCode ?? String(c.uomId),
            ratio: parseInt(c.ratio ?? '1', 10) || 1,
          })),
      ]

      const baseUom = availableUoms[0]

      const id = nextId++
      const ref = createRef<HTMLInputElement>()
      qtyRefs.current.set(id, ref)

      const newItem: ItemRow = {
        id,
        productId: product.id,
        productName: product.name,
        productCode: product.sku ?? product.barcode ?? String(product.id),
        uomId: baseUom.id,
        uomName: baseUom.name,
        availableUoms,
        baseDefaultCostPrice: baseDefaultCost,
        qtyRequested: 1,
        costPrice: baseDefaultCost,
      }

      setItems((prev) => [...prev, newItem])
      setSearchQuery('')
      setSearchResults([])
      setShowDropdown(false)

      setTimeout(() => {
        ref.current?.focus()
        ref.current?.select()
      }, 50)
    },
    []
  )

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || searchResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((i) => Math.min(i + 1, searchResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = searchResults[highlightIndex]
      if (selected) addProduct(selected)
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  const handleUpdateItem = useCallback(
    (id: number, field: keyof ItemRow, value: unknown) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
      )
    },
    []
  )

  const handleRemoveItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    qtyRefs.current.delete(id)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [])

  const handleQtyKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, _index: number) => {
      if (e.key === 'Delete' || e.key === 'Backspace') return
    },
    []
  )


  const handleOpenConfirm = () => {
    if (!sourceBranchId) {
      setErrorMsg('Pilih cabang pengirim terlebih dahulu')
      return
    }
    if (!destinationBranchId) {
      setErrorMsg('Pilih cabang tujuan terlebih dahulu')
      return
    }
    if (sourceBranchId === destinationBranchId) {
      setErrorMsg('Cabang pengirim dan tujuan tidak boleh sama')
      return
    }
    if (items.length === 0) {
      setErrorMsg('Tambahkan minimal satu produk')
      return
    }
    const invalidItem = items.find((item) => item.qtyRequested <= 0)
    if (invalidItem) {
      setErrorMsg(`Qty untuk "${invalidItem.productName}" harus lebih dari 0`)
      return
    }
    setErrorMsg('')
    setShowConfirm(true)
  }

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/bo/internal-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceBranchId,
          destinationBranchId,
          notes: notes.trim() || null,
          items: items.map((item) => ({
            productId: item.productId,
            uomId: item.uomId,
            qtyRequested: item.qtyRequested,
            costPrice: item.costPrice,
          })),
        }),
      })

      if (res.status === 404 || res.status === 405) {
        setSuccessMsg('Fitur segera tersedia')
        setItems([])
        setNotes('')
        setSourceBranchId(currentBranchId)
        setDestinationBranchId(otherBranches[0]?.id ?? null)
        setTimeout(() => searchInputRef.current?.focus(), 50)
        return
      }

      const data = await res.json()
      if (!res.ok) {
        setShowConfirm(false)
        setErrorMsg(data.error ?? 'Gagal membuat permintaan transfer')
        return
      }

      setShowConfirm(false)
      setSuccessMsg(`Permintaan transfer ${data.ibtNumber ?? ''} berhasil dibuat dan menunggu approval`)
      setItems([])
      setNotes('')
      setSourceBranchId(currentBranchId)
      setDestinationBranchId(otherBranches[0]?.id ?? null)
      setTimeout(() => searchInputRef.current?.focus(), 50)
    } catch {
      setShowConfirm(false)
      setErrorMsg('Terjadi kesalahan. Coba lagi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const canChangeBranch = MULTI_BRANCH_ROLES.includes(userRole)

  const availableDestinations = allBranches.filter((b) => b.id !== sourceBranchId)

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-base font-semibold text-foreground">PO Internal</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Buat permintaan transfer stok dari cabang lain
        </p>
      </div>

      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-md text-sm"
        >
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm"
        >
          {errorMsg}
        </div>
      )}

      {/* Header form: cabang pengirim & tujuan */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Cabang Pengirim
          </label>
          {canChangeBranch ? (
            <select
              value={sourceBranchId}
              onChange={(e) => {
                const newSourceId = parseInt(e.target.value, 10)
                setSourceBranchId(newSourceId)
                const newDest = allBranches.find((b) => b.id !== newSourceId)
                setDestinationBranchId(newDest?.id ?? null)
              }}
              disabled={isSubmitting}
              className="w-full border border-border rounded-md px-2.5 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            >
              {allBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="border border-border rounded-md px-2.5 py-1.5 text-sm bg-muted/30 text-foreground">
              {allBranches.find((b) => b.id === sourceBranchId)?.name ?? '-'}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Cabang Tujuan
          </label>
          <select
            value={destinationBranchId ?? ''}
            onChange={(e) => setDestinationBranchId(parseInt(e.target.value, 10))}
            disabled={isSubmitting || availableDestinations.length === 0}
            className="w-full border border-border rounded-md px-2.5 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          >
            {availableDestinations.length === 0 ? (
              <option value="">Tidak ada cabang lain</option>
            ) : (
              availableDestinations.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Search produk */}
      <div className="relative">
        <label className="block text-xs font-medium text-foreground mb-1">
          Cari Produk
        </label>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
          disabled={isSubmitting}
          placeholder="Nama, SKU, atau barcode produk..."
          autoComplete="off"
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        />
        {isSearching && (
          <div className="absolute right-3 top-8 text-xs text-muted-foreground">
            Mencari...
          </div>
        )}

        {showDropdown && searchResults.length > 0 && (
          <ul className="absolute z-20 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-56 overflow-y-auto">
            {searchResults.map((product, idx) => (
              <li key={product.id}>
                <button
                  ref={(el) => { dropdownItemRefs.current[idx] = el }}
                  type="button"
                  onMouseDown={() => addProduct(product)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    idx === highlightIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted/50 text-foreground'
                  }`}
                >
                  <div className="font-medium truncate">{product.name}</div>
                  <div
                    className={`text-xs ${
                      idx === highlightIndex ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}
                  >
                    {product.sku ?? product.barcode ?? '—'}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {showDropdown && !isSearching && searchResults.length === 0 && searchQuery.trim() && (
          <div className="absolute z-20 w-full mt-1 bg-card border border-border rounded-md shadow-lg px-3 py-2 text-sm text-muted-foreground">
            Produk tidak ditemukan
          </div>
        )}
      </div>

      {/* Tabel item */}
      {items.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">
                  Produk
                </th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground text-xs w-20">
                  Qty
                </th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground text-xs w-24">
                  Satuan
                </th>
                <th className="text-center px-2 py-2.5 font-medium text-muted-foreground text-xs w-28">
                  HPP Estimasi
                </th>
                <th className="px-2 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const ref = qtyRefs.current.get(item.id) ?? createRef<HTMLInputElement>()
                if (!qtyRefs.current.has(item.id)) {
                  qtyRefs.current.set(item.id, ref)
                }
                return (
                  <ItemRowComponent
                    key={item.id}
                    ref={ref}
                    item={item}
                    index={index}
                    onUpdate={handleUpdateItem}
                    onRemove={handleRemoveItem}
                    onQtyKeyDown={handleQtyKeyDown}
                    onLastFieldTab={(rowIndex) => {
                      const nextItem = items[rowIndex + 1]
                      if (nextItem) {
                        const nextRef = qtyRefs.current.get(nextItem.id)
                        setTimeout(() => nextRef?.current?.focus(), 50)
                      } else {
                        setTimeout(() => searchInputRef.current?.focus(), 50)
                      }
                    }}
                    disabled={isSubmitting}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.length === 0 && (
        <div className="border border-dashed border-border rounded-lg py-10 text-center text-muted-foreground text-sm">
          Belum ada produk. Gunakan kolom pencarian di atas untuk menambahkan produk.
        </div>
      )}

      {/* Catatan */}
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">
          Catatan (opsional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isSubmitting}
          rows={2}
          placeholder="Alasan permintaan transfer, urgensi, dll."
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none disabled:opacity-50"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-xs text-muted-foreground">
          {items.length} produk &bull;{' '}
          {items.reduce((sum, i) => sum + i.qtyRequested, 0)} total unit
        </div>
        <button
          type="button"
          onClick={handleOpenConfirm}
          disabled={isSubmitting || items.length === 0}
          className="px-5 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Mengirim...' : 'Kirim Permintaan'}
        </button>
      </div>

      {/* Modal konfirmasi sebelum kirim */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Konfirmasi Permintaan Transfer</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Periksa kembali sebelum mengirim</p>
            </div>

            {/* Body */}
            <div className="px-5 py-4 overflow-y-auto space-y-4 flex-1">
              {/* Cabang */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Cabang Pengirim</span>
                  <p className="font-medium text-foreground mt-0.5">
                    {allBranches.find((b) => b.id === sourceBranchId)?.name ?? '-'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cabang Tujuan</span>
                  <p className="font-medium text-foreground mt-0.5">
                    {allBranches.find((b) => b.id === destinationBranchId)?.name ?? '-'}
                  </p>
                </div>
              </div>

              {/* Tabel item */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Daftar Produk</p>
                <table className="w-full text-xs border border-border rounded-md overflow-hidden">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Produk</th>
                      <th className="text-center px-2 py-1.5 font-medium text-muted-foreground w-16">Qty</th>
                      <th className="text-left px-2 py-1.5 font-medium text-muted-foreground w-16">Satuan</th>
                      <th className="text-right px-3 py-1.5 font-medium text-muted-foreground w-28">Est. HPP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="px-3 py-1.5">
                          <div className="font-medium text-foreground truncate max-w-[160px]">{item.productName}</div>
                          <div className="text-muted-foreground">{item.productCode}</div>
                        </td>
                        <td className="px-2 py-1.5 text-center font-medium">{item.qtyRequested}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{item.uomName}</td>
                        <td className="px-3 py-1.5 text-right">
                          {item.costPrice > 0
                            ? `Rp ${(item.costPrice * item.qtyRequested).toLocaleString('id-ID')}`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-muted/20">
                    <tr>
                      <td className="px-3 py-1.5 text-muted-foreground" colSpan={3}>
                        Total — {items.length} produk, {items.reduce((s, i) => s + i.qtyRequested, 0)} unit
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold text-foreground">
                        {items.some((i) => i.costPrice > 0)
                          ? `Rp ${items.reduce((s, i) => s + i.costPrice * i.qtyRequested, 0).toLocaleString('id-ID')}`
                          : '-'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Catatan */}
              {notes.trim() && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Catatan: </span>
                  <span className="text-foreground">{notes.trim()}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm border border-border rounded-md text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 text-sm bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Mengirim...' : 'Ya, Kirim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
