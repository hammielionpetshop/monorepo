'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Plus, Minus, Trash2, Search, X, AlertTriangle } from 'lucide-react'
import type { TransactionWithDetails } from '@/app/pos/(authenticated)/history/page'

export interface UomOption {
  id: number
  code: string
}

interface TransactionEditDialogProps {
  isOpen: boolean
  transaction: TransactionWithDetails
  uoms: UomOption[]
  onClose: () => void
  onSuccess: () => void
}

interface EditableItem {
  key: string
  transactionItemId: number | null
  productId: number
  productName: string
  uomId: number
  uomCode: string
  qty: number
  unitPrice: number
  discountAmount: number
  priceTier: string
}

interface EditablePayment {
  paymentMethodId: number
  paymentMethodName: string
  amount: number
}

interface SearchProduct {
  id: number
  name: string
  sku: string | null
  baseUomId: number
  stock: string
  prices: { uomId: number; tierType: string; price: string }[]
  conversions: { uomId: number; uomCode: string | null; ratio: string | null }[]
}

function formatRupiahInt(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

export default function TransactionEditDialog({
  isOpen,
  transaction,
  uoms,
  onClose,
  onSuccess,
}: TransactionEditDialogProps) {
  const [items, setItems] = useState<EditableItem[]>([])
  const [payments, setPayments] = useState<EditablePayment[]>([])
  const [reason, setReason] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchProduct[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const uomCodeById = useMemo(() => new Map(uoms.map((u) => [u.id, u.code])), [uoms])

  // Diskon tingkat nota (bagian diskon header yang tidak berasal dari item) tidak diubah
  // oleh koreksi — dipertahankan apa adanya, sama seperti perhitungan di server.
  const headerOnlyDiscount = useMemo(() => {
    const itemDiscounts = transaction.items.reduce((sum, i) => sum + i.discountAmount, 0)
    return Math.max(0, transaction.discountAmount - itemDiscounts)
  }, [transaction])

  useEffect(() => {
    if (!isOpen) return
    setItems(
      transaction.items.map((item) => ({
        key: `existing-${item.id}`,
        transactionItemId: item.id,
        productId: item.productId ?? 0,
        productName: item.productName,
        uomId: item.uomId,
        uomCode: item.uomCode,
        qty: item.qty,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        priceTier: item.priceTier,
      })),
    )
    setPayments(
      transaction.payments.map((p) => ({
        paymentMethodId: p.paymentMethodId,
        paymentMethodName: p.paymentMethodName,
        amount: p.amount,
      })),
    )
    setReason('')
    setPin('')
    setError(null)
    setIsSearchOpen(false)
    setQuery('')
    setResults([])
  }, [isOpen, transaction])

  const totals = useMemo(() => {
    const gross = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0)
    const itemDiscount = items.reduce((sum, i) => sum + i.discountAmount, 0)
    const discount = itemDiscount + headerOnlyDiscount
    const payable = Math.max(0, gross - discount)
    const paid = payments.reduce((sum, p) => sum + p.amount, 0)
    return { gross, discount, payable, paid, change: Math.max(0, paid - payable) }
  }, [items, payments, headerOnlyDiscount])

  const delta = totals.payable - transaction.payableAmount

  // Pembayaran menyusul total: begitu tagihan naik melewati uang yang sudah tercatat,
  // baris pertama dinaikkan supaya kasir tidak perlu menghitung manual. Tetap bisa diubah.
  useEffect(() => {
    if (!isOpen || payments.length === 0) return
    const paid = payments.reduce((sum, p) => sum + p.amount, 0)
    if (paid >= totals.payable) return
    setPayments((prev) => {
      const shortfall = totals.payable - prev.reduce((sum, p) => sum + p.amount, 0)
      if (shortfall <= 0) return prev
      const next = [...prev]
      next[0] = { ...next[0], amount: next[0].amount + shortfall }
      return next
    })
  }, [isOpen, totals.payable, payments])

  const runSearch = useCallback(async (search: string) => {
    setIsSearching(true)
    try {
      const params = new URLSearchParams({ search, page: '1', limit: '15' })
      const res = await fetch(`/api/pos/products?${params}`)
      if (!res.ok) throw new Error('gagal')
      const data = await res.json()
      setResults(data.products ?? [])
    } catch {
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (!isSearchOpen) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(query), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, isSearchOpen, runSearch])

  const handleQtyChange = (key: string, qty: number) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, qty: Math.max(1, qty) } : i)))
  }

  const handlePriceChange = (key: string, unitPrice: number) => {
    setItems((prev) =>
      prev.map((i) => (i.key === key ? { ...i, unitPrice: Math.max(0, unitPrice) } : i)),
    )
  }

  const handleRemoveItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }

  const handleAddProduct = (product: SearchProduct) => {
    const uomId = product.baseUomId
    const priceRow =
      product.prices.find((p) => p.uomId === uomId && p.tierType === 'RETAIL') ??
      product.prices.find((p) => p.uomId === uomId)
    const uomCode =
      uomCodeById.get(uomId) ??
      product.conversions.find((c) => c.uomId === uomId)?.uomCode ??
      '-'

    setItems((prev) => [
      ...prev,
      {
        key: `new-${product.id}-${Date.now()}`,
        transactionItemId: null,
        productId: product.id,
        productName: product.name,
        uomId,
        uomCode,
        qty: 1,
        unitPrice: priceRow ? Number(priceRow.price) : 0,
        discountAmount: 0,
        priceTier: priceRow?.tierType ?? 'RETAIL',
      },
    ])
    setIsSearchOpen(false)
    setQuery('')
    setResults([])
  }

  const handlePaymentChange = (paymentMethodId: number, amount: number) => {
    setPayments((prev) =>
      prev.map((p) =>
        p.paymentMethodId === paymentMethodId ? { ...p, amount: Math.max(0, amount) } : p,
      ),
    )
  }

  const canSubmit =
    items.length > 0 &&
    reason.trim().length >= 3 &&
    pin.length >= 4 &&
    totals.paid >= totals.payable &&
    !isSubmitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/pos/transactions/${transaction.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reason.trim(),
          pin,
          items: items.map((i) => ({
            transactionItemId: i.transactionItemId,
            productId: i.productId,
            uomId: i.uomId,
            qty: i.qty,
            unitPrice: i.unitPrice,
            discountAmount: i.discountAmount,
            priceTier: i.priceTier,
          })),
          payments: payments.map((p) => ({
            paymentMethodId: p.paymentMethodId,
            amount: p.amount,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Gagal mengoreksi transaksi')
        setPin('')
        return
      }
      onSuccess()
    } catch {
      setError('Koneksi bermasalah, koreksi tidak tersimpan')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60" role="presentation" />
      <div
        className="fixed inset-x-0 bottom-0 z-[70] bg-background rounded-t-2xl shadow-xl flex flex-col max-h-[94vh] print:hidden"
        role="dialog"
        aria-modal="true"
        aria-label={`Koreksi Transaksi ${transaction.trxNumber}`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">Koreksi Transaksi</h2>
            <p className="text-xs text-muted-foreground">{transaction.trxNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
            aria-label="Tutup Koreksi Transaksi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="text-xs text-muted-foreground mb-3">
            Salah produk? Hapus item yang keliru lalu tambahkan yang benar. Stok akan
            menyesuaikan otomatis.
          </p>

          {/* Item */}
          <div className="space-y-3 mb-4">
            {items.map((item) => (
              <div key={item.key} className="border border-border rounded-xl p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight">
                      {item.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.uomCode}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.key)}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-lg transition-colors flex-shrink-0"
                    aria-label={`Hapus ${item.productName}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleQtyChange(item.key, item.qty - 1)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center border border-border rounded-lg hover:bg-accent transition-colors"
                      aria-label="Kurangi qty"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={item.qty}
                      onChange={(e) => handleQtyChange(item.key, parseInt(e.target.value, 10) || 1)}
                      className="w-14 h-[40px] text-center text-sm font-semibold border border-border rounded-lg bg-background text-foreground"
                      aria-label={`Qty ${item.productName}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleQtyChange(item.key, item.qty + 1)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center border border-border rounded-lg hover:bg-accent transition-colors"
                      aria-label="Tambah qty"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <input
                    type="number"
                    inputMode="numeric"
                    value={item.unitPrice}
                    onChange={(e) =>
                      handlePriceChange(item.key, parseInt(e.target.value, 10) || 0)
                    }
                    className="flex-1 min-w-0 h-[40px] px-2 text-sm text-right border border-border rounded-lg bg-background text-foreground"
                    aria-label={`Harga satuan ${item.productName}`}
                  />

                  <span className="text-sm font-semibold text-foreground tabular-nums flex-shrink-0 w-24 text-right">
                    {formatRupiahInt(Math.max(0, item.qty * item.unitPrice - item.discountAmount))}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Tambah item */}
          {isSearchOpen ? (
            <div className="border border-border rounded-xl p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari produk atau SKU…"
                  autoFocus
                  className="flex-1 min-w-0 h-[40px] px-2 text-sm border border-border rounded-lg bg-background text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-muted-foreground hover:bg-accent rounded-lg"
                  aria-label="Tutup pencarian produk"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {isSearching ? (
                  <p className="text-xs text-muted-foreground py-2">Mencari…</p>
                ) : results.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Produk tidak ditemukan.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {results.map((product) => (
                      <li key={product.id}>
                        <button
                          type="button"
                          onClick={() => handleAddProduct(product)}
                          className="w-full text-left py-2.5 px-1 hover:bg-accent rounded-lg transition-colors"
                        >
                          <p className="text-sm text-foreground leading-tight">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.sku ?? '-'} · stok {product.stock}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="w-full min-h-[44px] border border-dashed border-border text-foreground font-medium rounded-xl hover:bg-accent transition-colors flex items-center justify-center gap-2 text-sm mb-4"
            >
              <Plus className="w-4 h-4" />
              Tambah Item
            </button>
          )}

          <div className="border-t border-dashed border-border my-3" />

          {/* Ringkasan */}
          <div className="space-y-1.5 mb-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Total sebelum koreksi</span>
              <span className="tabular-nums">{formatRupiahInt(transaction.payableAmount)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Diskon</span>
                <span className="tabular-nums">-{formatRupiahInt(totals.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-foreground">
              <span>Total setelah koreksi</span>
              <span className="tabular-nums">{formatRupiahInt(totals.payable)}</span>
            </div>
            {delta !== 0 && (
              <div
                className={`flex justify-between text-sm font-medium ${
                  delta > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <span>{delta > 0 ? 'Kurang bayar' : 'Kelebihan bayar'}</span>
                <span className="tabular-nums">{formatRupiahInt(Math.abs(delta))}</span>
              </div>
            )}
          </div>

          {/* Pembayaran */}
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Pembayaran
            </h3>
            <div className="space-y-2">
              {payments.map((payment) => (
                <div key={payment.paymentMethodId} className="flex items-center gap-2">
                  <span className="text-sm text-foreground flex-1 min-w-0 truncate">
                    {payment.paymentMethodName}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={payment.amount}
                    onChange={(e) =>
                      handlePaymentChange(
                        payment.paymentMethodId,
                        parseInt(e.target.value, 10) || 0,
                      )
                    }
                    className="w-36 h-[40px] px-2 text-sm text-right border border-border rounded-lg bg-background text-foreground"
                    aria-label={`Nominal ${payment.paymentMethodName}`}
                  />
                </div>
              ))}
              <div className="flex justify-between text-sm text-muted-foreground pt-1">
                <span>Kembalian</span>
                <span className="tabular-nums">{formatRupiahInt(totals.change)}</span>
              </div>
            </div>
          </div>

          {/* Alasan & PIN */}
          <div className="space-y-3">
            <div>
              <label htmlFor="edit-reason" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Alasan Koreksi
              </label>
              <textarea
                id="edit-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Contoh: salah input qty, seharusnya 2 bukan 5"
                className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground resize-none"
              />
            </div>
            <div>
              <label htmlFor="edit-pin" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                PIN Petugas Berwenang
              </label>
              <input
                id="edit-pin"
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••"
                className="mt-1 w-full h-[44px] px-3 text-sm tracking-[0.5em] text-center border border-border rounded-lg bg-background text-foreground"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="px-4 py-4 border-t border-border flex-shrink-0 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 min-h-[52px] border border-border text-foreground font-semibold rounded-xl hover:bg-accent transition-colors disabled:opacity-40"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 min-h-[52px] bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Menyimpan…' : 'Simpan Koreksi'}
          </button>
        </div>
      </div>
    </>
  )
}
