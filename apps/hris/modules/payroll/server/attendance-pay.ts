import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { payWaivers } from '@petshop/hris-db/schema/payroll';
import { db } from '@/lib/db';
import { can, getOrgLookup, hasAction, recordAudit, type Actor, type ChangeAnnounce, type ServiceResult } from '@/modules/access';
import { payFacts } from '@/modules/attendance';
import { todayWib } from '@/modules/employees';
import { notify } from '@/modules/notifications';
import {
  SETTINGS, checkReason, formatSettingValue, setSettingsBatch, loadRows, resolveSetting, settingOn, settingVersions, settingsOn, upcomingRows, type SettingKey,
} from '@/modules/settings';
import {
  FINE_LABELS, LINE_LABELS, attendancePay, escalationSeries, multiplierLabel, waiverKey,
  type Escalation, type FineKind, type PayDay, type PayResult, type PayRules, type SickLetter,
} from '../rules/attendance-pay';
import { scheduleInstallments, takeDeductions } from '../rules/deductions';
import { netShortage, splitEvenly, splitLoss } from '../rules/losses';
import { addPeriods, longDate, monthlyTotal, packageOn, periodStartOf, rupiah, type IsoDate } from '../rules/salary';
import { amountOf } from '../rules/bonus';
import { accountOf, canSeeSalary, loadPackages, loadPayrollPeople, type PayrollPerson } from './data';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string };
const fail = (status: Fail['status'], error: string): Fail => ({ ok: false, status, error });

/** Kunci layar Potongan & Lembur, urut tampil (spec L4b §3.1). */
export const PAY_RULE_KEYS = [
  'payroll.overtime_rate', 'payroll.late_rate', 'payroll.ladder_permit_sick', 'payroll.ladder_permit_sudden', 'payroll.ladder_alpha',
  'payroll.sick_letter', 'payroll.training_multiplier', 'payroll.day_off_compensation', 'payroll.fine_forgot_in', 'payroll.fine_forgot_out',
  'payroll.fine_forgot_return', 'payroll.fine_forgot_surcharge', 'payroll.fine_day_off_missing', 'payroll.daily_divisor',
] as const satisfies readonly SettingKey[];

function toRules(values: Record<string, unknown>): PayRules {
  const n = (key: string) => Number(values[key]);
  return {
    divisor: n('payroll.daily_divisor'), lateRate: n('payroll.late_rate'), overtimeRate: n('payroll.overtime_rate'),
    permitSick: values['payroll.ladder_permit_sick'] as Escalation, sudden: values['payroll.ladder_permit_sudden'] as Escalation,
    alpha: values['payroll.ladder_alpha'] as Escalation, sickLetter: values['payroll.sick_letter'] as SickLetter,
    training: n('payroll.training_multiplier'), compensation: n('payroll.day_off_compensation'),
    fines: {
      IN: n('payroll.fine_forgot_in'), OUT: n('payroll.fine_forgot_out'), RETURN: n('payroll.fine_forgot_return'),
      surcharge: n('payroll.fine_forgot_surcharge'), dayOffMissing: n('payroll.fine_day_off_missing'),
    },
  };
}

/** Angka aturan satu periode: dibaca pada tanggal 26 awal periode (angka gaji hanya berubah tanggal 26). */
export async function payRulesOn(periodStart: IsoDate): Promise<PayRules> {
  return toRules(await settingsOn(PAY_RULE_KEYS, periodStart));
}

