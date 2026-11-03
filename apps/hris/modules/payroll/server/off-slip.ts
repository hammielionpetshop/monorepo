import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  bonusEntries, bonusTypes, fundEntries, offSlipClaims, otherReceivables, payBatches, payslipPayments, payslips, paymentSources, receivableSettlements,
} from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { hasAction, listEmployeesWithAnyAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { bankAccountsOf, todayWib } from '@/modules/employees';
import { filesUploadedBy } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { entryKindLabel } from '../rules/bonus';
import { CLAIM_KIND_LABELS, CLAIM_STATUS_LABELS, correctionPlan, settleAgainst, type ClaimKind, type ClaimStatus } from '../rules/off-slip';
import { PAY_METHOD_LABELS, moneyDateProblem, tailDigits, type PayMethod } from '../rules/payment';
import { fundMovements, reasonProblem, type SlipLine } from '../rules/payslip';
import { addPeriods, longDate, rupiah, type IsoDate } from '../rules/salary';
import { accountNames, type Executor, type PayrollPerson } from './data';
import { lockFunds } from './funds';
import { activePayments, payerProblem } from './payment';
import { canSeeSlip, loadSlip, pastAdjustments, wibTime, type SlipRow } from './payslip';

// L4f-2 Bayar di luar slip (spec L4f §3.7; GAJ-89, 96, 106): bonus susulan dan koreksi plus untuk orang yang slip terakhirnya
// sudah Dibayar. Tagihan lahir otomatis; saat dibayar dipotongkan ke Piutang Lain lebih dulu, sisanya dengan uang.

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });
class Conflict extends Error {}

export type ClaimRow = typeof offSlipClaims.$inferSelect;

/** Slip terakhir yang sudah Dibayar (uang atau tanpa uang) dan tidak punya slip sesudahnya; null = tidak berhak tagihan luar slip. */
export async function paidLastSlipOf(employeeId: number, executor: Executor = db): Promise<SlipRow | null> {
  const [latest] = await executor.select().from(payslips).where(eq(payslips.employeeId, employeeId)).orderBy(desc(payslips.periodStart)).limit(1);
  if (!latest || latest.status !== 'CLOSED' || !latest.lastSlip) return null;
  return (await activePayments([latest.id], executor)).has(latest.id) ? latest : null;
}

/** Sisa Piutang Lain terbuka per piutang (jumlah − cicilan yang berlaku), paling lama lebih dulu. */
async function openReceivablesOf(executor: Executor, employeeId: number, lock = false) {
  const base = executor.select().from(otherReceivables)
    .where(and(eq(otherReceivables.employeeId, employeeId), eq(otherReceivables.status, 'OPEN'))).orderBy(asc(otherReceivables.createdAt), asc(otherReceivables.id));
  const rows = lock ? await base.for('update') : await base;
  if (!rows.length) return [];
  const settled = await executor.select({ id: receivableSettlements.receivableId, total: sql<number>`sum(${receivableSettlements.amount})::int` }).from(receivableSettlements)
    .where(and(inArray(receivableSettlements.receivableId, rows.map((r) => r.id)), eq(receivableSettlements.status, 'ACTIVE'))).groupBy(receivableSettlements.receivableId);
  const done = new Map(settled.map((s) => [s.id, Number(s.total)]));
  return rows.map((r) => ({ ...r, settled: done.get(r.id) ?? 0, remaining: r.amount - (done.get(r.id) ?? 0) }));
}

/** Jumlah cicilan berlaku per Piutang Lain (layar Piutang Lain). */
export async function settledByReceivable(ids: readonly number[]): Promise<Map<number, number>> {
  if (!ids.length) return new Map();
  const rows = await db.select({ id: receivableSettlements.receivableId, total: sql<number>`sum(${receivableSettlements.amount})::int` }).from(receivableSettlements)
    .where(and(inArray(receivableSettlements.receivableId, [...ids]), eq(receivableSettlements.status, 'ACTIVE'))).groupBy(receivableSettlements.receivableId);
  return new Map(rows.map((r) => [r.id, Number(r.total)]));
}

