import { and, eq, inArray, sql } from 'drizzle-orm';
import { deliveryNoteEvents, deliveryNotes, tripPickups, trips, tripVisitNotes, tripVisits } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, type Actor, type ServiceResult, type Tx } from '@/modules/access';
import { saveUpload } from '@/modules/files';
import { settingOn } from '@/modules/settings';
import { ageDays, backofficeLink, compareQueue, type NoteKind } from '../rules/delivery-notes';
import { reasonProblem, wibDate, type IsoDate } from '../rules/trip';
import {
  MAX_NOTES_PER_TRIP, PICKUP_LABELS, VISIT_LABELS, VISIT_TONES, kasirChange, noteKey, parseNoteKey, pickupOrigins, planVisits,
  type KasirChange, type NoteKey, type PickupStatus, type VisitStatus,
} from '../rules/trip-notes';
import { FORBIDDEN, fail, type Executor } from './data';

// Surat jalan di trip (spec LT1 §3.3–3.5, LT1b-1). Data kasir dibaca lewat view logistics.pos_* (migrasi logistics 0003);
// status HRIS di logistics.delivery_notes (migrasi 0004).

/** Ditolak di tengah transaksi: seluruh perubahan trip dibatalkan, pesannya diteruskan ke layar. */
export class TripNotesConflict extends Error {}

const ids = (values: number[]) => sql.join((values.length ? values : [-1]).map((v) => sql`${v}`), sql`, `);
const backofficeBase = () => process.env.BACKOFFICE_PUBLIC_URL ?? null;

export type LiveNote = {
  key: NoteKey; kind: NoteKind; docId: number; number: string; on: IsoDate; kasirStatus: string; waiting: boolean;
  originBranchId: number; origin: string; customerId: number | null; destinationBranchId: number | null; destination: string;
  amount: number | null; revision: number | null; routeId: number | null;
};

type SaleRow = {
  id: number; trx_number: string; branch_id: number; branch_name: string; customer_id: number | null; customer_name: string | null;
  payable_amount: number; status: string; revision: number; trx_on: string; default_route_id: number | null;
};
type TransferRow = {
  id: number; ibt_number: string; source_branch_id: number; source_branch_name: string; destination_branch_id: number;
  destination_branch_name: string; status: string; created_on: string;
};

function fromSale(s: SaleRow): LiveNote {
  return {
    key: noteKey('SALE', Number(s.id)), kind: 'SALE', docId: Number(s.id), number: s.trx_number, on: s.trx_on, kasirStatus: s.status,
    waiting: s.status === 'COMPLETED', originBranchId: Number(s.branch_id), origin: s.branch_name,
    customerId: s.customer_id == null ? null : Number(s.customer_id), destinationBranchId: null, destination: s.customer_name ?? 'Pelanggan tidak ditemukan',
    amount: Number(s.payable_amount), revision: Number(s.revision), routeId: s.default_route_id == null ? null : Number(s.default_route_id),
  };
}

function fromTransfer(t: TransferRow): LiveNote {
  return {
    key: noteKey('TRANSFER', Number(t.id)), kind: 'TRANSFER', docId: Number(t.id), number: t.ibt_number, on: t.created_on, kasirStatus: t.status,
    waiting: t.status === 'IN_TRANSIT', originBranchId: Number(t.source_branch_id), origin: t.source_branch_name, customerId: null,
    destinationBranchId: Number(t.destination_branch_id), destination: t.destination_branch_name, amount: null, revision: null, routeId: null,
  };
}

const SALE_COLUMNS = sql`s.id, s.trx_number, s.branch_id, s.branch_name, s.customer_id, c.name as customer_name, s.payable_amount, s.status,
  s.revision, s.trx_on::text as trx_on, st.default_route_id`;
const SALE_FROM = sql`logistics.pos_truck_sales s left join logistics.pos_customers c on c.id = s.customer_id
  left join logistics.stores st on st.customer_id = s.customer_id`;
