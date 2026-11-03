import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// L4e-1 Periode Slip dan Tutup Slip (spec L4e §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
// Tanggal lampau: periode 26 Okt – 25 Nov 2026; "sekarang" 10 November 2026 (jendela tutup belum terbuka tanpa mode uji).
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l4e1_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const NOW = new Date('2026-11-10T05:00:00Z');
const P = '2026-10-26';
const NEXT = '2026-11-26';
const REASON = 'Membantu stok opname sampai malam';
const noAnnounce = async () => {};

let admin: postgres.Sql;
let sql: postgres.Sql;
let slip: typeof import('./payslip');
let free: typeof import('./free-bonus');
let funds: typeof import('./funds');
let other: typeof import('./other-deductions');
let pay: typeof import('./attendance-pay');
let data: typeof import('./data');
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'owner2' | 'gm' | 'hr' | 'ani' | 'budi' | 'cici', number>;

describe.skipIf(!ADMIN_URL)('L4e-1: Periode Slip dan Tutup Slip', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
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
    const person = async (name: string, position: string, monthly: number | null = 2_600_000) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
        values (hris.next_employee_code(), ${name}, '2026-01-01', 'BCA', '1234567890') returning id`;
      const [p] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${pusat}, ${p.id}, 'EMPLOYEE', '2026-01-01')`;
      if (monthly) {
        const [pkg] = await sql`insert into hris.salary_changes (employee_id, effective_from, origin, reason, created_by_account_id)
          values (${row.id}, '2026-01-26', 'DIRECT', 'Gaji awal karyawan uji', 1) returning id`;
        await sql`insert into hris.salary_change_lines (change_id, component_type_id, amount) values (${pkg.id}, ${pokok}, ${monthly})`;
      }
      return Number(row.id);
    };
    ids = {
      owner: await person('Elan', 'Pemilik'), owner2: await person('Irma', 'Pemilik'), gm: await person('Gina', 'GM'),
      hr: await person('Nadia HR', 'HR'), ani: await person('Ani', 'Kasir'), budi: await person('Budi', 'Kasir'), cici: await person('Cici', 'Kasir', null),
    };
    slip = await import('./payslip');
    free = await import('./free-bonus');
    funds = await import('./funds');
    other = await import('./other-deductions');
    pay = await import('./attendance-pay');
    data = await import('./data');
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

  const slipIdOf = async (employeeId: number, period = P) =>
    Number((await sql`select id from hris.payslips where employee_id = ${employeeId} and period_start = ${period}`)[0]?.id);
  const personOf = async (employeeId: number, period = P) => {
    const end = period === P ? '2026-11-25' : '2026-12-25';
    return (await data.loadPeriodPeople(period, end)).find((p) => p.id === employeeId)!;
  };
  const close = async (actorId: number, slipIds: number[]) => {
    const result = await slip.closeSlips(await actorOf(actorId), { slipIds, periodStart: null }, noAnnounce);
    if (!result.ok) throw new Error(result.error);
    return result.data.outcomes;
  };

  it('kerangka slip: dua kali = sama; HR tidak melihat slip Pemilik/GM; tanpa gaji = tertahan', async () => {
    const owner = await slip.periodScreen(await actorOf(ids.owner), P);
    await slip.periodScreen(await actorOf(ids.owner), P);
    const [{ n }] = await sql`select count(*)::int as n from hris.payslips where period_start = ${P}`;
    expect(n).toBe(owner!.rows.length);
    expect(owner!.rows.map((r) => r.employeeId)).toEqual(expect.arrayContaining([ids.owner, ids.gm, ids.ani]));
    const hr = await slip.periodScreen(await actorOf(ids.hr), P);
    expect(hr!.rows.map((r) => r.employeeId)).not.toContain(ids.owner);
    expect(hr!.rows.map((r) => r.employeeId)).not.toContain(ids.gm);
    expect(hr!.rows.find((r) => r.employeeId === ids.cici)!.holds.map((h) => h.kind)).toContain('NO_SALARY');
  });

  it('sebelum tanggal 29 Tutup ditolak; Pemilik tidak menutup slipnya sendiri; HR tidak menutup slip Pemilik', async () => {
    const [early] = await close(ids.hr, [await slipIdOf(ids.ani)]);
    expect(early).toMatchObject({ result: 'FAILED' });
    expect(early.text).toContain('Tombol Tutup aktif mulai');
    process.env.AUTH_COOKIE_ENV = 'staging';
    expect((await close(ids.owner, [await slipIdOf(ids.owner)]))[0]).toMatchObject({ result: 'FAILED' });
    expect((await close(ids.hr, [await slipIdOf(ids.owner2)]))[0]).toMatchObject({ result: 'FAILED' });
    expect((await close(ids.hr, [await slipIdOf(ids.cici)]))[0]).toMatchObject({ result: 'HELD' });
    const [{ n }] = await sql`select count(*)::int as n from hris.payslips where status = 'CLOSED'`;
    expect(n).toBe(0);
  });

  it('tutup: angka = perkiraan terakhir; nomor SB; bonus Masuk slip; mutasi Dana Disiplin; dua kali ditolak', async () => {
    const owner = await actorOf(ids.owner);
    expect((await funds.changeFund(owner, { kind: 'OPENING', fund: 'DISCIPLINE', amount: 100_000, reason: 'Saldo awal dari catatan HRIS lama' }, noAnnounce)).ok).toBe(true);
    const bonus = await free.recordFreeDirect(owner, { employeeId: ids.ani, typeId: (await sql`select id from hris.bonus_types limit 1`)[0].id, amount: 40_000, occurredOn: '2026-11-05', fund: 'DISCIPLINE_FUND', reason: REASON }, noAnnounce);
    expect(bonus.ok).toBe(true);
    const estimate = await slip.computeSlip(await personOf(ids.ani), P);
    expect(estimate!.computation.lines.some((l) => l.details.fund === 'DISCIPLINE_FUND' && l.amount === 40_000)).toBe(true);
    const id = await slipIdOf(ids.ani);
    const [done] = await close(ids.hr, [id]);
    expect(done).toMatchObject({ result: 'CLOSED' });
    const [row] = await sql`select * from hris.payslips where id = ${id}`;
    expect(row).toMatchObject({ status: 'CLOSED', number: 'SB-202611-0001', version: 1, net: estimate!.computation.net, income: estimate!.computation.income });
    expect(Number((await sql`select count(*)::int as n from hris.payslip_lines where payslip_id = ${id}`)[0].n)).toBe(estimate!.computation.lines.length);
    expect((await sql`select status, payslip_id from hris.bonus_entries where employee_id = ${ids.ani}`)[0]).toMatchObject({ status: 'IN_SLIP', payslip_id: id });
    const moves = await sql`select fund, amount from hris.fund_entries where kind = 'SLIP' and payslip_id = ${id}`;
    expect(moves).toContainEqual(expect.objectContaining({ fund: 'DISCIPLINE', amount: -40_000 }));
    const state = await funds.readFundState();
    expect(state.discipline).toMatchObject({ reserved: 0, balance: 100_000 + moves.filter((m) => m.fund === 'DISCIPLINE').reduce((s, m) => s + m.amount, 0) });
    const [again] = await close(ids.owner, [id]);
    expect(again).toMatchObject({ result: 'FAILED' });
    expect(again.text).toContain('Sudah ditutup oleh');
    expect(await sql`select action from hris.payslip_steps where payslip_id = ${id}`).toHaveLength(1);
  });

  it('dua orang menutup bersamaan: satu berhasil, yang lain "Sudah ditutup"; nomor urut berikutnya', async () => {
    const id = await slipIdOf(ids.owner2);
    const [a, b] = await Promise.all([close(ids.owner, [id]), close(ids.gm, [id])]);
    expect([a[0].result, b[0].result].sort()).toEqual(['CLOSED', 'FAILED']);
    expect((await sql`select number from hris.payslips where id = ${id}`)[0].number).toBe('SB-202611-0002');
  });

  it('sisa potongan Dibawa dan diambil lebih dulu di slip berikutnya; Batalkan sesudah terpotong ditolak', async () => {
    const owner = await actorOf(ids.owner);
    const [{ id: typeId }] = await sql`select id from hris.other_deduction_types order by sort_order limit 1`;
    const rec = await other.recordOtherDirect(owner, { employeeId: ids.budi, typeId, amount: 9_000_000, reason: 'Ganti rugi kerusakan mesin grooming', installments: 1, attachmentId: null }, noAnnounce);
    expect(rec.ok).toBe(true);
    const id = await slipIdOf(ids.budi);
    expect((await close(ids.hr, [id]))[0]).toMatchObject({ result: 'CLOSED' });
    const [row] = await sql`select net, carried from hris.payslips where id = ${id}`;
    expect(row.net).toBe(0);
    expect(row.carried).toBeGreaterThan(0);
    const [carry] = await sql`select * from hris.deduction_carryovers where employee_id = ${ids.budi}`;
    expect(carry).toMatchObject({ status: 'CARRIED', deduction_group: 'c', amount: row.carried });
    expect((await other.cancelOther(owner, rec.ok ? rec.data.id : 0, 'Salah catat nominal potongan', noAnnounce))).toMatchObject({ ok: false, status: 409 });
    const next = await slip.computeSlip(await personOf(ids.budi, NEXT), NEXT);
    const carried = next!.computation.lines.find((l) => l.sourceKey === `carry:${carry.id}`);
    expect(carried).toMatchObject({ amount: row.carried, originPeriod: P });
  });

  it('bonus disahkan sesudah slip periodenya ditutup masuk slip terbuka berikutnya bertanda periode asal', async () => {
    const owner = await actorOf(ids.owner);
    const typeId = (await sql`select id from hris.bonus_types limit 1`)[0].id;
    const late = await free.recordFreeDirect(owner, { employeeId: ids.ani, typeId, amount: 25_000, occurredOn: '2026-11-06', fund: 'OFFICE', reason: REASON }, noAnnounce);
    expect(late.ok).toBe(true);
    const next = await slip.computeSlip(await personOf(ids.ani, NEXT), NEXT);
    expect(next!.computation.lines.find((l) => l.section === 'INCOME' && l.amount === 25_000)).toMatchObject({ originPeriod: P });
  });

  it('pagar sesudah ditutup: tiadakan potongan periode itu dan batalkan bonus Masuk slip ditolak', async () => {
    const owner = await actorOf(ids.owner);
    const waive = await pay.waiveDeduction(owner, { employeeId: ids.ani, kind: 'LATE', fineKind: null, workDate: '2026-11-03', reason: 'Terlambat karena banjir besar' }, noAnnounce);
    expect(waive).toMatchObject({ ok: false, status: 409 });
    const { rejectOrCancelBonus } = await import('./bonus');
    const [{ id: entryId }] = await sql`select id from hris.bonus_entries where status = 'IN_SLIP' limit 1`;
    expect(await rejectOrCancelBonus(owner, entryId, 'Salah catat bonus bebas', noAnnounce)).toMatchObject({ ok: false, status: 409 });
  });
});
