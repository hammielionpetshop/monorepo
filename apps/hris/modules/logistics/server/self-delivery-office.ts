import { and, eq, inArray, sql } from 'drizzle-orm';
import { selfTripEvents, selfTripPayments, selfTrips, selfTripStops } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, type Actor, type ServiceResult } from '@/modules/access';
import { notify } from '@/modules/notifications';
import { rupiah } from '../rules/rates';
import { cashOf } from '../rules/self-delivery';
import {
  OFFICE_TABS, OFFICE_TAB_LABELS, officeActorProblem, officeReason, type OfficeTab, type SelfDecision,
} from '../rules/self-delivery-office';
import { addDays, wibDate } from '../rules/trip';
import { FORBIDDEN, accountsOf, fail, isUniqueViolation, peopleNames } from './data';
import { branchAccounts, onDuty, openSales, tripViews, type SelfTripView } from './self-delivery';

// Antar sendiri sisi kantor (spec LT1 §15.3, LT3c): daftar per cabang, tutup perjalanan, alihkan PJ, keputusan Gagal,
// tanda 23.59, pengantar kasir belum dipasangkan. Semua tindakan tercatat di self_trip_events (tidak dihapus).

const RUN = 'logistics.self_delivery.run';
const CASH = 'logistics.self_delivery.cash_receive';
const VIEW = 'logistics.self_delivery.view';
const MANAGE = 'logistics.self_delivery.manage';

class Rollback extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, message: string) { super(message); }
}

/** Cabang yang boleh dilihat: semua (null) atau daftar id cabang HRIS. Kosong = tidak berhak. */
function officeScope(actor: Actor): number[] | null | 'NONE' {
  if (actor.fullAccess || actor.grants.get(VIEW) === 'ALL' || actor.grants.get(MANAGE) === 'ALL') return null;
  if (actor.branchId != null && (can(actor, VIEW, { branchId: actor.branchId }) || can(actor, MANAGE, { branchId: actor.branchId }))) return [actor.branchId];
  return 'NONE';
}

const ids = (values: number[]) => sql.join((values.length ? values : [-1]).map((v) => sql`${v}`), sql`, `);
const startOfToday = (today: string) => `${today}T00:00:00+07:00`;

/** Saringan baris per tab (alias tabel `t`). */
function tabWhere(tab: OfficeTab, today: string) {
  const midnight = startOfToday(today);
  switch (tab) {
    case 'RUNNING': return sql`t.status = 'RUNNING' and t.started_at >= ${midnight}::timestamptz`;
    case 'LATE': return sql`t.status = 'RUNNING' and t.started_at < ${midnight}::timestamptz`;
    case 'FAILED': return sql`exists (select 1 from logistics.self_trip_stops x where x.trip_id = t.id and x.status = 'FAILED' and x.decision is null)`;
    case 'CASH': return sql`t.status in ('DONE', 'CLOSED') and t.cash_amount > 0 and t.cash_received_at is null`;
    case 'DONE': return sql`t.status in ('DONE', 'CLOSED') and t.started_at >= ${startOfToday(addDays(today, -6))}::timestamptz`;
  }
}

export type OfficeCandidate = { id: number; name: string };
export type UnpairedCourier = { name: string; branch: string; notes: number };

