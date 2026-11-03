import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm';
import { advanceFollowups } from '@petshop/hris-db/schema/advances';
import { paymentSources, payslips } from '@petshop/hris-db/schema/payroll';
import { requests } from '@petshop/hris-db/schema/requests';
import { db } from '@/lib/db';
import { can, getOrgLookup, hasAction, type Actor } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { listPeopleForModules, todayWib, type PersonForModules } from '@/modules/employees';
import { settingOn } from '@/modules/settings';
import {
  STAGE_LABELS, STAGE_TONES, addMonthsClamped, daysBetween, periodLabel, rupiah, type AdvanceStage, type IsoDate,
} from '../rules/advance';
import { checkAdvance, leavingOn, loadAdvances, payBasisOf, rulesOn, usage, type AdvanceView } from './data';

const wibDate = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

async function namesByAccount(): Promise<Map<number, string>> {
  const people = await listPeopleForModules();
  const accounts = await activeHrisAccounts(people.map((p) => p.id));
  const out = new Map<number, string>();
  for (const p of people) {
    const account = accounts.get(p.id);
    if (account) out.set(account, p.name);
  }
  return out;
}

/**
 * Pelihat kantor kasbon orang ini (spec L5 §5): Pemilik/GM semua; Finance (pemeriksa/penyerah) semua karena merekalah
 * yang menyerahkan uang; HR dan Admin HR (pelihat saja) tidak melihat kasbon jabatan Pemilik/GM.
 */
async function officeSees(actor: Actor, person: PersonForModules): Promise<boolean> {
  if (actor.fullAccess) return true;
  if (can(actor, 'advance.review', person.target) || can(actor, 'advance.hand_over', person.target)) return true;
  if (!can(actor, 'advance.view', person.target)) return false;
  const position = (await getOrgLookup()).positions.find((p) => p.id === person.positionId);
  return !position?.fullAccess;
}

const canOffice = (actor: Actor | null) => hasAction(actor, 'advance.view') || hasAction(actor, 'advance.review') || hasAction(actor, 'advance.hand_over') || Boolean(actor?.fullAccess);

const INSTALLMENT_LABELS: Record<string, string> = {
  SCHEDULED: 'Akan dipotong', TAKEN: 'Terpotong', PARTIAL: 'Sebagian, sisanya dibawa', REPLACED: 'Diganti', CANCELLED: 'Batal', WAITING_WEEKLY: 'Menunggu slip mingguan',
};

/** Jadwal + catatan berkurang yang dikirim ke layar (karyawan dan kantor sama; tanpa nama sumber uang). */
async function scheduleOf(view: AdvanceView) {
  const slipIds = [...new Set(view.movements.map((m) => m.payslipId).filter((id): id is number => id != null))];
  const slips = slipIds.length ? await db.select({ id: payslips.id, number: payslips.number, periodStart: payslips.periodStart }).from(payslips).where(inArray(payslips.id, slipIds)) : [];
  const live = view.installments.filter((i) => i.status !== 'REPLACED');
  return {
    installments: live.map((i) => {
      const taken = view.movements.filter((m) => m.installmentId === i.id && m.status === 'ACTIVE' && m.kind === 'SLIP').reduce((s, m) => s + m.amount, 0);
      return {
        id: i.id, sequence: i.sequence, total: i.total, amount: i.amount, period: i.periodStart ? periodLabel(i.periodStart) : null,
        status: i.status, statusLabel: INSTALLMENT_LABELS[i.status] ?? i.status, taken,
      };
    }),
    movements: view.movements.map((m) => {
      const slip = slips.find((s) => s.id === m.payslipId);
      return {
        id: m.id, kind: m.kind, amount: m.amount, active: m.status === 'ACTIVE', reason: m.reason, reversedReason: m.reversedReason,
        text: m.kind === 'SLIP' ? `Terpotong di slip ${slip?.number ?? ''} (${slip ? periodLabel(slip.periodStart) : ''})`
          : m.kind === 'TO_RECEIVABLE' ? `Dialihkan ke Piutang Lain (slip terakhir ${slip?.number ?? ''})`
            : m.kind === 'CASH' ? `Dilunasi tunai${m.moneyDate ? ` ${m.moneyDate}` : ''}` : 'Utang dihapus',
        at: m.createdAt.toISOString(),
      };
    }),
  };
}

