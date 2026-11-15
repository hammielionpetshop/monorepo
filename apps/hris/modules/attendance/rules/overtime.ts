/** Aturan murni Lembur (spec L3h §3). Tanggal = YYYY-MM-DD WIB, jam = HH:MM. Tanpa DB. */
import { wibInstant } from './attendance';
import { deadlineAfter } from './clarification';
import { addDays, type IsoDate } from './schedule';

/** Hari pertama lembur dihitung (spec L3h §9 butir 2): tanpa menghitung mundur. */
export const OVERTIME_MARKS_FROM: IsoDate = '2026-11-02';

export type OvertimeState = 'OPEN' | 'CLAIMED' | 'APPROVED' | 'EXPIRED' | 'VOID';
export type OvertimeChoice = 'UNANSWERED' | 'LATER' | 'NOT_OVERTIME' | 'CLAIMED';

export const OVERTIME_STATE_LABELS: Record<OvertimeState, string> = {
  OPEN: 'Belum diklaim', CLAIMED: 'Menunggu keputusan', APPROVED: 'Disahkan', EXPIRED: 'Hangus', VOID: 'Tidak ada lembur lagi',
};

/** Instan jam `time` pada hari kerja yang dimulai `startTime`: jam lebih kecil dari jam masuk = keesokan hari. */
function shiftInstant(workDate: IsoDate, startTime: string, time: string): Date {
  return wibInstant(time.slice(0, 5) <= startTime.slice(0, 5) ? addDays(workDate, 1) : workDate, time);
}

export type OvertimeInput = {
  workDate: IsoDate;
  startTime: string;
  endTime: string;
  /** Jam tutup cabang yang dipakai (toko: jam pulang shift terakhir; kantor: pengaturan). Null = tanpa batas tutup. */
  closing: string | null;
  outAt: Date;
  minHours: number;
  maxHours: number;
};

/**
 * Jam lembur terdeteksi (KEH-70, 71, 159): jam pulang dikurangi jam pulang jadwal, dihentikan di jam tutup,
 * dibulatkan ke bawah per jam penuh; di bawah `minHours` = 0, paling banyak `maxHours`. Satu-satunya rumus (WAJ-04).
 */
export function overtimeHours(input: OvertimeInput): number {
  const end = shiftInstant(input.workDate, input.startTime, input.endTime);
  const close = input.closing ? shiftInstant(input.workDate, input.startTime, input.closing) : null;
  const until = close && close < input.outAt ? close : input.outAt;
  const minutes = Math.floor((until.getTime() - end.getTime()) / 60_000);
  if (minutes <= 0) return 0;
  const hours = Math.floor(minutes / 60);
  if (hours < input.minHours) return 0;
  return Math.min(hours, input.maxHours);
}

/** Jam tutup kantor dari pengaturan jam penuh (spec L3h §9 butir 4). */
export function officeClosing(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export type OvertimeSkip = 'NOT_TRACKED' | 'NOT_ELIGIBLE' | 'NO_SHIFT' | 'NO_OUT' | 'CLOSED' | 'DAY_OFF_WORK';

/** Hari yang tidak pernah punya lembur (KEH-25, 99, 165). Urutan pemeriksaan tetap supaya pesannya sama di semua layar. */
export function overtimeSkip(facts: {
  tracked: boolean; eligible: boolean; hasShift: boolean; hasOut: boolean; closed: boolean; dayOffWork: boolean;
}): OvertimeSkip | null {
  if (!facts.tracked) return 'NOT_TRACKED';
  if (!facts.eligible) return 'NOT_ELIGIBLE';
  if (facts.closed) return 'CLOSED';
  if (facts.dayOffWork) return 'DAY_OFF_WORK';
  if (!facts.hasShift) return 'NO_SHIFT';
  if (!facts.hasOut) return 'NO_OUT';
  return null;
}

/**
 * Batas klaim (KEH-74, 161, 165): tanggal kerja + n hari pukul 23.59; hari lupa absen pulang yang dijelaskan dihitung
 * dari tanggal penjelasannya disahkan, bila itu lebih lambat.
 */
export function claimDeadline(workDate: IsoDate, days: number, explainedOn: IsoDate | null): Date {
  const base = explainedOn && explainedOn > workDate ? explainedOn : workDate;
  return deadlineAfter(base, days);
}

/** Pengesahan (KEH-162): jam penuh, paling kecil 1, tidak melebihi jam diklaim; diturunkan wajib alasan. */
export function approvalProblem(approved: number, claimed: number, reason: string | null): string | null {
  if (!Number.isInteger(approved) || approved < 1) return 'Jam disahkan paling sedikit 1 jam penuh.';
  if (approved > claimed) return `Jam disahkan tidak bisa melebihi jam diklaim (${claimed} jam). Menaikkan jam hanya lewat koreksi absen.`;
  if (approved < claimed && !reason) return 'Tulis alasan menurunkan jam lembur.';
  return null;
}

/** Penyuruh (KEH-163): bukan diri sendiri dan berjabatan "boleh menyuruh lembur". */
export function ordererProblem(ordererId: number, selfId: number, allowedIds: ReadonlySet<number>): string | null {
  if (ordererId === selfId) return 'Yang menyuruh tidak bisa diri sendiri.';
  if (!allowedIds.has(ordererId)) return 'Pilih yang menyuruh dari daftar orang yang boleh menyuruh lembur.';
  return null;
}

/** Koreksi yang membuat jam terdeteksi di bawah jam disahkan ditolak (KEH-166). */
export function correctionBlockedByApproval(newHours: number, approvedHours: number | null): boolean {
  return approvedHours != null && newHours < approvedHours;
}

/** Keadaan baris sesudah dihitung ulang (spec L3h §3.2): baris belum diklaim mengikuti angka; turun ke 0 = VOID. */
export function nextState(current: OvertimeState | null, hours: number): OvertimeState | null {
  if (current === null) return hours > 0 ? 'OPEN' : null;
  if ((current === 'OPEN' || current === 'EXPIRED') && hours === 0) return 'VOID';
  if (current === 'VOID' && hours > 0) return 'OPEN';
  return current;
}

export type RecapOvertime = { detected: number; claimed: number; approved: number };

/** Tiga angka lembur rekap (KEH-77). */
export function overtimeTotals(rows: readonly { state: OvertimeState; hours: number; claimedHours: number | null; approvedHours: number | null }[]): RecapOvertime {
  return rows.reduce<RecapOvertime>((sum, row) => ({
    detected: sum.detected + (row.state === 'VOID' ? 0 : row.hours),
    claimed: sum.claimed + (row.state === 'CLAIMED' || row.state === 'APPROVED' ? row.claimedHours ?? 0 : 0),
    approved: sum.approved + (row.state === 'APPROVED' ? row.approvedHours ?? 0 : 0),
  }), { detected: 0, claimed: 0, approved: 0 });
}

export function overtimeText(totals: RecapOvertime | null | undefined): string {
  if (!totals || (!totals.detected && !totals.claimed && !totals.approved)) return '-';
  return `${totals.detected} / ${totals.claimed} / ${totals.approved} jam`;
}
