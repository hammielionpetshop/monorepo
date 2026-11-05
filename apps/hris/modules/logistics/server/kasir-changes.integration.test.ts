import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// LT2c nota berubah di kasir sesudah masuk trip (spec LT1 §14.3) pada DB sintetis dengan stub kasir. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_lt2c_svc_${process.pid}_${Date.now()}`;
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

describe.skipIf(!ADMIN_URL)('LT2c: nota berubah di kasir', () => {
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

  const kasirNotes = async (number: string) => (await sql`
    select n.recipient_account_id as to, n.title, n.link from hris.notifications n where n.kind = 'logistics.kasir_changed' and n.title like ${number + ' %'} order by n.id`)
    .map((r) => ({ to: Number(r.to), title: r.title as string, link: r.link as string }));
  const noteOf = async (id: number, number: string) => (await lg.tripDetailScreen(await actorOf(ids.kg), id))!.delivery.visits.flatMap((v) => v.notes).find((n) => n.number === number)!;

  it('pemeriksa: diam bila tidak berubah; nominal berubah → Kepala Gudang + awak diberi tahu sekali', async () => {
    const kg = await actorOf(ids.kg);
    const made = await lg.createTrip(kg, { ...base(), noteKeys: [S(pos.a), S(pos.b), S(pos.c)] });
    expect(made.ok).toBe(true);
    const id = await tripId('TR-261106-1');
    expect(await lg.runKasirCheck(new Date())).toMatchObject({ checked: 3, notified: 0 });
    expect(await lg.kasirChangeAttention(kg)).toBeNull();

    await sql`update petshop.transactions set payable_amount = 120000, revision = 2 where id = ${pos.a}`;
    expect(await lg.runKasirCheck(new Date())).toMatchObject({ notified: 1 });
    expect(await lg.runKasirCheck(new Date())).toMatchObject({ notified: 0 });
    const sent = await kasirNotes('TRX-A');
    expect(sent.map((n) => n.to).sort()).toEqual([ids.kg, ids.driver, ids.kenek].map((x) => x + 1000).sort());
    expect(sent[0].title).toContain('TRX-A berubah di kasir');
    expect(sent.find((n) => n.to === ids.driver + 1000)!.link).toBe('/trip-saya');
    expect(sent.find((n) => n.to === ids.kg + 1000)!.link).toBe(`/logistik/trip/${id}`);
    expect(await lg.kasirChangeAttention(kg)).toEqual({ count: 1, tripId: id });
    expect(await lg.kasirChangeAttention(await actorOf(ids.driver))).toBeNull();
  });

  it('Tetap antar: hanya kantor; tanda abu-abu, keluar Beranda; diubah lagi = diberi tahu lagi', async () => {
    const kg = await actorOf(ids.kg);
    const id = await tripId('TR-261106-1');
    const a = await noteOf(id, 'TRX-A');
    expect(a.kept).toBe(false);
    expect(await lg.keepKasirChange(await actorOf(ids.driver), id, a.noteId)).toMatchObject({ ok: false, status: 403 });
    const c = await noteOf(id, 'TRX-C');
    expect(await lg.keepKasirChange(kg, id, c.noteId)).toMatchObject({ ok: false, status: 409 });
    expect((await lg.keepKasirChange(kg, id, a.noteId)).ok).toBe(true);
    expect((await noteOf(id, 'TRX-A')).kept).toBe(true);
    expect(await lg.kasirChangeAttention(kg)).toBeNull();
    expect(await lg.runKasirCheck(new Date())).toMatchObject({ notified: 0 });

    await sql`update petshop.transactions set payable_amount = 110000, revision = 3 where id = ${pos.a}`;
    expect(await lg.runKasirCheck(new Date())).toMatchObject({ notified: 1 });
    expect((await noteOf(id, 'TRX-A')).kept).toBe(false);
    expect(await lg.kasirChangeAttention(kg)).toEqual({ count: 1, tripId: id });
    const events = await sql`select e.kind from logistics.delivery_note_events e join logistics.delivery_notes n on n.id = e.note_id where n.number = 'TRX-A' order by e.id`;
    expect(events.map((e) => e.kind)).toEqual(['ON_TRIP', 'KASIR_CHANGED', 'KASIR_KEPT', 'KASIR_CHANGED']);
  });

  it('kasir kembali seperti semula = keadaan ditutup; menunggu batal boleh Tetap antar, batal final tidak', async () => {
    const kg = await actorOf(ids.kg);
    const id = await tripId('TR-261106-1');
    await sql`update petshop.transactions set payable_amount = 150000, revision = 1 where id = ${pos.a}`;
    expect(await lg.runKasirCheck(new Date())).toMatchObject({ notified: 0, cleared: 1 });
    expect(await lg.kasirChangeAttention(kg)).toBeNull();

    await sql`update petshop.transactions set status = 'PENDING_VOID' where id = ${pos.c}`;
    await sql`update petshop.transactions set status = 'VOIDED' where id = ${pos.b}`;
    expect(await lg.runKasirCheck(new Date())).toMatchObject({ notified: 2 });
    expect((await kasirNotes('TRX-B'))[0].title).toContain('dibatalkan di kasir');
    expect((await kasirNotes('TRX-C'))[0].title).toContain('menunggu batal');
    expect(await lg.kasirChangeAttention(kg)).toEqual({ count: 2, tripId: id });
    expect(await lg.keepKasirChange(kg, id, (await noteOf(id, 'TRX-B')).noteId)).toMatchObject({ ok: false, error: expect.stringContaining('Lepas') });
    expect((await lg.keepKasirChange(kg, id, (await noteOf(id, 'TRX-C')).noteId)).ok).toBe(true);
    expect(await lg.kasirChangeAttention(kg)).toEqual({ count: 1, tripId: id });
  });

  it('Terkirim: batal final ditolak, menunggu batal tidak; Lepas = keluar Beranda dan ditutup pemeriksa', async () => {
    const kg = await actorOf(ids.kg);
    const id = await tripId('TR-261106-1');
    expect((await lg.markReady(kg, id)).ok).toBe(true);
    at('08:00');
    expect((await lg.departTrip(await actorOf(ids.driver), id, jpeg(), null)).ok).toBe(true);
    const visits = (await lg.tripDetailScreen(kg, id))!.delivery.visits;
    const sinar = visits.find((v) => v.destination === 'Toko Sinar')!;
    const maju = visits.find((v) => v.destination === 'Toko Maju')!;
    const pickup = (await lg.tripDetailScreen(kg, id))!.delivery.pickups.find((p) => p.status === 'OPEN');
    if (pickup) expect((await lg.finishPickup(await actorOf(ids.driver), id, pickup.id, jpeg())).ok).toBe(true);
    expect(await lg.processVisit(await actorOf(ids.driver), id, sinar.id, { outcome: 'DELIVERED' }, jpeg()))
      .toMatchObject({ ok: false, status: 409, error: expect.stringContaining('TRX-B dibatalkan di kasir') });
    expect((await lg.processVisit(await actorOf(ids.driver), id, maju.id, { outcome: 'DELIVERED' }, jpeg())).ok).toBe(true);

    expect((await lg.releaseVisit(kg, id, sinar.id, REASON)).ok).toBe(true);
    expect(await lg.kasirChangeAttention(kg)).toBeNull();
    expect(await lg.runKasirCheck(new Date())).toMatchObject({ checked: 0, cleared: 1 });
    await expect(sql`delete from logistics.kasir_changes`).rejects.toThrow(/tidak boleh dihapus/);
  });
});
