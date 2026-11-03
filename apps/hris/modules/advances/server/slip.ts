import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { advanceHandovers, advanceInstallments, advanceMovements, advances } from '@petshop/hris-db/schema/advances';
import { deductionCarryovers, payslipLines } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import type { Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { notify } from '@/modules/notifications';
import { remainingOf, rupiah, type IsoDate } from '../rules/advance';
import type { Executor } from './data';

// Cicilan kasbon di slip utama (spec L5 §3.8; DRV-66, 133). Dipanggil modul Gaji; modul ini tidak mengimpor Gaji.

export type AdvanceSlipItem = {
  group: 'd'; sourceKey: string; lineKind: 'ADVANCE'; label: string; date: IsoDate; amount: number; originPeriod: IsoDate | null;
  details: { text: string; link: string };
};

const KEY = 'adv:';
export const isAdvanceKey = (key: string | null | undefined): boolean => Boolean(key?.startsWith(KEY));
const installmentIdOf = (key: string) => Number(key.slice(KEY.length));

/**
 * "Cicilan jatuh tempo (orang, slip)" (DRV-133): cicilan Terjadwal yang tujuannya periode-periode slip ini, semua kasbon
 * orang itu, paling lama diberikan lebih dulu (tanggal = tanggal uang). Slip terakhir (DRV-139): semua cicilan Terjadwal.
 */
export async function advanceSlipItems(employeeId: number, periods: readonly IsoDate[], periodStart: IsoDate, last: boolean, executor: Executor = db): Promise<AdvanceSlipItem[]> {
  const rows = await executor.select({ installment: advanceInstallments, number: advances.number, moneyDate: advanceHandovers.moneyDate, handed: advanceHandovers.amount, advanceId: advances.id })
    .from(advanceInstallments)
    .innerJoin(advances, eq(advances.id, advanceInstallments.advanceId))
    .innerJoin(advanceHandovers, and(eq(advanceHandovers.advanceId, advances.id), eq(advanceHandovers.status, 'ACTIVE')))
    .where(and(eq(advances.employeeId, employeeId), eq(advanceInstallments.status, 'SCHEDULED'), isNotNull(advanceInstallments.periodStart),
      last ? undefined : inArray(advanceInstallments.periodStart, [...periods])));
  if (!rows.length) return [];
  const moves = await executor.select().from(advanceMovements).where(inArray(advanceMovements.advanceId, [...new Set(rows.map((r) => r.advanceId))]));
  return rows.map(({ installment, number, moneyDate, handed, advanceId }) => {
    const before = remainingOf(handed, moves.filter((m) => m.advanceId === advanceId));
    const early = last && installment.periodStart! > periodStart;
    return {
      group: 'd' as const, sourceKey: `${KEY}${installment.id}`, lineKind: 'ADVANCE' as const,
      label: `Kasbon ${number}, cicilan ${installment.sequence} dari ${installment.total}${early ? ', dipercepat karena slip terakhir' : ''}`,
      date: moneyDate, amount: installment.amount, originPeriod: installment.periodStart === periodStart || early ? null : installment.periodStart,
      details: { text: `Sisa kasbon sebelum slip ini ${rupiah(before)}.`, link: '/kasbon' },
    };
  });
}

type ClosedLine = { sourceKey: string; section: string; taken: number; remaining: number; details: { originKey?: string | null } };

/**
 * "Tandai cicilan" saat slip ditutup (DRV-133): catatan berkurang SLIP sebesar yang tertampung; cicilan Terpotong atau
 * Sebagian (yang tidak tertampung sudah menjadi sisa potongan milik Gaji). Slip terakhir: kekurangannya dialihkan ke
 * Piutang Lain (DRV-139). Orang yang kasbonnya menjadi Lunas diberi tahu.
 */
export async function markAdvanceLines(tx: Tx, input: { payslipId: number; employeeId: number; lines: readonly ClosedLine[]; last: boolean; actorAccountId: number }) {
  const touched = new Map<number, { installmentId: number; taken: number; direct: boolean; transfer: number }>();
  const carryIds: number[] = [];
  for (const line of input.lines) {
    if (line.section !== 'DEDUCTION') continue;
    let key: string | null = null;
    let direct = false;
    if (isAdvanceKey(line.sourceKey)) {
      key = line.sourceKey;
      direct = true;
    } else if (line.sourceKey.startsWith('carry:') && isAdvanceKey(line.details.originKey)) {
      key = line.details.originKey!;
      carryIds.push(Number(line.sourceKey.slice('carry:'.length)));
    }
    if (!key) continue;
    const installmentId = installmentIdOf(key);
    const cur = touched.get(installmentId) ?? { installmentId, taken: 0, direct: false, transfer: 0 };
    cur.taken += line.taken;
    cur.direct ||= direct;
    if (input.last) cur.transfer += line.remaining;
    touched.set(installmentId, cur);
  }
  if (!touched.size) return;
  const installments = await tx.select().from(advanceInstallments).where(inArray(advanceInstallments.id, [...touched.keys()]));
  for (const t of touched.values()) {
    const inst = installments.find((i) => i.id === t.installmentId);
    if (!inst) continue;
    if (t.taken > 0) {
      await tx.insert(advanceMovements).values({ advanceId: inst.advanceId, kind: 'SLIP', amount: t.taken, payslipId: input.payslipId, installmentId: inst.id, recordedByAccountId: input.actorAccountId });
    }
    if (t.transfer > 0) {
      await tx.insert(advanceMovements).values({ advanceId: inst.advanceId, kind: 'TO_RECEIVABLE', amount: t.transfer, payslipId: input.payslipId, installmentId: inst.id, recordedByAccountId: input.actorAccountId });
    }
    await refreshInstallment(tx, inst.id, inst.amount);
  }
  await notifyPaidOff(tx, [...new Set(installments.map((i) => i.advanceId))], input.employeeId, input.actorAccountId);
}

/** Terpotong bila seluruh nominalnya sudah berkurang lewat slip / dialihkan; selain itu Sebagian (sisanya dibawa). */
async function refreshInstallment(tx: Tx, installmentId: number, amount: number) {
  const moves = await tx.select().from(advanceMovements)
    .where(and(eq(advanceMovements.installmentId, installmentId), eq(advanceMovements.status, 'ACTIVE')));
  const done = moves.reduce((sum, m) => sum + m.amount, 0);
  await tx.update(advanceInstallments).set({ status: done >= amount ? 'TAKEN' : 'PARTIAL' }).where(eq(advanceInstallments.id, installmentId));
}

async function notifyPaidOff(tx: Tx, advanceIds: number[], employeeId: number, actorAccountId: number) {
  if (!advanceIds.length) return;
  const rows = await tx.select().from(advances).where(inArray(advances.id, advanceIds));
  const handovers = await tx.select().from(advanceHandovers).where(and(inArray(advanceHandovers.advanceId, advanceIds), eq(advanceHandovers.status, 'ACTIVE')));
  const moves = await tx.select().from(advanceMovements).where(inArray(advanceMovements.advanceId, advanceIds));
  const account = (await activeHrisAccounts([employeeId])).get(employeeId);
  if (!account) return;
  for (const row of rows) {
    const handover = handovers.find((h) => h.advanceId === row.id);
    if (!handover) continue;
    const own = moves.filter((m) => m.advanceId === row.id);
    if (remainingOf(handover.amount, own) !== 0) continue;
    const transferred = own.some((m) => m.kind === 'TO_RECEIVABLE' && m.status === 'ACTIVE');
    await notify(tx, [account], {
      kind: transferred ? 'advance.transferred' : 'advance.paid_off',
      title: transferred ? `Sisa kasbon ${row.number} dialihkan ke Piutang Lain karena slip terakhir.` : `Kasbon ${row.number} sudah lunas.`,
      link: '/kasbon', entity: 'advance', entityId: row.id,
    }, actorAccountId);
  }
}

/**
 * "Balik tanda" saat slip dibuka kembali (DRV-133): catatan berkurang dari slip itu Dibalik; cicilan yang pertama kali
 * muncul di slip itu kembali Terjadwal; cicilan yang terambil dari sisa dibawa kembali Sebagian.
 */
export async function unmarkAdvanceLines(tx: Tx, input: { payslipId: number; version: number; actorAccountId: number; reason: string }) {
  const lines = await tx.select({ sourceKey: payslipLines.sourceKey, details: payslipLines.details }).from(payslipLines)
    .where(and(eq(payslipLines.payslipId, input.payslipId), eq(payslipLines.version, input.version), eq(payslipLines.status, 'ACTIVE')));
  const direct = lines.filter((l) => isAdvanceKey(l.sourceKey)).map((l) => installmentIdOf(l.sourceKey));
  const reversed = await tx.update(advanceMovements).set({ status: 'REVERSED', reversedAt: new Date(), reversedByAccountId: input.actorAccountId, reversedReason: input.reason })
    .where(and(eq(advanceMovements.payslipId, input.payslipId), eq(advanceMovements.status, 'ACTIVE'))).returning();
  if (direct.length) await tx.update(advanceInstallments).set({ status: 'SCHEDULED' }).where(inArray(advanceInstallments.id, direct));
  const viaCarry = [...new Set(reversed.map((m) => m.installmentId).filter((id): id is number => id != null && !direct.includes(id)))];
  for (const id of viaCarry) {
    const [inst] = await tx.select().from(advanceInstallments).where(eq(advanceInstallments.id, id));
    if (inst) await refreshInstallment(tx, id, inst.amount);
  }
}

/** Sisa potongan kasbon yang sedang dibawa per kasbon (untuk pemeriksa "sisa = terjadwal + dibawa", DRV-131). */
export async function carriedByAdvance(executor: Executor = db): Promise<Map<number, number>> {
  const rows = await executor.select({ key: deductionCarryovers.sourceKey, amount: deductionCarryovers.amount }).from(deductionCarryovers)
    .where(eq(deductionCarryovers.status, 'CARRIED'));
  const keys = rows.filter((r) => isAdvanceKey(r.key));
  if (!keys.length) return new Map();
  const ids = keys.map((r) => installmentIdOf(r.key!));
  const insts = await executor.select({ id: advanceInstallments.id, advanceId: advanceInstallments.advanceId }).from(advanceInstallments).where(inArray(advanceInstallments.id, ids));
  const out = new Map<number, number>();
  for (const r of keys) {
    const inst = insts.find((i) => i.id === installmentIdOf(r.key!));
    if (inst) out.set(inst.advanceId, (out.get(inst.advanceId) ?? 0) + r.amount);
  }
  return out;
}
