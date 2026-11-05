import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { photoPurges, photoViews, tripCrew, trips, tripWages } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, getOrgLookup, type Actor } from '@/modules/access';
import { settingOn } from '@/modules/settings';
import {
  ROLE_LABELS, ROUTE_KIND_LABELS, WAGE_KIND_LABELS, addDays, isHanging, wibClock, wibDate,
  type CrewRole, type IsoDate, type RouteKind, type TripStatus, type WageKind,
} from '../rules/trip';
import { activeFence, activePeople, garageBranchId, garagePoint, loadFleet, loadTrip, peopleNames } from './data';
import { nextWeek, prevWeek, weekOf } from '../rules/week';
import { loadWeekRegimes, wageWeekOf } from './week';
import { draftNoteKeys, liveNotesFor, pickupPhotoIds, tripNotesView, waitingNotes, type LiveNote } from './trip-notes';
import { ageDays } from '../rules/delivery-notes';
import type { NoteKey } from '../rules/trip-notes';
import { PHASE_LABELS, PHASE_TONES, tripPhase, type TripPhase } from '../rules/driver-trip';
import { endReportOf, endReportPhotoIds, pendingEndReports } from './driver-trip';
import { paymentProofIds } from './store-payments';
import { returnedGoodsPhotoIds } from './returned-goods';

export type NoteOption = {
  key: NoteKey; kind: 'SALE' | 'TRANSFER'; number: string; on: string; age: number; origin: string; originId: number; destination: string;
  routeId: number | null; route: string | null; amount: number | null;
};

const clock = (at: Date | null) => (at ? wibClock(at) : null);

export type TripCard = {
  id: number; number: string; status: TripStatus; statusLabel: string; tone: 'info' | 'ok' | 'warn' | 'danger';
  /** Tahap di layar (spec LT1 §13.3): Siap Kirim dan Menuju Garasi di atas DRAFT/RUNNING. */
  phase: TripPhase; readyAt: string | null; headingHomeAt: string | null; earlyFinish: string | null;
  vehicle: string; route: string | null; shopping: { id: number; name: string; status: string }[];
  crew: { id: number; employeeId: number; name: string; role: CrewRole; roleLabel: string; addedAfter: boolean; removed: boolean; inAt: string | null }[];
  tripDate: string | null; departedAt: string | null; finishedAt: string | null; officeClosed: boolean; hanging: boolean; createdOn: string;
};

/** Kartu trip untuk daftar, Trip Saya, dan Absen Trip. */
async function cards(rows: (typeof trips.$inferSelect)[], now: Date): Promise<TripCard[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [fleet, names, crew, shopping, hour] = await Promise.all([
    loadFleet(), peopleNames(),
    db.select().from(tripCrew).where(inArray(tripCrew.tripId, ids)),
    db.execute<{ id: number; trip_id: number; route_id: number; status: string }>(sql`
      select id, trip_id, route_id, status from logistics.trip_shopping where trip_id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)}) order by id`),
    settingOn<number>('logistics.hanging_hour', wibDate(now)),
  ]);
  const vehicleName = new Map(fleet.vehicles.map((v) => [v.id, `${v.name} (${v.plate})`]));
  const routeName = new Map(fleet.routes.map((r) => [r.id, r.name]));
  return rows.map((t) => {
    const phase = tripPhase(t.status as TripStatus, t.readyAt, t.headingHomeAt);
    return {
    id: t.id, number: t.number, status: t.status as TripStatus, statusLabel: PHASE_LABELS[phase], tone: PHASE_TONES[phase],
    phase, readyAt: clock(t.readyAt), headingHomeAt: clock(t.headingHomeAt), earlyFinish: t.earlyFinishReason,
    vehicle: vehicleName.get(t.vehicleId) ?? '-', route: t.routeId ? routeName.get(t.routeId) ?? '-' : null,
    shopping: shopping.filter((s) => Number(s.trip_id) === t.id && s.status !== 'DROPPED')
      .map((s) => ({ id: Number(s.id), name: routeName.get(Number(s.route_id)) ?? '-', status: s.status })),
    crew: crew.filter((c) => c.tripId === t.id && !(c.removedAt && (!t.departedAt || c.removedAt <= t.departedAt)))
      .sort((a, b) => (a.role === b.role ? a.id - b.id : a.role === 'DRIVER' ? -1 : 1))
      .map((c) => ({
        id: c.id, employeeId: c.employeeId, name: names.get(c.employeeId) ?? `#${c.employeeId}`, role: c.role as CrewRole,
        roleLabel: ROLE_LABELS[c.role as CrewRole], addedAfter: c.addedAfterDeparture, removed: !!c.removedAt,
        inAt: t.departedAt ? clock(c.addedAfterDeparture ? c.addedAt : t.departedAt) : null,
      })),
    tripDate: t.tripDate, departedAt: clock(t.departedAt), finishedAt: clock(t.finishedAt), officeClosed: !!t.officeClosedByAccountId,
    hanging: t.status === 'RUNNING' && isHanging(t.tripDate, now, hour), createdOn: wibDate(t.createdAt),
    };
  });
}

