import { and, asc, eq, gt, gte, inArray, like, lt, lte, ne, or, sql } from 'drizzle-orm';
import {
  bonusEntries, bonusTypes, deductionCarryovers, otherDeductionInstallments, otherDeductionTypes, otherDeductions, payslipLines, payslips, tripWageValues,
} from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { advanceSlipItems } from '@/modules/advances';
import { todayWib } from '@/modules/employees';
import { dayLabel, fleetLabels, weekOf, type WeekRange, type WeekRegime } from '@/modules/logistics';
import { entryKindLabel } from '../rules/bonus';
import type { DeductionGroup } from '../rules/deductions';
import {
  HOLD_LABELS, applyResignFine, buildSlip,
  type DeductionInput, type IncomeInput, type SlipComputation, type SlipHold, type SlipLineDetails,
} from '../rules/payslip';
import { longDate, periodStartOf, type IsoDate } from '../rules/salary';
import { valueNote, type ZeroReason } from '../rules/trip-wages';
import { WEEKLY_SLIP_FROM, addDays, weekKey, type SlipKind } from '../rules/wage-week';
import { loadPeriodPeople, type PayrollPerson } from './data';
import { fineRefundItems, fineSlipItems, waivedFineCarries } from './driver-fine-slip';
import { loadWeekRegimes } from './slip-period';
import { slippedSourceKeys } from './slip-state';

// Slip mingguan (spec L7 §3.5, L7b): slip utama orang berdasar gaji Mingguan dan slip di luar slip utama untuk upah ritase
// orang Bulanan. Satu penghitung untuk layar dan langkah tutup; tidak menyimpan apa pun.

const ROLE_LABELS: Record<string, string> = { DRIVER: 'Driver', ASSISTANT: 'Kenek' };
const KIND_LABELS: Record<string, string> = { RITASE: 'Ritase', SHOPPING: 'Upah belanja' };

export type WeeklyRef = { kind: SlipKind; periodStart: IsoDate };

export type WeeklyResult = {
  computation: SlipComputation;
  stop: IsoDate;
  last: boolean;
  withoutNotice: boolean;
  forfeitBonusIds: number[];
  voidCarryIds: number[];
  /** Upah ritase yang dimuat slip ini (ditandai slip pemuat saat ditutup). */
  tripValueIds: number[];
  holds: SlipHold[];
  range: WeekRange;
};

/** Slip terakhir di minggu ini: hari nonaktif jatuh di dalam minggu atau tepat sehari sesudahnya. */
export function weeklyLastOf(person: Pick<PayrollPerson, 'lastStatus'>, range: WeekRange): boolean {
  const s = person.lastStatus;
  return s?.kind === 'DEACTIVATE' && s.effectiveOn > range.start && s.effectiveOn <= addDays(range.end, 1);
}

/** Orang slip mingguan: utama = berdasar gaji Mingguan; di luar slip utama = siapa pun yang punya upah ritase Bulanan. */
export async function weeklyPeople(kind: SlipKind, range: WeekRange): Promise<PayrollPerson[]> {
  return loadPeriodPeople(range.start, range.end, kind === 'WEEKLY' ? 'WEEKLY' : 'ANY');
}

