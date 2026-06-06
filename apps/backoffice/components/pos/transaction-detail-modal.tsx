'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { TransactionWithDetails } from '@/app/pos/(authenticated)/history/page'
import type { CartItem } from './cart-store'
import { useCartStore } from './cart-store'
import ReceiptPrint from './receipt-print'
import VoidPinDialog from './void-pin-dialog'

interface TransactionDetailModalProps {
  transaction: TransactionWithDetails
  branchName: string
  cashierName: string
  onClose: () => void
  activeShiftId: number | null
}

function formatRupiahInt(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(dateStr))
}

export default function TransactionDetailModal({
  transaction,
  branchName,
  cashierName,
  onClose,
  activeShiftId,
}: TransactionDetailModalProps) {
  const router = useRouter()
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false)
  const [localStatus, setLocalStatus] = useState(transaction.status)
  
  useEffect(() => {
    setLocalStatus(transaction.status)
  }, [transaction.id, transaction.status])

  const isVoided = localStatus === 'VOIDED'
  // Void hanya diizinkan jika transaksi ada di shift aktif saat ini dan statusnya COMPLETED
  const canVoid = localStatus === 'COMPLETED' && transaction.shiftId === activeShiftId
  // Shift sudah ditutup = transaksi dari shift berbeda
  const isFromClosedShift = localStatus === 'COMPLETED' && transaction.shiftId !== activeShiftId

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isVoidDialogOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, isVoidDialogOpen])

  const handleVoidSuccess = () => {
    setIsVoidDialogOpen(false)
    setLocalStatus('VOIDED')
    router.refresh()
  }

  const handleCloneToCart = () => {
    const cartItems: CartItem[] = transaction.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      uomId: item.uomId,
      uomCode: item.uomCode,
      qty: item.qty,
      unitPrice: item.unitPrice.toString(),
      priceTier: item.priceTier,
      discountAmount: item.discountAmount.toString(),
      subtotal: item.totalPrice.toString(),
    }))
    useCartStore.setState({ items: cartItems })
    onClose()
    router.push('/pos')
  }

  // Convert DB integer items to CartItem format for ReceiptPrint
  const cartItems: CartItem[] = transaction.items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    uomId: item.uomId,
    uomCode: item.uomCode,
    qty: item.qty,
    unitPrice: item.unitPrice.toString(),
    priceTier: item.priceTier,
    discountAmount: item.discountAmount.toString(),
    subtotal: item.totalPrice.toString(),
  }))

  const grandTotalStr = transaction.payableAmount.toString()
  const paidAmountStr = transaction.paidAmount.toString()
  const kembalianStr = transaction.changeAmount.toString()
  const combinedPaymentMethods = transaction.payments.map((p) => p.paymentMethodName).join(' + ') || '-'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onClose()
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Tutup modal detail transaksi"
      />

      {/* Modal Container */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-2xl shadow-xl flex flex-col max-h-[90vh] print:hidden"
        role="dialog"
        aria-modal="true"
        aria-label={`Detail Transaksi ${transaction.trxNumber}`}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">{transaction.trxNumber}</h2>
            <p className="text-xs text-muted-foreground">{formatDateTime(transaction.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            {isVoided && (
              <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">
                VOID
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
              aria-label="Tutup Detail Transaksi"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Items */}
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Item ({transaction.items.length})
            </h3>
            <div className="space-y-3">
              {transaction.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight">{item.productName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.qty} {item.uomCode} × {formatRupiahInt(item.unitPrice)}
                      {item.discountAmount > 0 && ` (Potongan ${formatRupiahInt(item.discountAmount)})`}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-foreground flex-shrink-0">
                    {formatRupiahInt(item.totalPrice)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-border my-3" />

          {/* Totals */}
          <div className="space-y-1.5 mb-4">
            {transaction.discountAmount > 0 && (
              <>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatRupiahInt(transaction.totalAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-destructive font-medium">
                  <span>Diskon Transaksi</span>
                  <span>-{formatRupiahInt(transaction.discountAmount)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-foreground">Total</span>
              <span className={`text-sm font-bold ${isVoided ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {formatRupiahInt(transaction.payableAmount)}
              </span>
            </div>

            {transaction.payments.map((payment) => (
              <div key={payment.id} className="flex justify-between items-center text-sm text-muted-foreground">
                <span>{payment.paymentMethodName}</span>
                <span>{formatRupiahInt(payment.amount)}</span>
              </div>
            ))}

            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>Kembalian</span>
              <span>{formatRupiahInt(transaction.changeAmount)}</span>
            </div>
          </div>
        </div>

        {/* Modal footer */}
        <div className="px-4 py-4 border-t border-border flex-shrink-0 space-y-2">
          {/* Pesan shift tertutup */}
          {isFromClosedShift && (
            <p className="text-xs text-muted-foreground text-center px-2">
              Transaksi dari shift yang sudah ditutup tidak dapat di-void dari POS. Gunakan Retur di Backoffice.
            </p>
          )}

          {/* Clone to Cart — muncul setelah void berhasil */}
          {isVoided && (
            <button
              type="button"
              onClick={handleCloneToCart}
              className="w-full min-h-[44px] border border-border text-foreground font-semibold rounded-xl hover:bg-accent transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Clone to Cart
            </button>
          )}

          {/* Tombol Void — tampil hanya jika belum VOIDED */}
          {!isVoided && (
            <button
              type="button"
              onClick={() => canVoid && setIsVoidDialogOpen(true)}
              disabled={!canVoid}
              className="w-full min-h-[44px] border border-destructive/40 text-destructive font-semibold rounded-xl hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {localStatus === 'PENDING_VOID' ? 'Void Sedang Diproses' : 'Void Transaksi'}
            </button>
          )}

          {/* Cetak Ulang */}
          <button
            type="button"
            onClick={() => window.print()}
            className={`w-full min-h-[52px] text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-opacity-95 transition-colors ${
              isVoided ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'
            }`}
          >
            🖨️ Cetak Ulang Struk {isVoided ? '(VOID)' : ''}
          </button>
        </div>
      </div>

      {/* Hidden receipt for printing */}
      <ReceiptPrint
        receiptNumber={transaction.trxNumber}
        items={cartItems}
        grandTotal={grandTotalStr}
        amountPaid={paidAmountStr}
        kembalian={kembalianStr}
        paymentMethodName={combinedPaymentMethods}
        branchName={branchName}
        transactionDate={new Date(transaction.createdAt)}
        cashierName={cashierName}
        discountAmount={transaction.discountAmount > 0 ? transaction.discountAmount.toString() : undefined}
        isReprint={true}
        isVoided={isVoided}
      />

      <VoidPinDialog
        isOpen={isVoidDialogOpen}
        transactionId={transaction.id}
        trxNumber={transaction.trxNumber}
        onClose={() => setIsVoidDialogOpen(false)}
        onSuccess={handleVoidSuccess}
      />
    </>
  )
}
