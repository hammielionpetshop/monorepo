import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { photoPurges, photoViews, selfTrips, selfTripStops, storePoints, tripVisits } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, listEmployeesWithAnyAction, type Actor, type ServiceResult } from '@/modules/access';
import { saveUpload } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { settingOn } from '@/modules/settings';
import {
  POINT_KIND_LABELS, POINT_SOURCE_LABELS, POINT_STATUS_LABELS, accuracyProblem, correctionReason, mapUrl, parseCoordinates,
  type PointKind, type PointSource, type PointStatus,
} from '../rules/store-points';
import { distanceMeters, reasonProblem, validPoint, wibClock, wibDate } from '../rules/trip';
import { FORBIDDEN, accountsOf, fail, isUniqueViolation, peopleNames, type Executor } from './data';
import { runningForCrew } from './driver-trip';

// Titik toko (spec LT1 §3.8, §13.4, LT1b-2b). Toko = pelanggan kasir (`customer_id`); titik milik HRIS.

const DECIDE = 'logistics.store_point.decide';
const ids = (values: number[]) => sql.join((values.length ? values : [-1]).map((v) => sql`${v}`), sql`, `);
const PENDING_TAKEN = 'Titik toko ini sudah diusulkan dan sedang menunggu persetujuan.';

export type ApprovedPoint = { id: number; latitude: number; longitude: number; mapUrl: string };

/** Titik Disetujui + ada usulan Menunggu, per toko. */
export async function pointsOf(customerIds: number[], executor: Executor = db) {
  const unique = [...new Set(customerIds)];
  const approved = new Map<number, ApprovedPoint>();
  const pending = new Set<number>();
  if (!unique.length) return { approved, pending };
  const rows = await executor.select({
    id: storePoints.id, customerId: storePoints.customerId, status: storePoints.status, latitude: storePoints.latitude, longitude: storePoints.longitude,
  }).from(storePoints).where(and(inArray(storePoints.customerId, unique), inArray(storePoints.status, ['APPROVED', 'PENDING'])));
  for (const r of rows) {
    if (r.status === 'PENDING') pending.add(r.customerId);
    else approved.set(r.customerId, { id: r.id, latitude: r.latitude, longitude: r.longitude, mapUrl: mapUrl(r.latitude, r.longitude) });
  }
  return { approved, pending };
}

/** Jarak lokasi Terkirim dari titik toko Disetujui (§13.4 butir 5), dibulatkan meter; null bila salah satunya tidak ada. */
export async function distanceFromPoint(executor: Executor, customerId: number | null, where: { latitude: number; longitude: number } | null) {
  if (customerId == null || !where) return null;
  const point = (await pointsOf([customerId], executor)).approved.get(customerId);
  return point ? Math.round(distanceMeters(point, where)) : null;
}

async function deciderAccounts(): Promise<number[]> {
  return accountsOf(await listEmployeesWithAnyAction([DECIDE]));
}

export type ProposeInput = { kind: PointKind; reason?: string | null; point: { latitude?: number | null; longitude?: number | null; accuracy?: number | null } };

/**
 * Pasang titik dari kunjungan (§13.4 butir 1–3): awak trip Berjalan, kunjungan ke toko, GPS ≤ batas akurasi + foto depan
 * toko. Menunggu, kecuali dipasang pemegang hak putus (langsung Disetujui, titik lama Diganti).
 */
export async function proposeFromVisit(actor: Actor | null, tripId: number, visitId: number, input: ProposeInput, photo: File | null): Promise<ServiceResult<{ status: PointStatus }>> {
  const running = await runningForCrew(actor, tripId);
  if (!running.ok) return running;
  const me = actor!;
  const [visit] = await db.select().from(tripVisits).where(and(eq(tripVisits.id, visitId), eq(tripVisits.tripId, tripId))).limit(1);
  if (!visit || visit.status === 'RELEASED') return fail(404, 'Kunjungan tidak ditemukan di trip ini.');
  if (visit.customerId == null) return fail(400, 'Titik hanya untuk toko. Titik cabang diatur di Cabang & Jabatan.');
  return proposeCore(me, { customerId: visit.customerId, name: visit.destinationName, tripId, visitId, selfStopId: null }, input, photo);
}

/**
 * Pasang titik dari tujuan antar sendiri (spec LT1 §15.2): PJ perjalanan Berjalan, tujuan toko (bukan nota Umum). Aturan
 * akurasi, foto, dan persetujuan sama dengan dari kunjungan trip.
 */