export type TripTab = 'today' | 'hanging' | 'history';

/** Layar Trip (spec L6 §4): Hari ini (Draft + Berjalan + Selesai/batal hari ini), Menggantung, Riwayat per tanggal. */
export async function tripsScreen(actor: Actor | null, tab: TripTab, date: IsoDate | null) {
  if (!actor || !can(actor, 'logistics.trip.view')) return null;
  const now = new Date();
  const today = wibDate(now);
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
  const where = tab === 'history'
    ? or(eq(trips.tripDate, day), and(isNull(trips.tripDate), sql`(${trips.createdAt} at time zone 'Asia/Jakarta')::date = ${day}::date`))
    : tab === 'hanging'
      ? eq(trips.status, 'RUNNING')
      : or(inArray(trips.status, ['DRAFT', 'RUNNING']), eq(trips.tripDate, today), sql`(${trips.cancelledAt} at time zone 'Asia/Jakarta')::date = ${today}::date`);
  const rows = await db.select().from(trips).where(where).orderBy(desc(trips.id)).limit(200);
  let list = await cards(rows, now);
  if (tab === 'hanging') list = list.filter((c) => c.hanging);
  const fence = await activeFence(now);
  return {
    tab, date: day, today, trips: list, canManage: can(actor, 'logistics.trip.manage'),
    fence: fence ? { until: wibClock(fence.untilAt), reason: fence.reason } : null,
  };
}

/** Pilihan untuk Buat / Ubah trip. */
export async function tripFormScreen(actor: Actor | null, id: number | null) {
  if (!actor || !can(actor, 'logistics.trip.manage')) return null;
  const today = wibDate(new Date());
  const [fleet, people] = await Promise.all([loadFleet(), activePeople(today)]);
  let initial = null as null | {
    vehicleId: number; routeId: number | null; shoppingRouteIds: number[]; driverId: number | null; assistantIds: number[]; noteKeys: NoteKey[];
  };
  if (id) {
    const loaded = await loadTrip(id);
    if (!loaded || loaded.trip.status !== 'DRAFT') return { notEditable: true as const };
    initial = {
      vehicleId: loaded.trip.vehicleId, routeId: loaded.trip.routeId,
      shoppingRouteIds: loaded.shopping.filter((s) => s.status !== 'DROPPED').map((s) => s.routeId),
      driverId: loaded.activeCrew.find((c) => c.role === 'DRIVER')?.employeeId ?? null,
      assistantIds: loaded.activeCrew.filter((c) => c.role === 'ASSISTANT').map((c) => c.employeeId),
      noteKeys: await draftNoteKeys(id),
    };
  }
  const [waiting, attached] = await Promise.all([waitingNotes(), liveNotesFor(initial?.noteKeys ?? [])]);
  const routeName = new Map(fleet.routes.map((r) => [r.id, r.name]));
  const option = (n: LiveNote): NoteOption => ({
    key: n.key, kind: n.kind, number: n.number, on: n.on, age: ageDays(n.on, today), origin: n.origin, originId: n.originBranchId, destination: n.destination,
    routeId: n.routeId, route: n.routeId ? routeName.get(n.routeId) ?? null : null, amount: n.amount,
  });
  const notes = [...attached.values(), ...waiting.filter((w) => !attached.has(w.key))].map(option);
  return {
    notEditable: false as const, id, initial, notes, notesTruncated: waiting.length >= 300,
    vehicles: fleet.vehicles.filter((v) => v.active || v.id === initial?.vehicleId).map((v) => ({ id: v.id, name: `${v.name} (${v.plate})` })),
    deliveryRoutes: fleet.routes.filter((r) => r.kind === 'DELIVERY' && (r.active || r.id === initial?.routeId)).map((r) => ({ id: r.id, name: r.name })),
    shoppingRoutes: fleet.routes.filter((r) => r.kind === 'SHOPPING' && (r.active || initial?.shoppingRouteIds.includes(r.id))).map((r) => ({ id: r.id, name: r.name })),
    drivers: people.filter((p) => p.duty.drive).map((p) => ({ id: p.id, name: p.name, detail: `${p.positionName} · ${p.branchName}` })),
    assistants: people.filter((p) => p.duty.assist).map((p) => ({ id: p.id, name: p.name, detail: `${p.positionName} · ${p.branchName}` })),
  };
}

