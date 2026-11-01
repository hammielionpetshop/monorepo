/** Aturan murni Tinjau, Koreksi, dan Rekap (spec L3c §3). Tanggal = YYYY-MM-DD WIB. Tanpa DB. */
import { distanceMeters, earlyLeaveMinutes, lateMinutes, wibInstant, withinOutCutoff } from './attendance';
import { addDays, type IsoDate } from './schedule';

/** Keadaan satu hari kerja. Tanpa jam masuk = hari tanpa absen. */
export type DayState = {
  branchId: number | null; shiftId: number | null; shiftVersionId: number | null; inAt: Date | null; outAt: Date | null;
};

export const EMPTY_STATE: DayState = { branchId: null, shiftId: null, shiftVersionId: null, inAt: null, outAt: null };

export type Minutes = { lateMinutes: number | null; earlyLeaveMinutes: number | null };

export type CorrectionState = DayState & Minutes & { id: number };

export type EffectiveDay = { state: DayState; correctionId: number | null } & Minutes;

/** Catatan absen asli digabung koreksi terbaru (KEH-28). Satu fungsi untuk semua layar (KEH-76, WAJ-04). */
export function effectiveDay(original: (DayState & Minutes) | null, corrections: readonly CorrectionState[]): EffectiveDay {
  const latest = corrections.reduce<CorrectionState | null>((best, row) => (!best || row.id > best.id ? row : best), null);
  if (latest) {
    const { id, lateMinutes: late, earlyLeaveMinutes: early, ...state } = latest;
    return { state, correctionId: id, lateMinutes: late, earlyLeaveMinutes: early };
  }
  if (!original) return { state: EMPTY_STATE, correctionId: null, lateMinutes: null, earlyLeaveMinutes: null };
  const { lateMinutes: late, earlyLeaveMinutes: early, ...state } = original;
  return { state, correctionId: null, lateMinutes: late, earlyLeaveMinutes: early };
}

const time = (at: Date | null) => at?.getTime() ?? null;

export function sameState(a: DayState, b: DayState): boolean {
  return a.branchId === b.branchId && a.shiftId === b.shiftId && a.shiftVersionId === b.shiftVersionId
    && time(a.inAt) === time(b.inAt) && time(a.outAt) === time(b.outAt);
}

/** Isian `YYYY-MM-DDTHH:MM` dibaca sebagai jam WIB. */
export function wibLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const at = new Date(`${value}:00+07:00`);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** Jam koreksi mengikuti aturan absen: masuk di hari kerja itu, pulang sesudah masuk dan sebelum batas keesokan hari (KEH-18). */
export function correctionProblem(workDate: IsoDate, inAt: Date, outAt: Date | null, cutoffHour: number): string | null {
  if (inAt < wibInstant(workDate, '00:00') || !withinOutCutoff(workDate, inAt, cutoffHour)) return `Jam masuk harus di tanggal ${workDate}.`;
  if (outAt) {
    if (outAt <= inAt) return 'Jam pulang harus sesudah jam masuk.';
    if (!withinOutCutoff(workDate, outAt, cutoffHour)) {
      return `Jam pulang paling lambat ${String(cutoffHour).padStart(2, '0')}.00 keesokan hari.`;
    }
  }
  return null;
}

export type ShiftTimes = { startTime: string; endTime: string };

/** Telat dan pulang cepat dihitung ulang dengan fungsi yang sama dengan absen (KEH-29). Tanpa shift: kosong. */
export function recomputeMinutes(workDate: IsoDate, hours: ShiftTimes | null, state: DayState, lateApplies: boolean): Minutes {
  if (!hours || !state.inAt) return { lateMinutes: null, earlyLeaveMinutes: null };
  return {
    lateMinutes: lateApplies ? lateMinutes(workDate, hours.startTime, state.inAt) : null,
    earlyLeaveMinutes: state.outAt ? earlyLeaveMinutes(workDate, hours.startTime, hours.endTime, state.outAt) : null,
  };
}

export type DayStatus = 'PRESENT' | 'CLOSED' | 'UNDETERMINED';

export const DAY_STATUS_LABELS: Record<DayStatus, string> = { PRESENT: 'Hadir', CLOSED: 'Hari tutup', UNDETERMINED: 'Belum ditentukan' };

/** Urutan KEH-118 sejauh yang sudah dibangun: absen nyata menang, lalu hari tutup; hari kosong tidak ditebak. */
export function dayStatus(hasIn: boolean, closed: boolean): DayStatus {
  if (hasIn) return 'PRESENT';
  return closed ? 'CLOSED' : 'UNDETERMINED';
}

/** Periode rekap 26 sampai 25, sama dengan slip (KEH-119). */
export function payPeriodOf(date: IsoDate): { start: IsoDate; end: IsoDate } {
  const [y, m, d] = date.split('-').map(Number);
  const startMonth = d >= 26 ? m - 1 : m - 2;
  const start = new Date(Date.UTC(y, startMonth, 26)).toISOString().slice(0, 10);
  const end = new Date(Date.UTC(y, startMonth + 1, 25)).toISOString().slice(0, 10);
  return { start, end };
}

