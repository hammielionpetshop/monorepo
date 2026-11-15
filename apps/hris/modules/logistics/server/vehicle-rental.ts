import { and, asc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { tripWages, trips, vehicleRentalPayments, vehicleRentalRates, vehicles } from '@petshop/logistics';
import { db } from '@/lib/db';
import { MONEY_PLACE_KIND_LABELS, moneyPlaces, payableMoneyPlace } from '@/lib/money-places';
import { can, recordAudit, type Actor, type ServiceResult } from '@/modules/access';
import { saveUpload } from '@/modules/files';
import { RATE_STATE_LABELS, dayLabel, rateState, rupiah } from '../rules/rates';
import { cleanName, reasonProblem, wibDate, type IsoDate } from '../rules/trip';
import {
  OWNERSHIP_LABELS, PAYMENT_KIND_LABELS, canCancelPayment, monthLabel, monthOf, monthPayable, monthRange, nextMonth, payProblem, paymentState,
  previousMonth, rentalRateOn, rentalRateProblem, rentalRecap, type Ownership, type RentalPaymentKind,
} from '../rules/vehicle-rental';
import { FORBIDDEN, fail, isUniqueViolation, type Executor } from './data';

// Sewa Mobil per Ritase (F2-5b, spec F2-5 §3). Pengatur kepemilikan & tarif sewa = pengatur Tarif Ritase (`wage.rate.manage`).
// Pembayaran tidak ditulis ke Arus Kas Back Office; Finance (F2-6) membaca `vehicle_rental_payments` per `for_month`.

const MANAGE = 'wage.rate.manage';
const PAY = 'logistics.vehicle_rental.pay';
const VIEW = 'logistics.vehicle_rental.view';

const canViewRental = (actor: Actor) => can(actor, VIEW) || can(actor, PAY);

type RentalRateRow = typeof vehicleRentalRates.$inferSelect;
type PaymentRow = typeof vehicleRentalPayments.$inferSelect;

async function accountNames(accountIds: number[]): Promise<Map<number, string>> {
  if (!accountIds.length) return new Map();
  const rows = await db.execute<{ account_id: number; name: string }>(sql`
    select l.account_id, e.name from auth.account_links l join hris.employees e on e.id = l.local_user_id
    where l.app_code = 'hris' and l.account_id in (${sql.join(accountIds.map((id) => sql`${id}`), sql`, `)})`);
  return new Map(rows.map((r) => [Number(r.account_id), r.name]));
}

// ── Pengaturan di Mobil & Rute ────────────────────────────────────────────────────────────────────────────────────

/** Kepemilikan + tarif sewa per mobil untuk layar Mobil & Rute. */
export async function vehicleRentalSettings(actor: Actor) {
  const today = wibDate(new Date());
  const [vehicleRows, rates] = await Promise.all([
    db.select().from(vehicles).orderBy(asc(vehicles.name)),
    db.select().from(vehicleRentalRates).orderBy(asc(vehicleRentalRates.effectiveFrom), asc(vehicleRentalRates.id)),
  ]);
  return {
    canManageRental: can(actor, MANAGE),
    rental: vehicleRows.map((v) => {
      const history = rates.filter((r) => r.vehicleId === v.id);
      const inForce = rentalRateOn(history, v.id, today);
      return {
        vehicleId: v.id, ownership: v.ownership as Ownership, ownershipLabel: OWNERSHIP_LABELS[v.ownership as Ownership],
        ownerName: v.rentalOwnerName, ownerNote: v.rentalOwnerNote,
        current: inForce ? { amount: inForce.amount, from: inForce.effectiveFrom } : null,
        history: [...history].reverse().map((r) => {
          const state = rateState({ ...r, routeId: 0, driverWithAssistant: 0, driverAlone: 0, assistant: 0 }, inForce?.id ?? null, today);
          return {
            id: r.id, from: r.effectiveFrom, fromLabel: dayLabel(r.effectiveFrom), amount: r.amount, state, stateLabel: RATE_STATE_LABELS[state],
            reason: r.reason, endReason: r.endReason, canCancel: state === 'SCHEDULED', canFix: state === 'IN_FORCE' || state === 'REPLACED',
          };
        }),
      };
    }),
  };
}

export type VehicleRentalSettings = Awaited<ReturnType<typeof vehicleRentalSettings>>;

/** Ubah kepemilikan mobil: Milik sendiri / Sewa (+ pemilik sewa). Riwayat tarif tetap tersimpan. */
export async function setVehicleOwnership(
  actor: Actor | null, input: { vehicleId: number; ownership: Ownership; ownerName: string | null; ownerNote: string | null },
): Promise<ServiceResult> {
  if (!actor || !can(actor, MANAGE)) return fail(403, FORBIDDEN);
  if (input.ownership !== 'OWNED' && input.ownership !== 'RENTED') return fail(400, 'Pilih kepemilikan.');
  const ownerName = input.ownerName ? cleanName(input.ownerName) : '';
  const ownerNote = input.ownerNote?.trim() || null;
  if (input.ownership === 'RENTED' && (!ownerName || ownerName.length > 80)) return fail(400, 'Isi nama pemilik sewa (1 sampai 80 huruf).');
  if (ownerNote && ownerNote.length > 300) return fail(400, 'Catatan pemilik paling banyak 300 huruf.');
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(vehicles).where(eq(vehicles.id, input.vehicleId)).limit(1);
    if (!before) return fail(404, 'Mobil tidak ditemukan.');
    const set = input.ownership === 'RENTED'
      ? { ownership: 'RENTED', rentalOwnerName: ownerName, rentalOwnerNote: ownerNote }
      : { ownership: 'OWNED' };
    await tx.update(vehicles).set({ ...set, updatedByAccountId: actor.accountId, updatedAt: new Date() }).where(eq(vehicles.id, input.vehicleId));
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'logistics.vehicle', entityId: input.vehicleId, action: 'vehicle.ownership',
      before: { ownership: before.ownership, ownerName: before.rentalOwnerName, ownerNote: before.rentalOwnerNote },
      after: { ownership: input.ownership, ownerName: input.ownership === 'RENTED' ? ownerName : before.rentalOwnerName, ownerNote: input.ownership === 'RENTED' ? ownerNote : before.rentalOwnerNote },
    });
    return { ok: true as const, data: undefined };
  });
}

