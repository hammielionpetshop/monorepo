import Big from 'big.js'
import type { CartItem } from './cart-store'

// Bentuk item detail PO Internal dari `GET /api/pos/internal-po/[id]` yang dipakai
// saat memproses ke keranjang. Sengaja hanya field yang dibutuhkan builder.
export interface InternalPoItem {
  id: number
  productId: number
  productName: string | null
  uomId: number
  uomCode: string | null
  qtyRequested: number
  currentQty: number | null
  retailPrice: number | null
  tierPrices: Record<string, number>
  insufficient: boolean
}

// Tiga cara menentukan qty saat ada item ber-stok kurang (dialog konfirmasi drawer).
export const internalPoQtyStrategies = {
  // Pakai qty yang diminta apa adanya (oversell bila stok kurang).
  requested: (it: InternalPoItem) => it.qtyRequested,
  // Turunkan item yang kurang ke stok yang tersedia; item yang kosong jadi 0.
  available: (it: InternalPoItem) =>
    it.insufficient ? Math.max(it.currentQty ?? 0, 0) : it.qtyRequested,
  // Buang item yang kurang/kosong; sisanya qty diminta.
  dropShort: (it: InternalPoItem) => (it.insufficient ? 0 : it.qtyRequested),
} as const

/**
 * Ubah item PO Internal jadi item keranjang POS.
 *
 * Harga: SELURUH tier produk+satuan dibawa di `tierPrices` supaya "Ubah Tier" tetap jalan
 * setelah impor. Tier default = RETAIL bila ada, kalau tidak tier pertama yang tersedia
 * (atau RETAIL @ 0 bila produk tak punya harga sama sekali — kasir menyesuaikan manual).
 * Item dengan qty <= 0 (mis. di-drop strategi `available`/`dropShort`) tidak ikut.
 */
export function buildInternalPoCartItems(
  items: InternalPoItem[],
  qtyFor: (it: InternalPoItem) => number,
): CartItem[] {
  const out: CartItem[] = []
  for (const it of items) {
    const qty = qtyFor(it)
    if (qty <= 0) continue

    const tierPrices: Record<string, string> = {}
    for (const [tier, value] of Object.entries(it.tierPrices ?? {})) tierPrices[tier] = String(value)

    const priceTier = tierPrices.RETAIL != null ? 'RETAIL' : (Object.keys(tierPrices)[0] ?? 'RETAIL')
    const price = tierPrices[priceTier] ?? '0'

    out.push({
      productId: it.productId,
      productName: it.productName ?? `Produk #${it.productId}`,
      uomId: it.uomId,
      uomCode: it.uomCode ?? '',
      qty,
      unitPrice: price,
      priceTier,
      discountAmount: '0',
      subtotal: new Big(price).times(qty).round(0).toString(),
      tierPrices,
    })
  }
  return out
}
