import Big from 'big.js'

// ── MESIN NILAI BERSIH BARIS ────────────────────────────────────────────────────────────────
// Satu-satunya rumus "berapa yang benar-benar dibayar untuk baris nota ini"
// (docs/work/specs/2026-10-12-promo-otomatis-design.md). Dipakai bonus jasa, dan mulai P1c
// uang kembali retur serta laporan — supaya tidak ada rumus kembar.
//
// Bahan bakunya tiga angka yang sudah tersimpan di nota:
// - nilai baris (`transaction_items.total_price`) — SUDAH dikurangi potongan baris itu sendiri
//   (diskon per barang, promo, gratis ongkir);
// - jumlah semua baris nota (`transactions.total_amount`);
// - yang harus dibayar (`transactions.payable_amount`) — lebih kecil dari jumlah baris hanya
//   pada nota lama yang memakai diskon TOTAL nota.
//
// Diskon total nota tidak disimpan per baris, jadi dibagi sebanding nilai baris. Pembulatan
// selalu ke bawah: jumlah semua bagian tidak pernah melebihi yang dibayar.

/** Nilai bersih satu baris sesudah diskon total nota (bila ada) dibagi sebanding. */
export function netLineAmount(lineTotal: number, payableAmount: number, linesTotal: number): number {
  if (lineTotal <= 0 || linesTotal <= 0) return 0
  if (payableAmount >= linesTotal) return lineTotal
  if (payableAmount <= 0) return 0
  return Number(new Big(lineTotal).times(payableAmount).div(linesTotal).round(0, Big.roundDown).toString())
}

export interface NetRefundParams {
  /** Nilai bersih baris (hasil `netLineAmount`). */
  netAmount: number
  /** Qty baris di nota. */
  qty: number
  /** Qty yang diretur kali ini. */
  returnQty: number
  /** Qty baris ini yang sudah diretur sebelumnya (retur yang masih berlaku). */
  returnedQtyBefore?: number
  /** Uang yang sudah dikembalikan untuk baris ini oleh retur sebelumnya. */
  refundedBefore?: number
}

/**
 * Uang kembali untuk sebagian qty satu baris = bagian sebanding dari nilai bersihnya, dibulatkan
 * ke bawah. Retur yang menghabiskan sisa qty mengembalikan seluruh sisa nilai, sehingga total
 * semua retur satu baris tepat sama dengan nilai bersihnya — tidak lebih, tidak kurang.
 */
export function netRefundAmount(params: NetRefundParams): number {
  const { netAmount, qty, returnQty } = params
  const returnedQtyBefore = params.returnedQtyBefore ?? 0
  const refundedBefore = params.refundedBefore ?? 0
  if (netAmount <= 0 || qty <= 0 || returnQty <= 0) return 0
  const remaining = Math.max(0, netAmount - refundedBefore)
  if (returnedQtyBefore + returnQty >= qty) return remaining
  const share = Number(new Big(netAmount).times(returnQty).div(qty).round(0, Big.roundDown).toString())
  return Math.min(share, remaining)
}