async function requestFacts(requestIds: number[]) {
  if (!requestIds.length) return new Map<number, { status: string; version: number; decisionReason: string | null; submittedAt: Date }>();
  const rows = await db.select({ id: requests.id, status: requests.status, version: requests.version, decisionReason: requests.decisionReason, submittedAt: requests.submittedAt })
    .from(requests).where(inArray(requests.id, requestIds));
  return new Map(rows.map((r) => [r.id, r]));
}

async function followupsOf(advanceIds: number[]) {
  if (!advanceIds.length) return [];
  return db.select({ f: advanceFollowups, status: requests.status, decisionReason: requests.decisionReason }).from(advanceFollowups)
    .innerJoin(requests, eq(requests.id, advanceFollowups.requestId)).where(inArray(advanceFollowups.advanceId, advanceIds)).orderBy(asc(advanceFollowups.id));
}

const OPEN = ['PENDING', 'REVIEWED'];

// ---- Kasbon Saya (DRV-L23) ----

export async function myAdvancesScreen(actor: Actor | null, now: Date = new Date()) {
  if (!actor) return null;
  const today = todayWib(now);
  const views = (await loadAdvances({ employeeIds: [actor.personId] })).reverse();
  const reqs = await requestFacts(views.map((v) => v.row.requestId).filter((id): id is number => id != null));
  const follows = await followupsOf(views.map((v) => v.row.id));
  const names = await namesByAccount();
  const days = Number(await settingOn<number>('advance.not_received_days', today)) || 3;
  const people = await listPeopleForModules();
  const gate = await checkAdvance(actor.personId, 0, today);
  const blocked = !gate.ok && ['ELIGIBLE', 'TENURE', 'PENDING'].includes(gate.step) ? gate.message : null;
  const cards = [];
  for (const v of views) {
    const req = v.row.requestId ? reqs.get(v.row.requestId) : null;
    const own = follows.filter((f) => f.f.advanceId === v.row.id);
    const cancelOpen = own.find((f) => f.f.kind === 'CANCEL' && OPEN.includes(f.status));
    const notReceivedOpen = own.find((f) => f.f.kind === 'NOT_RECEIVED' && OPEN.includes(f.status));
    const notReceivedUntil = v.handover ? new Date(v.handover.createdAt.getTime() + days * 86_400_000) : null;
    const via = v.handover?.viaEmployeeId ? people.find((p) => p.id === v.handover!.viaEmployeeId)?.name ?? null : null;
    cards.push({
      id: v.row.id, number: v.row.number, kind: v.row.kind, stage: v.stage, stageLabel: STAGE_LABELS[v.stage], tone: STAGE_TONES[v.stage],
      requestedAmount: v.row.requestedAmount, requestedInstallments: v.row.requestedInstallments,
      finalAmount: v.row.finalAmount, finalInstallments: v.row.finalInstallments, reason: v.row.reason,
      decisionNote: v.row.decisionNote, rejectReason: v.stage === 'REJECTED' ? req?.decisionReason ?? v.row.closeReason : null,
      cancelReason: v.stage === 'CANCELLED' ? v.row.closeReason : null,
      filledBy: v.row.filledByAccountId !== actor.accountId ? names.get(v.row.filledByAccountId) ?? 'HR' : null,
      submittedAt: (req?.submittedAt ?? v.row.createdAt).toISOString(),
      requestId: v.row.requestId, requestVersion: req?.version ?? null,
      handover: v.handover ? { moneyDate: v.handover.moneyDate, method: v.handover.method === 'TRANSFER' ? 'transfer' : 'tunai', via } : null,
      remaining: v.remaining, handed: v.handover?.amount ?? 0,
      ...(await scheduleOf(v)),
      canWithdraw: v.stage === 'WAITING_REVIEW' || v.stage === 'REVIEWED',
      canResubmit: v.stage === 'REJECTED' && v.row.filledByAccountId === actor.accountId,
      canRequestCancel: v.stage === 'APPROVED' && !cancelOpen,
      cancelRequested: Boolean(cancelOpen),
      canReportNotReceived: Boolean(v.handover && notReceivedUntil && now <= notReceivedUntil && !notReceivedOpen && !own.some((f) => f.f.kind === 'NOT_RECEIVED' && f.f.handoverId === v.handover!.id)),
      notReceivedUntil: notReceivedUntil?.toISOString() ?? null,
      notReceived: own.filter((f) => f.f.kind === 'NOT_RECEIVED').map((f) => ({ status: f.status, note: f.f.decisionNote ?? f.decisionReason })),
    });
  }
  return { cards, blocked, today };
}

