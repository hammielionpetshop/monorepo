'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BranchStockInfo, ProductSearchResult, TransferDetailItem } from './types'

interface Props {
  transferId: number
  sourceBranchId: number
  sourceBranchName: string
  destinationBranchId: number
  destinationBranchName: string
  items: TransferDetailItem[]
  onCancel: () => void
  onSaved: (message: string) => void
}

interface EditItemRow {
  key: number
  id?: number
  productId: number
  productName: string
  productCode: string
  uomId: number
  uomCode: string
  availableUoms: { id: number; code: string; ratio: number }[]
  qtyRequested: number
}

let nextKey = 1

const stockKey = (branchId: number, productId: number) => `${branchId}:${productId}`

function formatStock(info: BranchStockInfo | undefined): string {
  if (info === undefined) return '…'
  if (info.baseQty === null) return '?'
  return `${info.baseQty.toLocaleString('id-ID')}${info.baseUomCode ? ` ${info.baseUomCode}` : ''}`
}

function toRow(item: TransferDetailItem): EditItemRow {
  return {
    key: nextKey++,
    id: item.id,
    productId: item.productId,
    productName: item.productName ?? '-',
    productCode: item.productSku ?? String(item.productId),
    uomId: item.uomId,
    uomCode: item.uomCode ?? '-',
    availableUoms: [],
    qtyRequested: item.qtyRequested,
  }
}

/**
 * Tambah/hapus/ubah qty produk pada PO Internal yang sudah dibuat, dari sudut pandang
 * cabang requester (kasir) — dimodel dari `internal-transfer-edit-form.tsx` di backoffice,
 * tapi tanpa selector cabang tujuan (kasir tidak bisa memindahkan PO ke cabang lain) dan
 * dengan kolom stok cabang pengirim + tujuan sekaligus.
 */
