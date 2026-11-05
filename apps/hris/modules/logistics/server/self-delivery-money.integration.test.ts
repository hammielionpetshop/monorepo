import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// LT3d Uang & laporan antar sendiri (spec LT1 §15.4) pada DB sintetis dengan stub kasir. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_lt3d_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const DAY = '2026-11-06';
const at = (clock: string, day = DAY) => new Date(`${day}T${clock}:00+07:00`);
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], 'foto.jpg', { type: 'image/jpeg' });

let admin: postgres.Sql;
let sql: postgres.Sql;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'kasir' | 'pramu' | 'kt' | 'finance', number>;
let lg: typeof import('@/modules/logistics');
const pos: Record<string, number> = {};
let tpBranch = 0;
let tripId = 0;
const stop: Record<'a' | 'b', number> = { a: 0, b: 0 };

describe.skipIf(!ADMIN_URL)('LT3d: Uang & laporan antar sendiri', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ now: at('09:00'), toFake: ['Date'] });
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
          await sql`insert into hris.branches (name, kasir_branch_id) values ('Gudang', 1), ('Toko Pusat', 2)`;
        }
        await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();
      }
    }
    process.env.DATABASE_URL = url.toString();
    process.env.AUTH_COOKIE_ENV = 'staging';
    const branchId = async (name: string) => Number((await sql`select id from hris.branches where name = ${name}`)[0].id);
    tpBranch = await branchId('Toko Pusat');
    const gudang = await branchId('Gudang');
    const person = async (name: string, position: string, branch: number) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on) values (hris.next_employee_code(), ${name}, '2026-01-01') returning id`;
      const [p] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${branch}, ${p.id}, 'EMPLOYEE', '2026-01-01')`;
      return Number(row.id);
    };
    ids = {
      kasir: await person('Kasir Pusat', 'Kasir', tpBranch), pramu: await person('Pramu Pusat', 'Pramuniaga', tpBranch),
      kt: await person('Kepala Pusat', 'Kepala Toko', tpBranch), finance: await person('Fina', 'Finance', gudang),
    };
    const [budi] = await sql`insert into petshop.groomers (name, is_groomer, is_courier) values ('Budi', false, true) returning id`;
    await sql`insert into hris.pos_groomer_links (pos_groomer_id, employee_id, created_by_account_id) values (${budi.id}, ${ids.kasir}, 1)`;
    const customer = async (name: string) => Number((await sql`insert into petshop.customers (code, name, address) values (${name.slice(-3)}, ${name}, 'Jl. Uji') returning id`)[0].id);
    pos.sinar = await customer('Toko Sinar');
    pos.maju = await customer('Toko Maju');
    const sale = async (number: string, customerId: number) => {
      const [row] = await sql`insert into petshop.transactions (trx_number, payable_amount, created_at, branch_id, customer_id, status, revision, delivery_method)
        values (${number}, 150000, '2026-11-06 01:00:00'::text::timestamp, 2, ${customerId}, 'COMPLETED', 1, 'BRANCH_COURIER') returning id`;
      const [item] = await sql`insert into petshop.transaction_items (transaction_id, product_name, total_price) values (${row.id}, 'Ongkos Kirim', 10000) returning id`;
      await sql`insert into petshop.service_deliveries (branch_id, transaction_id, transaction_item_id, courier_id) values (2, ${row.id}, ${item.id}, ${budi.id})`;
      return Number(row.id);
    };
    pos.a = await sale('TRX-A', pos.sinar);
    pos.b = await sale('TRX-B', pos.maju);
    for (const [customerId, trx] of [[pos.sinar, pos.a], [pos.maju, pos.b]]) {
      await sql`insert into petshop.customer_debts (customer_id, transaction_id, total_amount, remaining_amount) values (${customerId}, ${trx}, 150000, 150000)`;
    }

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

  const clockIn = async (employeeId: number) => {
    const [p] = await sql`select position_id from hris.current_placements where employee_id = ${employeeId} and active`;
    const [day] = await sql`insert into hris.attendance_days (employee_id, work_date, branch_id, position_id, shift_source)
      values (${employeeId}, ${DAY}, ${tpBranch}, ${p.position_id}, 'NONE') returning id`;
    const fileId = randomUUID();
    await sql`insert into hris.files (id, mime, size_bytes, sha256, uploaded_by_account_id) values (${fileId}, 'image/jpeg', 10, 'x', ${employeeId + 1000})`;
    const [attempt] = await sql`insert into hris.attendance_attempts (employee_id, kind, branch_id, result) values (${employeeId}, 'IN', ${tpBranch}, 'OK') returning id`;
    await sql`insert into hris.attendance_records (day_id, kind, branch_id, recorded_at, latitude, longitude, distance_m, photo_file_id, attempt_id)
      values (${day.id}, 'IN', ${tpBranch}, ${at('08:00')}, 0, 0, 0, ${fileId}, ${attempt.id})`;
  };
  const tripRow = async () => (await sql`select status, cash_amount, cash_received_at from logistics.self_trips where id = ${tripId}`)[0];
  const current = async (stopId: number) =>
    (await sql`select method, received_amount, correction_reason from logistics.self_trip_payments where stop_id = ${stopId} and replaced_at is null`)[0];

  it('selama berjalan: PJ mengoreksi cara bayar dan Lapor masalah; kantor belum boleh mengoreksi', async () => {
    await clockIn(ids.kasir);
    const kasir = await actorOf(ids.kasir);
    const made = await lg.startSelfTrip(kasir, { transactionIds: [pos.a, pos.b] }, jpeg());
    tripId = made.ok ? made.data.id : 0;
    const stops = await sql`select id from logistics.self_trip_stops where trip_id = ${tripId} order by id`;
    [stop.a, stop.b] = stops.map((s) => Number(s.id));
    vi.setSystemTime(at('09:10'));
    expect((await lg.selfStopOutcome(kasir, tripId, stop.a, { outcome: 'DELIVERED', payment: { method: 'CASH' } }, jpeg(), null)).ok).toBe(true);
    vi.setSystemTime(at('09:15'));
    expect((await lg.selfStopOutcome(kasir, tripId, stop.b, { outcome: 'DELIVERED', payment: { method: 'TEMPO', promiseDate: '2026-11-13' } }, jpeg(), null)).ok).toBe(true);

    const kt = await actorOf(ids.kt);
    expect(await lg.correctSelfPayment(kt, stop.b, { method: 'PARTIAL', partialAmount: 40000, promiseDate: '2026-11-13', reason: 'salah tekan' }, null))
      .toMatchObject({ ok: false, status: 403 });
    expect(await lg.correctSelfPayment(kasir, stop.b, { method: 'PARTIAL', partialAmount: 40000, promiseDate: '2026-11-13', reason: 'x' }, null))
      .toMatchObject({ ok: false, status: 400 });
    expect(await lg.correctSelfPayment(kasir, stop.a, { method: 'TRANSFER', reason: 'salah tekan' }, null)).toMatchObject({ ok: false, error: 'Foto bukti transfer wajib.' });
    expect((await lg.correctSelfPayment(kasir, stop.b, { method: 'PARTIAL', partialAmount: 40000, promiseDate: '2026-11-13', reason: 'toko titip cash' }, null)).ok).toBe(true);
    expect(await current(stop.b)).toMatchObject({ method: 'PARTIAL', received_amount: 40000, correction_reason: 'toko titip cash' });
    // Selama berjalan tunai belum dihitung; riwayat mencatat koreksi.
    expect(await tripRow()).toMatchObject({ status: 'RUNNING', cash_amount: 0 });

    expect(await lg.addSelfStopReport(kasir, tripId, stop.a, { kind: 'RETURN', note: 'rusak', items: [] }, jpeg())).toMatchObject({ ok: false, status: 400 });
    expect(await lg.addSelfStopReport(await actorOf(ids.pramu), tripId, stop.a, { kind: 'DAMAGED' }, jpeg())).toMatchObject({ ok: false, status: 404 });
    expect((await lg.addSelfStopReport(kasir, tripId, stop.a, { kind: 'DAMAGED', note: '1 sak sobek' }, jpeg())).ok).toBe(true);
    const [report] = await sql`select visit_id, self_stop_id, self_trip_id, customer_id from logistics.visit_reports`;
    expect(report).toMatchObject({ visit_id: null, self_stop_id: stop.a, self_trip_id: tripId, customer_id: pos.sinar });
    const [told] = await sql`select count(*)::int as n from hris.notifications where kind = 'logistics.visit_report' and recipient_account_id = ${ids.finance + 1000}`;
    expect(told.n).toBe(1);
  });

  it('sesudah Foto 3: PJ tidak bisa melapor / mengoreksi; kantor mengoreksi; tunai yang sudah diterima dibuka lagi bila berubah', async () => {
    const kasir = await actorOf(ids.kasir);
    vi.setSystemTime(at('09:30'));
    expect((await lg.finishSelfTrip(kasir, tripId, {}, jpeg())).ok).toBe(true);
    expect(await tripRow()).toMatchObject({ status: 'DONE', cash_amount: 190000 });
    expect(await lg.addSelfStopReport(kasir, tripId, stop.b, { kind: 'SHORT' }, jpeg())).toMatchObject({ ok: false, status: 409 });
    expect(await lg.correctSelfPayment(kasir, stop.b, { method: 'TEMPO', promiseDate: '2026-11-13', reason: 'salah tekan' }, null))
      .toMatchObject({ ok: false, status: 403 });

    const kt = await actorOf(ids.kt);
    // Belum diterima: tunai yang menunggu ikut berubah.
    expect((await lg.correctSelfPayment(kt, stop.b, { method: 'TEMPO', promiseDate: '2026-11-13', reason: 'toko batal titip cash' }, null)).ok).toBe(true);
    expect(await tripRow()).toMatchObject({ cash_amount: 150000, cash_received_at: null });
    expect((await lg.receiveSelfCash(kt, tripId)).ok).toBe(true);
    // Sudah diterima lalu berubah → penerimaan dibuka lagi.
    expect((await lg.correctSelfPayment(kt, stop.b, { method: 'PARTIAL', partialAmount: 50000, promiseDate: '2026-11-13', reason: 'ternyata titip 50 ribu' }, null)).ok).toBe(true);
    expect(await tripRow()).toMatchObject({ cash_amount: 200000, cash_received_at: null });
    const events = await sql`select kind, cash_before, cash_after, cash_received_before from logistics.self_trip_events where trip_id = ${tripId} order by id`;
    expect(events.map((e) => [e.kind, e.cash_before, e.cash_after, e.cash_received_before])).toEqual([
      ['PAYMENT_CORRECTED', 0, 0, null], ['PAYMENT_CORRECTED', 190000, 150000, null], ['PAYMENT_CORRECTED', 150000, 200000, 150000],
    ]);
    const office = await lg.selfDeliveryOfficeScreen(kt, { tab: 'CASH', branchId: null });
    expect(office!.trips[0]).toMatchObject({ id: tripId, cash: 200000, canCorrect: true });
    expect(office!.trips[0].stops.find((s) => s.id === stop.a)!.reports).toHaveLength(1);
  });

  it('Uang dari Toko memuat antar sendiri; Laporan Toko → potong nota kasir → Perlu dicatat di kasir', async () => {
    const finance = await actorOf(ids.finance);
    const self = (await lg.storePaymentsScreen(finance, DAY, { source: 'SELF', branchId: null }))!;
    expect(self.rows.map((r) => [r.source, r.store, r.method, r.received])).toEqual([['SELF', 'Toko Sinar', 'CASH', 150000], ['SELF', 'Toko Maju', 'PARTIAL', 50000]]);
    expect(self.totals).toMatchObject({ cashSelf: 200000, cashTruck: 0, left: 100000 });
    expect(self.trips[0]).toMatchObject({ source: 'SELF', cashReceived: false });
    expect(self.rows.some((r) => r.canCorrect)).toBe(false);
    expect((await lg.storePaymentsScreen(finance, DAY, { source: 'TRUCK', branchId: null }))!.rows).toHaveLength(0);

    const reports = (await lg.visitReportsScreen(finance))!;
    const row = reports.open[0];
    expect(row).toMatchObject({ store: 'Toko Sinar', tripNumber: 'AS-261106-1', source: 'Antar sendiri · Toko Pusat', customerId: pos.sinar });
    expect(row.noteOptions).toEqual([{ id: pos.a, number: 'TRX-A', amount: 150000, otherCuts: 0 }]);
    expect(await lg.decideVisitReport(finance, row.id, { decision: 'CUT', noteId: pos.a, amount: 200000, reason: 'DAMAGED' })).toMatchObject({ ok: false, status: 400 });
    expect((await lg.decideVisitReport(finance, row.id, { decision: 'CUT', noteId: pos.a, amount: 20000, reason: 'DAMAGED' })).ok).toBe(true);
    const [decision] = await sql`select note_id, transaction_id from logistics.report_decisions`;
    expect(decision).toMatchObject({ note_id: null, transaction_id: pos.a });
    const toRecord = (await lg.toRecordScreen(finance))!;
    expect(toRecord.waiting[0]).toMatchObject({ noteNumber: 'TRX-A', amount: 20000, source: 'Antar sendiri · Toko Pusat' });
    expect((await lg.markDecisionRecorded(finance, toRecord.waiting[0].id, 'RTR-001')).ok).toBe(true);
    // Foto laporan dibuka Finance lewat pintu foto antar sendiri.
    expect(await lg.openSelfPhoto(finance, { tripId, kind: 'report', stopId: row.id })).toBeTruthy();
    expect(await lg.openSelfPhoto(await actorOf(ids.pramu), { tripId, kind: 'report', stopId: row.id })).toBeNull();
  });
});
