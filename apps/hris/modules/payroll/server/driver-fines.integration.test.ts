import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import type { RequestHandler } from '@/modules/requests';

// L7c Denda driver & kenek (spec L7 §3.6, §8) pada DB sintetis, tanggal lampau. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l7c_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const GUDANG = { latitude: -7.350564720030627, longitude: 108.10865608125447 };
const W1 = '2026-10-30';
const W2 = '2026-11-06';
const DESC = 'Tidak foto nota belanja di supplier pagi ini';

let admin: postgres.Sql;
let sql: postgres.Sql;
let owner: Actor;
let kg: Actor;
let ids: Record<'owner' | 'kg' | 'driver' | 'kasir', number>;
let pr: typeof import('@/modules/payroll');
let engine: typeof import('@/modules/requests');
let handlers: Record<string, RequestHandler>;
let kindId: number;
const announce = async () => {};

describe.skipIf(!ADMIN_URL)('L7c: denda driver & kenek', () => {
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
    const [{ id: gudang }] = await sql`select id from hris.branches where name = 'Gudang'`;
    const person = async (name: string, position: string) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on) values (hris.next_employee_code(), ${name}, '2026-01-01') returning id`;
      const [p] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${gudang}, ${p.id}, 'EMPLOYEE', '2026-01-01')`;
      return Number(row.id);
    };
    ids = { owner: await person('Elan', 'Pemilik'), kg: await person('Gani', 'Kepala Gudang'), driver: await person('Dedi', 'Driver'), kasir: await person('Kasir Uji', 'Kasir') };
    [{ id: kindId }] = await sql`select id from hris.driver_fine_kinds where name = 'Tidak taat administrasi'`;
    pr = await import('@/modules/payroll');
    engine = await import('@/modules/requests');
    handlers = { driver_fine: pr.driverFineHandler(announce), deduction_objection: pr.deductionObjectionHandler(announce) } as Record<string, RequestHandler>;
    const { loadActor } = await import('@/modules/access');
    owner = await loadActor(ids.owner + 1000, ids.owner);
    kg = await loadActor(ids.kg + 1000, ids.kg);
    const [rate] = await sql`select id, vehicle_id, route_id from logistics.trip_rates order by id limit 1`;
    await sql`insert into hris.trip_wage_values (wage_id, employee_id, kind, wage_date, week_start, role, with_assistant, vehicle_id, route_id, rate_id, rate_amount, amount, pay_basis, status)
      values (1, ${ids.driver}, 'RITASE', '2026-10-31', ${W1}, 'DRIVER', false, ${rate.vehicle_id}, ${rate.route_id}, ${rate.id}, 90000, 90000, 'WEEKLY', 'ACTIVE')`;
    await pr.runWeeklySkeleton();
  });

  afterAll(async () => {
    vi.useRealTimers();
    delete process.env.AUTH_COOKIE_ENV;
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const fields = (employeeId: number, occurredOn: string) => ({ employeeId, kindId, occurredOn, tripId: null, description: DESC, photoId: null });
  const versionOf = async (id: number) => Number((await sql`select version from hris.requests where id = ${id}`)[0].version);
  const fineOf = async (id: number) => (await sql`select status, amount from hris.driver_fines where id = ${id}`)[0];
  const driverRow = async (week: string) => (await pr.periodScreen(owner, `W${week}`))!.rows.find((r) => r.employeeId === ids.driver)!;

  it('sasaran dan tanggal: hanya orang Mingguan/awak trip, ≤ 7 hari ke belakang, bukan diri sendiri', async () => {
    const kasir = await engine.submitRequest(kg, 'driver_fine', handlers.driver_fine, { fields: fields(ids.kasir, '2026-11-01'), attachmentIds: [] });
    expect(kasir.ok || kasir.error).toMatch(/Mingguan atau awak trip/);
    const old = await engine.submitRequest(kg, 'driver_fine', handlers.driver_fine, { fields: fields(ids.driver, '2026-10-30'), attachmentIds: [] });
    expect(old.ok || old.error).toMatch(/7 hari/);
    const short = await engine.submitRequest(kg, 'driver_fine', handlers.driver_fine, { fields: { ...fields(ids.driver, '2026-11-01'), description: 'pendek' }, attachmentIds: [] });
    expect(short.ok).toBe(false);
    expect((await pr.recordFineDirect(owner, fields(ids.owner, '2026-11-01'), announce)).ok).toBe(false);
  });

  it('usulan Kepala Gudang → disahkan Pemilik → terpotong di slip mingguan → Dana Disiplin', async () => {
    const sent = await engine.submitRequest(kg, 'driver_fine', handlers.driver_fine, { fields: fields(ids.driver, '2026-11-01'), attachmentIds: [] });
    expect(sent.ok).toBe(true);
    const requestId = sent.ok ? sent.data.id : 0;
    const [pending] = await sql`select id, status, amount from hris.driver_fines where request_id = ${requestId}`;
    expect(pending).toMatchObject({ status: 'PENDING', amount: 10_000 });
    // Usulan belum disahkan tidak dipotong dan tidak menahan slip.
    expect(await driverRow(W1)).toMatchObject({ net: 90_000, ready: true });

    const decided = await engine.decideRequest(owner, requestId, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(requestId) });
    expect(decided.ok).toBe(true);
    expect(await fineOf(Number(pending.id))).toMatchObject({ status: 'ACTIVE' });
    const [note] = await sql`select link from hris.notifications where kind = 'driver_fine.active' and recipient_account_id = ${ids.driver + 1000}`;
    expect(note.link).toBe(`/keberatan-potongan/ajukan?jenis=DRIVER_FINE&id=${pending.id}`);
    expect(await driverRow(W1)).toMatchObject({ income: 90_000, taken: 10_000, net: 80_000 });

    const closed = await pr.closeSlips(owner, { slipIds: null, periodStart: `W${W1}` }, announce);
    expect(closed.ok).toBe(true);
    const [slip] = await sql`select id from hris.payslips where employee_id = ${ids.driver} and period_start = ${W1} and kind = 'WEEKLY'`;
    const fund = await sql`select fund, amount from hris.fund_entries where payslip_id = ${slip.id}`;
    expect(fund).toEqual([expect.objectContaining({ fund: 'DISCIPLINE', amount: 10_000 })]);
    const screen = (await pr.finesScreen(owner, 'ACTIVE'))!;
    expect(screen.rows[0]).toMatchObject({ endAction: 'WAIVE', cut: expect.objectContaining({ label: 'Terpotong' }) });
  });

  it('tiadakan sesudah terpotong: dikembalikan di slip mingguan berikutnya dan keluar Dana Disiplin; batalkan sebelum terpotong', async () => {
    const [fine] = await sql`select id from hris.driver_fines where status = 'ACTIVE'`;
    expect((await pr.endFine(kg, Number(fine.id), 'Ternyata nota sudah difoto', announce)).ok).toBe(false);
    const waived = await pr.endFine(owner, Number(fine.id), 'Ternyata nota sudah difoto oleh kenek', announce);
    expect(waived.ok && waived.data.status).toBe('WAIVED');

    const direct = await pr.recordFineDirect(owner, fields(ids.driver, '2026-11-06'), announce);
    expect(direct.ok).toBe(true);
    expect(await driverRow(W2)).toMatchObject({ income: 10_000, taken: 10_000, net: 0 });
    const cancelled = await pr.endFine(owner, direct.ok ? direct.data.id : 0, 'Salah orang, bukan Dedi yang lalai', announce);
    expect(cancelled.ok && cancelled.data.status).toBe('CANCELLED');
    expect(await driverRow(W2)).toMatchObject({ income: 10_000, taken: 0, net: 10_000 });

    vi.setSystemTime(new Date('2026-11-14T11:00:00+07:00'));
    const closed = await pr.closeSlips(owner, { slipIds: null, periodStart: `W${W2}` }, announce);
    expect(closed.ok).toBe(true);
    const [slip] = await sql`select id, net from hris.payslips where employee_id = ${ids.driver} and period_start = ${W2} and kind = 'WEEKLY'`;
    expect(slip.net).toBe(10_000);
    const fund = await sql`select fund, amount from hris.fund_entries where payslip_id = ${slip.id}`;
    expect(fund).toEqual([expect.objectContaining({ fund: 'DISCIPLINE', amount: -10_000 })]);
    vi.setSystemTime(new Date('2026-11-07T11:00:00+07:00'));
  });

  it('pengaju menarik usulan = Ditarik; keberatan disetujui = denda tidak dipotong', async () => {
    const sent = await engine.submitRequest(kg, 'driver_fine', handlers.driver_fine, { fields: fields(ids.driver, '2026-11-07'), attachmentIds: [] });
    const requestId = sent.ok ? sent.data.id : 0;
    expect((await engine.cancelRequest(kg, requestId, await versionOf(requestId), 'Salah input tanggal', handlers)).ok).toBe(true);
    expect((await sql`select status from hris.driver_fines where request_id = ${requestId}`)[0].status).toBe('WITHDRAWN');

    const direct = await pr.recordFineDirect(owner, fields(ids.driver, '2026-11-07'), announce);
    const fineId = direct.ok ? direct.data.id : 0;
    const driver = await (await import('@/modules/access')).loadActor(ids.driver + 1000, ids.driver);
    const objection = await engine.submitRequest(driver, 'deduction_objection', handlers.deduction_objection, {
      fields: { target: 'DRIVER_FINE', targetId: fineId, reason: 'Hari itu saya libur, bukan saya yang bawa mobil' }, attachmentIds: [],
    });
    expect(objection.ok).toBe(true);
    const objectionId = objection.ok ? objection.data.id : 0;
    expect((await engine.decideRequest(owner, objectionId, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(objectionId) })).ok).toBe(true);
    expect(await fineOf(fineId)).toMatchObject({ status: 'CANCELLED' });
  });

  it('Jenis Denda: naik paling cepat 7 hari; turun 1 hari; denda tercatat tidak berubah', async () => {
    const early = await pr.saveFineKind(owner, { id: kindId, name: 'Tidak taat administrasi', example: '', amount: 15_000, active: true, effectiveOn: '2026-11-10', reason: 'Naik sesuai rapat bulanan' }, announce);
    expect(early.ok || early.error).toMatch(/paling cepat/);
    const ok = await pr.saveFineKind(owner, { id: kindId, name: 'Tidak taat administrasi', example: '', amount: 15_000, active: true, effectiveOn: '2026-11-14', reason: 'Naik sesuai rapat bulanan' }, announce);
    expect(ok.ok).toBe(true);
    const lower = await pr.saveFineKind(owner, { id: kindId, name: 'Tidak taat administrasi', example: '', amount: 5_000, active: true, effectiveOn: '2026-11-08', reason: 'Turun sementara selama uji coba' }, announce);
    expect(lower.ok).toBe(true);
    expect((await pr.saveFineKind(kg, { name: 'Telat lapor', example: '', amount: 5_000, active: true, effectiveOn: '2026-11-20', reason: 'Jenis baru dari rapat' }, announce)).ok).toBe(false);
    const screen = (await pr.fineKindsScreen(owner))!;
    expect(screen.kinds[0].versions.filter((v) => v.future).map((v) => v.amount).sort((a, b) => a - b)).toEqual([5_000, 15_000]);
    const amounts = await sql`select distinct amount from hris.driver_fines`;
    expect(amounts.map((a) => a.amount)).toEqual([10_000]);
  });
});