const periodEnd = (start: IsoDate) => {
  const next = addPeriods(start, 1);
  const date = new Date(`${next}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};
const minusDay = (date: IsoDate) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** Periode berjalan dan 11 periode lalu (pilihan layar; periode lama dimuat saat diminta). */
export function periodChoices(today: IsoDate) {
  const current = periodStartOf(today);
  return Array.from({ length: 12 }, (_, index) => {
    const start = addPeriods(current, -index);
    return { start, end: periodEnd(start), label: `${longDate(start)} – ${longDate(periodEnd(start))}` };
  });
}

/** Periode yang sudah masuk slip ditutup tidak bisa diubah peniadaannya. Slip baru ada di 4E-5a, jadi di L4b selalu "tidak". */
export async function isPeriodLocked(periodStart: IsoDate): Promise<boolean> {
  void periodStart;
  return false;
}

async function waiversOf(employeeIds: number[], from: IsoDate, to: IsoDate) {
  if (!employeeIds.length) return [];
  const rows = await db.select().from(payWaivers).where(and(
    isNull(payWaivers.cancelledAt), gte(payWaivers.workDate, from), lte(payWaivers.workDate, to),
    sql`${payWaivers.employeeId} in (${sql.join(employeeIds.map((id) => sql`${id}`), sql`, `)})`,
  ));
  return rows;
}

async function toleranceReader() {
  const versions = await settingVersions('attendance.late_tolerance_minutes');
  return (date: IsoDate) => Number([...versions].reverse().find((v) => v.from <= date)?.value ?? 0);
}

/** Hitungan kehadiran satu orang untuk satu periode (spec L4b §3.2). Null bila belum ada gaji. */
export async function computeAttendancePay(person: PayrollPerson, periodStart: IsoDate, now: Date = new Date()): Promise<PayResult | null> {
  const period = { start: periodStart, end: periodEnd(periodStart) };
  const [packages, rules, facts, tolerance, waivers, compensation] = await Promise.all([
    loadPackages([person.id]), payRulesOn(periodStart), payFacts(person.id, periodStart, now), toleranceReader(),
    waiversOf([person.id], period.start, period.end),
    settingOn<string>('position.day_off_compensation', periodStart, { positionId: person.positionId }),
  ]);
  const pkg = packageOn(packages.get(person.id) ?? [], periodStart) ?? packageOn(packages.get(person.id) ?? [], period.end);
  if (!pkg) return null;
  const workedFrom = person.joinedOn > period.start ? person.joinedOn : period.start;
  const stop = person.lastStatus?.kind === 'DEACTIVATE' && person.lastStatus.effectiveOn <= period.end && person.lastStatus.effectiveOn > period.start
    ? minusDay(person.lastStatus.effectiveOn) : period.end;
  const waived = new Map<string, string>();
  for (const row of waivers) waived.set(waiverKey(row.kind, row.workDate, row.fineKind), row.reason);
  return attendancePay({
    monthly: monthlyTotal(pkg.lines), period, workedFrom, workedUntil: stop,
    ownerPosition: person.isOwnerPosition, training: person.workStatus === 'TRAINING', compensationApplies: compensation === 'YES',
    tracked: facts.tracked, days: facts.days as PayDay[], lateTolerance: tolerance, lateExplained: new Set(facts.lateExplained),
    overtime: facts.overtime, forgot: facts.forgot, dayOffMissing: facts.dayOffMissing, workRequests: facts.workRequests, waived, rules,
  });
}

const canWaive = (actor: Actor | null, person: PayrollPerson) => Boolean(actor?.fullAccess) && can(actor, 'pay_waiver.manage', person.target) && actor?.personId !== person.id;

// ---- Hitungan Kehadiran (GAJ-L09) ----

export async function attendancePayScreen(actor: Actor | null, employeeId: number, periodInput: string | null, now: Date = new Date()) {
  const today = todayWib(now);
  const person = (await loadPayrollPeople(today)).find((p) => p.id === employeeId);
  if (!person || !canSeeSalary(actor, person)) return null;
  const periods = periodChoices(today);
  const period = periods.find((p) => p.start === periodInput) ?? periods[0];
  const result = await computeAttendancePay(person, period.start, now);
  return {
    person: { id: person.id, name: person.name, positionName: person.positionName, branchName: person.branchName, workStatus: person.workStatus },
    period, periods, computedAt: now.toISOString(), result,
    labels: { lines: LINE_LABELS },
    canWaive: canWaive(actor, person),
    note: person.isOwnerPosition ? 'Jabatan Pemilik hanya mendapat gaji tetap (GAJ-09).' : null,
  };
}

// ---- Tiadakan Potongan (GAJ-L10) ----

export type WaiverStatus = 'CUT' | 'WAIVED' | 'EXPLAINED';
export type WaiverRow = {
  employeeId: number; name: string; branchName: string; workDate: IsoDate; kind: 'LATE' | 'FINE'; fineKind: FineKind | null;
  what: string; amount: number; fullAmount: number; status: WaiverStatus; note: string | null; waiverId: number | null; canWaive: boolean;
};

export async function waiversScreen(
  actor: Actor | null, input: { period: string | null; branchId: number | null; employeeId: number | null; status: WaiverStatus | null }, now: Date = new Date(),
) {
  const today = todayWib(now);
  const periods = periodChoices(today);
  const period = periods.find((p) => p.start === input.period) ?? periods[0];
  const org = await getOrgLookup();
  const visible = (await loadPayrollPeople(today)).filter((p) => canSeeSalary(actor, p) && !p.isOwnerPosition);
  const people = visible.filter((p) => (input.branchId == null || p.branchId === input.branchId) && (input.employeeId == null || p.id === input.employeeId));
  const rows: WaiverRow[] = [];
  const ids = await waiversOf(people.map((p) => p.id), period.start, period.end);
  for (const person of people) {
    const result = await computeAttendancePay(person, period.start, now);
    if (!result) continue;
    for (const line of result.lines) {
      if (line.key !== 'LATE' && line.key !== 'FINE') continue;
      for (const detail of line.details) {
        if (detail.note === 'Dalam toleransi') continue;
        const explained = detail.note === 'Ditiadakan lewat penjelasan';
        const fineKind = detail.waive?.fineKind ?? null;
        const waiver = ids.find((w) => w.employeeId === person.id && w.workDate === detail.workDate && w.kind === line.key && (w.fineKind ?? null) === fineKind);
        rows.push({
          employeeId: person.id, name: person.name, branchName: person.branchName, workDate: detail.workDate, kind: line.key, fineKind,
          what: detail.text, amount: detail.amount, fullAmount: detail.full, status: explained ? 'EXPLAINED' : detail.waived ? 'WAIVED' : 'CUT',
          note: detail.note, waiverId: waiver?.id ?? null, canWaive: canWaive(actor, person) && !explained,
        });
      }
    }
  }
  const filtered = rows.filter((row) => input.status == null || row.status === input.status)
    .sort((a, b) => (a.workDate === b.workDate ? a.name.localeCompare(b.name) : a.workDate < b.workDate ? -1 : 1));
  return {
    period, periods, rows: filtered,
    branches: org.branches.filter((b) => b.active).map(({ id, name }) => ({ id, name })),
    people: visible.map((p) => ({ id: p.id, name: p.name })),
    filter: input,
    canWaive: hasAction(actor, 'pay_waiver.manage'),
  };
}

export type WaiveInput = { employeeId: number; kind: unknown; workDate: unknown; fineKind: unknown; reason: unknown };

export async function waiveDeduction(actor: Actor | null, input: WaiveInput, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<{ id: number }>> {
  if (!actor) return fail(403, 'Anda tidak berhak meniadakan potongan.');
  const today = todayWib(now);
  const person = (await loadPayrollPeople(today)).find((p) => p.id === input.employeeId);
  if (!person || !canSeeSalary(actor, person)) return fail(404, 'Karyawan tidak ditemukan.');
  if (!actor.fullAccess || !can(actor, 'pay_waiver.manage', person.target)) return fail(403, 'Hanya Pemilik atau GM yang bisa meniadakan potongan.');
  if (actor.personId === person.id) return fail(403, 'Potongan Anda sendiri ditiadakan oleh Pemilik lain atau GM.');
  const kind = input.kind === 'LATE' || input.kind === 'FINE' ? input.kind : null;
  const fineKind = kind === 'FINE' && typeof input.fineKind === 'string' && input.fineKind in FINE_LABELS ? (input.fineKind as FineKind) : null;
  if (!kind || (kind === 'FINE' && !fineKind) || typeof input.workDate !== 'string') return fail(400, 'Kejadian tidak dikenal.');
  const workDate = input.workDate;
  const periodStart = periodStartOf(workDate);
  if (await isPeriodLocked(periodStart)) return fail(409, 'Sudah masuk slip yang ditutup. Koreksinya lewat slip berikutnya.');
  const reason = await checkReason(input.reason);
  if (!reason.ok) return fail(400, reason.error);
  const result = await computeAttendancePay(person, periodStart, now);
  const detail = result?.lines.find((l) => l.key === kind)?.details.find((d) => d.workDate === workDate && (kind === 'LATE' || d.waive?.fineKind === fineKind));
  if (!detail) return fail(404, 'Potongan itu tidak ada di hitungan.');
  if (detail.waived) return fail(409, 'Potongan ini sudah ditiadakan.');
  if (detail.amount <= 0 || !detail.waive) return fail(400, 'Potongan ini Rp0 (dalam toleransi atau sudah dijelaskan); tidak ada yang perlu ditiadakan.');
  const what = kind === 'LATE' ? `potongan telat ${longDate(workDate)}` : `denda ${FINE_LABELS[fineKind as FineKind].toLowerCase()} ${longDate(workDate)}`;
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.insert(payWaivers).values({
        employeeId: person.id, kind, workDate, fineKind, reason: reason.reason, createdByAccountId: actor.accountId, createdByEmployeeId: actor.personId,
      }).returning({ id: payWaivers.id });
      await recordAudit(tx, {
        actorAccountId: actor.accountId, entity: 'pay_waiver', entityId: row.id, action: 'pay_waiver.create',
        before: null, after: { employeeId: person.id, kind, workDate, fineKind, amount: detail.amount }, reason: reason.reason,
      });
      const account = await accountOf(person.id);
      if (account) await notify(tx, [account], { kind: 'pay_waiver.created', title: `${capital(what)} ditiadakan.`, entity: 'pay_waiver', entityId: row.id }, actor.accountId);
      await announce(tx, actor.accountId, { what: `meniadakan ${what} ${person.name} (${rupiah(detail.amount)})`, link: `/gaji/tiadakan?periode=${periodStart}`, entity: 'pay_waiver', entityId: row.id });
      return { ok: true as const, data: { id: row.id } };
    });
  } catch (error) {
    const cause = (error as { cause?: { code?: string } })?.cause ?? (error as { code?: string });
    if ((cause as { code?: string })?.code === '23505') return fail(409, 'Potongan ini sudah ditiadakan.');
    throw error;
  }
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export async function cancelWaiver(actor: Actor | null, id: number, reasonInput: unknown, announce: ChangeAnnounce, now: Date = new Date()): Promise<ServiceResult<object>> {
  if (!actor?.fullAccess) return fail(403, 'Hanya Pemilik atau GM yang bisa membatalkan peniadaan.');
  const reason = await checkReason(reasonInput, 'Alasan pembatalan');
  if (!reason.ok) return fail(400, reason.error);
  const [row] = await db.select().from(payWaivers).where(eq(payWaivers.id, id));
  if (!row || row.cancelledAt) return fail(404, 'Peniadaan tidak ditemukan atau sudah dibatalkan.');
  const person = (await loadPayrollPeople(todayWib(now))).find((p) => p.id === row.employeeId);
  if (!person || !can(actor, 'pay_waiver.manage', person.target)) return fail(403, 'Anda tidak berhak membatalkan peniadaan ini.');
  if (actor.personId === person.id) return fail(403, 'Peniadaan atas potongan Anda sendiri dibatalkan oleh Pemilik lain atau GM.');
  if (await isPeriodLocked(periodStartOf(row.workDate))) return fail(409, 'Sudah masuk slip yang ditutup. Koreksinya lewat slip berikutnya.');
  const what = row.kind === 'LATE' ? `potongan telat ${longDate(row.workDate)}` : `denda ${FINE_LABELS[row.fineKind as FineKind].toLowerCase()} ${longDate(row.workDate)}`;
  return db.transaction(async (tx) => {
    const updated = await tx.update(payWaivers).set({ cancelledAt: new Date(), cancelledByAccountId: actor.accountId, cancelReason: reason.reason })
      .where(and(eq(payWaivers.id, id), isNull(payWaivers.cancelledAt))).returning({ id: payWaivers.id });
    if (!updated.length) return fail(409, 'Peniadaan ini baru saja dibatalkan orang lain.');
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'pay_waiver', entityId: id, action: 'pay_waiver.cancel',
      before: { cancelled: false }, after: { cancelled: true }, reason: reason.reason,
    });
    const account = await accountOf(person.id);
    if (account) await notify(tx, [account], { kind: 'pay_waiver.cancelled', title: `Peniadaan ${what} dibatalkan.`, entity: 'pay_waiver', entityId: id }, actor.accountId);
    await announce(tx, actor.accountId, { what: `membatalkan peniadaan ${what} ${person.name}`, link: `/gaji/tiadakan?periode=${periodStartOf(row.workDate)}`, entity: 'pay_waiver', entityId: id });
    return { ok: true as const, data: {} };
  });
}

// ---- Potongan & Lembur (GAJ-L06) ----

export async function payRulesScreen(actor: Actor | null, now: Date = new Date()) {
  if (!hasAction(actor, 'settings.view') && !hasAction(actor, 'salary.view') && !hasAction(actor, 'settings.manage')) return null;
  const today = todayWib(now);
  const rows = await loadRows(db, PAY_RULE_KEYS);
  const current: Record<string, unknown> = {};
  const scheduled: { id: number; key: SettingKey; label: string; value: string; effectiveFrom: IsoDate }[] = [];
  for (const key of PAY_RULE_KEYS) {
    const own = rows.filter((r) => r.key === key);
    current[key] = resolveSetting(own, today)?.value ?? null;
    for (const row of upcomingRows(own, today, 'ALL', null)) {
      scheduled.push({ id: row.id, key, label: SETTINGS[key].label, value: formatSettingValue(key, row.value), effectiveFrom: row.effectiveFrom });
    }
  }
  const history = rows.filter((r) => r.status !== 'PROPOSED' && r.effectiveFrom <= today)
    .sort((a, b) => (a.effectiveFrom === b.effectiveFrom ? b.id - a.id : a.effectiveFrom < b.effectiveFrom ? 1 : -1))
    .slice(0, 60)
    .map((r) => ({ id: r.id, label: SETTINGS[r.key as SettingKey].label, value: formatSettingValue(r.key as SettingKey, r.value), effectiveFrom: r.effectiveFrom, cancelled: r.status === 'CANCELLED' }));
  const choices = Array.from({ length: 4 }, (_, i) => addPeriods(periodStartOf(today), i)).filter((d) => d > today);
  const [minHours, maxHours] = await Promise.all([settingOn<number>('attendance.overtime_min_hours', today), settingOn<number>('attendance.overtime_max_hours', today)]);
  return {
    today, current, scheduled, history, choices,
    canEdit: hasAction(actor, 'settings.manage'),
    overtimeHours: { min: Number(minHours), max: Number(maxHours) },
    series: {
      permitSick: escalationSeries(current['payroll.ladder_permit_sick'] as Escalation).map(multiplierLabel),
      sudden: escalationSeries(current['payroll.ladder_permit_sudden'] as Escalation).map(multiplierLabel),
      alpha: escalationSeries(current['payroll.ladder_alpha'] as Escalation).map(multiplierLabel),
    },
  };
}

/** Simpan set Potongan & Lembur: hanya kunci layar ini, satu tanggal 26, satu alasan (spec L4b §3.1). */
export async function savePayRules(actor: Actor | null, input: { values: unknown; effectiveFrom: unknown; reason: unknown }, announce: ChangeAnnounce) {
  const values = typeof input.values === 'object' && input.values !== null ? (input.values as Record<string, unknown>) : {};
  if (Object.keys(values).some((key) => !(PAY_RULE_KEYS as readonly string[]).includes(key))) return fail(400, 'Ada angka yang bukan milik Potongan & Lembur.');
  return setSettingsBatch(actor, { values, effectiveFrom: String(input.effectiveFrom ?? ''), reason: String(input.reason ?? '') }, announce);
}

// ---- Aturan Potongan (GAJ-L07) ----

const SAMPLE_MONTHLY = 2_600_000;

export type RuleCard = { key: string; title: string; text: string; example: string; next: string | null };

/** Kartu aturan dengan contoh yang dihitung rumus yang sama (bukan diketik). */
export async function deductionRulesScreen(actor: Actor | null, now: Date = new Date()) {
  if (!actor) return null;
  const today = todayWib(now);
  const periodStart = periodStartOf(today);
  const rules = await payRulesOn(periodStart);
  const nextStart = addPeriods(periodStart, 1);
  const nextRules = await payRulesOn(nextStart);
  const [tolerance] = await Promise.all([settingOn<number>('attendance.late_tolerance_minutes', today)]);
  const all = actor.fullAccess || hasAction(actor, 'salary.view');
  const me = (await loadPayrollPeople(today)).find((p) => p.id === actor.personId);
  const flags = me ? await settingsOnPosition(me.positionId, today) : { late: true, overtime: true, compensation: true };
  const training = me?.workStatus === 'TRAINING';
  const period = { start: periodStart, end: periodEnd(periodStart) };
  const run = (days: PayDay[], extra: Partial<Parameters<typeof attendancePay>[0]> = {}) => attendancePay({
    monthly: SAMPLE_MONTHLY, period, workedFrom: period.start, workedUntil: period.end, ownerPosition: false, training: false,
    compensationApplies: true, tracked: true, days, lateTolerance: () => Number(tolerance), lateExplained: new Set(), overtime: [], forgot: [],
    dayOffMissing: false, workRequests: [], waived: new Map(), rules, ...extra,
  });
  const dates = Array.from({ length: 5 }, (_, i) => addDaysIso(period.start, i + 1));
  const absent = (status: PayDay['status'], absence: string | null, count: number) => dates.slice(0, count).map((workDate) => ({ workDate, status, lateMinutes: null, absence, tags: [] }));
  const lineOf = (result: PayResult, key: string) => result.lines.find((l) => l.key === key);
  const ladderText = (result: PayResult, key: string) => {
    const line = lineOf(result, key);
    return line ? `${line.details.map((d) => d.text.replace(/^Hari ke-\d+( \([^)]*\))?, pengali /, '')).join(' + ')} = ${rupiah(line.amount)}` : 'Rp0';
  };
  const daily = rules.divisor > 0 ? SAMPLE_MONTHLY / rules.divisor : 0;
  const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
  const nextText = (pick: (r: PayRules) => unknown, show: (r: PayRules) => string) => (changed(pick(rules), pick(nextRules)) ? `Mulai ${longDate(nextStart)} menjadi ${show(nextRules)}.` : null);
  const ladderShow = (l: Escalation) => escalationSeries(l).map(multiplierLabel).join(' · ');
  const late = run([{ workDate: dates[0], status: 'PRESENT', lateMinutes: Number(tolerance), absence: null, tags: [] }, { workDate: dates[1], status: 'PRESENT', lateMinutes: Number(tolerance) + 1, absence: null, tags: [] }]);
  const cards: RuleCard[] = [
    { key: 'daily', title: 'Gaji harian', text: `Gaji harian = gaji tetap sebulan ÷ ${rules.divisor}, berapa pun panjang periodenya.`, example: `${rupiah(SAMPLE_MONTHLY)} ÷ ${rules.divisor} = ${rupiah(Math.round(daily))}`, next: nextText((r) => r.divisor, (r) => `÷ ${r.divisor}`) },
    { key: 'join', title: 'Masuk di tengah periode', text: 'Gaji tetap dihitung sebanding hari kalender sejak tanggal masuk.', example: `Masuk tanggal 11 di periode 31 hari: ${rupiah(run([], { workedFrom: addDaysIso(period.start, 16) }).lines[0].amount)}`, next: null },
  ];
  if (all || flags.late) cards.push({ key: 'late', title: 'Telat', text: `Telat sampai ${tolerance} menit tidak dipotong. Lebih dari itu dipotong seluruh menitnya, ${rupiah(rules.lateRate)} per menit. Telat yang penjelasannya disetujui tidak dipotong.`, example: `Telat ${tolerance} menit: Rp0. Telat ${Number(tolerance) + 1} menit: ${rupiah(lineOf(late, 'LATE')?.amount ?? 0)}`, next: nextText((r) => r.lateRate, (r) => `${rupiah(r.lateRate)} per menit`) });
  cards.push(
    { key: 'permit', title: 'Izin, izin duka, dan sakit tanpa surat', text: `Dihitung bersama dalam satu periode; tiap hari dipotong pengali × gaji harian: ${ladderShow(rules.permitSick)}.`, example: `3 hari: ${ladderText(run(absent('PERMIT', 'PERMIT', 3)), 'PERMIT_SICK')}`, next: nextText((r) => r.permitSick, (r) => ladderShow(r.permitSick)) },
    { key: 'sudden', title: 'Izin mendadak', text: `Hitungan harinya sendiri: ${ladderShow(rules.sudden)}.`, example: `2 hari: ${ladderText(run(absent('PERMIT', 'PERMIT_SUDDEN', 2)), 'SUDDEN')}`, next: nextText((r) => r.sudden, (r) => ladderShow(r.sudden)) },
    { key: 'alpha', title: 'Alpha', text: `Tidak masuk tanpa keterangan. Hitungan harinya sendiri: ${ladderShow(rules.alpha)}.`, example: `2 hari: ${ladderText(run(absent('ALPHA', null, 2)), 'ALPHA')}`, next: nextText((r) => r.alpha, (r) => ladderShow(r.alpha)) },
    { key: 'sick_letter', title: 'Sakit dengan surat dokter', text: `Per periode: hari ke-1 ${multiplierLabel(rules.sickLetter.day1)}, hari ke-2 dan ke-3 ${multiplierLabel(rules.sickLetter.day2to3)}, hari ke-4 dst ${multiplierLabel(rules.sickLetter.day4plus)}.`, example: `4 hari: ${ladderText(run(absent('SICK', 'SICK_LETTER', 4)), 'SICK_LETTER')}`, next: nextText((r) => r.sickLetter, (r) => `${multiplierLabel(r.sickLetter.day1)} · ${multiplierLabel(r.sickLetter.day2to3)} · ${multiplierLabel(r.sickLetter.day4plus)}`) },
  );
  if (all || training) cards.push({ key: 'training', title: 'Training', text: `Selama Training, izin, sakit tanpa surat, izin mendadak, dan alpha dipotong ${multiplierLabel(rules.training)} gaji harian per hari, tidak naik.`, example: `Alpha 3 hari: ${ladderText(run(absent('ALPHA', null, 3), { training: true }), 'ALPHA')}`, next: nextText((r) => r.training, (r) => multiplierLabel(r.training)) });
  cards.push({ key: 'free', title: 'Yang tidak dipotong', text: 'Libur terjadwal, cuti tahunan, dan hari tutup.', example: 'Dibayar penuh.', next: null });
  if (all || flags.overtime) cards.push({ key: 'overtime', title: 'Lembur', text: `Jam lembur yang disahkan dibayar ${rupiah(rules.overtimeRate)} per jam.`, example: `2 jam: ${rupiah(lineOf(run([], { overtime: [{ workDate: dates[0], hours: 2 }] }), 'OVERTIME')?.amount ?? 0)}`, next: nextText((r) => r.overtimeRate, (r) => `${rupiah(r.overtimeRate)} per jam`) });
  if (all || flags.compensation) cards.push({ key: 'compensation', title: 'Kompensasi libur', text: `Diminta masuk di hari libur dan benar-benar masuk: ${multiplierLabel(rules.compensation)} gaji harian per hari.`, example: `1 hari: ${rupiah(lineOf(run([], { workRequests: [{ workDate: dates[0], present: true }] }), 'COMPENSATION')?.amount ?? 0)}`, next: nextText((r) => r.compensation, (r) => multiplierLabel(r.compensation)) });
  cards.push(
    { key: 'forgot', title: 'Denda lupa absen', text: `Lupa absen masuk ${rupiah(rules.fines.IN)}, lupa absen pulang ${rupiah(rules.fines.OUT)}, lupa Masuk Kembali ${rupiah(rules.fines.RETURN)} per kejadian yang penjelasannya disetujui. Mulai kejadian ke-5 pada jenis yang sama ditambah ${rupiah(rules.fines.surcharge)}.`, example: `Lupa absen pulang ke-1 sampai ke-4: ${rupiah(rules.fines.OUT)}; ke-5: ${rupiah(rules.fines.OUT + rules.fines.surcharge)}`, next: nextText((r) => r.fines, (r) => `masuk ${rupiah(r.fines.IN)}, pulang ${rupiah(r.fines.OUT)}, Masuk Kembali ${rupiah(r.fines.RETURN)}, tambahan ${rupiah(r.fines.surcharge)}`) },
    { key: 'day_off', title: 'Denda tidak memilih libur', text: `Tidak memilih libur sampai batasnya: ${rupiah(rules.fines.dayOffMissing)} sekali per periode.`, example: rupiah(rules.fines.dayOffMissing), next: null },
  );
  // L4c-1 (spec L4c §3.8): contoh dihitung fungsi pembagian yang sama dengan hitungan sebenarnya.
  const sharing = me ? (await settingOn<string>('position.loss_sharing', today, { positionId: me.positionId })) === 'YES' && !me.isOwnerPosition : false;
  if (all || sharing) {
    const loss = splitLoss({ amount: 1_000_000, officePercent: 40, periodDays: 30, holders: [
      { employeeId: 1, name: 'bobot 2', weight: 2, days: 30 }, { employeeId: 2, name: 'bobot 1', weight: 1, days: 30 },
      { employeeId: 3, name: 'bobot 1', weight: 1, days: 30 }, { employeeId: 4, name: 'bobot 1', weight: 1, days: 30 },
    ] });
    cards.push({
      key: 'loss', title: 'Kehilangan barang',
      text: 'Kehilangan hasil opname cabang dibagi: sebagian ditanggung kantor (persen kantor cabang), sisanya ke orang yang ditempatkan di cabang itu dengan jabatan yang ikut menanggung, sebanding bobot jabatan dan hari ditempatkan dalam periode.',
      example: `Kehilangan Rp1.000.000, kantor 40%, empat orang (bobot 2, 1, 1, 1) penuh: bobot 2 = ${rupiah(loss.shares[0].amount)}, bobot 1 = ${rupiah(loss.shares[1].amount)}, kantor ${rupiah(loss.office.total)}. Masuk di tengah periode: bagian sebanding hari Anda, sisanya ditanggung kantor.`,
      next: null,
    });
    const even = splitEvenly(90_000, [1, 2, 3]);
    cards.push({ key: 'shortage_unnamed', title: 'Minus kas tanpa nama', text: 'Minus kas di luar shift POS yang tidak jelas siapa: dibagi rata ke yang hadir di cabang itu hari itu dengan jabatan yang ikut menanggung.', example: `Rp90.000, tiga orang hadir: masing-masing ${rupiah(even.shares[0].amount)}`, next: null });
  }
  const shortage = netShortage([{ amount: -50_000, waived: false }, { amount: 20_000, waived: false }]);
  const plan = scheduleInstallments(600_000, 3, nextStart);
  cards.push({ key: 'other', title: 'Potongan Lain', text: 'Ganti rugi perorangan (barang rusak, peralatan, dan lainnya) diajukan HR dan disahkan Pemilik atau GM, dicicil 1 sampai 3 kali lewat slip. Keberatan paling lambat 3 hari sejak diberi tahu.', example: `Ganti rugi Rp600.000 dicicil 3 kali: ${plan.map((p) => rupiah(p.amount)).join(', ')} per slip`, next: null });
  const order = takeDeductions(1_000_000, [
    { group: 'a', key: 'a', label: 'a', date: period.start, amount: 300_000 }, { group: 'b', key: 'b', label: 'b', date: period.start, amount: 200_000 },
    { group: 'c', key: 'c', label: 'c', date: period.start, amount: 400_000 }, { group: 'd', key: 'd', label: 'd', date: period.start, amount: 250_000 },
  ]);
  cards.push({ key: 'order', title: 'Urutan potongan dan sisa potongan', text: 'Potongan diambil berurutan sampai pendapatan slip habis: (a) telat, tidak hadir, denda; (b) kehilangan barang dan minus kas; (c) Potongan Lain; (d) kasbon. Yang tidak tertampung dibawa ke slip berikutnya. Gaji bersih tidak pernah di bawah Rp0.', example: `Pendapatan Rp1.000.000; (a) Rp300.000, (b) Rp200.000, (c) Rp400.000, (d) Rp250.000: bersih ${rupiah(order.net)}, sisa kasbon ${rupiah(order.carried)} dibawa ke slip berikutnya`, next: null });
  cards.push({ key: 'shortage', title: 'Minus kas', text: 'Minus kas shift POS dibagi ke kasir menurut porsi kas tunai yang diterimanya (angka laporan Minus Kasir), lalu disahkan Pemilik atau GM. Lebih kas di periode yang sama hanya menutup minus, tidak menambah gaji.', example: `Minus Rp50.000 dan lebih Rp20.000 di periode yang sama: dipotong ${rupiah(shortage.net)}`, next: null });
  // L4d-1 (spec L4d §3.5): kartu bonus hanya untuk jabatan penerimanya; contoh dihitung rumus yang sama dengan Buku Bonus.
  const [groomingPercent, deliveryPercent] = await Promise.all([settingOn<number>('payroll.bonus_grooming_percent', today), settingOn<number>('payroll.bonus_delivery_percent', today)]);
  const bonusFlag = async (key: 'position.bonus_grooming' | 'position.bonus_delivery') => (me ? (await settingOn<string>(key, today, { positionId: me.positionId })) === 'YES' && !me.isGmPosition : false);
  if (all || await bonusFlag('position.bonus_grooming')) {
    cards.push({ key: 'bonus_grooming', title: 'Bonus grooming', text: `Tiap jasa grooming yang sudah diambil di kasir: ${groomingPercent}% × harga jasa sesudah diskon, dibulatkan ke bawah. Masuk periode tanggal kucing diambil; disahkan per groomer per periode.`, example: `Jasa ${rupiah(85_000)} sesudah diskon: bonus ${groomingPercent}% = ${rupiah(amountOf(85_000, Number(groomingPercent)))}`, next: null });
  }
  if (all || (await bonusFlag('position.bonus_delivery') && !me?.isOwnerPosition)) {
    cards.push({ key: 'bonus_delivery', title: 'Bonus ongkir', text: `Pengantar di nota mendapat ${deliveryPercent}% × ongkir sesudah diskon, dibulatkan ke bawah. Tercatat otomatis; gratis ongkir tidak berbonus.`, example: `Ongkir ${rupiah(15_000)}: bonus ${deliveryPercent}% = ${rupiah(amountOf(15_000, Number(deliveryPercent)))}`, next: null });
  }
  return { cards, sample: rupiah(SAMPLE_MONTHLY), today };
}

async function settingsOnPosition(positionId: number, on: IsoDate) {
  const [late, overtime, compensation] = await Promise.all([
    settingOn<string>('position.late_applies', on, { positionId }), settingOn<string>('position.overtime_applies', on, { positionId }),
    settingOn<string>('position.day_off_compensation', on, { positionId }),
  ]);
  return { late: late === 'YES', overtime: overtime === 'YES', compensation: compensation === 'YES' };
}

function addDaysIso(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
