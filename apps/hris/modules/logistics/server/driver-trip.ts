import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { deliveryNoteEvents, deliveryNotes, routes, tripEndReports, tripShopping, trips, tripVisitNotes, tripVisits, vehicles } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, listEmployeesWithAnyAction, type Actor, type ServiceResult } from '@/modules/access';
import { saveUpload } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { settingOn } from '@/modules/settings';
import {
  CONDITION_LABELS, VISIT_REASONS, cleanEndReport, deliverProblem, endReportDue, headHomeProblem, reasonLabel, reopenOpen, visitReason,
  type Condition, type EndReportInput, type VisitOutcome,
} from '../rules/driver-trip';
import { contentProblem, reasonProblem, validPoint, wibClock, wibDate, type IsoDate } from '../rules/trip';
import { rupiah } from '../rules/rates';
import { cleanPayment, cleanPromise } from '../rules/store-payments';
import { FORBIDDEN, accountsOf, fail, loadTrip, managerAccounts, peopleNames, type LoadedTrip } from './data';
import { rateProblem } from './rates';
import { distanceFromPoint } from './store-points';
import { openVisitBills, recordPayment, type PaymentInput } from './store-payments';
import { activeKeys, endLinks, reshapeTrip, settleOnClose, tripNotesView } from './trip-notes';

// Alur trip di HP driver (spec LT1 §13.3, LT1b-2a). Semua langkah lewat pintu server ini (LOG-24).

type Point = { latitude?: number | null; longitude?: number | null; accuracy?: number | null };

const NOT_FOUND = 'Trip tidak ditemukan.';

function cleanPoint(point: Point | null | undefined) {
  return point && validPoint(point.latitude, point.longitude)
    ? { latitude: point.latitude as number, longitude: point.longitude as number, accuracy: point.accuracy != null ? Math.round(point.accuracy) : null }
    : null;
}

const crewMember = (loaded: LoadedTrip, actor: Actor) => loaded.activeCrew.find((c) => c.employeeId === actor.personId) ?? null;

async function decideAccounts(): Promise<number[]> {
  return accountsOf(await listEmployeesWithAnyAction(['logistics.delivery_note.decide']));
}

async function followupAccounts(): Promise<number[]> {
  return accountsOf(await listEmployeesWithAnyAction(['logistics.vehicle_followup.manage']));
}

/** Trip yang sedang dijalankan awak ini: Berjalan dan belum Menuju Garasi. */
export async function runningForCrew(actor: Actor | null, tripId: number): Promise<{ ok: true; loaded: LoadedTrip } | { ok: false; status: 400 | 403 | 404 | 409; error: string }> {
  if (!actor) return fail(403, FORBIDDEN);
  const loaded = await loadTrip(tripId);
  if (!loaded) return fail(404, NOT_FOUND);
  if (!crewMember(loaded, actor)) return fail(403, 'Hanya awak trip ini yang bisa melakukannya.');
  if (loaded.trip.status !== 'RUNNING') return fail(409, loaded.trip.status === 'DONE' ? 'Trip ini sudah selesai.' : 'Trip ini belum berangkat.');
  if (loaded.trip.headingHomeAt) return fail(409, 'Trip sudah Menuju Garasi.');
  return { ok: true, loaded };
}

