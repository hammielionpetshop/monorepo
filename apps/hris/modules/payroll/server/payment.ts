import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { fundEntries, offSlipClaims, payBatches, payslipLines, payslipPayments, payslipSteps, payslips } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { MONEY_PLACE_HOLDER_LABELS, MONEY_PLACE_KIND_LABELS, moneyPlaces, payableMoneyPlace } from '@/lib/money-places';
import { hasAction, listEmployeesWithAnyAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { bankAccountsOf, todayWib, type BankAccount } from '@/modules/employees';
import { filesUploadedBy } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { settingOn } from '@/modules/settings';
import {
  DUE_BUCKET_LABELS, PAY_METHOD_LABELS, accountTail, tailDigits, dueBucket, dueDateOf, moneyDateProblem, payDateOf, reminderDue, sortTransfer, transferCsv,
  type DueBucket, type PayMethod,
} from '../rules/payment';
import { PAYSLIP_FROM, reasonProblem } from '../rules/payslip';
import { addPeriods, longDate, periodEndOf, periodStartOf, rupiah, type IsoDate } from '../rules/salary';
import { WEEKLY_SLIP_FROM, isWeeklyKind, parsePeriodKey, weekKey, weeklyPayDate } from '../rules/wage-week';
import { slipEndOf, slipPhrase } from './slip-period';
import { accountNames, loadPeriodPeople, type Executor, type PayrollPerson } from './data';
import { canSeeSlip, loadSlip, payslipTestMode, periodLabel, slipPerson, wibTime, type SlipRow } from './payslip';
import { autoLinkPayment } from './slip-objection';

// L4f-1 Bayar Slip (spec L4f §3): bayar, batal bayar, Jadwal Bayar + pengingat, Daftar Transfer, Sumber Uang.
// Slip "Dibayar" = punya pembayaran ACTIVE; status slip tetap CLOSED supaya semua pagar "slip ditutup" L4e tetap berlaku.

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });
class Conflict extends Error {}

export type PaymentRow = typeof payslipPayments.$inferSelect;

/** Pembayaran berlaku per slip. */
export async function activePayments(slipIds: readonly number[], executor: Executor = db): Promise<Map<number, PaymentRow>> {
  if (!slipIds.length) return new Map();
  const rows = await executor.select().from(payslipPayments)
    .where(and(inArray(payslipPayments.payslipId, [...slipIds]), eq(payslipPayments.status, 'ACTIVE')));
  return new Map(rows.map((r) => [r.payslipId!, r]));
}

/** Sebab slip tidak bisa dibuka kembali karena sudah Dibayar dengan uang (spec L4f §3.4); null = tidak terhalang pembayaran. */
export async function paidReopenBlock(slipId: number, executor: Executor = db): Promise<string | null> {
  const paid = (await activePayments([slipId], executor)).get(slipId);
  return paid?.kind === 'MONEY' ? 'Slip ini sudah Dibayar. Batalkan pembayarannya dulu.' : null;
}

/** Buka kembali slip Rp0: pembayaran tanpa uangnya ikut dibatalkan (GAJ-102). Dipanggil dalam transaksi buka kembali. */
export async function cancelZeroPayment(tx: Tx, slipId: number, actorAccountId: number, reason: string): Promise<boolean> {
  const done = await tx.update(payslipPayments).set({ status: 'CANCELLED', cancelledAt: new Date(), cancelledByAccountId: actorAccountId, cancelReason: reason })
    .where(and(eq(payslipPayments.payslipId, slipId), eq(payslipPayments.status, 'ACTIVE'), eq(payslipPayments.kind, 'NO_MONEY')))
    .returning({ id: payslipPayments.id });
  return done.length > 0;
}

async function payDayOf(periodStart: IsoDate): Promise<number> {
  return Number(await settingOn<number>('payroll.pay_day', periodStart)) || 1;
}

const closedOnOf = (slip: SlipRow) => todayWib(slip.closedAt ?? new Date());

/** Jatuh bayar slip Ditutup (GAJ-104). */
export async function dueOf(slip: SlipRow): Promise<IsoDate> {
  return dueDateOf(await plannedPayDateOf(slip), closedOnOf(slip), payslipTestMode());
}

