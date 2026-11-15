import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// A1 titipan toko (spec 2026-11-08-titipan-toko-design) pada DB sintetis dengan stub kasir. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_a1_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const DAY = '2026-11-06';
const GUDANG = { latitude: -7.350564720030627, longitude: 108.10865608125447 };
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], 'foto.jpg', { type: 'image/jpeg' });

let admin: postgres.Sql;
let sql: postgres.Sql;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'kg' | 'driver' | 'kenek' | 'finance', number>;
let lg: typeof import('@/modules/logistics');
const pos: Record<string, number> = {};
let tripId = 0;

describe.skipIf(!ADMIN_URL)('A1: titipan toko', () => {
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
    await sql`insert into petshop.branches (code, name) values ('GDG', 'Gudang')`;
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
        select 'position.field_duty_auto', 'POSITION', id, ${sql.json(duty)}, '2026-01-01', 'ACTIVE', 'Uji LT1b-3' from hris.positions where name = ${position}`;
    }
    const [route] = await sql`select id from logistics.routes where name = 'Garut'`;
    const [vehicle] = await sql`select id from logistics.vehicles where name = 'L300'`;
    const customer = async (name: string) => {
      const [row] = await sql`insert into petshop.customers (code, name, address) values (${name.slice(0, 3).toUpperCase()}, ${name}, 'Jl. Uji') returning id`;
      return Number(row.id);
    };
    const sale = async (number: string, customerId: number, remaining: number | null, status = 'UNPAID') => {
      const [row] = await sql`insert into petshop.transactions (trx_number, payable_amount, created_at, branch_id, customer_id, status, revision, delivery_method)
        values (${number}, 300000, '2026-11-05 02:00:00'::text::timestamp, 1, ${customerId}, 'COMPLETED', 1, 'TRUCK') returning id`;
      if (remaining != null) {
        await sql`insert into petshop.customer_debts (customer_id, transaction_id, total_amount, paid_amount, remaining_amount, status)
          values (${customerId}, ${row.id}, 300000, ${300000 - remaining}, ${remaining}, ${status})`;
      }
      return Number(row.id);
    };
    pos.sinar = await customer('Toko Sinar');
    pos.maju = await customer('Toko Maju');
    pos.depan = await customer('Toko Depan');
    pos.lunas = await customer('Toko Lunas');
    const notes = [
      await sale('TRX-A', pos.sinar, 150000, 'PARTIAL'), await sale('TRX-B', pos.sinar, null),
      await sale('TRX-C', pos.maju, 200000), await sale('TRX-D', pos.depan, 100000), await sale('TRX-E', pos.lunas, 0, 'PAID'),
    ];

    lg = await import('@/modules/logistics');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
    const kg = await actorOf(ids.kg);
    const made = await lg.createTrip(kg, {
      vehicleId: Number(vehicle.id), routeId: Number(route.id), shoppingRouteIds: [], driverId: ids.driver, assistantIds: [ids.kenek],
      noteKeys: notes.map((id) => `S${id}`),
    });
    tripId = made.ok ? made.data.id : 0;
    await lg.markReady(kg, tripId);
    vi.setSystemTime(new Date(`${DAY}T08:00:00+07:00`));
    await lg.departTrip(await actorOf(ids.driver), tripId, jpeg(), GUDANG);
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
  const deliver = async (destination: string, payment: { method?: string; partialAmount?: number; promiseDate?: string; depositAmount?: number } | null, proof: File | null = null) =>
    lg.processVisit(await actorOf(ids.driver), tripId, (await visitOf(destination)).id, { outcome: 'DELIVERED', point: GUDANG, payment }, jpeg(), proof);


  it('Terkirim: Lunas + titip dan Titip saja mencatat titipan; titipan di cara bayar lain ditolak', async () => {
    expect(await deliver('Toko Maju', { method: 'PARTIAL', partialAmount: 50000, promiseDate: '2026-11-10', depositAmount: 10000 })).toMatchObject({ ok: false, status: 400 });
    expect((await visitOf('Toko Maju')).status).toBe('OPEN');
    expect((await deliver('Toko Maju', { method: 'CASH', depositAmount: 50000 })).ok).toBe(true);
    expect((await deliver('Toko Lunas', { depositAmount: 25000 })).ok).toBe(true);
    const rows = await sql`select customer_id, amount, kind from logistics.store_deposits order by id`;
    expect(rows.map((r) => [Number(r.customer_id), Number(r.amount), r.kind])).toEqual([[pos.maju, 50000, 'IN'], [pos.lunas, 25000, 'IN']]);
    const [pay] = await sql`select method, received_amount from logistics.visit_payments where customer_id = ${pos.maju}`;
    expect(pay).toMatchObject({ method: 'CASH', received_amount: 200000 });
  });

  it('diperiksa sesudah Menuju Garasi; saldo hanya dari yang diperiksa; pakai, kembalikan, batal, dicatat', async () => {
    const finance = await actorOf(ids.finance);
    const pending = (await lg.pendingDeposits(finance))!;
    expect(pending.rows.map((r) => [r.store, r.ready])).toEqual([['Toko Maju', false], ['Toko Lunas', false]]);
    const maju = pending.rows[0];
    expect(await lg.checkDeposit(finance, maju.id, { actual: 50000 })).toMatchObject({ ok: false, status: 409 });
    for (const destination of ['Toko Sinar', 'Toko Depan']) await deliver(destination, { method: 'TEMPO', promiseDate: '2026-11-10' });
    vi.setSystemTime(new Date(`${DAY}T15:00:00+07:00`));
    expect((await lg.headHome(await actorOf(ids.driver), tripId, jpeg(), null)).ok).toBe(true);
    expect(await lg.checkDeposit(await actorOf(ids.driver), maju.id, { actual: 50000 })).toMatchObject({ ok: false, status: 403 });
    expect(await lg.checkDeposit(finance, maju.id, { actual: 40000 })).toMatchObject({ ok: false, status: 400 });
    expect((await lg.checkDeposit(finance, maju.id, { actual: 40000, note: 'kurang 10 ribu' })).ok).toBe(true);
    expect(await lg.checkDeposit(finance, maju.id, { actual: 40000, note: 'kurang 10 ribu' })).toMatchObject({ ok: false, status: 409 });
    let store = (await lg.depositsScreen(finance))!.stores.find((s) => s.customerId === pos.maju)!;
    expect(store).toMatchObject({ balance: 40000, waitingCheck: 0 });
    expect(store.debts.map((d) => [d.number, d.remaining])).toEqual([['TRX-C', 200000]]);
    const trx = store.debts[0].transactionId;
    expect(await lg.applyDeposit(finance, { customerId: pos.maju, transactionId: trx, amount: 45000 })).toMatchObject({ ok: false, status: 400 });
    expect((await lg.applyDeposit(finance, { customerId: pos.maju, transactionId: trx, amount: 30000 })).ok).toBe(true);
    expect(await lg.refundDeposit(finance, { customerId: pos.maju, amount: 20000, reason: 'Toko minta uangnya' })).toMatchObject({ ok: false, status: 400 });
    expect((await lg.refundDeposit(finance, { customerId: pos.maju, amount: 10000, reason: 'Toko minta uangnya' })).ok).toBe(true);
    store = (await lg.depositsScreen(finance))!.stores.find((s) => s.customerId === pos.maju)!;
    expect(store.balance).toBe(0);
    const uses = (await lg.depositUsesToRecord(finance))!;
    expect(uses.waiting.map((u) => [u.store, u.trxNumber, u.amount])).toEqual([['Toko Maju', 'TRX-C', 30000]]);
    const refund = store.entries.find((e) => e.kind === 'REFUND')!;
    expect((await lg.voidDeposit(finance, refund.id, 'Salah catat')).ok).toBe(true);
    expect((await lg.recordDepositUse(finance, uses.waiting[0].id, 'PL-0001')).ok).toBe(true);
    expect(await lg.voidDeposit(finance, uses.waiting[0].id, 'Salah catat')).toMatchObject({ ok: false, status: 409 });
    expect((await lg.depositsScreen(finance))!.stores.find((s) => s.customerId === pos.maju)!.balance).toBe(10000);
    expect(await lg.depositAttention(finance)).toEqual({ toCheck: 1, toRecord: 0 });
    await expect(sql`delete from logistics.store_deposits`).rejects.toThrow();
  });
});
