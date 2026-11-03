import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { config, fenceOverrides, routes, trips, vehicles } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, getOrgLookup, listEmployeesWithAnyAction, type Actor, type ServiceResult } from '@/modules/access';
import { notify } from '@/modules/notifications';
import { cleanName, normalizePlate, reasonProblem, wibClock, type RouteKind } from '../rules/trip';
import { FORBIDDEN, accountsOf, activeFence, fail, isUniqueViolation } from './data';

const busyStatuses = ['DRAFT', 'RUNNING'];

async function tripsUsing(column: 'vehicle' | 'route', id: number) {
  const where = column === 'vehicle'
    ? eq(trips.vehicleId, id)
    : or(eq(trips.routeId, id), sql`exists (select 1 from logistics.trip_shopping s where s.trip_id = ${trips.id} and s.route_id = ${id} and s.status <> 'DROPPED')`);
  return db.select({ number: trips.number }).from(trips).where(and(inArray(trips.status, busyStatuses), where)).limit(3);
}

/** Tambah atau ubah mobil (LOG-18, 94): plat unik. */
export async function saveVehicle(actor: Actor | null, input: { id?: number | null; name: string; plate: string }): Promise<ServiceResult<{ id: number }>> {
  if (!actor || !can(actor, 'logistics.fleet.manage')) return fail(403, FORBIDDEN);
  const name = cleanName(input.name);
  const plate = normalizePlate(input.plate);
  if (!name || name.length > 60) return fail(400, 'Nama mobil 1 sampai 60 huruf.');
  if (!plate || plate.length > 20) return fail(400, 'Plat 1 sampai 20 huruf.');
  try {
    if (input.id) {
      const [row] = await db.update(vehicles).set({ name, plate, updatedByAccountId: actor.accountId, updatedAt: new Date() })
        .where(eq(vehicles.id, input.id)).returning({ id: vehicles.id });
      return row ? { ok: true, data: row } : fail(404, 'Mobil tidak ditemukan.');
    }
    const [row] = await db.insert(vehicles).values({ name, plate, createdByAccountId: actor.accountId }).returning({ id: vehicles.id });
    return { ok: true, data: row };
  } catch (error) {
    if (isUniqueViolation(error, 'vehicles_plate_unique')) return fail(409, `Plat ${plate} sudah dipakai mobil lain.`);
    throw error;
  }
}

/** Tambah atau ubah rute (LOG-17, 94): jenis tidak bisa diubah sesudah pernah dipakai trip. */
export async function saveRoute(actor: Actor | null, input: { id?: number | null; name: string; kind: RouteKind }): Promise<ServiceResult<{ id: number }>> {
  if (!actor || !can(actor, 'logistics.fleet.manage')) return fail(403, FORBIDDEN);
  const name = cleanName(input.name);
  if (!name || name.length > 60) return fail(400, 'Nama rute 1 sampai 60 huruf.');
  if (input.kind !== 'DELIVERY' && input.kind !== 'SHOPPING') return fail(400, 'Pilih jenis rute.');
  try {
    if (input.id) {
      const [current] = await db.select().from(routes).where(eq(routes.id, input.id)).limit(1);
      if (!current) return fail(404, 'Rute tidak ditemukan.');
      if (current.kind !== input.kind) {
        const used = await db.execute<{ used: boolean }>(sql`select exists (
          select 1 from logistics.trips where route_id = ${input.id}
          union all select 1 from logistics.trip_shopping where route_id = ${input.id}
          union all select 1 from logistics.trip_wages where route_id = ${input.id}) as used`);
        if (used[0]?.used) return fail(409, 'Jenis rute tidak bisa diubah karena sudah pernah dipakai trip (tarif dicari menurut pasangan mobil dan rute).');
      }
      await db.update(routes).set({ name, kind: input.kind, updatedByAccountId: actor.accountId, updatedAt: new Date() }).where(eq(routes.id, input.id));
      return { ok: true, data: { id: input.id } };
    }
    const [row] = await db.insert(routes).values({ name, kind: input.kind, createdByAccountId: actor.accountId }).returning({ id: routes.id });
    return { ok: true, data: row };
  } catch (error) {
    if (isUniqueViolation(error, 'routes_name_unique')) return fail(409, `Nama rute ${name} sudah dipakai.`);
    throw error;
  }
}

/** Nonaktifkan / aktifkan lagi (tidak dihapus). Tidak bisa dinonaktifkan selama dipakai trip Draft atau Berjalan (LOG-94). */
export async function setFleetActive(actor: Actor | null, kind: 'vehicle' | 'route', id: number, active: boolean): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.fleet.manage')) return fail(403, FORBIDDEN);
  if (!active) {
    const using = await tripsUsing(kind, id);
    if (using.length) return fail(409, `Masih dipakai trip ${using.map((t) => t.number).join(', ')}. Selesaikan atau batalkan trip itu dulu.`);
  }
  const table = kind === 'vehicle' ? vehicles : routes;
  const [row] = await db.update(table).set({ active, updatedByAccountId: actor.accountId, updatedAt: new Date() })
    .where(eq(table.id, id)).returning({ id: table.id });
  return row ? { ok: true, data: undefined } : fail(404, 'Data tidak ditemukan.');
}

/** Cabang titik garasi (spec L6 §3.9). Hanya Pemilik/GM. */
export async function setGarageBranch(actor: Actor | null, branchId: number): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.fence.manage')) return fail(403, FORBIDDEN);
  const org = await getOrgLookup();
  if (!org.branches.some((b) => b.id === branchId && b.active)) return fail(400, 'Pilih cabang yang aktif.');
  await db.update(config).set({ garageBranchId: branchId, updatedByAccountId: actor.accountId, updatedAt: new Date() }).where(eq(config.id, 1));
  return { ok: true, data: undefined };
}

/** Matikan pemeriksaan titik garasi paling lama 24 jam (LOG-104); Pemilik/GM lain diberi tahu. */
export async function turnFenceOff(actor: Actor | null, hours: number, reason: string): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.fence.manage')) return fail(403, FORBIDDEN);
  const reasonError = reasonProblem(reason);
  if (reasonError) return fail(400, reasonError);
  if (!Number.isInteger(hours) || hours < 1 || hours > 24) return fail(400, 'Lama mati 1 sampai 24 jam.');
  const now = new Date();
  if (await activeFence(now)) return fail(409, 'Pagar uji sudah mati.');
  const until = new Date(now.getTime() + hours * 3_600_000);
  await db.transaction(async (tx) => {
    await tx.insert(fenceOverrides).values({ reason: reason.trim(), fromAt: now, untilAt: until, byAccountId: actor.accountId });
    const owners = await accountsOf(await listEmployeesWithAnyAction([]));
    await notify(tx, owners, {
      kind: 'logistics.fence_off', title: `Pemeriksaan titik garasi dimatikan sampai ${wibClock(until)}`, body: reason.trim(),
      link: '/logistik/mobil-rute', entity: 'fence', entityId: null,
    }, actor.accountId);
  });
  return { ok: true, data: undefined };
}

export async function turnFenceOn(actor: Actor | null): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.fence.manage')) return fail(403, FORBIDDEN);
  await db.update(fenceOverrides).set({ endedAt: new Date(), endedByAccountId: actor.accountId }).where(isNull(fenceOverrides.endedAt));
  return { ok: true, data: undefined };
}
