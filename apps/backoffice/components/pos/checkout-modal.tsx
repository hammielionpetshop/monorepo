'use client'

import { useState, useRef } from 'react'
import Big from 'big.js'
import { CartItem, formatRupiah, calcItemCount } from './cart-store'

import type { BootstrapPaymentMethod } from './pos-client'
import ReceiptPrint from './receipt-print'

interface CheckoutModalProps {
  items: CartItem[]
  grandTotal: string
  paymentMethods: BootstrapPaymentMethod[]
  shiftId: number
  cashierId: number
  cashierName: string
  branchId: number
  branchName: string
  onClose: () => void
  onSuccess: () => void
}

interface TransactionResult {
  receiptNumber: string
  transactionId: number
}

export default function CheckoutModal({
  items,
  grandTotal,
  paymentMethods,
  shiftId,
  cashierId,
  cashierName,
  branchId,
  branchName,
  onClose,
  onSuccess,
}: CheckoutModalProps) {
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<number | null>(
    paymentMethods[0]?.id ?? null
  )
  const [amountPaid, setAmountPaid] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TransactionResult | null>(null)
  
  const submittingRef = useRef(false)

  // Safe decimal parsing without stripping the decimal point
  let amountPaidBig = new Big(0)
  try {
    if (amountPaid && amountPaid.trim() !== '') {
      amountPaidBig = new Big(amountPaid)
    }
  } catch {
    amountPaidBig = new Big(0)
  }

  const grandTotalBig = new Big(grandTotal)

  const kembalian = amountPaidBig.gte(grandTotalBig)
    ? amountPaidBig.minus(grandTotalBig).toString()
    : null
  const isAmountValid = amountPaidBig.gte(grandTotalBig)
  const canSubmit = selectedPaymentMethodId !== null && isAmountValid && !loading

  async function handleSubmit() {
    if (!canSubmit || !selectedPaymentMethodId || submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    setError('')

    const payload = {
      branchId,
      shiftId,
      cashierId,
      customerId: null,
      items: items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        uomId: item.uomId,
        uomCode: item.uomCode,
        qty: item.qty,
        unitPrice: Number(item.unitPrice),
        priceTier: item.priceTier,
        discountAmount: Number(item.discountAmount),
        subtotal: Number(item.subtotal),
        isOwnerOverride: false,
      })),
      payments: [
        {
          paymentMethodId: selectedPaymentMethodId,
          amount: amountPaidBig.toNumber(),
          referenceNumber: null,
        },
      ],
      totals: {
        subtotal: grandTotalBig.toNumber(),
        discountTotal: 0,
        grandTotal: grandTotalBig.toNumber(),
        itemCount: calcItemCount(items),
      },
      amountPaid: amountPaidBig.toNumber(),
      change: kembalian ? new Big(kembalian).toNumber() : 0,
    }

    try {
      const res = await fetch('/api/pos/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      let data: { success?: boolean; transaction?: { id: number; receiptNumber?: string }; error?: string } = {}
      const ct = res.headers.get('content-type')
      if (ct && ct.includes('application/json')) {
        data = await res.json()
      }

      if (!res.ok) {
        setError(data.error || 'Transaksi gagal. Silakan coba lagi.')
        setLoading(false)
        submittingRef.current = false
        return
      }

      setResult({
        receiptNumber: data.transaction?.receiptNumber ?? `TRX-${data.transaction?.id ?? Date.now()}`,
        transactionId: data.transaction?.id ?? 0,
      })
    } catch {
      setError('Koneksi gagal. Periksa internet Anda dan coba lagi.')
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }


  // Success state
  if (result) {
    const selectedMethod = paymentMethods.find((m) => m.id === selectedPaymentMethodId)
    return (
      <>
        <ReceiptPrint
          receiptNumber={result.receiptNumber}
          items={items}
          grandTotal={grandTotal}
          amountPaid={amountPaidBig.toString()}
          kembalian={kembalian ?? '0'}
          paymentMethodName={selectedMethod?.name ?? '-'}
          branchName={branchName}
          transactionDate={new Date()}
          cashierName={cashierName}
        />

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl z-10">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground">Transaksi Berhasil!</h3>
              <p className="text-sm text-muted-foreground mt-2">No. Struk:</p>
              <p className="text-base font-mono font-bold text-foreground">{result.receiptNumber}</p>
            </div>

            <div className="bg-muted/40 rounded-xl p-4 mb-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">{formatRupiah(grandTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bayar</span>
                <span className="font-bold">{formatRupiah(amountPaidBig.toString())}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Kembalian</span>
                <span className="font-bold text-green-600">{formatRupiah(kembalian ?? '0')}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 min-h-[52px] border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-accent active:scale-[0.98] transition-all"
              >
                🖨️ Cetak Struk
              </button>
              <button
                type="button"
                onClick={onSuccess}
                className="flex-1 min-h-[52px] bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all"
              >
                Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Checkout form state
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-foreground">Pembayaran</h3>
          {!loading && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Summary */}
        <div className="bg-muted/40 rounded-xl p-4 mb-5">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{items.length} item</span>
            <span className="text-xl font-extrabold text-foreground tabular-nums">
              {formatRupiah(grandTotal)}
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-semibold flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Payment method */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 ml-1">
            Metode Pembayaran
          </label>
          <div className="grid grid-cols-2 gap-2">
            {paymentMethods.map((pm) => (
              <button
                key={pm.id}
                type="button"
                onClick={() => setSelectedPaymentMethodId(pm.id)}
                className={`min-h-[44px] px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                  selectedPaymentMethodId === pm.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:bg-accent'
                }`}
              >
                {pm.name}
              </button>
            ))}
          </div>
        </div>

        {/* Amount paid */}
        <div className="mb-5">
          <label htmlFor="amount-paid" className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 ml-1">
            Jumlah Bayar
          </label>
          <input
            id="amount-paid"
            type="number"
            inputMode="numeric"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            placeholder="0"
            min={0}
            className="w-full px-4 py-4 bg-background border border-input rounded-xl text-lg font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all min-h-[52px] tabular-nums"
          />
          {amountPaid && !isAmountValid && (
            <p className="text-xs text-destructive mt-1 ml-1">
              Jumlah bayar kurang dari total transaksi
            </p>
          )}
        </div>

        {/* Kembalian */}
        {kembalian && (
          <div className="mb-5 flex justify-between items-center px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <span className="text-sm font-medium text-green-700 dark:text-green-400">Kembalian</span>
            <span className="text-lg font-bold text-green-700 dark:text-green-400 tabular-nums">
              {formatRupiah(kembalian)}
            </span>
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full min-h-[52px] bg-primary text-primary-foreground rounded-xl text-base font-bold hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Memproses...
            </>
          ) : (
            'Proses Pembayaran'
          )}
        </button>
      </div>
    </div>
  )
}
