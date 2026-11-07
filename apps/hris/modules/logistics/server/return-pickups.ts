import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { returnPickupEvents, returnPickups, trips, visitReportItems, visitReports } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, listEmployeesWithAnyAction, type Actor, type ServiceResult, type Tx } from '@/modules/access';
import { saveUpload } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { settingOn } from '@/modules/settings';
import { ageDays } from '../rules/delivery-notes';
import { cleanReturnItems, quantityText, type ReturnItemInput } from '../rules/returned-goods';
import {
  PICKUP_EVENT_LABELS, PICKUP_TASK_LABELS, PICKUP_TASK_TONES, cleanPickupOutcome, cleanPickupTask, pickupWaitRed,
  type PickupEventKind, type PickupTaskStatus,
} from '../rules/return-pickups';
import { reasonProblem, validPoint, wibClock, wibDate, type IsoDate } from '../rules/trip';
import { FORBIDDEN, accountsOf, fail, isUniqueViolation, managerAccounts, peopleNames, type Executor } from './data';

// Tugas jemput retur (A2, spec docs/work/specs/2026-11-08-jemput-retur-design.md). Keadaan di logistics.return_pickups,
// riwayat + foto di logistics.return_pickup_events (migrasi logistics 0017). Diambil = laporan Retur (visit_reports
// bersumber tugas) sehingga Barang Kembali, Laporan Toko, dan Perlu dicatat di kasir tidak perlu jalur kedua.

const ids = (values: number[]) => sql.join((values.length ? values : [-1]).map((v) => sql`${v}`), sql`, `);
const OPEN_TRIP = 'Trip ini sudah Menuju Garasi atau ditutup.';
const photoUrl = (tripId: number, fileId: string) => `/api/logistics/photo?trip=${tripId}&file=${fileId}`;

type Point = { latitude?: number | null; longitude?: number | null; accuracy?: number | null };

/** Cabang kasir Gudang (cabang kasir yang ditautkan ke cabang garasi HRIS). */
async function homeBranch(executor: Executor = db): Promise<number | null> {
  const rows = await executor.execute<{ kasir_branch_id: number | null }>(sql`
    select b.kasir_branch_id from logistics.config c join hris.branches b on b.id = c.garage_branch_id where c.id = 1`);
  const value = rows[0]?.kasir_branch_id;
  return value == null ? null : Number(value);
}

async function addEvent(tx: Tx, rows: (typeof returnPickupEvents.$inferInsert)[]) {
  if (rows.length) await tx.insert(returnPickupEvents).values(rows);
}

/** Buat tugas jemput (pemegang `logistics.return_pickup.manage`): satu tugas terbuka per toko. */
export async function createReturnPickup(
  actor: Actor | null, input: { customerId: number; ownerBranchId?: number | null; reason?: string | null; estimate?: string | null },
): Promise<ServiceResult<{ id: number }>> {
  if (!actor || !can(actor, 'logistics.return_pickup.manage')) return fail(403, FORBIDDEN);
  const clean = cleanPickupTask(input);
  if (!clean.ok) return fail(400, clean.error);
  const [customer] = await db.execute<{ id: number; name: string; active: boolean; is_internal_branch: boolean }>(sql`
    select id, name, active, is_internal_branch from logistics.pos_customers where id = ${input.customerId}`);
  if (!customer || customer.is_internal_branch) return fail(400, 'Pilih toko (pelanggan kasir).');
  if (!customer.active) return fail(400, `${customer.name} tidak aktif di kasir.`);
  const owner = input.ownerBranchId ?? await homeBranch();
  if (owner == null) return fail(409, 'Cabang kasir Gudang belum diatur (Pengaturan › Mobil & Rute). Pilih pemilik barang.');
  const [branch] = await db.execute<{ id: number }>(sql`select id from hris.kasir_branches where id = ${owner}`);
  if (!branch) return fail(400, 'Pilih cabang pemilik barang.');
  try {
    return await db.transaction(async (tx) => {
      const now = new Date();
      const [row] = await tx.insert(returnPickups).values({
        customerId: input.customerId, ownerBranchId: owner, reason: clean.reason, estimate: clean.estimate, createdByAccountId: actor.accountId, createdAt: now,
      }).returning({ id: returnPickups.id });
      await addEvent(tx, [{ pickupId: row.id, kind: 'CREATED', note: clean.reason, byAccountId: actor.accountId, at: now }]);
      await notify(tx, await managerAccounts(), {
        kind: 'logistics.return_pickup', title: `Tugas jemput retur: ${customer.name}`,
        body: `${clean.reason}. Masukkan ke trip di Logistik › Jemput Retur atau saat membuat trip.`,
        link: '/logistik/jemput-retur', entity: 'return_pickup', entityId: row.id,
      }, actor.accountId);
      return { ok: true as const, data: { id: row.id } };
    });
  } catch (error) {
    if (isUniqueViolation(error, 'return_pickups_one_open')) return fail(409, `${customer.name} masih punya tugas jemput retur yang belum selesai.`);
    throw error;
  }
}

