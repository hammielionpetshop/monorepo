import { and, asc, desc, eq, gte, inArray, lte, ne, or } from 'drizzle-orm';
import { offSlipClaims, payslipObjections, payslipPayments, payslipSteps, payslips } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { can, type Actor } from '@/modules/access';
import { formerStatus, listPeopleForModules, todayWib, type PersonForModules } from '@/modules/employees';
import {
  TOTALS_MAX_PERIODS, lastPeriodOf, moneyMattersFrom, totalsCsv, totalsFrom, totalsRange, totalsSum, type TotalsRange, type TotalsRow,
} from '../rules/former';
import { PAYSLIP_FROM } from '../rules/payslip';
import { addDays, addPeriods, periodStartOf, type IsoDate } from '../rules/salary';
import { accountNames, positionFlags } from './data';
import { periodLabel, wibTime } from './payslip';

// L4g-3 (spec L4g §3.7–3.8): urusan uang mantan karyawan (akses terbatas) dan Total Diterima per Orang.

/**
 * `hasMoneyMatters` (GAJ-113): mantan karyawan (Berhenti/Diberhentikan) yang masih punya urusan uang. Selain mantan
 * karyawan selalu tidak. Dipakai penjaga akses terbatas dan job harian penyesuaian akun.
 */
export async function hasMoneyMatters(employeeId: number, now: Date = new Date()): Promise<boolean> {
  const former = await formerStatus(employeeId, todayWib(now));
  if (!former) return false;
  const lastPeriod = lastPeriodOf(addDays(former.since, -1));
  const [slips, objections, claims] = await Promise.all([
    db.select({ id: payslips.id, periodStart: payslips.periodStart, status: payslips.status }).from(payslips)
      .where(and(eq(payslips.employeeId, employeeId), lte(payslips.periodStart, lastPeriod ?? PAYSLIP_FROM))),
    db.select({ id: payslipObjections.id }).from(payslipObjections).where(and(
      eq(payslipObjections.employeeId, employeeId),
      or(eq(payslipObjections.state, 'PENDING'), eq(payslipObjections.fixStatus, 'WAITING_FIX')),
    )).limit(1),
    db.select({ id: offSlipClaims.id }).from(offSlipClaims).where(and(eq(offSlipClaims.employeeId, employeeId), eq(offSlipClaims.status, 'WAITING'))).limit(1),
  ]);
  const payments = slips.length ? await db.select({ payslipId: payslipPayments.payslipId, createdAt: payslipPayments.createdAt }).from(payslipPayments)
    .where(and(inArray(payslipPayments.payslipId, slips.map((s) => s.id)), eq(payslipPayments.status, 'ACTIVE'))) : [];
  return moneyMattersFrom({
    lastPeriod,
    slips: slips.map((s) => ({
      periodStart: s.periodStart, status: s.status as 'ESTIMATE' | 'CLOSED', paidAt: payments.find((p) => p.payslipId === s.id)?.createdAt ?? null,
    })),
    openObjections: objections.length, waitingClaims: claims.length,
  }, now);
}

// ---- Total Diterima per Orang (GAJ-L43) ----

/** Pemilik/GM semua; HR (`payroll_totals.view`) tanpa jabatan bertanda; Finance dan Admin HR tidak. */
function totalsViewOf(actor: Actor | null): 'FULL' | 'HR' | null {
  if (!actor || actor.limited) return null;
  if (actor.fullAccess) return 'FULL';
  return can(actor, 'payroll_totals.view') ? 'HR' : null;
}

export type TotalsFilter = { dari?: string; sampai?: string; cabang?: string; jabatan?: string; status?: string; cari?: string };

type Person = PersonForModules & { ownerOnly: boolean };

async function visiblePeople(view: 'FULL' | 'HR', today: IsoDate): Promise<Map<number, Person>> {
  const people = await listPeopleForModules();
  const flags = await positionFlags(people.map((p) => p.positionId), today);
  return new Map(people
    .map((p) => ({ ...p, ownerOnly: flags.get(p.positionId)?.ownerOnly ?? false }))
    // Jabatan bertanda tidak dikirim ke HR, juga tidak dalam jumlah (spec L4g §3.8).
    .filter((p) => view === 'FULL' || !p.ownerOnly)
    .map((p) => [p.id, p]));
}

async function latestClosedPeriod(): Promise<IsoDate | null> {
  const [row] = await db.select({ periodStart: payslips.periodStart }).from(payslips).where(eq(payslips.status, 'CLOSED')).orderBy(desc(payslips.periodStart)).limit(1);
  return row?.periodStart ?? null;
}