/** Pagar buka kembali slip terakhir (spec L4f §3.7): tagihan luar slip yang sudah Dibayar harus dibatalkan dulu. */
export async function offSlipReopenBlock(employeeId: number, executor: Executor = db): Promise<string | null> {
  const [paid] = await executor.select({ id: offSlipClaims.id }).from(offSlipClaims)
    .where(and(eq(offSlipClaims.employeeId, employeeId), eq(offSlipClaims.status, 'PAID'))).limit(1);
  return paid ? 'Orang ini sudah punya pembayaran di luar slip. Batalkan pembayaran itu dulu.' : null;
}

/** Tagihan Menunggu dibatalkan saat slip terakhir dibuka kembali: isinya kembali masuk slip. Dipanggil di transaksi buka kembali. */
export async function cancelWaitingClaims(tx: Tx, employeeId: number, reason: string): Promise<number> {
  const done = await tx.update(offSlipClaims).set({ status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason })
    .where(and(eq(offSlipClaims.employeeId, employeeId), eq(offSlipClaims.status, 'WAITING'))).returning({ id: offSlipClaims.id });
  return done.length;
}

// ---- Lahirnya tagihan (mesin harian + saat bonus disahkan + saat Jadwal Bayar dibuka) ----

type Wanted = { originKey: string; sourceKey: string; kind: ClaimKind; lineKind: string; label: string; bonusEntryId: number | null; fund: string | null; originPeriod: IsoDate | null; amount: number };

