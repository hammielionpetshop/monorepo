'use client'

import { create } from 'zustand'
import Big from 'big.js'
import { FALLBACK_TIER } from './price-tier'

export interface SelectedCustomer {
  id: number
  name: string
  // Tier harga pelanggan (customers.default_tier_type). Menentukan harga yang
  // dipakai POS; produk yang tidak punya harga di tier ini jatuh ke RETAIL.
  tierType: string
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

/**
 * Hargai ulang seluruh isi keranjang ke satu tier. Item yang tidak punya tier
 * tersebut dibiarkan apa adanya — sejalan dengan keputusan "produk tidak ditolak
 * hanya karena tier pelanggannya belum diisi". Baris yang jadi identik
 * (produk+satuan+tier sama) digabung supaya keranjang tidak punya dua baris kembar.
 */
function repriceItems(items: CartItem[], tier: string): CartItem[] {
  const merged: CartItem[] = []
  for (const item of items) {
    const price = item.tierPrices?.[tier]
    const next: CartItem = price == null
      ? item
      : {
          ...item,
          priceTier: tier,
          unitPrice: price,
          subtotal: calcSubtotal(price, item.qty, item.discountAmount),
        }

    const existing = merged.find(
      (m) => m.productId === next.productId && m.uomId === next.uomId && m.priceTier === next.priceTier
    )
    if (existing) {
      existing.qty += next.qty
      existing.subtotal = calcSubtotal(existing.unitPrice, existing.qty, existing.discountAmount)
    } else {
      merged.push({ ...next })
    }
  }
  return merged
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

  setBulkTier: (tier) => set((state) => ({ items: repriceItems(state.items, tier) })),

  clearCart: () => set({ items: [], selectedCustomer: null }),

  restoreCart: (items) => set({ items, selectedCustomer: null }),

  // Harga mengikuti pelanggan. Memilih pelanggan RESELLER menghargai ulang seluruh
  // keranjang ke RESELLER; melepas pelanggan mengembalikannya ke RETAIL. Satu aturan
  // dua arah — supaya tidak ada keranjang yang tertinggal di harga pelanggan sebelumnya.
  // Penyetelan manual lewat "Ubah Tier" tetap bisa dilakukan sesudahnya.
  setSelectedCustomer: (customer) =>
    set((state) => ({
      selectedCustomer: customer,
      items: repriceItems(state.items, customer?.tierType || FALLBACK_TIER),
    })),

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

