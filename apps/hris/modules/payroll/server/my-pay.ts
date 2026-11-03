import { and, asc, desc, eq, inArray, lte, ne } from 'drizzle-orm';
import { bonusEntries, bonusTypes, offSlipClaims, payslipLines, payslipPayments, payslipSteps, payslips } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import type { Actor } from '@/modules/access';
import { slipHoldFacts, unexplainedDays } from '@/modules/attendance';
import { todayWib } from '@/modules/employees';
import { LINE_LABELS, type LineKey } from '../rules/attendance-pay';
import { BONUS_STATUS_LABELS, entryKindLabel, type BonusStatus } from '../rules/bonus';
import {
  MAX_SELF_DOWNLOAD, headline, issueConsequence, mySlipState, paymentText, payIssuesFrom, withoutTolerance, type MyCard, type MyPayment, type PayIssue,
} from '../rules/my-pay';
import { CLAIM_STATUS_LABELS, type ClaimStatus } from '../rules/off-slip';
import { PAYSLIP_FROM, type SlipLine } from '../rules/payslip';
import { addPeriods, longDate, periodEndOf, periodStartOf, type IsoDate } from '../rules/salary';
import { computeAttendancePay } from './attendance-pay';
import { loadPeriodPeople, type PayrollPerson } from './data';
import { objectionLinksFor } from './other-deductions';
import { dueOf, plannedPayDateOf } from './payment';
import { slipPhrase } from './slip-period';
import { currentWeek } from './weekly-slip';
import { isWeeklyKind, parsePeriodKey, weekKey } from '../rules/wage-week';
import { mySlipObjections } from './slip-objection';
import { lastSlipOf, periodLabel, slipContent, slipPerson, slipVersionView, wibTime, type SlipRow, type SlipView } from './payslip';

// Pendapatan Saya, Slip Saya, dan unduh slip sendiri (spec L4g-1). Semua angka dari fungsi yang sama dengan layar kantor:
// Perkiraan dari `computeSlip` (lewat `slipContent`), slip Ditutup dari baris tersimpan. Hanya untuk orangnya sendiri.

async function personIn(personId: number, periodStart: IsoDate): Promise<PayrollPerson | null> {
  return (await loadPeriodPeople(periodStart, periodEndOf(periodStart))).find((p) => p.id === personId) ?? null;
}

/** Orang berslip mingguan (L7b) pada minggu berjalan. */
async function weeklyPersonNow(personId: number, now: Date): Promise<boolean> {
  const week = await currentWeek(now);
  return (await loadPeriodPeople(week.start, week.end, 'WEEKLY')).some((p) => p.id === personId);
}

/**
 * Periode yang punya slip atau tagihan luar slip orang itu, terbaru dulu: tanggal 26 untuk slip bulanan, `W` + awal minggu
 * untuk slip mingguan (L7b). Kerangka slip periode/minggu berjalan dibuat bila perlu.
 */
async function myPeriodStarts(personId: number, now: Date): Promise<string[]> {
  const current = periodStartOf(todayWib(now));
  if (current >= PAYSLIP_FROM && (await personIn(personId, current))) {
    await db.insert(payslips).values({ employeeId: personId, periodStart: current }).onConflictDoNothing();
  }
  if (await weeklyPersonNow(personId, now)) {
    const week = await currentWeek(now);
    await db.insert(payslips).values({ employeeId: personId, periodStart: week.start, periodEnd: week.end, kind: 'WEEKLY' }).onConflictDoNothing();
  }
  const [slipRows, claimRows] = await Promise.all([
    db.select({ periodStart: payslips.periodStart, kind: payslips.kind }).from(payslips).where(and(eq(payslips.employeeId, personId), lte(payslips.periodStart, todayWib(now)))),
    db.select({ createdAt: offSlipClaims.createdAt }).from(offSlipClaims).where(and(eq(offSlipClaims.employeeId, personId), ne(offSlipClaims.status, 'CANCELLED'))),
  ]);
  const keys = new Set<string>([
    ...slipRows.map((r) => (isWeeklyKind(r.kind) ? weekKey(r.periodStart) : r.periodStart)), ...claimRows.map((r) => periodStartOf(todayWib(r.createdAt))),
  ]);
  const dateOf = (k: string) => (k.startsWith('W') ? k.slice(1) : k);
  return [...keys].sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : dateOf(a) > dateOf(b) ? -1 : a < b ? 1 : -1));
}

