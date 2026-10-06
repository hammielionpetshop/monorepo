'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatWIB } from '@petshop/shared'
import ReceiptPrint from '@/components/pos/receipt-print'
import type { CartItem } from '@/components/pos/cart-store'
import BulkSaleDeliveryNotePrint from '../bulk-sale/_components/bulk-sale-delivery-note-print'
import DeliveryNoteImageExport from '../bulk-sale/_components/delivery-note-image-export'
import { describeQzError, printDeliveryNoteViaQz, type DeliveryNoteData } from '@/lib/qz-print'
import { printReceipt, type ReceiptSource } from '@/lib/print-receipt'
import ReceiptImageExport from './receipt-image-export'
import { canCloneTransaction } from './clone-rules'
import { CopyPlus, ImageDown, Printer, Receipt, Truck } from 'lucide-react'

const FOOTER_BTN_SECONDARY =
  'w-full min-h-[38px] px-3 py-2 text-sm font-medium border border-border bg-background text-foreground rounded-lg hover:bg-accent disabled:opacity-50 transition-colors flex items-center justify-center gap-2'

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
  // Berat 1 unit UOM baris ini (gram); null bila produk belum punya data berat.
  weightGram: number | null
  /** Qty yang sudah diretur (retur aktif). */
  returnedQty?: number
}

interface TransactionPaymentDetail {
  id: number
  paymentMethodId: number
  paymentMethodName: string
  amount: number
}

interface TransactionEditEntry {
  id: number
  revision: number
  reason: string
  createdAt: string
  editedByName: string
}

interface TransactionDetail {
  id: number
  trxNumber: string
  branchId: number
  branchName: string
  // Kop struk milik cabang transaksinya sendiri — cetak ulang lintas cabang tidak
  // boleh memakai identitas cabang yang sedang membuka halaman.
  storeName: string | null
  storeAddress: string | null
  storePhone: string | null
  cashierId: number
  cashierName: string
  customerId: number | null
  customerName: string | null
  customerPhone: string | null
  customerAddress: string | null
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
  edits?: TransactionEditEntry[]
  returns?: TransactionReturnEntry[]
}

interface TransactionReturnEntry {
  id: string
  returnNumber: string
  createdAt: string
  reason: string
  totalRefundAmount: number
}

