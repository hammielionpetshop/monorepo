import { and, eq, inArray, isNull, like, sql } from 'drizzle-orm';
import { routes, tripCrew, tripShopping, trips, tripWages, vehicles } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, type Actor, type ServiceResult, type Tx } from '@/modules/access';
import { activeHrisAccounts } from '@/modules/accounts';
import { saveUpload } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { settingOn } from '@/modules/settings';
import {
  ROLE_LABELS, contentProblem, isHanging, crewProblem, garageCheck, manualDateProblem, reasonProblem, tripNumber, validPoint, wagesFor, wibClock, wibDate,
  type CrewRole,
} from '../rules/trip';
import {
  FORBIDDEN, accountsOf, activeFence, activePeople, fail, garagePoint, isUniqueViolation, loadTrip, lockCrew, managerAccounts, peopleNames, runningTripsOf,
  type LoadedTrip,
} from './data';
import { rateProblem } from './rates';

export type TripInput = {
  vehicleId: number; routeId: number | null; shoppingRouteIds: number[]; driverId: number; assistantIds: number[];
};

type Point = { latitude?: number | null; longitude?: number | null; accuracy?: number | null };

const NOT_FOUND = 'Trip tidak ditemukan.';
const AUTO_DROP = 'Belum ditandai selesai saat trip ditutup';

function cleanPoint(point: Point | null | undefined) {
  return point && validPoint(point.latitude, point.longitude)
    ? { latitude: point.latitude as number, longitude: point.longitude as number, accuracy: point.accuracy != null ? Math.round(point.accuracy) : null }
    : null;
}

async function checkContent(input: TripInput, today: string, executor: Tx | typeof db = db): Promise<string | null> {
  const contentError = contentProblem(input.routeId, input.shoppingRouteIds);
  if (contentError) return contentError;
  const [vehicle] = await executor.select().from(vehicles).where(eq(vehicles.id, input.vehicleId)).limit(1);
  if (!vehicle || !vehicle.active) return 'Pilih mobil yang aktif.';
  const routeIds = [...(input.routeId ? [input.routeId] : []), ...input.shoppingRouteIds];
  const found = routeIds.length ? await executor.select().from(routes).where(inArray(routes.id, routeIds)) : [];
  if (input.routeId) {
    const route = found.find((r) => r.id === input.routeId);
    if (!route || !route.active || route.kind !== 'DELIVERY') return 'Pilih rute kirim yang aktif.';
  }
  for (const id of input.shoppingRouteIds) {
    const route = found.find((r) => r.id === id);
    if (!route || !route.active || route.kind !== 'SHOPPING') return 'Pilih supplier belanja yang aktif.';
  }
  const people = await activePeople(today);
  const byId = new Map(people.map((p) => [p.id, p]));
  return crewProblem(input.driverId, input.assistantIds, (id) => byId.get(id)?.duty ?? null, (id) => byId.get(id)?.name ?? `Orang #${id}`);
}

function crewRows(tripId: number, input: TripInput, accountId: number) {
  return [
    { tripId, employeeId: input.driverId, role: 'DRIVER' as const, addedByAccountId: accountId },
    ...input.assistantIds.map((employeeId) => ({ tripId, employeeId, role: 'ASSISTANT' as const, addedByAccountId: accountId })),
  ];
}

async function tripLabel(tripId: number, executor: Tx | typeof db = db) {
  const rows = await executor.execute<{ number: string; vehicle: string; route: string | null }>(sql`
    select t.number, v.name as vehicle, r.name as route from logistics.trips t
    join logistics.vehicles v on v.id = t.vehicle_id left join logistics.routes r on r.id = t.route_id where t.id = ${tripId}`);
  const row = rows[0];
  return row ? `${row.number} (${row.vehicle}${row.route ? `, ${row.route}` : ', belanja'})` : `trip #${tripId}`;
}