/** Batalkan tugas yang masih Menunggu: pembuatnya atau pemegang `logistics.trip.manage`, alasan wajib. */
export async function cancelReturnPickup(actor: Actor | null, id: number, reason: string): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  const problem = reasonProblem(reason);
  if (problem) return fail(400, problem);
  const [task] = await db.select().from(returnPickups).where(eq(returnPickups.id, id)).limit(1);
  if (!task) return fail(404, 'Tugas jemput tidak ditemukan.');
  const mine = task.createdByAccountId === actor.accountId && can(actor, 'logistics.return_pickup.manage');
  if (!mine && !can(actor, 'logistics.trip.manage')) return fail(403, FORBIDDEN);
  return db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx.update(returnPickups).set({
      status: 'CANCELLED', cancelledAt: now, cancelledByAccountId: actor.accountId, cancelReason: reason.trim(), updatedAt: now,
    }).where(and(eq(returnPickups.id, id), eq(returnPickups.status, 'WAITING'))).returning({ id: returnPickups.id });
    if (!row) return fail(409, 'Hanya tugas yang masih Menunggu yang bisa dibatalkan. Lepas dulu dari trip.');
    await addEvent(tx, [{ pickupId: id, kind: 'CANCELLED', note: reason.trim(), byAccountId: actor.accountId, at: now }]);
    return { ok: true as const, data: undefined };
  });
}

/** Trip yang bisa menerima tugas jemput: Draft, atau Berjalan yang belum Menuju Garasi, berute kirim. */
async function lockOpenTrip(tx: Tx, tripId: number) {
  const [trip] = await tx.select().from(trips).where(eq(trips.id, tripId)).for('update').limit(1);
  if (!trip) return { ok: false as const, error: 'Trip tidak ditemukan.' };
  if (!(trip.status === 'DRAFT' || (trip.status === 'RUNNING' && !trip.headingHomeAt))) {
    return { ok: false as const, error: 'Tugas jemput hanya bisa dimasukkan ke trip Draft atau yang sedang berjalan (belum Menuju Garasi).' };
  }
  if (!trip.routeId) return { ok: false as const, error: 'Trip belanja saja tidak bisa membawa tugas jemput. Pilih trip berute kirim.' };
  return { ok: true as const, trip };
}

/** Masukkan tugas Menunggu ke trip (pemegang `logistics.trip.manage`); awak trip yang sudah berangkat diberi tahu. */
export async function assignReturnPickup(actor: Actor | null, id: number, tripId: number): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.trip.manage')) return fail(403, FORBIDDEN);
  return db.transaction(async (tx) => {
    const open = await lockOpenTrip(tx, tripId);
    if (!open.ok) return fail(409, open.error);
    const now = new Date();
    const [row] = await tx.update(returnPickups).set({ status: 'ON_TRIP', tripId, updatedAt: now })
      .where(and(eq(returnPickups.id, id), eq(returnPickups.status, 'WAITING'))).returning({ id: returnPickups.id, customerId: returnPickups.customerId });
    if (!row) return fail(409, 'Tugas ini sudah di trip lain, sudah selesai, atau dibatalkan. Muat ulang halaman.');
    await addEvent(tx, [{ pickupId: id, kind: 'ON_TRIP', tripId, byAccountId: actor.accountId, at: now }]);
    if (open.trip.status === 'RUNNING') {
      const crew = await tx.execute<{ employee_id: number }>(sql`select employee_id from logistics.trip_crew where trip_id = ${tripId} and removed_at is null`);
      const [name] = await tx.execute<{ name: string }>(sql`select name from logistics.pos_customers where id = ${row.customerId}`);
      await notify(tx, await accountsOf(crew.map((c) => Number(c.employee_id))), {
        kind: 'logistics.return_pickup', title: `Tambahan jemput retur di ${name?.name ?? 'toko'} (trip ${open.trip.number})`,
        body: 'Buka Trip Saya › Jemput retur.', link: '/trip-saya', entity: 'trip', entityId: tripId,
      }, actor.accountId);
    }
    return { ok: true as const, data: undefined };
  });
}

