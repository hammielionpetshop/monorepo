import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import {
  attendanceCorrections, attendanceDays, attendancePatternFlags, attendancePatternSeen, attendancePhotoPurges, attendanceRecords,
  attendanceReviews, branchClosures,
} from '@petshop/hris-db/schema/attendance';
import { db } from '@/lib/db';
import { can, getOrgLookup, hasAction, type Actor, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { notify } from '@/modules/notifications';
import { checkReason, settingOn } from '@/modules/settings';
import { KIND_LABELS, wibClock, wibDate, type AttendanceKind } from '../rules/attendance';
import {
  CORRECTION_REASON_LABELS, DAY_STATUS_LABELS, EMPTY_STATE, EMPTY_TOTALS, countableDates, correctionProblem, dayStatus, effectiveDay, payPeriodOf,
  recomputeMinutes, repeatOutsideHit, sameState, sharedPointPairs, shiftPeriod, summarizeDays, addTotals, withinTolerance, wibLocal,
  type CorrectionReason, type CorrectionState, type DayState, type DayStatus, type EffectiveDay, type PatternKind, type RecapTotals,
  type ReviewOutcome,
} from '../rules/review';
import { addDays, closureCovers, versionOn, type IsoDate } from '../rules/schedule';
import type { ReportState } from '../rules/end-of-day';
import { reportStates } from './end-of-day';
import { activeDayOffKeys, loadShifts, rosterOn, type Executor, type RosterPerson } from './read';

const fail = (status: 400 | 403 | 404 | 409, error: string) => ({ ok: false as const, status, error });
const FORBIDDEN = 'Anda tidak berhak melakukan tindakan ini.';
const STALE = 'Absen ini baru saja diubah orang lain. Muat ulang.';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ITEMS = 200;

type DayRow = typeof attendanceDays.$inferSelect;
type RecordRow = typeof attendanceRecords.$inferSelect;
type CorrectionRow = typeof attendanceCorrections.$inferSelect;
type ReviewRow = typeof attendanceReviews.$inferSelect;

const yes = (value: unknown) => value === 'YES';

// ---- Pemuat bersama: satu sumber angka untuk semua layar (KEH-76) ----

export type DayInfo = {
  employeeId: number;
  workDate: IsoDate;
  day: DayRow | null;
  records: Partial<Record<AttendanceKind, RecordRow>>;
  corrections: CorrectionRow[];
  effective: EffectiveDay;
  pendingReviews: number;
  /** Keadaan Laporan Pulang (spec L3d §3). */
  report: ReportState;
};

const dayKey = (employeeId: number, workDate: IsoDate) => `${employeeId}|${workDate}`;

function correctionState(row: CorrectionRow): CorrectionState {
  return {
    id: row.id, branchId: row.branchId, shiftId: row.shiftId, shiftVersionId: row.shiftVersionId, inAt: row.inAt, outAt: row.outAt,
    lateMinutes: row.lateMinutes, earlyLeaveMinutes: row.earlyLeaveMinutes,
  };
}

/** Pulang baru dihitung bila Laporan Pulangnya terkirim (KEH-89, spec L3d §2); jam tetap jam foto. */
function originalState(day: DayRow | null, records: Partial<Record<AttendanceKind, RecordRow>>, reported: boolean) {
  if (!day || !records.IN) return null;
  const out = reported ? records.OUT?.recordedAt ?? null : null;
  return {
    branchId: day.branchId, shiftId: day.shiftId, shiftVersionId: day.shiftVersionId, inAt: records.IN.recordedAt,
    outAt: out, lateMinutes: day.lateMinutes, earlyLeaveMinutes: out ? day.earlyLeaveMinutes : null,
  };
}

/** Putusan terbaru per catatan absen. */
async function latestReviews(recordIds: number[], executor: Executor = db): Promise<Map<number, ReviewRow>> {
  if (!recordIds.length) return new Map();
  const rows = await executor.select().from(attendanceReviews).where(inArray(attendanceReviews.recordId, recordIds)).orderBy(asc(attendanceReviews.id));
  return new Map(rows.map((row) => [row.recordId, row]));
}

/** Hari kerja orang-orang dalam rentang tanggal, sudah digabung koreksi. Kunci `orang|tanggal`. */
export async function loadDayInfos(
  employeeIds: number[], from: IsoDate, to: IsoDate, executor: Executor = db, now: Date = new Date(),
): Promise<Map<string, DayInfo>> {
  const result = new Map<string, DayInfo>();
  if (!employeeIds.length) return result;
  const people = [...new Set(employeeIds)];
  const [days, corrections] = await Promise.all([
    executor.select().from(attendanceDays).where(and(
      inArray(attendanceDays.employeeId, people), gte(attendanceDays.workDate, from), lte(attendanceDays.workDate, to),
    )),
    executor.select().from(attendanceCorrections).where(and(
      inArray(attendanceCorrections.employeeId, people), gte(attendanceCorrections.workDate, from), lte(attendanceCorrections.workDate, to),
    )).orderBy(asc(attendanceCorrections.id)),
  ]);
  const records = days.length
    ? await executor.select().from(attendanceRecords).where(inArray(attendanceRecords.dayId, days.map((day) => day.id))) : [];
  const reviews = await latestReviews(records.filter((row) => row.needsReview).map((row) => row.id), executor);
  const ensure = (employeeId: number, workDate: IsoDate) => {
    const key = dayKey(employeeId, workDate);
    let info = result.get(key);
    if (!info) {
      info = { employeeId, workDate, day: null, records: {}, corrections: [], effective: effectiveDay(null, []), pendingReviews: 0, report: 'NONE' };
      result.set(key, info);
    }
    return info;
  };
  const byDay = new Map(days.map((day) => [day.id, ensure(day.employeeId, day.workDate)]));
  for (const day of days) byDay.get(day.id)!.day = day;
  for (const record of records) {
    const info = byDay.get(record.dayId)!;
    info.records[record.kind as AttendanceKind] = record;
    if (record.needsReview && !reviews.has(record.id)) info.pendingReviews += 1;
  }
  for (const row of corrections) ensure(row.employeeId, row.workDate).corrections.push(row);
  const states = await reportStates([...result.values()].filter((info) => info.day).map((info) => ({
    dayId: info.day!.id, workDate: info.workDate, hasOut: Boolean(info.records.OUT),
  })), now, executor);
  for (const info of result.values()) {
    info.report = info.day ? states.get(info.day.id) ?? 'NONE' : 'NONE';
    info.effective = effectiveDay(originalState(info.day, info.records, info.report === 'SENT'), info.corrections.map(correctionState));
  }
  return result;
}

async function closuresBetween(from: IsoDate, to: IsoDate, executor: Executor = db) {
  return executor.select().from(branchClosures).where(and(
    isNull(branchClosures.cancelledAt), lte(branchClosures.startDate, to), gte(branchClosures.endDate, from),
  ));
}

async function joinedOn(employeeIds: number[], executor: Executor = db): Promise<Map<number, IsoDate>> {
  if (!employeeIds.length) return new Map();
  const rows = await executor.execute<{ id: number; joined_on: string }>(
    sql`select id, joined_on from hris.employees where id in (${sql.join([...new Set(employeeIds)].map((id) => sql`${id}`), sql`, `)})`,
  );
  return new Map(rows.map((row) => [Number(row.id), String(row.joined_on).slice(0, 10)]));
}

async function peopleNames(ids: number[], executor: Executor = db) {
  if (!ids.length) return new Map<number, string>();
  const rows = await executor.execute<{ id: number; name: string }>(
    sql`select id, name from hris.employees where id in (${sql.join([...new Set(ids)].map((id) => sql`${id}`), sql`, `)})`,
  );
  return new Map(rows.map((row) => [Number(row.id), row.name]));
}

/** Nama orang di balik akun pusat (sama dengan layar Pengaturan). */
async function accountNames(ids: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const rows = await db.execute<{ account_id: number; name: string }>(sql`
    select l.account_id, e.name from auth.account_links l join hris.employees e on e.id = l.local_user_id
    where l.app_code = 'hris' and l.account_id in (${sql.join(unique.map((id) => sql`${id}`), sql`, `)})`);
  return new Map(rows.map((row) => [Number(row.account_id), row.name]));
}

async function branchLabels() {
  const org = await getOrgLookup();
  return {
    branches: org.branches.filter((branch) => branch.active).map(({ id, name }) => ({ id, name })),
    label: (id: number | null) => (id == null ? '-' : org.branches.find((branch) => branch.id === id)?.name ?? '-'),
  };
}

/** Orang pada tanggal itu: penempatannya (untuk lingkup hak) dan cara absennya. */
async function personOn(employeeId: number, on: IsoDate, executor: Executor = db): Promise<RosterPerson | null> {
  return (await rosterOn(on, executor)).find((person) => person.employeeId === employeeId) ?? null;
}

const targetOf = (person: RosterPerson) => ({ personId: person.employeeId, branchId: person.branchId, departmentId: person.departmentId });

async function versionHours(shiftId: number | null, shiftVersionId: number | null, executor: Executor = db) {
  if (!shiftId || !shiftVersionId) return null;
  const [shift] = await loadShifts(null, executor).then((rows) => rows.filter((row) => row.id === shiftId));
  return shift?.versions.find((version) => version.id === shiftVersionId) ?? null;
}

const clockOrDash = (at: Date | null) => (at ? wibClock(at) : '-');

// ---- Catatan Hari Kerja (KEH-L15) ----

export type DayCard = {
  employeeId: number; name: string; workDate: IsoDate; status: DayStatus; statusLabel: string; source: string;
  branch: string; shift: string | null; hours: string | null;
  times: { IN: string; BREAK: string; RETURN: string; OUT: string };
  lateMinutes: number | null; earlyLeaveMinutes: number | null; breakOverMinutes: number | null;
  inTolerance: boolean; pendingReviews: number;
  tags: string[];
  corrected: boolean;
};

/** Kartu satu hari dari keadaan berlaku. `office` = boleh melihat tanda toleransi (KEH-119). */
async function buildCard(
  info: DayInfo | undefined, employeeId: number, name: string, workDate: IsoDate, fallbackBranchId: number,
  closures: Awaited<ReturnType<typeof closuresBetween>>, tolerance: number, office: boolean,
  label: (id: number | null) => string, shifts: Awaited<ReturnType<typeof loadShifts>>, dayOffs: ReadonlySet<string>,
): Promise<DayCard> {
  const effective = info?.effective ?? effectiveDay(null, []);
  const state = effective.state;
  const branchId = state.branchId ?? fallbackBranchId;
  const closed = closures.some((closure) => closureCovers(closure, branchId, workDate));
  const status = dayStatus(Boolean(state.inAt), closed, dayOffs.has(dayKey(employeeId, workDate)));
  const shift = shifts.find((row) => row.id === state.shiftId);
  const version = shift?.versions.find((row) => row.id === state.shiftVersionId);
  const corrected = effective.correctionId != null;
  const tags: string[] = [];
  if (corrected) tags.push(info?.day ? 'Dikoreksi' : 'Ditambahkan HR');
  if (info?.day?.aloneNoBreak) tags.push('Tidak istirahat karena sendiri');
  if (status === 'PRESENT' && !state.shiftId) tags.push('Shift belum ditentukan');
  if (status === 'PRESENT' && dayOffs.has(dayKey(employeeId, workDate))) tags.push('Masuk di hari libur');
  if (info?.pendingReviews) tags.push('Perlu ditinjau');
  if (!corrected && info?.report === 'PENDING') tags.push('Laporan Pulang menunggu');
  if (!corrected && info?.report === 'MISSED') tags.push('Laporan pulang tidak terkirim');
  const records = info?.records ?? {};
  return {
    employeeId, name, workDate, status, statusLabel: DAY_STATUS_LABELS[status],
    source: status === 'PRESENT' ? (corrected ? 'Koreksi HR' : 'Absen') : status === 'CLOSED' ? 'Hari tutup' : status === 'DAY_OFF' ? 'Libur' : '-',
    branch: label(branchId), shift: shift?.name ?? null, hours: version ? `${version.startTime}–${version.endTime}` : null,
    times: {
      IN: clockOrDash(state.inAt), BREAK: clockOrDash(records.BREAK?.recordedAt ?? null),
      RETURN: clockOrDash(records.RETURN?.recordedAt ?? null), OUT: clockOrDash(state.outAt),
    },
    lateMinutes: effective.lateMinutes, earlyLeaveMinutes: effective.earlyLeaveMinutes, breakOverMinutes: info?.day?.breakOverMinutes ?? null,
    inTolerance: office && withinTolerance(effective.lateMinutes, tolerance), pendingReviews: info?.pendingReviews ?? 0,
    tags, corrected,
  };
}

async function correctionHistoryRows(rows: CorrectionRow[], label: (id: number | null) => string) {
  const [names, by] = await Promise.all([peopleNames(rows.map((row) => row.employeeId)), accountNames(rows.map((row) => row.createdByAccountId))]);
  const shifts = await loadShifts(null);
  const shiftName = (id: number | null) => shifts.find((shift) => shift.id === id)?.name ?? '-';
  const describe = (branchId: number | null, shiftId: number | null, inAt: Date | null, outAt: Date | null) => (
    inAt ? `${label(branchId)} · ${shiftName(shiftId)} · ${wibClock(inAt)}–${outAt ? wibClock(outAt) : '?'}` : 'Tanpa absen'
  );
  return rows.map((row) => ({
    id: row.id, employeeId: row.employeeId, name: names.get(row.employeeId) ?? '-', workDate: row.workDate,
    before: describe(row.prevBranchId, row.prevShiftId, row.prevInAt, row.prevOutAt),
    after: describe(row.branchId, row.shiftId, row.inAt, row.outAt),
    lateMinutes: row.lateMinutes, reason: CORRECTION_REASON_LABELS[row.reasonCode as CorrectionReason], note: row.note,
    reversesId: row.reversesId, batch: row.batchId != null,
    by: by.get(row.createdByAccountId) ?? `Akun #${row.createdByAccountId}`,
    at: row.createdAt.toISOString(),
  }));
}

export async function dayRecordScreen(actor: Actor, input: { employeeId: number | null; date: IsoDate | null }, now: Date = new Date()) {
  const today = wibDate(now);
  const date = input.date && ISO.test(input.date) && input.date <= today ? input.date : addDays(today, -1);
  const roster = (await rosterOn(date)).filter((person) => person.mode === 'QR' && can(actor, 'attendance.recap.view', targetOf(person)));
  const { label } = await branchLabels();
  const base = { date, people: roster.map(({ employeeId, name }) => ({ id: employeeId, name })), card: null as DayCard | null, history: [] as Awaited<ReturnType<typeof correctionHistoryRows>>, canCorrect: false };
  const person = roster.find((row) => row.employeeId === input.employeeId);
  if (!person) return { ...base, employeeId: null };
  const [infos, closures, tolerance, shifts, dayOffs] = await Promise.all([
    loadDayInfos([person.employeeId], date, date, db, now), closuresBetween(date, date),
    settingOn<number>('attendance.late_tolerance_minutes', date), loadShifts(null), activeDayOffKeys([person.employeeId], date, date),
  ]);
  const info = infos.get(dayKey(person.employeeId, date));
  const card = await buildCard(info, person.employeeId, person.name, date, person.branchId, closures, tolerance, true, label, shifts, dayOffs);
  return {
    ...base, employeeId: person.employeeId, card,
    history: await correctionHistoryRows([...(info?.corrections ?? [])].reverse(), label),
    canCorrect: can(actor, 'attendance.correction.create', targetOf(person)),
  };
}

// ---- Rekap Kehadiran (KEH-L16) dan Kehadiran Saya (KEH-L17) ----

function periodOptions(today: IsoDate) {
  const current = payPeriodOf(today).start;
  return Array.from({ length: 12 }, (_, index) => {
    const start = shiftPeriod(current, -index);
    return { start, end: addDays(shiftPeriod(start, 1), -1) };
  });
}

function pickPeriod(start: string | null, today: IsoDate) {
  const options = periodOptions(today);
  return { options, period: options.find((option) => option.start === start) ?? options[0] };
}

async function personDays(
  people: RosterPerson[], period: { start: IsoDate; end: IsoDate }, today: IsoDate, office: boolean, now: Date = new Date(),
) {
  const [infos, closures, tolerance, joined, shifts, { label }, dayOffs] = await Promise.all([
    loadDayInfos(people.map((person) => person.employeeId), period.start, period.end, db, now),
    closuresBetween(period.start, period.end),
    settingOn<number>('attendance.late_tolerance_minutes', today),
    joinedOn(people.map((person) => person.employeeId)),
    loadShifts(null),
    branchLabels(),
    activeDayOffKeys(people.map((person) => person.employeeId), period.start, period.end),
  ]);
  const result = new Map<number, DayCard[]>();
  for (const person of people) {
    const cards: DayCard[] = [];
    for (const date of countableDates(period.start, period.end, today, joined.get(person.employeeId) ?? null)) {
      cards.push(await buildCard(infos.get(dayKey(person.employeeId, date)), person.employeeId, person.name, date, person.branchId, closures, tolerance, office, label, shifts, dayOffs));
    }
    result.set(person.employeeId, cards);
  }
  return result;
}

const totalsOf = (cards: DayCard[]) => summarizeDays(cards.map((card) => ({
  status: card.status, lateMinutes: card.lateMinutes, earlyLeaveMinutes: card.earlyLeaveMinutes, pendingReviews: card.pendingReviews,
})));

export async function recapScreen(actor: Actor, input: { period: string | null; branchId: number | null; employeeId: number | null }, now: Date = new Date()) {
  const today = wibDate(now);
  const { options, period } = pickPeriod(input.period, today);
  const asOf = period.end < today ? period.end : today;
  const { branches } = await branchLabels();
  const people = (await rosterOn(asOf)).filter((person) => person.mode === 'QR'
    && (input.branchId == null || person.branchId === input.branchId)
    && can(actor, 'attendance.recap.view', targetOf(person)));
  const days = await personDays(people, period, today, true, now);
  const rows = people.map((person) => ({ employeeId: person.employeeId, name: person.name, totals: totalsOf(days.get(person.employeeId) ?? []) }));
  const empty: RecapTotals = { ...EMPTY_TOTALS };
  const selected = people.find((person) => person.employeeId === input.employeeId);
  return {
    period, periods: options, branchId: input.branchId, branches, rows,
    summary: rows.reduce((sum, row) => addTotals(sum, row.totals), empty),
    selected: selected ? { employeeId: selected.employeeId, name: selected.name, days: days.get(selected.employeeId) ?? [] } : null,
  };
}

export async function myAttendanceScreen(actor: Actor, periodStart: string | null, now: Date = new Date()) {
  const today = wibDate(now);
  const me = await personOn(actor.personId, today);
  if (!me || me.mode !== 'QR' || !can(actor, 'attendance.my_recap.view', { personId: actor.personId })) return { tracked: false as const };
  const { options, period } = pickPeriod(periodStart, today);
  const cards = (await personDays([me], period, today, false, now)).get(me.employeeId) ?? [];
  const infos = await loadDayInfos([me.employeeId], period.start, period.end, db, now);
  const notes = new Map<string, string>();
  for (const info of infos.values()) {
    const latest = info.corrections.at(-1);
    if (latest) notes.set(info.workDate, `Dibetulkan HR: ${CORRECTION_REASON_LABELS[latest.reasonCode as CorrectionReason]}. ${latest.note}`);
  }
  return {
    tracked: true as const, period, periods: options, totals: totalsOf(cards),
    days: [...cards].reverse().map((card) => ({ ...card, note: notes.get(card.workDate) ?? null })),
  };
}

// ---- Koreksi Absen (KEH-L13) ----

type ShiftOption = { id: number; name: string; versionId: number; hours: string; startTime: string; endTime: string };

async function shiftOptionsOn(on: IsoDate, executor: Executor = db): Promise<Map<number, ShiftOption[]>> {
  const map = new Map<number, ShiftOption[]>();
  for (const shift of await loadShifts(null, executor)) {
    if (!shift.active) continue;
    const version = versionOn(shift.versions, on);
    if (!version) continue;
    const list = map.get(shift.branchId) ?? [];
    list.push({ id: shift.id, name: shift.name, versionId: version.id, hours: `${version.startTime}–${version.endTime}`, startTime: version.startTime, endTime: version.endTime });
    map.set(shift.branchId, list);
  }
  return map;
}

const localOf = (at: Date | null) => (at ? new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 16) : '');

