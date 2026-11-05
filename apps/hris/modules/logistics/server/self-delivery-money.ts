import { and, eq, isNull } from 'drizzle-orm';
import { selfTripEvents, selfTripPayments, selfTrips, selfTripStops, visitReportItems, visitReports } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, listEmployeesWithAnyAction, type Actor, type ServiceResult } from '@/modules/access';
import { saveUpload } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { rupiah } from '../rules/rates';
import { cleanReturnItems, type ReturnItemInput } from '../rules/returned-goods';
import { cashOf } from '../rules/self-delivery';
import { cashAfterCorrection, selfCorrectProblem } from '../rules/self-delivery-office';
import { PAYMENT_LABELS, cleanPayment, cleanPromise, cleanReport, REPORT_LABELS, type PaymentMethod } from '../rules/store-payments';
import { reasonProblem, wibDate } from '../rules/trip';
import { FORBIDDEN, accountsOf, fail } from './data';
import { branchAccounts } from './self-delivery';
import type { PaymentInput } from './store-payments';

// Uang & laporan antar sendiri (spec LT1 §15.4, LT3d): koreksi cara bayar (PJ selama berjalan, sesudahnya kantor cabang;
// tunai yang sudah diterima laci dibuka lagi bila jumlahnya berubah) dan Lapor masalah / retur dari tujuan antar sendiri.

const CASH = 'logistics.self_delivery.cash_receive';
const MANAGE = 'logistics.self_delivery.manage';

class Rollback extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, message: string) { super(message); }
}

/** Boleh mengoreksi cara bayar perjalanan ini? (untuk menampilkan tombol). */
export function canCorrectSelf(actor: Actor, trip: { status: string; employeeId: number; branchId: number }): boolean {
  return selfCorrectProblem({
    running: trip.status === 'RUNNING', isPj: trip.employeeId === actor.personId, canManage: can(actor, MANAGE, { branchId: trip.branchId }),
  }) === null;
}

/**
 * Koreksi cara bayar salah tekan antar sendiri (spec LT1 §15.4 butir 2): aturan isi sama dengan truk (§14.2 butir 4) —
 * alasan wajib, tagihan tetap tagihan saat Terkirim, transfer wajib bukti, baris lama Diganti, Finance diberi tahu.
 * Sesudah Foto 3 tunai perjalanan dihitung ulang; bila sudah diterima laci dan jumlahnya berubah, penerimaan dibuka lagi.
 */