/**
 * Tarif sewa per ritase baru: mulai tanggal X (boleh tanggal lalu agar bulan yang belum dibayar bisa dihitung). Satu
 * tanggal satu tarif per mobil; tarif lama tidak diubah (kenaikan tidak mengubah trip sebelum tanggal itu).
 */
export async function createRentalRate(actor: Actor | null, input: { vehicleId: number; effectiveFrom: IsoDate; amount: number }): Promise<ServiceResult<{ message: string }>> {
  if (!actor || !can(actor, MANAGE)) return fail(403, FORBIDDEN);
  const amountError = rentalRateProblem(input.amount);
  if (amountError) return fail(400, amountError);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) return fail(400, 'Pilih tanggal mulai berlaku.');
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, input.vehicleId)).limit(1);
  if (!vehicle) return fail(404, 'Mobil tidak ditemukan.');
  if (vehicle.ownership !== 'RENTED') return fail(400, 'Tandai mobil ini Sewa dulu.');
  const paid = await db.select({ id: vehicleRentalPayments.id }).from(vehicleRentalPayments).where(and(
    eq(vehicleRentalPayments.vehicleId, input.vehicleId), gte(vehicleRentalPayments.forMonth, `${monthOf(input.effectiveFrom)}-01`),
    sql`${vehicleRentalPayments.cancelledAt} is null`,
  )).limit(1);
  try {
    await db.insert(vehicleRentalRates).values({ vehicleId: input.vehicleId, effectiveFrom: input.effectiveFrom, amount: input.amount, createdByAccountId: actor.accountId });
  } catch (error) {
    if (isUniqueViolation(error, 'vehicle_rental_rates_active_unique')) return fail(409, `Sudah ada tarif sewa ${vehicle.name} mulai ${dayLabel(input.effectiveFrom)}. Batalkan atau betulkan yang itu.`);
    throw error;
  }
  const note = paid.length ? ' Ada bulan yang sudah dibayar sejak tanggal itu; periksa selisihnya di Sewa Mobil.' : '';
  return { ok: true, data: { message: `Tarif sewa ${vehicle.name} ${rupiah(input.amount)} per ritase mulai ${dayLabel(input.effectiveFrom)}.${note}` } };
}