/** Siap Kirim (§13.3 butir 1): kantor, selagi Draft; syarat awak, isi, dan tarif. Awak diberi tahu. */
export async function markReady(actor: Actor | null, id: number): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.trip.manage')) return fail(403, FORBIDDEN);
  const loaded = await loadTrip(id);
  if (!loaded) return fail(404, NOT_FOUND);
  const t = loaded.trip;
  if (t.status !== 'DRAFT') return fail(409, 'Hanya trip Draft yang bisa dibuat Siap Kirim.');
  if (t.readyAt) return fail(409, 'Trip ini sudah Siap Kirim.');
  if (!loaded.activeCrew.some((c) => c.role === 'DRIVER')) return fail(409, 'Trip ini belum punya driver.');
  const openShopping = loaded.shopping.filter((s) => s.status === 'OPEN').map((s) => s.routeId);
  const content = contentProblem(t.routeId, openShopping);
  if (content) return fail(409, content);
  const unrated = await rateProblem(t.vehicleId, [...(t.routeId ? [t.routeId] : []), ...openShopping], wibDate(new Date()));
  if (unrated) return fail(409, unrated);
  return db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx.update(trips).set({ readyAt: now, readyByAccountId: actor.accountId, updatedAt: now })
      .where(and(eq(trips.id, id), eq(trips.status, 'DRAFT'), isNull(trips.readyAt))).returning({ number: trips.number });
    if (!row) return fail(409, 'Trip ini sudah berubah. Muat ulang halaman.');
    await notify(tx, await accountsOf(loaded.activeCrew.map((c) => c.employeeId)), {
      kind: 'logistics.ready', title: `Trip ${row.number} siap kirim`, body: 'Buka Trip Saya lalu tekan Berangkat saat mobil keluar.',
      link: '/trip-saya', entity: 'trip', entityId: id,
    }, actor.accountId);
    return { ok: true as const, data: undefined };
  });
}

/** Kembali ke Draft (§13.3 butir 1): sebelum Berangkat, supaya trip bisa diubah lagi. */
export async function unmarkReady(actor: Actor | null, id: number): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.trip.manage')) return fail(403, FORBIDDEN);
  const [row] = await db.update(trips).set({ readyAt: null, readyByAccountId: null, updatedAt: new Date() })
    .where(and(eq(trips.id, id), eq(trips.status, 'DRAFT'), sql`${trips.readyAt} is not null`)).returning({ id: trips.id });
  return row ? { ok: true, data: undefined } : fail(409, 'Hanya trip Siap Kirim yang belum berangkat yang bisa dikembalikan ke Draft.');
}

/** Pesan "sudah diproses" untuk tekanan kedua (LOG-26). */
async function alreadyProcessed(visitId: number): Promise<string> {
  const [visit] = await db.select().from(tripVisits).where(eq(tripVisits.id, visitId)).limit(1);
  if (!visit || visit.status === 'RELEASED') return 'Kunjungan ini sudah dilepas kantor. Muat ulang halaman.';
  const name = visit.processedByEmployeeId ? (await peopleNames()).get(visit.processedByEmployeeId) : null;
  return `Sudah diproses${name ? ` ${name}` : ''}${visit.processedAt ? ` pukul ${wibClock(visit.processedAt)}` : ''}.`;
}

export type VisitInput = {
  outcome: 'DELIVERED' | VisitOutcome; reasonCode?: string | null; note?: string | null; point?: Point | null;
  /** Cara bayar toko saat Terkirim (spec LT1 §13.5); wajib untuk kunjungan ke toko yang punya tagihan. */
  payment?: PaymentInput | null;
};

/** Dilempar di dalam transaksi kunjungan supaya seluruh perubahan dibatalkan; pesannya diteruskan ke layar. */
class VisitRollback extends Error {
  constructor(readonly status: 400 | 409, message: string) { super(message); }
}

/**
 * Kunjungan Terkirim / Kirim Besok / Gagal (§13.3 butir 2): awak trip, foto wajib (kamera langsung), lokasi dicatat.
 * Terkirim → surat jalan Terkirim; Kirim Besok → kembali Menunggu, tertunda +1; Gagal → Perlu keputusan.
 */