async function lockPerson(tx: Tx, employeeId: number) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('hris.off_slip_claims'), ${employeeId})`);
}

async function syncPerson(employeeId: number, now: Date): Promise<ClaimRow[]> {
  const last = await paidLastSlipOf(employeeId);
  if (!last) {
    await db.transaction(async (tx) => {
      await lockPerson(tx, employeeId);
      if (!(await paidLastSlipOf(employeeId, tx))) await cancelWaitingClaims(tx, employeeId, 'Slip terakhir orang ini belum atau tidak lagi Dibayar.');
    });
    return [];
  }
  const loaded = await loadSlip(last.id);
  if (!loaded) return [];
  const person = loaded.person;
  // (b) koreksi plus dan pengembalian yang akan masuk slip berikutnya bila ada (slip terakhir sudah Dibayar, jadi tidak ada).
  const adjust = await pastAdjustments(person, addPeriods(last.periodStart, 1), now);
  const corrections = new Map(adjust.income.map((i) => [i.sourceKey, i]));

  return db.transaction(async (tx) => {
    await lockPerson(tx, employeeId);
    const current = await paidLastSlipOf(employeeId, tx);
    if (!current || current.id !== last.id) return [];
    const live = await tx.select().from(offSlipClaims).where(and(eq(offSlipClaims.employeeId, employeeId), inArray(offSlipClaims.status, ['WAITING', 'PAID'])));
    const born: ClaimRow[] = [];
    const cancel = async (ids: number[], reason: string) => {
      if (ids.length) await tx.update(offSlipClaims).set({ status: 'CANCELLED', cancelledAt: now, cancelReason: reason }).where(and(inArray(offSlipClaims.id, ids), eq(offSlipClaims.status, 'WAITING')));
    };
    const create = async (w: Wanted) => {
      const [row] = await tx.insert(offSlipClaims).values({ ...w, employeeId, lastPayslipId: last.id, branchId: last.branchId, branchName: last.branchName }).returning();
      born.push(row);
    };

    // (a) bonus Disahkan (positif) yang belum masuk slip.
    const bonuses = await tx.select({ entry: bonusEntries, typeName: bonusTypes.name }).from(bonusEntries).leftJoin(bonusTypes, eq(bonusTypes.id, bonusEntries.typeId))
      .where(and(eq(bonusEntries.employeeId, employeeId), eq(bonusEntries.status, 'APPROVED'), sql`${bonusEntries.amount} > 0`));
    const approved = new Set(bonuses.map((b) => b.entry.id));
    await cancel(live.filter((c) => c.kind === 'BONUS' && c.status === 'WAITING' && !approved.has(c.bonusEntryId!)).map((c) => c.id), 'Bonusnya tidak lagi Disahkan.');
    for (const { entry, typeName } of bonuses) {
      if (live.some((c) => c.originKey === `bonus:${entry.id}`)) continue;
      await create({
        originKey: `bonus:${entry.id}`, sourceKey: `bonus:${entry.id}`, kind: 'BONUS', lineKind: entry.kind,
        label: `Bonus ${entryKindLabel(entry.kind, typeName).toLowerCase()} ${longDate(entry.occurredOn)}${entry.fund === 'DISCIPLINE_FUND' ? ' (Dana Disiplin)' : ''}`,
        bonusEntryId: entry.id, fund: entry.fund === 'DISCIPLINE_FUND' ? 'DISCIPLINE_FUND' : null, originPeriod: entry.periodStart, amount: entry.amount,
      });
    }

    // (b) koreksi plus: per kunci sumber, dibandingkan dengan tagihan yang sudah ada.
    const keys = new Set([...corrections.keys(), ...live.filter((c) => c.kind === 'CORRECTION').map((c) => c.sourceKey)]);
    for (const key of keys) {
      const input = corrections.get(key);
      const mine = live.filter((c) => c.kind === 'CORRECTION' && c.sourceKey === key).map((c) => ({ id: c.id, amount: c.amount, status: c.status as 'WAITING' | 'PAID' }));
      const plan = correctionPlan(input?.amount ?? 0, mine);
      await cancel(plan.cancel, 'Nominal koreksinya berubah.');
      if (plan.create > 0 && input) {
        const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(offSlipClaims).where(and(eq(offSlipClaims.employeeId, employeeId), eq(offSlipClaims.sourceKey, key)));
        await create({
          originKey: `${key}#${Number(n) + 1}`, sourceKey: key, kind: 'CORRECTION', lineKind: input.lineKind, label: input.label,
          bonusEntryId: null, fund: null, originPeriod: input.originPeriod, amount: plan.create,
        });
      }
    }

    if (born.length) {
      const owners = await activeHrisAccounts(await listEmployeesWithAnyAction([]));
      const total = born.reduce((s, c) => s + c.amount, 0);
      await notify(tx, [...owners.values()], {
        kind: 'off_slip.claim_born', title: `Bayar di luar slip: ${person.name} ${rupiah(total)} (${born.length} tagihan).`,
        body: `${born.map((c) => c.label).join('; ')}. Slip terakhirnya sudah Dibayar; dipotongkan ke Piutang Lain lebih dulu bila ada.`, link: '/gaji/jadwal-bayar',
      }, null);
    }
    return born;
  });
}

/** Lahirkan tagihan luar slip yang belum ada (idempoten, kunci asal). Tanpa daftar = semua orang yang berhak atau punya tagihan Menunggu. */
export async function eligibleOrWaitingPeople(): Promise<number[]> {
  const lastSlips = await db.select({ id: payslips.employeeId }).from(payslips).where(and(eq(payslips.lastSlip, true), eq(payslips.status, 'CLOSED')));
  const waiting = await db.select({ id: offSlipClaims.employeeId }).from(offSlipClaims).where(eq(offSlipClaims.status, 'WAITING'));
  return [...new Set([...lastSlips, ...waiting].map((r) => r.id))];
}

export async function syncOffSlipClaims(employeeIds?: readonly number[], now: Date = new Date()): Promise<{ born: number; people: number }> {
  const ids = employeeIds ? [...new Set(employeeIds)] : await eligibleOrWaitingPeople();
  let born = 0;
  for (const id of ids) born += (await syncPerson(id, now)).length;
  return { born, people: ids.length };
}