export async function proposeFromSelfStop(actor: Actor | null, selfTripId: number, stopId: number, input: ProposeInput, photo: File | null): Promise<ServiceResult<{ status: PointStatus }>> {
  if (!actor) return fail(403, FORBIDDEN);
  const [trip] = await db.select().from(selfTrips).where(eq(selfTrips.id, selfTripId)).limit(1);
  if (!trip || trip.employeeId !== actor.personId) return fail(404, 'Perjalanan antar tidak ditemukan.');
  if (trip.status !== 'RUNNING') return fail(409, 'Perjalanan ini sudah kembali (Foto 3).');
  const [stop] = await db.select().from(selfTripStops).where(and(eq(selfTripStops.id, stopId), eq(selfTripStops.tripId, selfTripId))).limit(1);
  if (!stop) return fail(404, 'Tujuan tidak ditemukan di perjalanan ini.');
  if (stop.customerId == null) return fail(400, 'Titik hanya untuk toko berpelanggan, bukan nota Umum.');
  return proposeCore(actor, { customerId: stop.customerId, name: stop.destinationName, tripId: null, visitId: null, selfStopId: stopId }, input, photo);
}

async function proposeCore(
  me: Actor, from: { customerId: number; name: string; tripId: number | null; visitId: number | null; selfStopId: number | null },
  input: ProposeInput, photo: File | null,
): Promise<ServiceResult<{ status: PointStatus }>> {
  const { tripId, visitId, selfStopId } = from;
  const visit = { destinationName: from.name };
  const actor = me;
  const { latitude, longitude, accuracy } = input.point;
  if (!validPoint(latitude, longitude)) return fail(400, 'Lokasi HP tidak terbaca. Nyalakan lokasi (GPS) lalu ulangi.');
  const limit = Number(await settingOn<number>('logistics.point_accuracy_m', wibDate(new Date())));
  const accuracyError = accuracyProblem(accuracy, limit);
  if (accuracyError) return fail(400, accuracyError);
  const reason = input.kind === 'CORRECTION' ? correctionReason(input.reason) : null;
  if (reason && !reason.ok) return fail(400, reason.error);
  const customerId = from.customerId;
  const current = await pointsOf([customerId]);
  if (current.pending.has(customerId)) return fail(409, PENDING_TAKEN);
  if (input.kind === 'NEW' && current.approved.has(customerId)) return fail(409, 'Toko ini sudah punya titik. Bila salah, pakai Laporkan titik salah.');
  if (input.kind === 'CORRECTION' && !current.approved.has(customerId)) return fail(409, 'Toko ini belum punya titik. Pakai Pasang titik toko.');
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  const direct = can(me, DECIDE);
  try {
    return await db.transaction(async (tx) => {
      const now = new Date();
      if (direct) await replaceApproved(tx, customerId, now);
      const [row] = await tx.insert(storePoints).values({
        customerId, status: direct ? 'APPROVED' : 'PENDING', source: 'VISIT', kind: input.kind, reason: reason?.ok ? reason.value : null,
        latitude: latitude as number, longitude: longitude as number, accuracyM: Math.round(accuracy as number), photoFileId: upload.data.id,
        tripId, visitId, selfStopId, proposedByEmployeeId: me.personId, proposedByAccountId: me.accountId, proposedAt: now,
        ...(direct ? { decidedAt: now, decidedByAccountId: me.accountId } : {}),
      }).returning({ id: storePoints.id });
      if (!direct) {
        await notify(tx, await deciderAccounts(), {
          kind: 'logistics.store_point', title: `${input.kind === 'CORRECTION' ? 'Titik salah dilaporkan' : 'Titik toko baru'}: ${visit.destinationName}`,
          body: `${reason?.ok ? `${reason.value}. ` : ''}Setujui atau tolak di Data Toko › Titik menunggu.`,
          link: '/logistik/toko?tab=titik', entity: 'store_point', entityId: row.id,
        }, me.accountId);
      }
      return { ok: true as const, data: { status: (direct ? 'APPROVED' : 'PENDING') as PointStatus } };
    });
  } catch (error) {
    if (isUniqueViolation(error, 'store_points_one_pending')) return fail(409, PENDING_TAKEN);
    if (isUniqueViolation(error, 'store_points_one_approved')) return fail(409, 'Titik toko ini baru saja diubah. Muat ulang halaman.');
    throw error;
  }
}

/** Titik Disetujui lama menjadi Diganti (dipanggil sebelum titik baru Disetujui, karena satu toko satu titik Disetujui). */
async function replaceApproved(tx: Executor, customerId: number, now: Date) {
  await tx.update(storePoints).set({ status: 'REPLACED', replacedAt: now })
    .where(and(eq(storePoints.customerId, customerId), eq(storePoints.status, 'APPROVED')));
}

