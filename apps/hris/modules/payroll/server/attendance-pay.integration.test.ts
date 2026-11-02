import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// Hitungan Kehadiran, Tiadakan Potongan, Potongan & Lembur (spec L4b §8) pada DB sintetis.
// Jalan bila ROLES_TEST_ADMIN_URL diisi (pola L4a). Tanggal lampau di periode 26 Okt – 25 Nov 2026.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_attpay_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const REASON = 'Uji hitungan kehadiran periode ini';
const PERIOD = '2026-10-26';
const NOW = new Date('2026-11-03T05:00:00Z');

let admin: postgres.Sql;
let sql: postgres.Sql;
let svc: typeof import('./attendance-pay');
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'gm' | 'hr' | 'ani' | 'budi', number>;
const noAnnounce = async () => {};

describe.skipIf(!ADMIN_URL)('L4b: Hitungan Kehadiran', () => {
  beforeAll(async () => {
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
    const folder = new URL('hris-db/src/migrations/', root);
    for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()) {
      await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();
    }
    process.env.DATABASE_URL = url.toString();
    const [{ id: pusat }] = await sql`insert into hris.branches (name, latitude, longitude) values ('Toko Pusat', -6.2, 106.8) returning id`;
    const [{ id: pokok }] = await sql`select id from hris.salary_component_types where name = 'Gaji Pokok'`;
    const person = async (name: string, position: string, monthly: number | null) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
        values (hris.next_employee_code(), ${name}, '2026-01-01', 'BCA', '1234567890') returning id`;
      const [pos] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${pusat}, ${pos.id}, 'EMPLOYEE', '2026-01-01')`;
      if (monthly) {
        const [pkg] = await sql`insert into hris.salary_changes (employee_id, effective_from, origin, reason, created_by_account_id)
          values (${row.id}, '2026-01-26', 'DIRECT', ${REASON}, 1) returning id`;
        await sql`insert into hris.salary_change_lines (change_id, component_type_id, amount) values (${pkg.id}, ${pokok}, ${monthly})`;
      }
      return Number(row.id);
    };
    ids = {
      owner: await person('Elan', 'Pemilik', null), gm: await person('Gilang', 'GM', 3_000_000), hr: await person('Nadia HR', 'HR', 2_600_000),
      ani: await person('Ani', 'Kasir', 2_600_000), budi: await person('Budi', 'Kasir', 2_600_000),
    };
    // Ani alpha 28 dan 29 Oktober (ditandai mesin, tidak dijelaskan) dan tidak memilih libur periode ini.
    for (const date of ['2026-10-28', '2026-10-29']) {
      await sql`insert into hris.clarification_events (employee_id, work_date, kind, deadline_at, state)
        values (${ids.ani}, ${date}, 'ALPHA', ${`${date}T16:59:00Z`}::timestamptz + interval '3 days', 'EXPIRED')`;
    }
    await sql`insert into hris.day_off_missing_marks (employee_id, period_start, quota, picked_count) values (${ids.ani}, ${PERIOD}, 4, 0)`;
    svc = await import('./attendance-pay');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const personOf = async (id: number) => {
    const { loadPayrollPeople } = await import('./data');
    return (await loadPayrollPeople('2026-11-03')).find((p) => p.id === id)!;
  };

  it('isi awal Potongan & Lembur = angka HRIS lama', async () => {
    const rules = await svc.payRulesOn(PERIOD);
    expect(rules.overtimeRate).toBe(10_000);
    expect(rules.lateRate).toBe(1_000);
    expect(rules.alpha).toEqual({ start: 1, step: 0, max: 2 });
    expect(rules.sickLetter).toEqual({ day1: 0, day2to3: 0.5, day4plus: 1 });
    expect(rules.fines.IN).toBe(15_000);
  });

  it('alpha dipotong rata 1× gaji harian; denda tidak memilih libur tercatat', async () => {
    const result = await svc.computeAttendancePay(await personOf(ids.ani), PERIOD, NOW);
    const alpha = result?.lines.find((l) => l.key === 'ALPHA');
    expect(alpha?.details.map((d) => d.amount)).toEqual([100_000, 100_000]);
    expect(result?.lines.find((l) => l.key === 'FINE')?.amount).toBe(10_000);
  });

  it('Tiadakan: HR ditolak, pemilik meniadakan, ganda ditolak, lalu dibatalkan', async () => {
    const input = { employeeId: ids.ani, kind: 'FINE', fineKind: 'DAY_OFF_MISSING', workDate: PERIOD, reason: REASON };
    const hr = await svc.waiveDeduction(await actorOf(ids.hr), input, noAnnounce, NOW);
    expect(hr.ok).toBe(false);
    const saved = await svc.waiveDeduction(await actorOf(ids.owner), input, noAnnounce, NOW);
    expect(saved.ok).toBe(true);
    const after = await svc.computeAttendancePay(await personOf(ids.ani), PERIOD, NOW);
    const fine = after?.lines.find((l) => l.key === 'FINE');
    expect(fine?.amount).toBe(0);
    expect(fine?.details[0].waived).toBe(true);
    const [note] = await sql`select title from hris.notifications where recipient_account_id = ${ids.ani + 1000} order by id desc limit 1`;
    expect(note.title).toMatch(/ditiadakan/);
    expect(note.title).not.toMatch(/Rp/);
    expect((await svc.waiveDeduction(await actorOf(ids.gm), input, noAnnounce, NOW)).ok).toBe(false);
    const id = saved.ok ? saved.data.id : 0;
    expect((await svc.cancelWaiver(await actorOf(ids.owner), id, REASON, noAnnounce, NOW)).ok).toBe(true);
    const again = await svc.computeAttendancePay(await personOf(ids.ani), PERIOD, NOW);
    expect(again?.lines.find((l) => l.key === 'FINE')?.amount).toBe(10_000);
    await expect(sql`delete from hris.pay_waivers`).rejects.toThrow();
  });

  it('Tiadakan potongan diri sendiri dan potongan Rp0 ditolak', async () => {
    const gmSelf = await svc.waiveDeduction(await actorOf(ids.gm), { employeeId: ids.gm, kind: 'FINE', fineKind: 'DAY_OFF_MISSING', workDate: PERIOD, reason: REASON }, noAnnounce, NOW);
    expect(gmSelf.ok).toBe(false);
    const none = await svc.waiveDeduction(await actorOf(ids.owner), { employeeId: ids.budi, kind: 'LATE', fineKind: null, workDate: '2026-10-28', reason: REASON }, noAnnounce, NOW);
    expect(none.ok).toBe(false);
  });

  it('Potongan & Lembur: hanya Pemilik/GM, hanya tanggal 26, lalu bisa dibatalkan sebelum berlaku', async () => {
    const values = { 'payroll.overtime_rate': 12_500, 'payroll.ladder_alpha': { start: 1.5, step: 0.2, max: 2 } };
    expect((await svc.savePayRules(await actorOf(ids.hr), { values, effectiveFrom: '2026-11-26', reason: REASON }, noAnnounce)).ok).toBe(false);
    expect((await svc.savePayRules(await actorOf(ids.owner), { values, effectiveFrom: '2026-11-27', reason: REASON }, noAnnounce)).ok).toBe(false);
    expect((await svc.savePayRules(await actorOf(ids.owner), { values: { 'payroll.ladder_alpha': { start: 2, step: 0, max: 1 } }, effectiveFrom: '2026-11-26', reason: REASON }, noAnnounce)).ok).toBe(false);
    expect((await svc.savePayRules(await actorOf(ids.owner), { values: { 'attendance.radius_m': 50 }, effectiveFrom: '2026-11-26', reason: REASON }, noAnnounce)).ok).toBe(false);
    const saved = await svc.savePayRules(await actorOf(ids.owner), { values, effectiveFrom: '2026-11-26', reason: REASON }, noAnnounce);
    expect(saved.ok).toBe(true);
    const next = await svc.payRulesOn('2026-11-26');
    expect(next.overtimeRate).toBe(12_500);
    expect(next.alpha).toEqual({ start: 1.5, step: 0.2, max: 2 });
    expect((await svc.payRulesOn(PERIOD)).overtimeRate).toBe(10_000);
  });

  it('Aturan Potongan memberi contoh dari rumus yang sama', async () => {
    const screen = await svc.deductionRulesScreen(await actorOf(ids.ani));
    const alpha = screen?.cards.find((c) => c.key === 'alpha');
    // Contoh dari rumus yang sama: deret pengali lalu jumlah, mis. "2 hari: 1× + 1× = Rp200.000".
    expect(alpha?.example).toMatch(/^2 hari: [\d,]+× \+ [\d,]+× = Rp[\d.]+$/);
  });
});