export default function InternalOrderEditForm({
  transferId,
  sourceBranchId,
  sourceBranchName,
  destinationBranchId,
  destinationBranchName,
  items,
  onCancel,
  onSaved,
}: Props) {
  const [rows, setRows] = useState<EditItemRow[]>(() => items.map(toRow))
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const [branchStocks, setBranchStocks] = useState<Record<string, BranchStockInfo>>({})

  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(''), 6000)
      return () => clearTimeout(t)
    }
  }, [errorMsg])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    setIsSearching(true)
    try {
      const res = await fetch(`/api/pos/products?search=${encodeURIComponent(q)}&limit=8`)
      const data = await res.json()
      setSearchResults(data.products ?? [])
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

  // Stok cabang pengirim + tujuan untuk produk yang sudah ada di tabel maupun hasil
  // pencarian — cache di-key per (cabang, produk), pola sama seperti form Buat PO Internal.
  const fetchBranchStocks = useCallback(
    async (branchId: number, productIds: number[]) => {
      const missing = [...new Set(productIds)].filter((pid) => branchStocks[stockKey(branchId, pid)] === undefined)
      if (missing.length === 0) return
      try {
        const res = await fetch(`/api/pos/branch-stock?branchId=${branchId}&productIds=${missing.join(',')}`)
        if (!res.ok) return
        const data = await res.json()
        const stocks = (data.stocks ?? {}) as Record<string, BranchStockInfo>
        setBranchStocks((prev) => {
          const next = { ...prev }
          for (const [pid, info] of Object.entries(stocks)) {
            next[stockKey(branchId, Number(pid))] = info
          }
          return next
        })
      } catch {
        // diam — stok cuma info bantu
      }
    },
    [branchStocks]
  )

  useEffect(() => {
    if (rows.length === 0) return
    const productIds = rows.map((r) => r.productId)
    void fetchBranchStocks(sourceBranchId, productIds)
    void fetchBranchStocks(destinationBranchId, productIds)
  }, [rows, sourceBranchId, destinationBranchId, fetchBranchStocks])

  useEffect(() => {
    if (searchResults.length === 0) return
    const productIds = searchResults.map((r) => r.id)
    void fetchBranchStocks(sourceBranchId, productIds)
    void fetchBranchStocks(destinationBranchId, productIds)
  }, [searchResults, sourceBranchId, destinationBranchId, fetchBranchStocks])

  function addProduct(product: ProductSearchResult) {
    const availableUoms: EditItemRow['availableUoms'] = [
      { id: product.baseUomId, code: 'Base', ratio: 1 },
      ...product.conversions
        .filter((c) => c.uomId != null)
        .map((c) => ({
          id: c.uomId,
          code: c.uomCode ?? String(c.uomId),
          ratio: parseInt(c.ratio ?? '1', 10) || 1,
        })),
    ]
    const baseUom = availableUoms[0]

    setRows((prev) => [
      ...prev,
      {
        key: nextKey++,
        id: undefined,
        productId: product.id,
        productName: product.name,
        productCode: product.sku ?? product.barcode ?? String(product.id),
        uomId: baseUom.id,
        uomCode: baseUom.code,
        availableUoms,
        qtyRequested: 1,
      },
    ])
    setSearchQuery('')
    setSearchResults([])
    setShowDropdown(false)
  }

  function updateQty(key: number, qty: number) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, qtyRequested: qty } : r)))
  }

  function updateUom(key: number, uomId: number) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r
        const uom = r.availableUoms.find((u) => u.id === uomId)
        if (!uom) return r
        return { ...r, uomId, uomCode: uom.code }
      })
    )
  }

  function removeRow(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key))
  }

  async function handleSave() {
    setErrorMsg('')
    if (rows.length === 0) {
      setErrorMsg('Minimal satu item wajib diisi')
      return
    }
    const invalidRow = rows.find((r) => r.qtyRequested <= 0)
    if (invalidRow) {
      setErrorMsg(`Qty untuk "${invalidRow.productName}" harus lebih dari 0`)
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`/api/pos/internal-order/${transferId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: rows.map((r) =>
            r.id !== undefined
              ? { id: r.id, qtyRequested: r.qtyRequested }
              : { productId: r.productId, uomId: r.uomId, qtyRequested: r.qtyRequested }
          ),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Gagal menyimpan perubahan')
        return
      }
      onSaved('Perubahan PO Internal berhasil disimpan')
    } catch {
      setErrorMsg('Terjadi kesalahan. Coba lagi.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Tambah produk baru, ubah qty, atau hapus item. Perubahan hanya bisa dilakukan selama PO
        belum diproses cabang pengirim.
      </p>

      {errorMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-md text-sm"
        >
          {errorMsg}
        </div>
      )}

      <div className="relative">
        <label className="block text-xs font-medium text-foreground mb-1">Tambah Produk</label>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
          disabled={isSaving}
          placeholder="Nama, SKU, atau barcode produk..."
          autoComplete="off"
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        />
        {isSearching && <div className="absolute right-3 top-9 text-xs text-muted-foreground">Mencari...</div>}
        {showDropdown && searchResults.length > 0 && (
          <ul className="absolute z-20 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-56 overflow-y-auto">
            {searchResults.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onMouseDown={() => addProduct(product)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 text-foreground transition-colors"
                >
                  <div className="font-medium truncate">{product.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span>{product.sku ?? product.barcode ?? '—'}</span>
                    <span>&bull;</span>
                    <span>Stok {sourceBranchName}: {formatStock(branchStocks[stockKey(sourceBranchId, product.id)])}</span>
                    <span>&bull;</span>
                    <span>Stok {destinationBranchName}: {formatStock(branchStocks[stockKey(destinationBranchId, product.id)])}</span>
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

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Produk</th>
              <th className="text-center px-2 py-2.5 font-medium text-muted-foreground text-xs w-20">Qty</th>
              <th className="text-center px-2 py-2.5 font-medium text-muted-foreground text-xs w-24">Satuan</th>
              <th className="text-center px-2 py-2.5 font-medium text-muted-foreground text-xs w-28">Stok {sourceBranchName}</th>
              <th className="text-center px-2 py-2.5 font-medium text-muted-foreground text-xs w-28">Stok {destinationBranchName}</th>
              <th className="px-2 py-2.5 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Belum ada produk. Gunakan kolom pencarian di atas untuk menambahkan produk.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-3 py-2">
                  <div className="font-medium text-xs text-foreground">{row.productName}</div>
                  <div className="text-xs text-muted-foreground">{row.productCode}</div>
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={row.qtyRequested === 0 ? '' : String(row.qtyRequested)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value.replace(/\D/g, ''), 10)
                      updateQty(row.key, isNaN(val) ? 0 : val)
                    }}
                    onFocus={(e) => e.target.select()}
                    disabled={isSaving}
                    placeholder="0"
                    className="w-full border border-border rounded px-2 py-1 text-xs text-center bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  {row.id === undefined && row.availableUoms.length > 1 ? (
                    <select
                      value={row.uomId}
                      onChange={(e) => updateUom(row.key, parseInt(e.target.value, 10))}
                      disabled={isSaving}
                      className="w-full border border-border rounded px-1.5 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    >
                      {row.availableUoms.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-muted-foreground">{row.uomCode}</span>
                  )}
                </td>
                <td className="px-2 py-2 text-center">
                  <span className="text-xs text-muted-foreground">
                    {formatStock(branchStocks[stockKey(sourceBranchId, row.productId)])}
                  </span>
                </td>
                <td className="px-2 py-2 text-center">
                  <span className="text-xs text-muted-foreground">
                    {formatStock(branchStocks[stockKey(destinationBranchId, row.productId)])}
                  </span>
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    disabled={isSaving}
                    className="text-destructive hover:text-destructive/80 text-xs px-1.5 py-1 rounded hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    aria-label={`Hapus ${row.productName}`}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 border border-border text-sm font-medium rounded-md hover:bg-accent disabled:opacity-50 transition-colors"
        >
          Batal
        </button>
      </div>
    </div>
  )
}
