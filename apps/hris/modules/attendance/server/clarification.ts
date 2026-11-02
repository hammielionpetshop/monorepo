// Perlu Dijelaskan dan alpha (spec L3g). Status penjelasan milik Mesin Pengajuan; modul ini melahirkan kejadian,
// menyimpan isi khas penjelasan, dan menulis akibatnya. Semua aturan diperiksa di server (WAJ-04).
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import {
  absenceNotices, absenceStreakFlags, absenceStreakSeen, clarificationEffects, clarificationEventLinks, clarificationEvents, clarifications,
} from '@petshop/hris-db/schema/attendance';
import { db } from '@/lib/db';
import { can, getOrgLookup, hasAction, listEmployeesWithAnyAction, type Actor, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { notify } from '@/modules/notifications';
import { checkReason, settingOn } from '@/modules/settings';
import { KIND_LABELS, wibClock, wibDate, withinOutCutoff } from '../rules/attendance';
import {
  CAUSE_LABELS, CLARIFY_MARKS_FROM, EVENT_KIND_LABELS, EVENT_STATE_LABELS, FORGOT_KIND_LABELS, FORGOT_SURCHARGE_FROM,
  causesFor, consequenceText, daysLeft, deadlineAfter, detectEvents, earliestInProblem, eventTitle, forgotKindOf, forgotSequence,
  isCause, isContiguous, isOpenAt, lastDayOf, lateSubmitAllowed, leftText, returnProblem, seriesAllowed, streakHits, urgencyOf,
  type BornEvent, type Cause, type DayFacts, type EventKind, type EventState, type ForgotItem, type ForgotKind, type StreakDay,
} from '../rules/clarification';
import { correctionProblem, payPeriodOf, shiftPeriod, wibLocal, type DayState } from '../rules/review';
import { addDays, mondayOf, versionOn, type IsoDate } from '../rules/schedule';
import { absenceDateClash, absenceDayStatuses, absenceRules, absenceDaysOf, createClarificationAbsence, longDate, releaseAbsenceDays, shortDate, sickRunExceeded, subjectOn } from './absence';
import { buildBranchWeek, rosterOn, type Executor, type RosterPerson } from './read';
import { correctionIsLatest, loadDayInfos, writeClarificationCorrection, type DayInfo } from './review';

type Fail = { ok: false; status: 400 | 403 | 404 | 409; error: string; hint?: 'SWITCH_TO_LETTER' };
const fail = (status: Fail['status'], error: string, hint?: Fail['hint']): Fail => ({ ok: false, status, error, ...(hint ? { hint } : {}) });
const FORBIDDEN = 'Anda tidak berhak melakukan tindakan ini.';
const MAX_EVENTS = 31;
const SCAN_CATCH_UP_DAYS = 14;
const REVALIDATE_DAYS = 40;

/** Tanggal mulai menandai; tes integrasi menggeser lewat env karena memakai tanggal lampau. */
const marksFrom = (): IsoDate => process.env.HRIS_CLARIFY_MARKS_FROM ?? CLARIFY_MARKS_FROM;

type EventRow = typeof clarificationEvents.$inferSelect;
type ClarificationRow = typeof clarifications.$inferSelect;

const key = (employeeId: number, date: IsoDate) => `${employeeId}|${date}`;
const ids = (values: number[]) => sql.join([...new Set(values.length ? values : [0])].map((id) => sql`${id}`), sql`, `);

function rangeText(dates: IsoDate[]): string {
  const sorted = [...dates].sort();
  return sorted.length === 1 ? shortDate(sorted[0]) : `${shortDate(sorted[0])} – ${shortDate(sorted[sorted.length - 1])} (${sorted.length} hari)`;
}

const deadlineText = (deadlineAt: Date) => `sampai ${shortDate(lastDayOf(deadlineAt))} 23.59`;

// ---- Pengaturan ----

export async function clarifyRules(on: IsoDate, executor: Executor = db) {
  const read = (k: Parameters<typeof settingOn>[0]) => settingOn<number>(k, on, {}, executor).then(Number);
  const [deadlineDays, late, early, streakDays, habitMin, earliestIn, cutoff] = await Promise.all([
    read('attendance.clarify_deadline_days'), read('attendance.clarify_late_threshold_minutes'),
    read('attendance.clarify_early_threshold_minutes'), read('attendance.absence_streak_days'), read('attendance.forgot_habit_min'),
    read('attendance.earliest_in_minutes'), read('attendance.out_cutoff_hour'),
  ]);
  return { deadlineDays, late, early, streakDays, habitMin, earliestIn, cutoff };
}

// ---- Fakta satu hari kerja (satu fungsi untuk mesin, pemeriksa ulang, dan isian; WAJ-04) ----

type ScheduledShift = { branchId: number; shiftId: number; shiftVersionId: number; startTime: string; endTime: string } | null;

type PersonDay = { person: RosterPerson; facts: DayFacts; shift: ScheduledShift; info: DayInfo | undefined };

/** Orang yang dinilai pada tanggal itu: cara absen QR, bukan Pemilik/GM (KAR-67), sudah bergabung. */
async function trackedOn(date: IsoDate, employeeIds: number[] | null, executor: Executor): Promise<RosterPerson[]> {
  const roster = (await rosterOn(date, executor)).filter((person) => person.mode === 'QR'
    && (!employeeIds || employeeIds.includes(person.employeeId)));
  if (!roster.length) return [];
  const rows = await executor.execute<{ id: number; full: boolean; joined: string }>(sql`
    select e.id, p.full_access as full, e.joined_on::text as joined from hris.employees e
    join hris.placements_on(${date}::date) pl on pl.employee_id = e.id join hris.positions p on p.id = pl.position_id
    where e.id in (${ids(roster.map((person) => person.employeeId))})`);
  const keep = new Set(rows.filter((row) => !row.full && row.joined <= date).map((row) => Number(row.id)));
  return roster.filter((person) => keep.has(person.employeeId));
}

export async function dayFacts(date: IsoDate, employeeIds: number[] | null, executor: Executor = db, now: Date = new Date()): Promise<Map<number, PersonDay>> {
  const people = await trackedOn(date, employeeIds, executor);
  const result = new Map<number, PersonDay>();
  if (!people.length) return result;
  const infos = await loadDayInfos(people.map((person) => person.employeeId), date, date, executor, now);
  const byBranch = new Map<number, RosterPerson[]>();
  for (const person of people) byBranch.set(person.branchId, [...(byBranch.get(person.branchId) ?? []), person]);
  for (const [branchId, members] of byBranch) {
    const week = await buildBranchWeek(branchId, mondayOf(date), members.map(({ employeeId, name }) => ({ employeeId, name })), executor);
    for (const person of members) {
      const cell = week.rows.find((row) => row.employeeId === person.employeeId)?.cells.find((c) => c.date === date);
      const shift = cell?.shiftId != null ? week.shifts.find((s) => s.id === cell.shiftId) : undefined;
      const version = shift ? versionOn(shift.versions, date) : null;
      const info = infos.get(key(person.employeeId, date));
      const state = info?.effective.state;
      result.set(person.employeeId, {
        person, info,
        shift: shift && version ? { branchId, shiftId: shift.id, shiftVersionId: version.id, startTime: version.startTime, endTime: version.endTime } : null,
        facts: {
          scheduled: Boolean(shift && version), closed: Boolean(cell?.closed), dayOff: Boolean(cell?.dayOff), absent: Boolean(cell?.absent),
          present: Boolean(state?.inAt), outCounted: Boolean(state?.outAt),
          hasBreak: Boolean(info?.records.BREAK), hasReturn: Boolean(info?.records.RETURN),
          lateMinutes: info?.effective.lateMinutes ?? null, earlyLeaveMinutes: info?.effective.earlyLeaveMinutes ?? null,
        },
      });
    }
  }
  return result;
}

async function detectOn(date: IsoDate, employeeIds: number[] | null, executor: Executor, now: Date) {
  const rules = await clarifyRules(date, executor);
  const facts = await dayFacts(date, employeeIds, executor, now);
  return { rules, facts, born: new Map([...facts].map(([id, day]) => [id, detectEvents(day.facts, rules)])) };
}

// ---- Kejadian dan tautan ----

async function eventsOf(employeeIds: number[] | null, from: IsoDate, to: IsoDate, executor: Executor = db): Promise<EventRow[]> {
  return executor.select().from(clarificationEvents).where(and(
    employeeIds ? inArray(clarificationEvents.employeeId, employeeIds.length ? employeeIds : [0]) : undefined,
    sql`${clarificationEvents.workDate} between ${from}::date and ${to}::date`,
  )).orderBy(asc(clarificationEvents.workDate), asc(clarificationEvents.id));
}

type LinkInfo = { clarificationId: number; requestId: number; status: string; active: boolean; reason: string | null; decidedAt: Date | null };

/** Tautan penjelasan per kejadian, terbaru terakhir. */
async function linksOf(eventIds: number[], executor: Executor = db): Promise<Map<number, LinkInfo[]>> {
  const map = new Map<number, LinkInfo[]>();
  if (!eventIds.length) return map;
  const rows = await executor.execute<{
    event_id: number; clarification_id: number; request_id: number; status: string; active: boolean; reason: string | null; decided_at: Date | null;
  }>(sql`select l.event_id, l.clarification_id, c.request_id, r.status::text as status, l.active, r.decision_reason as reason, r.decided_at
         from hris.clarification_event_links l join hris.clarifications c on c.id = l.clarification_id join hris.requests r on r.id = c.request_id
         where l.event_id in (${ids(eventIds)}) order by l.id`);
  for (const row of rows) {
    const list = map.get(Number(row.event_id)) ?? [];
    list.push({
      clarificationId: Number(row.clarification_id), requestId: Number(row.request_id), status: row.status, active: Boolean(row.active),
      reason: row.reason, decidedAt: row.decided_at ? new Date(row.decided_at) : null,
    });
    map.set(Number(row.event_id), list);
  }
  return map;
}

const activeLink = (links: LinkInfo[] | undefined) => links?.find((link) => link.active) ?? null;

async function setState(executor: Executor, eventIds: number[], state: EventState, deadlineAt?: Date) {
  if (!eventIds.length) return;
  await executor.update(clarificationEvents).set({ state, stateChangedAt: new Date(), ...(deadlineAt ? { deadlineAt } : {}) })
    .where(inArray(clarificationEvents.id, eventIds));
}

async function accountsOf(employeeIds: number[]): Promise<number[]> {
  return [...(await activeHrisAccounts(employeeIds)).values()];
}

async function ownerAccounts(): Promise<number[]> {
  return accountsOf(await listEmployeesWithAnyAction([]));
}

async function noticeOnce(executor: Executor, ref: string): Promise<boolean> {
  const rows = await executor.insert(absenceNotices).values({ ref }).onConflictDoNothing().returning({ ref: absenceNotices.ref });
  return rows.length > 0;
}

async function scanned(date: IsoDate, executor: Executor): Promise<boolean> {
  const rows = await executor.select({ ref: absenceNotices.ref }).from(absenceNotices).where(eq(absenceNotices.ref, `clar-scan:${date}`));
  return rows.length > 0;
}

async function notifyBorn(tx: Tx, employeeId: number, events: { kind: EventKind; minutes: number | null; workDate: IsoDate; deadlineAt: Date }[]) {
  if (!events.length) return;
  const first = [...events].sort((a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime())[0];
  await notify(tx, await accountsOf([employeeId]), {
    kind: 'attendance.clarification',
    title: events.length === 1 ? `Perlu dijelaskan: ${eventTitle(first.kind, first.minutes)} ${shortDate(first.workDate)}` : `${events.length} hal perlu dijelaskan`,
    body: `${consequenceText(first.kind)} Batas ${deadlineText(first.deadlineAt)}.`,
    link: '/perlu-dijelaskan',
  }, null);
}

/**
 * Selaraskan kejadian satu orang pada tanggal-tanggal yang sudah diproses mesin (spec L3g §3.1, §3.6):
 * yang sudah dibereskan (koreksi, izin disetujui) dilepas; yang muncul (izin ditolak/dicabut, koreksi dibalik)
 * dilahirkan dengan batas dari hari ini. `reopen` = alpha lama yang lewat batas dibuka lagi (KEH-62, 147).
 * Kejadian yang penjelasannya sedang berlaku tidak disentuh.
 */
export async function syncClarificationDays(tx: Tx, employeeId: number, dates: IsoDate[], now: Date = new Date(), reopen = true) {
  const today = wibDate(now);
  const due = [...new Set(dates)].filter((date) => date < today && date >= marksFrom()).sort();
  const born: { kind: EventKind; minutes: number | null; workDate: IsoDate; deadlineAt: Date }[] = [];
  for (const date of due) {
    if (!(await scanned(date, tx))) continue;
    const { rules, born: detected } = await detectOn(date, [employeeId], tx, now);
    const kinds = detected.get(employeeId) ?? [];
    const existing = await eventsOf([employeeId], date, date, tx);
    const links = await linksOf(existing.map((event) => event.id), tx);
    const free = existing.filter((event) => !activeLink(links.get(event.id)));
    const voidIds = free.filter((event) => (event.state === 'OPEN' || event.state === 'EXPIRED') && !kinds.some((k) => k.kind === event.kind))
      .map((event) => event.id);
    await setState(tx, voidIds, 'VOID');
    const fresh = deadlineAfter(today, rules.deadlineDays);
    for (const found of kinds) {
      const event = existing.find((row) => row.kind === found.kind);
      if (!event) {
        await tx.insert(clarificationEvents).values({ employeeId, workDate: date, kind: found.kind, minutes: found.minutes, deadlineAt: fresh });
        born.push({ ...found, workDate: date, deadlineAt: fresh });
      } else if (!activeLink(links.get(event.id)) && (event.state === 'VOID' || (reopen && event.state === 'EXPIRED' && found.kind === 'ALPHA'))) {
        await setState(tx, [event.id], 'OPEN', fresh);
        born.push({ ...found, workDate: date, deadlineAt: fresh });
      }
    }
  }
  await notifyBorn(tx, employeeId, born);
}

/** Tanda Alpha per `orang|tanggal` untuk status hari (KEH-150). PENDING = penjelasannya menunggu keputusan. */
export type AlphaMarks = Map<string, 'OPEN' | 'PENDING' | 'EXPIRED'>;

export async function alphaMarks(employeeIds: number[], from: IsoDate, to: IsoDate, executor: Executor = db): Promise<AlphaMarks> {
  const marks: AlphaMarks = new Map();
  if (!employeeIds.length) return marks;
  const rows = (await eventsOf(employeeIds, from, to, executor)).filter((event) => event.kind === 'ALPHA' && (event.state === 'OPEN' || event.state === 'EXPIRED'));
  const links = await linksOf(rows.map((row) => row.id), executor);
  for (const row of rows) {
    const link = activeLink(links.get(row.id));
    marks.set(key(row.employeeId, row.workDate), link && (link.status === 'PENDING' || link.status === 'REVIEWED') ? 'PENDING' : row.state === 'EXPIRED' ? 'EXPIRED' : 'OPEN');
  }
  return marks;
}

// ---- Kejadian ke-n lupa absen (KEH-64, 154) ----

type ForgotRow = ForgotItem & { employeeId: number; eventId: number; status: string };

/** Lupa absen (penjelasan + kejadian) dalam rentang; `approvedOnly` = hanya yang disetujui dan masih berlaku. */
async function forgotRows(employeeIds: number[] | null, from: IsoDate, to: IsoDate, approvedOnly: boolean, executor: Executor = db): Promise<ForgotRow[]> {
  const rows = await executor.execute<{ id: number; event_id: number; kind: string; work_date: string; cause: string; employee_id: number; status: string }>(sql`
    select c.id, ev.id as event_id, ev.kind::text as kind, ev.work_date::text as work_date, c.cause::text as cause, c.employee_id,
      r.status::text as status
    from hris.clarifications c join hris.requests r on r.id = c.request_id
    join hris.clarification_event_links l on l.clarification_id = c.id join hris.clarification_events ev on ev.id = l.event_id
    where ev.work_date between ${from}::date and ${to}::date
      ${approvedOnly ? sql`and r.status = 'APPROVED' and l.active` : sql``}
      ${employeeIds ? sql`and c.employee_id in (${ids(employeeIds)})` : sql``}`);
  return rows.flatMap((row) => {
    const kind = forgotKindOf(row.kind as EventKind, row.cause as Cause);
    return kind ? [{
      id: Number(row.event_id), eventId: Number(row.event_id), kind, workDate: row.work_date, employeeId: Number(row.employee_id), status: row.status,
    }] : [];
  });
}

/** Kejadian ke-berapa bila yang ini ikut disetujui (untuk konfirmasi Kirim dan keterangan pembantu). */
async function predictedNth(employeeId: number, eventId: number, workDate: IsoDate, kind: ForgotKind, executor: Executor = db): Promise<number> {
  const period = payPeriodOf(workDate);
  const approved = (await forgotRows([employeeId], period.start, period.end, true, executor)).filter((row) => row.eventId !== eventId);
  return forgotSequence([...approved, { id: eventId, kind, workDate }]).get(eventId) ?? 1;
}

const nthText = (kind: ForgotKind, nth: number) => `Kejadian ke-${nth} jenis ${FORGOT_KIND_LABELS[kind]} periode ini${nth >= FORGOT_SURCHARGE_FROM ? ': kena tambahan' : ''}`;

// ---- Isi khas pengajuan "Penjelasan" (RequestHandler) ----

type Draft = {
  eventIds: number[]; cause: Cause; inAt: Date | null; outAt: Date | null; returnAt: Date | null; reason: string; lateReason: string;
  letterPending: boolean;
};

function parseDraft(input: Record<string, unknown>): Draft | Fail {
  const eventIds = Array.isArray(input.eventIds) ? input.eventIds.filter((id): id is number => Number.isInteger(id) && (id as number) > 0) : [];
  if (!eventIds.length || eventIds.length > MAX_EVENTS || new Set(eventIds).size !== eventIds.length) return fail(400, 'Pilih kejadian yang dijelaskan.');
  if (!isCause(input.cause)) return fail(400, 'Pilih sebabnya.');
  const time = (value: unknown) => (typeof value === 'string' && value ? wibLocal(value) : null);
  const bad = (value: unknown) => typeof value === 'string' && value !== '' && !wibLocal(value);
  if (bad(input.inAt) || bad(input.outAt) || bad(input.returnAt)) return fail(400, 'Jam tidak valid.');
  return {
    eventIds, cause: input.cause, inAt: time(input.inAt), outAt: time(input.outAt), returnAt: time(input.returnAt),
    reason: typeof input.reason === 'string' ? input.reason : '', lateReason: typeof input.lateReason === 'string' ? input.lateReason : '',
    letterPending: input.letterPending === true,
  };
}

async function lockPerson(tx: Tx, employeeId: number) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('attendance.absence'), ${employeeId})`);
}

/** Siapa yang memakai Perlu Dijelaskan (KEH-L35): diabsen lewat QR, bukan Pemilik/GM. */
async function eligibility(actor: Actor, today: IsoDate, executor: Executor = db): Promise<string | null> {
  const subject = await subjectOn(actor.personId, today, executor);
  if (!subject) return 'Data karyawan tidak ditemukan atau tidak aktif.';
  if (subject.fullAccess) return 'Pemilik dan GM tidak memakai Perlu Dijelaskan.';
  if (subject.mode !== 'QR') return 'Jabatan ini tidak diabsen lewat QR, jadi tidak memakai Perlu Dijelaskan.';
  if (!can(actor, 'attendance.self.check', { personId: actor.personId })) return FORBIDDEN;
  return null;
}

/** Hari Hadir dan alpha lain di antara tanggal-tanggal terpilih (pemeriksa "berturut-turut", KEH-152). */
async function contiguityFacts(employeeId: number, dates: IsoDate[], selectedIds: number[], executor: Executor) {
  const sorted = [...dates].sort();
  const from = sorted[0];
  const to = sorted[sorted.length - 1];
  const infos = await loadDayInfos([employeeId], from, to, executor);
  const present = new Set([...infos.values()].filter((info) => info.effective.state.inAt).map((info) => info.workDate));
  const others = new Set((await eventsOf([employeeId], from, to, executor))
    .filter((event) => event.kind === 'ALPHA' && !selectedIds.includes(event.id)).map((event) => event.workDate));
  return { present, others };
}

async function clarificationOf(requestId: number, executor: Executor = db): Promise<ClarificationRow | null> {
  const [row] = await executor.select().from(clarifications).where(eq(clarifications.requestId, requestId));
  return row ?? null;
}

async function linkedEvents(clarificationId: number, onlyActive: boolean, executor: Executor = db): Promise<EventRow[]> {
  const rows = await executor.select({ event: clarificationEvents, active: clarificationEventLinks.active }).from(clarificationEventLinks)
    .innerJoin(clarificationEvents, eq(clarificationEvents.id, clarificationEventLinks.eventId))
    .where(eq(clarificationEventLinks.clarificationId, clarificationId)).orderBy(asc(clarificationEvents.workDate));
  const seen = new Map<number, EventRow>();
  for (const row of rows) if (!onlyActive || row.active) seen.set(row.event.id, row.event);
  return [...seen.values()];
}

const clock = (at: Date | null) => (at ? wibClock(at) : '-');

function filledText(row: Pick<ClarificationRow, 'inAt' | 'outAt' | 'returnAt'>, kind: EventKind): string | null {
  if (kind === 'ALPHA' && row.inAt) return `Masuk ${clock(row.inAt)}, pulang ${row.outAt ? clock(row.outAt) : 'kosong'}`;
  if (kind === 'FORGOT_OUT') return `Pulang ${clock(row.outAt)}`;
  if (kind === 'FORGOT_RETURN') return `Masuk Kembali ${clock(row.returnAt)}`;
  return null;
}

/** Bentuknya mengikuti `RequestHandler`; dirangkai di `lib/request-handlers.ts`. */
export const clarificationHandler = {
  async prepare(tx: Tx, actor: Actor, input: Record<string, unknown>) {
    const now = new Date();
    const today = wibDate(now);
    const problem = await eligibility(actor, today, tx);
    if (problem) return fail(403, problem);
    const draft = parseDraft(input);
    if ('ok' in draft) return draft;
    await lockPerson(tx, actor.personId);
    const events = await tx.select().from(clarificationEvents).where(inArray(clarificationEvents.id, draft.eventIds)).orderBy(asc(clarificationEvents.workDate));
    if (events.length !== draft.eventIds.length) return fail(404, 'Kejadian tidak ditemukan. Muat ulang.');
    if (events.some((event) => event.employeeId !== actor.personId)) return fail(403, 'Hanya kejadian milik Anda sendiri yang bisa dijelaskan.');
    const links = await linksOf(events.map((event) => event.id), tx);
    if (events.some((event) => activeLink(links.get(event.id)))) return fail(409, 'Kejadian ini sudah dijelaskan dan menunggu keputusan atau sudah disetujui.');
    if (events.some((event) => event.state !== 'OPEN' && event.state !== 'EXPIRED')) return fail(409, 'Kejadian ini sudah dibereskan. Muat ulang.');
    const kind = events[0].kind as EventKind;
    if (events.some((event) => event.kind !== kind)) return fail(400, 'Satu penjelasan hanya untuk satu jenis kejadian.');
    if (!causesFor(kind).includes(draft.cause)) return fail(400, 'Sebab itu tidak bisa dipakai untuk kejadian ini.');

    const expired = events.filter((event) => event.state === 'EXPIRED' || !isOpenAt(event.deadlineAt, now));
    if (expired.length && expired.length !== events.length) return fail(409, 'Sebagian hari sudah lewat batas. Jelaskan hari yang masih dalam batas saja.');
    const late = expired.length > 0;
    let lateReason: string | null = null;
    if (late) {
      if (!lateSubmitAllowed(kind, draft.cause) || events.length > 1) {
        return fail(409, kind === 'ALPHA'
          ? 'Sudah lewat batas 3 hari. Alpha hanya bisa diajukan terlambat dengan sebab Lupa absen. Bicarakan dengan HR.'
          : 'Sudah lewat batas 3 hari. Bicarakan dengan HR.');
      }
      const checked = await checkReason(draft.lateReason, 'Alasan terlambat');
      if (!checked.ok) return fail(400, checked.error);
      lateReason = checked.reason;
    }
    if (events.length > 1) {
      if (kind !== 'ALPHA' || !seriesAllowed(draft.cause)) return fail(400, 'Beberapa hari sekaligus hanya untuk alpha yang dijelaskan sakit atau izin mendadak.');
      const facts = await contiguityFacts(actor.personId, events.map((event) => event.workDate), draft.eventIds, tx);
      if (!isContiguous(events.map((event) => event.workDate), facts.others, facts.present)) return fail(400, 'Hari yang dipilih harus berturut-turut.');
    }
    const reason = await checkReason(draft.reason, 'Alasan');
    if (!reason.ok) return fail(400, reason.error);

    const dates = events.map((event) => event.workDate);
    const date = dates[0];
    const rules = await clarifyRules(date, tx);
    let inAt: Date | null = null;
    let outAt: Date | null = null;
    let returnAt: Date | null = null;
    const absenceCause = draft.cause === 'SICK' || draft.cause === 'SICK_LETTER' || draft.cause === 'SUDDEN_PERMIT' ? draft.cause : null;
    if (absenceCause) {
      const clash = await absenceDateClash(actor.personId, dates, tx);
      if (clash) return fail(409, `${clash} Batalkan dulu atau jelaskan dengan sebab lain.`);
      if (absenceCause === 'SICK') {
        const subject = (await subjectOn(actor.personId, today, tx))!;
        const max = await sickRunExceeded(subject, dates, tx);
        if (max != null) return fail(409, `Sakit tanpa surat paling lama ${max} hari kerja berturut-turut. Pilih sakit dengan surat dokter.`, 'SWITCH_TO_LETTER');
      }
    } else if (kind === 'ALPHA') {
      if (!draft.inAt) return fail(400, 'Isi jam masuk.');
      const day = (await dayFacts(date, [actor.personId], tx, now)).get(actor.personId);
      const problemText = (draft.inAt > now || (draft.outAt && draft.outAt > now)) ? 'Jam itu belum terjadi.'
        : correctionProblem(date, draft.inAt, draft.outAt, rules.cutoff) ?? earliestInProblem(date, day?.shift?.startTime ?? null, draft.inAt, rules.earliestIn);
      if (problemText) return fail(400, problemText);
      inAt = draft.inAt;
      outAt = draft.outAt;
    } else if (kind === 'FORGOT_OUT') {
      const info = (await loadDayInfos([actor.personId], date, date, tx, now)).get(key(actor.personId, date));
      const currentIn = info?.effective.state.inAt ?? null;
      if (!currentIn) return fail(409, 'Hari itu tidak punya absen masuk. Muat ulang.');
      if (!draft.outAt) return fail(400, 'Isi jam pulang yang benar.');
      const problemText = draft.outAt > now ? 'Jam itu belum terjadi.' : correctionProblem(date, currentIn, draft.outAt, rules.cutoff);
      if (problemText) return fail(400, problemText);
      outAt = draft.outAt;
    } else if (kind === 'FORGOT_RETURN') {
      const info = (await loadDayInfos([actor.personId], date, date, tx, now)).get(key(actor.personId, date));
      const breakAt = info?.records.BREAK?.recordedAt ?? null;
      if (!breakAt) return fail(409, 'Hari itu tidak punya catatan Istirahat. Muat ulang.');
      if (!draft.returnAt) return fail(400, 'Isi jam Masuk Kembali yang benar.');
      const problemText = draft.returnAt > now ? 'Jam itu belum terjadi.'
        : !withinOutCutoff(date, draft.returnAt, rules.cutoff) ? `Jam Masuk Kembali harus di hari kerja ${date}.`
          : returnProblem(breakAt, draft.returnAt, info?.effective.state.outAt ?? null);
      if (problemText) return fail(400, problemText);
      returnAt = draft.returnAt;
    }

    const summary = `${eventTitle(kind, events[0].minutes)} ${rangeText(dates)}: ${CAUSE_LABELS[draft.cause]}${late ? ' (terlambat)' : ''}`;
    return {
      ok: true as const,
      data: {
        subjectEmployeeId: actor.personId,
        summary,
        dedupeKey: null,
        requiredAttachment: draft.cause === 'SICK_LETTER' && !draft.letterPending ? 'Foto surat dokter' : null,
        save: async (inner: Tx, requestId: number) => {
          const absenceRequestId = absenceCause ? await createClarificationAbsence(inner, {
            requestId, employeeId: actor.personId, cause: absenceCause, dates, reason: reason.reason, letterPending: draft.letterPending,
            actorAccountId: actor.accountId,
          }) : null;
          const [row] = await inner.insert(clarifications).values({
            requestId, employeeId: actor.personId, cause: draft.cause, inAt, outAt, returnAt, reason: reason.reason, late, lateReason,
            absenceRequestId, createdByAccountId: actor.accountId,
          }).returning();
          await inner.insert(clarificationEventLinks).values(events.map((event) => ({ clarificationId: row.id, eventId: event.id })));
        },
      },
    };
  },

  async apply(tx: Tx, actorAccountId: number, requestId: number): Promise<{ ok: true; effect: string } | Fail> {
    const row = await clarificationOf(requestId, tx);
    if (!row) return fail(404, 'Isi penjelasan tidak ditemukan.');
    const events = await linkedEvents(row.id, true, tx);
    if (!events.length) return fail(409, 'Kejadian penjelasan ini sudah tidak berlaku. Muat ulang.');
    const kind = events[0].kind as EventKind;
    const date = events[0].workDate;
    let effect: string;
    if (row.absenceRequestId) {
      const days = (await absenceDaysOf(row.absenceRequestId, tx)).filter((day) => day.active);
      if (!days.length) return fail(409, 'Hari tidak masuk penjelasan ini sudah tidak berlaku. Muat ulang.');
      effect = `${rangeText(days.map((day) => day.workDate))} tercatat ${row.cause === 'SUDDEN_PERMIT' ? 'izin mendadak' : CAUSE_LABELS[row.cause as Cause].toLowerCase()}, bukan alpha.`;
    } else if ((kind === 'ALPHA' && row.cause === 'FORGOT') || kind === 'FORGOT_OUT') {
      const shift = kind === 'ALPHA' ? (await dayFacts(date, [row.employeeId], tx)).get(row.employeeId) : null;
      const written = await writeClarificationCorrection(tx, {
        employeeId: row.employeeId, workDate: date, actorAccountId, note: `Penjelasan PJ-${requestId} disetujui: ${row.reason}`,
        build: (current: DayState) => {
          if (kind === 'FORGOT_OUT') {
            if (!current.inAt) return 'Hari itu sudah tidak punya absen masuk. Tolak penjelasan ini.';
            if (current.outAt) return 'Jam pulang hari itu sudah diisi (dikoreksi HR). Tolak penjelasan ini.';
            return { ...current, outAt: row.outAt };
          }
          if (current.inAt) return 'Hari itu sudah punya absen masuk (dikoreksi HR). Tolak penjelasan ini.';
          const branchId = shift?.shift?.branchId ?? shift?.person.branchId ?? null;
          if (branchId == null) return 'Penempatan orang ini pada tanggal itu tidak ditemukan.';
          return {
            branchId, shiftId: shift?.shift?.shiftId ?? null, shiftVersionId: shift?.shift?.shiftVersionId ?? null, inAt: row.inAt, outAt: row.outAt,
          };
        },
      });
      if (!written.ok) return fail(409, written.error);
      await tx.insert(clarificationEffects).values({ clarificationId: row.id, kind: 'APPLY', correctionId: written.id });
      const forgot = forgotKindOf(kind, row.cause as Cause)!;
      const nth = await predictedNth(row.employeeId, events[0].id, date, forgot, tx);
      effect = `${shortDate(date)} tercatat Hadir dengan jam yang diisi (diisi lewat klarifikasi). ${nthText(forgot, nth)}.`;
    } else if (kind === 'FORGOT_RETURN') {
      const nth = await predictedNth(row.employeeId, events[0].id, date, 'RETURN', tx);
      effect = `Masuk Kembali ${shortDate(date)} tercatat ${clock(row.returnAt)} lewat penjelasan. ${nthText('RETURN', nth)}.`;
    } else {
      effect = `${eventTitle(kind, events[0].minutes)} ${shortDate(date)} ditandai sudah dijelaskan.${kind === 'LATE' ? ' Potongan telatnya ditiadakan; menitnya tetap tampil.' : ''}`;
    }
    await setState(tx, events.map((event) => event.id), 'EXPLAINED');
    return { ok: true, effect };
  },

  /** Ditolak, dibatalkan, atau dicabut: tautan dilepas, hari tidak masuk dilepas, koreksi dibalik, kejadian kembali. */
  async close(tx: Tx, actorAccountId: number, requestId: number, reason: string) {
    const row = await clarificationOf(requestId, tx);
    if (!row) return;
    const now = new Date();
    const [request] = await tx.execute<{ status: string }>(sql`select status::text as status from hris.requests where id = ${requestId}`);
    const events = await linkedEvents(row.id, true, tx);
    await tx.update(clarificationEventLinks).set({ active: false })
      .where(and(eq(clarificationEventLinks.clarificationId, row.id), eq(clarificationEventLinks.active, true)));
    if (row.absenceRequestId) await releaseAbsenceDays(tx, row.absenceRequestId);
    if (request?.status === 'REVOKED') {
      const effects = await tx.select().from(clarificationEffects).where(eq(clarificationEffects.clarificationId, row.id));
      for (const applied of effects.filter((e) => e.kind === 'APPLY')) {
        if (effects.some((e) => e.kind === 'REVERSE')) break;
        const { row: correction } = await correctionIsLatest(applied.correctionId, tx);
        if (!correction) continue;
        const written = await writeClarificationCorrection(tx, {
          employeeId: correction.employeeId, workDate: correction.workDate, actorAccountId, reversesId: correction.id,
          note: `Penjelasan PJ-${requestId} dicabut: ${reason}`,
          build: () => ({
            branchId: correction.prevBranchId, shiftId: correction.prevShiftId, shiftVersionId: correction.prevShiftVersionId,
            inAt: correction.prevInAt, outAt: correction.prevOutAt,
          }),
        });
        if (written.ok) await tx.insert(clarificationEffects).values({ clarificationId: row.id, kind: 'REVERSE', correctionId: written.id });
      }
    }
    const reopen = events.filter((event) => !row.late && isOpenAt(event.deadlineAt, now)).map((event) => event.id);
    await setState(tx, reopen, 'OPEN');
    await setState(tx, events.filter((event) => !reopen.includes(event.id)).map((event) => event.id), 'EXPIRED');
  },

  /** Cabut hanya bila koreksi dari penjelasan ini masih yang terakhir hari itu (KEH-158). */
  async revokeBlock(tx: Tx, requestId: number): Promise<string | null> {
    const row = await clarificationOf(requestId, tx);
    if (!row) return 'Isi penjelasan tidak ditemukan.';
    const effects = await tx.select().from(clarificationEffects).where(eq(clarificationEffects.clarificationId, row.id));
    if (effects.some((e) => e.kind === 'REVERSE')) return null;
    for (const applied of effects.filter((e) => e.kind === 'APPLY')) {
      if (!(await correctionIsLatest(applied.correctionId, tx)).latest) {
        return 'Hari itu sudah dikoreksi HR sesudah penjelasan ini disetujui. Balik koreksi HR itu dulu di Koreksi Absen, lalu cabut.';
      }
    }
    return null;
  },

  async effectPreview(requestId: number) {
    const row = await clarificationOf(requestId);
    if (!row) return '';
    const events = await linkedEvents(row.id, true);
    const kind = (events[0]?.kind ?? 'ALPHA') as EventKind;
    if (row.absenceRequestId) return `${rangeText(events.map((e) => e.workDate))} tercatat ${CAUSE_LABELS[row.cause as Cause].toLowerCase()}, bukan alpha.`;
    if ((kind === 'ALPHA' && row.cause === 'FORGOT') || kind === 'FORGOT_OUT') {
      return 'Jam yang diisi ditulis sebagai koreksi absen bertanda "Diisi lewat klarifikasi". Lupa absen dikenai denda lupa absen. Penyetuju tidak mengubah jamnya; bila salah, tolak dengan alasan.';
    }
    if (kind === 'FORGOT_RETURN') return 'Jam Masuk Kembali yang diisi dicatat. Lupa absen dikenai denda lupa absen.';
    return kind === 'LATE' ? 'Telat ini ditandai sudah dijelaskan; potongan telatnya ditiadakan, menitnya tetap tampil.' : 'Pulang cepat ini ditandai sudah dijelaskan.';
  },

  async describe(requestId: number, reveal: boolean) {
    const row = await clarificationOf(requestId);
    if (!row) return [];
    const events = await linkedEvents(row.id, false);
    if (!events.length) return [];
    const kind = events[0].kind as EventKind;
    const dates = events.map((event) => event.workDate);
    const rows: { label: string; before: string | null; after: string | null }[] = [
      { label: 'Kejadian', before: null, after: `${eventTitle(kind, events[0].minutes)} ${rangeText(dates)}` },
      { label: 'Sebab', before: null, after: CAUSE_LABELS[row.cause as Cause] },
    ];
    const filled = filledText(row, kind);
    if (row.late) rows.push({ label: 'Terlambat', before: null, after: 'Diajukan sesudah batas 3 hari; disahkan HR, Pemilik, atau GM' });
    if (!reveal) {
      if (filled) rows.push({ label: 'Jam yang diisi', before: null, after: filled });
      return rows;
    }
    rows.push({ label: 'Alasan', before: null, after: row.reason });
    if (row.lateReason) rows.push({ label: 'Alasan terlambat', before: null, after: row.lateReason });

    // Keterangan pembantu putusan (KEH-L38).
    const date = dates[0];
    const info = (await loadDayInfos([row.employeeId], date, date)).get(key(row.employeeId, date));
    const original = Object.entries(info?.records ?? {}).map(([k, rec]) => `${KIND_LABELS[k as keyof typeof KIND_LABELS]} ${clock(rec!.recordedAt)}`).join(', ');
    const recorded = kind === 'ALPHA' ? `Tanpa absen${original ? ` (${original})` : ''}`
      : `${original || 'Tanpa foto'}${info?.effective.lateMinutes ? `; telat ${info.effective.lateMinutes} menit` : ''}`;
    rows.push({ label: 'Tercatat server', before: recorded, after: filled ?? '-' });
    const outPhoto = info?.records.OUT?.recordedAt ?? null;
    if (kind === 'FORGOT_OUT' && row.outAt && outPhoto && Math.abs(row.outAt.getTime() - outPhoto.getTime()) > 2 * 3_600_000) {
      rows.push({ label: 'Perlu dicermati', before: null, after: `Jam pulang diisi ${clock(row.outAt)}, foto Pulang terakhir ${clock(outPhoto)}` });
    }
    if (kind === 'FORGOT_RETURN' && row.returnAt && info?.records.BREAK) {
      const minutes = Math.round((row.returnAt.getTime() - info.records.BREAK.recordedAt.getTime()) / 60_000);
      if (minutes > 180) rows.push({ label: 'Perlu dicermati', before: null, after: `Istirahat ${clock(info.records.BREAK.recordedAt)}, Masuk Kembali diisi ${clock(row.returnAt)} (${minutes} menit)` });
    }
    const forgot = forgotKindOf(kind, row.cause as Cause);
    if (forgot) rows.push({ label: 'Hitungan lupa absen', before: null, after: nthText(forgot, await predictedNth(row.employeeId, events[0].id, date, forgot)) });
    const period = payPeriodOf(date);
    const previousStart = shiftPeriod(period.start, -1);
    const counts = await db.execute<{ current: number; previous: number }>(sql`
      select count(*) filter (where ev.work_date >= ${period.start}::date)::int as current,
             count(*) filter (where ev.work_date < ${period.start}::date)::int as previous
      from hris.clarifications c join hris.clarification_event_links l on l.clarification_id = c.id
      join hris.clarification_events ev on ev.id = l.event_id
      where c.employee_id = ${row.employeeId} and c.id <> ${row.id} and ev.work_date between ${previousStart}::date and ${period.end}::date`);
    rows.push({ label: 'Penjelasan lain', before: null, after: `Periode ini ${counts[0]?.current ?? 0}, periode lalu ${counts[0]?.previous ?? 0}` });
    const absence = await absenceDayStatuses([row.employeeId], dates[0], dates[dates.length - 1]);
    const clashes = dates.filter((d) => absence.approved.has(key(row.employeeId, d)) || absence.waiting.has(key(row.employeeId, d)));
    if (clashes.length && !row.absenceRequestId) rows.push({ label: 'Bentrok', before: null, after: `Ada pengajuan izin/sakit/cuti pada ${clashes.map(shortDate).join(', ')}` });
    const chain = await db.execute<{ n: number }>(sql`
      with recursive chain as (select id, resubmitted_from_id from hris.requests where id = ${requestId}
        union all select r.id, r.resubmitted_from_id from hris.requests r join chain c on r.id = c.resubmitted_from_id)
      select count(*)::int as n from chain`);
    const nth = Number(chain[0]?.n ?? 1);
    if (nth > 1) rows.push({ label: 'Ajukan ulang', before: null, after: `Ajukan ulang ke-${nth - 1}` });
    if (filled) rows.push({ label: 'Label', before: null, after: 'Diisi lewat klarifikasi' });
    return rows;
  },

  async resubmitValues(requestId: number) {
    const row = await clarificationOf(requestId);
    if (!row) return null;
    const events = await linkedEvents(row.id, false);
    const local = (at: Date | null) => (at ? new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 16) : '');
    return {
      eventIds: events.map((event) => event.id), cause: row.cause, inAt: local(row.inAt), outAt: local(row.outAt), returnAt: local(row.returnAt),
      reason: row.reason, lateReason: row.lateReason ?? '', letterPending: false,
    };
  },
};

// ---- Layar Perlu Dijelaskan (KEH-L35) ----

export type MyTab = 'open' | 'waiting' | 'done';

export type ClarificationCard = {
  id: number; kind: EventKind; title: string; workDate: IsoDate; dateLabel: string; stateLabel: string;
  left: string; urgency: ReturnType<typeof urgencyOf>; deadline: string; consequence: string;
  requestId: number | null; rejection: { requestId: number; reason: string | null } | null;
  action: 'explain' | 'resubmit' | 'late' | null; note: string | null; seriesCount: number;
};

function toCard(event: EventRow, links: LinkInfo[] | undefined, now: Date, series: number): ClarificationCard {
  const kind = event.kind as EventKind;
  const active = activeLink(links);
  const last = links?.at(-1) ?? null;
  const rejection = !active && last?.status === 'REJECTED' ? { requestId: last.requestId, reason: last.reason } : null;
  const over = event.state === 'EXPIRED' || (event.state === 'OPEN' && !isOpenAt(event.deadlineAt, now));
  const open = event.state === 'OPEN' && !over && !active;
  const lateOk = over && !active && (kind === 'FORGOT_OUT' || kind === 'FORGOT_RETURN' || kind === 'ALPHA');
  return {
    id: event.id, kind, title: eventTitle(kind, event.minutes), workDate: event.workDate, dateLabel: shortDate(event.workDate),
    stateLabel: active ? (active.status === 'APPROVED' ? 'Disetujui' : 'Menunggu keputusan') : rejection && open ? 'Ditolak'
      : over ? EVENT_STATE_LABELS.EXPIRED : EVENT_STATE_LABELS[event.state as EventState],
    left: open ? leftText(event.deadlineAt, now) : '', urgency: open ? urgencyOf(event.deadlineAt, now) : 'over',
    deadline: deadlineText(event.deadlineAt), consequence: consequenceText(kind),
    requestId: active?.requestId ?? last?.requestId ?? null, rejection,
    action: open ? (rejection ? 'resubmit' : 'explain') : lateOk ? 'late' : null,
    note: over && !active
      ? (lateOk ? (kind === 'ALPHA' ? 'Sudah lewat batas 3 hari. Bila sebenarnya hadir dan lupa absen, ajukan terlambat; selain itu bicarakan dengan HR.' : 'Sudah lewat batas 3 hari. Masih bisa diajukan terlambat (denda tetap berlaku).')
        : 'Sudah lewat batas 3 hari. Bicarakan dengan HR.')
      : event.state === 'VOID' ? 'Sudah dibereskan lewat koreksi atau izin.' : null,
    seriesCount: series,
  };
}

/** Panjang rangkaian alpha OPEN berturut-turut tempat kejadian ini berada (KEH-152). */
function seriesOf(event: EventRow, openAlpha: EventRow[], present: Set<string>): EventRow[] {
  const sorted = openAlpha.filter((row) => row.employeeId === event.employeeId).sort((a, b) => (a.workDate < b.workDate ? -1 : 1));
  const index = sorted.findIndex((row) => row.id === event.id);
  if (index < 0) return [event];
  const allAlpha = new Set<string>();
  const joined = (a: EventRow, b: EventRow) => isContiguous([a.workDate, b.workDate], allAlpha, present);
  let start = index;
  while (start > 0 && joined(sorted[start - 1], sorted[start])) start -= 1;
  let end = index;
  while (end < sorted.length - 1 && joined(sorted[end], sorted[end + 1])) end += 1;
  return sorted.slice(start, end + 1);
}

async function presentDates(employeeId: number, from: IsoDate, to: IsoDate): Promise<Set<string>> {
  const infos = await loadDayInfos([employeeId], from, to);
  return new Set([...infos.values()].filter((info) => info.effective.state.inAt).map((info) => info.workDate));
}

export async function myClarificationsScreen(actor: Actor | null, tab: MyTab, all: boolean, now: Date = new Date()) {
  if (!actor) return null;
  const today = wibDate(now);
  const problem = await eligibility(actor, today);
  if (problem) return { tracked: false as const, problem };
  const from = all ? marksFrom() : addDays(today, -62);
  const events = await eventsOf([actor.personId], from < marksFrom() ? marksFrom() : from, today);
  const links = await linksOf(events.map((event) => event.id));
  const openAlpha = events.filter((event) => event.kind === 'ALPHA' && event.state === 'OPEN' && !activeLink(links.get(event.id)) && isOpenAt(event.deadlineAt, now));
  const present = openAlpha.length ? await presentDates(actor.personId, openAlpha[0].workDate, today) : new Set<string>();
  const bucket = (event: EventRow): MyTab => {
    const active = activeLink(links.get(event.id));
    if (active && (active.status === 'PENDING' || active.status === 'REVIEWED')) return 'waiting';
    if (!active && event.state === 'OPEN' && isOpenAt(event.deadlineAt, now)) return 'open';
    return 'done';
  };
  const counts = { open: 0, waiting: 0, done: 0 };
  for (const event of events) counts[bucket(event)] += 1;
  const cards = events.filter((event) => bucket(event) === tab).map((event) => toCard(event, links.get(event.id), now,
    openAlpha.some((row) => row.id === event.id) ? seriesOf(event, openAlpha, present).length : 1));
  cards.sort(tab === 'open'
    ? (a, b) => events.find((e) => e.id === a.id)!.deadlineAt.getTime() - events.find((e) => e.id === b.id)!.deadlineAt.getTime()
    : (a, b) => (a.workDate < b.workDate ? 1 : -1));
  return { tracked: true as const, tab, all, counts, cards };
}

/** Angka di menu Perlu Dijelaskan dan kartu Beranda. */
export async function openClarificationCount(actor: Actor | null, now: Date = new Date()): Promise<number> {
  if (!actor) return 0;
  const rows = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from hris.clarification_events ev
    where ev.employee_id = ${actor.personId} and ev.state = 'OPEN' and ev.deadline_at > ${now.toISOString()}::timestamptz
      and not exists (select 1 from hris.clarification_event_links l where l.event_id = ev.id and l.active)`);
  return Number(rows[0]?.n ?? 0);
}

