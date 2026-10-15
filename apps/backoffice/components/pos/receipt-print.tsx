'use client'

import Big from 'big.js'
import { ongkirReceiptRows } from '@/lib/ongkir'
import { toReceiptItem, type ReceiptItemPromo } from '@/lib/receipt-data'
import { lineDiscountRows, lineGrossAmount, receiptNoteDiscount, receiptSavings, savingsText } from '@/lib/receipt-lines'
import { formatWIB } from '@petshop/shared'
import type { CartItem } from './cart-store'

interface ReceiptPrintProps {
  receiptNumber: string
  items: CartItem[]
  /** Potongan promo per baris (selaras urutan `items`) — P2e. Absen = tidak ada promo. */
  promos?: (ReceiptItemPromo | null)[]
  grandTotal: string
  amountPaid: string
  kembalian: string
  paymentMethodName: string
  branchName: string
  storeName?: string
  storeAddress?: string | null
  storePhone?: string | null
  transactionDate: Date
  cashierName: string
  discountAmount?: string
  customerName?: string
  isReprint?: boolean
  isVoided?: boolean
  payments?: { name: string; amount: string }[]
  /**
   * Skala cetak, 1 = ukuran penuh. Kotak "Scale" di dialog cetak browser tidak bisa
   * disetel dari halaman, jadi struknya sendiri yang dikecilkan supaya kasir tidak
   * perlu mengubah dialog tiap kali mencetak.
   */
  printScale?: number
}

const DEFAULT_PRINT_SCALE = 0.7

/** Skala di luar rentang wajar (atau NaN dari pemanggil yang longgar) tidak boleh membuat struk mustahil dibaca. */
function normalizePrintScale(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_PRINT_SCALE
  return Math.min(1, Math.max(0.3, value))
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
  return formatWIB(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function ReceiptPrint({
  receiptNumber,
  items,
  promos,
  grandTotal,
  amountPaid,
  kembalian,
  paymentMethodName,
  branchName,
  storeName = 'HAMMIELION',
  storeAddress,
  storePhone,
  transactionDate,
  cashierName,
  discountAmount,
  customerName,
  isReprint = false,
  isVoided = false,
  payments,
  printScale,
}: ReceiptPrintProps) {
  const scale = normalizePrintScale(printScale)
  // Angka baris, potongan per barang, diskon nota & kalimat hemat dihitung mesin baris struk —
  // sama persis dengan printer kasir dan gambar struk.
  const lines = items.map((item, index) => toReceiptItem(item, promos?.[index]))
  const savings = receiptSavings(lines)
  const noteDiscount = receiptNoteDiscount({
    items: lines,
    discountAmount: Number(discountAmount ?? 0) || 0,
    grandTotal: Number(grandTotal) || 0,
  })
  const subtotal = noteDiscount > 0 ? new Big(grandTotal).plus(noteDiscount).toString() : null

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page {
              size: 80mm auto;
              margin: 3mm;
            }
            @media print {
              body * {
                visibility: hidden !important;
              }
              .print-container-receipt,
              .print-container-receipt * {
                visibility: visible !important;
              }
              .print-container-receipt {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                background: white !important;
                color: black !important;
                padding: 0 !important;
                /* Lebar sengaja dibiarkan 100%: isinya mengecil apa adanya, tata letak dan
                   pemenggalan barisnya persis seperti ukuran penuh. Melebarkan kontainer
                   supaya isi tetap memenuhi kertas membuat baris mengalir ulang — kolomnya
                   bergeser dan strukya tidak lagi simetri.

                   zoom, bukan transform: scale(), karena zoom ikut mengubah tata letak
                   sehingga pemenggalan halaman pada struk panjang tetap benar; transform
                   hanya menggeser gambarnya dan isi di luar halaman pertama terpotong. */
                zoom: ${scale};
              }
            }
          `,
        }}
      />
      <div
        className="hidden print:block fixed top-0 left-0 w-full z-[9999] bg-white text-black print-container-receipt"
        style={{
          fontFamily: '"Arial Narrow", "Liberation Sans Narrow", Arial, Helvetica, sans-serif',
          fontSize: '17px',
          lineHeight: 1.25,
          letterSpacing: '-0.4px',
          padding: '0 4mm',
        }}
      >
        <div>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <p style={{ fontWeight: 'bold', fontSize: '21px' }}>{storeName}</p>
            {storeAddress && <p>{storeAddress}</p>}
            {storePhone && <p>Telp: {storePhone}</p>}
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
          {items.map((item, index) => {
            const line = lines[index]
            if (line.ongkir) {
              const rows = ongkirReceiptRows(line)
              return (
                <div key={`ongkir_${index}`} style={{ marginBottom: '4px' }}>
                  {rows.map((row) => (
                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontWeight: row.amount < 0 ? 'bold' : undefined }}>
                      <span>{row.label}</span>
                      <span>{row.amount < 0 ? '-' : ''}{formatRupiahSimple(String(Math.abs(row.amount)))}</span>
                    </div>
                  ))}
                </div>
              )
            }
            return (
              <div key={`${item.productId}_${index}`} style={{ marginBottom: '4px' }}>
                <p style={{ fontWeight: 'bold' }}>{item.productName}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    {item.qty} {item.uomCode} x {formatRupiahSimple(item.unitPrice)}
                  </span>
                  <span>{formatRupiahSimple(String(lineGrossAmount(line)))}</span>
                </div>
                {lineDiscountRows(line).map((row) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>&nbsp;&nbsp;{row.label}</span>
                    <span>-{formatRupiahSimple(String(Math.abs(row.amount)))}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Totals */}
        <div style={{ marginBottom: '8px' }}>
          {subtotal && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal</span>
                <span>{formatRupiahSimple(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Diskon</span>
                <span>-{formatRupiahSimple(String(noteDiscount))}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>TOTAL</span>
            <span>{formatRupiahSimple(grandTotal)}</span>
          </div>
          {savings.total > 0 && <p style={{ fontWeight: 'bold' }}>{savingsText(savings)}</p>}
          {payments && payments.length > 0 ? (
            payments.map((p, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{p.name}</span>
                <span>{formatRupiahSimple(p.amount)}</span>
              </div>
            ))
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{paymentMethodName}</span>
              <span>{formatRupiahSimple(amountPaid)}</span>
            </div>
          )}
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