/** Rincian trip (spec L6 §4). Awak trip itu juga boleh membuka (lewat Trip Saya). */
export async function tripDetailScreen(actor: Actor | null, id: number) {
  if (!actor) return null;
  const loaded = await loadTrip(id);
  if (!loaded) return null;
  const isCrew = loaded.crew.some((c) => c.employeeId === actor.personId);
  if (!can(actor, 'logistics.trip.view') && !isCrew) return null;
  const now = new Date();
  const [[card], fleet, names, people] = await Promise.all([cards([loaded.trip], now), loadFleet(), peopleNames(), activePeople(wibDate(now))]);
  const routeName = new Map(fleet.routes.map((r) => [r.id, r.name]));
  const t = loaded.trip;
  const canManage = can(actor, 'logistics.trip.manage');
  const [delivery, endReport] = await Promise.all([tripNotesView(id), endReportOf(id)]);
  const photo = (file: string | null) => (file ? `/api/logistics/photo?trip=${t.id}&file=${file}` : null);
  return {
    card, delivery, endReport,
    emptyBedPhotoUrl: photo(t.emptyBedPhotoFileId), fuelGaugePhotoUrl: photo(t.fuelGaugePhotoFileId),
    allCrew: loaded.crew.map((c) => ({
      id: c.id, name: names.get(c.employeeId) ?? `#${c.employeeId}`, roleLabel: ROLE_LABELS[c.role as CrewRole], removed: !!c.removedAt,
      removeReason: c.removeReason, addedAfter: c.addedAfterDeparture, addedAt: wibClock(c.addedAt), removedAt: clock(c.removedAt),
    })),
    shopping: loaded.shopping.map((s) => ({
      id: s.id, name: routeName.get(s.routeId) ?? '-', status: s.status, doneAt: clock(s.doneAt), dropReason: s.dropReason,
      receiptUrl: s.receiptPhotoFileId ? `/api/logistics/photo?trip=${t.id}&file=${s.receiptPhotoFileId}` : null,
    })),
    crewPhotoUrl: t.crewPhotoFileId ? `/api/logistics/photo?trip=${t.id}&file=${t.crewPhotoFileId}` : null,
    officeClose: t.officeClosedByAccountId ? {
      reason: t.officeCloseReason, photoUrl: t.officeClosePhotoFileId ? `/api/logistics/photo?trip=${t.id}&file=${t.officeClosePhotoFileId}` : null,
    } : null,
    arrive: t.arrivedByEmployeeId ? {
      by: names.get(t.arrivedByEmployeeId) ?? '-', distanceM: t.arriveDistanceM, fenceOff: t.fenceOff,
    } : null,
    departedBy: t.departedByEmployeeId ? names.get(t.departedByEmployeeId) ?? '-' : null,
    cancel: t.cancelReason ? { reason: t.cancelReason } : null,
    wages: loaded.wages.map((w) => ({
      id: w.id, name: names.get(w.employeeId) ?? '-', roleLabel: ROLE_LABELS[w.role as CrewRole], kindLabel: WAGE_KIND_LABELS[w.kind as WageKind],
      route: routeName.get(w.routeId) ?? '-', withAssistant: w.withAssistant, cancelled: !!w.cancelledAt, cancelReason: w.cancelReason,
    })),
    canManage, canCancelWage: can(actor, 'logistics.wage.manage'), isCrew,
    canClose: canManage && !loaded.activeCrew.some((c) => c.employeeId === actor.personId),
    addOptions: canManage && t.status === 'RUNNING' ? {
      drivers: people.filter((p) => p.duty.drive && !loaded.activeCrew.some((c) => c.employeeId === p.id)).map((p) => ({ id: p.id, name: p.name })),
      assistants: people.filter((p) => p.duty.assist && !loaded.activeCrew.some((c) => c.employeeId === p.id)).map((p) => ({ id: p.id, name: p.name })),
      suppliers: fleet.routes.filter((r) => r.kind === 'SHOPPING' && r.active && !loaded.shopping.some((s) => s.routeId === r.id && s.status !== 'DROPPED'))
        .map((r) => ({ id: r.id, name: r.name })),
    } : null,
  };
}