// ---- Isi Penjelasan (KEH-L36) ----

export async function explainFormScreen(actor: Actor | null, eventId: number, options: { series: boolean; late: boolean }, now: Date = new Date()) {
  if (!actor) return null;
  const today = wibDate(now);
  const problem = await eligibility(actor, today);
  if (problem) return { allowed: false as const, problem };
  const [event] = await db.select().from(clarificationEvents).where(eq(clarificationEvents.id, eventId));
  if (!event || event.employeeId !== actor.personId) return { allowed: false as const, problem: 'Kejadian tidak ditemukan.' };
  const kind = event.kind as EventKind;
  const links = await linksOf([event.id]);
  if (activeLink(links.get(event.id))) return { allowed: false as const, problem: 'Kejadian ini sudah dijelaskan. Lihat di tab Menunggu keputusan.' };
  const open = event.state === 'OPEN' && isOpenAt(event.deadlineAt, now);
  const late = !open && (event.state === 'EXPIRED' || event.state === 'OPEN');
  if (!open && !late) return { allowed: false as const, problem: 'Kejadian ini sudah dibereskan.' };
  const causes = causesFor(kind).filter((cause) => !late || lateSubmitAllowed(kind, cause));
  if (!causes.length) return { allowed: false as const, problem: 'Sudah lewat batas 3 hari. Bicarakan dengan HR.' };

  let series: { id: number; dateLabel: string }[] = [];
  if (kind === 'ALPHA' && open && options.series) {
    const events = await eventsOf([actor.personId], addDays(event.workDate, -MAX_EVENTS), addDays(event.workDate, MAX_EVENTS));
    const all = await linksOf(events.map((row) => row.id));
    const openAlpha = events.filter((row) => row.kind === 'ALPHA' && row.state === 'OPEN' && !activeLink(all.get(row.id)) && isOpenAt(row.deadlineAt, now));
    const present = await presentDates(actor.personId, addDays(event.workDate, -MAX_EVENTS), today);
    series = seriesOf(event, openAlpha, present).map((row) => ({ id: row.id, dateLabel: shortDate(row.workDate) }));
  }
  const day = (await dayFacts(event.workDate, [actor.personId], db, now)).get(actor.personId);
  const records = day?.info?.records ?? {};
  const local = (at: Date | null | undefined) => (at ? new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 16) : '');
  const forgotKinds = causes.map((cause) => forgotKindOf(kind, cause)).filter((k): k is ForgotKind => k !== null);
  const nth = forgotKinds.length ? await predictedNth(actor.personId, event.id, event.workDate, forgotKinds[0]) : null;
  const rules = await absenceRules(today);
  return {
    allowed: true as const,
    event: {
      id: event.id, kind, kindLabel: EVENT_KIND_LABELS[kind], title: eventTitle(kind, event.minutes), workDate: event.workDate,
      dateLabel: longDate(event.workDate), deadline: deadlineText(event.deadlineAt), left: open ? leftText(event.deadlineAt, now) : 'Lewat batas',
      late, consequence: consequenceText(kind),
    },
    causes: causes.map((value) => ({ value, label: CAUSE_LABELS[value] })),
    series,
    evidence: {
      shift: day?.shift ? `${day.shift.startTime}–${day.shift.endTime}` : null,
      in: records.IN ? clock(records.IN.recordedAt) : null, break: records.BREAK ? clock(records.BREAK.recordedAt) : null,
      return: records.RETURN ? clock(records.RETURN.recordedAt) : null, out: records.OUT ? clock(records.OUT.recordedAt) : null,
    },
    prefill: {
      inAt: local(day?.info?.effective.state.inAt) || `${event.workDate}T${day?.shift?.startTime ?? '08:00'}`,
      outAt: local(records.OUT?.recordedAt) || (day?.shift ? `${day.shift.endTime < day.shift.startTime ? addDays(event.workDate, 1) : event.workDate}T${day.shift.endTime}` : ''),
      returnAt: '',
    },
    forgot: nth != null ? { label: FORGOT_KIND_LABELS[forgotKinds[0]], nth, surcharge: nth >= FORGOT_SURCHARGE_FROM } : null,
    rules: { sickNoLetterMaxDays: rules.sickNoLetterMaxDays, letterGraceDays: rules.letterGraceDays },
  };
}

