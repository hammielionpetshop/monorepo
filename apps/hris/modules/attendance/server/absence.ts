// Izin, Sakit, dan Cuti (spec L3f). Status pengajuan milik Mesin Pengajuan; modul ini menyimpan isi khasnya,
// menghitung hari kerja, batas waktu, bentrok, dan jatah cuti di server (WAJ-04).
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import {
  absenceDays, absenceNotices, absenceRequests, branchClosures, doctorLetterViews, doctorLetters, leaveMovements, leaveYears,
} from '@petshop/hris-db/schema/attendance';
import { db } from '@/lib/db';
import { can, listEmployeesWithAnyAction, recordAudit, type Actor, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { saveUpload } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { attachToRequest } from '@/modules/requests';
import { checkReason, settingOn } from '@/modules/settings';
import {
  ABSENCE_COUNT_LABELS, ABSENCE_KINDS, ABSENCE_KIND_LABELS, BEREAVEMENT_RELATIONS, MAX_RANGE_DAYS, RELATION_LABELS, addYears, checkDeadline,
  countKindOf, cutBereavement, datesBetween, deadlineLabel, firstLeaveDate, isAbsenceKind, isRelation, leaveBalance, leaveYearOf,
  letterDaysLeft, letterDeadline, sickRunLength, workdaysIn,
  type AbsenceCount, type AbsenceKind, type AbsenceRules, type LeaveMovementKind, type LeaveYear,
} from '../rules/absence';
import { wibDate } from '../rules/attendance';
import { daysBetween, periodRange } from '../rules/days-off';
import { payPeriodOf, shiftPeriod } from '../rules/review';
import { addDays, closureCovers, type IsoDate } from '../rules/schedule';
import { activeAbsenceDays, activeDayOffKeys, rosterOn, type Executor } from './read';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string; hint?: 'SWITCH_TO_LETTER' };
const fail = (status: Fail['status'], error: string, hint?: Fail['hint']): Fail => ({ ok: false, status, error, ...(hint ? { hint } : {}) });
const FORBIDDEN = 'Anda tidak berhak melakukan tindakan ini.';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const ids = (values: number[]) => sql.join([...new Set(values)].map((id) => sql`${id}`), sql`, `);

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const LONG_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "Kam 12 Nov". */
export function shortDate(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

/** "1 Maret 2027". */
export function longDate(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${LONG_MONTHS[m - 1]} ${y}`;
}

function rangeText(start: IsoDate, end: IsoDate): string {
  return start === end ? shortDate(start) : `${shortDate(start)} – ${shortDate(end)}`;
}

export async function absenceRules(on: IsoDate, executor: Executor = db): Promise<AbsenceRules> {
  const read = (key: Parameters<typeof settingOn>[0]) => settingOn<number>(key, on, {}, executor).then(Number);
  const [annualQuota, annualNoticeDays, permitNoticeDays, lateSubmitDays, sickNoLetterMaxDays, bereavementDays, letterGraceDays] = await Promise.all([
    read('attendance.leave_annual_quota'), read('attendance.leave_annual_notice_days'), read('attendance.leave_permit_notice_days'),
    read('attendance.leave_late_submit_days'), read('attendance.sick_no_letter_max_days'), read('attendance.bereavement_days'),
    read('attendance.doctor_letter_grace_days'),
  ]);
  return { annualQuota, annualNoticeDays, permitNoticeDays, lateSubmitDays, sickNoLetterMaxDays, bereavementDays, letterGraceDays };
}

// ---- Orang yang diajukan ----

export type Subject = {
  employeeId: number; name: string; branchId: number; departmentId: number; positionId: number; mode: string;
  fullAccess: boolean; joinedOn: IsoDate;
};

export async function subjectOn(employeeId: number, on: IsoDate, executor: Executor = db): Promise<Subject | null> {
  const person = (await rosterOn(on, executor)).find((row) => row.employeeId === employeeId);
  if (!person) return null;
  const rows = await executor.execute<{ full: boolean; joined: string }>(sql`
    select p.full_access as full, e.joined_on::text as joined from hris.employees e, hris.positions p
    where e.id = ${employeeId} and p.id = ${person.positionId}`);
  if (!rows[0]) return null;
  return { ...person, fullAccess: Boolean(rows[0].full), joinedOn: rows[0].joined };
}

const targetOf = (subject: Pick<Subject, 'employeeId' | 'branchId' | 'departmentId'>) => ({
  personId: subject.employeeId, branchId: subject.branchId, departmentId: subject.departmentId,
});

/** Siapa yang memakai izin, sakit, dan cuti (spec L3f §9 butir 7). */
function eligibilityProblem(subject: Subject | null): string | null {
  if (!subject) return 'Data karyawan tidak ditemukan atau tidak aktif.';
  if (subject.fullAccess) return 'Pemilik dan GM tidak mengajukan izin, sakit, atau cuti.';
  if (subject.mode !== 'QR') return 'Jabatan ini tidak diabsen lewat QR, jadi tidak memakai izin, sakit, atau cuti.';
  return null;
}

async function lockPerson(tx: Tx, employeeId: number) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('attendance.absence'), ${employeeId})`);
}

/** Libur berlaku orang itu dan Hari tutup cabangnya dalam rentang (KEH-41). */
async function offDates(subject: Subject, from: IsoDate, to: IsoDate, executor: Executor = db): Promise<Set<IsoDate>> {
  const [dayOffs, closures] = await Promise.all([
    activeDayOffKeys([subject.employeeId], from, to, executor),
    executor.select().from(branchClosures).where(and(
      isNull(branchClosures.cancelledAt), lte(branchClosures.startDate, to), gte(branchClosures.endDate, from),
    )),
  ]);
  const off = new Set<IsoDate>();
  for (const date of datesBetween(from, to)) {
    if (dayOffs.has(`${subject.employeeId}|${date}`) || closures.some((closure) => closureCovers(closure, subject.branchId, date))) off.add(date);
  }
  return off;
}

// ---- Tahun cuti dan gerak cuti ----

type YearRow = typeof leaveYears.$inferSelect;

async function yearRow(employeeId: number, start: IsoDate, executor: Executor = db): Promise<YearRow | null> {
  const [row] = await executor.select().from(leaveYears).where(and(eq(leaveYears.employeeId, employeeId), eq(leaveYears.startDate, start)));
  return row ?? null;
}

/** Buka tahun cuti bila belum ada (jatah dari pengaturan pada awal tahun cutinya). Aman diulang. */
async function ensureYear(tx: Tx, employeeId: number, year: LeaveYear): Promise<YearRow> {
  const quota = (await absenceRules(year.start, tx)).annualQuota;
  await tx.insert(leaveYears).values({ employeeId, startDate: year.start, endDate: year.end, quota }).onConflictDoNothing();
  return (await yearRow(employeeId, year.start, tx))!;
}

