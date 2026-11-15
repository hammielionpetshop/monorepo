import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// LT1a Surat Jalan + Data Toko (spec LT1 §12) pada DB sintetis dengan stub kasir. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_lt1a_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));

let admin: postgres.Sql;
let sql: postgres.Sql;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'kg' | 'finance' | 'kasir', number>;
let lg: typeof import('@/modules/logistics');
const pos: Record<string, number> = {};

describe.skipIf(!ADMIN_URL)('LT1a: Surat Jalan dan Data Toko dari kasir', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ now: new Date('2026-11-06T09:00:00+07:00'), toFake: ['Date'] });
    const adminUrl = new URL(ADMIN_URL!);
    adminUrl.pathname = '/postgres';
    admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database "${databaseName}"`);
    const url = new URL(ADMIN_URL!);
    url.pathname = `/${databaseName}`;
    sql = postgres(url.toString(), { max: 4, onnotice: () => {} });
    await sql`create schema petshop`;
    await sql`create table petshop.branches (id serial primary key, code varchar(20) not null, name varchar(100) not null, is_active boolean not null default true)`;
    await sql.unsafe(readFileSync(new URL('hris-db/test-stubs/petshop-pos.sql', root), 'utf8'));
    const { drizzle } = requireAuth('drizzle-orm/postgres-js');
    const { migrate } = requireAuth('drizzle-orm/postgres-js/migrator');
    const migrationClient = postgres(url.toString(), { max: 1, onnotice: () => {} });
    await migrate(drizzle(migrationClient), {
      migrationsFolder: fileURLToPath(new URL('auth/src/migrations/', root)), migrationsSchema: 'drizzle', migrationsTable: '__migrations_auth',
    });
    await migrationClient.end();
    for (const folder of [new URL('logistics/src/migrations/', root), new URL('hris-db/src/migrations/', root)]) {
      for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()) {
        await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();
      }
    }
    process.env.DATABASE_URL = url.toString();
    process.env.AUTH_COOKIE_ENV = 'staging';
    process.env.BACKOFFICE_PUBLIC_URL = 'https://bo.staginghml.my.id';

    const [{ id: hrisBranch }] = await sql`insert into hris.branches (name) values ('Gudang') returning id`;
    const person = async (name: string, position: string) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on) values (hris.next_employee_code(), ${name}, '2026-01-01') returning id`;
      const [p] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${hrisBranch}, ${p.id}, 'EMPLOYEE', '2026-01-01')`;
      return Number(row.id);
    };
    ids = {
      owner: await person('Elan', 'Pemilik'), kg: await person('Kepala Gudang Uji', 'Kepala Gudang'),
      finance: await person('Finance Uji', 'Finance'), kasir: await person('Kasir Uji', 'Kasir'),
    };

    // Kasir: Gudang (1), Toko Pusat (2), Toko Depan (3); pelanggan toko + pelanggan internal cabang.
    await sql`insert into petshop.branches (code, name) values ('GDG', 'Gudang'), ('TP', 'Toko Pusat'), ('TD', 'Toko Depan')`;
    const customer = async (name: string, extra: { internal?: boolean; phone?: string } = {}) => {
      const [row] = await sql`insert into petshop.customers (code, name, phone, address, is_internal_branch)
        values (${name.slice(0, 3).toUpperCase()}, ${name}, ${extra.phone ?? null}, 'Jl. Uji', ${extra.internal ?? false}) returning id`;
      return Number(row.id);
    };
    pos.sinar = await customer('Toko Sinar', { phone: '0812' });
    pos.maju = await customer('Toko Maju');
    pos.lain = await customer('Pelanggan Eceran');
    pos.internal = await customer('Internal Toko Depan', { internal: true });
    // created_at kasir = UTC tanpa zona. 2026-11-03 20:00 UTC = 4 Nov 03:00 WIB (masuk); 2026-11-02 = sebelum delivery_from.
    const sale = async (number: string, branchId: number, customerId: number | null, method: string | null, status: string, utc: string, revision = 1) => {
      const [row] = await sql`insert into petshop.transactions (trx_number, payable_amount, created_at, branch_id, customer_id, status, revision, delivery_method)
        values (${number}, 150000, ${utc}::text::timestamp, ${branchId}, ${customerId}, ${status}, ${revision}, ${method}) returning id`;
      return Number(row.id);
    };
    pos.old = await sale('TRX-OLD', 1, pos.sinar, 'TRUCK', 'COMPLETED', '2026-11-02 05:00:00');
    pos.t1 = await sale('TRX-1', 1, pos.sinar, 'TRUCK', 'COMPLETED', '2026-11-03 20:00:00', 2);
    pos.t2 = await sale('TRX-2', 2, pos.maju, 'TRUCK', 'COMPLETED', '2026-11-05 02:00:00');
    pos.t3 = await sale('TRX-3', 1, pos.maju, 'TRUCK', 'VOIDED', '2026-11-05 03:00:00');
    pos.t4 = await sale('TRX-4', 1, pos.sinar, 'TRUCK', 'PENDING_VOID', '2026-11-05 04:00:00');
    pos.pick = await sale('TRX-PICK', 1, pos.lain, 'PICKUP', 'COMPLETED', '2026-11-05 05:00:00');
    const transfer = async (number: string, source: number, status: string, method: string | null) => {
      await sql`insert into petshop.inter_branch_transfers (ibt_number, source_branch_id, destination_branch_id, status, delivery_method, created_at)
        values (${number}, ${source}, 3, ${status}, ${method}, '2026-11-05 01:00:00'::text::timestamp)`;
    };
    await transfer('IBT-1', 1, 'IN_TRANSIT', 'TRUCK');
    await transfer('IBT-2', 2, 'FULLY_RECEIVED', 'TRUCK');
    await transfer('IBT-3', 1, 'IN_TRANSIT', 'SELF');
    await transfer('IBT-4', 1, 'CANCELLED', 'TRUCK');

    lg = await import('@/modules/logistics');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
  });

  afterAll(async () => {
    vi.useRealTimers();
    delete process.env.AUTH_COOKIE_ENV;
    delete process.env.BACKOFFICE_PUBLIC_URL;
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const filter = (tab: 'WAITING' | 'RECEIVED' | 'CANCELLED', extra: Partial<{ originId: number; routeId: number; q: string }> = {}) => ({
    tab, originId: extra.originId ?? null, routeId: extra.routeId ?? null, q: extra.q ?? '',
  });

  it('hak: Kepala Gudang dan Finance melihat, kasir tidak; hanya Kepala Gudang/Pemilik mengubah toko', async () => {
    expect(await lg.deliveryNotesScreen(await actorOf(ids.kasir), filter('WAITING'))).toBeNull();
    expect(await lg.storesScreen(await actorOf(ids.kasir), '')).toBeNull();
    expect(await lg.deliveryNotesScreen(await actorOf(ids.finance), filter('WAITING'))).not.toBeNull();
    expect(await lg.saveStore(await actorOf(ids.finance), { customerId: pos.sinar, defaultRouteId: null, deliveryNote: 'x' }))
      .toMatchObject({ ok: false, status: 403 });
  });

  it('antrean Menunggu: nota truk selesai + PO Internal truk dalam perjalanan, sejak delivery_from, paling lama dulu', async () => {
    const data = (await lg.deliveryNotesScreen(await actorOf(ids.kg), filter('WAITING')))!;
    expect(data.from).toBe('2026-11-04');
    expect(data.rows.map((r) => r.number)).toEqual(['TRX-1', 'IBT-1', 'TRX-2']);
    const t1 = data.rows[0];
    expect(t1).toMatchObject({ on: '2026-11-04', age: 2, origin: 'Gudang', destination: 'Toko Sinar', amount: 150000, revised: true,
      link: 'https://bo.staginghml.my.id/transactions?trx=TRX-1' });
    expect(data.rows[1]).toMatchObject({ kind: 'TRANSFER', destination: 'Toko Depan', amount: null,
      link: expect.stringMatching(/\/purchase-orders\/internal\/\d+$/) });
    expect(Object.fromEntries(data.tabs.map((t) => [t.status, t.count]))).toEqual({ WAITING: 3, ON_TRIP: 0, NEEDS_DECISION: 0, DELIVERED: 0, RECEIVED: 1, CANCELLED: 3, DROPPED: 0 });
    expect(data.origins.map((o) => o.name)).toEqual(['Gudang', 'Toko Pusat']);
  });

  it('tab lain dan saringan', async () => {
    const kg = await actorOf(ids.kg);
    const cancelled = (await lg.deliveryNotesScreen(kg, filter('CANCELLED')))!;
    expect(cancelled.rows.map((r) => [r.number, r.pendingVoid])).toEqual([['IBT-4', false], ['TRX-3', false], ['TRX-4', true]]);
    expect((await lg.deliveryNotesScreen(kg, filter('RECEIVED')))!.rows.map((r) => r.number)).toEqual(['IBT-2']);
    const [{ id: tp }] = await sql`select id from petshop.branches where name = 'Toko Pusat'`;
    expect((await lg.deliveryNotesScreen(kg, filter('WAITING', { originId: Number(tp) })))!.rows.map((r) => r.number)).toEqual(['TRX-2']);
    expect((await lg.deliveryNotesScreen(kg, filter('WAITING', { q: 'sinar' })))!.rows.map((r) => r.number)).toEqual(['TRX-1']);
  });

  it('Data Toko: hanya toko truk; cari semua pelanggan bukan internal; simpan rute + catatan', async () => {
    const kg = await actorOf(ids.kg);
    expect((await lg.storesScreen(kg, ''))!.stores.map((s) => s.name).sort()).toEqual(['Toko Maju', 'Toko Sinar']);
    expect((await lg.storesScreen(kg, 'eceran'))!.stores.map((s) => s.name)).toEqual(['Pelanggan Eceran']);
    expect((await lg.storesScreen(kg, 'internal'))!.stores).toEqual([]);

    const [garut] = await sql`select id from logistics.routes where kind = 'DELIVERY' order by id limit 1`;
    const [shop] = await sql`select id from logistics.routes where kind = 'SHOPPING' order by id limit 1`;
    expect(await lg.saveStore(kg, { customerId: pos.internal, defaultRouteId: null, deliveryNote: null })).toMatchObject({ ok: false, status: 400 });
    expect(await lg.saveStore(kg, { customerId: 99999, defaultRouteId: null, deliveryNote: null })).toMatchObject({ ok: false, status: 404 });
    expect(await lg.saveStore(kg, { customerId: pos.lain, defaultRouteId: Number(shop.id), deliveryNote: null })).toMatchObject({ ok: false, status: 400 });
    expect(await lg.saveStore(kg, { customerId: pos.lain, defaultRouteId: null, deliveryNote: 'a'.repeat(501) })).toMatchObject({ ok: false, status: 400 });
    expect((await lg.saveStore(kg, { customerId: pos.lain, defaultRouteId: Number(garut.id), deliveryNote: '  pagar hijau ' })).ok).toBe(true);
    expect((await lg.saveStore(kg, { customerId: pos.lain, defaultRouteId: Number(garut.id), deliveryNote: 'pagar biru' })).ok).toBe(true);
    const rows = await sql`select customer_id, default_route_id, delivery_note, updated_by_account_id from logistics.stores`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ delivery_note: 'pagar biru', updated_by_account_id: ids.kg + 1000 });
    expect((await lg.storesScreen(kg, ''))!.stores.map((s) => s.name).sort()).toEqual(['Pelanggan Eceran', 'Toko Maju', 'Toko Sinar']);

    const detail = await lg.storeDetailScreen(kg, pos.sinar);
    expect(detail).toMatchObject({ notFound: false, canManage: true });
    if (detail && !detail.notFound) expect(detail.notes.map((n) => n.number)).toEqual(['TRX-4', 'TRX-1', 'TRX-OLD']);
    expect(await lg.storeDetailScreen(kg, pos.internal)).toEqual({ notFound: true });
  });

  it('rute bawaan ikut tampil di antrean dan bisa disaring', async () => {
    const kg = await actorOf(ids.kg);
    const [garut] = await sql`select id from logistics.routes where kind = 'DELIVERY' order by id limit 1`;
    await lg.saveStore(kg, { customerId: pos.maju, defaultRouteId: Number(garut.id), deliveryNote: null });
    const data = (await lg.deliveryNotesScreen(kg, filter('WAITING', { routeId: Number(garut.id) })))!;
    expect(data.rows.map((r) => r.number)).toEqual(['TRX-2']);
    expect(data.rows[0].route).toBeTruthy();
  });

  it('view kasir hanya bisa dibaca; data toko tidak bisa dihapus', async () => {
    await expect(sql`update logistics.pos_customers set name = 'X' where id = ${pos.sinar}`).rejects.toThrow(/hanya bisa dibaca/);
    await expect(sql`delete from logistics.pos_truck_sales`).rejects.toThrow(/hanya bisa dibaca/);
    await expect(sql`insert into logistics.pos_truck_transfers (id) values (1)`).rejects.toThrow(/hanya bisa dibaca/);
    await expect(sql`delete from logistics.stores`).rejects.toThrow(/tidak boleh dihapus/);
    expect((await sql`select name from petshop.customers where id = ${pos.sinar}`)[0].name).toBe('Toko Sinar');
  });
});
