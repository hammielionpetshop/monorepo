'use client'

import { useState, useRef, useEffect } from 'react'
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
  customerId: number | null
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
  customerId,
  onClose,
  onSuccess,
}: CheckoutModalProps) {
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<number | null>(
    paymentMethods[0]?.id ?? null
  )
  const [amountPaid, setAmountPaid] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TransactionResult | null>(null)

  const submittingRef = useRef(false)
  const amountInputRef = useRef<HTMLInputElement>(null)

  // Auto-fokus input nominal saat modal buka
  useEffect(() => {
    const timer = setTimeout(() => amountInputRef.current?.focus(), 80)
    return () => clearTimeout(timer)
  }, [])

  // Enter di state sukses → transaksi baru
  useEffect(() => {
    if (!result) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); onSuccess() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [result, onSuccess])

  // Hanya terima bilangan bulat — strip karakter non-digit lalu parse
  let amountPaidBig = new Big(0)
  try {
    const intStr = amountPaid.replace(/[^0-9]/g, '')
    if (intStr) {
      amountPaidBig = new Big(intStr)
    }
  } catch {
    amountPaidBig = new Big(0)
  }

  const grandTotalBig = new Big(grandTotal)
  const grandTotalNum = grandTotalBig.toNumber()

  const selectedMethod = paymentMethods.find((m) => m.id === selectedPaymentMethodId)
  const isCash = selectedMethod?.type === 'CASH'
  const isDebt = selectedMethod?.type === 'DEBT'

  const kembalian = !isDebt && amountPaidBig.gte(grandTotalBig)
    ? amountPaidBig.minus(grandTotalBig).toString()
    : null
  const isAmountValid = amountPaidBig.gte(grandTotalBig)
  const canSubmit = isDebt
    ? selectedPaymentMethodId !== null && customerId !== null && !loading
    : selectedPaymentMethodId !== null && isAmountValid && !loading

  function fillAmount(value: number) {
    setAmountPaid(String(value))
  }

  function fillDenomination(denom: number) {
    const rounded = Math.ceil(grandTotalNum / denom) * denom
    setAmountPaid(String(rounded))
  }

  async function handleSubmit() {
    if (!canSubmit || !selectedPaymentMethodId || submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    setError('')

    const payload = {
      branchId,
      shiftId,
      cashierId,
      customerId: customerId,
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
          amount: isDebt ? grandTotalBig.toNumber() : amountPaidBig.toNumber(),
          referenceNumber: null,
        },
      ],
      totals: {
        subtotal: grandTotalBig.toNumber(),
        discountTotal: 0,
        grandTotal: grandTotalBig.toNumber(),
        itemCount: calcItemCount(items),
      },
      amountPaid: isDebt ? grandTotalBig.toNumber() : amountPaidBig.toNumber(),
      change: isDebt ? 0 : (kembalian ? new Big(kembalian).toNumber() : 0),
      dueAt: isDebt ? (dueAt || null) : null,
    }

    try {
      const res = await fetch('/api/pos/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      let data: { success?: boolean; transaction?: { id: number; trxNumber?: string }; error?: string } = {}
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
        receiptNumber: data.transaction?.trxNumber ?? `TRX-${data.transaction?.id ?? Date.now()}`,
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

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
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

        {/* Mode Hutang/Kredit */}
        {isDebt ? (
          <>
            {customerId === null && (
              <div className="mb-5 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-yellow-800 dark:text-yellow-400 text-sm font-semibold flex items-center gap-2">
                <span>⚠️</span> Pilih customer terlebih dahulu untuk transaksi hutang.
              </div>
            )}
            <div className="mb-5 px-4 py-3 bg-muted/40 rounded-xl text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jumlah Hutang</span>
                <span className="font-bold">{formatRupiah(grandTotal)}</span>
              </div>
            </div>
            <div className="mb-5">
              <label htmlFor="due-at" className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 ml-1">
                Jatuh Tempo (opsional)
              </label>
              <input
                id="due-at"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all min-h-[52px]"
              />
            </div>
          </>
        ) : (
          <>
            {/* Amount paid */}
            <div className="mb-5">
              <label htmlFor="amount-paid" className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 ml-1">
                Jumlah Bayar
              </label>
              <input
                ref={amountInputRef}
                id="amount-paid"
                type="text"
                inputMode="numeric"
                value={amountPaid ? parseInt(amountPaid, 10).toLocaleString('id-ID') : ''}
                onChange={(e) => {
                  const intOnly = e.target.value.replace(/\D/g, '')
                  setAmountPaid(intOnly)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) { e.preventDefault(); handleSubmit() }
                }}
                placeholder="0"
                className="w-full px-4 py-4 bg-background border border-input rounded-xl text-lg font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all min-h-[52px] tabular-nums"
              />
              {amountPaid && !isAmountValid && (
                <p className="text-xs text-destructive mt-1 ml-1">
                  Jumlah bayar kurang dari total transaksi
                </p>
              )}
            </div>

            {/* Quick fill buttons */}
            <div className="mb-5 space-y-2">
              <button
                type="button"
                onClick={() => fillAmount(grandTotalNum)}
                className="w-full min-h-[44px] border border-primary/40 text-primary font-semibold rounded-xl text-sm hover:bg-primary/10 active:scale-[0.98] transition-all"
              >
                Uang Pas · {formatRupiah(grandTotal)}
              </button>
              {isCash && (
                <div className="grid grid-cols-3 gap-2">
                  {[20000, 50000, 100000].map((denom) => {
                    const filled = Math.ceil(grandTotalNum / denom) * denom
                    return (
                      <button
                        key={denom}
                        type="button"
                        onClick={() => fillDenomination(denom)}
                        className="min-h-[44px] border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-accent active:scale-[0.98] transition-all px-2"
                      >
                        {filled >= 1000000
                          ? `${filled / 1000000}jt`
                          : `${filled / 1000}rb`}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

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
          ) : isDebt ? (
            <>Catat Hutang</>
          ) : (
            <>Proses Pembayaran <kbd className="ml-1 text-xs opacity-50 font-mono font-normal">Enter</kbd></>
          )}
        </button>
      </div>
    </div>
  )
}