/** Dipanggil sesudah bonus disahkan; kegagalan tidak menggagalkan pengesahan (mesin harian mengulang). */
export async function syncOffSlipClaimsQuietly(employeeIds: readonly number[]) {
  try {
    await syncOffSlipClaims(employeeIds);
  } catch (error) {
    console.error('Tagihan luar slip gagal diperbarui', error);
  }
}

/** 05.05 WIB (spec L4f §6). */
export async function runOffSlipClaims(now: Date = new Date()) {
  return syncOffSlipClaims(undefined, now);
}

// ---- Bayar di luar slip (GAJ-L37) ----

async function claimWithPerson(id: number) {
  const [claim] = await db.select().from(offSlipClaims).where(eq(offSlipClaims.id, id));
  if (!claim) return null;
  const loaded = await loadSlip(claim.lastPayslipId);
  return loaded ? { claim, person: loaded.person, lastSlip: loaded.slip } : null;
}

const closedOnOf = (slip: SlipRow) => todayWib(slip.closedAt ?? new Date());

/** Baris slip semu untuk mutasi dana tagihan (bonus Dana Disiplin keluar; koreksi telat/denda/alpha/lembur ikut dananya). */
function claimMovements(claim: ClaimRow) {
  const line: SlipLine = {
    section: 'INCOME', group: null, sourceKey: claim.sourceKey, lineKind: claim.lineKind, label: claim.label, originPeriod: claim.originPeriod,
    amount: claim.amount, taken: 0, remaining: 0, details: claim.fund === 'DISCIPLINE_FUND' ? { fund: 'DISCIPLINE_FUND' } : {},
  };
  return fundMovements([line], `luar slip ${claim.label}`).map((m) => ({ ...m, reason: `Bayar di luar slip: ${claim.label}` }));
}

export async function offSlipPayScreen(actor: Actor | null, claimId: number, now: Date = new Date()) {
  if (!actor?.fullAccess || !hasAction(actor, 'payslip.pay')) return null;
  const loaded = await claimWithPerson(claimId);
  if (!loaded || !canSeeSlip(actor, loaded.person)) return null;
  const { claim, person, lastSlip } = loaded;
  const receivables = await openReceivablesOf(db, person.id);
  const plan = settleAgainst(claim.amount, receivables);
  const sources = await db.select().from(paymentSources).where(eq(paymentSources.active, true)).orderBy(asc(paymentSources.sortOrder), asc(paymentSources.name));
  return {
    claim: {
      id: claim.id, name: person.name, label: claim.label, kind: CLAIM_KIND_LABELS[claim.kind as ClaimKind], amount: claim.amount, status: claim.status as ClaimStatus,
      statusLabel: CLAIM_STATUS_LABELS[claim.status as ClaimStatus], lastSlipNumber: lastSlip.number, lastSlipId: lastSlip.id,
    },
    problem: claim.status !== 'WAITING' ? 'Tagihan ini sudah tidak Menunggu dibayar.' : payerProblem(actor, person, 'payslip.pay'),
    settlements: plan.settlements.map((s) => {
      const r = receivables.find((x) => x.id === s.receivableId)!;
      return { receivableId: s.receivableId, amount: s.amount, clears: s.clears, remaining: r.remaining };
    }),
    cash: plan.cash,
    today: todayWib(now),
    closedOn: closedOnOf(lastSlip),
    sources: sources.map((s) => ({ id: s.id, name: s.name, method: s.method as PayMethod, methodLabel: PAY_METHOD_LABELS[s.method as PayMethod] })),
  };
}

type OffSlipPayInput = { sourceId?: unknown; moneyDate?: unknown; dateReason?: unknown; proofFileId?: unknown };