const TRANSFER_COLUMNS = sql`t.id, t.ibt_number, t.source_branch_id, t.source_branch_name, t.destination_branch_id, t.destination_branch_name,
  t.status, t.created_on::text as created_on`;

/** Dokumen kasir untuk kunci-kunci ini (apa pun statusnya). */
export async function liveNotesFor(keys: NoteKey[], executor: Executor = db): Promise<Map<NoteKey, LiveNote>> {
  const parsed = keys.map(parseNoteKey).filter((p): p is NonNullable<typeof p> => !!p);
  const saleIds = parsed.filter((p) => p.kind === 'SALE').map((p) => p.docId);
  const transferIds = parsed.filter((p) => p.kind === 'TRANSFER').map((p) => p.docId);
  const [sales, transfers] = await Promise.all([
    saleIds.length ? executor.execute<SaleRow>(sql`select ${SALE_COLUMNS} from ${SALE_FROM} where s.id in (${ids(saleIds)})`) : [],
    transferIds.length ? executor.execute<TransferRow>(sql`select ${TRANSFER_COLUMNS} from logistics.pos_truck_transfers t where t.id in (${ids(transferIds)})`) : [],
  ]);
  return new Map([...sales.map(fromSale), ...transfers.map(fromTransfer)].map((n) => [n.key, n]));
}

/** Surat jalan Menunggu yang bisa dicentang ke trip: kasir masih menunggu, sejak tanggal mulai, belum di trip/terkirim. */
export async function waitingNotes(limit = 300): Promise<LiveNote[]> {
  const today = wibDate(new Date());
  const from = String(await settingOn<string>('logistics.delivery_from', today));
  const [sales, transfers] = await Promise.all([
    db.execute<SaleRow>(sql`select ${SALE_COLUMNS} from ${SALE_FROM}
      left join logistics.delivery_notes dn on dn.kind = 'SALE' and dn.doc_id = s.id
      where s.trx_on >= ${from}::date and s.status = 'COMPLETED' and coalesce(dn.status, 'WAITING') = 'WAITING'
      order by s.trx_on, s.trx_number limit ${limit}`),
    db.execute<TransferRow>(sql`select ${TRANSFER_COLUMNS} from logistics.pos_truck_transfers t
      left join logistics.delivery_notes dn on dn.kind = 'TRANSFER' and dn.doc_id = t.id
      where t.created_on >= ${from}::date and t.status = 'IN_TRANSIT' and coalesce(dn.status, 'WAITING') = 'WAITING'
      order by t.created_on, t.ibt_number limit ${limit}`),
  ]);
  return [...sales.map(fromSale), ...transfers.map(fromTransfer)].sort(compareQueue);
}

/** Cabang kasir Gudang = cabang kasir yang ditautkan ke cabang garasi HRIS (Pengaturan › Mobil & Rute). */
export async function homeKasirBranchId(executor: Executor = db): Promise<number | null> {
  const rows = await executor.execute<{ kasir_branch_id: number | null }>(sql`
    select b.kasir_branch_id from logistics.config c join hris.branches b on b.id = c.garage_branch_id where c.id = 1`);
  const value = rows[0]?.kasir_branch_id;
  return value == null ? null : Number(value);
}

/** Kunci surat jalan yang sedang aktif di trip ini. */
async function activeKeys(tx: Executor, tripId: number) {
  const rows = await tx.select({ linkId: tripVisitNotes.id, noteId: deliveryNotes.id, kind: deliveryNotes.kind, docId: deliveryNotes.docId, visitId: tripVisits.id })
    .from(tripVisitNotes).innerJoin(tripVisits, eq(tripVisits.id, tripVisitNotes.visitId)).innerJoin(deliveryNotes, eq(deliveryNotes.id, tripVisitNotes.noteId))
    .where(and(eq(tripVisits.tripId, tripId), eq(tripVisitNotes.active, true)));
  return rows.map((r) => ({ ...r, key: noteKey(r.kind as NoteKind, r.docId) }));
}