/** Lepas tugas dari trip selama belum dikerjakan awak (pemegang `logistics.trip.manage`), alasan wajib → Menunggu. */
export async function releaseReturnPickup(actor: Actor | null, id: number, reason: string): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.trip.manage')) return fail(403, FORBIDDEN);
  const problem = reasonProblem(reason);
  if (problem) return fail(400, problem);
  return db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx.update(returnPickups).set({ status: 'WAITING', updatedAt: now })
      .where(and(eq(returnPickups.id, id), eq(returnPickups.status, 'ON_TRIP'))).returning({ id: returnPickups.id, tripId: returnPickups.tripId });
    if (!row) return fail(409, 'Tugas ini tidak sedang di trip.');
    await addEvent(tx, [{ pickupId: id, kind: 'RELEASED', tripId: row.tripId, note: reason.trim(), byAccountId: actor.accountId, at: now }]);
    return { ok: true as const, data: undefined };
  });
}

/**
 * Samakan tugas jemput trip Draft dengan centang di form Buat/Ubah trip: yang dicentang masuk trip, yang dilepas kembali
 * Menunggu. Dipanggil di dalam transaksi pembuat/pengubah trip; bentrok dilempar sebagai Error berpesan.
 */
export async function syncDraftPickups(tx: Tx, tripId: number, pickupIds: number[], accountId: number) {
  const wanted = [...new Set(pickupIds)];
  const now = new Date();
  const current = await tx.select({ id: returnPickups.id }).from(returnPickups)
    .where(and(eq(returnPickups.tripId, tripId), eq(returnPickups.status, 'ON_TRIP')));
  const drop = current.filter((c) => !wanted.includes(c.id)).map((c) => c.id);
  if (drop.length) {
    await tx.update(returnPickups).set({ status: 'WAITING', updatedAt: now }).where(inArray(returnPickups.id, drop));
    await addEvent(tx, drop.map((pickupId) => ({ pickupId, kind: 'RELEASED', tripId, note: 'Dilepas saat trip diubah sebelum berangkat', byAccountId: accountId, at: now })));
  }
  const add = wanted.filter((id) => !current.some((c) => c.id === id));
  if (!add.length) return;
  const moved = await tx.update(returnPickups).set({ status: 'ON_TRIP', tripId, updatedAt: now })
    .where(and(inArray(returnPickups.id, add), eq(returnPickups.status, 'WAITING'))).returning({ id: returnPickups.id });
  if (moved.length !== add.length) throw new PickupConflict('Salah satu tugas jemput retur sudah di trip lain atau dibatalkan. Muat ulang halaman.');
  await addEvent(tx, moved.map((m) => ({ pickupId: m.id, kind: 'ON_TRIP', tripId, byAccountId: accountId, at: now })));
}

/** Bentrok tugas jemput di dalam transaksi trip. */
export class PickupConflict extends Error {}

/**
 * Trip dibatalkan / ditutup / Selesai lebih awal: tugas yang belum dikerjakan kembali Menunggu. Trip yang sudah berangkat
 * menandainya "terlewat" (dicoba +1); trip Draft yang dibatalkan hanya melepasnya.
 */
export async function returnPickupsOnClose(tx: Tx, tripId: number, options: { kind: 'MISSED' | 'RELEASED'; reason: string; accountId: number | null; employeeId?: number | null; now: Date }) {
  const rows = await tx.update(returnPickups).set({
    status: 'WAITING', updatedAt: options.now, ...(options.kind === 'MISSED' ? { tries: sql`${returnPickups.tries} + 1` } : {}),
  }).where(and(eq(returnPickups.tripId, tripId), eq(returnPickups.status, 'ON_TRIP'))).returning({ id: returnPickups.id });
  await addEvent(tx, rows.map((r) => ({
    pickupId: r.id, kind: options.kind, tripId, note: options.reason, byAccountId: options.accountId, byEmployeeId: options.employeeId ?? null, at: options.now,
  })));
}