/** Layar kantor Antar Sendiri (spec LT1 §15.3). */
export async function selfDeliveryOfficeScreen(actor: Actor | null, filter: { tab: OfficeTab; branchId: number | null }) {
  if (!actor) return null;
  const scope = officeScope(actor);
  if (scope === 'NONE') return null;
  const today = wibDate(new Date());
  const branches = await db.execute<{ id: number; name: string; kasir_branch_id: number }>(sql`
    select id, name, kasir_branch_id from hris.branches where kasir_branch_id is not null
      ${scope ? sql`and id in (${ids(scope)})` : sql``} order by name`);
  const chosen = filter.branchId != null && branches.some((b) => Number(b.id) === filter.branchId) ? [filter.branchId] : branches.map((b) => Number(b.id));
  const counts = Object.fromEntries(await Promise.all(OFFICE_TABS.map(async (tab) => {
    const [row] = await db.execute<{ n: number }>(sql`
      select count(*)::int as n from logistics.self_trips t where t.branch_id in (${ids(chosen)}) and ${tabWhere(tab, today)}`);
    return [tab, Number(row?.n ?? 0)];
  }))) as Record<OfficeTab, number>;
  const tripIds = (await db.execute<{ id: number }>(sql`
    select t.id from logistics.self_trips t where t.branch_id in (${ids(chosen)}) and ${tabWhere(filter.tab, today)}
    order by t.started_at ${filter.tab === 'DONE' ? sql`desc` : sql`asc`} limit 100`)).map((r) => Number(r.id));
  const rows = tripIds.length ? await db.select().from(selfTrips).where(inArray(selfTrips.id, tripIds)) : [];
  const order = new Map(tripIds.map((id, i) => [id, i]));
  const trips = (await tripViews(rows)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);

  // Calon PJ pengganti: karyawan cabang itu yang berhak antar, sudah absen masuk, tanpa perjalanan berjalan.
  const runningBranches = [...new Set(trips.filter((t) => t.status === 'RUNNING').map((t) => t.branchId))];
  const candidates = new Map<number, OfficeCandidate[]>();
  if (runningBranches.length) {
    const [rows, names] = await Promise.all([
      db.execute<{ employee_id: number; branch_id: number }>(sql`
        select distinct cp.employee_id, cp.branch_id from hris.current_placements cp
        join hris.positions p on p.id = cp.position_id and p.active
        join hris.position_grants g on g.position_id = p.id and g.action = ${RUN}
        where cp.active and cp.branch_id in (${ids(runningBranches)})
          and not exists (select 1 from logistics.self_trips r where r.employee_id = cp.employee_id and r.status = 'RUNNING')`),
      peopleNames(),
    ]);
    const now = new Date();
    for (const r of rows) {
      if (!(await onDuty(Number(r.employee_id), now))) continue;
      const list = candidates.get(Number(r.branch_id)) ?? [];
      list.push({ id: Number(r.employee_id), name: names.get(Number(r.employee_id)) ?? `#${r.employee_id}` });
      candidates.set(Number(r.branch_id), list);
    }
  }

  // Pengantar kasir belum dipasangkan (LOG-108): nota kurir yang menunggu diantar dengan nama kasir tanpa pasangan karyawan.
  const kasirOf = new Map(branches.map((b) => [Number(b.kasir_branch_id), b.name]));
  const chosenKasir = branches.filter((b) => chosen.includes(Number(b.id))).map((b) => Number(b.kasir_branch_id));
  const unpairedMap = new Map<string, UnpairedCourier>();
  for (const s of chosenKasir.length ? await openSales(chosenKasir, db) : []) {
    if (s.courier_id == null || s.courier_employee_id != null) continue;
    const key = `${s.branch_id}:${s.courier_id}`;
    const row = unpairedMap.get(key) ?? { name: s.courier_name ?? `#${s.courier_id}`, branch: kasirOf.get(Number(s.branch_id)) ?? '-', notes: 0 };
    row.notes += 1;
    unpairedMap.set(key, row);
  }

  return {
    tab: filter.tab, tabs: OFFICE_TABS.map((t) => ({ key: t, label: OFFICE_TAB_LABELS[t], count: counts[t] })),
    branches: branches.map((b) => ({ id: Number(b.id), name: b.name })), branchId: chosen.length === 1 && branches.length > 1 ? chosen[0] : null,
    trips: trips.map((t) => ({
      ...t,
      canManage: officeActorProblem({ allowed: can(actor, MANAGE, { branchId: t.branchId }), actorEmployeeId: actor.personId, pjEmployeeId: t.employeeId }) === null,
      canDecide: can(actor, MANAGE, { branchId: t.branchId }),
      canCash: can(actor, CASH, { branchId: t.branchId }) && t.employeeId !== actor.personId,
      candidates: (candidates.get(t.branchId) ?? []).filter((c) => c.id !== t.employeeId),
    })),
    unpaired: [...unpairedMap.values()], canPair: can(actor, 'pos_groomer_link.manage') || can(actor, 'bonus.view'),
  };
}

