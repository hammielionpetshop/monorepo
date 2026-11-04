import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// LT1b-2b titik toko (spec LT1 §13.4) pada DB sintetis dengan stub kasir. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_lt1b2b_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const DAY = '2026-11-06';
const GUDANG = { latitude: -7.350564720030627, longitude: 108.10865608125447 };
const SINAR = { latitude: -7.3485, longitude: 108.1086 };
const REASON = 'Alasan uji yang cukup panjang';
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], 'foto.jpg', { type: 'image/jpeg' });

let admin: postgres.Sql;
let sql: postgres.Sql;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'kg' | 'driver' | 'kenek' | 'owner', number>;
let lg: typeof import('@/modules/logistics');
const pos: Record<string, number> = {};
let tripId = 0;

const at = (clock: string) => vi.setSystemTime(new Date(`${DAY}T${clock}:00+07:00`));

describe.skipIf(!ADMIN_URL)('LT1b-2b: titik toko', () => {
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
      owner: await person('Elan', 'Pemilik'),
    };
    for (const [position, duty] of [['Driver', 'DRIVE'], ['Kenek', 'ASSIST']]) {
      await sql`insert into hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
        select 'position.field_duty_auto', 'POSITION', id, ${sql.json(duty)}, '2026-01-01', 'ACTIVE', 'Uji LT1b-2b' from hris.positions where name = ${position}`;
    }
    const [route] = await sql`select id from logistics.routes where name = 'Garut'`;
    const [vehicle] = await sql`select id from logistics.vehicles where name = 'L300'`;
    pos.route = Number(route.id);
    pos.vehicle = Number(vehicle.id);
    const customer = async (name: string) => {
      const [row] = await sql`insert into petshop.customers (code, name, address) values (${name.slice(0, 3).toUpperCase()}, ${name}, 'Jl. Uji') returning id`;
      return Number(row.id);
    };
    pos.sinar = await customer('Toko Sinar');
    pos.maju = await customer('Toko Maju');
    const sale = async (number: string, customerId: number) => {
      const [row] = await sql`insert into petshop.transactions (trx_number, payable_amount, created_at, branch_id, customer_id, status, revision, delivery_method)
        values (${number}, 150000, '2026-11-05 02:00:00'::text::timestamp, 1, ${customerId}, 'COMPLETED', 1, 'TRUCK') returning id`;
      return Number(row.id);
    };
    pos.a = await sale('TRX-A', pos.sinar);
    pos.c = await sale('TRX-C', pos.maju);

    lg = await import('@/modules/logistics');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);

    const kg = await actorOf(ids.kg);
    const made = await lg.createTrip(kg, {
      vehicleId: pos.vehicle, routeId: pos.route, shoppingRouteIds: [], driverId: ids.driver, assistantIds: [ids.kenek], noteKeys: [`S${pos.a}`, `S${pos.c}`],
    });
    tripId = made.ok ? made.data.id : 0;
    await lg.markReady(kg, tripId);
  });

  afterAll(async () => {
    vi.useRealTimers();
    delete process.env.AUTH_COOKIE_ENV;
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const visitOf = async (destination: string) => (await lg.tripDetailScreen(await actorOf(ids.kg), tripId))!.delivery.visits
    .filter((v) => v.destination === destination).at(-1)!;
  const points = async (customerId: number) => sql`select status, kind, source from logistics.store_points where customer_id = ${customerId} order by id`;
  const propose = async (employeeId: number, visitId: number, input: { kind: 'NEW' | 'CORRECTION'; reason?: string; accuracy?: number; point?: typeof SINAR }) =>
    lg.proposeFromVisit(await actorOf(employeeId), tripId, visitId, {
      kind: input.kind, reason: input.reason, point: { ...(input.point ?? SINAR), accuracy: input.accuracy ?? 12 },
    }, jpeg());

  it('Pasang titik hanya selama trip Berjalan, akurasi ≤ 50 m, foto wajib; masuk Menunggu + pemberitahuan', async () => {
    const sinar = await visitOf('Toko Sinar');
    expect(await propose(ids.driver, sinar.id, { kind: 'NEW' })).toMatchObject({ ok: false, status: 409 });
    at('08:00');
    expect((await lg.departTrip(await actorOf(ids.driver), tripId, jpeg(), GUDANG)).ok).toBe(true);
    expect(await propose(ids.driver, sinar.id, { kind: 'NEW', accuracy: 80 })).toMatchObject({ ok: false, status: 400, error: expect.stringContaining('80 m') });
    expect(await lg.proposeFromVisit(await actorOf(ids.driver), tripId, sinar.id, { kind: 'NEW', point: { ...SINAR, accuracy: 10 } }, null))
      .toMatchObject({ ok: false, status: 400 });
    expect(await propose(ids.owner, sinar.id, { kind: 'NEW' })).toMatchObject({ ok: false, status: 403 });
    expect(await propose(ids.driver, sinar.id, { kind: 'CORRECTION', reason: REASON })).toMatchObject({ ok: false, status: 409 });
    expect(await propose(ids.driver, sinar.id, { kind: 'NEW' })).toMatchObject({ ok: true, data: { status: 'PENDING' } });
    expect(await propose(ids.kenek, sinar.id, { kind: 'NEW' })).toMatchObject({ ok: false, status: 409, error: expect.stringContaining('menunggu persetujuan') });
    const [told] = await sql`select title, link from hris.notifications where kind = 'logistics.store_point' and recipient_account_id = ${ids.kg + 1000}`;
    expect(told).toMatchObject({ title: 'Titik toko baru: Toko Sinar', link: '/logistik/toko?tab=titik' });
    expect(await visitOf('Toko Sinar')).toMatchObject({ point: null, pointPending: true });
    expect(await lg.pendingPointCount(await actorOf(ids.kg))).toBe(1);
    expect(await lg.pendingPointCount(await actorOf(ids.driver))).toBe(0);
  });

  it('Tolak (alasan wajib) memberi tahu pemasang; Setujui memasang titik; foto hanya untuk yang berhak', async () => {
    const kg = await actorOf(ids.kg);
    let [pending] = (await lg.pendingPoints(kg))!.rows;
    expect(pending).toMatchObject({ store: 'Toko Sinar', by: 'Dedi', kindLabel: 'Usulan titik baru', accuracyM: 12 });
    expect(await lg.decidePoint(await actorOf(ids.driver), pending.id, 'APPROVE', '')).toMatchObject({ ok: false, status: 403 });
    expect(await lg.decidePoint(kg, pending.id, 'REJECT', 'x')).toMatchObject({ ok: false, status: 400 });
    expect((await lg.decidePoint(kg, pending.id, 'REJECT', 'Foto bukan toko ini')).ok).toBe(true);
    expect(await lg.decidePoint(kg, pending.id, 'APPROVE', '')).toMatchObject({ ok: false, status: 409 });
    const [rejected] = await sql`select title, body from hris.notifications where kind = 'logistics.store_point_rejected' and recipient_account_id = ${ids.driver + 1000}`;
    expect(rejected).toMatchObject({ title: 'Titik toko Toko Sinar ditolak', body: 'Foto bukan toko ini' });

    const sinar = await visitOf('Toko Sinar');
    expect((await propose(ids.kenek, sinar.id, { kind: 'NEW' })).ok).toBe(true);
    [pending] = (await lg.pendingPoints(kg))!.rows;
    expect(await lg.openStorePointPhoto(await actorOf(ids.driver), pending.id)).toBeNull();
    expect(await lg.openStorePointPhoto(await actorOf(ids.kenek), pending.id)).toBeTruthy();
    expect(await lg.openStorePointPhoto(kg, pending.id)).toBeTruthy();
    expect((await lg.decidePoint(kg, pending.id, 'APPROVE', '')).ok).toBe(true);
    expect((await visitOf('Toko Sinar')).point).toMatchObject({ latitude: SINAR.latitude, mapUrl: expect.stringContaining('-7.348500,108.108600') });
    expect(await points(pos.sinar)).toEqual([
      { status: 'REJECTED', kind: 'NEW', source: 'VISIT' }, { status: 'APPROVED', kind: 'NEW', source: 'VISIT' },
    ]);
  });

  it('Laporkan titik salah: alasan wajib, titik lama tetap sampai disetujui, lalu Diganti', async () => {
    const sinar = await visitOf('Toko Sinar');
    const moved = { latitude: SINAR.latitude + 0.0005, longitude: SINAR.longitude };
    expect(await propose(ids.driver, sinar.id, { kind: 'NEW', point: moved })).toMatchObject({ ok: false, status: 409, error: expect.stringContaining('Laporkan titik salah') });
    expect(await propose(ids.driver, sinar.id, { kind: 'CORRECTION', reason: 'abc', point: moved })).toMatchObject({ ok: false, status: 400 });
    expect((await propose(ids.driver, sinar.id, { kind: 'CORRECTION', reason: 'Titik lama di rumah sebelah', point: moved })).ok).toBe(true);
    const kg = await actorOf(ids.kg);
    const [pending] = (await lg.pendingPoints(kg))!.rows;
    expect(pending).toMatchObject({ kindLabel: 'Laporan titik salah', reason: 'Titik lama di rumah sebelah' });
    expect(pending.fromCurrentM).toBeGreaterThan(50);
    expect((await visitOf('Toko Sinar')).point?.latitude).toBe(SINAR.latitude);
    expect((await lg.decidePoint(kg, pending.id, 'APPROVE', '')).ok).toBe(true);
    expect((await points(pos.sinar)).map((p) => p.status)).toEqual(['REJECTED', 'REPLACED', 'APPROVED']);
    const history = await lg.storePointHistory(kg, pos.sinar);
    expect(history.approved?.kindLabel).toBe('Laporan titik salah');
    expect(history.history.map((h) => h.statusLabel)).toEqual(['Diganti', 'Ditolak']);
  });

  it('Terkirim mencatat jarak dari titik; lebih dari 100 m ditandai Di luar titik', async () => {
    const sinar = await visitOf('Toko Sinar');
    expect((await lg.processVisit(await actorOf(ids.driver), tripId, sinar.id, { outcome: 'DELIVERED', point: GUDANG }, jpeg())).ok).toBe(true);
    const done = await visitOf('Toko Sinar');
    expect(done.distanceM).toBeGreaterThan(100);
    expect(done.outside).toBe(true);
    const maju = await visitOf('Toko Maju');
    expect((await lg.processVisit(await actorOf(ids.driver), tripId, maju.id, { outcome: 'DELIVERED', point: GUDANG }, jpeg())).ok).toBe(true);
    expect(await visitOf('Toko Maju')).toMatchObject({ distanceM: null, outside: false, point: null });
  });

  it('Tempel koordinat kantor: langsung Disetujui tanpa foto; usulan Menunggu ikut ditolak; tidak bisa dihapus', async () => {
    const owner = await actorOf(ids.owner);
    expect(await lg.pastePoint(await actorOf(ids.driver), pos.maju, '-7.35, 108.11')).toMatchObject({ ok: false, status: 403 });
    expect(await lg.pastePoint(owner, pos.maju, 'https://maps.app.goo.gl/abc')).toMatchObject({ ok: false, status: 400 });
    expect((await lg.pastePoint(owner, pos.maju, 'https://www.google.com/maps/place/x/@-7.30,108.20,17z/data=!3d-7.3012!4d108.2034')).ok).toBe(true);
    expect((await lg.pastePoint(await actorOf(ids.kg), pos.maju, '-7.3013, 108.2035')).ok).toBe(true);
    expect(await points(pos.maju)).toEqual([
      { status: 'REPLACED', kind: 'NEW', source: 'OFFICE' }, { status: 'APPROVED', kind: 'NEW', source: 'OFFICE' },
    ]);
    const stores = (await lg.storesScreen(await actorOf(ids.kg), ''))!;
    expect(stores.stores.find((s) => s.customerId === pos.maju)).toMatchObject({ hasPoint: true, pointPending: false });
    await expect(sql`delete from logistics.store_points where customer_id = ${pos.maju}`).rejects.toThrow();
  });
});