async function movementsOf(yearIds: number[], executor: Executor = db) {
  if (!yearIds.length) return [];
  return executor.select().from(leaveMovements).where(inArray(leaveMovements.leaveYearId, yearIds)).orderBy(desc(leaveMovements.id));
}

/** Sisa cuti satu tahun; tahun yang belum dibuka dihitung dengan jatah pengaturan tanpa gerak. */
async function balanceOf(employeeId: number, year: LeaveYear, executor: Executor = db): Promise<{ row: YearRow | null; quota: number; balance: number }> {
  const row = await yearRow(employeeId, year.start, executor);
  if (!row) {
    const quota = (await absenceRules(year.start, executor)).annualQuota;
    return { row: null, quota, balance: quota };
  }
  const moves = await movementsOf([row.id], executor);
  return { row, quota: row.quota, balance: leaveBalance(row.quota, moves.map((m) => ({ kind: m.kind as LeaveMovementKind, days: m.days }))) };
}

/** Hari cuti yang masih terpesan oleh satu pengajuan (pesan − kembali). */
async function reservedFor(tx: Executor, absenceRequestId: number): Promise<{ yearId: number; days: number } | null> {
  const moves = await tx.select().from(leaveMovements).where(eq(leaveMovements.absenceRequestId, absenceRequestId));
  const reserve = moves.find((m) => m.kind === 'RESERVE');
  if (!reserve) return null;
  const returned = moves.filter((m) => m.kind === 'RETURN').reduce((sum, m) => sum + m.days, 0);
  return { yearId: reserve.leaveYearId, days: reserve.days - returned };
}

// ---- Perencana: satu fungsi untuk pratinjau dan Kirim (WAJ-04) ----

export type AbsenceDraft = {
  kind: AbsenceKind; startDate: IsoDate; endDate: IsoDate; reason: string; relation: string | null; letterPending: boolean;
};

export function parseDraft(input: Record<string, unknown>): AbsenceDraft | Fail {
  if (!isAbsenceKind(input.kind)) return fail(400, 'Pilih jenis tidak masuk.');
  const startDate = typeof input.startDate === 'string' ? input.startDate : '';
  const endDate = typeof input.endDate === 'string' && input.endDate ? input.endDate : startDate;
  if (!ISO.test(startDate) || !ISO.test(endDate)) return fail(400, 'Pilih tanggal mulai dan selesai.');
  if (endDate < startDate) return fail(400, 'Tanggal selesai tidak boleh sebelum tanggal mulai.');
  if (daysBetween(startDate, endDate) + 1 > MAX_RANGE_DAYS) return fail(400, `Satu pengajuan paling panjang ${MAX_RANGE_DAYS} hari. Pecah menjadi beberapa pengajuan.`);
  return {
    kind: input.kind, startDate, endDate,
    reason: typeof input.reason === 'string' ? input.reason.replace(/\s+/g, ' ').trim().slice(0, 500) : '',
    relation: typeof input.relation === 'string' && input.relation ? input.relation : null,
    letterPending: input.kind === 'SICK_LETTER' && input.letterPending === true,
  };
}

export type AbsencePlan = {
  subject: Subject;
  draft: AbsenceDraft;
  sudden: boolean;
  countKind: AbsenceCount;
  workdays: IsoDate[];
  skipped: IsoDate[];
  cut: boolean;
  endDate: IsoDate;
  leave: { year: LeaveYear; quota: number; before: number; after: number } | null;
  warnings: string[];
};

export async function planAbsence(subject: Subject, draft: AbsenceDraft, today: IsoDate, executor: Executor = db)
  : Promise<{ ok: true; plan: AbsencePlan } | Fail> {
  const rules = await absenceRules(today, executor);
  const deadline = checkDeadline(draft.kind, draft.startDate, today, rules);
  if (!deadline.ok) return fail(409, deadline.error);
  if (draft.kind === 'PERMIT' || draft.kind === 'SICK') {
    const reason = await checkReason(draft.reason, 'Alasan');
    if (!reason.ok) return fail(400, reason.error);
  }
  if (draft.kind === 'BEREAVEMENT' && !isRelation(draft.relation)) return fail(400, 'Pilih hubungan dengan yang meninggal (ayah, ibu, suami, istri, atau anak).');

  const off = await offDates(subject, draft.startDate, draft.endDate, executor);
  let workdays = workdaysIn(draft.startDate, draft.endDate, (date) => off.has(date));
  const skipped = datesBetween(draft.startDate, draft.endDate).filter((date) => off.has(date));
  if (!workdays.length) return fail(409, 'Rentang itu tidak berisi hari kerja Anda (semua libur atau hari tutup).');

  let cut = false;
  if (draft.kind === 'BEREAVEMENT') {
    const result = cutBereavement(workdays, rules.bereavementDays);
    workdays = result.days;
    cut = result.cut;
  }
  const endDate = cut ? workdays[workdays.length - 1] : draft.endDate;

  const existing = await activeAbsenceDays([subject.employeeId], addDays(draft.startDate, -MAX_RANGE_DAYS), addDays(endDate, MAX_RANGE_DAYS), executor);
  const clash = existing.filter((row) => workdays.includes(row.workDate));
  if (clash.length) {
    return fail(409, `Tanggal ${clash.map((row) => shortDate(row.workDate)).join(', ')} sudah berisi pengajuan izin, sakit, atau cuti (PJ-${clash[0].requestId}). Batalkan dulu atau pilih tanggal lain.`);
  }

  if (draft.kind === 'SICK') {
    const from = addDays(draft.startDate, -MAX_RANGE_DAYS);
    const to = addDays(endDate, MAX_RANGE_DAYS);
    const aroundOff = await offDates(subject, from, to, executor);
    const around = workdaysIn(from, to, (date) => aroundOff.has(date));
    const sick = new Set(existing.filter((row) => row.kind === 'SICK').map((row) => row.workDate));
    if (sickRunLength(around, new Set(workdays), sick) > rules.sickNoLetterMaxDays) {
      return fail(409, `Sakit tanpa surat paling lama ${rules.sickNoLetterMaxDays} hari kerja berturut-turut. Pilih sakit dengan surat dokter.`, 'SWITCH_TO_LETTER');
    }
  }

  let leave: AbsencePlan['leave'] = null;
  if (draft.kind === 'ANNUAL_LEAVE') {
    const year = leaveYearOf(subject.joinedOn, draft.startDate);
    if (!year) return fail(409, `Cuti pertama bisa diajukan untuk tanggal mulai ${longDate(firstLeaveDate(subject.joinedOn))} (masa kerja 1 tahun penuh).`);
    if (endDate > year.end) return fail(409, `Tahun cuti Anda berakhir ${longDate(year.end)}. Pecah menjadi dua pengajuan, satu per tahun cuti.`);
    const { quota, balance } = await balanceOf(subject.employeeId, year, executor);
    if (workdays.length > balance) return fail(409, `Sisa cuti ${balance} hari; pengajuan ini ${workdays.length} hari kerja.`);
    leave = { year, quota, before: balance, after: balance - workdays.length };
  }

  const warnings: string[] = [];
  if (cut) warnings.push(`Izin duka ${rules.bereavementDays} hari kerja pertama bebas dan dibayar. Hari ke-${rules.bereavementDays + 1} dan seterusnya diajukan terpisah sebagai izin keperluan atau cuti.`);
  const present = await executor.execute<{ work_date: string }>(sql`
    select work_date::text as work_date from hris.attendance_days
    where employee_id = ${subject.employeeId} and work_date between ${draft.startDate}::date and ${endDate}::date`);
  if (present.length) warnings.push(`Sudah ada absen masuk pada ${present.map((row) => shortDate(row.work_date)).join(', ')}; hari itu tetap tercatat Hadir.`);

  return {
    ok: true,
    plan: {
      subject, draft, sudden: deadline.sudden, countKind: countKindOf(draft.kind, deadline.sudden, draft.letterPending),
      workdays, skipped, cut, endDate, leave, warnings,
    },
  };
}