export async function processVisit(
  actor: Actor | null, tripId: number, visitId: number, input: VisitInput, photo: File | null, proof: File | null = null,
): Promise<ServiceResult> {
  const reason = input.outcome === 'DELIVERED' ? null : visitReason(input.outcome, input.reasonCode ?? '', input.note);
  if (reason && !reason.ok) return fail(400, reason.error);
  const running = await runningForCrew(actor, tripId);
  if (!running.ok) return running;
  const [visit] = await db.select().from(tripVisits).where(and(eq(tripVisits.id, visitId), eq(tripVisits.tripId, tripId))).limit(1);
  if (!visit) return fail(404, 'Kunjungan tidak ditemukan.');
  if (visit.status !== 'OPEN') return fail(409, await alreadyProcessed(visitId));
  if (input.outcome === 'DELIVERED') {
    const view = (await tripNotesView(tripId)).visits.find((v) => v.id === visitId);
    const problem = deliverProblem({
      waitsForPickup: view?.waitsForPickup ?? [],
      // Menunggu batal di kasir = peringatan saja; batal final ditolak (spec LT1 §14.3 butir 6).
      cancelledNumbers: (view?.notes ?? []).filter((n) => n.change?.kind === 'cancelled' && !n.change.pending).map((n) => n.number),
    });
    if (problem) return fail(409, problem);
  }
  // Cara bayar toko (§13.5 butir 2): diperiksa dulu dengan tagihan sekarang, dihitung ulang di dalam transaksi.
  const paying = input.outcome === 'DELIVERED' && visit.customerId != null;
  let proofId: string | null = null;
  if (paying) {
    const bill = (await openVisitBills([visitId])).get(visitId) ?? 0;
    const clean = cleanPayment(bill, input.payment?.method, input.payment?.partialAmount);
    if (!clean.ok) return fail(400, clean.error);
    const promise = cleanPromise(clean.method, input.payment?.promiseDate, wibDate(new Date()));
    if (!promise.ok) return fail(400, promise.error);
    if (clean.method === 'TRANSFER') {
      const proofUpload = await saveUpload(actor, proof);
      if (!proofUpload.ok) return fail(400, proofUpload.status === 400 ? `Bukti transfer: ${proofUpload.error}` : proofUpload.error);
      proofId = proofUpload.data.id;
    }
  }
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  const where = cleanPoint(input.point);
  const me = actor!;
  try {
    return await db.transaction(async (tx) => {
    const now = new Date();
    // Jarak dari titik toko Disetujui hanya dicatat untuk Terkirim (spec LT1 §13.4 butir 5).
    const distanceM = input.outcome === 'DELIVERED' ? await distanceFromPoint(tx, visit.customerId, where) : null;
    const [done] = await tx.update(tripVisits).set({
      status: input.outcome, processedAt: now, processedByEmployeeId: me.personId, photoFileId: upload.data.id,
      reason: reason?.ok ? reason.text : null, reasonCode: reason?.ok ? reason.code : null,
      latitude: where?.latitude ?? null, longitude: where?.longitude ?? null, accuracyM: where?.accuracy ?? null, distanceM,
    }).where(and(eq(tripVisits.id, visitId), eq(tripVisits.status, 'OPEN'))).returning({ id: tripVisits.id });
    if (!done) return fail(409, await alreadyProcessed(visitId));
    const [trip] = await tx.select({ status: trips.status, heading: trips.headingHomeAt, number: trips.number }).from(trips).where(eq(trips.id, tripId)).for('update');
    if (trip.status !== 'RUNNING' || trip.heading) throw new VisitRollback(409, 'Trip ini sudah Menuju Garasi atau ditutup.');
    if (paying) {
      const paid = await recordPayment(tx, { id: visitId, tripId, customerId: visit.customerId! }, input.payment ?? {}, proofId, { employeeId: me.personId, accountId: me.accountId }, now);
      if (!paid.ok) throw new VisitRollback(paid.status, paid.error);
    }
    const links = (await activeKeys(tx, tripId)).filter((k) => k.visitId === visitId);
    await endLinks(tx, links, {
      tripId, kind: input.outcome, reason: reason?.ok ? reason.text : null, accountId: me.accountId, employeeId: me.personId, now,
      toStatus: input.outcome === 'DELIVERED' ? 'DELIVERED' : input.outcome === 'FAILED' ? 'NEEDS_DECISION' : 'WAITING',
      tomorrow: input.outcome === 'TOMORROW',
    });
    // Ambil barang yang tidak lagi dibutuhkan (isinya Kirim Besok / Gagal semua) menjadi "Tidak jadi".
    if (input.outcome !== 'DELIVERED') await reshapeTrip(tx, tripId, me.accountId, 'Kunjungan tujuannya tidak terkirim', now);
    if (input.outcome === 'FAILED' && reason?.ok) {
      await notify(tx, await decideAccounts(), {
        kind: 'logistics.visit_failed', title: `Kiriman ke ${visit.destinationName} gagal (trip ${trip.number})`,
        body: `${reason.text}. Putuskan Kirim ulang atau Batal di Surat Jalan › Perlu keputusan.`,
        link: '/logistik/surat-jalan?tab=NEEDS_DECISION', entity: 'trip_visit', entityId: visitId,
      }, me.accountId);
    }
    return { ok: true as const, data: undefined };
    });
  } catch (error) {
    if (error instanceof VisitRollback) return fail(error.status, error.message);
    throw error;
  }
}