type Facts = {
  slips: { id: number; employeeId: number; periodStart: IsoDate; number: string | null; net: number; branchId: number | null; branchName: string | null; positionName: string | null; paid: boolean }[];
  claims: { id: number; employeeId: number; periodStart: IsoDate; label: string; amount: number; branchId: number | null; branchName: string | null; paid: boolean }[];
};

/** `totalReceived` (spec L4g §3.8): dibaca dari slip tersimpan, pembayaran, dan tagihan luar slip; tidak menghitung ulang. */
async function totalReceivedFacts(range: TotalsRange, employeeIds: readonly number[] | null): Promise<Facts> {
  const people = employeeIds ? inArray(payslips.employeeId, [...employeeIds]) : undefined;
  const slipRows = await db.select().from(payslips).where(and(
    eq(payslips.status, 'CLOSED'), gte(payslips.periodStart, range.from), lte(payslips.periodStart, range.to), people,
  )).orderBy(asc(payslips.periodStart));
  const paidSlips = slipRows.length ? new Set((await db.select({ id: payslipPayments.payslipId }).from(payslipPayments)
    .where(and(inArray(payslipPayments.payslipId, slipRows.map((s) => s.id)), eq(payslipPayments.status, 'ACTIVE')))).map((p) => p.id)) : new Set<number | null>();
  // Tagihan luar slip masuk periode saat lahir (sama dengan Pendapatan Saya).
  const claimRows = await db.select().from(offSlipClaims).where(and(
    ne(offSlipClaims.status, 'CANCELLED'), employeeIds ? inArray(offSlipClaims.employeeId, [...employeeIds]) : undefined,
  )).orderBy(asc(offSlipClaims.createdAt));
  return {
    slips: slipRows.map((s) => ({
      id: s.id, employeeId: s.employeeId, periodStart: s.periodStart, number: s.number, net: s.net ?? 0, branchId: s.branchId, branchName: s.branchName,
      positionName: s.positionName, paid: paidSlips.has(s.id),
    })),
    claims: claimRows
      .map((c) => ({ c, periodStart: periodStartOf(todayWib(c.createdAt)) }))
      .filter(({ periodStart }) => periodStart >= range.from && periodStart <= range.to)
      .map(({ c, periodStart }) => ({
        id: c.id, employeeId: c.employeeId, periodStart, label: c.label, amount: c.amount, branchId: c.branchId, branchName: c.branchName, paid: c.status === 'PAID',
      })),
  };
}

function rangeOf(q: TotalsFilter, fallback: IsoDate | null, now: Date): TotalsRange {
  const latest = periodStartOf(todayWib(now));
  return totalsRange({ from: q.dari, to: q.sampai }, fallback ?? (addPeriods(latest, -1) >= PAYSLIP_FROM ? addPeriods(latest, -1) : PAYSLIP_FROM), latest);
}

type ScreenRow = TotalsRow & { name: string; code: string; branchName: string; positionName: string; former: boolean };

async function totalsRows(view: 'FULL' | 'HR', q: TotalsFilter, range: TotalsRange, now: Date) {
  const people = await visiblePeople(view, todayWib(now));
  const facts = await totalReceivedFacts(range, [...people.keys()]);
  const latestSlip = new Map<number, Facts['slips'][number]>();
  for (const s of facts.slips) latestSlip.set(s.employeeId, s);
  const all: (ScreenRow & { branchIds: Set<number> })[] = totalsFrom(facts.slips, facts.claims).flatMap((row) => {
    const person = people.get(row.employeeId);
    if (!person) return [];
    const slip = latestSlip.get(row.employeeId);
    const branchIds = new Set<number>([...facts.slips, ...facts.claims].filter((x) => x.employeeId === row.employeeId && x.branchId != null).map((x) => x.branchId!));
    return [{
      ...row, name: person.name, code: person.code, branchName: slip?.branchName ?? person.branchName, positionName: slip?.positionName ?? person.positionName,
      former: !person.activeToday, branchIds,
    }];
  });
  const branchId = Number(q.cabang) || null;
  const search = (q.cari ?? '').trim().toLowerCase();
  const rows = all
    .filter((r) => !branchId || r.branchIds.has(branchId))
    .filter((r) => !q.jabatan || r.positionName === q.jabatan)
    .filter((r) => (q.status === 'aktif' ? !r.former : q.status === 'mantan' ? r.former : true))
    .filter((r) => !search || r.name.toLowerCase().includes(search) || r.code.toLowerCase().includes(search))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  const branches = new Map<number, string>();
  for (const x of [...facts.slips, ...facts.claims]) if (x.branchId != null && people.has(x.employeeId)) branches.set(x.branchId, x.branchName ?? '-');
  return {
    rows: rows.map((r) => ({ ...r, branchIds: undefined })),
    options: {
      branches: [...branches].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'id')),
      positions: [...new Set(all.map((r) => r.positionName))].sort((a, b) => a.localeCompare(b, 'id')),
    },
  };
}