export async function payOffSlipClaim(actor: Actor | null, claimId: number, input: OffSlipPayInput, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<{ effect: string }>> {
  if (!actor?.fullAccess || !hasAction(actor, 'payslip.pay')) return fail(403, 'Hanya Pemilik atau GM yang membayar di luar slip.');
  const loaded = await claimWithPerson(claimId);
  if (!loaded || !canSeeSlip(actor, loaded.person)) return fail(404, 'Tagihan tidak ditemukan.');
  const { person } = loaded;
  const problem = payerProblem(actor, person, 'payslip.pay');
  if (problem) return fail(403, problem);
  const today = todayWib(now);
  const dateReason = String(input.dateReason ?? '').trim() || null;
  const proofFileId = String(input.proofFileId ?? '').trim() || null;
  if (proofFileId && !(await filesUploadedBy(db as unknown as Tx, actor.accountId, [proofFileId])).length) return fail(400, 'Foto bukti tidak ditemukan. Unggah ulang.');
  try {
    return await db.transaction(async (tx) => {
      await lockPerson(tx, person.id);
      const [claim] = await tx.select().from(offSlipClaims).where(eq(offSlipClaims.id, claimId)).for('update');
      if (!claim || claim.status !== 'WAITING') throw new Conflict('Tagihan ini sudah tidak Menunggu dibayar.');
      const last = await paidLastSlipOf(person.id, tx);
      if (!last || last.id !== claim.lastPayslipId) throw new Conflict('Slip terakhir orang ini tidak lagi Dibayar. Tagihan akan dibatalkan otomatis.');
      if (claim.bonusEntryId) {
        const [bonus] = await tx.select().from(bonusEntries).where(eq(bonusEntries.id, claim.bonusEntryId)).for('update');
        if (!bonus || bonus.status !== 'APPROVED') throw new Conflict('Bonusnya tidak lagi Disahkan.');
      }
      const movements = claimMovements(claim);
      if (movements.length) await lockFunds(tx);

      // Potong Piutang Lain lebih dulu (Y5).
      const receivables = await openReceivablesOf(tx, person.id, true);
      const plan = settleAgainst(claim.amount, receivables);
      for (const s of plan.settlements) {
        await tx.insert(receivableSettlements).values({ receivableId: s.receivableId, claimId: claim.id, amount: s.amount, createdByAccountId: actor.accountId });
        if (s.clears) await tx.update(otherReceivables).set({ status: 'SETTLED' }).where(and(eq(otherReceivables.id, s.receivableId), eq(otherReceivables.status, 'OPEN')));
      }
      const settled = claim.amount - plan.cash;
      let methodText = 'dipotongkan ke Piutang Lain';
      const breakdown = {
        claimId: claim.id, kind: claim.kind, label: claim.label, branchId: claim.branchId, branchName: claim.branchName, ownerAndGmSalary: person.ownerOnly,
        amount: claim.amount, settledToReceivables: settled, cash: plan.cash, funds: movements.map((m) => ({ fund: m.fund, amount: m.amount })),
      };
      if (plan.cash > 0) {
        const [source] = await tx.select().from(paymentSources).where(eq(paymentSources.id, Number(input.sourceId)));
        if (!source?.active) throw new Conflict('Pilih sumber uang yang aktif.');
        const moneyDate = String(input.moneyDate ?? '');
        const dateProblem = moneyDateProblem({ moneyDate, today, closedOn: todayWib(claim.createdAt), reason: dateReason });
        if (dateProblem) throw new Conflict(dateProblem.replace('sebelum slip ditutup', 'sebelum tagihan lahir'));
        const [batch] = await tx.insert(payBatches).values({ paidByAccountId: actor.accountId, sourceId: source.id, moneyDate, dateReason, proofFileId }).returning({ id: payBatches.id });
        await tx.insert(payslipPayments).values({
          claimId: claim.id, batchId: batch.id, kind: 'MONEY', amount: plan.cash, moneyDate, method: source.method, sourceId: source.id, paidByAccountId: actor.accountId, breakdown,
          accountTail: source.method === 'TRANSFER' ? tailDigits((await bankAccountsOf([claim.employeeId])).get(claim.employeeId)?.accountNumber) : null,
        });
        methodText = `${rupiah(plan.cash)} lewat ${PAY_METHOD_LABELS[source.method as PayMethod]} tanggal ${longDate(moneyDate)}${settled ? `, ${rupiah(settled)} dipotongkan ke Piutang Lain` : ''}`;
      } else {
        await tx.insert(payslipPayments).values({ claimId: claim.id, kind: 'NO_MONEY', amount: 0, moneyDate: today, paidByAccountId: actor.accountId, breakdown });
      }
      if (movements.length) {
        await tx.insert(fundEntries).values(movements.map((m) => ({
          fund: m.fund, kind: 'OFF_SLIP', amount: m.amount, branchId: claim.branchId, periodStart: claim.originPeriod, reason: m.reason, claimId: claim.id, createdByAccountId: actor.accountId,
        })));
      }
      await tx.update(offSlipClaims).set({ status: 'PAID' }).where(eq(offSlipClaims.id, claim.id));
      if (claim.bonusEntryId) await tx.update(bonusEntries).set({ status: 'PAID_OUTSIDE' }).where(eq(bonusEntries.id, claim.bonusEntryId));
      await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'off_slip_claim', entityId: claim.id, action: 'off_slip.pay', before: { status: 'WAITING' }, after: breakdown, reason: dateReason ?? undefined });
      const account = (await activeHrisAccounts([person.id])).get(person.id);
      if (account) {
        await notify(tx, [account], {
          kind: 'off_slip.paid', title: `${claim.label} ${rupiah(claim.amount)} dibayar di luar slip.`, body: `${methodText}.`, entity: 'off_slip_claim', entityId: claim.id, link: '/pendapatan',
        }, actor.accountId);
      }
      if (actor.personId === person.id) await announce(tx, actor.accountId, { what: `membayar di luar slip untuk dirinya sendiri: ${claim.label} ${rupiah(claim.amount)}`, link: '/gaji/jadwal-bayar', entity: 'off_slip_claim', entityId: claim.id });
      return { ok: true as const, data: { effect: `${claim.label} ${person.name} ${rupiah(claim.amount)} Dibayar: ${methodText}.` } };
    });
  } catch (error) {
    if (error instanceof Conflict) return fail(409, error.message);
    if (String((error as { code?: string })?.code ?? (error as { cause?: { code?: string } })?.cause?.code) === '23505') return fail(409, 'Tagihan ini baru saja dibayar orang lain.');
    throw error;
  }
}