/** Coba lagi kunjungan Kirim Besok selama trip masih Berjalan (LOG-121): surat jalan yang masih Menunggu dibawa kembali. */
export async function retryVisit(actor: Actor | null, tripId: number, visitId: number): Promise<ServiceResult> {
  const running = await runningForCrew(actor, tripId);
  if (!running.ok) return running;
  const me = actor!;
  return db.transaction(async (tx) => {
    const [visit] = await tx.select().from(tripVisits).where(and(eq(tripVisits.id, visitId), eq(tripVisits.tripId, tripId))).for('update').limit(1);
    if (!visit || visit.status !== 'TOMORROW') return fail(409, 'Hanya kunjungan Kirim Besok yang bisa dicoba lagi.');
    const [open] = await tx.select({ id: tripVisits.id }).from(tripVisits).where(and(
      eq(tripVisits.tripId, tripId), eq(tripVisits.status, 'OPEN'),
      visit.customerId != null ? eq(tripVisits.customerId, visit.customerId) : eq(tripVisits.destinationBranchId, visit.destinationBranchId!),
    )).limit(1);
    if (open) return fail(409, 'Tujuan ini sudah ada lagi di daftar kunjungan.');
    const notes = await tx.select({ id: deliveryNotes.id }).from(tripVisitNotes).innerJoin(deliveryNotes, eq(deliveryNotes.id, tripVisitNotes.noteId))
      .where(and(eq(tripVisitNotes.visitId, visitId), eq(deliveryNotes.status, 'WAITING')));
    if (!notes.length) return fail(409, 'Surat jalannya sudah dimasukkan ke trip lain atau dibatalkan.');
    const now = new Date();
    const [fresh] = await tx.insert(tripVisits).values({
      tripId, customerId: visit.customerId, destinationBranchId: visit.destinationBranchId, destinationName: visit.destinationName,
    }).returning({ id: tripVisits.id });
    const noteIds = notes.map((n) => n.id);
    const moved = await tx.update(deliveryNotes).set({ status: 'ON_TRIP', tomorrowCount: sql`greatest(${deliveryNotes.tomorrowCount} - 1, 0)`, updatedAt: now })
      .where(and(inArray(deliveryNotes.id, noteIds), eq(deliveryNotes.status, 'WAITING'))).returning({ id: deliveryNotes.id });
    if (!moved.length) throw new Error('surat jalan berubah');
    await tx.insert(tripVisitNotes).values(moved.map((n) => ({ visitId: fresh.id, noteId: n.id, addedByAccountId: me.accountId })));
    await tx.insert(deliveryNoteEvents).values(moved.map((n) => ({ noteId: n.id, kind: 'RETRY', tripId, byEmployeeId: me.personId, at: now })));
    await reshapeTrip(tx, tripId, me.accountId, 'Coba lagi', now);
    return { ok: true as const, data: undefined };
  });
}

/**
 * Foto bak kosong → Menuju Garasi (§13.3 butir 3, 4). Tanpa `earlyReason` hanya bila semua kunjungan, ambil barang,
 * dan belanja beres; dengan alasan = Selesai lebih awal (sisa → Kirim Besok / Belum siap / Tidak jadi).
 */
