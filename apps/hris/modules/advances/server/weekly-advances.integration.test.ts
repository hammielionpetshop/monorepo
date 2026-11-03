import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import type { RequestHandler } from '@/modules/requests';

// L7b-2 Kasbon driver & kenek (spec L7 §3.5 butir Kasbon, §13; DRV-23, 65, 132, 133, 140) pada DB sintetis, tanggal lampau.
// Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l7b2_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const GUDANG = { latitude: -7.350564720030627, longitude: 108.10865608125447 };
const W1 = '2026-10-30';
const W2 = '2026-11-06';
const W3 = '2026-11-13';
const REASON = 'Biaya berobat anak di puskesmas';
const noAnnounce = async () => {};

let admin: postgres.Sql;
let sql: postgres.Sql;
let ids: Record<'owner' | 'fin' | 'driver', number>;
let adv: typeof import('@/modules/advances');
let engine: typeof import('@/modules/requests');
let pr: typeof import('@/modules/payroll');
let handlers: Record<string, RequestHandler>;
let actorOf: (employeeId: number) => Promise<Actor>;
let sourceId: number;
let advanceId: number;
let gudang: number;

describe.skipIf(!ADMIN_URL)('L7b-2: kasbon driver dan kenek', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ now: new Date('2026-11-07T11:00:00+07:00'), toFake: ['Date'] });
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
    for (const folder of [new URL('logistics/src/migrations/', root), new URL('hris-db/src/migrations/', root)]) {
      for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()) {
        if (folder.pathname.includes('hris-db') && file.startsWith('0031')) {
          await sql`insert into hris.branches (name, latitude, longitude) values ('Gudang', ${GUDANG.latitude}, ${GUDANG.longitude})`;
        }
        await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();
      }
    }
    process.env.DATABASE_URL = url.toString();
    process.env.AUTH_COOKIE_ENV = 'staging';
    [{ id: gudang }] = await sql`select id from hris.branches where name = 'Gudang'`;
    const [{ id: pokok }] = await sql`select id from hris.salary_component_types order by sort_order limit 1`;
    const person = async (name: string, position: string, withPackage: boolean) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
        values (hris.next_employee_code(), ${name}, '2026-01-01', 'BCA', '1234567890') returning id`;
      const [p] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${gudang}, ${p.id}, 'EMPLOYEE', '2026-01-01')`;
      if (withPackage) {
        const [pkg] = await sql`insert into hris.salary_changes (employee_id, effective_from, origin, reason, created_by_account_id)
          values (${row.id}, '2026-01-26', 'DIRECT', 'Gaji awal karyawan uji', 1) returning id`;
        await sql`insert into hris.salary_change_lines (change_id, component_type_id, amount) values (${pkg.id}, ${pokok}, 2600000)`;
      }
      return Number(row.id);
    };
    // Driver tanpa paket gaji bulanan: upahnya ritase saja.
    ids = { owner: await person('Elan', 'Pemilik', true), fin: await person('Fani', 'Finance', true), driver: await person('Dedi', 'Driver', false) };
    [{ id: sourceId }] = await sql`select id from hris.payment_sources order by id limit 1`;
    adv = await import('@/modules/advances');
    engine = await import('@/modules/requests');
    pr = await import('@/modules/payroll');
    handlers = { advance: adv.advanceHandler() } as Record<string, RequestHandler>;
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

  const versionOf = async (id: number) => Number((await sql`select version from hris.requests where id = ${id}`)[0].version);
  const viewOf = async (id: number) => (await adv.loadAdvances({ ids: [id] }))[0];
  const schedule = async (id: number) => (await viewOf(id)).installments.filter((i) => i.status === 'SCHEDULED' || i.status === 'WAITING_WEEKLY')
    .map((i) => [i.periodStart, i.amount, i.slipKind]);
  const placeAs = async (employeeId: number, position: string, from: string) => {
    const [p] = await sql`select id from hris.positions where name = ${position}`;
    await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from, reason, created_by_account_id)
      values (${employeeId}, 'POSITION', ${gudang}, ${p.id}, 'EMPLOYEE', ${from}, 'Pindah jabatan uji', 1)`;
  };

  it('pengajuan driver dibuka (tanpa paket gaji bulanan), memakai Dana Kasbon mingguan; cicilan dipasang per minggu upah', async () => {
    const checked = await adv.checkAdvance(ids.driver, 150_000, '2026-11-04');
    expect(checked).toMatchObject({ ok: true, fund: 'WEEKLY' });
    const sub = await engine.submitRequest(await actorOf(ids.driver), 'advance', handlers.advance, { fields: { reason: REASON, amount: 150_000, installments: 3 }, attachmentIds: [] });
    if (!sub.ok) throw new Error(sub.error);
    const decided = await engine.decideRequest(await actorOf(ids.owner), sub.data.id, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(sub.data.id), fields: {} });
    if (!decided.ok) throw new Error(decided.error);
    const [row] = await sql`select id, fund from hris.advances where request_id = ${sub.data.id}`;
    expect(row.fund).toBe('WEEKLY');
    advanceId = Number(row.id);
    const handed = await adv.handOver(await actorOf(ids.fin), advanceId, { sourceId, moneyDate: '2026-11-04', dateReason: 'Uang diberikan dulu karena mendesak' }, noAnnounce);
    if (!handed.ok) throw new Error(handed.error);
    expect(handed.data.message).toMatch(/minggu 30 Oktober 2026/);
    expect(await schedule(advanceId)).toEqual([[W1, 50_000, 'WEEKLY'], [W2, 50_000, 'WEEKLY'], [W3, 50_000, 'WEEKLY']]);
    // Batas orang Rp250.000 tetap berlaku untuk orang Mingguan.
    expect(await adv.checkAdvance(ids.driver, 150_000, '2026-11-04')).toMatchObject({ ok: false, step: 'PERSON' });
  });

  it('DRV-23, 133: slip mingguan memotong satu cicilan; tutup → Terpotong, sisa kasbon berkurang; slip bulanan tidak memuatnya', async () => {
    const [rate] = await sql`select id, vehicle_id, route_id from logistics.trip_rates order by id limit 1`;
    await sql`insert into hris.trip_wage_values (wage_id, employee_id, kind, wage_date, week_start, role, with_assistant, vehicle_id, route_id, rate_id, rate_amount, amount, pay_basis, status)
      values (1, ${ids.driver}, 'RITASE', '2026-10-31', ${W1}, 'DRIVER', false, ${rate.vehicle_id}, ${rate.route_id}, ${rate.id}, 90000, 90000, 'WEEKLY', 'ACTIVE')`;
    const owner = await actorOf(ids.owner);
    const screen = (await pr.periodScreen(owner, `W${W1}`))!;
    expect(screen.rows.find((r) => r.employeeId === ids.driver)).toMatchObject({ net: 40_000, ready: true });
    const closed = await pr.closeSlips(owner, { slipIds: null, periodStart: `W${W1}` }, noAnnounce);
    expect(closed.ok && closed.data.outcomes.map((o) => o.result)).toEqual(['CLOSED']);
    const view = await viewOf(advanceId);
    expect(view.remaining).toBe(100_000);
    expect(view.installments.find((i) => i.periodStart === W1)?.status).toBe('TAKEN');
    expect(await adv.advanceSlipItems(ids.driver, ['2026-10-26'], '2026-10-26', false)).toEqual([]);
    // Minggu kedua tanpa ritase: cicilan tidak tertampung → sisa potongan, dibawa ke slip mingguan berikutnya.
    const second = (await pr.periodScreen(owner, `W${W2}`))!;
    expect(second.rows.find((r) => r.employeeId === ids.driver)).toMatchObject({ net: 0 });
  });

  it('DRV-135: ubah jadwal memilih awal minggu upah; DRV-140 pindah ke Bulanan → cicilan sesudah tanggal pindah ke slip bulanan', async () => {
    const owner = await actorOf(ids.owner);
    const limits = (await adv.manageFormScreen(owner, advanceId))!;
    expect(limits.reschedule).toMatchObject({ weekly: true, total: 100_000 });
    expect(limits.reschedule.starts.map((s) => s.value)).toEqual([W2, W3, '2026-11-20', '2026-11-27']);
    expect(await adv.rescheduleAdvance(owner, advanceId, { count: 2, start: '2026-11-26', reason: 'Minggu depan upah sedikit' })).toMatchObject({ ok: false, status: 400 });
    expect((await adv.rescheduleAdvance(owner, advanceId, { count: 2, start: '2026-11-20', reason: 'Minggu depan upah sedikit' })).ok).toBe(true);
    expect(await schedule(advanceId)).toEqual([['2026-11-20', 50_000, 'WEEKLY'], ['2026-11-27', 50_000, 'WEEKLY']]);
    // Jadi Kasir mulai 26 Nov: minggu 20–26 Nov berakhir pada tanggal pindah → ikut dipasang ulang; banyak dan nominal tetap.
    await placeAs(ids.driver, 'Kasir', '2026-11-26');
    expect(await adv.syncMainSlip(ids.driver)).toBe(2);
    expect(await schedule(advanceId)).toEqual([['2026-11-26', 50_000, 'MONTHLY'], ['2026-12-26', 50_000, 'MONTHLY']]);
    expect(await adv.syncMainSlip(ids.driver)).toBe(0);
    const [cause] = await sql`select distinct cause from hris.advance_installments where advance_id = ${advanceId} and status = 'SCHEDULED'`;
    expect(cause.cause).toBe('MAIN_SLIP');
  });

  it('"Menunggu slip mingguan" dari L5b dipasang ke minggu upah pertama yang seluruhnya mingguan', async () => {
    await sql`update hris.advance_installments set status = 'WAITING_WEEKLY' where advance_id = ${advanceId} and status = 'SCHEDULED' and period_start = '2026-12-26'`;
    // Masih Kasir: kembali Terjadwal di tempat.
    expect(await adv.syncMainSlip(ids.driver)).toBe(1);
    expect((await viewOf(advanceId)).installments.some((i) => i.status === 'WAITING_WEEKLY')).toBe(false);
    await sql`update hris.advance_installments set status = 'WAITING_WEEKLY' where advance_id = ${advanceId} and status = 'SCHEDULED' and period_start = '2026-12-26'`;
    // Jadi Driver lagi mulai 26 Des (Sabtu): minggu Jumat 25 Des masih bulanan, jadi mulai Jumat 1 Jan 2027.
    await placeAs(ids.driver, 'Driver', '2026-12-26');
    expect(await adv.syncMainSlip(ids.driver)).toBe(1);
    expect(await schedule(advanceId)).toEqual([['2026-11-26', 50_000, 'MONTHLY'], ['2027-01-01', 50_000, 'WEEKLY']]);
  });
});