async function tellAssigned(tx: Tx, tripId: number, people: { employeeId: number; role: CrewRole }[], actorAccountId: number) {
  if (!people.length) return;
  const label = await tripLabel(tripId, tx);
  const accounts = await activeHrisAccounts(people.map((p) => p.employeeId));
  for (const person of people) {
    const accountId = accounts.get(person.employeeId);
    if (accountId) {
      await notify(tx, [accountId], {
        kind: 'logistics.assigned', title: `Anda ditugaskan sebagai ${ROLE_LABELS[person.role].toLowerCase()} di trip ${label}`,
        link: '/trip-saya', entity: 'trip', entityId: tripId,
      }, actorAccountId);
    }
  }
}

async function tellRemoved(tx: Tx, tripId: number, employeeIds: number[], reason: string, actorAccountId: number) {
  if (!employeeIds.length) return;
  await notify(tx, await accountsOf(employeeIds), {
    kind: 'logistics.removed', title: `Anda tidak lagi bertugas di trip ${await tripLabel(tripId, tx)}`, body: reason,
    link: '/trip-saya', entity: 'trip', entityId: tripId,
  }, actorAccountId);
}

/** Buat trip (Draft) langsung tanpa rencana kirim (PRD 08 §3; LOG-15, 21). */
export async function createTrip(actor: Actor | null, input: TripInput): Promise<ServiceResult<{ id: number }>> {
  if (!actor || !can(actor, 'logistics.trip.manage')) return fail(403, FORBIDDEN);
  const today = wibDate(new Date());
  const problem = await checkContent(input, today);
  if (problem) return fail(400, problem);
  const id = await db.transaction(async (tx) => {
    await lockCrew(tx);
    const prefix = tripNumber(today, 0).slice(0, -1);
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(trips).where(like(trips.number, `${prefix}%`));
    const [trip] = await tx.insert(trips).values({
      number: tripNumber(today, count + 1), vehicleId: input.vehicleId, routeId: input.routeId, createdByAccountId: actor.accountId,
    }).returning({ id: trips.id });
    await tx.insert(tripCrew).values(crewRows(trip.id, input, actor.accountId));
    if (input.shoppingRouteIds.length) {
      await tx.insert(tripShopping).values(input.shoppingRouteIds.map((routeId) => ({ tripId: trip.id, routeId, addedByAccountId: actor.accountId })));
    }
    await tellAssigned(tx, trip.id, [{ employeeId: input.driverId, role: 'DRIVER' }, ...input.assistantIds.map((employeeId) => ({ employeeId, role: 'ASSISTANT' as const }))], actor.accountId);
    return trip.id;
  });
  return { ok: true, data: { id } };
}