export type CorrectionPerson = {
  employeeId: number; name: string; canCorrect: boolean; baseCorrectionId: number | null;
  current: { branchId: number | null; shiftId: number | null; inAt: string; outAt: string; summary: string };
  defaultBranchId: number;
  /** Untuk hitung ulang di langkah Periksa; server menghitung ulang lagi saat menyimpan. */
  lateApplies: boolean;
};

export async function correctionScreen(actor: Actor, input: {
  mode: 'one' | 'many'; employeeId: number | null; branchId: number | null; date: string | null;
}, now: Date = new Date()) {
  const today = wibDate(now);
  const date = input.date && ISO.test(input.date) && input.date <= today ? input.date : today;
  const { branches, label } = await branchLabels();
  const roster = (await rosterOn(date)).filter((person) => person.mode === 'QR');
  const correctable = roster.filter((person) => can(actor, 'attendance.correction.create', targetOf(person)));
  const options = await shiftOptionsOn(date);
  const shifts = await loadShifts(null);
  const shiftName = (id: number | null) => shifts.find((shift) => shift.id === id)?.name ?? 'Belum ditentukan';

  let chosen: RosterPerson[] = [];
  if (input.mode === 'one') {
    const person = roster.find((row) => row.employeeId === input.employeeId);
    if (person) chosen = [person];
  } else if (input.branchId != null) {
    const days = await db.select({ employeeId: attendanceDays.employeeId }).from(attendanceDays)
      .where(and(eq(attendanceDays.workDate, date), eq(attendanceDays.branchId, input.branchId)));
    const visiting = new Set(days.map((row) => row.employeeId));
    chosen = roster.filter((person) => person.branchId === input.branchId || visiting.has(person.employeeId));
  }
  const infos = await loadDayInfos(chosen.map((person) => person.employeeId), date, date, db, now);
  const lateApplies = new Map<number, boolean>();
  for (const person of chosen) {
    const positionId = infos.get(dayKey(person.employeeId, date))?.day?.positionId ?? person.positionId;
    lateApplies.set(person.employeeId, yes(await settingOn<string>('position.late_applies', date, { positionId })));
  }
  const people: CorrectionPerson[] = chosen.map((person) => {
    const info = infos.get(dayKey(person.employeeId, date));
    const state = info?.effective.state ?? EMPTY_STATE;
    return {
      employeeId: person.employeeId, name: person.name, canCorrect: can(actor, 'attendance.correction.create', targetOf(person)),
      baseCorrectionId: info?.effective.correctionId ?? null,
      current: {
        branchId: state.branchId, shiftId: state.shiftId, inAt: localOf(state.inAt), outAt: localOf(state.outAt),
        summary: state.inAt ? `${label(state.branchId)} · ${shiftName(state.shiftId)} · ${wibClock(state.inAt)}–${state.outAt ? wibClock(state.outAt) : '?'}` : 'Tanpa absen',
      },
      defaultBranchId: state.branchId ?? person.branchId,
      lateApplies: lateApplies.get(person.employeeId) ?? false,
    };
  });
  return {
    mode: input.mode, date, today, branchId: input.branchId, employeeId: input.employeeId, branches,
    candidates: correctable.map(({ employeeId, name }) => ({ id: employeeId, name })),
    shiftOptions: Object.fromEntries([...options.entries()].map(([branchId, list]) => [branchId, list.map(({ id, name, hours, startTime, endTime }) => ({ id, name, hours, startTime, endTime }))])),
    people,
    reasons: Object.entries(CORRECTION_REASON_LABELS).map(([value, text]) => ({ value, label: text })),
  };
}