/** Awal periode sebelumnya/sesudahnya. */
export function shiftPeriod(start: IsoDate, months: number): IsoDate {
  const [y, m] = start.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 26)).toISOString().slice(0, 10);
}

/** Tanggal yang dihitung: sejak tanggal masuk, sampai kemarin. Hari yang masih berjalan belum masuk hitungan. */
export function countableDates(start: IsoDate, end: IsoDate, today: IsoDate, joinedOn: IsoDate | null): IsoDate[] {
  const from = joinedOn && joinedOn > start ? joinedOn : start;
  const yesterday = addDays(today, -1);
  const until = end < yesterday ? end : yesterday;
  const dates: IsoDate[] = [];
  for (let date = from; date <= until; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/** Tanda kantor "dalam toleransi" (KEH-22, 119). Karyawan tidak melihat tanda ini. */
export function withinTolerance(late: number | null, tolerance: number): boolean {
  return late != null && late > 0 && late <= tolerance;
}

export type RecapDay = { status: DayStatus; lateMinutes: number | null; earlyLeaveMinutes: number | null; pendingReviews: number };

export type RecapTotals = {
  present: number; lateCount: number; lateMinutes: number; earlyCount: number; closed: number; undetermined: number; pendingReviews: number;
};

/** Satu hitungan rekap untuk kantor dan karyawan (KEH-76). */
export function summarizeDays(days: readonly RecapDay[]): RecapTotals {
  const totals: RecapTotals = { present: 0, lateCount: 0, lateMinutes: 0, earlyCount: 0, closed: 0, undetermined: 0, pendingReviews: 0 };
  for (const day of days) {
    if (day.status === 'PRESENT') totals.present += 1;
    if (day.status === 'CLOSED') totals.closed += 1;
    if (day.status === 'UNDETERMINED') totals.undetermined += 1;
    if (day.lateMinutes) {
      totals.lateCount += 1;
      totals.lateMinutes += day.lateMinutes;
    }
    if (day.earlyLeaveMinutes) totals.earlyCount += 1;
    totals.pendingReviews += day.pendingReviews;
  }
  return totals;
}

export function addTotals(a: RecapTotals, b: RecapTotals): RecapTotals {
  return Object.fromEntries(Object.keys(a).map((key) => [key, a[key as keyof RecapTotals] + b[key as keyof RecapTotals]])) as RecapTotals;
}

// ---- Pola lokasi (KEH-115) ----

export type PersonWorkday = { workDate: IsoDate; outsideRecordIds: number[] };

/**
 * Pola 1: hari kerja terakhir orang itu (terbaru dulu, sudah dipotong sepanjang rentang).
 * Kena bila jumlah absen luar titik mencapai ambang dan hari terbaru ikut luar titik. Hasil: absen terkait.
 */
export function repeatOutsideHit(workdays: readonly PersonWorkday[], threshold: number): number[] | null {
  if (!workdays.length || !workdays[0].outsideRecordIds.length) return null;
  const records = workdays.flatMap((day) => day.outsideRecordIds);
  return records.length >= threshold ? [...records].sort((a, b) => a - b) : null;
}

export type OutsidePoint = { recordId: number; employeeId: number; latitude: number; longitude: number };

/** Pola 2: dua orang berbeda absen luar titik dari titik nyaris sama pada hari yang sama. Satu pasangan orang sekali. */
export function sharedPointPairs(points: readonly OutsidePoint[], maxMeters: number): [OutsidePoint, OutsidePoint][] {
  const pairs = new Map<string, [OutsidePoint, OutsidePoint]>();
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const [a, b] = points[i].employeeId < points[j].employeeId ? [points[i], points[j]] : [points[j], points[i]];
      if (a.employeeId === b.employeeId) continue;
      const key = `${a.employeeId}-${b.employeeId}`;
      if (!pairs.has(key) && distanceMeters(a, b) < maxMeters) pairs.set(key, [a, b]);
    }
  }
  return [...pairs.values()];
}

export const CORRECTION_REASONS = ['DEVICE', 'MOVED', 'WRONG_RECORD', 'OTHER'] as const;
export type CorrectionReason = (typeof CORRECTION_REASONS)[number];

export const CORRECTION_REASON_LABELS: Record<CorrectionReason, string> = {
  DEVICE: 'Handphone atau kamera bermasalah', MOVED: 'Pindah tempat di tengah hari', WRONG_RECORD: 'Salah catat', OTHER: 'Lainnya',
};

export const REVIEW_OUTCOME_LABELS = { FINE: 'Wajar', NEEDS_CORRECTION: 'Perlu dikoreksi' } as const;
export type ReviewOutcome = keyof typeof REVIEW_OUTCOME_LABELS;

export const PATTERN_LABELS = {
  REPEAT_OUTSIDE: 'Sering absen di luar titik',
  SHARED_POINT: 'Dua orang absen dari titik nyaris sama',
} as const;
export type PatternKind = keyof typeof PATTERN_LABELS;