// ---- Ajukan / Isikan atas nama (DRV-L24, L25) ----

export async function advanceFormScreen(actor: Actor | null, mode: 'self' | 'other', now: Date = new Date()) {
  if (!actor) return null;
  if (mode === 'other' && !hasAction(actor, 'advance.fill_for')) return null;
  const today = todayWib(now);
  const rules = await rulesOn(today);
  const quick = [1, 2, 3, 4, 5].map((n) => n * 50_000).filter((a) => a >= rules.amountMin && a % rules.amountStep === 0);
  if (mode === 'self') {
    const gate = await checkAdvance(actor.personId, 0, today);
    const blocked = !gate.ok && ['ELIGIBLE', 'TENURE', 'PENDING'].includes(gate.step) ? gate.message : null;
    return { mode, rules, quick, blocked, people: [] as { id: number; name: string; branchName: string; tenureOk: boolean; tenureFrom: IsoDate }[] };
  }
  const people = (await listPeopleForModules()).filter((p) => p.activeToday && p.id !== actor.personId && can(actor, 'advance.fill_for', p.target));
  const list = [];
  for (const p of people) {
    if ((await payBasisOf(p.positionId, today)) !== 'MONTHLY') continue;
    const from = addMonthsClamped(p.joinedOn, rules.minTenureMonths);
    list.push({ id: p.id, name: p.name, branchName: p.branchName, tenureOk: today >= from, tenureFrom: from });
  }
  list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  return { mode, rules, quick, blocked: null, people: list };
}

// ---- Kasbon (daftar kantor, DRV-L26) ----

export type OfficeTab = 'periksa' | 'putuskan' | 'diberikan' | 'berjalan' | 'selesai' | 'ditolak';
export const OFFICE_TABS: { key: OfficeTab; label: string }[] = [
  { key: 'periksa', label: 'Menunggu diperiksa' },
  { key: 'putuskan', label: 'Menunggu diputuskan' },
  { key: 'diberikan', label: 'Menunggu diberikan' },
  { key: 'berjalan', label: 'Berjalan' },
  { key: 'selesai', label: 'Selesai' },
  { key: 'ditolak', label: 'Ditolak dan dibatalkan' },
];

function tabOf(v: AdvanceView): OfficeTab {
  if (v.stage === 'WAITING_REVIEW') return 'periksa';
  if (v.stage === 'REVIEWED') return 'putuskan';
  if (v.stage === 'APPROVED') return 'diberikan';
  if (v.stage === 'RUNNING') return 'berjalan';
  if (v.stage === 'PAID_OFF' || v.stage === 'TRANSFERRED') return 'selesai';
  return 'ditolak';
}

