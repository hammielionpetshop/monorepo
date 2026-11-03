import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// L6 Logistik Minimal (spec L6 §8, PRD 08 §5) pada DB sintetis, tanggal lampau. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l6_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const DAY = '2026-11-02';
const GUDANG = { latitude: -7.350564720030627, longitude: 108.10865608125447 };
const FAR = { latitude: -7.36, longitude: 108.1 };
const REASON = 'Alasan uji yang cukup panjang';
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], 'foto.jpg', { type: 'image/jpeg' });

let admin: postgres.Sql;
let sql: postgres.Sql;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'kg' | 'driver' | 'kenek' | 'kenek2' | 'kasir', number>;
let lg: typeof import('@/modules/logistics');
let route: Record<string, number>;
let vehicle: Record<string, number>;

const at = (clock: string) => vi.setSystemTime(new Date(`${DAY}T${clock}:00+07:00`));

describe.skipIf(!ADMIN_URL)('L6: trip, absen lewat trip, dan ritase', () => {
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
    // Urutan pnpm db:migrate: logistics lebih dulu, lalu hris (0031 mengisi titik garasi = Gudang).
    for (const folder of [new URL('logistics/src/migrations/', root), new URL('hris-db/src/migrations/', root)]) {
      for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()) {
        if (folder.pathname.includes('hris-db') && file.startsWith('0031')) {
          await sql`insert into hris.branches (name, latitude, longitude) values ('Gudang', ${GUDANG.latitude}, ${GUDANG.longitude})`;
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
      owner: await person('Elan', 'Pemilik'), kg: await person('Kepala Gudang Uji', 'Kepala Gudang'), driver: await person('Dedi', 'Driver'),
      kenek: await person('Eko', 'Kenek'), kenek2: await person('Fajar', 'Kenek'), kasir: await person('Kasir Uji', 'Kasir'),
    };
    // Driver menyetir, Kenek jadi kenek: izin otomatis jabatan (KAR-64).
    for (const [position, duty] of [['Driver', 'DRIVE'], ['Kenek', 'ASSIST']]) {
      await sql`insert into hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
        select 'position.field_duty_auto', 'POSITION', id, ${sql.json(duty)}, '2026-01-01', 'ACTIVE', 'Uji L6' from hris.positions where name = ${position}`;
    }
    route = Object.fromEntries((await sql`select id, name from logistics.routes`).map((r) => [r.name, Number(r.id)]));
    vehicle = Object.fromEntries((await sql`select id, name from logistics.vehicles`).map((r) => [r.name, Number(r.id)]));
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

  const wagesOf = (tripId: number) => sql`select employee_id, role, kind, route_id, with_assistant from logistics.v_ritase where trip_id = ${tripId} order by employee_id, kind, route_id`;

  it('isi awal: titik garasi = Gudang, mobil dan rute dari owner', async () => {
    expect((await sql`select g.name from logistics.config c join hris.branches g on g.id = c.garage_branch_id`)[0].name).toBe('Gudang');
    expect(Object.keys(vehicle).sort()).toEqual(['Engkel Box', 'Grand Max Box', 'L300']);
    expect(route['Aina PS']).toBeTruthy();
  });

  it('buat trip: hanya pemegang hak, awak sesuai izin, kirim + belanja', async () => {
    const input = { vehicleId: vehicle['L300'], routeId: route['Garut'], shoppingRouteIds: [route['Aina PS']], driverId: ids.driver, assistantIds: [ids.kenek] };
    expect(await lg.createTrip(await actorOf(ids.kasir), input)).toMatchObject({ ok: false, status: 403 });
    expect(await lg.createTrip(await actorOf(ids.kg), { ...input, driverId: ids.kenek, assistantIds: [] })).toMatchObject({ ok: false, error: expect.stringContaining('menyetir') });
    const made = await lg.createTrip(await actorOf(ids.kg), input);
    expect(made.ok).toBe(true);
    const [trip] = await sql`select number, status, trip_date from logistics.trips`;
    expect(trip).toMatchObject({ number: 'TR-261102-1', status: 'DRAFT', trip_date: null });
  });

  it('alur PRD 08 §5: Berangkat (absen masuk seluruh awak) → belanja selesai → Sampai Garasi → ritase + belanja sekali per awak', async () => {
    const [{ id }] = await sql`select id from logistics.trips where number = 'TR-261102-1'`;
    const tripId = Number(id);
    expect(await lg.departTrip(await actorOf(ids.kasir), tripId, jpeg(), null)).toMatchObject({ ok: false, status: 403 });
    at('08:10');
    expect((await lg.departTrip(await actorOf(ids.kenek), tripId, jpeg(), null)).ok).toBe(true);
    expect(await lg.departTrip(await actorOf(ids.driver), tripId, jpeg(), null)).toMatchObject({ ok: false, status: 409 });
    const [absen] = await sql`select employee_id, trip_date::text, in_at, out_at, running_count from logistics.v_absen_trip where employee_id = ${ids.driver}`;
    expect(absen).toMatchObject({ trip_date: DAY, out_at: null, running_count: '1' });
    const [shop] = await sql`select id from logistics.trip_shopping where trip_id = ${tripId}`;
    at('10:00');
    expect((await lg.finishShopping(await actorOf(ids.driver), tripId, Number(shop.id), jpeg())).ok).toBe(true);
    at('15:30');
    expect(await lg.arriveTrip(await actorOf(ids.driver), tripId, FAR)).toMatchObject({ ok: false, error: expect.stringContaining('Gudang') });
    expect((await lg.arriveTrip(await actorOf(ids.driver), tripId, GUDANG)).ok).toBe(true);
    expect(await wagesOf(tripId)).toEqual([
      { employee_id: ids.driver, role: 'DRIVER', kind: 'RITASE', route_id: route['Garut'], with_assistant: true },
      { employee_id: ids.driver, role: 'DRIVER', kind: 'SHOPPING', route_id: route['Aina PS'], with_assistant: true },
      { employee_id: ids.kenek, role: 'ASSISTANT', kind: 'RITASE', route_id: route['Garut'], with_assistant: true },
      { employee_id: ids.kenek, role: 'ASSISTANT', kind: 'SHOPPING', route_id: route['Aina PS'], with_assistant: true },
    ]);
    expect(await lg.arriveTrip(await actorOf(ids.driver), tripId, GUDANG)).toMatchObject({ ok: false, status: 409 });
  });

  it('kunci unik menolak ritase dobel dan ritase tidak bisa dihapus', async () => {
    const [w] = await sql`select * from logistics.trip_wages where kind = 'RITASE' limit 1`;
    await expect(sql`insert into logistics.trip_wages (trip_id, employee_id, role, kind, trip_date, vehicle_id, route_id, with_assistant)
      values (${w.trip_id}, ${w.employee_id}, ${w.role}, 'RITASE', ${w.trip_date}, ${w.vehicle_id}, ${w.route_id}, true)`).rejects.toThrow();
    await expect(sql`delete from logistics.trip_wages where id = ${w.id}`).rejects.toThrow(/tidak boleh dihapus/);
    await expect(sql`update logistics.trip_wages set route_id = ${route['Cirebon']} where id = ${w.id}`).rejects.toThrow();
  });

  it('dua trip sehari: trip belanja saja tanpa ritase; absen pulang pindah ke trip terakhir; supplier Open gugur', async () => {
    at('16:00');
    const kg = await actorOf(ids.kg);
    const made = await lg.createTrip(kg, {
      vehicleId: vehicle['L300'], routeId: null, shoppingRouteIds: [route['H. Agus'], route['Rajawali / Wiji Dadi']], driverId: ids.driver, assistantIds: [],
    });
    const tripId = made.ok ? made.data.id : 0;
    at('16:10');
    expect((await lg.departTrip(await actorOf(ids.driver), tripId, jpeg(), null)).ok).toBe(true);
    const [agus] = await sql`select id from logistics.trip_shopping where trip_id = ${tripId} and route_id = ${route['H. Agus']}`;
    expect((await lg.finishShopping(await actorOf(ids.driver), tripId, Number(agus.id), jpeg())).ok).toBe(true);
    at('18:45');
    expect((await lg.arriveTrip(await actorOf(ids.driver), tripId, GUDANG)).ok).toBe(true);
    expect(await wagesOf(tripId)).toEqual([{ employee_id: ids.driver, role: 'DRIVER', kind: 'SHOPPING', route_id: route['H. Agus'], with_assistant: false }]);
    expect((await sql`select status, drop_reason from logistics.trip_shopping where trip_id = ${tripId} and route_id = ${route['Rajawali / Wiji Dadi']}`)[0])
      .toMatchObject({ status: 'DROPPED' });
    const [absen] = await sql`select in_at, out_at, trip_count from logistics.v_absen_trip where employee_id = ${ids.driver} and trip_date = ${DAY}`;
    expect(absen.trip_count).toBe('2');
    expect(new Date(absen.in_at).toISOString()).toBe(new Date(`${DAY}T08:10:00+07:00`).toISOString());
    expect(new Date(absen.out_at).toISOString()).toBe(new Date(`${DAY}T18:45:00+07:00`).toISOString());
  });

  it('satu trip berjalan per orang dan per mobil; ditambahkan sesudah berangkat; dicopot tanpa ritase; tutup kantor', async () => {
    at('19:00');
    const kg = await actorOf(ids.kg);
    const a = await lg.createTrip(kg, { vehicleId: vehicle['Engkel Box'], routeId: route['Cirebon'], shoppingRouteIds: [], driverId: ids.driver, assistantIds: [ids.kenek] });
    const b = await lg.createTrip(kg, { vehicleId: vehicle['Grand Max Box'], routeId: route['Tasik Kota'], shoppingRouteIds: [], driverId: ids.driver, assistantIds: [] });
    const tripA = a.ok ? a.data.id : 0;
    const tripB = b.ok ? b.data.id : 0;
    expect((await lg.departTrip(await actorOf(ids.driver), tripA, jpeg(), null)).ok).toBe(true);
    expect(await lg.departTrip(await actorOf(ids.driver), tripB, jpeg(), null)).toMatchObject({ ok: false, error: expect.stringContaining('masih di trip') });
    at('19:30');
    expect((await lg.addCrew(kg, tripA, ids.kenek2, 'ASSISTANT')).ok).toBe(true);
    const [kenekRow] = await sql`select id from logistics.trip_crew where trip_id = ${tripA} and employee_id = ${ids.kenek}`;
    expect((await lg.removeCrew(kg, tripA, Number(kenekRow.id), REASON)).ok).toBe(true);
    expect(await lg.closeByOffice(await actorOf(ids.kasir), tripA, REASON, jpeg())).toMatchObject({ ok: false, status: 403 });
    at('21:00');
    expect((await lg.closeByOffice(kg, tripA, REASON, jpeg())).ok).toBe(true);
    expect((await wagesOf(tripA)).map((w) => w.employee_id).sort()).toEqual([ids.driver, ids.kenek2].sort());
    const [added] = await sql`select in_at, added_by_office from logistics.v_absen_trip where employee_id = ${ids.kenek2} and trip_date = ${DAY}`;
    expect(new Date(added.in_at).toISOString()).toBe(new Date(`${DAY}T19:30:00+07:00`).toISOString());
    expect(added.added_by_office).toBe(true);
    expect((await sql`select office_closed from logistics.v_absen_trip where employee_id = ${ids.driver} and trip_date = ${DAY}`)[0].office_closed).toBe(true);
    expect((await lg.cancelTrip(kg, tripB, REASON)).ok).toBe(true);
  });

  it('batalkan ritase dan ritase tangan (Pemilik/GM, ≤14 hari, dobel butuh konfirmasi)', async () => {
    at('22:00');
    const owner = await actorOf(ids.owner);
    const [w] = await sql`select id from logistics.trip_wages where kind = 'RITASE' and cancelled_at is null and employee_id = ${ids.kenek} limit 1`;
    expect(await lg.cancelWage(await actorOf(ids.kg), Number(w.id), REASON)).toMatchObject({ ok: false, status: 403 });
    expect((await lg.cancelWage(owner, Number(w.id), REASON)).ok).toBe(true);
    expect((await sql`select cancelled from logistics.v_ritase where id = ${w.id}`)[0].cancelled).toBe(true);
    const manual = { employeeId: ids.driver, tripDate: DAY, vehicleId: vehicle['L300'], routeId: route['Garut'], role: 'DRIVER' as const, withAssistant: true, reason: REASON, confirmTwice: false };
    expect(await lg.addManualWage(owner, { ...manual, tripDate: '2026-10-01' })).toMatchObject({ ok: false, error: expect.stringContaining('14 hari') });
    expect(await lg.addManualWage(owner, manual)).toMatchObject({ ok: false, error: expect.stringContaining('dua kali') });
    expect((await lg.addManualWage(owner, { ...manual, confirmTwice: true })).ok).toBe(true);
    expect((await sql`select origin, confirmed_twice from logistics.trip_wages where origin = 'MANUAL'`)[0]).toMatchObject({ origin: 'MANUAL', confirmed_twice: true });
  });
});
