import { and, eq, isNull, sql } from 'drizzle-orm';
import { fuelFills, tripEndReports, vehicles } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, listEmployeesWithAnyAction, type Actor, type ServiceResult } from '@/modules/access';
import { saveUpload } from '@/modules/files';
import { notify } from '@/modules/notifications';
import { amountProblem, canChangeFill, fuelPeriod, noRequestReason } from '../rules/fuel';
import { rupiah } from '../rules/rates';
import { reasonProblem, wibClock, wibDate, type IsoDate } from '../rules/trip';
import { FORBIDDEN, accountsOf, activePeople, fail, garageBranchId, peopleNames } from './data';

// Bensin (spec LT1 §17.1 butir 1–6): permintaan driver → Finance isi nominal + foto struk. Baris `fuel_fills` yang berlaku
// adalah sumber uang keluar bensin; modul Keuangan nanti membacanya dari view `logistics.fuel_expenses`.

const RECORD = 'logistics.fuel.record';
const VIEW = 'logistics.vehicle_followup.manage';

const canView = (actor: Actor) => can(actor, RECORD) || can(actor, VIEW);

type FillInput = { vehicleId: number; driverId: number; amount: number };

async function driverOk(driverId: number): Promise<boolean> {
  const people = await activePeople(wibDate(new Date()));
  return people.some((p) => p.id === driverId) || (await peopleNames()).has(driverId);
}

async function vehicleName(vehicleId: number): Promise<string | null> {
  const [v] = await db.select({ name: vehicles.name, plate: vehicles.plate }).from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
  return v ? `${v.name} (${v.plate})` : null;
}

/** Isi nominal + foto struk untuk permintaan driver yang masih Menunggu (butir 1). */
export async function fillFuelRequest(actor: Actor | null, requestId: number, amount: number, photo: File | null): Promise<ServiceResult<{ id: number }>> {
  if (!actor || !can(actor, RECORD)) return fail(403, FORBIDDEN);
  const amountError = amountProblem(amount);
  if (amountError) return fail(400, amountError);
  if (!photo) return fail(400, 'Foto struk wajib.');
  const [request] = await db.select().from(tripEndReports).where(eq(tripEndReports.id, requestId)).limit(1);
  if (!request || !request.needsFuel) return fail(404, 'Permintaan bensin tidak ditemukan.');
  if (request.fuelClosedAt) return fail(409, 'Permintaan bensin ini sudah ditutup. Muat ulang halaman.');
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  const branchId = await garageBranchId();
  return db.transaction(async (tx) => {
    const now = new Date();
    const [closed] = await tx.update(tripEndReports).set({ fuelCloseKind: 'FILLED', fuelClosedAt: now, fuelClosedByAccountId: actor.accountId })
      .where(and(eq(tripEndReports.id, requestId), eq(tripEndReports.needsFuel, true), isNull(tripEndReports.fuelClosedAt))).returning({ id: tripEndReports.id });
    if (!closed) return fail(409, 'Permintaan bensin ini sudah ditutup. Muat ulang halaman.');
    const [row] = await tx.insert(fuelFills).values({
      requestId, vehicleId: request.vehicleId, driverEmployeeId: request.employeeId, filledOn: wibDate(now), amount, receiptFileId: upload.data.id,
      chargeBranchId: branchId, recordedByAccountId: actor.accountId, recordedAt: now,
    }).returning({ id: fuelFills.id });
    return { ok: true as const, data: { id: row.id } };
  });
}

