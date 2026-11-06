import Big from 'big.js';
import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  paymentSources, unloadingOverpaymentUses, unloadingOverpayments, unloadingPaymentLines, unloadingPayments, unloadingPhotos, unloadingReceiptClaims,
  unloadingReports, unloadingShares, unloadingTopUpLines, unloadingTopUps,
} from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { hasAction, listEmployeesWithAnyAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { todayWib } from '@/modules/employees';
import { filesUploadedBy } from '@/modules/files';
import { notify } from '@/modules/notifications';
import type { RequestHandler } from '@/modules/requests';
import { settingOn } from '@/modules/settings';
import { MONEY_DATE_FREE_DAYS, daysBetween } from '../rules/payment';
import { addDays, longDate, periodEndOf, periodStartOf, rupiah, type IsoDate } from '../rules/salary';
import { MIN_REASON, UNLOADING_FLAG_LABELS, UNLOADING_STATUS_LABELS, kgText, type UnloadingStatus } from '../rules/unloading';
import {
  NOT_RECEIVED_DAYS, OVERPAY_STATUS_LABELS, TOP_UP_STATUS_LABELS, correctionDelta, offsetShare, overpaymentRemaining, payerProblem, type OpenOverpayment,
} from '../rules/unloading-pay';
import { accountNames } from './data';
import {
  accountsWith, announceActive, canViewUnloading, checkUnloading, initialSyncStatus, itemsOf, reportFlags, sharesOf, unloadingFormScreen, writeVersion, type UnloadingInput,
} from './unloading';

// Bayar Bongkaran L8b (spec L8 §3.4–3.5; DRV-47 s.d. 53, 111 s.d. 120).

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });
const reportLink = (id: number) => `/gaji/bongkaran/${id}`;
const MY_LINK = '/pendapatan#bongkaran';
const reasonOf = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const keyOf = (row: { employeeId: number | null; casualWorkerId: number | null }) => (row.employeeId != null ? `E${row.employeeId}` : `C${row.casualWorkerId}`);
const personOf = (key: string) => (key.startsWith('E') ? { employeeId: Number(key.slice(1)), casualWorkerId: null } : { employeeId: null, casualWorkerId: Number(key.slice(1)) });
const isoWib = (at: Date) => new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
type Executor = typeof db | Tx;
type Report = typeof unloadingReports.$inferSelect;

async function ownerAccounts(): Promise<number[]> {
  return [...(await activeHrisAccounts(await listEmployeesWithAnyAction([]))).values()];
}

async function accountsOfKeys(keys: string[]): Promise<Map<string, number>> {
  const ids = keys.filter((k) => k.startsWith('E')).map((k) => Number(k.slice(1)));
  const accounts = await activeHrisAccounts(ids);
  return new Map([...accounts].map(([id, account]) => [`E${id}`, account]));
}

// ---- Lebih bayar: sisa dihitung dari pemakaian (DRV-118) ----

type OverRow = typeof unloadingOverpayments.$inferSelect & { remaining: number; key: string };

async function overpaymentsWith(executor: Executor, where: SQL | undefined): Promise<OverRow[]> {
  const rows = await executor.select().from(unloadingOverpayments).where(where).orderBy(asc(unloadingOverpayments.createdAt), asc(unloadingOverpayments.id));
  if (!rows.length) return [];
  const uses = await executor.select().from(unloadingOverpaymentUses).where(inArray(unloadingOverpaymentUses.overpaymentId, rows.map((r) => r.id)));
  return rows.map((r) => ({
    ...r, key: keyOf(r),
    remaining: r.status === 'WRITTEN_OFF' ? 0 : overpaymentRemaining(r.amount, uses.filter((u) => u.overpaymentId === r.id).map((u) => ({ amount: u.amount, active: u.status === 'ACTIVE' }))),
  }));
}

const toOpen = (rows: OverRow[]): OpenOverpayment[] => rows.filter((r) => r.remaining > 0 && r.status !== 'WRITTEN_OFF').map((r) => ({ id: r.id, remaining: r.remaining, createdAt: r.createdAt.toISOString() }));

/**
 * Uang yang sudah dihitung diterima tiap orang untuk satu laporan: bagian di pembayaran pertama + susulan dibayar − lebih bayar laporan itu yang
 * masih dihitung utang (nominal − pengurangan koreksi − hapus). Dasar fungsi "selisih bongkaran" (DRV-116).
 */
async function creditedFor(tx: Tx, reportId: number): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const add = (key: string, amount: number) => out.set(key, (out.get(key) ?? 0) + amount);
  const payments = await tx.select().from(unloadingPayments).where(and(eq(unloadingPayments.reportId, reportId), eq(unloadingPayments.status, 'ACTIVE')));
  if (payments.length) {
    const lines = await tx.select().from(unloadingPaymentLines).where(inArray(unloadingPaymentLines.paymentId, payments.map((p) => p.id)));
    for (const line of lines) add(keyOf(line), line.share);
  }
  const overs = await tx.select().from(unloadingOverpayments).where(eq(unloadingOverpayments.reportId, reportId));
  if (overs.length) {
    const uses = await tx.select().from(unloadingOverpaymentUses).where(and(inArray(unloadingOverpaymentUses.overpaymentId, overs.map((o) => o.id)), eq(unloadingOverpaymentUses.status, 'ACTIVE')));
    for (const o of overs) {
      const forgiven = uses.filter((u) => u.overpaymentId === o.id && (u.kind === 'CORRECTION' || u.kind === 'WRITE_OFF')).reduce((s, u) => s + u.amount, 0);
      add(keyOf(o), -(o.amount - forgiven));
    }
  }
  return out;
}

// ---- Bayar (DRV-L17) ----

export type PayTarget = { reportId: number; topUpId: number | null };
export type PayInput = {
  targets: PayTarget[]; sourceId: unknown; moneyDate: unknown; dateReason?: unknown; proofFileId?: unknown;
  /** Per sasaran: kunci orang yang dititipi (E/C) atau kosong = langsung ke tiap peserta (DRV-113). */
  handedTo: Record<string, string | null>;
};

type PayLine = { key: string; name: string; share: number };

async function linesToPay(tx: Executor, report: Report, topUpId: number | null): Promise<{ lines: PayLine[]; topUp: typeof unloadingTopUps.$inferSelect | null } | Fail> {
  if (topUpId == null) {
    if (report.status !== 'ACTIVE') return fail(409, `${report.number} ${report.status === 'PAID' ? 'sudah dibayar' : 'tidak bisa dibayar'} (${UNLOADING_STATUS_LABELS[report.status as UnloadingStatus]}).`);
    const shares = (await sharesOf(tx, report.id, report.version)).filter((s) => s.status === 'ACTIVE');
    return { lines: shares.map((s) => ({ key: keyOf(s), name: s.name, share: s.amount })), topUp: null };
  }
  const [topUp] = await tx.select().from(unloadingTopUps).where(and(eq(unloadingTopUps.id, topUpId), eq(unloadingTopUps.reportId, report.id)));
  if (!topUp || topUp.status !== 'WAITING') return fail(409, `Susulan ${report.number} tidak menunggu bayar.`);
  const lines = await tx.select().from(unloadingTopUpLines).where(eq(unloadingTopUpLines.topUpId, topUp.id));
  return { lines: lines.map((l) => ({ key: keyOf(l), name: l.name, share: l.amount })), topUp };
}

/** Rencana bayar satu sasaran: yang diterima tiap orang sesudah lebih bayar diperhitungkan (dipakai layar dan langkah bayar). */
async function planFor(tx: Executor, lines: PayLine[]) {
  const keys = lines.map((l) => l.key);
  const persons = keys.map(personOf);
  const employeeIds = persons.flatMap((p) => (p.employeeId != null ? [p.employeeId] : []));
  const casualIds = persons.flatMap((p) => (p.casualWorkerId != null ? [p.casualWorkerId] : []));
  const overs = (employeeIds.length || casualIds.length)
    ? await overpaymentsWith(tx, or(employeeIds.length ? inArray(unloadingOverpayments.employeeId, employeeIds) : undefined, casualIds.length ? inArray(unloadingOverpayments.casualWorkerId, casualIds) : undefined))
    : [];
  return lines.map((line) => {
    const open = toOpen(overs.filter((o) => o.key === line.key));
    const result = offsetShare(line.share, open);
    return { ...line, ...result };
  });
}

