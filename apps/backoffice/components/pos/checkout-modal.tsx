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

interface SplitLine {
  key: number
  paymentMethodId: number
  amount: string
}

function parseIntBig(value: string): Big {
  try {
    const intStr = value.replace(/[^0-9]/g, '')
    return intStr ? new Big(intStr) : new Big(0)
  } catch {
    return new Big(0)
  }
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
  const [discount, setDiscount] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [splitMode, setSplitMode] = useState(false)
  const [splitLines, setSplitLines] = useState<SplitLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TransactionResult | null>(null)

  const submittingRef = useRef(false)
  const splitKeyRef = useRef(0)
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

  const grossTotalBig = new Big(grandTotal)

  // Diskon nominal — strip non-digit, clamp ke [0, total kotor]
  let discountBig = parseIntBig(discount)
  if (discountBig.gt(grossTotalBig)) discountBig = grossTotalBig

  const netTotalBig = grossTotalBig.minus(discountBig)
  const netTotalNum = netTotalBig.toNumber()
  const hasDiscount = discountBig.gt(0)

  const methodById = new Map(paymentMethods.map((m) => [m.id, m]))

  // ── Single payment ───────────────────────────────────────────────
  const amountPaidBig = parseIntBig(amountPaid)
  const selectedMethod = paymentMethods.find((m) => m.id === selectedPaymentMethodId)
  const isCash = selectedMethod?.type === 'CASH'
  const isDebt = selectedMethod?.type === 'DEBT'

  // ── Split payment ────────────────────────────────────────────────
  const splitPaidBig = splitLines.reduce(
    (acc, l) => acc.plus(parseIntBig(l.amount)),
    new Big(0)
  )
  const splitRemainingBig = netTotalBig.minus(splitPaidBig)
  const splitHasDebt = splitLines.some(
    (l) => methodById.get(l.paymentMethodId)?.type === 'DEBT'
  )
  const splitDebtBig = splitLines.reduce(
    (acc, l) =>
      methodById.get(l.paymentMethodId)?.type === 'DEBT'
        ? acc.plus(parseIntBig(l.amount))
        : acc,
    new Big(0)
  )
  const splitChangeBig =
    !splitHasDebt && splitPaidBig.gt(netTotalBig)
      ? splitPaidBig.minus(netTotalBig)
      : new Big(0)
  const splitNeedsCustomer = splitHasDebt && customerId === null
  const splitValid =
    splitLines.length > 0 &&
    splitLines.some((l) => parseIntBig(l.amount).gt(0)) &&
    splitPaidBig.gte(netTotalBig) &&
    !splitNeedsCustomer

  // ── Mode aktif ───────────────────────────────────────────────────
  const kembalian = splitMode
    ? splitChangeBig.gt(0)
      ? splitChangeBig.toString()
      : null
    : !isDebt && amountPaidBig.gte(netTotalBig)
      ? amountPaidBig.minus(netTotalBig).toString()
      : null

  const isAmountValid = amountPaidBig.gte(netTotalBig)
  const canSubmit = loading
    ? false
    : splitMode
      ? splitValid
      : isDebt
        ? selectedPaymentMethodId !== null && customerId !== null
        : selectedPaymentMethodId !== null && isAmountValid

  function fillAmount(value: number) {
    setAmountPaid(String(value))
  }

  function fillDenomination(denom: number) {
    const rounded = Math.ceil(netTotalNum / denom) * denom
    setAmountPaid(String(rounded))
  }

  function enterSplitMode() {
    setError('')
    setSplitMode(true)
    if (splitLines.length === 0) {
      // Baris pertama: metode terpilih saat ini, prefill dengan total
      const firstId = selectedPaymentMethodId ?? paymentMethods[0]?.id
      if (firstId != null) {
        splitKeyRef.current += 1
        setSplitLines([
          { key: splitKeyRef.current, paymentMethodId: firstId, amount: String(netTotalNum) },
        ])
      }
    }
  }

  function exitSplitMode() {
    setError('')
    setSplitMode(false)
  }

  function addSplitLine() {
    const used = new Set(splitLines.map((l) => l.paymentMethodId))
    const nextMethod =
      paymentMethods.find((m) => !used.has(m.id)) ?? paymentMethods[0]
    if (!nextMethod) return
    splitKeyRef.current += 1
    const remaining = splitRemainingBig.gt(0) ? splitRemainingBig.toString() : ''
    setSplitLines((prev) => [
      ...prev,
      { key: splitKeyRef.current, paymentMethodId: nextMethod.id, amount: remaining },
    ])
  }

  function updateSplitLine(key: number, patch: Partial<SplitLine>) {
    setSplitLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    )
  }

  function removeSplitLine(key: number) {
    setSplitLines((prev) => prev.filter((l) => l.key !== key))
  }

  function fillSplitRemaining(key: number) {
    if (splitRemainingBig.lte(0)) return
    const line = splitLines.find((l) => l.key === key)
    const current = line ? parseIntBig(line.amount) : new Big(0)
    updateSplitLine(key, { amount: current.plus(splitRemainingBig).toString() })
  }

  // Rincian pembayaran untuk struk & ringkasan sukses
  const receiptPayments = splitMode
    ? splitLines
        .filter((l) => parseIntBig(l.amount).gt(0))
        .map((l) => ({
          name: methodById.get(l.paymentMethodId)?.name ?? '-',
          amount: parseIntBig(l.amount).toString(),
        }))
    : [
        {
          name: selectedMethod?.name ?? '-',
          amount: (isDebt ? netTotalBig : amountPaidBig).toString(),
        },
      ]
  const totalPaidBig = splitMode ? splitPaidBig : isDebt ? netTotalBig : amountPaidBig

  async function handleSubmit() {
    if (!canSubmit || submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    setError('')

    let payments: { paymentMethodId: number; amount: number; referenceNumber: null }[]
    let payloadAmountPaid: number
    let payloadChange: number
    let payloadDueAt: string | null

    if (splitMode) {
      payments = splitLines
        .filter((l) => parseIntBig(l.amount).gt(0))
        .map((l) => ({
          paymentMethodId: l.paymentMethodId,
          amount: parseIntBig(l.amount).toNumber(),
          referenceNumber: null,
        }))
      payloadAmountPaid = splitPaidBig.toNumber()
      payloadChange = splitChangeBig.toNumber()
      payloadDueAt = splitHasDebt ? dueAt || null : null
    } else {
      payments = [
        {
          paymentMethodId: selectedPaymentMethodId!,
          amount: isDebt ? netTotalBig.toNumber() : amountPaidBig.toNumber(),
          referenceNumber: null,
        },
      ]
      payloadAmountPaid = isDebt ? netTotalBig.toNumber() : amountPaidBig.toNumber()
      payloadChange = isDebt ? 0 : kembalian ? new Big(kembalian).toNumber() : 0
      payloadDueAt = isDebt ? dueAt || null : null
    }

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
      payments,
      totals: {
        subtotal: grossTotalBig.toNumber(),
        discountTotal: discountBig.toNumber(),
        grandTotal: netTotalBig.toNumber(),
        itemCount: calcItemCount(items),
      },
      amountPaid: payloadAmountPaid,
      change: payloadChange,
      dueAt: payloadDueAt,
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
          grandTotal={netTotalBig.toString()}
          discountAmount={discountBig.toString()}
          amountPaid={totalPaidBig.toString()}
          kembalian={kembalian ?? '0'}
          paymentMethodName={selectedMethod?.name ?? '-'}
          payments={receiptPayments}
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
              {hasDiscount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Diskon</span>
                  <span className="font-bold text-orange-600">-{formatRupiah(discountBig.toString())}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">{formatRupiah(netTotalBig.toString())}</span>
              </div>
              {receiptPayments.map((p, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-muted-foreground">{p.name}</span>
                  <span className="font-bold">{formatRupiah(p.amount)}</span>
                </div>
              ))}
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
        <div className="bg-muted/40 rounded-xl p-4 mb-5 space-y-1.5">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">{items.length} item · Subtotal</span>
            <span className="font-semibold text-foreground tabular-nums">
              {formatRupiah(grandTotal)}
            </span>
          </div>
          {hasDiscount && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Diskon</span>
              <span className="font-semibold text-orange-600 tabular-nums">
                -{formatRupiah(discountBig.toString())}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center border-t border-border pt-1.5">
            <span className="text-sm font-medium text-muted-foreground">Total</span>
            <span className="text-xl font-extrabold text-foreground tabular-nums">
              {formatRupiah(netTotalBig.toString())}
            </span>
          </div>
        </div>

        {/* Diskon nominal */}
        <div className="mb-5">
          <label htmlFor="discount" className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 ml-1">
            Diskon (Rp)
          </label>
          <input
            id="discount"
            type="text"
            inputMode="numeric"
            value={discount ? parseInt(discount, 10).toLocaleString('id-ID') : ''}
            onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
            className="w-full px-4 py-3 bg-background border border-input rounded-xl text-base font-semibold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all min-h-[52px] tabular-nums"
          />
          {discount && grossTotalBig.gt(0) && new Big(discount).gt(grossTotalBig) && (
            <p className="text-xs text-orange-600 mt-1 ml-1">
              Diskon dibatasi maksimal sebesar total ({formatRupiah(grandTotal)})
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-semibold flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Toggle split */}
        <div className="mb-5 flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
            {splitMode ? 'Bayar Gabungan' : 'Metode Pembayaran'}
          </span>
          <button
            type="button"
            onClick={splitMode ? exitSplitMode : enterSplitMode}
            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-accent text-xs font-semibold text-foreground transition-colors"
          >
            {splitMode ? '← Bayar Tunggal' : 'Bayar Gabungan (Split)'}
          </button>
        </div>

        {splitMode ? (
          /* ── Split payment editor ─────────────────────────────── */
          <>
            <div className="mb-4 space-y-3">
              {splitLines.map((line) => (
                <div key={line.key} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={line.paymentMethodId}
                      onChange={(e) =>
                        updateSplitLine(line.key, { paymentMethodId: Number(e.target.value) })
                      }
                      className="flex-1 min-h-[44px] px-3 py-2 bg-background border border-input rounded-lg text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      {paymentMethods.map((pm) => (
                        <option key={pm.id} value={pm.id}>
                          {pm.name}
                        </option>
                      ))}
                    </select>
                    {splitLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSplitLine(line.key)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                        aria-label="Hapus metode"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={line.amount ? parseInt(line.amount, 10).toLocaleString('id-ID') : ''}
                      onChange={(e) =>
                        updateSplitLine(line.key, { amount: e.target.value.replace(/\D/g, '') })
                      }
                      placeholder="0"
                      className="flex-1 px-3 py-2 bg-background border border-input rounded-lg text-base font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => fillSplitRemaining(line.key)}
                      disabled={splitRemainingBig.lte(0)}
                      className="min-h-[44px] px-3 py-2 rounded-lg border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                    >
                      Isi Sisa
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addSplitLine}
              className="w-full min-h-[44px] mb-4 border border-dashed border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.98] transition-all"
            >
              + Tambah Metode
            </button>

            {/* Ringkasan split */}
            <div className="mb-5 px-4 py-3 bg-muted/40 rounded-xl text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Terbayar</span>
                <span className="font-bold tabular-nums">{formatRupiah(splitPaidBig.toString())}</span>
              </div>
              {splitRemainingBig.gt(0) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sisa</span>
                  <span className="font-bold text-destructive tabular-nums">
                    {formatRupiah(splitRemainingBig.toString())}
                  </span>
                </div>
              )}
              {splitDebtBig.gt(0) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jumlah Hutang</span>
                  <span className="font-bold text-orange-600 tabular-nums">
                    {formatRupiah(splitDebtBig.toString())}
                  </span>
                </div>
              )}
            </div>

            {splitNeedsCustomer && (
              <div className="mb-5 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-yellow-800 dark:text-yellow-400 text-sm font-semibold flex items-center gap-2">
                <span>⚠️</span> Pilih customer terlebih dahulu untuk pembayaran hutang.
              </div>
            )}

            {splitHasDebt && (
              <div className="mb-5">
                <label htmlFor="due-at-split" className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 ml-1">
                  Jatuh Tempo (opsional)
                </label>
                <input
                  id="due-at-split"
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all min-h-[52px]"
                />
              </div>
            )}
          </>
        ) : (
          /* ── Single payment ───────────────────────────────────── */
          <>
            <div className="mb-5">
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
                    <span className="font-bold">{formatRupiah(netTotalBig.toString())}</span>
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
                    onClick={() => fillAmount(netTotalNum)}
                    className="w-full min-h-[44px] border border-primary/40 text-primary font-semibold rounded-xl text-sm hover:bg-primary/10 active:scale-[0.98] transition-all"
                  >
                    Uang Pas · {formatRupiah(netTotalBig.toString())}
                  </button>
                  {isCash && (
                    <div className="grid grid-cols-3 gap-2">
                      {[20000, 50000, 100000].map((denom) => {
                        const filled = Math.ceil(netTotalNum / denom) * denom
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
          ) : !splitMode && isDebt ? (
            <>Catat Hutang</>
          ) : splitMode && splitHasDebt ? (
            <>Proses & Catat Hutang</>
          ) : (
            <>Proses Pembayaran <kbd className="ml-1 text-xs opacity-50 font-mono font-normal">Enter</kbd></>
          )}
        </button>
      </div>
    </div>
  )
}