/** Menu dan halaman Pendapatan Saya hanya untuk orang yang punya slip (spec L4g §9 butir 3). */
export async function hasMyPay(actor: Actor | null): Promise<boolean> {
  if (!actor) return false;
  const [row] = await db.select({ id: payslips.id }).from(payslips).where(eq(payslips.employeeId, actor.personId)).limit(1);
  return Boolean(row) || Boolean(await personIn(actor.personId, periodStartOf(todayWib()))) || weeklyPersonNow(actor.personId, new Date());
}

async function paymentOf(slipId: number): Promise<MyPayment | null> {
  const [p] = await db.select().from(payslipPayments).where(and(eq(payslipPayments.payslipId, slipId), eq(payslipPayments.status, 'ACTIVE')));
  return p ? { kind: p.kind as MyPayment['kind'], moneyDate: p.moneyDate, method: p.method as MyPayment['method'], accountTail: p.accountTail } : null;
}

/** Alasan buka kembali terakhir; slip Perkiraan yang pernah dibuka kembali = sedang dibetulkan. */
async function reopenReasonOf(slipId: number): Promise<string | null> {
  const [step] = await db.select({ reason: payslipSteps.reason }).from(payslipSteps)
    .where(and(eq(payslipSteps.payslipId, slipId), eq(payslipSteps.action, 'REOPEN'))).orderBy(desc(payslipSteps.createdAt)).limit(1);
  return step?.reason ?? null;
}

/** Urusan gaji saya (GAJ-108) untuk slip Perkiraan: penahan slip + Perlu Dijelaskan yang belum diisi. */
async function myIssues(person: PayrollPerson, periodStart: IsoDate, hasSalary: boolean, now: Date): Promise<PayIssue[]> {
  const end = periodEndOf(periodStart);
  const [facts, unexplained] = await Promise.all([slipHoldFacts([person.id], periodStart, end), unexplainedDays(person.id, periodStart, end, now)]);
  const f = facts.get(person.id) ?? { outsideReviews: [], clarifications: [], overtimeClaims: [] };
  const lastSlipBonus = lastSlipOf(person, periodStart) && (await db.select({ id: bonusEntries.id }).from(bonusEntries)
    .where(and(eq(bonusEntries.employeeId, person.id), inArray(bonusEntries.status, ['PENDING', 'HELD']), lte(bonusEntries.periodStart, periodStart))).limit(1)).length > 0;
  return payIssuesFrom({ unexplained, ...f, noSalary: !hasSalary, lastSlipBonus });
}

type SlipBundle = { slip: SlipRow; person: PayrollPerson; view: SlipView; hasSalary: boolean; payment: MyPayment | null; issues: PayIssue[]; state: ReturnType<typeof mySlipState> };

async function slipBundle(slip: SlipRow, person: PayrollPerson, now: Date): Promise<SlipBundle> {
  const { view, hasSalary } = await slipContent(slip, person, now);
  const closed = slip.status === 'CLOSED';
  const [payment, issues, due, reopenReason] = await Promise.all([
    closed ? paymentOf(slip.id) : Promise.resolve(null),
    closed || isWeeklyKind(slip.kind) ? Promise.resolve([]) : myIssues(person, slip.periodStart, hasSalary, now),
    closed ? dueOf(slip) : plannedPayDateOf(slip),
    closed ? Promise.resolve(null) : reopenReasonOf(slip.id),
  ]);
  const state = mySlipState({
    periodStart: slip.periodStart, status: slip.status as 'ESTIMATE' | 'CLOSED', reopened: !closed && reopenReason != null, held: issues.some((i) => i.who === 'OFFICE'),
    payment, due, today: todayWib(now), carried: view.totals.carried, reopenReason,
  });
  return { slip, person, view, hasSalary, payment, issues, state };
}