/** Ubah trip Draft: mobil, rute, supplier, awak (LOG-22). Awak/supplier yang dilepas diberi tanda, tidak dihapus. */
export async function updateDraft(actor: Actor | null, id: number, input: TripInput): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.trip.manage')) return fail(403, FORBIDDEN);
  const problem = await checkContent(input, wibDate(new Date()));
  if (problem) return fail(400, problem);
  return db.transaction(async (tx) => {
    await lockCrew(tx);
    const loaded = await loadTrip(id, tx);
    if (!loaded) return fail(404, NOT_FOUND);
    if (loaded.trip.status !== 'DRAFT') return fail(409, 'Trip sudah berangkat atau ditutup; ubah awak dan supplier lewat rincian trip.');
    const now = new Date();
    await tx.update(trips).set({ vehicleId: input.vehicleId, routeId: input.routeId, updatedAt: now }).where(eq(trips.id, id));
    const wanted = crewRows(id, input, actor.accountId);
    const keep = new Set(wanted.map((w) => `${w.employeeId}|${w.role}`));
    const removed = loaded.activeCrew.filter((c) => !keep.has(`${c.employeeId}|${c.role}`));
    if (removed.length) {
      await tx.update(tripCrew).set({ removedAt: now, removedByAccountId: actor.accountId, removeReason: 'Diubah sebelum berangkat' })
        .where(inArray(tripCrew.id, removed.map((c) => c.id)));
    }
    const existing = new Set(loaded.activeCrew.filter((c) => !removed.includes(c)).map((c) => `${c.employeeId}|${c.role}`));
    const added = wanted.filter((w) => !existing.has(`${w.employeeId}|${w.role}`));
    if (added.length) await tx.insert(tripCrew).values(added);
    const openShopping = loaded.shopping.filter((s) => s.status !== 'DROPPED');
    const dropped = openShopping.filter((s) => !input.shoppingRouteIds.includes(s.routeId));
    if (dropped.length) {
      await tx.update(tripShopping).set({ status: 'DROPPED', dropReason: 'Diubah sebelum berangkat', droppedByAccountId: actor.accountId, droppedAt: now })
        .where(inArray(tripShopping.id, dropped.map((s) => s.id)));
    }
    const have = new Set(openShopping.map((s) => s.routeId));
    const newShopping = input.shoppingRouteIds.filter((routeId) => !have.has(routeId));
    if (newShopping.length) await tx.insert(tripShopping).values(newShopping.map((routeId) => ({ tripId: id, routeId, addedByAccountId: actor.accountId })));
    const stillOn = new Set(wanted.map((w) => w.employeeId));
    await tellRemoved(tx, id, [...new Set(removed.map((c) => c.employeeId))].filter((e) => !stillOn.has(e)), 'Trip diubah sebelum berangkat.', actor.accountId);
    await tellAssigned(tx, id, added.map((a) => ({ employeeId: a.employeeId, role: a.role })), actor.accountId);
    return { ok: true as const, data: undefined };
  });
}

/** Batalkan trip selagi Draft, wajib alasan (LOG-23). */
export async function cancelTrip(actor: Actor | null, id: number, reason: string): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.trip.manage')) return fail(403, FORBIDDEN);
  const reasonError = reasonProblem(reason);
  if (reasonError) return fail(400, reasonError);
  return db.transaction(async (tx) => {
    const loaded = await loadTrip(id, tx);
    if (!loaded) return fail(404, NOT_FOUND);
    if (loaded.trip.status !== 'DRAFT') return fail(409, 'Hanya trip Draft yang bisa dibatalkan. Trip yang sudah berangkat ditutup atas nama driver.');
    await tx.update(trips).set({ status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason.trim(), cancelledByAccountId: actor.accountId })
      .where(eq(trips.id, id));
    await tellRemoved(tx, id, loaded.activeCrew.map((c) => c.employeeId), `Trip dibatalkan: ${reason.trim()}`, actor.accountId);
    return { ok: true as const, data: undefined };
  });
}

/** Tambah awak ke trip Berjalan (LOG-22, KEH-121): absen masuk = jam ditambahkan, tanda "ditambahkan kantor". */
export async function addCrew(actor: Actor | null, id: number, employeeId: number, role: CrewRole): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.trip.manage')) return fail(403, FORBIDDEN);
  const people = await activePeople(wibDate(new Date()));
  const person = people.find((p) => p.id === employeeId);
  if (!person) return fail(400, 'Orang ini tidak aktif.');
  if (role === 'DRIVER' && !person.duty.drive) return fail(400, `${person.name} tidak punya izin menyetir.`);
  if (role === 'ASSISTANT' && !person.duty.assist) return fail(400, `${person.name} tidak punya izin jadi kenek.`);
  return db.transaction(async (tx) => {
    await lockCrew(tx);
    const loaded = await loadTrip(id, tx);
    if (!loaded) return fail(404, NOT_FOUND);
    if (loaded.trip.status !== 'RUNNING') return fail(409, 'Awak trip Draft diubah lewat Ubah trip; trip yang Selesai sudah terkunci.');
    if (loaded.activeCrew.some((c) => c.employeeId === employeeId)) return fail(409, `${person.name} sudah ada di trip ini.`);
    if (role === 'DRIVER' && loaded.activeCrew.some((c) => c.role === 'DRIVER')) return fail(409, 'Trip ini sudah punya driver. Copot driver lama dulu.');
    const busy = await runningTripsOf([employeeId], id, tx);
    if (busy.length) return fail(409, `${person.name} masih di trip ${busy[0].number} yang sedang berjalan.`);
    await tx.insert(tripCrew).values({ tripId: id, employeeId, role, addedAt: new Date(), addedByAccountId: actor.accountId, addedAfterDeparture: true });
    await tellAssigned(tx, id, [{ employeeId, role }], actor.accountId);
    return { ok: true as const, data: undefined };
  });
}

