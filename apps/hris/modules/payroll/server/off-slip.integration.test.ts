import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// L4f-2 Bayar di luar slip + Ringkasan Gaji (spec L4f §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
// Tanggal lampau: periode 26 Okt – 25 Nov 2026; "sekarang" 10 November 2026; mode uji staging membuka Tutup.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l4f2_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const NOW = new Date('2026-11-10T05:00:00Z');
const TODAY = '2026-11-10';
const P = '2026-10-26';
const REASON = 'Membantu stok opname sampai malam';
const CANCEL = 'Salah pilih tagihan, dibayar ulang';
const noAnnounce = async () => {};

let admin: postgres.Sql;
let sql: postgres.Sql;
let slip: typeof import('./payslip');
let pay: typeof import('./payment');
let off: typeof import('./off-slip');
let reopen: typeof import('./payslip-reopen');
let free: typeof import('./free-bonus');
let funds: typeof import('./funds');
let other: typeof import('./other-deductions');
let summary: typeof import('./summary');
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'gm' | 'hr' | 'finance' | 'budi' | 'eko', number>;
let brankas: number;

describe.skipIf(!ADMIN_URL)('L4f-2: Bayar di luar slip dan Ringkasan', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    process.env.AUTH_COOKIE_ENV = 'staging';
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
    const [{ id: pokok }] = await sql`select id from hris.salary_component_types order by sort_order limit 1`;
    const person = async (name: string, position: string) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number, bank_account_holder)
        values (hris.next_employee_code(), ${name}, '2026-01-01', 'BCA', '1234567890', ${name}) returning id`;
      const [p] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${pusat}, ${p.id}, 'EMPLOYEE', '2026-01-01')`;
      const [pkg] = await sql`insert into hris.salary_changes (employee_id, effective_from, origin, reason, created_by_account_id)
        values (${row.id}, '2026-01-26', 'DIRECT', 'Gaji awal karyawan uji', 1) returning id`;
      await sql`insert into hris.salary_change_lines (change_id, component_type_id, amount) values (${pkg.id}, ${pokok}, 2600000)`;
      return Number(row.id);
    };
    ids = {
      owner: await person('Elan', 'Pemilik'), gm: await person('Gina', 'GM'), hr: await person('Nadia HR', 'HR'), finance: await person('Fani', 'Finance'),
      budi: await person('Budi', 'Kasir'), eko: await person('Eko', 'Kasir'),
    };
    brankas = Number((await sql`insert into petshop.money_places (name, kind, branch_id) values ('Brankas', 'CASH', 1) returning id`)[0].id);
    slip = await import('./payslip');
    pay = await import('./payment');
    off = await import('./off-slip');
    reopen = await import('./payslip-reopen');
    free = await import('./free-bonus');
    funds = await import('./funds');
    other = await import('./other-deductions');
    summary = await import('./summary');
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

  const slipIdOf = async (employeeId: number) => Number((await sql`select id from hris.payslips where employee_id = ${employeeId} and period_start = ${P}`)[0]?.id);
  const bonusType = async () => Number((await sql`select id from hris.bonus_types limit 1`)[0].id);
  const otherType = async () => Number((await sql`select id from hris.other_deduction_types order by sort_order limit 1`)[0].id);
  const resign = (employeeId: number) => sql`insert into hris.employment_events (employee_id, kind, effective_on, reason_kind, resignation_notice, note, created_by_account_id)
    values (${employeeId}, 'DEACTIVATE', '2026-11-06', 'RESIGNED', 'WITH_NOTICE', 'Berhenti dengan pemberitahuan sesudah 5 November', 1)`;
  const closeEarly = async (employeeId: number) => {
    const owner = await actorOf(ids.owner);
    await slip.periodScreen(owner, P);
    const r = await slip.closeSlips(owner, { slipIds: [await slipIdOf(employeeId)], periodStart: null, early: 'Karyawan berhenti, slip diselesaikan cepat' }, noAnnounce);
    if (!r.ok || r.data.outcomes[0].result !== 'CLOSED') throw new Error(JSON.stringify(r));
  };
  const claimsOf = (employeeId: number) => sql`select id, status, amount, kind, origin_key from hris.off_slip_claims where employee_id = ${employeeId} order by id`;

  it('bonus susulan sesudah slip terakhir Dibayar tanpa uang: lahir sekali, dipotongkan ke Piutang Lain, batal bayar membalik, buka kembali membatalkan', async () => {
    const owner = await actorOf(ids.owner);
    expect((await other.recordOtherDirect(owner, { employeeId: ids.budi, typeId: await otherType(), amount: 5_000_000, reason: 'Ganti rugi kerusakan mesin grooming', installments: 2, attachmentId: null }, noAnnounce)).ok).toBe(true);
    await resign(ids.budi);
    await closeEarly(ids.budi);
    const last = await slipIdOf(ids.budi);
    // Bersih Rp0 → Dibayar tanpa uang; sisanya Piutang Lain.
    expect((await sql`select kind from hris.payslip_payments where payslip_id = ${last} and status = 'ACTIVE'`)[0]).toMatchObject({ kind: 'NO_MONEY' });
    const [receivable] = await sql`select id, amount from hris.other_receivables where payslip_id = ${last}`;
    expect(receivable.amount).toBeGreaterThan(50_000);

    // Bonus disahkan sesudah slip terakhir Dibayar → tagihan lahir saat itu juga, dan tidak dobel saat mesin harian jalan.
    expect((await free.recordFreeDirect(owner, { employeeId: ids.budi, typeId: await bonusType(), amount: 50_000, occurredOn: '2026-11-05', fund: 'OFFICE', reason: REASON }, noAnnounce)).ok).toBe(true);
    expect(await claimsOf(ids.budi)).toEqual([expect.objectContaining({ status: 'WAITING', amount: 50_000, kind: 'BONUS' })]);
    await off.runOffSlipClaims(NOW);
    expect(await claimsOf(ids.budi)).toHaveLength(1);
    const [claim] = await claimsOf(ids.budi);

    expect(await off.payOffSlipClaim(await actorOf(ids.hr), claim.id, {}, noAnnounce)).toMatchObject({ ok: false, status: 403 });
    const screen = await off.offSlipPayScreen(owner, claim.id);
    expect(screen).toMatchObject({ cash: 0, settlements: [expect.objectContaining({ receivableId: receivable.id, amount: 50_000, clears: false })] });

    // Bayar: habis dipotongkan ke piutang, tanpa uang.
    expect(await off.payOffSlipClaim(owner, claim.id, {}, noAnnounce)).toMatchObject({ ok: true });
    expect((await claimsOf(ids.budi))[0]).toMatchObject({ status: 'PAID' });
    expect((await sql`select status from hris.bonus_entries where employee_id = ${ids.budi}`)[0]).toMatchObject({ status: 'PAID_OUTSIDE' });
    expect((await sql`select kind, amount from hris.payslip_payments where claim_id = ${claim.id} and status = 'ACTIVE'`)[0]).toMatchObject({ kind: 'NO_MONEY', amount: 0 });
    expect((await sql`select amount, status from hris.receivable_settlements where claim_id = ${claim.id}`)[0]).toMatchObject({ amount: 50_000, status: 'ACTIVE' });
    expect(await off.payOffSlipClaim(owner, claim.id, {}, noAnnounce)).toMatchObject({ ok: false, status: 409 });
    const row = (await reopen.receivablesScreen(owner, { status: null }))!.rows.find((r) => r.id === receivable.id)!;
    expect(row).toMatchObject({ settled: 50_000, remaining: receivable.amount - 50_000 });
    // Slip terakhir tidak bisa dibuka kembali selama ada pembayaran di luar slip.
    expect(await reopen.reopenSlip(owner, last, 'Salah hitung lembur tanggal tiga', noAnnounce)).toMatchObject({ ok: false, status: 409 });

    // Batal bayar: membalik semuanya.
    expect(await off.cancelOffSlipPayment(owner, claim.id, 'pendek', noAnnounce)).toMatchObject({ ok: false, status: 400 });
    expect(await off.cancelOffSlipPayment(owner, claim.id, CANCEL, noAnnounce)).toMatchObject({ ok: true });
    expect((await claimsOf(ids.budi))[0]).toMatchObject({ status: 'WAITING' });
    expect((await sql`select status from hris.bonus_entries where employee_id = ${ids.budi}`)[0]).toMatchObject({ status: 'APPROVED' });
    expect((await sql`select status from hris.receivable_settlements where claim_id = ${claim.id}`)[0]).toMatchObject({ status: 'REVERSED' });

    // Buka kembali slip terakhir: tagihan Menunggu dibatalkan, bonusnya kembali ke slip.
    expect(await reopen.reopenSlip(owner, last, 'Salah hitung lembur tanggal tiga', noAnnounce)).toMatchObject({ ok: true });
    expect((await claimsOf(ids.budi))[0]).toMatchObject({ status: 'CANCELLED' });
  });

  it('bonus Dana Disiplin dengan uang: mutasi dana keluar saat dibayar, dibalik saat batal bayar', async () => {
    const owner = await actorOf(ids.owner);
    expect((await funds.changeFund(owner, { kind: 'OPENING', fund: 'DISCIPLINE', amount: 100_000, reason: 'Saldo awal dari catatan HRIS lama' }, noAnnounce)).ok).toBe(true);
    await resign(ids.eko);
    await closeEarly(ids.eko);
    const last = await slipIdOf(ids.eko);
    const paid = await pay.paySlips(owner, { slipIds: [last], sourceId: brankas, moneyDate: TODAY }, noAnnounce);
    expect(paid.ok && paid.data.outcomes[0]).toMatchObject({ result: 'PAID' });
    expect((await free.recordFreeDirect(owner, { employeeId: ids.eko, typeId: await bonusType(), amount: 40_000, occurredOn: '2026-11-05', fund: 'DISCIPLINE_FUND', reason: REASON }, noAnnounce)).ok).toBe(true);
    const [claim] = await claimsOf(ids.eko);
    expect(claim).toMatchObject({ status: 'WAITING', amount: 40_000 });
    expect((await funds.readFundState()).discipline.reserved).toBe(40_000);
    expect(await off.payOffSlipClaim(owner, claim.id, { sourceId: brankas, moneyDate: '2026-11-11' }, noAnnounce)).toMatchObject({ ok: false, status: 409 });
    expect(await off.payOffSlipClaim(owner, claim.id, { sourceId: brankas, moneyDate: TODAY }, noAnnounce)).toMatchObject({ ok: true });
    expect((await sql`select kind, amount, method from hris.payslip_payments where claim_id = ${claim.id} and status = 'ACTIVE'`)[0]).toMatchObject({ kind: 'MONEY', amount: 40_000, method: 'CASH' });
    expect(Number((await sql`select sum(amount)::int as s from hris.fund_entries where claim_id = ${claim.id}`)[0].s)).toBe(-40_000);
    expect((await funds.readFundState()).discipline.reserved).toBe(0);
    expect(await off.cancelOffSlipPayment(owner, claim.id, CANCEL, noAnnounce)).toMatchObject({ ok: true });
    expect(Number((await sql`select sum(amount)::int as s from hris.fund_entries where claim_id = ${claim.id}`)[0].s)).toBe(0);
    expect((await funds.readFundState()).discipline.reserved).toBe(40_000);
  });

  it('Ringkasan: seimbang; Finance total perusahaan tanpa per cabang dan tanpa dana; karyawan tanpa hak ditolak', async () => {
    const full = await summary.payrollSummary(await actorOf(ids.owner), P);
    expect(full).toMatchObject({ view: 'FULL', balanced: true });
    expect(full!.branches.length).toBeGreaterThan(0);
    expect(full!.total.counts.PAID).toBeGreaterThanOrEqual(1);
    const fin = await summary.payrollSummary(await actorOf(ids.finance), P, { finance: true });
    expect(fin).toMatchObject({ view: 'FINANCE', branches: [], balanced: true });
    expect(fin!.total.funds.every((f) => f.in === 0 && f.out === 0)).toBe(true);
    expect(await summary.payrollSummary(await actorOf(ids.hr), P)).toMatchObject({ view: 'HR', balanced: true });
    expect(await summary.payrollSummary(await actorOf(ids.budi), P)).toBeNull();
  });
});