export async function headHome(actor: Actor | null, tripId: number, photo: File | null, earlyReason: string | null): Promise<ServiceResult> {
  const running = await runningForCrew(actor, tripId);
  if (!running.ok) return running;
  const early = earlyReason?.trim() ? earlyReason.trim() : null;
  if (early) {
    const reasonError = reasonProblem(early);
    if (reasonError) return fail(400, reasonError);
  }
  const left = await leftovers(running.loaded);
  const problem = headHomeProblem(left);
  if (problem && !early) return fail(409, problem);
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  const me = actor!;
  return db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx.update(trips).set({
      headingHomeAt: now, headingHomeByEmployeeId: me.personId, emptyBedPhotoFileId: upload.data.id, earlyFinishReason: problem ? early : null, updatedAt: now,
    }).where(and(eq(trips.id, tripId), eq(trips.status, 'RUNNING'), isNull(trips.headingHomeAt))).returning({ number: trips.number });
    if (!row) return fail(409, 'Trip ini sudah Menuju Garasi atau ditutup.');
    if (problem && early) {
      const reason = `Selesai lebih awal: ${early}`;
      await settleOnClose(tx, tripId, me.accountId, now, { reason, employeeId: me.personId, kind: 'TOMORROW' });
      await tx.update(tripShopping).set({ status: 'DROPPED', dropReason: reason, droppedAt: now })
        .where(and(eq(tripShopping.tripId, tripId), eq(tripShopping.status, 'OPEN')));
      await notify(tx, await managerAccounts(), {
        kind: 'logistics.early_finish', title: `Trip ${row.number} selesai lebih awal`, body: `${early}. Sisa: ${problem.replace(/^Masih ada /, '').split('.')[0]}.`,
        link: `/logistik/trip/${tripId}`, entity: 'trip', entityId: tripId,
      }, me.accountId);
    }
    return { ok: true as const, data: undefined };
  });
}

async function leftovers(loaded: LoadedTrip) {
  const [view, routeRows] = await Promise.all([
    tripNotesView(loaded.trip.id),
    db.select({ id: routes.id, name: routes.name }).from(routes),
  ]);
  const routeName = new Map(routeRows.map((r) => [r.id, r.name]));
  return {
    visits: view.visits.filter((v) => v.status === 'OPEN').length,
    pickups: view.pickups.filter((p) => p.status === 'OPEN').map((p) => p.origin),
    shopping: loaded.shopping.filter((s) => s.status === 'OPEN').map((s) => routeName.get(s.routeId) ?? 'supplier'),
  };
}

/** Laporan Pulang trip (§13.3 butir 5): driver aktif trip Selesai hari ini/kemarin, sekali. */
export async function sendEndReport(actor: Actor | null, tripId: number, input: EndReportInput, photo: File | null): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  const clean = cleanEndReport(input);
  if (!clean.ok) return fail(400, clean.error);
  const loaded = await loadTrip(tripId);
  if (!loaded) return fail(404, NOT_FOUND);
  if (!loaded.activeCrew.some((c) => c.employeeId === actor.personId && c.role === 'DRIVER')) return fail(403, 'Laporan Pulang trip diisi driver trip ini.');
  if (loaded.trip.status !== 'DONE') return fail(409, 'Laporan Pulang diisi sesudah Sampai Garasi.');
  if (!endReportDue(loaded.trip.tripDate, wibDate(new Date()))) return fail(409, 'Waktu mengisi Laporan Pulang trip ini sudah lewat.');
  const [existing] = await db.select({ id: tripEndReports.id }).from(tripEndReports).where(eq(tripEndReports.tripId, tripId)).limit(1);
  if (existing) return fail(409, 'Laporan Pulang trip ini sudah terkirim.');
  let photoId: string | null = null;
  if (photo && clean.value.condition === 'ATTENTION') {
    const upload = await saveUpload(actor, photo);
    if (!upload.ok) return upload;
    photoId = upload.data.id;
  }
  const value = clean.value;
  return db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx.insert(tripEndReports).values({
      tripId, vehicleId: loaded.trip.vehicleId, employeeId: actor.personId, condition: value.condition, conditionNote: value.conditionNote,
      conditionPhotoFileId: photoId, needsFuel: value.needsFuel, fuelEstimate: value.fuelEstimate, problemNote: value.problemNote, sentAt: now,
    }).onConflictDoNothing({ target: tripEndReports.tripId }).returning({ id: tripEndReports.id });
    if (!row) return fail(409, 'Laporan Pulang trip ini sudah terkirim.');
    // Satu permintaan bensin Menunggu per mobil (LOG-143): yang baru menggantikan yang lama.
    if (value.needsFuel) {
      await tx.update(tripEndReports).set({ fuelCloseKind: 'REPLACED', fuelClosedAt: now })
        .where(and(eq(tripEndReports.vehicleId, loaded.trip.vehicleId), eq(tripEndReports.needsFuel, true), isNull(tripEndReports.fuelClosedAt),
          sql`${tripEndReports.id} <> ${row.id}`));
    }
    const [vehicle] = await tx.select({ name: vehicles.name, plate: vehicles.plate }).from(vehicles).where(eq(vehicles.id, loaded.trip.vehicleId));
    const parts = [
      value.condition === 'ATTENTION' ? `Mobil perlu perhatian: ${value.conditionNote}` : null,
      value.needsFuel ? `Perlu isi bensin besok ± ${rupiah(value.fuelEstimate!)}` : null,
      value.problemNote ? `Masalah: ${value.problemNote}` : null,
    ].filter(Boolean);
    if (parts.length) {
      await notify(tx, await followupAccounts(), {
        kind: 'logistics.end_report', title: `Laporan Pulang ${vehicle ? `${vehicle.name} (${vehicle.plate})` : `trip ${loaded.trip.number}`}`,
        body: parts.join(' · '), link: '/logistik/bensin-mobil', entity: 'trip_end_report', entityId: row.id,
      }, actor.accountId);
    }
    return { ok: true as const, data: undefined };
  });
}