// ---- Perlu Dijelaskan Tim (KEH-L37) ----

export type TeamTab = 'open' | 'soon' | 'waiting' | 'streak';

const targetOf = (person: RosterPerson) => ({ personId: person.employeeId, branchId: person.branchId, departmentId: person.departmentId });

export async function teamClarificationScreen(actor: Actor, input: { tab: TeamTab; branchId: number | null; kind: string | null }, now: Date = new Date()) {
  const today = wibDate(now);
  const roster = (await rosterOn(today)).filter((person) => can(actor, 'clarification.team.view', targetOf(person)));
  const people = new Map(roster.map((person) => [person.employeeId, person]));
  const org = await getOrgLookup();
  const branches = org.branches.filter((b) => b.active && roster.some((p) => p.branchId === b.id)).map(({ id, name }) => ({ id, name }));
  const branchName = (id: number) => org.branches.find((b) => b.id === id)?.name ?? '-';
  const base = { tab: input.tab, branchId: input.branchId, kind: input.kind, branches, kinds: Object.entries(EVENT_KIND_LABELS).map(([value, label]) => ({ value, label })) };
  const visible = [...people.values()].filter((p) => input.branchId == null || p.branchId === input.branchId).map((p) => p.employeeId);

  if (input.tab === 'streak') {
    const flags = visible.length ? await db.select().from(absenceStreakFlags).where(inArray(absenceStreakFlags.employeeId, visible)).orderBy(asc(absenceStreakFlags.flaggedDate)) : [];
    const seen = flags.length ? await db.select().from(absenceStreakSeen).where(inArray(absenceStreakSeen.flagId, flags.map((f) => f.id))).orderBy(asc(absenceStreakSeen.id)) : [];
    return {
      ...base, rows: [], waiting: [],
      streaks: flags.reverse().map((flag) => {
        const person = people.get(flag.employeeId)!;
        const last = seen.filter((s) => s.flagId === flag.id).at(-1) ?? null;
        return {
          id: flag.id, name: person.name, branch: branchName(person.branchId), startLabel: shortDate(flag.startDate), flaggedLabel: shortDate(flag.flaggedDate),
          causes: flag.causes, seen: last?.seen ?? false, note: last?.note ?? null, at: last?.at.toISOString() ?? null,
          canMark: can(actor, 'clarification.streak.seen', targetOf(person)),
        };
      }),
    };
  }

  const events = (await eventsOf(visible, addDays(today, -REVALIDATE_DAYS), today))
    .filter((event) => input.kind == null || event.kind === input.kind);
  const links = await linksOf(events.map((event) => event.id));
  if (input.tab === 'waiting') {
    const byRequest = new Map<number, { requestId: number; name: string; branch: string; title: string; dates: IsoDate[]; waitingDays: number; canOpen: boolean }>();
    for (const event of events) {
      const link = activeLink(links.get(event.id));
      if (!link || (link.status !== 'PENDING' && link.status !== 'REVIEWED')) continue;
      const person = people.get(event.employeeId)!;
      const entry = byRequest.get(link.requestId) ?? {
        requestId: link.requestId, name: person.name, branch: branchName(person.branchId), title: eventTitle(event.kind as EventKind, event.minutes),
        dates: [], waitingDays: 0, canOpen: can(actor, 'clarification.decide', targetOf(person)),
      };
      entry.dates.push(event.workDate);
      byRequest.set(link.requestId, entry);
    }
    const created = byRequest.size ? await db.execute<{ id: number; created_at: Date }>(sql`select id, created_at from hris.requests where id in (${ids([...byRequest.keys()])})`) : [];
    for (const row of created) {
      const entry = byRequest.get(Number(row.id));
      if (entry) entry.waitingDays = Math.floor((now.getTime() - new Date(row.created_at).getTime()) / 86_400_000);
    }
    return {
      ...base, rows: [], streaks: [],
      waiting: [...byRequest.values()].sort((a, b) => b.waitingDays - a.waitingDays).map((entry) => ({ ...entry, dateLabel: rangeText(entry.dates) })),
    };
  }
  const rows = events.filter((event) => event.state === 'OPEN' && !activeLink(links.get(event.id)) && isOpenAt(event.deadlineAt, now))
    .filter((event) => input.tab !== 'soon' || (daysLeft(event.deadlineAt, now) ?? 99) <= 1)
    .sort((a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime())
    .map((event) => {
      const person = people.get(event.employeeId)!;
      return {
        id: event.id, name: person.name, branch: branchName(person.branchId), title: eventTitle(event.kind as EventKind, event.minutes),
        dateLabel: shortDate(event.workDate), left: leftText(event.deadlineAt, now), urgency: urgencyOf(event.deadlineAt, now),
      };
    });
  return { ...base, rows, waiting: [], streaks: [] };
}

/** Sudah dilihat / buka kembali, dengan catatan (KEH-L37). Tandanya tetap tersimpan. */
export async function markStreakSeen(actor: Actor | null, input: { flagId: number; seen: boolean; note: string }) {
  if (!actor) return fail(403, FORBIDDEN);
  const [flag] = await db.select().from(absenceStreakFlags).where(eq(absenceStreakFlags.id, input.flagId));
  if (!flag) return fail(404, 'Tanda tidak ditemukan.');
  const person = (await rosterOn(wibDate(new Date()))).find((row) => row.employeeId === flag.employeeId);
  const target = person ? targetOf(person) : { personId: flag.employeeId };
  if (!can(actor, 'clarification.streak.seen', target)) return fail(403, flag.employeeId === actor.personId ? 'Tanda yang menyangkut Anda dilihat orang lain yang berhak.' : FORBIDDEN);
  const note = await checkReason(input.note, 'Catatan');
  if (!note.ok) return fail(400, note.error);
  await db.insert(absenceStreakSeen).values({ flagId: flag.id, seen: input.seen, note: note.reason, byAccountId: actor.accountId });
  return { ok: true as const, data: { message: input.seen ? 'Ditandai sudah dilihat.' : 'Dibuka kembali.' } };
}

// ---- Laporan Kebiasaan Lupa Absen (KEH-L39) ----

export async function habitScreen(actor: Actor, periodStart: string | null, now: Date = new Date()) {
  if (!hasAction(actor, 'clarification.habit.view')) return null;
  const today = wibDate(now);
  const current = payPeriodOf(today).start;
  const periods = Array.from({ length: 12 }, (_, index) => {
    const start = shiftPeriod(current, -index);
    return { start, end: addDays(shiftPeriod(start, 1), -1) };
  });
  const period = periods.find((p) => p.start === periodStart) ?? periods[0];
  const min = Number(await settingOn('attendance.forgot_habit_min', period.start));
  const all = await forgotRows(null, period.start, period.end, false);
  const approved = all.filter((row) => row.status === 'APPROVED');
  const rejected = await db.execute<{ employee_id: number; n: number }>(sql`
    select c.employee_id, count(distinct c.id)::int as n from hris.clarifications c join hris.requests r on r.id = c.request_id
    join hris.clarification_event_links l on l.clarification_id = c.id join hris.clarification_events ev on ev.id = l.event_id
    where r.status = 'REJECTED' and ev.work_date between ${period.start}::date and ${period.end}::date group by c.employee_id`);
  const names = await db.execute<{ id: number; name: string }>(sql`select id, name from hris.employees where id in (${ids(approved.map((r) => r.employeeId))})`);
  const roster = await rosterOn(period.end < today ? period.end : today);
  const org = await getOrgLookup();
  const byPerson = new Map<number, ForgotRow[]>();
  for (const row of approved) byPerson.set(row.employeeId, [...(byPerson.get(row.employeeId) ?? []), row]);
  const rows = [...byPerson].filter(([, list]) => list.length > min).map(([employeeId, list]) => {
    const branchId = roster.find((p) => p.employeeId === employeeId)?.branchId;
    return {
      employeeId, name: names.find((n) => Number(n.id) === employeeId)?.name ?? '-', branch: org.branches.find((b) => b.id === branchId)?.name ?? '-',
      in: list.filter((r) => r.kind === 'IN').length, out: list.filter((r) => r.kind === 'OUT').length, return: list.filter((r) => r.kind === 'RETURN').length,
      total: list.length, rejected: Number(rejected.find((r) => Number(r.employee_id) === employeeId)?.n ?? 0),
      days: list.sort((a, b) => (a.workDate < b.workDate ? -1 : 1)).map((r) => `${shortDate(r.workDate)} (${FORGOT_KIND_LABELS[r.kind]})`),
    };
  }).sort((a, b) => b.total - a.total);
  return { period, periods, min, rows };
}

// ---- Beranda ----

export type ClarificationCardHome = { key: string; title: string; detail?: string; href: string };

export async function clarificationAttention(actor: Actor | null, now: Date = new Date()): Promise<ClarificationCardHome[]> {
  if (!actor) return [];
  const cards: ClarificationCardHome[] = [];
  const mine = await db.execute<{ n: number; first: Date | null }>(sql`
    select count(*)::int as n, min(ev.deadline_at) as first from hris.clarification_events ev
    where ev.employee_id = ${actor.personId} and ev.state = 'OPEN' and ev.deadline_at > ${now.toISOString()}::timestamptz
      and not exists (select 1 from hris.clarification_event_links l where l.event_id = ev.id and l.active)`);
  const count = Number(mine[0]?.n ?? 0);
  if (count) {
    const first = mine[0].first ? new Date(mine[0].first) : null;
    cards.push({ key: 'clarify-mine', title: `${count} hal perlu dijelaskan`, detail: first ? `Terdekat batas ${deadlineText(first)}` : undefined, href: '/perlu-dijelaskan' });
  }
  if (hasAction(actor, 'clarification.streak.seen')) {
    const flags = await db.execute<{ n: number }>(sql`
      select count(*)::int as n from hris.absence_streak_flags f
      where f.employee_id <> ${actor.personId}
        and coalesce((select s.seen from hris.absence_streak_seen s where s.flag_id = f.id order by s.id desc limit 1), false) = false`);
    const n = Number(flags[0]?.n ?? 0);
    if (n) cards.push({ key: 'clarify-streak', title: `${n} orang tidak masuk berturut-turut`, detail: 'Belum ditandai sudah dilihat', href: '/kehadiran/perlu-dijelaskan?tab=streak' });
  }
  return cards;
}

// ---- Mesin harian `clarification-daily` 04.20 WIB (spec L3g §6) ----

export async function runClarificationDaily(now: Date = new Date()) {
  try {
    return await clarificationDaily(now);
  } catch (error) {
    await db.transaction(async (tx) => {
      await notify(tx, await ownerAccounts(), {
        kind: 'attendance.clarification', title: 'Mesin penanda alpha gagal berjalan',
        body: 'Penanda alpha dan Perlu Dijelaskan pagi ini gagal. Hari kemarin akan dikejar pada jalan berikutnya.', link: '/kehadiran/perlu-dijelaskan',
      }, null);
    }).catch(() => undefined);
    throw error;
  }
}

async function clarificationDaily(now: Date) {
  const today = wibDate(now);
  const yesterday = addDays(today, -1);
  const result = { scannedDays: 0, born: 0, voided: 0, expired: 0, reminders: 0, streaks: 0, habits: 0 };

  // 1. Lahirkan kejadian untuk hari yang belum diproses, berurutan tanpa dobel.
  const start = [marksFrom(), addDays(today, -SCAN_CATCH_UP_DAYS)].sort().at(-1)!;
  const bornByPerson = new Map<number, { kind: EventKind; minutes: number | null; workDate: IsoDate; deadlineAt: Date }[]>();
  for (let date = start; date <= yesterday; date = addDays(date, 1)) {
    if (await scanned(date, db)) continue;
    const { rules, born } = await detectOn(date, null, db, now);
    const deadlineAt = deadlineAfter(date, rules.deadlineDays);
    await db.transaction(async (tx) => {
      if (!(await noticeOnce(tx, `clar-scan:${date}`))) return;
      const values = [...born].flatMap(([employeeId, list]: [number, BornEvent[]]) => list.map((event) => ({
        employeeId, workDate: date, kind: event.kind, minutes: event.minutes, deadlineAt,
      })));
      if (!values.length) return;
      const inserted = await tx.insert(clarificationEvents).values(values).onConflictDoNothing().returning();
      for (const row of inserted) {
        bornByPerson.set(row.employeeId, [...(bornByPerson.get(row.employeeId) ?? []), { kind: row.kind as EventKind, minutes: row.minutes, workDate: row.workDate, deadlineAt: row.deadlineAt }]);
      }
      result.born += inserted.length;
    });
    result.scannedDays += 1;
  }

  // 2. Kejadian yang sudah dibereskan (koreksi, izin disetujui) dilepas.
  const recent = (await eventsOf(null, addDays(today, -REVALIDATE_DAYS), yesterday)).filter((event) => event.state === 'OPEN' || event.state === 'EXPIRED');
  const recentLinks = await linksOf(recent.map((event) => event.id));
  const free = recent.filter((event) => !activeLink(recentLinks.get(event.id)));
  for (const date of [...new Set(free.map((event) => event.workDate))]) {
    const own = free.filter((event) => event.workDate === date);
    const { born } = await detectOn(date, [...new Set(own.map((event) => event.employeeId))], db, now);
    const stale = own.filter((event) => !(born.get(event.employeeId) ?? []).some((found) => found.kind === event.kind)).map((event) => event.id);
    await setState(db, stale, 'VOID');
    result.voided += stale.length;
  }

  // 3. Lewat batas.
  const expired = await db.execute<{ id: number }>(sql`
    update hris.clarification_events ev set state = 'EXPIRED', state_changed_at = now()
    where ev.state = 'OPEN' and ev.deadline_at <= ${now.toISOString()}::timestamptz
      and not exists (select 1 from hris.clarification_event_links l where l.event_id = ev.id and l.active)
    returning ev.id`);
  result.expired = expired.length;

  // 4. Pemberitahuan sekali per tanda: lahir, sisa 1 hari, hari terakhir.
  await db.transaction(async (tx) => {
    for (const [employeeId, list] of bornByPerson) await notifyBorn(tx, employeeId, list);
  });
  const open = (await db.select().from(clarificationEvents).where(eq(clarificationEvents.state, 'OPEN'))).filter((event) => isOpenAt(event.deadlineAt, now));
  const openLinks = await linksOf(open.map((event) => event.id));
  const remind = new Map<number, { left: 0 | 1; events: EventRow[] }[]>();
  for (const event of open) {
    if (activeLink(openLinks.get(event.id))) continue;
    const left = daysLeft(event.deadlineAt, now);
    if (left !== 0 && left !== 1) continue;
    if (!(await noticeOnce(db, `clar:${event.id}:${left === 0 ? 'LAST_DAY' : 'ONE_DAY_LEFT'}`))) continue;
    const list = remind.get(event.employeeId) ?? [];
    const group = list.find((g) => g.left === left) ?? (list.push({ left, events: [] }), list[list.length - 1]);
    group.events.push(event);
    remind.set(event.employeeId, list);
  }
  await db.transaction(async (tx) => {
    for (const [employeeId, groups] of remind) {
      for (const group of groups) {
        const first = group.events[0];
        await notify(tx, await accountsOf([employeeId]), {
          kind: 'attendance.clarification',
          title: group.left === 0 ? `Hari terakhir menjelaskan: ${group.events.length === 1 ? `${eventTitle(first.kind as EventKind, first.minutes)} ${shortDate(first.workDate)}` : `${group.events.length} hal`}`
            : `Tinggal 1 hari: ${group.events.length === 1 ? `${eventTitle(first.kind as EventKind, first.minutes)} ${shortDate(first.workDate)}` : `${group.events.length} hal perlu dijelaskan`}`,
          body: consequenceText(first.kind as EventKind), link: '/perlu-dijelaskan',
        }, null);
        result.reminders += 1;
      }
    }
  });

  // 5. Tanda tidak masuk berturut-turut (KEH-157).
  const threshold = Number(await settingOn('attendance.absence_streak_days', today));
  const windowStart = [marksFrom(), addDays(yesterday, -threshold * 3)].sort().at(-1)!;
  if (windowStart <= yesterday) {
    const people = await trackedOn(today, null, db);
    const idsList = people.map((person) => person.employeeId);
    const [infos, absences, alphas] = await Promise.all([
      loadDayInfos(idsList, windowStart, yesterday, db, now), absenceDayStatuses(idsList, windowStart, yesterday), alphaMarks(idsList, windowStart, yesterday),
    ]);
    const recipients = await accountsOf([...new Set([...(await listEmployeesWithAnyAction(['clarification.streak.seen'])), ...(await listEmployeesWithAnyAction([]))])]);
    for (const person of people) {
      const days: StreakDay[] = [];
      for (let date = windowStart; date <= yesterday; date = addDays(date, 1)) {
        const k = key(person.employeeId, date);
        const count = absences.approved.get(k);
        if (infos.get(k)?.effective.state.inAt) days.push({ date, mark: 'BREAK', cause: null });
        else if (count === 'SICK') days.push({ date, mark: 'COUNT', cause: 'Sakit tanpa surat' });
        else if (count === 'PERMIT' || count === 'PERMIT_SUDDEN') days.push({ date, mark: 'COUNT', cause: count === 'PERMIT' ? 'Izin' : 'Izin mendadak' });
        else if (count) days.push({ date, mark: 'BREAK', cause: null });
        else if (alphas.has(k)) days.push({ date, mark: 'COUNT', cause: 'Alpha' });
        else days.push({ date, mark: 'SKIP', cause: null });
      }
      for (const hit of streakHits(days, threshold)) {
        await db.transaction(async (tx) => {
          const inserted = await tx.insert(absenceStreakFlags).values({ employeeId: person.employeeId, ...hit }).onConflictDoNothing().returning({ id: absenceStreakFlags.id });
          if (!inserted.length) return;
          result.streaks += 1;
          await notify(tx, recipients.filter((id) => id), {
            kind: 'attendance.clarification', title: `${person.name} tidak masuk ${threshold} hari kerja berturut-turut`,
            body: `Sejak ${shortDate(hit.startDate)}: ${[...new Set(hit.causes)].join(', ')}. Tidak ada penonaktifan otomatis.`, link: '/kehadiran/perlu-dijelaskan?tab=streak',
          }, null);
        });
      }
    }
  }

  // 6. Ambang kebiasaan lupa absen periode berjalan (spec L3g §9 butir 8).
  const period = payPeriodOf(yesterday);
  const min = Number(await settingOn('attendance.forgot_habit_min', period.start));
  const approved = await forgotRows(null, period.start, period.end, true);
  const perPerson = new Map<number, number>();
  for (const row of approved) perPerson.set(row.employeeId, (perPerson.get(row.employeeId) ?? 0) + 1);
  const owners = await ownerAccounts();
  for (const [employeeId, total] of perPerson) {
    if (total <= min) continue;
    await db.transaction(async (tx) => {
      if (!(await noticeOnce(tx, `habit:${period.start}:${employeeId}`))) return;
      const [person] = await tx.execute<{ name: string }>(sql`select name from hris.employees where id = ${employeeId}`);
      await notify(tx, owners, {
        kind: 'attendance.clarification', title: `${person?.name ?? 'Seseorang'} lupa absen lebih dari ${min} kali periode ini`,
        body: 'Lihat rinciannya di Laporan Kebiasaan Lupa Absen.', link: `/kehadiran/kebiasaan-lupa-absen?period=${period.start}`,
      }, null);
      result.habits += 1;
    });
  }
  return result;
}

