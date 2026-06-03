'use client'

import { create } from 'zustand'
import Big from 'big.js'

export interface SelectedCustomer {
  id: number
  name: string
}

export interface CartItem {
  productId: number
  productName: string
  uomId: number
  uomCode: string
  qty: number
  unitPrice: string
  priceTier: string
  discountAmount: string
  subtotal: string
}

interface CartStore {
  items: CartItem[]
  selectedCustomer: SelectedCustomer | null
  addItem: (item: Omit<CartItem, 'qty' | 'subtotal'>, qty?: number) => void
  updateQty: (productId: number, uomId: number, priceTier: string, qty: number) => void
  removeItem: (productId: number, uomId: number, priceTier: string) => void
  clearCart: () => void
  setSelectedCustomer: (customer: SelectedCustomer | null) => void
  grandTotal: (items: CartItem[]) => string
  subtotalItems: (items: CartItem[]) => string
  discountTotal: (items: CartItem[]) => string
  itemCount: (items: CartItem[]) => number
}

function calcSubtotal(unitPrice: string, qty: number, discountAmount: string): string {
  return new Big(unitPrice).times(qty).minus(discountAmount).round(0).toString()
}

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  selectedCustomer: null,

  addItem: (item, qty = 1) =>
    set((state) => {
      const existing = state.items.find(
        (i) => i.productId === item.productId && i.uomId === item.uomId && i.priceTier === item.priceTier
      )
      if (existing) {
        const newQty = existing.qty + qty
        return {
          items: state.items.map((i) =>
            i.productId === item.productId && i.uomId === item.uomId && i.priceTier === item.priceTier
              ? { ...i, qty: newQty, subtotal: calcSubtotal(i.unitPrice, newQty, i.discountAmount) }
              : i
          ),
        }
      }
      return {
        items: [
          ...state.items,
          { ...item, qty, subtotal: calcSubtotal(item.unitPrice, qty, item.discountAmount) },
        ],
      }
    }),

  updateQty: (productId, uomId, priceTier, qty) =>
    set((state) => {
      if (qty <= 0) {
        return {
          items: state.items.filter(
            (i) => !(i.productId === productId && i.uomId === uomId && i.priceTier === priceTier)
          ),
        }
      }
      return {
        items: state.items.map((i) =>
          i.productId === productId && i.uomId === uomId && i.priceTier === priceTier
            ? { ...i, qty, subtotal: calcSubtotal(i.unitPrice, qty, i.discountAmount) }
            : i
        ),
      }
    }),

  removeItem: (productId, uomId, priceTier) =>
    set((state) => ({
      items: state.items.filter(
        (i) => !(i.productId === productId && i.uomId === uomId && i.priceTier === priceTier)
      ),
    })),

  clearCart: () => set({ items: [], selectedCustomer: null }),

  setSelectedCustomer: (customer) => set({ selectedCustomer: customer }),

  grandTotal: (items) => calcGrandTotal(items),
  subtotalItems: (items) => calcSubtotalItems(items),
  discountTotal: (items) => calcDiscountTotal(items),
  itemCount: (items) => calcItemCount(items),
}))


export function calcGrandTotal(items: CartItem[]): string {
  if (items.length === 0) return '0'
  return items.reduce((acc, item) => acc.plus(item.subtotal), new Big(0)).round(0).toString()
}

export function calcSubtotalItems(items: CartItem[]): string {
  if (items.length === 0) return '0'
  return items.reduce((acc, item) => acc.plus(new Big(item.unitPrice).times(item.qty)), new Big(0)).round(0).toString()
}

export function calcDiscountTotal(items: CartItem[]): string {
  if (items.length === 0) return '0'
  return items.reduce((acc, item) => acc.plus(item.discountAmount), new Big(0)).round(0).toString()
}

export function calcItemCount(items: CartItem[]): number {
  return items.reduce((acc, item) => acc + item.qty, 0)
}

export function formatRupiah(value: string): string {
  const num = new Big(value).toNumber()
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num)
}

