import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm';
import { advanceFollowups } from '@petshop/hris-db/schema/advances';
import { payslips } from '@petshop/hris-db/schema/payroll';
import { requests } from '@petshop/hris-db/schema/requests';
import { db } from '@/lib/db';
import { moneyPlaceById, moneyPlaces } from '@/lib/money-places';
import { can, getOrgLookup, hasAction, type Actor } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { listPeopleForModules, placementHistory, placementOn, todayWib, type PersonForModules } from '@/modules/employees';
import { settingOn } from '@/modules/settings';
import {
  STAGE_LABELS, STAGE_TONES, addMonthsClamped, daysBetween, monthOf, periodLabel, rupiah, stepPeriods, type AdvanceStage, type IsoDate,
} from '../rules/advance';
import { checkAdvance, hasPackageOn, lastPeriodOf, leavingOn, loadAdvances, payBasisOf, personTrack, rulesOn, usage, type AdvanceView } from './data';
import { carriesOf, isWaiting, labelOf, rescheduleLimits, specialEventKinds } from './manage';
import { postponeCheck } from './postpone';

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
  const slips = slipIds.length ? await db.select({ id: payslips.id, number: payslips.number, periodStart: payslips.periodStart, kind: payslips.kind }).from(payslips).where(inArray(payslips.id, slipIds)) : [];
  const live = view.installments.filter((i) => i.status !== 'REPLACED');
  return {
    installments: live.map((i) => {
      const taken = view.movements.filter((m) => m.installmentId === i.id && m.status === 'ACTIVE' && m.kind === 'SLIP').reduce((s, m) => s + m.amount, 0);
      return {
        id: i.id, sequence: i.sequence, total: i.total, amount: i.amount, period: i.periodStart ? labelOf(i) : null,
        status: i.status, statusLabel: INSTALLMENT_LABELS[i.status] ?? i.status, taken,
      };
    }),
    movements: view.movements.map((m) => {
      const slip = slips.find((s) => s.id === m.payslipId);
      return {
        id: m.id, kind: m.kind, amount: m.amount, active: m.status === 'ACTIVE', reason: m.reason, reversedReason: m.reversedReason,
        text: m.kind === 'SLIP' ? `Terpotong di slip ${slip?.number ?? ''} (${slip ? periodLabel(slip.periodStart, slip.kind === 'MONTHLY' ? 'MONTHLY' : 'WEEKLY') : ''})`
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

/** Cara uang kasbon diserahkan; LEGACY = sisa bawaan sistem lama, tanpa uang keluar (spec L9 §2). */
const methodLabel = (method: string) => (method === 'TRANSFER' ? 'Transfer' : method === 'LEGACY' ? 'Bawaan sistem lama' : 'Tunai');

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
    const postponeOpen = own.find((f) => f.f.kind === 'POSTPONE' && OPEN.includes(f.status));
    const postponeBlocked = v.stage === 'RUNNING' && !postponeOpen ? await postponeCheck(v, db, today) : null;
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
      handover: v.handover ? { moneyDate: v.handover.moneyDate, method: methodLabel(v.handover.method).toLowerCase(), via } : null,
      remaining: v.remaining, handed: v.handover?.amount ?? 0,
      ...(await scheduleOf(v)),
      canWithdraw: v.stage === 'WAITING_REVIEW' || v.stage === 'REVIEWED',
      canResubmit: v.stage === 'REJECTED' && v.row.filledByAccountId === actor.accountId,
      canRequestCancel: v.stage === 'APPROVED' && !cancelOpen,
      cancelRequested: Boolean(cancelOpen),
      canReportNotReceived: Boolean(v.handover && v.handover.method !== 'LEGACY' && notReceivedUntil && now <= notReceivedUntil && !notReceivedOpen && !own.some((f) => f.f.kind === 'NOT_RECEIVED' && f.f.handoverId === v.handover!.id)),
      notReceivedUntil: notReceivedUntil?.toISOString() ?? null,
      notReceived: own.filter((f) => f.f.kind === 'NOT_RECEIVED').map((f) => ({ status: f.status, note: f.f.decisionNote ?? f.decisionReason })),
      // Tunda cicilan (DRV-134): tombol tampil selama berjalan; alasan bila tidak bisa.
      canPostpone: v.stage === 'RUNNING' && !postponeOpen && !postponeBlocked,
      postponeBlocked: v.stage === 'RUNNING' && !postponeOpen ? postponeBlocked : null,
      postponeRequested: Boolean(postponeOpen),
      postpones: own.filter((f) => f.f.kind === 'POSTPONE' && !OPEN.includes(f.status)).map((f) => ({ status: f.status, note: f.decisionReason })),
      eventKind: v.row.eventKind,
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
    if (!(await payBasisOf(p.positionId, today))) continue;
    const from = addMonthsClamped(p.joinedOn, rules.minTenureMonths);
    list.push({ id: p.id, name: p.name, branchName: p.branchName, tenureOk: today >= from, tenureFrom: from });
  }
  list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  return { mode, rules, quick, blocked: null, people: list };
}

// ---- Kasbon (daftar kantor, DRV-L26) ----

export type OfficeTab = 'periksa' | 'putuskan' | 'diberikan' | 'berjalan' | 'selesai' | 'ditolak' | 'uang';
export const OFFICE_TABS: { key: OfficeTab; label: string }[] = [
  { key: 'periksa', label: 'Menunggu diperiksa' },
  { key: 'putuskan', label: 'Menunggu diputuskan' },
  { key: 'diberikan', label: 'Menunggu diberikan' },
  { key: 'berjalan', label: 'Berjalan' },
  { key: 'selesai', label: 'Selesai' },
  { key: 'ditolak', label: 'Ditolak dan dibatalkan' },
  { key: 'uang', label: 'Uang Kasbon' },
];

/** Tab Uang Kasbon (spec L5 §9 butir 4): Pemilik, GM, Finance. HR dan Admin HR tidak melihat sumber uang. */
const seesMoneyOf = (actor: Actor | null) => Boolean(actor?.fullAccess) || hasAction(actor, 'advance.review') || hasAction(actor, 'advance.hand_over') || hasAction(actor, 'advance.repay');

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
  if (v.row.kind === 'SPECIAL') labels.push(v.row.eventKind ? `Khusus · ${v.row.eventKind}` : 'Khusus');
  if (v.row.kind === 'LEGACY') labels.push('Bawaan sistem lama');
  if (v.installments.some((i) => i.status === 'WAITING_WEEKLY')) labels.push('Menunggu slip mingguan');
  if (own.some((f) => f.f.kind === 'POSTPONE')) labels.push('Minta tunda');
  return labels;
}

export async function officeScreen(actor: Actor | null, input: { tab: OfficeTab | null; q: string | null; month?: string | null }, now: Date = new Date()) {
  if (!canOffice(actor)) return null;
  const tabs = OFFICE_TABS.filter((t) => t.key !== 'uang' || seesMoneyOf(actor));
  if (input.tab === 'uang' && !seesMoneyOf(actor)) input = { ...input, tab: null };
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
        return `${rupiah(i.amount)} · ${labelOf(i)}`;
      })() : null,
      labels: await labelsOf(v, { today, processDays, follows, people, names, submittedAt: req?.submittedAt ?? null }),
      waitingWeekly: v.installments.filter((i) => i.status === 'WAITING_WEEKLY').reduce((s, i) => s + i.amount, 0),
      sortKey: req?.submittedAt?.getTime() ?? v.row.createdAt.getTime(),
    });
  }
  rows.sort((a, b) => (tab === 'berjalan' ? b.remaining - a.remaining : a.sortKey - b.sortKey));
  const showFunds = Boolean(actor!.fullAccess) && hasAction(actor, 'advance.funds.view');
  const rules = await rulesOn(today);
  // Kasbon Berjalan (DRV-L38): ringkasan sisa per orang.
  const perPerson = new Map<string, { name: string; branchName: string; count: number; remaining: number; waitingWeekly: number }>();
  if (tab === 'berjalan') {
    for (const r of rows) {
      const cur = perPerson.get(r.name) ?? { name: r.name, branchName: r.branchName, count: 0, remaining: 0, waitingWeekly: 0 };
      cur.count += 1;
      cur.remaining += r.remaining;
      cur.waitingWeekly += r.waitingWeekly;
      perPerson.set(r.name, cur);
    }
  }
  return {
    tab, tabs, q: input.q ?? '', counts, rows,
    people: [...perPerson.values()].sort((a, b) => b.remaining - a.remaining),
    money: tab === 'uang' ? await moneyScreen(actor, input.month ?? null, now) : null,
    canSpecial: Boolean(actor!.fullAccess) && hasAction(actor, 'advance.manage'),
    canLegacy: hasAction(actor, 'advance.legacy_enter') || hasAction(actor, 'advance.decide'),
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
  const source = await moneyPlaceById(v.handover?.moneyPlaceId);
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
      amount: v.handover.amount, moneyDate: v.handover.moneyDate, by: names.get(v.handover.handedByAccountId) ?? '-', method: methodLabel(v.handover.method),
      source: seesMoney ? source?.name ?? '-' : null, via: v.handover.viaEmployeeId ? people.find((p) => p.id === v.handover!.viaEmployeeId)?.name ?? '-' : 'Langsung ke orangnya',
      dateReason: v.handover.dateReason, beforeApproval: v.handover.beforeApproval, recordedAt: v.handover.createdAt.toISOString(),
    } : null,
    remaining: v.remaining,
    ...(await scheduleOf(v)),
    followups: follows.map((f) => ({ requestId: f.f.requestId, kind: f.f.kind, status: f.status, note: f.f.decisionNote ?? f.decisionReason })),
    canHandOver: v.stage === 'APPROVED' && !cancelOpen && hasAction(actor, 'advance.hand_over') && (!self || actor.fullAccess),
    canCancel: v.stage === 'APPROVED' && actor.fullAccess && hasAction(actor, 'advance.cancel'),
    canCancelHandover: Boolean(v.handover) && v.handover?.method !== 'LEGACY' && !v.movements.some((m) => m.status === 'ACTIVE') && actor.fullAccess && hasAction(actor, 'advance.cancel'),
    decideHref: req && OPEN.includes(req.status) && v.row.requestId ? `/persetujuan/${v.row.requestId}` : null,
    cancelOpen,
    eventKind: v.row.eventKind,
    // L5b (spec L5 §3.10, §5): pelunasan Finance/Pemilik/GM (bukan miliknya kecuali Pemilik/GM); kelola Pemilik/GM bukan miliknya.
    canRepay: v.stage === 'RUNNING' && (actor.fullAccess || can(actor, 'advance.repay', person.target)) && (!self || actor.fullAccess),
    canManage: v.stage === 'RUNNING' && Boolean(actor.fullAccess) && hasAction(actor, 'advance.manage') && !self,
    canPostponeFor: v.stage === 'RUNNING' && !self && can(actor, 'advance.fill_for', person.target),
    reversible: actor.fullAccess && hasAction(actor, 'advance.manage') && !self && v.stage !== 'TRANSFERRED'
      ? v.movements.filter((m) => m.status === 'ACTIVE' && (m.kind === 'CASH' || m.kind === 'WRITE_OFF')).map((m) => m.id) : [],
  };
}

