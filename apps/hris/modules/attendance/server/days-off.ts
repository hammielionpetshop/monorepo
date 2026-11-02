import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import {
  branchClosures, dayOffMissingMarks, dayOffPicks, dayOffWorkRequests, replacementDaysOff, shiftDayChanges, swapInvitations,
} from '@petshop/hris-db/schema/attendance';
import { db } from '@/lib/db';
import { can, getOrgLookup, recordAudit, type Actor, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { notify, type NotificationInput } from '@/modules/notifications';
import { checkReason, loadRows, resolveSetting, type SettingKey } from '@/modules/settings';
import { wibDate, wibInstant } from '../rules/attendance';
import {
  DATE_BLOCK_LABELS, DAY_OFF_MARKS_FROM, ORIGIN_LABELS, REPLACEMENT_STATUS_LABELS, SWAP_STATUS_LABELS, WORK_REQUEST_STATUS_LABELS,
  acceptDates, branchCap, dateBlock, daysBetween, isWeekend, markDueAfter, periodDates, periodRange, periodStartOf, proratedQuota,
  swapAnswerBy, windowOf, windowPhase, type DateBlock, type DayOffRules, type WindowPhase,
} from '../rules/days-off';
import { shiftPeriod } from '../rules/review';
import { addDays, closureCovers, mondayOf, type AttendanceMode, type IsoDate } from '../rules/schedule';
import { absenceClash } from './absence';
import { absenceDateKeys, buildBranchWeek, loadShifts, type Executor } from './read';

const fail = (status: 400 | 403 | 404 | 409, error: string) => ({ ok: false as const, status, error });
const FORBIDDEN = 'Anda tidak berhak melakukan tindakan ini.';
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const STALE_SWAP = 'Jadwal sudah berubah, ajakan ini tidak berlaku lagi.';
const NO_QUOTA = 'Libur pilihan tidak berlaku untuk jabatan Anda.';

type PickRow = typeof dayOffPicks.$inferSelect;

const RULE_KEYS = [
  'position.day_off_quota', 'position.attendance_mode', 'attendance.day_off_max_per_branch', 'attendance.day_off_weekend_max',
  'attendance.day_off_min_gap_days', 'attendance.day_off_window_open_day', 'attendance.day_off_window_close_day',
  'attendance.day_off_late_min_days', 'attendance.newcomer_grace_days', 'attendance.swap_deadline_days', 'attendance.replacement_days',
] as const satisfies readonly SettingKey[];

type Rows = Awaited<ReturnType<typeof loadRows>>;

/** Semua angka libur sekali baca; dibaca per tanggal kejadian (WAJ-07). */
async function ruleBook(executor: Executor = db) {
  const rows: Rows = await loadRows(executor, RULE_KEYS);
  const value = (key: (typeof RULE_KEYS)[number], on: IsoDate, target: { positionId?: number; branchId?: number } = {}) => {
    const row = resolveSetting(rows.filter((item) => item.key === key), on, target);
    if (!row) throw new Error(`Pengaturan ${key} belum punya isi awal.`);
    return row.value as number | string;
  };
  return {
    value,
    rules(on: IsoDate): Omit<DayOffRules, 'quota' | 'maxPerBranch'> {
      return {
        weekendMax: Number(value('attendance.day_off_weekend_max', on)),
        minGapDays: Number(value('attendance.day_off_min_gap_days', on)),
        windowOpenDay: Number(value('attendance.day_off_window_open_day', on)),
        windowCloseDay: Number(value('attendance.day_off_window_close_day', on)),
        lateMinDays: Number(value('attendance.day_off_late_min_days', on)),
      };
    },
    quota: (positionId: number, on: IsoDate) => Number(value('position.day_off_quota', on, { positionId })),
    mode: (positionId: number, on: IsoDate) => value('position.attendance_mode', on, { positionId }) as AttendanceMode,
    maxPerBranch: (branchId: number, on: IsoDate) => Number(value('attendance.day_off_max_per_branch', on, { branchId })),
    graceDays: (on: IsoDate) => Number(value('attendance.newcomer_grace_days', on)),
    swapDays: (on: IsoDate) => Number(value('attendance.swap_deadline_days', on)),
    replacementDays: (on: IsoDate) => Number(value('attendance.replacement_days', on)),
  };
}

type RuleBook = Awaited<ReturnType<typeof ruleBook>>;

export type Member = { employeeId: number; name: string; branchId: number; positionId: number; departmentId: number };

/** Orang berjatah libur pada satu tanggal: absen QR dan jatah jabatannya lebih dari 0 (KEH-31, 32). */
async function membersOn(on: IsoDate, book: RuleBook, executor: Executor = db): Promise<Member[]> {
  const rows = await executor.execute<{
    employee_id: number; employee_name: string; branch_id: number; position_id: number; department_id: number;
  }>(sql`select employee_id, employee_name, branch_id, position_id, department_id from hris.placements_on(${on}::date) where active order by employee_name`);
  return rows.map((row) => ({
    employeeId: Number(row.employee_id), name: row.employee_name, branchId: Number(row.branch_id),
    positionId: Number(row.position_id), departmentId: Number(row.department_id),
  })).filter((person) => book.mode(person.positionId, on) === 'QR' && book.quota(person.positionId, on) > 0);
}

const targetOf = (person: Member) => ({ personId: person.employeeId, branchId: person.branchId, departmentId: person.departmentId });

async function joinedOn(ids: number[], executor: Executor = db): Promise<Map<number, IsoDate>> {
  if (!ids.length) return new Map();
  const rows = await executor.execute<{ id: number; joined_on: string }>(
    sql`select id, joined_on from hris.employees where id in (${sql.join([...new Set(ids)].map((id) => sql`${id}`), sql`, `)})`,
  );
  return new Map(rows.map((row) => [Number(row.id), String(row.joined_on).slice(0, 10)]));
}

async function names(ids: number[], executor: Executor = db): Promise<Map<number, string>> {
  if (!ids.length) return new Map();
  const rows = await executor.execute<{ id: number; name: string }>(
    sql`select id, name from hris.employees where id in (${sql.join([...new Set(ids)].map((id) => sql`${id}`), sql`, `)})`,
  );
  return new Map(rows.map((row) => [Number(row.id), row.name]));
}

async function activePicks(employeeIds: number[], from: IsoDate, to: IsoDate, executor: Executor = db): Promise<PickRow[]> {
  if (!employeeIds.length) return [];
  return executor.select().from(dayOffPicks).where(and(
    eq(dayOffPicks.status, 'ACTIVE'), inArray(dayOffPicks.employeeId, [...new Set(employeeIds)]),
    gte(dayOffPicks.offDate, from), lte(dayOffPicks.offDate, to),
  )).orderBy(asc(dayOffPicks.offDate));
}

async function closedDatesOf(branchId: number, from: IsoDate, to: IsoDate, executor: Executor = db): Promise<Set<IsoDate>> {
  const closures = await executor.select().from(branchClosures).where(and(
    isNull(branchClosures.cancelledAt), lte(branchClosures.startDate, to), gte(branchClosures.endDate, from),
  ));
  const closed = new Set<IsoDate>();
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (closures.some((closure) => closureCovers(closure, branchId, date))) closed.add(date);
  }
  return closed;
}