/** Catat bensin tanpa permintaan (butir 2): driver lupa minta. Driver diberi tahu. */
export async function recordFuelWithoutRequest(
  actor: Actor | null, input: FillInput & { reasonCode: string | null; reasonText: string | null }, photo: File | null,
): Promise<ServiceResult<{ id: number }>> {
  if (!actor || !can(actor, RECORD)) return fail(403, FORBIDDEN);
  const amountError = amountProblem(input.amount);
  if (amountError) return fail(400, amountError);
  const reason = noRequestReason(input.reasonCode, input.reasonText);
  if (!reason.ok) return fail(400, reason.error);
  if (!photo) return fail(400, 'Foto struk wajib.');
  const vehicle = await vehicleName(input.vehicleId);
  if (!vehicle) return fail(400, 'Pilih mobil.');
  if (!(await driverOk(input.driverId))) return fail(400, 'Pilih driver.');
  const upload = await saveUpload(actor, photo);
  if (!upload.ok) return upload;
  const [branchId, driverAccounts] = await Promise.all([garageBranchId(), accountsOf([input.driverId])]);
  return db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx.insert(fuelFills).values({
      vehicleId: input.vehicleId, driverEmployeeId: input.driverId, filledOn: wibDate(now), amount: input.amount, receiptFileId: upload.data.id,
      noRequestReason: reason.value, chargeBranchId: branchId, recordedByAccountId: actor.accountId, recordedAt: now,
    }).returning({ id: fuelFills.id });
    await notify(tx, driverAccounts, {
      kind: 'logistics.fuel_no_request', title: `Bensin ${vehicle} dicatat tanpa permintaan`,
      body: `${rupiah(input.amount)} · ${reason.value}. Lain kali minta isi bensin lewat Laporan Pulang trip.`, entity: 'fuel_fill', entityId: row.id,
    }, actor.accountId);
    return { ok: true as const, data: { id: row.id } };
  });
}

/** Ubah (butir 4): baris baru menggantikan yang lama, alasan wajib; foto boleh tidak diganti. */
export async function correctFuel(
  actor: Actor | null, fillId: number, input: FillInput & { reason: string }, photo: File | null,
): Promise<ServiceResult<{ id: number }>> {
  if (!actor || !can(actor, RECORD)) return fail(403, FORBIDDEN);
  const reasonError = reasonProblem(input.reason);
  if (reasonError) return fail(400, reasonError);
  const amountError = amountProblem(input.amount);
  if (amountError) return fail(400, amountError);
  const [old] = await db.select().from(fuelFills).where(eq(fuelFills.id, fillId)).limit(1);
  if (!old) return fail(404, 'Catatan bensin tidak ditemukan.');
  if (old.replacedAt || old.voidedAt) return fail(409, 'Catatan bensin ini sudah diganti atau dibatalkan. Muat ulang halaman.');
  if (!canChangeFill(old, actor)) return fail(403, 'Hanya pencatatnya, Pemilik, atau GM yang bisa mengubah catatan bensin ini.');
  // Pengisian dari permintaan tetap milik mobil & driver permintaan itu.
  const vehicleId = old.requestId ? old.vehicleId : input.vehicleId;
  const driverId = old.requestId ? old.driverEmployeeId : input.driverId;
  if (!(await vehicleName(vehicleId))) return fail(400, 'Pilih mobil.');
  if (!(await driverOk(driverId))) return fail(400, 'Pilih driver.');
  let receiptFileId = old.receiptFileId;
  if (photo) {
    const upload = await saveUpload(actor, photo);
    if (!upload.ok) return upload;
    receiptFileId = upload.data.id;
  }
  return db.transaction(async (tx) => {
    const now = new Date();
    const [replaced] = await tx.update(fuelFills).set({ replacedAt: now })
      .where(and(eq(fuelFills.id, fillId), isNull(fuelFills.replacedAt), isNull(fuelFills.voidedAt))).returning({ id: fuelFills.id });
    if (!replaced) return fail(409, 'Catatan bensin ini sudah diganti atau dibatalkan. Muat ulang halaman.');
    const [row] = await tx.insert(fuelFills).values({
      requestId: old.requestId, vehicleId, driverEmployeeId: driverId, filledOn: old.filledOn, amount: input.amount, receiptFileId,
      noRequestReason: old.noRequestReason, chargeBranchId: old.chargeBranchId, correctionOfId: old.id, correctionReason: input.reason.trim(),
      recordedByAccountId: actor.accountId, recordedAt: now,
    }).returning({ id: fuelFills.id });
    return { ok: true as const, data: { id: row.id } };
  });
}