function moneyDateCheck(moneyDate: string, today: IsoDate, workDate: IsoDate, reason: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(moneyDate)) return 'Tanggal uang tidak sah.';
  if (moneyDate > today) return 'Tanggal uang tidak boleh sesudah hari ini.';
  if (moneyDate < workDate) return 'Tanggal uang tidak boleh sebelum tanggal kerja.';
  if (daysBetween(moneyDate, today) > MONEY_DATE_FREE_DAYS && reason.length < MIN_REASON) {
    return `Tanggal uang mundur lebih dari ${MONEY_DATE_FREE_DAYS} hari: tulis alasannya (paling sedikit ${MIN_REASON} huruf).`;
  }
  return null;
}

async function payOne(tx: Tx, actor: Actor, target: PayTarget, input: PayInput, source: typeof paymentSources.$inferSelect | null, now: Date, announce: ChangeAnnounce) {
  const [report] = await tx.select().from(unloadingReports).where(eq(unloadingReports.id, target.reportId)).for('update');
  if (!report) return fail(404, 'Laporan tidak ditemukan.');
  const found = await linesToPay(tx, report, target.topUpId);
  if ('ok' in found) return found;
  const label = `${found.topUp ? 'Susulan ' : ''}${report.number}`;
  const payer = payerProblem({ fullAccess: actor.fullAccess, isParticipant: found.lines.some((l) => l.key === `E${actor.personId}`), isCreator: report.createdByEmployeeId === actor.personId });
  if (payer.problem) return fail(403, `${label}: ${payer.problem}`);
  const today = todayWib(now);
  const moneyDate = String(input.moneyDate ?? today);
  const dateReason = reasonOf(input.dateReason);
  const dateProblem = moneyDateCheck(moneyDate, today, report.workDate, dateReason);
  if (dateProblem) return fail(400, `${label}: ${dateProblem}`);
  const handedKey = input.handedTo[`${target.reportId}:${target.topUpId ?? 0}`] ?? null;
  let handedToName: string | null = null;
  if (handedKey) {
    const line = found.lines.find((l) => l.key === handedKey);
    if (line) handedToName = line.name;
    else if (handedKey === `E${report.createdByEmployeeId}`) handedToName = (await accountNames()).get(report.createdByAccountId) ?? 'pembuat laporan';
    else return fail(400, `${label}: yang dititipi harus peserta atau pembuat laporan.`);
  }
  const plan = await planFor(tx, found.lines);
  const amount = plan.reduce((s, l) => s + l.received, 0);
  if (amount > 0 && !source) return fail(400, 'Pilih sumber uang.');
  const [payment] = await tx.insert(unloadingPayments).values({
    reportId: report.id, topUpId: found.topUp?.id ?? null, kind: amount > 0 ? 'MONEY' : 'NO_MONEY', amount, moneyDate, dateReason: dateReason || null,
    sourceId: amount > 0 ? source!.id : null, method: amount > 0 ? source!.method : null, paidByAccountId: actor.accountId, ownerFlag: payer.ownerFlag,
    handedToName, proofFileId: input.proofFileId ? String(input.proofFileId) : null,
    breakdown: {
      report: report.number, supplier: report.supplierName, workDate: report.workDate, totalKg: report.totalKg, costBranchId: report.costBranchId, topUp: !!found.topUp,
      offset: plan.reduce((s, l) => s + l.offset, 0), people: plan.length,
    },
  }).returning({ id: unloadingPayments.id });
  await tx.insert(unloadingPaymentLines).values(plan.map((l) => ({ paymentId: payment.id, ...personOf(l.key), name: l.name, share: l.share, offset: l.offset, received: l.received })));
  const uses = plan.flatMap((l) => l.uses.map((u) => ({ overpaymentId: u.id, kind: 'OFFSET', amount: u.amount, paymentId: payment.id, createdByAccountId: actor.accountId })));
  if (uses.length) await tx.insert(unloadingOverpaymentUses).values(uses);
  if (found.topUp) await tx.update(unloadingTopUps).set({ status: 'PAID' }).where(eq(unloadingTopUps.id, found.topUp.id));
  else await tx.update(unloadingReports).set({ status: 'PAID' }).where(eq(unloadingReports.id, report.id));
  const accounts = await accountsOfKeys(plan.map((l) => l.key));
  for (const l of plan) {
    const account = accounts.get(l.key);
    if (!account) continue;
    await notify(tx, [account], {
      kind: 'unloading.paid',
      title: `${found.topUp ? 'Susulan upah' : 'Upah'} bongkaran ${longDate(report.workDate)} ${rupiah(l.received)} sudah dibayar tanggal ${longDate(moneyDate)}${handedToName ? `, diserahkan lewat ${handedToName}` : ''}.`,
      body: l.offset ? `Bagian ${rupiah(l.share)}, diperhitungkan lebih bayar sebelumnya ${rupiah(l.offset)}. Bila uangnya belum Anda terima, laporkan dalam ${NOT_RECEIVED_DAYS} hari.` : `Bila uangnya belum Anda terima, laporkan dalam ${NOT_RECEIVED_DAYS} hari.`,
      link: MY_LINK, entity: 'unloading_payment', entityId: payment.id,
    }, actor.accountId);
  }
  if (payer.ownerFlag) await announce(tx, actor.accountId, { what: `membayar ${label} (${rupiah(amount)}) yang ia ikuti atau buat sendiri`, link: reportLink(report.id), entity: 'unloading_report', entityId: report.id });
  await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'unloading_payment', entityId: payment.id, action: 'unloading.pay', before: null, after: { report: report.number, topUpId: found.topUp?.id ?? null, amount, moneyDate } });
  return { ok: true as const, data: { label, amount, people: plan.length } };
}

/** Bayar satu atau beberapa laporan/susulan dari satu sumber uang; tiap sasaran satu langkah utuh tersendiri (DRV-111). */
export async function payUnloading(actor: Actor | null, input: PayInput, announce: ChangeAnnounce, now: Date = new Date()) {
  if (!hasAction(actor, 'unloading.pay')) return fail(403, 'Anda tidak berhak membayar bongkaran.');
  if (!input.targets.length) return fail(400, 'Pilih laporan yang dibayar.');
  const [source] = input.sourceId ? await db.select().from(paymentSources).where(and(eq(paymentSources.id, Number(input.sourceId)), eq(paymentSources.active, true))) : [];
  if (input.proofFileId && !(await db.transaction((tx) => filesUploadedBy(tx, actor!.accountId, [String(input.proofFileId)]))).length) return fail(400, 'Foto bukti tidak ditemukan. Unggah ulang.');
  const done: { label: string; amount: number; people: number }[] = [];
  const failed: string[] = [];
  for (const target of input.targets) {
    try {
      const result = await db.transaction(async (tx) => {
        const r = await payOne(tx, actor!, target, input, source ?? null, now, announce);
        if (!r.ok) throw Object.assign(new Error(r.error), { failed: r });
        return r;
      });
      done.push(result.data);
    } catch (error) {
      const failedResult = (error as { failed?: Fail }).failed;
      if (!failedResult) {
        if ((error as { cause?: { code?: string } })?.cause?.code === '23505') { failed.push(`Laporan #${target.reportId}: sudah dibayar orang lain.`); continue; }
        throw error;
      }
      failed.push(failedResult.error);
    }
  }
  if (!done.length) return fail(409, failed.join(' '));
  return { ok: true as const, data: { paid: done.length, total: done.reduce((s, d) => s + d.amount, 0), failed } };
}

// ---- Tanyakan dulu / Jawab (DRV-114, B4) ----

