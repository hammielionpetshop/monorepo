// Tindak lanjut kurang serah Terima Uang (spec 2026-11-08 B3). Aturan murni: sisa, tanda, pembagian driver/kenek. Tanpa DB.
import Big from 'big.js';

export type LinkedDeductionStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'CANCELLED' | 'WAIVED';
export type SettlementKind = 'CASH_REPLACED' | 'WAIVED';
export type ShortState = 'OPEN' | 'PENDING' | 'DONE' | 'WAIVED';

export const SHORT_STATE_LABELS: Record<ShortState, string> = {
  OPEN: 'Belum ditindaklanjuti',
  PENDING: 'Diajukan, menunggu pengesahan',
  DONE: 'Selesai',
  WAIVED: 'Tidak dipotong',
};
export const SETTLEMENT_LABELS: Record<SettlementKind, string> = { CASH_REPLACED: 'Sudah diganti tunai', WAIVED: 'Tidak dipotong' };

/** Kurang serah ⚠️ ditandai merah sesudah sekian hari sejak diperiksa (sama dengan batas merah Terima Uang). */
export const SHORT_RED_DAYS = 3;

export type ShortSummary = {
  total: number; replaced: number; pending: number; running: number; objected: number; left: number; waived: boolean; state: ShortState;
};

/**
 * Sisa kurang serah (spec B3 butir 4–5) = total − ganti tunai berlaku − Potongan Lain hidup (Menunggu / Berjalan) − Potongan Lain
 * yang ditiadakan lewat keberatan (dihitung selesai). Ditolak / Dibatalkan tidak dihitung, jadi sisanya bisa diajukan ulang.
 * Tanda Tidak dipotong menutup sisanya.
 */
export function summarizeShort(
  total: number,
  deductions: { status: LinkedDeductionStatus; amount: number }[],
  settlements: { kind: SettlementKind; amount: number | null }[],
): ShortSummary {
  const sum = (values: number[]) => Number(values.reduce((n, v) => n.plus(v), new Big(0)));
  const replaced = sum(settlements.filter((s) => s.kind === 'CASH_REPLACED').map((s) => s.amount ?? 0));
  const pending = sum(deductions.filter((d) => d.status === 'PENDING').map((d) => d.amount));
  const running = sum(deductions.filter((d) => d.status === 'ACTIVE').map((d) => d.amount));
  const objected = sum(deductions.filter((d) => d.status === 'WAIVED').map((d) => d.amount));
  const waived = settlements.some((s) => s.kind === 'WAIVED');
  const left = waived ? 0 : Math.max(0, total - replaced - pending - running - objected);
  const state: ShortState = waived ? 'WAIVED' : left > 0 ? 'OPEN' : pending > 0 ? 'PENDING' : 'DONE';
  return { total, replaced, pending, running, objected, left, waived, state };
}

export type ShareInput = { employeeId?: unknown; amount?: unknown };
export type Share = { employeeId: number; amount: number };

/**
 * Pembagian Potongan Lain kurang serah (spec B3 butir 2, keputusan owner A): satu orang (bawaan pembawa uang) atau dibagi dengan
 * awak trip lain. Tiap bagian rupiah bulat > 0, orangnya awak cara bayar itu dan tidak berulang; jumlahnya 1..sisa (boleh
 * diturunkan, tidak dinaikkan).
 */
export function cleanShares(input: ShareInput[] | null | undefined, crewIds: number[], left: number): { ok: true; shares: Share[]; total: number } | { ok: false; error: string } {
  const rows = Array.isArray(input) ? input : [];
  if (!rows.length) return { ok: false, error: 'Pilih orang yang dipotong.' };
  if (rows.length > crewIds.length) return { ok: false, error: 'Orangnya lebih banyak dari awak trip.' };
  const shares: Share[] = [];
  for (const r of rows) {
    const employeeId = Number(r.employeeId);
    const amount = Number(r.amount);
    if (!crewIds.includes(employeeId)) return { ok: false, error: 'Yang dipotong hanya awak trip / pembawa uang ini.' };
    if (shares.some((s) => s.employeeId === employeeId)) return { ok: false, error: 'Satu orang hanya satu bagian.' };
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: 'Bagian tiap orang harus rupiah bulat lebih dari 0.' };
    shares.push({ employeeId, amount });
  }
  const total = Number(shares.reduce((n, s) => n.plus(s.amount), new Big(0)));
  if (left <= 0) return { ok: false, error: 'Kurang serah ini sudah tidak bersisa.' };
  if (total > left) return { ok: false, error: `Jumlah potongan paling banyak sisa kurang serah ${left.toLocaleString('id-ID')}.` };
  return { ok: true, shares, total };
}

/** Bagi rata (sisa pembulatan ke orang pertama, yaitu pembawa uang). */
export function splitEvenly(total: number, people: number): number[] {
  if (people <= 0) return [];
  const base = Math.floor(total / people);
  return Array.from({ length: people }, (_, i) => (i === 0 ? total - base * (people - 1) : base));
}