/** Mobil perlu perhatian → Selesai (§13.3 butir 6), catatan boleh. */
export async function closeCondition(actor: Actor | null, reportId: number, note: string | null): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.vehicle_followup.manage')) return fail(403, FORBIDDEN);
  const text = (note ?? '').trim();
  if (text.length > 300) return fail(400, 'Catatan paling panjang 300 huruf.');
  const [row] = await db.update(tripEndReports)
    .set({ conditionClosedAt: new Date(), conditionClosedByAccountId: actor.accountId, conditionCloseNote: text || null })
    .where(and(eq(tripEndReports.id, reportId), eq(tripEndReports.condition, 'ATTENTION'), isNull(tripEndReports.conditionClosedAt)))
    .returning({ id: tripEndReports.id });
  return row ? { ok: true, data: undefined } : fail(409, 'Keadaan mobil ini sudah ditandai selesai.');
}

/** Perlu keputusan (§3.9, §13.3 butir 7): Kirim ulang (kembali Menunggu, tertunda +1) atau Batal (alasan wajib). */
export async function decideNote(actor: Actor | null, noteId: number, decision: 'RESEND' | 'DROP', reason: string): Promise<ServiceResult> {
  if (!actor || !can(actor, 'logistics.delivery_note.decide')) return fail(403, FORBIDDEN);
  const text = reason.trim();
  if (decision === 'DROP') {
    const reasonError = reasonProblem(text);
    if (reasonError) return fail(400, reasonError);
  }
  return db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx.update(deliveryNotes).set({
      status: decision === 'RESEND' ? 'WAITING' : 'CANCELLED', updatedAt: now,
      ...(decision === 'RESEND' ? { tomorrowCount: sql`${deliveryNotes.tomorrowCount} + 1` } : {}),
    }).where(and(eq(deliveryNotes.id, noteId), eq(deliveryNotes.status, 'NEEDS_DECISION'))).returning({ id: deliveryNotes.id });
    if (!row) return fail(409, 'Surat jalan ini sudah diputuskan. Muat ulang halaman.');
    await tx.insert(deliveryNoteEvents).values({ noteId, kind: decision === 'RESEND' ? 'RESENT' : 'DROPPED', reason: text || null, byAccountId: actor.accountId, at: now });
    return { ok: true as const, data: undefined };
  });
}

