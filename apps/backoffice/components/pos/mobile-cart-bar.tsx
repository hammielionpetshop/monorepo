'use client'

import { formatRupiah } from './cart-store'

interface MobileCartBarProps {
  itemCount: number
  grandTotal: string
  onCheckout: () => void
  onOpenCustomerSearch: () => void
  onHold: () => void
  selectedCustomerName: string | null
}

export default function MobileCartBar({
  itemCount,
  grandTotal,
  onCheckout,
  onOpenCustomerSearch,
  onHold,
  selectedCustomerName,
}: MobileCartBarProps) {
  const isEmpty = itemCount === 0

  return (
    <div className="flex flex-col">
      {/* Customer row */}
      <button
        type="button"
        onClick={onOpenCustomerSearch}
        className="flex items-center gap-2 px-4 pt-2 pb-1 text-xs text-left"
        aria-label="Pilih pelanggan"
      >
        <svg className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        {selectedCustomerName ? (
          <span className="text-foreground font-medium truncate max-w-[200px]">{selectedCustomerName}</span>
        ) : (
          <span className="text-muted-foreground">Pilih Pelanggan</span>
        )}
      </button>

      {/* Main row */}
      <div className="flex items-center gap-3 px-4 pb-4 pt-1">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{itemCount} item</p>
          <p className="text-base font-extrabold text-foreground tabular-nums">
            {formatRupiah(grandTotal)}
          </p>
        </div>
        <button
          type="button"
          onClick={onHold}
          disabled={isEmpty}
          className="min-h-[52px] px-4 border border-border bg-background text-foreground rounded-xl text-sm font-semibold hover:bg-accent active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          aria-label="Tahan transaksi"
        >
          Tahan
        </button>
        <button
          type="button"
          onClick={onCheckout}
          disabled={isEmpty}
          className="min-h-[52px] px-8 bg-primary text-primary-foreground rounded-xl text-base font-bold hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
        >
          Bayar
        </button>
      </div>
    </div>
  )
}
