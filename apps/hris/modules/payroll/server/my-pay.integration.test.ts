import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// L4g-1 Pendapatan Saya, Slip Saya, unduh slip sendiri (spec L4g §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
// Tanggal lampau: periode 26 Okt – 25 Nov 2026; "sekarang" 10 November 2026; mode uji staging membuka Tutup.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l4g1_svc_${process.pid}_${Date.now()}`;
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
let mine: typeof import('./my-pay');
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'owner2' | 'gm' | 'hr' | 'finance' | 'ani' | 'budi' | 'cici' | 'dodi', number>;
let rekening: number;

describe.skipIf(!ADMIN_URL)('L4g-1: Pendapatan Saya dan Slip Saya', () => {
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
    rekening = Number((await sql`select id from hris.payment_sources where name = 'Rekening Kantor'`)[0].id);
    slip = await import('./payslip');
    pay = await import('./payment');
    reopen = await import('./payslip-reopen');
    mine = await import('./my-pay');
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
    actorOf(actorId).then((a) => pay.paySlips(a, { slipIds, sourceId: rekening, moneyDate: TODAY, ...extra }, noAnnounce));

  it('Perkiraan: angka sama dengan layar kantor; slip orang lain tidak ditemukan; Perkiraan tidak bisa diunduh', async () => {
    const ani = await actorOf(ids.ani);
    const office = await slip.periodScreen(await actorOf(ids.gm), P);
    const row = office!.rows.find((r) => r.employeeId === ids.ani)!;
    const screen = await mine.myPayScreen(ani, P);
    expect(screen?.slip).toMatchObject({ id: row.slipId, net: row.net, estimate: true });
    expect(screen?.slip?.state.key).toBe('ESTIMATE');
    expect(screen?.head).toMatchObject({ income: row.net, received: 0, pending: row.net, estimate: true });
    expect(screen?.upah.some((u) => u.label === 'Gaji tetap (perkiraan)')).toBe(true);
    expect(await mine.mySlipScreen(ani, await slipIdOf(ids.budi), null)).toBeNull();
    expect(await mine.myPrintScreen(ani, { slipId: row.slipId, periods: [] })).toBeNull();
    expect(await mine.hasMyPay(ani)).toBe(true);
  });

  it('Ditutup lalu Dibayar transfer: status bayar dengan 4 angka rekening, tanpa sumber uang; tautan pemberitahuan ke Slip Saya', async () => {
    expect((await close([ids.ani])).every((o) => o.result === 'CLOSED')).toBe(true);
    const id = await slipIdOf(ids.ani);
    const ani = await actorOf(ids.ani);
    const before = await mine.mySlipScreen(ani, id, null);
    expect(before && !before.old && before.state.key).toBe('CLOSED');
    const paid = await payOf(ids.owner, [id]);
    expect(paid.ok && paid.data.outcomes[0].result).toBe('PAID');
    const after = await mine.mySlipScreen(ani, id, null);
    expect(after && !after.old && after.state).toMatchObject({ key: 'PAID', text: 'Dibayar 10 November 2026 lewat transfer ke rekening ****7890.' });
    expect(JSON.stringify(after)).not.toMatch(/Rekening Kantor/);
    const screen = await mine.myPayScreen(ani, P);
    expect(screen?.head).toMatchObject({ received: screen?.slip?.net, pending: 0, estimate: false });
    const links = await sql`select kind, link from hris.notifications where kind in ('payslip.closed', 'payslip.paid') order by id`;
    expect(links.map((l) => l.link)).toEqual([`/pendapatan/slip/${id}`, `/pendapatan/slip/${id}`]);
  });

  it('unduh slip tertutup sendiri tercatat; lebih dari 12 periode ditolak', async () => {
    const ani = await actorOf(ids.ani);
    const id = await slipIdOf(ids.ani);
    expect((await mine.myPrintScreen(ani, { slipId: id, periods: [] }))?.slips).toHaveLength(1);
    expect((await mine.myPrintScreen(ani, { slipId: null, periods: [P] }))?.slips).toHaveLength(1);
    const many = Array.from({ length: 13 }, (_, i) => `2026-${String((i % 12) + 1).padStart(2, '0')}-26`).concat('2025-01-26');
    expect(await mine.myPrintScreen(ani, { slipId: null, periods: many })).toBeNull();
    const steps = await sql`select action from hris.payslip_steps where action like 'SELF_%' order by id`;
    expect(steps.map((s) => s.action)).toEqual(['SELF_DOWNLOAD', 'SELF_DOWNLOAD_MANY']);
  });

  it('dibuka kembali: Sedang dibetulkan dengan alasan; versi lama bisa dibuka hanya baca', async () => {
    await close([ids.budi]);
    const id = await slipIdOf(ids.budi);
    const done = await reopen.reopenSlip(await actorOf(ids.owner), id, 'Tunjangan salah ketik di slip ini', noAnnounce);
    expect(done.ok).toBe(true);
    const budi = await actorOf(ids.budi);
    const now = await mine.mySlipScreen(budi, id, null);
    expect(now && !now.old && now.state).toMatchObject({ key: 'REOPENED', text: expect.stringMatching(/Tunjangan salah ketik/) });
    expect(now?.versions).toEqual([1]);
    const old = await mine.mySlipScreen(budi, id, 1);
    expect(old?.old && old.view.version).toBe(1);
    expect(await mine.mySlipScreen(budi, id, 5)).toBeNull();
  });
});
