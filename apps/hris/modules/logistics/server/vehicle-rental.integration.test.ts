import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// F2-5b Sewa Mobil (spec F2-5 §3.5) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_f25b_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const DAY = '2026-11-11';
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], 'bukti.jpg', { type: 'image/jpeg' });

let admin: postgres.Sql;
let sql: postgres.Sql;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'kg' | 'finance' | 'finance2' | 'owner' | 'driver', number>;
let lg: typeof import('@/modules/logistics');
let vehicleId = 0;
let routeId = 0;
let places: { drawer: number; safe: number };

describe.skipIf(!ADMIN_URL)('F2-5b: sewa mobil per ritase', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ now: new Date(`${DAY}T09:00:00+07:00`), toFake: ['Date'] });
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
          await sql`insert into hris.branches (name, latitude, longitude, kasir_branch_id) values ('Gudang', -7.35, 108.1, 1)`;
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
      kg: await person('Kepala Gudang Uji', 'Kepala Gudang'), finance: await person('Fina', 'Finance'), finance2: await person('Fani', 'Finance'),
      owner: await person('Pemilik Uji', 'Pemilik'), driver: await person('Dedi', 'Driver'),
    };
    const [m1] = await sql`insert into petshop.money_places (name, kind, branch_id) values ('Laci Gudang', 'DRAWER', 1) returning id`;
    const [m2] = await sql`insert into petshop.money_places (name, kind, branch_id) values ('Brankas', 'CASH', 1) returning id`;
    places = { drawer: Number(m1.id), safe: Number(m2.id) };
    const [vehicle] = await sql`select id from logistics.vehicles where name = 'L300'`;
    const [route] = await sql`select id from logistics.routes where name = 'Garut'`;
    vehicleId = Number(vehicle.id);
    routeId = Number(route.id);
    const trip = async (number: string, date: string, status: 'DONE' | 'CANCELLED') => (status === 'DONE'
      ? sql`insert into logistics.trips (number, vehicle_id, route_id, status, trip_date, departed_at, crew_photo_file_id, finished_at, created_by_account_id)
          values (${number}, ${vehicleId}, ${routeId}, 'DONE', ${date}, now(), gen_random_uuid(), now(), 1)`
      : sql`insert into logistics.trips (number, vehicle_id, route_id, status, trip_date, cancelled_at, cancel_reason, created_by_account_id)
          values (${number}, ${vehicleId}, ${routeId}, 'CANCELLED', ${date}, now(), 'Batal uji', 1)`);
    await trip('T-1', '2026-10-05', 'DONE');
    await trip('T-2', '2026-10-20', 'DONE');
    await trip('T-3', '2026-10-21', 'CANCELLED');
    await trip('T-4', '2026-11-02', 'DONE');

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

  const rowOf = async (employeeId: number, month = '2026-10') => (await lg.vehicleRentalScreen(await actorOf(employeeId), month))!.rows.find((r) => r.vehicleId === vehicleId)!;
  const payInput = (over: Partial<import('@/modules/logistics').RentalPayInput> = {}) => ({
    vehicleId, month: '2026-10', kind: 'PAYMENT' as const, occurredOn: DAY, moneyPlaceId: places.safe, amount: 300_000, differenceReason: null, ...over,
  });

  it('Sewa + tarif: tanpa tarif belum bertarif dan Bayar ditolak; Kepala Gudang hanya melihat', async () => {
    const owner = await actorOf(ids.owner);
    expect((await lg.setVehicleOwnership(await actorOf(ids.kg), { vehicleId, ownership: 'RENTED', ownerName: 'Pak Ujang', ownerNote: null })).ok).toBe(false);
    expect((await lg.setVehicleOwnership(owner, { vehicleId, ownership: 'RENTED', ownerName: 'Pak Ujang', ownerNote: 'BCA 123' })).ok).toBe(true);
    let row = await rowOf(ids.finance);
    expect(row).toMatchObject({ tripCount: 2, total: 0 });
    expect(row.unratedDates).toHaveLength(2);
    expect(await lg.payVehicleRental(await actorOf(ids.finance), payInput(), null)).toMatchObject({ ok: false, status: 400 });

    expect((await lg.createRentalRate(owner, { vehicleId, effectiveFrom: '2026-10-01', amount: 150_000 })).ok).toBe(true);
    row = await rowOf(ids.finance);
    expect(row).toMatchObject({ tripCount: 2, total: 300_000, unratedDates: [], next: { kind: 'PAYMENT', due: 300_000 } });

    const kg = await lg.vehicleRentalScreen(await actorOf(ids.kg), '2026-10');
    expect(kg?.canPay).toBe(false);
    expect(await lg.payVehicleRental(await actorOf(ids.kg), payInput(), null)).toMatchObject({ ok: false, status: 403 });
  });

  it('Bayar: bulan berjalan dan Laci ditolak; jumlah beda wajib alasan; potret tersimpan', async () => {
    const finance = await actorOf(ids.finance);
    expect(await lg.payVehicleRental(finance, payInput({ month: '2026-11', amount: 150_000 }), null)).toMatchObject({ ok: false, status: 400 });
    expect(await lg.payVehicleRental(finance, payInput({ moneyPlaceId: places.drawer }), null)).toMatchObject({ ok: false, status: 400 });
    expect(await lg.payVehicleRental(finance, payInput({ amount: 250_000 }), null)).toMatchObject({ ok: false, status: 400 });
    expect((await lg.payVehicleRental(finance, payInput(), jpeg())).ok).toBe(true);
    expect(await lg.payVehicleRental(finance, payInput(), null)).toMatchObject({ ok: false, status: 409 });
    const [p] = await sql`select trip_count, billed_amount, amount, money_place_id, proof_file_id from logistics.vehicle_rental_payments`;
    expect(p).toMatchObject({ trip_count: 2, billed_amount: 300_000, amount: 300_000, money_place_id: places.safe });
    expect(p.proof_file_id).not.toBeNull();
  });

  it('ritase tangan driver sesudah dibayar → kurang Rp150.000 → Bayar susulan', async () => {
    await sql`insert into logistics.trip_wages (employee_id, role, kind, trip_date, vehicle_id, route_id, with_assistant, origin, manual_reason)
      values (${ids.driver}, 'DRIVER', 'RITASE', '2026-10-25', ${vehicleId}, ${routeId}, false, 'MANUAL', 'Lupa dicatat')`;
    await sql`insert into logistics.trip_wages (employee_id, role, kind, trip_date, vehicle_id, route_id, with_assistant, origin, manual_reason)
      values (${ids.driver}, 'ASSISTANT', 'RITASE', '2026-10-25', ${vehicleId}, ${routeId}, false, 'MANUAL', 'Kenek tidak menambah')`;
    const row = await rowOf(ids.finance);
    expect(row).toMatchObject({ tripCount: 3, total: 450_000, paid: 300_000, changeAfterPaid: 150_000, next: { kind: 'TOP_UP', due: 150_000 } });
    expect((await lg.payVehicleRental(await actorOf(ids.finance), payInput({ kind: 'TOP_UP', amount: 150_000 }), null)).ok).toBe(true);
    expect(await rowOf(ids.finance)).toMatchObject({ paid: 450_000, remaining: 0, changeAfterPaid: 0, next: null });
  });

  it('batal: bukan pembayar ditolak; Bayar ditolak selama ada Bayar susulan; besoknya hanya Pemilik/GM', async () => {
    const row = await rowOf(ids.finance);
    const payment = row.payments.find((p) => p.kind === 'PAYMENT')!;
    const topUp = row.payments.find((p) => p.kind === 'TOP_UP')!;
    expect(await lg.cancelVehicleRentalPayment(await actorOf(ids.finance2), topUp.id, 'Salah catat')).toMatchObject({ ok: false, status: 403 });
    expect(await lg.cancelVehicleRentalPayment(await actorOf(ids.finance), payment.id, 'Salah catat')).toMatchObject({ ok: false, status: 409 });
    expect((await lg.cancelVehicleRentalPayment(await actorOf(ids.finance), topUp.id, 'Salah catat')).ok).toBe(true);
    vi.setSystemTime(new Date('2026-11-12T09:00:00+07:00'));
    expect(await lg.cancelVehicleRentalPayment(await actorOf(ids.finance), payment.id, 'Salah catat')).toMatchObject({ ok: false, status: 403 });
    expect((await lg.cancelVehicleRentalPayment(await actorOf(ids.owner), payment.id, 'Salah catat')).ok).toBe(true);
    expect(await rowOf(ids.finance)).toMatchObject({ paid: 0, hasPayment: false, next: { kind: 'PAYMENT', due: 450_000 } });
    await expect(sql`delete from logistics.vehicle_rental_payments`).rejects.toThrow();
  });
});
