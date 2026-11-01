import { and, desc, eq, inArray, isNull, lte, gte, or, sql } from 'drizzle-orm';
import {
  attendanceAttempts, attendanceDays, attendancePhotoPurges, attendancePhotoViews, attendanceRecords, branchAssists, branchClosures, branchQrCodes,
} from '@petshop/hris-db/schema/attendance';
import { db } from '@/lib/db';
import { can, getOrgLookup, type Actor, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { removeStoredBytes, saveUpload } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { settingOn } from '@/modules/settings';
import {
  KIND_LABELS, breakOverMinutes, distanceMeters, earliestIn, earliestOut, earlyLeaveMinutes, guardDecision, lateMinutes, locationFresh,
  matchAssistShift, screenState, validPoint, wibClock, wibDate, wibInstant, withinOutCutoff, type AttendanceKind, type DayHours,
} from '../rules/attendance';
import { addDays, mondayOf, versionOn, type AttendanceMode, type IsoDate } from '../rules/schedule';
import { buildBranchWeek, loadShifts, rosterOn, type Executor, type RosterPerson } from './read';

const fail = (status: 400 | 403 | 404 | 409, error: string) => ({ ok: false as const, status, error });
const FORBIDDEN = 'Anda tidak berhak melakukan tindakan ini.';
const QR_DEAD = 'QR ini sudah tidak berlaku, minta yang baru ke kepala cabang.';
const QR_UNKNOWN = 'QR tidak dikenal. Pindai QR yang ditempel di cabang.';
const NO_LOCATION = 'Nyalakan lokasi lalu coba lagi. Handphone bermasalah? Hubungi HR.';
const NO_POINT = 'Absen di cabang ini belum bisa dipakai. Hubungi HR.';

type Point = { latitude?: number | null; longitude?: number | null; accuracy?: number | null };
type AttemptResult = (typeof attendanceAttempts.$inferInsert)['result'];
type Day = typeof attendanceDays.$inferSelect;

type Hours = DayHours & { id: number };

const yes = (value: unknown) => value === 'YES';

function clockOf(value: string | null) {
  return value ? value.slice(0, 5) : null;
}

/** Orang yang absen QR pada satu tanggal; selain itu menu dan layanan menolak (KEH-10, 96, KAR-67). */
async function qrPerson(actor: Actor, on: IsoDate, executor: Executor = db): Promise<RosterPerson | null> {
  if (!can(actor, 'attendance.self.check', { personId: actor.personId })) return null;
  const me = (await rosterOn(on, executor)).find((person) => person.employeeId === actor.personId);
  return me?.mode === 'QR' ? me : null;
}

/** Untuk menu: tombol Absen hanya bagi jabatan yang absen QR. */
export async function tracksAttendance(actor: Actor, on: IsoDate): Promise<boolean> {
  if (actor.positionId == null || !actor.grants.has('attendance.self.check')) return false;
  return (await settingOn<AttendanceMode>('position.attendance_mode', on, { positionId: actor.positionId })) === 'QR';
}

async function latestDays(employeeId: number, executor: Executor = db): Promise<Day[]> {
  return executor.select().from(attendanceDays).where(eq(attendanceDays.employeeId, employeeId)).orderBy(desc(attendanceDays.workDate)).limit(2);
}

async function dayTimes(dayId: number, executor: Executor = db) {
  const rows = await executor.select().from(attendanceRecords).where(eq(attendanceRecords.dayId, dayId));
  return Object.fromEntries(rows.map((row) => [row.kind, row])) as Partial<Record<AttendanceKind, typeof rows[number]>>;
}

/**
 * Hari kerja aktif pada `now`: hari kemarin yang belum pulang tetap aktif sampai batas absen pulang (KEH-18);
 * selain itu hari ini, ada atau belum ada catatannya.
 */
async function activeWorkDay(employeeId: number, now: Date, executor: Executor = db): Promise<{ workDate: IsoDate; day: Day | null }> {
  const today = wibDate(now);
  const days = await latestDays(employeeId, executor);
  const todayRow = days.find((day) => day.workDate === today);
  const previous = days.find((day) => day.workDate === addDays(today, -1));
  if (previous && !todayRow) {
    const cutoff = await settingOn<number>('attendance.out_cutoff_hour', previous.workDate, {}, executor);
    if (withinOutCutoff(previous.workDate, now, cutoff) && !(await dayTimes(previous.id, executor)).OUT) {
      return { workDate: previous.workDate, day: previous };
    }
  }
  return { workDate: today, day: todayRow ?? null };
}

async function branchClosedOn(branchId: number, on: IsoDate, executor: Executor = db): Promise<boolean> {
  const rows = await executor.select({ id: branchClosures.id }).from(branchClosures).where(and(
    isNull(branchClosures.cancelledAt), lte(branchClosures.startDate, on), gte(branchClosures.endDate, on),
    or(isNull(branchClosures.branchId), eq(branchClosures.branchId, branchId)),
  )).limit(1);
  return rows.length > 0;
}

async function branchPoint(branchId: number, executor: Executor = db): Promise<{ latitude: number; longitude: number } | null> {
  const rows = await executor.execute<{ latitude: number | null; longitude: number | null }>(
    sql`select latitude, longitude from hris.branches where id = ${branchId}`,
  );
  const row = rows[0];
  return row && row.latitude != null && row.longitude != null ? { latitude: Number(row.latitude), longitude: Number(row.longitude) } : null;
}

async function branchName(branchId: number): Promise<string> {
  return (await getOrgLookup()).branches.find((branch) => branch.id === branchId)?.name ?? '-';
}

function hoursOf(version: { id: number; startTime: string; endTime: string; breakMinutes: number | null; breakStartFrom: string | null; breakStartUntil: string | null } | null | undefined): Hours | null {
  return version ? {
    id: version.id, startTime: version.startTime, endTime: version.endTime, breakMinutes: version.breakMinutes,
    breakStartFrom: version.breakStartFrom, breakStartUntil: version.breakStartUntil,
  } : null;
}

/** Shift orang itu di cabang penempatannya (KEH-07). */
async function ownShift(person: RosterPerson, on: IsoDate, executor: Executor = db) {
  const week = await buildBranchWeek(person.branchId, mondayOf(on), [{ employeeId: person.employeeId, name: person.name }], executor);
  const cell = week.rows[0]?.cells.find((row) => row.date === on);
  if (!cell?.shiftId) return { shiftId: null, shiftName: null, source: 'NONE', hours: null as Hours | null };
  const shift = (await loadShifts([person.branchId], executor)).find((row) => row.id === cell.shiftId);
  return { shiftId: cell.shiftId, shiftName: cell.shiftName, source: cell.source as string, hours: hoursOf(shift && versionOn(shift.versions, on)) };
}

/** Shift aktif cabang tujuan yang punya jam pada tanggal itu. */
async function branchShiftOptions(branchId: number, on: IsoDate, executor: Executor = db) {
  return (await loadShifts([branchId], executor)).filter((shift) => shift.active).map((shift) => ({
    id: shift.id, name: shift.name, hours: hoursOf(versionOn(shift.versions, on)),
  })).filter((shift) => shift.hours);
}

async function logAttempt(values: typeof attendanceAttempts.$inferInsert, executor: Executor = db) {
  const [row] = await executor.insert(attendanceAttempts).values(values).returning({ id: attendanceAttempts.id });
  return row.id;
}

async function findQr(code: string) {
  const [row] = await db.select().from(branchQrCodes).where(eq(branchQrCodes.code, code)).limit(1);
  return row ?? null;
}

// ---- Layar Absen (KEH-L06) ----

export async function attendanceScreen(actor: Actor, now: Date = new Date()) {
  const { workDate, day } = await activeWorkDay(actor.personId, now);
  const person = await qrPerson(actor, workDate);
  if (!person) return { tracked: false as const };
  const records = day ? await dayTimes(day.id) : {};
  const times = Object.fromEntries(Object.entries(records).map(([kind, row]) => [kind, row.recordedAt])) as Partial<Record<AttendanceKind, Date>>;
  const branchId = day?.branchId ?? person.branchId;
  let hours: Hours | null;
  let shiftName: string | null;
  if (day) {
    const shift = day.shiftId ? (await loadShifts([branchId])).find((row) => row.id === day.shiftId) : null;
    shiftName = shift?.name ?? null;
    hours = hoursOf(shift?.versions.find((version) => version.id === day.shiftVersionId));
  } else {
    const own = await ownShift(person, workDate);
    shiftName = own.shiftName;
    hours = own.hours;
  }
  const [breakRequired, closed, point, earliestInMinutes, minOutMinutes] = await Promise.all([
    settingOn<string>('position.break_required', workDate, { positionId: day?.positionId ?? person.positionId }),
    branchClosedOn(branchId, workDate),
    branchPoint(branchId),
    settingOn<number>('attendance.earliest_in_minutes', workDate),
    settingOn<number>('attendance.min_out_minutes', workDate),
  ]);
  const state = screenState({
    now, workDate, times, hours, breakRequired: yes(breakRequired), closed, hasPoint: Boolean(point), earliestInMinutes, minOutMinutes,
  });
  return {
    tracked: true as const,
    workDate,
    branchName: await branchName(branchId),
    shiftName,
    hours: hours ? `${clockOf(hours.startTime)}–${clockOf(hours.endTime)}` : null,
    state,
    times: Object.fromEntries(Object.entries(times).map(([kind, at]) => [kind, wibClock(at)])) as Partial<Record<AttendanceKind, string>>,
    breakUntil: times.BREAK && hours?.breakMinutes != null ? wibClock(new Date(times.BREAK.getTime() + hours.breakMinutes * 60_000)) : null,
    aloneNoBreak: day?.aloneNoBreak ?? false,
  };
}

// ---- Langkah 1: pindai QR ----

export type ScanResult = {
  branchId: number; branchName: string; needsAssist: boolean; matchedShift: string | null; shiftOptions: { id: number; name: string; hours: string }[];
};

/** Memeriksa QR dan aturan yang tidak butuh lokasi. Pertanyaan perbantuan muncul sebelum lokasi dan foto (KEH-109). */
export async function scanQr(actor: Actor, input: { code: string; kind: AttendanceKind }, now: Date = new Date()): Promise<ServiceResult<ScanResult>> {
  if (input.kind === 'BREAK') return fail(400, 'Istirahat tidak memakai QR.');
  const { workDate, day } = await activeWorkDay(actor.personId, now);
  const person = await qrPerson(actor, workDate);
  if (!person) return fail(403, FORBIDDEN);
  const base = { employeeId: person.employeeId, kind: input.kind };
  const qr = await findQr(input.code);
  if (!qr) {
    await logAttempt({ ...base, result: 'BAD_QR' });
    return fail(400, QR_UNKNOWN);
  }
  const attempt = { ...base, qrCodeId: qr.id, branchId: qr.branchId };
  if (qr.deadAt) {
    await logAttempt({ ...attempt, result: 'BAD_QR' });
    return fail(400, QR_DEAD);
  }
  const name = await branchName(qr.branchId);

  if (input.kind !== 'IN') {
    if (!day) return fail(409, 'Anda belum absen masuk hari ini.');
    if (day.branchId !== qr.branchId) {
      await logAttempt({ ...attempt, result: 'WRONG_BRANCH' });
      const home = await branchName(day.branchId);
      return fail(409, `QR ini milik ${name}, tetapi Anda masuk tadi di ${home}. Pindai QR ${home}.`);
    }
    return { ok: true, data: { branchId: qr.branchId, branchName: name, needsAssist: false, matchedShift: null, shiftOptions: [] } };
  }

  if (await branchClosedOn(qr.branchId, workDate)) {
    await logAttempt({ ...attempt, result: 'CLOSED' });
    return fail(409, 'Hari ini cabang tutup.');
  }
  if (!(await branchPoint(qr.branchId))) return fail(409, NO_POINT);
  if (qr.branchId === person.branchId) {
    const own = await ownShift(person, workDate);
    const problem = await tooEarly(own.hours, workDate, now);
    if (problem) {
      await logAttempt({ ...attempt, result: 'TOO_EARLY' });
      return fail(409, problem);
    }
    return { ok: true, data: { branchId: qr.branchId, branchName: name, needsAssist: false, matchedShift: null, shiftOptions: [] } };
  }
  const own = await ownShift(person, workDate);
  const options = await branchShiftOptions(qr.branchId, workDate);
  return {
    ok: true,
    data: {
      branchId: qr.branchId, branchName: name, needsAssist: true,
      matchedShift: matchAssistShift(own.shiftName, options)?.name ?? null,
      shiftOptions: options.map((shift) => ({ id: shift.id, name: shift.name, hours: `${clockOf(shift.hours!.startTime)}–${clockOf(shift.hours!.endTime)}` })),
    },
  };
}

async function tooEarly(hours: Hours | null, workDate: IsoDate, now: Date): Promise<string | null> {
  if (!hours) return null;
  const opens = earliestIn(workDate, hours.startTime, await settingOn<number>('attendance.earliest_in_minutes', workDate));
  return now < opens ? `Absen baru bisa dibuka mulai ${wibClock(opens)}.` : null;
}

/** Jawaban "Salah scan" tercatat lalu batal, sebelum lokasi dan foto (KEH-109). */
export async function reportWrongScan(actor: Actor, code: string, now: Date = new Date()): Promise<ServiceResult<Record<string, never>>> {
  const { workDate } = await activeWorkDay(actor.personId, now);
  const person = await qrPerson(actor, workDate);
  if (!person) return fail(403, FORBIDDEN);
  const qr = await findQr(code);
  if (!qr) return fail(400, QR_UNKNOWN);
  await db.insert(branchAssists).values({
    employeeId: person.employeeId, workDate, homeBranchId: person.branchId, targetBranchId: qr.branchId, answer: 'WRONG_SCAN',
  });
  return { ok: true, data: {} };
}

// ---- Langkah 2: lokasi ----

export type LocateInput = Point & { code: string; kind: AttendanceKind; assist?: boolean; shiftId?: number | null };

/** Server yang menghitung jarak. Tanpa titik GPS ditolak (syarat owner); di luar radius tetap lanjut bertanda (KEH-14). */
export async function checkLocation(actor: Actor, input: LocateInput, now: Date = new Date()): Promise<ServiceResult<{
  attemptId: number; distanceM: number; inside: boolean; branchName: string;
}>> {
  if (input.kind === 'BREAK') return fail(400, 'Istirahat tidak memakai QR.');
  const { workDate, day } = await activeWorkDay(actor.personId, now);
  const person = await qrPerson(actor, workDate);
  if (!person) return fail(403, FORBIDDEN);
  const qr = await findQr(input.code);
  if (!qr || qr.deadAt) return fail(400, qr ? QR_DEAD : QR_UNKNOWN);
  const targetBranch = input.kind === 'IN' ? qr.branchId : day?.branchId;
  if (targetBranch !== qr.branchId) return fail(409, 'QR ini bukan QR cabang tempat Anda masuk.');
  const isAssist = input.kind === 'IN' && qr.branchId !== person.branchId;
  if (isAssist && !input.assist) return fail(409, 'Pilih dulu: sedang perbantuan atau salah scan.');

  const base = {
    employeeId: person.employeeId, kind: input.kind, qrCodeId: qr.id, branchId: qr.branchId, isAssist, chosenShiftId: input.shiftId ?? null,
  };
  const point = await branchPoint(qr.branchId);
  if (!point) return fail(409, NO_POINT);
  if (!validPoint(input.latitude, input.longitude)) {
    await logAttempt({ ...base, chosenShiftId: null, result: 'NO_LOCATION' });
    return fail(400, NO_LOCATION);
  }
  if (isAssist && input.shiftId != null) {
    const options = await branchShiftOptions(qr.branchId, workDate);
    if (!options.some((shift) => shift.id === input.shiftId)) return fail(400, 'Shift tidak ada di cabang ini.');
  }
  const here = { latitude: input.latitude as number, longitude: input.longitude as number };
  const distanceM = distanceMeters(here, point);
  const radius = Number(await settingOn('attendance.radius_m', workDate, { branchId: qr.branchId }));
  const inside = distanceM <= radius;
  const result: AttemptResult = inside ? 'OK' : 'OUTSIDE';
  const attemptId = await logAttempt({
    ...base, ...here, accuracyM: accuracyOf(input.accuracy), distanceM, result,
  });
  return { ok: true, data: { attemptId, distanceM, inside, branchName: await branchName(qr.branchId) } };
}

function accuracyOf(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(Math.round(value), 1_000_000) : null;
}

// ---- Langkah 4: Kirim ----

async function lockPerson(tx: Tx, employeeId: number) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('attendance.person'), ${employeeId})`);
}

async function lockBranch(tx: Tx, branchId: number) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('attendance.branch'), ${branchId})`);
}

