import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// LT3b Antar sendiri (spec LT1 §15.2) pada DB sintetis dengan stub kasir. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_lt3b_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const DAY = '2026-11-06';
const at = (clock: string, day = DAY) => new Date(`${day}T${clock}:00+07:00`);
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], 'foto.jpg', { type: 'image/jpeg' });

let admin: postgres.Sql;
let sql: postgres.Sql;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'kasir' | 'pramu' | 'kt' | 'gk', number>;
let lg: typeof import('@/modules/logistics');
const pos: Record<string, number> = {};
let tpBranch = 0;
let tripId = 0;

describe.skipIf(!ADMIN_URL)('LT3b: Antar sendiri', () => {
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
      kt: await person('Kepala Pusat', 'Kepala Toko', tpBranch), gk: await person('Kasir Gudang', 'Kasir', gudang),
    };
    // Pengantar kasir: "Budi" = Kasir Pusat; "Lama" belum dipasangkan.
    const [budi] = await sql`insert into petshop.groomers (name, is_groomer, is_courier) values ('Budi', false, true) returning id`;
    const [lama] = await sql`insert into petshop.groomers (name, is_groomer, is_courier) values ('Lama', false, true) returning id`;
    await sql`insert into hris.pos_groomer_links (pos_groomer_id, employee_id, created_by_account_id) values (${budi.id}, ${ids.kasir}, 1)`;
    const customer = async (name: string) => Number((await sql`insert into petshop.customers (code, name, address) values (${name.slice(-3)}, ${name}, 'Jl. Uji') returning id`)[0].id);
    pos.sinar = await customer('Toko Sinar');
    pos.maju = await customer('Toko Maju');
    const sale = async (number: string, customerId: number | null, courier: number, opts: { status?: string; method?: string; at?: string } = {}) => {
      const [row] = await sql`insert into petshop.transactions (trx_number, payable_amount, created_at, branch_id, customer_id, status, revision, delivery_method)
        values (${number}, 150000, ${opts.at ?? '2026-11-06 01:00:00'}::text::timestamp, 2, ${customerId}, ${opts.status ?? 'COMPLETED'}, 1, ${opts.method ?? 'BRANCH_COURIER'}) returning id`;
      const [item] = await sql`insert into petshop.transaction_items (transaction_id, product_name, total_price) values (${row.id}, 'Ongkos Kirim', 10000) returning id`;
      await sql`insert into petshop.service_deliveries (branch_id, transaction_id, transaction_item_id, courier_id) values (2, ${row.id}, ${item.id}, ${courier})`;
      return Number(row.id);
    };
    pos.a = await sale('TRX-A', pos.sinar, Number(budi.id));
    pos.b = await sale('TRX-B', pos.maju, Number(budi.id));
    pos.umum = await sale('TRX-UMUM', null, Number(lama.id));
    pos.void = await sale('TRX-VOID', pos.sinar, Number(budi.id), { status: 'VOIDED' });
    pos.truck = await sale('TRX-TRUK', pos.sinar, Number(budi.id), { method: 'TRUCK' });
    pos.old = await sale('TRX-OLD', pos.sinar, Number(budi.id), { at: '2026-11-03 01:00:00' });
    // Piutang kasir TRX-A (tempo di kasir): tagihan saat Terkirim.
    await sql`insert into petshop.customer_debts (customer_id, transaction_id, total_amount, remaining_amount) values (${pos.sinar}, ${pos.a}, 150000, 150000)`;

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

  it('tugas antar: nota kurir cabang sejak tanggal mulai, tanpa batal / truk; milik saya dipisah', async () => {
    const screen = await lg.selfDeliveryScreen(await actorOf(ids.kasir));
    expect(screen!.tasks.mine.map((t) => t.trxNumber)).toEqual(['TRX-A', 'TRX-B']);
    expect(screen!.tasks.others.map((t) => t.trxNumber)).toEqual(['TRX-UMUM']);
    expect(screen!.tasks.others[0]).toMatchObject({ destination: 'Umum (TRX-UMUM)', courier: 'Lama (belum dipasangkan)' });
    expect(await lg.selfDeliveryScreen(await actorOf(ids.gk))).toMatchObject({ tasks: { mine: [], others: [] } });
  });

  it('Mulai antar butuh absen masuk; satu perjalanan berjalan per orang; satu nota satu tujuan', async () => {
    const kasir = await actorOf(ids.kasir);
    expect(await lg.startSelfTrip(kasir, { transactionIds: [pos.a, pos.b, pos.umum] }, jpeg())).toMatchObject({ ok: false, status: 409 });
    await clockIn(ids.kasir);
    expect(await lg.startSelfTrip(kasir, { transactionIds: [pos.void] }, jpeg())).toMatchObject({ ok: false, status: 409 });
    const made = await lg.startSelfTrip(kasir, { transactionIds: [pos.a, pos.b, pos.umum] }, jpeg());
    expect(made.ok).toBe(true);
    tripId = made.ok ? made.data.id : 0;
    const stops = await sql`select trx_number, courier_mismatch from logistics.self_trip_stops where trip_id = ${tripId} order by id`;
    expect(stops.map((s) => [s.trx_number, s.courier_mismatch])).toEqual([['TRX-A', false], ['TRX-B', false], ['TRX-UMUM', true]]);
    expect(await lg.startSelfTrip(kasir, { transactionIds: [pos.old] }, jpeg())).toMatchObject({ ok: false });
    await clockIn(ids.pramu);
    expect(await lg.startSelfTrip(await actorOf(ids.pramu), { transactionIds: [pos.a] }, jpeg())).toMatchObject({ ok: false, status: 409 });
    expect(await lg.runningSelfTripNumber(ids.kasir)).toMatch(/^AS-261106-1$/);
  });

  it('Foto 2: tiap tahap ≥ 2 menit; Terkirim mencatat cara bayar dari sisa piutang kasir', async () => {
    const kasir = await actorOf(ids.kasir);
    const stops = await sql`select id, trx_number from logistics.self_trip_stops where trip_id = ${tripId} order by id`;
    const stopOf = (n: string) => Number(stops.find((s) => s.trx_number === n)!.id);
    vi.setSystemTime(at('09:01'));
    expect(await lg.selfStopOutcome(kasir, tripId, stopOf('TRX-A'), { outcome: 'DELIVERED', payment: { method: 'CASH' } }, jpeg(), null))
      .toMatchObject({ ok: false, status: 409 });
    vi.setSystemTime(at('09:10'));
    expect(await lg.selfStopOutcome(await actorOf(ids.pramu), tripId, stopOf('TRX-A'), { outcome: 'DELIVERED' }, jpeg(), null)).toMatchObject({ ok: false, status: 404 });
    expect(await lg.selfStopOutcome(kasir, tripId, stopOf('TRX-A'), { outcome: 'DELIVERED', payment: { method: 'PARTIAL', partialAmount: 50000, promiseDate: '2026-11-10' } }, jpeg(), null))
      .toMatchObject({ ok: true });
    const [pay] = await sql`select method, bill_amount, received_amount from logistics.self_trip_payments where stop_id = ${stopOf('TRX-A')}`;
    expect(pay).toMatchObject({ method: 'PARTIAL', bill_amount: 150000, received_amount: 50000 });
    // Nota Umum / lunas di kasir: tanpa tagihan.
    vi.setSystemTime(at('09:15'));
    expect((await lg.selfStopOutcome(kasir, tripId, stopOf('TRX-UMUM'), { outcome: 'DELIVERED' }, jpeg(), null)).ok).toBe(true);
    const [none] = await sql`select method from logistics.self_trip_payments where stop_id = ${stopOf('TRX-UMUM')}`;
    expect(none.method).toBe('NONE');
    vi.setSystemTime(at('09:20'));
    expect(await lg.selfStopOutcome(kasir, tripId, stopOf('TRX-B'), { outcome: 'TOMORROW', reasonCode: 'CLOSED' }, jpeg(), null)).toMatchObject({ ok: true });
    const screen = await lg.selfDeliveryScreen(await actorOf(ids.pramu));
    expect(screen!.tasks.others.map((t) => t.trxNumber)).toEqual(['TRX-B']);
  });

  it('Foto 3: selisih lama ≥ 20 menit wajib alasan; tunai diterima rekan cabang, bukan PJ', async () => {
    const kasir = await actorOf(ids.kasir);
    // Berangkat 10 menit (09.00 → 09.10), kembali 09.20 → 10.00 = 40 menit: selisih 30.
    vi.setSystemTime(at('10:00'));
    expect(await lg.finishSelfTrip(kasir, tripId, {}, jpeg())).toMatchObject({ ok: false, status: 400 });
    const done = await lg.finishSelfTrip(kasir, tripId, { gapReason: 'TRAFFIC' }, jpeg());
    expect(done).toMatchObject({ ok: true, data: { cash: 50000 } });
    const [trip] = await sql`select status, gap_reason, gap_minutes, cash_amount from logistics.self_trips where id = ${tripId}`;
    expect(trip).toMatchObject({ status: 'DONE', gap_reason: 'Macet', gap_minutes: 30, cash_amount: 50000 });
    expect(await lg.runningSelfTripNumber(ids.kasir)).toBeNull();
    expect(await lg.receiveSelfCash(kasir, tripId)).toMatchObject({ ok: false, status: 403 });
    expect(await lg.receiveSelfCash(await actorOf(ids.pramu), tripId)).toMatchObject({ ok: false, status: 403 });
    expect(await lg.selfCashWaitingCount(await actorOf(ids.kt))).toBe(1);
    expect((await lg.receiveSelfCash(await actorOf(ids.kt), tripId)).ok).toBe(true);
    expect(await lg.receiveSelfCash(await actorOf(ids.kt), tripId)).toMatchObject({ ok: false, status: 409 });
  });

  it('tanda ⚠ bonus ongkir: belum Foto 3 sesudah 23.59 hari berikutnya', async () => {
    const deliveries = await sql`select d.id, t.trx_number from petshop.service_deliveries d join petshop.transactions t on t.id = d.transaction_id`;
    const idOf = (n: string) => Number(deliveries.find((d) => d.trx_number === n)!.id);
    const list = [idOf('TRX-A'), idOf('TRX-B'), idOf('TRX-OLD')];
    expect([...(await lg.selfDeliveryPhotoGaps(list, at('23:00')))]).toEqual([]);
    // Lewat 23.59 tanggal 7: TRX-B (Kirim Besok, belum terkirim) ditandai; TRX-A sudah Foto 3; TRX-OLD sebelum tanggal mulai.
    expect([...(await lg.selfDeliveryPhotoGaps(list, at('00:30', '2026-11-08')))]).toEqual([idOf('TRX-B')]);
  });
});