export async function correctSelfPayment(
  actor: Actor | null, stopId: number, input: PaymentInput & { reason?: string | null }, proof: File | null,
): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  const [current] = await db.select().from(selfTripPayments)
    .where(and(eq(selfTripPayments.stopId, stopId), isNull(selfTripPayments.replacedAt))).limit(1);
  if (!current) return fail(404, 'Cara bayar tujuan ini tidak ditemukan.');
  const [peek] = await db.select().from(selfTrips).where(eq(selfTrips.id, current.tripId)).limit(1);
  if (!peek) return fail(404, 'Perjalanan antar tidak ditemukan.');
  const problem = selfCorrectProblem({
    running: peek.status === 'RUNNING', isPj: peek.employeeId === actor.personId, canManage: can(actor, MANAGE, { branchId: peek.branchId }),
  });
  if (problem) return fail(403, problem);
  if (current.billAmount === 0) return fail(409, 'Tujuan ini tidak punya tagihan.');
  const reason = (input.reason ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
  const reasonError = reasonProblem(reason);
  if (reasonError) return fail(400, reasonError);
  const clean = cleanPayment(current.billAmount, input.method, input.partialAmount);
  if (!clean.ok) return fail(400, clean.error);
  const now = new Date();
  const promise = cleanPromise(clean.method, input.promiseDate, wibDate(now));
  if (!promise.ok) return fail(400, promise.error);
  if (clean.method === current.method && clean.received === current.receivedAmount && promise.date === current.promiseDate && !proof) {
    return fail(400, 'Tidak ada yang berubah.');
  }
  let proofId: string | null = null;
  if (clean.method === 'TRANSFER') {
    if (proof) {
      const upload = await saveUpload(actor, proof);
      if (!upload.ok) return fail(400, upload.status === 400 ? `Bukti transfer: ${upload.error}` : upload.error);
      proofId = upload.data.id;
    } else if (current.proofPhotoFileId) proofId = current.proofPhotoFileId;
    else return fail(400, 'Foto bukti transfer wajib.');
  }
  try {
    return await db.transaction(async (tx) => {
      const [trip] = await tx.select().from(selfTrips).where(eq(selfTrips.id, current.tripId)).for('update').limit(1);
      if (!trip) throw new Rollback(404, 'Perjalanan antar tidak ditemukan.');
      const again = selfCorrectProblem({
        running: trip.status === 'RUNNING', isPj: trip.employeeId === actor.personId, canManage: can(actor, MANAGE, { branchId: trip.branchId }),
      });
      if (again) throw new Rollback(409, `${again} Muat ulang halaman.`);
      const [old] = await tx.update(selfTripPayments).set({ replacedAt: now })
        .where(and(eq(selfTripPayments.id, current.id), isNull(selfTripPayments.replacedAt))).returning({ id: selfTripPayments.id });
      if (!old) throw new Rollback(409, 'Cara bayar ini baru saja dikoreksi orang lain. Muat ulang halaman.');
      await tx.insert(selfTripPayments).values({
        stopId, tripId: current.tripId, transactionId: current.transactionId, customerId: current.customerId, method: clean.method,
        billAmount: current.billAmount, receivedAmount: clean.received, proofPhotoFileId: proofId, promiseDate: promise.date,
        recordedByEmployeeId: actor.personId, recordedByAccountId: actor.accountId, recordedAt: now, correctionOfId: current.id, correctionReason: reason,
      });
      const running = trip.status === 'RUNNING';
      const payments = await tx.select({ method: selfTripPayments.method, receivedAmount: selfTripPayments.receivedAmount })
        .from(selfTripPayments).where(and(eq(selfTripPayments.tripId, trip.id), isNull(selfTripPayments.replacedAt)));
      const received = !!trip.cashReceivedAt;
      const next = cashAfterCorrection({ running, cashBefore: trip.cashAmount, cashAfter: cashOf(payments), received });
      if (!running && (next.cash !== trip.cashAmount || next.reopen)) {
        await tx.update(selfTrips).set({
          cashAmount: next.cash,
          ...(next.reopen ? { cashReceivedAt: null, cashReceivedByEmployeeId: null, cashReceivedByAccountId: null } : {}),
        }).where(eq(selfTrips.id, trip.id));
      }
      const [stop] = await tx.select({ name: selfTripStops.destinationName, trx: selfTripStops.trxNumber }).from(selfTripStops).where(eq(selfTripStops.id, stopId));
      const change = `${PAYMENT_LABELS[current.method as PaymentMethod]} → ${PAYMENT_LABELS[clean.method]}`;
      await tx.insert(selfTripEvents).values({
        tripId: trip.id, stopId, kind: 'PAYMENT_CORRECTED', reason: `${change}. ${reason}`.slice(0, 600),
        cashBefore: running ? 0 : trip.cashAmount, cashAfter: running ? 0 : next.cash, cashReceivedBefore: received ? trip.cashAmount : null,
        byEmployeeId: actor.personId, byAccountId: actor.accountId, at: now,
      });
      const tripDate = wibDate(trip.startedAt);
      await notify(tx, await accountsOf(await listEmployeesWithAnyAction(['logistics.store_payment.view'])), {
        kind: 'logistics.payment_corrected', title: `Cara bayar ${stop?.name ?? 'tujuan'} dikoreksi (antar ${trip.number})`,
        body: `${change}. Alasan: ${reason}`, link: `/logistik/uang-toko?tanggal=${tripDate}&sumber=SELF`, entity: 'self_trip_payment', entityId: current.id,
      }, actor.accountId);
      if (!running && next.cash !== trip.cashAmount) {
        const body = next.reopen
          ? next.cash > 0
            ? `Sebelumnya diterima ${rupiah(trip.cashAmount)}. Hitung ulang laci, lalu tekan Sudah diterima untuk ${rupiah(next.cash)}.`
            : `Sebelumnya diterima ${rupiah(trip.cashAmount)}, sekarang tidak ada tunai. Periksa laci dan laporkan ke Finance.`
          : `Tunai yang menunggu diterima kini ${rupiah(next.cash)}.`;
        await notify(tx, (await branchAccounts(trip.branchId, CASH)).filter((a) => a !== trip.accountId), {
          kind: 'logistics.self_cash', title: `Tunai antar ${trip.number} berubah: ${rupiah(trip.cashAmount)} → ${rupiah(next.cash)}`,
          body, link: '/logistik/antar-sendiri/kantor?tab=CASH', entity: 'self_trip', entityId: trip.id,
        }, actor.accountId);
      }
      return { ok: true as const, data: undefined };
    });
  } catch (error) {
    if (error instanceof Rollback) return fail(error.status, error.message);
    throw error;
  }
}

