import { randomUUID } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { bonusEntries, bonusTypes, fundEntries } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { hasAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult, type Tx } from '@/modules/access';
import { todayWib } from '@/modules/employees';
import { settingOn } from '@/modules/settings';
import { entryKindLabel } from '../rules/bonus';
import {
  ABSENCE_REPORT_NOTE, BONUS_FUND_LABELS, FUND_ENTRY_LABELS, FUND_LABELS, addEstimates, disciplineShortfall, estimateOf, fundChangeProblem, fundState,
  type Fund, type FundChange, type FundEstimate, type FundEntryKind, type FundState,
} from '../rules/funds';
import { longDate, periodEndOf, periodStartOf, rupiah, type IsoDate } from '../rules/salary';
import { computeAttendancePay } from './attendance-pay';
import { accountNames, loadPayrollPeople } from './data';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });
type Executor = typeof db | Tx;

/**
 * Kunci dana di transaksi: pemeriksaan Tersedia dan pengesahan/penyesuaian dalam satu transaksi berkunci,
 * sehingga dua pengesahan bersumber Dana Disiplin yang bersamaan tidak bisa sama-sama lolos (spec L4d §3.4).
 */
export async function lockFunds(tx: Tx) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('hris.fund_entries'))`);
}

/** Terpesan: bonus bersumber Dana Disiplin yang Disahkan. Belum ada slip ditutup (4E-5a), jadi semuanya masih terpesan. */
async function reservedDiscipline(executor: Executor): Promise<number> {
  const [row] = await executor.select({ total: sql<number>`coalesce(sum(${bonusEntries.amount}), 0)::int` }).from(bonusEntries)
    .where(and(eq(bonusEntries.status, 'APPROVED'), eq(bonusEntries.fund, 'DISCIPLINE_FUND')));
  return Number(row?.total ?? 0);
}

export async function readFundState(executor: Executor = db): Promise<FundState> {
  const [entries, reserved] = await Promise.all([
    executor.select({ fund: fundEntries.fund, amount: fundEntries.amount }).from(fundEntries),
    reservedDiscipline(executor),
  ]);
  return fundState(entries, reserved);
}

/** Pagar pengesahan bonus bersumber Dana Disiplin. Dipanggil di dalam transaksi pengesahan; mengunci dana dulu. */
export async function disciplineFundProblem(tx: Tx, amount: number): Promise<string | null> {
  await lockFunds(tx);
  const state = await readFundState(tx);
  return disciplineShortfall(state.discipline.available, amount);
}

// ---- Isi saldo awal, Sesuaikan, Pindah (GAJ-L26) ----

export type FundChangeInput = { kind: unknown; fund: unknown; amount: unknown; reason: unknown };

function parseChange(input: FundChangeInput): FundChange | null {
  const amount = Number(input.amount);
  const fund = input.fund === 'DISCIPLINE' || input.fund === 'ABSENCE' ? (input.fund as Fund) : null;
  if (input.kind === 'TRANSFER') return { kind: 'TRANSFER', amount };
  if ((input.kind === 'OPENING' || input.kind === 'ADJUSTMENT') && fund) return { kind: input.kind, fund, amount };
  return null;
}

export function describeChange(change: FundChange): string {
  if (change.kind === 'TRANSFER') return `memindahkan ${rupiah(change.amount)} dari Dana Tidak Hadir ke Dana Disiplin`;
  if (change.kind === 'OPENING') return `mengisi saldo awal ${FUND_LABELS[change.fund]} ${rupiah(change.amount)}`;
  return `menyesuaikan ${FUND_LABELS[change.fund]} ${change.amount < 0 ? '−' : '+'}${rupiah(Math.abs(change.amount))}`;
}

export async function changeFund(actor: Actor | null, input: FundChangeInput, announce: ChangeAnnounce): Promise<ServiceResult<{ ids: number[] }>> {
  if (!actor?.fullAccess || !hasAction(actor, 'fund.manage')) return fail(403, 'Hanya Pemilik atau GM yang mengubah dana.');
  const change = parseChange(input);
  if (!change) return fail(400, 'Pilih jenis perubahan dan dananya.');
  const reason = String(input.reason ?? '').trim();
  return db.transaction(async (tx) => {
    await lockFunds(tx);
    const problem = fundChangeProblem(change, await readFundState(tx), reason);
    if (problem) return fail(change.kind === 'OPENING' ? 409 : 400, problem);
    const base = { reason, createdByAccountId: actor.accountId };
    const rows: (typeof fundEntries.$inferInsert)[] = change.kind === 'TRANSFER'
      ? (() => {
        const transferGroup = randomUUID();
        return [
          { ...base, fund: 'ABSENCE', kind: 'TRANSFER', amount: -change.amount, transferGroup },
          { ...base, fund: 'DISCIPLINE', kind: 'TRANSFER', amount: change.amount, transferGroup },
        ];
      })()
      // Saldo awal = bawaan sistem lama bertanggal hari pindah (SIS-33, spec L9 §3.2); tanggalnya disimpan di period_start.
      : [{ ...base, fund: change.fund, kind: change.kind, amount: change.amount, periodStart: change.kind === 'OPENING' ? await cutoverDate() : null }];
    const inserted = await tx.insert(fundEntries).values(rows).returning({ id: fundEntries.id });
    const ids = inserted.map((r) => r.id);
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'fund_entry', entityId: ids[0], action: `fund.${change.kind.toLowerCase()}`, before: null, after: change, reason });
    await announce(tx, actor.accountId, { what: describeChange(change), link: '/dana', entity: 'fund_entry', entityId: ids[0] });
    return { ok: true as const, data: { ids } };
  }).catch((error: unknown) => {
    const cause = (error as { cause?: { code?: string } })?.cause ?? (error as { code?: string });
    if ((cause as { code?: string })?.code === '23505') return fail(409, 'Saldo awal dana ini sudah diisi. Pakai Sesuaikan.');
    throw error;
  });
}

/** Hari pindah dari Pengaturan (SIS-13); null bila belum ditetapkan. */
async function cutoverDate(): Promise<IsoDate | null> {
  const value = await settingOn<string>('migration.cutover_on', todayWib());
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

// ---- Perkiraan periode berjalan (spec L4d §9 butir 2) ----

export type BranchEstimate = FundEstimate & { branchName: string; people: number };

/** Perkiraan mutasi dana periode berjalan per cabang dari hitungan kehadiran (belum masuk saldo). */
export async function estimateCurrentPeriod(now: Date = new Date()): Promise<{ periodStart: IsoDate; branches: BranchEstimate[]; total: FundEstimate }> {
  const today = todayWib(now);
  const periodStart = periodStartOf(today);
  const people = (await loadPayrollPeople(today)).filter((p) => !p.isOwnerPosition && !p.isGmPosition);
  const byBranch = new Map<string, BranchEstimate>();
  let total: FundEstimate = { disciplineIn: 0, absenceIn: 0, absenceOut: 0 };
  for (const person of people) {
    const result = await computeAttendancePay(person, periodStart, now);
    if (!result) continue;
    const est = estimateOf(result.lines);
    const row = byBranch.get(person.branchName) ?? { branchName: person.branchName, people: 0, disciplineIn: 0, absenceIn: 0, absenceOut: 0 };
    byBranch.set(person.branchName, { ...row, ...addEstimates(row, est), people: row.people + 1 });
    total = addEstimates(total, est);
  }
  return { periodStart, branches: [...byBranch.values()].sort((a, b) => a.branchName.localeCompare(b.branchName)), total };
}

// ---- Layar Dana Disiplin & Dana Tidak Hadir (GAJ-L24, L25) ----

export async function fundsScreen(actor: Actor | null, now: Date = new Date()) {
  if (!hasAction(actor, 'fund.view')) return null;
  // Finance melihat angka tanpa nama orang (spec L4d §5).
  const showNames = Boolean(actor?.fullAccess) || hasAction(actor, 'bonus.view');
  const [state, entries, accounts, reservedRows, estimate] = await Promise.all([
    readFundState(),
    db.select().from(fundEntries).orderBy(desc(fundEntries.createdAt), desc(fundEntries.id)),
    accountNames(),
    db.select({
      id: bonusEntries.id, employeeId: bonusEntries.employeeId, occurredOn: bonusEntries.occurredOn, periodStart: bonusEntries.periodStart,
      amount: bonusEntries.amount, kind: bonusEntries.kind, typeName: bonusTypes.name, reason: bonusEntries.note,
    }).from(bonusEntries).leftJoin(bonusTypes, eq(bonusTypes.id, bonusEntries.typeId))
      .where(and(eq(bonusEntries.status, 'APPROVED'), eq(bonusEntries.fund, 'DISCIPLINE_FUND'))).orderBy(desc(bonusEntries.occurredOn)),
    estimateCurrentPeriod(now),
  ]);
  const names = showNames ? new Map((await loadPayrollPeople(todayWib(now))).map((p) => [p.id, p.name])) : new Map<number, string>();
  const ledger = (fund: Fund) => {
    const own = entries.filter((e) => e.fund === fund).reverse();
    let running = 0;
    return own.map((e) => {
      running += e.amount;
      return {
        id: e.id, kind: e.kind as FundEntryKind, amount: e.amount, balance: running,
        kindLabel: e.kind === 'OPENING' && e.periodStart ? `Saldo awal · bawaan sistem lama per ${longDate(e.periodStart)}` : FUND_ENTRY_LABELS[e.kind as FundEntryKind] ?? e.kind,
        reason: e.reason, at: e.createdAt.toISOString(), by: showNames ? accounts.get(e.createdByAccountId) ?? '-' : null,
        periodStart: e.periodStart,
      };
    }).reverse();
  };
  return {
    state,
    period: { start: estimate.periodStart, end: periodEndOf(estimate.periodStart), label: `${longDate(estimate.periodStart)} – ${longDate(periodEndOf(estimate.periodStart))}` },
    estimate,
    ledger: { discipline: ledger('DISCIPLINE'), absence: ledger('ABSENCE') },
    reserved: reservedRows.map((r) => ({
      id: r.id, name: showNames ? names.get(r.employeeId) ?? `#${r.employeeId}` : null, occurredOn: r.occurredOn, periodStart: r.periodStart,
      amount: r.amount, label: entryKindLabel(r.kind, r.typeName),
    })),
    labels: { funds: FUND_LABELS, bonusFunds: BONUS_FUND_LABELS },
    note: ABSENCE_REPORT_NOTE,
    can: { manage: Boolean(actor?.fullAccess) && hasAction(actor, 'fund.manage') },
  };
}

export async function fundChangeScreen(actor: Actor | null) {
  if (!actor?.fullAccess || !hasAction(actor, 'fund.manage')) return null;
  return { state: await readFundState() };
}
