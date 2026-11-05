import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { selfTripPayments, selfTrips, selfTripStops } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, type Actor, type ServiceResult, type Tx } from '@/modules/access';
import { saveUpload } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { settingOn } from '@/modules/settings';
import { VISIT_REASONS, visitReason, type VisitOutcome } from '../rules/driver-trip';
import { rupiah } from '../rules/rates';
import {
  GAP_REASONS, SELF_STOP_LABELS, SELF_TRIP_LABELS, cashLate, cashOf, cleanGapReason, gapMinutes, isVoided, photoDeadlinePassed, selfTripNumber,
  stageWaitProblem, stopsProblem, type SelfStopStatus, type SelfTripStatus,
} from '../rules/self-delivery';
import { PAYMENT_LABELS, billOf, cleanPayment, cleanPromise, leftToCollect, type PaymentMethod } from '../rules/store-payments';
import { addDays, validPoint, wibClock, wibDate, type IsoDate } from '../rules/trip';
import { FORBIDDEN, accountsOf, fail, isUniqueViolation, peopleNames, type Executor } from './data';
import { distanceFromPoint, pointsOf } from './store-points';

// Antar sendiri di HP pengantar (spec LT1 §15.2, LT3b). Tugas antar dibaca hidup dari nota kasir "Diantar kurir cabang"
// (view logistics.pos_courier_sales); perjalanan, tujuan, dan cara bayar milik HRIS. Bukan trip truk: tanpa ritase/upah.

const RUN = 'logistics.self_delivery.run';
const CASH = 'logistics.self_delivery.cash_receive';
const VIEW = 'logistics.self_delivery.view';
const ids = (values: number[]) => sql.join((values.length ? values : [-1]).map((v) => sql`${v}`), sql`, `);
const stamp = (at: Date | null) => (at ? `${wibDate(at)} ${wibClock(at)}` : null);

type Point = { latitude?: number | null; longitude?: number | null; accuracy?: number | null };
function cleanPoint(point: Point | null | undefined) {
  return point && validPoint(point.latitude, point.longitude)
    ? { latitude: point.latitude as number, longitude: point.longitude as number, accuracy: point.accuracy != null ? Math.round(point.accuracy) : null }
    : null;
}

class Rollback extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, message: string) { super(message); }
}

export type HomeBranch = { id: number; name: string; kasirBranchId: number };

/** Cabang HRIS penempatan pelaku yang punya cabang kasir. */
async function homeBranch(actor: Actor): Promise<HomeBranch | null> {
  if (actor.branchId == null) return null;
  const [row] = await db.execute<{ id: number; name: string; kasir_branch_id: number | null }>(sql`
    select id, name, kasir_branch_id from hris.branches where id = ${actor.branchId}`);
  return row?.kasir_branch_id != null ? { id: Number(row.id), name: row.name, kasirBranchId: Number(row.kasir_branch_id) } : null;
}

/**
 * Sudah absen masuk dan belum pulang (LOG-110). Hari kemarin yang belum pulang masih berlaku sampai batas absen pulang
 * (KEH-18), sama dengan hari aktif di modul Kehadiran.
 */
async function onDuty(employeeId: number, now: Date, executor: Executor = db): Promise<boolean> {
  const today = wibDate(now);
  const rows = await executor.execute<{ work_date: string; has_in: boolean; has_out: boolean }>(sql`
    select d.work_date::text as work_date,
      exists (select 1 from hris.attendance_records r where r.day_id = d.id and r.kind = 'IN') as has_in,
      exists (select 1 from hris.attendance_records r where r.day_id = d.id and r.kind = 'OUT') as has_out
    from hris.attendance_days d
    where d.employee_id = ${employeeId} and d.work_date in (${today}::date, ${addDays(today, -1)}::date)
    order by d.work_date desc`);
  const todayRow = rows.find((r) => String(r.work_date).slice(0, 10) === today);
  if (todayRow) return todayRow.has_in && !todayRow.has_out;
  const previous = rows[0];
  if (!previous || !previous.has_in || previous.has_out) return false;
  const workDate = String(previous.work_date).slice(0, 10);
  const cutoff = Number(await settingOn<number>('attendance.out_cutoff_hour', workDate, {}, executor));
  return now < new Date(`${addDays(workDate, 1)}T${String(cutoff).padStart(2, '0')}:00:00+07:00`);
}

