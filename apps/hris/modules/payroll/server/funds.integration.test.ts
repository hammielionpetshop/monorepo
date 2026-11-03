import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import type { RequestHandler } from '@/modules/requests';

// L4d-2 Bonus Bebas dan Dana Disiplin & Dana Tidak Hadir (spec L4d §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
// Tanggal lampau: periode 26 Okt – 25 Nov 2026; "sekarang" 10 November 2026.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l4d2_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const NOW = new Date('2026-11-10T05:00:00Z');
const REASON = 'Membantu stok opname sampai malam';
const FUND_REASON = 'Saldo awal dari catatan HRIS lama';
const noAnnounce = async () => {};

let admin: postgres.Sql;
let sql: postgres.Sql;
let free: typeof import('./free-bonus');
let funds: typeof import('./funds');
let bonus: typeof import('./bonus');
let engine: typeof import('@/modules/requests');
let handlers: Record<string, RequestHandler>;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'owner2' | 'gm' | 'hr' | 'ani' | 'budi', number>;
let typeId: number;

describe.skipIf(!ADMIN_URL)('L4d-2: Bonus Bebas dan dua dana', () => {
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
      hr: await person('Nadia HR', 'HR'), ani: await person('Ani', 'Kasir'), budi: await person('Budi', 'Kasir'),
    };
    [{ id: typeId }] = await sql`select id from hris.bonus_types where name = 'Bonus Bebas'`;
    free = await import('./free-bonus');
    funds = await import('./funds');
    bonus = await import('./bonus');
    engine = await import('@/modules/requests');
    handlers = { free_bonus: free.freeBonusHandler(noAnnounce) };
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
  });

  afterAll(async () => {
    vi.useRealTimers();
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const input = (employeeId: number, amount: number, fund: 'OFFICE' | 'DISCIPLINE_FUND' = 'OFFICE', extra: Record<string, unknown> = {}) =>
    ({ employeeId, typeId, amount, occurredOn: '2026-11-05', fund, reason: REASON, ...extra });
  const versionOf = async (id: number) => Number((await sql`select version from hris.requests where id = ${id}`)[0].version);
  const change = async (actorId: number, kind: string, fund: string | null, amount: number, reason = FUND_REASON) =>
    funds.changeFund(await actorOf(actorId), { kind, fund, amount, reason }, noAnnounce);

  it('pagar Bonus Bebas: diri sendiri, Pemilik, GM, alasan pendek, tanggal masa depan; HR tidak bisa mencatat langsung', async () => {
    const owner = await actorOf(ids.owner);
    expect(await free.recordFreeDirect(owner, input(ids.owner, 10_000), noAnnounce)).toMatchObject({ ok: false, status: 403 });
    expect(await free.recordFreeDirect(owner, input(ids.owner2, 10_000), noAnnounce)).toMatchObject({ ok: false, status: 400 });
    expect(await free.recordFreeDirect(owner, input(ids.gm, 10_000), noAnnounce)).toMatchObject({ ok: false, status: 400 });
    expect(await free.recordFreeDirect(owner, input(ids.ani, 10_000, 'OFFICE', { reason: 'terlalu pendek' }), noAnnounce)).toMatchObject({ ok: false });
    expect(await free.recordFreeDirect(owner, input(ids.ani, 10_000, 'OFFICE', { occurredOn: '2026-11-11' }), noAnnounce)).toMatchObject({ ok: false });
    expect(await free.recordFreeDirect(await actorOf(ids.hr), input(ids.ani, 10_000), noAnnounce)).toMatchObject({ ok: false, status: 403 });
    expect(await sql`select id from hris.bonus_entries`).toHaveLength(0);
  });

  it('Pemilik mencatat langsung uang kantor: lahir Disahkan, masuk bonusesOf; HR tidak bisa membatalkan, Pemilik bisa', async () => {
    const result = await free.recordFreeDirect(await actorOf(ids.owner), input(ids.ani, 75_000), noAnnounce);
    expect(result.ok).toBe(true);
    const id = result.ok ? result.data.id : 0;
    const [row] = await sql`select *, period_start::text as period_start from hris.bonus_entries where id = ${id}`;
    expect(row).toMatchObject({ kind: 'TYPED', status: 'APPROVED', amount: 75_000, fund: 'OFFICE', period_start: '2026-10-26', employee_id: ids.ani });
    const summary = await bonus.bonusesOf(ids.ani, '2026-10-26');
    expect(summary.income).toBe(75_000);
    expect(summary.byKind.find((k) => k.label === 'Bonus Bebas')?.amount).toBe(75_000);
    expect(await bonus.rejectOrCancelBonus(await actorOf(ids.hr), id, 'Salah orang, mohon dibatalkan', noAnnounce)).toMatchObject({ ok: false, status: 403 });
    expect(await bonus.rejectOrCancelBonus(await actorOf(ids.owner2), id, 'Salah orang, mohon dibatalkan', noAnnounce)).toMatchObject({ ok: true });
    expect((await bonus.bonusesOf(ids.ani, '2026-10-26')).income).toBe(0);
  });

  it('dana: hanya Pemilik/GM; saldo awal sekali; pindah tidak melebihi saldo berjalan; mutasi tidak bisa dihapus', async () => {
    expect(await change(ids.hr, 'OPENING', 'DISCIPLINE', 100_000)).toMatchObject({ ok: false, status: 403 });
    expect(await change(ids.owner, 'OPENING', 'DISCIPLINE', 100_000)).toMatchObject({ ok: true });
    expect(await change(ids.owner, 'OPENING', 'DISCIPLINE', 50_000)).toMatchObject({ ok: false, status: 409 });
    expect(await change(ids.owner, 'OPENING', 'ABSENCE', 80_000)).toMatchObject({ ok: true });
    expect(await change(ids.owner, 'TRANSFER', null, 80_001)).toMatchObject({ ok: false });
    expect(await change(ids.gm, 'TRANSFER', null, 30_000)).toMatchObject({ ok: true });
    const state = await funds.readFundState();
    expect(state.discipline.balance).toBe(130_000);
    expect(state.absence.balance).toBe(50_000);
    const pair = await sql`select fund, amount, transfer_group from hris.fund_entries where kind = 'TRANSFER' order by amount`;
    expect(pair.map((r) => [r.fund, r.amount])).toEqual([['ABSENCE', -30_000], ['DISCIPLINE', 30_000]]);
    expect(pair[0].transfer_group).toBe(pair[1].transfer_group);
    await expect(sql`delete from hris.fund_entries`).rejects.toThrow(/tidak diizinkan/);
    await expect(sql`update hris.fund_entries set amount = 1`).rejects.toThrow(/tidak diizinkan/);
  });

  it('HR mengusulkan bersumber Dana Disiplin; pengesahan melebihi Tersedia ditolak dan usulan tetap menunggu', async () => {
    const hr = await actorOf(ids.hr);
    expect(await engine.submitRequest(hr, 'free_bonus', handlers.free_bonus, { fields: input(ids.hr, 10_000), attachmentIds: [] })).toMatchObject({ ok: false });
    const submitted = await engine.submitRequest(hr, 'free_bonus', handlers.free_bonus, { fields: input(ids.budi, 200_000, 'DISCIPLINE_FUND'), attachmentIds: [] });
    expect(submitted.ok ? null : submitted.error).toBeNull();
    const requestId = submitted.ok ? submitted.data.id : 0;
    expect((await sql`select status from hris.bonus_entries where request_id = ${requestId}`)[0].status).toBe('PENDING');
    const denied = await engine.decideRequest(await actorOf(ids.owner), requestId, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(requestId) });
    expect(denied).toMatchObject({ ok: false });
    expect(denied.ok ? '' : denied.error).toContain('kurang Rp70.000');
    expect((await sql`select status from hris.bonus_entries where request_id = ${requestId}`)[0].status).toBe('PENDING');
    expect(await change(ids.owner, 'ADJUSTMENT', 'DISCIPLINE', 70_000)).toMatchObject({ ok: true });
    const decided = await engine.decideRequest(await actorOf(ids.owner), requestId, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(requestId) });
    expect(decided.ok ? null : decided.error).toBeNull();
    const state = await funds.readFundState();
    expect(state.discipline).toMatchObject({ balance: 200_000, reserved: 200_000, available: 0 });
    // Penyesuaian kurang yang membuat Saldo < Terpesan ditolak.
    expect(await change(ids.owner, 'ADJUSTMENT', 'DISCIPLINE', -1)).toMatchObject({ ok: false });
  });

  it('dua pengesahan bersumber Dana Disiplin bersamaan tidak bisa sama-sama lolos', async () => {
    expect(await change(ids.owner, 'ADJUSTMENT', 'DISCIPLINE', 100_000)).toMatchObject({ ok: true });
    const owner = await actorOf(ids.owner);
    const results = await Promise.all([
      free.recordFreeDirect(owner, input(ids.ani, 60_000, 'DISCIPLINE_FUND'), noAnnounce),
      free.recordFreeDirect(owner, input(ids.budi, 60_000, 'DISCIPLINE_FUND'), noAnnounce),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ ok: false, status: 409 });
    expect((await funds.readFundState()).discipline.available).toBe(40_000);
  });

  it('jenis ketik: hanya Pemilik/GM; nama kembar ditolak; jenis nonaktif tidak bisa dipilih', async () => {
    expect(await free.saveBonusType(await actorOf(ids.hr), { name: 'Bonus Lebaran', defaultFund: 'OFFICE' }, noAnnounce)).toMatchObject({ ok: false, status: 403 });
    const created = await free.saveBonusType(await actorOf(ids.owner), { name: 'Bonus Lebaran', defaultFund: 'OFFICE' }, noAnnounce);
    expect(created.ok).toBe(true);
    expect(await free.saveBonusType(await actorOf(ids.owner), { name: 'bonus lebaran', defaultFund: 'OFFICE' }, noAnnounce)).toMatchObject({ ok: false, status: 409 });
    const newId = created.ok ? created.data.id : 0;
    await free.saveBonusType(await actorOf(ids.owner), { id: newId, name: 'Bonus Lebaran', defaultFund: 'OFFICE', active: false }, noAnnounce);
    expect(await free.recordFreeDirect(await actorOf(ids.owner), { ...input(ids.ani, 10_000), typeId: newId }, noAnnounce)).toMatchObject({ ok: false, status: 400 });
  });
});
