import { and, asc, eq, gte, inArray, isNull, lte, sql, type SQL } from 'drizzle-orm';
import { routes, tripRates, tripWages, vehicles } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, type Actor, type ServiceResult } from '@/modules/access';
import { notify } from '@/modules/notifications';
import {
  RATE_STATE_LABELS, changeKind, dayLabel, earliestFrom, numbersProblem, pairLabel, rateOnDate, rateState, rupiah, sameNumbers,
  unratedMessage, type RateNumbers, type RateRecord,
} from '../rules/rates';
import { ROUTE_KIND_LABELS, addDays, reasonProblem, wibDate, type CrewRole, type IsoDate, type RouteKind } from '../rules/trip';
import { FORBIDDEN, accountsOf, activePeople, fail, isUniqueViolation, type Executor } from './data';

// Tarif ritase (spec L7 §3.1, §3.4). Tabelnya di schema logistics (pasangan mobil + rute ada di sini); rupiah per orang
// ditulis modul Gaji, yang membaca tarif lewat fungsi di bawah (modul logistics tidak mengimpor modul Gaji).

export type RateRow = typeof tripRates.$inferSelect;

export async function loadRates(executor: Executor = db): Promise<RateRow[]> {
  return executor.select().from(tripRates).orderBy(asc(tripRates.effectiveFrom), asc(tripRates.id));
}

/** Satu fungsi tarif (WAJ-04): baris yang berlaku untuk pasangan pada tanggal itu, atau null. */
export async function rateOn(vehicleId: number, routeId: number, date: IsoDate, executor: Executor = db): Promise<RateRow | null> {
  const rows = await executor.select().from(tripRates).where(and(eq(tripRates.vehicleId, vehicleId), eq(tripRates.routeId, routeId)));
  return rateOnDate(rows, vehicleId, routeId, date);
}

/** Nama pasangan (mobil ke rute) yang belum bertarif pada tanggal itu; kosong = semua bertarif. */
export async function unratedPairs(vehicleId: number, routeIds: number[], date: IsoDate, executor: Executor = db): Promise<string[]> {
  if (!routeIds.length) return [];
  const [rows, [vehicle], routeRows] = await Promise.all([
    executor.select().from(tripRates).where(and(eq(tripRates.vehicleId, vehicleId), inArray(tripRates.routeId, routeIds))),
    executor.select({ name: vehicles.name }).from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1),
    executor.select({ id: routes.id, name: routes.name }).from(routes).where(inArray(routes.id, routeIds)),
  ]);
  const name = new Map(routeRows.map((r) => [r.id, r.name]));
  return [...new Set(routeIds)].filter((routeId) => !rateOnDate(rows, vehicleId, routeId, date))
    .map((routeId) => pairLabel(vehicle?.name ?? 'Mobil', name.get(routeId) ?? 'rute'));
}

/** Penolakan baku LOG-21/36 bila ada pasangan belum bertarif. */
export async function rateProblem(vehicleId: number, routeIds: number[], date: IsoDate, executor: Executor = db): Promise<string | null> {
  const missing = await unratedPairs(vehicleId, routeIds, date, executor);
  return missing.length ? unratedMessage(missing, date) : null;
}

/** Baris ritase untuk penilai upah modul Gaji (dibaca, tidak diubah). */
export async function ritaseRows(filter: { ids?: number[]; tripId?: number; from?: IsoDate; to?: IsoDate; pairs?: { vehicleId: number; routeId: number }[] }) {
  const where: SQL[] = [];
  if (filter.ids) where.push(inArray(tripWages.id, filter.ids.length ? filter.ids : [-1]));
  if (filter.tripId) where.push(eq(tripWages.tripId, filter.tripId));
  if (filter.from) where.push(gte(tripWages.tripDate, filter.from));
  if (filter.to) where.push(lte(tripWages.tripDate, filter.to));
  if (filter.pairs) {
    if (!filter.pairs.length) return [];
    where.push(sql`(${tripWages.vehicleId}, ${tripWages.routeId}) in (${sql.join(filter.pairs.map((p) => sql`(${p.vehicleId}, ${p.routeId})`), sql`, `)})`);
  }
  const rows = await db.select().from(tripWages).where(and(...where)).orderBy(asc(tripWages.tripDate), asc(tripWages.id));
  return rows.map((w) => ({
    id: w.id, tripId: w.tripId, employeeId: w.employeeId, role: w.role as CrewRole, kind: w.kind as 'RITASE' | 'SHOPPING', tripDate: w.tripDate,
    vehicleId: w.vehicleId, routeId: w.routeId, withAssistant: w.withAssistant, manual: w.origin === 'MANUAL', cancelled: !!w.cancelledAt,
    cancelReason: w.cancelReason,
  }));
}