/** Nomor perjalanan antar sendiri yang masih berjalan milik orang ini (pintu untuk absen Pulang, LOG-110). */
export async function runningSelfTripNumber(employeeId: number, executor: Executor = db): Promise<string | null> {
  const [row] = await executor.select({ number: selfTrips.number }).from(selfTrips)
    .where(and(eq(selfTrips.employeeId, employeeId), eq(selfTrips.status, 'RUNNING'))).limit(1);
  return row?.number ?? null;
}

/** Akun karyawan aktif di cabang ini yang jabatannya memegang hak itu (tanpa Pemilik/GM full_access, agar tidak ramai). */
async function branchAccounts(branchId: number, action: string): Promise<number[]> {
  const rows = await db.execute<{ employee_id: number }>(sql`
    select distinct cp.employee_id from hris.current_placements cp
    join hris.positions p on p.id = cp.position_id and p.active
    join hris.position_grants g on g.position_id = p.id and g.action = ${action}
    where cp.active and cp.branch_id = ${branchId}`);
  return accountsOf(rows.map((r) => Number(r.employee_id)));
}

type SaleRow = {
  id: number; trx_number: string; branch_id: number; customer_id: number | null; customer_name: string | null; customer_phone: string | null;
  address: string | null; payable_amount: number; status: string; courier_id: number | null; courier_name: string | null; trx_on: string;
  created_at: Date; courier_employee_id: number | null; courier_employee_name: string | null; tomorrow_count: number;
};

/** Nota kurir cabang yang belum dibawa / sudah Kirim Besok (tanpa tujuan berlaku), sejak tanggal mulai antar sendiri. */
async function openSales(kasirBranchId: number, executor: Executor, only: number[] | null = null): Promise<SaleRow[]> {
  const from = String(await settingOn<string>('logistics.self_delivery_from', wibDate(new Date()), {}, executor));
  return executor.execute<SaleRow>(sql`
    select s.id, s.trx_number, s.branch_id, s.customer_id, s.customer_name, s.customer_phone, s.address, s.payable_amount, s.status,
      s.courier_id, s.courier_name, s.trx_on::text as trx_on, s.created_at, l.employee_id as courier_employee_id, e.name as courier_employee_name,
      (select count(*)::int from logistics.self_trip_stops x where x.transaction_id = s.id and x.status = 'TOMORROW') as tomorrow_count
    from logistics.pos_courier_sales s
    left join hris.pos_groomer_links l on l.pos_groomer_id = s.courier_id and l.released_at is null
    left join hris.employees e on e.id = l.employee_id
    where s.branch_id = ${kasirBranchId} and s.trx_on >= ${from}::date and s.status not in ('VOIDED', 'PENDING_VOID')
      and not exists (select 1 from logistics.self_trip_stops x where x.transaction_id = s.id and x.status in ('OPEN', 'DELIVERED', 'FAILED'))
      ${only ? sql`and s.id in (${ids(only)})` : sql``}
    order by s.created_at asc, s.id asc limit 200`);
}

export type SelfTask = {
  transactionId: number; trxNumber: string; destination: string; phone: string | null; address: string | null; amount: number;
  trxOn: IsoDate; at: string; courier: string; mine: boolean; tomorrowCount: number;
};

const destinationOf = (r: Pick<SaleRow, 'customer_name' | 'trx_number'>) => r.customer_name ?? `Umum (${r.trx_number})`;
const courierLabel = (r: SaleRow) => r.courier_employee_name ?? (r.courier_name ? `${r.courier_name} (belum dipasangkan)` : 'Tanpa pengantar');

/** Sisa piutang kasir per nota (belum PAID). Nota Umum / lunas = 0. */
async function billsOf(transactionIds: number[], executor: Executor): Promise<Map<number, number>> {
  const rows = transactionIds.length ? await executor.execute<{ transaction_id: number; remaining_amount: number }>(sql`
    select transaction_id, remaining_amount from logistics.pos_customer_debts where transaction_id in (${ids(transactionIds)}) and status <> 'PAID'`) : [];
  return new Map(transactionIds.map((id) => [id, billOf(rows.filter((r) => Number(r.transaction_id) === id).map((r) => Number(r.remaining_amount)))]));
}

