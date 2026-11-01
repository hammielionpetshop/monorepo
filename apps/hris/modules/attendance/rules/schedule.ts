/** Aturan murni Jam Kerja & Jadwal (spec L3a §3). Tanggal = YYYY-MM-DD WIB, jam = HH:MM. */
export type IsoDate = string;

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function mondayOf(date: IsoDate): IsoDate {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

export function weekDates(weekStart: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function weeksBetween(from: IsoDate, to: IsoDate): number {
  const utc = (value: IsoDate) => Date.parse(`${value}T00:00:00Z`);
  return Math.round((utc(to) - utc(from)) / (7 * 86_400_000));
}

export type ShiftVersion = {
  id: number;
  startTime: string;
  endTime: string;
  breakMinutes: number | null;
  breakStartFrom: string | null;
  breakStartUntil: string | null;
  effectiveFrom: IsoDate;
  effectiveUntil: IsoDate | null;
  cancelled: boolean;
};

/** Versi berlaku pada tanggal X (KEH-02): `berlaku dari` terbaru yang masih mencakup X; versi bertenggat kembali ke versi tetap. */
export function versionOn<T extends ShiftVersion>(versions: readonly T[], on: IsoDate): T | null {
  let best: T | null = null;
  for (const version of versions) {
    if (version.cancelled || version.effectiveFrom > on) continue;
    if (version.effectiveUntil && version.effectiveUntil < on) continue;
    if (!best || version.effectiveFrom > best.effectiveFrom) best = version;
  }
  return best;
}

/** Urutan shift kelompok pada satu minggu (KEH-06). Dihitung dari minggu acuan, jadi minggu terlewat tidak membalik giliran. */
export function rotationIndex(groupPosition: number, anchorWeek: IsoDate, week: IsoDate): number {
  const offset = weeksBetween(anchorWeek, week);
  return (((groupPosition + offset) % 2) + 2) % 2;
}

export type ShiftSource = 'DAY_CHANGE' | 'ASSIGNMENT' | 'GROUP' | 'SOLE' | 'NONE';

/** Shift seseorang pada satu tanggal, tidak pernah ditebak dari jam datang (KEH-07). */
export function resolveShift(input: {
  dayChangeShiftId?: number | null;
  assignmentShiftId?: number | null;
  groupShiftId?: number | null;
  soleShiftId?: number | null;
}): { shiftId: number | null; source: ShiftSource } {
  if (input.dayChangeShiftId != null) return { shiftId: input.dayChangeShiftId, source: 'DAY_CHANGE' };
  if (input.assignmentShiftId != null) return { shiftId: input.assignmentShiftId, source: 'ASSIGNMENT' };
  if (input.groupShiftId != null) return { shiftId: input.groupShiftId, source: 'GROUP' };
  if (input.soleShiftId != null) return { shiftId: input.soleShiftId, source: 'SOLE' };
  return { shiftId: null, source: 'NONE' };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ShiftHours = {
  startTime: string;
  endTime: string;
  breakMinutes: number | null;
  breakStartFrom: string | null;
  breakStartUntil: string | null;
};

/** Pesan kesalahan isian jam, atau null bila benar. Jam pulang lebih kecil = pulang keesokan hari. */
export function shiftHoursProblem(hours: ShiftHours): string | null {
  if (!TIME.test(hours.startTime) || !TIME.test(hours.endTime)) return 'Jam masuk dan jam pulang harus berformat JJ:MM.';
  if (hours.startTime === hours.endTime) return 'Jam masuk dan jam pulang tidak boleh sama.';
  const filled = [hours.breakMinutes, hours.breakStartFrom, hours.breakStartUntil].filter((value) => value != null).length;
  if (filled === 0) return null;
  if (filled < 3) return 'Lama istirahat dan rentang mulainya diisi semua, atau dikosongkan semua.';
  if (!Number.isInteger(hours.breakMinutes) || hours.breakMinutes! < 1 || hours.breakMinutes! > 240) {
    return 'Lama istirahat harus 1 sampai 240 menit.';
  }
  if (!TIME.test(hours.breakStartFrom!) || !TIME.test(hours.breakStartUntil!)) return 'Rentang mulai istirahat harus berformat JJ:MM.';
  if (hours.breakStartFrom! > hours.breakStartUntil!) return 'Awal rentang istirahat harus sebelum akhirnya.';
  return null;
}

/** Tanggal berlaku paling cepat (KEH-02): besok; shift yang belum pernah punya jam boleh mulai hari ini karena belum ada absen. */
export function earliestEffectiveDate(today: IsoDate, hasVersion: boolean): IsoDate {
  return hasVersion ? addDays(today, 1) : today;
}

/** Jam tutup toko turunan: jam pulang shift terakhir, tidak disimpan (KEH-71, W5). */
export function closingTime(shifts: readonly { position: number; endTime: string | null }[]): string | null {
  const withHours = shifts.filter((shift) => shift.endTime != null);
  if (!withHours.length) return null;
  return withHours.reduce((last, shift) => (shift.position > last.position ? shift : last)).endTime;
}

export type ClosureRange = { startDate: IsoDate; endDate: IsoDate; branchId: number | null };

/** Hari tutup berlaku untuk cabang pada tanggal itu; cabang kosong = semua cabang. */
export function closureCovers(closure: ClosureRange, branchId: number, on: IsoDate): boolean {
  return (closure.branchId == null || closure.branchId === branchId) && closure.startDate <= on && on <= closure.endDate;
}

export function closuresOverlap(a: ClosureRange, b: ClosureRange): boolean {
  const sameScope = a.branchId == null || b.branchId == null || a.branchId === b.branchId;
  return sameScope && a.startDate <= b.endDate && b.startDate <= a.endDate;
}

export const ATTENDANCE_MODES = ['QR', 'TRIP', 'NONE'] as const;
export type AttendanceMode = (typeof ATTENDANCE_MODES)[number];

/** Isi QR: tautan yang dibuka kamera HP. */
export function qrLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, '')}/absen?c=${encodeURIComponent(code)}`;
}
