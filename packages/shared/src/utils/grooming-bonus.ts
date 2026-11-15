// Rumus bonus jasa grooming dan ongkir (POS apps/backoffice/lib/grooming-bonus.ts + line-net-value.ts), dipakai
// HRIS Buku Bonus (spec HRIS L4d §2, PRD 01 §4) supaya bonus di slip = bonus di laporan Grooming kasir.
// Hitungan memakai BigInt (pasti, tanpa pecahan), hasilnya sama dengan versi big.js di backoffice; kasus tesnya sama.

/** Nilai bersih satu baris nota sesudah diskon total nota (bila ada) dibagi sebanding, dibulatkan ke bawah. */
export function netLineAmount(lineTotal: number, payableAmount: number, linesTotal: number): number {
  if (lineTotal <= 0 || linesTotal <= 0) return 0
  if (payableAmount >= linesTotal) return lineTotal
  if (payableAmount <= 0) return 0
  return Number((BigInt(lineTotal) * BigInt(payableAmount)) / BigInt(linesTotal))
}

/** Bonus = persen × nilai bersih, dibulatkan ke bawah ke rupiah penuh. */
export function bonusOf(netAmount: number, percent: number): number {
  if (netAmount <= 0 || percent <= 0) return 0
  return Number((BigInt(netAmount) * BigInt(percent)) / BigInt(100))
}