/** Mulai antar (Foto 1 ambil barang, LOG-43): PJ = pemotret. Nota bukan milik pengantar ini bertanda "pengantar beda dengan kasir". */
export async function startSelfTrip(actor: Actor | null, input: { transactionIds: number[]; point?: Point | null }, photo: File | null): Promise<ServiceResult<{ id: number }>> {
  if (!actor) return fail(403, FORBIDDEN);
  const branch = await homeBranch(actor);
  if (!branch || !can(actor, RUN, { branchId: branch.id })) return fail(403, 'Anda tidak berhak mengantar sendiri di cabang ini.');
  const problem = stopsProblem(input.transactionIds);
  if (problem) return fail(400, problem);
  const now = new Date();
  if (!(await onDuty(actor.personId, now))) return fail(409, 'Mulai antar hanya bisa sesudah absen masuk dan sebelum absen pulang.');
  if (await runningSelfTripNumber(actor.personId)) return fail(409, 'Anda masih punya perjalanan antar yang berjalan. Selesaikan dulu (Foto 3).');
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  const point = cleanPoint(input.point);
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('logistics.self_trip'))`);
      const sales = await openSales(branch.kasirBranchId, tx, input.transactionIds);
      if (sales.length !== input.transactionIds.length) {
        return fail(409, 'Ada nota yang sudah dibawa orang lain, dibatalkan di kasir, atau bukan nota kurir cabang ini. Muat ulang daftar.');
      }
      const today = wibDate(now);
      const [{ n }] = await tx.execute<{ n: number }>(sql`
        select count(*)::int as n from logistics.self_trips where (started_at at time zone 'Asia/Jakarta')::date = ${today}::date`);
      const [trip] = await tx.insert(selfTrips).values({
        number: selfTripNumber(today, Number(n) + 1), branchId: branch.id, kasirBranchId: branch.kasirBranchId, employeeId: actor.personId,
        accountId: actor.accountId, startedAt: now, pickupPhotoFileId: upload.data.id,
        startLatitude: point?.latitude ?? null, startLongitude: point?.longitude ?? null, startAccuracyM: point?.accuracy ?? null,
      }).returning({ id: selfTrips.id });
      await tx.insert(selfTripStops).values(sales.map((s) => ({
        tripId: trip.id, transactionId: Number(s.id), trxNumber: s.trx_number, customerId: s.customer_id != null ? Number(s.customer_id) : null,
        destinationName: destinationOf(s), amountAtStart: Number(s.payable_amount), addedAt: now,
        courierMismatch: s.courier_employee_id == null || Number(s.courier_employee_id) !== actor.personId,
      })));
      return { ok: true as const, data: { id: trip.id } };
    });
  } catch (error) {
    if (isUniqueViolation(error, 'self_trip_stops_live')) return fail(409, 'Ada nota yang baru saja dibawa orang lain. Muat ulang daftar.');
    if (isUniqueViolation(error, 'self_trips_one_running')) return fail(409, 'Anda masih punya perjalanan antar yang berjalan.');
    throw error;
  }
}

/** Perjalanan berjalan milik PJ ini, dikunci untuk diubah. */
async function lockedRunning(tx: Tx, actor: Actor, tripId: number) {
  const [trip] = await tx.select().from(selfTrips).where(eq(selfTrips.id, tripId)).for('update').limit(1);
  if (!trip) throw new Rollback(404, 'Perjalanan antar tidak ditemukan.');
  if (trip.employeeId !== actor.personId) throw new Rollback(403, 'Hanya PJ perjalanan ini yang bisa melakukannya.');
  if (trip.status !== 'RUNNING') throw new Rollback(409, 'Perjalanan ini sudah kembali (Foto 3).');
  return trip;
}

/** Jam tahap terakhir: Foto 1 atau tujuan terakhir yang selesai. */
async function lastStageAt(tx: Executor, trip: { id: number; startedAt: Date }): Promise<Date> {
  const [row] = await tx.execute<{ at: Date | null }>(sql`select max(done_at) as at from logistics.self_trip_stops where trip_id = ${trip.id}`);
  const last = row?.at ? new Date(row.at) : null;
  return last && last > trip.startedAt ? last : trip.startedAt;
}

export type SelfStopInput = {
  outcome: 'DELIVERED' | VisitOutcome; reasonCode?: string | null; note?: string | null; point?: Point | null;
  payment?: { method?: string | null; partialAmount?: number | null; promiseDate?: string | null } | null;
};

/**
 * Sampai di tujuan (Foto 2, LOG-43, 117): Terkirim + cara bayar (tagihan = sisa piutang kasir nota itu), Kirim Besok (nota kembali
 * ke daftar tugas), atau Gagal (menunggu keputusan cabang asal, LOG-56). Tiap tahap paling sedikit sekian menit.
 */
export async function selfStopOutcome(actor: Actor | null, tripId: number, stopId: number, input: SelfStopInput, photo: File | null, proof: File | null): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  if (input.outcome !== 'DELIVERED' && !(input.outcome in VISIT_REASONS)) return fail(400, 'Pilih hasil kunjungan.');
  const reason = input.outcome === 'DELIVERED' ? null : visitReason(input.outcome, input.reasonCode ?? '', input.note);
  if (reason && !reason.ok) return fail(400, reason.error);
  const [peek] = await db.select().from(selfTrips).where(eq(selfTrips.id, tripId)).limit(1);
  if (!peek || peek.employeeId !== actor.personId) return fail(404, 'Perjalanan antar tidak ditemukan.');
  const now = new Date();
  const minMinutes = Number(await settingOn<number>('logistics.self_stage_min_minutes', wibDate(now)));
  const early = stageWaitProblem(await lastStageAt(db, peek), now, minMinutes);
  if (early) return fail(409, early);
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  let proofId: string | null = null;
  if (input.outcome === 'DELIVERED' && input.payment?.method === 'TRANSFER') {
    const proofUpload = await saveUpload(actor, proof);
    if (!proofUpload.ok) return fail(400, proof ? proofUpload.error : 'Foto bukti transfer wajib.');
    proofId = proofUpload.data.id;
  }
  const point = cleanPoint(input.point);
  try {
    return await db.transaction(async (tx) => {
      const trip = await lockedRunning(tx, actor, tripId);
      const [stop] = await tx.select().from(selfTripStops).where(and(eq(selfTripStops.id, stopId), eq(selfTripStops.tripId, tripId))).for('update').limit(1);
      if (!stop) throw new Rollback(404, 'Tujuan tidak ditemukan di perjalanan ini.');
      if (stop.status !== 'OPEN') throw new Rollback(409, 'Tujuan ini sudah diproses.');
      const again = stageWaitProblem(await lastStageAt(tx, trip), now, minMinutes);
      if (again) throw new Rollback(409, again);
      let distanceM: number | null = null;
      if (input.outcome === 'DELIVERED') {
        const [sale] = await tx.execute<{ status: string }>(sql`select status from logistics.pos_courier_sales where id = ${stop.transactionId}`);
        if (!sale || isVoided(sale.status)) throw new Rollback(409, `Nota ${stop.trxNumber} dibatalkan di kasir. Pilih Gagal (Batal pesan) atau hubungi Kepala Toko.`);
        const bill = (await billsOf([stop.transactionId], tx)).get(stop.transactionId) ?? 0;
        const clean = cleanPayment(bill, input.payment?.method, input.payment?.partialAmount);
        if (!clean.ok) throw new Rollback(400, clean.error);
        if (clean.method === 'TRANSFER' && !proofId) throw new Rollback(400, 'Foto bukti transfer wajib.');
        const promise = cleanPromise(clean.method, input.payment?.promiseDate, wibDate(now));
        if (!promise.ok) throw new Rollback(400, promise.error);
        await tx.insert(selfTripPayments).values({
          stopId, tripId, transactionId: stop.transactionId, customerId: stop.customerId, method: clean.method, billAmount: bill,
          receivedAmount: clean.received, proofPhotoFileId: clean.method === 'TRANSFER' ? proofId : null, promiseDate: promise.date,
          recordedByEmployeeId: actor.personId, recordedByAccountId: actor.accountId, recordedAt: now,
        });
        distanceM = await distanceFromPoint(tx, stop.customerId, point);
      }
      await tx.update(selfTripStops).set({
        status: input.outcome, reasonCode: reason?.ok ? reason.code : null, reasonText: reason?.ok ? reason.text : null, photoFileId: upload.data.id,
        doneAt: now, doneByEmployeeId: actor.personId, latitude: point?.latitude ?? null, longitude: point?.longitude ?? null,
        accuracyM: point?.accuracy ?? null, distanceM,
      }).where(eq(selfTripStops.id, stopId));
      if (input.outcome === 'FAILED' && reason?.ok) {
        await notify(tx, await branchAccounts(trip.branchId, VIEW), {
          kind: 'logistics.self_failed', title: `Antar ${stop.trxNumber} ke ${stop.destinationName} gagal (${trip.number})`,
          body: `${reason.text}. Barang dibawa kembali ke cabang; keputusan kirim ulang atau batal menyusul.`,
          link: '/logistik/antar-sendiri', entity: 'self_trip_stop', entityId: stopId,
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
 * Kembali di cabang (Foto 3, LOG-43, 128): semua tujuan sudah diproses, tiap tahap ≥ batas, selisih lama berangkat dan
 * kembali ≥ batas wajib alasan. Tunai dicatat untuk diterima laci cabang; penerima di cabang diberi tahu.
 */
export async function finishSelfTrip(actor: Actor | null, tripId: number, input: { gapReason?: string | null; gapNote?: string | null; point?: Point | null }, photo: File | null): Promise<ServiceResult<{ cash: number }>> {
  if (!actor) return fail(403, FORBIDDEN);
  const [peek] = await db.select().from(selfTrips).where(eq(selfTrips.id, tripId)).limit(1);
  if (!peek || peek.employeeId !== actor.personId) return fail(404, 'Perjalanan antar tidak ditemukan.');
  const stops = await db.select().from(selfTripStops).where(eq(selfTripStops.tripId, tripId));
  const open = stops.filter((s) => s.status === 'OPEN');
  if (open.length) return fail(409, `Masih ada ${open.length} tujuan. Pilih Terkirim, Kirim Besok, atau Gagal dulu.`);
  const now = new Date();
  const today = wibDate(now);
  const [minMinutes, limit] = await Promise.all([
    settingOn<number>('logistics.self_stage_min_minutes', today).then(Number), settingOn<number>('logistics.self_gap_minutes', today).then(Number),
  ]);
  const early = stageWaitProblem(await lastStageAt(db, peek), now, minMinutes);
  if (early) return fail(409, early);
  const done = stops.map((s) => s.doneAt!).sort((a, b) => a.getTime() - b.getTime());
  const gap = gapMinutes(peek.startedAt, done[0], done[done.length - 1], now);
  const gapReason = cleanGapReason(gap, limit, input.gapReason, input.gapNote);
  if (!gapReason.ok) return fail(400, gapReason.error);
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  const point = cleanPoint(input.point);
  try {
    return await db.transaction(async (tx) => {
      const trip = await lockedRunning(tx, actor, tripId);
      const [left] = await tx.execute<{ n: number }>(sql`select count(*)::int as n from logistics.self_trip_stops where trip_id = ${tripId} and status = 'OPEN'`);
      if (Number(left.n)) throw new Rollback(409, 'Masih ada tujuan yang belum diproses.');
      const payments = await tx.select({ method: selfTripPayments.method, receivedAmount: selfTripPayments.receivedAmount })
        .from(selfTripPayments).where(eq(selfTripPayments.tripId, tripId));
      const cash = cashOf(payments);
      await tx.update(selfTrips).set({
        status: 'DONE', returnedAt: now, returnPhotoFileId: upload.data.id, returnLatitude: point?.latitude ?? null,
        returnLongitude: point?.longitude ?? null, returnAccuracyM: point?.accuracy ?? null, gapReason: gapReason.text,
        gapMinutes: gap, cashAmount: cash,
      }).where(eq(selfTrips.id, tripId));
      if (cash > 0) {
        await notify(tx, await branchAccounts(trip.branchId, CASH), {
          kind: 'logistics.self_cash', title: `Terima tunai ${rupiah(cash)} dari antar ${trip.number}`,
          body: 'Hitung uangnya, masukkan ke laci, lalu tekan Sudah diterima di Antar Sendiri.',
          link: '/logistik/antar-sendiri', entity: 'self_trip', entityId: tripId,
        }, actor.accountId);
      }
      return { ok: true as const, data: { cash } };
    });
  } catch (error) {
    if (error instanceof Rollback) return fail(error.status, error.message);
    throw error;
  }
}

/** Tunai antar sendiri diterima laci cabang asal (LOG-128): karyawan cabang itu yang bertugas, bukan PJ. */
export async function receiveSelfCash(actor: Actor | null, tripId: number): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  return db.transaction(async (tx) => {
    const [trip] = await tx.select().from(selfTrips).where(eq(selfTrips.id, tripId)).for('update').limit(1);
    if (!trip) return fail(404, 'Perjalanan antar tidak ditemukan.');
    if (!can(actor, CASH, { branchId: trip.branchId })) return fail(403, FORBIDDEN);
    if (trip.employeeId === actor.personId) return fail(403, 'Uang yang Anda bawa sendiri diterima rekan cabang.');
    if (trip.status !== 'DONE' || trip.cashAmount <= 0) return fail(409, 'Perjalanan ini tidak membawa uang tunai.');
    if (trip.cashReceivedAt) return fail(409, 'Uang ini sudah diterima.');
    await tx.update(selfTrips).set({ cashReceivedAt: new Date(), cashReceivedByEmployeeId: actor.personId, cashReceivedByAccountId: actor.accountId })
      .where(eq(selfTrips.id, tripId));
    return { ok: true as const, data: undefined };
  });
}

export type SelfStopView = {
  id: number; trxNumber: string; destination: string; customerId: number | null; phone: string | null; address: string | null; amount: number;
  status: SelfStopStatus; statusLabel: string; reason: string | null; doneAt: string | null; courierMismatch: boolean; voided: boolean;
  bill: number; payment: { method: PaymentMethod; label: string; received: number; left: number; promiseDate: string | null } | null;
  distanceM: number | null; mapUrl: string | null; hasPoint: boolean; pointPending: boolean; photoUrl: string | null; proofUrl: string | null;
};
export type SelfTripView = {
  id: number; number: string; status: SelfTripStatus; statusLabel: string; branch: string; pj: string; employeeId: number;
  startedAt: string; returnedAt: string | null; gapReason: string | null; gapMinutes: number | null;
  cash: number; cashReceived: { by: string; at: string } | null; cashLate: boolean;
  pickupUrl: string; returnUrl: string | null; stops: SelfStopView[];
};

async function tripViews(rows: (typeof selfTrips.$inferSelect)[], executor: Executor = db): Promise<SelfTripView[]> {
  if (!rows.length) return [];
  const tripIds = rows.map((t) => t.id);
  const [stops, payments, people, branches] = await Promise.all([
    executor.select().from(selfTripStops).where(inArray(selfTripStops.tripId, tripIds)).orderBy(asc(selfTripStops.id)),
    executor.select().from(selfTripPayments).where(inArray(selfTripPayments.tripId, tripIds)),
    peopleNames(),
    executor.execute<{ id: number; name: string }>(sql`select id, name from hris.branches where id in (${ids([...new Set(rows.map((t) => t.branchId))])})`),
  ]);
  const txIds = stops.map((s) => s.transactionId);
  const [sales, bills, points] = await Promise.all([
    txIds.length ? executor.execute<{ id: number; status: string; customer_phone: string | null; address: string | null }>(sql`
      select id, status, customer_phone, address from logistics.pos_courier_sales where id in (${ids(txIds)})`) : [],
    billsOf(stops.filter((s) => s.status === 'OPEN').map((s) => s.transactionId), executor),
    pointsOf(stops.map((s) => s.customerId).filter((c): c is number => c != null), executor),
  ]);
  const sale = new Map(sales.map((s) => [Number(s.id), s]));
  const branchName = new Map(branches.map((b) => [Number(b.id), b.name]));
  const today = wibDate(new Date());
  return rows.map((t) => ({
    id: t.id, number: t.number, status: t.status as SelfTripStatus, statusLabel: SELF_TRIP_LABELS[t.status as SelfTripStatus],
    branch: branchName.get(t.branchId) ?? '-', pj: people.get(t.employeeId) ?? `#${t.employeeId}`, employeeId: t.employeeId,
    startedAt: stamp(t.startedAt)!, returnedAt: stamp(t.returnedAt), gapReason: t.gapReason, gapMinutes: t.gapMinutes,
    cash: t.cashAmount,
    cashReceived: t.cashReceivedAt ? { by: people.get(t.cashReceivedByEmployeeId ?? 0) ?? '-', at: stamp(t.cashReceivedAt)! } : null,
    cashLate: t.cashAmount > 0 && !t.cashReceivedAt && !!t.returnedAt && cashLate(wibDate(t.returnedAt), today),
    pickupUrl: `/api/logistics/self-photo?trip=${t.id}&kind=pickup`,
    returnUrl: t.returnPhotoFileId ? `/api/logistics/self-photo?trip=${t.id}&kind=return` : null,
    stops: stops.filter((s) => s.tripId === t.id).map((s) => {
      const p = payments.find((x) => x.stopId === s.id);
      const now = sale.get(s.transactionId);
      const approved = s.customerId != null ? points.approved.get(s.customerId) : undefined;
      return {
        id: s.id, trxNumber: s.trxNumber, destination: s.destinationName, customerId: s.customerId, phone: now?.customer_phone ?? null,
        address: now?.address ?? null, amount: s.amountAtStart, status: s.status as SelfStopStatus, statusLabel: SELF_STOP_LABELS[s.status as SelfStopStatus],
        reason: s.reasonText, doneAt: stamp(s.doneAt), courierMismatch: s.courierMismatch, voided: now ? isVoided(now.status) : false,
        bill: bills.get(s.transactionId) ?? 0,
        payment: p ? {
          method: p.method as PaymentMethod, label: PAYMENT_LABELS[p.method as PaymentMethod], received: p.receivedAmount,
          left: leftToCollect(p.method as PaymentMethod, p.billAmount, p.receivedAmount), promiseDate: p.promiseDate,
        } : null,
        distanceM: s.distanceM, mapUrl: approved?.mapUrl ?? null, hasPoint: !!approved,
        pointPending: s.customerId != null && points.pending.has(s.customerId),
        photoUrl: s.photoFileId ? `/api/logistics/self-photo?trip=${t.id}&kind=stop&stop=${s.id}` : null,
        proofUrl: p?.proofPhotoFileId ? `/api/logistics/self-photo?trip=${t.id}&kind=proof&stop=${s.id}` : null,
      };
    }),
  }));
}

