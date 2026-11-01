import { randomBytes } from 'node:crypto';
import { and, asc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import {
  branchClosures, branchQrCodes, shiftAssignments, shiftDayChanges, shiftGroupMembers, shiftGroups, workShiftVersions, workShifts,
} from '@petshop/hris-db/schema/attendance';
import { db } from '@/lib/db';
import { can, getOrgLookup, recordAudit, type Actor, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { todayWib } from '@/modules/employees';
import { notify, type NotificationInput } from '@/modules/notifications';
import { checkReason } from '@/modules/settings';
import {
  addDays, closuresOverlap, earliestEffectiveDate, mondayOf, rotationIndex, shiftHoursProblem, type IsoDate, type ShiftHours,
} from '../rules/schedule';
import { notifyDaysOffUnderClosure } from './days-off';
import { buildBranchWeek, loadShifts, rosterOn } from './read';

const fail = (status: 400 | 403 | 404 | 409, error: string) => ({ ok: false as const, status, error });
const FORBIDDEN = 'Anda tidak berhak melakukan tindakan ini.';
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function names(list: string[]): string {
  const shown = list.slice(0, 5).join(', ');
  return list.length > 5 ? `${shown}, dan ${list.length - 5} lainnya` : shown;
}

/** Kabar ke orang-orang (id karyawan) di transaksi kejadiannya. */
async function notifyPeople(tx: Tx, employeeIds: number[], input: NotificationInput, actorAccountId: number | null) {
  if (!employeeIds.length) return;
  const accounts = await activeHrisAccounts(employeeIds);
  await notify(tx, [...accounts.values()], input, actorAccountId);
}

async function branchPeople(branchId: number | null, on: IsoDate): Promise<number[]> {
  return (await rosterOn(on))
    .filter((person) => person.mode !== 'NONE' && (branchId == null || person.branchId === branchId))
    .map((person) => person.employeeId);
}

async function activeBranch(branchId: number) {
  const org = await getOrgLookup();
  return org.branches.find((branch) => branch.id === branchId && branch.active) ?? null;
}

// ---- Jam kerja (KEH-L01) ----

export type ShiftVersionInput = ShiftHours & {
  shiftId?: number; branchId: number; name?: string; effectiveFrom: IsoDate; effectiveUntil: IsoDate | null; reason: string;
};

/** Tambah shift atau jam baru bertanggal. Jam lama tidak pernah ditimpa (KEH-02). */
export async function saveShiftVersion(actor: Actor, input: ShiftVersionInput): Promise<ServiceResult<{ id: number; shiftId: number }>> {
  if (!can(actor, 'attendance.work_hours.update')) return fail(403, FORBIDDEN);
  const problem = shiftHoursProblem(input);
  if (problem) return fail(400, problem);
  const reason = await checkReason(input.reason);
  if (!reason.ok) return fail(400, reason.error);
  if (!ISO.test(input.effectiveFrom)) return fail(400, 'Tanggal berlaku tidak valid.');
  if (input.effectiveUntil && (!ISO.test(input.effectiveUntil) || input.effectiveUntil < input.effectiveFrom)) {
    return fail(400, 'Tanggal akhir harus sesudah tanggal mulai.');
  }
  if (!(await activeBranch(input.branchId))) return fail(404, 'Cabang tidak ditemukan.');

  const today = todayWib();
  const existing = input.shiftId ? (await loadShifts([input.branchId])).find((shift) => shift.id === input.shiftId) : null;
  if (input.shiftId && !existing) return fail(404, 'Shift tidak ditemukan.');
  const hasVersion = Boolean(existing?.versions.some((version) => !version.cancelled));
  const earliest = earliestEffectiveDate(today, hasVersion);
  if (input.effectiveFrom < earliest) return fail(400, `Tanggal berlaku paling cepat ${earliest}. Jam kerja tidak berubah mundur.`);
  if (existing?.versions.some((version) => !version.cancelled && version.effectiveFrom === input.effectiveFrom)) {
    return fail(409, 'Shift ini sudah punya jam kerja mulai tanggal itu. Batalkan dulu yang lama.');
  }
  const name = input.name?.trim().replace(/\s+/g, ' ') ?? '';
  if (!existing && (!name || name.length > 50)) return fail(400, 'Nama shift wajib diisi (paling banyak 50 huruf).');

  try {
    return await db.transaction(async (tx) => {
      let shiftId = existing?.id;
      if (!shiftId) {
        const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${workShifts.position}), -1) + 1` })
          .from(workShifts).where(eq(workShifts.branchId, input.branchId));
        const [shift] = await tx.insert(workShifts).values({
          branchId: input.branchId, name, position: Number(next), createdByAccountId: actor.accountId,
        }).returning({ id: workShifts.id });
        shiftId = shift.id;
      }
      const [row] = await tx.insert(workShiftVersions).values({
        shiftId, startTime: input.startTime, endTime: input.endTime, breakMinutes: input.breakMinutes,
        breakStartFrom: input.breakStartFrom, breakStartUntil: input.breakStartUntil,
        effectiveFrom: input.effectiveFrom, effectiveUntil: input.effectiveUntil, reason: reason.reason,
        createdByAccountId: actor.accountId,
      }).returning({ id: workShiftVersions.id });
      await recordAudit(tx, {
        actorAccountId: actor.accountId, entity: 'work_shift', entityId: shiftId, action: 'work_hours.set',
        after: { startTime: input.startTime, endTime: input.endTime, effectiveFrom: input.effectiveFrom }, reason: reason.reason,
      });
      await notifyPeople(tx, await branchPeople(input.branchId, today), {
        kind: 'attendance.work_hours', title: `Jam kerja ${existing?.name ?? name} berubah mulai ${input.effectiveFrom}`,
        body: `Masuk ${input.startTime}, pulang ${input.endTime}.`, link: '/jadwal', entity: 'work_shift', entityId: shiftId,
      }, actor.accountId);
      return { ok: true as const, data: { id: row.id, shiftId } };
    });
  } catch (error) {
    if ((error as { cause?: { code?: string } })?.cause?.code === '23505') return fail(409, 'Nama shift atau tanggal berlaku itu sudah ada.');
    throw error;
  }
}

/** Batalkan jam kerja yang belum berlaku. */
export async function cancelShiftVersion(actor: Actor, id: number, reasonInput: string): Promise<ServiceResult<{ id: number }>> {
  if (!can(actor, 'attendance.work_hours.update')) return fail(403, FORBIDDEN);
  const reason = await checkReason(reasonInput);
  if (!reason.ok) return fail(400, reason.error);
  const [version] = await db.select().from(workShiftVersions).where(eq(workShiftVersions.id, id)).limit(1);
  if (!version || version.cancelledAt) return fail(404, 'Jam kerja tidak ditemukan.');
  if (version.effectiveFrom <= todayWib()) return fail(409, 'Jam kerja yang sudah berlaku tidak bisa dibatalkan.');
  return db.transaction(async (tx) => {
    await tx.update(workShiftVersions).set({ cancelledAt: new Date(), cancelledByAccountId: actor.accountId, cancelReason: reason.reason })
      .where(eq(workShiftVersions.id, id));
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'work_shift', entityId: version.shiftId, action: 'work_hours.cancel', reason: reason.reason,
    });
    return { ok: true as const, data: { id } };
  });
}

/** Shift tidak dihapus, hanya dinonaktifkan; ditolak bila masih dipakai (KEH-03). */
export async function setShiftActive(actor: Actor, shiftId: number, active: boolean, reasonInput: string): Promise<ServiceResult<{ id: number }>> {
  if (!can(actor, 'attendance.work_hours.update')) return fail(403, FORBIDDEN);
  const reason = await checkReason(reasonInput);
  if (!reason.ok) return fail(400, reason.error);
  const [shift] = await db.select().from(workShifts).where(eq(workShifts.id, shiftId)).limit(1);
  if (!shift) return fail(404, 'Shift tidak ditemukan.');
  if (!active) {
    const today = todayWib();
    const siblings = await db.select({ id: workShifts.id }).from(workShifts)
      .where(and(eq(workShifts.branchId, shift.branchId), eq(workShifts.active, true)));
    if (siblings.length <= 1) return fail(409, 'Cabang aktif wajib punya paling sedikit satu shift aktif.');
    const roster = await rosterOn(today);
    const people = roster.filter((person) => person.branchId === shift.branchId);
    const week = await buildBranchWeek(shift.branchId, mondayOf(today), people.map(({ employeeId, name }) => ({ employeeId, name })));
    const users = week.rows.filter((row) => row.cells.some((cell) => cell.date >= today && cell.shiftId === shiftId)).map((row) => row.name);
    if (users.length) return fail(409, `Shift masih dipakai ${names(users)}. Pindahkan dulu jadwalnya.`);
    if (week.groups.length && siblings.length === 2) return fail(409, 'Cabang ini memakai giliran dua kelompok, jadi tidak bisa tinggal satu shift.');
  }
  return db.transaction(async (tx) => {
    await tx.update(workShifts).set({ active }).where(eq(workShifts.id, shiftId));
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'work_shift', entityId: shiftId, action: active ? 'shift.activate' : 'shift.deactivate', reason: reason.reason,
    });
    return { ok: true as const, data: { id: shiftId } };
  });
}

// ---- Jadwal (KEH-L02) ----

async function schedulablePerson(actor: Actor, employeeId: number, on: IsoDate) {
  const person = (await rosterOn(on)).find((row) => row.employeeId === employeeId);
  if (!person || person.mode !== 'QR') return null;
  return can(actor, 'attendance.schedule.update', { personId: employeeId, branchId: person.branchId, departmentId: person.departmentId }) ? person : null;
}

/** Giliran awal sekali (KEH-102): dua kelompok, kelompok pertama memakai shift pertama minggu ini. */
export async function saveInitialGroups(actor: Actor, branchId: number, groups: [number[], number[]]): Promise<ServiceResult<{ branchId: number }>> {
  const today = todayWib();
  const week = mondayOf(today);
  const [first, second] = groups;
  if (!first.length || !second.length) return fail(400, 'Kedua kelompok harus punya anggota.');
  const all = [...first, ...second];
  if (new Set(all).size !== all.length) return fail(400, 'Satu orang hanya boleh di satu kelompok.');
  const roster = await rosterOn(today);
  for (const employeeId of all) {
    const person = roster.find((row) => row.employeeId === employeeId);
    if (!person || person.branchId !== branchId || person.mode !== 'QR') return fail(400, 'Ada anggota yang bukan orang cabang ini.');
    if (!can(actor, 'attendance.schedule.update', { personId: employeeId, branchId, departmentId: person.departmentId })) return fail(403, FORBIDDEN);
  }
  const shifts = (await loadShifts([branchId])).filter((shift) => shift.active);
  if (shifts.length !== 2) return fail(409, 'Giliran kelompok hanya untuk cabang dengan tepat dua shift aktif.');
  try {
    return await db.transaction(async (tx) => {
      const created = await tx.insert(shiftGroups).values([0, 1].map((position) => ({
        branchId, position, name: position === 0 ? 'Kelompok A' : 'Kelompok B', anchorWeek: week, createdByAccountId: actor.accountId,
      }))).returning();
      for (const group of created) {
        const shift = shifts[rotationIndex(group.position, week, week)];
        for (const employeeId of groups[group.position]) {
          await tx.update(shiftGroupMembers).set({ effectiveUntil: addDays(week, -1) })
            .where(and(eq(shiftGroupMembers.employeeId, employeeId), isNull(shiftGroupMembers.effectiveUntil)));
          await tx.insert(shiftGroupMembers).values({ groupId: group.id, employeeId, effectiveFrom: week, createdByAccountId: actor.accountId });
          await tx.insert(shiftAssignments).values({
            employeeId, branchId, weekStart: week, shiftId: shift.id, origin: 'INITIAL', createdByAccountId: actor.accountId,
          }).onConflictDoNothing();
        }
      }
      await recordAudit(tx, {
        actorAccountId: actor.accountId, entity: 'branch', entityId: branchId, action: 'shift_groups.initial', after: { first, second, week },
      });
      return { ok: true as const, data: { branchId } };
    });
  } catch (error) {
    if ((error as { cause?: { code?: string } })?.cause?.code === '23505') return fail(409, 'Giliran awal cabang ini sudah diisi.');
    throw error;
  }
}

/** Isi shift orang yang belum punya, mulai minggu itu (KEH-103). Di cabang berkelompok ia masuk kelompok yang memakai shift itu. */
export async function assignShift(actor: Actor, employeeId: number, shiftId: number, week: IsoDate): Promise<ServiceResult<{ id: number }>> {
  if (employeeId === actor.personId) return fail(403, 'Jadwal sendiri diubah oleh kepala cabang atau HR.');
  const today = todayWib();
  if (mondayOf(week) !== week || week < mondayOf(today)) return fail(400, 'Minggu tidak valid.');
  const person = await schedulablePerson(actor, employeeId, week === mondayOf(today) ? today : week);
  if (!person) return fail(403, FORBIDDEN);
  const shifts = (await loadShifts([person.branchId])).filter((shift) => shift.active);
  if (!shifts.some((shift) => shift.id === shiftId)) return fail(400, 'Shift tidak ada di cabang ini.');
  const groups = await db.select().from(shiftGroups).where(eq(shiftGroups.branchId, person.branchId)).orderBy(asc(shiftGroups.position));
  const group = shifts.length === 2 ? groups.find((row) => shifts[rotationIndex(row.position, row.anchorWeek, week)].id === shiftId) : undefined;
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(shiftAssignments).values({
      employeeId, branchId: person.branchId, weekStart: week, shiftId, origin: 'MANUAL', createdByAccountId: actor.accountId,
    }).onConflictDoNothing().returning({ id: shiftAssignments.id });
    if (!row) return fail(409, 'Orang ini sudah punya shift minggu itu. Ubah per hari lewat selnya.');
    if (group) {
      await tx.update(shiftGroupMembers).set({ effectiveUntil: addDays(week, -1) })
        .where(and(eq(shiftGroupMembers.employeeId, employeeId), isNull(shiftGroupMembers.effectiveUntil)));
      await tx.insert(shiftGroupMembers).values({ groupId: group.id, employeeId, effectiveFrom: week, createdByAccountId: actor.accountId });
    }
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'employee', entityId: employeeId, action: 'shift.assign', after: { shiftId, week },
    });
    await notifyPeople(tx, [employeeId], { kind: 'attendance.shift', title: 'Shift Anda sudah ditentukan', link: '/jadwal' }, actor.accountId);
    return { ok: true as const, data: { id: row.id } };
  });
}

/** Ubah shift mendadak untuk satu hari (KEH-45): alasan wajib, orangnya diberi tahu, nilai lama tercatat. */
export async function changeDayShift(actor: Actor, employeeId: number, date: IsoDate, shiftId: number, reasonInput: string): Promise<ServiceResult<{ id: number }>> {
  if (employeeId === actor.personId) return fail(403, 'Jadwal sendiri diubah oleh kepala cabang atau HR.');
  const today = todayWib();
  if (!ISO.test(date) || date < today) return fail(400, 'Hanya hari ini atau sesudahnya. Hari yang sudah lewat memakai koreksi.');
  const reason = await checkReason(reasonInput);
  if (!reason.ok) return fail(400, reason.error);
  const person = await schedulablePerson(actor, employeeId, date);
  if (!person) return fail(403, FORBIDDEN);
  const week = await buildBranchWeek(person.branchId, mondayOf(date), [{ employeeId, name: '' }]);
  if (!week.shifts.some((shift) => shift.id === shiftId)) return fail(400, 'Shift tidak ada di cabang ini.');
  const previous = week.rows[0].cells.find((cell) => cell.date === date)?.shiftId ?? null;
  if (previous === shiftId) return fail(409, 'Shift hari itu sudah sama.');
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(shiftDayChanges).values({
      employeeId, branchId: person.branchId, workDate: date, shiftId, previousShiftId: previous, reason: reason.reason,
      createdByAccountId: actor.accountId,
    }).returning({ id: shiftDayChanges.id });
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'employee', entityId: employeeId, action: 'shift.day_change',
      before: { shiftId: previous }, after: { shiftId, date }, reason: reason.reason,
    });
    const name = week.shifts.find((shift) => shift.id === shiftId)?.name;
    await notifyPeople(tx, [employeeId], {
      kind: 'attendance.shift', title: `Shift Anda tanggal ${date} diubah menjadi ${name}`, body: reason.reason, link: '/jadwal',
    }, actor.accountId);
    return { ok: true as const, data: { id: row.id } };
  });
}

// ---- QR (KEH-L03) ----

/** Buat QR pertama atau buat ulang; QR lama langsung mati dalam transaksi yang sama (KEH-11). */
export async function regenerateQr(actor: Actor, branchId: number): Promise<ServiceResult<{ code: string }>> {
  if (!can(actor, 'attendance.qr.manage')) return fail(403, FORBIDDEN);
  if (!(await activeBranch(branchId))) return fail(404, 'Cabang tidak ditemukan.');
  const code = randomBytes(16).toString('base64url');
  return db.transaction(async (tx) => {
    await tx.update(branchQrCodes).set({ deadAt: new Date() }).where(and(eq(branchQrCodes.branchId, branchId), isNull(branchQrCodes.deadAt)));
    const [row] = await tx.insert(branchQrCodes).values({ branchId, code, createdByAccountId: actor.accountId }).returning({ id: branchQrCodes.id });
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'branch_qr', entityId: row.id, action: 'qr.regenerate', after: { branchId } });
    return { ok: true as const, data: { code } };
  });
}

// ---- Hari tutup (KEH-L04) ----

export type ClosureInput = { branchId: number | null; startDate: IsoDate; endDate: IsoDate; reason: string };

export async function addClosure(actor: Actor, input: ClosureInput): Promise<ServiceResult<{ id: number }>> {
  if (!can(actor, 'attendance.closure.manage')) return fail(403, FORBIDDEN);
  if (!ISO.test(input.startDate) || !ISO.test(input.endDate) || input.endDate < input.startDate) return fail(400, 'Rentang tanggal tidak valid.');
  const reason = await checkReason(input.reason);
  if (!reason.ok) return fail(400, reason.error);
  if (input.branchId != null && !(await activeBranch(input.branchId))) return fail(404, 'Cabang tidak ditemukan.');
  const today = todayWib();
  const existing = await db.select().from(branchClosures).where(isNull(branchClosures.cancelledAt));
  if (existing.some((closure) => closuresOverlap(closure, input))) return fail(409, 'Sudah ada hari tutup pada tanggal dan cabang itu.');
  // Tolak slip tertutup + ubah alpha menyusul bersama modul Gaji dan Perlu Dijelaskan (KEH-105).
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(branchClosures).values({
      branchId: input.branchId, startDate: input.startDate, endDate: input.endDate, reason: reason.reason,
      backdated: input.startDate < today, createdByAccountId: actor.accountId,
    }).returning({ id: branchClosures.id });
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'branch_closure', entityId: row.id, action: 'closure.add', after: input, reason: reason.reason });
    const range = input.startDate === input.endDate ? input.startDate : `${input.startDate} s.d. ${input.endDate}`;
    await notifyPeople(tx, await branchPeople(input.branchId, today), {
      kind: 'attendance.closure', title: `Hari tutup: ${range}`, body: reason.reason, link: '/jadwal', entity: 'branch_closure', entityId: row.id,
    }, actor.accountId);
    await notifyDaysOffUnderClosure(tx, input.branchId, input.startDate, input.endDate, actor.accountId);
    return { ok: true as const, data: { id: row.id } };
  });
}

export async function cancelClosure(actor: Actor, id: number, reasonInput: string): Promise<ServiceResult<{ id: number }>> {
  if (!can(actor, 'attendance.closure.manage')) return fail(403, FORBIDDEN);
  const reason = await checkReason(reasonInput);
  if (!reason.ok) return fail(400, reason.error);
  const [closure] = await db.select().from(branchClosures).where(eq(branchClosures.id, id)).limit(1);
  if (!closure || closure.cancelledAt) return fail(404, 'Hari tutup tidak ditemukan.');
  return db.transaction(async (tx) => {
    await tx.update(branchClosures).set({ cancelledAt: new Date(), cancelledByAccountId: actor.accountId, cancelReason: reason.reason })
      .where(eq(branchClosures.id, id));
    await recordAudit(tx, { actorAccountId: actor.accountId, entity: 'branch_closure', entityId: id, action: 'closure.cancel', reason: reason.reason });
    await notifyPeople(tx, await branchPeople(closure.branchId, todayWib()), {
      kind: 'attendance.closure', title: `Hari tutup ${closure.startDate} dibatalkan`, body: reason.reason, link: '/jadwal',
      entity: 'branch_closure', entityId: id,
    }, actor.accountId);
    return { ok: true as const, data: { id } };
  });
}

// ---- Mesin (spec L3a §6) ----

/** Isi jadwal minggu berjalan anggota kelompok. Aman diulang: kunci orang + cabang + minggu. */
export async function rotateShifts(today: IsoDate = todayWib()) {
  const week = mondayOf(today);
  const groups = await db.select().from(shiftGroups).orderBy(asc(shiftGroups.branchId), asc(shiftGroups.position));
  if (!groups.length) return { week, written: 0 };
  const shifts = await loadShifts([...new Set(groups.map((group) => group.branchId))]);
  const members = await db.select().from(shiftGroupMembers).where(and(
    inArray(shiftGroupMembers.groupId, groups.map((group) => group.id)),
    or(isNull(shiftGroupMembers.effectiveUntil), gte(shiftGroupMembers.effectiveUntil, week)),
  ));
  const roster = await rosterOn(today);
  let written = 0;
  for (const group of groups) {
    const active = shifts.filter((shift) => shift.branchId === group.branchId && shift.active);
    if (active.length !== 2) continue; // Cabang tiga shift ke atas diisi tangan (keputusan owner §9 butir 5).
    const shift = active[rotationIndex(group.position, group.anchorWeek, week)];
    for (const member of members.filter((row) => row.groupId === group.id && row.effectiveFrom <= week)) {
      const person = roster.find((row) => row.employeeId === member.employeeId);
      if (!person || person.branchId !== group.branchId || person.mode !== 'QR') continue;
      const inserted = await db.insert(shiftAssignments).values({
        employeeId: member.employeeId, branchId: group.branchId, weekStart: week, shiftId: shift.id, origin: 'MACHINE',
      }).onConflictDoNothing().returning({ id: shiftAssignments.id });
      written += inserted.length;
    }
  }
  return { week, written };
}

/** Peringatan kelompok kosong / orang tanpa shift, paling banyak sekali per cabang per minggu. */
export async function checkShifts(today: IsoDate = todayWib()) {
  const week = mondayOf(today);
  const roster = (await rosterOn(today)).filter((person) => person.mode === 'QR');
  const org = await getOrgLookup();
  let warned = 0;
  for (const branch of org.branches.filter((row) => row.active)) {
    const people = roster.filter((person) => person.branchId === branch.id);
    if (!people.length) continue;
    const data = await buildBranchWeek(branch.id, week, people.map(({ employeeId, name }) => ({ employeeId, name })));
    if (data.shifts.length < 2) continue;
    const missingGroups = data.shifts.length === 2 && data.groups.length === 0;
    const unassigned = data.rows.filter((row) => row.cells.every((cell) => cell.shiftId == null)).map((row) => row.name);
    if (!missingGroups && !unassigned.length) continue;
    const managers = await db.execute<{ employee_id: number }>(sql`
      select cp.employee_id from hris.current_placements cp
      join hris.positions p on p.id = cp.position_id and p.active
      join hris.position_grants g on g.position_id = p.id and g.action = 'attendance.schedule.update'
      where cp.active and (g.scope = 'ALL' or cp.branch_id = ${branch.id})`);
    const sent = await db.transaction(async (tx) => {
      const inserted = await tx.execute(sql`insert into hris.shift_check_notices (branch_id, week_start)
        values (${branch.id}, ${week}) on conflict do nothing returning branch_id`);
      if (!inserted.length) return false;
      await notifyPeople(tx, managers.map((row) => Number(row.employee_id)), {
        kind: 'attendance.shift_check',
        title: missingGroups ? `Giliran ${branch.name} belum diisi` : `${branch.name}: ada orang tanpa shift`,
        body: missingGroups ? 'Isi kelompok giliran di Jadwal & Shift supaya mesin bisa menggilir.' : names(unassigned),
        link: `/kehadiran/jadwal?branch=${branch.id}`,
      }, null);
      return true;
    });
    if (sent) warned += 1;
  }
  return { week, warned };
}
