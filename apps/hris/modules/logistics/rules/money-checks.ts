// Terima Uang (spec LT1 §16.1, LT4a). Aturan murni: bagian uang, pembagian per nota, pemeriksaan, tanda pelunasan POS. Tanpa DB.
import Big from 'big.js';
import { REASON_MIN } from './trip';
import type { PaymentMethod } from './store-payments';

export type MoneyKind = 'CASH' | 'TRANSFER';
export const MONEY_KIND_LABELS: Record<MoneyKind, string> = { CASH: 'Tunai', TRANSFER: 'Transfer' };

/** Bagian uang yang diperiksa: Lunas cash / Bayar sebagian = tunai, Lunas transfer = transfer. Tempo / tanpa tagihan tidak diperiksa. */
export function moneyKindOf(method: PaymentMethod): MoneyKind | null {
  if (method === 'CASH' || method === 'PARTIAL') return 'CASH';
  if (method === 'TRANSFER') return 'TRANSFER';
  return null;
}

/** Hari tunggu sebelum belum diperiksa / belum masuk POS ditandai merah (§16.1 butir 7, 8). */
export const CHECK_RED_DAYS = 3;
/** Pemeriksa boleh membatalkan pemeriksaannya sendiri selama sekian hari; Pemilik/GM kapan saja (§16.1 butir 9). */
export const VOID_OWN_DAYS = 7;

export type NoteBill = { transactionId: number; number: string; bill: number | null };

/**
 * Saran pembagian uang per nota (§16.1 butir 2): Lunas → tiap nota = tagihannya; satu nota → seluruhnya; Bayar sebagian dengan
 * beberapa nota → nota paling depan dulu (urutan daftar = nota paling lama), sama dengan bayar gabungan BO. Tagihan tidak
 * diketahui (kunjungan sebelum LT4a) dengan beberapa nota → 0 semua, diketik Finance.
 */
export function suggestSplit(method: PaymentMethod, received: number, notes: NoteBill[]): number[] {
  if (notes.length === 1) return [received];
  if (notes.some((n) => n.bill == null)) return notes.map(() => 0);
  if (method === 'CASH' || method === 'TRANSFER') return notes.map((n) => n.bill!);
  let left = new Big(received);
  return notes.map((n) => {
    const take = left.gt(n.bill!) ? new Big(n.bill!) : left;
    left = left.minus(take);
    return Number(take);
  });
}

/** Pembagian per nota perlu diketik Finance? (beberapa nota dan Bayar sebagian, atau tagihan per nota tidak diketahui). */
export const splitEditable = (method: PaymentMethod, notes: NoteBill[]) =>
  notes.length > 1 && (method === 'PARTIAL' || notes.some((n) => n.bill == null));

export type CheckLineInput = { transactionId?: number | null; reported?: number | null; actual?: number | null; note?: string | null };
export type CheckLine = {
  transactionId: number; number: string; bill: number | null; reported: number; actual: number; note: string | null;
  /** Yang harus dilunasi di POS (§16.1 butir 4, 5): tunai = laporan driver; transfer = yang benar-benar masuk (paling banyak laporan). */
  posExpected: number;
  /** Kurang serah tunai (atas nama pembawa) atau lebih serah: sebenarnya − laporan. */
  difference: number;
};

const isMoney = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 1_000_000_000;

/**
 * Pemeriksaan satu cara bayar (§16.1 butir 2, 3): tiap nota tepat sekali, dilaporkan 0..tagihan (bila diketahui) dengan jumlah =
 * uang yang dilaporkan driver; Tidak cocok (sebenarnya ≠ laporan) wajib catatan ≥ 5 huruf.
 */
