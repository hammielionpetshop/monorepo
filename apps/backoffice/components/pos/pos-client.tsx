'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProductSearchPanel from './product-search-panel'
import CartPanel from './cart-panel'
import MobileCartBar from './mobile-cart-bar'
import CheckoutModal from './checkout-modal'
import ShiftGateClient from './shift-gate-client'
import ExpenseDialog from './expense-dialog'
import CustomerSearchDialog from './customer-search-dialog'
import { useCartStore, calcGrandTotal, calcItemCount, formatRupiah } from './cart-store'

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
  userRole: string
  totalExpenses: number
}

export default function PosClient({
  paymentMethods,
  shift,
  isCashierInShift,
  cashierId,
  cashierName,
  branchId,
  branchName,
  uoms,
  userRole,
  totalExpenses,
}: PosClientProps) {
  const router = useRouter()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [productRefreshKey, setProductRefreshKey] = useState(0)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const items = useCartStore((s) => s.items)
  const clearCart = useCartStore((s) => s.clearCart)
  const selectedCustomer = useCartStore((s) => s.selectedCustomer)
  const grandTotal = calcGrandTotal(items)
  const itemCount = calcItemCount(items)

  // F10 → buka checkout dari mana saja
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F10' && items.length > 0 && !checkoutOpen) {
        e.preventDefault()
        setCheckoutOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [items.length, checkoutOpen])

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
      <div className="flex flex-col h-[calc(100vh-64px-44px)] flex-1 overflow-hidden">
        {/* Shift info bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border text-sm flex-shrink-0 print:hidden">
          <span className="text-muted-foreground flex items-center gap-1.5">
            Shift #{shift.shiftNumber} · Expense:
            <span className="text-foreground font-medium">{formatRupiah(String(totalExpenses ?? 0))}</span>
          </span>
          <div className="flex items-center gap-2">
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
            />
          </div>

          {/* Mobile cart bottom bar */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card z-10">
            <MobileCartBar
              itemCount={itemCount}
              grandTotal={grandTotal}
              onCheckout={() => setCheckoutOpen(true)}
              onOpenCustomerSearch={() => setCustomerSearchOpen(true)}
              selectedCustomerName={selectedCustomer?.name ?? null}
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
          customerId={selectedCustomer?.id ?? null}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={() => {
            clearCart()
            setCheckoutOpen(false)
            setProductRefreshKey((k) => k + 1)
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
    </>
  )
}