/** Batalkan tarif sewa yang belum berlaku; alasan wajib. */
export async function cancelRentalRate(actor: Actor | null, id: number, reason: string): Promise<ServiceResult> {
  if (!actor || !can(actor, MANAGE)) return fail(403, FORBIDDEN);
  const reasonError = reasonProblem(reason);
  if (reasonError) return fail(400, reasonError);
  const today = wibDate(new Date());
  const [row] = await db.update(vehicleRentalRates).set({ status: 'CANCELLED', endedAt: new Date(), endedByAccountId: actor.accountId, endReason: reason.trim() })
    .where(and(eq(vehicleRentalRates.id, id), eq(vehicleRentalRates.status, 'ACTIVE'), sql`${vehicleRentalRates.effectiveFrom} > ${today}`))
    .returning({ id: vehicleRentalRates.id });
  return row ? { ok: true, data: undefined } : fail(409, 'Hanya tarif yang belum berlaku yang bisa dibatalkan. Yang sudah berlaku dibetulkan bila salah ketik.');
}

/** Betulkan salah ketik tarif sewa yang sudah berlaku: baris lama FIXED, baris betulan dengan tanggal sama. */
export async function fixRentalRate(actor: Actor | null, id: number, amount: number, reason: string): Promise<ServiceResult> {
  if (!actor || !can(actor, MANAGE)) return fail(403, FORBIDDEN);
  const reasonError = reasonProblem(reason);
  if (reasonError) return fail(400, reasonError);
  const amountError = rentalRateProblem(amount);
  if (amountError) return fail(400, amountError);
  const today = wibDate(new Date());
  return db.transaction(async (tx) => {
    const [old] = await tx.select().from(vehicleRentalRates).where(eq(vehicleRentalRates.id, id)).limit(1);
    if (!old || old.status !== 'ACTIVE' || old.effectiveFrom > today) return fail(409, 'Tarif ini belum berlaku, sudah dibetulkan, atau sudah dibatalkan.');
    if (old.amount === amount) return fail(400, 'Angka betulan sama dengan angka sekarang.');
    const [ended] = await tx.update(vehicleRentalRates).set({ status: 'FIXED', endedAt: new Date(), endedByAccountId: actor.accountId, endReason: reason.trim() })
      .where(and(eq(vehicleRentalRates.id, id), eq(vehicleRentalRates.status, 'ACTIVE'))).returning({ id: vehicleRentalRates.id });
    if (!ended) return fail(409, 'Tarif ini baru saja diubah orang lain. Muat ulang halaman.');
    await tx.insert(vehicleRentalRates).values({
      vehicleId: old.vehicleId, effectiveFrom: old.effectiveFrom, amount, fixesId: old.id, reason: reason.trim(), createdByAccountId: actor.accountId,
    });
    return { ok: true as const, data: undefined };
  });
}

// ── Rekap & Bayar ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Rekap satu bulan untuk mobil-mobil tertentu (dibaca di dalam/luar transaksi). */
async function loadRecaps(vehicleIds: number[], month: string, executor: Executor = db) {
  const range = monthRange(month)!;
  if (!vehicleIds.length) return new Map<number, ReturnType<typeof rentalRecap>>();
  const [tripRows, manualRows, rateRows] = await Promise.all([
    executor.select({ id: trips.id, number: trips.number, tripDate: trips.tripDate, status: trips.status, vehicleId: trips.vehicleId }).from(trips)
      .where(and(inArray(trips.vehicleId, vehicleIds), gte(trips.tripDate, range.from), lte(trips.tripDate, range.to))),
    executor.select({ id: tripWages.id, tripDate: tripWages.tripDate, role: tripWages.role, kind: tripWages.kind, cancelledAt: tripWages.cancelledAt, vehicleId: tripWages.vehicleId })
      .from(tripWages).where(and(
        inArray(tripWages.vehicleId, vehicleIds), eq(tripWages.origin, 'MANUAL'), gte(tripWages.tripDate, range.from), lte(tripWages.tripDate, range.to),
      )),
    executor.select().from(vehicleRentalRates).where(inArray(vehicleRentalRates.vehicleId, vehicleIds)),
  ]);
  return new Map(vehicleIds.map((vehicleId) => [vehicleId, rentalRecap({
    vehicleId,
    trips: tripRows.filter((t) => t.vehicleId === vehicleId && t.tripDate).map((t) => ({ id: t.id, number: t.number, tripDate: t.tripDate!, status: t.status })),
    manual: manualRows.filter((w) => w.vehicleId === vehicleId).map((w) => ({ id: w.id, tripDate: w.tripDate, role: w.role, kind: w.kind, cancelled: !!w.cancelledAt })),
    rates: rateRows as RentalRateRow[],
  })]));
}