export type SelfDeliveryOfficeData = NonNullable<Awaited<ReturnType<typeof selfDeliveryOfficeScreen>>>;
export type OfficeTripView = SelfDeliveryOfficeData['trips'][number];
export type { SelfTripView };

/**
 * Tutup perjalanan oleh kantor (LOG-110): bukan PJ-nya, alasan wajib. Tujuan tanpa hasil → Kirim Besok (nota kembali ke
 * daftar tugas). Tunai yang sudah dicatat tetap harus diterima laci. Absen Pulang PJ terbuka lagi; tanda ⚠ bonus tetap.
 */
export async function closeSelfTrip(actor: Actor | null, tripId: number, reason: string | null | undefined): Promise<ServiceResult<{ cash: number }>> {
  if (!actor) return fail(403, FORBIDDEN);
  const clean = officeReason(reason);
  if (!clean.ok) return fail(400, clean.error);
  try {
    return await db.transaction(async (tx) => {
      const [trip] = await tx.select().from(selfTrips).where(eq(selfTrips.id, tripId)).for('update').limit(1);
      if (!trip) throw new Rollback(404, 'Perjalanan antar tidak ditemukan.');
      const problem = officeActorProblem({ allowed: can(actor, MANAGE, { branchId: trip.branchId }), actorEmployeeId: actor.personId, pjEmployeeId: trip.employeeId });
      if (problem) throw new Rollback(403, problem);
      if (trip.status !== 'RUNNING') throw new Rollback(409, 'Perjalanan ini sudah kembali atau sudah ditutup.');
      const now = new Date();
      await tx.update(selfTripStops).set({
        status: 'TOMORROW', reasonCode: 'OFFICE_CLOSED', reasonText: `Ditutup kantor: ${clean.text}`, officeClosed: true,
        doneAt: now, doneByEmployeeId: actor.personId,
      }).where(and(eq(selfTripStops.tripId, tripId), eq(selfTripStops.status, 'OPEN')));
      const payments = await tx.select({ method: selfTripPayments.method, receivedAmount: selfTripPayments.receivedAmount })
        .from(selfTripPayments).where(eq(selfTripPayments.tripId, tripId));
      const cash = cashOf(payments);
      await tx.update(selfTrips).set({
        status: 'CLOSED', closedAt: now, closedByEmployeeId: actor.personId, closedByAccountId: actor.accountId, closeReason: clean.text, cashAmount: cash,
      }).where(eq(selfTrips.id, tripId));
      await tx.insert(selfTripEvents).values({ tripId, kind: 'CLOSED', reason: clean.text, byEmployeeId: actor.personId, byAccountId: actor.accountId, at: now });
      await notify(tx, await accountsOf([trip.employeeId]), {
        kind: 'logistics.self_closed', title: `Perjalanan antar ${trip.number} ditutup kantor`,
        body: `${clean.text}. Tujuan yang belum selesai kembali ke daftar tugas.${cash > 0 ? ` Serahkan tunai ${rupiah(cash)} ke laci cabang.` : ''}`,
        link: '/logistik/antar-sendiri', entity: 'self_trip', entityId: tripId,
      }, actor.accountId);
      if (cash > 0) {
        await notify(tx, (await branchAccounts(trip.branchId, CASH)).filter((a) => a !== trip.accountId), {
          kind: 'logistics.self_cash', title: `Terima tunai ${rupiah(cash)} dari antar ${trip.number}`,
          body: 'Perjalanan ditutup kantor. Hitung uangnya, masukkan ke laci, lalu tekan Sudah diterima.',
          link: '/logistik/antar-sendiri/kantor?tab=CASH', entity: 'self_trip', entityId: tripId,
        }, actor.accountId);
      }
      return { ok: true as const, data: { cash } };
    });
  } catch (error) {
    if (error instanceof Rollback) return fail(error.status, error.message);
    throw error;
  }
}