function planSummary(plan: AbsencePlan) {
  return {
    kindLabel: ABSENCE_KIND_LABELS[plan.draft.kind],
    sudden: plan.sudden,
    range: rangeText(plan.draft.startDate, plan.endDate),
    workdays: plan.workdays.length,
    workdayLabels: plan.workdays.map(shortDate),
    skippedText: plan.skipped.length ? `${plan.skipped.map(shortDate).join(', ')} tidak dihitung (libur atau hari tutup)` : null,
    cut: plan.cut,
    endDate: plan.endDate,
    leave: plan.leave ? { before: plan.leave.before, after: plan.leave.after, yearStart: plan.leave.year.start, yearEnd: plan.leave.year.end } : null,
    warnings: plan.warnings,
  };
}

export type PlanSummary = ReturnType<typeof planSummary>;

/** Orang yang diajukan: diri sendiri, atau orang lain lewat Isikan atas Nama (KEH-148). */
async function resolveSubject(actor: Actor, employeeIdInput: unknown, today: IsoDate, executor: Executor = db)
  : Promise<{ ok: true; subject: Subject; onBehalf: boolean } | Fail> {
  const onBehalf = typeof employeeIdInput === 'number' && employeeIdInput !== actor.personId;
  const subject = await subjectOn(onBehalf ? employeeIdInput as number : actor.personId, today, executor);
  const problem = eligibilityProblem(subject);
  if (problem) return fail(onBehalf ? 409 : 403, problem);
  if (onBehalf && !can(actor, 'absence.submit_for', targetOf(subject!))) return fail(403, FORBIDDEN);
  if (!onBehalf && !can(actor, 'attendance.self.check', { personId: actor.personId })) return fail(403, FORBIDDEN);
  return { ok: true, subject: subject!, onBehalf };
}

/** Pratinjau langkah Tanggal dan Periksa: hitungan yang sama dengan saat Kirim. */
export async function previewAbsence(actor: Actor | null, input: Record<string, unknown>, now: Date = new Date())
  : Promise<ServiceResult<PlanSummary> | Fail> {
  if (!actor) return fail(403, FORBIDDEN);
  const today = wibDate(now);
  const resolved = await resolveSubject(actor, input.employeeId, today);
  if (!resolved.ok) return resolved;
  const draft = parseDraft(input);
  if ('ok' in draft) return draft;
  const planned = await planAbsence(resolved.subject, draft, today);
  return planned.ok ? { ok: true, data: planSummary(planned.plan) } : planned;
}

// ---- Layar Ajukan (KEH-L30) dan Isikan atas Nama (KEH-L34) ----

export async function absenceFormScreen(actor: Actor | null, input: { employeeId: number | null; onBehalf: boolean }, now: Date = new Date()) {
  if (!actor) return null;
  const today = wibDate(now);
  const rules = await absenceRules(today);
  let people: { id: number; name: string }[] = [];
  if (input.onBehalf) {
    const roster = await rosterOn(today);
    const subjects = await Promise.all(roster.filter((person) => person.employeeId !== actor.personId && person.mode === 'QR')
      .map((person) => subjectOn(person.employeeId, today)));
    people = subjects.filter((subject): subject is Subject => !!subject && !subject.fullAccess && can(actor, 'absence.submit_for', targetOf(subject)))
      .map((subject) => ({ id: subject.employeeId, name: subject.name }));
    if (!people.length && !can(actor, 'absence.submit_for')) return { allowed: false as const, problem: FORBIDDEN };
  }
  const subjectId = input.onBehalf ? (people.some((person) => person.id === input.employeeId) ? input.employeeId : null) : actor.personId;
  const subject = subjectId != null ? await subjectOn(subjectId, today) : null;
  const problem = subjectId != null ? eligibilityProblem(subject) : null;
  if (!input.onBehalf && (problem || !can(actor, 'attendance.self.check', { personId: actor.personId }))) {
    return { allowed: false as const, problem: problem ?? FORBIDDEN };
  }
  let leave: { text: string; balance: number | null } | null = null;
  let annualBlocked: string | null = null;
  if (subject && !problem) {
    const year = leaveYearOf(subject.joinedOn, today);
    if (!year) {
      annualBlocked = `Masa kerja belum 1 tahun. Cuti pertama untuk tanggal mulai ${longDate(firstLeaveDate(subject.joinedOn))}.`;
      leave = { text: annualBlocked, balance: null };
    } else {
      const { balance } = await balanceOf(subject.employeeId, year);
      leave = { text: `Sisa cuti ${balance} hari (tahun cuti ${longDate(year.start)} – ${longDate(year.end)}).`, balance };
      if (balance <= 0) annualBlocked = 'Sisa cuti 0 hari.';
    }
  }
  return {
    allowed: true as const,
    onBehalf: input.onBehalf,
    people,
    employeeId: subjectId,
    subjectName: subject?.name ?? null,
    subjectProblem: problem,
    today,
    kinds: ABSENCE_KINDS.map((kind) => ({
      kind, label: ABSENCE_KIND_LABELS[kind], deadline: deadlineLabel(kind, rules),
      disabledReason: kind === 'ANNUAL_LEAVE' ? annualBlocked : null,
    })),
    relations: BEREAVEMENT_RELATIONS.map((value) => ({ value, label: RELATION_LABELS[value] })),
    leave,
    rules: { sickNoLetterMaxDays: rules.sickNoLetterMaxDays, letterGraceDays: rules.letterGraceDays, bereavementDays: rules.bereavementDays },
  };
}

// ---- Isi khas pengajuan (RequestHandler) ----