export async function askUnloading(actor: Actor | null, reportId: number, question: unknown): Promise<ServiceResult<object>> {
  if (!hasAction(actor, 'unloading.pay')) return fail(403, 'Hanya Finance, Pemilik, atau GM yang menanyakan sebelum membayar.');
  const text = reasonOf(question);
  if (text.length < MIN_REASON) return fail(400, `Pertanyaan paling sedikit ${MIN_REASON} huruf.`);
  return db.transaction(async (tx) => {
    const [report] = await tx.select().from(unloadingReports).where(eq(unloadingReports.id, reportId)).for('update');
    if (!report || report.status !== 'ACTIVE') return fail(409, 'Hanya laporan yang belum dibayar yang bisa ditanyakan.');
    await tx.update(unloadingReports).set({ question: text, askedByAccountId: actor!.accountId, askedAt: new Date(), answer: null, answeredAt: null }).where(eq(unloadingReports.id, reportId));
    await notify(tx, [report.createdByAccountId, ...(await ownerAccounts())], {
      kind: 'unloading.asked', title: `${report.number} ditanyakan sebelum dibayar`, body: text, link: reportLink(reportId), entity: 'unloading_report', entityId: reportId,
    }, actor!.accountId);
    return { ok: true as const, data: {} };
  });
}

export async function answerUnloading(actor: Actor | null, reportId: number, answer: unknown): Promise<ServiceResult<object>> {
  const text = reasonOf(answer);
  if (text.length < 3) return fail(400, 'Tulis jawabannya.');
  return db.transaction(async (tx) => {
    const [report] = await tx.select().from(unloadingReports).where(eq(unloadingReports.id, reportId)).for('update');
    if (!report || !report.question || report.answeredAt) return fail(409, 'Tidak ada pertanyaan yang menunggu jawaban.');
    if (!actor || (report.createdByAccountId !== actor.accountId && !actor.fullAccess)) return fail(403, 'Hanya pembuat laporan, Pemilik, atau GM yang menjawab.');
    await tx.update(unloadingReports).set({ answer: text, answeredAt: new Date() }).where(eq(unloadingReports.id, reportId));
    if (report.askedByAccountId) {
      await notify(tx, [report.askedByAccountId], { kind: 'unloading.answered', title: `Pertanyaan ${report.number} dijawab`, body: text, link: reportLink(reportId), entity: 'unloading_report', entityId: reportId }, actor.accountId);
    }
    return { ok: true as const, data: {} };
  });
}

// ---- Koreksi dan batal (DRV-115, 116) ----

export type CorrectInput = UnloadingInput & { reason: unknown; applyWeights?: unknown };

type DeltaRow = { key: string; name: string; before: number; after: number; topUp: number; overpay: number; reduced: number };

/** Akibat koreksi per orang sebelum disimpan (DRV-L18 langkah 2) dan saat menyimpan. */
async function correctionEffect(tx: Tx, report: Report, next: Map<string, { name: string; amount: number }>): Promise<{ rows: DeltaRow[]; reduces: { id: number; amount: number }[] }> {
  const credited = await creditedFor(tx, report.id);
  const oldShares = (await sharesOf(tx, report.id, report.version)).filter((s) => s.status === 'ACTIVE');
  const names = new Map([...oldShares.map((s) => [keyOf(s), s.name] as const), ...[...next].map(([k, v]) => [k, v.name] as const)]);
  const sameReport = await overpaymentsWith(tx, eq(unloadingOverpayments.reportId, report.id));
  const rows: DeltaRow[] = [];
  const reduces: { id: number; amount: number }[] = [];
  for (const key of new Set([...credited.keys(), ...next.keys(), ...oldShares.map(keyOf)])) {
    const before = oldShares.find((s) => keyOf(s) === key)?.amount ?? 0;
    const after = next.get(key)?.amount ?? 0;
    if (report.status !== 'PAID') { rows.push({ key, name: names.get(key) ?? key, before, after, topUp: 0, overpay: 0, reduced: 0 }); continue; }
    const delta = correctionDelta({ next: after, credited: credited.get(key) ?? 0, sameReportOpen: toOpen(sameReport.filter((o) => o.key === key)) });
    reduces.push(...delta.reduce);
    rows.push({ key, name: names.get(key) ?? key, before, after, topUp: delta.topUp, overpay: delta.overpay, reduced: delta.reduce.reduce((s, r) => s + r.amount, 0) });
  }
  return { rows, reduces };
}

function correctionRights(actor: Actor | null, report: Report): string | null {
  if (!actor) return 'Perlu masuk.';
  if (report.status === 'ACTIVE') return hasAction(actor, 'unloading.create') ? null : 'Hanya Kepala Gudang, Pemilik, atau GM yang mengoreksi laporan yang belum dibayar.';
  if (report.status === 'PAID') return hasAction(actor, 'unloading.correct_paid') ? null : 'Laporan yang sudah dibayar hanya dikoreksi Pemilik atau GM.';
  if (report.status === 'PENDING') return 'Laporan terlambat yang menunggu tidak dikoreksi: tarik pengajuannya, lalu buat laporan baru.';
  return 'Laporan ini sudah selesai dan tidak bisa dikoreksi.';
}

/** Tulis akibat uang koreksi sesudah dibayar: susulan menunggu lama dibatalkan, pengurangan lebih bayar, susulan baru, lebih bayar baru (DRV-116 s.d. 118). */
async function applyEffect(tx: Tx, actor: Actor, report: Report, version: number, effect: Awaited<ReturnType<typeof correctionEffect>>) {
  if (report.status !== 'PAID') return { topUp: 0, overpay: 0 };
  await tx.update(unloadingTopUps).set({ status: 'CANCELLED', cancelledAt: new Date() }).where(and(eq(unloadingTopUps.reportId, report.id), eq(unloadingTopUps.status, 'WAITING')));
  if (effect.reduces.length) {
    await tx.insert(unloadingOverpaymentUses).values(effect.reduces.map((r) => ({ overpaymentId: r.id, kind: 'CORRECTION', amount: r.amount, createdByAccountId: actor.accountId })));
  }
  const topUps = effect.rows.filter((r) => r.topUp > 0);
  if (topUps.length) {
    const [topUp] = await tx.insert(unloadingTopUps).values({ reportId: report.id, version, status: 'WAITING' }).returning({ id: unloadingTopUps.id });
    await tx.insert(unloadingTopUpLines).values(topUps.map((r) => ({ topUpId: topUp.id, ...personOf(r.key), name: r.name, amount: r.topUp })));
  }
  const overs = effect.rows.filter((r) => r.overpay > 0);
  if (overs.length) await tx.insert(unloadingOverpayments).values(overs.map((r) => ({ reportId: report.id, version, ...personOf(r.key), name: r.name, amount: r.overpay })));
  return { topUp: topUps.reduce((s, r) => s + r.topUp, 0), overpay: overs.reduce((s, r) => s + r.overpay, 0) };
}

async function notifyChanged(tx: Tx, actor: Actor, report: Report, rows: DeltaRow[], reason: string, cancelled: boolean) {
  const accounts = await accountsOfKeys(rows.map((r) => r.key));
  for (const r of rows) {
    if (r.before === r.after && !r.topUp && !r.overpay) continue;
    const account = accounts.get(r.key);
    if (!account) continue;
    const tail = r.topUp ? ` Kekurangan ${rupiah(r.topUp)} disusulkan tunai.` : r.overpay ? ` Kelebihan ${rupiah(r.overpay)} diperhitungkan di bongkaran Anda berikutnya.` : '';
    await notify(tx, [account], {
      kind: cancelled ? 'unloading.cancelled' : 'unloading.corrected',
      title: `Upah bongkaran ${longDate(report.workDate)} ${cancelled ? 'dibatalkan' : 'dikoreksi'}: ${rupiah(r.before)} → ${rupiah(r.after)}.${tail}`,
      body: `Alasan: ${reason}`, link: MY_LINK, entity: 'unloading_report', entityId: report.id,
    }, actor.accountId);
  }
}

export async function correctionPreview(actor: Actor | null, reportId: number, input: CorrectInput, now: Date = new Date()) {
  return db.transaction(async (tx) => {
    const [report] = await tx.select().from(unloadingReports).where(eq(unloadingReports.id, reportId));
    if (!report) return fail(404, 'Laporan tidak ditemukan.');
    const rights = correctionRights(actor, report);
    if (rights) return fail(403, rights);
    const checked = await checkUnloading(tx, actor!, input, now, false, { id: report.id, createdOn: report.createdOn });
    if ('ok' in checked) return checked;
    const next = new Map(checked.participants.map((p) => [p.key, { name: p.name, amount: checked.result.shares.find((s) => s.key === p.key)!.amount }]));
    const effect = await correctionEffect(tx, report, next);
    return {
      ok: true as const,
      data: {
        paid: report.status === 'PAID', before: { totalKg: report.totalKg, totalPay: report.totalPay }, after: { totalKg: checked.result.totalKg, totalPay: checked.result.totalPay },
        rows: effect.rows, similar: checked.similar,
      },
    };
  });
}