type EndOptions = { tripId: number; kind: 'RELEASED' | 'TRIP_CANCELLED' | 'TRIP_CLOSED'; reason: string; accountId: number | null; now: Date; tomorrow?: boolean };

/** Lepas surat jalan dari kunjungannya: kembali Menunggu + riwayat. */
async function endLinks(tx: Tx, links: { linkId: number; noteId: number }[], options: EndOptions) {
  if (!links.length) return;
  await tx.update(tripVisitNotes).set({ active: false, endedAt: options.now }).where(inArray(tripVisitNotes.id, links.map((l) => l.linkId)));
  await tx.update(deliveryNotes).set({
    status: 'WAITING', updatedAt: options.now, ...(options.tomorrow ? { tomorrowCount: sql`${deliveryNotes.tomorrowCount} + 1` } : {}),
  }).where(and(inArray(deliveryNotes.id, links.map((l) => l.noteId)), eq(deliveryNotes.status, 'ON_TRIP')));
  await tx.insert(deliveryNoteEvents).values(links.map((l) => ({
    noteId: l.noteId, kind: options.kind, tripId: options.tripId, reason: options.reason, byAccountId: options.accountId, at: options.now,
  })));
}

/**
 * Rapikan bentuk trip sesudah surat jalan berubah: kunjungan terbuka tanpa surat jalan dilepas; langkah ambil barang
 * dibuat untuk tiap cabang asal selain Gudang, yang tidak lagi dibutuhkan dan belum diambil menjadi "Tidak jadi".
 */
async function reshapeTrip(tx: Tx, tripId: number, accountId: number | null, reason: string, now: Date) {
  await tx.execute(sql`
    update logistics.trip_visits v set status = 'RELEASED', released_at = ${now.toISOString()}::timestamptz, released_by_account_id = ${accountId}, reason = ${reason}
    where v.trip_id = ${tripId} and v.status = 'OPEN'
      and not exists (select 1 from logistics.trip_visit_notes l where l.visit_id = v.id and l.active)`);
  const notes = await tx.select({ originBranchId: deliveryNotes.originBranchId }).from(tripVisitNotes)
    .innerJoin(tripVisits, eq(tripVisits.id, tripVisitNotes.visitId)).innerJoin(deliveryNotes, eq(deliveryNotes.id, tripVisitNotes.noteId))
    .where(and(eq(tripVisits.tripId, tripId), eq(tripVisitNotes.active, true)));
  const home = await homeKasirBranchId(tx);
  const names = await tx.execute<{ id: number; name: string }>(sql`select id, name from hris.kasir_branches where id in (${ids([...new Set(notes.map((n) => n.originBranchId))])})`);
  const nameOf = new Map(names.map((n) => [Number(n.id), n.name]));
  const wanted = pickupOrigins(notes.map((n) => ({ originBranchId: n.originBranchId, origin: nameOf.get(n.originBranchId) ?? `Cabang #${n.originBranchId}` })), home);
  const current = await tx.select().from(tripPickups).where(and(eq(tripPickups.tripId, tripId), inArray(tripPickups.status, ['OPEN', 'DONE'])));
  const unneeded = current.filter((p) => p.status === 'OPEN' && !wanted.some((w) => w.originBranchId === p.originBranchId));
  if (unneeded.length) {
    await tx.update(tripPickups).set({ status: 'DROPPED', reason: 'Tidak ada surat jalan dari cabang ini lagi', closedAt: now })
      .where(inArray(tripPickups.id, unneeded.map((p) => p.id)));
  }
  const missing = wanted.filter((w) => !current.some((p) => p.originBranchId === w.originBranchId));
  if (missing.length) await tx.insert(tripPickups).values(missing.map((w) => ({ tripId, originBranchId: w.originBranchId, originName: w.origin })));
}

