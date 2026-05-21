'use client'

import { formatRupiah } from './cart-store'

interface MobileCartBarProps {
  itemCount: number
  grandTotal: string
  onCheckout: () => void
}

export default function MobileCartBar({ itemCount, grandTotal, onCheckout }: MobileCartBarProps) {
  const isEmpty = itemCount === 0

  return (
    <div className="flex items-center gap-3 p-4">
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{itemCount} item</p>
        <p className="text-base font-extrabold text-foreground tabular-nums">
          {formatRupiah(grandTotal)}
        </p>
      </div>
      <button
        type="button"
        onClick={onCheckout}
        disabled={isEmpty}
        className="min-h-[52px] px-8 bg-primary text-primary-foreground rounded-xl text-base font-bold hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
      >
        Bayar
      </button>
    </div>
  )
}