/**
 * Halaman Antar Sendiri (spec LT1 §15.2): tugas antar (milik saya + nota kurir lain di cabang), perjalanan berjalan,
 * riwayat 2 hari, tunai yang menunggu diterima laci, dan perjalanan cabang (Kepala Toko).
 */
export async function selfDeliveryScreen(actor: Actor | null) {
  if (!actor) return null;
  const branch = await homeBranch(actor);
  const canRun = !!branch && can(actor, RUN, { branchId: branch.id });
  const canCash = !!branch && can(actor, CASH, { branchId: branch.id });
  const canView = can(actor, VIEW, branch ? { branchId: branch.id } : undefined);
  if (!canRun && !canCash && !canView) return null;
  const now = new Date();
  const today = wibDate(now);
  const [sales, mine, cashRows, branchRows, minMinutes, gapLimit, duty, pointAccuracyM] = await Promise.all([
    canRun && branch ? openSales(branch.kasirBranchId, db) : Promise.resolve([] as SaleRow[]),
    db.select().from(selfTrips).where(and(eq(selfTrips.employeeId, actor.personId),
      sql`(${selfTrips.status} = 'RUNNING' or ${selfTrips.startedAt} >= ${`${addDays(today, -1)}T00:00:00+07:00`}::timestamptz)`)).orderBy(desc(selfTrips.startedAt)),
    canCash && branch ? db.select().from(selfTrips).where(and(eq(selfTrips.branchId, branch.id), eq(selfTrips.status, 'DONE'),
      sql`${selfTrips.cashAmount} > 0 and ${selfTrips.cashReceivedAt} is null`)).orderBy(asc(selfTrips.returnedAt)) : Promise.resolve([]),
    canView ? db.select().from(selfTrips).where(and(
      actor.fullAccess || actor.grants.get(VIEW) === 'ALL' ? sql`true` : eq(selfTrips.branchId, branch?.id ?? -1),
      sql`${selfTrips.startedAt} >= ${`${addDays(today, -6)}T00:00:00+07:00`}::timestamptz`)).orderBy(desc(selfTrips.startedAt)).limit(100) : Promise.resolve([]),
    settingOn<number>('logistics.self_stage_min_minutes', today).then(Number),
    settingOn<number>('logistics.self_gap_minutes', today).then(Number),
    canRun ? onDuty(actor.personId, now) : Promise.resolve(false),
    settingOn<number>('logistics.point_accuracy_m', today).then(Number),
  ]);
  const tasks: SelfTask[] = sales.map((s) => ({
    transactionId: Number(s.id), trxNumber: s.trx_number, destination: destinationOf(s), phone: s.customer_phone, address: s.address,
    amount: Number(s.payable_amount), trxOn: s.trx_on, at: wibClock(new Date(s.created_at)), courier: courierLabel(s),
    mine: s.courier_employee_id != null && Number(s.courier_employee_id) === actor.personId, tomorrowCount: Number(s.tomorrow_count),
  }));
  const [mineViews, cashViews, branchViews] = await Promise.all([tripViews(mine), tripViews(cashRows), tripViews(branchRows)]);
  const running = mineViews.find((t) => t.status === 'RUNNING') ?? null;
  return {
    branch: branch?.name ?? null, me: actor.personId, canRun, canCash, canView, onDuty: duty, minMinutes, gapLimit, pointAccuracyM,
    lastStageAt: running ? (await lastStageAt(db, mine.find((t) => t.id === running.id)!)).toISOString() : null,
    startedAtIso: running ? mine.find((t) => t.id === running.id)!.startedAt.toISOString() : null,
    tasks: { mine: tasks.filter((t) => t.mine), others: tasks.filter((t) => !t.mine) },
    running, recent: mineViews.filter((t) => t.status === 'DONE'),
    cashWaiting: cashViews.filter((t) => t.employeeId !== actor.personId), cashMine: cashViews.filter((t) => t.employeeId === actor.personId),
    branchTrips: branchViews,
    reasons: VISIT_REASONS, gapReasons: GAP_REASONS,
  };
}