/**
 * Alihkan PJ (LOG-43, 108): PJ baru = karyawan cabang itu yang berhak antar, sudah absen masuk, tanpa perjalanan berjalan.
 * Tujuan yang belum selesai ditandai "pengantar beda dengan kasir" bila pengantar kasirnya bukan PJ baru.
 */
export async function handoverSelfTrip(actor: Actor | null, tripId: number, toEmployeeId: number, reason: string | null | undefined): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  const clean = officeReason(reason);
  if (!clean.ok) return fail(400, clean.error);
  const [peek] = await db.select().from(selfTrips).where(eq(selfTrips.id, tripId)).limit(1);
  if (!peek) return fail(404, 'Perjalanan antar tidak ditemukan.');
  if (toEmployeeId === peek.employeeId) return fail(400, 'Pilih orang lain sebagai PJ baru.');
  const [placement] = await db.execute<{ ok: boolean }>(sql`
    select true as ok from hris.current_placements cp
    join hris.positions p on p.id = cp.position_id and p.active
    join hris.position_grants g on g.position_id = p.id and g.action = ${RUN}
    where cp.active and cp.employee_id = ${toEmployeeId} and cp.branch_id = ${peek.branchId} limit 1`);
  if (!placement) return fail(400, 'PJ baru harus karyawan cabang ini yang berhak mengantar.');
  if (!(await onDuty(toEmployeeId, new Date()))) return fail(409, 'PJ baru belum absen masuk atau sudah absen pulang.');
  const [account] = await accountsOf([toEmployeeId]);
  if (!account) return fail(409, 'PJ baru belum punya akun HRIS.');
  try {
    return await db.transaction(async (tx) => {
      const [trip] = await tx.select().from(selfTrips).where(eq(selfTrips.id, tripId)).for('update').limit(1);
      if (!trip) throw new Rollback(404, 'Perjalanan antar tidak ditemukan.');
      const problem = officeActorProblem({ allowed: can(actor, MANAGE, { branchId: trip.branchId }), actorEmployeeId: actor.personId, pjEmployeeId: trip.employeeId });
      if (problem) throw new Rollback(403, problem);
      if (trip.status !== 'RUNNING') throw new Rollback(409, 'Perjalanan ini sudah kembali atau sudah ditutup.');
      const now = new Date();
      await tx.update(selfTrips).set({ employeeId: toEmployeeId, accountId: account }).where(eq(selfTrips.id, tripId));
      await tx.execute(sql`
        update logistics.self_trip_stops x set courier_mismatch = true
        where x.trip_id = ${tripId} and x.status = 'OPEN' and not exists (
          select 1 from logistics.pos_courier_sales s join hris.pos_groomer_links l on l.pos_groomer_id = s.courier_id and l.released_at is null
          where s.id = x.transaction_id and l.employee_id = ${toEmployeeId})`);
      await tx.insert(selfTripEvents).values({
        tripId, kind: 'HANDOVER', reason: clean.text, fromEmployeeId: trip.employeeId, toEmployeeId, byEmployeeId: actor.personId, byAccountId: actor.accountId, at: now,
      });
      await notify(tx, [account, ...(await accountsOf([trip.employeeId]))], {
        kind: 'logistics.self_handover', title: `PJ antar ${trip.number} dialihkan`,
        body: `${clean.text}. Lanjutkan Foto 2 dan Foto 3 dari Antar Sendiri.`, link: '/logistik/antar-sendiri', entity: 'self_trip', entityId: tripId,
      }, actor.accountId);
      return { ok: true as const, data: undefined };
    });
  } catch (error) {
    if (error instanceof Rollback) return fail(error.status, error.message);
    if (isUniqueViolation(error, 'self_trips_one_running')) return fail(409, 'PJ baru sudah punya perjalanan antar yang berjalan.');
    throw error;
  }
}