async function labelsOf(v: AdvanceView, ctx: { today: IsoDate; processDays: number; follows: Awaited<ReturnType<typeof followupsOf>>; people: PersonForModules[]; names: Map<number, string>; submittedAt: Date | null }) {
  const labels: string[] = [];
  if ((v.stage === 'WAITING_REVIEW' || v.stage === 'REVIEWED') && ctx.submittedAt && Date.now() - ctx.submittedAt.getTime() >= ctx.processDays * 86_400_000) {
    labels.push(`Lewat ${ctx.processDays} hari`);
  }
  if (v.row.filledByEmployeeId !== v.row.employeeId) labels.push(`Diisi oleh ${ctx.names.get(v.row.filledByAccountId) ?? 'HR'}`);
  if (v.row.withoutReview && v.row.state !== 'OPEN') labels.push('Tanpa pemeriksaan Finance');
  const own = ctx.follows.filter((f) => f.f.advanceId === v.row.id && OPEN.includes(f.status));
  if (own.some((f) => f.f.kind === 'CANCEL')) labels.push('Diminta dibatalkan');
  if (own.some((f) => f.f.kind === 'NOT_RECEIVED')) labels.push('Belum diterima');
  const person = ctx.people.find((p) => p.id === v.row.employeeId);
  if (person && leavingOn(person, ctx.today) && ['WAITING_REVIEW', 'REVIEWED', 'APPROVED'].includes(v.stage)) labels.push('Akan berhenti');
  if (v.handover?.beforeApproval) labels.push('Uang keluar sebelum disetujui');
  if (v.row.kind === 'SPECIAL') labels.push('Khusus');
  return labels;
}

export async function officeScreen(actor: Actor | null, input: { tab: OfficeTab | null; q: string | null }, now: Date = new Date()) {
  if (!canOffice(actor)) return null;
  const today = todayWib(now);
  const { all, byFund } = await usage(today);
  const people = await listPeopleForModules();
  const visible = [];
  for (const v of all) {
    const person = people.find((p) => p.id === v.row.employeeId);
    if (person && (await officeSees(actor!, person))) visible.push(v);
  }
  const reqs = await requestFacts(visible.map((v) => v.row.requestId).filter((id): id is number => id != null));
  const follows = await followupsOf(visible.map((v) => v.row.id));
  const names = await namesByAccount();
  const processDays = Number(await settingOn<number>('advance.process_days', today)) || 2;
  const defaultTab: OfficeTab = actor!.fullAccess ? 'putuskan' : hasAction(actor, 'advance.review') ? 'periksa' : hasAction(actor, 'advance.hand_over') ? 'diberikan' : 'berjalan';
  const tab = input.tab ?? defaultTab;
  const q = (input.q ?? '').trim().toLowerCase();
  const counts = Object.fromEntries(OFFICE_TABS.map((t) => [t.key, { count: 0, amount: 0 }])) as Record<OfficeTab, { count: number; amount: number }>;
  const rows = [];
  for (const v of visible) {
    const t = tabOf(v);
    const amount = v.handover ? v.remaining : v.row.finalAmount ?? v.row.requestedAmount;
    counts[t].count += 1;
    counts[t].amount += amount;
    if (t !== tab) continue;
    const person = people.find((p) => p.id === v.row.employeeId);
    if (q && !`${person?.name ?? ''} ${v.row.number}`.toLowerCase().includes(q)) continue;
    const req = v.row.requestId ? reqs.get(v.row.requestId) : null;
    rows.push({
      id: v.row.id, number: v.row.number, name: person?.name ?? `#${v.row.employeeId}`, branchName: person?.branchName ?? '-',
      requestedAmount: v.row.requestedAmount, finalAmount: v.row.finalAmount, installments: v.row.finalInstallments ?? v.row.requestedInstallments,
      remaining: v.remaining, handed: v.handover?.amount ?? 0, stageLabel: STAGE_LABELS[v.stage], tone: STAGE_TONES[v.stage],
      waitingDays: req?.submittedAt ? Math.max(0, daysBetween(wibDate(req.submittedAt), today)) : null,
      requestId: v.row.requestId, requestOpen: Boolean(req && OPEN.includes(req.status)),
      nextInstallment: v.installments.find((i) => i.status === 'SCHEDULED' && i.periodStart) ? (() => {
        const i = v.installments.find((x) => x.status === 'SCHEDULED' && x.periodStart)!;
        return `${rupiah(i.amount)} · ${periodLabel(i.periodStart!)}`;
      })() : null,
      labels: await labelsOf(v, { today, processDays, follows, people, names, submittedAt: req?.submittedAt ?? null }),
      sortKey: req?.submittedAt?.getTime() ?? v.row.createdAt.getTime(),
    });
  }
  rows.sort((a, b) => (tab === 'berjalan' ? b.remaining - a.remaining : a.sortKey - b.sortKey));
  const showFunds = Boolean(actor!.fullAccess) && hasAction(actor, 'advance.funds.view');
  const rules = await rulesOn(today);
  return {
    tab, q: input.q ?? '', counts, rows,
    funds: showFunds ? {
      monthly: { used: byFund.MONTHLY, size: rules.fundSize },
      weekly: { used: byFund.WEEKLY, size: Number(await settingOn<number>('advance.fund_weekly', today)) || 1_000_000 },
    } : null,
    canFillFor: hasAction(actor, 'advance.fill_for'),
  };
}

