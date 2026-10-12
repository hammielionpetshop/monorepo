import Big from 'big.js'

// Bonus jasa (keputusan owner, docs/work/specs/2026-10-11-jasa-grooming-design.md):
// groomer 10% dari harga jasa SESUDAH diskon; pengantar 50% dari ongkir sesudah diskon.
// Dibulatkan ke bawah ke rupiah penuh. Baris yang dibatalkan / diretur tidak dihitung.
export const GROOMER_BONUS_PERCENT = 10
export const COURIER_BONUS_PERCENT = 50

/**
 * Nilai bersih satu baris nota sesudah diskon NOTA dibagi sebanding ke semua baris.
 *
 * Diskon nota tidak disimpan per baris, jadi bagiannya dihitung dari perbandingan
 * "yang harus dibayar" terhadap jumlah semua baris: bersih = baris × dibayar / jumlah baris.
 * Tanpa diskon nota (dibayar = jumlah baris) hasilnya sama dengan nilai baris itu sendiri.
 */
export function netLineAmount(lineTotal: number, payableAmount: number, linesTotal: number): number {
  if (lineTotal <= 0 || linesTotal <= 0) return 0
  if (payableAmount >= linesTotal) return lineTotal
  if (payableAmount <= 0) return 0
  return Number(new Big(lineTotal).times(payableAmount).div(linesTotal).round(0, Big.roundDown).toString())
}

export function bonusOf(netAmount: number, percent: number): number {
  if (netAmount <= 0) return 0
  return Number(new Big(netAmount).times(percent).div(100).round(0, Big.roundDown).toString())
}