/** Periksa kunci sebelum trip ditulis. Mengembalikan dokumen kasirnya atau pesan salah. */
export async function checkNoteKeys(keys: string[], tripId: number | null): Promise<{ ok: true; notes: LiveNote[] } | { ok: false; error: string }> {
  const unique = [...new Set(keys)];
  if (unique.length > MAX_NOTES_PER_TRIP) return { ok: false, error: `Satu trip paling banyak ${MAX_NOTES_PER_TRIP} surat jalan.` };
  const parsed = unique.map((k) => (parseNoteKey(k) ? (k as NoteKey) : null));
  if (parsed.some((k) => k == null)) return { ok: false, error: 'Data surat jalan tidak valid.' };
  if (!unique.length) return { ok: true, notes: [] };
  const live = await liveNotesFor(parsed as NoteKey[]);
  const current = tripId ? new Set((await activeKeys(db, tripId)).map((k) => k.key)) : new Set<NoteKey>();
  const today = wibDate(new Date());
  const from = String(await settingOn<string>('logistics.delivery_from', today));
  const notes: LiveNote[] = [];
  for (const key of parsed as NoteKey[]) {
    const note = live.get(key);
    if (!note) return { ok: false, error: 'Surat jalan tidak ditemukan di kasir. Muat ulang halaman.' };
    if (current.has(key)) { notes.push(note); continue; }
    if (!note.waiting) return { ok: false, error: `${note.number} sudah tidak menunggu dikirim di kasir (dibatalkan, diterima, atau cara kirimnya diubah).` };
    if (note.on < from) return { ok: false, error: `${note.number} bertanggal sebelum ${from}, tidak masuk antrean surat jalan.` };
    notes.push(note);
  }
  return { ok: true, notes };
}

/**
 * Samakan isi surat jalan trip Draft dengan pilihan di form (spec LT1 §3.4): yang dicentang masuk trip (Dalam perjalanan),
 * yang dilepas kembali Menunggu. Dipanggil di dalam transaksi pembuat/pengubah trip. Bentrok = TripNotesConflict.
 */
export async function syncDraftNotes(tx: Tx, tripId: number, notes: LiveNote[], accountId: number) {
  const now = new Date();
  const current = await activeKeys(tx, tripId);
  const wanted = new Set(notes.map((n) => n.key));
  await endLinks(tx, current.filter((c) => !wanted.has(c.key)), { tripId, kind: 'RELEASED', reason: 'Dilepas saat trip diubah sebelum berangkat', accountId, now });
  const have = new Set(current.map((c) => c.key));
  const added = notes.filter((n) => !have.has(n.key));
  if (added.length) {
    const openVisits = await tx.select().from(tripVisits).where(and(eq(tripVisits.tripId, tripId), eq(tripVisits.status, 'OPEN')));
    for (const visit of planVisits(added)) {
      let target = openVisits.find((v) => (visit.customerId != null ? v.customerId === visit.customerId : v.destinationBranchId === visit.destinationBranchId));
      if (!target) {
        [target] = await tx.insert(tripVisits).values({
          tripId, customerId: visit.customerId, destinationBranchId: visit.destinationBranchId, destinationName: visit.destination,
        }).returning();
        openVisits.push(target);
      }
      for (const key of visit.keys) {
        const note = added.find((n) => n.key === key)!;
        const [row] = await tx.insert(deliveryNotes).values({
          kind: note.kind, docId: note.docId, number: note.number, originBranchId: note.originBranchId, customerId: note.customerId,
          destinationBranchId: note.destinationBranchId, status: 'ON_TRIP', amountAtTrip: note.amount, revisionAtTrip: note.revision,
        }).onConflictDoUpdate({
          target: [deliveryNotes.kind, deliveryNotes.docId],
          set: { status: 'ON_TRIP', amountAtTrip: note.amount, revisionAtTrip: note.revision, updatedAt: now },
          setWhere: sql`${deliveryNotes.status} = 'WAITING'`,
        }).returning({ id: deliveryNotes.id });
        if (!row) {
          const [busy] = await tx.execute<{ number: string }>(sql`
            select t.number from logistics.delivery_notes dn join logistics.trip_visit_notes l on l.note_id = dn.id and l.active
            join logistics.trip_visits v on v.id = l.visit_id join logistics.trips t on t.id = v.trip_id
            where dn.kind = ${note.kind} and dn.doc_id = ${note.docId}`);
          throw new TripNotesConflict(busy ? `${note.number} sudah ada di trip ${busy.number}.` : `${note.number} sudah tidak menunggu dikirim.`);
        }
        await tx.insert(tripVisitNotes).values({ visitId: target.id, noteId: row.id, addedByAccountId: accountId });
        await tx.insert(deliveryNoteEvents).values({ noteId: row.id, kind: 'ON_TRIP', tripId, byAccountId: accountId, at: now });
      }
    }
  }
  await reshapeTrip(tx, tripId, accountId, 'Dilepas saat trip diubah sebelum berangkat', now);
}