const successText = (kind: AttendanceKind, clock: string, name: string) => `Absen ${KIND_LABELS[kind].toLowerCase()} Anda tercatat pukul ${clock} di ${name}.`;

export type SubmitInput = { attemptId: number; kind: AttendanceKind; photo: File | null };

/**
 * Mencatat Masuk, Masuk Kembali, atau Pulang. Semua diperiksa ulang di server; jam = jam server saat foto diterima (KEH-16).
 * Tekan dua kali tercatat sekali (no 32).
 */
export async function submitAttendance(actor: Actor, input: SubmitInput, now: Date = new Date()): Promise<ServiceResult<{ message: string; recordId: number }>> {
  if (input.kind === 'BREAK') return fail(400, 'Istirahat tidak memakai foto.');
  const { workDate, day } = await activeWorkDay(actor.personId, now);
  const person = await qrPerson(actor, workDate);
  if (!person) return fail(403, FORBIDDEN);
  const [attempt] = await db.select().from(attendanceAttempts).where(and(
    eq(attendanceAttempts.id, input.attemptId), eq(attendanceAttempts.employeeId, person.employeeId), eq(attendanceAttempts.kind, input.kind),
    inArray(attendanceAttempts.result, ['OK', 'OUTSIDE']),
  )).limit(1);
  if (!attempt || attempt.branchId == null || attempt.distanceM == null) return fail(400, 'Lokasi belum diperiksa. Ulangi dari awal.');

  // Sudah tercatat: jawab sukses tanpa menyimpan foto baru.
  if (day) {
    const existing = (await dayTimes(day.id))[input.kind];
    if (existing) return { ok: true, data: { message: successText(input.kind, wibClock(existing.recordedAt), await branchName(existing.branchId)), recordId: existing.id } };
  }
  if (!locationFresh(attempt.createdAt, now)) return fail(409, 'Pemeriksaan lokasi sudah lama. Ulangi dari awal.');
  const [qr] = await db.select().from(branchQrCodes).where(eq(branchQrCodes.id, attempt.qrCodeId!)).limit(1);
  if (!qr || qr.deadAt) return fail(400, QR_DEAD);

  const upload = await saveUpload(actor, input.photo);
  if (!upload.ok) return upload;

  const branchId = attempt.branchId;
  const needsReview = attempt.result === 'OUTSIDE';
  const point = {
    latitude: attempt.latitude, longitude: attempt.longitude, accuracyM: attempt.accuracyM, distanceM: attempt.distanceM,
    needsReview, photoFileId: upload.data.id, attemptId: attempt.id,
  };
  const name = await branchName(branchId);
  let notifyChosen: { shift: string } | null = null;
  const outcome = await db.transaction(async (tx): Promise<ServiceResult<{ recordId: number; at: Date }>> => {
    await lockPerson(tx, person.employeeId);
    const fresh = await activeWorkDay(person.employeeId, now, tx);
    const records = fresh.day ? await dayTimes(fresh.day.id, tx) : {};
    const repeated = records[input.kind];
    if (repeated) return { ok: true, data: { recordId: repeated.id, at: repeated.recordedAt } };

    if (input.kind === 'IN') {
      if (fresh.day) return fail(409, 'Anda sudah absen masuk.');
      if (await branchClosedOn(branchId, fresh.workDate, tx)) return fail(409, 'Hari ini cabang tutup.');
      const shift = await shiftForIn(person, attempt, fresh.workDate, tx);
      if (!shift.ok) return shift;
      const problem = await tooEarly(shift.data.hours, fresh.workDate, now);
      if (problem) {
        await logAttempt({ employeeId: person.employeeId, kind: 'IN', qrCodeId: attempt.qrCodeId, branchId, result: 'TOO_EARLY' }, tx);
        return fail(409, problem);
      }
      const applies = yes(await settingOn<string>('position.late_applies', fresh.workDate, { positionId: person.positionId }, tx));
      const [created] = await tx.insert(attendanceDays).values({
        employeeId: person.employeeId, workDate: fresh.workDate, branchId, positionId: person.positionId,
        shiftId: shift.data.shiftId, shiftVersionId: shift.data.hours?.id ?? null, shiftSource: shift.data.source,
        lateMinutes: applies && shift.data.hours ? lateMinutes(fresh.workDate, shift.data.hours.startTime, now) : null,
      }).returning({ id: attendanceDays.id });
      const [record] = await tx.insert(attendanceRecords).values({ dayId: created.id, kind: 'IN', branchId, recordedAt: now, ...point }).returning({ id: attendanceRecords.id });
      if (attempt.isAssist) {
        await tx.insert(branchAssists).values({
          employeeId: person.employeeId, workDate: fresh.workDate, homeBranchId: person.branchId, targetBranchId: branchId, answer: 'ASSIST',
          shiftId: shift.data.shiftId, shiftChosen: shift.data.source === 'ASSIST_CHOSEN',
        });
        if (shift.data.source === 'ASSIST_CHOSEN') notifyChosen = { shift: shift.data.name ?? '-' };
      }
      return { ok: true, data: { recordId: record.id, at: now } };
    }

    const current = fresh.day;
    if (!current || !records.IN) return fail(409, 'Anda belum absen masuk hari ini.');
    if (current.branchId !== branchId) return fail(409, `Pindai QR ${await branchName(current.branchId)}.`);
    if (records.OUT) return fail(409, 'Anda sudah pulang.');
    if (input.kind === 'RETURN') {
      if (!records.BREAK) return fail(409, 'Anda tidak sedang istirahat.');
      const hours = await versionOfDay(current, tx);
      const [record] = await tx.insert(attendanceRecords).values({ dayId: current.id, kind: 'RETURN', branchId, recordedAt: now, ...point }).returning({ id: attendanceRecords.id });
      if (hours?.breakMinutes != null) {
        await tx.update(attendanceDays).set({ breakOverMinutes: breakOverMinutes(records.BREAK.recordedAt, now, hours.breakMinutes) }).where(eq(attendanceDays.id, current.id));
      }
      return { ok: true, data: { recordId: record.id, at: now } };
    }
    // Pulang
    if (records.BREAK && !records.RETURN) return fail(409, 'Anda masih istirahat. Absen Masuk Kembali dulu.');
    const minOut = await settingOn<number>('attendance.min_out_minutes', current.workDate, {}, tx);
    const opens = earliestOut(records.IN.recordedAt, minOut);
    if (now < opens) {
      await logAttempt({ employeeId: person.employeeId, kind: 'OUT', qrCodeId: attempt.qrCodeId, branchId, result: 'TOO_SOON' }, tx);
      return fail(409, `Absen pulang bisa mulai ${wibClock(opens)}.`);
    }
    const hours = await versionOfDay(current, tx);
    const [record] = await tx.insert(attendanceRecords).values({ dayId: current.id, kind: 'OUT', branchId, recordedAt: now, ...point }).returning({ id: attendanceRecords.id });
    if (hours) {
      await tx.update(attendanceDays).set({ earlyLeaveMinutes: earlyLeaveMinutes(current.workDate, hours.startTime, hours.endTime, now) }).where(eq(attendanceDays.id, current.id));
    }
    return { ok: true, data: { recordId: record.id, at: now } };
  });
  if (!outcome.ok) return outcome;
  if (notifyChosen) await notifyTargetHeads(person, branchId, name, (notifyChosen as { shift: string }).shift);
  return { ok: true, data: { recordId: outcome.data.recordId, message: successText(input.kind, wibClock(outcome.data.at), name) } };
}

