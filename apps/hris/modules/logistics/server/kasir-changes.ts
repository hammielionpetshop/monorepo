import { sql } from 'drizzle-orm';
import { deliveryNoteEvents } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, type Actor, type ServiceResult } from '@/modules/access';
import { notify } from '@/modules/notifications';
import type { NoteKind } from '../rules/delivery-notes';
import { rupiah } from '../rules/rates';
import { kasirChange, kasirChangeKey, kasirChangeText, noteKey, type KasirChange } from '../rules/trip-notes';
import { FORBIDDEN, accountsOf, fail, managerAccounts, type Executor } from './data';
import { liveNotesFor } from './trip-notes';

// Nota berubah / dibatalkan di kasir sesudah masuk trip (spec LT1 §14.3). Pemeriksa berkala `logistics-kasir-check`
// (tiap 10 menit) membandingkan dokumen kasir dengan nominal/revisi saat masuk trip, lalu memberi tahu Kepala Gudang dan
// awak trip sekali per keadaan. Kepala Gudang memutuskan Lepas (sudah ada) atau Tetap antar.

type OnTripRow = {
  note_id: number; trip_id: number; trip_number: string; number: string; kind: string; doc_id: number;
  amount_at_trip: number | null; revision_at_trip: number | null;
};

/** Surat jalan aktif di kunjungan terbuka pada trip yang belum selesai (Draft / Berjalan). */
async function onTripNotes(executor: Executor, tripId?: number) {
  return executor.execute<OnTripRow>(sql`
    select dn.id as note_id, v.trip_id, t.number as trip_number, dn.number, dn.kind, dn.doc_id, dn.amount_at_trip, dn.revision_at_trip
    from logistics.trip_visit_notes l
    join logistics.trip_visits v on v.id = l.visit_id and v.status = 'OPEN'
    join logistics.trips t on t.id = v.trip_id and t.status in ('DRAFT', 'RUNNING')
    join logistics.delivery_notes dn on dn.id = l.note_id
    where l.active ${tripId == null ? sql`` : sql`and v.trip_id = ${tripId}`}`);
}

type Detected = OnTripRow & { change: NonNullable<KasirChange>; kind: string; signature: string; toAmount: number | null; revision: number | null };

async function detect(rows: OnTripRow[], executor: Executor): Promise<Detected[]> {
  const live = await liveNotesFor(rows.map((r) => noteKey(r.kind as NoteKind, Number(r.doc_id))), executor);
  const found: Detected[] = [];
  for (const row of rows) {
    const doc = live.get(noteKey(row.kind as NoteKind, Number(row.doc_id)));
    if (!doc) continue;
    const change = kasirChange(
      { amount: row.amount_at_trip == null ? null : Number(row.amount_at_trip), revision: row.revision_at_trip == null ? null : Number(row.revision_at_trip) },
      { amount: doc.amount, revision: doc.revision, status: doc.kasirStatus },
    );
    const key = kasirChangeKey(change, doc.revision);
    if (!change || !key) continue;
    found.push({ ...row, change, kind: key.kind, signature: key.signature, toAmount: doc.amount, revision: doc.revision });
  }
  return found;
}

/**
 * Pemeriksa berkala (spec LT1 §14.3 butir 1–3), aman diulang. Keadaan baru → baris `kasir_changes` + riwayat + pemberitahuan.
 * Keadaan lama yang sudah tidak berlaku (kasir kembali seperti semula, diubah lagi, atau surat jalan lepas dari trip) ditutup.
 */
export async function runKasirCheck(now: Date = new Date()) {
  const rows = await onTripNotes(db);
  const found = await detect([...rows], db);
  const current = found.map((f) => sql`(${Number(f.note_id)}, ${Number(f.trip_id)}, ${f.signature})`);
  const cleared = await db.execute(sql`
    update logistics.kasir_changes k set cleared_at = ${now.toISOString()}::timestamptz
    where k.kept_at is null and k.cleared_at is null
      ${current.length ? sql`and (k.note_id, k.trip_id, k.signature) not in (${sql.join(current, sql`, `)})` : sql``}
    returning k.id`);
  if (!found.length) return { checked: rows.length, notified: 0, cleared: cleared.length };
  const managers = await managerAccounts();
  const crewOf = new Map<number, number[]>();
  let notified = 0;
  for (const f of found) {
    const tripId = Number(f.trip_id);
    const fromAmount = f.amount_at_trip == null ? null : Number(f.amount_at_trip);
    await db.transaction(async (tx) => {
      // Keadaan yang sama muncul lagi sesudah ditutup (mis. nominal kembali lalu berubah lagi) = diberi tahu lagi.
      const [row] = await tx.execute<{ id: number }>(sql`
        insert into logistics.kasir_changes (note_id, trip_id, kind, signature, from_amount, to_amount, revision, detected_at)
        values (${Number(f.note_id)}, ${tripId}, ${f.kind}, ${f.signature}, ${fromAmount}, ${f.toAmount}, ${f.revision}, ${now.toISOString()}::timestamptz)
        on conflict (note_id, trip_id, signature) do update set cleared_at = null, detected_at = excluded.detected_at
          where logistics.kasir_changes.cleared_at is not null and logistics.kasir_changes.kept_at is null
        returning id`);
      if (!row) return;
      const text = kasirChangeText(f.number, f.change, rupiah);
      await tx.insert(deliveryNoteEvents).values({ noteId: Number(f.note_id), kind: 'KASIR_CHANGED', tripId, reason: text, at: now });
      if (!crewOf.has(tripId)) {
        const crew = await tx.execute<{ employee_id: number }>(sql`
          select employee_id from logistics.trip_crew where trip_id = ${tripId} and removed_at is null`);
        crewOf.set(tripId, await accountsOf(crew.map((c) => Number(c.employee_id))));
      }
      const crew = crewOf.get(tripId)!.filter((id) => !managers.includes(id));
      const cancelled = f.change.kind === 'cancelled' && !f.change.pending;
      await notify(tx, managers, {
        kind: 'logistics.kasir_changed', title: `${text} (trip ${f.trip_number})`,
        body: cancelled ? 'Lepas kunjungannya dari trip; driver tidak bisa menandai Terkirim.' : 'Buka rincian trip: Lepas atau Tetap antar.',
        link: `/logistik/trip/${tripId}`, entity: 'delivery_note', entityId: Number(f.note_id),
      }, null);
      await notify(tx, crew, {
        kind: 'logistics.kasir_changed', title: `${text} (trip ${f.trip_number})`,
        body: cancelled ? 'Jangan diantar dulu; tunggu Kepala Gudang.' : 'Tagih sesuai tagihan baru di Trip Saya.',
        link: '/trip-saya', entity: 'delivery_note', entityId: Number(f.note_id),
      }, null);
      notified += 1;
    });
  }
  return { checked: rows.length, notified, cleared: cleared.length };
}