/** Trip Draft dibatalkan: semua surat jalannya kembali Menunggu (LOG-23). */
export async function releaseAllOnCancel(tx: Tx, tripId: number, reason: string, accountId: number) {
  const now = new Date();
  await endLinks(tx, await activeKeys(tx, tripId), { tripId, kind: 'TRIP_CANCELLED', reason, accountId, now });
  await tx.update(tripPickups).set({ status: 'DROPPED', reason: 'Trip dibatalkan', closedAt: now })
    .where(and(eq(tripPickups.tripId, tripId), eq(tripPickups.status, 'OPEN')));
  await reshapeTrip(tx, tripId, accountId, `Trip dibatalkan: ${reason}`, now);
}

/**
 * Trip ditutup (Sampai Garasi / kantor): kunjungan yang belum diproses menjadi Kirim Besok dan surat jalannya kembali
 * Menunggu bertanda tertunda; ambil barang yang belum diambil menjadi Belum siap (spec LT1 §3.7).
 */
export async function settleOnClose(tx: Tx, tripId: number, accountId: number | null, now: Date) {
  const reason = 'Trip ditutup sebelum kunjungan diproses';
  const open = await tx.select({ id: tripVisits.id }).from(tripVisits).where(and(eq(tripVisits.tripId, tripId), eq(tripVisits.status, 'OPEN')));
  if (open.length) {
    const links = (await activeKeys(tx, tripId)).filter((k) => open.some((v) => v.id === k.visitId));
    await endLinks(tx, links, { tripId, kind: 'TRIP_CLOSED', reason, accountId, now, tomorrow: true });
    await tx.update(tripVisits).set({ status: 'TOMORROW', processedAt: now, reason }).where(inArray(tripVisits.id, open.map((v) => v.id)));
  }
  await tx.update(tripPickups).set({ status: 'NOT_READY', reason: 'Belum diambil saat trip ditutup', closedAt: now })
    .where(and(eq(tripPickups.tripId, tripId), eq(tripPickups.status, 'OPEN')));
}