async function versionOfDay(day: Day, executor: Executor) {
  if (!day.shiftId || !day.shiftVersionId) return null;
  const shift = (await loadShifts([day.branchId], executor)).find((row) => row.id === day.shiftId);
  return shift?.versions.find((version) => version.id === day.shiftVersionId) ?? null;
}

async function shiftForIn(
  person: RosterPerson, attempt: typeof attendanceAttempts.$inferSelect, workDate: IsoDate, executor: Executor,
): Promise<ServiceResult<{ shiftId: number | null; name: string | null; hours: Hours | null; source: string }>> {
  const own = await ownShift(person, workDate, executor);
  if (!attempt.isAssist) return { ok: true, data: { shiftId: own.shiftId, name: own.shiftName, hours: own.hours, source: own.source } };
  const options = await branchShiftOptions(attempt.branchId!, workDate, executor);
  const matched = matchAssistShift(own.shiftName, options);
  if (matched) return { ok: true, data: { shiftId: matched.id, name: matched.name, hours: matched.hours, source: 'ASSIST_SAME' } };
  if (!options.length) return { ok: true, data: { shiftId: null, name: null, hours: null, source: 'NONE' } };
  const chosen = options.find((shift) => shift.id === attempt.chosenShiftId);
  if (!chosen) return fail(400, 'Pilih shift di cabang ini. Ulangi dari awal.');
  return { ok: true, data: { shiftId: chosen.id, name: chosen.name, hours: chosen.hours, source: 'ASSIST_CHOSEN' } };
}

