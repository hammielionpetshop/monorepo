import { asc, eq, sql } from 'drizzle-orm';
import { routes, stores } from '@petshop/logistics';
import { db } from '@/lib/db';
import { can, type Actor, type ServiceResult } from '@/modules/access';
import { settingOn } from '@/modules/settings';
import {
  QUEUE_LABELS, QUEUE_STATUSES, ageDays, backofficeLink, cleanStoreNote, compareQueue, saleQueueStatus, transferQueueStatus,
  type NoteKind, type QueueStatus,
} from '../rules/delivery-notes';
import { wibDate, type IsoDate } from '../rules/trip';
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

const SALE_STATUSES: Record<QueueStatus, string[]> = { WAITING: ['COMPLETED'], RECEIVED: [], CANCELLED: ['VOIDED', 'PENDING_VOID'] };
const TRANSFER_STATUSES: Record<QueueStatus, string[]> = {
  WAITING: ['IN_TRANSIT'], RECEIVED: ['PARTIALLY_RECEIVED', 'FULLY_RECEIVED'], CANCELLED: ['CANCELLED'],
};
const inList = (values: string[]) => (values.length ? sql.join(values.map((v) => sql`${v}`), sql`, `) : sql`null`);

export type NoteRow = {
  key: string; kind: NoteKind; id: number; number: string; on: IsoDate; age: number; status: QueueStatus; pendingVoid: boolean;
  originId: number; origin: string; destination: string; customerId: number | null; routeId: number | null; route: string | null;
  amount: number | null; revised: boolean; link: string | null;
};

export type NotesFilter = { tab: QueueStatus; originId: number | null; routeId: number | null; q: string };

/** Layar Surat Jalan (spec LT1 §12): tab per status dengan angka, saringan cabang asal / rute bawaan / cari. */
export async function deliveryNotesScreen(actor: Actor | null, filter: NotesFilter) {
  if (!actor || !can(actor, 'logistics.delivery_note.view')) return null;
  const today = wibDate(new Date());
  const from = await deliveryFrom(today);
  const base = backofficeBase();
  const routeList = await deliveryRoutes();
  const routeName = new Map(routeList.map((r) => [r.id, r.name]));

  const [sales, transfers, counts, origins] = await Promise.all([
    db.execute<{
      id: number; trx_number: string; branch_id: number; branch_name: string; customer_id: number | null; customer_name: string | null;
      payable_amount: number; status: string; revision: number; trx_on: string; default_route_id: number | null;
    }>(sql`
      select s.id, s.trx_number, s.branch_id, s.branch_name, s.customer_id, c.name as customer_name, s.payable_amount, s.status, s.revision,
        s.trx_on::text as trx_on, st.default_route_id
      from logistics.pos_truck_sales s
      left join logistics.pos_customers c on c.id = s.customer_id
      left join logistics.stores st on st.customer_id = s.customer_id
      where s.trx_on >= ${from}::date and s.status in (${inList(SALE_STATUSES[filter.tab])})
      order by s.trx_on, s.trx_number limit ${LIST_LIMIT}`),
    db.execute<{
      id: number; ibt_number: string; source_branch_id: number; source_branch_name: string; destination_branch_name: string; status: string; created_on: string;
    }>(sql`
      select id, ibt_number, source_branch_id, source_branch_name, destination_branch_name, status, created_on::text as created_on
      from logistics.pos_truck_transfers
      where created_on >= ${from}::date and status in (${inList(TRANSFER_STATUSES[filter.tab])})
      order by created_on, ibt_number limit ${LIST_LIMIT}`),
    db.execute<{ kind: NoteKind; status: string; n: number }>(sql`
      select 'SALE' as kind, status, count(*)::int as n from logistics.pos_truck_sales where trx_on >= ${from}::date group by status
      union all
      select 'TRANSFER' as kind, status, count(*)::int as n from logistics.pos_truck_transfers where created_on >= ${from}::date group by status`),
    db.execute<{ id: number; name: string }>(sql`
      select distinct branch_id as id, branch_name as name from logistics.pos_truck_sales where trx_on >= ${from}::date
      union
      select distinct source_branch_id, source_branch_name from logistics.pos_truck_transfers where created_on >= ${from}::date
      order by name`),
  ]);

  const tabCounts = Object.fromEntries(QUEUE_STATUSES.map((s) => [s, 0])) as Record<QueueStatus, number>;
  for (const c of counts) {
    const status = c.kind === 'SALE' ? saleQueueStatus(c.status).status : transferQueueStatus(c.status);
    if (status) tabCounts[status] += Number(c.n);
  }

  let rows: NoteRow[] = [
    ...sales.map((s): NoteRow => {
      const queue = saleQueueStatus(s.status);
      const routeId = s.default_route_id == null ? null : Number(s.default_route_id);
      return {
        key: `S${s.id}`, kind: 'SALE', id: Number(s.id), number: s.trx_number, on: s.trx_on, age: ageDays(s.trx_on, today),
        status: queue.status, pendingVoid: queue.pendingVoid, originId: Number(s.branch_id), origin: s.branch_name,
        destination: s.customer_name ?? 'Pelanggan tidak ditemukan', customerId: s.customer_id == null ? null : Number(s.customer_id),
        routeId, route: routeId ? routeName.get(routeId) ?? null : null, amount: Number(s.payable_amount), revised: Number(s.revision) > 1,
        link: backofficeLink(base, 'SALE', { number: s.trx_number, id: Number(s.id) }),
      };
    }),
    ...transfers.map((t): NoteRow => ({
      key: `T${t.id}`, kind: 'TRANSFER', id: Number(t.id), number: t.ibt_number, on: t.created_on, age: ageDays(t.created_on, today),
      status: transferQueueStatus(t.status) ?? filter.tab, pendingVoid: false, originId: Number(t.source_branch_id), origin: t.source_branch_name,
      destination: t.destination_branch_name, customerId: null, routeId: null, route: null, amount: null, revised: false,
      link: backofficeLink(base, 'TRANSFER', { number: t.ibt_number, id: Number(t.id) }),
    })),
  ];
  const q = filter.q.trim().toLowerCase();
  rows = rows.filter((r) => (filter.originId == null || r.originId === filter.originId)
    && (filter.routeId == null || r.routeId === filter.routeId)
    && (!q || r.number.toLowerCase().includes(q) || r.destination.toLowerCase().includes(q)))
    .sort(compareQueue);

  return {
    tab: filter.tab, tabs: QUEUE_STATUSES.map((s) => ({ status: s, label: QUEUE_LABELS[s], count: tabCounts[s] })),
    rows, truncated: sales.length >= LIST_LIMIT || transfers.length >= LIST_LIMIT, from, today, hasBackoffice: !!backofficeLink(base, 'SALE', { number: 'x', id: 1 }),
    origins: origins.map((o) => ({ id: Number(o.id), name: o.name })), routes: routeList.filter((r) => r.active).map((r) => ({ id: r.id, name: r.name })),
    filter, canStores: can(actor, 'logistics.store.view'),
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
      select customer_id, count(*)::int as truck_notes, count(*) filter (where status = 'COMPLETED')::int as waiting, max(trx_on)::text as last_on
      from logistics.pos_truck_sales where trx_on >= ${from}::date and customer_id is not null group by customer_id
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
    db.execute<{ id: number; trx_number: string; branch_name: string; payable_amount: number; status: string; trx_on: string }>(sql`
      select id, trx_number, branch_name, payable_amount, status, trx_on::text as trx_on from logistics.pos_truck_sales
      where customer_id = ${customerId} order by created_at desc limit 20`),
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
      const queue = saleQueueStatus(n.status);
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