/**
 * Keputusan kiriman Gagal (spec LT1 §15.3): Kirim ulang = nota kembali ke daftar tugas; Batal kirim = alasan wajib, nota
 * tidak diantar lagi (ubah cara kirim / batalkan nota tetap di kasir BO).
 */
export async function decideSelfStop(actor: Actor | null, stopId: number, decision: SelfDecision, reason: string | null | undefined): Promise<ServiceResult> {
  if (!actor) return fail(403, FORBIDDEN);
  if (decision !== 'RESEND' && decision !== 'DROP') return fail(400, 'Pilih Kirim ulang atau Batal kirim.');
  const text = (reason ?? '').replace(/\s+/g, ' ').trim();
  if (decision === 'DROP') {
    const clean = officeReason(text);
    if (!clean.ok) return fail(400, clean.error);
  } else if (text.length > 300) return fail(400, 'Alasan paling panjang 300 huruf.');
  try {
    return await db.transaction(async (tx) => {
      const [stop] = await tx.select().from(selfTripStops).where(eq(selfTripStops.id, stopId)).for('update').limit(1);
      if (!stop) throw new Rollback(404, 'Tujuan tidak ditemukan.');
      const [trip] = await tx.select({ branchId: selfTrips.branchId }).from(selfTrips).where(eq(selfTrips.id, stop.tripId)).limit(1);
      if (!trip || !can(actor, MANAGE, { branchId: trip.branchId })) throw new Rollback(403, FORBIDDEN);
      if (stop.status !== 'FAILED' || stop.decision) throw new Rollback(409, 'Kiriman ini sudah diputuskan. Muat ulang halaman.');
      const now = new Date();
      await tx.update(selfTripStops).set({ decision, decisionReason: text || null, decidedAt: now, decidedByAccountId: actor.accountId })
        .where(eq(selfTripStops.id, stopId));
      await tx.insert(selfTripEvents).values({
        tripId: stop.tripId, stopId, kind: decision === 'RESEND' ? 'RESENT' : 'DROPPED', reason: text || null,
        byEmployeeId: actor.personId, byAccountId: actor.accountId, at: now,
      });
      return { ok: true as const, data: undefined };
    });
  } catch (error) {
    if (error instanceof Rollback) return fail(error.status, error.message);
    // Kirim ulang membebaskan nota; indeks unik tetap menjaga satu tujuan berlaku per nota.
    if (isUniqueViolation(error, 'self_trip_stops_live')) return fail(409, 'Nota ini sudah dibawa di perjalanan lain.');
    throw error;
  }
}

/** Kartu Beranda (spec LT1 §15.3 butir 5): belum kembali, Gagal belum diputuskan, tunai lewat hari — cabang yang dilihat. */
export async function selfDeliveryAttention(actor: Actor | null): Promise<{ late: number; failed: number; cashLate: number } | null> {
  if (!actor || !(actor.fullAccess || actor.grants.has(MANAGE) || actor.grants.has(VIEW))) return null;
  const scope = officeScope(actor);
  if (scope === 'NONE') return null;
  const today = wibDate(new Date());
  const where = scope ? sql`t.branch_id in (${ids(scope)})` : sql`true`;
  const [row] = await db.execute<{ late: number; failed: number; cash_late: number }>(sql`
    select
      count(*) filter (where ${tabWhere('LATE', today)})::int as late,
      count(*) filter (where ${tabWhere('FAILED', today)})::int as failed,
      count(*) filter (where ${tabWhere('CASH', today)} and coalesce(t.returned_at, t.closed_at) < ${startOfToday(today)}::timestamptz)::int as cash_late
    from logistics.self_trips t where ${where}`);
  const result = { late: Number(row?.late ?? 0), failed: Number(row?.failed ?? 0), cashLate: Number(row?.cash_late ?? 0) };
  return result.late || result.failed || result.cashLate ? result : null;
}