/** Buka lagi Batal logistik (§3.9): Pemilik/GM, paling lama `logistics.reopen_days` hari; kembali ke Perlu keputusan. */
export async function reopenNote(actor: Actor | null, noteId: number): Promise<ServiceResult> {
  if (!actor || !actor.fullAccess) return fail(403, 'Hanya Pemilik atau GM yang bisa membuka lagi surat jalan yang dibatalkan.');
  const now = new Date();
  const days = Number(await settingOn<number>('logistics.reopen_days', wibDate(now)));
  return db.transaction(async (tx) => {
    const [dropped] = await tx.select({ at: deliveryNoteEvents.at }).from(deliveryNoteEvents)
      .where(and(eq(deliveryNoteEvents.noteId, noteId), eq(deliveryNoteEvents.kind, 'DROPPED'))).orderBy(desc(deliveryNoteEvents.id)).limit(1);
    if (!dropped) return fail(409, 'Surat jalan ini tidak dibatalkan logistik.');
    if (!reopenOpen(dropped.at, now, days)) return fail(409, `Batal lebih dari ${days} hari lalu tidak bisa dibuka lagi.`);
    const [row] = await tx.update(deliveryNotes).set({ status: 'NEEDS_DECISION', updatedAt: now })
      .where(and(eq(deliveryNotes.id, noteId), eq(deliveryNotes.status, 'CANCELLED'))).returning({ id: deliveryNotes.id });
    if (!row) return fail(409, 'Surat jalan ini sudah berubah. Muat ulang halaman.');
    await tx.insert(deliveryNoteEvents).values({ noteId, kind: 'REOPENED', byAccountId: actor.accountId, at: now });
    return { ok: true as const, data: undefined };
  });
}

export type EndReportPending = { tripId: number; number: string; vehicle: string; tripDate: IsoDate };

/** Laporan Pulang yang masih ditunggu dari driver ini (kartu di Trip Saya). */
export async function pendingEndReports(actor: Actor | null): Promise<EndReportPending[]> {
  if (!actor) return [];
  const today = wibDate(new Date());
  const rows = await db.execute<{ id: number; number: string; trip_date: string; vehicle: string }>(sql`
    select t.id, t.number, t.trip_date::text as trip_date, v.name || ' (' || v.plate || ')' as vehicle
    from logistics.trips t join logistics.trip_crew c on c.trip_id = t.id and c.employee_id = ${actor.personId} and c.role = 'DRIVER' and c.removed_at is null
    join logistics.vehicles v on v.id = t.vehicle_id
    where t.status = 'DONE' and t.trip_date >= (${today}::date - 1)
      and not exists (select 1 from logistics.trip_end_reports r where r.trip_id = t.id)
    order by t.finished_at`);
  return rows.filter((r) => endReportDue(r.trip_date, today)).map((r) => ({ tripId: Number(r.id), number: r.number, vehicle: r.vehicle, tripDate: r.trip_date }));
}

export type FollowupRow = {
  id: number; tripId: number; tripNumber: string; vehicle: string; driver: string; sentAt: string; sentOn: IsoDate;
  fuelEstimate: number | null; condition: Condition; conditionLabel: string; conditionNote: string | null; problemNote: string | null; photoUrl: string | null;
};