// ---- Batal bayar tagihan luar slip ----

export async function cancelOffSlipPayment(actor: Actor | null, claimId: number, reasonInput: unknown, announce: ChangeAnnounce): Promise<ServiceResult<{ effect: string }>> {
  const loaded = await claimWithPerson(claimId);
  if (!loaded || !canSeeSlip(actor, loaded.person)) return fail(404, 'Tagihan tidak ditemukan.');
  const problem = payerProblem(actor, loaded.person, 'payslip.cancel_payment');
  if (problem) return fail(403, problem);
  const reason = String(reasonInput ?? '').trim();
  const bad = reasonProblem(reason);
  if (bad) return fail(400, bad);
  const { person } = loaded;
  const now = new Date();
  return db.transaction(async (tx) => {
    await lockPerson(tx, person.id);
    const [claim] = await tx.select().from(offSlipClaims).where(eq(offSlipClaims.id, claimId)).for('update');
    const [payment] = claim ? await tx.select().from(payslipPayments).where(and(eq(payslipPayments.claimId, claim.id), eq(payslipPayments.status, 'ACTIVE'))) : [];
    if (!claim || claim.status !== 'PAID' || !payment) return fail(409, 'Tagihan ini belum Dibayar.');
    await tx.update(payslipPayments).set({ status: 'CANCELLED', cancelledAt: now, cancelledByAccountId: actor!.accountId, cancelReason: reason }).where(eq(payslipPayments.id, payment.id));
    const settlements = await tx.update(receivableSettlements).set({ status: 'REVERSED', reversedAt: now, reversedByAccountId: actor!.accountId })
      .where(and(eq(receivableSettlements.claimId, claim.id), eq(receivableSettlements.status, 'ACTIVE'))).returning();
    const touched = [...new Set(settlements.map((s) => s.receivableId))];
    if (touched.length) await tx.update(otherReceivables).set({ status: 'OPEN' }).where(and(inArray(otherReceivables.id, touched), eq(otherReceivables.status, 'SETTLED')));
    // Buku dana hanya tambah: pembalik = lawan jumlah mutasi tagihan ini per dana.
    const entries = await tx.select({ fund: fundEntries.fund, amount: sql<number>`sum(${fundEntries.amount})::int` }).from(fundEntries)
      .where(eq(fundEntries.claimId, claim.id)).groupBy(fundEntries.fund);
    const reversal = entries.filter((e) => Number(e.amount) !== 0);
    if (reversal.length) {
      await lockFunds(tx);
      await tx.insert(fundEntries).values(reversal.map((e) => ({
        fund: e.fund, kind: 'OFF_SLIP', amount: -Number(e.amount), branchId: claim.branchId, periodStart: claim.originPeriod,
        reason: `Batal bayar di luar slip: ${claim.label}`, claimId: claim.id, createdByAccountId: actor!.accountId,
      })));
    }
    if (claim.bonusEntryId) await tx.update(bonusEntries).set({ status: 'APPROVED' }).where(and(eq(bonusEntries.id, claim.bonusEntryId), eq(bonusEntries.status, 'PAID_OUTSIDE')));
    await tx.update(offSlipClaims).set({ status: 'WAITING' }).where(eq(offSlipClaims.id, claim.id));
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'off_slip_claim', entityId: claim.id, action: 'off_slip.cancel_payment', before: { paymentId: payment.id, cash: payment.amount }, after: { status: 'WAITING', settlementsReversed: settlements.length }, reason });
    const account = (await activeHrisAccounts([person.id])).get(person.id);
    if (account) {
      await notify(tx, [account], { kind: 'off_slip.payment_cancelled', title: `Pembayaran di luar slip "${claim.label}" dibatalkan.`, body: `Alasan: ${reason}`, entity: 'off_slip_claim', entityId: claim.id, link: '/pendapatan' }, actor!.accountId);
    }
    await announce(tx, actor!.accountId, { what: `membatalkan pembayaran di luar slip ${person.name} ${claim.label} ${rupiah(claim.amount)}: ${reason}`, link: '/gaji/jadwal-bayar', entity: 'off_slip_claim', entityId: claim.id });
    const settledTotal = settlements.reduce((s, x) => s + x.amount, 0);
    return {
      ok: true as const,
      data: { effect: `Pembayaran dibatalkan. ${settledTotal ? `Potongan Piutang Lain ${rupiah(settledTotal)} dikembalikan. ` : ''}${claim.bonusEntryId ? 'Bonusnya kembali Disahkan. ' : ''}Tagihan kembali Menunggu dibayar.` },
    };
  });
}

