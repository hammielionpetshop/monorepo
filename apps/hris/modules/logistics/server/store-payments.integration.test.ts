import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// LT1b-3 uang dan laporan di toko (spec LT1 §13.5) pada DB sintetis dengan stub kasir. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_lt1b3_svc_${process.pid}_${Date.now()}`;
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

describe.skipIf(!ADMIN_URL)('LT1b-3: uang dan laporan di toko', () => {
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
  const deliver = async (destination: string, payment: { method?: string; partialAmount?: number } | null, proof: File | null = null) =>
    lg.processVisit(await actorOf(ids.driver), tripId, (await visitOf(destination)).id, { outcome: 'DELIVERED', point: GUDANG, payment }, jpeg(), proof);

  it('tagihan = sisa piutang kasir; Lunas transfer wajib bukti; salah isi tidak meninggalkan Terkirim setengah jadi', async () => {
    expect(await visitOf('Toko Sinar')).toMatchObject({ bill: 150000, payment: null });
    expect(await visitOf('Toko Lunas')).toMatchObject({ bill: 0 });
    expect(await deliver('Toko Sinar', null)).toMatchObject({ ok: false, status: 400, error: 'Pilih cara bayar toko.' });
    expect(await deliver('Toko Sinar', { method: 'TRANSFER' })).toMatchObject({ ok: false, status: 400 });
    expect(await visitOf('Toko Sinar')).toMatchObject({ status: 'OPEN' });
    expect((await sql`select status from logistics.delivery_notes where number = 'TRX-A'`)[0].status).toBe('ON_TRIP');
    expect((await deliver('Toko Sinar', { method: 'TRANSFER' }, jpeg())).ok).toBe(true);
    expect((await visitOf('Toko Sinar')).payment).toMatchObject({ method: 'TRANSFER', bill: 150000, received: 150000, left: 0, proofUrl: expect.stringMatching(/^\/api\/logistics\/photo/) });
    const proof = (await visitOf('Toko Sinar')).payment!.proofUrl!.split('file=')[1];
    expect(await lg.openTripPhoto(await actorOf(ids.finance), tripId, proof)).toBe(proof);
    expect(await lg.openTripPhoto(await actorOf(ids.finance), tripId, (await visitOf('Toko Sinar')).photoUrl!.split('file=')[1])).toBeNull();
    expect(await lg.openTripPhoto(await actorOf(ids.kg), tripId, proof)).toBe(proof);
  });

  it('bayar sebagian kurang dari tagihan; tempo; tagihan 0 dicatat Tidak ada tagihan', async () => {
    expect(await deliver('Toko Maju', { method: 'PARTIAL', partialAmount: 200000 })).toMatchObject({ ok: false, error: expect.stringContaining('Lunas cash') });
    expect((await deliver('Toko Maju', { method: 'PARTIAL', partialAmount: 50000 })).ok).toBe(true);
    expect((await deliver('Toko Depan', { method: 'TEMPO' })).ok).toBe(true);
    expect((await deliver('Toko Lunas', { method: 'CASH' })).ok).toBe(true);
    const rows = await sql`select v.destination_name, p.method, p.bill_amount, p.received_amount from logistics.visit_payments p
      join logistics.trip_visits v on v.id = p.visit_id order by p.id`;
    expect(rows.map((r) => [r.destination_name, r.method, r.bill_amount, r.received_amount])).toEqual([
      ['Toko Sinar', 'TRANSFER', 150000, 150000], ['Toko Maju', 'PARTIAL', 200000, 50000], ['Toko Depan', 'TEMPO', 100000, 0], ['Toko Lunas', 'NONE', 0, 0],
    ]);
    await expect(sql`delete from logistics.visit_payments`).rejects.toThrow();
  });

  it('Uang dari Toko untuk Finance: cash dibawa driver, transfer, sisa ditagih kantor', async () => {
    expect(await lg.storePaymentsScreen(await actorOf(ids.driver), DAY)).toBeNull();
    const screen = (await lg.storePaymentsScreen(await actorOf(ids.finance), DAY))!;
    expect(screen.totals).toEqual({ cash: 50000, transfer: 150000, left: 250000, visits: 4 });
    expect(screen.trips).toHaveLength(1);
    expect(screen.trips[0].crew).toBe('Dedi, Eko');
    expect(screen.rows.find((r) => r.store === 'Toko Sinar')?.notes).toEqual(['TRX-A', 'TRX-B']);
  });

  it('Lapor masalah sesudah Terkirim: jenis baku + foto; retur dibawa pulang; kantor menutup dengan catatan', async () => {
    const kenek = await actorOf(ids.kenek);
    const maju = await visitOf('Toko Maju');
    expect(await lg.addVisitReport(kenek, tripId, maju.id, { kind: 'OTHER', note: 'x' }, jpeg())).toMatchObject({ ok: false, status: 400 });
    expect(await lg.addVisitReport(kenek, tripId, maju.id, { kind: 'DAMAGED', note: '2 sak sobek' }, null)).toMatchObject({ ok: false, status: 400 });
    expect((await lg.addVisitReport(kenek, tripId, maju.id, { kind: 'DAMAGED', note: '2 sak sobek' }, jpeg())).ok).toBe(true);
    expect((await lg.addVisitReport(kenek, tripId, maju.id, { kind: 'RETURN', note: '1 dus', items: [{ name: 'Whiskas 1 kg', quantity: 1, unit: 'dus' }] }, jpeg())).ok).toBe(true);
    expect((await visitOf('Toko Maju')).reports.map((r) => [r.label, r.carriedBack])).toEqual([['Barang rusak', false], ['Retur (dibawa pulang)', true]]);
    const [told] = await sql`select title, link from hris.notifications where kind = 'logistics.visit_report' and recipient_account_id = ${ids.kg + 1000} order by id limit 1`;
    expect(told).toMatchObject({ title: 'Barang rusak: Toko Maju (trip TR-261106-1)', link: '/logistik/laporan-toko' });
    expect(await lg.openReportCount(await actorOf(ids.kg))).toBe(2);

    const kg = await actorOf(ids.kg);
    const screen = (await lg.visitReportsScreen(kg))!;
    expect(screen.open.map((r) => r.store)).toEqual(['Toko Maju', 'Toko Maju']);
    expect(await lg.closeVisitReport(await actorOf(ids.driver), screen.open[0].id, 'Nota dipotong')).toMatchObject({ ok: false, status: 403 });
    expect(await lg.closeVisitReport(kg, screen.open[0].id, 'ok')).toMatchObject({ ok: false, status: 400 });
    expect((await lg.closeVisitReport(kg, screen.open[0].id, 'Nota dipotong Rp 20.000')).ok).toBe(true);
    expect(await lg.closeVisitReport(kg, screen.open[0].id, 'Nota dipotong Rp 20.000')).toMatchObject({ ok: false, status: 409 });
    expect((await lg.visitReportsScreen(kg))!.closed[0]).toMatchObject({ closeNote: 'Nota dipotong Rp 20.000', closed: true });
  });

  it('laporan hanya sesudah Terkirim dan selama trip Berjalan', async () => {
    const lunas = await visitOf('Toko Lunas');
    const driver = await actorOf(ids.driver);
    expect((await lg.headHome(driver, tripId, jpeg(), null)).ok).toBe(true);
    expect(await lg.addVisitReport(driver, tripId, lunas.id, { kind: 'SHORT' }, jpeg())).toMatchObject({ ok: false, status: 409 });
  });
});
