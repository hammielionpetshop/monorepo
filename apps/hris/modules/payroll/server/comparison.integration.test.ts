import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import { comparisonLoadSql, comparisonPurgeSql, type OldSlip } from '../rules/comparison';

// L9b uji banding (spec L9 §4; SIS-15, 16, 41) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l9b_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const P = '2026-10-26';
/**
 * SQL skrip dijalankan psql (ON_ERROR_STOP memutus sesi). Di tes: baris perintah psql dibuang, satu koneksi sendiri,
 * dan transaksi yang gagal digulung supaya koneksinya bisa dipakai lagi.
 */
const run = async (text: string) => {
  try {
    await script.unsafe(text.replace(/^\\set .*\n/, '')).simple();
  } catch (error) {
    await script`rollback`;
    throw error;
  }
};

let admin: postgres.Sql;
let sql: postgres.Sql;
let script: postgres.Sql;
let ids: Record<'owner' | 'kasir', number>;
let svc: typeof import('./comparison');
let payroll: typeof import('./payslip');
let actorOf: (employeeId: number) => Promise<Actor>;

const slip = (over: Partial<OldSlip>): OldSlip => ({ legacyCode: 'EMP-002', name: 'Kiki', slipKind: 'MONTHLY', slipStart: P, oldTotal: 2_000_000, components: [], ...over });