/** Tetap antar (spec LT1 §14.3 butir 4): Kepala Gudang menerima perubahan kasir; tanda jadi abu-abu, hilang dari Beranda. */
export async function keepKasirChange(actor: Actor | null, tripId: number, noteId: number): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.trip.manage')) return fail(403, FORBIDDEN);
  return db.transaction(async (tx) => {
    const [trip] = await tx.execute<{ status: string }>(sql`select status from logistics.trips where id = ${tripId} for update`);
    if (!trip) return fail(404, 'Trip tidak ditemukan.');
    if (trip.status !== 'DRAFT' && trip.status !== 'RUNNING') return fail(409, 'Trip ini sudah ditutup.');
    const rows = (await onTripNotes(tx, tripId)).filter((r) => Number(r.note_id) === noteId);
    if (!rows.length) return fail(409, 'Surat jalan ini sudah tidak ada di kunjungan terbuka trip ini.');
    const [found] = await detect(rows, tx);
    if (!found) return fail(409, 'Nota ini sudah sama lagi dengan saat masuk trip. Muat ulang halaman.');
    if (found.kind === 'CANCELLED') return fail(409, 'Nota sudah dibatalkan di kasir. Lepas kunjungannya dari trip.');
    const now = new Date();
    const fromAmount = found.amount_at_trip == null ? null : Number(found.amount_at_trip);
    await tx.execute(sql`
      insert into logistics.kasir_changes (note_id, trip_id, kind, signature, from_amount, to_amount, revision, detected_at, kept_at, kept_by_account_id)
      values (${noteId}, ${tripId}, ${found.kind}, ${found.signature}, ${fromAmount}, ${found.toAmount}, ${found.revision},
        ${now.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz, ${actor.accountId})
      on conflict (note_id, trip_id, signature) do update set kept_at = excluded.kept_at, kept_by_account_id = excluded.kept_by_account_id, cleared_at = null
        where logistics.kasir_changes.kept_at is null`);
    await tx.execute(sql`
      update logistics.kasir_changes set cleared_at = ${now.toISOString()}::timestamptz
      where note_id = ${noteId} and trip_id = ${tripId} and signature <> ${found.signature} and kept_at is null and cleared_at is null`);
    await tx.insert(deliveryNoteEvents).values({
      noteId, kind: 'KASIR_KEPT', tripId, reason: `Tetap antar: ${kasirChangeText(found.number, found.change, rupiah)}`, byAccountId: actor.accountId, at: now,
    });
    return { ok: true as const, data: undefined };
  });
}

/**
 * Kartu Beranda "Nota berubah di kasir" (spec LT1 §14.3 butir 5): keadaan yang belum diputuskan pada surat jalan yang masih
 * di kunjungan terbuka. Kepala Gudang, Pemilik, GM (`logistics.trip.manage`).
 */
export async function kasirChangeAttention(actor: Actor | null): Promise<{ count: number; tripId: number | null } | null> {
  if (!actor || !can(actor, 'logistics.trip.manage')) return null;
  const rows = await db.execute<{ trip_id: number; n: number }>(sql`
    select k.trip_id, count(distinct k.note_id)::int as n
    from logistics.kasir_changes k
    join logistics.trips t on t.id = k.trip_id and t.status in ('DRAFT', 'RUNNING')
    join logistics.trip_visit_notes l on l.note_id = k.note_id and l.active
    join logistics.trip_visits v on v.id = l.visit_id and v.trip_id = k.trip_id and v.status = 'OPEN'
    where k.kept_at is null and k.cleared_at is null
    group by k.trip_id`);
  const count = rows.reduce((sum, r) => sum + Number(r.n), 0);
  if (!count) return null;
  return { count, tripId: rows.length === 1 ? Number(rows[0].trip_id) : null };
}
