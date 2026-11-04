import { asc, eq, sql } from 'drizzle-orm';
import { routes, stores } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, type Actor, type ServiceResult } from '@/modules/access';
import { settingOn } from '@/modules/settings';
import {
  HRIS_TAB_STATUS, NEWEST_FIRST, QUEUE_LABELS, QUEUE_STATUSES, ageDays, backofficeLink, cleanStoreNote, compareQueue, queueOf, saleQueueStatus,
  type NoteKind, type QueueStatus,
} from '../rules/delivery-notes';
import { reopenOpen } from '../rules/driver-trip';
import { wibClock, wibDate, type IsoDate } from '../rules/trip';
import { FORBIDDEN, fail } from './data';

// Surat Jalan + Data Toko (spec LT1 §12). Kasir hanya dibaca lewat view logistics.pos_* (migrasi logistics 0003).
const LIST_LIMIT = 300;
const backofficeBase = () => process.env.BACKOFFICE_PUBLIC_URL ?? null;

async function deliveryFrom(today: IsoDate): Promise<IsoDate> {
  return String(await settingOn<string>('logistics.delivery_from', today));
}

async function deliveryRoutes() {
  return db.select({ id: routes.id, name: routes.name, active: routes.active }).from(routes).where(eq(routes.kind, 'DELIVERY')).orderBy(asc(routes.name));
}

const SALE_STATUSES: Record<QueueStatus, string[]> = {
  WAITING: ['COMPLETED'], ON_TRIP: ['COMPLETED'], NEEDS_DECISION: ['COMPLETED'], DELIVERED: ['COMPLETED'], RECEIVED: [],
  CANCELLED: ['VOIDED', 'PENDING_VOID'], DROPPED: ['COMPLETED'],
};
const TRANSFER_STATUSES: Record<QueueStatus, string[]> = {
  WAITING: ['IN_TRANSIT'], ON_TRIP: ['IN_TRANSIT'], NEEDS_DECISION: ['IN_TRANSIT'], DELIVERED: ['IN_TRANSIT'],
  RECEIVED: ['PARTIALLY_RECEIVED', 'FULLY_RECEIVED'], CANCELLED: ['CANCELLED'], DROPPED: ['IN_TRANSIT'],
};
const inList = (values: string[]) => (values.length ? sql.join(values.map((v) => sql`${v}`), sql`, `) : sql`null`);
/** Status HRIS per tab: Menunggu = belum pernah disentuh atau kembali menunggu; tab HRIS lain = status surat jalannya. */
const hrisFilter = (tab: QueueStatus) => {
  if (tab === 'WAITING') return sql`coalesce(dn.status, 'WAITING') = 'WAITING'`;
  const status = HRIS_TAB_STATUS[tab];
  return status ? sql`dn.status = ${status}` : sql`true`;
};
/** Kejadian HRIS terakhir surat jalan (alasan Gagal / Batal, trip-nya, jam). */
const lastEvent = sql`left join lateral (
  select e.kind, e.reason, e.at, et.number as trip_number, et.id as trip_id from logistics.delivery_note_events e
  left join logistics.trips et on et.id = e.trip_id where e.note_id = dn.id order by e.id desc limit 1) ev on true`;
const EVENT_COLUMNS = sql`dn.id as note_id, ev.kind as ev_kind, ev.reason as ev_reason, ev.at as ev_at, ev.trip_number as ev_trip_number, ev.trip_id as ev_trip_id`;
type EventColumns = { note_id: number | null; ev_kind: string | null; ev_reason: string | null; ev_at: string | null; ev_trip_number: string | null; ev_trip_id: number | null };
/** Trip yang sedang membawa surat jalan ini. */
const onTrip = sql`left join lateral (
  select t.id, t.number from logistics.trip_visit_notes l join logistics.trip_visits v on v.id = l.visit_id join logistics.trips t on t.id = v.trip_id
  where l.note_id = dn.id and l.active limit 1) tr on true`;

