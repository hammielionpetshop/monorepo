import { settingVersions } from '@/modules/settings';
import { weekOf, weekRegimes, type WeekRange, type WeekRegime } from '../rules/week';
import type { IsoDate } from '../rules/trip';

/** Rezim hari awal minggu upah dari riwayat pengaturan `payroll.weekly_start_day` (spec L7 §3.7). */
export async function loadWeekRegimes(): Promise<WeekRegime[]> {
  return weekRegimes(await settingVersions('payroll.weekly_start_day'));
}

/** Minggu upah yang memuat tanggal itu. */
export async function wageWeekOf(date: IsoDate): Promise<WeekRange> {
  return weekOf(date, await loadWeekRegimes());
}