/** GAJ-L43 Total Diterima per Orang (PC). Null = tidak berhak. */
export async function totalsScreen(actor: Actor | null, q: TotalsFilter, now: Date = new Date()) {
  const view = totalsViewOf(actor);
  if (!view) return null;
  const range = rangeOf(q, await latestClosedPeriod(), now);
  const { rows, options } = await totalsRows(view, q, range, now);
  const latest = periodStartOf(todayWib(now));
  const periods: { start: IsoDate; label: string }[] = [];
  for (let p = latest; p >= PAYSLIP_FROM; p = addPeriods(p, -1)) periods.push({ start: p, label: periodLabel(p) });
  return {
    view, rows, sum: totalsSum(rows), options, periods, maxPeriods: TOTALS_MAX_PERIODS,
    range: { from: range.from, to: range.to, count: range.periods.length, label: rangeLabel(range) },
    filter: { cabang: q.cabang ?? '', jabatan: q.jabatan ?? '', status: q.status ?? '', cari: q.cari ?? '' },
  };
}

const rangeLabel = (range: TotalsRange) => (range.from === range.to ? periodLabel(range.from) : `${periodLabel(range.from)} s.d. ${periodLabel(range.to)}`);

/** Rincian per periode satu orang (bentuk Pendapatan Saya, hanya baca). Orang di luar hak = tidak ditemukan. */
export async function totalsPersonScreen(actor: Actor | null, employeeId: number, q: TotalsFilter, now: Date = new Date()) {
  const view = totalsViewOf(actor);
  if (!view) return null;
  const person = (await visiblePeople(view, todayWib(now))).get(employeeId);
  if (!person) return null;
  const range = rangeOf(q, await latestClosedPeriod(), now);
  const facts = await totalReceivedFacts(range, [employeeId]);
  const periods = range.periods.slice().reverse().map((start) => {
    const slips = facts.slips.filter((s) => s.periodStart === start);
    const claims = facts.claims.filter((c) => c.periodStart === start);
    const [row] = totalsFrom(slips, claims);
    return {
      start, label: periodLabel(start),
      slips: slips.map((s) => ({ id: s.id, number: s.number, net: s.net, paid: s.paid, branchName: s.branchName ?? '-' })),
      claims: claims.map((c) => ({ id: c.id, label: c.label, amount: c.amount, paid: c.paid })),
      totals: row ?? null,
    };
  }).filter((p) => p.totals);
  const [row] = totalsFrom(facts.slips, facts.claims);
  return {
    person: { id: person.id, name: person.name, code: person.code, former: !person.activeToday },
    range: { from: range.from, to: range.to, label: rangeLabel(range) }, periods, totals: row ?? null,
  };
}

/** Unduh CSV (§9 butir 7). Tiap unduhan dicatat di Riwayat periode akhir rentang. */
export async function totalsDownload(actor: Actor | null, q: TotalsFilter, now: Date = new Date()): Promise<{ filename: string; csv: string } | null> {
  const view = totalsViewOf(actor);
  if (!view || !actor) return null;
  const range = rangeOf(q, await latestClosedPeriod(), now);
  const { rows } = await totalsRows(view, q, range, now);
  const madeBy = (await accountNames()).get(actor.accountId) ?? '-';
  await db.insert(payslipSteps).values({
    payslipId: null, periodStart: range.to, action: 'TOTALS_DOWNLOAD', actorAccountId: actor.accountId,
    summary: { from: range.from, to: range.to, count: rows.length, filter: { cabang: q.cabang ?? null, jabatan: q.jabatan ?? null, status: q.status ?? null, cari: q.cari ?? null } },
  });
  return {
    filename: `total-diterima-${range.from}-sd-${range.to}-dibuat-${todayWib(now)}.csv`,
    csv: totalsCsv(rows, { range: rangeLabel(range), madeBy, madeAt: wibTime(now) }),
  };
}