/** Kepala cabang tujuan diberi tahu bila shift dipilih sendiri (KEH-109). Gagal memberi tahu tidak membatalkan absen. */
async function notifyTargetHeads(person: RosterPerson, branchId: number, name: string, shift: string) {
  const heads = await db.execute<{ employee_id: number }>(sql`
    select cp.employee_id from hris.current_placements cp
    join hris.positions p on p.id = cp.position_id and p.active
    join hris.position_grants g on g.position_id = p.id and g.action = 'attendance.assist.view'
    where cp.active and cp.branch_id = ${branchId} and g.scope in ('BRANCH', 'DEPARTMENT')`);
  const accounts = await activeHrisAccounts(heads.map((row) => Number(row.employee_id)));
  if (!accounts.size) return;
  await db.transaction(async (tx) => notify(tx, [...accounts.values()], {
    kind: 'attendance.assist_chosen',
    title: `${person.name} perbantuan di ${name}`,
    body: `Shift dipilih sendiri: ${shift}. Mohon dicek.`,
    link: '/kehadiran/perbantuan',
  }, null));
}

// ---- Istirahat (KEH-L09) ----

export async function startBreak(actor: Actor, input: Point, now: Date = new Date()): Promise<ServiceResult<{ message: string; alone?: boolean }>> {
  const { workDate, day } = await activeWorkDay(actor.personId, now);
  const person = await qrPerson(actor, workDate);
  if (!person) return fail(403, FORBIDDEN);
  if (!day) return fail(409, 'Anda belum absen masuk hari ini.');
  const branchId = day.branchId;
  const result = await db.transaction(async (tx): Promise<ServiceResult<{ at: Date; alone?: boolean }> > => {
    // Kunci cabang: dua kasir yang menekan bersamaan tidak lolos keduanya (no 26).
    await lockBranch(tx, branchId);
    const records = await dayTimes(day.id, tx);
    if (records.BREAK) return { ok: true, data: { at: records.BREAK.recordedAt } };
    if (records.OUT) return fail(409, 'Anda sudah pulang.');
    const hours = await versionOfDay(day, tx);
    const required = yes(await settingOn<string>('position.break_required', day.workDate, { positionId: day.positionId }, tx));
    const state = screenState({
      now, workDate: day.workDate, times: { IN: records.IN?.recordedAt }, hours: hours ?? null, breakRequired: required,
      closed: false, hasPoint: true, earliestInMinutes: 0, minOutMinutes: 0,
    });
    if (!state.buttons.includes('BREAK')) return fail(409, 'Istirahat tidak bisa dimulai sekarang.');
    if (yes(await settingOn<string>('position.is_guard', day.workDate, { positionId: day.positionId }, tx))) {
      const minimum = await settingOn<number>('attendance.guard_minimum', day.workDate, {}, tx);
      const decision = guardDecision(await otherGuards(day, now, tx), minimum);
      if (!decision.ok) {
        if (decision.reason === 'ALONE') {
          await tx.update(attendanceDays).set({ aloneNoBreak: true }).where(eq(attendanceDays.id, day.id));
          return { ok: true, data: { at: now, alone: true } };
        }
        return fail(409, `Teman Anda, ${decision.friend.name}, sedang istirahat sampai ${decision.friend.onBreakUntil}. Coba lagi nanti.`);
      }
    }
    const here = validPoint(input.latitude, input.longitude)
      ? { latitude: input.latitude as number, longitude: input.longitude as number } : null;
    const point = here ? await branchPoint(branchId, tx) : null;
    await tx.insert(attendanceRecords).values({
      dayId: day.id, kind: 'BREAK', branchId, recordedAt: now,
      latitude: here?.latitude ?? null, longitude: here?.longitude ?? null, accuracyM: here ? accuracyOf(input.accuracy) : null,
      distanceM: here && point ? distanceMeters(here, point) : null,
    });
    return { ok: true, data: { at: now } };
  });
  if (!result.ok) return result;
  if (result.data.alone) return { ok: true, data: { alone: true, message: 'Hari ini hanya Anda yang berjaga, jadi tidak bisa istirahat.' } };
  return { ok: true, data: { message: `Istirahat Anda tercatat mulai pukul ${wibClock(result.data.at)}.` } };
}