/** Tanggal bayar menurut aturan untuk satu slip: bulanan pengaturan `payroll.pay_day`; mingguan Sabtu (2 hari sesudah minggu berakhir). */
export async function plannedPayDateOf(slip: Pick<SlipRow, 'kind' | 'periodStart' | 'periodEnd'>): Promise<IsoDate> {
  if (isWeeklyKind(slip.kind)) return weeklyPayDate(slipEndOf(slip));
  return payDateOf(slip.periodStart, await payDayOf(slip.periodStart));
}

/** Tanggal bayar menurut pengaturan untuk slip yang belum ditutup (Pendapatan Saya). */
export async function plannedPayDate(periodStart: IsoDate): Promise<IsoDate> {
  return payDateOf(periodStart, await payDayOf(periodStart));
}

/** Bayar dan batal bayar hanya Pemilik/GM; slip sendiri hanya GM (GAJ-98, 103). Null = boleh. */
export function payerProblem(actor: Actor | null, person: PayrollPerson, action: 'payslip.pay' | 'payslip.cancel_payment'): string | null {
  if (!actor?.fullAccess || !hasAction(actor, action)) {
    return action === 'payslip.pay' ? 'Hanya Pemilik atau GM yang menandai slip Dibayar.' : 'Hanya Pemilik atau GM yang membatalkan pembayaran.';
  }
  if (actor.personId === person.id && !person.isGmPosition) return 'Slip Anda sendiri dibayar Pemilik lain atau GM.';
  return null;
}

/** Uraian per pembayaran untuk app Keuangan kelak (GAJ-56, spec L4f §2). Dibaca dari baris slip tersimpan, tidak dihitung ulang. */
export async function breakdownOf(executor: Executor, slip: SlipRow, person: PayrollPerson) {
  const lines = await executor.select({ section: payslipLines.section, group: payslipLines.deductionGroup, kind: payslipLines.lineKind, amount: payslipLines.amount, taken: payslipLines.taken })
    .from(payslipLines).where(and(eq(payslipLines.payslipId, slip.id), eq(payslipLines.version, slip.version), eq(payslipLines.status, 'ACTIVE')));
  const incomeByKind: Record<string, number> = {};
  const takenByGroup: Record<string, number> = {};
  for (const l of lines) {
    if (l.section === 'INCOME') incomeByKind[l.kind] = (incomeByKind[l.kind] ?? 0) + l.amount;
    if (l.section === 'DEDUCTION' && l.group) takenByGroup[l.group] = (takenByGroup[l.group] ?? 0) + l.taken;
  }
  const funds = await executor.select({ fund: fundEntries.fund, amount: sql<number>`sum(${fundEntries.amount})::int` }).from(fundEntries)
    .where(eq(fundEntries.payslipId, slip.id)).groupBy(fundEntries.fund);
  return {
    number: slip.number, version: slip.version, periodStart: slip.periodStart, branchId: slip.branchId, branchName: slip.branchName, positionName: slip.positionName,
    ownerAndGmSalary: person.ownerOnly, income: slip.income ?? 0, taken: slip.taken ?? 0, net: slip.net ?? 0, incomeByKind, takenByGroup,
    funds: funds.map((f) => ({ fund: f.fund, amount: Number(f.amount) })),
  };
}

async function paidText(payment: PaymentRow): Promise<string> {
  const by = (await accountNames()).get(payment.paidByAccountId) ?? 'orang lain';
  return `Sudah dibayar oleh ${by} pukul ${wibTime(payment.createdAt)}.`;
}

// ---- Bayar Slip (GAJ-98; spec L4f §3.1) ----

export type PayOutcome = { slipId: number; name: string; result: 'PAID' | 'FAILED'; text: string; net: number };

type PayInput = { slipIds: unknown; sourceId: unknown; moneyDate: unknown; dateReason?: unknown; proofFileId?: unknown };