async function lockBranch(tx: Tx, branchId: number) {
  // Satu kunci per cabang: semua yang menghitung KEH-34 di cabang itu bergiliran (spec L3e §2).
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('attendance.dayoff'), ${branchId})`);
}

async function notifyPeople(tx: Tx, employeeIds: number[], input: NotificationInput, actorAccountId: number | null) {
  if (!employeeIds.length) return;
  const accounts = await activeHrisAccounts([...new Set(employeeIds)]);
  if (accounts.size) await notify(tx, [...accounts.values()], input, actorAccountId);
}

/**
 * Keadaan libur satu cabang pada rentang tanggal: anggota per tanggal, batas KEH-34 per tanggal,
 * siapa libur per tanggal. Rentang biasanya satu periode ditambah jarak libur di ujungnya (KEH-134).
 */
async function branchState(branchId: number, from: IsoDate, to: IsoDate, book: RuleBook, executor: Executor = db) {
  const membersByDate = new Map<IsoDate, Member[]>();
  // Satu kueri penempatan per tanggal (KEH-34 menghitung orang cabang pada tanggal itu).
  for (let date = from; date <= to; date = addDays(date, 1)) {
    membersByDate.set(date, (await membersOn(date, book, executor)).filter((person) => person.branchId === branchId));
  }
  const everyone = [...new Map([...membersByDate.values()].flat().map((person) => [person.employeeId, person])).values()];
  const picks = await activePicks(everyone.map((person) => person.employeeId), from, to, executor);
  const caps = new Map<IsoDate, number>();
  for (const [date, members] of membersByDate) caps.set(date, branchCap(book.maxPerBranch(branchId, date), members.length));
  const offOn = (date: IsoDate) => {
    const members = new Set((membersByDate.get(date) ?? []).map((person) => person.employeeId));
    return picks.filter((pick) => pick.offDate === date && members.has(pick.employeeId));
  };
  return { membersByDate, everyone, picks, caps, offOn };
}

type BranchState = Awaited<ReturnType<typeof branchState>>;

function takenByOthers(state: BranchState, employeeId: number): Map<IsoDate, number> {
  const taken = new Map<IsoDate, number>();
  for (const date of state.membersByDate.keys()) taken.set(date, state.offOn(date).filter((pick) => pick.employeeId !== employeeId).length);
  return taken;
}

/** Orang itu sebagai pemilik jatah pada tanggal `on` (diri sendiri, KEH-L26). */
async function quotaHolder(actor: Actor, on: IsoDate, book: RuleBook, executor: Executor = db): Promise<Member | null> {
  if (!can(actor, 'attendance.self.check', { personId: actor.personId })) return null;
  return (await membersOn(on, book, executor)).find((person) => person.employeeId === actor.personId) ?? null;
}

/** Jatah periode orang itu (KEH-31, GAJ-06). */
async function quotaOf(person: Member, periodStart: IsoDate, book: RuleBook, executor: Executor = db): Promise<number> {
  const joined = (await joinedOn([person.employeeId], executor)).get(person.employeeId) ?? null;
  const on = joined && joined > periodStart ? joined : periodStart;
  return proratedQuota(book.quota(person.positionId, on), periodStart, joined);
}

const regular = (pick: PickRow) => pick.origin !== 'REPLACEMENT';

function blockLabel(block: DateBlock | 'QUOTA'): string {
  return block === 'QUOTA' ? 'Jatah libur sudah penuh' : DATE_BLOCK_LABELS[block];
}

function longDate(date: IsoDate): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

// ---- Pilih Libur (KEH-L26) ----

export type CalendarDay = {
  date: IsoDate; weekend: boolean; mine: { origin: string; replacement: boolean } | null; block: string | null;
  friends: string[]; closed: boolean; outside: boolean;
};

function periodChoices(today: IsoDate) {
  const current = periodStartOf(today);
  return [current, shiftPeriod(current, 1)];
}

export async function myDaysOffScreen(actor: Actor, periodInput: string | null, now: Date = new Date()) {
  const today = wibDate(now);
  const book = await ruleBook();
  const me = await quotaHolder(actor, today, book);
  if (!me) return { tracked: false as const };
  const [current, next] = periodChoices(today);
  const rulesToday = book.rules(today);
  const defaultPeriod = windowPhase(next, today, rulesToday) === 'OPEN' ? next : current;
  const periodStart = periodInput === current || periodInput === next ? periodInput : defaultPeriod;
  const { start, end } = periodRange(periodStart);
  const rules = book.rules(periodStart);
  const phase = windowPhase(periodStart, today, rules);
  const window = windowOf(periodStart, rules);
  const gap = rules.minGapDays;
  const state = await branchState(me.branchId, addDays(start, -gap), addDays(end, gap), book);
  const [quota, closed, replacements, requests, mark, nameMap] = await Promise.all([
    quotaOf(me, periodStart, book),
    closedDatesOf(me.branchId, start, end),
    db.select().from(replacementDaysOff).where(and(eq(replacementDaysOff.employeeId, me.employeeId), ne(replacementDaysOff.status, 'EXPIRED')))
      .orderBy(desc(replacementDaysOff.id)).limit(20),
    db.select().from(dayOffWorkRequests).where(and(
      eq(dayOffWorkRequests.employeeId, me.employeeId), ne(dayOffWorkRequests.status, 'CANCELLED'), gte(dayOffWorkRequests.workDate, today),
    )).orderBy(asc(dayOffWorkRequests.workDate)),
    db.select().from(dayOffMissingMarks).where(and(eq(dayOffMissingMarks.employeeId, me.employeeId), eq(dayOffMissingMarks.periodStart, periodStart))).limit(1),
    names(state.everyone.map((person) => person.employeeId)),
  ]);
  const myPicks = (await activePicks([me.employeeId], addDays(start, -gap), addDays(end, gap)));
  const mineInPeriod = myPicks.filter((pick) => pick.offDate >= start && pick.offDate <= end);
  const regularInPeriod = mineInPeriod.filter(regular);
  const earliest = phase === 'LATE' ? addDays(today, rules.lateMinDays) : today;
  const context = {
    periodStart, today, earliest,
    otherDates: myPicks.filter(regular).map((pick) => pick.offDate),
    replacementDates: myPicks.filter((pick) => !regular(pick)).map((pick) => pick.offDate),
    closedDates: closed, takenByOthers: takenByOthers(state, me.employeeId), caps: state.caps,
    rules: { weekendMax: rules.weekendMax, minGapDays: gap },
  };
  const editable = phase === 'OPEN' || (phase === 'LATE' && regularInPeriod.length < quota);
  const days: CalendarDay[] = periodDates(periodStart).map((date) => {
    const mine = mineInPeriod.find((pick) => pick.offDate === date);
    const block = mine ? null : dateBlock(date, context);
    return {
      date, weekend: isWeekend(date), closed: closed.has(date), outside: false,
      mine: mine ? { origin: ORIGIN_LABELS[mine.origin], replacement: mine.origin === 'REPLACEMENT' } : null,
      block: block ? DATE_BLOCK_LABELS[block] : null,
      friends: state.offOn(date).filter((pick) => pick.employeeId !== me.employeeId).map((pick) => nameMap.get(pick.employeeId) ?? '-'),
    };
  });
  const requesters = await names(requests.map((row) => row.requestedByEmployeeId));
  return {
    tracked: true as const, today, periodStart, periodEnd: end, periods: [current, next], phase, window, quota,
    picked: regularInPeriod.length, editable, late: phase === 'LATE', earliest,
    weekendMax: rules.weekendMax, minGap: gap,
    weekendUsed: regularInPeriod.filter((pick) => isWeekend(pick.offDate)).length,
    myDates: regularInPeriod.map((pick) => pick.offDate),
    lockedDates: phase === 'OPEN' ? [] : regularInPeriod.map((pick) => pick.offDate),
    neighbours: myPicks.filter((pick) => regular(pick) && (pick.offDate < start || pick.offDate > end)).map((pick) => pick.offDate),
    marked: mark.length > 0,
    days,
    requests: requests.map((row) => ({
      id: row.id, workDate: row.workDate, label: longDate(row.workDate), status: row.status,
      statusLabel: WORK_REQUEST_STATUS_LABELS[row.status], by: requesters.get(row.requestedByEmployeeId) ?? '-', reason: row.reason,
    })),
    replacements: await Promise.all(replacements.map(async (row) => {
      const pick = row.pickId ? (await db.select().from(dayOffPicks).where(eq(dayOffPicks.id, row.pickId)).limit(1))[0] : null;
      const movable = row.status === 'WAITING' || (pick?.status === 'ACTIVE' && pick.offDate > today && row.chooseBy >= today);
      return {
        id: row.id, workDate: row.workDate, chooseBy: row.chooseBy, status: row.status, statusLabel: REPLACEMENT_STATUS_LABELS[row.status],
        chosenDate: pick?.status === 'ACTIVE' ? pick.offDate : null, movable,
        options: movable ? await replacementOptions(me, row.workDate, row.chooseBy, today, book) : [],
      };
    })),
  };
}

/** Tanggal pengganti yang boleh: sesudah hari masuk, sampai batas, diperiksa KEH-34 saja (KEH-138). */
async function replacementOptions(me: Member, workDate: IsoDate, chooseBy: IsoDate, today: IsoDate, book: RuleBook, executor: Executor = db) {
  const from = addDays(workDate > today ? workDate : today, 1);
  if (from > chooseBy) return [];
  const state = await branchState(me.branchId, from, chooseBy, book, executor);
  const closed = await closedDatesOf(me.branchId, from, chooseBy, executor);
  const mine = new Set(state.picks.filter((pick) => pick.employeeId === me.employeeId).map((pick) => pick.offDate));
  const taken = takenByOthers(state, me.employeeId);
  const options: { date: IsoDate; label: string; block: string | null }[] = [];
  for (let date = from; date <= chooseBy; date = addDays(date, 1)) {
    const block = closed.has(date) ? DATE_BLOCK_LABELS.CLOSED : mine.has(date) ? DATE_BLOCK_LABELS.MINE
      : (taken.get(date) ?? 0) >= (state.caps.get(date) ?? 1) ? DATE_BLOCK_LABELS.FULL : null;
    options.push({ date, label: longDate(date), block });
  }
  return options;
}

export type SaveDaysOffResult = { accepted: IsoDate[]; released: IsoDate[]; rejected: { date: IsoDate; reason: string }[] };

/**
 * Simpan pilihan libur satu periode (KEH-131 s.d. 135). Jendela terbuka: `dates` = seluruh pilihan baru (yang hilang dilepas).
 * Sesudah tutup: hanya menambah lewat jalur terlambat. Tanggal yang tertolak disebut; sisanya tetap tersimpan.
 */
export async function saveMyDaysOff(actor: Actor, input: { periodStart: IsoDate; dates: IsoDate[] }, now: Date = new Date()): Promise<ServiceResult<SaveDaysOffResult>> {
  const today = wibDate(now);
  if (!ISO.test(input.periodStart) || input.dates.some((date) => !ISO.test(date)) || input.dates.length > 20) return fail(400, 'Tanggal tidak valid.');
  if (!periodChoices(today).includes(input.periodStart)) return fail(400, 'Periode ini tidak bisa diubah.');
  const book = await ruleBook();
  const me = await quotaHolder(actor, today, book);
  if (!me) return fail(403, NO_QUOTA);
  const rules = book.rules(input.periodStart);
  const phase = windowPhase(input.periodStart, today, rules);
  if (phase === 'BEFORE') return fail(409, `Jendela memilih libur periode ini dibuka ${windowOf(input.periodStart, rules).opens}.`);
  if (phase === 'OVER') return fail(409, 'Periode ini sudah lewat.');
  const { start, end } = periodRange(input.periodStart);
  const quota = await quotaOf(me, input.periodStart, book);
  const desired = [...new Set(input.dates)];

  return db.transaction(async (tx) => {
    await lockBranch(tx, me.branchId);
    const gap = rules.minGapDays;
    const state = await branchState(me.branchId, addDays(start, -gap), addDays(end, gap), book, tx);
    const closed = await closedDatesOf(me.branchId, start, end, tx);
    const myPicks = await activePicks([me.employeeId], addDays(start, -gap), addDays(end, gap), tx);
    const current = myPicks.filter((pick) => regular(pick) && pick.offDate >= start && pick.offDate <= end);
    // Sesudah jendela tutup tidak ada lepas sendiri (KEH-133): yang sudah ada tetap.
    const release = phase === 'OPEN' ? current.filter((pick) => !desired.includes(pick.offDate)) : [];
    if (phase === 'LATE' && current.some((pick) => !desired.includes(pick.offDate))) {
      return fail(409, 'Sesudah jendela tutup, libur yang sudah dipilih tidak bisa dilepas. Tukar dengan teman atau minta kepala cabang.');
    }
    const keep = current.filter((pick) => !release.includes(pick));
    // Tanggal yang berisi izin, sakit, atau cuti berlaku tidak bisa menjadi libur (spec L3f §3).
    const absent = await absenceDateKeys([me.employeeId], start, end, tx);
    const absentDates = desired.filter((date) => absent.has(`${me.employeeId}|${date}`) && !keep.some((pick) => pick.offDate === date));
    const candidates = desired.filter((date) => !keep.some((pick) => pick.offDate === date) && !absentDates.includes(date));
    const released = new Set(release.map((pick) => pick.id));
    const others = myPicks.filter((pick) => regular(pick) && !released.has(pick.id)).map((pick) => pick.offDate);
    const { accepted, rejected } = acceptDates(candidates, {
      periodStart: input.periodStart, today, earliest: phase === 'LATE' ? addDays(today, rules.lateMinDays) : today,
      otherDates: others, replacementDates: myPicks.filter((pick) => !regular(pick)).map((pick) => pick.offDate),
      closedDates: closed, takenByOthers: takenByOthers(state, me.employeeId), caps: state.caps,
      rules: { weekendMax: rules.weekendMax, minGapDays: gap },
    }, Math.max(0, quota - keep.length));
    const endedAt = new Date();
    for (const pick of release) {
      await tx.update(dayOffPicks).set({ status: 'REPLACED', endedAt, endedByAccountId: actor.accountId, endReason: 'Lepas pilihan' })
        .where(eq(dayOffPicks.id, pick.id));
    }
    if (accepted.length) {
      await tx.insert(dayOffPicks).values(accepted.map((date) => ({
        employeeId: me.employeeId, periodStart: input.periodStart, offDate: date, origin: phase === 'LATE' ? 'LATE' as const : 'PICK' as const,
        createdByAccountId: actor.accountId,
      })));
    }
    if (accepted.length || release.length) {
      await recordAudit(tx, {
        actorAccountId: actor.accountId, entity: 'employee', entityId: me.employeeId, action: 'day_off.pick',
        before: { dates: current.map((pick) => pick.offDate) }, after: { added: accepted, released: release.map((pick) => pick.offDate), periodStart: input.periodStart },
      });
    }
    return {
      ok: true as const,
      data: {
        accepted, released: release.map((pick) => pick.offDate),
        rejected: [
          ...rejected.map((row) => ({ date: row.date, reason: blockLabel(row.block) })),
          ...absentDates.map((date) => ({ date, reason: 'Sudah ada izin, sakit, atau cuti' })),
        ],
      },
    };
  });
}

/** Pilih atau geser libur pengganti (KEH-138): paling lambat batasnya, diperiksa KEH-34 saja. */
export async function chooseReplacement(actor: Actor, input: { id: number; date: IsoDate }, now: Date = new Date()): Promise<ServiceResult<{ date: IsoDate }>> {
  const today = wibDate(now);
  if (!ISO.test(input.date)) return fail(400, 'Tanggal tidak valid.');
  const book = await ruleBook();
  const me = await quotaHolder(actor, today, book);
  if (!me) return fail(403, NO_QUOTA);
  const [row] = await db.select().from(replacementDaysOff).where(eq(replacementDaysOff.id, input.id)).limit(1);
  if (!row || row.employeeId !== me.employeeId) return fail(404, 'Libur pengganti tidak ditemukan.');
  if (row.status === 'EXPIRED' || row.chooseBy < today) return fail(409, 'Batas memilih libur pengganti sudah lewat.');
  const options = await replacementOptions(me, row.workDate, row.chooseBy, today, book);
  const option = options.find((item) => item.date === input.date);
  if (!option) return fail(400, `Pilih tanggal sesudah ${row.workDate} sampai ${row.chooseBy}.`);
  if (option.block) return fail(409, `Tanggal itu tidak bisa dipilih: ${option.block}.`);
  const clashText = await absenceClash([{ employeeId: me.employeeId, date: input.date }]);
  if (clashText) return fail(409, clashText);
  return db.transaction(async (tx) => {
    await lockBranch(tx, me.branchId);
    const fresh = await replacementOptions(me, row.workDate, row.chooseBy, today, book, tx);
    if (fresh.find((item) => item.date === input.date)?.block) return fail(409, 'Tanggal itu baru saja penuh. Pilih tanggal lain.');
    const [current] = await tx.select().from(replacementDaysOff).where(eq(replacementDaysOff.id, row.id)).for('update');
    let old: PickRow | undefined;
    if (current.pickId) {
      [old] = await tx.select().from(dayOffPicks).where(eq(dayOffPicks.id, current.pickId)).limit(1);
      if (old?.status === 'ACTIVE' && old.offDate <= today) return fail(409, 'Libur pengganti yang sudah lewat tidak bisa digeser.');
    }
    const [pick] = await tx.insert(dayOffPicks).values({
      employeeId: me.employeeId, periodStart: periodStartOf(input.date), offDate: input.date, origin: 'REPLACEMENT',
      createdByAccountId: actor.accountId, replacementId: row.id,
    }).returning({ id: dayOffPicks.id });
    if (old?.status === 'ACTIVE') {
      await tx.update(dayOffPicks).set({
        status: 'REPLACED', endedAt: new Date(), endedByAccountId: actor.accountId, endReason: 'Pengganti digeser', replacedById: pick.id,
      }).where(eq(dayOffPicks.id, old.id));
    }
    await tx.update(replacementDaysOff).set({ status: 'CHOSEN', pickId: pick.id, closedAt: new Date() }).where(eq(replacementDaysOff.id, row.id));
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'employee', entityId: me.employeeId, action: 'day_off.replacement',
      before: old ? { date: old.offDate } : null, after: { date: input.date, replacementId: row.id },
    });
    return { ok: true as const, data: { date: input.date } };
  });
}

// ---- Libur Cabang (KEH-L27) ----

async function viewableBranches(actor: Actor) {
  const org = await getOrgLookup();
  const active = org.branches.filter((branch) => branch.active);
  if (can(actor, 'attendance.dayoff.view')) return active;
  return active.filter((branch) => branch.id === actor.branchId);
}

export async function branchDaysOffScreen(actor: Actor, input: { branchId: number | null; periodStart: string | null }, now: Date = new Date()) {
  const today = wibDate(now);
  const branches = await viewableBranches(actor);
  const branch = branches.find((row) => row.id === input.branchId) ?? branches[0] ?? null;
  const current = periodStartOf(today);
  const periods = [shiftPeriod(current, -2), shiftPeriod(current, -1), current, shiftPeriod(current, 1)];
  const periodStart = periods.includes(input.periodStart ?? '') ? input.periodStart! : current;
  const base = {
    branches: branches.map(({ id, name }) => ({ id, name })), branchId: branch?.id ?? null, periods, periodStart, today,
    days: [] as { date: IsoDate; weekend: boolean; closed: boolean; cap: number; people: { pickId: number; employeeId: number; name: string; origin: string; editable: boolean; work: string | null }[] }[],
    missing: [] as { employeeId: number; name: string; quota: number; picked: number; marked: boolean }[],
    swaps: [] as { id: number; kind: string; from: string; to: string; fromDate: IsoDate; toDate: IsoDate; at: string }[],
    swapCounts: [] as { name: string; count: number }[],
    candidates: [] as { employeeId: number; name: string }[],
    canChange: false, canRevoke: false, canRequestWork: false, selfId: actor.personId,
  };
  if (!branch) return base;
  const book = await ruleBook();
  const { start, end } = periodRange(periodStart);
  const state = await branchState(branch.id, start, end, book);
  const visible = (person: Member) => can(actor, 'attendance.dayoff.view', targetOf(person));
  const people = state.everyone.filter(visible);
  if (!people.length) return base;
  const visibleIds = new Set(people.map((person) => person.employeeId));
  const [closed, nameMap, marks, requests, swaps, joined] = await Promise.all([
    closedDatesOf(branch.id, start, end),
    names(people.map((person) => person.employeeId)),
    db.select().from(dayOffMissingMarks).where(and(eq(dayOffMissingMarks.periodStart, periodStart), inArray(dayOffMissingMarks.employeeId, [...visibleIds]))),
    db.select().from(dayOffWorkRequests).where(and(
      inArray(dayOffWorkRequests.employeeId, [...visibleIds]), gte(dayOffWorkRequests.workDate, start), lte(dayOffWorkRequests.workDate, end),
      ne(dayOffWorkRequests.status, 'CANCELLED'),
    )),
    db.select().from(swapInvitations).where(and(
      eq(swapInvitations.branchId, branch.id), eq(swapInvitations.status, 'ACCEPTED'),
      or(and(gte(swapInvitations.fromDate, start), lte(swapInvitations.fromDate, end)), and(gte(swapInvitations.toDate, start), lte(swapInvitations.toDate, end))),
    )).orderBy(desc(swapInvitations.answeredAt)),
    joinedOn(people.map((person) => person.employeeId)),
  ]);
  const swapNames = await names(swaps.flatMap((row) => [row.fromEmployeeId, row.toEmployeeId]));
  const editableFor = (person: Member, date: IsoDate) => date >= today && person.employeeId !== actor.personId;
  const memberOf = (id: number) => people.find((person) => person.employeeId === id)!;
  const asOf = end < today ? end : start > today ? start : today;
  const quotaMembers = (state.membersByDate.get(asOf) ?? state.everyone).filter(visible);
  const counts = new Map<number, number>();
  for (const row of swaps) for (const id of [row.fromEmployeeId, row.toEmployeeId]) counts.set(id, (counts.get(id) ?? 0) + 1);
  return {
    ...base,
    days: periodDates(periodStart).map((date) => ({
      date, weekend: isWeekend(date), closed: closed.has(date), cap: state.caps.get(date) ?? 1,
      people: state.offOn(date).filter((pick) => visibleIds.has(pick.employeeId)).map((pick) => {
        const work = requests.find((row) => row.pickId === pick.id);
        return {
          pickId: pick.id, employeeId: pick.employeeId, name: nameMap.get(pick.employeeId) ?? '-', origin: ORIGIN_LABELS[pick.origin],
          editable: editableFor(memberOf(pick.employeeId), date), work: work ? WORK_REQUEST_STATUS_LABELS[work.status] : null,
        };
      }),
    })),
    missing: (await Promise.all(quotaMembers.map(async (person) => {
      const quota = proratedQuota(book.quota(person.positionId, periodStart), periodStart, joined.get(person.employeeId) ?? null);
      const picked = state.picks.filter((pick) => pick.employeeId === person.employeeId && regular(pick)).length;
      return { employeeId: person.employeeId, name: person.name, quota, picked, marked: marks.some((mark) => mark.employeeId === person.employeeId) };
    }))).filter((row) => row.picked < row.quota || row.marked),
    swaps: swaps.map((row) => ({
      id: row.id, kind: row.kind === 'DAY_OFF' ? 'Tukar libur' : 'Tukar shift',
      from: swapNames.get(row.fromEmployeeId) ?? '-', to: swapNames.get(row.toEmployeeId) ?? '-',
      fromDate: row.fromDate, toDate: row.toDate, at: row.answeredAt?.toISOString() ?? '',
    })),
    swapCounts: [...counts].map(([id, count]) => ({ name: swapNames.get(id) ?? '-', count })).sort((a, b) => b.count - a.count),
    candidates: people.map(({ employeeId, name }) => ({ employeeId, name })),
    canChange: people.some((person) => person.employeeId !== actor.personId && can(actor, 'attendance.dayoff.change', targetOf(person))),
    canRevoke: people.some((person) => person.employeeId !== actor.personId && can(actor, 'attendance.dayoff.revoke', targetOf(person))),
    canRequestWork: people.some((person) => person.employeeId !== actor.personId && can(actor, 'attendance.dayoff.request_work', targetOf(person))),
  };
}

/** Libur berlaku + orangnya (penempatan pada tanggal libur) untuk tindakan kantor. */
async function pickWithPerson(pickId: number, book: RuleBook, executor: Executor = db) {
  const [pick] = await executor.select().from(dayOffPicks).where(eq(dayOffPicks.id, pickId)).limit(1);
  if (!pick) return null;
  const person = (await membersOn(pick.offDate, book, executor)).find((row) => row.employeeId === pick.employeeId) ?? null;
  return person ? { pick, person } : null;
}

/** Ubah libur seseorang langsung saat mendadak (KEH-45): alasan wajib, hanya KEH-34, orangnya diberi tahu. */
export async function changeDayOff(actor: Actor, input: { pickId: number; date: IsoDate; reason: string }, now: Date = new Date()): Promise<ServiceResult<{ id: number; note: string | null }>> {
  const today = wibDate(now);
  if (!ISO.test(input.date)) return fail(400, 'Tanggal tidak valid.');
  const reason = await checkReason(input.reason);
  if (!reason.ok) return fail(400, reason.error);
  const book = await ruleBook();
  const found = await pickWithPerson(input.pickId, book);
  if (!found || found.pick.status !== 'ACTIVE') return fail(404, 'Libur tidak ditemukan.');
  const { pick, person } = found;
  if (person.employeeId === actor.personId) return fail(403, 'Libur sendiri diubah oleh kepala cabang atau HR.');
  if (!can(actor, 'attendance.dayoff.change', targetOf(person))) return fail(403, FORBIDDEN);
  if (pick.offDate < today || input.date < today) return fail(409, 'Libur yang sudah lewat tidak bisa diubah.');
  if (input.date === pick.offDate) return fail(400, 'Tanggal barunya sama.');
  return db.transaction(async (tx) => {
    await lockBranch(tx, person.branchId);
    const state = await branchState(person.branchId, input.date, input.date, book, tx);
    if ((await closedDatesOf(person.branchId, input.date, input.date, tx)).has(input.date)) return fail(409, 'Tanggal itu hari tutup.');
    if (state.picks.some((row) => row.employeeId === person.employeeId && row.offDate === input.date)) return fail(409, 'Orang ini sudah libur di tanggal itu.');
    const clashText = await absenceClash([{ employeeId: person.employeeId, date: input.date }], tx);
    if (clashText) return fail(409, clashText);
    if (!state.membersByDate.get(input.date)?.some((row) => row.employeeId === person.employeeId)) return fail(409, 'Orang ini tidak di cabang ini pada tanggal itu.');
    if (state.offOn(input.date).length >= (state.caps.get(input.date) ?? 1)) return fail(409, 'Tanggal itu sudah penuh (batas libur bersamaan per cabang).');
    const newPeriod = periodStartOf(input.date);
    const weekendMax = book.rules(newPeriod).weekendMax;
    const { start, end } = periodRange(newPeriod);
    const weekendCount = (await activePicks([person.employeeId], start, end, tx))
      .filter((row) => regular(row) && row.id !== pick.id && isWeekend(row.offDate)).length + (isWeekend(input.date) ? 1 : 0);
    // Ubah langsung tidak diperiksa KEH-35; dua akhir pekan hanya dicatat (spec L3e §3).
    const note = isWeekend(input.date) && weekendCount > weekendMax ? 'Dua akhir pekan' : null;
    const [row] = await tx.insert(dayOffPicks).values({
      employeeId: person.employeeId, periodStart: newPeriod, offDate: input.date,
      origin: pick.origin === 'REPLACEMENT' ? 'REPLACEMENT' : 'DIRECT', replacementId: pick.replacementId,
      createdByAccountId: actor.accountId, note,
    }).returning({ id: dayOffPicks.id });
    await tx.update(dayOffPicks).set({
      status: 'REPLACED', endedAt: new Date(), endedByAccountId: actor.accountId, endReason: reason.reason, replacedById: row.id,
    }).where(eq(dayOffPicks.id, pick.id));
    if (pick.replacementId) await tx.update(replacementDaysOff).set({ pickId: row.id }).where(eq(replacementDaysOff.id, pick.replacementId));
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'employee', entityId: person.employeeId, action: 'day_off.change',
      before: { date: pick.offDate }, after: { date: input.date, note }, reason: reason.reason,
    });
    await notifyPeople(tx, [person.employeeId], {
      kind: 'attendance.day_off', title: `Libur Anda ${longDate(pick.offDate)} dipindah ke ${longDate(input.date)}`, body: reason.reason, link: '/libur',
    }, actor.accountId);
    return { ok: true as const, data: { id: row.id, note } };
  });
}

/** Cabut libur (KEH-131): HR, Pemilik, GM; alasan wajib; status Dicabut, tidak dihapus. */
export async function revokeDayOff(actor: Actor, input: { pickId: number; reason: string }, now: Date = new Date()): Promise<ServiceResult<{ id: number }>> {
  const today = wibDate(now);
  const reason = await checkReason(input.reason);
  if (!reason.ok) return fail(400, reason.error);
  const book = await ruleBook();
  const found = await pickWithPerson(input.pickId, book);
  if (!found || found.pick.status !== 'ACTIVE') return fail(404, 'Libur tidak ditemukan.');
  const { pick, person } = found;
  if (person.employeeId === actor.personId) return fail(403, 'Libur sendiri tidak bisa dicabut sendiri.');
  if (!can(actor, 'attendance.dayoff.revoke', targetOf(person))) return fail(403, FORBIDDEN);
  if (pick.offDate < today) return fail(409, 'Libur yang sudah lewat tidak bisa dicabut.');
  return db.transaction(async (tx) => {
    await tx.update(dayOffPicks).set({ status: 'REVOKED', endedAt: new Date(), endedByAccountId: actor.accountId, endReason: reason.reason })
      .where(and(eq(dayOffPicks.id, pick.id), eq(dayOffPicks.status, 'ACTIVE')));
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'employee', entityId: person.employeeId, action: 'day_off.revoke',
      before: { date: pick.offDate }, reason: reason.reason,
    });
    await notifyPeople(tx, [person.employeeId], {
      kind: 'attendance.day_off', title: `Libur Anda ${longDate(pick.offDate)} dicabut`,
      body: `${reason.reason}. Pilih tanggal lain di Pilih Libur.`, link: '/libur',
    }, actor.accountId);
    return { ok: true as const, data: { id: pick.id } };
  });
}

// ---- Tukar Libur dan Shift (KEH-L28) ----

async function shiftOn(branchId: number, employeeIds: number[], date: IsoDate, executor: Executor = db) {
  const week = await buildBranchWeek(branchId, mondayOf(date), employeeIds.map((employeeId) => ({ employeeId, name: '' })), executor);
  return {
    shifts: week.shifts,
    of: (employeeId: number) => week.rows.find((row) => row.employeeId === employeeId)?.cells.find((cell) => cell.date === date) ?? null,
  };
}

export async function swapScreen(actor: Actor, now: Date = new Date()) {
  const today = wibDate(now);
  const book = await ruleBook();
  const me = await quotaHolder(actor, today, book);
  if (!me) return { tracked: false as const };
  const [incoming, mine, upcoming, shifts] = await Promise.all([
    db.select().from(swapInvitations).where(and(eq(swapInvitations.toEmployeeId, me.employeeId), eq(swapInvitations.status, 'PENDING')))
      .orderBy(asc(swapInvitations.answerBy)),
    db.select().from(swapInvitations).where(eq(swapInvitations.fromEmployeeId, me.employeeId)).orderBy(desc(swapInvitations.id)).limit(30),
    activePicks([me.employeeId], today, addDays(today, 70)),
    loadShifts([me.branchId]),
  ]);
  const people = await names([...incoming, ...mine].flatMap((row) => [row.fromEmployeeId, row.toEmployeeId]));
  const shiftName = (id: number | null) => shifts.find((shift) => shift.id === id)?.name ?? '-';
  const describe = (row: typeof incoming[number], forMe: boolean) => {
    if (row.kind === 'SHIFT') {
      const [mineShift, theirs] = forMe ? [row.toShiftId, row.fromShiftId] : [row.fromShiftId, row.toShiftId];
      return `${longDate(row.fromDate)}: shift ${shiftName(mineShift)} Anda ↔ shift ${shiftName(theirs)}`;
    }
    const [myDate, theirDate] = forMe ? [row.toDate, row.fromDate] : [row.fromDate, row.toDate];
    return `libur Anda ${longDate(myDate)} ↔ libur ${longDate(theirDate)}`;
  };
  return {
    tracked: true as const, today,
    canSwapShift: shifts.filter((shift) => shift.active).length >= 2,
    incoming: incoming.map((row) => ({
      id: row.id, from: people.get(row.fromEmployeeId) ?? '-', kind: row.kind, text: describe(row, true), answerBy: row.answerBy,
      expired: row.answerBy < today,
    })),
    mine: mine.map((row) => ({
      id: row.id, to: people.get(row.toEmployeeId) ?? '-', kind: row.kind, text: describe(row, false), answerBy: row.answerBy,
      status: row.status, statusLabel: SWAP_STATUS_LABELS[row.status],
    })),
    myDaysOff: upcoming.filter((pick) => pick.offDate > today).map((pick) => ({ date: pick.offDate, label: longDate(pick.offDate) })),
  };
}

export type SwapOption = { employeeId: number; name: string; dates: { date: IsoDate; label: string; answerBy: IsoDate }[]; shiftName?: string };

/** Teman yang bisa diajak tukar pada tanggal milik saya (KEH-136). Tanpa teman sedang izin/sakit/cuti: menyusul 4D-4b. */
export async function swapOptions(actor: Actor, input: { kind: 'DAY_OFF' | 'SHIFT'; date: IsoDate }, now: Date = new Date()): Promise<ServiceResult<{ options: SwapOption[]; tooLate: boolean }>> {
  const today = wibDate(now);
  if (!ISO.test(input.date)) return fail(400, 'Tanggal tidak valid.');
  const book = await ruleBook();
  const me = await quotaHolder(actor, today, book);
  if (!me) return fail(403, NO_QUOTA);
  const deadline = book.swapDays(today);
  if (input.kind === 'DAY_OFF') {
    const mine = await activePicks([me.employeeId], today, addDays(today, 70));
    if (!mine.some((pick) => pick.offDate === input.date)) return fail(400, 'Pilih tanggal libur Anda yang belum lewat.');
    if (swapAnswerBy(input.date, input.date, deadline) < today) return { ok: true, data: { options: [], tooLate: true } };
    const mates = (await membersOn(input.date, book)).filter((person) => person.branchId === me.branchId && person.employeeId !== me.employeeId);
    const picks = await activePicks(mates.map((person) => person.employeeId), addDays(today, 1), addDays(today, 70));
    const options = mates.map((mate) => {
      const theirs = picks.filter((pick) => pick.employeeId === mate.employeeId);
      if (theirs.some((pick) => pick.offDate === input.date)) return null;
      const dates = theirs.filter((pick) => !mine.some((own) => own.offDate === pick.offDate))
        .map((pick) => ({ date: pick.offDate, label: longDate(pick.offDate), answerBy: swapAnswerBy(input.date, pick.offDate, deadline) }))
        .filter((row) => row.answerBy >= today);
      return dates.length ? { employeeId: mate.employeeId, name: mate.name, dates } : null;
    }).filter((row): row is SwapOption => row != null);
    return { ok: true, data: { options, tooLate: false } };
  }
  if (input.date <= today) return fail(400, 'Pilih tanggal yang belum lewat.');
  if (swapAnswerBy(input.date, input.date, deadline) < today) return { ok: true, data: { options: [], tooLate: true } };
  const mates = (await membersOn(input.date, book)).filter((person) => person.branchId === me.branchId);
  const view = await shiftOn(me.branchId, mates.map((person) => person.employeeId), input.date);
  if (view.shifts.length < 2) return fail(409, 'Cabang ini hanya punya satu shift.');
  const own = view.of(me.employeeId);
  if (!own?.shiftId || own.dayOff || own.closed) return fail(409, 'Anda tidak punya shift pada tanggal itu.');
  const options = mates.filter((mate) => mate.employeeId !== me.employeeId).map((mate) => {
    const cell = view.of(mate.employeeId);
    if (!cell?.shiftId || cell.shiftId === own.shiftId || cell.dayOff) return null;
    return {
      employeeId: mate.employeeId, name: mate.name, shiftName: cell.shiftName ?? '-',
      dates: [{ date: input.date, label: longDate(input.date), answerBy: swapAnswerBy(input.date, input.date, deadline) }],
    };
  }).filter((row): row is NonNullable<typeof row> => row != null);
  return { ok: true, data: { options, tooLate: false } };
}

export async function sendSwap(actor: Actor, input: { kind: 'DAY_OFF' | 'SHIFT'; date: IsoDate; friendId: number; friendDate: IsoDate }, now: Date = new Date()): Promise<ServiceResult<{ id: number }>> {
  const today = wibDate(now);
  const options = await swapOptions(actor, { kind: input.kind, date: input.date }, now);
  if (!options.ok) return options;
  if (options.data.tooLate) return fail(409, 'Sudah lewat batas tukar. Anda bisa mengajukan izin biasa.');
  const option = options.data.options.find((row) => row.employeeId === input.friendId);
  const target = option?.dates.find((row) => row.date === input.friendDate);
  if (!option || !target) return fail(409, 'Teman atau tanggal itu tidak bisa ditukar. Teman harus satu cabang dan jadwalnya cocok.');
  const book = await ruleBook();
  const me = (await quotaHolder(actor, today, book))!;
  let values: typeof swapInvitations.$inferInsert;
  if (input.kind === 'DAY_OFF') {
    const [mine] = await activePicks([me.employeeId], input.date, input.date);
    const [theirs] = await activePicks([input.friendId], input.friendDate, input.friendDate);
    values = {
      kind: 'DAY_OFF', branchId: me.branchId, fromEmployeeId: me.employeeId, toEmployeeId: input.friendId,
      fromDate: input.date, toDate: input.friendDate, fromPickId: mine.id, toPickId: theirs.id, answerBy: target.answerBy,
    };
  } else {
    const view = await shiftOn(me.branchId, [me.employeeId, input.friendId], input.date);
    values = {
      kind: 'SHIFT', branchId: me.branchId, fromEmployeeId: me.employeeId, toEmployeeId: input.friendId,
      fromDate: input.date, toDate: input.date, fromShiftId: view.of(me.employeeId)!.shiftId, toShiftId: view.of(input.friendId)!.shiftId,
      answerBy: target.answerBy,
    };
  }
  const clashText = await absenceClash(swapClashPairs(input.kind, me.employeeId, input.friendId, input.date, input.friendDate));
  if (clashText) return fail(409, clashText);
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.insert(swapInvitations).values(values).returning({ id: swapInvitations.id });
      await notifyPeople(tx, [input.friendId], {
        kind: 'attendance.swap', title: `${me.name} mengajak tukar ${input.kind === 'DAY_OFF' ? 'libur' : 'shift'}`,
        body: `Jawab sebelum ${longDate(target.answerBy)} pukul 23.59.`, link: '/tukar', entity: 'swap_invitation', entityId: row.id,
      }, actor.accountId);
      return { ok: true as const, data: { id: row.id } };
    });
  } catch (error) {
    if ((error as { cause?: { code?: string } })?.cause?.code === '23505') return fail(409, 'Tanggal ini sudah punya ajakan yang menunggu. Batalkan dulu yang lama.');
    throw error;
  }
}

/**
 * Tanggal yang akan menjadi libur/shift baru tiap orang sesudah tukar (KEH-136): tukar libur = pengaju libur di
 * tanggal teman dan sebaliknya; tukar shift = keduanya bekerja di tanggal itu.
 */
function swapClashPairs(kind: 'DAY_OFF' | 'SHIFT', fromId: number, toId: number, fromDate: IsoDate, toDate: IsoDate) {
  return kind === 'DAY_OFF'
    ? [{ employeeId: fromId, date: toDate }, { employeeId: toId, date: fromDate }]
    : [{ employeeId: fromId, date: fromDate }, { employeeId: toId, date: fromDate }];
}

/** Terima atau tolak ajakan (KEH-43): hanya teman yang diajak; diterima = jadwal kedua orang berubah dalam satu transaksi. */
export async function answerSwap(actor: Actor, input: { id: number; accept: boolean }, now: Date = new Date()): Promise<ServiceResult<{ status: string }>> {
  const today = wibDate(now);
  const [row] = await db.select().from(swapInvitations).where(eq(swapInvitations.id, input.id)).limit(1);
  if (!row || row.toEmployeeId !== actor.personId) return fail(404, 'Ajakan tidak ditemukan.');
  if (row.status !== 'PENDING') return fail(409, 'Ajakan ini sudah tidak menunggu jawaban.');
  if (row.answerBy < today) return fail(409, 'Ajakan sudah lewat batas jawab.');
  const fromName = (await names([row.fromEmployeeId, row.toEmployeeId]));
  return db.transaction(async (tx) => {
    await lockBranch(tx, row.branchId);
    const [fresh] = await tx.select().from(swapInvitations).where(eq(swapInvitations.id, row.id)).for('update');
    if (fresh.status !== 'PENDING') return fail(409, 'Ajakan ini sudah tidak menunggu jawaban.');
    const answeredAt = new Date();
    if (!input.accept) {
      await tx.update(swapInvitations).set({ status: 'REJECTED', answeredAt }).where(eq(swapInvitations.id, row.id));
      await notifyPeople(tx, [row.fromEmployeeId], {
        kind: 'attendance.swap', title: `${fromName.get(row.toEmployeeId) ?? 'Teman'} menolak ajakan tukar`,
        body: 'Anda bisa mengajukan izin biasa.', link: '/tukar', entity: 'swap_invitation', entityId: row.id,
      }, actor.accountId);
      return { ok: true as const, data: { status: 'REJECTED' } };
    }
    const clashText = await absenceClash(swapClashPairs(row.kind, row.fromEmployeeId, row.toEmployeeId, row.fromDate, row.toDate), tx);
    if (clashText) return fail(409, clashText);
    if (row.kind === 'DAY_OFF') {
      const picks = await tx.select().from(dayOffPicks).where(inArray(dayOffPicks.id, [row.fromPickId!, row.toPickId!]));
      const fromPick = picks.find((pick) => pick.id === row.fromPickId);
      const toPick = picks.find((pick) => pick.id === row.toPickId);
      if (fromPick?.status !== 'ACTIVE' || toPick?.status !== 'ACTIVE') return fail(409, STALE_SWAP);
      const clash = await tx.select({ id: dayOffPicks.id }).from(dayOffPicks).where(and(eq(dayOffPicks.status, 'ACTIVE'), or(
        and(eq(dayOffPicks.employeeId, row.fromEmployeeId), eq(dayOffPicks.offDate, row.toDate)),
        and(eq(dayOffPicks.employeeId, row.toEmployeeId), eq(dayOffPicks.offDate, row.fromDate)),
      ))).limit(1);
      if (clash.length) return fail(409, STALE_SWAP);
      // KEH-136: tukar satu cabang tidak mengubah jumlah libur per tanggal (KEH-34 terjaga), dan tidak diperiksa KEH-35.
      const [forFrom] = await tx.insert(dayOffPicks).values({
        employeeId: row.fromEmployeeId, periodStart: periodStartOf(row.toDate), offDate: row.toDate, origin: 'SWAP',
        createdByAccountId: actor.accountId, swapInvitationId: row.id,
      }).returning({ id: dayOffPicks.id });
      const [forTo] = await tx.insert(dayOffPicks).values({
        employeeId: row.toEmployeeId, periodStart: periodStartOf(row.fromDate), offDate: row.fromDate, origin: 'SWAP',
        createdByAccountId: actor.accountId, swapInvitationId: row.id,
      }).returning({ id: dayOffPicks.id });
      for (const [old, next] of [[fromPick, forFrom.id], [toPick, forTo.id]] as const) {
        await tx.update(dayOffPicks).set({ status: 'REPLACED', endedAt: answeredAt, endedByAccountId: actor.accountId, endReason: 'Tukar libur', replacedById: next })
          .where(eq(dayOffPicks.id, old.id));
      }
    } else {
      const view = await shiftOn(row.branchId, [row.fromEmployeeId, row.toEmployeeId], row.fromDate, tx);
      const a = view.of(row.fromEmployeeId);
      const b = view.of(row.toEmployeeId);
      if (a?.shiftId !== row.fromShiftId || b?.shiftId !== row.toShiftId || a?.dayOff || b?.dayOff) return fail(409, STALE_SWAP);
      const reason = (other: number) => `Tukar shift dengan ${fromName.get(other) ?? 'teman'}`;
      await tx.insert(shiftDayChanges).values([
        {
          employeeId: row.fromEmployeeId, branchId: row.branchId, workDate: row.fromDate, shiftId: row.toShiftId!, previousShiftId: row.fromShiftId,
          reason: reason(row.toEmployeeId), createdByAccountId: actor.accountId, swapInvitationId: row.id,
        },
        {
          employeeId: row.toEmployeeId, branchId: row.branchId, workDate: row.fromDate, shiftId: row.fromShiftId!, previousShiftId: row.toShiftId,
          reason: reason(row.fromEmployeeId), createdByAccountId: actor.accountId, swapInvitationId: row.id,
        },
      ]);
    }
    await tx.update(swapInvitations).set({ status: 'ACCEPTED', answeredAt }).where(eq(swapInvitations.id, row.id));
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'swap_invitation', entityId: row.id, action: 'swap.accept',
      after: { kind: row.kind, fromDate: row.fromDate, toDate: row.toDate },
    });
    // Tidak ada pemberitahuan ke atasan (KEH-43).
    await notifyPeople(tx, [row.fromEmployeeId], {
      kind: 'attendance.swap', title: `${fromName.get(row.toEmployeeId) ?? 'Teman'} menerima ajakan tukar`,
      body: 'Jadwal Anda sudah berubah.', link: row.kind === 'DAY_OFF' ? '/libur' : '/jadwal', entity: 'swap_invitation', entityId: row.id,
    }, actor.accountId);
    return { ok: true as const, data: { status: 'ACCEPTED' } };
  });
}

export async function cancelSwap(actor: Actor, id: number): Promise<ServiceResult<{ id: number }>> {
  const [row] = await db.select().from(swapInvitations).where(eq(swapInvitations.id, id)).limit(1);
  if (!row || row.fromEmployeeId !== actor.personId) return fail(404, 'Ajakan tidak ditemukan.');
  if (row.status !== 'PENDING') return fail(409, 'Hanya ajakan yang menunggu yang bisa dibatalkan.');
  await db.update(swapInvitations).set({ status: 'CANCELLED', answeredAt: new Date() })
    .where(and(eq(swapInvitations.id, id), eq(swapInvitations.status, 'PENDING')));
  return { ok: true, data: { id } };
}

// ---- Minta Masuk di Hari Libur (KEH-L29) ----

export async function workRequestScreen(actor: Actor, branchInput: number | null, now: Date = new Date()) {
  const today = wibDate(now);
  const book = await ruleBook();
  const all = await membersOn(today, book);
  const scope = all.filter((person) => person.employeeId !== actor.personId && can(actor, 'attendance.dayoff.request_work', targetOf(person)));
  const org = await getOrgLookup();
  const branches = org.branches.filter((branch) => scope.some((person) => person.branchId === branch.id)).map(({ id, name }) => ({ id, name }));
  const branchId = branches.find((branch) => branch.id === branchInput)?.id ?? branches[0]?.id ?? null;
  const people = scope.filter((person) => person.branchId === branchId);
  const ids = people.map((person) => person.employeeId);
  const [picks, requests] = await Promise.all([
    activePicks(ids, today, addDays(today, 45)),
    ids.length ? db.select().from(dayOffWorkRequests).where(inArray(dayOffWorkRequests.employeeId, ids)).orderBy(desc(dayOffWorkRequests.workDate)).limit(100) : [],
  ]);
  const replacements = requests.length
    ? await db.select().from(replacementDaysOff).where(inArray(replacementDaysOff.workRequestId, requests.map((row) => row.id))) : [];
  const chosen = replacements.filter((row) => row.pickId != null).length
    ? await db.select().from(dayOffPicks).where(inArray(dayOffPicks.id, replacements.filter((row) => row.pickId != null).map((row) => row.pickId!))) : [];
  const nameMap = await names([...ids, ...requests.map((row) => row.requestedByEmployeeId)]);
  const live = new Set(requests.filter((row) => row.status !== 'CANCELLED').map((row) => row.pickId));
  return {
    today, branches, branchId,
    options: people.map((person) => ({
      employeeId: person.employeeId, name: person.name,
      days: picks.filter((pick) => pick.employeeId === person.employeeId && !live.has(pick.id))
        .map((pick) => ({ pickId: pick.id, date: pick.offDate, label: longDate(pick.offDate) })),
    })).filter((row) => row.days.length),
    rows: requests.map((row) => {
      const replacement = replacements.find((item) => item.workRequestId === row.id);
      const pick = replacement?.pickId ? chosen.find((item) => item.id === replacement.pickId) : null;
      return {
        id: row.id, workDate: row.workDate, name: nameMap.get(row.employeeId) ?? '-', by: nameMap.get(row.requestedByEmployeeId) ?? '-',
        reason: row.reason, status: row.status, statusLabel: WORK_REQUEST_STATUS_LABELS[row.status],
        replacement: replacement
          ? `${REPLACEMENT_STATUS_LABELS[replacement.status]}${replacement.status === 'CHOSEN' && pick ? ` pada ${pick.offDate}` : replacement.status === 'WAITING' ? ` (sampai ${replacement.chooseBy})` : ''}`
          : row.status === 'CANCELLED' ? '-' : 'Belum masuk',
        cancellable: row.status !== 'CANCELLED' && row.workDate >= today && !replacement,
      };
    }),
    replacementDays: book.replacementDays(today),
  };
}

export async function createWorkRequest(actor: Actor, input: { pickId: number; reason: string }, now: Date = new Date()): Promise<ServiceResult<{ id: number }>> {
  const today = wibDate(now);
  const reason = await checkReason(input.reason);
  if (!reason.ok) return fail(400, reason.error);
  const book = await ruleBook();
  const found = await pickWithPerson(input.pickId, book);
  if (!found || found.pick.status !== 'ACTIVE') return fail(404, 'Libur tidak ditemukan.');
  const { pick, person } = found;
  if (person.employeeId === actor.personId) return fail(403, 'Tidak bisa meminta diri sendiri masuk.');
  if (!can(actor, 'attendance.dayoff.request_work', targetOf(person))) return fail(403, FORBIDDEN);
  if (pick.offDate < today) return fail(409, 'Tanggal libur itu sudah lewat.');
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx.insert(dayOffWorkRequests).values({
        employeeId: person.employeeId, pickId: pick.id, workDate: pick.offDate, requestedByAccountId: actor.accountId,
        requestedByEmployeeId: actor.personId, reason: reason.reason,
      }).returning({ id: dayOffWorkRequests.id });
      await recordAudit(tx, {
        actorAccountId: actor.accountId, entity: 'employee', entityId: person.employeeId, action: 'day_off.request_work',
        after: { date: pick.offDate }, reason: reason.reason,
      });
      await notifyPeople(tx, [person.employeeId], {
        kind: 'attendance.work_request', title: `Anda diminta masuk ${longDate(pick.offDate)}`,
        body: `${reason.reason}. Tekan Siap masuk di Pilih Libur; sesudah masuk, pilih libur pengganti.`, link: '/libur',
        entity: 'day_off_work_request', entityId: row.id,
      }, actor.accountId);
      return { ok: true as const, data: { id: row.id } };
    });
  } catch (error) {
    if ((error as { cause?: { code?: string } })?.cause?.code === '23505') return fail(409, 'Tanggal itu sudah punya permintaan masuk.');
    throw error;
  }
}

/** Batalkan permintaan masuk (KEH-137): peminta, HR, Pemilik, GM; alasan wajib; selama tanggalnya belum lewat. */
export async function cancelWorkRequest(actor: Actor, input: { id: number; reason: string }, now: Date = new Date()): Promise<ServiceResult<{ id: number }>> {
  const today = wibDate(now);
  const reason = await checkReason(input.reason);
  if (!reason.ok) return fail(400, reason.error);
  const [row] = await db.select().from(dayOffWorkRequests).where(eq(dayOffWorkRequests.id, input.id)).limit(1);
  if (!row || row.status === 'CANCELLED') return fail(404, 'Permintaan tidak ditemukan.');
  const book = await ruleBook();
  const person = (await membersOn(row.workDate, book)).find((item) => item.employeeId === row.employeeId);
  const allowed = row.requestedByAccountId === actor.accountId || (person && person.employeeId !== actor.personId && can(actor, 'attendance.dayoff.revoke', targetOf(person)));
  if (!allowed) return fail(403, FORBIDDEN);
  if (row.workDate < today) return fail(409, 'Tanggalnya sudah lewat.');
  const [born] = await db.select({ id: replacementDaysOff.id }).from(replacementDaysOff).where(eq(replacementDaysOff.workRequestId, row.id)).limit(1);
  if (born) return fail(409, 'Orangnya sudah absen masuk, jadi permintaan tidak bisa dibatalkan.');
  return db.transaction(async (tx) => {
    await tx.update(dayOffWorkRequests).set({ status: 'CANCELLED', cancelledAt: new Date(), cancelledByAccountId: actor.accountId, cancelReason: reason.reason })
      .where(eq(dayOffWorkRequests.id, row.id));
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'day_off_work_request', entityId: row.id, action: 'day_off.request_work_cancel', reason: reason.reason });
    await notifyPeople(tx, [row.employeeId], {
      kind: 'attendance.work_request', title: `Permintaan masuk ${longDate(row.workDate)} dibatalkan`, body: `${reason.reason}. Hari itu tetap libur.`, link: '/libur',
    }, actor.accountId);
    return { ok: true as const, data: { id: row.id } };
  });
}

/** Siap masuk (KEH-137). Tidak ada tombol Tolak. */
export async function readyToWork(actor: Actor, id: number, now: Date = new Date()): Promise<ServiceResult<{ id: number }>> {
  const today = wibDate(now);
  const [row] = await db.select().from(dayOffWorkRequests).where(eq(dayOffWorkRequests.id, id)).limit(1);
  if (!row || row.employeeId !== actor.personId || row.status === 'CANCELLED') return fail(404, 'Permintaan tidak ditemukan.');
  if (row.status === 'READY') return { ok: true, data: { id } };
  if (row.workDate < today) return fail(409, 'Tanggalnya sudah lewat.');
  return db.transaction(async (tx) => {
    await tx.update(dayOffWorkRequests).set({ status: 'READY', readyAt: new Date() }).where(and(eq(dayOffWorkRequests.id, id), eq(dayOffWorkRequests.status, 'REQUESTED')));
    const me = await names([actor.personId], tx);
    await notifyPeople(tx, [row.requestedByEmployeeId], {
      kind: 'attendance.work_request', title: `${me.get(actor.personId) ?? 'Karyawan'} siap masuk ${longDate(row.workDate)}`, link: '/kehadiran/minta-masuk',
    }, actor.accountId);
    return { ok: true as const, data: { id } };
  });
}

// ---- Hari tutup di atas libur (spec L3e §9 butir 6) ----

/** Dipanggil saat hari tutup dipasang: orang yang liburnya tertimpa dan kepala cabangnya diberi tahu. Jatah tidak dikembalikan. */
export async function notifyDaysOffUnderClosure(tx: Tx, branchId: number | null, startDate: IsoDate, endDate: IsoDate, actorAccountId: number) {
  const book = await ruleBook(tx);
  const members = await membersOn(startDate, book, tx);
  const scoped = members.filter((person) => branchId == null || person.branchId === branchId);
  const picks = await activePicks(scoped.map((person) => person.employeeId), startDate, endDate, tx);
  if (!picks.length) return;
  const affected = [...new Set(picks.map((pick) => pick.employeeId))];
  await notifyPeople(tx, affected, {
    kind: 'attendance.day_off', title: 'Hari tutup jatuh di hari libur Anda',
    body: 'Libur tetap tercatat. Bila perlu digeser, hubungi kepala cabang.', link: '/libur',
  }, actorAccountId);
  const branches = [...new Set(scoped.filter((person) => affected.includes(person.employeeId)).map((person) => person.branchId))];
  for (const id of branches) {
    const heads = await headsOf(id, tx);
    const who = scoped.filter((person) => person.branchId === id && affected.includes(person.employeeId)).map((person) => person.name);
    await notifyPeople(tx, heads, {
      kind: 'attendance.day_off', title: 'Hari tutup menimpa libur karyawan', body: who.join(', '), link: `/kehadiran/libur?branch=${id}`,
    }, actorAccountId);
  }
}

async function headsOf(branchId: number, executor: Executor = db): Promise<number[]> {
  const rows = await executor.execute<{ employee_id: number }>(sql`
    select cp.employee_id from hris.current_placements cp
    join hris.positions p on p.id = cp.position_id and p.active
    join hris.position_grants g on g.position_id = p.id and g.action = 'attendance.dayoff.change'
    where cp.active and cp.branch_id = ${branchId} and g.scope in ('BRANCH', 'DEPARTMENT')`);
  return rows.map((row) => Number(row.employee_id));
}

// ---- Beranda dan Absen ----

export type DayOffCard = { key: string; title: string; detail?: string; href: string };

export async function dayOffAttention(actor: Actor | null, now: Date = new Date()): Promise<DayOffCard[]> {
  const today = wibDate(now);
  if (!actor || !actor.grants.has('attendance.self.check')) return [];
  const book = await ruleBook();
  const me = await quotaHolder(actor, today, book);
  if (!me) return [];
  const cards: DayOffCard[] = [];
  const [current, next] = periodChoices(today);
  for (const periodStart of [current, next]) {
    const rules = book.rules(periodStart);
    const phase = windowPhase(periodStart, today, rules);
    if (phase !== 'OPEN' && phase !== 'LATE') continue;
    const { start, end } = periodRange(periodStart);
    const quota = await quotaOf(me, periodStart, book);
    const picked = (await activePicks([me.employeeId], start, end)).filter(regular).length;
    if (picked >= quota) continue;
    const window = windowOf(periodStart, rules);
    cards.push({
      key: `day-off-${periodStart}`, title: `Jatah libur belum lengkap: ${picked} dari ${quota}`,
      detail: phase === 'OPEN' ? `Periode ${start} s.d. ${end}. Ditutup ${window.closes} pukul 23.59.` : `Periode ${start} s.d. ${end}. Pilih tanggal paling cepat ${addDays(today, rules.lateMinDays)}.`,
      href: `/libur?period=${periodStart}`,
    });
  }
  const [incoming, requests, waiting] = await Promise.all([
    db.select({ id: swapInvitations.id }).from(swapInvitations).where(and(
      eq(swapInvitations.toEmployeeId, me.employeeId), eq(swapInvitations.status, 'PENDING'), gte(swapInvitations.answerBy, today),
    )),
    db.select().from(dayOffWorkRequests).where(and(
      eq(dayOffWorkRequests.employeeId, me.employeeId), eq(dayOffWorkRequests.status, 'REQUESTED'), gte(dayOffWorkRequests.workDate, today),
    )),
    db.select().from(replacementDaysOff).where(and(eq(replacementDaysOff.employeeId, me.employeeId), eq(replacementDaysOff.status, 'WAITING'))),
  ]);
  if (incoming.length) cards.push({ key: 'swap', title: `Ajakan tukar menunggu jawaban Anda: ${incoming.length}`, href: '/tukar' });
  for (const row of requests) cards.push({ key: `work-${row.id}`, title: `Anda diminta masuk ${longDate(row.workDate)}`, detail: 'Tekan Siap masuk.', href: '/libur' });
  for (const row of waiting) cards.push({ key: `rep-${row.id}`, title: 'Pilih libur pengganti', detail: `Paling lambat ${longDate(row.chooseBy)}.`, href: '/libur' });
  return cards;
}

// ---- Mesin harian (spec L3e §6) ----

/** Tanda waktu akhir satu tanggal WIB (23.59.59 + 1 detik). */
const endOfDay = (date: IsoDate) => wibInstant(addDays(date, 1), '00:00');

/**
 * `days-off-daily`, tiap hari 00.10 WIB, aman diulang: batal otomatis ajakan lewat batas, tanda tidak memilih libur,
 * hangus libur pengganti, pengingat sekali per tanda.
 */
export async function runDaysOffDaily(now: Date = new Date()) {
  const today = wibDate(now);
  const book = await ruleBook();
  const result = { expiredSwaps: 0, marks: 0, expiredReplacements: 0, reminders: 0 };

  // 1. Ajakan tukar lewat batas jawab → batal otomatis (KEH-44, W32).
  const expired = await db.update(swapInvitations).set({ status: 'EXPIRED', answeredAt: now })
    .where(and(eq(swapInvitations.status, 'PENDING'), lt(swapInvitations.answerBy, today))).returning();
  if (expired.length) {
    const people = await names(expired.map((row) => row.toEmployeeId));
    await db.transaction(async (tx) => {
      for (const row of expired) {
        await notifyPeople(tx, [row.fromEmployeeId], {
          kind: 'attendance.swap', title: `Ajakan tukar dengan ${people.get(row.toEmployeeId) ?? 'teman'} batal`,
          body: 'Ajakan batal karena tidak dijawab sampai batas. Anda bisa mengajukan izin biasa.', link: '/tukar',
          entity: 'swap_invitation', entityId: row.id,
        }, null);
      }
    });
  }
  result.expiredSwaps = expired.length;

  // 2. Tanda tidak memilih libur, satu per orang per periode (KEH-135, 140).
  const periodStart = periodStartOf(today);
  if (periodStart >= DAY_OFF_MARKS_FROM) {
    const rules = book.rules(periodStart);
    const { closes } = windowOf(periodStart, rules);
    const members = await membersOn(today, book);
    const joined = await joinedOn(members.map((person) => person.employeeId));
    const grace = book.graceDays(periodStart);
    const { start, end } = periodRange(periodStart);
    for (const person of members) {
      const joinDate = joined.get(person.employeeId) ?? null;
      const due = markDueAfter(periodStart, joinDate, grace, closes);
      if (today <= due) continue;
      const quota = proratedQuota(book.quota(person.positionId, periodStart), periodStart, joinDate);
      if (quota <= 0) continue;
      // Jatah dinilai pada akhir batasnya: libur yang berlaku saat itu (yang dicabut sesudahnya tetap dihitung).
      const at = endOfDay(due);
      const held = await db.select({ id: dayOffPicks.id }).from(dayOffPicks).where(and(
        eq(dayOffPicks.employeeId, person.employeeId), gte(dayOffPicks.offDate, start), lte(dayOffPicks.offDate, end),
        ne(dayOffPicks.origin, 'REPLACEMENT'), lte(dayOffPicks.createdAt, at),
        or(isNull(dayOffPicks.endedAt), gt(dayOffPicks.endedAt, at)),
      ));
      if (held.length >= quota) continue;
      const inserted = await db.insert(dayOffMissingMarks).values({
        employeeId: person.employeeId, periodStart, quota, pickedCount: held.length,
      }).onConflictDoNothing().returning({ id: dayOffMissingMarks.id });
      result.marks += inserted.length;
    }
  }

  // 3. Libur pengganti lewat batas → hangus, tanpa denda (KEH-138, W33).
  const lapsed = await db.update(replacementDaysOff).set({ status: 'EXPIRED', closedAt: now })
    .where(and(eq(replacementDaysOff.status, 'WAITING'), lt(replacementDaysOff.chooseBy, today))).returning({ id: replacementDaysOff.id });
  result.expiredReplacements = lapsed.length;

  // 4. Pengingat sekali per tanda (spec L3e §9 butir 8).
  const reminders: { employeeId: number; ref: string; input: NotificationInput }[] = [];
  const nextStart = shiftPeriod(periodStart, 1);
  const nextRules = book.rules(nextStart);
  if (windowPhase(nextStart, today, nextRules) === 'OPEN') {
    const { closes } = windowOf(nextStart, nextRules);
    const left = daysBetween(today, closes);
    if ([7, 3, 1].includes(left)) {
      const members = await membersOn(today, book);
      const { start, end } = periodRange(nextStart);
      const picks = await activePicks(members.map((person) => person.employeeId), start, end);
      const joined = await joinedOn(members.map((person) => person.employeeId));
      for (const person of members) {
        const quota = proratedQuota(book.quota(person.positionId, nextStart), nextStart, joined.get(person.employeeId) ?? null);
        const picked = picks.filter((pick) => pick.employeeId === person.employeeId && regular(pick)).length;
        if (picked >= quota) continue;
        reminders.push({
          employeeId: person.employeeId, ref: `window:${nextStart}:H-${left}`,
          input: {
            kind: 'attendance.day_off', title: `Pilih libur periode ${start} s.d. ${end}`,
            body: `Terisi ${picked} dari ${quota}. Jendela ditutup ${closes} pukul 23.59.`, link: `/libur?period=${nextStart}`,
          },
        });
      }
    }
  }
  const soon = await db.select().from(replacementDaysOff).where(and(eq(replacementDaysOff.status, 'WAITING'), eq(replacementDaysOff.chooseBy, addDays(today, 3))));
  for (const row of soon) {
    reminders.push({
      employeeId: row.employeeId, ref: `replacement:${row.id}:H-3`,
      input: { kind: 'attendance.day_off', title: 'Libur pengganti belum dipilih', body: `Tinggal 3 hari, paling lambat ${row.chooseBy}.`, link: '/libur' },
    });
  }
  for (const reminder of reminders) {
    const sent = await db.transaction(async (tx) => {
      const inserted = await tx.execute(sql`insert into hris.day_off_notices (employee_id, ref) values (${reminder.employeeId}, ${reminder.ref})
        on conflict do nothing returning employee_id`);
      if (!inserted.length) return false;
      await notifyPeople(tx, [reminder.employeeId], reminder.input, null);
      return true;
    });
    if (sent) result.reminders += 1;
  }
  return { today, ...result };
}

export type { WindowPhase };