type Claim = typeof offSlipClaims.$inferSelect;

async function claimsIn(personId: number, periodStart: IsoDate): Promise<{ claim: Claim; payment: MyPayment | null }[]> {
  const rows = (await db.select().from(offSlipClaims).where(and(eq(offSlipClaims.employeeId, personId), ne(offSlipClaims.status, 'CANCELLED'))).orderBy(asc(offSlipClaims.createdAt)))
    .filter((c) => periodStartOf(todayWib(c.createdAt)) === periodStart);
  const pays = rows.length ? await db.select().from(payslipPayments)
    .where(and(inArray(payslipPayments.claimId, rows.map((r) => r.id)), eq(payslipPayments.status, 'ACTIVE'))) : [];
  return rows.map((claim) => {
    const p = pays.find((x) => x.claimId === claim.id);
    return { claim, payment: p ? { kind: p.kind as MyPayment['kind'], moneyDate: p.moneyDate, method: p.method as MyPayment['method'], accountTail: p.accountTail } : null };
  });
}

export type UpahRow = { date: IsoDate; label: string; amount: number; note: string | null };
export type HitunganLine = { key: string; label: string; sign: 1 | -1; amount: number; days: { workDate: IsoDate; text: string; amount: number; note: string | null }[] };

/** Tab Upah (spec L4g §3.1, §9 butir 2): baris pendapatan per tanggal kejadian; ritase dan bongkaran menyusul L7. */
async function upahRows(view: SlipView, estimate: boolean): Promise<UpahRow[]> {
  const rows: UpahRow[] = [];
  const end = view.period.start ? periodEndOf(view.period.start) : null;
  const bonusIds = view.income.flatMap((l) => l.details.bonusIds ?? []);
  const bonusRows = bonusIds.length ? await db.select({ entry: bonusEntries, typeName: bonusTypes.name }).from(bonusEntries)
    .leftJoin(bonusTypes, eq(bonusTypes.id, bonusEntries.typeId)).where(inArray(bonusEntries.id, bonusIds)) : [];
  for (const line of view.income) {
    if (line.lineKind === 'BASE') {
      rows.push({ date: end!, label: estimate ? 'Gaji tetap (perkiraan)' : 'Gaji tetap', amount: line.amount, note: null });
    } else if (line.details.bonusIds?.length) {
      for (const { entry, typeName } of bonusRows.filter((b) => line.details.bonusIds!.includes(b.entry.id))) {
        rows.push({ date: entry.occurredOn, label: `Bonus ${entryKindLabel(entry.kind, typeName).toLowerCase()}`, amount: entry.amount, note: entry.serviceName ?? entry.note ?? null });
      }
    } else if (line.details.days?.length) {
      for (const d of line.details.days) if (d.amount > 0) rows.push({ date: d.workDate, label: line.label, amount: d.amount, note: d.text });
    } else {
      rows.push({ date: line.details.date ?? end!, label: line.label, amount: line.amount, note: line.originPeriod ? `periode asal ${longDate(line.originPeriod)}` : null });
    }
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Tab Hitungan (GAJ-L09 bentuk karyawan): tersimpan bila slip Ditutup, dihitung bila Perkiraan; tanpa "dalam toleransi". */
async function hitungan(bundle: SlipBundle, now: Date): Promise<HitunganLine[] | null> {
  if (!bundle.hasSalary) return null;
  if (bundle.slip.status === 'CLOSED') {
    const lines: SlipLine[] = [...bundle.view.income, ...bundle.view.deductions.flatMap((g) => g.lines)].filter((l) => l.sourceKey.startsWith('att:'));
    return lines.map((l) => ({
      key: l.lineKind, label: l.label, sign: l.section === 'INCOME' ? 1 : -1, amount: l.amount,
      days: withoutTolerance((l.details.days ?? []).map((d) => ({ ...d, note: d.note ?? null }))),
    }));
  }
  const pay = await computeAttendancePay(bundle.person, bundle.slip.periodStart, now);
  if (!pay) return null;
  return pay.lines.filter((l) => l.amount > 0 || l.details.some((d) => d.amount > 0)).map((l) => ({
    key: l.key, label: LINE_LABELS[l.key as LineKey], sign: l.sign, amount: l.amount,
    days: withoutTolerance(l.details.map((d) => ({ workDate: d.workDate, text: d.text, amount: d.amount, note: d.note }))),
  }));
}

/** GAJ-L39 Pendapatan Saya: satu periode 26–25, kepala tiga angka, lima tab. Null = tidak punya slip. */
export async function myPayScreen(actor: Actor | null, periodInput: string | null, now: Date = new Date()) {
  if (!actor) return null;
  const starts = await myPeriodStarts(actor.personId, now);
  if (!starts.length) return null;
  const key = periodInput && starts.includes(periodInput) ? periodInput : starts[0];
  const parsed = parsePeriodKey(key)!;
  const period = parsed.start;
  const [slip] = parsed.weekly
    ? await db.select().from(payslips).where(and(eq(payslips.employeeId, actor.personId), eq(payslips.periodStart, period), inArray(payslips.kind, ['WEEKLY', 'WEEKLY_EXTRA'])))
    : await db.select().from(payslips).where(and(eq(payslips.employeeId, actor.personId), eq(payslips.periodStart, period), eq(payslips.kind, 'MONTHLY')));
  const person = slip ? (parsed.weekly ? await slipPerson(slip) : await personIn(actor.personId, period)) : null;
  const bundle = slip && person ? await slipBundle(slip, person, now) : null;
  const claims = parsed.weekly ? [] : await claimsIn(actor.personId, period);

  const cards: MyCard[] = [];
  if (bundle) cards.push({ net: bundle.view.totals.net, estimate: bundle.slip.status === 'ESTIMATE', paid: bundle.payment != null });
  for (const c of claims) cards.push({ net: c.claim.amount, estimate: false, paid: c.payment != null || c.claim.status === 'PAID' });
  const head = headline(cards);
  const pendingDue = bundle && !bundle.payment ? (bundle.slip.status === 'CLOSED' ? await dueOf(bundle.slip) : await plannedPayDateOf(bundle.slip)) : null;

  const deductions = bundle ? bundle.view.deductions.flatMap((g) => g.lines.map((l) => ({ ...l, groupLabel: g.label }))) : [];
  const links = bundle ? await objectionLinksFor(actor.personId, deductions.map((d) => d.sourceKey), now) : new Map<string, string>();
  const bonusRows = parsed.weekly ? [] : await db.select({ entry: bonusEntries, typeName: bonusTypes.name }).from(bonusEntries)
    .leftJoin(bonusTypes, eq(bonusTypes.id, bonusEntries.typeId))
    .where(and(eq(bonusEntries.employeeId, actor.personId), eq(bonusEntries.periodStart, period))).orderBy(asc(bonusEntries.occurredOn), asc(bonusEntries.id));
  const replaced = new Set(bonusRows.map((r) => r.entry.replacesId).filter((x): x is number => x != null));

  return {
    period: { start: key, label: bundle ? slipPhrase(bundle.slip) : `periode ${periodLabel(period)}` },
    periods: await myKeyLabels(actor.personId, starts),
    issues: bundle && bundle.slip.status === 'ESTIMATE' ? bundle.issues : [],
    consequence: parsed.weekly ? '' : issueConsequence(period, todayWib(now)),
    head: { ...head, pendingDue: pendingDue ? longDate(pendingDue) : null },
    slip: bundle ? {
      id: bundle.slip.id, number: bundle.slip.number, net: bundle.view.totals.net, state: bundle.state, estimate: bundle.slip.status === 'ESTIMATE',
      hasSalary: bundle.hasSalary,
    } : null,
    claims: claims.map(({ claim, payment }) => ({
      id: claim.id, label: claim.label, amount: claim.amount, status: CLAIM_STATUS_LABELS[claim.status as ClaimStatus],
      paymentText: payment ? paymentText(payment) : null,
    })),
    upah: bundle ? await upahRows(bundle.view, bundle.slip.status === 'ESTIMATE') : [],
    bonus: bonusRows.filter((r) => !(r.entry.status === 'CANCELLED' && replaced.has(r.entry.id))).map(({ entry, typeName }) => ({
      id: entry.id, date: entry.occurredOn, label: entryKindLabel(entry.kind, typeName), amount: entry.amount,
      status: BONUS_STATUS_LABELS[entry.status as BonusStatus], note: entry.serviceName ?? entry.note ?? entry.reason ?? null,
    })),
    potongan: deductions.map((d) => ({
      key: d.sourceKey, group: d.group, groupLabel: d.groupLabel, label: d.label, amount: d.amount, taken: d.taken, remaining: d.remaining,
      objectionLink: links.get(d.sourceKey) ?? null,
    })),
    potonganTotals: bundle ? { taken: bundle.view.totals.taken, carried: bundle.view.totals.carried } : null,
    // GM tidak diabsen (KAR-67): tidak punya tab Hitungan. Slip mingguan tidak memakai hitungan kehadiran.
    hitungan: bundle && !bundle.person.isGmPosition && !parsed.weekly ? await hitungan(bundle, now) : null,
    noHitungan: parsed.weekly ? 'Slip mingguan dihitung dari ritase dan upah belanja (tab Upah), bukan dari kehadiran.'
      : bundle?.person.isGmPosition ? 'GM tidak diabsen, jadi tidak punya hitungan kehadiran.' : null,
    closedPeriods: (await db.select().from(payslips)
      .where(and(eq(payslips.employeeId, actor.personId), eq(payslips.status, 'CLOSED'))).orderBy(desc(payslips.periodStart)))
      .map((r) => ({ start: isWeeklyKind(r.kind) ? weekKey(r.periodStart) : r.periodStart, label: isWeeklyKind(r.kind) ? slipPhrase(r) : periodLabel(r.periodStart), number: r.number })),
    computedAt: now.toISOString(),
  };
}

/** Label pilihan periode: slip mingguan dengan akhir minggunya, bulanan rentang 26–25. */
async function myKeyLabels(personId: number, keys: readonly string[]): Promise<{ start: string; label: string }[]> {
  const weekly = keys.filter((k) => k.startsWith('W')).map((k) => k.slice(1));
  const rows = weekly.length ? await db.select().from(payslips)
    .where(and(eq(payslips.employeeId, personId), inArray(payslips.periodStart, weekly), inArray(payslips.kind, ['WEEKLY', 'WEEKLY_EXTRA']))) : [];
  return keys.map((k) => {
    if (!k.startsWith('W')) return { start: k, label: periodLabel(k) };
    const row = rows.find((r) => r.periodStart === k.slice(1));
    return { start: k, label: row ? slipPhrase(row) : `minggu mulai ${k.slice(1)}` };
  });
}

/** GAJ-L40 Slip Saya. Slip orang lain = tidak ditemukan. `version` = versi lama (hanya baca). */
export async function mySlipScreen(actor: Actor | null, slipId: number, version: number | null, now: Date = new Date()) {
  if (!actor) return null;
  const [slip] = await db.select().from(payslips).where(eq(payslips.id, slipId));
  if (!slip || slip.employeeId !== actor.personId) return null;
  const person = await slipPerson(slip);
  if (!person) return null;
  const replaced = await db.selectDistinct({ version: payslipLines.version }).from(payslipLines)
    .where(and(eq(payslipLines.payslipId, slip.id), eq(payslipLines.status, 'REPLACED'))).orderBy(asc(payslipLines.version));
  const versions = replaced.map((r) => r.version);
  if (version != null) {
    const view = versions.includes(version) ? await slipVersionView(slip, person, version) : null;
    return view ? { old: true as const, view, versions, current: slip.version } : null;
  }
  const bundle = await slipBundle(slip, person, now);
  const cancelled = await db.select({ moneyDate: payslipPayments.moneyDate, reason: payslipPayments.cancelReason }).from(payslipPayments)
    .where(and(eq(payslipPayments.payslipId, slip.id), eq(payslipPayments.status, 'CANCELLED'))).orderBy(desc(payslipPayments.createdAt));
  return {
    old: false as const,
    view: bundle.view, state: bundle.state, issues: bundle.issues, consequence: isWeeklyKind(slip.kind) ? '' : issueConsequence(slip.periodStart, todayWib(now)),
    cancelled: cancelled.map((c) => ({ text: `Pembayaran ${longDate(c.moneyDate)} dibatalkan${c.reason ? `: ${c.reason}` : ''}` })),
    versions, current: slip.version, canDownload: slip.status === 'CLOSED', computedAt: now.toISOString(),
    objections: await mySlipObjections(slip, now),
  };
}

/** Unduh slip tertutup sendiri (GAJ-113): satu slip, atau sampai 12 periode. Perkiraan ditolak. Tiap unduhan dicatat. */
export async function myPrintScreen(actor: Actor | null, input: { slipId: number | null; periods: string[] }, now: Date = new Date()) {
  if (!actor) return null;
  let rows: SlipRow[] = [];
  if (input.slipId != null) {
    rows = await db.select().from(payslips).where(and(eq(payslips.id, input.slipId), eq(payslips.employeeId, actor.personId), eq(payslips.status, 'CLOSED')));
  } else {
    // Kunci periode: tanggal 26 (bulanan) atau W + awal minggu (mingguan, L7b).
    const keys = [...new Set(input.periods)].map(parsePeriodKey).filter((k): k is { weekly: boolean; start: IsoDate } => k != null);
    if (!keys.length || keys.length > MAX_SELF_DOWNLOAD) return null;
    rows = (await db.select().from(payslips)
      .where(and(eq(payslips.employeeId, actor.personId), eq(payslips.status, 'CLOSED'), inArray(payslips.periodStart, keys.map((k) => k.start)))).orderBy(asc(payslips.periodStart)))
      .filter((r) => keys.some((k) => k.start === r.periodStart && k.weekly === isWeeklyKind(r.kind)));
  }
  if (!rows.length) return null;
  const views: SlipView[] = [];
  for (const slip of rows) {
    const person = await slipPerson(slip);
    if (person) views.push((await slipContent(slip, person, now)).view);
  }
  if (!views.length) return null;
  await db.insert(payslipSteps).values(input.slipId != null
    ? { payslipId: rows[0].id, periodStart: rows[0].periodStart, action: 'SELF_DOWNLOAD', summary: { number: rows[0].number }, actorAccountId: actor.accountId }
    : { payslipId: null, periodStart: rows[rows.length - 1].periodStart, action: 'SELF_DOWNLOAD_MANY', summary: { count: rows.length, numbers: rows.map((r) => r.number) }, actorAccountId: actor.accountId });
  return { slips: views, printedAt: wibTime(now) };
}

/** Kartu Beranda "Urusan gaji saya" (GAJ-108): slip Perkiraan periode berjalan dan periode lalu yang masih punya urusan. */
export async function myPayAttention(actor: Actor | null, now: Date = new Date()) {
  if (!actor) return null;
  const current = periodStartOf(todayWib(now));
  const issues: PayIssue[] = [];
  for (const period of [addPeriods(current, -1), current]) {
    if (period < PAYSLIP_FROM) continue;
    const [slip] = await db.select().from(payslips).where(and(eq(payslips.employeeId, actor.personId), eq(payslips.periodStart, period), eq(payslips.status, 'ESTIMATE')));
    const person = slip ? await personIn(actor.personId, period) : null;
    if (!slip || !person) continue;
    const pay = await computeAttendancePay(person, period, now);
    issues.push(...(await myIssues(person, period, pay != null, now)));
  }
  if (!issues.length) return null;
  const mine = issues.filter((i) => i.who === 'YOU').length;
  return {
    title: `Urusan gaji Anda: ${issues.length}`,
    detail: mine ? `${mine} perlu Anda selesaikan supaya gaji tidak tertahan` : 'Menunggu keputusan kantor',
    href: '/pendapatan',
  };
}