/** Bayar satu atau banyak slip dari satu sumber uang dan satu tanggal uang; tiap slip satu transaksi tersendiri. */
export async function paySlips(actor: Actor | null, input: PayInput, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<{ outcomes: PayOutcome[] }>> {
  if (!actor?.fullAccess || !hasAction(actor, 'payslip.pay')) return fail(403, 'Hanya Pemilik atau GM yang menandai slip Dibayar.');
  const ids = Array.isArray(input.slipIds) ? [...new Set(input.slipIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : [];
  if (!ids.length) return fail(400, 'Pilih slip yang dibayar.');
  if (ids.length > 300) return fail(400, 'Paling banyak 300 slip sekali bayar.');
  const source = await payableMoneyPlace(input.sourceId);
  if (!source) return fail(400, 'Pilih sumber uang yang aktif.');
  const moneyDate = String(input.moneyDate ?? '');
  const dateReason = String(input.dateReason ?? '').trim() || null;
  const proofFileId = String(input.proofFileId ?? '').trim() || null;
  if (proofFileId && !(await filesUploadedBy(db as unknown as Tx, actor.accountId, [proofFileId])).length) return fail(400, 'Foto bukti tidak ditemukan. Unggah ulang.');
  const today = todayWib(now);
  const general = moneyDateProblem({ moneyDate, today, closedOn: '0000-01-01', reason: dateReason });
  if (general) return fail(400, general);

  let batchId: number | null = null;
  const outcomes: PayOutcome[] = [];
  for (const slipId of ids) {
    const loaded = await loadSlip(slipId);
    if (!loaded || !canSeeSlip(actor, loaded.person)) {
      outcomes.push({ slipId, name: `#${slipId}`, result: 'FAILED', text: 'Slip tidak ditemukan.', net: 0 });
      continue;
    }
    const { person } = loaded;
    const out = (result: PayOutcome['result'], text: string, net = 0): PayOutcome => ({ slipId, name: person.name, result, text, net });
    const problem = payerProblem(actor, person, 'payslip.pay');
    if (problem) { outcomes.push(out('FAILED', problem)); continue; }
    try {
      const paid = await db.transaction(async (tx) => {
        const [slip] = await tx.select().from(payslips).where(eq(payslips.id, slipId)).for('update');
        if (!slip || slip.status !== 'CLOSED') throw new Conflict('Slip belum ditutup.');
        const existing = (await activePayments([slip.id], tx)).get(slip.id);
        if (existing) throw new Conflict(existing.kind === 'NO_MONEY' ? 'Slip bersih Rp0 sudah Dibayar tanpa uang.' : await paidText(existing));
        const net = slip.net ?? 0;
        if (net <= 0) throw new Conflict('Slip bersih Rp0 tidak dibayar dengan uang.');
        const dateProblem = moneyDateProblem({ moneyDate, today, closedOn: closedOnOf(slip), reason: dateReason });
        if (dateProblem) throw new Conflict(dateProblem);
        if (batchId == null) {
          const [batch] = await tx.insert(payBatches).values({ paidByAccountId: actor.accountId, moneyPlaceId: source.id, moneyDate, dateReason, proofFileId }).returning({ id: payBatches.id });
          batchId = batch.id;
        }
        const breakdown = await breakdownOf(tx, slip, person);
        const accountTail = source.method === 'TRANSFER' ? tailDigits((await bankAccountsOf([person.id])).get(person.id)?.accountNumber) : null;
        const [paid] = await tx.insert(payslipPayments).values({
          payslipId: slip.id, batchId, kind: 'MONEY', amount: net, moneyDate, method: source.method, moneyPlaceId: source.id, paidByAccountId: actor.accountId, breakdown, accountTail,
        }).returning({ id: payslipPayments.id });
        // Bayar ulang sesudah keberatan "uang belum saya terima" disetujui: tertaut otomatis (spec L4g §3.6).
        await autoLinkPayment(tx, slip.id, paid.id, actor.accountId);
        const summary = { number: slip.number, name: person.name, net, moneyDate, source: source.name, method: source.method, batchId };
        await tx.insert(payslipSteps).values({ payslipId: slip.id, periodStart: slip.periodStart, action: 'PAY', reason: dateReason, summary, actorAccountId: actor.accountId });
        await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'payslip', entityId: slip.id, action: 'payslip.pay', before: null, after: summary, reason: dateReason ?? undefined });
        const account = (await activeHrisAccounts([person.id])).get(person.id);
        if (account) {
          await notify(tx, [account], {
            kind: 'payslip.paid', title: `Gaji ${slipPhrase(slip)} ${rupiah(net)} sudah dibayar.`,
            body: `Tanggal ${longDate(moneyDate)} lewat ${PAY_METHOD_LABELS[source.method as PayMethod]}.`, entity: 'payslip', entityId: slip.id, link: `/pendapatan/slip/${slip.id}`,
          }, actor.accountId);
        }
        if (actor.personId === person.id) await announce(tx, actor.accountId, { what: `menandai Dibayar slip gajinya sendiri ${slip.number}`, link: `/gaji/slip/${slip.id}`, entity: 'payslip', entityId: slip.id });
        return net;
      });
      outcomes.push(out('PAID', `${rupiah(paid)} dibayar`, paid));
    } catch (error) {
      if (error instanceof Conflict) { outcomes.push(out('FAILED', error.message)); continue; }
      // Dua penekan bersamaan: indeks satu pembayaran berlaku per slip menolak yang kedua.
      if (String((error as { code?: string })?.code ?? (error as { cause?: { code?: string } })?.cause?.code) === '23505') {
        const existing = (await activePayments([slipId])).get(slipId);
        outcomes.push(out('FAILED', existing ? await paidText(existing) : 'Slip sudah dibayar.'));
        continue;
      }
      throw error;
    }
  }
  return { ok: true, data: { outcomes } };
}

// ---- Batal bayar (GAJ-103; spec L4f §3.3) ----

export async function cancelPayment(actor: Actor | null, slipId: number, reasonInput: unknown, announce: ChangeAnnounce): Promise<ServiceResult<{ effect: string }>> {
  const loaded = await loadSlip(slipId);
  if (!loaded || !canSeeSlip(actor, loaded.person)) return fail(404, 'Slip tidak ditemukan.');
  const problem = payerProblem(actor, loaded.person, 'payslip.cancel_payment');
  if (problem) return fail(403, problem);
  const reason = String(reasonInput ?? '').trim();
  const reasonBad = reasonProblem(reason);
  if (reasonBad) return fail(400, reasonBad);
  const { person } = loaded;
  return db.transaction(async (tx) => {
    const [slip] = await tx.select().from(payslips).where(eq(payslips.id, slipId)).for('update');
    const payment = slip ? (await activePayments([slip.id], tx)).get(slip.id) : undefined;
    if (!slip || !payment) return fail(409, 'Slip ini belum Dibayar.');
    if (payment.kind === 'NO_MONEY') return fail(409, 'Slip bersih Rp0 tidak punya pembayaran uang. Buka kembali slipnya bila isinya salah.');
    await tx.update(payslipPayments).set({ status: 'CANCELLED', cancelledAt: new Date(), cancelledByAccountId: actor!.accountId, cancelReason: reason })
      .where(eq(payslipPayments.id, payment.id));
    const summary = { number: slip.number, name: person.name, net: payment.amount, moneyDate: payment.moneyDate, paymentId: payment.id };
    await tx.insert(payslipSteps).values({ payslipId: slip.id, periodStart: slip.periodStart, action: 'PAY_CANCEL', reason, summary, actorAccountId: actor!.accountId });
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'payslip', entityId: slip.id, action: 'payslip.cancel_payment', before: { paymentId: payment.id, amount: payment.amount }, after: { status: 'CANCELLED' }, reason });
    const account = (await activeHrisAccounts([person.id])).get(person.id);
    if (account) {
      await notify(tx, [account], {
        kind: 'payslip.payment_cancelled', title: `Pembayaran gaji ${slipPhrase(slip)} dibatalkan.`, body: `Alasan: ${reason}`,
        entity: 'payslip', entityId: slip.id, link: `/pendapatan/slip/${slip.id}`,
      }, actor!.accountId);
    }
    await announce(tx, actor!.accountId, { what: `membatalkan pembayaran slip ${slip.number} ${person.name} ${rupiah(payment.amount)}: ${reason}`, link: `/gaji/slip/${slip.id}`, entity: 'payslip', entityId: slip.id });
    return { ok: true as const, data: { effect: `Pembayaran ${rupiah(payment.amount)} dibatalkan. Slip ${slip.number} kembali Ditutup dan masuk Jadwal Bayar. ${person.name} dan pemilik lain diberi tahu.` } };
  });
}

