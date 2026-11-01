import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import {
  branchClosures, branchQrCodes, shiftAssignments, shiftDayChanges, shiftGroupMembers, shiftGroups, workShiftVersions, workShifts,
} from '@petshop/hris-db/schema/attendance';
import { db } from '@/lib/db';
import { can, getOrgLookup, type Actor, type Tx } from '@/modules/access';
import { loadRows, settingOn } from '@/modules/settings';
import {
  closingTime, closureCovers, resolveShift, rotationIndex, versionOn, weekDates,
  type AttendanceMode, type IsoDate, type ShiftSource,
} from '../rules/schedule';

export type Executor = typeof db | Tx;

export type RosterPerson = {
  employeeId: number; name: string; branchId: number; positionId: number; departmentId: number; mode: AttendanceMode;
};

const clock = (value: string | null) => (value ? value.slice(0, 5) : null);

/** Orang aktif pada satu tanggal beserta cara absennya (Pengaturan Jabatan). */
export async function rosterOn(on: IsoDate, executor: Executor = db): Promise<RosterPerson[]> {
  const rows = await executor.execute<{
    employee_id: number; employee_name: string; branch_id: number; position_id: number; department_id: number;
  }>(sql`select employee_id, employee_name, branch_id, position_id, department_id
         from hris.placements_on(${on}::date) where active order by employee_name`);
  const modes = new Map<number, AttendanceMode>();
  for (const positionId of new Set(rows.map((row) => Number(row.position_id)))) {
    modes.set(positionId, await settingOn<AttendanceMode>('position.attendance_mode', on, { positionId }, executor));
  }
  return rows.map((row) => ({
    employeeId: Number(row.employee_id), name: row.employee_name, branchId: Number(row.branch_id),
    positionId: Number(row.position_id), departmentId: Number(row.department_id), mode: modes.get(Number(row.position_id)) ?? 'QR',
  }));
}

export type ShiftWithVersions = {
  id: number; branchId: number; name: string; position: number; active: boolean;
  versions: {
    id: number; startTime: string; endTime: string; breakMinutes: number | null; breakStartFrom: string | null;
    breakStartUntil: string | null; effectiveFrom: IsoDate; effectiveUntil: IsoDate | null; cancelled: boolean; reason: string;
  }[];
};

export async function loadShifts(branchIds: number[] | null, executor: Executor = db): Promise<ShiftWithVersions[]> {
  const shifts = await executor.select().from(workShifts)
    .where(branchIds ? inArray(workShifts.branchId, branchIds) : undefined)
    .orderBy(asc(workShifts.position), asc(workShifts.id));
  if (!shifts.length) return [];
  const versions = await executor.select().from(workShiftVersions)
    .where(inArray(workShiftVersions.shiftId, shifts.map((shift) => shift.id)))
    .orderBy(asc(workShiftVersions.effectiveFrom));
  return shifts.map((shift) => ({
    id: shift.id, branchId: shift.branchId, name: shift.name, position: shift.position, active: shift.active,
    versions: versions.filter((version) => version.shiftId === shift.id).map((version) => ({
      id: version.id, startTime: clock(version.startTime)!, endTime: clock(version.endTime)!, breakMinutes: version.breakMinutes,
      breakStartFrom: clock(version.breakStartFrom), breakStartUntil: clock(version.breakStartUntil),
      effectiveFrom: version.effectiveFrom, effectiveUntil: version.effectiveUntil, cancelled: version.cancelledAt != null,
      reason: version.reason,
    })),
  }));
}

/** Cabang aktif yang boleh dilihat pelaku; lingkup selain "semua" hanya cabangnya sendiri. */
export async function visibleBranches(actor: Actor, action: Parameters<typeof can>[1]) {
  const org = await getOrgLookup();
  const active = org.branches.filter((branch) => branch.active);
  if (can(actor, action)) return active;
  return active.filter((branch) => branch.id === actor.branchId);
}

export async function workHoursScreen(actor: Actor, branchId: number | null, today: IsoDate) {
  const branches = await visibleBranches(actor, 'attendance.work_hours.view');
  const selected = branches.find((branch) => branch.id === branchId) ?? branches[0] ?? null;
  const shifts = selected ? await loadShifts([selected.id]) : [];
  const roster = selected ? (await rosterOn(today)).filter((person) => person.branchId === selected.id && person.mode === 'QR') : [];
  const closing = closingTime(shifts.filter((shift) => shift.active).map((shift) => ({
    position: shift.position, endTime: versionOn(shift.versions, today)?.endTime ?? null,
  })));
  return { branches: branches.map(({ id, name }) => ({ id, name })), branchId: selected?.id ?? null, shifts, closing, peopleCount: roster.length, today };
}

type Closure = typeof branchClosures.$inferSelect;

async function activeClosures(from: IsoDate, to: IsoDate, executor: Executor = db): Promise<Closure[]> {
  return executor.select().from(branchClosures).where(and(
    isNull(branchClosures.cancelledAt), lte(branchClosures.startDate, to), gte(branchClosures.endDate, from),
  ));
}