/** Copot awak dari trip Berjalan (LOG-101): tanpa ritase otomatis; jam masuknya tetap tampil bertanda dicopot. */
export async function removeCrew(actor: Actor | null, id: number, crewId: number, reason: string): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.trip.manage')) return fail(403, FORBIDDEN);
  const reasonError = reasonProblem(reason);
  if (reasonError) return fail(400, reasonError);
  return db.transaction(async (tx) => {
    await lockCrew(tx);
    const loaded = await loadTrip(id, tx);
    if (!loaded) return fail(404, NOT_FOUND);
    if (loaded.trip.status !== 'RUNNING') return fail(409, 'Awak hanya dicopot dari trip yang sedang berjalan.');
    const row = loaded.activeCrew.find((c) => c.id === crewId);
    if (!row) return fail(404, 'Awak tidak ditemukan.');
    await tx.update(tripCrew).set({ removedAt: new Date(), removedByAccountId: actor.accountId, removeReason: reason.trim() }).where(eq(tripCrew.id, crewId));
    await tellRemoved(tx, id, [row.employeeId], reason.trim(), actor.accountId);
    return { ok: true as const, data: undefined };
  });
}

/** Tambah supplier belanja ke trip Berjalan (LOG-103). */
export async function addShopping(actor: Actor | null, id: number, routeId: number): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.trip.manage')) return fail(403, FORBIDDEN);
  const [route] = await db.select().from(routes).where(eq(routes.id, routeId)).limit(1);
  if (!route || !route.active || route.kind !== 'SHOPPING') return fail(400, 'Pilih supplier belanja yang aktif.');
  return db.transaction(async (tx) => {
    const loaded = await loadTrip(id, tx);
    if (!loaded) return fail(404, NOT_FOUND);
    if (loaded.trip.status !== 'RUNNING') return fail(409, 'Supplier trip Draft diubah lewat Ubah trip; trip yang Selesai sudah terkunci.');
    const unrated = await rateProblem(loaded.trip.vehicleId, [routeId], loaded.trip.tripDate!, tx);
    if (unrated) return fail(409, unrated);
    try {
      await tx.insert(tripShopping).values({ tripId: id, routeId, addedByAccountId: actor.accountId });
    } catch (error) {
      if (isUniqueViolation(error, 'trip_shopping_route_unique')) return fail(409, `${route.name} sudah ada di trip ini.`);
      throw error;
    }
    return { ok: true as const, data: undefined };
  });
}

/** Lepas supplier yang tidak jadi dibelanjai, wajib alasan (spec L6 §3.4). Yang sudah Selesai terkunci. */
export async function dropShopping(actor: Actor | null, id: number, shoppingId: number, reason: string): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.trip.manage')) return fail(403, FORBIDDEN);
  const reasonError = reasonProblem(reason);
  if (reasonError) return fail(400, reasonError);
  const [row] = await db.update(tripShopping)
    .set({ status: 'DROPPED', dropReason: reason.trim(), droppedByAccountId: actor.accountId, droppedAt: new Date() })
    .where(and(eq(tripShopping.id, shoppingId), eq(tripShopping.tripId, id), eq(tripShopping.status, 'OPEN'),
      sql`exists (select 1 from logistics.trips t where t.id = ${id} and t.status = 'RUNNING')`))
    .returning({ id: tripShopping.id });
  return row ? { ok: true, data: undefined } : fail(409, 'Supplier ini sudah selesai, sudah dilepas, atau trip-nya tidak sedang berjalan.');
}

