import { and, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import {
  attendanceDays, attendanceRecords, attendanceReviews, clarificationEventLinks, clarificationEvents, clarifications, dayOffMissingMarks, dayOffWorkRequests,
  overtimeClaims, overtimeDays,
} from '@petshop/hris-db/schema/attendance';
import { requests } from '@petshop/hris-db/schema/requests';
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

/**
 * Urusan Kehadiran yang menahan slip (spec L4e §3.3, GAJ-93 penahan 1–3) untuk beberapa orang dalam satu rentang tanggal:
 * absen di luar titik belum diputus, penjelasan Menunggu, klaim lembur Menunggu. Hanya jumlah dan tanggal tertua.
 */
export type SlipHoldFacts = { outsideReviews: IsoDate[]; clarifications: IsoDate[]; overtimeClaims: IsoDate[] };

export async function slipHoldFacts(employeeIds: number[], from: IsoDate, to: IsoDate): Promise<Map<number, SlipHoldFacts>> {
  const result = new Map<number, SlipHoldFacts>();
  if (!employeeIds.length) return result;
  const of = (id: number) => {
    if (!result.has(id)) result.set(id, { outsideReviews: [], clarifications: [], overtimeClaims: [] });
    return result.get(id)!;
  };
  const [outside, clar, overtime] = await Promise.all([
    db.select({ employeeId: attendanceDays.employeeId, workDate: attendanceDays.workDate }).from(attendanceRecords)
      .innerJoin(attendanceDays, eq(attendanceDays.id, attendanceRecords.dayId))
      .where(and(eq(attendanceRecords.needsReview, true), gte(attendanceDays.workDate, from), lte(attendanceDays.workDate, to),
        inArray(attendanceDays.employeeId, employeeIds),
        sql`not exists (select 1 from ${attendanceReviews} r where r.record_id = ${attendanceRecords.id})`)),
    db.select({ employeeId: clarificationEvents.employeeId, workDate: clarificationEvents.workDate }).from(clarificationEventLinks)
      .innerJoin(clarificationEvents, eq(clarificationEvents.id, clarificationEventLinks.eventId))
      .innerJoin(clarifications, eq(clarifications.id, clarificationEventLinks.clarificationId))
      .innerJoin(requests, eq(requests.id, clarifications.requestId))
      .where(and(eq(clarificationEventLinks.active, true), inArray(requests.status, ['PENDING', 'REVIEWED']),
        gte(clarificationEvents.workDate, from), lte(clarificationEvents.workDate, to), inArray(clarificationEvents.employeeId, employeeIds))),
    db.select({ employeeId: overtimeDays.employeeId, workDate: overtimeDays.workDate }).from(overtimeClaims)
      .innerJoin(overtimeDays, eq(overtimeDays.id, overtimeClaims.overtimeDayId))
      .innerJoin(requests, eq(requests.id, overtimeClaims.requestId))
      .where(and(eq(overtimeClaims.active, true), inArray(requests.status, ['PENDING', 'REVIEWED']),
        gte(overtimeDays.workDate, from), lte(overtimeDays.workDate, to), inArray(overtimeDays.employeeId, employeeIds))),
  ]);
  for (const row of outside) of(row.employeeId).outsideReviews.push(row.workDate);
  for (const row of clar) of(row.employeeId).clarifications.push(row.workDate);
  for (const row of overtime) of(row.employeeId).overtimeClaims.push(row.workDate);
  return result;
}