// ---- Kotak Pembayaran di layar Slip ----

export async function slipPayment(actor: Actor | null, slipId: number) {
  const loaded = await loadSlip(slipId);
  if (!actor || !loaded || !canSeeSlip(actor, loaded.person)) return null;
  const { slip, person } = loaded;
  if (slip.status !== 'CLOSED') return null;
  const all = await db.select().from(payslipPayments).where(eq(payslipPayments.payslipId, slip.id)).orderBy(desc(payslipPayments.createdAt));
  const sources = await moneyPlaces();
  const batches = all.some((p) => p.batchId) ? await db.select().from(payBatches).where(inArray(payBatches.id, all.flatMap((p) => (p.batchId ? [p.batchId] : [])))) : [];
  const names = await accountNames();
  const active = all.find((p) => p.status === 'ACTIVE') ?? null;
  const view = (p: PaymentRow) => {
    const batch = batches.find((b) => b.id === p.batchId);
    return {
      id: p.id, kind: p.kind as 'MONEY' | 'NO_MONEY', amount: p.amount, moneyDate: longDate(p.moneyDate), recordedAt: wibTime(p.createdAt),
      by: names.get(p.paidByAccountId) ?? '-', source: sources.find((s) => s.id === p.moneyPlaceId)?.name ?? null,
      method: p.method ? PAY_METHOD_LABELS[p.method as PayMethod] : null, dateReason: batch?.dateReason ?? null, hasProof: Boolean(batch?.proofFileId),
      cancelled: p.status === 'CANCELLED' ? { at: wibTime(p.cancelledAt!), by: names.get(p.cancelledByAccountId ?? 0) ?? '-', reason: p.cancelReason } : null,
    };
  };
  const can = (action: 'payslip.pay' | 'payslip.cancel_payment') => payerProblem(actor, person, action) == null;
  return {
    paid: active ? view(active) : null,
    history: all.filter((p) => p.status === 'CANCELLED').map(view),
    due: longDate(await dueOf(slip)),
    can: { pay: !active && (slip.net ?? 0) > 0 && can('payslip.pay'), cancel: active?.kind === 'MONEY' && can('payslip.cancel_payment') },
  };
}