type AbsenceRow = typeof absenceRequests.$inferSelect;

async function absenceOf(requestId: number, executor: Executor = db): Promise<AbsenceRow | null> {
  const [row] = await executor.select().from(absenceRequests).where(eq(absenceRequests.requestId, requestId));
  return row ?? null;
}

async function daysOf(absenceRequestId: number, executor: Executor = db) {
  return executor.select().from(absenceDays).where(eq(absenceDays.absenceRequestId, absenceRequestId)).orderBy(asc(absenceDays.workDate));
}

async function accountsOf(employeeIds: number[]): Promise<number[]> {
  return [...(await activeHrisAccounts(employeeIds)).values()];
}

/** Akun penyetuju izin/sakit/cuti (HR + Pemilik/GM), tanpa orangnya sendiri. */
async function deciderAccounts(exceptEmployeeId: number): Promise<number[]> {
  const people = new Set([...(await listEmployeesWithAnyAction(['absence.decide'])), ...(await listEmployeesWithAnyAction([]))]);
  people.delete(exceptEmployeeId);
  return accountsOf([...people]);
}

function kindText(row: Pick<AbsenceRow, 'kind' | 'sudden'>): string {
  return `${ABSENCE_KIND_LABELS[row.kind as AbsenceKind]}${row.sudden ? ' (izin mendadak)' : ''}`;
}

/** Bentuknya mengikuti `RequestHandler`; dirangkai di `lib/request-handlers.ts`. */
export const absenceHandler = {
  async prepare(tx: Tx, actor: Actor, input: Record<string, unknown>) {
    const today = wibDate(new Date());
    const onBehalfInput = input.onBehalf === true;
    if (onBehalfInput && input.employeeId === actor.personId) return fail(403, 'Isikan atas nama tidak untuk diri sendiri. Ajukan lewat Pengajuan Saya.');
    const resolved = await resolveSubject(actor, onBehalfInput ? input.employeeId : undefined, today, tx);
    if (!resolved.ok) return resolved;
    const { subject, onBehalf } = resolved;
    let onBehalfReason: string | null = null;
    if (onBehalf) {
      const reason = await checkReason(input.onBehalfReason, 'Alasan diisikan');
      if (!reason.ok) return fail(400, reason.error);
      onBehalfReason = reason.reason;
    }
    const draft = parseDraft(input);
    if ('ok' in draft) return draft;
    await lockPerson(tx, subject.employeeId);
    const planned = await planAbsence(subject, draft, today, tx);
    if (!planned.ok) return planned;
    const { plan } = planned;
    const summary = `${ABSENCE_KIND_LABELS[draft.kind]}${plan.sudden ? ' (izin mendadak)' : ''}: ${rangeText(draft.startDate, plan.endDate)}, ${plan.workdays.length} hari kerja`;
    return {
      ok: true as const,
      data: {
        subjectEmployeeId: subject.employeeId,
        summary,
        dedupeKey: null,
        requiredAttachment: draft.kind === 'SICK_LETTER' && !draft.letterPending ? 'Foto surat dokter' : null,
        save: async (inner: Tx, requestId: number) => {
          const [row] = await inner.insert(absenceRequests).values({
            requestId, employeeId: subject.employeeId, kind: draft.kind, sudden: plan.sudden, startDate: draft.startDate, endDate: plan.endDate,
            relation: draft.kind === 'BEREAVEMENT' ? draft.relation : null, reason: draft.reason || null, letterPending: draft.letterPending,
            origin: onBehalf ? 'ON_BEHALF' : 'SELF', onBehalfReason, createdByAccountId: actor.accountId,
          }).returning();
          await inner.insert(absenceDays).values(plan.workdays.map((workDate) => ({
            absenceRequestId: row.id, employeeId: subject.employeeId, workDate, countKind: plan.countKind,
          })));
          if (plan.leave) {
            const year = await ensureYear(inner, subject.employeeId, plan.leave.year);
            await inner.insert(leaveMovements).values({
              leaveYearId: year.id, kind: 'RESERVE', days: plan.workdays.length, absenceRequestId: row.id, byAccountId: actor.accountId,
            });
          }
          if (onBehalf) {
            await notify(inner, await accountsOf([subject.employeeId]), {
              kind: 'attendance.absence', title: `HR mengisikan ${ABSENCE_KIND_LABELS[draft.kind].toLowerCase()} atas nama Anda`,
              body: `${rangeText(draft.startDate, plan.endDate)}. Alasan diisikan: ${onBehalfReason}`,
              link: `/pengajuan/${requestId}`, entity: 'request', entityId: requestId,
            }, actor.accountId);
          }
        },
      },
    };
  },

  async apply(tx: Tx, actorAccountId: number, requestId: number): Promise<{ ok: true; effect: string } | Fail> {
    const row = await absenceOf(requestId, tx);
    if (!row) return fail(404, 'Isi pengajuan tidak ditemukan.');
    const days = (await daysOf(row.id, tx)).filter((day) => day.active);
    if (!days.length) return fail(409, 'Hari pengajuan ini sudah tidak berlaku. Muat ulang.');
    let leaveText = '';
    if (row.kind === 'ANNUAL_LEAVE') {
      const reserved = await reservedFor(tx, row.id);
      if (reserved && reserved.days > 0) {
        await tx.insert(leaveMovements).values({
          leaveYearId: reserved.yearId, kind: 'USE', days: reserved.days, absenceRequestId: row.id, byAccountId: actorAccountId,
        });
        leaveText = ` Cuti terpakai ${reserved.days} hari.`;
      }
    }
    return { ok: true, effect: `${kindText(row)} tercatat ${days.length} hari kerja: ${days.map((day) => shortDate(day.workDate)).join(', ')}.${leaveText}` };
  },

  /** Ditolak, dibatalkan, atau dicabut: hari dilepas dan cuti yang terpesan dikembalikan (KEH-145). */
  async close(tx: Tx, actorAccountId: number, requestId: number, reason: string) {
    const row = await absenceOf(requestId, tx);
    if (!row) return;
    await tx.update(absenceDays).set({ active: false }).where(and(eq(absenceDays.absenceRequestId, row.id), eq(absenceDays.active, true)));
    const reserved = await reservedFor(tx, row.id);
    if (reserved && reserved.days > 0) {
      await tx.insert(leaveMovements).values({
        leaveYearId: reserved.yearId, kind: 'RETURN', days: reserved.days, absenceRequestId: row.id, byAccountId: actorAccountId, reason,
      });
    }
  },

  /** Batal sesudah disetujui hanya sebelum tanggal mulai (spec L3f §9 butir 3). */
  async cancelApprovedBlock(requestId: number): Promise<string | null> {
    const row = await absenceOf(requestId);
    if (!row) return 'Isi pengajuan tidak ditemukan.';
    return wibDate(new Date()) >= row.startDate
      ? 'Tanggal mulainya sudah tiba, jadi tidak bisa dibatalkan sendiri. Minta HR, Pemilik, atau GM mencabut persetujuannya.'
      : null;
  },

  async effectPreview(requestId: number) {
    const row = await absenceOf(requestId);
    if (!row) return '';
    const days = (await daysOf(row.id)).filter((day) => day.active);
    return `${days.length} hari kerja (${days.map((day) => shortDate(day.workDate)).join(', ')}) tercatat ${kindText(row).toLowerCase()}.`
      + (row.kind === 'ANNUAL_LEAVE' ? ' Jatah cuti yang terpesan menjadi terpakai.' : '')
      + ' Kalau ternyata ada absen masuk di hari itu, statusnya tetap Hadir.';
  },

  async describe(requestId: number, reveal: boolean) {
    const row = await absenceOf(requestId);
    if (!row) return [];
    const days = await daysOf(row.id);
    const active = days.filter((day) => day.active);
    const shown = active.length ? active : days;
    const rows: { label: string; before: string | null; after: string | null }[] = [
      { label: 'Jenis', before: null, after: kindText(row) },
      { label: 'Tanggal', before: null, after: rangeText(row.startDate, row.endDate) },
      { label: 'Hari kerja dihitung', before: null, after: `${shown.length} hari: ${shown.map((day) => shortDate(day.workDate)).join(', ')}` },
    ];
    if (row.relation) rows.push({ label: 'Hubungan', before: null, after: RELATION_LABELS[row.relation as keyof typeof RELATION_LABELS] ?? row.relation });
    if (reveal && row.reason) rows.push({ label: 'Alasan', before: null, after: row.reason });
    if (row.kind === 'SICK_LETTER') {
      const [letter] = await db.select().from(doctorLetters).where(eq(doctorLetters.absenceRequestId, row.id));
      rows.push({
        label: 'Surat dokter', before: null,
        after: !row.letterPending ? 'Terlampir' : letter ? `Menyusul, masuk ${shortDate(wibDate(letter.uploadedAt))}` : 'Menyusul (belum masuk; dihitung sakit tanpa surat)',
      });
    }
    if (row.origin === 'ON_BEHALF') rows.push({ label: 'Diisikan atas nama', before: null, after: row.onBehalfReason });
    if (!reveal) return rows;

    // Keterangan pembantu putusan (KEH-L33).
    const subject = await subjectOn(row.employeeId, row.startDate) ?? await subjectOn(row.employeeId, wibDate(new Date()));
    if (row.kind === 'ANNUAL_LEAVE' && subject) {
      const year = leaveYearOf(subject.joinedOn, row.startDate);
      if (year) {
        const { balance } = await balanceOf(row.employeeId, year);
        const reserved = (await reservedFor(db, row.id))?.days ?? 0;
        rows.push({ label: 'Sisa cuti', before: `${balance + reserved} hari`, after: `${balance} hari` });
        rows.push({ label: 'Tahun cuti', before: null, after: `${longDate(year.start)} – ${longDate(year.end)} (sisa hangus ${longDate(addDays(year.end, 1))})` });
      }
    }
    if (subject && shown.length) {
      const first = shown[0].workDate;
      const last = shown[shown.length - 1].workDate;
      const branchmates = new Map((await rosterOn(first)).filter((person) => person.branchId === subject.branchId && person.employeeId !== row.employeeId)
        .map((person) => [person.employeeId, person.name]));
      const others = (await activeAbsenceDays([...branchmates.keys()], first, last)).filter((day) => shown.some((d) => d.workDate === day.workDate));
      const byDate = new Map<IsoDate, string[]>();
      for (const day of others) byDate.set(day.workDate, [...(byDate.get(day.workDate) ?? []), branchmates.get(day.employeeId) ?? '-']);
      rows.push({
        label: 'Orang lain di cabangnya tidak masuk', before: null,
        after: byDate.size ? [...byDate].map(([date, names]) => `${shortDate(date)}: ${names.length} orang (${names.join(', ')})`).join('; ') : 'Tidak ada',
      });
      const present = await db.execute<{ work_date: string }>(sql`
        select work_date::text as work_date from hris.attendance_days
        where employee_id = ${row.employeeId} and work_date between ${first}::date and ${last}::date`);
      if (present.length) rows.push({ label: 'Absen hari itu', before: null, after: `Ada absen masuk ${present.map((p) => shortDate(p.work_date)).join(', ')}; bentrok, status tetap Hadir` });
    }
    const habit = await habitCounts(row.employeeId, row.startDate, row.id);
    rows.push({ label: 'Izin dan sakit periode ini', before: null, after: `Izin ${habit.current.permit} hari, sakit ${habit.current.sick} hari` });
    rows.push({ label: 'Izin dan sakit periode lalu', before: null, after: `Izin ${habit.previous.permit} hari, sakit ${habit.previous.sick} hari` });
    return rows;
  },

  async resubmitValues(requestId: number) {
    const row = await absenceOf(requestId);
    if (!row) return null;
    return {
      kind: row.kind, startDate: row.startDate, endDate: row.endDate, reason: row.reason ?? '', relation: row.relation ?? '',
      letterPending: row.letterPending,
    };
  },
};

