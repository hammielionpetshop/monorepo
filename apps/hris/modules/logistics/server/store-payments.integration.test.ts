import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// LT1b-3 uang dan laporan di toko (spec LT1 §13.5) + LT2b potong nota, koreksi cara bayar, janji bayar (§14.2) pada DB sintetis dengan stub kasir. Jalan bila ROLES_TEST_ADMIN_URL diisi.
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
  const deliver = async (destination: string, payment: { method?: string; partialAmount?: number; promiseDate?: string } | null, proof: File | null = null) =>
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
    // Janji bayar sisa wajib untuk Bayar sebagian / Tempo, besok s.d. 60 hari (§14.2 butir 5).
    expect(await deliver('Toko Maju', { method: 'PARTIAL', partialAmount: 50000 })).toMatchObject({ ok: false, error: 'Isi tanggal janji bayar sisa.' });
    expect(await deliver('Toko Maju', { method: 'PARTIAL', partialAmount: 50000, promiseDate: DAY })).toMatchObject({ ok: false, status: 400 });
    expect(await deliver('Toko Maju', { method: 'PARTIAL', partialAmount: 50000, promiseDate: '2027-01-06' })).toMatchObject({ ok: false, status: 400 });
    expect((await deliver('Toko Maju', { method: 'PARTIAL', partialAmount: 50000, promiseDate: '2026-11-13' })).ok).toBe(true);
    expect((await deliver('Toko Depan', { method: 'TEMPO', promiseDate: '2026-11-20' })).ok).toBe(true);
    expect((await deliver('Toko Lunas', { method: 'CASH' })).ok).toBe(true);
    const rows = await sql`select v.destination_name, p.method, p.bill_amount, p.received_amount, p.promise_date::text as promise from logistics.visit_payments p
      join logistics.trip_visits v on v.id = p.visit_id order by p.id`;
    expect(rows.map((r) => [r.destination_name, r.method, r.bill_amount, r.received_amount, r.promise])).toEqual([
      ['Toko Sinar', 'TRANSFER', 150000, 150000, null], ['Toko Maju', 'PARTIAL', 200000, 50000, '2026-11-13'], ['Toko Depan', 'TEMPO', 100000, 0, '2026-11-20'],
      ['Toko Lunas', 'NONE', 0, 0, null],
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
    expect(screen.rows.find((r) => r.store === 'Toko Maju')).toMatchObject({ promiseDate: '2026-11-13', overdue: false });
    expect(screen.canCorrect).toBe(false);
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
    // Harga beda (§14.2 butir 2) wajib catatan harga yang diminta toko.
    expect(await lg.addVisitReport(kenek, tripId, maju.id, { kind: 'PRICE' }, jpeg())).toMatchObject({ ok: false, status: 400 });
    expect(await lg.openReportCount(await actorOf(ids.kg))).toBe(0);
    expect(await lg.openReportCount(await actorOf(ids.finance))).toBe(2);
  });

  it('keputusan potong nota oleh Finance → Perlu dicatat di kasir → Sudah dicatat mengunci (§14.2 butir 1, 3)', async () => {
    const finance = await actorOf(ids.finance);
    const screen = (await lg.visitReportsScreen(finance))!;
    expect(screen.canDecide).toBe(true);
    const [damaged, ret] = screen.open;
    expect(damaged.noteOptions).toEqual([{ id: expect.any(Number), number: 'TRX-C', amount: 300000, otherCuts: 0 }]);
    const noteId = damaged.noteOptions[0].id;
    expect(await lg.decideVisitReport(await actorOf(ids.kg), damaged.id, { decision: 'NO_CUT', note: 'tidak apa' })).toMatchObject({ ok: false, status: 403 });
    expect(await lg.decideVisitReport(finance, damaged.id, { decision: 'CUT', noteId, amount: 400000, reason: 'DAMAGED' })).toMatchObject({ ok: false, status: 400 });
    expect(await lg.decideVisitReport(finance, damaged.id, { decision: 'RETURN_BO', noteId })).toMatchObject({ ok: false, status: 400 });
    expect((await lg.decideVisitReport(finance, damaged.id, { decision: 'CUT', noteId, amount: 20000, reason: 'DAMAGED', note: '2 sak' })).ok).toBe(true);
    // Ubah keputusan wajib alasan; potongan lain di nota yang sama ikut membatasi nominal.
    expect(await lg.decideVisitReport(finance, damaged.id, { decision: 'CUT', noteId, amount: 25000, reason: 'DAMAGED' })).toMatchObject({ ok: false, status: 400 });
    expect((await lg.decideVisitReport(finance, damaged.id, { decision: 'CUT', noteId, amount: 25000, reason: 'DAMAGED', changeReason: 'salah ketik nominal' })).ok).toBe(true);
    expect(await lg.decideVisitReport(finance, ret.id, { decision: 'CUT', noteId, amount: 280000, reason: 'OTHER', note: 'retur penuh' }))
      .toMatchObject({ ok: false, error: expect.stringContaining('melebihi nota') });
    expect((await lg.decideVisitReport(finance, ret.id, { decision: 'RETURN_BO', noteId })).ok).toBe(true);

    const after = (await lg.visitReportsScreen(finance))!;
    expect(after.open).toHaveLength(0);
    expect(after.closed.find((r) => r.id === damaged.id)).toMatchObject({
      closeNote: 'Potong nota TRX-C Rp25.000 (Barang rusak)', decision: { decision: 'CUT', amount: 25000, changes: 1, recorded: null },
    });
    expect(await lg.toRecordScreen(await actorOf(ids.kg))).toBeNull();
    const list = (await lg.toRecordScreen(finance))!;
    expect(list.waiting.map((r) => [r.label, r.noteNumber, r.amount])).toEqual([['Potong nota', 'TRX-C', 25000], ['Dicatat lewat Retur BO', 'TRX-C', null]]);
    expect(await lg.unrecordedCounts(finance)).toEqual({ waiting: 2, red: 0 });
    const cut = list.waiting[0];
    expect(await lg.markDecisionRecorded(finance, cut.id, 'x')).toMatchObject({ ok: false, status: 400 });
    expect((await lg.markDecisionRecorded(finance, cut.id, 'Nota TRX-C dikurangi')).ok).toBe(true);
    expect(await lg.markDecisionRecorded(finance, cut.id, 'Nota TRX-C dikurangi')).toMatchObject({ ok: false, status: 409 });
    expect(await lg.decideVisitReport(finance, damaged.id, { decision: 'NO_CUT', note: 'batal potong', changeReason: 'salah putus' }))
      .toMatchObject({ ok: false, status: 409 });
    expect(await lg.unrecordedCounts(finance)).toEqual({ waiting: 1, red: 0 });
    expect((await lg.toRecordScreen(finance))!.done[0]).toMatchObject({ recorded: { ref: 'Nota TRX-C dikurangi' } });
    await expect(sql`delete from logistics.report_decisions`).rejects.toThrow();
  });

  it('koreksi cara bayar oleh awak selama trip berjalan; baris lama Diganti; Finance diberi tahu (§14.2 butir 4)', async () => {
    const depan = await visitOf('Toko Depan');
    const kenek = await actorOf(ids.kenek);
    expect(await lg.correctPayment(await actorOf(ids.finance), depan.id, { method: 'CASH', reason: 'salah tekan' }, null)).toMatchObject({ ok: false, status: 403 });
    expect(await lg.correctPayment(kenek, depan.id, { method: 'CASH', reason: 'x' }, null)).toMatchObject({ ok: false, status: 400 });
    expect(await lg.correctPayment(kenek, depan.id, { method: 'TEMPO', promiseDate: '2026-11-20', reason: 'salah tekan' }, null))
      .toMatchObject({ ok: false, error: 'Tidak ada yang berubah.' });
    expect(await lg.correctPayment(kenek, depan.id, { method: 'TRANSFER', reason: 'salah tekan' }, null)).toMatchObject({ ok: false, error: 'Foto bukti transfer wajib.' });
    expect((await lg.correctPayment(kenek, depan.id, { method: 'CASH', reason: 'salah tekan, bayar cash' }, null)).ok).toBe(true);
    expect((await visitOf('Toko Depan')).payment).toMatchObject({ method: 'CASH', received: 100000, promiseDate: null, correctionReason: 'salah tekan, bayar cash' });
    const screen = (await lg.storePaymentsScreen(await actorOf(ids.finance), DAY))!;
    expect(screen.totals).toEqual({ cash: 150000, transfer: 150000, left: 150000, visits: 4 });
    const [told] = await sql`select title from hris.notifications where kind = 'logistics.payment_corrected' and recipient_account_id = ${ids.finance + 1000}`;
    expect(told.title).toBe('Cara bayar Toko Depan dikoreksi (trip TR-261106-1)');
    expect((await sql`select count(*)::int as n from logistics.visit_payments where replaced_at is not null`)[0].n).toBe(1);
  });

  it('laporan hanya sesudah Terkirim dan selama trip Berjalan', async () => {
    const lunas = await visitOf('Toko Lunas');
    const driver = await actorOf(ids.driver);
    expect((await lg.headHome(driver, tripId, jpeg(), null)).ok).toBe(true);
    expect(await lg.addVisitReport(driver, tripId, lunas.id, { kind: 'SHORT' }, jpeg())).toMatchObject({ ok: false, status: 409 });
    // Sesudah Menuju Garasi awak tidak bisa mengoreksi; Kepala Gudang bisa (§14.2 butir 4).
    const depan = await visitOf('Toko Depan');
    expect(await lg.correctPayment(driver, depan.id, { method: 'TEMPO', promiseDate: '2026-11-20', reason: 'salah tekan' }, null)).toMatchObject({ ok: false, status: 403 });
    expect((await lg.correctPayment(await actorOf(ids.kg), depan.id, { method: 'PARTIAL', partialAmount: 60000, promiseDate: '2026-11-13', reason: 'toko hanya bayar 60rb' }, null)).ok).toBe(true);
    expect((await visitOf('Toko Depan')).payment).toMatchObject({ method: 'PARTIAL', received: 60000, left: 40000, promiseDate: '2026-11-13' });
    // Lewat janji: tanggal lewat dan piutang kasir nota kunjungan masih ada (§14.2 butir 5).
    vi.setSystemTime(new Date('2026-11-14T08:00:00+07:00'));
    const late = (await lg.storePaymentsScreen(await actorOf(ids.finance), DAY))!;
    expect(late.rows.filter((r) => r.overdue).map((r) => r.store).sort()).toEqual(['Toko Depan', 'Toko Maju']);
  });
});