interface TransactionDetailModalProps {
  trxNumber: string
  onClose: () => void
  // Hanya halaman yang penggunanya boleh membuat Bulk Sale yang menyalakan tombol clone.
  canCloneToBulkSale?: boolean
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
  canCloneToBulkSale = false,
}: TransactionDetailModalProps) {
  const [detail, setDetail] = useState<TransactionDetail | null>(null)
  const returnTotal = detail?.returns?.reduce((sum, r) => sum + r.totalRefundAmount, 0) ?? 0
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

  function getReceiptSource(): ReceiptSource | null {
    if (!detail || !receiptCartItems) return null
    return {
      receiptNumber: detail.trxNumber,
      items: receiptCartItems,
      grandTotal: detail.payableAmount.toString(),
      amountPaid: detail.paidAmount.toString(),
      kembalian: detail.changeAmount.toString(),
      paymentMethodName: detail.payments.map((p) => p.paymentMethodName).join(' + ') || '-',
      storeName: detail.storeName ?? 'HAMMIELION',
      storeAddress: detail.storeAddress,
      storePhone: detail.storePhone,
      transactionDate: new Date(detail.createdAt),
      cashierName: detail.cashierName,
      discountAmount: detail.discountAmount > 0 ? detail.discountAmount.toString() : undefined,
      customerName: detail.customerName ?? undefined,
      isReprint: true,
      isVoided: detail.status === 'VOIDED',
      payments: detail.payments.map((p) => ({ name: p.paymentMethodName, amount: p.amount.toString() })),
    }
  }

  async function cetakStruk() {
    const source = getReceiptSource()
    if (!source) return
    await printReceipt(
      source,
      () => handlePrint('receipt'),
      { forceRetry: true }
    )
  }

  function getDeliveryNoteData(): DeliveryNoteData | null {
    if (!detail) return null
    return {
      transactionNumber: detail.trxNumber,
      transactionDate: formatDateTime(detail.createdAt),
      branchName: detail.branchName,
      customerName: detail.customerName ?? 'Umum',
      customerPhone: detail.customerPhone,
      customerAddress: detail.customerAddress,
      staffName: detail.cashierName,
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
        weightGram: item.weightGram,
      })),
    }
  }

  async function handlePrintSuratJalan() {
    const data = getDeliveryNoteData()
    if (!data) return
    setSjNote('Mengirim ke printer...')
    try {
      await printDeliveryNoteViaQz(data)
      setSjNote('Surat jalan terkirim ke printer (QZ Tray).')
    } catch (err) {
      console.error('[Surat Jalan] Cetak via QZ Tray gagal:', err)
      setSjNote(`Cetak QZ Tray gagal (${describeQzError(err)}) — memakai cetak browser.`)
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
                              {(item.returnedQty ?? 0) > 0 && (
                                <p className="text-xs font-medium text-destructive">diretur {item.returnedQty}</p>
                              )}
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

                    {returnTotal > 0 && (
                      <>
                        <div className="flex justify-between text-destructive font-medium">
                          <span>Retur</span>
                          <span>-{formatRupiahInt(returnTotal)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-foreground">
                          <span>Total Bersih</span>
                          <span>{formatRupiahInt(detail.payableAmount - returnTotal)}</span>
                        </div>
                      </>
                    )}

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

                {detail.returns && detail.returns.length > 0 && (
                  <div className="pt-4 border-t border-border">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Retur</h4>
                    <ul className="space-y-2">
                      {detail.returns.map((ret) => (
                        <li key={ret.id} className="text-sm bg-muted/20 border border-border/30 rounded-lg px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground">{ret.returnNumber}</span>
                            <span className="text-xs text-muted-foreground">{formatDateTime(ret.createdAt)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="text-muted-foreground">{ret.reason}</span>
                            <span className="font-medium text-destructive">-{formatRupiahInt(ret.totalRefundAmount)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Riwayat koreksi — nomor nota tetap, jadi jejaknya harus terlihat di sini */}
                {detail.edits && detail.edits.length > 0 && (
                  <div className="pt-4 border-t border-border">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Riwayat Koreksi
                    </h4>
                    <ul className="space-y-2">
                      {detail.edits.map((edit) => (
                        <li
                          key={edit.id}
                          className="text-sm bg-muted/20 border border-border/30 rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground">Revisi {edit.revision}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(edit.createdAt)} · {edit.editedByName}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-0.5">{edit.reason}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
          <div className="px-6 py-4 border-t border-border flex-shrink-0 space-y-3">
            {!loading && !error && detail && (
              <div className="grid gap-3 sm:grid-cols-2">
                <section className="rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <Truck className="h-3.5 w-3.5" aria-hidden />
                      {includePrice ? 'Nota' : 'Surat Jalan'}
                    </h4>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={includePrice}
                        onChange={(e) => setIncludePrice(e.target.checked)}
                        className="h-3.5 w-3.5"
                      />
                      Sertakan harga
                    </label>
                  </div>
                  <div className={`grid gap-2 ${detail.saleType === 'BULK' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {detail.saleType === 'BULK' && (
                      <button
                        type="button"
                        onClick={handlePrintSuratJalan}
                        className={FOOTER_BTN_SECONDARY}
                      >
                        <Printer className="h-4 w-4" aria-hidden />
                        Cetak
                      </button>
                    )}
                    <DeliveryNoteImageExport
                      data={getDeliveryNoteData()!}
                      customerName={detail.customerName}
                      label="Simpan PNG"
                      icon={<ImageDown className="h-4 w-4" aria-hidden />}
                      buttonClassName={FOOTER_BTN_SECONDARY}
                    />
                  </div>
                </section>

                <section className="rounded-lg border border-border bg-muted/20 p-3 space-y-2.5">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Receipt className="h-3.5 w-3.5" aria-hidden />
                    Struk
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { void cetakStruk() }}
                      className="w-full min-h-[38px] px-3 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                      <Printer className="h-4 w-4" aria-hidden />
                      Cetak
                    </button>
                    <ReceiptImageExport
                      data={getReceiptSource()!}
                      label="Simpan PNG"
                      icon={<ImageDown className="h-4 w-4" aria-hidden />}
                      buttonClassName={FOOTER_BTN_SECONDARY}
                    />
                  </div>
                </section>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              {!loading && !error && detail && canCloneToBulkSale && detail.items.length > 0 && canCloneTransaction(detail.status) ? (
                <Link
                  href={`/transactions/bulk-sale?fromTransaction=${encodeURIComponent(detail.trxNumber)}`}
                  title="Salin isi nota yang dibatalkan ini ke Bulk Sale untuk dibuat ulang"
                  className="px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors flex items-center gap-2"
                >
                  <CopyPlus className="h-4 w-4" aria-hidden />
                  Clone ke Bulk Sale
                </Link>
              ) : !loading && !error && detail && canCloneToBulkSale && detail.items.length > 0 && detail.status === 'COMPLETED' ? (
                <span className="px-3 py-2 text-xs text-muted-foreground">
                  Clone ke Bulk Sale tersedia setelah void nota ini diajukan
                </span>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition-colors"
              >
                Tutup
              </button>
            </div>
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
          customerPhone={detail.customerPhone}
          customerAddress={detail.customerAddress}
          staffName={detail.cashierName}
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
          storeName={detail.storeName ?? undefined}
          storeAddress={detail.storeAddress}
          storePhone={detail.storePhone}
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