// ---- Terima pelunasan, Hapus utang, Ubah jadwal, Batalkan catatan (DRV-L34, L35, L36, L39) ----

export async function manageFormScreen(actor: Actor | null, id: number, now: Date = new Date()) {
  const detail = await detailScreen(actor, id, now);
  if (!detail) return null;
  const [v] = await loadAdvances({ ids: [id] });
  const today = todayWib(now);
  const sources = await moneyPlaces({ payable: true });
  const carried = (await carriesOf(db, v)).reduce((s, c) => s + c.amount, 0);
  const limits = await rescheduleLimits(v, today);
  const person = (await listPeopleForModules()).find((p) => p.id === v.row.employeeId);
  const last = person ? lastPeriodOf(person, limits.track) : null;
  const starts: { value: IsoDate; label: string }[] = [];
  for (let i = 0; i <= limits.maxAhead; i += 1) {
    const period = stepPeriods(limits.nearestOpen, i, limits.track);
    if (limits.closed.has(period) || (last && period > last)) continue;
    starts.push({ value: period, label: periodLabel(period, limits.track.kind) });
  }
  return {
    detail, today, handedOn: v.handover?.moneyDate ?? today, carried,
    sources: sources.map((s) => ({ id: s.id, name: s.name, method: s.method })),
    waiting: v.installments.filter((i) => isWaiting(i.status)).map((i) => ({ amount: i.amount, period: i.periodStart ? labelOf(i) : '-' })),
    reschedule: { total: limits.total, maxCount: limits.maxCount, starts, weekly: limits.track.kind === 'WEEKLY' },
  };
}

