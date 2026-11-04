import Big from 'big.js'
import type { CartItem } from './cart-store'
import { priceForTier } from '@/app/pos/(authenticated)/grooming/_components/types'
import { ONGKIR_KIND, freeShippingQty } from '@/lib/ongkir'
import type { PosOngkirProduct } from '@/app/api/pos/delivery-options/route'

// Langkah Pengiriman tab Kasir: jawaban kasir sebelum layar bayar. Kurir cabang selalu membawa
// pengantar + baris ongkir (bayar atau Gratis ongkir); truk Gudang selalu gratis ongkir (penanda HRIS).
export type DeliveryChoice =
  | { method: 'PICKUP' }
  | { method: 'TRUCK' }
  | { method: 'BRANCH_COURIER'; courierId: number; courierName: string; amount: number; free: boolean }

/** Tombol cepat nilai ongkir (ongkir standar Rp 10.000, ada juga 8 rb / 15 rb). */
export const ONGKIR_QUICK_AMOUNTS = [8000, 10000, 15000]

export const ONGKIR_LINE_NAME = 'Ongkos kirim'

/** Pesan bila nilai ongkir tidak sah (null = sah). Ongkir = harga per qty × qty, jadi harus kelipatannya. */
export function ongkirAmountProblem(amount: number, unitPrice: number): string | null {
  if (!Number.isInteger(amount) || amount <= 0) return 'Isi nilai ongkir (rupiah), atau centang Gratis ongkir.'
  if (!(unitPrice > 0)) return 'Harga ongkos kirim di cabang ini belum diisi. Minta Owner/GM mengisinya di Manajemen Harga.'
  if (amount % unitPrice !== 0) return `Nilai ongkir harus kelipatan Rp ${unitPrice.toLocaleString('id-ID')}.`
  return null
}

/** Harga ongkir per qty untuk golongan pelanggan nota ini (jatuh ke RETAIL bila golongannya kosong). */
export function ongkirUnitPrice(ongkir: PosOngkirProduct, tier: string): { tier: string; price: number } | null {
  const priced = priceForTier(ongkir.tierPrices, tier)
  return priced ? { tier: priced.tier, price: Number(priced.price) } : null
}

/**
 * Baris ongkir untuk nota kasir dari pilihan kurir cabang. Pengantar & potongan Gratis ongkir dipasang
 * layar bayar lewat mesin ongkir (sama seperti sebelumnya), jadi baris ini dikirim tanpa `delivery`.
 * Gratis ongkir: qty = nilai standar ÷ harga (mesin ongkir memotongnya penuh di layar bayar).
 */
export function buildOngkirCartItem(
  ongkir: PosOngkirProduct,
  tier: string,
  choice: Extract<DeliveryChoice, { method: 'BRANCH_COURIER' }>,
  freeShippingValue: number,
): CartItem {
  const priced = ongkirUnitPrice(ongkir, tier)
  if (!priced) throw new Error('Harga ongkos kirim di cabang ini belum diisi')
  const qty = choice.free ? freeShippingQty(freeShippingValue, priced.price) : choice.amount / priced.price
  if (qty == null || !Number.isInteger(qty) || qty <= 0) throw new Error('Nilai ongkir tidak cocok dengan harga ongkos kirim')
  return {
    productId: ongkir.productId,
    productName: ONGKIR_LINE_NAME,
    uomId: ongkir.uomId,
    uomCode: ongkir.uomCode,
    qty,
    unitPrice: String(priced.price),
    priceTier: priced.tier,
    discountAmount: '0',
    subtotal: new Big(priced.price).times(qty).round(0).toString(),
    tierPrices: ongkir.tierPrices,
    productKind: ONGKIR_KIND,
  }
}