/** Tugas jemput yang masih Di trip ini (penahan Menuju Garasi biasa). */
export async function openPickupStores(tripId: number, executor: Executor = db): Promise<string[]> {
  const rows = await executor.execute<{ name: string }>(sql`
    select coalesce(c.name, 'toko') as name from logistics.return_pickups p left join logistics.pos_customers c on c.id = p.customer_id
    where p.trip_id = ${tripId} and p.status = 'ON_TRIP' order by p.id`);
  return rows.map((r) => r.name);
}

/**
 * Hasil di toko (awak trip, Berjalan, belum Menuju Garasi; foto kamera langsung): Diambil = laporan Retur + rincian barang
 * (masuk Barang Kembali dan Laporan Toko); Tidak ada barang = selesai, pembuat diberi tahu; Kirim Besok = kembali Menunggu.
 */
export async function processReturnPickup(
  actor: Actor | null, tripId: number, pickupId: number,
  input: { outcome?: string | null; note?: string | null; items?: ReturnItemInput[] | null; ownerBranchId?: number | null; point?: Point | null },
  photo: File | null,
): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  const clean = cleanPickupOutcome(input.outcome, input.note);
  if (!clean.ok) return fail(400, clean.error);
  const items = clean.outcome === 'PICKED' ? cleanReturnItems(input.items) : null;
  if (items && !items.ok) return fail(400, items.error);
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
  if (!trip) return fail(404, 'Trip tidak ditemukan.');
  const crew = await db.execute<{ id: number }>(sql`
    select id from logistics.trip_crew where trip_id = ${tripId} and employee_id = ${actor.personId} and removed_at is null`);
  if (!crew.length) return fail(403, 'Hanya awak trip ini yang bisa mengerjakan tugas jemput.');
  if (trip.status !== 'RUNNING' || trip.headingHomeAt) return fail(409, OPEN_TRIP);
  const [task] = await db.select().from(returnPickups).where(and(eq(returnPickups.id, pickupId), eq(returnPickups.tripId, tripId))).limit(1);
  if (!task || task.status !== 'ON_TRIP') return fail(409, 'Tugas jemput ini sudah dikerjakan atau dilepas kantor. Muat ulang halaman.');
  let owner = task.ownerBranchId;
  if (clean.outcome === 'PICKED' && input.ownerBranchId != null && input.ownerBranchId !== owner) {
    const [branch] = await db.execute<{ id: number }>(sql`select id from hris.kasir_branches where id = ${input.ownerBranchId}`);
    if (!branch) return fail(400, 'Pilih cabang pemilik barang.');
    owner = input.ownerBranchId;
  }
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  const point = input.point && validPoint(input.point.latitude, input.point.longitude) ? input.point : null;
  const me = actor;
  return db.transaction(async (tx) => {
    const now = new Date();
    const [locked] = await tx.select({ status: trips.status, heading: trips.headingHomeAt, number: trips.number }).from(trips).where(eq(trips.id, tripId)).for('update');
    if (locked.status !== 'RUNNING' || locked.heading) return fail(409, OPEN_TRIP);
    const [name] = await tx.execute<{ name: string }>(sql`select name from logistics.pos_customers where id = ${task.customerId}`);
    const store = name?.name ?? 'toko';
    let reportId: number | null = null;
    if (clean.outcome === 'PICKED' && items?.ok) {
      const [report] = await tx.insert(visitReports).values({
        tripId, customerId: task.customerId, returnPickupId: pickupId, kind: 'RETURN', note: clean.note, photoFileId: upload.data.id,
        carriedBack: true, ownerBranchId: owner, reportedByEmployeeId: me.personId, reportedAt: now,
      }).returning({ id: visitReports.id });
      reportId = report.id;
      await tx.insert(visitReportItems).values(items.items.map((i) => ({ reportId: report.id, ...i })));
    }
    const next = clean.outcome === 'TOMORROW'
      ? { status: 'WAITING', tries: sql`${returnPickups.tries} + 1`, updatedAt: now }
      : { status: clean.outcome, reportId, doneAt: now, updatedAt: now };
    const [row] = await tx.update(returnPickups).set(next as Partial<typeof returnPickups.$inferInsert>)
      .where(and(eq(returnPickups.id, pickupId), eq(returnPickups.status, 'ON_TRIP'), eq(returnPickups.tripId, tripId))).returning({ id: returnPickups.id });
    if (!row) throw new PickupConflict('Tugas jemput ini baru saja dikerjakan orang lain.');
    await addEvent(tx, [{
      pickupId, kind: clean.outcome, tripId, note: clean.note, photoFileId: upload.data.id, latitude: point?.latitude ?? null, longitude: point?.longitude ?? null,
      byAccountId: me.accountId, byEmployeeId: me.personId, at: now,
    }]);
    if (clean.outcome === 'PICKED' && reportId) {
      await notify(tx, await accountsOf(await listEmployeesWithAnyAction(['logistics.delivery_note.decide', 'logistics.note_cut.decide'])), {
        kind: 'logistics.visit_report', title: `Retur dijemput: ${store} (trip ${locked.number})`,
        body: 'Barangnya diterima di Barang Kembali; Finance memutuskan Retur BO di Laporan Toko.',
        link: '/logistik/laporan-toko', entity: 'visit_report', entityId: reportId,
      }, me.accountId);
    }
    if (clean.outcome === 'NO_GOODS') {
      await notify(tx, [task.createdByAccountId], {
        kind: 'logistics.return_pickup', title: `Jemput retur ${store}: tidak ada barang`, body: clean.note ?? '',
        link: '/logistik/jemput-retur', entity: 'return_pickup', entityId: pickupId,
      }, me.accountId);
    }
    return { ok: true as const, data: undefined };
  }).catch((error: unknown) => {
    if (error instanceof PickupConflict) return fail(409, error.message);
    throw error;
  });
}