// ---- Minta Tunda (DRV-L32): pemilik kasbon, atau HR/Admin HR atas nama ----

export async function postponeFormScreen(actor: Actor | null, id: number, now: Date = new Date()) {
  if (!actor) return null;
  const [v] = await loadAdvances({ ids: [id] });
  if (!v) return null;
  const self = v.row.employeeId === actor.personId;
  const person = (await listPeopleForModules()).find((p) => p.id === v.row.employeeId);
  if (!self && !(person && can(actor, 'advance.fill_for', person.target))) return null;
  const next = v.installments.filter((i) => i.status === 'SCHEDULED' && i.periodStart).sort((a, b) => (a.periodStart! < b.periodStart! ? -1 : 1))[0];
  return {
    id, number: v.row.number, name: person?.name ?? '-', self,
    next: next ? { amount: next.amount, period: labelOf(next) } : null,
    blocked: await postponeCheck(v, db, todayWib(now)),
    backHref: self ? '/kasbon' : `/gaji/kasbon/${id}`,
  };
}

// ---- Buat Kasbon Khusus (DRV-L37) ----

export async function specialFormScreen(actor: Actor | null, now: Date = new Date()) {
  if (!actor?.fullAccess || !hasAction(actor, 'advance.manage')) return null;
  const today = todayWib(now);
  const rules = await rulesOn(today);
  const people = [];
  for (const p of await listPeopleForModules()) {
    if (!p.activeToday || p.id === actor.personId || leavingOn(p, today)) continue;
    const basis = await payBasisOf(p.positionId, today);
    if (!basis || (basis === 'MONTHLY' && !(await hasPackageOn(p.id, today)))) continue;
    people.push({ id: p.id, name: p.name, branchName: p.branchName });
  }
  people.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  return {
    people, kinds: await specialEventKinds(today), amountStep: rules.amountStep, reasonMin: rules.reasonMin,
    maxInstallments: Number(await settingOn<number>('advance.special_max_installments', today)) || 12,
  };
}

