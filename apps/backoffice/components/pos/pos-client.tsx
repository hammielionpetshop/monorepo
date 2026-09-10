'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ProductSearchPanel from './product-search-panel'
import CartPanel from './cart-panel'
import MobileCartBar from './mobile-cart-bar'
import CheckoutModal from './checkout-modal'
import ShiftGateClient from './shift-gate-client'
import ExpenseDialog from './expense-dialog'
import CustomerSearchDialog from './customer-search-dialog'
import HoldBillDialog from './hold-bill-dialog'
import OpenBillsDrawer from './open-bills-drawer'
import InternalPoDrawer from './internal-po-drawer'
import CartPreviewModal from './cart-preview-modal'
import { useCartStore, calcGrandTotal, calcItemCount, formatRupiah } from './cart-store'
import { isShortcutLocked } from './shortcut-lock'
import { useConnection } from '@/components/connection/connection-provider'
import { warmUpQz } from '@/lib/print-receipt'
import type { ReceiptStoreInfo } from '@/lib/receipt-info'

export interface BootstrapProduct {
  id: number
  sku: string | null
  barcode: string | null
  name: string
  categoryId: number | null
  brandId: number | null
  baseUomId: number
  weightGram: string | null
  stock: string
}

export interface PosProduct extends BootstrapProduct {
  prices: BootstrapPrice[]
  conversions: BootstrapConversion[]
}

export interface BootstrapPrice {
  id: number
  productId: number
  branchId: number
  uomId: number
  tierType: string
  price: string
}

export interface BootstrapConversion {
  id: number
  productId: number
  uomId: number
  ratio: string | null
  weightGram: string | null
  uomCode: string | null
}

export interface BootstrapUom {
  id: number
  code: string
  name: string
  isBase: boolean
}

export interface BootstrapPaymentMethod {
  id: number
  name: string
  type: string
}

export interface ActiveShift {
  id: number
  branchId: number
  shiftNumber: number
  status: string
  openedAt: Date | string
  openingCash: number
  assignedCashiers: number[]
  joinedCashierIds: number[]
  targetEndTime?: Date | string | null
}

interface PosClientProps {
  uoms: BootstrapUom[]
  paymentMethods: BootstrapPaymentMethod[]
  shift: ActiveShift | null
  isCashierInShift: boolean
  cashierId: number
  cashierName: string
  branchId: number
  branchName: string
  storeInfo: ReceiptStoreInfo
  userRole: string
  totalExpenses: number
  canProcessInternalPo: boolean
}

