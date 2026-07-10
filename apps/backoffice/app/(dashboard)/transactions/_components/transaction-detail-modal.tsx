'use client'

import { useState, useEffect } from 'react'
import { formatWIB } from '@petshop/shared'
import ReceiptPrint from '@/components/pos/receipt-print'
import type { CartItem } from '@/components/pos/cart-store'
import BulkSaleDeliveryNotePrint from '../bulk-sale/_components/bulk-sale-delivery-note-print'
import { printDeliveryNoteViaQz, type DeliveryNoteData } from '@/lib/qz-print'

interface TransactionItemDetail {
  id: number
  productId: number
  productName: string
  productSku: string
  uomId: number
  uomCode: string
  qty: number
  unitPrice: number
  totalPrice: number
  discountAmount: number
  priceTier: string
}

interface TransactionPaymentDetail {
  id: number
  paymentMethodId: number
  paymentMethodName: string
  amount: number
}

interface TransactionDetail {
  id: number
  trxNumber: string
  branchId: number
  branchName: string
  cashierId: number
  cashierName: string
  customerId: number | null
  customerName: string | null
  totalAmount: number
  discountAmount: number
  payableAmount: number
  paidAmount: number
  changeAmount: number
  status: string
  saleType: string
  createdAt: string
  items: TransactionItemDetail[]
  payments: TransactionPaymentDetail[]
}

interface TransactionDetailModalProps {
  trxNumber: string
  onClose: () => void
}