// ---- Uang Kasbon (spec L5 §9 butir 4): per bulan, per cabang, per Sumber Uang; pengganti Buku Kas sementara ----

export type MoneyRow = { date: IsoDate; kind: 'OUT' | 'IN' | 'WRITE_OFF'; number: string; name: string; branchName: string; sourceName: string; amount: number; id: number };
const MONEY_KIND_LABELS: Record<MoneyRow['kind'], string> = { OUT: 'Uang keluar (diberikan)', IN: 'Uang masuk (pelunasan)', WRITE_OFF: 'Utang kasbon dihapus (biaya)' };

export async function moneyScreen(actor: Actor | null, monthInput: string | null, now: Date = new Date()) {
  if (!seesMoneyOf(actor)) return null;
  const today = todayWib(now);
  const month = monthInput && /^\d{4}-\d{2}$/.test(monthInput) ? monthInput : monthOf(today);
  const all = await loadAdvances();
  const people = await listPeopleForModules();
  const { branches } = await getOrgLookup();
  const sources = await moneyPlaces();
  const history = await placementHistory();
  const branchOn = (employeeId: number, date: IsoDate) => {
    const placement = placementOn(history.get(employeeId) ?? [], date);
    return branches.find((b) => b.id === placement?.branchId)?.name ?? '-';
  };
  const rows: MoneyRow[] = [];
  const months = new Set<string>([monthOf(today)]);
  for (const v of all) {
    const name = people.find((p) => p.id === v.row.employeeId)?.name ?? `#${v.row.employeeId}`;
    // Kasbon bawaan sistem lama tidak mengeluarkan uang (spec L9 §2).
    if (v.handover && v.handover.method !== 'LEGACY') {
      months.add(monthOf(v.handover.moneyDate));
      if (monthOf(v.handover.moneyDate) === month) {
        rows.push({ id: v.handover.id, date: v.handover.moneyDate, kind: 'OUT', number: v.row.number, name, branchName: branchOn(v.row.employeeId, v.handover.moneyDate), sourceName: sources.find((s) => s.id === v.handover!.moneyPlaceId)?.name ?? '-', amount: v.handover.amount });
      }
    }
    for (const m of v.movements) {
      if (m.status !== 'ACTIVE' || (m.kind !== 'CASH' && m.kind !== 'WRITE_OFF') || !m.moneyDate) continue;
      months.add(monthOf(m.moneyDate));
      if (monthOf(m.moneyDate) !== month) continue;
      rows.push({
        id: m.id, date: m.moneyDate, kind: m.kind === 'CASH' ? 'IN' : 'WRITE_OFF', number: v.row.number, name, branchName: branchOn(v.row.employeeId, m.moneyDate),
        sourceName: m.kind === 'CASH' ? sources.find((s) => s.id === m.moneyPlaceId)?.name ?? '-' : '-', amount: m.amount,
      });
    }
  }
  rows.sort((a, b) => (a.date === b.date ? a.number.localeCompare(b.number) : a.date < b.date ? -1 : 1));
  const groups = new Map<string, { kind: MoneyRow['kind']; label: string; branchName: string; sourceName: string; amount: number; count: number }>();
  for (const r of rows) {
    const key = `${r.kind}|${r.branchName}|${r.sourceName}`;
    const cur = groups.get(key) ?? { kind: r.kind, label: MONEY_KIND_LABELS[r.kind], branchName: r.branchName, sourceName: r.sourceName, amount: 0, count: 0 };
    cur.amount += r.amount;
    cur.count += 1;
    groups.set(key, cur);
  }
  const total = (kind: MoneyRow['kind']) => rows.filter((r) => r.kind === kind).reduce((s, r) => s + r.amount, 0);
  return {
    month, months: [...months].sort().reverse(), rows, groups: [...groups.values()],
    totals: { out: total('OUT'), in: total('IN'), writeOff: total('WRITE_OFF') }, kindLabels: MONEY_KIND_LABELS,
  };
}

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Unduh CSV Uang Kasbon satu bulan (salin ke pembukuan sampai app Keuangan ada). */
export async function moneyCsv(actor: Actor | null, month: string | null, now: Date = new Date()) {
  const screen = await moneyScreen(actor, month, now);
  if (!screen) return null;
  const head = ['Tanggal', 'Jenis', 'Nomor kasbon', 'Nama', 'Cabang', 'Sumber uang', 'Nominal'];
  const lines = screen.rows.map((r) => [r.date, MONEY_KIND_LABELS[r.kind], r.number, r.name, r.branchName, r.sourceName, r.amount].map(csvCell).join(','));
  return { filename: `uang-kasbon-${screen.month}.csv`, csv: [head.join(','), ...lines].join('\r\n') };
}

