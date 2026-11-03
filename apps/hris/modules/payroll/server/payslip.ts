import { and, asc, desc, eq, gt, gte, inArray, like, lt, lte, or, sql } from 'drizzle-orm';
import {
  bonusEntries, bonusTypes, deductionCarryovers, fundEntries, inventoryLosses, manualCashShortages, otherDeductionInstallments, otherDeductions,
  otherDeductionTypes, otherReceivables, payslipLines, payslipObjections, payslipPayments, payslipSteps, payslips,
} from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { can, getOrgLookup, hasAction, listEmployeesWithAnyAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { slipHoldFacts } from '@/modules/attendance';
import { placementOn, todayWib } from '@/modules/employees';
import { notify } from '@/modules/notifications';
import { settingOn } from '@/modules/settings';
import { LINE_LABELS } from '../rules/attendance-pay';
import { entryKindLabel } from '../rules/bonus';
import { GROUP_LABELS, type DeductionGroup } from '../rules/deductions';
import {
  PAYSLIP_FROM, SLIP_STATUS_LABELS, applyResignFine, attendanceInputs, buildSlip, closeOpensAt, closeWindowOpen, correctionInputs, fundMovements, holdsFrom,
  lastSlipLeftovers, objectionUntil, reasonProblem, slipNumber,
  type DeductionInput, type IncomeInput, type SlipComputation, type SlipHold, type SlipLine, type SlipLineDetails, type SlipStatus,
} from '../rules/payslip';
import { addPeriods, longDate, packageOn, periodEndOf, periodStartOf, rupiah, type IsoDate } from '../rules/salary';
import { computeAttendancePay } from './attendance-pay';
import { shortageAmountsOf } from './cash-shortages';
import { accountNames, loadPackages, loadPeriodPeople, type PayrollPerson } from './data';
import { loadTimelines } from './deduction-data';
import { lockFunds } from './funds';
import { lossSplitOf } from './losses';
import { slippedSourceKeys } from './slip-state';

// Periode Slip, Slip, penahan, dan langkah tutup (spec L4e-1). Satu penghitung `computeSlip` dipakai semua layar dan langkah tutup.

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

/** Mode uji tutup slip (spec L4e §3.4, §9 butir 3): hanya di staging (penanda staging yang sudah dipasang compose). */
export const payslipTestMode = () => process.env.AUTH_COOKIE_ENV === 'staging';

export const periodLabel = (start: IsoDate) => `${longDate(start)} – ${longDate(periodEndOf(start))}`;
const timeFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const wibTime = (d: Date) => timeFormat.format(d);

async function openDayOf(periodStart: IsoDate): Promise<number> {
  return Number(await settingOn<number>('payroll.slip_close_open_day', periodStart)) || 29;
}

/** Periode yang slip orang ini sudah ditutup. */
async function closedPeriodsOf(employeeId: number): Promise<Set<IsoDate>> {
  const rows = await db.select({ periodStart: payslips.periodStart }).from(payslips).where(and(eq(payslips.employeeId, employeeId), eq(payslips.status, 'CLOSED')));
  return new Set(rows.map((r) => r.periodStart));
}

/**
 * Periode sumber yang masuk slip P (GAJ-50, 86): P sendiri, ditambah periode sebelumnya yang slipnya sudah ditutup berturut-turut
 * tepat sebelum P (sumber yang disahkan sesudah slip periodenya ditutup ikut slip terbuka berikutnya).
 */
function sourcePeriods(periodStart: IsoDate, closed: Set<IsoDate>): IsoDate[] {
  const list = [periodStart];
  let prev = addPeriods(periodStart, -1);
  while (prev >= PAYSLIP_FROM && closed.has(prev)) {
    list.push(prev);
    prev = addPeriods(prev, -1);
  }
  return list;
}

const isOwnerOrGm = (person: PayrollPerson) => person.isOwnerPosition || person.isGmPosition;
const origin = (q: IsoDate, p: IsoDate) => (q === p ? null : q);

export type SlipResult = {
  computation: SlipComputation;
  stop: IsoDate;
  /** Slip terakhir (GAJ-82): orang berhenti di periode ini. */
  last: boolean;
  /** Berhenti tanpa pemberitahuan (GAJ-58): bonus Hangus dan bersih menjadi denda. */
  withoutNotice: boolean;
  /** Bonus Disahkan yang menjadi Hangus saat ditutup. */
  forfeitBonusIds: number[];
  /** Sisa potongan dari sumber yang sudah ditiadakan (keberatan): tidak diambil, ditandai batal saat ditutup. */
  voidCarryIds: number[];
};

/** Slip terakhir: hari nonaktif (sehari sesudah hari terakhir bekerja) jatuh di dalam periode atau tepat sehari sesudahnya. */
export function lastSlipOf(person: Pick<PayrollPerson, 'lastStatus'>, periodStart: IsoDate): boolean {
  const s = person.lastStatus;
  return s?.kind === 'DEACTIVATE' && s.effectiveOn > periodStart && s.effectiveOn <= addDays(periodEndOf(periodStart), 1);
}

/**
 * Hitung slip satu orang satu periode (GAJ-91, spec L4e §3.2). Tidak menyimpan apa pun. Null = belum ada gaji berlaku.
 * Pendapatan: kehadiran + bonus Disahkan. Potongan: (a) kehadiran; (b) kehilangan, minus kas; (c) cicilan Potongan Lain,
 * koreksi bonus minus; sisa dari slip sebelumnya diambil lebih dulu di kelompoknya. L4e-2: Koreksi Periode Lalu,
 * pengembalian potongan yang ditiadakan sesudah terpotong, seluruh sisa cicilan di slip terakhir, Hangus + denda GAJ-58.
 */
export async function computeSlip(person: PayrollPerson, periodStart: IsoDate, now: Date = new Date()): Promise<SlipResult | null> {
  const pay = await computeAttendancePay(person, periodStart, now);
  if (!pay) return null;
  const end = periodEndOf(periodStart);
  const periods = sourcePeriods(periodStart, await closedPeriodsOf(person.id));
  const oldest = periods[periods.length - 1];
  const last = lastSlipOf(person, periodStart);
  const withoutNotice = last && Boolean(person.lastStatus?.withoutNotice);
  const forfeitBonusIds: number[] = [];
  const voidCarryIds: number[] = [];
  const att = attendanceInputs(pay.lines, periodStart, LINE_LABELS);
  const income: IncomeInput[] = [...att.income];
  const deductions: DeductionInput[] = [...att.deductions];

  // Bonus Disahkan yang belum masuk slip tertutup (GAJ-86).
  const bonusRows = await db.select({ entry: bonusEntries, typeName: bonusTypes.name }).from(bonusEntries)
    .leftJoin(bonusTypes, eq(bonusTypes.id, bonusEntries.typeId))
    .where(and(eq(bonusEntries.employeeId, person.id), eq(bonusEntries.status, 'APPROVED'), inArray(bonusEntries.periodStart, periods)))
    .orderBy(asc(bonusEntries.occurredOn), asc(bonusEntries.id));
  const bonusGroups = new Map<string, IncomeInput & { ids: number[]; count: number }>();
  for (const { entry, typeName } of bonusRows) {
    const label = entryKindLabel(entry.kind, typeName);
    if (withoutNotice && entry.amount > 0) {
      // GAJ-58: bonus yang belum masuk slip menjadi Hangus (dana terpesan dilepas saat ditutup).
      forfeitBonusIds.push(entry.id);
      continue;
    }
    if (entry.amount < 0) {
      deductions.push({
        group: 'c', sourceKey: `bonus:${entry.id}`, lineKind: 'BONUS_CORRECTION', label: `Koreksi bonus ${label.toLowerCase()}`, date: entry.occurredOn,
        amount: -entry.amount, originPeriod: origin(entry.periodStart, periodStart), details: { text: entry.note ?? undefined, bonusIds: [entry.id] },
      });
      continue;
    }
    const key = `bonus:${entry.kind}:${entry.typeId ?? ''}:${entry.fund}:${entry.periodStart}`;
    const group = bonusGroups.get(key) ?? {
      sourceKey: key, lineKind: entry.kind, label: `Bonus ${label.toLowerCase()}${entry.fund === 'DISCIPLINE_FUND' ? ' (Dana Disiplin)' : ''}`,
      amount: 0, originPeriod: origin(entry.periodStart, periodStart), details: {}, ids: [], count: 0,
    };
    group.amount += entry.amount;
    group.ids.push(entry.id);
    group.count += 1;
    bonusGroups.set(key, group);
  }
  for (const g of bonusGroups.values()) {
    const details: SlipLineDetails = { text: `${g.count} baris Buku Bonus`, bonusIds: g.ids, link: `/gaji/${person.id}/bonus?periode=${g.originPeriod ?? periodStart}` };
    if (g.sourceKey.includes(':DISCIPLINE_FUND:')) details.fund = 'DISCIPLINE_FUND';
    income.push({ sourceKey: g.sourceKey, lineKind: g.lineKind, label: g.label, amount: g.amount, originPeriod: g.originPeriod, details });
  }

  // Potongan di luar kehadiran; jabatan Pemilik dan GM tidak dikenai (GAJ-09).
  if (!isOwnerOrGm(person)) {
    const candidates: DeductionInput[] = [];
    const losses = await db.select().from(inventoryLosses).where(and(eq(inventoryLosses.status, 'ACTIVE'), gte(inventoryLosses.foundOn, oldest), lte(inventoryLosses.foundOn, end)));
    for (const loss of losses) {
      const q = periodStartOf(loss.foundOn);
      if (!periods.includes(q)) continue;
      const share = (await lossSplitOf(loss.branchId, loss.foundOn, loss.amount))?.shares.find((s) => s.employeeId === person.id);
      if (share?.amount) {
        candidates.push({
          group: 'b', sourceKey: `loss:${loss.id}`, lineKind: 'LOSS', label: `Kehilangan barang ${longDate(loss.foundOn)}`, date: loss.foundOn, amount: share.amount,
          originPeriod: origin(q, periodStart), details: { link: `/potongan/kehilangan-barang/${loss.id}` },
        });
      }
    }
    for (const q of periods) {
      const shortage = await shortageAmountsOf(person.id, q);
      if (shortage.pos.net > 0) {
        // Minus POS disahkan sesudah slip periodenya ditutup: hanya selisih yang belum terpotong (spec L4e §3.2).
        const already = await db.select({ total: sql<number>`coalesce(sum(${payslipLines.amount}), 0)::int` }).from(payslipLines)
          .innerJoin(payslips, eq(payslips.id, payslipLines.payslipId))
          .where(and(eq(payslipLines.employeeId, person.id), like(payslipLines.sourceKey, `pos:${q}%`), eq(payslipLines.status, 'ACTIVE'), eq(payslips.status, 'CLOSED')));
        const done = Number(already[0]?.total ?? 0);
        const amount = shortage.pos.net - done;
        if (amount > 0) {
          candidates.push({
            group: 'b', sourceKey: done ? `pos:${q}@${periodStart}` : `pos:${q}`, lineKind: 'POS_SHORTAGE',
            label: `Minus kas POS (minus ${rupiah(shortage.pos.minus)} − lebih ${rupiah(shortage.pos.plus)})`, date: periodEndOf(q), amount,
            originPeriod: origin(q, periodStart), details: { link: '/potongan/minus-kas' },
          });
        }
      }
      for (const m of shortage.manual) {
        candidates.push({
          group: 'b', sourceKey: `manual:${m.id}`, lineKind: 'MANUAL_SHORTAGE', label: `Minus kas ${longDate(m.occurredOn)}`, date: m.occurredOn, amount: m.amount,
          originPeriod: origin(q, periodStart), details: { text: m.reason, link: '/potongan/minus-kas' },
        });
      }
    }
    const due = await db.select({
      id: otherDeductionInstallments.id, amount: otherDeductionInstallments.amount, sequence: otherDeductionInstallments.sequence, periodStart: otherDeductionInstallments.periodStart,
      total: otherDeductions.installments, createdAt: otherDeductions.createdAt, typeName: otherDeductionTypes.name, reason: otherDeductions.reason,
    }).from(otherDeductionInstallments).innerJoin(otherDeductions, eq(otherDeductions.id, otherDeductionInstallments.deductionId))
      .innerJoin(otherDeductionTypes, eq(otherDeductionTypes.id, otherDeductions.typeId))
      // Slip terakhir: seluruh sisa cicilan ikut (GAJ-82), termasuk yang terjadwal sesudah periode ini.
      .where(and(eq(otherDeductions.employeeId, person.id), eq(otherDeductions.status, 'ACTIVE'),
        last ? or(inArray(otherDeductionInstallments.periodStart, periods), gt(otherDeductionInstallments.periodStart, periodStart)) : inArray(otherDeductionInstallments.periodStart, periods),
        sql`${otherDeductionInstallments.cancelledAt} is null`));
    for (const d of due) {
      const early = d.periodStart > periodStart;
      candidates.push({
        group: 'c', sourceKey: `other:${d.id}`, lineKind: 'OTHER', label: `${d.typeName} (cicilan ${d.sequence} dari ${d.total})${early ? ', dipercepat karena slip terakhir' : ''}`,
        date: d.createdAt.toISOString().slice(0, 10), amount: d.amount, originPeriod: early ? null : origin(d.periodStart, periodStart), details: { text: d.reason, link: '/potongan/lain' },
      });
    }
    const slipped = await slippedSourceKeys(candidates.map((c) => c.sourceKey), person.id);
    deductions.push(...candidates.filter((c) => !slipped.has(c.sourceKey)));
  }

  // Sisa potongan dari slip sebelumnya (GAJ-52, 75).
  const carries = await db.select({ carry: deductionCarryovers }).from(deductionCarryovers)
    .innerJoin(payslips, eq(payslips.id, deductionCarryovers.fromPayslipId))
    .where(and(eq(deductionCarryovers.employeeId, person.id), eq(deductionCarryovers.status, 'CARRIED'), sql`${payslips.periodStart} < ${periodStart}`));
  const waived = await waivedSources(carries.map((c) => c.carry.sourceKey).filter((k): k is string => Boolean(k)));
  for (const { carry } of carries) {
    if (carry.sourceKey && waived.has(carry.sourceKey)) {
      voidCarryIds.push(carry.id);
      continue;
    }
    deductions.push({
      group: carry.deductionGroup as DeductionGroup, sourceKey: `carry:${carry.id}`, lineKind: carry.lineKind, label: carry.label, date: carry.originPeriod,
      amount: carry.amount, originPeriod: carry.originPeriod, carried: true,
      details: { carryId: carry.id, text: 'Sisa potongan dari slip sebelumnya', ...(carry.sourceKey ? { originKey: carry.sourceKey } : {}) },
    });
  }

  // Koreksi Periode Lalu dan pengembalian potongan (L4e-2): hanya di slip terbuka paling awal orang itu.
  const adjust = await pastAdjustments(person, periodStart, now);
  income.push(...adjust.income);
  deductions.push(...adjust.deductions);

  const stop = person.lastStatus?.kind === 'DEACTIVATE' && person.lastStatus.effectiveOn <= end && person.lastStatus.effectiveOn > periodStart
    ? addDays(person.lastStatus.effectiveOn, -1) : end;
  const built = buildSlip(income, deductions);
  return { computation: withoutNotice ? applyResignFine(built, end) : built, stop, last, withoutNotice, forfeitBonusIds, voidCarryIds };
}

/** Baris tersimpan (versi berlaku) slip tertutup orang ini yang kunci sumbernya cocok pola `like`. */
async function closedLinesLike(employeeId: number, pattern: string) {
  return db.select({ line: payslipLines }).from(payslipLines).innerJoin(payslips, eq(payslips.id, payslipLines.payslipId))
    .where(and(eq(payslipLines.employeeId, employeeId), like(payslipLines.sourceKey, pattern), eq(payslipLines.status, 'ACTIVE'),
      eq(payslips.status, 'CLOSED'), sql`${payslipLines.version} = ${payslips.version}`))
    .then((rows) => rows.map((r) => r.line));
}

/**
 * Sumber potongan yang sudah ditiadakan lewat keberatan (L4c, GAJ-81): cicilan Potongan Lain berstatus Ditiadakan dan
 * minus kas catat tangan Ditiadakan. Minus kas POS dihitung terpisah per periode (selisih bersih).
 */
async function waivedSources(keys: readonly string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const ids = (prefix: string) => keys.filter((k) => k.startsWith(prefix)).map((k) => Number(k.slice(prefix.length))).filter(Number.isInteger);
  const other = ids('other:');
  if (other.length) {
    const rows = await db.select({ id: otherDeductionInstallments.id }).from(otherDeductionInstallments)
      .innerJoin(otherDeductions, eq(otherDeductions.id, otherDeductionInstallments.deductionId))
      .where(and(inArray(otherDeductionInstallments.id, other), eq(otherDeductions.status, 'WAIVED')));
    for (const r of rows) out.add(`other:${r.id}`);
  }
  const manual = ids('manual:');
  if (manual.length) {
    const rows = await db.select({ id: manualCashShortages.id }).from(manualCashShortages).where(and(inArray(manualCashShortages.id, manual), eq(manualCashShortages.status, 'WAIVED')));
    for (const r of rows) out.add(`manual:${r.id}`);
  }
  return out;
}

/**
 * Koreksi Periode Lalu (GAJ-L11) dan koreksi plus keberatan (spec L4e §3.7), dihitung untuk slip terbuka paling awal
 * orang itu supaya tidak muncul di dua slip sekaligus. Dibandingkan dengan baris versi berlaku slip-slip tertutupnya.
 */
export async function pastAdjustments(person: PayrollPerson, periodStart: IsoDate, now: Date): Promise<{ income: IncomeInput[]; deductions: DeductionInput[] }> {
  const empty = { income: [], deductions: [] };
  const [earlierOpen] = await db.select({ id: payslips.id }).from(payslips)
    .where(and(eq(payslips.employeeId, person.id), eq(payslips.status, 'ESTIMATE'), lt(payslips.periodStart, periodStart))).limit(1);
  if (earlierOpen) return empty;
  const closed = await db.select().from(payslips)
    .where(and(eq(payslips.employeeId, person.id), eq(payslips.status, 'CLOSED'), lt(payslips.periodStart, periodStart))).orderBy(asc(payslips.periodStart));
  if (!closed.length) return empty;
  const income: IncomeInput[] = [];
  const deductions: DeductionInput[] = [];

  // Gaji tetap ikut dibandingkan hanya untuk periode yang paketnya hasil Pembetulan gaji periode lalu (spec L4g §3.6).
  const packages = (await loadPackages([person.id])).get(person.id) ?? [];
  for (const slip of closed) {
    const pay = await computeAttendancePay(person, slip.periodStart, now);
    if (!pay) continue;
    const stored = (await storedLines(slip)).filter((l) => l.sourceKey.startsWith('att:'));
    const corrected = await closedLinesLike(person.id, `corr:${slip.periodStart}:%`);
    const includeBase = packageOn(packages, slip.periodStart)?.origin === 'CORRECTION';
    const c = correctionInputs(slip.periodStart, pay.lines, stored, corrected.map((l) => ({ section: l.section as SlipLine['section'], lineKind: l.lineKind, amount: l.amount })), LINE_LABELS, { includeBase });
    income.push(...c.income);
    deductions.push(...c.deductions);
  }

  // Pengembalian: potongan yang Ditiadakan sesudah terpotong di slip tertutup kembali sebagai pendapatan.
  const closedDeductions = (await closedLinesLike(person.id, '%')).filter((l) => l.section === 'DEDUCTION');
  const taken = closedDeductions.filter((l) => l.taken > 0);
  const refunded = new Map<string, number>();
  for (const l of await closedLinesLike(person.id, 'refund:%')) {
    const key = l.sourceKey.slice('refund:'.length);
    refunded.set(key, (refunded.get(key) ?? 0) + l.amount);
  }
  const carryIds = taken.filter((l) => l.sourceKey.startsWith('carry:')).map((l) => Number(l.sourceKey.slice(6)));
  const carrySource = new Map<number, string | null>();
  if (carryIds.length) {
    for (const r of await db.select({ id: deductionCarryovers.id, sourceKey: deductionCarryovers.sourceKey }).from(deductionCarryovers).where(inArray(deductionCarryovers.id, carryIds))) {
      carrySource.set(r.id, r.sourceKey);
    }
  }
  const originOf = (l: { sourceKey: string }) => (l.sourceKey.startsWith('carry:') ? carrySource.get(Number(l.sourceKey.slice(6))) ?? null : l.sourceKey);
  const waived = await waivedSources(taken.map(originOf).filter((k): k is string => Boolean(k)));
  for (const l of taken) {
    const source = originOf(l);
    if (!source || !waived.has(source)) continue;
    const amount = l.taken - (refunded.get(l.sourceKey) ?? 0);
    if (amount <= 0) continue;
    income.push({
      sourceKey: `refund:${l.sourceKey}`, lineKind: l.lineKind, label: `Pengembalian ${l.label.charAt(0).toLowerCase()}${l.label.slice(1)}`, amount,
      originPeriod: l.originPeriod, details: { text: 'Potongan ini ditiadakan lewat keberatan sesudah terpotong.', originKey: source, link: '/potongan/lain' },
    });
  }
  // Minus kas POS: bila bersih periode itu turun (ditiadakan) di bawah yang sudah dipotong, selisihnya dikembalikan.
  const posByPeriod = new Map<IsoDate, { amount: number; taken: number }>();
  for (const l of closedDeductions.filter((x) => x.sourceKey.startsWith('pos:'))) {
    const q = l.sourceKey.slice(4, 14);
    const cur = posByPeriod.get(q) ?? { amount: 0, taken: 0 };
    posByPeriod.set(q, { amount: cur.amount + l.amount, taken: cur.taken + l.taken });
  }
  for (const [q, done] of posByPeriod) {
    const net = (await shortageAmountsOf(person.id, q)).pos.net;
    const amount = Math.min(done.taken, done.amount - net) - (refunded.get(`pos:${q}`) ?? 0);
    if (amount <= 0) continue;
    income.push({
      sourceKey: `refund:pos:${q}`, lineKind: 'POS_SHORTAGE', label: `Pengembalian minus kas POS periode ${longDate(q)}`, amount, originPeriod: q,
      details: { text: 'Minus kas ini ditiadakan lewat keberatan sesudah terpotong.', link: '/potongan/minus-kas' },
    });
  }
  return { income, deductions };
}

function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---- Kerangka slip, hak, penahan ----

/** Kerangka slip Perkiraan untuk semua orang periode itu (idempoten, GAJ-91). */
export async function ensureSkeletons(periodStart: IsoDate): Promise<PayrollPerson[]> {
  const people = await loadPeriodPeople(periodStart, periodEndOf(periodStart));
  if (periodStart < PAYSLIP_FROM || !people.length) return people;
  await db.insert(payslips).values(people.map((p) => ({ employeeId: p.id, periodStart }))).onConflictDoNothing();
  return people;
}

/** Hak lihat slip (GAJ-46): slip jabatan bertanda "Gaji hanya terlihat Pemilik dan GM" tidak dikirim ke selain Pemilik/GM. */
export function canSeeSlip(actor: Actor | null, person: Pick<PayrollPerson, 'ownerOnly' | 'target'>): boolean {
  if (!actor) return false;
  if (person.ownerOnly && !actor.fullAccess) return false;
  return Boolean(actor.fullAccess) || can(actor, 'payslip.view', person.target);
}

/** Pelaku boleh menutup slip orang ini (spec L4e §3.4, §9 butir 6); null = boleh. */
async function closeProblem(actor: Actor | null, person: PayrollPerson): Promise<string | null> {
  if (!actor || !canSeeSlip(actor, person)) return 'Slip ini tidak ditemukan.';
  if (!actor.fullAccess && !can(actor, 'payslip.close', person.target)) return 'Anda tidak berhak menutup slip.';
  if (person.ownerOnly && !actor.fullAccess) return 'Slip ini hanya ditutup Pemilik atau GM.';
  if (actor.personId === person.id) {
    const position = (await getOrgLookup()).positions.find((p) => p.id === actor.positionId);
    if (position?.name.trim().toLowerCase() !== 'gm') return 'Slip Anda sendiri ditutup Pemilik lain atau GM.';
  }
  return null;
}

async function holdsOf(people: PayrollPerson[], periodStart: IsoDate, hasSalary: Map<number, boolean>): Promise<Map<number, SlipHold[]>> {
  const facts = await slipHoldFacts(people.map((p) => p.id), periodStart, periodEndOf(periodStart));
  const empty = { outsideReviews: [], clarifications: [], overtimeClaims: [] };
  // Penahan 5 (L4e-2): slip terakhir menunggu bonus Menunggu/Ditahan diputus, karena tidak ada slip sesudahnya.
  // Penahan 6 (usulan berhenti tanpa pemberitahuan) tidak ada: di HRIS ini hanya Pemilik/GM yang menetapkannya langsung (L2c).
  const lastIds = people.filter((p) => lastSlipOf(p, periodStart)).map((p) => p.id);
  const waiting = lastIds.length
    ? await db.select({ employeeId: bonusEntries.employeeId, on: bonusEntries.occurredOn }).from(bonusEntries)
      .where(and(inArray(bonusEntries.employeeId, lastIds), inArray(bonusEntries.status, ['PENDING', 'HELD']), lte(bonusEntries.periodStart, periodStart)))
    : [];
  return new Map(people.map((p) => [p.id, holdsFrom(facts.get(p.id) ?? empty, hasSalary.get(p.id) ?? true, p.id, waiting.filter((w) => w.employeeId === p.id).map((w) => w.on))]));
}

export type SlipRow = typeof payslips.$inferSelect;

async function slipRowsOf(periodStart: IsoDate): Promise<Map<number, SlipRow>> {
  const rows = await db.select().from(payslips).where(eq(payslips.periodStart, periodStart));
  return new Map(rows.map((r) => [r.employeeId, r]));
}

async function windowOf(periodStart: IsoDate, now: Date) {
  const openDay = await openDayOf(periodStart);
  const opensAt = closeOpensAt(periodStart, openDay);
  return { opensAt: opensAt.toISOString(), opensText: wibTime(opensAt), open: closeWindowOpen(periodStart, openDay, now, payslipTestMode()), testMode: payslipTestMode() };
}

// ---- Layar Periode Slip (GAJ-L08) ----

export async function periodsScreen(actor: Actor | null, now: Date = new Date()) {
  if (!actor || !(actor.fullAccess || hasAction(actor, 'payslip.view') || hasAction(actor, 'payslip.view_periods'))) return null;
  const current = periodStartOf(todayWib(now));
  const starts: IsoDate[] = [];
  for (let p = current; p >= PAYSLIP_FROM; p = addPeriods(p, -1)) starts.push(p);
  const counts = starts.length ? await db.select({ periodStart: payslips.periodStart, status: payslips.status, n: sql<number>`count(*)::int` }).from(payslips)
    .where(inArray(payslips.periodStart, starts)).groupBy(payslips.periodStart, payslips.status) : [];
  // Dibayar = pembayaran berlaku (L4f, spec L4f §2); slip Rp0 Dibayar tanpa uang ikut terhitung.
  const paidRows = starts.length ? await db.select({ periodStart: payslips.periodStart, n: sql<number>`count(*)::int` }).from(payslipPayments)
    .innerJoin(payslips, eq(payslips.id, payslipPayments.payslipId))
    .where(and(inArray(payslips.periodStart, starts), eq(payslipPayments.status, 'ACTIVE'))).groupBy(payslips.periodStart) : [];
  const rows = [];
  for (const start of starts) {
    const of = (s: SlipStatus) => Number(counts.find((c) => c.periodStart === start && c.status === s)?.n ?? 0);
    const estimate = of('ESTIMATE');
    const closed = of('CLOSED');
    const paid = Number(paidRows.find((r) => r.periodStart === start)?.n ?? 0);
    const win = await windowOf(start, now);
    const status = start === current && closed === 0 ? 'Berjalan'
      : estimate === 0 && closed > 0 && paid === closed ? 'Lunas'
        : estimate === 0 && closed > 0 ? 'Semua ditutup' : closed > 0 ? 'Sebagian ditutup' : start === current ? 'Berjalan' : 'Belum ditutup';
    rows.push({ start, label: periodLabel(start), status, estimate, closed, paid, opensText: win.opensText });
  }
  return { rows, canOpen: Boolean(actor.fullAccess) || hasAction(actor, 'payslip.view'), canSummary: Boolean(actor.fullAccess) || hasAction(actor, 'payroll_summary.view'), from: longDate(PAYSLIP_FROM) };
}

// ---- Satu periode (GAJ-L28) ----

export async function periodScreen(actor: Actor | null, periodStart: IsoDate, now: Date = new Date()) {
  if (!actor || !(actor.fullAccess || hasAction(actor, 'payslip.view'))) return null;
  if (periodStart < PAYSLIP_FROM || periodStart > periodStartOf(todayWib(now)) || periodStartOf(periodStart) !== periodStart) return null;
  const people = (await ensureSkeletons(periodStart)).filter((p) => canSeeSlip(actor, p));
  const slips = await slipRowsOf(periodStart);
  const closedIds = [...slips.values()].filter((s) => s.status === 'CLOSED').map((s) => s.id);
  const paidKinds = new Map((closedIds.length ? await db.select({ id: payslipPayments.payslipId, kind: payslipPayments.kind }).from(payslipPayments)
    .where(and(inArray(payslipPayments.payslipId, closedIds), eq(payslipPayments.status, 'ACTIVE'))) : []).map((r) => [r.id, r.kind]));
  const computed = new Map<number, SlipResult | null>();
  for (const p of people) if (slips.get(p.id)?.status !== 'CLOSED') computed.set(p.id, await computeSlip(p, periodStart, now));
  const holds = await holdsOf(people.filter((p) => slips.get(p.id)?.status !== 'CLOSED'), periodStart, new Map([...computed].map(([id, r]) => [id, r != null])));
  const win = await windowOf(periodStart, now);
  const rows = people.map((p) => {
    const slip = slips.get(p.id)!;
    const closed = slip.status === 'CLOSED';
    const result = computed.get(p.id);
    const own = holds.get(p.id) ?? [];
    return {
      slipId: slip.id, employeeId: p.id, name: p.name, positionName: closed ? slip.positionName ?? p.positionName : p.positionName,
      branchName: closed ? slip.branchName ?? p.branchName : p.branchName, status: slip.status as SlipStatus,
      statusLabel: paidKinds.get(slip.id) === 'NO_MONEY' ? 'Dibayar tanpa uang' : paidKinds.has(slip.id) ? 'Dibayar' : SLIP_STATUS_LABELS[slip.status as SlipStatus],
      paid: paidKinds.has(slip.id), number: slip.number, version: slip.version,
      income: closed ? slip.income : result?.computation.income ?? null, taken: closed ? slip.taken : result?.computation.taken ?? null,
      net: closed ? slip.net : result?.computation.net ?? null, carried: closed ? slip.carried ?? 0 : result?.computation.carried ?? 0,
      lastSlip: lastSlipOf(p, periodStart),
      holds: closed ? [] : own, ready: !closed && !own.length,
    };
  }).sort((a, b) => a.branchName.localeCompare(b.branchName) || a.name.localeCompare(b.name));
  const steps = await db.select().from(payslipSteps).where(eq(payslipSteps.periodStart, periodStart)).orderBy(desc(payslipSteps.createdAt)).limit(200);
  const names = await accountNames();
  const visibleSlipIds = new Set(rows.map((r) => r.slipId));
  const canClose = Boolean(actor.fullAccess) || hasAction(actor, 'payslip.close');
  // Tab Koreksi Periode Lalu (GAJ-L11): baris koreksi dan pengembalian yang masuk slip periode ini. Tanpa tombol ubah angka.
  const isAdjustment = (key: string) => key.startsWith('corr:') || key.startsWith('refund:');
  const corrections: { slipId: number; name: string; label: string; amount: number; plus: boolean; closed: boolean }[] = [];
  for (const p of people) {
    const slip = slips.get(p.id)!;
    const lines = slip.status === 'CLOSED'
      ? (await storedLines(slip)).filter((l) => isAdjustment(l.sourceKey))
      : (computed.get(p.id)?.computation.lines ?? []).filter((l) => isAdjustment(l.sourceKey));
    for (const l of lines) corrections.push({ slipId: slip.id, name: p.name, label: l.label, amount: l.amount, plus: l.section === 'INCOME', closed: slip.status === 'CLOSED' });
  }
  return {
    period: { start: periodStart, label: periodLabel(periodStart) },
    window: win,
    counts: {
      estimate: rows.filter((r) => r.status === 'ESTIMATE').length, held: rows.filter((r) => r.holds.length).length, closed: rows.filter((r) => r.status === 'CLOSED').length,
      paid: rows.filter((r) => r.paid).length,
    },
    rows,
    corrections,
    history: steps.filter((s) => s.payslipId == null || visibleSlipIds.has(s.payslipId)).map((s) => ({
      id: s.id, action: s.action, at: wibTime(s.createdAt), by: names.get(s.actorAccountId) ?? '-', reason: s.reason,
      text: stepText(s.action, s.summary as Record<string, unknown> | null),
    })),
    can: { close: canClose && win.open },
  };
}

function stepText(action: string, summary: Record<string, unknown> | null): string {
  const who = summary?.name ? ` ${String(summary.name)}` : '';
  if (action === 'CLOSE') return `Menutup slip${who} ${String(summary?.number ?? '')}: bersih ${rupiah(Number(summary?.net ?? 0))}`;
  if (action === 'EARLY_CLOSE') return `Menutup lebih cepat slip terakhir${who} ${String(summary?.number ?? '')}: bersih ${rupiah(Number(summary?.net ?? 0))}`;
  if (action === 'PRINT') return `Mencetak slip${who} ${String(summary?.number ?? '')}`;
  if (action === 'REOPEN') return `Membuka kembali slip${who} ${String(summary?.number ?? '')} (versi ${String(summary?.version ?? '')})`;
  if (action === 'REOPEN_REQUEST') return `Meminta buka kembali slip${who} ${String(summary?.number ?? '')}`;
  if (action === 'PAY') return `Menandai Dibayar slip${who} ${String(summary?.number ?? '')}: ${rupiah(Number(summary?.net ?? 0))} dari ${String(summary?.source ?? '')}`;
  if (action === 'PAY_CANCEL') return `Membatalkan pembayaran slip${who} ${String(summary?.number ?? '')}: ${rupiah(Number(summary?.net ?? 0))}`;
  if (action === 'PAY_ZERO') return `Slip${who} ${String(summary?.number ?? '')} bersih Rp0: Dibayar tanpa uang`;
  if (action === 'TRANSFER_VIEW') return `Membuka Daftar Transfer (${String(summary?.count ?? 0)} orang)`;
  if (action === 'TRANSFER_DOWNLOAD') return `Mengunduh Daftar Transfer (${String(summary?.count ?? 0)} orang)`;
  if (action === 'TOTALS_DOWNLOAD') return `Mengunduh Total Diterima per Orang (${String(summary?.count ?? 0)} orang, sejak ${String(summary?.from ?? '')})`;
  return `Mencetak ${String(summary?.count ?? 0)} slip sekaligus`;
}

// ---- Slip (GAJ-L29) ----

export type SlipView = {
  slipId: number; employeeId: number; name: string; positionName: string; branchName: string; period: { start: IsoDate; label: string };
  status: SlipStatus; statusLabel: string; number: string | null; version: number;
  closedAt: string | null; closedBy: string | null; objectionUntil: string | null;
  income: SlipLine[]; deductions: { group: DeductionGroup; label: string; lines: SlipLine[] }[];
  totals: { income: number; taken: number; net: number; carried: number };
};

export async function loadSlip(id: number) {
  const [slip] = await db.select().from(payslips).where(eq(payslips.id, id));
  if (!slip) return null;
  const person = (await loadPeriodPeople(slip.periodStart, periodEndOf(slip.periodStart))).find((p) => p.id === slip.employeeId) ?? null;
  return person ? { slip, person } : null;
}

async function storedLines(slip: SlipRow): Promise<SlipLine[]> {
  const rows = await db.select().from(payslipLines).where(and(eq(payslipLines.payslipId, slip.id), eq(payslipLines.version, slip.version), eq(payslipLines.status, 'ACTIVE')))
    .orderBy(asc(payslipLines.sortOrder));
  return rows.map((r) => ({
    section: r.section as SlipLine['section'], group: (r.deductionGroup as DeductionGroup | null) ?? null, sourceKey: r.sourceKey, lineKind: r.lineKind, label: r.label,
    originPeriod: r.originPeriod, amount: r.amount, taken: r.taken, remaining: r.remaining, details: (r.details ?? {}) as SlipLineDetails,
  }));
}

function toView(slip: SlipRow, person: PayrollPerson, lines: SlipLine[], totals: SlipView['totals'], names: Map<number, string>): SlipView {
  const closed = slip.status === 'CLOSED';
  const groups: DeductionGroup[] = ['a', 'b', 'c', 'd'];
  return {
    slipId: slip.id, employeeId: person.id, name: person.name, positionName: closed ? slip.positionName ?? person.positionName : person.positionName,
    branchName: closed ? slip.branchName ?? person.branchName : person.branchName, period: { start: slip.periodStart, label: periodLabel(slip.periodStart) },
    status: slip.status as SlipStatus, statusLabel: SLIP_STATUS_LABELS[slip.status as SlipStatus], number: slip.number, version: slip.version,
    closedAt: slip.closedAt ? wibTime(slip.closedAt) : null, closedBy: slip.closedByAccountId ? names.get(slip.closedByAccountId) ?? '-' : null,
    objectionUntil: slip.objectionUntil ? wibTime(slip.objectionUntil) : null,
    income: lines.filter((l) => l.section === 'INCOME'),
    deductions: groups.map((g) => ({ group: g, label: GROUP_LABELS[g], lines: lines.filter((l) => l.section === 'DEDUCTION' && l.group === g) })),
    totals,
  };
}

/** Isi slip: tersimpan bila Ditutup, dihitung bila Perkiraan. */
export async function slipContent(slip: SlipRow, person: PayrollPerson, now: Date) {
  const names = await accountNames();
  if (slip.status === 'CLOSED') {
    const lines = await storedLines(slip);
    return { view: toView(slip, person, lines, { income: slip.income ?? 0, taken: slip.taken ?? 0, net: slip.net ?? 0, carried: slip.carried ?? 0 }, names), hasSalary: true };
  }
  const result = await computeSlip(person, slip.periodStart, now);
  const c = result?.computation ?? { lines: [], income: 0, taken: 0, net: 0, carried: 0 };
  return { view: toView(slip, person, c.lines, { income: c.income, taken: c.taken, net: c.net, carried: c.carried }, names), hasSalary: result != null };
}

/** Versi lama slip yang dibuka kembali (baris Diganti), hanya baca (Slip Saya, spec L4g §3.3). Null bila versi itu tidak ada. */
export async function slipVersionView(slip: SlipRow, person: PayrollPerson, version: number): Promise<SlipView | null> {
  // Slip Ditutup versi v menyimpan versi < v sebagai Diganti; slip yang sedang dibetulkan (Perkiraan) juga versi v-nya sendiri.
  if (version > slip.version || (slip.status === 'CLOSED' && version === slip.version)) return null;
  const rows = await db.select().from(payslipLines)
    .where(and(eq(payslipLines.payslipId, slip.id), eq(payslipLines.version, version), eq(payslipLines.status, 'REPLACED'))).orderBy(asc(payslipLines.sortOrder));
  if (!rows.length) return null;
  const lines: SlipLine[] = rows.map((r) => ({
    section: r.section as SlipLine['section'], group: (r.deductionGroup as DeductionGroup | null) ?? null, sourceKey: r.sourceKey, lineKind: r.lineKind, label: r.label,
    originPeriod: r.originPeriod, amount: r.amount, taken: r.taken, remaining: r.remaining, details: (r.details ?? {}) as SlipLineDetails,
  }));
  const income = lines.filter((l) => l.section === 'INCOME').reduce((s, l) => s + l.amount, 0);
  const deductions = lines.filter((l) => l.section === 'DEDUCTION');
  const taken = deductions.reduce((s, l) => s + l.taken, 0);
  const carried = deductions.reduce((s, l) => s + l.remaining, 0);
  const old: SlipRow = { ...slip, version, status: 'CLOSED', closedAt: null, closedByAccountId: null, objectionUntil: null };
  return toView(old, person, lines, { income, taken, net: Math.max(0, income - taken), carried }, new Map());
}

export async function slipScreen(actor: Actor | null, id: number, now: Date = new Date()) {
  const loaded = await loadSlip(id);
  if (!loaded || !canSeeSlip(actor, loaded.person)) return null;
  const { slip, person } = loaded;
  const { view, hasSalary } = await slipContent(slip, person, now);
  const holds = slip.status === 'CLOSED' ? [] : (await holdsOf([person], slip.periodStart, new Map([[person.id, hasSalary]]))).get(person.id) ?? [];
  const win = await windowOf(slip.periodStart, now);
  const problem = await closeProblem(actor, person);
  return {
    slip: view, holds, window: win, computedAt: now.toISOString(),
    can: { close: slip.status === 'ESTIMATE' && !problem && win.open && !holds.length, print: slip.status === 'CLOSED' },
    closeBlocked: slip.status !== 'ESTIMATE' ? null : problem ?? (!win.open ? `Tombol Tutup aktif mulai ${win.opensText}.` : holds.length ? 'Slip tertahan; putuskan dulu urusannya.' : null),
  };
}

/** Tab Slip di Gaji Seseorang: daftar slip orang itu. */
export async function personSlipsScreen(actor: Actor | null, employeeId: number, now: Date = new Date()) {
  if (!actor || !(actor.fullAccess || hasAction(actor, 'payslip.view'))) return null;
  const current = periodStartOf(todayWib(now));
  const person = (await loadPeriodPeople(current, periodEndOf(current))).find((p) => p.id === employeeId)
    ?? (await loadPeriodPeople(addPeriods(current, -1), periodEndOf(addPeriods(current, -1)))).find((p) => p.id === employeeId);
  if (!person || !canSeeSlip(actor, person)) return null;
  await ensureSkeletons(current);
  const rows = await db.select().from(payslips).where(eq(payslips.employeeId, employeeId)).orderBy(desc(payslips.periodStart));
  return {
    person: { id: person.id, name: person.name },
    rows: rows.map((r) => ({ id: r.id, period: periodLabel(r.periodStart), status: SLIP_STATUS_LABELS[r.status as SlipStatus], number: r.number, net: r.net, version: r.version })),
  };
}

// ---- Tutup slip (GAJ-L30; spec L4e §3.5) ----

class Conflict extends Error {}

export type CloseOutcome = { slipId: number; name: string; result: 'CLOSED' | 'HELD' | 'FAILED'; text: string };

/** Tutup lebih cepat slip terakhir (GAJ-96): Pemilik/GM, mulai 00.00 sesudah hari terakhir bekerja; null = boleh. */
export function earlyCloseProblem(actor: Actor, person: PayrollPerson, periodStart: IsoDate, now: Date): string | null {
  if (!actor.fullAccess) return 'Tutup lebih cepat hanya oleh Pemilik atau GM.';
  if (!lastSlipOf(person, periodStart)) return 'Tutup lebih cepat hanya untuk slip terakhir orang yang berhenti.';
  const from = person.lastStatus!.effectiveOn;
  if (todayWib(now) < from) return `Tutup lebih cepat bisa mulai ${longDate(from)} pukul 00.00 (sesudah hari terakhir bekerja).`;
  return null;
}

async function closeOne(actor: Actor, slipId: number, announce: ChangeAnnounce, now: Date, early: string | null = null): Promise<CloseOutcome> {
  const loaded = await loadSlip(slipId);
  if (!loaded) return { slipId, name: `#${slipId}`, result: 'FAILED', text: 'Slip tidak ditemukan.' };
  const { slip, person } = loaded;
  const out = (result: CloseOutcome['result'], text: string): CloseOutcome => ({ slipId, name: person.name, result, text });
  const problem = await closeProblem(actor, person);
  if (problem) return out('FAILED', problem);
  if (slip.status === 'CLOSED') return out('FAILED', await closedText(slip));
  if (early != null) {
    const earlyProblem = earlyCloseProblem(actor, person, slip.periodStart, now) ?? reasonProblem(early);
    if (earlyProblem) return out('FAILED', earlyProblem);
  } else {
    const win = await windowOf(slip.periodStart, now);
    if (!win.open) return out('FAILED', `Tombol Tutup aktif mulai ${win.opensText}.`);
  }
  const result = await computeSlip(person, slip.periodStart, now);
  const holds = (await holdsOf([person], slip.periodStart, new Map([[person.id, result != null]]))).get(person.id) ?? [];
  if (holds.length || !result) return out('HELD', holds.map((h) => h.text).join('; ') || 'Belum ada gaji berlaku.');
  const c = result.computation;
  try {
    const closedNumber = await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(payslips).where(eq(payslips.id, slip.id)).for('update');
      if (!locked || locked.status !== 'ESTIMATE') throw new Conflict(locked ? await closedText(locked) : 'Slip tidak ditemukan.');
      await lockFunds(tx);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('hris.payslip_number'))`);
      let number = locked.number;
      if (!number) {
        const prefix = slipNumber(locked.periodStart, 1).slice(0, -4);
        const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(payslips).where(like(payslips.number, `${prefix}%`));
        number = slipNumber(locked.periodStart, Number(row?.n ?? 0) + 1);
      }
      const version = locked.version + 1;
      const place = await placeOn(person.id, result.stop);
      const closedAt = now;
      await tx.update(payslips).set({
        status: 'CLOSED', number, version, branchId: place.branchId, branchName: place.branchName, positionName: place.positionName,
        income: c.income, taken: c.taken, net: c.net, carried: result.last ? 0 : c.carried, lastSlip: result.last,
        closedAt, closedByAccountId: actor.accountId, objectionUntil: objectionUntil(closedAt),
      }).where(eq(payslips.id, locked.id));
      if (c.lines.length) {
        await tx.insert(payslipLines).values(c.lines.map((l, index) => ({
          payslipId: locked.id, version, employeeId: person.id, section: l.section, deductionGroup: l.group, sourceKey: l.sourceKey, lineKind: l.lineKind,
          label: l.label, originPeriod: l.originPeriod, amount: l.amount, taken: l.taken, remaining: l.remaining, details: l.details, sortOrder: index + 1,
        })));
      }
      // Sisa lama terambil → Terpotong; yang tidak tertampung → sisa baru Dibawa (GAJ-94 langkah 8).
      for (const l of c.lines.filter((x) => x.details.carryId != null)) {
        const done = await tx.update(deductionCarryovers).set({ status: 'TAKEN', takenInPayslipId: locked.id })
          .where(and(eq(deductionCarryovers.id, l.details.carryId!), eq(deductionCarryovers.status, 'CARRIED'))).returning({ id: deductionCarryovers.id });
        if (!done.length) throw new Conflict('Sisa potongan berubah sejak dihitung. Muat ulang, lalu ulangi.');
      }
      const leftovers = c.lines.filter((l) => l.section === 'DEDUCTION' && l.remaining > 0);
      const lastLeft = result.last ? lastSlipLeftovers(c.lines) : null;
      if (lastLeft) {
        // Slip terakhir (GAJ-82): (a) Tidak tertagih, tidak dibawa; (b), (c) menjadi Piutang Lain.
        if (lastLeft.receivables.length) {
          await tx.insert(otherReceivables).values(lastLeft.receivables.map((r) => ({ employeeId: person.id, payslipId: locked.id, deductionGroup: r.group, amount: r.amount })));
        }
      } else if (leftovers.length) {
        await tx.insert(deductionCarryovers).values(leftovers.map((l) => ({
          employeeId: person.id, fromPayslipId: locked.id, deductionGroup: l.group!, lineKind: l.lineKind, label: l.label,
          originPeriod: l.originPeriod ?? locked.periodStart, amount: l.remaining,
          sourceKey: l.details.originKey ?? (l.sourceKey.startsWith('carry:') ? null : l.sourceKey),
        })));
      }
      // Sisa dari sumber yang ditiadakan lewat keberatan: tidak diambil lagi.
      if (result.voidCarryIds.length) {
        await tx.update(deductionCarryovers).set({ status: 'CANCELLED' })
          .where(and(inArray(deductionCarryovers.id, result.voidCarryIds), eq(deductionCarryovers.status, 'CARRIED')));
      }
      // Bonus → Masuk slip (dana terpesan berubah menjadi mutasi keluar di bawah).
      const bonusIds = c.lines.flatMap((l) => l.details.bonusIds ?? []);
      if (bonusIds.length) {
        const moved = await tx.update(bonusEntries).set({ status: 'IN_SLIP', payslipId: locked.id })
          .where(and(inArray(bonusEntries.id, bonusIds), eq(bonusEntries.status, 'APPROVED'))).returning({ id: bonusEntries.id });
        if (moved.length !== bonusIds.length) throw new Conflict('Bonus orang ini berubah sejak dihitung. Muat ulang, lalu ulangi.');
      }
      // Berhenti tanpa pemberitahuan (GAJ-58): bonus yang belum masuk slip Hangus; dana terpesan ikut lepas.
      if (result.forfeitBonusIds.length) {
        const gone = await tx.update(bonusEntries).set({ status: 'FORFEITED', payslipId: locked.id })
          .where(and(inArray(bonusEntries.id, result.forfeitBonusIds), eq(bonusEntries.status, 'APPROVED'))).returning({ id: bonusEntries.id });
        if (gone.length !== result.forfeitBonusIds.length) throw new Conflict('Bonus orang ini berubah sejak dihitung. Muat ulang, lalu ulangi.');
      }
      // Mutasi Dana Disiplin dan Dana Tidak Hadir (GAJ-87, 88).
      const movements = fundMovements(c.lines, number);
      if (movements.length) {
        await tx.insert(fundEntries).values(movements.map((m) => ({
          fund: m.fund, kind: 'SLIP', amount: m.amount, branchId: place.branchId, periodStart: locked.periodStart, reason: m.reason,
          payslipId: locked.id, createdByAccountId: actor.accountId,
        })));
      }
      const summary = {
        number, name: person.name, net: c.net, lines: c.lines.length, carried: lastLeft ? 0 : c.carried, version,
        funds: movements.map((m) => ({ fund: m.fund, amount: m.amount })), bonuses: bonusIds.length,
        ...(lastLeft ? { lastSlip: true, uncollectible: lastLeft.uncollectible, receivables: lastLeft.receivables, forfeited: result.forfeitBonusIds.length } : {}),
      };
      await tx.insert(payslipSteps).values({ payslipId: locked.id, periodStart: locked.periodStart, action: early != null ? 'EARLY_CLOSE' : 'CLOSE', reason: early, summary, actorAccountId: actor.accountId });
      // Slip bersih Rp0 langsung Dibayar tanpa uang (GAJ-102, spec L4f §3.2): tidak masuk Jadwal Bayar.
      if (c.net === 0) {
        await tx.insert(payslipPayments).values({ payslipId: locked.id, kind: 'NO_MONEY', amount: 0, moneyDate: todayWib(closedAt), paidByAccountId: actor.accountId });
        await tx.insert(payslipSteps).values({ payslipId: locked.id, periodStart: locked.periodStart, action: 'PAY_ZERO', summary: { number, name: person.name, net: 0 }, actorAccountId: actor.accountId });
      }
      await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'payslip', entityId: locked.id, action: early != null ? 'payslip.early_close' : 'payslip.close', before: { status: 'ESTIMATE' }, after: summary, reason: early ?? undefined });
      const account = (await activeHrisAccounts([person.id])).get(person.id);
      if (account) {
        await notify(tx, [account], {
          kind: 'payslip.closed', title: `Slip gaji periode ${periodLabel(locked.periodStart)} sudah ditutup.`,
          body: `Gaji bersih ${rupiah(c.net)}. Rinciannya ada di Pendapatan Saya.`, entity: 'payslip', entityId: locked.id, link: `/pendapatan/slip/${locked.id}`,
        }, actor.accountId);
      }
      if (actor.personId === person.id) await announce(tx, actor.accountId, { what: `menutup slip gajinya sendiri ${number}`, link: `/gaji/slip/${locked.id}`, entity: 'payslip', entityId: locked.id });
      return number;
    });
    return out('CLOSED', `${closedNumber}: bersih ${rupiah(c.net)}`);
  } catch (error) {
    if (error instanceof Conflict) return out('FAILED', error.message);
    throw error;
  }
}

async function closedText(slip: SlipRow): Promise<string> {
  const by = slip.closedByAccountId ? (await accountNames()).get(slip.closedByAccountId) ?? 'orang lain' : 'orang lain';
  return `Sudah ditutup oleh ${by}${slip.closedAt ? ` pukul ${wibTime(slip.closedAt)}` : ''}.`;
}

/** Cabang dan jabatan pada hari terakhir bekerja di periode itu (GAJ-40). */
async function placeOn(employeeId: number, date: IsoDate) {
  const timeline = (await loadTimelines()).find((t) => t.employeeId === employeeId);
  const placement = timeline ? placementOn(timeline.placements, date) : null;
  const org = await getOrgLookup();
  return {
    branchId: placement?.branchId ?? null,
    branchName: org.branches.find((b) => b.id === placement?.branchId)?.name ?? '-',
    positionName: org.positions.find((p) => p.id === placement?.positionId)?.name ?? '-',
  };
}

/** Tutup satu slip atau semua yang siap di satu periode; tiap slip satu langkah tersendiri (GAJ-92). */
export async function closeSlips(
  actor: Actor | null, input: { slipIds: number[] | null; periodStart: IsoDate | null; early?: string | null }, announce: ChangeAnnounce, now: Date = new Date(),
): Promise<ServiceResult<{ outcomes: CloseOutcome[] }>> {
  if (!actor || !(actor.fullAccess || hasAction(actor, 'payslip.close'))) return fail(403, 'Anda tidak berhak menutup slip.');
  if (input.early != null) {
    // Tutup lebih cepat: satu slip terakhir, oleh Pemilik/GM, dengan alasan (GAJ-96).
    if (!actor.fullAccess || !hasAction(actor, 'payslip.early_close')) return fail(403, 'Tutup lebih cepat hanya oleh Pemilik atau GM.');
    if (input.slipIds?.length !== 1) return fail(400, 'Tutup lebih cepat satu slip saja.');
    return { ok: true, data: { outcomes: [await closeOne(actor, input.slipIds[0], announce, now, input.early.trim())] } };
  }
  let ids = input.slipIds ?? [];
  if (!input.slipIds) {
    if (!input.periodStart) return fail(400, 'Pilih slip atau periode.');
    const screen = await periodScreen(actor, input.periodStart, now);
    if (!screen) return fail(404, 'Periode tidak ditemukan.');
    ids = screen.rows.filter((r) => r.status === 'ESTIMATE').map((r) => r.slipId);
  }
  if (!ids.length) return fail(409, 'Tidak ada slip Perkiraan yang bisa ditutup.');
  const outcomes: CloseOutcome[] = [];
  for (const id of ids) outcomes.push(await closeOne(actor, id, announce, now));
  const failed = outcomes.filter((o) => o.result === 'FAILED');
  if (failed.length && ids.length > 1) {
    await db.transaction((tx) => announce(tx, actor.accountId, { what: `menutup slip: ${failed.length} gagal (${failed.map((f) => f.name).join(', ')})`, link: '/gaji/periode', entity: 'payslip', entityId: failed[0].slipId }));
  }
  return { ok: true, data: { outcomes } };
}

/** Pratinjau langkah 1–2 Tutup Slip: yang siap, yang tertahan, dan hal yang perlu diketahui. */
export async function closePreviewScreen(actor: Actor | null, periodStart: IsoDate, slipId: number | null, now: Date = new Date()) {
  const screen = await periodScreen(actor, periodStart, now);
  if (!screen) return null;
  const rows = screen.rows.filter((r) => r.status === 'ESTIMATE' && (slipId == null || r.slipId === slipId));
  if (slipId != null && !rows.length) return null;
  const ready = rows.filter((r) => r.ready);
  return {
    period: screen.period, window: screen.window, can: screen.can,
    ready: ready.map((r) => ({ slipId: r.slipId, name: r.name, branchName: r.branchName, net: r.net ?? 0, carried: r.carried, lastSlip: r.lastSlip })),
    held: rows.filter((r) => !r.ready).map((r) => ({ slipId: r.slipId, name: r.name, holds: r.holds })),
    totalNet: ready.reduce((s, r) => s + (r.net ?? 0), 0),
    zeroNet: ready.filter((r) => (r.net ?? 0) === 0).map((r) => r.name),
    withCarry: ready.filter((r) => r.carried > 0).map((r) => ({ name: r.name, carried: r.carried })),
    // Keberatan slip Menunggu tidak menahan slip, hanya diberitahukan di langkah Periksa (spec L4g §3.5).
    objectionsWaiting: await pendingObjectionsOn(ready.map((r) => r.slipId)),
    single: slipId != null,
  };
}

// ---- Cetakan (GAJ-L32) ----

export async function printScreen(actor: Actor | null, input: { slipId: number | null; periodStart: IsoDate | null }, now: Date = new Date()) {
  if (!actor || !(actor.fullAccess || hasAction(actor, 'payslip.view'))) return null;
  let slips: { slip: SlipRow; person: PayrollPerson }[] = [];
  if (input.slipId != null) {
    const loaded = await loadSlip(input.slipId);
    if (!loaded || !canSeeSlip(actor, loaded.person) || loaded.slip.status !== 'CLOSED') return null;
    slips = [loaded];
  } else if (input.periodStart) {
    const people = (await loadPeriodPeople(input.periodStart, periodEndOf(input.periodStart))).filter((p) => canSeeSlip(actor, p));
    const rows = await slipRowsOf(input.periodStart);
    slips = people.map((p) => ({ slip: rows.get(p.id)!, person: p })).filter((s) => s.slip?.status === 'CLOSED')
      .sort((a, b) => (a.slip.number ?? '').localeCompare(b.slip.number ?? ''));
  }
  if (!slips.length) return null;
  const views: SlipView[] = [];
  for (const s of slips) views.push((await slipContent(s.slip, s.person, now)).view);
  // Tiap cetak dicatat (GAJ-97).
  await db.transaction(async (tx) => {
    if (slips.length === 1 && input.slipId != null) {
      await tx.insert(payslipSteps).values({ payslipId: slips[0].slip.id, periodStart: slips[0].slip.periodStart, action: 'PRINT', summary: { number: slips[0].slip.number, name: slips[0].person.name }, actorAccountId: actor.accountId });
    } else {
      await tx.insert(payslipSteps).values({ payslipId: null, periodStart: input.periodStart!, action: 'PRINT_MANY', summary: { count: slips.length }, actorAccountId: actor.accountId });
    }
  });
  return { slips: views, printedAt: wibTime(now) };
}

// ---- Mesin terjadwal (spec L4e §6) ----

/** 04.55 WIB: kerangka slip periode berjalan dan periode lalu. */
export async function runPayslipSkeleton(now: Date = new Date()) {
  const current = periodStartOf(todayWib(now));
  const made: Record<string, number> = {};
  for (const p of [addPeriods(current, -1), current]) {
    if (p < PAYSLIP_FROM) continue;
    made[p] = (await ensureSkeletons(p)).length;
  }
  return { periods: made };
}

/** 07.00 WIB mulai batas tutup: pengingat harian selama periode masih punya slip Perkiraan (GAJ-92). */
export async function runPayslipReminder(now: Date = new Date()) {
  const current = periodStartOf(todayWib(now));
  const sent: { period: IsoDate; estimate: number }[] = [];
  for (let p = addPeriods(current, -1); p >= PAYSLIP_FROM; p = addPeriods(p, -1)) {
    if (now.getTime() < closeOpensAt(p, await openDayOf(p)).getTime()) continue;
    const people = await ensureSkeletons(p);
    const slips = await slipRowsOf(p);
    const open = people.filter((person) => slips.get(person.id)?.status === 'ESTIMATE');
    if (!open.length) continue;
    const salary = new Map<number, boolean>();
    for (const person of open) salary.set(person.id, (await computeAttendancePay(person, p, now)) != null);
    const holds = await holdsOf(open, p, salary);
    const held = open.filter((person) => (holds.get(person.id) ?? []).length);
    const recipients = await activeHrisAccounts(await listEmployeesWithAnyAction(['payslip.close']));
    const heldText = held.slice(0, 10).map((person) => `${person.name}: ${(holds.get(person.id) ?? []).map((h) => `${h.text} → ${h.resolver}`).join('; ')}`).join('\n');
    await db.transaction((tx) => notify(tx, [...recipients.values()], {
      kind: 'payslip.reminder', title: `Slip periode ${periodLabel(p)}: ${open.length} belum ditutup (${open.length - held.length} siap, ${held.length} tertahan).`,
      body: heldText || null, link: `/gaji/periode/${p}`,
    }, null));
    sent.push({ period: p, estimate: open.length });
  }
  return { sent };
}

/** Isi potongan satu orang satu periode untuk tab Potongan (GAJ-L19): tersimpan bila slipnya Ditutup, selain itu perkiraan. */
export async function slipLinesFor(person: PayrollPerson, periodStart: IsoDate, now: Date = new Date()): Promise<(SlipComputation & { closed: boolean }) | null> {
  const [slip] = await db.select().from(payslips).where(and(eq(payslips.employeeId, person.id), eq(payslips.periodStart, periodStart), eq(payslips.status, 'CLOSED')));
  if (slip) return { lines: await storedLines(slip), income: slip.income ?? 0, taken: slip.taken ?? 0, net: slip.net ?? 0, carried: slip.carried ?? 0, closed: true };
  const result = await computeSlip(person, periodStart, now);
  return result ? { ...result.computation, closed: false } : null;
}

/** Jumlah keberatan slip Menunggu atas slip-slip ini (langkah Periksa Tutup Slip, spec L4g §3.5). */
async function pendingObjectionsOn(slipIds: readonly number[]): Promise<number> {
  if (!slipIds.length) return 0;
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(payslipObjections)
    .where(and(inArray(payslipObjections.payslipId, [...slipIds]), eq(payslipObjections.state, 'PENDING')));
  return Number(row?.n ?? 0);
}
