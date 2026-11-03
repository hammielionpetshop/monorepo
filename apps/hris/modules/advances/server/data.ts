import { and, asc, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import { advanceFollowups, advanceHandovers, advanceInstallments, advanceMovements, advances } from '@petshop/hris-db/schema/advances';
import { payslips, salaryChanges } from '@petshop/hris-db/schema/payroll';
import { requests } from '@petshop/hris-db/schema/requests';
import { db } from '@/lib/db';
import type { Tx } from '@/modules/access';
import { listPeopleForModules, todayWib, type PersonForModules } from '@/modules/employees';
import { settingOn } from '@/modules/settings';
import {
  addDays, checkAdvanceFacts, periodStartOf, remainingOf, stageOf, usedOf, type AdvanceRules, type AdvanceStage, type CheckResult, type IsoDate,
} from '../rules/advance';

export type Executor = typeof db | Tx;
export type AdvanceRow = typeof advances.$inferSelect;
export type HandoverRow = typeof advanceHandovers.$inferSelect;
export type InstallmentRow = typeof advanceInstallments.$inferSelect;
export type MovementRow = typeof advanceMovements.$inferSelect;

export async function rulesOn(date: IsoDate, fund: 'MONTHLY' | 'WEEKLY' = 'MONTHLY'): Promise<AdvanceRules> {
  const read = async (key: Parameters<typeof settingOn>[0], fallback: number) => Number(await settingOn<number>(key, date)) || fallback;
  const tenure = await settingOn<number>('advance.min_tenure_months', date);
  return {
    minTenureMonths: tenure == null ? 6 : Number(tenure),
    personLimit: await read('advance.person_limit', 250_000),
    fundSize: await read(fund === 'MONTHLY' ? 'advance.fund_monthly' : 'advance.fund_weekly', 1_000_000),
    maxInstallments: await read('advance.max_installments', 3),
    reasonMin: await read('advance.reason_min_chars', 15),
    amountStep: await read('advance.amount_step', 10_000),
    amountMin: await read('advance.amount_min', 50_000),
  };
}

export async function payBasisOf(positionId: number, date: IsoDate): Promise<'MONTHLY' | 'WEEKLY' | null> {
  const basis = await settingOn<string>('position.pay_basis', date, { positionId });
  return basis === 'MONTHLY' || basis === 'WEEKLY' ? basis : null;
}

export async function personOf(employeeId: number): Promise<PersonForModules | null> {
  return (await listPeopleForModules()).find((p) => p.id === employeeId) ?? null;
}

/** Tanggal berhenti tercatat dan masih di depan (DRV-139): hari terakhir bekerja = sehari sebelum nonaktif. */
export function leavingOn(person: Pick<PersonForModules, 'lastStatus'>, today: IsoDate): IsoDate | null {
  const s = person.lastStatus;
  return s?.kind === 'DEACTIVATE' && s.effectiveOn > today ? addDays(s.effectiveOn, -1) : null;
}

/** Periode slip terakhir orang yang tanggal berhentinya tercatat (cicilan tidak dipasang melewatinya). */
export function lastPeriodOf(person: Pick<PersonForModules, 'lastStatus'>): IsoDate | null {
  const s = person.lastStatus;
  return s?.kind === 'DEACTIVATE' ? periodStartOf(addDays(s.effectiveOn, -1)) : null;
}

async function hasPackageOn(employeeId: number, date: IsoDate, executor: Executor = db): Promise<boolean> {
  const [row] = await executor.select({ id: salaryChanges.id }).from(salaryChanges)
    .where(and(eq(salaryChanges.employeeId, employeeId), lte(salaryChanges.effectiveFrom, date), isNull(salaryChanges.cancelledAt))).limit(1);
  return Boolean(row);
}

export type AdvanceView = {
  row: AdvanceRow;
  requestStatus: string | null;
  handover: HandoverRow | null;
  installments: InstallmentRow[];
  movements: MovementRow[];
  remaining: number;
  stage: AdvanceStage;
  used: number;
};

/** Kasbon beserta serah uang Berlaku, jadwal versi berlaku, dan catatan berkurang; keadaannya dihitung (DRV-67, 71). */
export async function loadAdvances(filter: { ids?: number[]; employeeIds?: number[] } = {}, executor: Executor = db): Promise<AdvanceView[]> {
  const where = filter.ids ? inArray(advances.id, filter.ids.length ? filter.ids : [-1])
    : filter.employeeIds ? inArray(advances.employeeId, filter.employeeIds.length ? filter.employeeIds : [-1]) : undefined;
  const rows = await executor.select({ advance: advances, requestStatus: requests.status }).from(advances)
    .leftJoin(requests, eq(requests.id, advances.requestId)).where(where).orderBy(asc(advances.id));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.advance.id);
  const [handovers, installments, movements] = await Promise.all([
    executor.select().from(advanceHandovers).where(and(inArray(advanceHandovers.advanceId, ids), eq(advanceHandovers.status, 'ACTIVE'))),
    executor.select().from(advanceInstallments).where(inArray(advanceInstallments.advanceId, ids)).orderBy(asc(advanceInstallments.version), asc(advanceInstallments.sequence)),
    executor.select().from(advanceMovements).where(inArray(advanceMovements.advanceId, ids)).orderBy(asc(advanceMovements.id)),
  ]);
  return rows.map(({ advance, requestStatus }) => {
    const handover = handovers.find((h) => h.advanceId === advance.id) ?? null;
    const own = installments.filter((i) => i.advanceId === advance.id);
    const version = own.reduce((max, i) => Math.max(max, i.version), 0);
    const current = own.filter((i) => i.version === version || i.status === 'TAKEN' || i.status === 'PARTIAL');
    const moves = movements.filter((m) => m.advanceId === advance.id);
    const remaining = handover ? remainingOf(handover.amount, moves) : 0;
    const transferred = moves.some((m) => m.kind === 'TO_RECEIVABLE' && m.status === 'ACTIVE');
    const stage = stageOf({ state: advance.state, requestStatus: requestStatus ?? null, handedOver: Boolean(handover), remaining, transferred });
    const used = usedOf({ kind: advance.kind, state: advance.state, requestedAmount: advance.requestedAmount, finalAmount: advance.finalAmount, handedOver: Boolean(handover), remaining });
    return { row: advance, requestStatus: requestStatus ?? null, handover, installments: current, movements: moves, remaining, stage, used };
  });
}