// ---- Rincian Kasbon (DRV-L28) ----

export async function detailScreen(actor: Actor | null, id: number, now: Date = new Date()) {
  if (!actor) return null;
  const [v] = await loadAdvances({ ids: [id] });
  if (!v) return null;
  const people = await listPeopleForModules();
  const person = people.find((p) => p.id === v.row.employeeId);
  if (!person) return null;
  if (!(await officeSees(actor, person))) return null;
  const today = todayWib(now);
  const names = await namesByAccount();
  const req = v.row.requestId ? (await requestFacts([v.row.requestId])).get(v.row.requestId) : null;
  const follows = await followupsOf([id]);
  const processDays = Number(await settingOn<number>('advance.process_days', today)) || 2;
  const seesMoney = actor.fullAccess || hasAction(actor, 'advance.review') || hasAction(actor, 'advance.hand_over');
  const [source] = v.handover ? await db.select().from(paymentSources).where(eq(paymentSources.id, v.handover.sourceId)) : [];
  const self = v.row.employeeId === actor.personId;
  const cancelOpen = follows.some((f) => f.f.kind === 'CANCEL' && OPEN.includes(f.status));
  return {
    id, number: v.row.number, kind: v.row.kind, name: person.name, branchName: person.branchName, stage: v.stage, stageLabel: STAGE_LABELS[v.stage], tone: STAGE_TONES[v.stage],
    labels: await labelsOf(v, { today, processDays, follows, people, names, submittedAt: req?.submittedAt ?? null }),
    request: {
      id: v.row.requestId, amount: v.row.requestedAmount, installments: v.row.requestedInstallments, reason: v.row.reason,
      filledBy: v.row.filledByEmployeeId !== v.row.employeeId ? names.get(v.row.filledByAccountId) ?? '-' : null, submittedAt: (req?.submittedAt ?? v.row.createdAt).toISOString(),
      open: Boolean(req && OPEN.includes(req.status)),
    },
    review: seesMoney && v.row.reviewedAt ? {
      amount: v.row.reviewAmount, installments: v.row.reviewInstallments, note: v.row.reviewNote, by: names.get(v.row.reviewedByAccountId ?? -1) ?? '-', at: v.row.reviewedAt.toISOString(),
    } : null,
    decision: v.row.decidedAt ? {
      amount: v.row.finalAmount, installments: v.row.finalInstallments, note: v.row.decisionNote, by: names.get(v.row.decidedByAccountId ?? -1) ?? '-', at: v.row.decidedAt.toISOString(),
      withoutReview: v.row.withoutReview,
    } : null,
    closed: v.row.closedAt ? { reason: req?.decisionReason ?? v.row.closeReason, at: v.row.closedAt.toISOString(), by: names.get(v.row.closedByAccountId ?? -1) ?? '-' } : null,
    handover: v.handover ? {
      amount: v.handover.amount, moneyDate: v.handover.moneyDate, by: names.get(v.handover.handedByAccountId) ?? '-', method: v.handover.method === 'TRANSFER' ? 'Transfer' : 'Tunai',
      source: seesMoney ? source?.name ?? '-' : null, via: v.handover.viaEmployeeId ? people.find((p) => p.id === v.handover!.viaEmployeeId)?.name ?? '-' : 'Langsung ke orangnya',
      dateReason: v.handover.dateReason, beforeApproval: v.handover.beforeApproval, recordedAt: v.handover.createdAt.toISOString(),
    } : null,
    remaining: v.remaining,
    ...(await scheduleOf(v)),
    followups: follows.map((f) => ({ requestId: f.f.requestId, kind: f.f.kind, status: f.status, note: f.f.decisionNote ?? f.decisionReason })),
    canHandOver: v.stage === 'APPROVED' && !cancelOpen && hasAction(actor, 'advance.hand_over') && (!self || actor.fullAccess),
    canCancel: v.stage === 'APPROVED' && actor.fullAccess && hasAction(actor, 'advance.cancel'),
    canCancelHandover: Boolean(v.handover) && !v.movements.some((m) => m.status === 'ACTIVE') && actor.fullAccess && hasAction(actor, 'advance.cancel'),
    decideHref: req && OPEN.includes(req.status) && v.row.requestId ? `/persetujuan/${v.row.requestId}` : null,
    cancelOpen,
  };
}

