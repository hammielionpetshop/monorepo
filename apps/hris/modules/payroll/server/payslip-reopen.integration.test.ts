import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// L4e-2 Buka kembali, slip terakhir, Piutang Lain, pengembalian (spec L4e §3.7, §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
// Tanggal lampau: periode 26 Okt – 25 Nov 2026; "sekarang" 10 November 2026 (jendela tutup belum terbuka tanpa mode uji).
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l4e2_svc_${process.pid}_${Date.now()}`;
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
let data: typeof import('./data');
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'owner2' | 'gm' | 'hr' | 'ani' | 'budi' | 'dodi' | 'eko', number>;
let reopen: typeof import('./payslip-reopen');

describe.skipIf(!ADMIN_URL)('L4e-2: Buka kembali dan slip terakhir', () => {
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
      hr: await person('Nadia HR', 'HR'), ani: await person('Ani', 'Kasir'), budi: await person('Budi', 'Kasir'), dodi: await person('Dodi', 'Kasir'),
      eko: await person('Eko', 'Kasir'),
    };
    slip = await import('./payslip');
    reopen = await import('./payslip-reopen');
    free = await import('./free-bonus');
    funds = await import('./funds');
    other = await import('./other-deductions');
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
  const otherType = async () => Number((await sql`select id from hris.other_deduction_types order by sort_order limit 1`)[0].id);
  const bonusType = async () => Number((await sql`select id from hris.bonus_types limit 1`)[0].id);
  const resign = (employeeId: number) => sql`insert into hris.employment_events (employee_id, kind, effective_on, reason_kind, resignation_notice, note, created_by_account_id)
    values (${employeeId}, 'DEACTIVATE', '2026-11-06', 'RESIGNED', 'WITHOUT_NOTICE', 'Tidak masuk lagi sejak 6 November', 1)`;

  it('buka kembali: HR ditolak; Pemilik membalik baris, dana, dan bonus; nomor tetap, versi naik saat ditutup lagi', async () => {
    process.env.AUTH_COOKIE_ENV = 'staging';
    const owner = await actorOf(ids.owner);
    await slip.periodScreen(owner, P);
    expect((await funds.changeFund(owner, { kind: 'OPENING', fund: 'DISCIPLINE', amount: 100_000, reason: 'Saldo awal dari catatan HRIS lama' }, noAnnounce)).ok).toBe(true);
    expect((await free.recordFreeDirect(owner, { employeeId: ids.ani, typeId: await bonusType(), amount: 40_000, occurredOn: '2026-11-05', fund: 'DISCIPLINE_FUND', reason: REASON }, noAnnounce)).ok).toBe(true);
    const id = await slipIdOf(ids.ani);
    expect((await close(ids.hr, [id]))[0]).toMatchObject({ result: 'CLOSED' });
    expect(await reopen.reopenSlip(await actorOf(ids.hr), id, 'Salah hitung lembur tanggal tiga', noAnnounce)).toMatchObject({ ok: false, status: 403 });
    expect(await reopen.reopenSlip(owner, id, 'pendek', noAnnounce)).toMatchObject({ ok: false, status: 400 });
    expect(await reopen.reopenSlip(owner, id, 'Salah hitung lembur tanggal tiga', noAnnounce)).toMatchObject({ ok: true });
    expect((await sql`select status, number, version from hris.payslips where id = ${id}`)[0]).toMatchObject({ status: 'ESTIMATE', number: 'SB-202611-0001', version: 1 });
    expect(Number((await sql`select count(*)::int as n from hris.payslip_lines where payslip_id = ${id} and status = 'ACTIVE'`)[0].n)).toBe(0);
    expect(Number((await sql`select coalesce(sum(amount), 0)::int as s from hris.fund_entries where payslip_id = ${id}`)[0].s)).toBe(0);
    expect((await sql`select status, payslip_id from hris.bonus_entries where employee_id = ${ids.ani}`)[0]).toMatchObject({ status: 'APPROVED', payslip_id: null });
    expect((await funds.readFundState()).discipline.reserved).toBe(40_000);
    expect((await sql`select action from hris.payslip_steps where payslip_id = ${id} order by id`).map((s) => s.action)).toEqual(['CLOSE', 'REOPEN']);
    expect((await close(ids.hr, [id]))[0]).toMatchObject({ result: 'CLOSED' });
    expect((await sql`select status, number, version from hris.payslips where id = ${id}`)[0]).toMatchObject({ status: 'CLOSED', number: 'SB-202611-0001', version: 2 });
    expect((await reopen.slipVersions(id)).replacedVersions).toEqual([1]);
  });

  it('HR Minta buka kembali lewat pengajuan; buka kembali ditolak bila slip periode berikutnya sudah ditutup', async () => {
    const id = await slipIdOf(ids.ani);
    const handler = reopen.payslipReopenHandler(noAnnounce);
    const hr = await actorOf(ids.hr);
    const { db } = await import('@/lib/db');
    const prepared = await db.transaction((tx) => handler.prepare(tx, hr, { slipId: id, reason: 'Lembur tanggal tiga belum masuk' }));
    expect(prepared).toMatchObject({ ok: true, data: { dedupeKey: `payslip:${id}` } });
    await sql`insert into hris.payslips (employee_id, period_start, status, number, version, net, closed_at, objection_until)
      values (${ids.ani}, ${NEXT}, 'CLOSED', 'SB-202612-0001', 1, 0, now(), now())`;
    expect(await reopen.reopenSlip(await actorOf(ids.owner), id, 'Salah hitung lembur tanggal tiga', noAnnounce)).toMatchObject({ ok: false, status: 409 });
  });

  it('slip terakhir tanpa pemberitahuan: cicilan dipercepat, Piutang Lain, bonus Hangus; Tutup lebih cepat hanya Pemilik/GM', async () => {
    delete process.env.AUTH_COOKIE_ENV;
    const owner = await actorOf(ids.owner);
    expect((await other.recordOtherDirect(owner, { employeeId: ids.budi, typeId: await otherType(), amount: 3_000_000, reason: 'Ganti rugi kerusakan mesin grooming', installments: 2, attachmentId: null }, noAnnounce)).ok).toBe(true);
    expect((await free.recordFreeDirect(owner, { employeeId: ids.budi, typeId: await bonusType(), amount: 30_000, occurredOn: '2026-11-04', fund: 'OFFICE', reason: REASON }, noAnnounce)).ok).toBe(true);
    await resign(ids.budi);
    const est = await slip.computeSlip(await personOf(ids.budi), P);
    expect(est).toMatchObject({ last: true, withoutNotice: true });
    expect(est!.forfeitBonusIds).toHaveLength(1);
    expect(est!.computation.lines.filter((l) => l.sourceKey.startsWith('other:'))).toHaveLength(2);
    const id = await slipIdOf(ids.budi);
    expect((await close(ids.hr, [id]))[0]).toMatchObject({ result: 'FAILED' });
    expect(await slip.closeSlips(await actorOf(ids.hr), { slipIds: [id], periodStart: null, early: 'Karyawan berhenti mendadak' }, noAnnounce)).toMatchObject({ ok: false, status: 403 });
    const early = await slip.closeSlips(owner, { slipIds: [id], periodStart: null, early: 'Karyawan berhenti mendadak, slip diselesaikan' }, noAnnounce);
    expect(early.ok && early.data.outcomes[0]).toMatchObject({ result: 'CLOSED' });
    expect((await sql`select last_slip, carried, net from hris.payslips where id = ${id}`)[0]).toMatchObject({ last_slip: true, carried: 0, net: 0 });
    const receivables = await sql`select deduction_group, amount, status from hris.other_receivables where payslip_id = ${id}`;
    expect(receivables).toEqual([expect.objectContaining({ deduction_group: 'c', status: 'OPEN' })]);
    expect(receivables[0].amount).toBeGreaterThan(0);
    expect(await sql`select id from hris.deduction_carryovers where employee_id = ${ids.budi}`).toHaveLength(0);
    expect((await sql`select status, payslip_id from hris.bonus_entries where employee_id = ${ids.budi}`)[0]).toMatchObject({ status: 'FORFEITED', payslip_id: id });
    expect((await sql`select action from hris.payslip_steps where payslip_id = ${id}`)[0]).toMatchObject({ action: 'EARLY_CLOSE' });
  });

  it('Piutang Lain: HR hanya melihat; Pemilik menghapuskan; sesudahnya slip asal tidak bisa dibuka kembali', async () => {
    const [row] = await sql`select id, payslip_id from hris.other_receivables where employee_id = ${ids.budi}`;
    const hr = await actorOf(ids.hr);
    expect((await reopen.receivablesScreen(hr, { status: null }))!.rows[0]).toMatchObject({ canWriteOff: false });
    expect(await reopen.writeOffReceivable(hr, row.id, 'Tidak akan ditagih karena pindah kota', noAnnounce)).toMatchObject({ ok: false, status: 403 });
    expect(await reopen.writeOffReceivable(await actorOf(ids.owner), row.id, 'Tidak akan ditagih karena pindah kota', noAnnounce)).toMatchObject({ ok: true });
    expect(await reopen.reopenSlip(await actorOf(ids.owner), Number(row.payslip_id), 'Salah hitung cicilan terakhir', noAnnounce)).toMatchObject({ ok: false, status: 409 });
  });

  it('denda berhenti tanpa pemberitahuan: bersih tersisa menjadi denda, diterima Rp0', async () => {
    await resign(ids.dodi);
    const est = await slip.computeSlip(await personOf(ids.dodi), P);
    expect(est!.computation.net).toBe(0);
    expect(est!.computation.lines.find((l) => l.lineKind === 'RESIGN_FINE')!.amount).toBeGreaterThan(0);
  });

  it('pengembalian: Potongan Lain ditiadakan sesudah terpotong kembali sebagai pendapatan di slip berikutnya; Hapuskan sisa sebelum terpotong ditolak', async () => {
    process.env.AUTH_COOKIE_ENV = 'staging';
    const owner = await actorOf(ids.owner);
    const rec = await other.recordOtherDirect(owner, { employeeId: ids.eko, typeId: await otherType(), amount: 100_000, reason: 'Ganti rugi gelas pecah di toko', installments: 1, attachmentId: null }, noAnnounce);
    expect(rec.ok).toBe(true);
    expect((await close(ids.hr, [await slipIdOf(ids.eko)]))[0]).toMatchObject({ result: 'CLOSED' });
    await sql`update hris.other_deductions set status = 'WAIVED', cancelled_at = now(), cancel_reason = 'Keberatan disetujui' where employee_id = ${ids.eko}`;
    const next = await slip.computeSlip(await personOf(ids.eko, NEXT), NEXT);
    expect(next!.computation.lines.find((l) => l.sourceKey.startsWith('refund:other:'))).toMatchObject({ section: 'INCOME', amount: 100_000 });
    const fresh = await other.recordOtherDirect(owner, { employeeId: ids.eko, typeId: await otherType(), amount: 50_000, reason: 'Ganti rugi timbangan rusak', installments: 2, attachmentId: null }, noAnnounce);
    expect(fresh.ok).toBe(true);
    expect(await other.writeOffOther(owner, fresh.ok ? fresh.data.id : 0, 'Sudah diganti sendiri oleh karyawan', noAnnounce)).toMatchObject({ ok: false, status: 409 });
  });
});