export type NoteRow = {
  key: string; kind: NoteKind; id: number; number: string; on: IsoDate; age: number; status: QueueStatus; pendingVoid: boolean;
  originId: number; origin: string; destination: string; customerId: number | null; routeId: number | null; route: string | null;
  amount: number | null; revised: boolean; link: string | null; trip: { id: number; number: string } | null; tomorrowCount: number;
  /** Id surat jalan HRIS (untuk keputusan) dan kejadian terakhirnya (LT1b-2a). */
  noteId: number | null; event: { kind: string; reason: string | null; at: string; on: IsoDate; trip: { id: number; number: string } | null } | null;
  canReopen: boolean;
};

export type NotesFilter = { tab: QueueStatus; originId: number | null; routeId: number | null; q: string };

/** Layar Surat Jalan (spec LT1 §12): tab per status dengan angka, saringan cabang asal / rute bawaan / cari. */
export async function deliveryNotesScreen(actor: Actor | null, filter: NotesFilter) {
  if (!actor || !can(actor, 'logistics.delivery_note.view')) return null;
  const today = wibDate(new Date());
  const from = await deliveryFrom(today);
  const base = backofficeBase();
  const now = new Date();
  const [routeList, reopenDays] = await Promise.all([deliveryRoutes(), settingOn<number>('logistics.reopen_days', today)]);
  const order = NEWEST_FIRST.includes(filter.tab) ? sql`desc` : sql`asc`;
  const routeName = new Map(routeList.map((r) => [r.id, r.name]));

  const [sales, transfers, counts, origins] = await Promise.all([
    db.execute<{
      id: number; trx_number: string; branch_id: number; branch_name: string; customer_id: number | null; customer_name: string | null;
      payable_amount: number; status: string; revision: number; trx_on: string; default_route_id: number | null;
      hris_status: string | null; tomorrow_count: number | null; trip_id: number | null; trip_number: string | null;
    } & EventColumns>(sql`
      select s.id, s.trx_number, s.branch_id, s.branch_name, s.customer_id, c.name as customer_name, s.payable_amount, s.status, s.revision,
        s.trx_on::text as trx_on, st.default_route_id, dn.status as hris_status, dn.tomorrow_count, tr.id as trip_id, tr.number as trip_number, ${EVENT_COLUMNS}
      from logistics.pos_truck_sales s
      left join logistics.pos_customers c on c.id = s.customer_id
      left join logistics.stores st on st.customer_id = s.customer_id
      left join logistics.delivery_notes dn on dn.kind = 'SALE' and dn.doc_id = s.id
      ${onTrip}
      ${lastEvent}
      where s.trx_on >= ${from}::date and s.status in (${inList(SALE_STATUSES[filter.tab])}) and ${hrisFilter(filter.tab)}
      order by s.trx_on ${order}, s.trx_number ${order} limit ${LIST_LIMIT}`),
    db.execute<{
      id: number; ibt_number: string; source_branch_id: number; source_branch_name: string; destination_branch_name: string; status: string; created_on: string;
      hris_status: string | null; tomorrow_count: number | null; trip_id: number | null; trip_number: string | null;
    } & EventColumns>(sql`
      select p.id, p.ibt_number, p.source_branch_id, p.source_branch_name, p.destination_branch_name, p.status, p.created_on::text as created_on,
        dn.status as hris_status, dn.tomorrow_count, tr.id as trip_id, tr.number as trip_number, ${EVENT_COLUMNS}
      from logistics.pos_truck_transfers p
      left join logistics.delivery_notes dn on dn.kind = 'TRANSFER' and dn.doc_id = p.id
      ${onTrip}
      ${lastEvent}
      where p.created_on >= ${from}::date and p.status in (${inList(TRANSFER_STATUSES[filter.tab])}) and ${hrisFilter(filter.tab)}
      order by p.created_on ${order}, p.ibt_number ${order} limit ${LIST_LIMIT}`),
    db.execute<{ kind: NoteKind; status: string; hris_status: string | null; n: number }>(sql`
      select 'SALE' as kind, s.status, dn.status as hris_status, count(*)::int as n from logistics.pos_truck_sales s
        left join logistics.delivery_notes dn on dn.kind = 'SALE' and dn.doc_id = s.id
        where s.trx_on >= ${from}::date group by s.status, dn.status
      union all
      select 'TRANSFER' as kind, p.status, dn.status as hris_status, count(*)::int as n from logistics.pos_truck_transfers p
        left join logistics.delivery_notes dn on dn.kind = 'TRANSFER' and dn.doc_id = p.id
        where p.created_on >= ${from}::date group by p.status, dn.status`),
    db.execute<{ id: number; name: string }>(sql`
      select distinct branch_id as id, branch_name as name from logistics.pos_truck_sales where trx_on >= ${from}::date
      union
      select distinct source_branch_id, source_branch_name from logistics.pos_truck_transfers where created_on >= ${from}::date
      order by name`),
  ]);

  const tabCounts = Object.fromEntries(QUEUE_STATUSES.map((s) => [s, 0])) as Record<QueueStatus, number>;
  for (const c of counts) {
    const queue = queueOf(c.kind, c.status, c.hris_status);
    if (queue) tabCounts[queue.status] += Number(c.n);
  }
  const tripOf = (r: { trip_id: number | null; trip_number: string | null }) => (r.trip_id && r.trip_number ? { id: Number(r.trip_id), number: r.trip_number } : null);
  const eventOf = (r: EventColumns, status: QueueStatus) => {
    const at = r.ev_kind && r.ev_at ? new Date(r.ev_at) : null;
    return {
      noteId: r.note_id == null ? null : Number(r.note_id),
      event: at ? {
        kind: r.ev_kind!, reason: r.ev_reason, at: wibClock(at), on: wibDate(at),
        trip: r.ev_trip_id && r.ev_trip_number ? { id: Number(r.ev_trip_id), number: r.ev_trip_number } : null,
      } : null,
      canReopen: status === 'DROPPED' && actor.fullAccess && r.ev_kind === 'DROPPED' && !!at && reopenOpen(at, now, Number(reopenDays)),
    };
  };

  let rows: NoteRow[] = [
    ...sales.map((s): NoteRow => {
      const queue = queueOf('SALE', s.status, s.hris_status) ?? { status: filter.tab, pendingVoid: false };
      const routeId = s.default_route_id == null ? null : Number(s.default_route_id);
      return {
        key: `S${s.id}`, kind: 'SALE', id: Number(s.id), number: s.trx_number, on: s.trx_on, age: ageDays(s.trx_on, today),
        status: queue.status, pendingVoid: queue.pendingVoid, originId: Number(s.branch_id), origin: s.branch_name,
        destination: s.customer_name ?? 'Pelanggan tidak ditemukan', customerId: s.customer_id == null ? null : Number(s.customer_id),
        routeId, route: routeId ? routeName.get(routeId) ?? null : null, amount: Number(s.payable_amount), revised: Number(s.revision) > 1,
        link: backofficeLink(base, 'SALE', { number: s.trx_number, id: Number(s.id) }), trip: tripOf(s), tomorrowCount: Number(s.tomorrow_count ?? 0),
        ...eventOf(s, queue.status),
      };
    }),
    ...transfers.map((t): NoteRow => {
      const status = queueOf('TRANSFER', t.status, t.hris_status)?.status ?? filter.tab;
      return {
        key: `T${t.id}`, kind: 'TRANSFER', id: Number(t.id), number: t.ibt_number, on: t.created_on, age: ageDays(t.created_on, today),
        status, pendingVoid: false, originId: Number(t.source_branch_id), origin: t.source_branch_name,
        destination: t.destination_branch_name, customerId: null, routeId: null, route: null, amount: null, revised: false,
        link: backofficeLink(base, 'TRANSFER', { number: t.ibt_number, id: Number(t.id) }), trip: tripOf(t), tomorrowCount: Number(t.tomorrow_count ?? 0),
        ...eventOf(t, status),
      };
    }),
  ];
  const q = filter.q.trim().toLowerCase();
  rows = rows.filter((r) => (filter.originId == null || r.originId === filter.originId)
    && (filter.routeId == null || r.routeId === filter.routeId)
    && (!q || r.number.toLowerCase().includes(q) || r.destination.toLowerCase().includes(q)))
    .sort(NEWEST_FIRST.includes(filter.tab) ? (a, b) => compareQueue(b, a) : compareQueue);

  return {
    tab: filter.tab, tabs: QUEUE_STATUSES.map((s) => ({ status: s, label: QUEUE_LABELS[s], count: tabCounts[s] })),
    rows, truncated: sales.length >= LIST_LIMIT || transfers.length >= LIST_LIMIT, from, today, hasBackoffice: !!backofficeLink(base, 'SALE', { number: 'x', id: 1 }),
    origins: origins.map((o) => ({ id: Number(o.id), name: o.name })), routes: routeList.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name })),
    filter, canStores: can(actor, 'logistics.store.view'), canDecide: can(actor, 'logistics.delivery_note.decide'), reopenDays: Number(reopenDays),
  };
}