const toPaymentRecord = (p: PaymentRow) => ({
  id: p.id, kind: p.kind as RentalPaymentKind, amount: p.amount, billedAmount: p.billedAmount, paidAt: p.paidAt, cancelled: !!p.cancelledAt,
});

/** Layar Logistik › Sewa Mobil: rekap per bulan per mobil sewa. */
export async function vehicleRentalScreen(actor: Actor | null, monthParam: string | null) {
  if (!actor || !canViewRental(actor)) return null;
  const today = wibDate(new Date());
  const month = monthParam && monthRange(monthParam) ? monthParam : previousMonth(monthOf(today));
  const forMonth = `${month}-01`;
  const payments = await db.select().from(vehicleRentalPayments).where(eq(vehicleRentalPayments.forMonth, forMonth)).orderBy(asc(vehicleRentalPayments.paidAt));
  const paidVehicleIds = [...new Set(payments.map((p) => p.vehicleId))];
  const vehicleRows = await db.select().from(vehicles)
    .where(paidVehicleIds.length ? or(eq(vehicles.ownership, 'RENTED'), inArray(vehicles.id, paidVehicleIds)) : eq(vehicles.ownership, 'RENTED'))
    .orderBy(asc(vehicles.name));
  const [recaps, names, places] = await Promise.all([
    loadRecaps(vehicleRows.map((v) => v.id), month),
    accountNames([...new Set(payments.flatMap((p) => [p.paidByAccountId, p.cancelledByAccountId].filter((x): x is number => x != null)))]),
    moneyPlaces(),
  ]);
  const placeName = new Map(places.map((p) => [p.id, `${p.name}${p.branchName ? ` · ${p.branchName}` : ''}`]));
  const canPay = can(actor, PAY);
  const payable = monthPayable(month, today);
  const rows = vehicleRows.map((v) => {
    const recap = recaps.get(v.id)!;
    const own = payments.filter((p) => p.vehicleId === v.id);
    const state = paymentState(recap.total, own.map(toPaymentRecord));
    const hasLiveTopUp = own.some((p) => p.kind === 'TOP_UP' && !p.cancelledAt);
    return {
      vehicleId: v.id, name: v.name, plate: v.plate, ownerName: v.rentalOwnerName, ownerNote: v.rentalOwnerNote, rented: v.ownership === 'RENTED',
      tripCount: recap.tripCount, total: recap.total, unratedDates: recap.unratedDates.map(dayLabel),
      lines: recap.lines.map((l) => ({ ...l, dateLabel: dayLabel(l.date) })),
      ...state,
      payments: own.map((p) => {
        const paidOn = wibDate(p.paidAt);
        return {
          id: p.id, kind: p.kind, kindLabel: PAYMENT_KIND_LABELS[p.kind as RentalPaymentKind], amount: p.amount, tripCount: p.tripCount, billedAmount: p.billedAmount,
          differenceReason: p.differenceReason, occurredOn: dayLabel(p.occurredOn), place: placeName.get(p.moneyPlaceId) ?? `#${p.moneyPlaceId}`,
          paidBy: names.get(p.paidByAccountId) ?? `Akun #${p.paidByAccountId}`, hasProof: !!p.proofFileId,
          cancelled: p.cancelledAt ? { by: p.cancelledByAccountId ? names.get(p.cancelledByAccountId) ?? '-' : '-', reason: p.cancelReason ?? '', on: dayLabel(wibDate(p.cancelledAt)) } : null,
          canCancel: canPay && !p.cancelledAt && !(p.kind === 'PAYMENT' && hasLiveTopUp)
            && canCancelPayment({ paidByAccountId: p.paidByAccountId, paidOn, actorAccountId: actor.accountId, ownerOrGm: actor.fullAccess, today }),
        };
      }),
    };
  });
  return {
    month, monthLabel: monthLabel(month), prev: previousMonth(month), next: nextMonth(month), today, payable,
    payableFrom: `1 ${monthLabel(nextMonth(month))}`, rows,
    totals: { tripCount: rows.reduce((s, r) => s + r.tripCount, 0), total: rows.reduce((s, r) => s + r.total, 0), paid: rows.reduce((s, r) => s + r.paid, 0) },
    canPay,
    places: canPay ? (await moneyPlaces({ payable: true })).map((p) => ({ id: p.id, label: `${p.name} (${MONEY_PLACE_KIND_LABELS[p.kind]}${p.branchName ? ` · ${p.branchName}` : ''})` })) : [],
  };
}

