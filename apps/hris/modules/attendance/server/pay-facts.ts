import { and, eq, gte, lte, ne } from 'drizzle-orm';
import { dayOffMissingMarks, dayOffWorkRequests } from '@petshop/hris-db/schema/attendance';
import { db } from '@/lib/db';
import { wibDate } from '../rules/attendance';
import type { ForgotKind } from '../rules/clarification';
import { payPeriodOf } from '../rules/review';
import type { IsoDate } from '../rules/schedule';
import { payClarificationFacts, type PayForgot } from './clarification';
import { overtimeByDay } from './overtime';
import { payDayCards, type PayDayCard } from './review';

/**
 * Semua yang terjadi di Kehadiran untuk satu orang dalam satu periode gaji (spec L4b §3.2). Kehadiran hanya
 * menyerahkan fakta (menit, status, jam, kejadian ke-n); rupiahnya dihitung modul Gaji.
 */
export type PayFacts = {
  /** false = jabatannya tidak diabsen QR: tidak ada potongan/tambahan kehadiran. */
  tracked: boolean;
  days: PayDayCard[];
  lateExplained: IsoDate[];
  overtime: { workDate: IsoDate; hours: number }[];
  forgot: PayForgot[];
  dayOffMissing: boolean;
  /** Diminta masuk di hari libur (tidak dibatalkan) dan apakah benar-benar masuk. */
  workRequests: { workDate: IsoDate; present: boolean }[];
};

export type { ForgotKind, PayForgot, PayDayCard };

export async function payFacts(employeeId: number, periodStart: IsoDate, now: Date = new Date()): Promise<PayFacts> {
  const period = payPeriodOf(periodStart);
  const today = wibDate(now);
  const until = period.end < today ? period.end : today;
  const days = await payDayCards(employeeId, period, now);
  if (!days) return { tracked: false, days: [], lateExplained: [], overtime: [], forgot: [], dayOffMissing: false, workRequests: [] };
  const [clarification, overtime, missing, requests] = await Promise.all([
    payClarificationFacts(employeeId, period.start, period.end),
    overtimeByDay([employeeId], period.start, period.end),
    db.select({ id: dayOffMissingMarks.id }).from(dayOffMissingMarks)
      .where(and(eq(dayOffMissingMarks.employeeId, employeeId), eq(dayOffMissingMarks.periodStart, period.start))),
    db.select({ workDate: dayOffWorkRequests.workDate }).from(dayOffWorkRequests).where(and(
      eq(dayOffWorkRequests.employeeId, employeeId), ne(dayOffWorkRequests.status, 'CANCELLED'),
      gte(dayOffWorkRequests.workDate, period.start), lte(dayOffWorkRequests.workDate, until),
    )),
  ]);
  const present = new Set(days.filter((day) => day.status === 'PRESENT').map((day) => day.workDate));
  return {
    tracked: true,
    days,
    lateExplained: [...clarification.lateExplained].sort(),
    overtime: [...overtime.entries()]
      .map(([key, totals]) => ({ workDate: key.split('|')[1], hours: totals.approved }))
      .filter((row) => row.hours > 0)
      .sort((a, b) => (a.workDate < b.workDate ? -1 : 1)),
    forgot: clarification.forgot,
    dayOffMissing: missing.length > 0,
    workRequests: requests.map((row) => ({ workDate: row.workDate, present: present.has(row.workDate) })).sort((a, b) => (a.workDate < b.workDate ? -1 : 1)),
  };
}