/** Status kirim ke kasir sesudah koreksi: versi baru perlu dikirim lagi bila pernah terkirim atau ada barang kasir. */
function nextSyncStatus(report: typeof unloadingReports.$inferSelect, checked: Parameters<typeof initialSyncStatus>[0]) {
  const fresh = initialSyncStatus(checked);
  if (fresh === 'WAITING_APPROVAL' && report.draftApprovedAt) return 'PENDING';
  if (fresh === 'NONE' && report.poSyncedVersion != null) return 'PENDING';
  return fresh;
}

export async function correctUnloading(actor: Actor | null, reportId: number, input: CorrectInput, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<{ message: string }>> {
  const reason = reasonOf(input.reason);
  if (reason.length < MIN_REASON) return fail(400, `Alasan koreksi paling sedikit ${MIN_REASON} huruf.`);
  return db.transaction(async (tx) => {
    const [report] = await tx.select().from(unloadingReports).where(eq(unloadingReports.id, reportId)).for('update');
    if (!report) return fail(404, 'Laporan tidak ditemukan.');
    const rights = correctionRights(actor, report);
    if (rights) return fail(403, rights);
    // Asal barang tidak berubah lewat koreksi (PO yang dicocokkan tetap; Draft PO tetap satu per laporan).
    const checked = await checkUnloading(tx, actor!, { ...input, source: report.source, poId: report.poId }, now, true, { id: report.id, createdOn: report.createdOn });
    if ('ok' in checked) return checked;
    const next = new Map(checked.participants.map((p) => [p.key, { name: p.name, amount: checked.result.shares.find((s) => s.key === p.key)!.amount }]));
    const effect = await correctionEffect(tx, report, next);
    const version = report.version + 1;
    const oldPhotos = await tx.select().from(unloadingPhotos).where(and(eq(unloadingPhotos.reportId, report.id), eq(unloadingPhotos.version, report.version)));
    const kind = checked.noDeliveryNoteReason ? 'GOODS' : 'DELIVERY_NOTE';
    const photos = checked.photoIds.length ? checked.photoIds.map((fileId) => ({ fileId, kind })) : oldPhotos.map((p) => ({ fileId: p.fileId, kind: p.kind }));
    await tx.update(unloadingShares).set({ status: 'CANCELLED' }).where(and(eq(unloadingShares.reportId, report.id), eq(unloadingShares.version, report.version), eq(unloadingShares.status, 'ACTIVE')));
    await writeVersion(tx, actor!, report.id, version, checked, 'ACTIVE', reason, input.applyWeights === true, photos);
    await tx.update(unloadingReports).set({
      version, workDate: checked.workDate, supplierId: checked.supplierId, supplierName: checked.supplierName, rate: checked.rate,
      totalKg: checked.result.totalKg, totalPay: checked.result.totalPay, similarToId: checked.similarConfirmedId,
      noDeliveryNoteReason: checked.photoIds.length ? checked.noDeliveryNoteReason : report.noDeliveryNoteReason,
      poMismatch: checked.poMismatch, poSyncStatus: nextSyncStatus(report, checked),
      ...(report.question && !report.answeredAt ? { answer: `Dikoreksi: ${reason}`, answeredAt: now } : {}),
    }).where(eq(unloadingReports.id, report.id));
    const money = await applyEffect(tx, actor!, report, version, effect);
    await notifyChanged(tx, actor!, report, effect.rows, reason, false);
    if (report.status === 'ACTIVE') await announceActive(tx, { id: report.id, number: report.number, totalPay: checked.result.totalPay, workDate: checked.workDate, supplierName: checked.supplierName }, actor!.accountId);
    if (report.status === 'PAID') await announce(tx, actor!.accountId, { what: `mengoreksi ${report.number} yang sudah dibayar: ${rupiah(report.totalPay)} → ${rupiah(checked.result.totalPay)}`, link: reportLink(report.id), entity: 'unloading_report', entityId: report.id });
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'unloading_report', entityId: report.id, action: 'unloading_report.correct', before: { version: report.version, totalPay: report.totalPay }, after: { version, totalPay: checked.result.totalPay, ...money }, reason });
    const message = report.status === 'PAID'
      ? `${report.number} dikoreksi.${money.topUp ? ` Susulan ${rupiah(money.topUp)} menunggu dibayar Finance.` : ''}${money.overpay ? ` Lebih bayar ${rupiah(money.overpay)} diperhitungkan di bongkaran berikutnya.` : ''}`
      : `${report.number} dikoreksi. Finance diberi tahu jumlah barunya ${rupiah(checked.result.totalPay)}.`;
    return { ok: true as const, data: { message } };
  });
}

export async function cancelUnloading(actor: Actor | null, reportId: number, reasonInput: unknown, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<{ message: string }>> {
  const reason = reasonOf(reasonInput);
  if (reason.length < MIN_REASON) return fail(400, `Alasan paling sedikit ${MIN_REASON} huruf.`);
  return db.transaction(async (tx) => {
    const [report] = await tx.select().from(unloadingReports).where(eq(unloadingReports.id, reportId)).for('update');
    if (!report) return fail(404, 'Laporan tidak ditemukan.');
    const rights = correctionRights(actor, report);
    if (rights) return fail(403, rights.replace('mengoreksi', 'membatalkan').replace('dikoreksi', 'dibatalkan'));
    const effect = await correctionEffect(tx, report, new Map());
    const money = await applyEffect(tx, actor!, report, report.version, effect);
    await tx.update(unloadingShares).set({ status: 'CANCELLED' }).where(and(eq(unloadingShares.reportId, report.id), eq(unloadingShares.status, 'ACTIVE')));
    await tx.update(unloadingReports).set({
      status: 'CANCELLED', cancelledAt: now, cancelledByAccountId: actor!.accountId, cancelReason: reason,
      poSyncStatus: report.poSyncedVersion == null ? 'NONE' : 'PENDING',
    }).where(eq(unloadingReports.id, report.id));
    await notifyChanged(tx, actor!, report, effect.rows, reason, true);
    if (report.status === 'PAID') await announce(tx, actor!.accountId, { what: `membatalkan ${report.number} yang sudah dibayar (${rupiah(report.totalPay)})`, link: reportLink(report.id), entity: 'unloading_report', entityId: report.id });
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'unloading_report', entityId: report.id, action: 'unloading_report.cancel', before: { status: report.status }, after: { status: 'CANCELLED', ...money }, reason });
    return { ok: true as const, data: { message: report.status === 'PAID' ? `${report.number} dibatalkan. ${rupiah(money.overpay)} menjadi lebih bayar dan diperhitungkan di bongkaran berikutnya.` : `${report.number} dibatalkan dan keluar dari daftar bayar.` } };
  });
}

// ---- Batal bayar (DRV-119) ----

