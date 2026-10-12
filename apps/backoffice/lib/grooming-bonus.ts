import Big from 'big.js'

// Bonus jasa (keputusan owner, docs/work/specs/2026-10-11-jasa-grooming-design.md):
// groomer 10% dari harga jasa SESUDAH diskon; pengantar 50% dari ongkir sesudah diskon.
// Dibulatkan ke bawah ke rupiah penuh. Baris yang dibatalkan / diretur tidak dihitung.
export const GROOMER_BONUS_PERCENT = 10
export const COURIER_BONUS_PERCENT = 50

// Nilai bersih baris dihitung mesin nilai bersih baris — satu rumus untuk bonus, retur, laporan.
export { netLineAmount } from './line-net-value'

export function bonusOf(netAmount: number, percent: number): number {
  if (netAmount <= 0) return 0
  return Number(new Big(netAmount).times(percent).div(100).round(0, Big.roundDown).toString())
}