/** Rute kirim + supplier yang masih akan dibelanjai. */
function tripRouteIds(loaded: LoadedTrip): number[] {
  return [...(loaded.trip.routeId ? [loaded.trip.routeId] : []), ...loaded.shopping.filter((s) => s.status === 'OPEN').map((s) => s.routeId)];
}

function crewMember(loaded: LoadedTrip, actor: Actor) {
  return loaded.activeCrew.find((c) => c.employeeId === actor.personId) ?? null;
}

/**
 * Berangkat (LOG-25, KEH-96, 97, 122, 124): driver atau kenek trip ini, satu foto awak dari kamera. Satu tekanan = absen
 * masuk seluruh awak pada jam server ini; tanggal trip = tanggal WIB saat ini. Lokasi dicatat, tidak diperiksa.
 */
export async function departTrip(actor: Actor | null, id: number, photo: File | null, point: Point | null): Promise<ServiceResult<{ at: string }>> {
  if (!actor) return fail(403, FORBIDDEN);
  const before = await loadTrip(id);
  if (!before) return fail(404, NOT_FOUND);
  if (!crewMember(before, actor)) return fail(403, 'Hanya awak trip ini yang bisa menekan Berangkat.');
  if (before.trip.status !== 'DRAFT') return fail(409, before.trip.status === 'RUNNING' ? 'Trip ini sudah berangkat.' : 'Trip ini sudah ditutup.');
  // Syarat bertarif (spec L7 §3.4, LOG-21): pasangan trip dan tiap supplier pada hari ini, sebelum foto diunggah.
  const unrated = await rateProblem(before.trip.vehicleId, tripRouteIds(before), wibDate(new Date()));
  if (unrated) return fail(409, unrated);
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  const where = cleanPoint(point);
  return db.transaction(async (tx) => {
    await lockCrew(tx);
    const loaded = await loadTrip(id, tx);
    if (!loaded || loaded.trip.status !== 'DRAFT') return fail(409, 'Trip ini sudah berangkat atau ditutup.');
    if (!loaded.activeCrew.some((c) => c.role === 'DRIVER')) return fail(409, 'Trip ini belum punya driver. Hubungi Kepala Gudang.');
    const busy = await runningTripsOf(loaded.activeCrew.map((c) => c.employeeId), id, tx);
    if (busy.length) {
      const names = await peopleNames();
      return fail(409, `${names.get(busy[0].employeeId) ?? 'Salah satu awak'} masih di trip ${busy[0].number} yang belum Sampai Garasi.`);
    }
    const [running] = await tx.select({ number: trips.number }).from(trips)
      .where(and(eq(trips.vehicleId, loaded.trip.vehicleId), eq(trips.status, 'RUNNING'))).limit(1);
    if (running) return fail(409, `Mobil ini masih di trip ${running.number} yang belum Sampai Garasi.`);
    const now = new Date();
    await tx.update(trips).set({
      status: 'RUNNING', tripDate: wibDate(now), departedAt: now, departedByEmployeeId: actor.personId, crewPhotoFileId: upload.data.id,
      departLatitude: where?.latitude ?? null, departLongitude: where?.longitude ?? null, departAccuracyM: where?.accuracy ?? null, updatedAt: now,
    }).where(eq(trips.id, id));
    return { ok: true as const, data: { at: wibClock(now) } };
  });
}