export async function cancelUnloadingPayment(actor: Actor | null, paymentId: number, reasonInput: unknown, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<object>> {
  if (!hasAction(actor, 'unloading.cancel_payment')) return fail(403, 'Hanya Pemilik atau GM yang membatalkan pembayaran bongkaran.');
  const reason = reasonOf(reasonInput);
  if (reason.length < MIN_REASON) return fail(400, `Alasan paling sedikit ${MIN_REASON} huruf.`);
  return db.transaction(async (tx) => {
    const [payment] = await tx.select().from(unloadingPayments).where(eq(unloadingPayments.id, paymentId)).for('update');
    if (!payment || payment.status !== 'ACTIVE') return fail(404, 'Pembayaran yang berlaku tidak ditemukan.');
    const [report] = await tx.select().from(unloadingReports).where(eq(unloadingReports.id, payment.reportId)).for('update');
    const [later] = await tx.select({ n: sql<number>`count(*)::int` }).from(unloadingOverpayments)
      .where(and(eq(unloadingOverpayments.reportId, report.id), gt(unloadingOverpayments.createdAt, payment.createdAt)));
    const [laterTopUps] = await tx.select({ n: sql<number>`count(*)::int` }).from(unloadingTopUps)
      .where(and(eq(unloadingTopUps.reportId, report.id), gt(unloadingTopUps.createdAt, payment.createdAt)));
    if (report.status === 'CANCELLED' || Number(later.n) > 0 || Number(laterTopUps.n) > 0) {
      return fail(409, 'Laporan ini sudah dikoreksi atau dibatalkan sesudah dibayar; jalan keluarnya koreksi lagi.');
    }
    await tx.update(unloadingPayments).set({ status: 'CANCELLED', cancelledAt: now, cancelledByAccountId: actor!.accountId, cancelReason: reason }).where(eq(unloadingPayments.id, payment.id));
    await tx.update(unloadingOverpaymentUses).set({ status: 'CANCELLED' }).where(and(eq(unloadingOverpaymentUses.paymentId, payment.id), eq(unloadingOverpaymentUses.status, 'ACTIVE')));
    if (payment.topUpId) await tx.update(unloadingTopUps).set({ status: 'WAITING' }).where(eq(unloadingTopUps.id, payment.topUpId));
    else await tx.update(unloadingReports).set({ status: 'ACTIVE' }).where(eq(unloadingReports.id, report.id));
    const lines = await tx.select().from(unloadingPaymentLines).where(eq(unloadingPaymentLines.paymentId, payment.id));
    const accounts = await accountsOfKeys(lines.map(keyOf));
    await notify(tx, [...accounts.values()], {
      kind: 'unloading.payment_cancelled', title: `Pembayaran upah bongkaran ${longDate(report.workDate)} dibatalkan (salah catat); laporan kembali menunggu dibayar.`,
      body: `Alasan: ${reason}`, link: MY_LINK, entity: 'unloading_payment', entityId: payment.id,
    }, actor!.accountId);
    await announce(tx, actor!.accountId, { what: `membatalkan pembayaran ${payment.topUpId ? 'susulan ' : ''}${report.number} (${rupiah(payment.amount)})`, link: reportLink(report.id), entity: 'unloading_report', entityId: report.id });
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'unloading_payment', entityId: payment.id, action: 'unloading.cancel_payment', before: { status: 'ACTIVE' }, after: { status: 'CANCELLED' }, reason });
    return { ok: true as const, data: {} };
  });
}

// ---- Lebih bayar: tagih tunai, terima pengembalian, hapus (DRV-118, B5) ----

export async function decideOverpayment(actor: Actor | null, id: number, decision: 'COLLECT' | 'WRITE_OFF', reasonInput: unknown): Promise<ServiceResult<object>> {
  if (!hasAction(actor, 'unloading.overpay_decide')) return fail(403, 'Hanya Pemilik atau GM yang memutuskan lebih bayar.');
  const reason = reasonOf(reasonInput);
  if (decision === 'WRITE_OFF' && reason.length < MIN_REASON) return fail(400, `Alasan menghapus paling sedikit ${MIN_REASON} huruf.`);
  return db.transaction(async (tx) => {
    const [row] = await overpaymentsWith(tx, eq(unloadingOverpayments.id, id));
    if (!row || row.status === 'WRITTEN_OFF' || row.remaining <= 0) return fail(409, 'Lebih bayar ini sudah tidak bersisa.');
    if (decision === 'WRITE_OFF') {
      await tx.insert(unloadingOverpaymentUses).values({ overpaymentId: id, kind: 'WRITE_OFF', amount: row.remaining, createdByAccountId: actor!.accountId });
    }
    await tx.update(unloadingOverpayments).set({ status: decision === 'WRITE_OFF' ? 'WRITTEN_OFF' : 'COLLECT', decidedByAccountId: actor!.accountId, decidedAt: new Date(), decisionReason: reason || null })
      .where(eq(unloadingOverpayments.id, id));
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'unloading_overpayment', entityId: id, action: `unloading_overpayment.${decision.toLowerCase()}`, before: { status: row.status, remaining: row.remaining }, after: { status: decision }, reason: reason || undefined });
    return { ok: true as const, data: {} };
  });
}

export async function receiveOverpaymentRefund(actor: Actor | null, id: number, input: { amount: unknown; sourceId: unknown; moneyDate: unknown; dateReason?: unknown }, now: Date = new Date()): Promise<ServiceResult<object>> {
  if (!hasAction(actor, 'unloading.pay')) return fail(403, 'Hanya Finance, Pemilik, atau GM yang menerima pengembalian.');
  const amount = Number(input.amount);
  if (!Number.isInteger(amount) || amount <= 0) return fail(400, 'Nominal pengembalian harus rupiah bulat lebih dari 0.');
  return db.transaction(async (tx) => {
    const [row] = await overpaymentsWith(tx, eq(unloadingOverpayments.id, id));
    if (!row || row.status === 'WRITTEN_OFF' || row.remaining <= 0) return fail(409, 'Lebih bayar ini sudah tidak bersisa.');
    if (amount > row.remaining) return fail(400, `Paling banyak sebesar sisa ${rupiah(row.remaining)}.`);
    const [source] = await tx.select().from(paymentSources).where(and(eq(paymentSources.id, Number(input.sourceId)), eq(paymentSources.active, true)));
    if (!source) return fail(400, 'Pilih sumber uang.');
    const today = todayWib(now);
    const moneyDate = String(input.moneyDate ?? today);
    const problem = moneyDateCheck(moneyDate, today, isoWib(row.createdAt), reasonOf(input.dateReason));
    if (problem) return fail(400, problem);
    await tx.insert(unloadingOverpaymentUses).values({ overpaymentId: id, kind: 'REFUND', amount, sourceId: source.id, moneyDate, createdByAccountId: actor!.accountId });
    await recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'unloading_overpayment', entityId: id, action: 'unloading_overpayment.refund', before: { remaining: row.remaining }, after: { amount, sourceId: source.id, moneyDate } });
    return { ok: true as const, data: {} };
  });
}

// ---- Layar ----

export async function waitingTopUps(actor: Actor | null) {
  if (!canViewUnloading(actor)) return [];
  const rows = await db.select({ topUp: unloadingTopUps, report: unloadingReports, total: sql<number>`(select coalesce(sum(amount), 0)::int from hris.unloading_top_up_lines l where l.top_up_id = ${unloadingTopUps.id})` })
    .from(unloadingTopUps).innerJoin(unloadingReports, eq(unloadingReports.id, unloadingTopUps.reportId)).where(eq(unloadingTopUps.status, 'WAITING')).orderBy(asc(unloadingTopUps.createdAt));
  return rows.map((r) => ({ topUpId: r.topUp.id, reportId: r.report.id, number: r.report.number, workDate: r.report.workDate, supplierName: r.report.supplierName, total: Number(r.total), createdOn: isoWib(r.topUp.createdAt) }));
}

