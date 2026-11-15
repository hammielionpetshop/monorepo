import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// LT1b-1 surat jalan di trip (spec LT1 §3.3–3.5, §13) pada DB sintetis dengan stub kasir. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_lt1b1_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const DAY = '2026-11-06';
const GUDANG = { latitude: -7.350564720030627, longitude: 108.10865608125447 };
const REASON = 'Alasan uji yang cukup panjang';
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], 'foto.jpg', { type: 'image/jpeg' });

let admin: postgres.Sql;
let sql: postgres.Sql;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'kg' | 'driver' | 'kenek' | 'driver2', number>;
let lg: typeof import('@/modules/logistics');
let route: Record<string, number>;
let vehicle: Record<string, number>;
const pos: Record<string, number> = {};

const at = (clock: string) => vi.setSystemTime(new Date(`${DAY}T${clock}:00+07:00`));
const S = (id: number) => `S${id}`;
const T = (id: number) => `T${id}`;

describe.skipIf(!ADMIN_URL)('LT1b-1: surat jalan masuk trip', () => {
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
    // Kasir: Gudang (1), Toko Pusat (2), Toko Depan (3).
    await sql`insert into petshop.branches (code, name) values ('GDG', 'Gudang'), ('TP', 'Toko Pusat'), ('TD', 'Toko Depan')`;
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
    ids = { kg: await person('Kepala Gudang Uji', 'Kepala Gudang'), driver: await person('Dedi', 'Driver'), kenek: await person('Eko', 'Kenek'), driver2: await person('Gani', 'Driver') };
    for (const [position, duty] of [['Driver', 'DRIVE'], ['Kenek', 'ASSIST']]) {
      await sql`insert into hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
        select 'position.field_duty_auto', 'POSITION', id, ${sql.json(duty)}, '2026-01-01', 'ACTIVE', 'Uji LT1b' from hris.positions where name = ${position}`;
    }
    route = Object.fromEntries((await sql`select id, name from logistics.routes`).map((r) => [r.name, Number(r.id)]));
    vehicle = Object.fromEntries((await sql`select id, name from logistics.vehicles`).map((r) => [r.name, Number(r.id)]));

    const customer = async (name: string) => {
      const [row] = await sql`insert into petshop.customers (code, name, address) values (${name.slice(0, 3).toUpperCase()}, ${name}, 'Jl. Uji') returning id`;
      return Number(row.id);
    };
    pos.sinar = await customer('Toko Sinar');
    pos.maju = await customer('Toko Maju');
    const sale = async (number: string, branchId: number, customerId: number, status = 'COMPLETED') => {
      const [row] = await sql`insert into petshop.transactions (trx_number, payable_amount, created_at, branch_id, customer_id, status, revision, delivery_method)
        values (${number}, 150000, '2026-11-05 02:00:00'::text::timestamp, ${branchId}, ${customerId}, ${status}, 1, 'TRUCK') returning id`;
      return Number(row.id);
    };
    pos.a = await sale('TRX-A', 1, pos.sinar);
    pos.b = await sale('TRX-B', 2, pos.sinar);
    pos.c = await sale('TRX-C', 1, pos.maju);
    pos.d = await sale('TRX-D', 1, pos.maju, 'VOIDED');
    const [ibt] = await sql`insert into petshop.inter_branch_transfers (ibt_number, source_branch_id, destination_branch_id, status, delivery_method, created_at)
      values ('IBT-A', 1, 3, 'IN_TRANSIT', 'TRUCK', '2026-11-05 01:00:00'::text::timestamp) returning id`;
    pos.ibt = Number(ibt.id);

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

  const base = () => ({ vehicleId: vehicle['L300'], routeId: route['Garut'], shoppingRouteIds: [], driverId: ids.driver, assistantIds: [ids.kenek] });
  const tabs = async () => Object.fromEntries((await lg.deliveryNotesScreen(await actorOf(ids.kg), { tab: 'WAITING', originId: null, routeId: null, q: '' }))!
    .tabs.map((t) => [t.status, t.count]));
  const tripId = async (number: string) => Number((await sql`select id from logistics.trips where number = ${number}`)[0].id);

  it('trip berisi surat jalan wajib rute kirim; nota batal di kasir ditolak', async () => {
    const kg = await actorOf(ids.kg);
    expect(await lg.createTrip(kg, { ...base(), routeId: null, shoppingRouteIds: [route['Aina PS']], noteKeys: [S(pos.a)] }))
      .toMatchObject({ ok: false, error: expect.stringContaining('rute kirim') });
    expect(await lg.createTrip(kg, { ...base(), noteKeys: [S(pos.d)] })).toMatchObject({ ok: false, error: expect.stringContaining('TRX-D') });
    expect(await lg.createTrip(kg, { ...base(), noteKeys: ['X1'] })).toMatchObject({ ok: false, status: 400 });
  });

  it('centang di form: satu kunjungan per toko, ambil barang di cabang selain Gudang, keluar dari Menunggu', async () => {
    const kg = await actorOf(ids.kg);
    const made = await lg.createTrip(kg, { ...base(), noteKeys: [S(pos.a), S(pos.b), S(pos.c), T(pos.ibt)] });
    expect(made.ok).toBe(true);
    const id = made.ok ? made.data.id : 0;
    const detail = (await lg.tripDetailScreen(kg, id))!;
    expect(detail.delivery.visits.map((v) => [v.destination, v.notes.map((n) => n.number).sort()])).toEqual([
      ['Toko Sinar', ['TRX-A', 'TRX-B']], ['Toko Maju', ['TRX-C']], ['Toko Depan', ['IBT-A']],
    ]);
    expect(detail.delivery.pickups.map((p) => [p.origin, p.status, p.noteCount])).toEqual([['Toko Pusat', 'OPEN', 1]]);
    expect(detail.delivery.visits[0].waitsForPickup).toEqual(['Toko Pusat']);
    expect(await tabs()).toMatchObject({ WAITING: 0, ON_TRIP: 4 });
    const onTrip = (await lg.deliveryNotesScreen(kg, { tab: 'ON_TRIP', originId: null, routeId: null, q: '' }))!;
    expect(onTrip.rows.every((r) => r.trip?.id === id)).toBe(true);

    // Surat jalan yang sama tidak bisa masuk trip lain.
    expect(await lg.createTrip(kg, { ...base(), driverId: ids.driver2, assistantIds: [], noteKeys: [S(pos.a)] }))
      .toMatchObject({ ok: false, status: 409, error: expect.stringContaining('TRX-A sudah ada di trip TR-261106-1') });
  });

  it('ubah trip Draft: lepas TRX-B → ambil barang Toko Pusat tidak jadi, TRX-B kembali Menunggu', async () => {
    const kg = await actorOf(ids.kg);
    const id = await tripId('TR-261106-1');
    expect((await lg.updateDraft(kg, id, { ...base(), noteKeys: [S(pos.a), S(pos.c), T(pos.ibt)] })).ok).toBe(true);
    const detail = (await lg.tripDetailScreen(kg, id))!;
    expect(detail.delivery.pickups.map((p) => p.status)).toEqual(['DROPPED']);
    expect(detail.delivery.visits.find((v) => v.destination === 'Toko Sinar')!.notes.map((n) => n.number)).toEqual(['TRX-A']);
    expect(await tabs()).toMatchObject({ WAITING: 1, ON_TRIP: 3 });
    const events = await sql`select e.kind from logistics.delivery_note_events e join logistics.delivery_notes n on n.id = e.note_id where n.number = 'TRX-B' order by e.id`;
    expect(events.map((e) => e.kind)).toEqual(['ON_TRIP', 'RELEASED']);
    // Masukkan lagi: baris surat jalan dipakai ulang, ambil barang dibuka lagi.
    expect((await lg.updateDraft(kg, id, { ...base(), noteKeys: [S(pos.a), S(pos.b), S(pos.c), T(pos.ibt)] })).ok).toBe(true);
    expect((await lg.tripDetailScreen(kg, id))!.delivery.pickups.filter((p) => p.status === 'OPEN')).toHaveLength(1);
    expect(Number((await sql`select count(*) from logistics.delivery_notes`)[0].count)).toBe(4);
  });

  it('sesudah Berangkat: ambil barang dengan foto oleh awak; kantor melepas toko dengan alasan; nota dibatalkan di kasir bertanda', async () => {
    const id = await tripId('TR-261106-1');
    expect((await lg.markReady(await actorOf(ids.kg), id)).ok).toBe(true);
    at('08:00');
    expect((await lg.departTrip(await actorOf(ids.driver), id, jpeg(), null)).ok).toBe(true);
    const detail = (await lg.tripDetailScreen(await actorOf(ids.kg), id))!;
    const pickup = detail.delivery.pickups.find((p) => p.status === 'OPEN')!;
    expect(await lg.finishPickup(await actorOf(ids.driver2), id, pickup.id, jpeg())).toMatchObject({ ok: false, status: 403 });
    expect((await lg.finishPickup(await actorOf(ids.kenek), id, pickup.id, jpeg())).ok).toBe(true);
    expect(await lg.finishPickup(await actorOf(ids.kenek), id, pickup.id, jpeg())).toMatchObject({ ok: false, status: 409 });

    const maju = detail.delivery.visits.find((v) => v.destination === 'Toko Maju' && v.status === 'OPEN')!;
    expect(await lg.releaseVisit(await actorOf(ids.driver), id, maju.id, REASON)).toMatchObject({ ok: false, status: 403 });
    expect(await lg.releaseVisit(await actorOf(ids.kg), id, maju.id, 'x')).toMatchObject({ ok: false, status: 400 });
    expect((await lg.releaseVisit(await actorOf(ids.kg), id, maju.id, REASON)).ok).toBe(true);
    expect(await tabs()).toMatchObject({ WAITING: 1, ON_TRIP: 3 });

    await sql`update petshop.transactions set payable_amount = 120000, revision = 2 where id = ${pos.a}`;
    await sql`update petshop.transactions set status = 'VOIDED' where id = ${pos.b}`;
    const after = (await lg.tripDetailScreen(await actorOf(ids.kg), id))!;
    const sinar = after.delivery.visits.find((v) => v.destination === 'Toko Sinar')!;
    expect(sinar.notes.map((n) => [n.number, n.change])).toEqual([
      ['TRX-A', { kind: 'changed', from: 150000, to: 120000 }], ['TRX-B', { kind: 'cancelled', pending: false }],
    ]);
    expect(await tabs()).toMatchObject({ WAITING: 1, ON_TRIP: 2, CANCELLED: 2 });
    const mine = (await lg.myTripsScreen(await actorOf(ids.driver)))!;
    expect(mine.delivery[id].pickups.filter((p) => p.status !== 'DROPPED').map((p) => p.status)).toEqual(['DONE']);
  });

  it('Selesai lebih awal sebelum kunjungan diproses: surat jalan kembali Menunggu bertanda tertunda (LT1b-2a)', async () => {
    const id = await tripId('TR-261106-1');
    at('17:00');
    expect(await lg.arriveTrip(await actorOf(ids.driver), id, GUDANG, jpeg())).toMatchObject({ ok: false, status: 409 });
    expect(await lg.headHome(await actorOf(ids.driver), id, jpeg(), null)).toMatchObject({ ok: false, error: expect.stringContaining('kunjungan') });
    expect((await lg.headHome(await actorOf(ids.driver), id, jpeg(), 'Hujan deras, jalan banjir')).ok).toBe(true);
    expect((await lg.arriveTrip(await actorOf(ids.driver), id, GUDANG, jpeg())).ok).toBe(true);
    const visits = (await lg.tripDetailScreen(await actorOf(ids.kg), id))!.delivery.visits;
    expect(visits.filter((v) => v.status === 'OPEN')).toHaveLength(0);
    expect(visits.filter((v) => v.status === 'TOMORROW').map((v) => v.destination).sort()).toEqual(['Toko Depan', 'Toko Sinar']);
    const waiting = (await lg.deliveryNotesScreen(await actorOf(ids.kg), { tab: 'WAITING', originId: null, routeId: null, q: '' }))!;
    expect(waiting.rows.map((r) => [r.number, r.tomorrowCount])).toEqual([['IBT-A', 1], ['TRX-A', 1], ['TRX-C', 0]]);
  });

  it('batal trip Draft: semua surat jalannya kembali Menunggu; tabel baru tidak bisa dihapus', async () => {
    const kg = await actorOf(ids.kg);
    const made = await lg.createTrip(kg, { ...base(), noteKeys: [S(pos.c)] });
    const id = made.ok ? made.data.id : 0;
    expect(await tabs()).toMatchObject({ ON_TRIP: 1 });
    expect((await lg.cancelTrip(kg, id, REASON)).ok).toBe(true);
    expect(await tabs()).toMatchObject({ ON_TRIP: 0, WAITING: 3 });
    for (const table of ['delivery_notes', 'trip_visits', 'trip_visit_notes', 'trip_pickups', 'delivery_note_events']) {
      await expect(sql.unsafe(`delete from logistics.${table}`)).rejects.toThrow(/tidak boleh dihapus/);
    }
  });
});
