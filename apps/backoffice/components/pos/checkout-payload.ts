import { toManualDiscountInput } from '@/lib/manual-discount'
import { calcItemCount, type CartItem } from './cart-store'

/**
 * Baris nota yang dikirim layar bayar ke `POST /api/pos/transactions`. Baris berdiskon per
 * barang membawa `manualDiscount` — server memeriksanya ulang dengan mesin diskon manual.
 */
export function toCheckoutItems(items: CartItem[]) {
  return items.map((item) => ({
    productId: item.productId,
    productName: item.productName,
    uomId: item.uomId,
    uomCode: item.uomCode,
    qty: item.qty,
    unitPrice: Number(item.unitPrice),
    priceTier: item.priceTier,
    discountAmount: Number(item.discountAmount),
    subtotal: Number(item.subtotal),
    isOwnerOverride: false,
    ...(item.manualDiscount ? { manualDiscount: toManualDiscountInput(item.manualDiscount, Number(item.discountAmount)) } : {}),
    ...(item.grooming ? { grooming: item.grooming } : {}),
    ...(item.delivery ? { delivery: item.delivery } : {}),
  }))
}

/**
 * Total nota. Diskon total nota sudah tidak ada di layar kasir (diganti diskon per barang,
 * keputusan owner 2026-10-12) — `discountTotal` selalu 0, sehingga satu nota tidak mungkin
 * membawa dua macam diskon.
 */
export function checkoutTotals(items: CartItem[], grandTotal: number) {
  return { subtotal: grandTotal, discountTotal: 0, grandTotal, itemCount: calcItemCount(items) }
}
