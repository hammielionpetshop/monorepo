'use client'

import { useState } from 'react'
import ProductSearchPanel from './product-search-panel'
import CartPanel from './cart-panel'
import MobileCartBar from './mobile-cart-bar'
import CheckoutModal from './checkout-modal'
import ShiftGateClient from './shift-gate-client'
import { useCartStore, calcGrandTotal, calcItemCount } from './cart-store'

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
  products: BootstrapProduct[]
  conversions: BootstrapConversion[]
  prices: BootstrapPrice[]
  uoms: BootstrapUom[]
  paymentMethods: BootstrapPaymentMethod[]
  shift: ActiveShift | null
  isCashierInShift: boolean
  cashierId: number
  cashierName: string
  branchId: number
  branchName: string
  userRole: string
}

export default function PosClient({
  products,
  prices,
  paymentMethods,
  shift,
  isCashierInShift,
  cashierId,
  cashierName,
  branchId,
  branchName,
  uoms,
  conversions,
  userRole,
}: PosClientProps) {
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const items = useCartStore((s) => s.items)
  const clearCart = useCartStore((s) => s.clearCart)
  const grandTotal = calcGrandTotal(items)
  const itemCount = calcItemCount(items)

  if (!shift || !isCashierInShift) {
    const isAssigned = shift
      ? (shift.assignedCashiers ?? []).includes(cashierId)
      : false
    return (
      <ShiftGateClient
        shift={shift}
        isAssigned={isAssigned}
        isCashierInShift={isCashierInShift}
        cashierId={cashierId}
        branchId={branchId}
        userRole={userRole}
      />
    )
  }


  return (
    <>
      <div className="flex flex-col md:flex-row flex-1 h-[calc(100vh-64px-44px)] overflow-hidden">
        {/* Product panel */}
        <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4">
          <ProductSearchPanel
            products={products}
            prices={prices}
            uoms={uoms}
            branchId={branchId}
          />
        </div>

        {/* Desktop cart panel */}
        <div className="hidden md:flex w-80 border-l border-border flex-col">
          <CartPanel onCheckout={() => setCheckoutOpen(true)} />
        </div>

        {/* Mobile cart bottom bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card z-10">
          <MobileCartBar
            itemCount={itemCount}
            grandTotal={grandTotal}
            onCheckout={() => setCheckoutOpen(true)}
          />
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
          onClose={() => setCheckoutOpen(false)}
          onSuccess={() => {
            clearCart()
            setCheckoutOpen(false)
          }}
        />
      )}

    </>
  )
}