export type PickupEventView = { kind: PickupEventKind; label: string; note: string | null; by: string; on: IsoDate; at: string; photoUrl: string | null; tripNumber: string | null };
export type ReturnPickupView = {
  id: number; customerId: number; store: string; address: string | null; phone: string | null; owner: string; reason: string; estimate: string | null;
  status: PickupTaskStatus; statusLabel: string; tone: 'info' | 'ok' | 'warn' | 'danger'; tries: number; age: number; red: boolean; createdOn: IsoDate;
  createdBy: string; tripId: number | null; tripNumber: string | null; reportId: number | null; events: PickupEventView[];
  items: { name: string; quantity: string; unit: string }[]; mine: boolean;
};

async function viewsOf(rows: (typeof returnPickups.$inferSelect)[], actor: Actor | null, executor: Executor = db): Promise<ReturnPickupView[]> {
  if (!rows.length) return [];
  const pickupIds = rows.map((r) => r.id);
  const customerIds = [...new Set(rows.map((r) => r.customerId))];
  const reportIds = rows.map((r) => r.reportId).filter((id): id is number => id != null);
  const [customers, branches, events, items, accounts, names, red] = await Promise.all([
    executor.execute<{ id: number; name: string; address: string | null; phone: string | null }>(sql`
      select id, name, address, phone from logistics.pos_customers where id in (${ids(customerIds)})`),
    executor.execute<{ id: number; name: string }>(sql`select id, name from hris.kasir_branches`),
    executor.execute<{ pickup_id: number; kind: string; note: string | null; photo_file_id: string | null; trip_id: number | null; number: string | null; by_account_id: number | null; by_employee_id: number | null; at: string }>(sql`
      select e.pickup_id, e.kind, e.note, e.photo_file_id, e.trip_id, t.number, e.by_account_id, e.by_employee_id, e.at
      from logistics.return_pickup_events e left join logistics.trips t on t.id = e.trip_id
      where e.pickup_id in (${ids(pickupIds)}) order by e.id`),
    reportIds.length ? executor.execute<{ report_id: number; name: string; quantity: string; unit: string }>(sql`
      select report_id, name, quantity::text as quantity, unit from logistics.visit_report_items where report_id in (${ids(reportIds)}) order by id`) : [],
    executor.execute<{ account_id: number; name: string }>(sql`
      select l.account_id, e.name from auth.account_links l join hris.employees e on e.id = l.local_user_id where l.app_code = 'hris'`),
    peopleNames(),
    settingOn<number>('logistics.pending_red_days', wibDate(new Date())),
  ]);
  const customerOf = new Map(customers.map((c) => [Number(c.id), c]));
  const branchOf = new Map(branches.map((b) => [Number(b.id), b.name]));
  const accountName = new Map(accounts.map((a) => [Number(a.account_id), a.name]));
  const tripNumbers = new Map(events.filter((e) => e.trip_id != null).map((e) => [Number(e.trip_id), e.number]));
  const today = wibDate(new Date());
  return rows.map((r) => {
    const c = customerOf.get(r.customerId);
    const status = r.status as PickupTaskStatus;
    const age = ageDays(wibDate(r.createdAt), today);
    return {
      id: r.id, customerId: r.customerId, store: c?.name ?? `Pelanggan #${r.customerId}`, address: c?.address ?? null, phone: c?.phone ?? null,
      owner: branchOf.get(r.ownerBranchId) ?? `Cabang #${r.ownerBranchId}`, reason: r.reason, estimate: r.estimate, status,
      statusLabel: PICKUP_TASK_LABELS[status], tone: PICKUP_TASK_TONES[status], tries: r.tries, age,
      red: status === 'WAITING' && pickupWaitRed(age, Number(red)), createdOn: wibDate(r.createdAt), createdBy: accountName.get(r.createdByAccountId) ?? '-',
      tripId: r.tripId, tripNumber: r.tripId ? tripNumbers.get(r.tripId) ?? null : null, reportId: r.reportId,
      events: events.filter((e) => Number(e.pickup_id) === r.id).map((e) => {
        const at = new Date(e.at);
        return {
          kind: e.kind as PickupEventKind, label: PICKUP_EVENT_LABELS[e.kind as PickupEventKind] ?? e.kind, note: e.note,
          by: (e.by_employee_id != null ? names.get(Number(e.by_employee_id)) : null) ?? (e.by_account_id != null ? accountName.get(Number(e.by_account_id)) : null) ?? '-',
          on: wibDate(at), at: wibClock(at), tripNumber: e.number,
          photoUrl: e.photo_file_id && e.trip_id != null ? photoUrl(Number(e.trip_id), e.photo_file_id) : null,
        };
      }),
      items: items.filter((i) => Number(i.report_id) === r.reportId).map((i) => ({ name: i.name, quantity: quantityText(i.quantity), unit: i.unit })),
      mine: !!actor && r.createdByAccountId === actor.accountId,
    };
  });
}

