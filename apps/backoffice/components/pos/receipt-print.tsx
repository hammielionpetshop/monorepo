'use client'

import Big from 'big.js'
import type { CartItem } from './cart-store'

interface ReceiptPrintProps {
  receiptNumber: string
  items: CartItem[]
  grandTotal: string
  amountPaid: string
  kembalian: string
  paymentMethodName: string
  branchName: string
  transactionDate: Date
  cashierName: string
  discountAmount?: string
  customerName?: string
  isReprint?: boolean
  isVoided?: boolean
}

function formatRupiahSimple(value: string): string {
  const num = new Big(value).toNumber()
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num)
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export default function ReceiptPrint({
  receiptNumber,
  items,
  grandTotal,
  amountPaid,
  kembalian,
  paymentMethodName,
  branchName,
  transactionDate,
  cashierName,
  discountAmount,
  customerName,
  isReprint = false,
  isVoided = false,
}: ReceiptPrintProps) {
  const hasDiscount = discountAmount && new Big(discountAmount).gt(0)
  const subtotal = hasDiscount
    ? new Big(grandTotal).plus(new Big(discountAmount!)).toString()
    : null

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              .print-container-receipt,
              .print-container-receipt * {
                visibility: visible !important;
              }
              .print-container-receipt {
                position: fixed !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                background: white !important;
                color: black !important;
              }
            }
          `,
        }}
      />
      <div
        className="hidden print:block fixed inset-0 z-[9999] bg-white text-black print-container-receipt"
        style={{ fontFamily: 'monospace', fontSize: '12px', padding: '8px' }}
      >
        <div style={{ maxWidth: '300px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <p style={{ fontWeight: 'bold', fontSize: '14px' }}>HAMMIELION</p>
            <p>{branchName}</p>
            <p style={{ borderTop: '1px dashed #000', marginTop: '4px', paddingTop: '4px' }}>
              STRUK PENJUALAN
            </p>
            {isVoided && (
              <p style={{ fontWeight: 'bold', border: '1px solid #000', padding: '2px 8px', marginTop: '4px', display: 'inline-block', backgroundColor: '#eee' }}>
                *** VOID / BATAL ***
              </p>
            )}
            {isReprint && !isVoided && (
              <p style={{ fontWeight: 'bold', border: '1px solid #000', padding: '2px 8px', marginTop: '4px', display: 'inline-block' }}>
                *** COPY / CETAK ULANG ***
              </p>
            )}
          </div>

        {/* Info */}
        <div style={{ marginBottom: '8px' }}>
          <p>No: {receiptNumber}</p>
          <p>Tgl: {formatDate(transactionDate)}</p>
          <p>Kasir: {cashierName}</p>
          {customerName && <p>Pelanggan: {customerName}</p>}
        </div>


        <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', paddingTop: '4px', paddingBottom: '4px', marginBottom: '8px' }}>
          {/* Items */}
          {items.map((item) => (
            <div key={item.productId} style={{ marginBottom: '4px' }}>
              <p style={{ fontWeight: 'bold' }}>{item.productName}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {item.qty} {item.uomCode} x {formatRupiahSimple(item.unitPrice)}
                </span>
                <span>{formatRupiahSimple(item.subtotal)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div style={{ marginBottom: '8px' }}>
          {hasDiscount && subtotal && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal</span>
                <span>{formatRupiahSimple(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Diskon</span>
                <span>-{formatRupiahSimple(discountAmount!)}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>TOTAL</span>
            <span>{formatRupiahSimple(grandTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{paymentMethodName}</span>
            <span>{formatRupiahSimple(amountPaid)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Kembalian</span>
            <span>{formatRupiahSimple(kembalian)}</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', borderTop: '1px dashed #000', paddingTop: '8px' }}>
          <p>Terima kasih telah berbelanja!</p>
          <p>Barang yang sudah dibeli</p>
          <p>tidak dapat dikembalikan.</p>
        </div>
      </div>
    </div>
  </>
)
}

