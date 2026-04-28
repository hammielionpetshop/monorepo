import React from 'react'
import { X } from 'lucide-react'
import type { LocalTransaction, PaymentMethod } from '@/lib/db'
import { formatRupiah } from '@/lib/utils'
import type { CartItem, CartTotals } from '@petshop/shared'
import type { TransactionPayment } from '@petshop/shared'

interface TransactionDetailDialogProps {
  transaction: LocalTransaction | null
  paymentMethods: PaymentMethod[]
  onClose: () => void
}

export const TransactionDetailDialog: React.FC<TransactionDetailDialogProps> = ({
  transaction,
  paymentMethods,
  onClose,
}) => {
  if (!transaction) return null

  const payload = transaction.payload ?? {}
  const items: CartItem[] = payload.items ?? []
  const totals: CartTotals = payload.totals ?? {}
  const payments: TransactionPayment[] = payload.payments ?? []
  const amountPaid: number = payload.amountPaid ?? 0
  const change: number = payload.change ?? 0

  const taxAmount = (totals.grandTotal ?? 0) - ((totals.subtotal ?? 0) - (totals.discountTotal ?? 0))
  const showTax = taxAmount > 0.001

  const formatDateTime = (timestamp: number) => {
    if (!timestamp || isNaN(timestamp)) return '—'
    return new Date(timestamp).toLocaleString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const getMethodName = (paymentMethodId: number) =>
    paymentMethods.find((m: PaymentMethod) => m.id === paymentMethodId)?.name ?? '—'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[85vh] flex flex-col bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/5 shrink-0">
          <div>
            <h2 className="text-lg font-black text-white">{transaction.trxNumber}</h2>
            <p className="text-sm text-neutral-500 mt-0.5">{formatDateTime(transaction.createdAt)}</p>
            {transaction.customerName && (
              <p className="text-sm text-brand-400 mt-0.5">{transaction.customerName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">

          {/* Items Table */}
          <div>
            <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">Item Pembelian</h3>
            <div className="space-y-1">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] font-black text-neutral-600 uppercase tracking-widest">
                <span className="col-span-1">#</span>
                <span className="col-span-4">Produk</span>
                <span className="col-span-2 text-right">Qty</span>
                <span className="col-span-2 text-right">Harga</span>
                <span className="col-span-1 text-right">Disc</span>
                <span className="col-span-2 text-right">Subtotal</span>
              </div>
              {items.map((item: CartItem, idx: number) => (
                <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-white/5 rounded-lg text-sm">
                  <span className="col-span-1 text-neutral-600">{idx + 1}</span>
                  <span className="col-span-4 text-white font-medium leading-tight">{item.productName}</span>
                  <span className="col-span-2 text-right text-neutral-300">
                    {item.qty} <span className="text-neutral-600 text-xs">{item.uomCode}</span>
                  </span>
                  <span className="col-span-2 text-right text-neutral-300">{formatRupiah(item.unitPrice)}</span>
                  <span className="col-span-1 text-right text-red-400 text-xs">
                    {item.discountAmount > 0 ? `-${formatRupiah(item.discountAmount)}` : '—'}
                  </span>
                  <span className="col-span-2 text-right text-white font-bold">{formatRupiah(item.subtotal)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div>
            <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">Ringkasan</h3>
            <div className="bg-white/5 rounded-xl px-5 py-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Subtotal</span>
                <span className="text-white">{formatRupiah(totals.subtotal ?? 0)}</span>
              </div>
              {(totals.discountTotal ?? 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Diskon</span>
                  <span className="text-red-400">-{formatRupiah(totals.discountTotal)}</span>
                </div>
              )}
              {showTax && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Pajak</span>
                  <span className="text-white">{formatRupiah(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black pt-2 border-t border-white/10">
                <span className="text-white">Grand Total</span>
                <span className="text-emerald-400">{formatRupiah(totals.grandTotal ?? 0)}</span>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div>
            <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">Pembayaran</h3>
            <div className="bg-white/5 rounded-xl px-5 py-4 space-y-2">
              {payments.map((p: TransactionPayment, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-neutral-400">{getMethodName(p.paymentMethodId)}</span>
                  <span className="text-white">{formatRupiah(p.amount)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Total Dibayar</span>
                  <span className="text-white font-bold">{formatRupiah(amountPaid)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Kembalian</span>
                  <span className="text-white font-bold">{formatRupiah(change)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </>
  )
}