/** Foto bukti pembayaran: hanya yang boleh melihat slipnya. */
export async function openPaymentProof(actor: Actor | null, paymentId: number): Promise<string | null> {
  const [row] = await db.select({ slipId: payslipPayments.payslipId, claimId: payslipPayments.claimId, proof: payBatches.proofFileId }).from(payslipPayments)
    .innerJoin(payBatches, eq(payBatches.id, payslipPayments.batchId)).where(eq(payslipPayments.id, paymentId));
  if (!row?.proof) return null;
  // Pembayaran tagihan luar slip (L4f-2): dilihat lewat slip terakhir orangnya.
  const [claim] = row.claimId ? await db.select({ slipId: offSlipClaims.lastPayslipId }).from(offSlipClaims).where(eq(offSlipClaims.id, row.claimId)) : [];
  const slipId = row.slipId ?? claim?.slipId;
  if (!slipId) return null;
  const loaded = await loadSlip(slipId);
  return loaded && canSeeSlip(actor, loaded.person) ? row.proof : null;
}

// ---- Jadwal Bayar (GAJ-L33, GAJ-104) ----

type BankInfo = BankAccount;
const bankInfoOf = bankAccountsOf;

type UnpaidSlip = { slip: SlipRow; person: PayrollPerson; due: IsoDate };

/** Slip Ditutup belum Dibayar per periode (slip Rp0 sudah Dibayar tanpa uang), plus jumlah yang masih Perkiraan di periode yang sudah lewat. */
async function unpaidByPeriod(now: Date): Promise<{ period: string; label: string; unpaid: UnpaidSlip[]; estimate: PayrollPerson[] }[]> {
  const current = periodStartOf(todayWib(now));
  const out: { period: string; label: string; unpaid: UnpaidSlip[]; estimate: PayrollPerson[] }[] = [];
  // Slip mingguan (L7b): per minggu upah, terbaru dulu; minggu berjalan tidak dihitung "belum ditutup".
  const weekly = await db.select().from(payslips).where(and(inArray(payslips.kind, ['WEEKLY', 'WEEKLY_EXTRA']), sql`${payslips.periodStart} >= ${WEEKLY_SLIP_FROM}`))
    .orderBy(desc(payslips.periodStart));
  const weeklyPaid = await activePayments(weekly.filter((r) => r.status === 'CLOSED').map((r) => r.id));
  const today = todayWib(now);
  for (const start of [...new Set(weekly.map((r) => r.periodStart))]) {
    const rows = weekly.filter((r) => r.periodStart === start);
    const unpaid: UnpaidSlip[] = [];
    const estimate: PayrollPerson[] = [];
    for (const slip of rows) {
      if (slip.status === 'CLOSED' && weeklyPaid.has(slip.id)) continue;
      if (slip.status === 'ESTIMATE' && slipEndOf(slip) >= today) continue;
      const person = await slipPerson(slip);
      if (!person) continue;
      if (slip.status === 'CLOSED') unpaid.push({ slip, person, due: await dueOf(slip) });
      else estimate.push(person);
    }
    if (unpaid.length || estimate.length) out.push({ period: weekKey(start), label: slipPhrase(rows[0]), unpaid, estimate });
  }
  for (let p = current; p >= PAYSLIP_FROM; p = addPeriods(p, -1)) {
    const rows = await db.select().from(payslips).where(and(eq(payslips.periodStart, p), eq(payslips.kind, 'MONTHLY')));
    if (!rows.length) continue;
    const people = new Map((await loadPeriodPeople(p, periodEndOf(p))).map((x) => [x.id, x]));
    const paid = await activePayments(rows.filter((r) => r.status === 'CLOSED').map((r) => r.id));
    const unpaid: UnpaidSlip[] = [];
    for (const slip of rows) {
      const person = people.get(slip.employeeId);
      if (!person || slip.status !== 'CLOSED' || paid.has(slip.id)) continue;
      unpaid.push({ slip, person, due: await dueOf(slip) });
    }
    const estimate = p === current ? [] : rows.filter((r) => r.status === 'ESTIMATE').flatMap((r) => (people.get(r.employeeId) ? [people.get(r.employeeId)!] : []));
    out.push({ period: p, label: `periode ${periodLabel(p)}`, unpaid, estimate });
  }
  return out;
}