/** DRV-L17 langkah 1–2: sasaran terpilih, rincian per peserta sesudah lebih bayar, yang tidak bisa dibayar beserta sebabnya. */
export async function payScreen(actor: Actor | null, targets: PayTarget[], now: Date = new Date()) {
  if (!hasAction(actor, 'unloading.pay')) return null;
  const sources = await db.select().from(paymentSources).where(eq(paymentSources.active, true)).orderBy(asc(paymentSources.sortOrder), asc(paymentSources.name));
  const ready = [];
  const blocked: { label: string; why: string }[] = [];
  for (const target of targets) {
    const [report] = await db.select().from(unloadingReports).where(eq(unloadingReports.id, target.reportId));
    if (!report) continue;
    const found = await linesToPay(db, report, target.topUpId);
    const label = `${target.topUpId ? 'Susulan ' : ''}${report.number}`;
    if ('ok' in found) { blocked.push({ label, why: found.error }); continue; }
    const payer = payerProblem({ fullAccess: actor!.fullAccess, isParticipant: found.lines.some((l) => l.key === `E${actor!.personId}`), isCreator: report.createdByEmployeeId === actor!.personId });
    if (payer.problem) { blocked.push({ label, why: payer.problem }); continue; }
    const plan = await planFor(db, found.lines);
    const reportFlagList = (await reportFlags([report])).get(report.id) ?? [];
    const photos = await db.select({ id: unloadingPhotos.id }).from(unloadingPhotos).where(and(eq(unloadingPhotos.reportId, report.id), eq(unloadingPhotos.version, report.version)));
    ready.push({
      key: `${report.id}:${target.topUpId ?? 0}`, reportId: report.id, topUpId: target.topUpId, label, workDate: report.workDate, supplierName: report.supplierName, totalKg: report.totalKg,
      flags: reportFlagList.map((f) => UNLOADING_FLAG_LABELS[f]), photoIds: photos.map((p) => p.id), ownerFlag: payer.ownerFlag,
      creator: { key: `E${report.createdByEmployeeId}`, name: (await accountNames()).get(report.createdByAccountId) ?? 'pembuat' },
      lines: plan.map((l) => ({ key: l.key, name: l.name, share: l.share, offset: l.offset, received: l.received })),
      amount: plan.reduce((s, l) => s + l.received, 0),
    });
  }
  return {
    today: todayWib(now), freeDays: MONEY_DATE_FREE_DAYS, ready, blocked,
    sources: sources.map((s) => ({ id: s.id, name: s.name, method: s.method })),
  };
}

/** Bagian Pembayaran, susulan, lebih bayar, dan tombol di Rincian (DRV-L13 titipan 4G-3a). */
export async function unloadingPaySection(actor: Actor | null, reportId: number) {
  if (!canViewUnloading(actor)) return null;
  const [report] = await db.select().from(unloadingReports).where(eq(unloadingReports.id, reportId));
  if (!report) return null;
  const [payments, topUps, overs, names, sources] = await Promise.all([
    db.select().from(unloadingPayments).where(eq(unloadingPayments.reportId, reportId)).orderBy(asc(unloadingPayments.createdAt)),
    db.select().from(unloadingTopUps).where(eq(unloadingTopUps.reportId, reportId)).orderBy(asc(unloadingTopUps.createdAt)),
    overpaymentsWith(db, eq(unloadingOverpayments.reportId, reportId)),
    accountNames(),
    db.select().from(paymentSources),
  ]);
  const lines = payments.length ? await db.select().from(unloadingPaymentLines).where(inArray(unloadingPaymentLines.paymentId, payments.map((p) => p.id))) : [];
  const topUpLines = topUps.length ? await db.select().from(unloadingTopUpLines).where(inArray(unloadingTopUpLines.topUpId, topUps.map((t) => t.id))) : [];
  const canPay = hasAction(actor, 'unloading.pay');
  const showMoney = canPay || !!actor?.fullAccess;
  const isCreator = report.createdByAccountId === actor!.accountId;
  return {
    status: report.status, question: report.question ? {
      text: report.question, by: names.get(report.askedByAccountId ?? 0) ?? '-', at: report.askedAt?.toISOString() ?? null, answer: report.answer, open: !report.answeredAt,
    } : null,
    cancelReason: report.cancelReason,
    can: {
      pay: canPay && report.status === 'ACTIVE', ask: canPay && report.status === 'ACTIVE' && (!report.question || !!report.answeredAt),
      answer: !!report.question && !report.answeredAt && (isCreator || !!actor?.fullAccess),
      correct: report.status === 'ACTIVE' ? hasAction(actor, 'unloading.create') : report.status === 'PAID' && hasAction(actor, 'unloading.correct_paid'),
      cancelPayment: hasAction(actor, 'unloading.cancel_payment'),
    },
    payments: payments.map((p) => ({
      id: p.id, topUp: p.topUpId != null, status: p.status, kind: p.kind, amount: p.amount, moneyDate: p.moneyDate, by: names.get(p.paidByAccountId) ?? '-',
      source: showMoney ? sources.find((s) => s.id === p.sourceId)?.name ?? (p.kind === 'NO_MONEY' ? 'tanpa uang' : '-') : null,
      handedTo: p.handedToName ?? 'langsung ke tiap peserta', ownerFlag: p.ownerFlag, cancelReason: p.cancelReason, at: p.createdAt.toISOString(),
      lines: lines.filter((l) => l.paymentId === p.id).map((l) => ({ name: l.name, share: l.share, offset: l.offset, received: l.received })),
    })),
    topUps: topUps.map((t) => ({
      id: t.id, status: t.status, statusLabel: TOP_UP_STATUS_LABELS[t.status] ?? t.status, at: t.createdAt.toISOString(),
      lines: topUpLines.filter((l) => l.topUpId === t.id).map((l) => ({ name: l.name, amount: l.amount })),
    })),
    overpayments: overs.map((o) => ({ id: o.id, name: o.name, amount: o.amount, remaining: o.remaining, status: OVERPAY_STATUS_LABELS[o.remaining === 0 && o.status !== 'WRITTEN_OFF' ? 'SETTLED' : o.status] })),
  };
}

export async function overpaymentsScreen(actor: Actor | null, now: Date = new Date()) {
  if (!canViewUnloading(actor)) return null;
  const today = todayWib(now);
  const days = Number(await settingOn<number>('payroll.unloading_overpay_flag_days', today) ?? 30);
  const [rows, reports, sources] = await Promise.all([
    overpaymentsWith(db, undefined), db.select({ id: unloadingReports.id, number: unloadingReports.number }).from(unloadingReports),
    db.select().from(paymentSources).where(eq(paymentSources.active, true)).orderBy(asc(paymentSources.sortOrder)),
  ]);
  const list = rows.map((o) => {
    const age = daysBetween(isoWib(o.createdAt), today);
    const status = o.remaining === 0 && o.status !== 'WRITTEN_OFF' ? 'SETTLED' : o.status;
    return {
      id: o.id, name: o.name, casual: o.casualWorkerId != null, reportId: o.reportId, number: reports.find((r) => r.id === o.reportId)?.number ?? '-', bornOn: isoWib(o.createdAt),
      amount: o.amount, remaining: o.remaining, used: o.amount - o.remaining, age, late: age > days && o.remaining > 0 && o.status === 'OPEN', status, statusLabel: OVERPAY_STATUS_LABELS[status],
    };
  });
  return {
    days, canDecide: hasAction(actor, 'unloading.overpay_decide'), canRefund: hasAction(actor, 'unloading.pay'), today,
    head: { people: new Set(list.filter((r) => r.remaining > 0).map((r) => r.name)).size, remaining: list.reduce((s, r) => s + r.remaining, 0), late: list.filter((r) => r.late).length },
    rows: list, sources: sources.map((s) => ({ id: s.id, name: s.name })),
  };
}

type PersonTotal = { key: string; name: string; casual: boolean; times: number; kg: Big; shares: number; received: number; unpaid: number; overpay: number };

async function perPersonRows(from: IsoDate, to: IsoDate): Promise<PersonTotal[]> {
  const shares = await db.select({ share: unloadingShares, report: unloadingReports }).from(unloadingShares)
    .innerJoin(unloadingReports, and(eq(unloadingReports.id, unloadingShares.reportId), eq(unloadingReports.version, unloadingShares.version)))
    .where(and(eq(unloadingShares.status, 'ACTIVE'), inArray(unloadingReports.status, ['ACTIVE', 'PAID']), gte(unloadingReports.workDate, from), lte(unloadingReports.workDate, to)));
  const reportIds = [...new Set(shares.map((s) => s.report.id))];
  const counts = new Map<number, number>();
  for (const s of shares) counts.set(s.report.id, (counts.get(s.report.id) ?? 0) + 1);
  const payLines = reportIds.length ? await db.select({ line: unloadingPaymentLines, payment: unloadingPayments }).from(unloadingPaymentLines)
    .innerJoin(unloadingPayments, eq(unloadingPayments.id, unloadingPaymentLines.paymentId))
    .where(and(eq(unloadingPayments.status, 'ACTIVE'), inArray(unloadingPayments.reportId, reportIds))) : [];
  const waiting = reportIds.length ? await db.select({ line: unloadingTopUpLines }).from(unloadingTopUpLines).innerJoin(unloadingTopUps, eq(unloadingTopUps.id, unloadingTopUpLines.topUpId))
    .where(and(eq(unloadingTopUps.status, 'WAITING'), inArray(unloadingTopUps.reportId, reportIds))) : [];
  const overs = await overpaymentsWith(db, undefined);
  const out = new Map<string, PersonTotal>();
  const get = (key: string, name: string, casual: boolean) => {
    const cur = out.get(key) ?? { key, name, casual, times: 0, kg: new Big(0), shares: 0, received: 0, unpaid: 0, overpay: 0 };
    out.set(key, cur);
    return cur;
  };
  for (const { share, report } of shares) {
    const p = get(keyOf(share), share.name, share.casualWorkerId != null);
    p.times += 1;
    p.kg = p.kg.plus(new Big(report.totalKg).div(counts.get(report.id) ?? 1));
    p.shares += share.amount;
    if (report.status === 'ACTIVE') p.unpaid += share.amount;
  }
  for (const { line } of payLines) { const p = out.get(keyOf(line)); if (p) p.received += line.received; }
  for (const { line } of waiting) { const p = out.get(keyOf(line)); if (p) p.unpaid += line.amount; }
  for (const o of overs) { const p = out.get(o.key); if (p) p.overpay += o.remaining; }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, 'id'));
}