// ---- Daftar tagihan (Jadwal Bayar, layar Piutang Lain) ----

export async function offSlipClaimsView(actor: Actor, opts: { names: boolean }) {
  const rows = await db.select().from(offSlipClaims).where(inArray(offSlipClaims.status, ['WAITING', 'PAID'])).orderBy(desc(offSlipClaims.createdAt)).limit(300);
  if (!rows.length) return { waiting: [], paid: [], waitingTotal: 0, waitingCount: 0 };
  const people = new Map<number, PayrollPerson>();
  for (const id of [...new Set(rows.map((r) => r.lastPayslipId))]) {
    const loaded = await loadSlip(id);
    if (loaded) people.set(loaded.person.id, loaded.person);
  }
  const visible = rows.filter((r) => {
    const p = people.get(r.employeeId);
    return p && (opts.names ? canSeeSlip(actor, p) : !p.ownerOnly);
  });
  const payments = await db.select().from(payslipPayments).where(and(inArray(payslipPayments.claimId, visible.map((r) => r.id)), eq(payslipPayments.status, 'ACTIVE')));
  const names = await accountNames();
  const view = (r: ClaimRow) => {
    const p = people.get(r.employeeId)!;
    const pay = payments.find((x) => x.claimId === r.id);
    return {
      id: r.id, name: p.name, branchName: r.branchName ?? p.branchName, label: r.label, kind: CLAIM_KIND_LABELS[r.kind as ClaimKind], amount: r.amount,
      status: r.status as ClaimStatus, statusLabel: CLAIM_STATUS_LABELS[r.status as ClaimStatus], born: wibTime(r.createdAt),
      paid: pay ? { cash: pay.kind === 'MONEY' ? pay.amount : 0, settled: r.amount - (pay.kind === 'MONEY' ? pay.amount : 0), by: names.get(pay.paidByAccountId) ?? '-', moneyDate: longDate(pay.moneyDate) } : null,
      ownClaim: actor.personId === r.employeeId && !p.isGmPosition,
      canCancel: Boolean(pay) && payerProblem(actor, p, 'payslip.cancel_payment') == null,
    };
  };
  const waiting = visible.filter((r) => r.status === 'WAITING');
  return {
    waiting: opts.names ? waiting.map(view) : [],
    paid: opts.names ? visible.filter((r) => r.status === 'PAID').slice(0, 30).map(view) : [],
    waitingTotal: waiting.reduce((s, r) => s + r.amount, 0),
    waitingCount: waiting.length,
  };
}

