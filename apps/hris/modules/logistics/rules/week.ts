// Kalender minggu upah driver & kenek (DRV-19, spec L7 §3.5): hari awal minggu bertanggal, dipakai Logistik (Trip Saya,
// Ritase) dan Gaji (Upah Ritase, slip mingguan). Pengaturannya `payroll.weekly_start_day`, bawaan Jumat.
import { addDays, type IsoDate } from './trip';

export const WEEKDAYS = [
  { value: 'MON', label: 'Senin' },
  { value: 'TUE', label: 'Selasa' },
  { value: 'WED', label: 'Rabu' },
  { value: 'THU', label: 'Kamis' },
  { value: 'FRI', label: 'Jumat' },
  { value: 'SAT', label: 'Sabtu' },
  { value: 'SUN', label: 'Minggu' },
] as const;
export type Weekday = (typeof WEEKDAYS)[number]['value'];

const DOW: Record<Weekday, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

export const DEFAULT_WEEK_DAY: Weekday = 'FRI';

export const isWeekday = (v: unknown): v is Weekday => typeof v === 'string' && v in DOW;
export const weekdayLabel = (day: Weekday): string => WEEKDAYS.find((w) => w.value === day)!.label;

const dowOf = (date: IsoDate) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** Tanggal pertama pada/sesudah `date` yang jatuh pada hari `day`. */
export function onOrAfter(date: IsoDate, day: Weekday): IsoDate {
  return addDays(date, (DOW[day] - dowOf(date) + 7) % 7);
}

/** Tanggal terakhir pada/sebelum `date` yang jatuh pada hari `day`. */
export function onOrBefore(date: IsoDate, day: Weekday): IsoDate {
  return addDays(date, -((dowOf(date) - DOW[day] + 7) % 7));
}

/**
 * Rezim hari awal minggu. `boundary` = hari pertama rezim itu (null = sejak dulu). Perubahan pengaturan berlaku mulai hari
 * bersangkutan pertama pada/sesudah tanggal berlakunya; minggu yang sedang berjalan dipotong sehari sebelumnya (minggu
 * peralihan lebih pendek, tidak pernah lebih dari 7 hari).
 */
export type WeekRegime = { boundary: IsoDate | null; day: Weekday };

export function weekRegimes(versions: readonly { from: IsoDate; value: unknown }[]): WeekRegime[] {
  const sorted = [...versions].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  const out: WeekRegime[] = [];
  for (const v of sorted) {
    const day = isWeekday(v.value) ? v.value : DEFAULT_WEEK_DAY;
    if (!out.length) { out.push({ boundary: null, day }); continue; }
    const boundary = onOrAfter(v.from, day);
    // Dua perubahan berdekatan: yang lebih baru menggantikan rezim yang belum sempat dimulai.
    while (out.length > 1 && out[out.length - 1].boundary! >= boundary) out.pop();
    if (out[out.length - 1].day === day) continue;
    out.push({ boundary, day });
  }
  return out.length ? out : [{ boundary: null, day: DEFAULT_WEEK_DAY }];
}

export type WeekRange = { start: IsoDate; end: IsoDate };

/** Minggu upah yang memuat `date`. */
export function weekOf(date: IsoDate, regimes: readonly WeekRegime[]): WeekRange {
  let i = 0;
  for (let k = 0; k < regimes.length; k += 1) if (regimes[k].boundary == null || regimes[k].boundary! <= date) i = k;
  const start = onOrBefore(date, regimes[i].day);
  let end = addDays(start, 6);
  const next = regimes[i + 1];
  if (next && end >= next.boundary!) end = addDays(next.boundary!, -1);
  return { start, end };
}

export const nextWeek = (start: IsoDate, regimes: readonly WeekRegime[]): WeekRange => weekOf(addDays(weekOf(start, regimes).end, 1), regimes);
export const prevWeek = (start: IsoDate, regimes: readonly WeekRegime[]): WeekRange => weekOf(addDays(start, -1), regimes);

/** Awal minggu dari minggu `from` sampai minggu `to`, terbaru dulu. */
export function weekStartsBetween(from: IsoDate, to: IsoDate, regimes: readonly WeekRegime[]): IsoDate[] {
  const out: IsoDate[] = [];
  const first = weekOf(from, regimes).start;
  for (let w = weekOf(to, regimes); w.start >= first; w = prevWeek(w.start, regimes)) out.push(w.start);
  return out;
}