/** Belanja selesai + foto nota supplier (LOG-100; spec L6 §9 butir 7). */
export async function finishShopping(actor: Actor | null, id: number, shoppingId: number, photo: File | null): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  const loaded = await loadTrip(id);
  if (!loaded) return fail(404, NOT_FOUND);
  if (!crewMember(loaded, actor)) return fail(403, 'Hanya awak trip ini yang bisa menandai belanja.');
  if (loaded.trip.status !== 'RUNNING') return fail(409, 'Belanja ditandai selama trip berjalan.');
  const task = loaded.shopping.find((s) => s.id === shoppingId);
  if (!task || task.status !== 'OPEN') return fail(409, 'Belanja ini sudah selesai atau sudah dilepas.');
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  const [row] = await db.update(tripShopping)
    .set({ status: 'DONE', receiptPhotoFileId: upload.data.id, doneAt: new Date(), doneByEmployeeId: actor.personId })
    .where(and(eq(tripShopping.id, shoppingId), eq(tripShopping.status, 'OPEN'))).returning({ id: tripShopping.id });
  return row ? { ok: true, data: undefined } : fail(409, 'Belanja ini sudah selesai atau sudah dilepas.');
}

/**
 * Menutup trip (Sampai Garasi atau kantor): supplier yang masih Open gugur (spec L6 §9 butir 3), lalu ritase dan belanja
 * dicatat sekali untuk awak yang masih tercatat (LOG-33 s.d. 35, 101). Dipanggil di dalam transaksi pemanggil.
 */
async function finishTrip(tx: Tx, loaded: LoadedTrip, now: Date, patch: Partial<typeof trips.$inferInsert>) {
  await tx.update(tripShopping).set({ status: 'DROPPED', dropReason: AUTO_DROP, droppedAt: now })
    .where(and(eq(tripShopping.tripId, loaded.trip.id), eq(tripShopping.status, 'OPEN')));
  const [updated] = await tx.update(trips).set({ ...patch, status: 'DONE', finishedAt: now, updatedAt: now })
    .where(and(eq(trips.id, loaded.trip.id), eq(trips.status, 'RUNNING'))).returning({ id: trips.id });
  if (!updated) return false;
  const drafts = wagesFor({
    routeId: loaded.trip.routeId,
    crew: loaded.activeCrew.map((c) => ({ employeeId: c.employeeId, role: c.role as CrewRole })),
    shoppingDone: loaded.shopping.filter((s) => s.status === 'DONE').map((s) => ({ id: s.id, routeId: s.routeId })),
  });
  if (drafts.length) {
    await tx.insert(tripWages).values(drafts.map((w) => ({
      ...w, tripId: loaded.trip.id, tripDate: loaded.trip.tripDate!, vehicleId: loaded.trip.vehicleId, origin: 'AUTO' as const,
    })));
  }
  return true;
}

/** Sampai Garasi (LOG-29, 103; KEH-98): driver atau kenek (spec L6 §9 butir 2), di titik garasi; trip langsung Selesai. */
export async function arriveTrip(actor: Actor | null, id: number, point: Point | null): Promise<ServiceResult<{ at: string; distanceM: number | null }>> {
  if (!actor) return fail(403, FORBIDDEN);
  const now = new Date();
  const where = cleanPoint(point);
  const [garage, fence] = await Promise.all([garagePoint(wibDate(now)), activeFence(now)]);
  const check = garageCheck({ point: where, garage, fenceOff: !!fence });
  if (!check.ok) return fail(400, check.error);
  return db.transaction(async (tx) => {
    const loaded = await loadTrip(id, tx);
    if (!loaded) return fail(404, NOT_FOUND);
    if (!crewMember(loaded, actor)) return fail(403, 'Hanya awak trip ini yang bisa menekan Sampai Garasi.');
    if (loaded.trip.status !== 'RUNNING') return fail(409, loaded.trip.status === 'DRAFT' ? 'Trip ini belum berangkat.' : 'Trip ini sudah ditutup.');
    const done = await finishTrip(tx, loaded, now, {
      arrivedByEmployeeId: actor.personId, arriveLatitude: where?.latitude ?? null, arriveLongitude: where?.longitude ?? null,
      arriveAccuracyM: where?.accuracy ?? null, arriveDistanceM: check.distanceM, fenceOff: check.fenceOff,
    });
    if (!done) return fail(409, 'Trip ini sudah ditutup.');
    return { ok: true as const, data: { at: wibClock(now), distanceM: check.distanceM } };
  });
}