export type SelfDeliveryScreenData = NonNullable<Awaited<ReturnType<typeof selfDeliveryScreen>>>;

/** Menu Antar Sendiri tampil bagi pemegang salah satu haknya. */
export function selfDeliveryMenuVisible(actor: Actor | null): boolean {
  return !!actor && (actor.fullAccess || [RUN, CASH, VIEW].some((a) => actor.grants.has(a)));
}

/** Jumlah tunai antar sendiri yang menunggu diterima laci cabang pelaku (kartu Beranda). */
export async function selfCashWaitingCount(actor: Actor | null): Promise<number> {
  if (!actor || actor.branchId == null || !can(actor, CASH, { branchId: actor.branchId })) return 0;
  const [row] = await db.execute<{ n: number }>(sql`
    select count(*)::int as n from logistics.self_trips
    where branch_id = ${actor.branchId} and status = 'DONE' and cash_amount > 0 and cash_received_at is null and employee_id <> ${actor.personId}`);
  return Number(row?.n ?? 0);
}

/** Pintu foto antar sendiri: PJ, penerima tunai / pelihat cabang itu. Mengembalikan id berkas atau null. */
export async function openSelfPhoto(actor: Actor | null, input: { tripId: number; kind: string; stopId?: number | null }): Promise<string | null> {
  if (!actor) return null;
  const [trip] = await db.select().from(selfTrips).where(eq(selfTrips.id, input.tripId)).limit(1);
  if (!trip) return null;
  const allowed = trip.employeeId === actor.personId || can(actor, VIEW, { branchId: trip.branchId }) || can(actor, CASH, { branchId: trip.branchId });
  if (!allowed) return null;
  if (input.kind === 'pickup') return trip.pickupPhotoFileId;
  if (input.kind === 'return') return trip.returnPhotoFileId;
  if (!input.stopId) return null;
  if (input.kind === 'stop') {
    const [stop] = await db.select({ fileId: selfTripStops.photoFileId }).from(selfTripStops)
      .where(and(eq(selfTripStops.id, input.stopId), eq(selfTripStops.tripId, trip.id))).limit(1);
    return stop?.fileId ?? null;
  }
  if (input.kind === 'proof') {
    const [pay] = await db.select({ fileId: selfTripPayments.proofPhotoFileId }).from(selfTripPayments)
      .where(and(eq(selfTripPayments.stopId, input.stopId), eq(selfTripPayments.tripId, trip.id))).limit(1);
    return pay?.fileId ?? null;
  }
  return null;
}