export type VehicleRentalScreenData = NonNullable<Awaited<ReturnType<typeof vehicleRentalScreen>>>;

export type RentalPayInput = {
  vehicleId: number; month: string; kind: RentalPaymentKind; occurredOn: string; moneyPlaceId: number; amount: number; differenceReason: string | null;
};

/** Bayar / Bayar susulan sewa satu mobil satu bulan (Finance/Pemilik/GM). Menyimpan potret rekap saat dibayar. */
export async function payVehicleRental(actor: Actor | null, input: RentalPayInput, photo: File | null): Promise<ServiceResult<{ message: string }>> {
  if (!actor || !can(actor, PAY)) return fail(403, FORBIDDEN);
  if (!monthRange(input.month)) return fail(400, 'Bulan tidak valid.');
  if (input.kind !== 'PAYMENT' && input.kind !== 'TOP_UP') return fail(400, 'Data tidak valid.');
  const place = await payableMoneyPlace(input.moneyPlaceId);
  if (!place) return fail(400, 'Pilih Dibayar dari: Tempat Uang aktif jenis Tunai atau Rekening (bukan Laci kasir).');
  let proofFileId: string | null = null;
  if (photo) {
    const upload = await saveUpload(actor, photo);
    if (!upload.ok) return upload;
    proofFileId = upload.data.id;
  }
  const today = wibDate(new Date());
  const forMonth = `${input.month}-01`;
  return db.transaction(async (tx) => {
    // Kunci baris mobil agar dua pembayaran bersamaan tidak membaca keadaan yang sama.
    const [vehicle] = await tx.execute<{ id: number; name: string }>(sql`select id, name from logistics.vehicles where id = ${input.vehicleId} for update`);
    if (!vehicle) return fail(404, 'Mobil tidak ditemukan.');
    const recap = (await loadRecaps([input.vehicleId], input.month, tx)).get(input.vehicleId)!;
    const own = await tx.select().from(vehicleRentalPayments)
      .where(and(eq(vehicleRentalPayments.vehicleId, input.vehicleId), eq(vehicleRentalPayments.forMonth, forMonth)));
    const state = paymentState(recap.total, own.map(toPaymentRecord));
    const reason = input.differenceReason?.trim() || null;
    const problem = payProblem({
      month: input.month, today, occurredOn: input.occurredOn, amount: input.amount, differenceReason: reason, unratedDates: recap.unratedDates,
      next: state.next, kind: input.kind,
    });
    if (problem) {
      const stale = monthPayable(input.month, today) && !recap.unratedDates.length && state.next?.kind !== input.kind;
      return fail(stale ? 409 : 400, problem);
    }
    try {
      const [row] = await tx.insert(vehicleRentalPayments).values({
        vehicleId: input.vehicleId, forMonth, kind: input.kind, tripCount: recap.tripCount, billedAmount: recap.total, amount: input.amount,
        differenceReason: input.amount !== state.next!.due ? reason : null, moneyPlaceId: place.id, occurredOn: input.occurredOn, proofFileId,
        paidByAccountId: actor.accountId,
      }).returning({ id: vehicleRentalPayments.id });
      await recordAudit(tx, {
        actorAccountId: actor.accountId, entity: 'logistics.vehicle_rental_payment', entityId: row.id, action: `vehicle_rental.${input.kind.toLowerCase()}`,
        after: { vehicleId: input.vehicleId, forMonth, tripCount: recap.tripCount, billedAmount: recap.total, amount: input.amount, moneyPlaceId: place.id },
        reason,
      });
    } catch (error) {
      if (isUniqueViolation(error, 'vehicle_rental_payments_one_payment')) return fail(409, 'Sewa bulan ini baru saja dibayar orang lain. Muat ulang halaman.');
      throw error;
    }
    const label = input.kind === 'PAYMENT' ? 'Sewa' : 'Bayar susulan sewa';
    return { ok: true as const, data: { message: `${label} ${vehicle.name} ${monthLabel(input.month)} ${rupiah(input.amount)} tercatat dari ${place.name}.` } };
  });
}