/** Batal (butir 4): pencatatan dobel / keliru. Bila dari permintaan, permintaan kembali Menunggu. */
export async function voidFuel(actor: Actor | null, fillId: number, reason: string): Promise<ServiceResult> {
  if (!actor || !can(actor, RECORD)) return fail(403, FORBIDDEN);
  const reasonError = reasonProblem(reason);
  if (reasonError) return fail(400, reasonError);
  const [old] = await db.select().from(fuelFills).where(eq(fuelFills.id, fillId)).limit(1);
  if (!old) return fail(404, 'Catatan bensin tidak ditemukan.');
  if (!canChangeFill(old, actor)) return fail(403, 'Hanya pencatatnya, Pemilik, atau GM yang bisa membatalkan catatan bensin ini.');
  return db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx.update(fuelFills).set({ voidedAt: now, voidedByAccountId: actor.accountId, voidReason: reason.trim() })
      .where(and(eq(fuelFills.id, fillId), isNull(fuelFills.replacedAt), isNull(fuelFills.voidedAt))).returning({ id: fuelFills.id });
    if (!row) return fail(409, 'Catatan bensin ini sudah diganti atau dibatalkan. Muat ulang halaman.');
    if (old.requestId) {
      // Permintaan dibuka lagi hanya bila mobil itu belum punya permintaan Menunggu yang lebih baru.
      const [newer] = await tx.select({ id: tripEndReports.id }).from(tripEndReports)
        .where(and(eq(tripEndReports.vehicleId, old.vehicleId), eq(tripEndReports.needsFuel, true), isNull(tripEndReports.fuelClosedAt))).limit(1);
      if (!newer) {
        await tx.update(tripEndReports).set({ fuelCloseKind: null, fuelClosedAt: null, fuelClosedByAccountId: null })
          .where(and(eq(tripEndReports.id, old.requestId), eq(tripEndReports.fuelCloseKind, 'FILLED')));
      }
    }
    return { ok: true as const, data: undefined };
  });
}

export type FuelFillRow = {
  id: number; on: IsoDate; at: string; vehicleId: number; vehicle: string; driverId: number; driver: string; amount: number;
  withRequest: boolean; noRequestReason: string | null; estimate: number | null; tripId: number | null; tripNumber: string | null;
  state: 'CURRENT' | 'REPLACED' | 'VOIDED'; correctionReason: string | null; voidReason: string | null; recordedBy: string; canChange: boolean;
  receiptUrl: string;
};

/** Pengisian bensin 60 hari terakhir, terbaru di atas, termasuk yang sudah diganti / dibatalkan (riwayat). */
async function recentFills(actor: Actor): Promise<FuelFillRow[]> {
  const rows = await db.execute<{
    id: number; filled_on: string; recorded_at: string; vehicle_id: number; vehicle: string; driver_employee_id: number; amount: number;
    request_id: number | null; no_request_reason: string | null; fuel_estimate: number | null; trip_id: number | null; trip_number: string | null;
    replaced_at: string | null; voided_at: string | null; correction_reason: string | null; void_reason: string | null; recorded_by_account_id: number;
    recorder: string | null;
  }>(sql`
    select f.id, f.filled_on::text as filled_on, f.recorded_at, f.vehicle_id, v.name || ' (' || v.plate || ')' as vehicle, f.driver_employee_id, f.amount,
      f.request_id, f.no_request_reason, r.fuel_estimate, r.trip_id, t.number as trip_number, f.replaced_at, f.voided_at, f.correction_reason,
      f.void_reason, f.recorded_by_account_id, e.name as recorder
    from logistics.fuel_fills f join logistics.vehicles v on v.id = f.vehicle_id
    left join logistics.trip_end_reports r on r.id = f.request_id left join logistics.trips t on t.id = r.trip_id
    left join auth.account_links l on l.account_id = f.recorded_by_account_id and l.app_code = 'hris'
    left join hris.employees e on e.id = l.local_user_id
    where f.filled_on > current_date - 60
    order by f.recorded_at desc limit 300`);
  const names = await peopleNames();
  return rows.map((r) => {
    const state = r.voided_at ? 'VOIDED' : r.replaced_at ? 'REPLACED' : 'CURRENT';
    return {
      id: Number(r.id), on: r.filled_on, at: wibClock(new Date(r.recorded_at)), vehicleId: Number(r.vehicle_id), vehicle: r.vehicle,
      driverId: Number(r.driver_employee_id), driver: names.get(Number(r.driver_employee_id)) ?? '-', amount: Number(r.amount),
      withRequest: r.request_id != null, noRequestReason: r.no_request_reason, estimate: r.fuel_estimate == null ? null : Number(r.fuel_estimate),
      tripId: r.trip_id == null ? null : Number(r.trip_id), tripNumber: r.trip_number, state, correctionReason: r.correction_reason, voidReason: r.void_reason,
      recordedBy: r.recorder ?? '-',
      canChange: state === 'CURRENT' && can(actor, RECORD) && canChangeFill({ recordedByAccountId: Number(r.recorded_by_account_id) }, actor),
      receiptUrl: `/api/logistics/fuel-receipt?fill=${r.id}`,
    };
  });
}