/** DRV-L22 Bongkaran per Orang: Pemilik, GM, Finance, Kepala Gudang; periode bawaan 26–25 berjalan. */
export async function perPersonScreen(actor: Actor | null, input: { from?: string | null; to?: string | null; q?: string | null; kind?: string | null }, now: Date = new Date()) {
  if (!canViewUnloading(actor)) return null;
  const start = periodStartOf(todayWib(now));
  const from = input.from && /^\d{4}-\d{2}-\d{2}$/.test(input.from) ? input.from : start;
  const to = input.to && /^\d{4}-\d{2}-\d{2}$/.test(input.to) ? input.to : periodEndOf(start);
  const q = (input.q ?? '').trim().toLowerCase();
  const rows = (await perPersonRows(from, to)).filter((r) => (!q || r.name.toLowerCase().includes(q)) && (input.kind === 'CASUAL' ? r.casual : input.kind === 'EMPLOYEE' ? !r.casual : true));
  return { from, to, q: input.q ?? '', kind: input.kind ?? '', rows: rows.map((r) => ({ ...r, kg: r.kg.round(3, Big.roundHalfUp).toFixed(3) })) };
}

export async function perPersonDownload(actor: Actor | null, input: { from?: string | null; to?: string | null }) {
  const screen = await perPersonScreen(actor, input);
  if (!screen) return null;
  const names = await accountNames();
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ['Nama', 'Karyawan/Pekerja lepas', 'Berapa kali', 'Kg bagian', 'Jumlah bagian', 'Diterima', 'Belum dibayar', 'Sisa lebih bayar'];
  const lines = screen.rows.map((r) => [r.name, r.casual ? 'Pekerja lepas' : 'Karyawan', r.times, kgText(r.kg), r.shares, r.received, r.unpaid, r.overpay].map(esc).join(','));
  await db.transaction((tx) => recordAudit(tx, { actorAccountId: actor!.accountId, entity: 'unloading_report', entityId: 0, action: 'unloading.per_person_download', before: null, after: { from: screen.from, to: screen.to } }));
  return {
    filename: `bongkaran-per-orang_${screen.from}_${screen.to}.csv`,
    csv: [`Bongkaran per Orang ${screen.from} s.d. ${screen.to}, diunduh ${names.get(actor!.accountId) ?? ''} ${new Date().toISOString()}`, header.map(esc).join(','), ...lines].join('\r\n'),
  };
}

/** Kartu Upah bongkaran di Pendapatan Saya (DRV-53, 120): 90 hari terakhir, tanpa nama dan bagian orang lain. */
export async function myUnloadingScreen(actor: Actor | null, now: Date = new Date()) {
  if (!actor) return null;
  const today = todayWib(now);
  const from = addDays(today, -90);
  const mine = await db.select({ share: unloadingShares, report: unloadingReports }).from(unloadingShares)
    .innerJoin(unloadingReports, eq(unloadingReports.id, unloadingShares.reportId))
    .where(and(eq(unloadingShares.employeeId, actor.personId), gte(unloadingReports.workDate, from))).orderBy(desc(unloadingReports.workDate), asc(unloadingShares.version));
  if (!mine.length) return { rows: [], overpay: 0 };
  const reportIds = [...new Set(mine.map((m) => m.report.id))];
  const [counts, payLines, topLines, overs, claims] = await Promise.all([
    db.select({ reportId: unloadingShares.reportId, version: unloadingShares.version, n: sql<number>`count(*)::int` }).from(unloadingShares)
      .where(inArray(unloadingShares.reportId, reportIds)).groupBy(unloadingShares.reportId, unloadingShares.version),
    db.select({ line: unloadingPaymentLines, payment: unloadingPayments }).from(unloadingPaymentLines).innerJoin(unloadingPayments, eq(unloadingPayments.id, unloadingPaymentLines.paymentId))
      .where(and(eq(unloadingPaymentLines.employeeId, actor.personId), inArray(unloadingPayments.reportId, reportIds))),
    db.select({ line: unloadingTopUpLines, topUp: unloadingTopUps }).from(unloadingTopUpLines).innerJoin(unloadingTopUps, eq(unloadingTopUps.id, unloadingTopUpLines.topUpId))
      .where(and(eq(unloadingTopUpLines.employeeId, actor.personId), inArray(unloadingTopUps.reportId, reportIds))),
    overpaymentsWith(db, eq(unloadingOverpayments.employeeId, actor.personId)),
    db.select({ paymentId: unloadingReceiptClaims.paymentId }).from(unloadingReceiptClaims).where(eq(unloadingReceiptClaims.employeeId, actor.personId)),
  ]);
  const claimed = new Set(claims.map((c) => c.paymentId));
  const rows = reportIds.map((reportId) => {
    const report = mine.find((m) => m.report.id === reportId)!.report;
    const current = mine.find((m) => m.report.id === reportId && m.share.version === report.version);
    const first = mine.filter((m) => m.report.id === reportId && m.share.status !== 'PENDING')[0];
    const payments = payLines.filter((p) => p.payment.reportId === reportId);
    const active = payments.find((p) => p.payment.status === 'ACTIVE' && p.payment.topUpId == null);
    const status = report.status === 'PENDING' ? 'Menunggu persetujuan' : report.status === 'CANCELLED' ? 'Dibatalkan'
      : report.status === 'PAID' ? `Dibayar ${longDate(active?.payment.moneyDate ?? report.workDate)}${active?.payment.handedToName ? `, diserahkan lewat ${active.payment.handedToName}` : ''}` : 'Belum dibayar';
    const claimable = payments.filter((p) => p.payment.status === 'ACTIVE' && !claimed.has(p.payment.id) && daysBetween(isoWib(p.payment.createdAt), today) <= NOT_RECEIVED_DAYS);
    return {
      reportId, workDate: report.workDate, totalKg: report.totalKg, people: Number(counts.find((c) => c.reportId === reportId && c.version === report.version)?.n ?? 0),
      share: current && current.share.status !== 'CANCELLED' ? current.share.amount : report.status === 'CANCELLED' ? 0 : current?.share.amount ?? 0,
      corrected: first && current && first.share.amount !== current.share.amount ? { from: first.share.amount, to: current.share.amount } : null,
      status, offset: payments.filter((p) => p.payment.status === 'ACTIVE').reduce((s, p) => s + p.line.offset, 0),
      topUps: topLines.filter((t) => t.topUp.reportId === reportId && t.topUp.status !== 'CANCELLED').map((t) => ({ amount: t.line.amount, status: TOP_UP_STATUS_LABELS[t.topUp.status] })),
      claimPaymentId: claimable[0]?.payment.id ?? null,
    };
  });
  return { rows, overpay: overs.reduce((s, o) => s + o.remaining, 0) };
}

// ---- "Uang belum saya terima" (DRV-113, B2) ----