/** Tugas jemput sebuah trip (rincian trip kantor dan Trip Saya): yang pernah dibawa trip ini. */
export async function tripReturnPickupsView(tripId: number, executor: Executor = db): Promise<ReturnPickupView[]> {
  const rows = await executor.execute<{ id: number }>(sql`
    select distinct pickup_id as id from logistics.return_pickup_events where trip_id = ${tripId}`);
  if (!rows.length) return [];
  const tasks = await executor.select().from(returnPickups).where(inArray(returnPickups.id, rows.map((r) => Number(r.id)))).orderBy(returnPickups.id);
  const [views, lastHere] = await Promise.all([
    viewsOf(tasks, null, executor),
    executor.execute<{ pickup_id: number; kind: string }>(sql`
      select distinct on (pickup_id) pickup_id, kind from logistics.return_pickup_events where trip_id = ${tripId} order by pickup_id, id desc`),
  ]);
  const lastOf = new Map(lastHere.map((e) => [Number(e.pickup_id), e.kind as PickupEventKind]));
  // Tugas yang sudah kembali Menunggu (Kirim Besok / terlewat / dilepas) tampil dengan hasilnya di trip ini.
  return views.map((v) => {
    const last = lastOf.get(v.id);
    if (v.status === 'ON_TRIP' && v.tripId === tripId) return v;
    if (last === 'PICKED' || last === 'NO_GOODS') return v;
    return { ...v, statusLabel: last ? PICKUP_EVENT_LABELS[last] : v.statusLabel, tone: 'info' as const };
  });
}

/** Pilihan centang di form trip: tugas Menunggu + yang sedang di trip ini. */
export async function pickupOptions(tripId: number | null): Promise<{ id: number; store: string; reason: string; owner: string; age: number; tries: number; onTrip: boolean }[]> {
  const rows = await db.select().from(returnPickups).where(tripId
    ? sql`${returnPickups.status} = 'WAITING' or (${returnPickups.status} = 'ON_TRIP' and ${returnPickups.tripId} = ${tripId})`
    : eq(returnPickups.status, 'WAITING')).orderBy(returnPickups.createdAt).limit(200);
  const views = await viewsOf(rows, null);
  return views.map((v) => ({ id: v.id, store: v.store, reason: v.reason, owner: v.owner, age: v.age, tries: v.tries, onTrip: v.status === 'ON_TRIP' }));
}

