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
  // Peta tier harga yang tersedia untuk produk+UOM ini (tierType -> harga).
  // Dipakai untuk ganti tier harga secara massal tanpa fetch ulang.
  tierPrices: Record<string, string>
}

interface CartStore {
  items: CartItem[]
  selectedCustomer: SelectedCustomer | null
  addItem: (item: Omit<CartItem, 'qty' | 'subtotal'>, qty?: number) => void
  updateQty: (productId: number, uomId: number, priceTier: string, qty: number) => void
  removeItem: (productId: number, uomId: number, priceTier: string) => void
  setBulkTier: (tier: string) => void
  clearCart: () => void
  restoreCart: (items: CartItem[]) => void
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

  // Kunci baris = produk + UOM + tier, sama seperti updateQty/removeItem/setBulkTier.
  // Satu produk boleh muncul lebih dari sekali dengan satuan berbeda dalam satu nota —
  // mis. Jagung TT 4.5 kg dijual sebagai 4 × KG + 1 × GRAM(500gr), karena satuan
  // terkecilnya memang bukan pecahan bebas. Sebelumnya pencocokan hanya lewat productId
  // dan UOM baris lama ditimpa, sehingga baris kedua mustahil dibuat.
  addItem: (item, qty = 1) =>
    set((state) => {
      const idx = state.items.findIndex(
        (i) => i.productId === item.productId && i.uomId === item.uomId && i.priceTier === item.priceTier
      )
      if (idx >= 0) {
        // Produk+UOM+tier yang sama ditambahkan lagi → qty diakumulasi.
        // Diskon baris yang sudah ada dipertahankan, jangan tertimpa nilai default.
        return {
          items: state.items.map((i, n) =>
            n === idx
              ? { ...i, qty: i.qty + qty, subtotal: calcSubtotal(i.unitPrice, i.qty + qty, i.discountAmount) }
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

  setBulkTier: (tier) =>
    set((state) => {
      // Re-price tiap item ke tier terpilih bila tier tsb tersedia untuknya.
      // Item yang tidak punya tier ini dibiarkan apa adanya.
      const remapped = state.items.map((i) => {
        const price = i.tierPrices?.[tier]
        if (price == null) return i
        return {
          ...i,
          priceTier: tier,
          unitPrice: price,
          subtotal: calcSubtotal(price, i.qty, i.discountAmount),
        }
      })

      // Gabungkan item yang jadi identik (produk+UOM+tier sama) dengan menjumlahkan qty.
      const merged: CartItem[] = []
      for (const it of remapped) {
        const ex = merged.find(
          (m) => m.productId === it.productId && m.uomId === it.uomId && m.priceTier === it.priceTier
        )
        if (ex) {
          ex.qty += it.qty
          ex.subtotal = calcSubtotal(ex.unitPrice, ex.qty, ex.discountAmount)
        } else {
          merged.push({ ...it })
        }
      }

      return { items: merged }
    }),

  clearCart: () => set({ items: [], selectedCustomer: null }),

  restoreCart: (items) => set({ items, selectedCustomer: null }),

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