/** Trip Saya (KEH-L18 + layar HP trip): trip yang menugaskan dirinya, hari ini. */
export async function myTripsScreen(actor: Actor | null) {
  if (!actor) return null;
  const now = new Date();
  const today = wibDate(now);
  const mine = await db.select({ tripId: tripCrew.tripId }).from(tripCrew)
    .where(and(eq(tripCrew.employeeId, actor.personId), isNull(tripCrew.removedAt)));
  const ids = [...new Set(mine.map((m) => m.tripId))];
  // Driver dan kenek hanya melihat trip Siap Kirim, Berjalan, dan yang selesai hari ini (spec LT1 §13.3 butir 1).
  const rows = ids.length ? await db.select().from(trips).where(and(inArray(trips.id, ids), or(
    and(eq(trips.status, 'DRAFT'), sql`${trips.readyAt} is not null`), eq(trips.status, 'RUNNING'), eq(trips.tripDate, today),
  ))).orderBy(trips.id) : [];
  const list = await cards(rows, now);
  const delivery = new Map(await Promise.all(list.filter((c) => c.status !== 'CANCELLED').map(async (c) => [c.id, await tripNotesView(c.id)] as const)));
  const doneToday = list.filter((c) => c.status === 'DONE' && c.tripDate === today);
  const running = list.find((c) => c.status === 'RUNNING');
  const firstIn = list.filter((c) => c.tripDate === today).map((c) => c.crew.find((m) => m.employeeId === actor.personId)?.inAt).filter(Boolean).sort()[0] ?? null;
  const mates = (c: TripCard) => c.crew.filter((m) => m.employeeId !== actor.personId && !m.removed).map((m) => m.name).join(' dan ');
  const headline = running
    ? `Berangkat ${firstIn ?? running.departedAt}${mates(running) ? ` bersama ${mates(running)}` : ''} (${running.number})`
    : doneToday.length
      ? `Pulang tercatat ${doneToday[doneToday.length - 1].finishedAt} (${doneToday[doneToday.length - 1].number})`
      : 'Belum berangkat';
  const week = await wageWeekOf(today);
  const wageRows = await db.select({ id: tripWages.id, kind: tripWages.kind, routeId: tripWages.routeId, cancelled: tripWages.cancelledAt })
    .from(tripWages).where(and(eq(tripWages.employeeId, actor.personId), gte(tripWages.tripDate, week.start), lte(tripWages.tripDate, today)));
  return {
    today, headline, trips: list.filter((c) => c.status !== 'CANCELLED'), delivery: Object.fromEntries(delivery), pendingReports: await pendingEndReports(actor), myId: actor.personId,
    weekCount: { ritase: wageRows.filter((w) => w.kind === 'RITASE' && !w.cancelled).length, shopping: wageRows.filter((w) => w.kind === 'SHOPPING' && !w.cancelled).length },
    weekStart: week.start,
    pointAccuracyM: Number(await settingOn<number>('logistics.point_accuracy_m', today)),
  };
}

/** Menu Trip Saya: orang ber-cara absen Lewat trip, atau yang sedang ditugaskan di trip Draft/Berjalan. */
export async function myTripMenuVisible(actor: Actor | null, today: IsoDate): Promise<boolean> {
  if (!actor || actor.positionId == null) return false;
  if (String(await settingOn('position.attendance_mode', today, { positionId: actor.positionId })) === 'TRIP') return true;
  const [row] = await db.select({ id: tripCrew.id }).from(tripCrew).innerJoin(trips, eq(trips.id, tripCrew.tripId))
    .where(and(eq(tripCrew.employeeId, actor.personId), isNull(tripCrew.removedAt), inArray(trips.status, ['DRAFT', 'RUNNING']))).limit(1);
  return !!row;
}