export async function correctionHistoryScreen(actor: Actor, input: { branchId: number | null; period: string | null; q: string }, now: Date = new Date()) {
  const today = wibDate(now);
  const { options, period } = pickPeriod(input.period, today);
  const { branches, label } = await branchLabels();
  if (!hasAction(actor, 'attendance.correction.view')) return { period, periods: options, branches, branchId: input.branchId, q: input.q, rows: [] };
  const all = await db.select().from(attendanceCorrections).where(and(
    gte(attendanceCorrections.workDate, period.start), lte(attendanceCorrections.workDate, period.end),
  )).orderBy(desc(attendanceCorrections.id)).limit(1000);
  // Hanya koreksi terakhir per orang + tanggal yang bisa dibalik (urutan menurun: yang pertama ditemui = terakhir).
  const latest = new Set<number>();
  const seenDays = new Set<string>();
  for (const row of all) {
    const key = dayKey(row.employeeId, row.workDate);
    if (!seenDays.has(key)) latest.add(row.id);
    seenDays.add(key);
  }
  const rows = all.filter((row) => input.branchId == null || row.branchId === input.branchId || row.prevBranchId === input.branchId);
  const list = await correctionHistoryRows(rows, label);
  const q = input.q.trim().toLowerCase();
  return {
    period, periods: options, branches, branchId: input.branchId, q: input.q,
    rows: list.filter((row) => !q || row.name.toLowerCase().includes(q)).map((row) => ({
      ...row, canReverse: latest.has(row.id) && can(actor, 'attendance.correction.create', { personId: row.employeeId }),
    })),
  };
}