export default function PosClient({
  paymentMethods,
  shift,
  isCashierInShift,
  cashierId,
  cashierName,
  branchId,
  branchName,
  storeInfo,
  uoms,
  userRole,
  totalExpenses,
  canProcessInternalPo,
}: PosClientProps) {
  const router = useRouter()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [productRefreshKey, setProductRefreshKey] = useState(0)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [holdOpen, setHoldOpen] = useState(false)
  const [openBillsOpen, setOpenBillsOpen] = useState(false)
  const [internalPoOpen, setInternalPoOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [openBillCount, setOpenBillCount] = useState(0)
  const [internalPoCount, setInternalPoCount] = useState(0)
  const [flashMsg, setFlashMsg] = useState('')
  const items = useCartStore((s) => s.items)
  const clearCart = useCartStore((s) => s.clearCart)
  const restoreCart = useCartStore((s) => s.restoreCart)
  const importInternalPo = useCartStore((s) => s.importInternalPo)
  const selectedCustomer = useCartStore((s) => s.selectedCustomer)
  const sourceIbt = useCartStore((s) => s.sourceIbt)
  const grandTotal = calcGrandTotal(items)
  const itemCount = calcItemCount(items)
  const { isOnline } = useConnection()

  const refreshOpenBillCount = useCallback(async () => {
    try {
      const res = await fetch('/api/pos/open-bills')
      if (!res.ok) return
      const data = (await res.json()) as unknown[]
      setOpenBillCount(Array.isArray(data) ? data.length : 0)
    } catch {
      // abaikan — badge count bersifat informatif
    }
  }, [])

  const refreshInternalPoCount = useCallback(async () => {
    if (!canProcessInternalPo) return
    try {
      const res = await fetch('/api/pos/internal-po')
      if (!res.ok) return
      const data = (await res.json()) as unknown[]
      setInternalPoCount(Array.isArray(data) ? data.length : 0)
    } catch {
      // abaikan — badge count bersifat informatif
    }
  }, [canProcessInternalPo])

  useEffect(() => {
    refreshOpenBillCount()
    refreshInternalPoCount()
  }, [refreshOpenBillCount, refreshInternalPoCount])

  useEffect(() => {
    if (!flashMsg) return
    const t = setTimeout(() => setFlashMsg(''), 5000)
    return () => clearTimeout(t)
  }, [flashMsg])

  // Tanyakan ketersediaan QZ Tray sekali di awal. Tanpa ini, cetak pertama di stasiun
  // tanpa QZ menanggung ongkos timeout koneksi — dan struk dicetak tiap transaksi.
  useEffect(() => {
    warmUpQz()
  }, [])

  // Hotkey: F7 preview keranjang, F8 tahan, F9 pilih pelanggan, F10 bayar.
  // F8/F10 ikut terkunci saat koneksi putus supaya tidak membuka dialog yang
  // ujungnya pasti gagal menyimpan — sejalan dengan tombolnya di panel keranjang.
  // F7 tidak menyentuh server sama sekali, jadi tetap boleh saat koneksi putus.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isShortcutLocked()) return
      if (e.key === 'F7' && items.length > 0) {
        e.preventDefault()
        setPreviewOpen(true)
      } else if (e.key === 'F8' && items.length > 0 && isOnline) {
        e.preventDefault()
        setHoldOpen(true)
      } else if (e.key === 'F9') {
        e.preventDefault()
        setCustomerSearchOpen(true)
      } else if (e.key === 'F10' && items.length > 0 && isOnline) {
        e.preventDefault()
        setCheckoutOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [items.length, isOnline])

  if (!shift || !isCashierInShift) {
    return (
      <ShiftGateClient
        shift={shift}
        cashierId={cashierId}
        branchId={branchId}
        branchName={branchName}
        userRole={userRole}
      />
    )
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Shift info bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border text-sm flex-shrink-0 print:hidden">
          <span className="text-muted-foreground flex items-center gap-1.5">
            Shift #{shift.shiftNumber} · Expense:
            <span className="text-foreground font-medium">{formatRupiah(String(totalExpenses ?? 0))}</span>
          </span>
          <div className="flex items-center gap-2">
          {canProcessInternalPo && (
            <button
              type="button"
              onClick={() => setInternalPoOpen(true)}
              className="min-h-[44px] px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium text-foreground transition-colors flex items-center gap-1.5 active:scale-[0.98]"
              aria-label={`PO Internal masuk${internalPoCount > 0 ? ` (${internalPoCount})` : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              <span>PO Internal</span>
              {internalPoCount > 0 && (
                <span className="ml-0.5 min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold tabular-nums">
                  {internalPoCount}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpenBillsOpen(true)}
            className="min-h-[44px] px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium text-foreground transition-colors flex items-center gap-1.5 active:scale-[0.98]"
            aria-label={`Daftar tunggu transaksi ditahan${openBillCount > 0 ? ` (${openBillCount})` : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span>Daftar Tunggu</span>
            {openBillCount > 0 && (
              <span className="ml-0.5 min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold tabular-nums">
                {openBillCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              if (
                items.length > 0 &&
                !confirm(
                  'Anda memiliki transaksi aktif di keranjang. Menutup shift akan membatalkan transaksi ini. Lanjutkan?'
                )
              ) {
                return
              }
              router.push('/pos/settlement')
            }}
            className="min-h-[44px] px-3 py-2 rounded-lg border border-destructive/50 bg-destructive/10 hover:bg-destructive/20 text-sm font-medium text-destructive transition-colors"
            aria-label="Tutup shift"
          >
            Tutup Shift
          </button>
          <button
            type="button"
            onClick={() => setExpenseOpen(true)}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium text-foreground transition-colors flex items-center gap-1.5 active:scale-[0.98]"
            aria-label="Catat pengeluaran"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4 text-destructive flex-shrink-0"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <span>+ Expense</span>
          </button>
          </div>
        </div>

        {sourceIbt && (
          <div className="flex items-center justify-between gap-2 px-4 py-1.5 bg-primary/10 border-b border-primary/20 text-xs text-primary flex-shrink-0 print:hidden">
            <span className="truncate">
              Keranjang dari PO Internal <span className="font-mono font-semibold">{sourceIbt.ibtNumber}</span> — harga retail, sesuaikan bila perlu.
            </span>
            <button
              type="button"
              onClick={() => {
                if (confirm('Batalkan pemrosesan PO Internal ini? Keranjang akan dikosongkan.')) clearCart()
              }}
              className="flex-shrink-0 font-medium underline hover:no-underline"
            >
              Batalkan
            </button>
          </div>
        )}

        {flashMsg && (
          <div
            role="status"
            aria-live="polite"
            className="px-4 py-1.5 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-900 text-xs text-green-800 dark:text-green-400 flex-shrink-0 print:hidden"
          >
            {flashMsg}
          </div>
        )}

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Product panel */}
          <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4">
            <ProductSearchPanel
              uoms={uoms}
              branchId={branchId}
              refreshKey={productRefreshKey}
            />
          </div>

          {/* Desktop cart panel */}
          <div className="hidden md:flex w-80 border-l border-border flex-col">
            <CartPanel
              onCheckout={() => setCheckoutOpen(true)}
              onOpenCustomerSearch={() => setCustomerSearchOpen(true)}
              onHold={() => setHoldOpen(true)}
              onPreview={() => setPreviewOpen(true)}
            />
          </div>

          {/* Mobile cart bottom bar */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card z-10">
            <MobileCartBar
              itemCount={itemCount}
              grandTotal={grandTotal}
              onCheckout={() => setCheckoutOpen(true)}
              onOpenCustomerSearch={() => setCustomerSearchOpen(true)}
              onHold={() => setHoldOpen(true)}
              onPreview={() => setPreviewOpen(true)}
              selectedCustomerName={selectedCustomer?.name ?? null}
              selectedCustomerTier={selectedCustomer?.tierType ?? null}
            />
          </div>
        </div>
      </div>

      {checkoutOpen && (
        <CheckoutModal
          items={items}
          grandTotal={grandTotal}
          paymentMethods={paymentMethods}
          shiftId={shift.id}
          cashierId={cashierId}
          cashierName={cashierName}
          branchId={branchId}
          branchName={branchName}
          storeInfo={storeInfo}
          customerId={selectedCustomer?.id ?? null}
          customerName={selectedCustomer?.name ?? null}
          sourceIbtId={sourceIbt?.id ?? null}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={() => {
            const wasInternalPo = sourceIbt !== null
            clearCart()
            setCheckoutOpen(false)
            setProductRefreshKey((k) => k + 1)
            if (wasInternalPo) refreshInternalPoCount()
          }}
        />
      )}

      {expenseOpen && (
        <ExpenseDialog
          shiftId={shift.id}
          cashierId={cashierId}
          onClose={() => setExpenseOpen(false)}
          onSuccess={() => {
            setExpenseOpen(false)
            router.refresh()
          }}
        />
      )}

      {customerSearchOpen && (
        <CustomerSearchDialog
          onClose={() => setCustomerSearchOpen(false)}
        />
      )}

      {holdOpen && (
        <HoldBillDialog
          shiftId={shift.id}
          branchId={branchId}
          items={items}
          grandTotal={grandTotal}
          selectedCustomer={selectedCustomer}
          onClose={() => setHoldOpen(false)}
          onSuccess={() => {
            clearCart()
            setHoldOpen(false)
            refreshOpenBillCount()
          }}
        />
      )}

      {previewOpen && (
        <CartPreviewModal
          storeName={storeInfo.storeName}
          storePhone={storeInfo.storePhone}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {openBillsOpen && (
        <OpenBillsDrawer
          hasActiveCart={items.length > 0}
          onClose={() => {
            setOpenBillsOpen(false)
            refreshOpenBillCount()
          }}
          onResume={(restored, customer) => restoreCart(restored, customer)}
        />
      )}

      {internalPoOpen && (
        <InternalPoDrawer
          hasActiveCart={items.length > 0}
          onClose={() => {
            setInternalPoOpen(false)
            refreshInternalPoCount()
          }}
          onImported={(imported, customer, ibt) => {
            importInternalPo(imported, customer, ibt)
            setInternalPoOpen(false)
            setProductRefreshKey((k) => k + 1)
            refreshInternalPoCount()
            setFlashMsg('Semua produk saat ini menggunakan harga retail, silakan sesuaikan.')
          }}
          onCancelled={() => refreshInternalPoCount()}
        />
      )}
    </>
  )
}
