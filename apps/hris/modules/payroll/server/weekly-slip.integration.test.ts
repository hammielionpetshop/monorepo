import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// L7b Slip Mingguan (spec L7 §3.5, §8) pada DB sintetis, tanggal lampau. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l7b_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const GUDANG = { latitude: -7.350564720030627, longitude: 108.10865608125447 };
const W1 = '2026-10-30';
const W2 = '2026-11-06';

let admin: postgres.Sql;
let sql: postgres.Sql;
let owner: Actor;
let ids: Record<'owner' | 'driver' | 'kenek' | 'kasir', number>;
let pr: typeof import('@/modules/payroll');
let rateId: number;
let vehicleId: number;
let routeId: number;
let wageSeq = 1;
const announce = async () => {};

const value = async (employeeId: number, date: string, amount: number, input: { basis?: 'WEEKLY' | 'MONTHLY'; kind?: 'RITASE' | 'SHOPPING'; role?: 'DRIVER' | 'ASSISTANT'; unrated?: boolean } = {}) => {
  const [row] = await sql`insert into hris.trip_wage_values (wage_id, employee_id, kind, wage_date, week_start, role, with_assistant, vehicle_id, route_id, rate_id, rate_amount, amount, pay_basis, status)
    values (${wageSeq++}, ${employeeId}, ${input.kind ?? 'RITASE'}, ${date}, ${date < W2 ? W1 : W2}, ${input.role ?? 'DRIVER'}, false, ${vehicleId}, ${routeId},
      ${input.unrated ? null : rateId}, ${input.unrated ? null : amount}, ${input.unrated ? 0 : amount}, ${input.basis ?? 'WEEKLY'}, ${input.unrated ? 'UNRATED' : 'ACTIVE'}) returning id`;
  return Number(row.id);
};
const cancel = (id: number, reason = 'Dinilai ulang: tarif dibetulkan') =>
  sql`update hris.trip_wage_values set status = 'CANCELLED', cancelled_at = now(), cancel_reason = ${reason} where id = ${id}`;

