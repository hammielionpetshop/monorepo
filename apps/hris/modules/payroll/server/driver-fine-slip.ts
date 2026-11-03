import { and, asc, eq, gte, inArray, like, lte, or, sql } from 'drizzle-orm';
import { deductionCarryovers, driverFineKinds, driverFines, payslipLines, payslips } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { dayLabel } from '@/modules/logistics';
import type { DeductionInput, IncomeInput } from '../rules/payslip';
import type { IsoDate } from '../rules/salary';
import { slippedSourceKeys } from './slip-state';

// Denda driver & kenek di slip utama (spec L7 §3.6, L7c): kelompok a, satu baris per denda (`fine:<id>`). Denda yang
// ditiadakan sesudah terpotong dikembalikan sebagai pendapatan `refund:<kunci>` di slip utama berikutnya (keluar Dana Disiplin).

const LINK = '/gaji/denda-driver';

/** Denda Berlaku orang itu dengan tanggal kejadian di rentang itu yang belum terpotong di slip tertutup. */
export async function fineSlipItems(employeeId: number, range: { from?: IsoDate; to: IsoDate }, origin: (occurredOn: IsoDate) => IsoDate | null): Promise<DeductionInput[]> {
  const rows = await db.select({ fine: driverFines, kindName: driverFineKinds.name }).from(driverFines)
    .innerJoin(driverFineKinds, eq(driverFineKinds.id, driverFines.kindId))
    .where(and(eq(driverFines.employeeId, employeeId), eq(driverFines.status, 'ACTIVE'), lte(driverFines.occurredOn, range.to),
      ...(range.from ? [gte(driverFines.occurredOn, range.from)] : [])))
    .orderBy(asc(driverFines.occurredOn), asc(driverFines.id));
  const items: DeductionInput[] = rows.map(({ fine, kindName }) => ({
    group: 'a', sourceKey: `fine:${fine.id}`, lineKind: 'DRIVER_FINE', label: `Denda ${kindName.toLowerCase()} · ${dayLabel(fine.occurredOn)}`,
    date: fine.occurredOn, amount: fine.amount, originPeriod: origin(fine.occurredOn), details: { date: fine.occurredOn, text: fine.description, link: LINK },
  }));
  const done = await slippedSourceKeys(items.map((i) => i.sourceKey), employeeId);
  return items.filter((i) => !done.has(i.sourceKey));
}

async function waivedFineIds(ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const rows = await db.select({ id: driverFines.id }).from(driverFines).where(and(inArray(driverFines.id, ids), eq(driverFines.status, 'WAIVED')));
  return new Set(rows.map((r) => r.id));
}

const fineIdOf = (key: string | null) => (key && /^fine:\d+$/.test(key) ? Number(key.slice(5)) : null);

/** Sisa denda yang dibawa dari slip sebelumnya tapi dendanya sudah ditiadakan: tidak dipotong lagi (ditandai batal saat ditutup). */
export async function waivedFineCarries(carries: readonly { id: number; sourceKey: string | null }[]): Promise<Set<number>> {
  const waived = await waivedFineIds(carries.map((c) => fineIdOf(c.sourceKey)).filter((id): id is number => id != null));
  return new Set(carries.filter((c) => {
    const id = fineIdOf(c.sourceKey);
    return id != null && waived.has(id);
  }).map((c) => c.id));
}

/**
 * Pengembalian denda yang ditiadakan sesudah terpotong: sebesar yang terpotong di slip tertutup mana pun (langsung atau
 * lewat sisa dibawa), dikurangi pengembalian yang sudah masuk slip tertutup. Hanya dipanggil untuk slip utama Perkiraan paling awal.
 */
export async function fineRefundItems(employeeId: number): Promise<IncomeInput[]> {
  const closed = await db.select({ line: payslipLines }).from(payslipLines).innerJoin(payslips, eq(payslips.id, payslipLines.payslipId))
    .where(and(eq(payslipLines.employeeId, employeeId), eq(payslipLines.status, 'ACTIVE'), eq(payslips.status, 'CLOSED'), sql`${payslipLines.version} = ${payslips.version}`,
      or(like(payslipLines.sourceKey, 'fine:%'), like(payslipLines.sourceKey, 'carry:%'), like(payslipLines.sourceKey, 'refund:%'))))
    .then((rows) => rows.map((r) => r.line));
  const carryIds = closed.filter((l) => l.sourceKey.startsWith('carry:') && l.lineKind === 'DRIVER_FINE').map((l) => Number(l.sourceKey.slice(6)));
  const carrySource = new Map<number, string | null>();
  if (carryIds.length) {
    for (const c of await db.select({ id: deductionCarryovers.id, sourceKey: deductionCarryovers.sourceKey }).from(deductionCarryovers).where(inArray(deductionCarryovers.id, carryIds))) {
      carrySource.set(c.id, c.sourceKey);
    }
  }
  const taken = closed.filter((l) => l.section === 'DEDUCTION' && l.taken > 0 && l.lineKind === 'DRIVER_FINE');
  const sourceOf = (key: string) => (key.startsWith('carry:') ? carrySource.get(Number(key.slice(6))) ?? null : key);
  const waived = await waivedFineIds(taken.map((l) => fineIdOf(sourceOf(l.sourceKey))).filter((id): id is number => id != null));
  const refunded = new Map<string, number>();
  for (const l of closed.filter((x) => x.section === 'INCOME' && x.sourceKey.startsWith('refund:'))) {
    const key = l.sourceKey.slice('refund:'.length);
    refunded.set(key, (refunded.get(key) ?? 0) + l.amount);
  }
  const out: IncomeInput[] = [];
  for (const l of taken) {
    const source = sourceOf(l.sourceKey);
    const id = fineIdOf(source);
    if (id == null || !waived.has(id)) continue;
    const amount = l.taken - (refunded.get(l.sourceKey) ?? 0);
    if (amount <= 0) continue;
    out.push({
      sourceKey: `refund:${l.sourceKey}`, lineKind: 'DRIVER_FINE', label: `Pengembalian ${l.label.charAt(0).toLowerCase()}${l.label.slice(1)}`, amount,
      originPeriod: l.originPeriod, details: { text: 'Denda ini ditiadakan sesudah terpotong.', originKey: source!, link: LINK },
    });
  }
  return out;
}