// ---- Serahkan Uang (DRV-L29) ----

export async function handoverFormScreen(actor: Actor | null, id: number, now: Date = new Date()) {
  const detail = await detailScreen(actor, id, now);
  if (!detail) return null;
  const [v] = await loadAdvances({ ids: [id] });
  const sources = await db.select().from(paymentSources).where(eq(paymentSources.active, true)).orderBy(asc(paymentSources.sortOrder), asc(paymentSources.name));
  const people = (await listPeopleForModules()).filter((p) => p.activeToday && p.id !== v.row.employeeId).map((p) => ({ id: p.id, name: p.name, branchName: p.branchName }));
  people.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  return {
    detail, today: todayWib(now), approvedOn: v.row.decidedAt ? wibDate(v.row.decidedAt) : todayWib(now),
    sources: sources.map((s) => ({ id: s.id, name: s.name, method: s.method })), people,
    self: v.row.employeeId === actor!.personId,
    installments: v.installments.filter((i) => i.status === 'SCHEDULED').map((i) => i.amount),
  };
}

// ---- Periksa dan Putuskan (DRV-L27): isi khas di /persetujuan/[id] ----

export async function decisionPanel(actor: Actor | null, requestId: number, now: Date = new Date()) {
  if (!actor) return null;
  const [request] = await db.select().from(requests).where(eq(requests.id, requestId));
  if (!request || request.typeKey !== 'advance') return null;
  const views = await loadAdvances({ employeeIds: [request.subjectEmployeeId] });
  const v = views.find((x) => x.row.requestId === requestId);
  if (!v) return null;
  const person = (await listPeopleForModules()).find((p) => p.id === v.row.employeeId);
  if (!person) return null;
  const today = todayWib(now);
  const own = v.row.employeeId === actor.personId || v.row.filledByAccountId === actor.accountId;
  const approver = can(actor, 'advance.decide', person.target);
  const reviewer = !approver && can(actor, 'advance.review', person.target);
  if (!approver && !reviewer) return null;
  const rules = await rulesOn(today);
  const sixMonthsAgo = new Date(now.getTime() - 183 * 86_400_000);
  const recent = await db.select({ id: requests.id, status: requests.status, summary: requests.summary, submittedAt: requests.submittedAt }).from(requests)
    .where(and(eq(requests.typeKey, 'advance'), eq(requests.subjectEmployeeId, v.row.employeeId), gte(requests.submittedAt, sixMonthsAgo))).orderBy(desc(requests.submittedAt));
  const running = views.filter((x) => x.stage === 'RUNNING');
  const helper = {
    joinedOn: person.joinedOn,
    tenureMonths: Math.floor(daysBetween(person.joinedOn, today) / 30.44),
    running: running.filter((x) => x.row.kind !== 'SPECIAL').map((x) => ({ number: x.row.number, remaining: x.remaining })),
    special: running.filter((x) => x.row.kind === 'SPECIAL').map((x) => ({ number: x.row.number, remaining: x.remaining })),
    recent: recent.filter((r) => r.id !== requestId).map((r) => ({ status: r.status, summary: r.summary, at: r.submittedAt.toISOString() })),
  };
  let owner: { personLeft: number; funds: { monthly: number; weekly: number } } | null = null;
  if (approver) {
    const { byPerson, byFund } = await usage(today);
    owner = {
      personLeft: rules.personLimit - (byPerson.get(v.row.employeeId) ?? 0) + v.used,
      funds: { monthly: rules.fundSize - byFund.MONTHLY, weekly: (Number(await settingOn<number>('advance.fund_weekly', today)) || 1_000_000) - byFund.WEEKLY },
    };
  }
  return {
    requestId, version: request.version, status: request.status, number: v.row.number, name: person.name, own,
    role: approver ? 'APPROVER' as const : 'REVIEWER' as const,
    requested: { amount: v.row.requestedAmount, installments: v.row.requestedInstallments, reason: v.row.reason },
    review: approver && v.row.reviewedAt ? { amount: v.row.reviewAmount, installments: v.row.reviewInstallments, note: v.row.reviewNote } : null,
    rules: { amountStep: rules.amountStep, amountMin: rules.amountMin, maxInstallments: rules.maxInstallments, reasonMin: rules.reasonMin },
    open: request.status === 'PENDING' || request.status === 'REVIEWED',
    canAct: !own && (approver ? request.status === 'PENDING' || request.status === 'REVIEWED' : request.status === 'PENDING'),
    reviewed: request.status === 'REVIEWED',
    helper, owner, employeeId: v.row.employeeId,
  };
}

