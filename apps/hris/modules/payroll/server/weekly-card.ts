import { and, eq, inArray } from 'drizzle-orm';
import { payslips } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import type { Actor } from '@/modules/access';
import { longDate, rupiah } from '../rules/salary';
import { weekKey, weeklyPayDate, type SlipKind } from '../rules/wage-week';
import { slipPerson } from './payslip';
import { computeWeeklySlip, currentWeek } from './weekly-slip';

/**
 * Kartu Beranda "Upah Minggu Ini" (spec L7 §4): untuk orang yang punya slip mingguan minggu berjalan, perkiraan bersih
 * dan jatuh bayarnya. Angka dari `computeWeeklySlip` yang sama dengan slip.
 */
export async function weeklyPayCard(actor: Actor | null, now: Date = new Date()) {
  if (!actor) return null;
  const week = await currentWeek(now);
  const [slip] = await db.select().from(payslips)
    .where(and(eq(payslips.employeeId, actor.personId), eq(payslips.periodStart, week.start), inArray(payslips.kind, ['WEEKLY', 'WEEKLY_EXTRA'])));
  if (!slip) return null;
  const person = await slipPerson(slip);
  if (!person) return null;
  const result = await computeWeeklySlip(person, { kind: slip.kind as SlipKind, periodStart: week.start }, now);
  const rows = result.tripValueIds.length;
  return {
    title: `Upah minggu ini: ${rupiah(result.computation.net)} (perkiraan)`,
    detail: `${rows} baris upah · ${longDate(week.start)} – ${longDate(week.end)} · dibayar ${longDate(weeklyPayDate(week.end))}`,
    href: `/pendapatan?periode=${weekKey(week.start)}`,
  };
}
