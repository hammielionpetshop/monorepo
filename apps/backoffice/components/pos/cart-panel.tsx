'use client'

import { useState } from 'react'
import { useCartStore, calcGrandTotal, formatRupiah } from './cart-store'
import BulkTierDialog from './bulk-tier-dialog'

interface CartPanelProps {
  onCheckout: () => void
  onOpenCustomerSearch: () => void
  onHold: () => void
}

export default function CartPanel({ onCheckout, onOpenCustomerSearch, onHold }: CartPanelProps) {
  const items = useCartStore((s) => s.items)
  const updateQty = useCartStore((s) => s.updateQty)
  const removeItem = useCartStore((s) => s.removeItem)
  const selectedCustomer = useCartStore((s) => s.selectedCustomer)
  const setSelectedCustomer = useCartStore((s) => s.setSelectedCustomer)
  const grandTotal = calcGrandTotal(items)
  const isEmpty = items.length === 0
  const [bulkTierOpen, setBulkTierOpen] = useState(false)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-foreground">Keranjang</h2>
          <p className="text-xs text-muted-foreground">{items.length} item</p>
        </div>
        {!isEmpty && (
          <button
            type="button"
            onClick={() => setBulkTierOpen(true)}
            className="min-h-[40px] px-3 py-2 rounded-lg border border-border bg-background hover:bg-accent text-xs font-medium text-foreground transition-colors flex items-center gap-1.5 active:scale-[0.98]"
            aria-label="Ubah tier harga semua item"
          >
            <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
            </svg>
            Ubah Tier
          </button>
        )}
      </div>

      {/* Customer section */}
      <div className="px-4 py-2 border-b border-border flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpenCustomerSearch}
          className="flex-1 flex items-center gap-2 text-sm text-left min-h-[44px] rounded-lg hover:bg-accent transition-colors px-1"
          aria-label="Pilih pelanggan"
        >
          <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {selectedCustomer ? (
            <span className="font-medium text-foreground truncate">{selectedCustomer.name}</span>
          ) : (
            <span className="text-muted-foreground">Pilih Pelanggan (Opsional)</span>
          )}
        </button>
        {selectedCustomer && (
          <button
            type="button"
            onClick={() => setSelectedCustomer(null)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg transition-colors flex-shrink-0"
            aria-label="Batalkan pilihan pelanggan"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
            <p className="text-3xl mb-2">🛒</p>
            <p className="text-sm">Keranjang kosong</p>
            <p className="text-xs mt-1">Pilih produk dari daftar sebelah kiri</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={`${item.productId}_${item.uomId}_${item.priceTier}`} className="px-4 py-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground leading-tight line-clamp-2 block">
                      {item.productName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.uomCode} · {item.priceTier}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId, item.uomId, item.priceTier)}
                    className="text-destructive hover:text-destructive/70 text-xs min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
                    aria-label="Hapus item"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  {/* Qty stepper */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, item.uomId, item.priceTier, item.qty - 1)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border bg-background hover:bg-accent text-foreground font-bold text-lg transition-colors"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-base font-semibold tabular-nums">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, item.uomId, item.priceTier, item.qty + 1)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border bg-background hover:bg-accent text-foreground font-bold text-lg transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {formatRupiah(item.unitPrice)} / {item.uomCode}
                    </p>
                    <p className="text-sm font-bold text-foreground">
                      {formatRupiah(item.subtotal)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer total + bayar */}
      <div className="border-t border-border p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground font-medium">Total</span>
          <span className="text-lg font-extrabold text-foreground tabular-nums">
            {formatRupiah(grandTotal)}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onHold}
            disabled={isEmpty}
            className="min-h-[52px] px-4 rounded-xl border border-border bg-background text-sm font-semibold text-foreground hover:bg-accent active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            aria-label="Tahan transaksi"
          >
            Tahan
          </button>
          <button
            type="button"
            onClick={onCheckout}
            disabled={isEmpty}
            className="flex-1 min-h-[52px] bg-primary text-primary-foreground rounded-xl text-base font-bold hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
          >
            Bayar <kbd className="ml-1 text-xs opacity-50 font-mono font-normal">F10</kbd>
          </button>
        </div>
      </div>

      {bulkTierOpen && <BulkTierDialog onClose={() => setBulkTierOpen(false)} />}
    </div>
  )
}