/** Isi layar Batal bayar tagihan luar slip. */
export async function offSlipCancelScreen(actor: Actor | null, claimId: number) {
  const loaded = await claimWithPerson(claimId);
  if (!actor || !loaded || !canSeeSlip(actor, loaded.person)) return null;
  const { claim, person } = loaded;
  const [payment] = await db.select().from(payslipPayments).where(and(eq(payslipPayments.claimId, claim.id), eq(payslipPayments.status, 'ACTIVE')));
  const can = claim.status === 'PAID' && Boolean(payment) && payerProblem(actor, person, 'payslip.cancel_payment') == null;
  if (!payment) return { name: person.name, label: claim.label, can: false, lines: [], effects: [] };
  const source = payment.sourceId ? (await db.select().from(paymentSources).where(eq(paymentSources.id, payment.sourceId)))[0] : null;
  const settled = claim.amount - (payment.kind === 'MONEY' ? payment.amount : 0);
  const fundRows = await db.select({ id: fundEntries.id }).from(fundEntries).where(eq(fundEntries.claimId, claim.id)).limit(1);
  const by = (await accountNames()).get(payment.paidByAccountId) ?? '-';
  return {
    name: person.name, label: claim.label, can,
    lines: [
      `${person.name}: ${claim.label} ${rupiah(claim.amount)}`,
      ...(settled ? [`${rupiah(settled)} dipotongkan ke Piutang Lain`] : []),
      ...(payment.kind === 'MONEY' ? [`${rupiah(payment.amount)} dari ${source?.name ?? '-'} tanggal ${longDate(payment.moneyDate)}`] : []),
      `Dibayar oleh ${by} · ${wibTime(payment.createdAt)}`,
    ],
    effects: [
      'Pembayaran ditandai Dibatalkan (tidak dihapus).',
      ...(settled ? [`Potongan Piutang Lain ${rupiah(settled)} dikembalikan: piutangnya terbuka lagi.`] : []),
      ...(fundRows.length ? ['Mutasi dana tagihan ini dibalik dengan baris baru.'] : []),
      ...(claim.bonusEntryId ? ['Bonusnya kembali Disahkan.'] : []),
      'Tagihan kembali Menunggu dibayar di Jadwal Bayar.',
      'Orangnya dan pemilik lain diberi tahu beserta alasannya.',
    ],
  };
}