/** Terpakai per orang dan per dana (DRV-121), dihitung satu tempat; dana kasbon yang sudah diberikan = dasar gaji hari ini. */
export async function usage(today: IsoDate, executor: Executor = db) {
  const all = await loadAdvances({}, executor);
  const people = await listPeopleForModules();
  const basis = new Map<number, 'MONTHLY' | 'WEEKLY' | null>();
  for (const p of people) basis.set(p.id, await payBasisOf(p.positionId, today));
  const byPerson = new Map<number, number>();
  const byFund = { MONTHLY: 0, WEEKLY: 0 };
  for (const a of all) {
    if (!a.used) continue;
    byPerson.set(a.row.employeeId, (byPerson.get(a.row.employeeId) ?? 0) + a.used);
    const fund = a.handover ? basis.get(a.row.employeeId) ?? (a.row.fund as 'MONTHLY' | 'WEEKLY') : (a.row.fund as 'MONTHLY' | 'WEEKLY');
    byFund[fund] += a.used;
  }
  return { all, byPerson, byFund };
}

/** Kunci serialisasi pengajuan/serah kasbon supaya batas orang dan dana tidak terlewati dua permintaan bersamaan. */
export async function lockAdvances(tx: Tx) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('hris.advances'))`);
}

export type CheckOutcome = (CheckResult & { fund: 'MONTHLY' | 'WEEKLY' | null; rules: AdvanceRules });

/** "Periksa kasbon" (DRV-55 s.d. 58, 121) atas satu orang dan satu nominal, dibaca dari data hari ini. */
export async function checkAdvance(employeeId: number, amount: number, today: IsoDate = todayWib(), executor: Executor = db): Promise<CheckOutcome> {
  const person = await personOf(employeeId);
  const basis = person ? await payBasisOf(person.positionId, today) : null;
  const rules = await rulesOn(today, basis ?? 'MONTHLY');
  if (!person) return { ok: false, step: 'ELIGIBLE', message: 'Karyawan tidak ditemukan.', fund: null, rules };
  const { all, byPerson, byFund } = await usage(today, executor);
  const mine = all.filter((a) => a.row.employeeId === employeeId && a.row.kind !== 'SPECIAL');
  const hasPending = mine.some((a) => a.row.state === 'OPEN');
  const result = checkAdvanceFacts({
    active: person.activeToday, payBasis: basis, hasPackage: await hasPackageOn(employeeId, today, executor), leaving: Boolean(leavingOn(person, today)),
    joinedOn: person.joinedOn, today, personUsed: byPerson.get(employeeId) ?? 0, fundUsed: basis ? byFund[basis] : 0,
    hasRunningOrPending: hasPending || mine.some((a) => a.remaining > 0), hasPending, amount,
  }, rules);
  return { ...result, fund: basis, rules };
}

/** Periode yang slip orang ini sudah Ditutup (pasang jadwal tidak menuju ke sana, DRV-132). */
export async function closedPeriodsOf(employeeId: number, executor: Executor = db): Promise<Set<IsoDate>> {
  const rows = await executor.select({ periodStart: payslips.periodStart }).from(payslips)
    .where(and(eq(payslips.employeeId, employeeId), eq(payslips.status, 'CLOSED')));
  return new Set(rows.map((r) => r.periodStart));
}

/** Pengajuan lanjutan yang masih terbuka atas kasbon ini (mis. "Minta dibatalkan" menahan serah uang, DRV-129). */
export async function openFollowup(advanceId: number, kind: 'CANCEL' | 'NOT_RECEIVED' | 'POSTPONE', executor: Executor = db) {
  const [row] = await executor.select({ followup: advanceFollowups, status: requests.status }).from(advanceFollowups)
    .innerJoin(requests, eq(requests.id, advanceFollowups.requestId))
    .where(and(eq(advanceFollowups.advanceId, advanceId), eq(advanceFollowups.kind, kind), inArray(requests.status, ['PENDING', 'REVIEWED']))).limit(1);
  return row?.followup ?? null;
}

export async function nextNumber(tx: Tx): Promise<number> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('hris.advance_number'))`);
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(advances);
  return Number(row?.n ?? 0) + 1;
}
