import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// LT4a Terima Uang (spec LT1 §16.1) pada DB sintetis dengan stub kasir. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_lt4a_svc_${process.pid}_${Date.now()}`;
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

describe.skipIf(!ADMIN_URL)('LT4a: Terima Uang', () => {
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
    pos.a = await sale('TRX-A', pos.sinar, 150000);
    pos.b = await sale('TRX-B', pos.sinar, 100000);
    pos.c = await sale('TRX-C', pos.maju, 200000);
    pos.d = await sale('TRX-D', pos.depan, 100000);
    pos.e = await sale('TRX-E', pos.lunas, 0, 'PAID');
    const notes = [pos.a, pos.b, pos.c, pos.d, pos.e];

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
  const screen = async (tab: 'WAITING' | 'DONE' | 'DIFF', employeeId = ids.finance) => (await lg.moneyCheckScreen(await actorOf(employeeId), tab))!;
  const payment = async (store: string, tab: 'WAITING' | 'DONE' = 'WAITING') =>
    (await screen(tab)).trips.flatMap((t) => t.payments).find((p) => p.store === store)!;
  const check = async (employeeId: number, store: string, lines: { transactionId: number; reported: number; actual: number; note?: string }[]) => {
    const p = await payment(store);
    return lg.saveMoneyCheck(await actorOf(employeeId), { source: 'TRUCK', paymentId: p.paymentId, lines });
  };

  it('Terkirim menyimpan tagihan per nota; daftar baru muncul sesudah Menuju Garasi', async () => {
    expect((await deliver('Toko Sinar', { method: 'PARTIAL', partialAmount: 120000, promiseDate: '2026-11-13' })).ok).toBe(true);
    expect((await deliver('Toko Maju', { method: 'CASH' })).ok).toBe(true);
    expect((await deliver('Toko Depan', { method: 'TRANSFER' }, jpeg())).ok).toBe(true);
    expect((await deliver('Toko Lunas', { method: 'CASH' })).ok).toBe(true);
    const bills = await sql`select n.number, b.bill_amount from logistics.visit_note_bills b join logistics.delivery_notes n on n.id = b.note_id order by n.number`;
    expect(bills.map((b) => [b.number, b.bill_amount])).toEqual([['TRX-A', 150000], ['TRX-B', 100000], ['TRX-C', 200000], ['TRX-D', 100000]]);
    // Trip masih berjalan: awak masih boleh mengoreksi, belum diperiksa.
    expect((await screen('WAITING')).trips).toHaveLength(0);
    expect((await lg.headHome(await actorOf(ids.driver), tripId, jpeg(), null)).ok).toBe(true);
    const waiting = await screen('WAITING');
    expect(waiting.canCheck).toBe(true);
    expect(waiting.trips[0].payments.map((p) => [p.store, p.kind, p.received])).toEqual([
      ['Toko Sinar', 'CASH', 120000], ['Toko Maju', 'CASH', 200000], ['Toko Depan', 'TRANSFER', 100000],
    ]);
    const sinar = await payment('Toko Sinar');
    expect(sinar).toMatchObject({ splitEditable: true, carrier: 'Dedi', crew: 'Dedi, Eko' });
    expect(sinar.notes.map((n) => [n.number, n.bill, n.suggested])).toEqual([['TRX-A', 150000, 120000], ['TRX-B', 100000, 0]]);
    expect((await payment('Toko Maju')).notes.map((n) => n.suggested)).toEqual([200000]);
  });

  it('hak periksa, pembagian per nota wajib sama dengan laporan, Tidak cocok wajib catatan', async () => {
    expect(await check(ids.kg, 'Toko Sinar', [])).toMatchObject({ ok: false, status: 403 });
    expect((await screen('WAITING', ids.kg)).canCheck).toBe(false);
    expect(await lg.moneyCheckScreen(await actorOf(ids.driver), 'WAITING')).toBeNull();
    expect(await check(ids.finance, 'Toko Sinar', [{ transactionId: pos.a, reported: 120000, actual: 120000 }])).toMatchObject({ ok: false, status: 400 });
    expect(await check(ids.finance, 'Toko Sinar', [
      { transactionId: pos.a, reported: 70000, actual: 70000 }, { transactionId: pos.b, reported: 40000, actual: 40000 },
    ])).toMatchObject({ ok: false, status: 400 });
    expect(await check(ids.finance, 'Toko Sinar', [
      { transactionId: pos.a, reported: 10000, actual: 10000 }, { transactionId: pos.b, reported: 110000, actual: 110000 },
    ])).toMatchObject({ ok: false, error: expect.stringContaining('melebihi tagihannya') });
    expect((await check(ids.finance, 'Toko Sinar', [
      { transactionId: pos.a, reported: 70000, actual: 70000 }, { transactionId: pos.b, reported: 50000, actual: 50000 },
    ])).ok).toBe(true);
    expect(await check(ids.finance, 'Toko Maju', [{ transactionId: pos.c, reported: 200000, actual: 180000 }])).toMatchObject({ ok: false, status: 400 });
    expect((await check(ids.finance, 'Toko Maju', [{ transactionId: pos.c, reported: 200000, actual: 180000, note: 'ikatan kurang 20 ribu' }])).ok).toBe(true);
    expect((await check(ids.finance, 'Toko Depan', [{ transactionId: pos.d, reported: 100000, actual: 0, note: 'belum masuk mutasi' }])).ok).toBe(true);
    const rows = await sql`select note_number, kind, reported_amount, actual_amount, pos_expected_amount, responsible_employee_id from logistics.money_checks order by id`;
    expect(rows.map((r) => [r.note_number, r.kind, r.reported_amount, r.actual_amount, r.pos_expected_amount, r.responsible_employee_id])).toEqual([
      ['TRX-A', 'CASH', 70000, 70000, 70000, null], ['TRX-B', 'CASH', 50000, 50000, 50000, null],
      // Kurang serah tunai atas nama driver; piutang toko tetap dilunasi sesuai laporan driver.
      ['TRX-C', 'CASH', 200000, 180000, 200000, ids.driver],
      // Transfer kurang bukan tanggung jawab driver; yang dilunasi di POS = yang masuk.
      ['TRX-D', 'TRANSFER', 100000, 0, 0, null],
    ]);
    const [told] = await sql`select title, link from hris.notifications where kind = 'logistics.cash_short' and recipient_account_id = ${ids.driver + 1000}`;
    expect(told).toMatchObject({ title: expect.stringMatching(/^Kurang serah Rp\s?20\.000: Toko Maju \(TR-261106-1\)$/), link: '/logistik/terima-uang?tab=DIFF' });
    expect((await screen('WAITING')).trips).toHaveLength(0);
    await expect(sql`delete from logistics.money_checks`).rejects.toThrow();
  });

  it('tanda pelunasan POS dibaca dari piutang kasir; tab Selisih', async () => {
    const before = await payment('Toko Sinar', 'DONE');
    expect(before.notes.map((n) => n.pos?.status)).toEqual(['WAITING', 'WAITING']);
    // Finance melunasi di BO (Bayar per nota): A penuh 70 rb, B baru 30 rb dari 50 rb.
    await sql`update petshop.customer_debts set remaining_amount = 80000 where transaction_id = ${pos.a}`;
    await sql`update petshop.customer_debts set remaining_amount = 70000 where transaction_id = ${pos.b}`;
    await sql`update petshop.customer_debts set status = 'VOIDED' where transaction_id = ${pos.c}`;
    const sinar = await payment('Toko Sinar', 'DONE');
    expect(sinar.notes.map((n) => [n.number, n.pos?.status, n.pos?.paid])).toEqual([['TRX-A', 'OK', 70000], ['TRX-B', 'PARTLY', 30000]]);
    expect(sinar.checked).toMatchObject({ on: '2026-11-06', canVoid: true });
    expect((await payment('Toko Maju', 'DONE')).notes[0].pos?.status).toBe('GONE');
    expect((await payment('Toko Depan', 'DONE')).notes[0].pos?.status).toBe('NONE');
    const diff = await screen('DIFF');
    expect(diff.diffs.map((d) => [d.number, d.label, d.difference, d.person])).toEqual([
      ['TRX-D', 'Transfer kurang (tetap piutang toko)', -100000, null], ['TRX-C', 'Kurang serah', -20000, 'Dedi'],
    ]);
  });

  it('cara bayar yang sudah diperiksa terkunci; batal pemeriksaan membukanya lagi', async () => {
    const kg = await actorOf(ids.kg);
    const maju = await payment('Toko Maju', 'DONE');
    const visitId = (await visitOf('Toko Maju')).id;
    expect(await lg.correctPayment(kg, visitId, { method: 'TRANSFER', reason: 'salah tekan' }, jpeg())).toMatchObject({ ok: false, status: 409 });
    expect(await lg.voidMoneyCheck(kg, { source: 'TRUCK', paymentId: maju.paymentId, reason: 'salah periksa' })).toMatchObject({ ok: false, status: 403 });
    const finance = await actorOf(ids.finance);
    expect(await lg.voidMoneyCheck(finance, { source: 'TRUCK', paymentId: maju.paymentId, reason: 'x' })).toMatchObject({ ok: false, status: 400 });
    expect((await lg.voidMoneyCheck(finance, { source: 'TRUCK', paymentId: maju.paymentId, reason: 'ikatan uang ternyata lengkap' })).ok).toBe(true);
    const [voided] = await sql`select voided_at, void_reason from logistics.money_checks where note_number = 'TRX-C'`;
    expect(voided.void_reason).toBe('ikatan uang ternyata lengkap');
    expect((await lg.correctPayment(kg, visitId, { method: 'TRANSFER', reason: 'salah tekan' }, jpeg())).ok).toBe(true);
    const again = await payment('Toko Maju');
    expect(again).toMatchObject({ kind: 'TRANSFER', received: 200000 });
    expect(await lg.saveMoneyCheck(finance, { source: 'TRUCK', paymentId: maju.paymentId, lines: [{ transactionId: pos.c, reported: 200000, actual: 200000 }] }))
      .toMatchObject({ ok: false, status: 404 });
    expect((await lg.saveMoneyCheck(finance, { source: 'TRUCK', paymentId: again.paymentId, lines: [{ transactionId: pos.c, reported: 200000, actual: 200000 }] })).ok).toBe(true);
    expect(await lg.moneyCheckAttention(finance)).toEqual({ waiting: 0, red: 0, posRed: 0 });
    expect(await lg.moneyCheckAttention(kg)).toEqual({ waiting: 0, red: 0, posRed: 0 });
  });
});
