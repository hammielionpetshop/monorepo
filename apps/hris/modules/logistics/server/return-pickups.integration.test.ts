import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// A2 tugas jemput retur (spec docs/work/specs/2026-11-08-jemput-retur-design.md) pada DB sintetis dengan stub kasir.
// Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_a2_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const DAY = '2026-11-06';
const GUDANG = { latitude: -7.350564720030627, longitude: 108.10865608125447 };
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], 'foto.jpg', { type: 'image/jpeg' });
const RETURN_ITEMS = [{ name: 'Royal Canin 2 kg', quantity: '2', unit: 'pcs' }, { name: 'Pasir', quantity: '1,5', unit: 'sak' }];

let admin: postgres.Sql;
let sql: postgres.Sql;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'kg' | 'driver' | 'kenek' | 'finance', number>;
let lg: typeof import('@/modules/logistics');
const pos: Record<string, number> = {};
const pickups: Record<string, number> = {};
let routeId = 0;
let vehicleId = 0;
let pickupTripId = 0;

const at = (clock: string, day = DAY) => vi.setSystemTime(new Date(`${day}T${clock}:00+07:00`));

describe.skipIf(!ADMIN_URL)('A2: tugas jemput retur', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ now: new Date(`${DAY}T07:00:00+07:00`), toFake: ['Date'] });
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
    await sql`insert into petshop.branches (code, name) values ('GDG', 'Gudang'), ('TP', 'Toko Pusat')`;
    for (const folder of [new URL('logistics/src/migrations/', root), new URL('hris-db/src/migrations/', root)]) {
      for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()) {
        if (folder.pathname.includes('hris-db') && file.startsWith('0031')) {
          await sql`insert into hris.branches (name, latitude, longitude, kasir_branch_id) values ('Gudang', ${GUDANG.latitude}, ${GUDANG.longitude}, 1)`;
        }
        await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();
      }
    }
    process.env.DATABASE_URL = url.toString();
    process.env.AUTH_COOKIE_ENV = 'staging';
    const [{ id: gudang }] = await sql`select id from hris.branches where name = 'Gudang'`;
    const person = async (name: string, position: string) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on) values (hris.next_employee_code(), ${name}, '2026-01-01') returning id`;
      const [p] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${gudang}, ${p.id}, 'EMPLOYEE', '2026-01-01')`;
      return Number(row.id);
    };
    ids = {
      kg: await person('Kepala Gudang Uji', 'Kepala Gudang'), driver: await person('Dedi', 'Driver'), kenek: await person('Eko', 'Kenek'),
      finance: await person('Fina', 'Finance'),
    };
    for (const [position, duty] of [['Driver', 'DRIVE'], ['Kenek', 'ASSIST']]) {
      await sql`insert into hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
        select 'position.field_duty_auto', 'POSITION', id, ${sql.json(duty)}, '2026-01-01', 'ACTIVE', 'Uji A2' from hris.positions where name = ${position}`;
    }
    const [route] = await sql`select id from logistics.routes where name = 'Garut'`;
    const [vehicle] = await sql`select id from logistics.vehicles where name = 'L300'`;
    routeId = Number(route.id);
    vehicleId = Number(vehicle.id);
    const customer = async (name: string) => {
      const [row] = await sql`insert into petshop.customers (code, name, address) values (${name.slice(5, 8).toUpperCase()}, ${name}, 'Jl. Uji') returning id`;
      return Number(row.id);
    };
    pos.sinar = await customer('Toko Sinar');
    pos.lain = await customer('Toko Lain');
    pos.maju = await customer('Toko Maju');

    lg = await import('@/modules/logistics');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
  });

  afterAll(async () => {
    vi.useRealTimers();
    delete process.env.AUTH_COOKIE_ENV;
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const tripInput = (pickupIds: number[], assistantIds: number[]) => ({
    vehicleId, routeId, shoppingRouteIds: [], driverId: ids.driver, assistantIds, noteKeys: [], pickupIds,
  });

  it('buat tugas: hak, satu terbuka per toko, alasan wajib; masuk trip lewat form dan Masukkan ke trip', async () => {
    const finance = await actorOf(ids.finance);
    expect(await lg.createReturnPickup(await actorOf(ids.driver), { customerId: pos.sinar, reason: 'Kedaluwarsa 3 sak' })).toMatchObject({ ok: false, status: 403 });
    expect(await lg.createReturnPickup(finance, { customerId: pos.sinar, reason: 'ok' })).toMatchObject({ ok: false, status: 400 });
    const sinar = await lg.createReturnPickup(finance, { customerId: pos.sinar, reason: 'Kedaluwarsa 3 sak', estimate: '3 sak Royal' });
    expect(sinar.ok).toBe(true);
    expect(await lg.createReturnPickup(finance, { customerId: pos.sinar, reason: 'Retur kedua' })).toMatchObject({ ok: false, status: 409 });
    const lain = await lg.createReturnPickup(finance, { customerId: pos.lain, reason: 'Barang salah kirim' });
    const maju = await lg.createReturnPickup(finance, { customerId: pos.maju, reason: 'Rusak di gudang toko' });
    pickups.sinar = sinar.ok ? sinar.data.id : 0;
    pickups.lain = lain.ok ? lain.data.id : 0;
    pickups.maju = maju.ok ? maju.data.id : 0;
    const kg = await actorOf(ids.kg);
    // Trip Draft membawa tugas Sinar lewat form (toko tanpa surat jalan di trip ini).
    const made = await lg.createTrip(kg, tripInput([pickups.sinar], [ids.kenek]));
    expect(made.ok).toBe(true);
    pickupTripId = made.ok ? made.data.id : 0;
    expect(await lg.assignReturnPickup(finance, pickups.lain, pickupTripId)).toMatchObject({ ok: false, status: 403 });
    expect((await lg.assignReturnPickup(kg, pickups.lain, pickupTripId)).ok).toBe(true);
    expect(await lg.assignReturnPickup(kg, pickups.lain, pickupTripId)).toMatchObject({ ok: false, status: 409 });
    expect(await lg.cancelReturnPickup(finance, pickups.lain, 'Salah toko')).toMatchObject({ ok: false, status: 409 });
    const loaded = await lg.tripDetailScreen(kg, pickupTripId);
    expect(loaded!.delivery.returns.map((r) => r.store).sort()).toEqual(['Toko Lain', 'Toko Sinar']);
    // Ubah trip Draft: centang dilepas → kembali Menunggu, lalu dimasukkan lagi.
    expect((await lg.updateDraft(kg, pickupTripId, tripInput([pickups.sinar], [ids.kenek]))).ok).toBe(true);
    expect((await sql`select status from logistics.return_pickups where id = ${pickups.lain}`)[0].status).toBe('WAITING');
    expect((await lg.assignReturnPickup(kg, pickups.lain, pickupTripId)).ok).toBe(true);
    expect((await lg.cancelReturnPickup(finance, pickups.maju, 'Toko batal retur')).ok).toBe(true);
    expect((await lg.returnPickupsScreen(finance))!.done.map((p) => p.statusLabel)).toEqual(['Dibatalkan']);
  });

  it('di toko: Menuju Garasi ditahan; Diambil → laporan Retur + Barang Kembali; Kirim Besok kembali Menunggu', async () => {
    const kg = await actorOf(ids.kg);
    expect((await lg.markReady(kg, pickupTripId)).ok).toBe(true);
    at('09:00');
    const driver = await actorOf(ids.driver);
    expect((await lg.departTrip(driver, pickupTripId, jpeg(), GUDANG)).ok).toBe(true);
    expect(await lg.headHome(driver, pickupTripId, jpeg(), null)).toMatchObject({ ok: false, status: 409 });
    expect(await lg.processReturnPickup(driver, pickupTripId, pickups.sinar, { outcome: 'PICKED', items: [] }, jpeg())).toMatchObject({ ok: false, status: 400 });
    expect(await lg.processReturnPickup(driver, pickupTripId, pickups.sinar, { outcome: 'PICKED', items: RETURN_ITEMS }, null)).toMatchObject({ ok: false, status: 400 });
    expect((await lg.processReturnPickup(await actorOf(ids.kenek), pickupTripId, pickups.sinar, { outcome: 'PICKED', items: RETURN_ITEMS, note: '1 dus basah' }, jpeg())).ok).toBe(true);
    expect(await lg.processReturnPickup(driver, pickupTripId, pickups.sinar, { outcome: 'NO_GOODS', note: 'tidak ada' }, jpeg())).toMatchObject({ ok: false, status: 409 });
    expect(await lg.processReturnPickup(driver, pickupTripId, pickups.lain, { outcome: 'TOMORROW', note: 'tdk' }, jpeg())).toMatchObject({ ok: false, status: 400 });
    expect((await lg.processReturnPickup(driver, pickupTripId, pickups.lain, { outcome: 'TOMORROW', note: 'Toko tutup, pemilik pergi' }, jpeg())).ok).toBe(true);
    const [task] = await sql`select status, tries from logistics.return_pickups where id = ${pickups.lain}`;
    expect(task).toMatchObject({ status: 'WAITING', tries: 1 });
    const [report] = await sql`select kind, carried_back, visit_id, owner_branch_id from logistics.visit_reports where return_pickup_id = ${pickups.sinar}`;
    expect(report).toMatchObject({ kind: 'RETURN', carried_back: true, visit_id: null, owner_branch_id: 1 });
    at('15:00');
    expect((await lg.headHome(driver, pickupTripId, jpeg(), null)).ok).toBe(true);
    expect((await lg.arriveTrip(driver, pickupTripId, GUDANG, jpeg())).ok).toBe(true);
    const goods = (await lg.returnedGoodsScreen(kg))!.warehouse.filter((r) => r.tripId === pickupTripId);
    expect(goods.map((g) => ({ what: g.what, destination: g.destination }))).toEqual([{ what: 'Jemput retur', destination: 'Toko Sinar' }]);
    expect(goods[0].items).toHaveLength(2);
    const detail = await lg.tripDetailScreen(kg, pickupTripId);
    expect(detail!.delivery.returns.map((r) => [r.store, r.statusLabel]).sort()).toEqual([['Toko Lain', 'Kirim Besok'], ['Toko Sinar', 'Diambil']]);
  });

  it('Laporan Toko: Retur BO tanpa nota, potong nota ditolak; masuk Perlu dicatat di kasir', async () => {
    const finance = await actorOf(ids.finance);
    const screen = (await lg.visitReportsScreen(finance))!;
    const row = screen.open.find((r) => r.pickup)!;
    expect(row).toMatchObject({ store: 'Toko Sinar', source: 'Jemput retur', noteOptions: [] });
    expect(await lg.decideVisitReport(finance, row.id, { decision: 'CUT', amount: 1000, reason: 'DAMAGED' })).toMatchObject({ ok: false, status: 400 });
    expect((await lg.decideVisitReport(finance, row.id, { decision: 'RETURN_BO', note: null })).ok).toBe(true);
    const waiting = (await lg.toRecordScreen(finance))!.waiting.filter((w) => w.reportId === row.id);
    expect(waiting).toHaveLength(1);
    expect(waiting[0]).toMatchObject({ decision: 'RETURN_BO', noteNumber: null, store: 'Toko Sinar' });
  });

  it('trip berjalan ditutup kantor: tugas yang belum dikerjakan kembali Menunggu bertanda terlewat', async () => {
    const kg = await actorOf(ids.kg);
    const made = await lg.createTrip(kg, tripInput([], []));
    const second = made.ok ? made.data.id : 0;
    expect((await lg.markReady(kg, second)).ok).toBe(true);
    at('16:00');
    expect(await lg.departTrip(await actorOf(ids.driver), second, jpeg(), GUDANG)).toMatchObject({ ok: true });
    expect((await lg.assignReturnPickup(kg, pickups.lain, second)).ok).toBe(true);
    expect(await sql`select 1 from hris.notifications where kind = 'logistics.return_pickup' and recipient_account_id = ${ids.driver + 1000}`).not.toHaveLength(0);
    expect((await lg.closeByOffice(kg, second, 'Mobil mogok di jalan', jpeg())).ok).toBe(true);
    const [task] = await sql`select status, tries from logistics.return_pickups where id = ${pickups.lain}`;
    expect(task).toMatchObject({ status: 'WAITING', tries: 2 });
    const events = await sql`select kind from logistics.return_pickup_events where pickup_id = ${pickups.lain} order by id`;
    expect(events.map((e) => e.kind)).toEqual(['CREATED', 'ON_TRIP', 'RELEASED', 'ON_TRIP', 'TOMORROW', 'ON_TRIP', 'MISSED']);
    await expect(sql`delete from logistics.return_pickups`).rejects.toThrow();
  });
});
