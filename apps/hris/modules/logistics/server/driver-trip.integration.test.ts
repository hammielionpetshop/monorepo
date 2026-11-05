import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// LT1b-2a alur trip HP driver (spec LT1 §13.3) pada DB sintetis dengan stub kasir. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_lt1b2a_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const DAY = '2026-11-06';
const GUDANG = { latitude: -7.350564720030627, longitude: 108.10865608125447 };
const REASON = 'Alasan uji yang cukup panjang';
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], 'foto.jpg', { type: 'image/jpeg' });

let admin: postgres.Sql;
let sql: postgres.Sql;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'kg' | 'driver' | 'kenek' | 'owner' | 'finance', number>;
let lg: typeof import('@/modules/logistics');
let route: Record<string, number>;
let vehicle: Record<string, number>;
const pos: Record<string, number> = {};
let tripId = 0;

const at = (clock: string) => vi.setSystemTime(new Date(`${DAY}T${clock}:00+07:00`));
const S = (id: number) => `S${id}`;
const T = (id: number) => `T${id}`;

describe.skipIf(!ADMIN_URL)('LT1b-2a: alur trip HP driver', () => {
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
    ids = {
      kg: await person('Kepala Gudang Uji', 'Kepala Gudang'), driver: await person('Dedi', 'Driver'), kenek: await person('Eko', 'Kenek'),
      owner: await person('Elan', 'Pemilik'), finance: await person('Fina', 'Finance'),
    };
    for (const [position, duty] of [['Driver', 'DRIVE'], ['Kenek', 'ASSIST']]) {
      await sql`insert into hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason)
        select 'position.field_duty_auto', 'POSITION', id, ${sql.json(duty)}, '2026-01-01', 'ACTIVE', 'Uji LT1b-2a' from hris.positions where name = ${position}`;
    }
    route = Object.fromEntries((await sql`select id, name from logistics.routes`).map((r) => [r.name, Number(r.id)]));
    vehicle = Object.fromEntries((await sql`select id, name from logistics.vehicles`).map((r) => [r.name, Number(r.id)]));

    const customer = async (name: string, phone: string | null = null) => {
      const [row] = await sql`insert into petshop.customers (code, name, address, phone) values (${name.slice(0, 3).toUpperCase()}, ${name}, 'Jl. Uji', ${phone}) returning id`;
      return Number(row.id);
    };
    pos.sinar = await customer('Toko Sinar', '0812-3456');
    pos.maju = await customer('Toko Maju');
    const sale = async (number: string, branchId: number, customerId: number) => {
      const [row] = await sql`insert into petshop.transactions (trx_number, payable_amount, created_at, branch_id, customer_id, status, revision, delivery_method)
        values (${number}, 150000, '2026-11-05 02:00:00'::text::timestamp, ${branchId}, ${customerId}, 'COMPLETED', 1, 'TRUCK') returning id`;
      return Number(row.id);
    };
    pos.a = await sale('TRX-A', 1, pos.sinar);
    pos.b = await sale('TRX-B', 2, pos.sinar);
    pos.c = await sale('TRX-C', 1, pos.maju);
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

  const tabs = async () => Object.fromEntries((await lg.deliveryNotesScreen(await actorOf(ids.kg), { tab: 'WAITING', originId: null, routeId: null, q: '' }))!
    .tabs.map((t) => [t.status, t.count]));
  const visitOf = async (destination: string) => (await lg.tripDetailScreen(await actorOf(ids.kg), tripId))!.delivery.visits
    .filter((v) => v.destination === destination).at(-1)!;
  const noteStatus = async (number: string) => (await sql`select status, tomorrow_count from logistics.delivery_notes where number = ${number}`)[0];

  it('Siap Kirim oleh kantor: driver belum melihat trip Draft; Ubah ditolak sampai Kembali ke Draft', async () => {
    const kg = await actorOf(ids.kg);
    const made = await lg.createTrip(kg, {
      vehicleId: vehicle['L300'], routeId: route['Garut'], shoppingRouteIds: [], driverId: ids.driver, assistantIds: [ids.kenek],
      noteKeys: [S(pos.a), S(pos.b), S(pos.c), T(pos.ibt)],
    });
    tripId = made.ok ? made.data.id : 0;
    expect((await lg.myTripsScreen(await actorOf(ids.driver)))!.trips).toHaveLength(0);
    expect(await lg.markReady(await actorOf(ids.driver), tripId)).toMatchObject({ ok: false, status: 403 });
    expect((await lg.markReady(kg, tripId)).ok).toBe(true);
    expect(await lg.markReady(kg, tripId)).toMatchObject({ ok: false, status: 409 });
    const input = { vehicleId: vehicle['L300'], routeId: route['Garut'], shoppingRouteIds: [], driverId: ids.driver, assistantIds: [ids.kenek], noteKeys: [S(pos.a)] };
    expect(await lg.updateDraft(kg, tripId, input)).toMatchObject({ ok: false, error: expect.stringContaining('Kembali ke Draft') });
    expect((await lg.unmarkReady(kg, tripId)).ok).toBe(true);
    expect((await lg.markReady(kg, tripId)).ok).toBe(true);
    const mine = (await lg.myTripsScreen(await actorOf(ids.driver)))!;
    expect(mine.trips.map((t) => [t.number, t.phase, t.statusLabel])).toEqual([['TR-261106-1', 'READY', 'Siap Kirim']]);
    const [note] = await sql`select title from hris.notifications where kind = 'logistics.ready' and recipient_account_id = ${ids.driver + 1000}`;
    expect(note.title).toContain('siap kirim');
  });

  it('kunjungan: Terkirim ditahan ambil barang; tekanan kedua "Sudah diproses"; kartu memuat telepon dan alamat', async () => {
    at('08:00');
    expect((await lg.departTrip(await actorOf(ids.driver), tripId, jpeg(), GUDANG)).ok).toBe(true);
    const sinar = await visitOf('Toko Sinar');
    expect(sinar).toMatchObject({ phone: '0812-3456', address: 'Jl. Uji' });
    expect(await lg.processVisit(await actorOf(ids.driver), tripId, sinar.id, { outcome: 'DELIVERED' }, jpeg()))
      .toMatchObject({ ok: false, error: expect.stringContaining('Toko Pusat belum diambil') });
    const pickup = (await lg.tripDetailScreen(await actorOf(ids.kg), tripId))!.delivery.pickups.find((p) => p.status === 'OPEN')!;
    expect((await lg.finishPickup(await actorOf(ids.kenek), tripId, pickup.id, jpeg())).ok).toBe(true);
    at('09:15');
    expect(await lg.processVisit(await actorOf(ids.kg), tripId, sinar.id, { outcome: 'DELIVERED' }, jpeg())).toMatchObject({ ok: false, status: 403 });
    expect(await lg.processVisit(await actorOf(ids.driver), tripId, sinar.id, { outcome: 'DELIVERED' }, null)).toMatchObject({ ok: false, status: 400 });
    expect((await lg.processVisit(await actorOf(ids.driver), tripId, sinar.id, { outcome: 'DELIVERED', point: GUDANG }, jpeg())).ok).toBe(true);
    expect(await lg.processVisit(await actorOf(ids.kenek), tripId, sinar.id, { outcome: 'DELIVERED' }, jpeg()))
      .toMatchObject({ ok: false, status: 409, error: 'Sudah diproses Dedi pukul 09.15.' });
    expect(await noteStatus('TRX-A')).toMatchObject({ status: 'DELIVERED' });
    expect(await noteStatus('TRX-B')).toMatchObject({ status: 'DELIVERED' });
    const done = await visitOf('Toko Sinar');
    expect(done).toMatchObject({ status: 'DELIVERED', by: 'Dedi' });
    expect(done.photoUrl).toMatch(/^\/api\/logistics\/photo\?trip=/);
  });

  it('Kirim Besok dengan alasan baku → Menunggu tertunda; Coba lagi membawa kembali; Gagal → Perlu keputusan + pemberitahuan', async () => {
    const driver = await actorOf(ids.driver);
    let maju = await visitOf('Toko Maju');
    expect(await lg.processVisit(driver, tripId, maju.id, { outcome: 'TOMORROW', reasonCode: 'OTHER', note: 'x' }, jpeg())).toMatchObject({ ok: false, status: 400 });
    expect((await lg.processVisit(driver, tripId, maju.id, { outcome: 'TOMORROW', reasonCode: 'CLOSED' }, jpeg())).ok).toBe(true);
    expect(await noteStatus('TRX-C')).toMatchObject({ status: 'WAITING', tomorrow_count: 1 });
    expect((await visitOf('Toko Maju')).reason).toBe('Toko tutup');
    expect((await lg.retryVisit(driver, tripId, maju.id)).ok).toBe(true);
    expect(await lg.retryVisit(driver, tripId, maju.id)).toMatchObject({ ok: false, status: 409 });
    expect(await noteStatus('TRX-C')).toMatchObject({ status: 'ON_TRIP', tomorrow_count: 0 });
    maju = await visitOf('Toko Maju');
    expect(maju.status).toBe('OPEN');
    expect((await lg.processVisit(driver, tripId, maju.id, { outcome: 'TOMORROW', reasonCode: 'NOBODY', note: 'dua kali datang' }, jpeg())).ok).toBe(true);
    expect((await visitOf('Toko Maju')).reason).toBe('Tidak ada orang: dua kali datang');
    const events = await sql`select e.kind from logistics.delivery_note_events e join logistics.delivery_notes n on n.id = e.note_id where n.number = 'TRX-C' order by e.id`;
    expect(events.map((e) => e.kind)).toEqual(['ON_TRIP', 'TOMORROW', 'RETRY', 'TOMORROW']);

    const depan = await visitOf('Toko Depan');
    expect((await lg.processVisit(driver, tripId, depan.id, { outcome: 'FAILED', reasonCode: 'REFUSED' }, jpeg())).ok).toBe(true);
    expect(await noteStatus('IBT-A')).toMatchObject({ status: 'NEEDS_DECISION' });
    const [told] = await sql`select title, link from hris.notifications where kind = 'logistics.visit_failed' and recipient_account_id = ${ids.kg + 1000}`;
    expect(told).toMatchObject({ title: expect.stringContaining('Toko Depan'), link: '/logistik/surat-jalan?tab=NEEDS_DECISION' });
    expect(await tabs()).toMatchObject({ WAITING: 1, ON_TRIP: 0, DELIVERED: 2, NEEDS_DECISION: 1 });
  });

  it('Menuju Garasi lalu Sampai Garasi dengan foto amper: ritase tetap seperti L6', async () => {
    at('15:00');
    expect((await lg.headHome(await actorOf(ids.kenek), tripId, jpeg(), null)).ok).toBe(true);
    const visit = await visitOf('Toko Maju');
    expect(await lg.processVisit(await actorOf(ids.driver), tripId, visit.id, { outcome: 'DELIVERED' }, jpeg())).toMatchObject({ ok: false, status: 409 });
    expect((await lg.myTripsScreen(await actorOf(ids.driver)))!.trips[0]).toMatchObject({ phase: 'HEADING_HOME', statusLabel: 'Menuju Garasi' });
    at('16:00');
    expect((await lg.arriveTrip(await actorOf(ids.driver), tripId, GUDANG, jpeg())).ok).toBe(true);
    const wages = await sql`select employee_id, kind from logistics.trip_wages where trip_id = ${tripId} order by employee_id`;
    expect(wages.map((w) => [Number(w.employee_id), w.kind])).toEqual([[ids.driver, 'RITASE'], [ids.kenek, 'RITASE']]);
    const [trip] = await sql`select status, fuel_gauge_photo_file_id, empty_bed_photo_file_id from logistics.trips where id = ${tripId}`;
    expect(trip.status).toBe('DONE');
    expect(trip.fuel_gauge_photo_file_id).toBeTruthy();
  });

  it('Laporan Pulang: hanya driver, sekali; bensin dan mobil masuk Bensin & Mobil sampai ditindaklanjuti', async () => {
    expect((await lg.myTripsScreen(await actorOf(ids.driver)))!.pendingReports.map((r) => r.tripId)).toEqual([tripId]);
    expect((await lg.myTripsScreen(await actorOf(ids.kenek)))!.pendingReports).toEqual([]);
    const report = { condition: 'ATTENTION', conditionNote: 'Rem belakang bunyi', needsFuel: true, fuelEstimate: 150_000, problemNote: null };
    expect(await lg.sendEndReport(await actorOf(ids.kenek), tripId, report, null)).toMatchObject({ ok: false, status: 403 });
    expect(await lg.sendEndReport(await actorOf(ids.driver), tripId, { ...report, fuelEstimate: 150_500 }, null)).toMatchObject({ ok: false, status: 400 });
    expect((await lg.sendEndReport(await actorOf(ids.driver), tripId, report, jpeg())).ok).toBe(true);
    expect(await lg.sendEndReport(await actorOf(ids.driver), tripId, report, null)).toMatchObject({ ok: false, status: 409 });
    expect((await lg.myTripsScreen(await actorOf(ids.driver)))!.pendingReports).toEqual([]);

    expect(await lg.followupScreen(await actorOf(ids.driver))).toBeNull();
    const screen = (await lg.followupScreen(await actorOf(ids.finance)))!;
    expect(screen.fuel.map((r) => [r.tripId, r.fuelEstimate, r.driver])).toEqual([[tripId, 150_000, 'Dedi']]);
    expect(screen.condition.map((r) => r.conditionNote)).toEqual(['Rem belakang bunyi']);
    expect(await lg.followupAttention(await actorOf(ids.kg))).toEqual({ fuel: 1, condition: 1, decide: 1 });
    expect(await lg.followupAttention(await actorOf(ids.finance))).toEqual({ fuel: 1, condition: 1, decide: 0 });
    const reportId = screen.fuel[0].id;
    // LT5a (spec LT1 §17.1): Finance isi nominal + foto struk; Kepala Gudang hanya melihat.
    const finance = await actorOf(ids.finance);
    expect(await lg.fillFuelRequest(await actorOf(ids.kg), reportId, 300_000, jpeg())).toMatchObject({ ok: false, status: 403 });
    expect(await lg.fillFuelRequest(finance, reportId, 0, jpeg())).toMatchObject({ ok: false, status: 400 });
    expect(await lg.fillFuelRequest(finance, reportId, 300_000, null)).toMatchObject({ ok: false, status: 400 });
    const filled = await lg.fillFuelRequest(finance, reportId, 300_000, jpeg());
    expect(filled.ok).toBe(true);
    expect(await lg.fillFuelRequest(finance, reportId, 300_000, jpeg())).toMatchObject({ ok: false, status: 409 });
    const expenses = () => sql`select amount, with_request, driver_employee_id from logistics.fuel_expenses order by id`;
    expect((await expenses()).map((r) => [Number(r.amount), r.with_request, Number(r.driver_employee_id)])).toEqual([[300_000, true, ids.driver]]);
    const fillId = filled.ok ? filled.data.id : 0;
    expect(await lg.correctFuel(finance, fillId, { vehicleId: 0, driverId: 0, amount: 310_000, reason: 'x' }, null)).toMatchObject({ ok: false, status: 400 });
    const corrected = await lg.correctFuel(finance, fillId, { vehicleId: 0, driverId: 0, amount: 310_000, reason: 'Salah ketik nominal' }, null);
    expect(corrected.ok).toBe(true);
    expect(await lg.correctFuel(finance, fillId, { vehicleId: 0, driverId: 0, amount: 320_000, reason: 'Salah ketik lagi' }, null)).toMatchObject({ ok: false, status: 409 });
    expect((await expenses()).map((r) => Number(r.amount))).toEqual([310_000]);
    // Batal mengembalikan permintaan ke Menunggu; diisi lagi.
    const correctedId = corrected.ok ? corrected.data.id : 0;
    expect((await lg.voidFuel(finance, correctedId, 'Tercatat dobel')).ok).toBe(true);
    expect(await expenses()).toEqual([]);
    expect((await lg.followupAttention(await actorOf(ids.kg)))?.fuel).toBe(1);
    expect((await lg.fillFuelRequest(finance, reportId, 305_000, jpeg())).ok).toBe(true);
    // Driver lupa minta: Catat bensin tanpa permintaan, driver diberi tahu.
    const [{ vehicle_id: vehicleId }] = await sql`select vehicle_id from logistics.trips where id = ${tripId}`;
    const noReq = { vehicleId: Number(vehicleId), driverId: ids.driver, amount: 100_000, reasonCode: 'FORGOT', reasonText: null };
    expect(await lg.recordFuelWithoutRequest(finance, { ...noReq, reasonCode: null }, jpeg())).toMatchObject({ ok: false, status: 400 });
    expect((await lg.recordFuelWithoutRequest(finance, noReq, jpeg())).ok).toBe(true);
    const [told] = await sql`select title from hris.notifications where kind = 'logistics.fuel_no_request' and recipient_account_id = ${ids.driver + 1000}`;
    expect(told?.title).toMatch(/tanpa permintaan/);
    expect((await expenses()).map((r) => [Number(r.amount), r.with_request])).toEqual([[305_000, true], [100_000, false]]);
    expect(await lg.fuelPeriodSummary('2026-11-05')).toMatchObject({ total: 405_000, count: 2, noRequest: 1 });
    await expect(sql`delete from logistics.fuel_fills`).rejects.toThrow(/tidak boleh dihapus/);

    // Dashboard Logistik (spec LT1 §17.1 butir 7, 8): bagian mengikuti hak.
    expect(await lg.logisticsDashboard(await actorOf(ids.driver))).toBeNull();
    const ownerBoard = (await lg.logisticsDashboard(await actorOf(ids.owner)))!;
    expect(ownerBoard.sections.map((s) => s.key)).toEqual(['RUNNING', 'DELIVERY', 'MONEY', 'FLEET']);
    expect(ownerBoard.sections.find((s) => s.key === 'FLEET')!.rows.find((r) => r.key === 'fuel-period')).toMatchObject({ value: expect.stringContaining('405') });
    expect((await lg.logisticsDashboard(finance))!.sections.map((s) => s.key)).toEqual(['MONEY', 'FLEET']);
    expect((await lg.logisticsDashboard(await actorOf(ids.kg)))!.sections.map((s) => s.key)).toEqual(['RUNNING', 'DELIVERY', 'MONEY', 'FLEET']);

    // Di luar titik (§17.1 butir 9): kunjungan Terkirim yang jauh dari titik toko ditinjau bukan oleh awaknya.
    const [delivered] = await sql`select id from logistics.trip_visits where trip_id = ${tripId} and status = 'DELIVERED' order by id limit 1`;
    await sql`update logistics.trip_visits set distance_m = 900 where id = ${delivered.id}`;
    const kg = await actorOf(ids.kg);
    expect(await lg.outsideScreen(finance, 'WAITING')).toBeNull();
    const waiting = (await lg.outsideScreen(kg, 'WAITING'))!;
    expect(waiting.rows.map((r) => [r.kind, r.id, r.distanceM, r.canReview])).toEqual([['TRUCK', Number(delivered.id), 900, true]]);
    expect(await lg.reviewOutside(kg, 'TRUCK', Number(delivered.id), 'NOT_OK', 'abc')).toMatchObject({ ok: false, status: 400 });
    expect((await lg.reviewOutside(kg, 'TRUCK', Number(delivered.id), 'NOT_OK', 'Jauh dari toko tanpa alasan')).ok).toBe(true);
    expect(await lg.reviewOutside(await actorOf(ids.owner), 'TRUCK', Number(delivered.id), 'OK', null)).toMatchObject({ ok: false, status: 409 });
    expect((await lg.outsideScreen(kg, 'WAITING'))!.rows).toEqual([]);
    expect((await lg.outsideScreen(kg, 'DONE'))!.rows.map((r) => r.verdict)).toEqual(['NOT_OK']);
    const [warned] = await sql`select title from hris.notifications where kind = 'logistics.outside_point' and recipient_account_id = ${ids.driver + 1000}`;
    expect(warned?.title).toMatch(/Tidak wajar/);
    expect((await lg.closeCondition(await actorOf(ids.kg), reportId, 'Sudah diservis')).ok).toBe(true);
    expect(await lg.followupAttention(await actorOf(ids.kg))).toEqual({ fuel: 0, condition: 0, decide: 1 });
    const detail = (await lg.tripDetailScreen(await actorOf(ids.kg), tripId))!;
    expect(detail.endReport).toMatchObject({ by: 'Dedi', conditionLabel: 'Perlu perhatian', fuel: 150_000 });
    expect(detail.fuelGaugePhotoUrl).toBeTruthy();
    await expect(sql`delete from logistics.trip_end_reports`).rejects.toThrow(/tidak boleh dihapus/);
  });

  it('Perlu keputusan: Batal (alasan wajib) → Buka lagi hanya Pemilik/GM → Kirim ulang ke antrean', async () => {
    const [{ id }] = await sql`select id from logistics.delivery_notes where number = 'IBT-A'`;
    const noteId = Number(id);
    const kg = await actorOf(ids.kg);
    expect(await lg.decideNote(await actorOf(ids.finance), noteId, 'RESEND', '')).toMatchObject({ ok: false, status: 403 });
    expect(await lg.decideNote(kg, noteId, 'DROP', '')).toMatchObject({ ok: false, status: 400 });
    expect((await lg.decideNote(kg, noteId, 'DROP', REASON)).ok).toBe(true);
    expect(await tabs()).toMatchObject({ NEEDS_DECISION: 0, DROPPED: 1 });
    const dropped = (await lg.deliveryNotesScreen(await actorOf(ids.owner), { tab: 'DROPPED', originId: null, routeId: null, q: '' }))!;
    expect(dropped.rows.map((r) => [r.number, r.event?.reason, r.canReopen])).toEqual([['IBT-A', REASON, true]]);
    expect((await lg.deliveryNotesScreen(kg, { tab: 'DROPPED', originId: null, routeId: null, q: '' }))!.rows[0].canReopen).toBe(false);
    expect(await lg.reopenNote(kg, noteId)).toMatchObject({ ok: false, status: 403 });
    expect((await lg.reopenNote(await actorOf(ids.owner), noteId)).ok).toBe(true);
    expect((await lg.decideNote(kg, noteId, 'RESEND', '')).ok).toBe(true);
    expect(await noteStatus('IBT-A')).toMatchObject({ status: 'WAITING', tomorrow_count: 1 });
    expect(await tabs()).toMatchObject({ WAITING: 2, NEEDS_DECISION: 0, DROPPED: 0 });
  });
});