// ---- Beranda / perlu perhatian (DRV-64, 130) ----

export async function advanceAttention(actor: Actor | null, now: Date = new Date()) {
  if (!actor) return null;
  const reviewer = hasAction(actor, 'advance.review') && !actor.fullAccess;
  const handOver = hasAction(actor, 'advance.hand_over');
  if (!reviewer && !handOver && !actor.fullAccess) return null;
  const today = todayWib(now);
  const all = await loadAdvances();
  const reqs = await requestFacts(all.map((v) => v.row.requestId).filter((id): id is number => id != null));
  const processDays = Number(await settingOn<number>('advance.process_days', today)) || 2;
  const waitingReview = all.filter((v) => v.stage === 'WAITING_REVIEW' && v.row.employeeId !== actor.personId).length;
  const waitingDecision = actor.fullAccess ? all.filter((v) => v.stage === 'REVIEWED' && v.row.employeeId !== actor.personId).length : 0;
  const toHandOver = all.filter((v) => v.stage === 'APPROVED');
  const late = all.filter((v) => {
    const req = v.row.requestId ? reqs.get(v.row.requestId) : null;
    return (v.stage === 'WAITING_REVIEW' || v.stage === 'REVIEWED') && req && now.getTime() - req.submittedAt.getTime() >= processDays * 86_400_000;
  }).length;
  return {
    waitingReview: reviewer || actor.fullAccess ? waitingReview : 0, waitingDecision,
    toHandOver: handOver ? toHandOver.length : 0, toHandOverAmount: handOver ? toHandOver.reduce((s, v) => s + (v.row.finalAmount ?? 0), 0) : 0,
    late, processDays,
  };
}

export type { AdvanceStage };