/** Setujui / Tolak usulan (§13.4 butir 2). Tolak wajib alasan dan memberi tahu pemasang. */
export async function decidePoint(actor: Actor | null, pointId: number, decision: 'APPROVE' | 'REJECT', reason: string): Promise<ServiceResult> {
  if (!actor || !can(actor, DECIDE)) return fail(403, FORBIDDEN);
  const text = reason.trim();
  if (decision === 'REJECT') {
    const reasonError = reasonProblem(text);
    if (reasonError) return fail(400, reasonError);
  }
  return db.transaction(async (tx) => {
    const [point] = await tx.select().from(storePoints).where(eq(storePoints.id, pointId)).for('update').limit(1);
    if (!point || point.status !== 'PENDING') return fail(409, 'Usulan titik ini sudah diputuskan. Muat ulang halaman.');
    const now = new Date();
    if (decision === 'APPROVE') {
      await replaceApproved(tx, point.customerId, now);
      await tx.update(storePoints).set({ status: 'APPROVED', decidedAt: now, decidedByAccountId: actor.accountId }).where(eq(storePoints.id, pointId));
      return { ok: true as const, data: undefined };
    }
    await tx.update(storePoints).set({ status: 'REJECTED', decidedAt: now, decidedByAccountId: actor.accountId, rejectReason: text.slice(0, 500) })
      .where(eq(storePoints.id, pointId));
    const [name] = await tx.execute<{ name: string }>(sql`select name from logistics.pos_customers where id = ${point.customerId}`);
    await notify(tx, [point.proposedByAccountId], {
      kind: 'logistics.store_point_rejected', title: name ? `Titik toko ${name.name} ditolak` : 'Titik toko ditolak',
      body: text.slice(0, 300), link: '/trip-saya', entity: 'store_point', entityId: pointId,
    }, actor.accountId);
    return { ok: true as const, data: undefined };
  });
}

/** Tempel koordinat kantor (§13.4 butir 8): tanpa foto, langsung Disetujui; usulan Menunggu toko itu ikut ditolak. */
export async function pastePoint(actor: Actor | null, customerId: number, text: string): Promise<ServiceResult> {
  if (!actor || !can(actor, DECIDE)) return fail(403, FORBIDDEN);
  const parsed = parseCoordinates(text);
  if (!parsed.ok) return fail(400, parsed.error);
  const [customer] = await db.execute<{ is_internal_branch: boolean }>(sql`select is_internal_branch from logistics.pos_customers where id = ${customerId}`);
  if (!customer) return fail(404, 'Pelanggan tidak ditemukan di kasir.');
  if (customer.is_internal_branch) return fail(400, 'Pelanggan internal (cabang) bukan toko.');
  return db.transaction(async (tx) => {
    const now = new Date();
    await tx.update(storePoints).set({ status: 'REJECTED', decidedAt: now, decidedByAccountId: actor.accountId, rejectReason: 'Diganti koordinat yang ditempel kantor' })
      .where(and(eq(storePoints.customerId, customerId), eq(storePoints.status, 'PENDING')));
    await replaceApproved(tx, customerId, now);
    await tx.insert(storePoints).values({
      customerId, status: 'APPROVED', source: 'OFFICE', kind: 'NEW', latitude: parsed.latitude, longitude: parsed.longitude,
      proposedByEmployeeId: actor.personId, proposedByAccountId: actor.accountId, proposedAt: now, decidedAt: now, decidedByAccountId: actor.accountId,
    });
    return { ok: true as const, data: undefined };
  });
}

export type PointRow = {
  id: number; customerId: number; store: string; status: PointStatus; statusLabel: string; kindLabel: string; sourceLabel: string; reason: string | null;
  latitude: number; longitude: number; mapUrl: string; accuracyM: number | null; photoUrl: string | null; by: string; at: string; on: string;
  decidedBy: string | null; decidedAt: string | null; rejectReason: string | null; tripNumber: string | null;
  /** Usulan: jarak dari titik Disetujui sekarang (laporan titik salah). */
  fromCurrentM: number | null;
};

type PointDb = typeof storePoints.$inferSelect;