export type CorrectionItem = {
  employeeId: number; branchId: number; shiftId: number | null; inAt: string; outAt: string | null; baseCorrectionId: number | null;
};

export type CorrectionInput = {
  workDate: string; batchBranchId: number | null; reasonCode: CorrectionReason; note: string; items: CorrectionItem[];
};

async function lockDay(tx: Tx, employeeId: number, workDate: IsoDate) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`attendance.day.${workDate}`}), ${employeeId})`);
}

async function latestCorrection(employeeId: number, workDate: IsoDate, executor: Executor): Promise<CorrectionRow | null> {
  const [row] = await executor.select().from(attendanceCorrections).where(and(
    eq(attendanceCorrections.employeeId, employeeId), eq(attendanceCorrections.workDate, workDate),
  )).orderBy(desc(attendanceCorrections.id)).limit(1);
  return row ?? null;
}

const prevColumns = (state: DayState) => ({
  prevBranchId: state.branchId, prevShiftId: state.shiftId, prevShiftVersionId: state.shiftVersionId, prevInAt: state.inAt, prevOutAt: state.outAt,
});

async function notifyCorrected(tx: Tx, employeeIds: number[], workDate: IsoDate, reason: string, actorAccountId: number) {
  const accounts = await activeHrisAccounts(employeeIds);
  if (!accounts.size) return;
  await notify(tx, [...accounts.values()], {
    kind: 'attendance.corrected', title: `Absen Anda ${workDate} dibetulkan HR`, body: reason, link: '/kehadiran-saya',
  }, actorAccountId);
}

/**
 * Satu-satunya pintu membetulkan absen (KEH-28, 116). Banyak orang: satu cabang, satu tanggal, satu alasan.
 * Telat dan pulang cepat dihitung ulang server; tidak ada angka yang diketik (KEH-29).
 */
export async function saveCorrections(actor: Actor, input: CorrectionInput, now: Date = new Date()): Promise<ServiceResult<{ message: string; count: number }>> {
  const today = wibDate(now);
  const workDate = input.workDate;
  if (!ISO.test(workDate) || workDate > today) return fail(400, 'Tanggal tidak valid.');
  if (!input.items.length || input.items.length > MAX_ITEMS) return fail(400, 'Pilih orang yang dikoreksi.');
  if (new Set(input.items.map((item) => item.employeeId)).size !== input.items.length) return fail(400, 'Ada orang yang tercantum dua kali.');
  if (!(input.reasonCode in CORRECTION_REASON_LABELS)) return fail(400, 'Pilih alasan.');
  const batch = input.batchBranchId != null;
  if (batch && input.items.some((item) => item.branchId !== input.batchBranchId)) return fail(400, 'Koreksi banyak orang hanya untuk satu cabang.');
  if (!batch && input.items.length > 1) return fail(400, 'Koreksi satu orang hanya untuk satu orang.');
  const note = await checkReason(input.note, 'Keterangan');
  if (!note.ok) return fail(400, note.error);

  const roster = await rosterOn(workDate);
  const org = await getOrgLookup();
  const options = await shiftOptionsOn(workDate);
  const cutoff = await settingOn<number>('attendance.out_cutoff_hour', workDate);
  type Prepared = { person: RosterPerson; state: DayState; hours: ShiftOption | null; base: number | null };
  const prepared: Prepared[] = [];
  for (const item of input.items) {
    const person = roster.find((row) => row.employeeId === item.employeeId);
    if (!person) return fail(404, 'Orang tidak ditemukan pada tanggal itu.');
    if (!can(actor, 'attendance.correction.create', targetOf(person))) {
      return fail(403, person.employeeId === actor.personId ? 'Absen Anda sendiri dikoreksi orang lain yang berhak.' : FORBIDDEN);
    }
    if (person.mode !== 'QR') return fail(400, `${person.name} tidak diabsen lewat QR.`);
    if (!org.branches.some((branch) => branch.id === item.branchId && branch.active)) return fail(400, 'Cabang tidak ditemukan.');
    const branchShifts = options.get(item.branchId) ?? [];
    const shift = item.shiftId == null ? null : branchShifts.find((row) => row.id === item.shiftId) ?? null;
    if (item.shiftId != null && !shift) return fail(400, `Shift ${person.name} tidak ada di cabang itu pada tanggal ini.`);
    if (item.shiftId == null && branchShifts.length) return fail(400, `Pilih shift untuk ${person.name}.`);
    const inAt = wibLocal(item.inAt);
    const outAt = item.outAt ? wibLocal(item.outAt) : null;
    if (!inAt || (item.outAt && !outAt)) return fail(400, `Jam ${person.name} tidak valid.`);
    if (inAt > now || (outAt && outAt > now)) return fail(400, `Jam ${person.name} belum terjadi.`);
    const problem = correctionProblem(workDate, inAt, outAt, cutoff);
    if (problem) return fail(400, `${person.name}: ${problem}`);
    prepared.push({
      person, hours: shift, base: item.baseCorrectionId,
      state: { branchId: item.branchId, shiftId: shift?.id ?? null, shiftVersionId: shift?.versionId ?? null, inAt, outAt },
    });
  }

  const batchId = batch ? randomUUID() : null;
  const outcome = await db.transaction(async (tx): Promise<ServiceResult<{ late: number | null }>> => {
    let late: number | null = null;
    for (const item of prepared) {
      await lockDay(tx, item.person.employeeId, workDate);
      const latest = await latestCorrection(item.person.employeeId, workDate, tx);
      if ((latest?.id ?? null) !== item.base) return fail(409, STALE);
      const info = (await loadDayInfos([item.person.employeeId], workDate, workDate, tx, now)).get(dayKey(item.person.employeeId, workDate));
      const previous = info?.effective.state ?? EMPTY_STATE;
      if (sameState(previous, item.state)) return fail(400, `Tidak ada yang berubah untuk ${item.person.name}.`);
      const positionId = info?.day?.positionId ?? item.person.positionId;
      const lateApplies = yes(await settingOn<string>('position.late_applies', workDate, { positionId }, tx));
      const minutes = recomputeMinutes(workDate, item.hours, item.state, lateApplies);
      late = minutes.lateMinutes;
      await tx.insert(attendanceCorrections).values({
        employeeId: item.person.employeeId, workDate, ...item.state, ...prevColumns(previous), ...minutes,
        reasonCode: input.reasonCode, note: note.reason, batchId, createdByAccountId: actor.accountId,
      });
    }
    await notifyCorrected(tx, prepared.map((item) => item.person.employeeId), workDate, `${CORRECTION_REASON_LABELS[input.reasonCode]}. ${note.reason}`, actor.accountId);
    return { ok: true, data: { late } };
  });
  if (!outcome.ok) return outcome;
  const message = prepared.length === 1
    ? `Koreksi ${prepared[0].person.name} tersimpan. Telat ${workDate} dihitung ulang: ${outcome.data.late ?? 0} menit.`
    : `Koreksi ${prepared.length} orang tersimpan.`;
  return { ok: true, data: { message, count: prepared.length } };
}

/** Membalik koreksi terakhir: keadaan sebelum koreksi itu ditulis sebagai koreksi baru (KEH-68). */
export async function reverseCorrection(actor: Actor, input: { correctionId: number; reason: string }): Promise<ServiceResult<{ message: string }>> {
  const [row] = await db.select().from(attendanceCorrections).where(eq(attendanceCorrections.id, input.correctionId)).limit(1);
  if (!row) return fail(404, 'Koreksi tidak ditemukan.');
  const person = await personOn(row.employeeId, row.workDate);
  if (!person || !can(actor, 'attendance.correction.create', targetOf(person))) {
    return fail(403, row.employeeId === actor.personId ? 'Absen Anda sendiri dikoreksi orang lain yang berhak.' : FORBIDDEN);
  }
  const reason = await checkReason(input.reason);
  if (!reason.ok) return fail(400, reason.error);
  const state: DayState = {
    branchId: row.prevBranchId, shiftId: row.prevShiftId, shiftVersionId: row.prevShiftVersionId, inAt: row.prevInAt, outAt: row.prevOutAt,
  };
  const outcome = await db.transaction(async (tx): Promise<ServiceResult<Record<string, never>>> => {
    await lockDay(tx, row.employeeId, row.workDate);
    const latest = await latestCorrection(row.employeeId, row.workDate, tx);
    if (latest?.id !== row.id) return fail(409, 'Hanya koreksi terakhir hari itu yang bisa dibalik. Muat ulang.');
    const info = (await loadDayInfos([row.employeeId], row.workDate, row.workDate, tx)).get(dayKey(row.employeeId, row.workDate));
    const hours = await versionHours(state.shiftId, state.shiftVersionId, tx);
    const lateApplies = yes(await settingOn<string>('position.late_applies', row.workDate, { positionId: info?.day?.positionId ?? person.positionId }, tx));
    await tx.insert(attendanceCorrections).values({
      employeeId: row.employeeId, workDate: row.workDate, ...state, ...prevColumns(info?.effective.state ?? EMPTY_STATE),
      ...recomputeMinutes(row.workDate, hours, state, lateApplies),
      reasonCode: 'OTHER', note: reason.reason, reversesId: row.id, createdByAccountId: actor.accountId,
    });
    await notifyCorrected(tx, [row.employeeId], row.workDate, `Koreksi sebelumnya dibalik. ${reason.reason}`, actor.accountId);
    return { ok: true, data: {} };
  });
  if (!outcome.ok) return outcome;
  return { ok: true, data: { message: `Koreksi ${person.name} ${row.workDate} dibalik.` } };
}

// ---- Tinjau Absen (KEH-L12) ----

export type ReviewFilter = 'pending' | 'decided' | 'uncorrected';

const REVIEW_LOOKBACK_DAYS = 120;

export async function reviewScreen(actor: Actor, input: { tab: 'outside' | 'patterns'; filter: ReviewFilter; branchId: number | null }, now: Date = new Date()) {
  const today = wibDate(now);
  const { branches, label } = await branchLabels();
  const base = { tab: input.tab, filter: input.filter, branchId: input.branchId, branches, canDecide: hasAction(actor, 'attendance.review.decide') };
  if (input.tab === 'patterns') return { ...base, rows: [], flags: await patternFlags(actor, today) };

  const from = addDays(today, -REVIEW_LOOKBACK_DAYS);
  const rows = await db.select({ record: attendanceRecords, day: attendanceDays }).from(attendanceRecords)
    .innerJoin(attendanceDays, eq(attendanceDays.id, attendanceRecords.dayId))
    .where(and(eq(attendanceRecords.needsReview, true), gte(attendanceDays.workDate, from),
      input.branchId ? eq(attendanceRecords.branchId, input.branchId) : undefined))
    .orderBy(asc(attendanceRecords.recordedAt));
  const rosters = new Map<IsoDate, RosterPerson[]>();
  const rosterFor = async (date: IsoDate) => {
    if (!rosters.has(date)) rosters.set(date, await rosterOn(date));
    return rosters.get(date)!;
  };
  const visible: { record: RecordRow; day: DayRow; person: RosterPerson | null }[] = [];
  for (const row of rows) {
    const person = (await rosterFor(row.day.workDate)).find((item) => item.employeeId === row.day.employeeId) ?? null;
    if (can(actor, 'attendance.review.view', { personId: row.day.employeeId, branchId: row.record.branchId, departmentId: person?.departmentId ?? null })) {
      visible.push({ ...row, person });
    }
  }
  const recordIds = visible.map((row) => row.record.id);
  const history = recordIds.length
    ? await db.select().from(attendanceReviews).where(inArray(attendanceReviews.recordId, recordIds)).orderBy(asc(attendanceReviews.id)) : [];
  const corrections = visible.length ? await db.select({
    employeeId: attendanceCorrections.employeeId, workDate: attendanceCorrections.workDate, createdAt: attendanceCorrections.createdAt,
  }).from(attendanceCorrections).where(inArray(attendanceCorrections.employeeId, [...new Set(visible.map((row) => row.day.employeeId))])) : [];
  const purged = await purgedFiles(visible.map((row) => row.record.photoFileId).filter((id): id is string => Boolean(id)));
  const [names, by] = await Promise.all([
    peopleNames(visible.map((row) => row.day.employeeId)), accountNames(history.map((row) => row.decidedByAccountId)),
  ]);
  const radii = new Map<string, number>();
  const list = [];
  for (const { record, day, person } of visible) {
    const own = history.filter((row) => row.recordId === record.id);
    const latest = own.at(-1) ?? null;
    const corrected = latest?.outcome === 'NEEDS_CORRECTION' && corrections.some((row) => (
      row.employeeId === day.employeeId && row.workDate === day.workDate && row.createdAt >= latest.decidedAt
    ));
    const status: 'pending' | 'decided' | 'uncorrected' = !latest ? 'pending' : latest.outcome === 'NEEDS_CORRECTION' && !corrected ? 'uncorrected' : 'decided';
    if (input.filter === 'pending' ? status !== 'pending' : input.filter === 'uncorrected' ? status !== 'uncorrected' : !latest) continue;
    const radiusKey = `${record.branchId}|${day.workDate}`;
    if (!radii.has(radiusKey)) radii.set(radiusKey, Number(await settingOn('attendance.radius_m', day.workDate, { branchId: record.branchId })));
    const target = { personId: day.employeeId, branchId: record.branchId, departmentId: person?.departmentId ?? null };
    list.push({
      id: record.id, employeeId: day.employeeId, name: names.get(day.employeeId) ?? '-', workDate: day.workDate,
      kind: record.kind as AttendanceKind, kindLabel: KIND_LABELS[record.kind as AttendanceKind], clock: wibClock(record.recordedAt),
      branch: label(record.branchId), distanceM: record.distanceM, radiusM: radii.get(radiusKey)!, accuracyM: record.accuracyM,
      photo: Boolean(record.photoFileId) && !purged.has(record.photoFileId!) && can(actor, 'attendance.photo.view', target),
      canDecide: can(actor, 'attendance.review.decide', target),
      latestReviewId: latest?.id ?? null, status,
      history: own.map((row) => ({
        id: row.id, outcome: row.outcome as ReviewOutcome, reason: row.reason, at: row.decidedAt.toISOString(),
        by: by.get(row.decidedByAccountId) ?? `Akun #${row.decidedByAccountId}`,
      })).reverse(),
    });
  }
  return { ...base, rows: input.filter === 'pending' ? list : list.reverse(), flags: [] };
}

