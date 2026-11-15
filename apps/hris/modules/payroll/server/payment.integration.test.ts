import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// L4f-1 Bayar Slip, Batal bayar, slip Rp0, Jadwal Bayar, Daftar Transfer (spec L4f §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
// Tanggal lampau: periode 26 Okt – 25 Nov 2026; "sekarang" 10 November 2026; mode uji staging membuka Tutup.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l4f1_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const NOW = new Date('2026-11-10T05:00:00Z');
const TODAY = '2026-11-10';
const P = '2026-10-26';
const noAnnounce = async () => {};

let admin: postgres.Sql;
let sql: postgres.Sql;
let slip: typeof import('./payslip');
let pay: typeof import('./payment');
let reopen: typeof import('./payslip-reopen');
let other: typeof import('./other-deductions');
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'owner2' | 'gm' | 'hr' | 'finance' | 'ani' | 'budi' | 'cici' | 'dodi', number>;
let brankas: number;

describe.skipIf(!ADMIN_URL)('L4f-1: Bayar slip', () => {
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
    const person = async (name: string, position: string, bank: string | null = 'BCA') => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number, bank_account_holder)
        values (hris.next_employee_code(), ${name}, '2026-01-01', ${bank}, ${bank ? '1234567890' : null}, ${bank ? name : null}) returning id`;
      const [p] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${pusat}, ${p.id}, 'EMPLOYEE', '2026-01-01')`;
      const [pkg] = await sql`insert into hris.salary_changes (employee_id, effective_from, origin, reason, created_by_account_id)
        values (${row.id}, '2026-01-26', 'DIRECT', 'Gaji awal karyawan uji', 1) returning id`;
      await sql`insert into hris.salary_change_lines (change_id, component_type_id, amount) values (${pkg.id}, ${pokok}, 2600000)`;
      return Number(row.id);
    };
    ids = {
      owner: await person('Elan', 'Pemilik'), owner2: await person('Irma', 'Pemilik'), gm: await person('Gina', 'GM'), hr: await person('Nadia HR', 'HR'),
      finance: await person('Fani', 'Finance'), ani: await person('Ani', 'Kasir'), budi: await person('Budi', 'Kasir', 'Mandiri'), cici: await person('Cici', 'Kasir', null),
      dodi: await person('Dodi', 'Kasir'),
    };
    brankas = Number((await sql`insert into petshop.money_places (name, kind, branch_id) values ('Brankas', 'CASH', 1) returning id`)[0].id);
    slip = await import('./payslip');
    pay = await import('./payment');
    reopen = await import('./payslip-reopen');
    other = await import('./other-deductions');
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
  // Ditutup GM: Pemilik tidak menutup slipnya sendiri (spec L4e §9 butir 6).
  const close = async (employeeIds: number[]) => {
    const gm = await actorOf(ids.gm);
    await slip.periodScreen(gm, P);
    const result = await slip.closeSlips(gm, { slipIds: await Promise.all(employeeIds.map(slipIdOf)), periodStart: null }, noAnnounce);
    if (!result.ok) throw new Error(result.error);
    return result.data.outcomes;
  };
  const payOf = (actorId: number, slipIds: number[], extra: Record<string, unknown> = {}) =>
    actorOf(actorId).then((a) => pay.paySlips(a, { slipIds, sourceId: brankas, moneyDate: TODAY, ...extra }, noAnnounce));

  it('hak: HR, Finance ditolak; Pemilik tidak membayar slipnya sendiri; slip Perkiraan tidak ikut', async () => {
    expect((await close([ids.ani, ids.budi, ids.cici, ids.owner, ids.gm])).every((o) => o.result === 'CLOSED')).toBe(true);
    const ani = await slipIdOf(ids.ani);
    expect(await payOf(ids.hr, [ani])).toMatchObject({ ok: false, status: 403 });
    expect(await payOf(ids.finance, [ani])).toMatchObject({ ok: false, status: 403 });
    const own = await payOf(ids.owner, [await slipIdOf(ids.owner)]);
    expect(own.ok && own.data.outcomes[0]).toMatchObject({ result: 'FAILED', text: expect.stringMatching(/sendiri/) });
    const gmOwn = await payOf(ids.gm, [await slipIdOf(ids.gm)]);
    expect(gmOwn.ok && gmOwn.data.outcomes[0]).toMatchObject({ result: 'PAID' });
    const estimate = await payOf(ids.owner, [await slipIdOf(ids.dodi)]);
    expect(estimate.ok && estimate.data.outcomes[0]).toMatchObject({ result: 'FAILED', text: 'Slip belum ditutup.' });
  });

  it('sumber uang: Laci kasir dan Tempat Uang nonaktif ditolak; daftar pilihan tanpa keduanya (F2-1b)', async () => {
    const [{ id: drawer }] = await sql`insert into petshop.money_places (name, kind, branch_id, held_by) values ('Laci Kasir Uji', 'DRAWER', 1, 'STORE') returning id`;
    const [{ id: closed }] = await sql`insert into petshop.money_places (name, kind, branch_id, is_active) values ('Kas Lama', 'CASH', 1, false) returning id`;
    const ani = await slipIdOf(ids.ani);
    expect(await payOf(ids.owner, [ani], { sourceId: Number(drawer) })).toMatchObject({ ok: false, status: 400 });
    expect(await payOf(ids.owner, [ani], { sourceId: Number(closed) })).toMatchObject({ ok: false, status: 400 });
    const preview = await pay.payPreviewScreen(await actorOf(ids.owner), [ani]);
    expect(preview?.sources.map((s) => s.name)).toEqual(['Brankas']);
  });

  it('tanggal uang: masa depan dan mundur > 7 hari tanpa alasan ditolak', async () => {
    const ani = await slipIdOf(ids.ani);
    expect(await payOf(ids.owner, [ani], { moneyDate: '2026-11-11' })).toMatchObject({ ok: false, status: 400 });
    const early = await payOf(ids.owner, [ani], { moneyDate: '2026-11-01', dateReason: 'Dibayar tunai sebelum ditandai di sistem' });
    expect(early.ok && early.data.outcomes[0]).toMatchObject({ result: 'FAILED', text: expect.stringMatching(/sebelum slip ditutup/) });
  });

  it('bayar banyak: satu gagal tidak membatalkan yang lain; bayar dua kali (juga bersamaan) hanya sekali', async () => {
    const [ani, budi] = [await slipIdOf(ids.ani), await slipIdOf(ids.budi)];
    const both = await Promise.all([payOf(ids.owner, [ani, budi, 999_999]), payOf(ids.owner2, [ani])]);
    const outcomes = both.flatMap((r) => (r.ok ? r.data.outcomes : []));
    expect(outcomes.filter((o) => o.slipId === ani && o.result === 'PAID')).toHaveLength(1);
    expect(outcomes.find((o) => o.slipId === budi)).toMatchObject({ result: 'PAID' });
    expect(outcomes.find((o) => o.slipId === 999_999)).toMatchObject({ result: 'FAILED' });
    const again = await payOf(ids.owner, [ani]);
    expect(again.ok && again.data.outcomes[0]).toMatchObject({ result: 'FAILED', text: expect.stringMatching(/Sudah dibayar oleh/) });
    const [row] = await sql`select kind, amount, method, status, breakdown from hris.payslip_payments where payslip_id = ${ani} and status = 'ACTIVE'`;
    const [net] = await sql`select net from hris.payslips where id = ${ani}`;
    expect(row).toMatchObject({ kind: 'MONEY', amount: net.net, method: 'CASH', status: 'ACTIVE' });
    expect(row.breakdown).toMatchObject({ net: net.net, branchName: 'Toko Pusat', ownerAndGmSalary: false });
  });

  it('buka kembali slip Dibayar ditolak; batal bayar → Ditutup lagi, bisa dibayar ulang', async () => {
    const ani = await slipIdOf(ids.ani);
    expect(await reopen.reopenSlip(await actorOf(ids.owner), ani, 'Salah hitung lembur tanggal tiga', noAnnounce)).toMatchObject({ ok: false, status: 409, error: expect.stringMatching(/Batalkan pembayarannya/) });
    expect(await pay.cancelPayment(await actorOf(ids.hr), ani, 'Salah sumber uang dipilih kemarin', noAnnounce)).toMatchObject({ ok: false, status: 403 });
    expect(await pay.cancelPayment(await actorOf(ids.owner), ani, 'pendek', noAnnounce)).toMatchObject({ ok: false, status: 400 });
    expect(await pay.cancelPayment(await actorOf(ids.owner), ani, 'Salah sumber uang dipilih kemarin', noAnnounce)).toMatchObject({ ok: true });
    expect((await sql`select status, cancel_reason from hris.payslip_payments where payslip_id = ${ani} order by id`)).toMatchObject([{ status: 'CANCELLED', cancel_reason: 'Salah sumber uang dipilih kemarin' }]);
    const again = await payOf(ids.owner, [ani]);
    expect(again.ok && again.data.outcomes[0]).toMatchObject({ result: 'PAID' });
    expect((await sql`select action from hris.payslip_steps where payslip_id = ${ani} and action like 'PAY%' order by id`).map((s) => s.action)).toEqual(['PAY', 'PAY_CANCEL', 'PAY']);
  });

  it('slip bersih Rp0 langsung Dibayar tanpa uang; buka kembali membaliknya', async () => {
    const owner = await actorOf(ids.owner);
    const typeId = Number((await sql`select id from hris.other_deduction_types order by sort_order limit 1`)[0].id);
    expect((await other.recordOtherDirect(owner, { employeeId: ids.dodi, typeId, amount: 3_000_000, reason: 'Ganti rugi kerusakan mesin grooming', installments: 1, attachmentId: null }, noAnnounce)).ok).toBe(true);
    expect((await close([ids.dodi]))[0]).toMatchObject({ result: 'CLOSED' });
    const dodi = await slipIdOf(ids.dodi);
    expect((await sql`select net from hris.payslips where id = ${dodi}`)[0].net).toBe(0);
    expect((await sql`select kind, status from hris.payslip_payments where payslip_id = ${dodi}`)).toMatchObject([{ kind: 'NO_MONEY', status: 'ACTIVE' }]);
    const schedule = await pay.payScheduleScreen(owner);
    expect(schedule!.groups.flatMap((g) => g.rows).some((r) => r.slipId === dodi)).toBe(false);
    expect(await reopen.reopenSlip(owner, dodi, 'Potongan ganti rugi perlu dicicil dua kali', noAnnounce)).toMatchObject({ ok: true });
    expect((await sql`select status from hris.payslip_payments where payslip_id = ${dodi}`)).toMatchObject([{ status: 'CANCELLED' }]);
  });

  it('Jadwal Bayar dan Daftar Transfer: Finance tanpa nama, tanpa jabatan bertanda; tiap buka dan unduh dicatat', async () => {
    const cici = await slipIdOf(ids.cici);
    const owner = await pay.payScheduleScreen(await actorOf(ids.owner));
    const rows = owner!.groups.flatMap((g) => g.rows);
    expect(rows.map((r) => r.slipId)).toEqual(expect.arrayContaining([cici, await slipIdOf(ids.owner)]));
    expect(rows.find((r) => r.slipId === cici)).toMatchObject({ account: null, bucket: 'TODAY' });
    const finance = await pay.payScheduleScreen(await actorOf(ids.finance));
    expect(finance!.payer).toBe(false);
    expect(finance!.groups.every((g) => g.rows.length === 0)).toBe(true);
    // Slip Pemilik (jabatan bertanda) tidak terhitung untuk Finance.
    expect(finance!.groups[0].count).toBe(owner!.groups[0].count - 1);
    expect(await pay.payScheduleScreen(await actorOf(ids.hr))).toBeNull();
    const list = await pay.transferScreen(await actorOf(ids.finance), P);
    expect(list!.rows.map((r) => r.name)).toEqual(['Cici']);
    const file = await pay.transferDownload(await actorOf(ids.finance), P);
    expect(file!.csv).toContain('Belum ada rekening');
    expect(await pay.transferScreen(await actorOf(ids.hr), P)).toBeNull();
    expect((await sql`select action from hris.payslip_steps where action like 'TRANSFER%' order by id`).map((s) => s.action)).toEqual(['TRANSFER_VIEW', 'TRANSFER_DOWNLOAD']);
  });

  it('periode Lunas bila semua slip Dibayar', async () => {
    const owner = await actorOf(ids.owner);
    expect((await payOf(ids.owner2, [await slipIdOf(ids.owner), await slipIdOf(ids.cici)])).ok).toBe(true);
    expect((await close([ids.hr, ids.finance, ids.owner2, ids.dodi])).every((o) => o.result === 'CLOSED')).toBe(true);
    const rest = await sql`select s.id from hris.payslips s where s.period_start = ${P} and s.net > 0
      and not exists (select 1 from hris.payslip_payments p where p.payslip_id = s.id and p.status = 'ACTIVE') and s.employee_id <> ${ids.owner2}`;
    expect((await payOf(ids.owner, rest.map((r) => Number(r.id)))).ok).toBe(true);
    expect((await payOf(ids.owner, [await slipIdOf(ids.owner2)])).ok).toBe(true);
    const periods = await slip.periodsScreen(owner);
    expect(periods!.rows.find((r) => r.start === P)).toMatchObject({ status: 'Lunas' });
  });
});
