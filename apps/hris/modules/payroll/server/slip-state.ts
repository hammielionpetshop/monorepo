import { and, eq, inArray, sql } from 'drizzle-orm';
import { payslipLines, payslips } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import type { IsoDate } from '../rules/salary';
import type { Executor } from './data';

// Keadaan slip tertutup yang dibaca modul Gaji lain (spec L4e §3.6). Tanpa impor ke penghitung slip supaya tidak melingkar.

/**
 * Kunci sesudah slip ditutup (§9 butir 2: per orang). Dengan `employeeId`: slip orang itu di periode itu sudah ditutup.
 * Tanpa orang (catatan yang dibagi ke banyak orang): ada slip periode itu yang sudah ditutup.
 */
export async function isPeriodLocked(periodStart: IsoDate, employeeId: number | null = null, executor: Executor = db): Promise<boolean> {
  const [row] = await executor.select({ id: payslips.id }).from(payslips)
    .where(and(eq(payslips.periodStart, periodStart), eq(payslips.kind, 'MONTHLY'), eq(payslips.status, 'CLOSED'), employeeId != null ? eq(payslips.employeeId, employeeId) : undefined))
    .limit(1);
  return Boolean(row);
}

/** Kunci sumber yang sudah masuk slip tertutup (baris ACTIVE). Dipakai pagar Batalkan dan tanda "terpotong". */
export async function slippedSourceKeys(keys: readonly string[], employeeId: number | null = null, executor: Executor = db): Promise<Set<string>> {
  if (!keys.length) return new Set();
  const rows = await executor.select({ key: payslipLines.sourceKey }).from(payslipLines)
    .innerJoin(payslips, eq(payslips.id, payslipLines.payslipId))
    .where(and(inArray(payslipLines.sourceKey, [...keys]), eq(payslipLines.status, 'ACTIVE'), eq(payslips.status, 'CLOSED'),
      sql`${payslipLines.version} = ${payslips.version}`, employeeId != null ? eq(payslipLines.employeeId, employeeId) : undefined));
  return new Set(rows.map((r) => r.key));
}