/** Kebiasaan: hari izin dan sakit berlaku pada periode berjalan dan sebelumnya, tanpa pengajuan ini (KEH-L33). */
async function habitCounts(employeeId: number, on: IsoDate, exceptAbsenceId: number) {
  const current = payPeriodOf(on);
  const previousStart = shiftPeriod(current.start, -1);
  const rows = await db.execute<{ work_date: string; count_kind: string }>(sql`
    select d.work_date::text as work_date, d.count_kind::text as count_kind from hris.absence_days d
    where d.employee_id = ${employeeId} and d.active and d.absence_request_id <> ${exceptAbsenceId}
      and d.work_date between ${previousStart}::date and ${current.end}::date`);
  const tally = (from: IsoDate, to: IsoDate) => {
    const inRange = rows.filter((row) => row.work_date >= from && row.work_date <= to);
    return {
      permit: inRange.filter((row) => ['PERMIT', 'PERMIT_SUDDEN', 'BEREAVEMENT'].includes(row.count_kind)).length,
      sick: inRange.filter((row) => row.count_kind === 'SICK' || row.count_kind === 'SICK_LETTER').length,
    };
  };
  return { current: tally(current.start, current.end), previous: tally(previousStart, addDays(current.start, -1)) };
}

/** Foto lampiran pengajuan izin/sakit dibuka selain pengajunya: dicatat (KEH-144). */
export async function logAbsenceAttachmentView(actor: Actor, requestId: number, fileId: string) {
  const row = await absenceOf(requestId);
  if (!row) return;
  const rows = await db.execute<{ submitted_by_account_id: number }>(sql`select submitted_by_account_id from hris.requests where id = ${requestId}`);
  if (row.employeeId === actor.personId || Number(rows[0]?.submitted_by_account_id) === actor.accountId) return;
  await db.insert(doctorLetterViews).values({ fileId, viewerAccountId: actor.accountId });
}