export type RitaseRow = Awaited<ReturnType<typeof ritaseRows>>[number];

/** Nama mobil, rute, dan nomor trip untuk tampilan modul lain. */
export async function fleetLabels() {
  const [vehicleRows, routeRows] = await Promise.all([db.select().from(vehicles), db.select().from(routes)]);
  return {
    vehicles: new Map(vehicleRows.map((v) => [v.id, v.name])),
    routes: new Map(routeRows.map((r) => [r.id, { name: r.name, kind: r.kind as RouteKind }])),
  };
}

export async function tripNumbers(ids: number[]): Promise<Map<number, string>> {
  if (!ids.length) return new Map();
  const rows = await db.execute<{ id: number; number: string }>(sql`select id, number from logistics.trips where id in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
  return new Map([...rows].map((r) => [Number(r.id), r.number]));
}

const numbersOf = (r: RateNumbers): RateNumbers => ({ driverWithAssistant: r.driverWithAssistant, driverAlone: r.driverAlone, assistant: r.assistant });

function describe(n: RateNumbers): string {
  return `driver ada kenek ${rupiah(n.driverWithAssistant)}, driver tanpa kenek ${rupiah(n.driverAlone)}, kenek ${rupiah(n.assistant)}`;
}

/** Layar Tarif Ritase (DRV-L02): satu baris per pasangan mobil × rute aktif, riwayat per pasangan. */
export async function ratesScreen(actor: Actor | null) {
  if (!actor || !can(actor, 'wage.rate.view')) return null;
  const today = wibDate(new Date());
  const [vehicleRows, routeRows, rows] = await Promise.all([
    db.select().from(vehicles).orderBy(asc(vehicles.name)),
    db.select().from(routes).orderBy(asc(routes.kind), asc(routes.name)),
    loadRates(),
  ]);
  const pairs = vehicleRows.flatMap((v) => routeRows.map((r) => {
    const history = rows.filter((x) => x.vehicleId === v.id && x.routeId === r.id);
    const inForce = rateOnDate(history, v.id, r.id, today);
    const scheduled = history.filter((x) => x.status === 'ACTIVE' && x.effectiveFrom > today);
    return {
      key: `${v.id}-${r.id}`, vehicleId: v.id, routeId: r.id, vehicle: v.name, route: r.name, routeKind: r.kind as RouteKind,
      routeKindLabel: ROUTE_KIND_LABELS[r.kind as RouteKind], active: v.active && r.active,
      current: inForce ? { ...numbersOf(inForce), from: inForce.effectiveFrom } : null,
      scheduled: scheduled.map((x) => ({ ...numbersOf(x), from: x.effectiveFrom })),
      history: [...history].reverse().map((x) => {
        const state = rateState(x, inForce?.id ?? null, today);
        return {
          id: x.id, from: x.effectiveFrom, ...numbersOf(x), state, stateLabel: RATE_STATE_LABELS[state], reason: x.reason, endReason: x.endReason,
          canCancel: state === 'SCHEDULED', canFix: state === 'IN_FORCE' || state === 'REPLACED',
        };
      }),
    };
  }));
  const active = pairs.filter((p) => p.active);
  return {
    today, pairs,
    counts: { active: active.length, unrated: active.filter((p) => !p.current).length, scheduled: active.filter((p) => p.scheduled.length).length },
    canManage: can(actor, 'wage.rate.manage'),
  };
}

export type RateInput = { vehicleId: number; routeId: number; effectiveFrom: IsoDate } & RateNumbers;

/** Pratinjau Tarif Baru (DRV-L03 langkah 2-3): tarif sekarang, jenis perubahan, tanggal paling cepat. */
export async function ratePreview(actor: Actor | null, vehicleId: number, routeId: number, numbers: RateNumbers | null) {
  if (!actor || !can(actor, 'wage.rate.manage')) return null;
  const today = wibDate(new Date());
  const rows = await db.select().from(tripRates).where(and(eq(tripRates.vehicleId, vehicleId), eq(tripRates.routeId, routeId)));
  const everRated = rows.some((r) => r.status === 'ACTIVE');
  const current = rateOnDate(rows, vehicleId, routeId, today);
  const change = numbers ? changeKind(everRated ? (current ?? numbers) : null, numbers) : everRated ? 'UP_OR_SAME' : 'NEW_PAIR';
  return { today, current: current ? { ...numbersOf(current), from: current.effectiveFrom } : null, change, earliest: earliestFrom(change, today) };
}

async function pairNames(vehicleId: number, routeId: number, executor: Executor = db) {
  const [[vehicle], [route]] = await Promise.all([
    executor.select().from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1),
    executor.select().from(routes).where(eq(routes.id, routeId)).limit(1),
  ]);
  return { vehicle, route };
}

/** Driver & kenek aktif + orang yang 3 bulan terakhir punya ritase di pasangan itu (spec L7 §7). */
async function rateAudience(vehicleId: number, routeId: number, today: IsoDate): Promise<number[]> {
  const [people, recent] = await Promise.all([
    activePeople(today),
    db.selectDistinct({ employeeId: tripWages.employeeId }).from(tripWages).where(and(
      eq(tripWages.vehicleId, vehicleId), eq(tripWages.routeId, routeId), gte(tripWages.tripDate, addDays(today, -92)), isNull(tripWages.cancelledAt),
    )),
  ]);
  const ids = new Set([...people.filter((p) => p.duty.drive || p.duty.assist).map((p) => p.id), ...recent.map((r) => r.employeeId)]);
  return accountsOf([...ids]);
}

/**
 * Tarif Baru (DRV-L03): Pemilik/GM. Tidak berlaku mundur; jarak berlaku dihitung server (PRI-35, U3). Satu tanggal satu
 * tarif per pasangan. Tanpa Papan Perubahan Aturan: driver dan kenek diberi tahu lewat Pemberitahuan (§9 butir 5).
 */
export async function createRate(actor: Actor | null, input: RateInput): Promise<ServiceResult<{ id: number; message: string }>> {
  if (!actor || !can(actor, 'wage.rate.manage')) return fail(403, FORBIDDEN);
  const numbers = numbersOf(input);
  const numbersError = numbersProblem(numbers);
  if (numbersError) return fail(400, numbersError);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom)) return fail(400, 'Pilih tanggal mulai berlaku.');
  const { vehicle, route } = await pairNames(input.vehicleId, input.routeId);
  if (!vehicle || !vehicle.active) return fail(400, 'Pilih mobil yang aktif.');
  if (!route || !route.active) return fail(400, 'Pilih rute yang aktif.');
  const preview = await ratePreview(actor, input.vehicleId, input.routeId, numbers);
  if (!preview) return fail(403, FORBIDDEN);
  if (preview.current && preview.change !== 'NEW_PAIR' && sameNumbers(preview.current, numbers)) return fail(400, 'Angkanya sama dengan tarif yang berlaku sekarang.');
  if (input.effectiveFrom < preview.earliest) {
    const why = preview.change === 'DOWN' ? 'ada angka yang turun, jadi paling cepat 7 hari lagi' : 'tarif tidak berlaku mundur dan paling cepat besok';
    return fail(400, `Tanggal berlaku paling cepat ${dayLabel(preview.earliest)} (${why}).`);
  }
  const label = pairLabel(vehicle.name, route.name);
  return db.transaction(async (tx) => {
    let id: number;
    try {
      [{ id }] = await tx.insert(tripRates).values({ vehicleId: input.vehicleId, routeId: input.routeId, effectiveFrom: input.effectiveFrom, ...numbers, createdByAccountId: actor.accountId })
        .returning({ id: tripRates.id });
    } catch (error) {
      if (isUniqueViolation(error, 'trip_rates_active_unique')) return fail(409, `Sudah ada tarif ${label} mulai ${dayLabel(input.effectiveFrom)}. Batalkan dulu bila ingin menggantinya.`);
      throw error;
    }
    const before = preview.current ? ` (sebelumnya ${describe(preview.current)})` : '';
    await notify(tx, await rateAudience(input.vehicleId, input.routeId, preview.today), {
      kind: 'wage.rate_changed', title: `Tarif ${label} mulai ${dayLabel(input.effectiveFrom)}`,
      body: `${describe(numbers)}${before}.`, link: '/trip-saya', entity: 'trip_rate', entityId: id,
    }, actor.accountId);
    return { ok: true as const, data: { id, message: `Tarif ${label} tersimpan, mulai ${dayLabel(input.effectiveFrom)}. Driver dan kenek diberi tahu.` } };
  });
}

/** Batalkan tarif terjadwal (belum berlaku): Pemilik/GM, alasan wajib. */
export async function cancelRate(actor: Actor | null, id: number, reason: string): Promise<ServiceResult> {
  if (!actor || !can(actor, 'wage.rate.manage')) return fail(403, FORBIDDEN);
  const reasonError = reasonProblem(reason);
  if (reasonError) return fail(400, reasonError);
  const today = wibDate(new Date());
  const [row] = await db.update(tripRates).set({ status: 'CANCELLED', endedAt: new Date(), endedByAccountId: actor.accountId, endReason: reason.trim() })
    .where(and(eq(tripRates.id, id), eq(tripRates.status, 'ACTIVE'), sql`${tripRates.effectiveFrom} > ${today}`)).returning({ id: tripRates.id });
  return row ? { ok: true, data: undefined } : fail(409, 'Hanya tarif yang belum berlaku yang bisa dibatalkan. Tarif yang sudah berlaku digantikan tarif baru atau dibetulkan bila salah ketik.');
}

/** Baris tarif yang boleh dibetulkan (sudah berlaku, belum dibetulkan/dibatalkan). */
export async function fixableRate(id: number, executor: Executor = db): Promise<RateRow | null> {
  const today = wibDate(new Date());
  const [row] = await executor.select().from(tripRates).where(eq(tripRates.id, id)).limit(1);
  return row && row.status === 'ACTIVE' && row.effectiveFrom <= today ? row : null;
}

/**
 * Betulkan salah ketik (DRV-L04, U4): angka baris yang sudah berlaku; pasangan dan tanggal tetap. Baris lama FIXED
 * (tetap tersimpan), baris betulan menggantikannya. Penilaian ulang upah dijalankan modul Gaji sesudahnya.
 */
export async function fixRate(actor: Actor | null, id: number, numbers: RateNumbers, reason: string): Promise<ServiceResult<{ id: number; oldId: number }>> {
  if (!actor || !can(actor, 'wage.rate.manage')) return fail(403, FORBIDDEN);
  const reasonError = reasonProblem(reason);
  if (reasonError) return fail(400, reasonError);
  const clean = numbersOf(numbers);
  const numbersError = numbersProblem(clean);
  if (numbersError) return fail(400, numbersError);
  return db.transaction(async (tx) => {
    const old = await fixableRate(id, tx);
    if (!old) return fail(409, 'Tarif ini belum berlaku, sudah dibetulkan, atau sudah dibatalkan.');
    if (sameNumbers(old, clean)) return fail(400, 'Angka betulan sama dengan angka sekarang.');
    const [ended] = await tx.update(tripRates).set({ status: 'FIXED', endedAt: new Date(), endedByAccountId: actor.accountId, endReason: reason.trim() })
      .where(and(eq(tripRates.id, id), eq(tripRates.status, 'ACTIVE'))).returning({ id: tripRates.id });
    if (!ended) return fail(409, 'Tarif ini baru saja diubah orang lain. Muat ulang halaman.');
    const [row] = await tx.insert(tripRates).values({
      vehicleId: old.vehicleId, routeId: old.routeId, effectiveFrom: old.effectiveFrom, ...clean, fixesId: old.id, reason: reason.trim(),
      createdByAccountId: actor.accountId,
    }).returning({ id: tripRates.id });
    return { ok: true as const, data: { id: row.id, oldId: old.id } };
  });
}

/** Untuk pratinjau akibat betulkan salah ketik di modul Gaji. */
export async function rateById(id: number): Promise<(RateRecord & { vehicle: string; route: string }) | null> {
  const [row] = await db.select().from(tripRates).where(eq(tripRates.id, id)).limit(1);
  if (!row) return null;
  const { vehicle, route } = await pairNames(row.vehicleId, row.routeId);
  return { ...row, vehicle: vehicle?.name ?? '-', route: route?.name ?? '-' };
}