/**
 * Lapor masalah / retur dari tujuan antar sendiri (spec LT1 §15.4 butir 3): PJ, sesudah Terkirim dan sebelum Foto 3. Pilihan
 * baku + foto sama dengan truk; masuk Laporan Toko untuk keputusan potong nota Finance. Retur dibawa PJ ke cabangnya sendiri
 * (tanpa langkah Barang kembali); pemilik barang = cabang kasir perjalanan itu.
 */
export async function addSelfStopReport(
  actor: Actor | null, tripId: number, stopId: number,
  input: { kind?: string | null; note?: string | null; items?: ReturnItemInput[] | null }, photo: File | null,
): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  const clean = cleanReport(input.kind, input.note);
  if (!clean.ok) return fail(400, clean.error);
  const items = clean.kind === 'RETURN' ? cleanReturnItems(input.items) : null;
  if (items && !items.ok) return fail(400, items.error);
  const [peek] = await db.select().from(selfTrips).where(eq(selfTrips.id, tripId)).limit(1);
  if (!peek || peek.employeeId !== actor.personId) return fail(404, 'Perjalanan antar tidak ditemukan.');
  if (peek.status !== 'RUNNING') return fail(409, 'Lapor masalah dibuat sebelum Foto 3 (kembali di cabang).');
  const [stop] = await db.select().from(selfTripStops).where(and(eq(selfTripStops.id, stopId), eq(selfTripStops.tripId, tripId))).limit(1);
  if (!stop) return fail(404, 'Tujuan tidak ditemukan di perjalanan ini.');
  if (stop.status !== 'DELIVERED') return fail(409, 'Lapor masalah dibuat sesudah Terkirim.');
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  try {
    return await db.transaction(async (tx) => {
      const [trip] = await tx.select().from(selfTrips).where(eq(selfTrips.id, tripId)).for('update').limit(1);
      if (!trip || trip.employeeId !== actor.personId) throw new Rollback(403, 'Hanya PJ perjalanan ini yang bisa melapor.');
      if (trip.status !== 'RUNNING') throw new Rollback(409, 'Perjalanan ini sudah kembali (Foto 3).');
      const [row] = await tx.insert(visitReports).values({
        visitId: null, tripId: null, selfStopId: stopId, selfTripId: tripId, customerId: stop.customerId, kind: clean.kind, note: clean.note,
        photoFileId: upload.data.id, carriedBack: clean.kind === 'RETURN', ownerBranchId: clean.kind === 'RETURN' ? trip.kasirBranchId : null,
        reportedByEmployeeId: actor.personId,
      }).returning({ id: visitReports.id });
      if (items?.ok) await tx.insert(visitReportItems).values(items.items.map((i) => ({ reportId: row.id, ...i })));
      const office = await accountsOf(await listEmployeesWithAnyAction(['logistics.delivery_note.decide', 'logistics.note_cut.decide']));
      const branch = await branchAccounts(trip.branchId, MANAGE);
      await notify(tx, [...new Set([...office, ...branch])].filter((a) => a !== actor.accountId), {
        kind: 'logistics.visit_report', title: `${REPORT_LABELS[clean.kind]}: ${stop.destinationName} (antar ${trip.number})`,
        body: `${clean.note ? `${clean.note}. ` : ''}Finance memutuskan potong nota di Laporan Toko.`,
        link: '/logistik/laporan-toko', entity: 'visit_report', entityId: row.id,
      }, actor.accountId);
      return { ok: true as const, data: undefined };
    });
  } catch (error) {
    if (error instanceof Rollback) return fail(error.status, error.message);
    throw error;
  }
}