// ---- Surat dokter menyusul (KEH-L32) ----

/** Absen masuk pertama sesudah sakit = masuk kembali (KEH-51). */
async function returnedOn(employeeId: number, after: IsoDate, executor: Executor = db): Promise<IsoDate | null> {
  const rows = await executor.execute<{ d: string | null }>(sql`
    select min(work_date)::text as d from hris.attendance_days where employee_id = ${employeeId} and work_date > ${after}::date`);
  return rows[0]?.d ?? null;
}

async function waitingLetters(employeeIds: number[] | null, executor: Executor = db) {
  const rows = await executor.execute<{ id: number; request_id: number; employee_id: number; start_date: string; end_date: string; status: string }>(sql`
    select a.id, a.request_id, a.employee_id, a.start_date::text as start_date, a.end_date::text as end_date, r.status::text as status
    from hris.absence_requests a join hris.requests r on r.id = a.request_id
    where a.kind = 'SICK_LETTER' and a.letter_pending and r.status in ('PENDING', 'REVIEWED', 'APPROVED')
      and not exists (select 1 from hris.doctor_letters l where l.absence_request_id = a.id)
      ${employeeIds ? sql`and a.employee_id in (${ids(employeeIds.length ? employeeIds : [0])})` : sql``}
    order by a.start_date`);
  return rows.map((row) => ({
    id: Number(row.id), requestId: Number(row.request_id), employeeId: Number(row.employee_id), startDate: row.start_date, endDate: row.end_date,
  }));
}

export async function pendingLettersScreen(actor: Actor | null, now: Date = new Date()) {
  if (!actor) return [];
  const today = wibDate(now);
  const grace = (await absenceRules(today)).letterGraceDays;
  const letters = await waitingLetters([actor.personId]);
  return Promise.all(letters.map(async (letter) => {
    const back = await returnedOn(letter.employeeId, letter.endDate);
    const left = letterDaysLeft(back, today, grace);
    return {
      id: letter.id, requestId: letter.requestId, range: rangeText(letter.startDate, letter.endDate),
      open: left !== null,
      text: !back ? `Batasnya ${grace} hari sesudah Anda masuk kerja kembali.`
        : left === null ? 'Batas menyusulkan sudah lewat; hari itu dicatat sakit tanpa surat.'
          : left === 0 ? 'Hari ini batas terakhir.' : `Tinggal ${left} hari lagi (sampai ${shortDate(letterDeadline(back, grace))}).`,
    };
  }));
}

export async function submitDoctorLetter(actor: Actor | null, absenceId: number, file: File | null, now: Date = new Date())
  : Promise<ServiceResult<{ message: string }> | Fail> {
  if (!actor) return fail(403, FORBIDDEN);
  const today = wibDate(now);
  const letter = (await waitingLetters([actor.personId])).find((row) => row.id === absenceId);
  if (!letter) return fail(404, 'Pengajuan sakit dengan surat menyusul tidak ditemukan.');
  const grace = (await absenceRules(today)).letterGraceDays;
  const back = await returnedOn(letter.employeeId, letter.endDate);
  if (letterDaysLeft(back, today, grace) === null) {
    return fail(409, 'Batas menyusulkan sudah lewat; hari itu dicatat sakit tanpa surat. Bila keberatan, pakai klarifikasi (menyusul).');
  }
  const saved = await saveUpload(actor, file);
  if (!saved.ok) return saved;
  return db.transaction(async (tx) => {
    await lockPerson(tx, letter.employeeId);
    const fresh = (await waitingLetters([actor.personId], tx)).find((row) => row.id === absenceId);
    if (!fresh) return fail(409, 'Surat untuk pengajuan ini sudah masuk.');
    await tx.insert(doctorLetters).values({ absenceRequestId: absenceId, fileId: saved.data.id, uploadedByAccountId: actor.accountId });
    await attachToRequest(tx, letter.requestId, saved.data.id, 'Foto surat dokter (menyusul)');
    // Satu fungsi hitungan yang sama (WAJ-04): hari sakit berlaku dihitung ulang menjadi sakit dengan surat.
    await tx.update(absenceDays).set({ countKind: countKindOf('SICK_LETTER', false, false) })
      .where(and(eq(absenceDays.absenceRequestId, absenceId), eq(absenceDays.active, true), eq(absenceDays.countKind, 'SICK')));
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'request', entityId: letter.requestId, action: 'absence.letter_submit', after: { absenceId },
    });
    return { ok: true as const, data: { message: 'Surat terkirim. Hari sakit Anda dihitung sebagai sakit dengan surat.' } };
  });
}

// ---- Sisa Cuti (KEH-L31) dan Sesuaikan sisa (§9 butir 4) ----

const MOVEMENT_LABELS: Record<LeaveMovementKind, string> = {
  RESERVE: 'Dipesan', USE: 'Dipakai', RETURN: 'Dikembalikan', EXPIRE: 'Hangus', ADJUST: 'Disesuaikan',
};

async function yearDetail(employeeId: number, year: LeaveYear) {
  const { row, quota, balance } = await balanceOf(employeeId, year);
  const moves = row ? await movementsOf([row.id]) : [];
  const statuses = new Map<number, string>();
  const absenceIds = [...new Set(moves.map((m) => m.absenceRequestId).filter((id): id is number => id != null))];
  if (absenceIds.length) {
    const rows = await db.execute<{ id: number; status: string; request_id: number }>(sql`
      select a.id, a.request_id, r.status::text as status from hris.absence_requests a join hris.requests r on r.id = a.request_id
      where a.id in (${ids(absenceIds)})`);
    for (const r of rows) statuses.set(Number(r.id), r.status);
  }
  let reserved = 0;
  let used = 0;
  for (const id of absenceIds) {
    const net = moves.filter((m) => m.absenceRequestId === id && m.kind === 'RESERVE').reduce((s, m) => s + m.days, 0)
      - moves.filter((m) => m.absenceRequestId === id && m.kind === 'RETURN').reduce((s, m) => s + m.days, 0);
    if (net <= 0) continue;
    if (statuses.get(id) === 'APPROVED') used += net;
    else reserved += net;
  }
  return {
    start: year.start, end: year.end, expiresOn: addDays(year.end, 1), quota, balance, reserved, used,
    expired: moves.filter((m) => m.kind === 'EXPIRE').reduce((s, m) => s + m.days, 0),
    adjusted: moves.filter((m) => m.kind === 'ADJUST').reduce((s, m) => s + m.days, 0),
    history: moves.map((m) => ({
      id: m.id, label: `${MOVEMENT_LABELS[m.kind as LeaveMovementKind]} ${m.kind === 'ADJUST' && m.days > 0 ? '+' : ''}${m.days} hari`,
      at: m.createdAt.toISOString(), reason: m.reason,
    })),
  };
}