export async function payScheduleScreen(actor: Actor | null, now: Date = new Date()) {
  const payer = Boolean(actor?.fullAccess) && hasAction(actor, 'payslip.pay');
  if (!actor || !(payer || hasAction(actor, 'pay_schedule.view'))) return null;
  const today = todayWib(now);
  // Tagihan bayar di luar slip (L4f-2): disegarkan saat Pemilik/GM membuka layar ini, selain mesin harian 05.05.
  const offSlip = await import('./off-slip');
  if (payer) await offSlip.syncOffSlipClaimsQuietly(await offSlip.eligibleOrWaitingPeople());
  const outside = await offSlip.offSlipClaimsView(actor, { names: payer });
  const periods = await unpaidByPeriod(now);
  const banks = payer ? await bankInfoOf(periods.flatMap((g) => g.unpaid.map((u) => u.person.id))) : new Map<number, BankInfo>();
  const totals: Record<'LATE' | 'TODAY' | 'WEEK', { count: number; amount: number }> = { LATE: { count: 0, amount: 0 }, TODAY: { count: 0, amount: 0 }, WEEK: { count: 0, amount: 0 } };
  const groups = periods.map((g) => {
    // Finance: tanpa jabatan bertanda dan tanpa nama (GAJ-104).
    const visible = payer ? g.unpaid.filter((u) => canSeeSlip(actor, u.person)) : g.unpaid.filter((u) => !u.person.ownerOnly);
    const due = visible.reduce<IsoDate | null>((min, u) => (min == null || u.due < min ? u.due : min), null);
    const rows = visible.map((u) => {
      const b = dueBucket(u.due, today);
      if (b.bucket !== 'LATER') { totals[b.bucket].count += 1; totals[b.bucket].amount += u.slip.net ?? 0; }
      const bank = banks.get(u.person.id);
      return {
        slipId: u.slip.id, name: u.person.name, branchName: u.slip.branchName ?? u.person.branchName, number: u.slip.number, net: u.slip.net ?? 0,
        due: longDate(u.due), bucket: b.bucket, bucketLabel: DUE_BUCKET_LABELS[b.bucket], daysLate: b.daysLate,
        account: bank ? accountTail(bank.accountNumber) : null, ownSlip: actor.personId === u.person.id && !u.person.isGmPosition,
      };
    }).sort((a, b) => a.branchName.localeCompare(b.branchName) || a.name.localeCompare(b.name));
    const groupBucket = due ? dueBucket(due, today) : null;
    return {
      period: g.period, label: g.label, count: rows.length, amount: rows.reduce((s, r) => s + r.net, 0),
      due: due ? longDate(due) : null, bucket: groupBucket?.bucket ?? null, bucketLabel: groupBucket ? DUE_BUCKET_LABELS[groupBucket.bucket] : null,
      daysLate: groupBucket?.daysLate ?? 0, rows: payer ? rows : [],
      notYetClosed: (payer ? g.estimate.filter((p) => canSeeSlip(actor, p)) : g.estimate.filter((p) => !p.ownerOnly)).length,
    };
  }).filter((g) => g.count || g.notYetClosed);
  return { payer, groups, totals, outside, testMode: payslipTestMode(), canTransfer: payer || hasAction(actor, 'transfer_list.view') };
}