/** Tutup atas nama driver (LOG-30, 103; KEH-101): alasan + foto wajib, bukan trip yang ia awaki sendiri. */
export async function closeByOffice(actor: Actor | null, id: number, reason: string, photo: File | null): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.trip.manage')) return fail(403, FORBIDDEN);
  const reasonError = reasonProblem(reason);
  if (reasonError) return fail(400, reasonError);
  const before = await loadTrip(id);
  if (!before) return fail(404, NOT_FOUND);
  if (before.trip.status !== 'RUNNING') return fail(409, 'Hanya trip yang sedang berjalan yang bisa ditutup.');
  if (crewMember(before, actor)) return fail(403, 'Trip yang Anda awaki sendiri tidak bisa Anda tutup. Minta Kepala Gudang lain, Pemilik, atau GM.');
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  return db.transaction(async (tx) => {
    const loaded = await loadTrip(id, tx);
    if (!loaded) return fail(404, NOT_FOUND);
    const now = new Date();
    const done = await finishTrip(tx, loaded, now, {
      officeClosedByAccountId: actor.accountId, officeCloseReason: reason.trim(), officeClosePhotoFileId: upload.data.id,
    });
    if (!done) return fail(409, 'Trip ini sudah ditutup.');
    await notify(tx, await accountsOf(loaded.activeCrew.map((c) => c.employeeId)), {
      kind: 'logistics.office_closed', title: `Trip ${await tripLabel(id, tx)} ditutup kantor pukul ${wibClock(now)}`, body: reason.trim(),
      link: '/trip-saya', entity: 'trip', entityId: id,
    }, actor.accountId);
    return { ok: true as const, data: undefined };
  });
}

/** Batalkan ritase / belanja (DRV-15): Pemilik atau GM, wajib alasan; tidak dihapus. */
export async function cancelWage(actor: Actor | null, wageId: number, reason: string): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.wage.manage')) return fail(403, FORBIDDEN);
  const reasonError = reasonProblem(reason);
  if (reasonError) return fail(400, reasonError);
  return db.transaction(async (tx) => {
    const [row] = await tx.update(tripWages).set({ cancelledAt: new Date(), cancelledByAccountId: actor.accountId, cancelReason: reason.trim() })
      .where(and(eq(tripWages.id, wageId), isNull(tripWages.cancelledAt))).returning();
    if (!row) return fail(409, 'Ritase ini tidak ditemukan atau sudah dibatalkan.');
    const [route] = await tx.select({ name: routes.name }).from(routes).where(eq(routes.id, row.routeId)).limit(1);
    await notify(tx, await accountsOf([row.employeeId]), {
      kind: 'logistics.wage_cancelled', title: `${row.kind === 'RITASE' ? 'Ritase' : 'Upah belanja'} ${route?.name ?? ''} tanggal ${row.tripDate} dibatalkan`,
      body: reason.trim(), link: '/trip-saya', entity: 'trip_wage', entityId: row.id,
    }, actor.accountId);
    return { ok: true as const, data: undefined };
  });
}

export type ManualWageInput = {
  employeeId: number; tripDate: string; vehicleId: number; routeId: number; role: CrewRole; withAssistant: boolean; reason: string; confirmTwice: boolean;
};

/**
 * Ritase tangan (LOG-102; spec L6 §9 butir 5): Pemilik/GM, alasan wajib, paling jauh N hari ke belakang. Jenis mengikuti
 * jenis rute (kirim = ritase, belanja = upah belanja). Bila orang itu sudah punya yang sama di tanggal, mobil, dan rute itu,
 * butuh konfirmasi kedua "Memang dua kali jalan".
 */
