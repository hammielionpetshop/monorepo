'use client'

import { useEffect, useRef } from 'react'
import type { BulkSaleRow, BulkSaleTotals } from './types'

type BulkSaleReviewDialogProps = {
  branchName: string
  customerName: string
  customerPhone: string | null
  customerSummary: { total: number; outstandingDebt: number } | null
  paymentMethodName: string
  isCredit: boolean
  dpMethodName: string | null
  dueAt: string
  rows: BulkSaleRow[]
  totals: BulkSaleTotals
  amountPaid: number
  isSubmitting: boolean
  onConfirm: () => void
  onCancel: () => void
}

function formatCurrency(value: number) {
  return value.toLocaleString('id-ID')
}

function basePriceForRow(row: BulkSaleRow) {
  return (
    row.availablePrices.find((price) => price.uomId === row.uomId && price.priceTier === row.priceTier)?.price ?? null
  )
}

export default function BulkSaleReviewDialog({
  branchName,
  customerName,
  customerPhone,
  customerSummary,
  paymentMethodName,
  isCredit,
  dpMethodName,
  dueAt,
  rows,
  totals,
  amountPaid,
  isSubmitting,
  onConfirm,
  onCancel,
}: BulkSaleReviewDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!isSubmitting) onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSubmitting, onCancel])

  const remainingDebt = Math.max(0, totals.grandTotal - amountPaid)
  const change = Math.max(0, totals.change)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Tinjau transaksi bulk sale"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onCancel()
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Tinjau Transaksi</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Periksa detail sebelum menyimpan.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-xs text-muted-foreground">Customer</div>
              <div className="font-medium text-foreground">{customerName}</div>
              <div className="text-xs text-muted-foreground">{customerPhone ?? 'Tanpa nomor telepon'}</div>
              {customerSummary && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded bg-muted/60 px-2 py-0.5 text-xs text-foreground">
                    Belanja 30 hari: Rp {formatCurrency(customerSummary.total)}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      customerSummary.outstandingDebt > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-muted/60 text-foreground'
                    }`}
                  >
                    Sisa hutang: Rp {formatCurrency(customerSummary.outstandingDebt)}
                  </span>
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Cabang</div>
              <div className="font-medium text-foreground">{branchName}</div>
              <div className="mt-1 text-xs text-muted-foreground">Metode Pembayaran</div>
              <div className="font-medium text-foreground">{paymentMethodName}</div>
              {isCredit && (
                <div className="mt-1 text-xs text-yellow-700">
                  {amountPaid > 0 ? `DP via ${dpMethodName ?? '-'}` : 'Tanpa uang muka (full kredit)'}
                  {dueAt ? ` · Jatuh tempo ${dueAt}` : ''}
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground">Produk</th>
                  <th className="px-2 py-2 text-center font-medium text-muted-foreground">Qty</th>
                  <th className="px-2 py-2 text-center font-medium text-muted-foreground">UOM</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">Harga</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">Diskon</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const basePrice = basePriceForRow(row)
                  const isCustom = basePrice !== null && row.unitPrice !== basePrice
                  return (
                    <tr key={row.id} className="border-t border-border">
                      <td className="px-2 py-1.5 text-foreground">{row.productName}</td>
                      <td className="px-2 py-1.5 text-center text-foreground">{row.qty}</td>
                      <td className="px-2 py-1.5 text-center text-foreground">{row.uomCode}</td>
                      <td className="px-2 py-1.5 text-right text-foreground">
                        {formatCurrency(row.unitPrice)}
                        {isCustom && <span className="ml-1 text-[10px] text-yellow-600">custom</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right text-foreground">{formatCurrency(row.discountAmount)}</td>
                      <td className="px-2 py-1.5 text-right font-medium text-foreground">{formatCurrency(row.subtotal)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>Rp {formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Total Diskon Item</span>
              <span>Rp {formatCurrency(totals.discountTotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Diskon Transaksi</span>
              <span>Rp {formatCurrency(totals.transactionDiscount)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 text-base font-semibold text-foreground">
              <span>Grand Total</span>
              <span>Rp {formatCurrency(totals.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{isCredit ? 'Uang Muka (DP)' : 'Jumlah Bayar'}</span>
              <span>Rp {formatCurrency(amountPaid)}</span>
            </div>
            {isCredit ? (
              <div className="flex justify-between font-semibold text-yellow-700">
                <span>Sisa Hutang</span>
                <span>Rp {formatCurrency(remainingDebt)}</span>
              </div>
            ) : (
              <div className="flex justify-between text-muted-foreground">
                <span>Kembali</span>
                <span>Rp {formatCurrency(change)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
          >
            Kembali
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Menyimpan...' : 'Konfirmasi & Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