export async function computeWeeklySlip(person: PayrollPerson, ref: WeeklyRef, _now: Date = new Date(), regimes?: WeekRegime[]): Promise<WeeklyResult> {
  const weeks = regimes ?? await loadWeekRegimes();
  const range = weekOf(ref.periodStart, weeks);
  const { start, end } = range;
  const basis = ref.kind === 'WEEKLY' ? 'WEEKLY' : 'MONTHLY';
  const last = weeklyLastOf(person, range);
  const withoutNotice = last && Boolean(person.lastStatus?.withoutNotice);
  const income: IncomeInput[] = [];
  const deductions: DeductionInput[] = [];
  const forfeitBonusIds: number[] = [];
  const voidCarryIds: number[] = [];
  const holds: SlipHold[] = [];

  // Upah yang tanggalnya sebelum minggu ini (ritase tangan atau penilaian ulang sesudah slip minggunya ditutup) dan koreksi
  // hanya masuk slip Perkiraan paling awal orang itu, supaya tidak muncul di dua slip sekaligus.
  const [earlierOpen] = await db.select({ id: payslips.id }).from(payslips)
    .where(and(eq(payslips.employeeId, person.id), eq(payslips.kind, ref.kind), eq(payslips.status, 'ESTIMATE'), lt(payslips.periodStart, start))).limit(1);
  const earliest = !earlierOpen;

  // ---- Pendapatan: upah ritase dan upah belanja (per hari) ----
  const values = await db.select().from(tripWageValues)
    .where(and(eq(tripWageValues.employeeId, person.id), eq(tripWageValues.payBasis, basis), ne(tripWageValues.status, 'CANCELLED'),
      gte(tripWageValues.wageDate, earliest ? WEEKLY_SLIP_FROM : start), lte(tripWageValues.wageDate, end)))
    .orderBy(asc(tripWageValues.wageDate), asc(tripWageValues.id));
  const slipped = await slippedSourceKeys(values.map((v) => `trip:${v.id}`), person.id);
  const mine = values.filter((v) => !slipped.has(`trip:${v.id}`) && !(v.amount === 0 && v.status === 'ACTIVE' && v.wageDate < start));
  const labels = mine.length ? await fleetLabels() : null;
  const unratedDates: IsoDate[] = [];
  for (const v of mine) {
    const note = valueNote({ status: v.status as 'ACTIVE' | 'UNRATED', zeroReason: v.zeroReason as ZeroReason | null });
    if (v.status === 'UNRATED') unratedDates.push(v.wageDate);
    const older = v.wageDate < start;
    const details: SlipLineDetails = {
      date: v.wageDate, tripValueId: v.id, link: `/gaji/upah-ritase?minggu=${weekOf(v.wageDate, weeks).start}`,
      ...(note || older ? { text: [note, older ? `tanggal asal ${longDate(v.wageDate)}` : null].filter(Boolean).join(' · ') } : {}),
    };
    income.push({
      sourceKey: `trip:${v.id}`, lineKind: v.kind,
      label: `${dayLabel(v.wageDate)} · ${KIND_LABELS[v.kind] ?? v.kind} ${ROLE_LABELS[v.role] ?? v.role} · ${labels!.vehicles.get(v.vehicleId) ?? 'Mobil'} · ${labels!.routes.get(v.routeId)?.name ?? 'rute'}`,
      amount: v.amount, originPeriod: older ? weekOf(v.wageDate, weeks).start : null, details,
    });
  }
  if (unratedDates.length) {
    const since = [...unratedDates].sort()[0];
    holds.push({ kind: 'UNRATED', text: `${HOLD_LABELS.UNRATED.title} (${unratedDates.length}, sejak ${longDate(since)})`, resolver: HOLD_LABELS.UNRATED.resolver, link: '/pengaturan/tarif-ritase', since });
  }

  // ---- Koreksi upah ritase yang sudah masuk slip tertutup lalu dibatalkan / dinilai ulang (spec L7 §3.3) ----
  if (earliest) {
    const closedTrip = await closedLines(person.id, ref.kind, 'trip:%');
    const corrected = new Set((await closedLines(person.id, ref.kind, 'tripcorr:%')).map((l) => l.sourceKey.slice('tripcorr:'.length)));
    const ids = closedTrip.map((l) => Number(l.sourceKey.slice(5))).filter((id) => Number.isInteger(id) && !corrected.has(String(id)));
    const cancelled = ids.length ? await db.select().from(tripWageValues).where(and(inArray(tripWageValues.id, ids), eq(tripWageValues.status, 'CANCELLED'))) : [];
    for (const v of cancelled) {
      const line = closedTrip.find((l) => l.sourceKey === `trip:${v.id}`)!;
      if (line.amount <= 0) continue;
      deductions.push({
        group: 'a', sourceKey: `tripcorr:${v.id}`, lineKind: 'TRIP_CORRECTION', label: `Koreksi ${line.label}`, date: v.wageDate, amount: line.amount,
        originPeriod: weekOf(v.wageDate, weeks).start,
        details: { date: v.wageDate, text: `Sudah dibayar ${longDate(v.wageDate)}; ${v.cancelReason ?? 'dibatalkan'}. Upah penggantinya (bila ada) tercatat sebagai baris baru.`, link: `/gaji/upah-ritase?minggu=${weekOf(v.wageDate, weeks).start}` },
      });
    }
  }

  // ---- Slip utama saja: bonus, Potongan Lain, sisa potongan ----
  if (ref.kind === 'WEEKLY') {
    const bonusRows = await db.select({ entry: bonusEntries, typeName: bonusTypes.name }).from(bonusEntries)
      .leftJoin(bonusTypes, eq(bonusTypes.id, bonusEntries.typeId))
      .where(and(eq(bonusEntries.employeeId, person.id), eq(bonusEntries.status, 'APPROVED'), lte(bonusEntries.occurredOn, end)))
      .orderBy(asc(bonusEntries.occurredOn), asc(bonusEntries.id));
    const groups = new Map<string, IncomeInput & { ids: number[] }>();
    for (const { entry, typeName } of bonusRows) {
      const label = entryKindLabel(entry.kind, typeName);
      if (withoutNotice && entry.amount > 0) { forfeitBonusIds.push(entry.id); continue; }
      if (entry.amount < 0) {
        deductions.push({
          group: 'c', sourceKey: `bonus:${entry.id}`, lineKind: 'BONUS_CORRECTION', label: `Koreksi bonus ${label.toLowerCase()}`, date: entry.occurredOn,
          amount: -entry.amount, originPeriod: null, details: { text: entry.note ?? undefined, bonusIds: [entry.id] },
        });
        continue;
      }
      const key = `bonus:${entry.kind}:${entry.typeId ?? ''}:${entry.fund}:${weekKey(start)}`;
      const g = groups.get(key) ?? {
        sourceKey: key, lineKind: entry.kind, label: `Bonus ${label.toLowerCase()}${entry.fund === 'DISCIPLINE_FUND' ? ' (Dana Disiplin)' : ''}`,
        amount: 0, originPeriod: null, details: {}, ids: [],
      };
      g.amount += entry.amount;
      g.ids.push(entry.id);
      groups.set(key, g);
    }
    for (const g of groups.values()) {
      const details: SlipLineDetails = { text: `${g.ids.length} baris Buku Bonus`, bonusIds: g.ids, link: `/gaji/${person.id}/bonus` };
      if (g.sourceKey.includes(':DISCIPLINE_FUND:')) details.fund = 'DISCIPLINE_FUND';
      income.push({ sourceKey: g.sourceKey, lineKind: g.lineKind, label: g.label, amount: g.amount, originPeriod: null, details });
    }
    const waiting = last ? await db.select({ on: bonusEntries.occurredOn }).from(bonusEntries)
      .where(and(eq(bonusEntries.employeeId, person.id), inArray(bonusEntries.status, ['PENDING', 'HELD']), lte(bonusEntries.occurredOn, end))) : [];
    if (waiting.length) {
      const since = waiting.map((w) => w.on).sort()[0];
      holds.push({ kind: 'LAST_SLIP_BONUS', text: `${HOLD_LABELS.LAST_SLIP_BONUS.title} (${waiting.length}, sejak ${longDate(since)})`, resolver: HOLD_LABELS.LAST_SLIP_BONUS.resolver, link: `/gaji/${person.id}/bonus`, since });
    }

    // Potongan Lain (kelompok c): cicilan yang jatuh di periode bulanan sampai akhir minggu ini; satu cicilan = satu slip mingguan.
    if (!(person.isOwnerPosition || person.isGmPosition)) {
      const monthOfEnd = periodStartOf(end);
      const due = await db.select({
        id: otherDeductionInstallments.id, amount: otherDeductionInstallments.amount, sequence: otherDeductionInstallments.sequence,
        total: otherDeductions.installments, createdAt: otherDeductions.createdAt, typeName: otherDeductionTypes.name, reason: otherDeductions.reason,
      }).from(otherDeductionInstallments).innerJoin(otherDeductions, eq(otherDeductions.id, otherDeductionInstallments.deductionId))
        .innerJoin(otherDeductionTypes, eq(otherDeductionTypes.id, otherDeductions.typeId))
        .where(and(eq(otherDeductions.employeeId, person.id), eq(otherDeductions.status, 'ACTIVE'),
          last ? or(lte(otherDeductionInstallments.periodStart, monthOfEnd), gt(otherDeductionInstallments.periodStart, monthOfEnd)) : lte(otherDeductionInstallments.periodStart, monthOfEnd),
          sql`${otherDeductionInstallments.cancelledAt} is null`));
      const candidates: DeductionInput[] = due.map((d) => ({
        group: 'c' as DeductionGroup, sourceKey: `other:${d.id}`, lineKind: 'OTHER', label: `${d.typeName} (cicilan ${d.sequence} dari ${d.total})`,
        date: d.createdAt.toISOString().slice(0, 10), amount: d.amount, originPeriod: null, details: { text: d.reason, link: '/potongan/lain' },
      }));
      const done = await slippedSourceKeys(candidates.map((c) => c.sourceKey), person.id);
      deductions.push(...candidates.filter((c) => !done.has(c.sourceKey)));
    }

    // Denda driver & kenek (kelompok a, L7c): minggu tanggal kejadian; denda minggu lalu yang belum terpotong (slip minggunya
    // sudah ditutup sebelum disahkan) hanya di slip Perkiraan paling awal. Pengembalian denda yang ditiadakan juga di sana.
    if (!(person.isOwnerPosition || person.isGmPosition)) {
      deductions.push(...await fineSlipItems(person.id, { from: earliest ? undefined : start, to: end }, (d) => (d < start ? weekOf(d, weeks).start : null)));
    }
    if (earliest) income.push(...await fineRefundItems(person.id));

    // Cicilan kasbon (kelompok d, DRV-23, 133; L7b-2): satu cicilan = satu slip mingguan. Cicilan minggu sebelumnya yang
    // belum terpotong hanya masuk slip Perkiraan paling awal, seperti upah ritase.
    const advanceItems = await advanceSlipItems(person.id, [], start, last, db, { kind: 'WEEKLY', from: earliest ? undefined : start, upTo: end });
    const advanceSlipped = await slippedSourceKeys(advanceItems.map((i) => i.sourceKey), person.id);
    deductions.push(...advanceItems.filter((i) => !advanceSlipped.has(i.sourceKey)));
  }

  // Sisa potongan dari slip mingguan sebelumnya yang sejenis (GAJ-52, 75). Slip utama mingguan juga membawa sisa dari slip
  // bulanan orang yang berganti slip utama (DRV-140), hanya di slip Perkiraan paling awal supaya tidak tampil dua kali.
  const fromKinds: SlipKind[] = ref.kind === 'WEEKLY' && earliest ? ['WEEKLY', 'MONTHLY'] : [ref.kind];
  const carries = await db.select({ carry: deductionCarryovers, kind: payslips.kind }).from(deductionCarryovers)
    .innerJoin(payslips, eq(payslips.id, deductionCarryovers.fromPayslipId))
    .where(and(eq(deductionCarryovers.employeeId, person.id), eq(deductionCarryovers.status, 'CARRIED'), inArray(payslips.kind, fromKinds), lt(payslips.periodStart, start)));
  const waivedFines = await waivedFineCarries(carries.map((c) => c.carry));
  for (const { carry, kind } of carries) {
    if (waivedFines.has(carry.id)) {
      voidCarryIds.push(carry.id);
      continue;
    }
    deductions.push({
      group: carry.deductionGroup as DeductionGroup, sourceKey: `carry:${carry.id}`, lineKind: carry.lineKind, label: carry.label, date: carry.originPeriod,
      amount: carry.amount, originPeriod: carry.originPeriod, carried: true,
      details: { carryId: carry.id, text: kind === 'MONTHLY' ? 'Sisa potongan dari slip bulanan sebelumnya' : 'Sisa potongan dari slip mingguan sebelumnya', ...(carry.sourceKey ? { originKey: carry.sourceKey } : {}) },
    });
  }

  const stop = person.lastStatus?.kind === 'DEACTIVATE' && person.lastStatus.effectiveOn <= end && person.lastStatus.effectiveOn > start
    ? addDays(person.lastStatus.effectiveOn, -1) : end;
  const built = buildSlip(income, deductions);
  return {
    computation: withoutNotice ? applyResignFine(built, end) : built, stop, last, withoutNotice, forfeitBonusIds, voidCarryIds,
    tripValueIds: mine.map((v) => v.id), holds, range,
  };
}