/** Data bagian bensin di layar Bensin & Mobil: pilihan mobil + driver terakhirnya, driver, riwayat, ringkasan periode. */
export async function fuelPanel(actor: Actor | null) {
  if (!actor || !canView(actor)) return null;
  const today = wibDate(new Date());
  const [fleet, lastDrivers, people, fills, period] = await Promise.all([
    db.select({ id: vehicles.id, name: vehicles.name, plate: vehicles.plate, active: vehicles.active }).from(vehicles).orderBy(vehicles.name),
    db.execute<{ vehicle_id: number; employee_id: number }>(sql`
      select distinct on (t.vehicle_id) t.vehicle_id, c.employee_id
      from logistics.trips t join logistics.trip_crew c on c.trip_id = t.id and c.role = 'DRIVER' and c.removed_at is null
      where t.status <> 'CANCELLED'
      order by t.vehicle_id, t.trip_date desc, t.id desc`),
    activePeople(today),
    recentFills(actor),
    fuelPeriodSummary(),
  ]);
  const last = new Map(lastDrivers.map((r) => [Number(r.vehicle_id), Number(r.employee_id)]));
  return {
    canRecord: can(actor, RECORD),
    vehicles: fleet.filter((v) => v.active).map((v) => ({ id: v.id, label: `${v.name} (${v.plate})`, lastDriverId: last.get(v.id) ?? null })),
    drivers: people.filter((p) => p.duty.drive).map((p) => ({ id: p.id, name: p.name })),
    fills,
    period,
  };
}

/** Bensin periode 26–25 berjalan dari baris yang berlaku (Dashboard, Bensin & Mobil). */
export async function fuelPeriodSummary(today: IsoDate = wibDate(new Date())) {
  const period = fuelPeriod(today);
  const [row] = await db.execute<{ total: number; count: number; no_request: number }>(sql`
    select coalesce(sum(amount), 0)::bigint as total, count(*)::int as count, count(*) filter (where not with_request)::int as no_request
    from logistics.fuel_expenses where filled_on between ${period.from}::date and ${period.to}::date`);
  return { ...period, total: Number(row?.total ?? 0), count: Number(row?.count ?? 0), noRequest: Number(row?.no_request ?? 0) };
}

/** Pintu foto struk: pemegang hak bensin atau Bensin & Mobil. */
export async function openFuelReceipt(actor: Actor | null, fillId: number): Promise<string | null> {
  if (!actor || !canView(actor)) return null;
  const [row] = await db.select({ fileId: fuelFills.receiptFileId }).from(fuelFills).where(eq(fuelFills.id, fillId)).limit(1);
  return row?.fileId ?? null;
}

/** Pemilik/GM untuk pemberitahuan (full_access). */
export async function ownerAccounts(): Promise<number[]> {
  return accountsOf(await listEmployeesWithAnyAction([]));
}

