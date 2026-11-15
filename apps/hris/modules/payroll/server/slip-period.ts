import { loadWeekRegimes, weekOf, type WeekRange, type WeekRegime } from '@/modules/logistics';
import { settingOn } from '@/modules/settings';
import { longDate, periodEndOf, type IsoDate } from '../rules/salary';
import { isWeeklyKind, weeklyCloseOpensAt } from '../rules/wage-week';

// Periode slip bulanan (26–25) dan mingguan (minggu upah bertanggal) dalam satu bentuk, untuk layar dan langkah slip.
// Kalender minggu upah (hari awal minggu bertanggal) dibaca dari modul Logistik.

export { loadWeekRegimes };

/** Jendela tutup slip mingguan (spec L7 §3.5): sehari sesudah minggu berakhir, jam dari pengaturan. */
export async function weeklyCloseOpens(end: IsoDate): Promise<Date> {
  const hour = Number(await settingOn<number>('payroll.weekly_close_open_hour', end));
  return weeklyCloseOpensAt(end, Number.isInteger(hour) ? hour : 10);
}

/** Rentang tanggal slip: bulanan 26–25; mingguan menurut hari awal minggu yang berlaku. */
export async function slipRange(slip: { kind: string; periodStart: IsoDate }, regimes?: WeekRegime[]): Promise<WeekRange> {
  if (!isWeeklyKind(slip.kind)) return { start: slip.periodStart, end: periodEndOf(slip.periodStart) };
  return weekOf(slip.periodStart, regimes ?? await loadWeekRegimes());
}

export type SlipPeriodRow = { kind: string; periodStart: IsoDate; periodEnd: IsoDate | null };

/** Akhir slip dari baris tersimpan (mingguan: `period_end`; bulanan: tanggal 25 berikutnya). */
export const slipEndOf = (slip: SlipPeriodRow): IsoDate => (isWeeklyKind(slip.kind) && slip.periodEnd ? slip.periodEnd : periodEndOf(slip.periodStart));

/** "periode 26 Oktober 2026 – 25 November 2026" atau "minggu 30 Oktober 2026 – 5 November 2026", tanpa kueri. */
export function slipPhrase(slip: SlipPeriodRow): string {
  const range = `${longDate(slip.periodStart)} – ${longDate(slipEndOf(slip))}`;
  return isWeeklyKind(slip.kind) ? `minggu ${range}` : `periode ${range}`;
}

/** Label rentang tanpa awalan, untuk kolom "Periode". */
export const slipRangeText = (slip: SlipPeriodRow): string => `${longDate(slip.periodStart)} – ${longDate(slipEndOf(slip))}`;
