import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { config, fenceOverrides, routes, tripCrew, tripShopping, trips, tripWages, vehicles } from '@petshop/logistics';
import { db } from '@/lib/db';
import { listEmployeesWithAnyAction, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { listPeopleForModules } from '@/modules/employees';
import { settingOn } from '@/modules/settings';
import type { Duty, IsoDate } from '../rules/trip';

export type Executor = typeof db | Tx;

export const fail = (status: 400 | 403 | 404 | 409, error: string) => ({ ok: false as const, status, error });
export const FORBIDDEN = 'Anda tidak berhak melakukan tindakan ini.';

export function isUniqueViolation(error: unknown, constraint: string): boolean {
  const cause = (error as { cause?: unknown })?.cause ?? error;
  const pg = cause as { code?: string; constraint_name?: string; constraint?: string };
  return pg?.code === '23505' && (pg.constraint_name ?? pg.constraint) === constraint;
}

/** Satu kunci untuk semua perubahan awak dan Berangkat: "satu trip berjalan per orang" (LOG-98) dicek tanpa balapan. */
export async function lockCrew(tx: Tx) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('logistics.crew'))`);
}

export async function loadFleet(executor: Executor = db) {
  const [vehicleRows, routeRows] = await Promise.all([
    executor.select().from(vehicles).orderBy(asc(vehicles.name)),
    executor.select().from(routes).orderBy(asc(routes.kind), asc(routes.name)),
  ]);
  return { vehicles: vehicleRows, routes: routeRows };
}

export type Person = {
  id: number; name: string; branchName: string; positionId: number; positionName: string; departmentId: number; branchId: number;
  duty: Duty; mode: string;
};

/**
 * Karyawan aktif hari ini beserta izin tugas lapangannya: izin per orang ATAU izin otomatis jabatan (KAR-05, 64, 65),
 * dan cara absennya (`position.attendance_mode`; TRIP = absen lewat trip, KEH-96).
 */
export async function activePeople(today: IsoDate): Promise<Person[]> {
  const people = (await listPeopleForModules()).filter((p) => p.activeToday);
  const positionIds = [...new Set(people.map((p) => p.positionId))];
  const auto = new Map<number, string>();
  const mode = new Map<number, string>();
  await Promise.all(positionIds.map(async (positionId) => {
    auto.set(positionId, String(await settingOn('position.field_duty_auto', today, { positionId })));
    mode.set(positionId, String(await settingOn('position.attendance_mode', today, { positionId })));
  }));
  return people.map((p) => {
    const a = auto.get(p.positionId) ?? 'NONE';
    return {
      id: p.id, name: p.name, branchName: p.branchName, branchId: p.branchId, positionId: p.positionId, positionName: p.positionName,
      departmentId: p.departmentId, mode: mode.get(p.positionId) ?? 'QR',
      duty: { drive: p.permits.DRIVE || a === 'DRIVE' || a === 'BOTH', assist: p.permits.ASSIST || a === 'ASSIST' || a === 'BOTH' },
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/** Nama semua orang (termasuk yang sudah tidak aktif) untuk tampilan riwayat. */
export async function peopleNames(): Promise<Map<number, string>> {
  return new Map((await listPeopleForModules()).map((p) => [p.id, p.name]));
}

export async function garageBranchId(executor: Executor = db): Promise<number | null> {
  const [row] = await executor.select({ id: config.garageBranchId }).from(config).where(eq(config.id, 1)).limit(1);
  return row?.id ?? null;
}

/** Titik + radius cabang garasi (radius absen cabang itu, `attendance.radius_m`). */
export async function garagePoint(on: IsoDate, executor: Executor = db) {
  const branchId = await garageBranchId(executor);
  if (!branchId) return null;
  const rows = await executor.execute<{ name: string; latitude: number | null; longitude: number | null }>(
    sql`select name, latitude, longitude from hris.branches where id = ${branchId}`,
  );
  const row = rows[0];
  if (!row || row.latitude == null || row.longitude == null) return null;
  const radiusM = Number(await settingOn('attendance.radius_m', on, { branchId }));
  return { branchId, name: row.name, latitude: Number(row.latitude), longitude: Number(row.longitude), radiusM };
}

/** Pagar uji yang sedang mati (LOG-104); lewat batas = menyala lagi sendiri. */
export async function activeFence(now: Date, executor: Executor = db) {
  const [row] = await executor.select().from(fenceOverrides)
    .where(and(isNull(fenceOverrides.endedAt), gt(fenceOverrides.untilAt, now))).orderBy(asc(fenceOverrides.id)).limit(1);
  return row ?? null;
}

export async function accountsOf(employeeIds: number[]): Promise<number[]> {
  return [...(await activeHrisAccounts(employeeIds)).values()];
}

/** Akun Kepala Gudang + Pemilik/GM (pemegang `logistics.trip.manage` atau full_access). */
export async function managerAccounts(): Promise<number[]> {
  return accountsOf(await listEmployeesWithAnyAction(['logistics.trip.manage']));
}

export async function loadTrip(id: number, executor: Executor = db) {
  const [trip] = await executor.select().from(trips).where(eq(trips.id, id)).limit(1);
  if (!trip) return null;
  const [crew, shopping, wages] = await Promise.all([
    executor.select().from(tripCrew).where(eq(tripCrew.tripId, id)).orderBy(asc(tripCrew.id)),
    executor.select().from(tripShopping).where(eq(tripShopping.tripId, id)).orderBy(asc(tripShopping.id)),
    executor.select().from(tripWages).where(eq(tripWages.tripId, id)).orderBy(asc(tripWages.id)),
  ]);
  return { trip, crew, shopping, wages, activeCrew: crew.filter((c) => !c.removedAt) };
}

export type LoadedTrip = NonNullable<Awaited<ReturnType<typeof loadTrip>>>;

/** Trip Berjalan lain yang masih diawaki orang-orang ini (LOG-98). */
export async function runningTripsOf(employeeIds: number[], exceptTripId: number, executor: Executor = db) {
  if (!employeeIds.length) return [];
  return executor.select({ employeeId: tripCrew.employeeId, number: trips.number }).from(tripCrew)
    .innerJoin(trips, eq(trips.id, tripCrew.tripId))
    .where(and(inArray(tripCrew.employeeId, employeeIds), isNull(tripCrew.removedAt), eq(trips.status, 'RUNNING'), sql`${trips.id} <> ${exceptTripId}`));
}

/** Trip yang sudah berangkat (Berjalan/Selesai) pada tanggal-tanggal itu beserta awaknya (sasaran denda L7c, spec L7 §3.6). */
export async function crewTripsBetween(from: IsoDate, to: IsoDate, employeeIds: number[] | null = null) {
  return db.select({ tripId: trips.id, number: trips.number, tripDate: trips.tripDate, employeeId: tripCrew.employeeId, role: tripCrew.role })
    .from(tripCrew).innerJoin(trips, eq(trips.id, tripCrew.tripId))
    .where(and(isNull(tripCrew.removedAt), inArray(trips.status, ['RUNNING', 'DONE']), sql`${trips.tripDate} between ${from} and ${to}`,
      ...(employeeIds ? [inArray(tripCrew.employeeId, employeeIds.length ? employeeIds : [-1])] : [])))
    .orderBy(asc(trips.tripDate), asc(trips.id));
}