export function unloadingNotReceivedHandler(): RequestHandler {
  return {
    async prepare(tx, actor, input) {
      const paymentId = Number(input.paymentId);
      const note = reasonOf(input.note);
      if (note.length < MIN_REASON) return fail(400, `Tulis keterangannya paling sedikit ${MIN_REASON} huruf.`);
      const [payment] = await tx.select().from(unloadingPayments).where(eq(unloadingPayments.id, paymentId));
      if (!payment || payment.status !== 'ACTIVE') return fail(404, 'Pembayaran tidak ditemukan.');
      const [line] = await tx.select().from(unloadingPaymentLines).where(and(eq(unloadingPaymentLines.paymentId, paymentId), eq(unloadingPaymentLines.employeeId, actor.personId)));
      if (!line) return fail(403, 'Anda bukan penerima pembayaran ini.');
      if (daysBetween(isoWib(payment.createdAt), todayWib()) > NOT_RECEIVED_DAYS) return fail(409, `Laporan uang belum diterima paling lambat ${NOT_RECEIVED_DAYS} hari sesudah diberi tahu dibayar.`);
      const [report] = await tx.select().from(unloadingReports).where(eq(unloadingReports.id, payment.reportId));
      return {
        ok: true as const,
        data: {
          subjectEmployeeId: actor.personId,
          summary: `Upah bongkaran ${longDate(report.workDate)} ${rupiah(line.received)} (${report.number}) belum diterima`,
          dedupeKey: `unloading-payment:${paymentId}:${actor.personId}`,
          requiredAttachment: null,
          save: async (saveTx, requestId) => {
            await saveTx.insert(unloadingReceiptClaims).values({ paymentId, employeeId: actor.personId, requestId, note });
            await notify(saveTx, [payment.paidByAccountId], {
              kind: 'unloading.not_received', title: `Upah bongkaran ${report.number} dilaporkan belum diterima`, body: note, link: `/persetujuan/${requestId}`, entity: 'unloading_payment', entityId: paymentId,
            }, actor.accountId);
          },
        },
      };
    },
    async apply() {
      return { ok: true as const, effect: 'Ditandai sudah diselesaikan. Tidak ada akibat uang otomatis; bila pembayarannya memang salah, pakai Batal bayar atau Koreksi.' };
    },
    async effectPreview() {
      return 'Sudah diselesaikan: tanpa akibat uang otomatis. Bila pembayarannya salah catat, pakai Batal bayar di laporannya.';
    },
    async describe(requestId) {
      const [row] = await db.select({ claim: unloadingReceiptClaims, payment: unloadingPayments, report: unloadingReports }).from(unloadingReceiptClaims)
        .innerJoin(unloadingPayments, eq(unloadingPayments.id, unloadingReceiptClaims.paymentId)).innerJoin(unloadingReports, eq(unloadingReports.id, unloadingPayments.reportId))
        .where(eq(unloadingReceiptClaims.requestId, requestId));
      if (!row) return [];
      const names = await accountNames();
      return [
        { label: 'Laporan', before: null, after: `${row.report.number} · ${longDate(row.report.workDate)} · /gaji/bongkaran/${row.report.id}` },
        { label: 'Dibayar', before: null, after: `${longDate(row.payment.moneyDate)} oleh ${names.get(row.payment.paidByAccountId) ?? '-'}, ${row.payment.handedToName ? `dititipkan ke ${row.payment.handedToName}` : 'langsung ke tiap peserta'}` },
        { label: 'Keterangan', before: null, after: row.claim.note },
      ];
    },
    async resubmitValues() {
      return null;
    },
  };
}

// ---- Mesin harian 07.00 (DRV-114, 118) dan Beranda ----

export async function runUnloadingDaily(now: Date = new Date()) {
  const today = todayWib(now);
  const unpaid = await db.select({ n: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(${unloadingReports.totalPay}), 0)::int`, oldest: sql<string | null>`min(${unloadingReports.workDate})::text` })
    .from(unloadingReports).where(and(eq(unloadingReports.status, 'ACTIVE'), sql`(${unloadingReports.activatedAt} at time zone 'Asia/Jakarta')::date < ${today}::date`));
  const topUps = (await waitingTopUps({ fullAccess: true } as Actor)).filter((t) => t.createdOn < today);
  const count = Number(unpaid[0].n) + topUps.length;
  let reminded = 0;
  if (count) {
    const total = Number(unpaid[0].sum) + topUps.reduce((s, t) => s + t.total, 0);
    const oldest = [unpaid[0].oldest, ...topUps.map((t) => t.workDate)].filter((d): d is string => !!d).sort()[0];
    reminded = await db.transaction(async (tx) => notify(tx, await accountsWith(['unloading.pay']), {
      kind: 'unloading.reminder', title: `Ada ${count} Laporan Bongkaran belum dibayar, ${rupiah(total)}, paling lama sejak ${longDate(oldest)}.`,
      link: '/gaji/bongkaran', entity: 'unloading_report', entityId: 0,
    }, null));
  }
  const days = Number(await settingOn<number>('payroll.unloading_overpay_flag_days', today) ?? 30);
  const overs = (await overpaymentsWith(db, and(eq(unloadingOverpayments.status, 'OPEN'), isNull(unloadingOverpayments.flaggedAt))))
    .filter((o) => o.remaining > 0 && daysBetween(isoWib(o.createdAt), today) > days);
  if (overs.length) {
    await db.transaction(async (tx) => {
      await tx.update(unloadingOverpayments).set({ flaggedAt: now }).where(inArray(unloadingOverpayments.id, overs.map((o) => o.id)));
      await notify(tx, await ownerAccounts(), {
        kind: 'unloading.overpay_late', title: `${overs.length} lebih bayar bongkaran sudah lewat ${days} hari belum tertagih (${rupiah(overs.reduce((s, o) => s + o.remaining, 0))}).`,
        body: 'Putuskan: tagih tunai atau hapus.', link: '/gaji/bongkaran?tab=OVERPAY', entity: 'unloading_overpayment', entityId: overs[0].id,
      }, null);
    });
  }
  return { reminded, flagged: overs.length };
}

export async function overpayAttention(actor: Actor | null) {
  if (!hasAction(actor, 'unloading.overpay_decide')) return 0;
  const rows = await overpaymentsWith(db, and(eq(unloadingOverpayments.status, 'OPEN'), sql`${unloadingOverpayments.flaggedAt} is not null`));
  return rows.filter((o) => o.remaining > 0).length;
}

export { UNLOADING_STATUS_LABELS };

/** DRV-L18 Koreksi: langkah 1–4 Laporan Baru terbuka dengan isi laporan itu (berat = salinan laporan). */
export async function correctionFormScreen(actor: Actor | null, reportId: number, dateInput: string | null, now: Date = new Date()) {
  const [report] = await db.select().from(unloadingReports).where(eq(unloadingReports.id, reportId));
  if (!report || correctionRights(actor, report)) return null;
  const base = await unloadingFormScreen(actor, dateInput ?? report.workDate, now);
  if (!base) return null;
  const [items, shares, photos] = await Promise.all([
    itemsOf(db, report.id, report.version), sharesOf(db, report.id, report.version),
    db.select({ id: unloadingPhotos.id }).from(unloadingPhotos).where(and(eq(unloadingPhotos.reportId, report.id), eq(unloadingPhotos.version, report.version))),
  ]);
  return {
    ...base, late: false,
    correction: {
      id: report.id, number: report.number, paid: report.status === 'PAID',
      initial: {
        supplierId: report.supplierId,
        rows: items.map((i) => (i.productId != null
          ? {
            key: `${i.productId}:${i.uomId}`, productId: i.productId, uomId: i.uomId!, name: i.productName, uomName: i.uomName ?? '', quantity: new Big(i.quantity!).toFixed(3).replace(/\.?0+$/, ''),
            currentKg: new Big(i.weightKg!).toFixed(3), currentNote: 'berat di laporan ini', weightKg: new Big(i.weightKg!).toFixed(3), editWeight: false, weightReason: '',
          }
          : { key: `other-${i.id}`, other: true as const, name: i.productName, kg: new Big(i.lineKg).toFixed(3), reason: i.otherReason ?? '' })),
        people: shares.filter((s) => s.status !== 'CANCELLED').map(keyOf),
        noDeliveryNoteReason: report.noDeliveryNoteReason, photoCount: photos.length,
      },
    },
  };
}
