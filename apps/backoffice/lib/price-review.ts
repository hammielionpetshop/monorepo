import Big from 'big.js'

/**
 * Pemeriksaan Harga Jual (spec 2026-11-10 periksa harga jual, Tahap 2): usulan harga jual saat
 * modal naik. Fungsi murni — dipakai layar dan server.
 */

/** Usulan dibulatkan ke atas ke kelipatan ini (keputusan owner: tanpa ekor 5 perak). */
export const PRICE_ROUNDING = 100

export function roundUpPrice(value: Big.BigSource): number {
  return new Big(value).div(PRICE_ROUNDING).round(0, Big.roundUp).times(PRICE_ROUNDING).toNumber()
}

/**
 * Usulan harga jual satu baris harga (satuan × jenis harga): persentase untung lama dipertahankan
 * (harga × modal baru ÷ modal lama), dibulatkan ke atas ke 100, dan tidak pernah di bawah modal
 * satuan itu. Tanpa modal lama (tidak ada pembanding): harga lama, dinaikkan ke modal bila kurang.
 */
export function suggestSellPrice(input: {
  price: number
  oldCostPerBase: number | null
  newCostPerBase: number
  unitCost: number
}): number {
  const { price, oldCostPerBase, newCostPerBase, unitCost } = input
  const floor = unitCost > 0 ? roundUpPrice(unitCost) : 0
  if (!oldCostPerBase || oldCostPerBase <= 0) return Math.max(price, floor)
  const kept = roundUpPrice(new Big(price).times(newCostPerBase).div(oldCostPerBase))
  return Math.max(kept, floor)
}

/** Kenaikan modal dalam persen (1 desimal); null bila tidak ada modal lama. */
export function costChangePercent(oldCostPerBase: number | null, newCostPerBase: number): number | null {
  if (!oldCostPerBase || oldCostPerBase <= 0) return null
  return new Big(newCostPerBase).minus(oldCostPerBase).div(oldCostPerBase).times(100).round(1, Big.roundHalfUp).toNumber()
}