function formatRupiahInt(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

function formatDateTime(dateStr: string): string {
  return formatWIB(dateStr, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  VOIDED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  PENDING_VOID: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
}

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Selesai',
  VOIDED: 'Dibatalkan (Void)',
  PENDING_VOID: 'Menunggu Void',
}

export default function TransactionDetailModal({
  trxNumber,
  onClose,
}: TransactionDetailModalProps) {
  const [detail, setDetail] = useState<TransactionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Kendalikan komponen cetak mana yang ter-mount saat window.print(): struk & surat
  // jalan sama-sama pakai CSS `body * { hidden }`, jadi keduanya TIDAK boleh mounted
  // bersamaan (kalau tidak, cetak struk ikut memunculkan surat jalan).
  const [printMode, setPrintMode] = useState<'receipt' | 'delivery-note' | null>(null)
  // Surat jalan boleh dicetak dengan atau tanpa harga (default tanpa harga).
  const [includePrice, setIncludePrice] = useState(false)
  const [sjNote, setSjNote] = useState<string | null>(null)

  function handlePrint(mode: 'receipt' | 'delivery-note') {
    setPrintMode(mode)
    setTimeout(() => window.print(), 50)
  }

  // Cetak surat jalan: coba raw ESC/P via QZ Tray (dot-matrix, mulus). Bila QZ Tray
  // tak terpasang/aktif, fallback ke cetak browser (window.print) agar tetap bisa cetak.
  async function handlePrintSuratJalan() {
    if (!detail) return
    const data: DeliveryNoteData = {
      transactionNumber: detail.trxNumber,
      transactionDate: formatDateTime(detail.createdAt),
      branchName: detail.branchName,
      customerName: detail.customerName ?? 'Umum',
      isVoided: detail.status === 'VOIDED',
      withPrice: includePrice,
      grandTotal: detail.payableAmount,
      items: detail.items.map((item) => ({
        id: item.id,
        productCode: item.productSku,
        productName: item.productName,
        uomCode: item.uomCode,
        qty: item.qty,
        unitPrice: item.unitPrice,
        subtotal: item.totalPrice,
      })),
    }
    setSjNote('Mengirim ke printer...')
    try {
      await printDeliveryNoteViaQz(data)
      setSjNote('Surat jalan terkirim ke printer (QZ Tray).')
    } catch {
      setSjNote('QZ Tray tak terdeteksi — memakai cetak browser.')
      handlePrint('delivery-note')
    }
  }

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!sjNote) return
    const id = setTimeout(() => setSjNote(null), 4000)
    return () => clearTimeout(id)
  }, [sjNote])

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/bo/transactions/${trxNumber}/detail`)
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Gagal mengambil detail transaksi')
          return
        }
        setDetail(data)
      } catch (err) {
        console.error('Fetch transaction detail error:', err)
        setError('Terjadi kesalahan jaringan')
      } finally {
        setLoading(false)
      }
    }

    fetchDetail()
  }, [trxNumber])

  const receiptCartItems: CartItem[] | null = detail
    ? detail.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        uomId: item.uomId,
        uomCode: item.uomCode,
        qty: item.qty,
        unitPrice: item.unitPrice.toString(),
        priceTier: item.priceTier,
        discountAmount: item.discountAmount.toString(),
        subtotal: item.totalPrice.toString(),
        tierPrices: { [item.priceTier]: item.unitPrice.toString() },
      }))
    : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        role="presentation"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 overflow-y-auto print:hidden"
        role="dialog"
        aria-modal="true"
        aria-label={`Detail Transaksi ${trxNumber}`}
      >
        <div className="bg-card text-card-foreground border border-border rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] transition-all transform duration-300 scale-100">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                Detail Transaksi: <span className="font-mono text-primary">{trxNumber}</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
              aria-label="Tutup Detail Transaksi"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {loading && (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Memuat detail transaksi...</p>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                {error}
              </div>
            )}

            {!loading && !error && detail && (
              <>
                {/* Meta Information Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 border border-border/50 rounded-xl p-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between sm:justify-start gap-4">
                      <span className="text-muted-foreground w-24">Tanggal:</span>
                      <span className="font-medium text-foreground">{formatDateTime(detail.createdAt)}</span>
                    </div>
                    <div className="flex justify-between sm:justify-start gap-4">
                      <span className="text-muted-foreground w-24">Cabang:</span>
                      <span className="font-medium text-foreground">{detail.branchName}</span>
                    </div>
                    <div className="flex justify-between sm:justify-start gap-4">
                      <span className="text-muted-foreground w-24">Kasir:</span>
                      <span className="font-medium text-foreground">{detail.cashierName}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between sm:justify-start gap-4">
                      <span className="text-muted-foreground w-24">Customer:</span>
                      <span className="font-medium text-foreground">
                        {detail.customerName ?? <span className="italic text-muted-foreground">Umum</span>}
                      </span>
                    </div>
                    <div className="flex justify-between sm:justify-start gap-4">
                      <span className="text-muted-foreground w-24">Status:</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[detail.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {STATUS_LABEL[detail.status] ?? detail.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    Daftar Item ({detail.items.length})
                  </h3>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border text-left">
                          <th className="px-4 py-2 font-medium text-muted-foreground">Produk</th>
                          <th className="px-4 py-2 font-medium text-muted-foreground text-center">Qty</th>
                          <th className="px-4 py-2 font-medium text-muted-foreground text-right">Harga Satuan</th>
                          <th className="px-4 py-2 font-medium text-muted-foreground text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {detail.items.map((item) => (
                          <tr key={item.id} className="hover:bg-muted/20">
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground leading-tight">{item.productName}</p>
                              {item.discountAmount > 0 && (
                                <p className="text-xs text-destructive font-medium mt-0.5">
                                  Potongan: {formatRupiahInt(item.discountAmount)}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap text-muted-foreground">
                              {item.qty} {item.uomCode}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap text-muted-foreground">
                              {formatRupiahInt(item.unitPrice)}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap font-medium text-foreground">
                              {formatRupiahInt(item.totalPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4 border-t border-border">
                  {/* Payment Methods Info */}
                  <div className="w-full sm:w-1/2 space-y-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Informasi Pembayaran
                    </h4>
                    {detail.payments.map((payment) => (
                      <div key={payment.id} className="flex justify-between items-center text-sm bg-muted/20 border border-border/30 rounded-lg px-3 py-2">
                        <span className="text-muted-foreground font-medium">{payment.paymentMethodName}</span>
                        <span className="font-semibold text-foreground">{formatRupiahInt(payment.amount)}</span>
                      </div>
                    ))}
                    {detail.payments.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Tidak ada metode pembayaran tercatat</p>
                    )}
                  </div>

                  {/* Pricing Calculations */}
                  <div className="w-full sm:w-1/2 space-y-2 text-sm">
                    {detail.discountAmount > 0 && (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Subtotal kotor</span>
                          <span>{formatRupiahInt(detail.totalAmount)}</span>
                        </div>
                        <div className="flex justify-between text-destructive font-medium">
                          <span>Diskon Transaksi</span>
                          <span>-{formatRupiahInt(detail.discountAmount)}</span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between font-bold text-base text-foreground pt-2 border-t border-border/50">
                      <span>Total Bayar</span>
                      <span className={detail.status === 'VOIDED' ? 'line-through text-muted-foreground' : ''}>
                        {formatRupiahInt(detail.payableAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between text-muted-foreground">
                      <span>Diterima</span>
                      <span>{formatRupiahInt(detail.paidAmount)}</span>
                    </div>

                    <div className="flex justify-between text-muted-foreground">
                      <span>Kembalian</span>
                      <span>{formatRupiahInt(detail.changeAmount)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Status cetak surat jalan */}
          {sjNote && (
            <div className="px-6 pt-2 text-xs text-muted-foreground" role="status" aria-live="polite">
              {sjNote}
            </div>
          )}

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-border flex-shrink-0 flex flex-col sm:flex-row gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors"
            >
              Tutup
            </button>
            {!loading && !error && detail && detail.saleType === 'BULK' && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground sm:mr-auto cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includePrice}
                  onChange={(e) => setIncludePrice(e.target.checked)}
                  className="h-4 w-4"
                />
                Sertakan harga
              </label>
            )}
            {!loading && !error && detail && detail.saleType === 'BULK' && (
              <button
                type="button"
                onClick={handlePrintSuratJalan}
                className="px-4 py-2 text-sm font-semibold border border-primary/40 text-primary rounded-lg hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
              >
                📦 Cetak Surat Jalan
              </button>
            )}
            {!loading && !error && detail && (
              <button
                type="button"
                onClick={() => handlePrint('receipt')}
                className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                🖨️ Cetak Struk
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hidden Surat Jalan — hanya untuk transaksi BULK, mount hanya saat mode-nya aktif */}
      {!loading && !error && detail && printMode === 'delivery-note' && (
        <BulkSaleDeliveryNotePrint
          transactionNumber={detail.trxNumber}
          transactionDate={formatDateTime(detail.createdAt)}
          branchName={detail.branchName}
          customerName={detail.customerName ?? 'Umum'}
          isVoided={detail.status === 'VOIDED'}
          withPrice={includePrice}
          grandTotal={detail.payableAmount}
          items={detail.items.map((item) => ({
            id: item.id,
            productCode: item.productSku,
            productName: item.productName,
            uomCode: item.uomCode,
            qty: item.qty,
            unitPrice: item.unitPrice,
            subtotal: item.totalPrice,
          }))}
        />
      )}

      {/* Hidden Receipt component for browser printing */}
      {!loading && !error && detail && receiptCartItems && printMode === 'receipt' && (
        <ReceiptPrint
          receiptNumber={detail.trxNumber}
          items={receiptCartItems}
          grandTotal={detail.payableAmount.toString()}
          amountPaid={detail.paidAmount.toString()}
          kembalian={detail.changeAmount.toString()}
          paymentMethodName={detail.payments.map((p) => p.paymentMethodName).join(' + ') || '-'}
          branchName={detail.branchName}
          transactionDate={new Date(detail.createdAt)}
          cashierName={detail.cashierName}
          discountAmount={detail.discountAmount > 0 ? detail.discountAmount.toString() : undefined}
          customerName={detail.customerName ?? undefined}
          isReprint={true}
          isVoided={detail.status === 'VOIDED'}
          payments={detail.payments.map(p => ({ name: p.paymentMethodName, amount: p.amount.toString() }))}
        />
      )}
    </>
  )
}