export type StoreRow = {
  customerId: number; code: string | null; name: string; phone: string | null; address: string | null; active: boolean;
  route: string | null; note: string | null; truckNotes: number; waiting: number; lastOn: IsoDate | null;
};

/**
 * Daftar Data Toko (spec LT1 §12, keputusan owner F): pelanggan bukan internal yang pernah dikirimi truk (sejak
 * `logistics.delivery_from`) atau sudah diberi data pengiriman. Kata cari ≥ 2 huruf mencari semua pelanggan bukan internal.
 */
export async function storesScreen(actor: Actor | null, query: string) {
  if (!actor || !can(actor, 'logistics.store.view')) return null;
  const today = wibDate(new Date());
  const from = await deliveryFrom(today);
  const q = query.trim();
  const searching = q.length >= 2;
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const rows = await db.execute<{
    id: number; code: string | null; name: string; phone: string | null; address: string | null; active: boolean;
    route_name: string | null; delivery_note: string | null; truck_notes: number; waiting: number; last_on: string | null;
  }>(sql`
    with truck as (
      select s.customer_id, count(*)::int as truck_notes,
        count(*) filter (where s.status = 'COMPLETED' and coalesce(dn.status, 'WAITING') = 'WAITING')::int as waiting, max(s.trx_on)::text as last_on
      from logistics.pos_truck_sales s left join logistics.delivery_notes dn on dn.kind = 'SALE' and dn.doc_id = s.id
      where s.trx_on >= ${from}::date and s.customer_id is not null group by s.customer_id
    )
    select c.id, c.code, c.name, c.phone, c.address, c.active, r.name as route_name, st.delivery_note,
      coalesce(t.truck_notes, 0) as truck_notes, coalesce(t.waiting, 0) as waiting, t.last_on
    from logistics.pos_customers c
    left join truck t on t.customer_id = c.id
    left join logistics.stores st on st.customer_id = c.id
    left join logistics.routes r on r.id = st.default_route_id
    where not c.is_internal_branch
      and ${searching
        ? sql`(c.name ilike ${like} or c.code ilike ${like} or c.phone ilike ${like})`
        : sql`(t.customer_id is not null or (st.id is not null and (st.default_route_id is not null or st.delivery_note is not null)))`}
    order by t.last_on desc nulls last, c.name
    limit ${LIST_LIMIT}`);
  const list: StoreRow[] = rows.map((r) => ({
    customerId: Number(r.id), code: r.code, name: r.name, phone: r.phone, address: r.address, active: r.active, route: r.route_name,
    note: r.delivery_note, truckNotes: Number(r.truck_notes), waiting: Number(r.waiting), lastOn: r.last_on,
  }));
  return { stores: list, query: q, searching, truncated: list.length >= LIST_LIMIT, from };
}