describe.skipIf(!ADMIN_URL)('L7b: slip mingguan', () => {
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
    ids = { owner: await person('Elan', 'Pemilik'), driver: await person('Dedi', 'Driver'), kenek: await person('Eko', 'Kenek'), kasir: await person('Kasir Uji', 'Kasir') };
    const [rate] = await sql`select id, vehicle_id, route_id from logistics.trip_rates order by id limit 1`;
    rateId = Number(rate.id);
    vehicleId = Number(rate.vehicle_id);
    routeId = Number(rate.route_id);
    pr = await import('@/modules/payroll');
    const { loadActor } = await import('@/modules/access');
    owner = await loadActor(ids.owner + 1000, ids.owner);
  });

  afterAll(async () => {
    vi.useRealTimers();
    delete process.env.AUTH_COOKIE_ENV;
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const slipOf = async (employeeId: number, start: string) => {
    const [row] = await sql`select id, kind, status, number, net, carried, period_end::text from hris.payslips where employee_id = ${employeeId} and period_start = ${start} and kind <> 'MONTHLY'`;
    return row;
  };

  it('kerangka: slip utama untuk Driver dan Kenek walau belum ada ritase; slip di luar slip utama hanya bila staf bulanan punya upah', async () => {
    await pr.runWeeklySkeleton();
    expect(await slipOf(ids.driver, W1)).toMatchObject({ kind: 'WEEKLY', status: 'ESTIMATE', period_end: '2026-11-05' });
    expect(await slipOf(ids.kenek, W2)).toMatchObject({ kind: 'WEEKLY', period_end: '2026-11-12' });
    expect(await slipOf(ids.kasir, W1)).toBeUndefined();
    // Slip bulanan tidak dibuat untuk berdasar gaji Mingguan.
    await pr.ensureSkeletons('2026-10-26');
    const monthly = await sql`select employee_id from hris.payslips where kind = 'MONTHLY'`;
    expect(monthly.map((r) => Number(r.employee_id))).not.toContain(ids.driver);
  });

  it('isi minggu: ritase + belanja per hari; staf bulanan mendapat slip di luar slip utama; belum bertarif menahan', async () => {
    await value(ids.driver, '2026-10-31', 90_000);
    await value(ids.driver, '2026-11-02', 15_000, { kind: 'SHOPPING' });
    await value(ids.kenek, '2026-11-01', 40_000, { role: 'ASSISTANT' });
    const unrated = await value(ids.kenek, '2026-11-03', 0, { role: 'ASSISTANT', unrated: true });
    await value(ids.kasir, '2026-11-01', 50_000, { basis: 'MONTHLY' });
    const screen = (await pr.periodScreen(owner, `W${W1}`))!;
    expect(screen.period).toMatchObject({ weekly: true, key: `W${W1}` });
    const row = (id: number) => screen.rows.find((r) => r.employeeId === id)!;
    expect(row(ids.driver)).toMatchObject({ net: 105_000, ready: true, kindLabel: 'Slip mingguan' });
    expect(row(ids.kasir)).toMatchObject({ net: 50_000, ready: true, kindLabel: 'Slip di luar slip utama' });
    expect(row(ids.kenek).holds.map((h) => h.kind)).toEqual(['UNRATED']);

    const closed = await pr.closeSlips(owner, { slipIds: null, periodStart: `W${W1}` }, announce);
    expect(closed.ok).toBe(true);
    const outcomes = closed.ok ? closed.data.outcomes : [];
    expect(outcomes.filter((o) => o.result === 'CLOSED')).toHaveLength(2);
    expect(outcomes.find((o) => o.name === 'Eko')?.result).toBe('HELD');
    expect(await slipOf(ids.driver, W1)).toMatchObject({ status: 'CLOSED', net: 105_000, number: expect.stringMatching(/^SM-20261105-000[12]$/) });
    const marked = await sql`select count(*)::int as n from hris.trip_wage_values where payslip_id is not null`;
    expect(marked[0].n).toBe(3);

    await cancel(unrated, 'Ritase dibatalkan: salah catat');
    const again = await pr.closeSlips(owner, { slipIds: null, periodStart: `W${W1}` }, announce);
    expect(again.ok && again.data.outcomes.map((o) => o.result)).toEqual(['CLOSED']);
    expect(await slipOf(ids.kenek, W1)).toMatchObject({ status: 'CLOSED', net: 40_000 });
  });

  it('upah yang sudah masuk slip lalu dinilai ulang: koreksi minus + upah pengganti di slip berikutnya; sisa dibawa, koreksi terpotong ke Dana Disiplin', async () => {
    const [old] = await sql`select id from hris.trip_wage_values where employee_id = ${ids.driver} and wage_date = '2026-10-31'`;
    await cancel(Number(old.id));
    await value(ids.driver, '2026-10-31', 80_000);
    const screen = (await pr.periodScreen(owner, `W${W2}`))!;
    const driver = screen.rows.find((r) => r.employeeId === ids.driver)!;
    expect(driver).toMatchObject({ income: 80_000, taken: 80_000, net: 0, carried: 10_000 });
    expect(screen.corrections.map((c) => c.plus).sort()).toEqual([false, true]);

    const done = await pr.closeSlips(owner, { slipIds: [driver.slipId], periodStart: null }, announce);
    expect(done.ok && done.data.outcomes[0].result).toBe('CLOSED');
    const carry = await sql`select amount, line_kind from hris.deduction_carryovers where employee_id = ${ids.driver} and status = 'CARRIED'`;
    expect(carry).toEqual([expect.objectContaining({ amount: 10_000, line_kind: 'TRIP_CORRECTION' })]);
    const fund = await sql`select fund, amount from hris.fund_entries where payslip_id = ${driver.slipId}`;
    expect(fund).toEqual([expect.objectContaining({ fund: 'DISCIPLINE', amount: 80_000 })]);
    // Bersih Rp0 langsung Dibayar tanpa uang.
    const paid = await sql`select kind from hris.payslip_payments where payslip_id = ${driver.slipId} and status = 'ACTIVE'`;
    expect(paid.map((p) => p.kind)).toEqual(['NO_MONEY']);
  });

  it('Periode Slip menampilkan minggu upah; jatuh bayar Sabtu', async () => {
    const periods = (await pr.periodsScreen(owner))!;
    expect(periods.weeks.map((w) => w.key)).toEqual([`W${W2}`, `W${W1}`]);
    expect(periods.weeks[1]).toMatchObject({ estimate: 0, closed: 3 });
    const schedule = (await pr.payScheduleScreen(owner))!;
    const week = schedule.groups.find((g) => g.period === `W${W1}`)!;
    expect(week).toMatchObject({ count: 3, amount: 195_000 });
    expect(week.label).toContain('minggu');
  });

  it('hari awal minggu diganti: minggu berjalan dipotong dan slip Perkiraan disegarkan', async () => {
    // Senin berlaku 8 Nov → Senin pertama 9 Nov; minggu 6 Nov menjadi 6–8 Nov.
    await sql`insert into hris.setting_values (key, value, effective_from, status, reason) values ('payroll.weekly_start_day', '"MON"'::jsonb, '2026-11-08', 'ACTIVE', 'Uji L7b')`;
    await pr.runWeeklySkeleton();
    expect(await slipOf(ids.kenek, W2)).toMatchObject({ status: 'ESTIMATE', period_end: '2026-11-08' });
    const tw = (await pr.tripWagesScreen(owner, '2026-11-10', 'ALL'))!;
    expect({ start: tw.start, end: tw.end, prev: tw.prev }).toEqual({ start: '2026-11-09', end: '2026-11-15', prev: W2 });
  });
});