/** Mobil & Rute (spec L6 §4) + titik garasi + pagar uji. */
export async function fleetScreen(actor: Actor | null) {
  if (!actor || !(can(actor, 'logistics.fleet.manage') || can(actor, 'logistics.trip.view'))) return null;
  const now = new Date();
  const [fleet, org, garageId, garage, fence] = await Promise.all([loadFleet(), getOrgLookup(), garageBranchId(), garagePoint(wibDate(now)), activeFence(now)]);
  return {
    vehicles: fleet.vehicles.map((v) => ({ id: v.id, name: v.name, plate: v.plate, active: v.active })),
    routes: fleet.routes.map((r) => ({ id: r.id, name: r.name, kind: r.kind as RouteKind, kindLabel: ROUTE_KIND_LABELS[r.kind as RouteKind], active: r.active })),
    canEdit: can(actor, 'logistics.fleet.manage'), canOwner: can(actor, 'logistics.fence.manage'),
    garage: { branchId: garageId, name: org.branches.find((b) => b.id === garageId)?.name ?? null, hasPoint: !!garage, radiusM: garage?.radiusM ?? null },
    branches: org.branches.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name })),
    fence: fence ? { until: wibClock(fence.untilAt), untilDate: wibDate(fence.untilAt), reason: fence.reason } : null,
  };
}

/** Ritase per minggu upah (DRV-19; hari awal minggu dari pengaturan, bawaan Jumat–Kamis): per orang, ritase + belanja, tanpa nominal. */
export async function wagesScreen(actor: Actor | null, week: IsoDate | null) {
  if (!actor || !can(actor, 'logistics.wage.view')) return null;
  const today = wibDate(new Date());
  const regimes = await loadWeekRegimes();
  const { start, end } = weekOf(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today, regimes);
  const [rows, fleet, names, people, days] = await Promise.all([
    db.select().from(tripWages).where(and(gte(tripWages.tripDate, start), lte(tripWages.tripDate, end))).orderBy(tripWages.tripDate, tripWages.id),
    loadFleet(), peopleNames(), activePeople(today), settingOn<number>('logistics.manual_wage_days', today),
  ]);
  const tripIds = [...new Set(rows.map((r) => r.tripId).filter((id): id is number => id != null))];
  const numbers = tripIds.length ? await db.select({ id: trips.id, number: trips.number }).from(trips).where(inArray(trips.id, tripIds)) : [];
  const numberOf = new Map(numbers.map((n) => [n.id, n.number]));
  const vehicleName = new Map(fleet.vehicles.map((v) => [v.id, v.name]));
  const routeName = new Map(fleet.routes.map((r) => [r.id, r.name]));
  const list = rows.map((w) => ({
    id: w.id, employeeId: w.employeeId, name: names.get(w.employeeId) ?? `#${w.employeeId}`, date: w.tripDate, vehicle: vehicleName.get(w.vehicleId) ?? '-',
    route: routeName.get(w.routeId) ?? '-', roleLabel: ROLE_LABELS[w.role as CrewRole], kind: w.kind as WageKind, kindLabel: WAGE_KIND_LABELS[w.kind as WageKind],
    withAssistant: w.withAssistant, manual: w.origin === 'MANUAL', manualReason: w.manualReason, tripId: w.tripId, tripNumber: w.tripId ? numberOf.get(w.tripId) ?? null : null,
    cancelled: !!w.cancelledAt, cancelReason: w.cancelReason,
  }));
  const perPerson = new Map<number, { name: string; ritase: number; shopping: number }>();
  for (const row of list.filter((r) => !r.cancelled)) {
    const p = perPerson.get(row.employeeId) ?? { name: row.name, ritase: 0, shopping: 0 };
    if (row.kind === 'RITASE') p.ritase += 1; else p.shopping += 1;
    perPerson.set(row.employeeId, p);
  }
  return {
    start, end, prev: prevWeek(start, regimes).start, next: nextWeek(start, regimes).start, today, rows: list,
    people: [...perPerson.values()].sort((a, b) => a.name.localeCompare(b.name)),
    canManage: can(actor, 'logistics.wage.manage'), manualDays: days, earliest: addDays(today, -days),
    options: {
      people: people.filter((p) => p.duty.drive || p.duty.assist).map((p) => ({ id: p.id, name: p.name })),
      vehicles: fleet.vehicles.map((v) => ({ id: v.id, name: `${v.name} (${v.plate})` })),
      routes: fleet.routes.map((r) => ({ id: r.id, name: `${r.name} · ${ROUTE_KIND_LABELS[r.kind as RouteKind]}` })),
    },
  };
}

