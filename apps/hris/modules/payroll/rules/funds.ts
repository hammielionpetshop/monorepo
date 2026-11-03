import type { LineKey, PayLine } from './attendance-pay';
import { rupiah } from './salary';

// Aturan murni Dana Disiplin & Dana Tidak Hadir (spec L4d §3.4; GAJ-33 s.d. 35, 87, 88).

export type Fund = 'DISCIPLINE' | 'ABSENCE';
export type FundEntryKind = 'OPENING' | 'ADJUSTMENT' | 'TRANSFER' | 'SLIP' | 'OFF_SLIP';
export type BonusFund = 'OFFICE' | 'DISCIPLINE_FUND';

export const FUND_LABELS: Record<Fund, string> = { DISCIPLINE: 'Dana Disiplin', ABSENCE: 'Dana Tidak Hadir' };
export const FUND_ENTRY_LABELS: Record<FundEntryKind, string> = { OPENING: 'Saldo awal', ADJUSTMENT: 'Penyesuaian', TRANSFER: 'Pindah dana', SLIP: 'Slip ditutup', OFF_SLIP: 'Bayar di luar slip' };
export const BONUS_FUND_LABELS: Record<BonusFund, string> = { OFFICE: 'Uang kantor', DISCIPLINE_FUND: 'Dana Disiplin' };

export const ABSENCE_REPORT_NOTE = 'Ini laporan. Lembur dan kompensasi libur tetap dibayar berapa pun saldonya.';
export const MIN_REASON = 15;

/** Baris hitungan kehadiran yang menjadi mutasi dana saat slip ditutup (spec L4d §3.4). */
export const DISCIPLINE_IN: readonly LineKey[] = ['LATE', 'FINE'];
export const ABSENCE_IN: readonly LineKey[] = ['ALPHA', 'PERMIT_SICK', 'SUDDEN', 'SICK_LETTER'];
export const ABSENCE_OUT: readonly LineKey[] = ['OVERTIME', 'COMPENSATION'];

export type FundEstimate = { disciplineIn: number; absenceIn: number; absenceOut: number };

/** Perkiraan mutasi dana dari hitungan kehadiran satu orang (belum masuk saldo sampai slip ditutup). */
export function estimateOf(lines: readonly Pick<PayLine, 'key' | 'amount'>[]): FundEstimate {
  const sum = (keys: readonly LineKey[]) => lines.filter((l) => keys.includes(l.key)).reduce((s, l) => s + l.amount, 0);
  return { disciplineIn: sum(DISCIPLINE_IN), absenceIn: sum(ABSENCE_IN), absenceOut: sum(ABSENCE_OUT) };
}

export function addEstimates(a: FundEstimate, b: FundEstimate): FundEstimate {
  return { disciplineIn: a.disciplineIn + b.disciplineIn, absenceIn: a.absenceIn + b.absenceIn, absenceOut: a.absenceOut + b.absenceOut };
}

export type FundState = {
  discipline: { balance: number; reserved: number; available: number; hasEntries: boolean };
  absence: { balance: number; hasEntries: boolean };
};

/** Saldo = jumlah mutasi; Terpesan = bonus bersumber Dana Disiplin yang Disahkan dan belum masuk slip ditutup; Tersedia = Saldo − Terpesan. */
export function fundState(entries: readonly { fund: string; amount: number }[], reserved: number): FundState {
  const of = (fund: Fund) => entries.filter((e) => e.fund === fund);
  const balance = (fund: Fund) => of(fund).reduce((s, e) => s + e.amount, 0);
  const discipline = balance('DISCIPLINE');
  return {
    discipline: { balance: discipline, reserved, available: discipline - reserved, hasEntries: of('DISCIPLINE').length > 0 },
    absence: { balance: balance('ABSENCE'), hasEntries: of('ABSENCE').length > 0 },
  };
}

/** Pagar Tersedia saat mengesahkan bonus bersumber Dana Disiplin; null = cukup. */
export function disciplineShortfall(available: number, amount: number): string | null {
  if (amount <= available) return null;
  return `Dana Disiplin tersedia ${rupiah(Math.max(available, 0))}; bonus ini ${rupiah(amount)}; kurang ${rupiah(amount - Math.max(available, 0))}.`;
}

export type FundChange =
  | { kind: 'OPENING'; fund: Fund; amount: number }
  | { kind: 'ADJUSTMENT'; fund: Fund; amount: number }
  | { kind: 'TRANSFER'; amount: number };

/** Pemeriksaan Isi saldo awal, Sesuaikan, dan Pindah (spec L4d §3.4); null = boleh. */
export function fundChangeProblem(change: FundChange, state: FundState, reason: string): string | null {
  if (reason.trim().length < MIN_REASON) return `Alasan paling sedikit ${MIN_REASON} huruf.`;
  if (!Number.isInteger(change.amount) || Math.abs(change.amount) > 10_000_000_000) return 'Nominal harus rupiah bulat.';
  if (change.kind === 'OPENING') {
    if (change.amount < 0) return 'Saldo awal tidak boleh minus.';
    const has = change.fund === 'DISCIPLINE' ? state.discipline.hasEntries : state.absence.hasEntries;
    return has ? `${FUND_LABELS[change.fund]} sudah punya mutasi; saldo awal hanya diisi sekali sebelum mutasi lain. Pakai Sesuaikan.` : null;
  }
  if (change.amount === 0) return 'Nominal tidak boleh nol.';
  if (change.kind === 'ADJUSTMENT') {
    if (change.fund === 'DISCIPLINE' && change.amount < 0) {
      const after = state.discipline.balance + change.amount;
      if (after < state.discipline.reserved) {
        return `Saldo Dana Disiplin menjadi ${rupiah(after)}, di bawah yang terpesan bonus ${rupiah(state.discipline.reserved)}. Paling banyak dikurangi ${rupiah(Math.max(state.discipline.available, 0))}.`;
      }
    }
    return null;
  }
  if (change.amount < 0) return 'Nominal pindah harus lebih dari 0.';
  const max = Math.max(state.absence.balance, 0);
  return change.amount > max ? `Saldo berjalan Dana Tidak Hadir ${rupiah(state.absence.balance)}; paling banyak dipindah ${rupiah(max)}.` : null;
}