async function purgedFiles(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const rows = await db.select({ id: attendancePhotoPurges.fileId }).from(attendancePhotoPurges).where(inArray(attendancePhotoPurges.fileId, ids));
  return new Set(rows.map((row) => row.id));
}

/** Putusan Wajar atau Perlu dikoreksi; alasan wajib; boleh diganti, riwayat tetap (KEH-114). Bukan untuk absen sendiri (KEH-117). */
export async function decideReview(actor: Actor, input: {
  recordId: number; outcome: ReviewOutcome; reason: string; baseReviewId: number | null;
}): Promise<ServiceResult<{ message: string; link: string | null }>> {
  const [row] = await db.select({ record: attendanceRecords, day: attendanceDays }).from(attendanceRecords)
    .innerJoin(attendanceDays, eq(attendanceDays.id, attendanceRecords.dayId)).where(eq(attendanceRecords.id, input.recordId)).limit(1);
  if (!row || !row.record.needsReview) return fail(404, 'Absen ini tidak perlu ditinjau.');
  const person = await personOn(row.day.employeeId, row.day.workDate);
  if (!can(actor, 'attendance.review.decide', { personId: row.day.employeeId, branchId: row.record.branchId, departmentId: person?.departmentId ?? null })) {
    return fail(403, row.day.employeeId === actor.personId ? 'Absen Anda sendiri diputuskan orang lain yang berhak.' : FORBIDDEN);
  }
  if (input.outcome !== 'FINE' && input.outcome !== 'NEEDS_CORRECTION') return fail(400, 'Pilih Wajar atau Perlu dikoreksi.');
  const reason = await checkReason(input.reason);
  if (!reason.ok) return fail(400, reason.error);
  const outcome = await db.transaction(async (tx): Promise<ServiceResult<Record<string, never>>> => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('attendance.review'), ${input.recordId})`);
    const latest = (await latestReviews([input.recordId], tx)).get(input.recordId);
    if ((latest?.id ?? null) !== input.baseReviewId) return fail(409, STALE);
    if (latest?.outcome === input.outcome) return fail(400, 'Putusan ini sama dengan putusan sebelumnya.');
    await tx.insert(attendanceReviews).values({ recordId: input.recordId, outcome: input.outcome, reason: reason.reason, decidedByAccountId: actor.accountId });
    return { ok: true, data: {} };
  });
  if (!outcome.ok) return outcome;
  const name = person?.name ?? 'orang ini';
  return input.outcome === 'FINE'
    ? { ok: true, data: { message: `Absen ${name} diputuskan wajar.`, link: null } }
    : {
      ok: true,
      data: {
        message: `Absen ${name} ditandai perlu dikoreksi.`,
        link: `/kehadiran/koreksi?mode=one&employee=${row.day.employeeId}&date=${row.day.workDate}`,
      },
    };
}

/** Jumlah absen luar titik yang menunggu putusan pelaku ini (kartu Beranda). */
export async function pendingReviewCount(actor: Actor | null, now: Date = new Date()): Promise<number> {
  if (!actor || !hasAction(actor, 'attendance.review.decide')) return 0;
  const screen = await reviewScreen(actor, { tab: 'outside', filter: 'pending', branchId: null }, now);
  return screen.rows.filter((row) => row.canDecide).length;
}

// ---- Pola lokasi (KEH-115) ----

const PATTERN_LOOKBACK_DAYS = 60;

async function patternFlags(actor: Actor, today: IsoDate) {
  const flags = await db.select().from(attendancePatternFlags)
    .where(gte(attendancePatternFlags.detectedOn, addDays(today, -PATTERN_LOOKBACK_DAYS))).orderBy(desc(attendancePatternFlags.id));
  const roster = await rosterOn(today);
  const visible = flags.filter((flag) => flag.employeeIds.every((employeeId) => {
    const person = roster.find((row) => row.employeeId === employeeId);
    return can(actor, 'attendance.review.view', { personId: employeeId, branchId: person?.branchId ?? null, departmentId: person?.departmentId ?? null });
  }));
  const seen = visible.length
    ? await db.select().from(attendancePatternSeen).where(inArray(attendancePatternSeen.flagId, visible.map((flag) => flag.id))) : [];
  const records = visible.length ? await db.select({ id: attendanceRecords.id, employeeId: attendanceDays.employeeId, workDate: attendanceDays.workDate })
    .from(attendanceRecords).innerJoin(attendanceDays, eq(attendanceDays.id, attendanceRecords.dayId))
    .where(inArray(attendanceRecords.id, [...new Set(visible.flatMap((flag) => flag.recordIds))])) : [];
  const [names, by] = await Promise.all([
    peopleNames(visible.flatMap((flag) => flag.employeeIds)), accountNames(seen.map((row) => row.seenByAccountId)),
  ]);
  return visible.map((flag) => {
    const mark = seen.find((row) => row.flagId === flag.id);
    const days = records.filter((row) => flag.recordIds.includes(row.id));
    return {
      id: flag.id, kind: flag.kind as PatternKind, detectedOn: flag.detectedOn,
      people: flag.employeeIds.map((employeeId) => ({ id: employeeId, name: names.get(employeeId) ?? '-' })),
      days: [...new Map(days.map((row) => [`${row.employeeId}|${row.workDate}`, { employeeId: row.employeeId, workDate: row.workDate, name: names.get(row.employeeId) ?? '-' }])).values()],
      seen: mark ? { by: by.get(mark.seenByAccountId) ?? `Akun #${mark.seenByAccountId}`, at: mark.seenAt.toISOString(), note: mark.note } : null,
    };
  });
}