/** Rincian toko: data kasir (baca saja), data pengiriman, nota truk terakhir. */
export async function storeDetailScreen(actor: Actor | null, customerId: number) {
  if (!actor || !can(actor, 'logistics.store.view')) return null;
  const today = wibDate(new Date());
  const base = backofficeBase();
  const [customer] = await db.execute<{
    id: number; code: string | null; name: string; phone: string | null; address: string | null; active: boolean; is_internal_branch: boolean;
  }>(sql`select id, code, name, phone, address, active, is_internal_branch from logistics.pos_customers where id = ${customerId}`);
  if (!customer || customer.is_internal_branch) return { notFound: true as const };
  const [[store], routeList, notes] = await Promise.all([
    db.select().from(stores).where(eq(stores.customerId, customerId)).limit(1),
    deliveryRoutes(),
    db.execute<{ id: number; trx_number: string; branch_name: string; payable_amount: number; status: string; trx_on: string; hris_status: string | null }>(sql`
      select s.id, s.trx_number, s.branch_name, s.payable_amount, s.status, s.trx_on::text as trx_on, dn.status as hris_status
      from logistics.pos_truck_sales s left join logistics.delivery_notes dn on dn.kind = 'SALE' and dn.doc_id = s.id
      where s.customer_id = ${customerId} order by s.created_at desc limit 20`),
  ]);
  const routeId = store?.defaultRouteId ?? null;
  return {
    notFound: false as const,
    store: {
      customerId: Number(customer.id), code: customer.code, name: customer.name, phone: customer.phone, address: customer.address, active: customer.active,
      routeId, route: routeId ? routeList.find((r) => r.id === routeId)?.name ?? null : null, note: store?.deliveryNote ?? null,
    },
    routes: routeList.filter((r) => r.active || r.id === routeId).map((r) => ({ id: r.id, name: r.name })),
    notes: notes.map((n) => {
      const queue = queueOf('SALE', n.status, n.hris_status) ?? saleQueueStatus(n.status);
      return {
        id: Number(n.id), number: n.trx_number, origin: n.branch_name, amount: Number(n.payable_amount), on: n.trx_on, age: ageDays(n.trx_on, today),
        status: QUEUE_LABELS[queue.status], pendingVoid: queue.pendingVoid, link: backofficeLink(base, 'SALE', { number: n.trx_number, id: Number(n.id) }),
      };
    }),
    canManage: can(actor, 'logistics.store.manage'),
  };
}