/** Lepas kunjungan yang belum diproses (spec LT1 §3.4): kantor, alasan wajib; surat jalannya kembali Menunggu. */
export async function releaseVisit(actor: Actor | null, tripId: number, visitId: number, reason: string): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.trip.manage')) return fail(403, FORBIDDEN);
  const reasonError = reasonProblem(reason);
  if (reasonError) return fail(400, reasonError);
  return db.transaction(async (tx) => {
    const [trip] = await tx.select().from(trips).where(eq(trips.id, tripId)).for('update').limit(1);
    if (!trip) return fail(404, 'Trip tidak ditemukan.');
    if (trip.status !== 'DRAFT' && trip.status !== 'RUNNING') return fail(409, 'Trip ini sudah ditutup.');
    const [visit] = await tx.select().from(tripVisits).where(and(eq(tripVisits.id, visitId), eq(tripVisits.tripId, tripId))).for('update').limit(1);
    if (!visit) return fail(404, 'Kunjungan tidak ditemukan.');
    if (visit.status !== 'OPEN') return fail(409, 'Kunjungan ini sudah diproses atau sudah dilepas.');
    const now = new Date();
    await endLinks(tx, (await activeKeys(tx, tripId)).filter((k) => k.visitId === visitId), { tripId, kind: 'RELEASED', reason: reason.trim(), accountId: actor.accountId, now });
    await tx.update(tripVisits).set({ status: 'RELEASED', releasedAt: now, releasedByAccountId: actor.accountId, reason: reason.trim() }).where(eq(tripVisits.id, visitId));
    await reshapeTrip(tx, tripId, actor.accountId, reason.trim(), now);
    return { ok: true as const, data: undefined };
  });
}

/** Ambil barang di cabang asal selesai (spec LT1 §3.5, keputusan owner J): awak trip, satu foto barang diterima driver. */
export async function finishPickup(actor: Actor | null, tripId: number, pickupId: number, photo: File | null): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId)).limit(1);
  if (!trip) return fail(404, 'Trip tidak ditemukan.');
  const crew = await db.execute<{ id: number }>(sql`
    select id from logistics.trip_crew where trip_id = ${tripId} and employee_id = ${actor.personId} and removed_at is null`);
  if (!crew.length) return fail(403, 'Hanya awak trip ini yang bisa menandai ambil barang.');
  if (trip.status !== 'RUNNING') return fail(409, 'Ambil barang ditandai selama trip berjalan.');
  const [pickup] = await db.select().from(tripPickups).where(and(eq(tripPickups.id, pickupId), eq(tripPickups.tripId, tripId))).limit(1);
  if (!pickup || pickup.status !== 'OPEN') return fail(409, 'Langkah ambil barang ini sudah selesai atau tidak jadi.');
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  return db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx.update(tripPickups).set({ status: 'DONE', photoFileId: upload.data.id, doneAt: now, doneByEmployeeId: actor.personId })
      .where(and(eq(tripPickups.id, pickupId), eq(tripPickups.status, 'OPEN'))).returning({ id: tripPickups.id });
    if (!row) return fail(409, 'Langkah ambil barang ini sudah selesai atau tidak jadi.');
    const loaded = (await activeKeys(tx, tripId));
    const fromOrigin = loaded.length ? await tx.select({ id: deliveryNotes.id }).from(deliveryNotes)
      .where(and(inArray(deliveryNotes.id, loaded.map((l) => l.noteId)), eq(deliveryNotes.originBranchId, pickup.originBranchId))) : [];
    if (fromOrigin.length) {
      await tx.insert(deliveryNoteEvents).values(fromOrigin.map((n) => ({ noteId: n.id, kind: 'LOADED', tripId, byEmployeeId: actor.personId, at: now })));
    }
    return { ok: true as const, data: undefined };
  });
}

export type TripNoteView = {
  key: NoteKey; kind: NoteKind; number: string; on: IsoDate; age: number; origin: string; amount: number | null;
  change: KasirChange; tomorrowCount: number; link: string | null;
};
export type TripVisitView = {
  id: number; destination: string; customerId: number | null; status: VisitStatus; statusLabel: string; tone: 'info' | 'ok' | 'warn' | 'danger';
  reason: string | null; at: string | null; notes: TripNoteView[]; waitsForPickup: string[];
};
export type TripPickupView = { id: number; origin: string; status: PickupStatus; statusLabel: string; reason: string | null; photoUrl: string | null; noteCount: number };

