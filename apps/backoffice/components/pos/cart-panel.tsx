'use client'

import { useCartStore, calcGrandTotal, formatRupiah } from './cart-store'
import Big from 'big.js'

interface CartPanelProps {
  onCheckout: () => void
}

export default function CartPanel({ onCheckout }: CartPanelProps) {
  const items = useCartStore((s) => s.items)
  const updateQty = useCartStore((s) => s.updateQty)
  const removeItem = useCartStore((s) => s.removeItem)
  const grandTotal = calcGrandTotal(items)
  const isEmpty = items.length === 0

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-base font-bold text-foreground">Keranjang</h2>
        <p className="text-xs text-muted-foreground">{items.length} item</p>
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
              <li key={item.productId} className="px-4 py-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-foreground leading-tight flex-1 line-clamp-2">
                    {item.productName}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.productId)}
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
                      onClick={() => updateQty(item.productId, item.qty - 1)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border bg-background hover:bg-accent text-foreground font-bold text-lg transition-colors"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-base font-semibold tabular-nums">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.productId, item.qty + 1)}
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
        <button
          type="button"
          onClick={onCheckout}
          disabled={isEmpty}
          className="w-full min-h-[52px] bg-primary text-primary-foreground rounded-xl text-base font-bold hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
        >
          Bayar
        </button>
      </div>
    </div>
  )
}