/** Simpan rute bawaan + catatan pengiriman toko (spec LT1 §3.8, §12). Nama, HP, alamat tetap diubah di kasir. */
export async function saveStore(
  actor: Actor | null, input: { customerId: number; defaultRouteId: number | null; deliveryNote: string | null },
): Promise<ServiceResult<{ customerId: number }>> {
  if (!actor || !can(actor, 'logistics.store.manage')) return fail(403, FORBIDDEN);
  const note = cleanStoreNote(input.deliveryNote);
  if (!note.ok) return fail(400, note.error);
  const [customer] = await db.execute<{ is_internal_branch: boolean }>(sql`
    select is_internal_branch from logistics.pos_customers where id = ${input.customerId}`);
  if (!customer) return fail(404, 'Pelanggan tidak ditemukan di kasir.');
  if (customer.is_internal_branch) return fail(400, 'Pelanggan internal (cabang) bukan toko; kiriman ke cabang lewat PO Internal.');
  const [current] = await db.select().from(stores).where(eq(stores.customerId, input.customerId)).limit(1);
  if (input.defaultRouteId != null) {
    const [route] = await db.select().from(routes).where(eq(routes.id, input.defaultRouteId)).limit(1);
    if (!route || route.kind !== 'DELIVERY') return fail(400, 'Pilih rute kirim.');
    if (!route.active && current?.defaultRouteId !== route.id) return fail(400, `Rute ${route.name} sudah nonaktif.`);
  }
  const now = new Date();
  await db.insert(stores).values({
    customerId: input.customerId, defaultRouteId: input.defaultRouteId, deliveryNote: note.value, createdByAccountId: actor.accountId,
  }).onConflictDoUpdate({
    target: stores.customerId,
    set: { defaultRouteId: input.defaultRouteId, deliveryNote: note.value, updatedByAccountId: actor.accountId, updatedAt: now },
  });
  return { ok: true, data: { customerId: input.customerId } };
}