export async function leaveScreen(actor: Actor | null, employeeId: number | null, now: Date = new Date()) {
  if (!actor) return null;
  const today = wibDate(now);
  const self = employeeId == null || employeeId === actor.personId;
  const subject = await subjectOn(self ? actor.personId : employeeId!, today);
  if (!subject) return null;
  if (!self && !can(actor, 'absence.decide', targetOf(subject)) && !can(actor, 'absence.adjust_leave', targetOf(subject))) return null;
  const problem = eligibilityProblem(subject);
  if (problem) return { tracked: false as const, problem };
  const current = leaveYearOf(subject.joinedOn, today);
  if (!current) {
    return {
      tracked: true as const, name: subject.name, firstDate: firstLeaveDate(subject.joinedOn), quota: (await absenceRules(today)).annualQuota,
      current: null, previous: [], canAdjust: false,
    };
  }
  // Tahun cuti lama (paling banyak 3) dimuat bersama; jumlahnya kecil (PRI-11).
  const previous = [];
  for (let index = current.index - 1; index >= 1 && previous.length < 3; index -= 1) {
    const year = leaveYearOf(subject.joinedOn, addYears(subject.joinedOn, index));
    if (year) previous.push(await yearDetail(subject.employeeId, year));
  }
  return {
    tracked: true as const, name: subject.name, firstDate: null, quota: null,
    current: await yearDetail(subject.employeeId, current), previous,
    canAdjust: !self && can(actor, 'absence.adjust_leave', targetOf(subject)),
  };
}

export async function adjustLeave(actor: Actor | null, input: { employeeId: number; days: number; reason: string }, now: Date = new Date())
  : Promise<ServiceResult<{ balance: number }> | Fail> {
  if (!actor) return fail(403, FORBIDDEN);
  const today = wibDate(now);
  if (!Number.isInteger(input.days) || input.days === 0 || Math.abs(input.days) > 30) return fail(400, 'Isi penyesuaian antara -30 dan 30 hari, bukan 0.');
  const subject = await subjectOn(input.employeeId, today);
  if (eligibilityProblem(subject)) return fail(409, eligibilityProblem(subject)!);
  if (!can(actor, 'absence.adjust_leave', targetOf(subject!))) return fail(403, FORBIDDEN);
  const reason = await checkReason(input.reason, 'Alasan penyesuaian');
  if (!reason.ok) return fail(400, reason.error);
  const year = leaveYearOf(subject!.joinedOn, today);
  if (!year) return fail(409, 'Orang ini belum punya tahun cuti (masa kerja belum 1 tahun).');
  return db.transaction(async (tx) => {
    await lockPerson(tx, subject!.employeeId);
    const row = await ensureYear(tx, subject!.employeeId, year);
    const { balance } = await balanceOf(subject!.employeeId, year, tx);
    if (balance + input.days < 0) return fail(409, `Sisa cuti sekarang ${balance} hari; penyesuaian membuatnya minus.`);
    await tx.insert(leaveMovements).values({ leaveYearId: row.id, kind: 'ADJUST', days: input.days, byAccountId: actor.accountId, reason: reason.reason });
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'employee', entityId: subject!.employeeId, action: 'leave.adjust',
      before: { balance }, after: { balance: balance + input.days }, reason: reason.reason,
    });
    await notify(tx, await accountsOf([subject!.employeeId]), {
      kind: 'attendance.absence', title: `Sisa cuti Anda disesuaikan ${input.days > 0 ? '+' : ''}${input.days} hari`, body: reason.reason, link: '/cuti',
    }, actor.accountId);
    return { ok: true as const, data: { balance: balance + input.days } };
  });
}

// ---- Tab Tidak masuk di Libur Cabang (KEH-L27, KEH-80, 149) ----

export async function absenceCalendar(actor: Actor, branchId: number, periodStart: IsoDate) {
  const { start: from, end: to } = periodRange(periodStart);
  const people = (await rosterOn(from)).filter((person) => person.branchId === branchId && person.mode === 'QR'
    && can(actor, 'attendance.dayoff.view', targetOf(person)));
  const names = new Map(people.map((person) => [person.employeeId, person]));
  const rows = await activeAbsenceDays([...names.keys()], from, to);
  const byDate = new Map<IsoDate, { name: string; status: string; kind: string | null; requestId: number | null }[]>();
  for (const row of rows) {
    const person = names.get(row.employeeId)!;
    // Jenis dan pengajuannya hanya untuk HR, Pemilik, GM (KEH-42, 80).
    const detail = can(actor, 'absence.decide', targetOf(person));
    byDate.set(row.workDate, [...(byDate.get(row.workDate) ?? []), {
      name: person.name, status: row.status === 'APPROVED' ? 'Disetujui' : 'Menunggu',
      kind: detail ? ABSENCE_COUNT_LABELS[row.countKind as AbsenceCount] : null, requestId: detail ? row.requestId : null,
    }]);
  }
  return datesBetween(from, to).map((date) => ({ date, label: shortDate(date), people: byDate.get(date) ?? [] })).filter((day) => day.people.length);
}

// ---- Status hari & catatan untuk layar lain ----

/** Status Izin/Sakit/Cuti per `orang|tanggal` dari pengajuan Disetujui, dan yang masih Menunggu (KEH-118, 147). */
export async function absenceDayStatuses(employeeIds: number[], from: IsoDate, to: IsoDate, executor: Executor = db) {
  const rows = await activeAbsenceDays(employeeIds, from, to, executor);
  const approved = new Map<string, AbsenceCount>();
  const waiting = new Set<string>();
  for (const row of rows) {
    const key = `${row.employeeId}|${row.workDate}`;
    if (row.status === 'APPROVED') approved.set(key, row.countKind as AbsenceCount);
    else waiting.add(key);
  }
  return { approved, waiting };
}

/** Kalimat untuk layar Absen: "Hari ini Anda tercatat sakit" (tombol Masuk tetap aktif, KEH-118). */
export async function absenceToday(employeeId: number, on: IsoDate, executor: Executor = db): Promise<string | null> {
  const [row] = await activeAbsenceDays([employeeId], on, on, executor);
  if (!row) return null;
  const label = ABSENCE_COUNT_LABELS[row.countKind as AbsenceCount].toLowerCase();
  return row.status === 'APPROVED'
    ? `Hari ini Anda tercatat ${label}. Kalau tetap masuk, absen seperti biasa; hari ini menjadi Hadir.`
    : `Pengajuan ${label} untuk hari ini masih menunggu keputusan. Hari ini tidak ditandai alpha selama menunggu.`;
}

