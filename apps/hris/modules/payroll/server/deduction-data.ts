import { and, eq } from 'drizzle-orm';
import { attendanceDays, attendanceRecords } from '@petshop/hris-db/schema/attendance';
import { employees, employmentEvents, placements } from '@petshop/hris-db/schema/employees';
import { db } from '@/lib/db';
import { getOrgLookup } from '@/modules/access';
import { activeOn, placementOn, type EmploymentEventRecord, type PlacementRecord } from '@/modules/employees';
import { settingOn } from '@/modules/settings';
import { daysBetween, type LossHolder } from '../rules/losses';
import { addPeriods, periodStartOf, type IsoDate } from '../rules/salary';
import type { Executor } from './data';

// Bahan bersama potongan L4c: riwayat penempatan per hari, tanda dan bobot jabatan, dan yang hadir di cabang.

export function periodEndOf(start: IsoDate): IsoDate {
  const next = new Date(`${addPeriods(start, 1)}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() - 1);
  return next.toISOString().slice(0, 10);
}

export function periodOf(date: IsoDate) {
  const start = periodStartOf(date);
  return { start, end: periodEndOf(start), days: daysBetween(start, periodEndOf(start)) };
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type Timeline = { employeeId: number; name: string; placements: PlacementRecord[]; events: EmploymentEventRecord[] };

/** Riwayat penempatan dan status semua karyawan (data kecil; dibaca sekali per hitungan). */
export async function loadTimelines(executor: Executor = db): Promise<Timeline[]> {
  const [people, rows, events] = await Promise.all([
    executor.select({ id: employees.id, name: employees.name }).from(employees),
    executor.select({
      id: placements.id, employeeId: placements.employeeId, kind: placements.kind, branchId: placements.branchId,
      positionId: placements.positionId, workStatus: placements.workStatus, effectiveFrom: placements.effectiveFrom, cancelledAt: placements.cancelledAt,
    }).from(placements),
    executor.select({ id: employmentEvents.id, employeeId: employmentEvents.employeeId, kind: employmentEvents.kind, effectiveOn: employmentEvents.effectiveOn }).from(employmentEvents),
  ]);
  return people.map((p) => ({
    employeeId: p.id, name: p.name,
    placements: rows.filter((r) => r.employeeId === p.id).map((r) => ({ ...r, effectiveFrom: String(r.effectiveFrom) })),
    events: events.filter((e) => e.employeeId === p.id).map((e) => ({ id: e.id, kind: e.kind, effectiveOn: String(e.effectiveOn) })),
  }));
}

/** Jabatan Pemilik/GM (full_access) tidak pernah ikut menanggung (GAJ-09). */
async function ownerPositions(): Promise<Set<number>> {
  const { positions } = await getOrgLookup();
  return new Set(positions.filter((p) => p.fullAccess).map((p) => p.id));
}

/** Tanda "ikut menanggung kehilangan barang" dan bobot jabatan, dibaca pada tanggal 26 awal periode. */
export async function lossFlags(positionIds: Iterable<number>, periodStart: IsoDate) {
  const owners = await ownerPositions();
  const flags = new Map<number, { sharing: boolean; weight: number }>();
  for (const positionId of new Set(positionIds)) {
    if (owners.has(positionId)) { flags.set(positionId, { sharing: false, weight: 0 }); continue; }
    const [sharing, weight] = await Promise.all([
      settingOn<string>('position.loss_sharing', periodStart, { positionId }),
      settingOn<number>('position.loss_weight', periodStart, { positionId }),
    ]);
    flags.set(positionId, { sharing: sharing === 'YES', weight: Number(weight) });
  }
  return flags;
}

/**
 * GAJ-77 yang ikut menanggung: ditempatkan di cabang itu ≥ 1 hari dalam periode, aktif, jabatan bertanda.
 * Hari = hari kalender ia ditempatkan di sana dengan jabatan bertanda; bobot = jabatan pada hari terakhirnya di sana.
 */
export async function lossHolders(branchId: number, periodStart: IsoDate, timelines?: Timeline[]): Promise<LossHolder[]> {
  const people = timelines ?? await loadTimelines();
  const end = periodEndOf(periodStart);
  const positionIds = new Set<number>();
  for (const t of people) for (const p of t.placements) positionIds.add(p.positionId);
  const flags = await lossFlags(positionIds, periodStart);
  const holders: LossHolder[] = [];
  for (const t of people) {
    let days = 0;
    let lastPosition: number | null = null;
    for (let day = periodStart; day <= end; day = addDays(day, 1)) {
      if (!activeOn(t.events, day)) continue;
      const placement = placementOn(t.placements, day);
      if (!placement || placement.branchId !== branchId || !flags.get(placement.positionId)?.sharing) continue;
      days += 1;
      lastPosition = placement.positionId;
    }
    if (days > 0 && lastPosition != null) holders.push({ employeeId: t.employeeId, name: t.name, weight: flags.get(lastPosition)?.weight ?? 0, days });
  }
  return holders.sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
}

/** GAJ-79 tanpa nama: orang yang absen masuk di cabang itu pada tanggal itu, dengan jabatan bertanda. */
export async function presentFlagged(branchId: number, date: IsoDate, executor: Executor = db): Promise<{ employeeId: number; name: string }[]> {
  const rows = await executor.selectDistinct({ employeeId: attendanceDays.employeeId, name: employees.name, positionId: attendanceDays.positionId })
    .from(attendanceDays)
    .innerJoin(attendanceRecords, and(eq(attendanceRecords.dayId, attendanceDays.id), eq(attendanceRecords.kind, 'IN')))
    .innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
    .where(and(eq(attendanceDays.branchId, branchId), eq(attendanceDays.workDate, date)));
  const flags = await lossFlags(rows.map((r) => r.positionId), periodStartOf(date));
  return rows.filter((r) => flags.get(r.positionId)?.sharing).map(({ employeeId, name }) => ({ employeeId, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Orang yang ditempatkan di cabang itu pada tanggal itu (penanggung minus bernama, GAJ-79). */
export async function placedAt(branchId: number, date: IsoDate, timelines?: Timeline[]) {
  const people = timelines ?? await loadTimelines();
  const owners = await ownerPositions();
  return people.filter((t) => {
    const placement = placementOn(t.placements, date);
    return activeOn(t.events, date) && placement?.branchId === branchId && !owners.has(placement.positionId);
  }).map((t) => ({ employeeId: t.employeeId, name: t.name }));
}

/** Penempatan hari ini satu orang adalah jabatan Pemilik/GM. */
export async function isOwnerPerson(employeeId: number, date: IsoDate, timelines?: Timeline[]): Promise<boolean> {
  const people = timelines ?? await loadTimelines();
  const t = people.find((p) => p.employeeId === employeeId);
  const placement = t ? placementOn(t.placements, date) : null;
  return placement ? (await ownerPositions()).has(placement.positionId) : false;
}