// ---- Serahkan Uang (DRV-L29) ----

export async function handoverFormScreen(actor: Actor | null, id: number, now: Date = new Date()) {
  const detail = await detailScreen(actor, id, now);
  if (!detail) return null;
  const [v] = await loadAdvances({ ids: [id] });
  const sources = await moneyPlaces({ payable: true });
  const people = (await listPeopleForModules()).filter((p) => p.activeToday && p.id !== v.row.employeeId).map((p) => ({ id: p.id, name: p.name, branchName: p.branchName }));
  people.sort((a, b) => a.name.localeCompare(b.name, 'id'));
  return {
    detail, today: todayWib(now), approvedOn: v.row.decidedAt ? wibDate(v.row.decidedAt) : todayWib(now),
    sources: sources.map((s) => ({ id: s.id, name: s.name, method: s.method })), people,
    self: v.row.employeeId === actor!.personId,
    installments: v.installments.filter((i) => i.status === 'SCHEDULED').map((i) => i.amount),
    weekly: (await personTrack(v.row.employeeId, todayWib(now))).kind === 'WEEKLY',
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
    // Cicilan "Menunggu slip mingguan" (spec L5 §9 butir 3): perlu perhatian Pemilik/GM.
    waitingWeekly: actor.fullAccess ? all.filter((v) => v.installments.some((i) => i.status === 'WAITING_WEEKLY')).length : 0,
  };
}

export type { AdvanceStage };