// ---- Bayar Slip langkah 1–2 (GAJ-L34) ----

export async function payPreviewScreen(actor: Actor | null, slipIds: number[], now: Date = new Date()) {
  if (!actor?.fullAccess || !hasAction(actor, 'payslip.pay')) return null;
  const paid = await activePayments(slipIds);
  const ready: { slipId: number; name: string; period: string; number: string | null; net: number; closedOn: IsoDate }[] = [];
  const skipped: { slipId: number; name: string; text: string }[] = [];
  for (const id of slipIds) {
    const loaded = await loadSlip(id);
    if (!loaded || !canSeeSlip(actor, loaded.person)) { skipped.push({ slipId: id, name: `#${id}`, text: 'Slip tidak ditemukan.' }); continue; }
    const { slip, person } = loaded;
    const problem = payerProblem(actor, person, 'payslip.pay')
      ?? (slip.status !== 'CLOSED' ? 'Slip belum ditutup.' : paid.has(slip.id) ? 'Sudah Dibayar.' : (slip.net ?? 0) <= 0 ? 'Bersih Rp0 (Dibayar tanpa uang).' : null);
    if (problem) skipped.push({ slipId: id, name: person.name, text: problem });
    else ready.push({ slipId: slip.id, name: person.name, period: slipPhrase(slip), number: slip.number, net: slip.net ?? 0, closedOn: closedOnOf(slip) });
  }
  const sources = await moneyPlaces({ payable: true });
  return {
    ready, skipped, total: ready.reduce((s, r) => s + r.net, 0), today: todayWib(now),
    latestClosedOn: ready.reduce<IsoDate | null>((max, r) => (max == null || r.closedOn > max ? r.closedOn : max), null),
    sources: sources.map((s) => ({ id: s.id, name: s.name, method: s.method as PayMethod, methodLabel: PAY_METHOD_LABELS[s.method as PayMethod] })),
  };
}

// ---- Daftar Transfer (GAJ-L36, GAJ-100) ----

async function transferRows(actor: Actor, periodStart: string) {
  const groups = await unpaidByPeriod(new Date());
  const group = groups.find((g) => g.period === periodStart);
  // Tanpa jabatan bertanda "Gaji hanya terlihat Pemilik dan GM", termasuk untuk Pemilik/GM (dibayar sendiri).
  const unpaid = (group?.unpaid ?? []).filter((u) => !u.person.ownerOnly);
  const banks = await bankInfoOf(unpaid.map((u) => u.person.id));
  return sortTransfer(unpaid.map((u) => {
    const b = banks.get(u.person.id);
    return { slipId: u.slip.id, name: u.person.name, bank: b?.bank ?? null, accountNumber: b?.accountNumber ?? null, accountHolder: b?.accountHolder ?? null, net: u.slip.net ?? 0 };
  }));
}

const canTransfer = (actor: Actor | null): actor is Actor => Boolean(actor && ((actor.fullAccess && hasAction(actor, 'payslip.pay')) || hasAction(actor, 'transfer_list.view')));

/** Kunci periode Daftar Transfer: tanggal 26 (bulanan) atau `W` + awal minggu (mingguan, L7b). */
function transferPeriod(key: string): { start: IsoDate; label: string } | null {
  const parsed = parsePeriodKey(key);
  if (!parsed || parsed.start < (parsed.weekly ? WEEKLY_SLIP_FROM : PAYSLIP_FROM)) return null;
  return { start: parsed.start, label: parsed.weekly ? `minggu mulai ${longDate(parsed.start)}` : periodLabel(parsed.start) };
}

export async function transferScreen(actor: Actor | null, key: string) {
  const period = transferPeriod(key);
  if (!canTransfer(actor) || !period) return null;
  const groups = await unpaidByPeriod(new Date());
  const label = groups.find((g) => g.period === key)?.label ?? period.label;
  const rows = await transferRows(actor, key);
  // Tiap buka dicatat (GAJ-100).
  await db.insert(payslipSteps).values({ payslipId: null, periodStart: period.start, action: 'TRANSFER_VIEW', summary: { count: rows.length }, actorAccountId: actor.accountId });
  return { period: { start: key, label }, rows, total: rows.reduce((s, r) => s + r.net, 0) };
}

