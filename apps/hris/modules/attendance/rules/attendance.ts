/** Aturan murni Absen dan Istirahat (spec L3b §3). Tanggal = YYYY-MM-DD WIB, jam = HH:MM. Tanpa DB. */
import { addDays, type IsoDate } from './schedule';

export const ATTENDANCE_KINDS = ['IN', 'BREAK', 'RETURN', 'OUT'] as const;
export type AttendanceKind = (typeof ATTENDANCE_KINDS)[number];

export const KIND_LABELS: Record<AttendanceKind, string> = { IN: 'Masuk', BREAK: 'Istirahat', RETURN: 'Masuk Kembali', OUT: 'Pulang' };

const WIB_OFFSET_MS = 7 * 3_600_000;
const MINUTE_MS = 60_000;

/** Instan dari tanggal + jam WIB. */
export function wibInstant(date: IsoDate, time: string): Date {
  return new Date(`${date}T${time.slice(0, 5)}:00+07:00`);
}

export function wibDate(at: Date): IsoDate {
  return new Date(at.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** HH.MM WIB, bentuk jam di pesan layar. */
export function wibClock(at: Date): string {
  return new Date(at.getTime() + WIB_OFFSET_MS).toISOString().slice(11, 16).replace(':', '.');
}

const wholeMinutes = (ms: number) => Math.max(0, Math.floor(ms / MINUTE_MS));

/** Jarak dua titik dalam meter (haversine), dibulatkan. */
export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

/** Titik GPS yang masuk akal; selain ini diperlakukan seperti tanpa lokasi. */
export function validPoint(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === 'number' && typeof longitude === 'number'
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

/** Masih dalam batas absen pulang hari kerja `workDate`? Sampai jam batas keesokan hari (KEH-18, W11). */
export function withinOutCutoff(workDate: IsoDate, at: Date, cutoffHour: number): boolean {
  return at < wibInstant(addDays(workDate, 1), `${String(cutoffHour).padStart(2, '0')}:00`);
}

/** Jam Masuk mulai dibuka (KEH-111). */
export function earliestIn(workDate: IsoDate, startTime: string, earliestMinutes: number): Date {
  return new Date(wibInstant(workDate, startTime).getTime() - earliestMinutes * MINUTE_MS);
}

/** Jam Pulang mulai dibuka (KEH-17). */
export function earliestOut(inAt: Date, minOutMinutes: number): Date {
  return new Date(inAt.getTime() + minOutMinutes * MINUTE_MS);
}

/** Telat, dibulatkan ke bawah per menit (spec L3b §9 butir 7, KEH-21). */
export function lateMinutes(workDate: IsoDate, startTime: string, inAt: Date): number {
  return wholeMinutes(inAt.getTime() - wibInstant(workDate, startTime).getTime());
}

/** Pulang cepat (KEH-24). Jam pulang lebih kecil dari jam masuk berarti keesokan hari. */
export function earlyLeaveMinutes(workDate: IsoDate, startTime: string, endTime: string, outAt: Date): number {
  const endDate = endTime.slice(0, 5) <= startTime.slice(0, 5) ? addDays(workDate, 1) : workDate;
  return wholeMinutes(wibInstant(endDate, endTime).getTime() - outAt.getTime());
}

/** Lewat batas istirahat (KEH-86, W14). */
export function breakOverMinutes(breakAt: Date, returnAt: Date, breakLength: number): number {
  return Math.max(0, wholeMinutes(returnAt.getTime() - breakAt.getTime()) - breakLength);
}

/** Rentang jam mulai istirahat berlaku pada `at`? Rentang lewat tengah malam didukung. */
export function withinBreakWindow(workDate: IsoDate, from: string, until: string, at: Date): boolean {
  const start = wibInstant(workDate, from);
  const end = wibInstant(until.slice(0, 5) < from.slice(0, 5) ? addDays(workDate, 1) : workDate, until);
  return at >= start && at <= end;
}

export type DayHours = {
  startTime: string; endTime: string; breakMinutes: number | null; breakStartFrom: string | null; breakStartUntil: string | null;
};

export type ScreenInput = {
  now: Date;
  workDate: IsoDate;
  /** Jam kejadian hari kerja ini, per jenis. */
  times: Partial<Record<AttendanceKind, Date>>;
  hours: DayHours | null;
  breakRequired: boolean;
  closed: boolean;
  /** Libur terjadwal tanpa permintaan masuk yang berlaku (KEH-113, 137). */
  dayOff?: boolean;
  hasPoint: boolean;
  earliestInMinutes: number;
  minOutMinutes: number;
};

export type ScreenState = {
  status: 'NOT_IN' | 'TOO_EARLY' | 'CLOSED' | 'DAY_OFF' | 'NO_POINT' | 'IN' | 'ON_BREAK' | 'OUT';
  buttons: AttendanceKind[];
  /** Pesan jam: buka Masuk, atau Pulang abu-abu. */
  opensAt: string | null;
  outLocked: boolean;
};

/** Tombol yang berlaku saat ini saja (KEH-17, 83, 108, tabel KEH-L06). Tidak menebak dari urutan pindai. */
export function screenState(input: ScreenInput): ScreenState {
  const { now, times, hours } = input;
  const state = (status: ScreenState['status'], buttons: AttendanceKind[] = [], opensAt: string | null = null, outLocked = false): ScreenState => (
    { status, buttons, opensAt, outLocked }
  );
  if (times.OUT) return state('OUT');
  if (times.BREAK && !times.RETURN) return state('ON_BREAK', ['RETURN']);
  if (times.IN) {
    const buttons: AttendanceKind[] = [];
    const canBreak = input.breakRequired && !times.BREAK && hours?.breakMinutes != null && hours.breakStartFrom && hours.breakStartUntil
      && withinBreakWindow(input.workDate, hours.breakStartFrom, hours.breakStartUntil, now);
    if (canBreak) buttons.push('BREAK');
    const opens = earliestOut(times.IN, input.minOutMinutes);
    buttons.push('OUT');
    return state('IN', buttons, now < opens ? wibClock(opens) : null, now < opens);
  }
  if (!input.hasPoint) return state('NO_POINT');
  if (input.closed) return state('CLOSED');
  if (input.dayOff) return state('DAY_OFF');
  if (hours) {
    const opens = earliestIn(input.workDate, hours.startTime, input.earliestInMinutes);
    if (now < opens) return state('TOO_EARLY', [], wibClock(opens));
  }
  return state('NOT_IN', ['IN']);
}

export type GuardPerson = { employeeId: number; name: string; onBreakUntil: string | null };

/**
 * Cabang tidak boleh kosong penjaga (KEH-85, 112). `others` = penjaga lain yang sudah masuk di cabang itu dan belum pulang.
 * Dipanggil hanya bila yang menekan berjabatan penjaga.
 */
export function guardDecision(others: readonly GuardPerson[], minimum: number):
  | { ok: true } | { ok: false; reason: 'ALONE' } | { ok: false; reason: 'FRIEND_ON_BREAK'; friend: GuardPerson } {
  const onDuty = others.filter((person) => !person.onBreakUntil).length;
  if (onDuty >= minimum) return { ok: true };
  const friend = others.find((person) => person.onBreakUntil);
  return friend ? { ok: false, reason: 'FRIEND_ON_BREAK', friend } : { ok: false, reason: 'ALONE' };
}

/** Shift perbantuan: nama sama di cabang tujuan, tidak peka huruf besar (KEH-109, W13). */
export function matchAssistShift<T extends { name: string }>(ownShiftName: string | null, targetShifts: readonly T[]): T | null {
  if (!ownShiftName) return null;
  const wanted = ownShiftName.trim().toLowerCase();
  return targetShifts.find((shift) => shift.name.trim().toLowerCase() === wanted) ?? null;
}

/** Hasil langkah lokasi berlaku sekian menit sebelum diminta mengulang (spec L3b §3). */
export const LOCATION_FRESH_MINUTES = 5;

export function locationFresh(attemptAt: Date, now: Date): boolean {
  return now.getTime() - attemptAt.getTime() <= LOCATION_FRESH_MINUTES * MINUTE_MS;
}