describe.skipIf(!ADMIN_URL)('L9b: uji banding', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ now: new Date('2026-11-07T11:00:00+07:00'), toFake: ['Date'] });
    const adminUrl = new URL(ADMIN_URL!);
    adminUrl.pathname = '/postgres';
    admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database "${databaseName}"`);
    const url = new URL(ADMIN_URL!);
    url.pathname = `/${databaseName}`;
    sql = postgres(url.toString(), { max: 4, onnotice: () => {} });
    script = postgres(url.toString(), { max: 1, onnotice: () => {} });
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
          await sql`insert into hris.branches (name, latitude, longitude) values ('Gudang', -7.35, 108.1)`;
        }
        await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();
      }
    }
    process.env.DATABASE_URL = url.toString();
    process.env.AUTH_COOKIE_ENV = 'staging';
    const [{ id: branch }] = await sql`select id from hris.branches where name = 'Gudang'`;
    const [{ id: pokok }] = await sql`select id from hris.salary_component_types order by sort_order limit 1`;
    const person = async (name: string, position: string) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on) values (hris.next_employee_code(), ${name}, '2026-01-01') returning id`;
      const [p] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${branch}, ${p.id}, 'EMPLOYEE', '2026-01-01')`;
      const [pkg] = await sql`insert into hris.salary_changes (employee_id, effective_from, origin, reason, created_by_account_id)
        values (${row.id}, '2026-01-26', 'DIRECT', 'Gaji awal karyawan uji', 1) returning id`;
      await sql`insert into hris.salary_change_lines (change_id, component_type_id, amount) values (${pkg.id}, ${pokok}, 2600000)`;
      return Number(row.id);
    };
    ids = { owner: await person('Elan', 'Pemilik'), kasir: await person('Kiki', 'Kasir') };
    svc = await import('./comparison');
    payroll = await import('./payslip');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
  });

  afterAll(async () => {
    vi.useRealTimers();
    delete process.env.AUTH_COOKIE_ENV;
    await sql?.end();
    await script?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const meta = { periodStart: P, label: 'Okt–Nov', files: ['slip.xlsx'] };

  it('muat: nama tak dikenal membatalkan semuanya; berhasil sekali, dimuat ulang ditolak', async () => {
    await expect(run(comparisonLoadSql([slip({}), slip({ legacyCode: 'EMP-099', name: 'Tidak Ada' })], meta))).rejects.toThrow(/Tidak Ada.*ditemukan 0 kali/);
    expect((await sql`select count(*)::int as n from hris.comparison_runs`)[0].n).toBe(0);
    // L9c: Kiki punya Kode lama → dicocokkan lewat kode walau ejaan nama di berkas lain; Elan tanpa Kode lama → lewat nama.
    await sql`update hris.employees set legacy_code = 'EMP-002' where id = ${ids.kasir}`;
    await expect(sql`update hris.employees set legacy_code = 'EMP-003' where id = ${ids.kasir}`).rejects.toThrow(/Kode lama karyawan tidak bisa diubah/);
    await run(comparisonLoadSql([
      slip({ name: 'Kiki Salah Eja' }),
      slip({ slipKind: 'WEEKLY_EXTRA', slipStart: '2026-10-30', oldTotal: 0 }),
      slip({ legacyCode: 'EMP-001', name: 'Elan', oldTotal: 2_600_000 }),
    ], meta));
    await expect(run(comparisonLoadSql([slip({})], meta))).rejects.toThrow(/sudah dimuat/);
    expect((await sql`select count(*)::int as n from hris.comparison_slips`)[0].n).toBe(3);
  });

  it('hanya Pemilik/GM; hitungan HRIS = mesin slip yang sama; hitung ulang paling banyak sekali', async () => {
    const [{ id: runId }] = await sql`select id from hris.comparison_runs`;
    expect(await svc.comparisonScreen(await actorOf(ids.kasir), null)).toBeNull();
    expect(await svc.computeComparison(await actorOf(ids.kasir), runId)).toMatchObject({ ok: false, status: 403 });
    const owner = await actorOf(ids.owner);
    const before = await svc.comparisonScreen(owner, null);
    expect(before?.rows.every((r) => r.hris == null)).toBe(true);
    expect(await svc.computeComparison(owner, runId)).toMatchObject({ ok: true, data: { computed: 3, round: 1 } });
    const people = await (await import('./data')).loadPeriodPeople(P, '2026-11-25', 'ANY');
    const kiki = people.find((p) => p.id === ids.kasir)!;
    const expected = (await payroll.computeSlip(kiki, P))!.computation.net;
    const screen = await svc.comparisonScreen(owner, null);
    const monthly = screen!.rows.find((r) => r.employeeId === ids.kasir && r.slipKind === 'MONTHLY')!;
    expect(monthly).toMatchObject({ hris: expected, firstTotal: expected, diff: expected - 2_000_000 });
    expect(screen!.rows.find((r) => r.slipKind === 'WEEKLY_EXTRA')?.hris).toBe(0);
    expect(await svc.computeComparison(owner, runId)).toMatchObject({ ok: true, data: { round: 2 } });
    expect(await svc.computeComparison(owner, runId)).toMatchObject({ ok: false, status: 409 });
    // Tidak ada slip yang ditutup/dibayar oleh uji banding.
    expect((await sql`select count(*)::int as n from hris.payslips where status = 'CLOSED'`)[0].n).toBe(0);
  });

  it('sebab selisih: beda disengaja wajib nomor aturan; dicatat siapa; CSV memuat sebabnya', async () => {
    const owner = await actorOf(ids.owner);
    const [{ id: slipId }] = await sql`select id from hris.comparison_slips where employee_id = ${ids.kasir} and slip_kind = 'MONTHLY'`;
    expect(await svc.saveComparisonCause(owner, slipId, { cause: 'INTENDED', ruleRef: '', note: null })).toMatchObject({ ok: false, status: 400 });
    expect(await svc.saveComparisonCause(owner, slipId, { cause: 'INTENDED', ruleRef: 'GAJ-54', note: 'Telat dihitung per menit' })).toMatchObject({ ok: true });
    const [row] = await sql`select cause, rule_ref, decided_by_account_id from hris.comparison_slips where id = ${slipId}`;
    expect(row).toMatchObject({ cause: 'INTENDED', rule_ref: 'GAJ-54', decided_by_account_id: owner.accountId });
    const [{ id: runId }] = await sql`select id from hris.comparison_runs`;
    const file = await svc.comparisonDownload(owner, runId);
    expect(file?.csv).toMatch(/Kiki;Bulanan;2026-10-26;2000000;.*Beda disengaja;GAJ-54;Telat dihitung per menit/);
  });

  it('--purge: baris bertanda COMPARISON dihapus, uji banding tetap ada berstatus PURGED dan terkunci', async () => {
    const [{ id: runId }] = await sql`select id from hris.comparison_runs`;
    const [{ id: marked }] = await sql`select id from hris.comparison_slips where slip_kind = 'WEEKLY_EXTRA'`;
    await sql`insert into hris.comparison_rows (run_id, table_name, row_id) values (${runId}, 'hris.comparison_slips', ${marked})`;
    await run(comparisonPurgeSql(P));
    expect((await sql`select count(*)::int as n from hris.comparison_slips`)[0].n).toBe(0);
    expect((await sql`select status from hris.comparison_runs where id = ${runId}`)[0].status).toBe('PURGED');
    expect(await svc.computeComparison(await actorOf(ids.owner), runId)).toMatchObject({ ok: false, status: 409 });
    await expect(run(comparisonPurgeSql(P))).rejects.toThrow(/Tidak ada uji banding/);
  });
});