export async function transferDownload(actor: Actor | null, periodStart: string, now: Date = new Date()): Promise<{ filename: string; csv: string } | null> {
  const period = transferPeriod(periodStart);
  if (!canTransfer(actor) || !period) return null;
  const rows = await transferRows(actor, periodStart);
  const madeBy = (await accountNames()).get(actor.accountId) ?? '-';
  await db.insert(payslipSteps).values({ payslipId: null, periodStart: period.start, action: 'TRANSFER_DOWNLOAD', summary: { count: rows.length }, actorAccountId: actor.accountId });
  return {
    filename: `daftar-transfer-${periodStart}-dibuat-${todayWib(now)}.csv`,
    csv: transferCsv(rows, { period: period.label, madeBy, madeAt: wibTime(now) }),
  };
}

// ---- Sumber Uang (Pengaturan) ----

/**
 * Sumber Uang = daftar Tempat Uang Back Office (F2-1b): HRIS hanya membaca; tambah/ubah/nonaktif di
 * Back Office › Pengaturan › Tempat Uang. Laci kasir tampil tetapi tidak ditawarkan saat membayar.
 */
export async function paymentSourcesScreen(actor: Actor | null) {
  const manage = Boolean(actor?.fullAccess) && hasAction(actor, 'payment_sources.manage');
  if (!manage) return null;
  const rows = await moneyPlaces();
  const base = (process.env.BACKOFFICE_PUBLIC_URL ?? '').trim().replace(/\/+$/, '');
  const boRoot = /^https?:\/\/[^/\s]+$/.test(base) ? base : null;
  return {
    manageUrl: boRoot ? `${boRoot}/settings/money-places` : null,
    rows: rows.map((r) => ({
      id: r.id, name: r.name, kindLabel: MONEY_PLACE_KIND_LABELS[r.kind], branchName: r.branchName, accountTail: r.accountTail,
      heldBy: MONEY_PLACE_HOLDER_LABELS[r.heldBy] ?? r.heldBy, holderNote: r.holderNote, methodLabel: PAY_METHOD_LABELS[r.method], active: r.active,
      payable: r.active && r.kind !== 'DRAWER',
    })),
  };
}

// ---- Status bayar untuk daftar periode dan halaman periode ----

/** Jumlah slip Dibayar per periode (slip Rp0 tanpa uang ikut terhitung). */
export async function paidCounts(periodStarts: readonly IsoDate[]): Promise<Map<IsoDate, number>> {
  if (!periodStarts.length) return new Map();
  const rows = await db.select({ periodStart: payslips.periodStart, n: sql<number>`count(*)::int` }).from(payslipPayments)
    .innerJoin(payslips, eq(payslips.id, payslipPayments.payslipId))
    .where(and(inArray(payslips.periodStart, [...periodStarts]), eq(payslipPayments.status, 'ACTIVE')))
    .groupBy(payslips.periodStart);
  return new Map(rows.map((r) => [r.periodStart, Number(r.n)]));
}

// ---- Mesin terjadwal (spec L4f §6) ----

/** 07.00 WIB: pengingat ke Pemilik dan GM per periode yang slipnya lewat jatuh bayar dan belum ditandai Dibayar. */
export async function runPayslipPayReminder(now: Date = new Date()) {
  const today = todayWib(now);
  const owners = await activeHrisAccounts(await listEmployeesWithAnyAction([]));
  const sent: { period: IsoDate; count: number }[] = [];
  for (const g of await unpaidByPeriod(now)) {
    const late = g.unpaid.filter((u) => reminderDue(u.due, today));
    if (!late.length || !owners.size) continue;
    const since = late.reduce((min, u) => (u.due < min ? u.due : min), late[0].due);
    await db.transaction((tx) => notify(tx, [...owners.values()], {
      kind: 'payslip.pay_reminder', title: `Ada ${late.length} slip ${g.label} belum ditandai Dibayar, sejak ${longDate(since)}.`,
      body: `Jumlah ${rupiah(late.reduce((s, u) => s + (u.slip.net ?? 0), 0))}.`, link: '/gaji/jadwal-bayar',
    }, null));
    sent.push({ period: g.period, count: late.length });
  }
  return { sent };
}

export type { DueBucket };