export async function addManualWage(actor: Actor | null, input: ManualWageInput): Promise<ServiceResult<{ id: number }>> {
  if (!actor || !can(actor, 'logistics.wage.manage')) return fail(403, FORBIDDEN);
  const today = wibDate(new Date());
  const reasonError = reasonProblem(input.reason);
  if (reasonError) return fail(400, reasonError);
  const days = await settingOn<number>('logistics.manual_wage_days', today);
  const dateError = manualDateProblem(input.tripDate, today, days);
  if (dateError) return fail(400, dateError);
  const [[vehicle], [route]] = await Promise.all([
    db.select().from(vehicles).where(eq(vehicles.id, input.vehicleId)).limit(1),
    db.select().from(routes).where(eq(routes.id, input.routeId)).limit(1),
  ]);
  if (!vehicle) return fail(400, 'Pilih mobil.');
  if (!route) return fail(400, 'Pilih rute.');
  const unrated = await rateProblem(input.vehicleId, [input.routeId], input.tripDate);
  if (unrated) return fail(409, unrated);
  const names = await peopleNames();
  if (!names.has(input.employeeId)) return fail(400, 'Pilih karyawan.');
  return db.transaction(async (tx) => {
    const same = await tx.select({ id: tripWages.id }).from(tripWages).where(and(
      eq(tripWages.employeeId, input.employeeId), eq(tripWages.tripDate, input.tripDate), eq(tripWages.vehicleId, input.vehicleId),
      eq(tripWages.routeId, input.routeId), isNull(tripWages.cancelledAt),
    ));
    if (same.length && !input.confirmTwice) {
      return fail(409, `${names.get(input.employeeId)} sudah punya ${same.length} catatan ${route.name} dengan ${vehicle.name} di tanggal ${input.tripDate}. Centang "Memang dua kali jalan" bila memang benar.`);
    }
    const [row] = await tx.insert(tripWages).values({
      employeeId: input.employeeId, role: input.role, kind: route.kind === 'SHOPPING' ? 'SHOPPING' : 'RITASE', tripDate: input.tripDate,
      vehicleId: input.vehicleId, routeId: input.routeId, withAssistant: input.withAssistant, origin: 'MANUAL', manualReason: input.reason.trim(),
      confirmedTwice: same.length > 0, createdByAccountId: actor.accountId,
    }).returning({ id: tripWages.id });
    await notify(tx, await accountsOf([input.employeeId]), {
      kind: 'logistics.wage_manual', title: `Ritase tangan dicatat: ${route.name} tanggal ${input.tripDate}`, body: input.reason.trim(),
      link: '/trip-saya', entity: 'trip_wage', entityId: row.id,
    }, actor.accountId);
    return { ok: true as const, data: { id: row.id } };
  });
}

/** Mesin harian (LOG-31): trip Berjalan yang lewat batas diberitahukan sekali ke Kepala Gudang + Pemilik/GM. */
export async function notifyHanging(now: Date, hour: number) {
  const running = await db.select({ id: trips.id, tripDate: trips.tripDate }).from(trips)
    .where(and(eq(trips.status, 'RUNNING'), isNull(trips.hangingNotifiedAt)));
  const due = running.filter((t) => isHanging(t.tripDate, now, hour));
  if (!due.length) return 0;
  const recipients = await managerAccounts();
  for (const trip of due) {
    await db.transaction(async (tx) => {
      const [marked] = await tx.update(trips).set({ hangingNotifiedAt: now })
        .where(and(eq(trips.id, trip.id), isNull(trips.hangingNotifiedAt))).returning({ id: trips.id });
      if (!marked) return;
      await notify(tx, recipients, {
        kind: 'logistics.hanging', title: `Trip ${await tripLabel(trip.id, tx)} belum Sampai Garasi sejak ${trip.tripDate}`,
        body: 'Tutup atas nama driver bila HP atau GPS-nya bermasalah.', link: `/logistik/trip/${trip.id}`, entity: 'trip', entityId: trip.id,
      }, null);
    });
  }
  return due.length;
}
