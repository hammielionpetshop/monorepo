// Uang dan laporan di toko (spec LT1 §13.2, §13.5, LT1b-3). Aturan murni: cara bayar, nominal, laporan kunjungan. Tanpa DB.
import Big from 'big.js';
import { REASON_MIN } from './trip';

export type PaymentMethod = 'NONE' | 'CASH' | 'TRANSFER' | 'PARTIAL' | 'TEMPO';
/** Pilihan awak saat ada tagihan (NONE dicatat sendiri bila tagihan 0). */
export type ChosenMethod = Exclude<PaymentMethod, 'NONE'>;

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  NONE: 'Tidak ada tagihan (lunas di kasir)', CASH: 'Lunas cash', TRANSFER: 'Lunas transfer', PARTIAL: 'Bayar sebagian (titip cash)', TEMPO: 'Tempo',
};
export const PAYMENT_HINTS: Record<ChosenMethod, string> = {
  CASH: 'Toko membayar seluruh tagihan dengan uang tunai.',
  TRANSFER: 'Toko mentransfer seluruh tagihan. Wajib foto bukti transfer.',
  PARTIAL: 'Toko membayar sebagian dengan uang tunai; sisanya ditagih kantor.',
  TEMPO: 'Tidak ada uang dan tidak ada bukti transfer; seluruh tagihan ditagih kantor.',
};
export const CHOSEN_METHODS: ChosenMethod[] = ['CASH', 'TRANSFER', 'PARTIAL', 'TEMPO'];

/** Tagihan kunjungan = jumlah sisa piutang nota-notanya (rupiah bulat, big.js). */
export function billOf(remaining: number[]): number {
  return Number(remaining.reduce((sum, n) => sum.plus(Math.max(0, Math.round(n))), new Big(0)));
}

/**
 * Cara bayar (§13.5 butir 2). Tagihan 0 → NONE apa pun pilihannya. Mengembalikan nominal diterima, atau pesan salah.
 * Bukti transfer diperiksa pemanggil (foto).
 */
export function cleanPayment(bill: number, method: string | null | undefined, partialAmount: number | null | undefined):
  { ok: true; method: PaymentMethod; received: number } | { ok: false; error: string } {
  if (!Number.isInteger(bill) || bill < 0) return { ok: false, error: 'Tagihan tidak valid.' };
  if (bill === 0) return { ok: true, method: 'NONE', received: 0 };
  if (!CHOSEN_METHODS.includes(method as ChosenMethod)) return { ok: false, error: 'Pilih cara bayar toko.' };
  const chosen = method as ChosenMethod;
  if (chosen === 'CASH' || chosen === 'TRANSFER') return { ok: true, method: chosen, received: bill };
  if (chosen === 'TEMPO') return { ok: true, method: chosen, received: 0 };
  if (partialAmount == null || !Number.isInteger(partialAmount) || partialAmount <= 0) return { ok: false, error: 'Isi uang yang diterima (rupiah).' };
  if (partialAmount >= bill) return { ok: false, error: 'Uang yang diterima sama dengan tagihan atau lebih: pilih Lunas cash.' };
  return { ok: true, method: chosen, received: partialAmount };
}

/** Sisa yang ditagih kantor sesudah kunjungan. */
export function leftToCollect(method: PaymentMethod, bill: number, received: number): number {
  return method === 'PARTIAL' || method === 'TEMPO' ? Number(new Big(bill).minus(received)) : 0;
}

export type ReportKind = 'WRONG_ITEM' | 'SHORT' | 'DAMAGED' | 'RETURN' | 'OTHER';
export const REPORT_KINDS: { code: ReportKind; label: string }[] = [
  { code: 'WRONG_ITEM', label: 'Barang salah' }, { code: 'SHORT', label: 'Barang kurang' }, { code: 'DAMAGED', label: 'Barang rusak' },
  { code: 'RETURN', label: 'Retur (dibawa pulang)' }, { code: 'OTHER', label: 'Kendala lain' },
];
export const REPORT_LABELS = Object.fromEntries(REPORT_KINDS.map((k) => [k.code, k.label])) as Record<ReportKind, string>;

/** Laporan kunjungan (§13.5 butir 4): jenis baku, catatan ≤ 300 (wajib ≥ 5 huruf untuk Kendala lain). */
export function cleanReport(kind: string | null | undefined, note: string | null | undefined):
  { ok: true; kind: ReportKind; note: string | null } | { ok: false; error: string } {
  if (!REPORT_KINDS.some((k) => k.code === kind)) return { ok: false, error: 'Pilih jenis laporan.' };
  const text = (note ?? '').replace(/\s+/g, ' ').trim();
  if (text.length > 300) return { ok: false, error: 'Catatan paling panjang 300 huruf.' };
  if (kind === 'OTHER' && text.length < REASON_MIN) return { ok: false, error: `Ceritakan kendalanya, paling sedikit ${REASON_MIN} huruf.` };
  return { ok: true, kind: kind as ReportKind, note: text || null };
}