export type AbsenceCard = { key: string; title: string; detail?: string; href: string };

export async function absenceAttention(actor: Actor | null, now: Date = new Date()): Promise<AbsenceCard[]> {
  if (!actor) return [];
  const cards: AbsenceCard[] = [];
  for (const letter of await pendingLettersScreen(actor, now)) {
    if (!letter.open) continue;
    cards.push({ key: `letter-${letter.id}`, title: 'Surat dokter belum disusulkan', detail: `Sakit ${letter.range}. ${letter.text}`, href: '/tidak-masuk/surat-dokter' });
  }
  if (can(actor, 'absence.decide')) {
    const today = wibDate(now);
    const rows = await db.execute<{ n: number }>(sql`
      select count(*)::int as n from hris.absence_requests a join hris.requests r on r.id = a.request_id
      where r.status in ('PENDING', 'REVIEWED') and a.start_date <= ${today}::date and a.employee_id <> ${actor.personId}`);
    const count = Number(rows[0]?.n ?? 0);
    if (count) cards.push({ key: 'absence-due', title: `${count} pengajuan izin/sakit/cuti menunggu, tanggalnya sudah tiba`, href: '/persetujuan' });
  }
  return cards;
}

// ---- Penolakan libur dan tukar di tanggal izin (catatan L3e §10) ----

/** Pesan bila salah satu orang punya izin, sakit, atau cuti berlaku di tanggal yang akan menjadi liburnya/shiftnya. */
export async function absenceClash(pairs: { employeeId: number; date: IsoDate }[], executor: Executor = db): Promise<string | null> {
  for (const pair of pairs) {
    if ((await activeAbsenceDays([pair.employeeId], pair.date, pair.date, executor)).length) {
      return `${shortDate(pair.date)} sudah berisi izin, sakit, atau cuti, jadi tidak bisa dipakai untuk libur atau tukar.`;
    }
  }
  return null;
}

// ---- Mesin harian `absence-daily` (spec L3f §6) ----

async function noticeOnce(tx: Tx, ref: string): Promise<boolean> {
  const rows = await tx.insert(absenceNotices).values({ ref }).onConflictDoNothing().returning({ ref: absenceNotices.ref });
  return rows.length > 0;
}

export async function runAbsenceDaily(now: Date = new Date()) {
  const today = wibDate(now);
  const result = { expiredYears: 0, openedYears: 0, letterReminders: 0, dueReminders: 0, expiryNotices: 0 };

  // 1. Penutup tahun cuti: sisa hangus sekali (kunci unik), lalu buka tahun berikutnya untuk yang masih aktif.
  const ended = await db.select().from(leaveYears).where(lte(leaveYears.endDate, addDays(today, -1)));
  for (const year of ended) {
    await db.transaction(async (tx) => {
      await lockPerson(tx, year.employeeId);
      const moves = await movementsOf([year.id], tx);
      if (moves.some((m) => m.kind === 'EXPIRE')) return;
      const balance = leaveBalance(year.quota, moves.map((m) => ({ kind: m.kind as LeaveMovementKind, days: m.days })));
      await tx.insert(leaveMovements).values({ leaveYearId: year.id, kind: 'EXPIRE', days: Math.max(0, balance), reason: 'Akhir tahun cuti' }).onConflictDoNothing();
      result.expiredYears += 1;
    });
  }
  const roster = await rosterOn(today);
  for (const person of roster.filter((row) => row.mode === 'QR')) {
    const subject = await subjectOn(person.employeeId, today);
    if (!subject || eligibilityProblem(subject)) continue;
    const year = leaveYearOf(subject.joinedOn, today);
    if (!year || await yearRow(subject.employeeId, year.start)) continue;
    await db.transaction(async (tx) => { await ensureYear(tx, subject.employeeId, year); });
    result.openedYears += 1;
  }

  // 2. Surat menyusul tinggal 1 hari: sekali per pengajuan.
  const grace = (await absenceRules(today)).letterGraceDays;
  for (const letter of await waitingLetters(null)) {
    const back = await returnedOn(letter.employeeId, letter.endDate);
    if (letterDaysLeft(back, today, grace) !== 1) continue;
    await db.transaction(async (tx) => {
      if (!(await noticeOnce(tx, `letter:${letter.id}`))) return;
      await notify(tx, await accountsOf([letter.employeeId]), {
        kind: 'attendance.absence', title: 'Surat dokter tinggal 1 hari lagi',
        body: `Sakit ${rangeText(letter.startDate, letter.endDate)}. Lewat batas, hari itu dicatat sakit tanpa surat.`, link: '/tidak-masuk/surat-dokter',
      }, null);
      result.letterReminders += 1;
    });
  }

  // 3. Pengajuan masih menunggu saat tanggal mulainya tiba (KEH-147): penyetuju diberi tahu sekali.
  const due = await db.execute<{ request_id: number; employee_id: number; name: string }>(sql`
    select a.request_id, a.employee_id, e.name from hris.absence_requests a
    join hris.requests r on r.id = a.request_id join hris.employees e on e.id = a.employee_id
    where r.status in ('PENDING', 'REVIEWED') and a.start_date <= ${today}::date`);
  for (const row of due) {
    const recipients = await deciderAccounts(Number(row.employee_id));
    await db.transaction(async (tx) => {
      if (!(await noticeOnce(tx, `due:${row.request_id}`))) return;
      await notify(tx, recipients, {
        kind: 'attendance.absence', title: `Pengajuan tidak masuk ${row.name} masih menunggu, tanggalnya sudah tiba`,
        body: 'Selama menunggu, hari itu tidak ditandai alpha.', link: `/persetujuan/${row.request_id}`, entity: 'request', entityId: Number(row.request_id),
      }, null);
      result.dueReminders += 1;
    });
  }

  // 4. Sisa cuti hangus 30 hari lagi (spec L3f §9 butir 8).
  const ending = await db.select().from(leaveYears).where(eq(leaveYears.endDate, addDays(today, 30)));
  for (const year of ending) {
    const moves = await movementsOf([year.id]);
    const balance = leaveBalance(year.quota, moves.map((m) => ({ kind: m.kind as LeaveMovementKind, days: m.days })));
    if (balance <= 0) continue;
    await db.transaction(async (tx) => {
      if (!(await noticeOnce(tx, `expire:${year.id}`))) return;
      await notify(tx, await accountsOf([year.employeeId]), {
        kind: 'attendance.absence', title: `Sisa cuti ${balance} hari hangus ${longDate(addDays(year.endDate, 1))}`,
        body: 'Sisa cuti yang tidak dipakai sampai akhir tahun cutinya hangus dan tidak diganti uang.', link: '/cuti',
      }, null);
      result.expiryNotices += 1;
    });
  }
  return result;
}