/** Isi surat jalan trip untuk rincian trip dan Trip Saya. */
export async function tripNotesView(tripId: number, executor: Executor = db): Promise<{ visits: TripVisitView[]; pickups: TripPickupView[] }> {
  const [visits, pickups, links] = await Promise.all([
    executor.select().from(tripVisits).where(eq(tripVisits.tripId, tripId)).orderBy(tripVisits.id),
    executor.select().from(tripPickups).where(eq(tripPickups.tripId, tripId)).orderBy(tripPickups.id),
    executor.select({ visitId: tripVisitNotes.visitId, active: tripVisitNotes.active, note: deliveryNotes }).from(tripVisitNotes)
      .innerJoin(tripVisits, eq(tripVisits.id, tripVisitNotes.visitId)).innerJoin(deliveryNotes, eq(deliveryNotes.id, tripVisitNotes.noteId))
      .where(eq(tripVisits.tripId, tripId)).orderBy(tripVisitNotes.id),
  ]);
  const live = await liveNotesFor(links.map((l) => noteKey(l.note.kind as NoteKind, l.note.docId)), executor);
  const today = wibDate(new Date());
  const base = backofficeBase();
  const pickupOrigin = new Map(pickups.filter((p) => p.status === 'OPEN').map((p) => [p.originBranchId, p.originName]));
  const clock = (at: Date | null) => (at ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).format(at).replace(':', '.') : null);
  return {
    visits: visits.map((v) => {
      // Kunjungan terbuka menampilkan surat jalan yang aktif; yang sudah lewat menampilkan yang pernah dibawanya.
      const mine = links.filter((l) => l.visitId === v.id && (v.status === 'OPEN' ? l.active : true));
      const notes = mine.map((l): TripNoteView => {
        const key = noteKey(l.note.kind as NoteKind, l.note.docId);
        const doc = live.get(key);
        return {
          key, kind: l.note.kind as NoteKind, number: l.note.number, on: doc?.on ?? today, age: doc ? ageDays(doc.on, today) : 0,
          origin: doc?.origin ?? '-', amount: doc?.amount ?? null,
          change: doc && v.status === 'OPEN'
            ? kasirChange({ amount: l.note.amountAtTrip, revision: l.note.revisionAtTrip }, { amount: doc.amount, revision: doc.revision, status: doc.kasirStatus })
            : null,
          tomorrowCount: l.note.tomorrowCount, link: backofficeLink(base, l.note.kind as NoteKind, { number: l.note.number, id: l.note.docId }),
        };
      });
      const waits = v.status === 'OPEN'
        ? [...new Set(mine.map((l) => pickupOrigin.get(l.note.originBranchId)).filter((o): o is string => !!o))]
        : [];
      const status = v.status as VisitStatus;
      return {
        id: v.id, destination: v.destinationName, customerId: v.customerId, status, statusLabel: VISIT_LABELS[status], tone: VISIT_TONES[status],
        reason: v.reason, at: clock(v.releasedAt ?? v.processedAt), notes, waitsForPickup: waits,
      };
    }),
    pickups: pickups.map((p) => ({
      id: p.id, origin: p.originName, status: p.status as PickupStatus, statusLabel: PICKUP_LABELS[p.status as PickupStatus], reason: p.reason,
      photoUrl: p.photoFileId ? `/api/logistics/photo?trip=${tripId}&file=${p.photoFileId}` : null,
      noteCount: links.filter((l) => l.active && l.note.originBranchId === p.originBranchId).length,
    })),
  };
}

/** Kunci surat jalan aktif sebuah trip (isi awal form Ubah trip). */
export async function draftNoteKeys(tripId: number): Promise<NoteKey[]> {
  return (await activeKeys(db, tripId)).map((k) => k.key);
}

/** Foto ambil barang milik trip ini (untuk pintu foto trip). */
export async function pickupPhotoIds(tripId: number): Promise<string[]> {
  const rows = await db.select({ id: tripPickups.photoFileId }).from(tripPickups).where(eq(tripPickups.tripId, tripId));
  return rows.map((r) => r.id).filter((id): id is string => !!id);
}
