import { REASON_MIN, type IsoDate } from './trip';

// Aturan murni bensin (spec LT1 §17.1 butir 1–5): nominal, alasan tanpa permintaan, periode 26–25.

export const FUEL_MAX = 10_000_000;

/** Pilihan baku alasan Catat bensin tanpa permintaan (butir 2); OTHER = ketik sendiri. */
export const NO_REQUEST_REASONS = { FORGOT: 'Driver lupa minta', OTHER: 'Lainnya' } as const;
export type NoRequestReason = keyof typeof NO_REQUEST_REASONS;

export function amountProblem(amount: unknown): string | null {
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) return 'Isi nominal bensin sesuai struk (rupiah, lebih dari 0).';
  if (amount > FUEL_MAX) return 'Nominal bensin terlalu besar. Periksa lagi angkanya.';
  return null;
}

/** Alasan tanpa permintaan yang disimpan: teks baku, atau ketikan sendiri (≥ 5 huruf). */
export function noRequestReason(code: string | null | undefined, text: string | null | undefined): { ok: true; value: string } | { ok: false; error: string } {
  if (code === 'FORGOT') return { ok: true, value: NO_REQUEST_REASONS.FORGOT };
  const typed = (text ?? '').trim();
  if (code === 'OTHER' && typed.length >= REASON_MIN && typed.length <= 300) return { ok: true, value: typed };
  return { ok: false, error: `Pilih alasan, atau ketik alasan paling sedikit ${REASON_MIN} huruf.` };
}

/** Periode 26–25 yang memuat tanggal ini: 26 bulan lalu s.d. 25 bulan ini (tanggal ≤ 25), atau 26 bulan ini s.d. 25 bulan depan. */
export function fuelPeriod(day: IsoDate): { from: IsoDate; to: IsoDate } {
  const [y, m, d] = day.split('-').map(Number);
  const start = d >= 26 ? { y, m } : m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const end = start.m === 12 ? { y: start.y + 1, m: 1 } : { y: start.y, m: start.m + 1 };
  const iso = (p: { y: number; m: number }, dd: number) => `${p.y}-${String(p.m).padStart(2, '0')}-${dd}` as IsoDate;
  return { from: iso(start, 26), to: iso(end, 25) };
}

/** Hanya pencatatnya atau Pemilik/GM yang boleh mengubah / membatalkan (butir 4). */
export function canChangeFill(fill: { recordedByAccountId: number }, actor: { accountId: number; fullAccess: boolean }): boolean {
  return actor.fullAccess || fill.recordedByAccountId === actor.accountId;
}