export type ScheduleCell = {
  date: IsoDate; shiftId: number | null; shiftName: string | null; hours: string | null; source: ShiftSource; closed: boolean;
};
export type ScheduleRow = { employeeId: number; name: string; cells: ScheduleCell[] };

/** Satu baris jadwal per orang untuk satu cabang dan minggu; dasar layar Jadwal & Shift, Jadwal Saya, dan mesin. */
export async function buildBranchWeek(branchId: number, week: IsoDate, people: { employeeId: number; name: string }[], executor: Executor = db) {
  const dates = weekDates(week);
  const shifts = await loadShifts([branchId], executor);
  const activeShifts = shifts.filter((shift) => shift.active);
  const ids = people.map((person) => person.employeeId);
  const [assignments, changes, groups, members, closures] = await Promise.all([
    ids.length ? executor.select().from(shiftAssignments).where(and(
      eq(shiftAssignments.branchId, branchId), eq(shiftAssignments.weekStart, week), inArray(shiftAssignments.employeeId, ids),
    )) : [],
    ids.length ? executor.select().from(shiftDayChanges).where(and(
      eq(shiftDayChanges.branchId, branchId), gte(shiftDayChanges.workDate, dates[0]), lte(shiftDayChanges.workDate, dates[6]),
      inArray(shiftDayChanges.employeeId, ids),
    )).orderBy(asc(shiftDayChanges.id)) : [],
    executor.select().from(shiftGroups).where(eq(shiftGroups.branchId, branchId)).orderBy(asc(shiftGroups.position)),
    ids.length ? executor.select().from(shiftGroupMembers).where(and(
      inArray(shiftGroupMembers.employeeId, ids), lte(shiftGroupMembers.effectiveFrom, week),
      or(isNull(shiftGroupMembers.effectiveUntil), gte(shiftGroupMembers.effectiveUntil, week)),
    )) : [],
    activeClosures(dates[0], dates[6], executor),
  ]);
  const sole = activeShifts.length === 1 ? activeShifts[0].id : null;
  const dayChange = new Map(changes.map((change) => [`${change.employeeId}:${change.workDate}`, change.shiftId]));
  const groupShift = (employeeId: number): number | null => {
    if (activeShifts.length !== 2) return null;
    const member = members.find((row) => row.employeeId === employeeId && groups.some((group) => group.id === row.groupId));
    const group = member && groups.find((row) => row.id === member.groupId);
    return group ? activeShifts[rotationIndex(group.position, group.anchorWeek, week)].id : null;
  };
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]));
  const rows: ScheduleRow[] = people.map((person) => ({
    employeeId: person.employeeId,
    name: person.name,
    cells: dates.map((date) => {
      const { shiftId, source } = resolveShift({
        dayChangeShiftId: dayChange.get(`${person.employeeId}:${date}`),
        assignmentShiftId: assignments.find((row) => row.employeeId === person.employeeId)?.shiftId,
        groupShiftId: groupShift(person.employeeId),
        soleShiftId: sole,
      });
      const shift = shiftId != null ? shiftById.get(shiftId) : undefined;
      const version = shift ? versionOn(shift.versions, date) : null;
      return {
        date, shiftId, shiftName: shift?.name ?? null, source,
        hours: version ? `${version.startTime}–${version.endTime}` : null,
        closed: closures.some((closure) => closureCovers(closure, branchId, date)),
      };
    }),
  }));
  return { rows, dates, shifts: activeShifts, groups, members };
}

export async function scheduleScreen(actor: Actor, branchId: number | null, week: IsoDate, today: IsoDate) {
  const branches = await visibleBranches(actor, 'attendance.schedule.view');
  const selected = branches.find((branch) => branch.id === branchId) ?? branches[0] ?? null;
  if (!selected) return { branches: [], branchId: null, week, today, rows: [], dates: weekDates(week), shifts: [], groups: [], canUpdate: false, needsInitialGroups: false, candidates: [] };
  const on = week <= today && today <= weekDates(week)[6] ? today : week;
  const people = (await rosterOn(on)).filter((person) => person.branchId === selected.id && person.mode === 'QR'
    && can(actor, 'attendance.schedule.view', { personId: person.employeeId, branchId: person.branchId, departmentId: person.departmentId }));
  const data = await buildBranchWeek(selected.id, week, people.map(({ employeeId, name }) => ({ employeeId, name })));
  const open = data.members.filter((member) => member.effectiveUntil == null);
  return {
    branches: branches.map(({ id, name }) => ({ id, name })),
    branchId: selected.id, week, today, rows: data.rows, dates: data.dates,
    shifts: data.shifts.map((shift) => ({ id: shift.id, name: shift.name })),
    groups: data.groups.map((group) => ({
      id: group.id, name: group.name, position: group.position,
      memberNames: people.filter((person) => open.some((member) => member.groupId === group.id && member.employeeId === person.employeeId)).map((person) => person.name),
    })),
    canUpdate: people.length > 0 && people.some((person) => can(actor, 'attendance.schedule.update', {
      personId: person.employeeId, branchId: person.branchId, departmentId: person.departmentId,
    })),
    needsInitialGroups: data.shifts.length === 2 && data.groups.length === 0,
    candidates: people.map(({ employeeId, name }) => ({ employeeId, name })),
  };
}

