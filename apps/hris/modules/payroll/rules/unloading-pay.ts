// Aturan murni Bayar Bongkaran (spec L8 §3.4–3.5; DRV-111, 116, 118, 119). Tanpa DB, tanpa React.

/** Masa "Uang belum saya terima" sejak diberi tahu dibayar (DRV-113, B2). */
export const NOT_RECEIVED_DAYS = 3;

export type OpenOverpayment = { id: number; remaining: number; createdAt: string };

/**
 * Bagian dikurangi lebih bayar orang itu yang belum tertagih, yang paling lama lebih dulu, sampai habis atau sampai bagiannya Rp0 (DRV-118).
 * Diterima = bagian − diperhitungkan. Tidak ada potongan lain (DRV-48).
 */
export function offsetShare(share: number, open: readonly OpenOverpayment[]): { offset: number; received: number; uses: { id: number; amount: number }[] } {
  let left = Math.max(0, share);
  const uses: { id: number; amount: number }[] = [];
  const ordered = [...open].filter((o) => o.remaining > 0).sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id - b.id));
  for (const o of ordered) {
    if (left <= 0) break;
    const take = Math.min(left, o.remaining);
    uses.push({ id: o.id, amount: take });
    left -= take;
  }
  const offset = uses.reduce((s, u) => s + u.amount, 0);
  return { offset, received: share - offset, uses };
}

/** Sisa lebih bayar = nominal − pemakaian yang masih berlaku (dihitung, tidak disimpan; DRV-118). */
export function overpaymentRemaining(amount: number, uses: readonly { amount: number; active: boolean }[]): number {
  return Math.max(0, amount - uses.filter((u) => u.active).reduce((s, u) => s + u.amount, 0));
}

/**
 * Satu fungsi "selisih bongkaran" per orang untuk koreksi sesudah dibayar (DRV-116). `credited` = uang yang sudah dihitung diterima orang itu
 * untuk laporan ini (bagian di pembayaran pertama + susulan dibayar − lebih bayar laporan ini yang masih dihitung utang). Susulan yang masih menunggu
 * dibatalkan lebih dulu dan diganti hasil ini (itulah "lebih dulu mengurangi susulan yang masih menunggu").
 * Plus: kurangi dulu sisa lebih bayar laporan yang sama, sisanya susulan. Minus: lebih bayar baru.
 */
export function correctionDelta(input: { next: number; credited: number; sameReportOpen: readonly OpenOverpayment[] }): {
  topUp: number; overpay: number; reduce: { id: number; amount: number }[];
} {
  const diff = input.next - input.credited;
  if (diff < 0) return { topUp: 0, overpay: -diff, reduce: [] };
  if (diff === 0) return { topUp: 0, overpay: 0, reduce: [] };
  const { uses, offset } = offsetShare(diff, input.sameReportOpen);
  return { topUp: diff - offset, overpay: 0, reduce: uses };
}

/** Pembayar bukan peserta dan bukan pembuat; Pemilik/GM boleh dengan tanda (DRV-111, B3). */
export function payerProblem(input: { fullAccess: boolean; isParticipant: boolean; isCreator: boolean }): { problem: string | null; ownerFlag: boolean } {
  const involved = input.isParticipant || input.isCreator;
  if (!involved) return { problem: null, ownerFlag: false };
  if (input.fullAccess) return { problem: null, ownerFlag: true };
  return { problem: input.isCreator ? 'Pembuat laporan tidak membayar laporannya sendiri.' : 'Peserta tidak membayar bongkaran yang ia ikuti.', ownerFlag: false };
}

export const TOP_UP_STATUS_LABELS: Record<string, string> = { WAITING: 'Menunggu bayar', PAID: 'Dibayar', CANCELLED: 'Dibatalkan' };
export const OVERPAY_STATUS_LABELS: Record<string, string> = { OPEN: 'Berjalan', COLLECT: 'Ditagih tunai', WRITTEN_OFF: 'Dihapus', SETTLED: 'Lunas' };