async function closedLines(employeeId: number, kind: SlipKind, pattern: string) {
  return db.select({ line: payslipLines }).from(payslipLines).innerJoin(payslips, eq(payslips.id, payslipLines.payslipId))
    .where(and(eq(payslipLines.employeeId, employeeId), like(payslipLines.sourceKey, pattern), eq(payslipLines.status, 'ACTIVE'), eq(payslips.kind, kind),
      eq(payslips.status, 'CLOSED'), sql`${payslipLines.version} = ${payslips.version}`))
    .then((rows) => rows.map((r) => r.line));
}

/**
 * Kerangka slip minggu itu (idempoten): slip utama untuk tiap orang Mingguan yang aktif ≥ 1 hari di minggu itu, walau belum
 * punya ritase; slip di luar slip utama untuk orang yang punya upah ritase Bulanan (atau koreksi) yang belum masuk slip.
 * Akhir minggu slip Perkiraan disegarkan bila hari awal minggu diganti.
 */
export async function ensureWeeklySkeletons(start: IsoDate, regimes?: WeekRegime[]): Promise<{ range: WeekRange; main: PayrollPerson[]; extraIds: number[] }> {
  const weeks = regimes ?? await loadWeekRegimes();
  const range = weekOf(start, weeks);
  if (range.start < WEEKLY_SLIP_FROM) return { range, main: [], extraIds: [] };
  const main = await weeklyPeople('WEEKLY', range);
  if (main.length) {
    await db.insert(payslips).values(main.map((p) => ({ employeeId: p.id, periodStart: range.start, periodEnd: range.end, kind: 'WEEKLY' }))).onConflictDoNothing();
  }
  // Upah Bulanan sampai minggu ini yang belum masuk slip (Rp0 hari kerja tidak melahirkan slip). Slipnya di minggu tanggal
  // upah itu; bila slip minggu itu sudah ditutup, di minggu ini. Koreksi upah yang sudah dibayar lalu dibatalkan juga minggu ini.
  const monthly = await db.select({ id: tripWageValues.id, employeeId: tripWageValues.employeeId, wageDate: tripWageValues.wageDate }).from(tripWageValues)
    .where(and(eq(tripWageValues.payBasis, 'MONTHLY'), ne(tripWageValues.status, 'CANCELLED'), gte(tripWageValues.wageDate, WEEKLY_SLIP_FROM), lte(tripWageValues.wageDate, range.end),
      or(gt(tripWageValues.amount, 0), eq(tripWageValues.status, 'UNRATED'))));
  const done = await slippedSourceKeys(monthly.map((v) => `trip:${v.id}`));
  const pending = monthly.filter((v) => !done.has(`trip:${v.id}`));
  const paidThenCancelled = await db.select({ id: tripWageValues.id, employeeId: tripWageValues.employeeId }).from(tripWageValues)
    .where(and(eq(tripWageValues.payBasis, 'MONTHLY'), eq(tripWageValues.status, 'CANCELLED'), sql`${tripWageValues.payslipId} is not null`));
  const corrected = await slippedSourceKeys(paidThenCancelled.map((v) => `tripcorr:${v.id}`));
  const closedExtra = new Set((pending.length ? await db.select({ employeeId: payslips.employeeId, periodStart: payslips.periodStart }).from(payslips)
    .where(and(eq(payslips.kind, 'WEEKLY_EXTRA'), eq(payslips.status, 'CLOSED'), inArray(payslips.employeeId, [...new Set(pending.map((v) => v.employeeId))]))) : [])
    .map((r) => `${r.employeeId}|${r.periodStart}`));
  const wanted = new Map<string, { employeeId: number; week: WeekRange }>();
  for (const v of pending) {
    const own = weekOf(v.wageDate, weeks);
    const week = closedExtra.has(`${v.employeeId}|${own.start}`) ? range : own;
    wanted.set(`${v.employeeId}|${week.start}`, { employeeId: v.employeeId, week });
  }
  for (const v of paidThenCancelled) if (!corrected.has(`tripcorr:${v.id}`)) wanted.set(`${v.employeeId}|${range.start}`, { employeeId: v.employeeId, week: range });
  const extra = [...wanted.values()];
  if (extra.length) {
    await db.insert(payslips).values(extra.map((w) => ({ employeeId: w.employeeId, periodStart: w.week.start, periodEnd: w.week.end, kind: 'WEEKLY_EXTRA' }))).onConflictDoNothing();
  }
  const extraIds = [...new Set(extra.filter((w) => w.week.start === range.start).map((w) => w.employeeId))];
  await db.update(payslips).set({ periodEnd: range.end })
    .where(and(eq(payslips.periodStart, range.start), inArray(payslips.kind, ['WEEKLY', 'WEEKLY_EXTRA']), eq(payslips.status, 'ESTIMATE'), ne(payslips.periodEnd, range.end)));
  return { range, main, extraIds };
}

/** Minggu berjalan menurut tanggal WIB. */
export async function currentWeek(now: Date = new Date(), regimes?: WeekRegime[]): Promise<WeekRange> {
  return weekOf(todayWib(now), regimes ?? await loadWeekRegimes());
}