async function viewRows(rows: PointDb[]): Promise<PointRow[]> {
  if (!rows.length) return [];
  const customerIds = [...new Set(rows.map((r) => r.customerId))];
  const accountIds = [...new Set(rows.flatMap((r) => [r.proposedByAccountId, r.decidedByAccountId]).filter((id): id is number => id != null))];
  const tripIds = [...new Set(rows.map((r) => r.tripId).filter((id): id is number => id != null))];
  const [customers, people, accounts, tripRows, current] = await Promise.all([
    db.execute<{ id: number; name: string }>(sql`select id, name from logistics.pos_customers where id in (${ids(customerIds)})`),
    peopleNames(),
    db.execute<{ account_id: number; name: string }>(sql`
      select l.account_id, e.name from auth.account_links l join hris.employees e on e.id = l.local_user_id
      where l.app_code = 'hris' and l.account_id in (${ids(accountIds)})`),
    db.execute<{ id: number; number: string }>(sql`select id, number from logistics.trips where id in (${ids(tripIds)})`),
    pointsOf(customerIds),
  ]);
  const storeName = new Map(customers.map((c) => [Number(c.id), c.name]));
  const accountName = new Map(accounts.map((a) => [Number(a.account_id), a.name]));
  const tripNumber = new Map(tripRows.map((t) => [Number(t.id), t.number]));
  return rows.map((r) => {
    const approvedNow = current.approved.get(r.customerId);
    return {
      id: r.id, customerId: r.customerId, store: storeName.get(r.customerId) ?? `Pelanggan #${r.customerId}`, status: r.status as PointStatus,
      statusLabel: POINT_STATUS_LABELS[r.status as PointStatus], kindLabel: POINT_KIND_LABELS[r.kind as PointKind], sourceLabel: POINT_SOURCE_LABELS[r.source as PointSource],
      reason: r.reason, latitude: r.latitude, longitude: r.longitude, mapUrl: mapUrl(r.latitude, r.longitude), accuracyM: r.accuracyM,
      photoUrl: r.photoFileId ? `/api/logistics/store-photo?point=${r.id}` : null,
      by: (r.proposedByEmployeeId ? people.get(r.proposedByEmployeeId) : null) ?? accountName.get(r.proposedByAccountId) ?? '-',
      at: wibClock(r.proposedAt), on: wibDate(r.proposedAt),
      decidedBy: r.decidedByAccountId ? accountName.get(r.decidedByAccountId) ?? '-' : null, decidedAt: r.decidedAt ? `${wibDate(r.decidedAt)} ${wibClock(r.decidedAt)}` : null,
      rejectReason: r.rejectReason, tripNumber: r.tripId ? tripNumber.get(r.tripId) ?? null : null,
      fromCurrentM: r.status === 'PENDING' && approvedNow ? Math.round(distanceMeters(approvedNow, r)) : null,
    };
  });
}

/** Tab Titik menunggu di Data Toko (§13.4 butir 2), paling lama di atas. */
export async function pendingPoints(actor: Actor | null) {
  if (!actor || !(can(actor, 'logistics.store.view') || can(actor, DECIDE))) return null;
  const rows = await db.select().from(storePoints).where(eq(storePoints.status, 'PENDING')).orderBy(storePoints.proposedAt).limit(300);
  return { rows: await viewRows(rows), canDecide: can(actor, DECIDE) };
}

/** Kartu Titik toko di rincian toko: titik sekarang, usulan menunggu, riwayat 20 terakhir. */
export async function storePointHistory(actor: Actor, customerId: number) {
  const rows = await db.select().from(storePoints).where(eq(storePoints.customerId, customerId)).orderBy(desc(storePoints.id)).limit(20);
  const view = await viewRows(rows);
  return {
    approved: view.find((r) => r.status === 'APPROVED') ?? null,
    pending: view.find((r) => r.status === 'PENDING') ?? null,
    history: view.filter((r) => r.status === 'REJECTED' || r.status === 'REPLACED'),
    canDecide: can(actor, DECIDE),
  };
}

/** Angka Beranda: usulan titik menunggu (pemegang hak putus). */
export async function pendingPointCount(actor: Actor | null): Promise<number> {
  if (!actor || !can(actor, DECIDE)) return 0;
  return countPendingPoints();
}

/** Hitung titik toko Menunggu tanpa pemeriksaan hak (Dashboard Logistik, spec LT1 §17.1 butir 7). */
export async function countPendingPoints(): Promise<number> {
  const [row] = await db.execute<{ n: number }>(sql`select count(*)::int as n from logistics.store_points where status = 'PENDING'`);
  return Number(row?.n ?? 0);
}

/** Pintu foto titik (§13.4): pemegang lihat toko / putus titik, atau pemasangnya. Pembukaan dicatat di photo_views trip asal. */
export async function openStorePointPhoto(actor: Actor | null, pointId: number): Promise<string | null> {
  if (!actor) return null;
  const [point] = await db.select().from(storePoints).where(eq(storePoints.id, pointId)).limit(1);
  if (!point?.photoFileId || (!point.tripId && !point.selfStopId)) return null;
  const allowed = can(actor, 'logistics.store.view') || can(actor, DECIDE) || point.proposedByAccountId === actor.accountId;
  if (!allowed) return null;
  const [purged] = await db.select().from(photoPurges).where(eq(photoPurges.fileId, point.photoFileId)).limit(1);
  if (purged) return null;
  if (point.tripId) await db.insert(photoViews).values({ tripId: point.tripId, fileId: point.photoFileId, viewedByAccountId: actor.accountId });
  return point.photoFileId;
}