/** Bensin & Mobil (§13.3 butir 6): permintaan bensin dan keadaan mobil yang belum ditindaklanjuti, plus 30 terakhir yang sudah. */
export async function followupScreen(actor: Actor | null) {
  if (!actor || !can(actor, 'logistics.vehicle_followup.manage')) return null;
  const [rows, names] = await Promise.all([
    db.execute<{
      id: number; trip_id: number; number: string; vehicle: string; employee_id: number; sent_at: string; fuel_estimate: number | null; needs_fuel: boolean;
      fuel_closed_at: string | null; fuel_close_kind: string | null; condition: Condition; condition_note: string | null; condition_closed_at: string | null;
      condition_close_note: string | null; problem_note: string | null; condition_photo_file_id: string | null;
    }>(sql`
      select r.id, r.trip_id, t.number, v.name || ' (' || v.plate || ')' as vehicle, r.employee_id, r.sent_at, r.fuel_estimate, r.needs_fuel,
        r.fuel_closed_at, r.fuel_close_kind, r.condition, r.condition_note, r.condition_closed_at, r.condition_close_note, r.problem_note, r.condition_photo_file_id
      from logistics.trip_end_reports r join logistics.trips t on t.id = r.trip_id join logistics.vehicles v on v.id = r.vehicle_id
      where (r.needs_fuel and r.fuel_closed_at is null) or (r.condition = 'ATTENTION' and r.condition_closed_at is null) or r.problem_note is not null
        or r.sent_at > now() - interval '14 days'
      order by r.sent_at desc limit 200`),
    peopleNames(),
  ]);
  const view = (r: (typeof rows)[number]): FollowupRow => {
    const sent = new Date(r.sent_at);
    return {
      id: Number(r.id), tripId: Number(r.trip_id), tripNumber: r.number, vehicle: r.vehicle, driver: names.get(Number(r.employee_id)) ?? '-',
      sentAt: wibClock(sent), sentOn: wibDate(sent), fuelEstimate: r.fuel_estimate == null ? null : Number(r.fuel_estimate),
      condition: r.condition, conditionLabel: CONDITION_LABELS[r.condition], conditionNote: r.condition_note, problemNote: r.problem_note,
      photoUrl: r.condition_photo_file_id ? `/api/logistics/photo?trip=${r.trip_id}&file=${r.condition_photo_file_id}` : null,
    };
  };
  return {
    fuel: rows.filter((r) => r.needs_fuel && !r.fuel_closed_at).map(view),
    condition: rows.filter((r) => r.condition === 'ATTENTION' && !r.condition_closed_at).map(view),
    recent: rows.slice(0, 30).map((r) => ({
      ...view(r),
      fuelState: !r.needs_fuel ? null : !r.fuel_closed_at ? 'Menunggu' : r.fuel_close_kind === 'REPLACED' ? 'Diganti laporan baru' : 'Sudah diisi',
      conditionState: r.condition !== 'ATTENTION' ? null : r.condition_closed_at ? `Selesai${r.condition_close_note ? `: ${r.condition_close_note}` : ''}` : 'Menunggu',
    })),
  };
}

/** Kartu Beranda (§13.3 butir 6, 7): bensin dan mobil menunggu (tindak lanjut), surat jalan perlu keputusan (decide). */
export async function followupAttention(actor: Actor | null) {
  if (!actor) return null;
  const canFollow = can(actor, 'logistics.vehicle_followup.manage');
  const canDecide = can(actor, 'logistics.delivery_note.decide');
  if (!canFollow && !canDecide) return null;
  const counts = await countFollowup();
  return {
    fuel: canFollow ? Number(counts.fuel) : 0, condition: canFollow ? Number(counts.condition) : 0, decide: canDecide ? Number(counts.decide) : 0,
  };
}

/** Hitung permintaan bensin Menunggu, mobil perlu perhatian, surat jalan perlu keputusan tanpa pemeriksaan hak (Dashboard Logistik). */
export async function countFollowup(): Promise<{ fuel: number; condition: number; decide: number }> {
  const [counts] = await db.execute<{ fuel: number; condition: number; decide: number }>(sql`
    select
      (select count(*)::int from logistics.trip_end_reports where needs_fuel and fuel_closed_at is null) as fuel,
      (select count(*)::int from logistics.trip_end_reports where condition = 'ATTENTION' and condition_closed_at is null) as condition,
      (select count(*)::int from logistics.delivery_notes where status = 'NEEDS_DECISION') as decide`);
  return { fuel: Number(counts.fuel), condition: Number(counts.condition), decide: Number(counts.decide) };
}

/** Laporan Pulang + foto trip (rincian trip). */
export async function endReportOf(tripId: number) {
  const [row] = await db.select().from(tripEndReports).where(eq(tripEndReports.tripId, tripId)).limit(1);
  if (!row) return null;
  const names = await peopleNames();
  return {
    by: names.get(row.employeeId) ?? '-', at: wibClock(row.sentAt), conditionLabel: CONDITION_LABELS[row.condition as Condition], conditionNote: row.conditionNote,
    fuel: row.needsFuel ? row.fuelEstimate : null, problemNote: row.problemNote,
    photoUrl: row.conditionPhotoFileId ? `/api/logistics/photo?trip=${tripId}&file=${row.conditionPhotoFileId}` : null,
  };
}

export async function endReportPhotoIds(tripId: number): Promise<string[]> {
  const rows = await db.select({ id: tripEndReports.conditionPhotoFileId }).from(tripEndReports).where(eq(tripEndReports.tripId, tripId));
  return rows.map((r) => r.id).filter((id): id is string => !!id);
}

export { VISIT_REASONS, reasonLabel };