export async function locationScreen(actor: Actor, today: IsoDate) {
  const org = await getOrgLookup();
  const branches = org.branches.filter((branch) => branch.active);
  const codes = branches.length ? await db.select().from(branchQrCodes)
    .where(and(isNull(branchQrCodes.deadAt), inArray(branchQrCodes.branchId, branches.map((branch) => branch.id)))) : [];
  const radiusRows = await loadRows(db, ['attendance.radius_m']);
  const points = await db.execute<{ id: number; latitude: number | null; longitude: number | null }>(sql`select id, latitude, longitude from hris.branches`);
  const point = (id: number) => points.find((row) => Number(row.id) === id);
  const details = await Promise.all(branches.map(async (branch) => ({
    id: branch.id, name: branch.name, latitude: point(branch.id)?.latitude ?? null, longitude: point(branch.id)?.longitude ?? null,
    radius: Number(await settingOn('attendance.radius_m', today, { branchId: branch.id })),
    radiusLatestId: radiusRows.filter((row) => row.targetKind === 'BRANCH' && row.targetId === branch.id).reduce<number | null>((max, row) => (max == null || row.id > max ? row.id : max), null),
    radiusHistory: radiusRows.filter((row) => row.targetKind === 'BRANCH' && row.targetId === branch.id && row.status === 'ACTIVE')
      .map((row) => ({ id: row.id, meters: Number(row.value), effectiveFrom: row.effectiveFrom })),
    qr: codes.find((code) => code.branchId === branch.id)?.code ?? null,
    qrCreatedAt: codes.find((code) => code.branchId === branch.id)?.createdAt.toISOString() ?? null,
  })));
  return {
    branches: details,
    canManageQr: can(actor, 'attendance.qr.manage'),
    canUpdateRadius: can(actor, 'attendance.radius.update'),
    canEditPoint: can(actor, 'org.manage'),
  };
}

export async function closuresScreen(actor: Actor) {
  const org = await getOrgLookup();
  const all = can(actor, 'attendance.closure.view');
  const rows = await db.select().from(branchClosures)
    .where(all ? undefined : or(isNull(branchClosures.branchId), eq(branchClosures.branchId, actor.branchId ?? -1)))
    .orderBy(desc(branchClosures.startDate), desc(branchClosures.id)).limit(200);
  const name = (id: number | null) => (id == null ? 'Semua cabang' : org.branches.find((branch) => branch.id === id)?.name ?? '-');
  return {
    rows: rows.map((row) => ({
      id: row.id, startDate: row.startDate, endDate: row.endDate, branch: name(row.branchId), reason: row.reason,
      backdated: row.backdated, cancelled: row.cancelledAt != null, cancelReason: row.cancelReason,
    })),
    branches: org.branches.filter((branch) => branch.active).map(({ id, name: label }) => ({ id, name: label })),
    canManage: can(actor, 'attendance.closure.manage'),
  };
}

/** Jadwal Saya (KEH-L05). Teman: nama + shift satu cabang saja, tanpa alasan (KEH-107). */
export async function mySchedule(actor: Actor, week: IsoDate, today: IsoDate) {
  const on = week <= today && today <= weekDates(week)[6] ? today : week;
  const roster = await rosterOn(on);
  const me = roster.find((person) => person.employeeId === actor.personId);
  if (!me || me.mode === 'NONE') return { tracked: false as const };
  const shiftless = me.mode === 'TRIP';
  const mates = roster.filter((person) => person.branchId === me.branchId && person.mode === 'QR');
  const people = shiftless ? [{ employeeId: me.employeeId, name: me.name }, ...mates] : mates;
  const data = await buildBranchWeek(me.branchId, week, people.map(({ employeeId, name }) => ({ employeeId, name })));
  const own = data.rows.find((row) => row.employeeId === me.employeeId)!;
  return {
    tracked: true as const, week, today, shiftless,
    cells: shiftless ? own.cells.map((cell) => ({ ...cell, shiftId: null, shiftName: null, hours: null })) : own.cells,
    friends: shiftless ? [] : data.rows.filter((row) => row.employeeId !== me.employeeId),
    branchShifts: data.shifts.map((shift) => {
      const version = versionOn(shift.versions, today);
      return {
        id: shift.id, name: shift.name, hours: version ? `${version.startTime}–${version.endTime}` : null,
        breakMinutes: version?.breakMinutes ?? null,
      };
    }),
  };
}

/** Status kode QR untuk halaman penampung `/absen`. */
export async function qrStatus(code: string): Promise<'ALIVE' | 'DEAD' | 'UNKNOWN'> {
  const [row] = await db.select({ deadAt: branchQrCodes.deadAt }).from(branchQrCodes).where(eq(branchQrCodes.code, code)).limit(1);
  if (!row) return 'UNKNOWN';
  return row.deadAt ? 'DEAD' : 'ALIVE';
}
