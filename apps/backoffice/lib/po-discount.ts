import Big from 'big.js'

/**
 * Diskon PO (rupiah) atas total PO (keputusan owner 2026-11-25). Diskon dibaca sebagai persentase
 * dari total kotor: setiap barang dipotong dengan persentase yang sama, sehingga modal ikut turun
 * dan hutang dari barang yang datang sebagian/rusak ikut proporsional.
 * Contoh: total kotor 1.000.000, diskon 200.000 → setiap harga × 0,8.
 */

/** Faktor pengali harga sesudah diskon: (kotor − diskon) / kotor. Tanpa diskon/total = 1. */
export function poDiscountFactor(gross: number, discount: number): Big {
  if (!(discount > 0) || !(gross > 0)) return new Big(1)
  if (discount >= gross) return new Big(0)
  return new Big(gross).minus(discount).div(gross)
}

/** Nilai rupiah sesudah diskon PO, dibulatkan ke rupiah terdekat. */
export function applyPoDiscount(amount: number | Big, gross: number, discount: number): number {
  return Number(new Big(amount).times(poDiscountFactor(gross, discount)).round(0))
}

/** Total PO yang disimpan di `purchase_orders.total_amount` = kotor − diskon (tidak minus). */
export function poNetTotal(gross: number, discount: number): number {
  return Math.max(0, gross - Math.max(0, discount))
}

/**
 * Faktor diskon dari header PO yang tersimpan (total_amount = kotor − diskon), untuk tempat
 * yang tidak memuat seluruh baris PO (mis. harga klaim retur supplier).
 */
export function poDiscountFactorFromHeader(po: { totalAmount: number; discountAmount: number }): Big {
  return poDiscountFactor(po.totalAmount + po.discountAmount, po.discountAmount)
}

/** Pesan galat bila diskon tidak sah terhadap total kotor; null = sah. */
export function poDiscountError(discount: number, gross: number): string | null {
  if (!Number.isInteger(discount) || discount < 0) return 'Diskon harus berupa angka rupiah, tidak boleh minus'
  if (discount > 0 && discount >= gross) return 'Diskon harus lebih kecil dari total PO'
  return null
}
