import Big from 'big.js'
import { toManualDiscountInput } from '@/lib/manual-discount'
import { calcItemCount, type CartItem } from './cart-store'
import { promoLineSubtotal } from './promo-cart'
import type { PromoLineResult } from '@/lib/promo/promo-engine'

/**
 * Baris nota yang dikirim layar bayar ke `POST /api/pos/transactions`. Baris berdiskon per
 * barang membawa `manualDiscount`; baris berpromo membawa `promo { promoId, amount }` — server
 * memeriksanya ulang (diskon manual dengan mesin diskon, promo dengan mesin promo).
 *
 * Satu baris tidak boleh membawa dua-duanya: bila promo berlaku, promo menang dan diskon manual
 * baris itu dilepas (server menolak baris berpromo yang juga berdiskon manual). `awards` selaras
 * urutan `items` — elemen null = baris tanpa promo.
 */
interface CheckoutItem {
  productId: number
  productName: string
  uomId: number
  uomCode: string
  qty: number
  unitPrice: number
  priceTier: string
  discountAmount: number
  subtotal: number
  isOwnerOverride: boolean
  manualDiscount?: ReturnType<typeof toManualDiscountInput>
  promo?: { promoId: number; amount: number; gift?: boolean }
  grooming?: CartItem['grooming']
  delivery?: CartItem['delivery']
}

export function toCheckoutItems(items: CartItem[], awards: (PromoLineResult | null)[] = []): CheckoutItem[] {
  return items.map((item, index) => {
    // Baris hadiah gratis (P4d): harga penuh, potongan penuh, tagihan 0, bertanda `promo.gift`.
    // Server menghitung ulang hadiah dari baris berbayar lalu mencocokkan baris ini.
    if (item.promoGift) {
      const amount = Number(item.discountAmount)
      return {
        productId: item.productId,
        productName: item.productName,
        uomId: item.uomId,
        uomCode: item.uomCode,
        qty: item.qty,
        unitPrice: Number(item.unitPrice),
        priceTier: item.priceTier,
        discountAmount: amount,
        subtotal: 0,
        isOwnerOverride: false,
        promo: { promoId: item.promoGift.promoId, amount, gift: true },
      }
    }
    const award = awards[index] ?? null
    const line: CheckoutItem = {
      productId: item.productId,
      productName: item.productName,
      uomId: item.uomId,
      uomCode: item.uomCode,
      qty: item.qty,
      unitPrice: Number(item.unitPrice),
      priceTier: item.priceTier,
      discountAmount: award ? award.amount : Number(item.discountAmount),
      subtotal: award ? Number(promoLineSubtotal(item, award)) : Number(item.subtotal),
      isOwnerOverride: false,
    }
    // Promo menang: baris berpromo tidak membawa diskon manual (server menolak gabungannya).
    if (award) line.promo = { promoId: award.promoId, amount: award.amount }
    else if (item.manualDiscount) line.manualDiscount = toManualDiscountInput(item.manualDiscount, Number(item.discountAmount))
    if (item.grooming) line.grooming = item.grooming
    if (item.delivery) line.delivery = item.delivery
    return line
  })
}

/**
 * Total nota. Diskon total nota sudah tidak ada di layar kasir (diganti diskon per barang,
 * keputusan owner 2026-10-12) — `discountTotal` selalu 0, sehingga satu nota tidak mungkin
 * membawa dua macam diskon. `grandTotal` yang dikirim pemanggil sudah termasuk potongan promo.
 */
export function checkoutTotals(items: CartItem[], grandTotal: number) {
  return { subtotal: grandTotal, discountTotal: 0, grandTotal, itemCount: calcItemCount(items) }
}

/** Total keranjang sesudah promo (dipakai layar bayar sebagai dasar sebelum gratis ongkir). */
export function checkoutGrandTotal(items: CartItem[], awards: (PromoLineResult | null)[]): number {
  return items.reduce((acc, item, index) => acc.plus(promoLineSubtotal(item, awards[index] ?? null)), new Big(0)).round(0).toNumber()
}