/** Penjaga lain di cabang itu: sudah masuk, belum pulang; sertakan jam kembali bagi yang sedang istirahat (KEH-85). */
async function otherGuards(day: Day, now: Date, tx: Tx) {
  const rows = await tx.execute<{
    day_id: number; employee_id: number; position_id: number; work_date: string; name: string; break_at: Date | string | null; returned: boolean; break_minutes: number | null;
  }>(sql`
    select d.id as day_id, d.employee_id, d.position_id, d.work_date, e.name,
      b.recorded_at as break_at, r.id is not null as returned, v.break_minutes
    from hris.attendance_days d
    join hris.employees e on e.id = d.employee_id
    left join hris.attendance_records b on b.day_id = d.id and b.kind = 'BREAK'
    left join hris.attendance_records r on r.day_id = d.id and r.kind = 'RETURN'
    left join hris.work_shift_versions v on v.id = d.shift_version_id
    where d.branch_id = ${day.branchId} and d.employee_id <> ${day.employeeId}
      and d.work_date in (${day.workDate}::date, ${addDays(day.workDate, -1)}::date)
      and not exists (select 1 from hris.attendance_records o where o.day_id = d.id and o.kind = 'OUT')`);
  const people = [];
  for (const row of rows) {
    const workDate = String(row.work_date).slice(0, 10);
    const cutoff = await settingOn<number>('attendance.out_cutoff_hour', workDate, {}, tx);
    if (!withinOutCutoff(workDate, now, cutoff)) continue;
    if (!yes(await settingOn<string>('position.is_guard', workDate, { positionId: Number(row.position_id) }, tx))) continue;
    const onBreak = row.break_at != null && !row.returned;
    people.push({
      employeeId: Number(row.employee_id),
      name: row.name,
      onBreakUntil: onBreak ? wibClock(new Date(new Date(row.break_at as string).getTime() + Number(row.break_minutes ?? 0) * 60_000)) : null,
    });
  }
  return people;
}