/** Tanda pola ditandai Sudah dilihat dengan catatan; tandanya tetap tersimpan (KEH-115). */
export async function markPatternSeen(actor: Actor, input: { flagId: number; note: string }): Promise<ServiceResult<{ message: string }>> {
  const [flag] = await db.select().from(attendancePatternFlags).where(eq(attendancePatternFlags.id, input.flagId)).limit(1);
  if (!flag) return fail(404, 'Tanda tidak ditemukan.');
  const roster = await rosterOn(flag.detectedOn);
  const allowed = flag.employeeIds.every((employeeId) => {
    const person = roster.find((row) => row.employeeId === employeeId);
    return can(actor, 'attendance.review.decide', { personId: employeeId, branchId: person?.branchId ?? null, departmentId: person?.departmentId ?? null });
  });
  if (!allowed) return fail(403, flag.employeeIds.includes(actor.personId) ? 'Tanda yang menyangkut Anda dilihat orang lain yang berhak.' : FORBIDDEN);
  const note = await checkReason(input.note, 'Catatan');
  if (!note.ok) return fail(400, note.error);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('attendance.pattern'), ${flag.id})`);
    const [already] = await tx.select({ id: attendancePatternSeen.id }).from(attendancePatternSeen).where(eq(attendancePatternSeen.flagId, flag.id)).limit(1);
    if (already) return fail(409, 'Tanda ini sudah ditandai dilihat.');
    await tx.insert(attendancePatternSeen).values({ flagId: flag.id, seenByAccountId: actor.accountId, note: note.reason });
    return { ok: true as const, data: { message: 'Tanda ditandai sudah dilihat.' } };
  });
}

const PATTERN_CATCH_UP_DAYS = 7;

/** Mesin 05.00: mencari dua pola untuk hari yang sudah lewat, sekali per kejadian. Aman diulang (spec L3c §6). */
export async function scanAttendancePatterns(now: Date = new Date()) {
  const today = wibDate(now);
  let written = 0;
  for (let back = PATTERN_CATCH_UP_DAYS; back >= 1; back -= 1) written += await scanPatternsOn(addDays(today, -back));
  return { written };
}

async function scanPatternsOn(date: IsoDate): Promise<number> {
  const [threshold, windowDays, sameMeters] = await Promise.all([
    settingOn<number>('attendance.pattern_outside_count', date),
    settingOn<number>('attendance.pattern_window_workdays', date),
    settingOn<number>('attendance.pattern_same_point_m', date),
  ]);
  const outside = await db.select({ record: attendanceRecords, day: attendanceDays }).from(attendanceRecords)
    .innerJoin(attendanceDays, eq(attendanceDays.id, attendanceRecords.dayId))
    .where(and(eq(attendanceDays.workDate, date), eq(attendanceRecords.needsReview, true)));
  if (!outside.length) return 0;
  const flags: (typeof attendancePatternFlags.$inferInsert)[] = [];

  for (const employeeId of new Set(outside.map((row) => row.day.employeeId))) {
    const days = await db.select({ id: attendanceDays.id, workDate: attendanceDays.workDate }).from(attendanceDays)
      .where(and(eq(attendanceDays.employeeId, employeeId), lte(attendanceDays.workDate, date)))
      .orderBy(desc(attendanceDays.workDate)).limit(windowDays);
    const marked = await db.select({ id: attendanceRecords.id, dayId: attendanceRecords.dayId }).from(attendanceRecords)
      .where(and(inArray(attendanceRecords.dayId, days.map((day) => day.id)), eq(attendanceRecords.needsReview, true)));
    const hit = repeatOutsideHit(days.map((day) => ({
      workDate: day.workDate, outsideRecordIds: marked.filter((row) => row.dayId === day.id).map((row) => row.id),
    })), threshold);
    if (!hit) continue;
    // Sekali per kejadian: orang yang sudah ditandai dalam rentang hari kerja yang sama tidak ditandai lagi.
    const earliest = days.at(-1)!.workDate;
    const [recent] = await db.select({ id: attendancePatternFlags.id }).from(attendancePatternFlags).where(and(
      eq(attendancePatternFlags.kind, 'REPEAT_OUTSIDE'), gte(attendancePatternFlags.detectedOn, earliest),
      sql`${attendancePatternFlags.detectedOn} < ${date}::date`, sql`${employeeId} = any(${attendancePatternFlags.employeeIds})`,
    )).limit(1);
    if (recent) continue;
    flags.push({ kind: 'REPEAT_OUTSIDE', detectedOn: date, fingerprint: `REPEAT_OUTSIDE:${employeeId}:${date}`, employeeIds: [employeeId], recordIds: hit });
  }

  const points = outside.filter((row) => row.record.latitude != null && row.record.longitude != null).map((row) => ({
    recordId: row.record.id, employeeId: row.day.employeeId, latitude: row.record.latitude!, longitude: row.record.longitude!,
  }));
  for (const [a, b] of sharedPointPairs(points, sameMeters)) {
    flags.push({
      kind: 'SHARED_POINT', detectedOn: date, fingerprint: `SHARED_POINT:${date}:${a.employeeId}-${b.employeeId}`,
      employeeIds: [a.employeeId, b.employeeId], recordIds: [a.recordId, b.recordId],
    });
  }
  if (!flags.length) return 0;
  const inserted = await db.insert(attendancePatternFlags).values(flags).onConflictDoNothing().returning({ id: attendancePatternFlags.id });
  return inserted.length;
}