/**
 * Tanda ⚠ foto antar tidak lengkap untuk bonus ongkir (LOG-109), per id baris ongkir kasir (`hris.pos_deliveries.id`):
 * nota kurir cabang sejak tanggal mulai antar sendiri yang belum punya tujuan Terkirim / Gagal di perjalanan yang sudah
 * Foto 3, padahal sudah lewat 23.59 hari berikutnya sesudah tanggal nota. Hanya tanda; nominal bonus tidak diubah.
 */
export async function selfDeliveryPhotoGaps(deliveryIds: number[], now: Date = new Date()): Promise<Set<number>> {
  const result = new Set<number>();
  if (!deliveryIds.length) return result;
  const from = String(await settingOn<string>('logistics.self_delivery_from', wibDate(now)));
  const rows = await db.execute<{ id: number; trx_on: string; complete: boolean }>(sql`
    select d.id, s.trx_on::text as trx_on,
      exists (select 1 from logistics.self_trip_stops x join logistics.self_trips t on t.id = x.trip_id
        where x.transaction_id = s.id and x.status in ('DELIVERED', 'FAILED') and t.status = 'DONE') as complete
    from hris.pos_deliveries d
    join logistics.pos_courier_sales s on s.id = d.transaction_id
    where d.id in (${ids(deliveryIds)}) and s.trx_on >= ${from}::date`);
  for (const r of rows) if (!r.complete && photoDeadlinePassed(String(r.trx_on).slice(0, 10), now)) result.add(Number(r.id));
  return result;
}