// ---- Daftar Perbantuan (KEH-L11) ----

export async function assistsScreen(actor: Actor, branchId: number | null, days: number, now: Date = new Date()) {
  const today = wibDate(now);
  const from = addDays(today, -days);
  const org = await getOrgLookup();
  const rows = await db.select().from(branchAssists).where(and(
    eq(branchAssists.answer, 'ASSIST'), gte(branchAssists.workDate, from), lte(branchAssists.workDate, today),
    branchId ? eq(branchAssists.targetBranchId, branchId) : undefined,
  )).orderBy(desc(branchAssists.workDate), desc(branchAssists.id)).limit(500);
  const roster = await rosterOn(today);
  const shifts = await loadShifts(null);
  const label = (id: number) => org.branches.find((branch) => branch.id === id)?.name ?? '-';
  const names = await peopleNames(rows.map((row) => row.employeeId));
  const allowed = rows.filter((row) => {
    const person = roster.find((item) => item.employeeId === row.employeeId);
    return can(actor, 'attendance.assist.view', { branchId: row.targetBranchId, departmentId: person?.departmentId ?? null });
  });
  return {
    days,
    branchId,
    branches: org.branches.filter((branch) => branch.active).map(({ id, name }) => ({ id, name })),
    rows: allowed.map((row) => ({
      id: row.id, name: names.get(row.employeeId) ?? '-', home: label(row.homeBranchId), target: label(row.targetBranchId), date: row.workDate,
      shift: shifts.find((shift) => shift.id === row.shiftId)?.name ?? 'Belum ditentukan', chosen: row.shiftChosen,
    })),
  };
}