/** Halaman Jemput Retur: Menunggu, Di trip, 30 terakhir yang selesai; trip yang bisa menerima tugas. */
export async function returnPickupsScreen(actor: Actor | null) {
  if (!actor || !(can(actor, 'logistics.return_pickup.manage') || can(actor, 'logistics.trip.manage') || can(actor, 'logistics.trip.view'))) return null;
  const [open, done, openTrips, branches, home] = await Promise.all([
    db.select().from(returnPickups).where(inArray(returnPickups.status, ['WAITING', 'ON_TRIP'])).orderBy(returnPickups.createdAt).limit(300),
    db.select().from(returnPickups).where(inArray(returnPickups.status, ['PICKED', 'NO_GOODS', 'CANCELLED']))
      .orderBy(desc(sql`coalesce(${returnPickups.doneAt}, ${returnPickups.cancelledAt})`)).limit(30),
    db.execute<{ id: number; number: string; status: string; vehicle: string; route: string | null }>(sql`
      select t.id, t.number, t.status, v.name as vehicle, r.name as route from logistics.trips t
      join logistics.vehicles v on v.id = t.vehicle_id left join logistics.routes r on r.id = t.route_id
      where t.route_id is not null and (t.status = 'DRAFT' or (t.status = 'RUNNING' and t.heading_home_at is null)) order by t.id desc limit 50`),
    db.execute<{ id: number; name: string }>(sql`select id, name from hris.kasir_branches order by name`),
    homeBranch(),
  ]);
  const views = await viewsOf([...open, ...done], actor);
  return {
    waiting: views.filter((v) => v.status === 'WAITING'), onTrip: views.filter((v) => v.status === 'ON_TRIP'),
    done: views.filter((v) => !['WAITING', 'ON_TRIP'].includes(v.status)),
    trips: openTrips.map((t) => ({ id: Number(t.id), label: `${t.number} · ${t.vehicle}${t.route ? ` · ${t.route}` : ''}${t.status === 'RUNNING' ? ' (berjalan)' : ''}` })),
    branches: branches.map((b) => ({ id: Number(b.id), name: b.name })), homeBranchId: home,
    canCreate: can(actor, 'logistics.return_pickup.manage'), canAssign: can(actor, 'logistics.trip.manage'),
  };
}

/** Cari toko untuk tugas baru (nama, kode, HP), paling banyak 20. */
export async function searchPickupStores(actor: Actor | null, query: string) {
  if (!actor || !can(actor, 'logistics.return_pickup.manage')) return null;
  const q = query.trim();
  if (q.length < 2) return [];
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const rows = await db.execute<{ id: number; code: string | null; name: string; address: string | null; open_task: boolean }>(sql`
    select c.id, c.code, c.name, c.address,
      exists (select 1 from logistics.return_pickups p where p.customer_id = c.id and p.status in ('WAITING', 'ON_TRIP')) as open_task
    from logistics.pos_customers c
    where not c.is_internal_branch and c.active and (c.name ilike ${like} or c.code ilike ${like} or c.phone ilike ${like})
    order by c.name limit 20`);
  return rows.map((r) => ({ id: Number(r.id), code: r.code, name: r.name, address: r.address, openTask: !!r.open_task }));
}

/** Angka Beranda: tugas jemput Menunggu (pemegang `logistics.trip.manage`). */
export async function waitingPickupCount(actor: Actor | null): Promise<number> {
  if (!actor || !can(actor, 'logistics.trip.manage')) return 0;
  const [row] = await db.execute<{ n: number }>(sql`select count(*)::int as n from logistics.return_pickups where status = 'WAITING'`);
  return Number(row?.n ?? 0);
}

/** Foto langkah tugas jemput milik trip ini (pintu foto trip). */
export async function returnPickupPhotoIds(tripId: number): Promise<string[]> {
  const rows = await db.select({ id: returnPickupEvents.photoFileId }).from(returnPickupEvents).where(eq(returnPickupEvents.tripId, tripId));
  return rows.map((r) => r.id).filter((id): id is string => !!id);
}