/** Batalkan pembayaran sewa: pembayar sendiri di hari yang sama, sesudahnya Pemilik/GM. Alasan wajib. */
export async function cancelVehicleRentalPayment(actor: Actor | null, id: number, reason: string): Promise<ServiceResult> {
  if (!actor || !can(actor, PAY)) return fail(403, FORBIDDEN);
  const reasonError = reasonProblem(reason);
  if (reasonError) return fail(400, reasonError);
  const today = wibDate(new Date());
  return db.transaction(async (tx) => {
    const [p] = await tx.execute<{ id: number }>(sql`select id from logistics.vehicle_rental_payments where id = ${id} for update`);
    if (!p) return fail(404, 'Pembayaran tidak ditemukan.');
    const [row] = await tx.select().from(vehicleRentalPayments).where(eq(vehicleRentalPayments.id, id)).limit(1);
    if (row.cancelledAt) return fail(409, 'Pembayaran ini sudah dibatalkan.');
    if (!canCancelPayment({ paidByAccountId: row.paidByAccountId, paidOn: wibDate(row.paidAt), actorAccountId: actor.accountId, ownerOrGm: actor.fullAccess, today })) {
      return fail(403, 'Sesudah hari pembayaran, hanya Pemilik atau GM yang bisa membatalkan. Pembayar sendiri bisa membatalkan di hari yang sama.');
    }
    if (row.kind === 'PAYMENT') {
      const [topUp] = await tx.select({ id: vehicleRentalPayments.id }).from(vehicleRentalPayments).where(and(
        eq(vehicleRentalPayments.vehicleId, row.vehicleId), eq(vehicleRentalPayments.forMonth, row.forMonth), eq(vehicleRentalPayments.kind, 'TOP_UP'),
        sql`${vehicleRentalPayments.cancelledAt} is null`,
      )).limit(1);
      if (topUp) return fail(409, 'Batalkan Bayar susulan bulan ini dulu.');
    }
    await tx.update(vehicleRentalPayments).set({ cancelledAt: new Date(), cancelledByAccountId: actor.accountId, cancelReason: reason.trim() })
      .where(eq(vehicleRentalPayments.id, id));
    await recordAudit(tx, {
      actorAccountId: actor.accountId, entity: 'logistics.vehicle_rental_payment', entityId: id, action: 'vehicle_rental.cancel',
      before: { amount: row.amount, kind: row.kind }, reason: reason.trim(),
    });
    return { ok: true as const, data: undefined };
  });
}

/** Foto bukti bayar sewa: hanya pemegang hak lihat/bayar sewa. */
export async function openRentalProof(actor: Actor | null, paymentId: number): Promise<string | null> {
  if (!actor || !canViewRental(actor)) return null;
  const [row] = await db.select({ fileId: vehicleRentalPayments.proofFileId }).from(vehicleRentalPayments).where(eq(vehicleRentalPayments.id, paymentId)).limit(1);
  return row?.fileId ?? null;
}