async function peopleNames(ids: number[]) {
  if (!ids.length) return new Map<number, string>();
  const rows = await db.execute<{ id: number; name: string }>(sql`select id, name from hris.employees where id in (${sql.join([...new Set(ids)].map((id) => sql`${id}`), sql`, `)})`);
  return new Map(rows.map((row) => [Number(row.id), row.name]));
}

// ---- Foto Absen Hari Ini (KEH-L14) ----

async function purgedFiles(ids: string[]) {
  if (!ids.length) return new Set<string>();
  const rows = await db.select({ id: attendancePhotoPurges.fileId }).from(attendancePhotoPurges).where(inArray(attendancePhotoPurges.fileId, ids));
  return new Set(rows.map((row) => row.id));
}

/** Pilih tanggal sampai sepanjang masa simpan foto ke belakang (KEH-15, spec L3c §4). */
export async function photosScreen(actor: Actor, branchId: number | null, now: Date = new Date(), dateInput: string | null = null) {
  const today = wibDate(now);
  const earliest = addDays(today, -(await settingOn<number>('attendance.photo_retention_days', today)));
  const date = dateInput && /^\d{4}-\d{2}-\d{2}$/.test(dateInput) && dateInput <= today && dateInput >= earliest ? dateInput : today;
  const org = await getOrgLookup();
  const roster = await rosterOn(date);
  const rows = await db.select({ record: attendanceRecords, day: attendanceDays }).from(attendanceRecords)
    .innerJoin(attendanceDays, eq(attendanceDays.id, attendanceRecords.dayId))
    .where(and(eq(attendanceDays.workDate, date), inArray(attendanceRecords.kind, ['IN', 'RETURN', 'OUT']), branchId ? eq(attendanceRecords.branchId, branchId) : undefined))
    .orderBy(desc(attendanceRecords.recordedAt));
  const names = await peopleNames(rows.map((row) => row.day.employeeId));
  const label = (id: number) => org.branches.find((branch) => branch.id === id)?.name ?? '-';
  const allowed = rows.filter((row) => photoAllowed(actor, row.record.branchId, roster.find((person) => person.employeeId === row.day.employeeId)?.departmentId ?? null));
  const purged = await purgedFiles(allowed.map((row) => row.record.photoFileId!).filter(Boolean));
  return {
    today,
    date,
    earliest,
    branchId,
    branches: org.branches.filter((branch) => branch.active).map(({ id, name }) => ({ id, name })),
    rows: allowed.map(({ record, day }) => ({
      id: record.id, name: names.get(day.employeeId) ?? '-', kind: record.kind as AttendanceKind, clock: wibClock(record.recordedAt), branch: label(record.branchId),
      latitude: record.latitude, longitude: record.longitude, accuracyM: record.accuracyM, distanceM: record.distanceM, needsReview: record.needsReview,
      available: Boolean(record.photoFileId) && !purged.has(record.photoFileId!),
    })),
  };
}