export function cleanCheck(
  kind: MoneyKind, received: number, notes: NoteBill[], input: CheckLineInput[] | null | undefined,
): { ok: true; lines: CheckLine[] } | { ok: false; error: string } {
  const rows = input ?? [];
  if (rows.length !== notes.length) return { ok: false, error: 'Periksa semua nota toko ini.' };
  const lines: CheckLine[] = [];
  let sum = new Big(0);
  for (const n of notes) {
    const row = rows.find((r) => r.transactionId === n.transactionId);
    if (!row) return { ok: false, error: `Nota ${n.number} belum diperiksa.` };
    if (!isMoney(row.reported)) return { ok: false, error: `Isi uang menurut driver untuk nota ${n.number} (rupiah).` };
    if (!isMoney(row.actual)) return { ok: false, error: `Isi uang yang diterima untuk nota ${n.number} (rupiah).` };
    if (n.bill != null && row.reported > n.bill) {
      return { ok: false, error: `Uang menurut driver untuk nota ${n.number} melebihi tagihannya (Rp ${n.bill.toLocaleString('id-ID')}).` };
    }
    const note = (row.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 300) || null;
    if (row.actual !== row.reported && (!note || note.length < REASON_MIN)) {
      return { ok: false, error: `Tidak cocok di nota ${n.number}: tulis catatan paling sedikit ${REASON_MIN} huruf.` };
    }
    sum = sum.plus(row.reported);
    lines.push({
      transactionId: n.transactionId, number: n.number, bill: n.bill, reported: row.reported, actual: row.actual,
      note: row.actual === row.reported ? null : note,
      posExpected: kind === 'CASH' ? row.reported : Math.min(row.actual, row.reported),
      difference: Number(new Big(row.actual).minus(row.reported)),
    });
  }
  if (!sum.eq(received)) {
    return { ok: false, error: `Jumlah uang menurut driver per nota harus sama dengan laporan driver (Rp ${received.toLocaleString('id-ID')}).` };
  }
  return { ok: true, lines };
}

export type PosStatus = 'OK' | 'PARTLY' | 'WAITING' | 'GONE' | 'UNKNOWN' | 'NONE';
export const POS_STATUS_LABELS: Record<PosStatus, string> = {
  OK: 'Sudah masuk POS', PARTLY: 'Baru sebagian di POS', WAITING: 'Belum masuk POS', GONE: 'Piutang tidak ada di kasir',
  UNKNOWN: 'Tidak bisa dibaca', NONE: 'Tidak perlu',
};

/**
 * Tanda pelunasan POS (§16.1 butir 7): masuk POS sejak Terkirim = tagihan saat Terkirim − sisa piutang sekarang − potong nota
 * HRIS yang sudah dicatat di kasir. `debt` null = piutang tidak ada / dibatalkan di kasir.
 */
export function posStatusOf(input: {
  expected: number; bill: number | null; debt: { remaining: number; voided: boolean } | null; recordedCuts: number;
}): { status: PosStatus; paid: number | null } {
  if (input.expected === 0) return { status: 'NONE', paid: null };
  if (input.bill == null) return { status: 'UNKNOWN', paid: null };
  if (!input.debt || input.debt.voided) return { status: 'GONE', paid: null };
  const paid = Number(new Big(input.bill).minus(input.debt.remaining).minus(input.recordedCuts));
  if (paid >= input.expected) return { status: 'OK', paid };
  return { status: paid > 0 ? 'PARTLY' : 'WAITING', paid: Math.max(0, paid) };
}

/** Pemeriksaan boleh dibatalkan: Pemilik/GM kapan saja; pemeriksa sendiri dalam 7 hari. */
export function voidProblem(input: { fullAccess: boolean; own: boolean; daysSince: number }): string | null {
  if (input.fullAccess) return null;
  if (!input.own) return 'Pemeriksaan ini dibatalkan oleh pemeriksanya sendiri, atau Pemilik / GM.';
  if (input.daysSince > VOID_OWN_DAYS) return `Lewat ${VOID_OWN_DAYS} hari: pembatalan oleh Pemilik / GM.`;
  return null;
}