/** Absen Trip Hari Ini (KEH-L19): trip per tanggal, perlu perhatian, Tidak jalan. */
export async function tripAttendanceScreen(actor: Actor | null, date: IsoDate | null) {
  if (!actor || !can(actor, 'attendance.trip.view')) return null;
  const now = new Date();
  const today = wibDate(now);
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today ? date : today;
  const [rows, running, people] = await Promise.all([
    db.select().from(trips).where(eq(trips.tripDate, day)).orderBy(trips.departedAt),
    db.select().from(trips).where(and(eq(trips.status, 'RUNNING'), sql`${trips.tripDate} < ${day}`)),
    activePeople(day),
  ]);
  const list = await cards(rows, now);
  const attention = [...list.filter((c) => c.status === 'RUNNING'), ...(day === today ? await cards(running, now) : [])];
  const onTrip = new Set(list.flatMap((c) => c.crew.filter((m) => !m.removed).map((m) => m.employeeId)));
  const showPhoto = can(actor, 'attendance.trip.photo') || can(actor, 'logistics.trip.view');
  return {
    date: day, today, prev: addDays(day, -1), next: day < today ? addDays(day, 1) : null,
    trips: list.map((c) => ({
      ...c, photoUrl: showPhoto && rows.find((r) => r.id === c.id)?.crewPhotoFileId ? `/api/logistics/photo?trip=${c.id}&file=${rows.find((r) => r.id === c.id)!.crewPhotoFileId}` : null,
    })),
    attention,
    notRunning: people.filter((p) => p.mode === 'TRIP' && !onTrip.has(p.id)).map((p) => ({ id: p.id, name: p.name, positionName: p.positionName })),
    canOpenTrip: can(actor, 'logistics.trip.view'),
  };
}

/** Kartu Beranda Kepala Gudang / Pemilik / GM: trip menggantung dan pagar uji mati. */
export async function logisticsAttention(actor: Actor | null) {
  if (!actor || !can(actor, 'logistics.trip.view')) return null;
  const now = new Date();
  const running = await db.select().from(trips).where(eq(trips.status, 'RUNNING'));
  const hanging = (await cards(running, now)).filter((c) => c.hanging);
  const fence = can(actor, 'logistics.fence.manage') ? await activeFence(now) : null;
  if (!hanging.length && !fence) return null;
  return { hanging: hanging.map((c) => ({ id: c.id, number: c.number, vehicle: c.vehicle, tripDate: c.tripDate })), fence: fence ? { until: wibClock(fence.untilAt) } : null };
}

/**
 * Foto trip (awak, nota, tutup kantor): untuk awak trip itu, pemegang `logistics.trip.view`, atau `attendance.trip.photo`.
 * Setiap pembukaan dicatat (KEH-20); foto yang sudah dibuang masa simpannya tidak keluar.
 */
export async function openTripPhoto(actor: Actor | null, tripId: number, fileId: string): Promise<string | null> {
  if (!actor) return null;
  const loaded = await loadTrip(tripId);
  if (!loaded) return null;
  const t = loaded.trip;
  const known = [
    t.crewPhotoFileId, t.officeClosePhotoFileId, t.emptyBedPhotoFileId, t.fuelGaugePhotoFileId, ...loaded.shopping.map((s) => s.receiptPhotoFileId),
    ...await pickupPhotoIds(tripId), ...await endReportPhotoIds(tripId), ...await returnedGoodsPhotoIds(tripId),
  ].filter(Boolean);
  if (!known.includes(fileId)) return null;
  const allowed = loaded.crew.some((c) => c.employeeId === actor.personId) || can(actor, 'logistics.trip.view')
    || (fileId === t.crewPhotoFileId && can(actor, 'attendance.trip.photo'))
    // Finance membuka bukti transfer dari layar Uang dari Toko (spec LT1 §13.5 butir 6).
    || (can(actor, 'logistics.store_payment.view') && (await paymentProofIds(tripId)).includes(fileId))
    // Penerima barang kembali membuka foto retur dan foto penerimaan (spec LT1 §14.1).
    || (can(actor, 'logistics.returned_goods.receive') && (await returnedGoodsPhotoIds(tripId)).includes(fileId));
  if (!allowed) return null;
  const [purged] = await db.select().from(photoPurges).where(eq(photoPurges.fileId, fileId)).limit(1);
  if (purged) return null;
  await db.insert(photoViews).values({ tripId, fileId, viewedByAccountId: actor.accountId });
  return fileId;
}