function photoAllowed(actor: Actor, branchId: number, departmentId: number | null) {
  return can(actor, 'attendance.photo.view', { branchId, departmentId });
}

/** Satu foto absen untuk route yang memeriksa hak. Setiap pembukaan dicatat (KEH-119). Selain yang berhak: null. */
export async function openAttendancePhoto(actor: Actor, recordId: number): Promise<string | null> {
  const [row] = await db.select({ record: attendanceRecords, day: attendanceDays }).from(attendanceRecords)
    .innerJoin(attendanceDays, eq(attendanceDays.id, attendanceRecords.dayId))
    .where(eq(attendanceRecords.id, recordId)).limit(1);
  if (!row?.record.photoFileId) return null;
  const person = (await rosterOn(row.day.workDate)).find((item) => item.employeeId === row.day.employeeId);
  if (!photoAllowed(actor, row.record.branchId, person?.departmentId ?? null)) return null;
  if ((await purgedFiles([row.record.photoFileId])).size) return null;
  await db.insert(attendancePhotoViews).values({ recordId, viewedByAccountId: actor.accountId });
  return row.record.photoFileId;
}

// ---- Mesin (spec L3b §6) ----

/** Membuang isi foto lewat masa simpan; jam dan angka tetap (KEH-15). Aman diulang. */
export async function purgeAttendancePhotos(now: Date = new Date()) {
  const days = await settingOn<number>('attendance.photo_retention_days', wibDate(now));
  const before = wibInstant(addDays(wibDate(now), -days), '00:00');
  const rows = await db.execute<{ file_id: string }>(sql`
    select r.photo_file_id as file_id from hris.attendance_records r
    where r.photo_file_id is not null and r.recorded_at < ${before.toISOString()}::timestamptz
      and not exists (select 1 from hris.attendance_photo_purges p where p.file_id = r.photo_file_id)
    limit 2000`);
  for (const { file_id: fileId } of rows) {
    await removeStoredBytes(fileId);
    await db.insert(attendancePhotoPurges).values({ fileId }).onConflictDoNothing();
  }
  return { purged: rows.length, before: before.toISOString() };
}
