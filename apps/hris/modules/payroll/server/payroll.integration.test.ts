import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import type { RequestHandler } from '@/modules/requests';
import { effectiveChoices } from '../rules/salary';

// Komponen gaji (spec L4a §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi (pola L3h).
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_payroll_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const REASON = 'Kenaikan tahunan untuk uji gaji';

let admin: postgres.Sql;
let sql: postgres.Sql;
let write: typeof import('./write');
let screens: typeof import('./screens');
let engine: typeof import('@/modules/requests');
let handlers: Record<string, RequestHandler>;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'owner2' | 'gm' | 'hr' | 'ani' | 'budi' | 'tia' | 'driver', number>;
let choices: string[];
const noAnnounce = async () => {};
const types = { pokok: 0, jabatan: 0, tetap: 0 };

describe.skipIf(!ADMIN_URL)('L4a: Komponen Gaji', () => {
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
    const { todayWib } = await import('@/modules/employees');
    choices = effectiveChoices(todayWib());
    const [{ id: pusat }] = await sql`insert into hris.branches (name, latitude, longitude) values ('Toko Pusat', -6.2, 106.8) returning id`;
    const person = async (name: string, position: string, status = 'EMPLOYEE') => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
        values (hris.next_employee_code(), ${name}, '2026-01-01', 'BCA', '1234567890') returning id`;
      const [pos] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${pusat}, ${pos.id}, ${status}, '2026-01-01')`;
      return Number(row.id);
    };
    ids = {
      owner: await person('Elan', 'Pemilik'), owner2: await person('Irma', 'Pemilik'), gm: await person('Gilang', 'GM'),
      hr: await person('Nadia HR', 'HR'), ani: await person('Ani', 'Kasir'), budi: await person('Budi', 'Pramuniaga'),
      tia: await person('Tia', 'Kasir', 'TRAINING'), driver: await person('Dodi', 'Driver'),
    };
    for (const row of await sql`select id, name from hris.salary_component_types`) {
      if (row.name === 'Gaji Pokok') types.pokok = Number(row.id);
      if (row.name === 'Tunjangan Jabatan') types.jabatan = Number(row.id);
      if (row.name === 'Tunjangan Tetap') types.tetap = Number(row.id);
    }
    write = await import('./write');
    screens = await import('./screens');
    engine = await import('@/modules/requests');
    handlers = { salary_change: write.salaryChangeHandler(noAnnounce) as unknown as RequestHandler };
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const lines = (pokok: number, extra: Record<string, number> = {}) => [
    { componentTypeId: types.pokok, amount: pokok },
    ...Object.entries(extra).map(([key, amount]) => ({ componentTypeId: types[key as keyof typeof types], amount })),
  ];
  const change = async (by: number, employeeId: number, effectiveFrom: string, pkg: { componentTypeId: number; amount: number }[]) =>
    write.changeSalary(await actorOf(by), { employeeId, effectiveFrom, lines: pkg, reason: REASON }, noAnnounce);
  const propose = async (by: number, employeeId: number, effectiveFrom: string, pkg: { componentTypeId: number; amount: number }[]) =>
    engine.submitRequest(await actorOf(by), 'salary_change', handlers.salary_change, {
      fields: { employeeId, effectiveFrom, lines: pkg, reason: REASON }, attachmentIds: [],
    });
  const versionOf = async (id: number) => Number((await sql`select version from hris.requests where id = ${id}`)[0].version);

  it('Pemilik mengisi gaji pertama di periode berjalan; orangnya diberi tahu tanpa nominal', async () => {
    const saved = await change(ids.owner, ids.ani, choices[0], lines(2_400_000, { jabatan: 200_000 }));
    expect(saved.ok).toBe(true);
    const person = await screens.salaryPersonScreen(await actorOf(ids.owner), ids.ani);
    expect(person?.current?.total).toBe(2_600_000);
    const [note] = await sql`select title from hris.notifications where recipient_account_id = ${ids.ani + 1000} order by id desc limit 1`;
    expect(note.title).toMatch(/^Gaji Anda berubah mulai/);
    expect(note.title).not.toMatch(/Rp/);
  });

  it('penurunan hanya periode depan; tanggal bukan 26 ditolak (GAJ-63)', async () => {
    expect(await change(ids.owner, ids.ani, choices[0], lines(2_000_000))).toMatchObject({ ok: false, status: 400 });
    expect(await change(ids.owner, ids.ani, '2026-11-01', lines(2_000_000))).toMatchObject({ ok: false });
    expect((await change(ids.owner, ids.ani, choices[1], lines(2_500_000))).ok).toBe(true);
  });

  it('paket baru di tanggal yang sama menggantikan yang lama; batalkan hanya sebelum berlaku', async () => {
    expect((await change(ids.owner, ids.ani, choices[1], lines(2_550_000))).ok).toBe(true);
    const rows = await sql`select id, cancelled_at, cancel_reason from hris.salary_changes where employee_id = ${ids.ani} and effective_from = ${choices[1]} order by id`;
    expect(rows).toHaveLength(2);
    expect(rows[0].cancel_reason).toMatch(/Diganti/);
    const owner = await actorOf(ids.owner);
    expect((await write.cancelSalaryChange(owner, Number(rows[1].id), REASON, noAnnounce)).ok).toBe(true);
    const [active] = await sql`select id from hris.salary_changes where employee_id = ${ids.ani} and effective_from = ${choices[0]}`;
    expect(await write.cancelSalaryChange(owner, Number(active.id), REASON, noAnnounce)).toMatchObject({ ok: false, status: 409 });
  });

  it('HR tidak bisa mengubah langsung; usulan HR diputuskan Pemilik dan tidak tampil ke orangnya', async () => {
    expect(await change(ids.hr, ids.budi, choices[0], lines(2_000_000))).toMatchObject({ ok: false, status: 403 });
    const sent = await propose(ids.hr, ids.budi, choices[0], lines(2_100_000, { tetap: 100_000 }));
    expect(sent.ok).toBe(true);
    const requestId = (sent as { ok: true; data: { id: number } }).data.id;
    expect(await propose(ids.hr, ids.budi, choices[0], lines(2_200_000))).toMatchObject({ ok: false });
    expect((await engine.listMyRequests(await actorOf(ids.budi)))?.cards.some((r) => r.id === requestId)).toBe(false);
    expect((await screens.salaryListScreen(await actorOf(ids.hr))).rows.find((r) => r.id === ids.budi)?.pendingProposal).toBe(true);
    const decided = await engine.decideRequest(await actorOf(ids.owner), requestId, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(requestId) });
    expect(decided.ok).toBe(true);
    const [pkg] = await sql`select origin::text as origin, proposed_by_account_id from hris.salary_changes where request_id = ${requestId}`;
    expect(pkg).toMatchObject({ origin: 'PROPOSAL', proposed_by_account_id: ids.hr + 1000 });
    expect((await screens.salaryPersonScreen(await actorOf(ids.hr), ids.budi))?.current?.total).toBe(2_200_000);
  });

  it('HR tidak melihat gaji Pemilik dan GM sama sekali (KAR-83) dan tidak mengusulkan untuk dirinya', async () => {
    expect((await change(ids.owner2, ids.owner, choices[0], lines(10_000_000))).ok).toBe(true);
    const hr = await actorOf(ids.hr);
    const list = await screens.salaryListScreen(hr);
    expect(list.rows.some((r) => r.id === ids.owner || r.id === ids.gm)).toBe(false);
    expect(await screens.salaryPersonScreen(hr, ids.owner)).toBeNull();
    expect(await propose(ids.hr, ids.owner, choices[1], lines(1_000))).toMatchObject({ ok: false, status: 404 });
    expect(await propose(ids.hr, ids.hr, choices[1], lines(1_000))).toMatchObject({ ok: false, status: 403 });
    expect((await screens.salaryListScreen(await actorOf(ids.owner))).rows.some((r) => r.id === ids.gm)).toBe(true);
  });

  it('Pemilik tidak mengubah gajinya sendiri; GM boleh (GAJ-62)', async () => {
    expect(await change(ids.owner, ids.owner, choices[1], lines(11_000_000))).toMatchObject({ ok: false, status: 403 });
    expect((await change(ids.gm, ids.gm, choices[0], lines(8_000_000))).ok).toBe(true);
  });

  it('Driver (dasar gaji mingguan) tidak tampil di Gaji Karyawan; Belum ada gaji terhitung', async () => {
    const list = await screens.salaryListScreen(await actorOf(ids.owner));
    expect(list.rows.some((r) => r.id === ids.driver)).toBe(false);
    expect(list.rows.find((r) => r.id === ids.tia)?.missing).toBe(true);
    expect(await screens.missingSalaryCount(await actorOf(ids.hr))).toBeGreaterThan(0);
  });

  it('jenis yang dipakai tidak bisa dinonaktifkan; nama kembar ditolak', async () => {
    const owner = await actorOf(ids.owner);
    const blocked = await write.setComponentTypeActive(owner, types.jabatan, false);
    expect(blocked).toMatchObject({ ok: false, status: 409 });
    expect((blocked as { error: string }).error).toMatch(/Ani/);
    expect(await write.saveComponentType(owner, { name: 'gaji pokok', sortOrder: 9 })).toMatchObject({ ok: false, status: 409 });
    expect(await write.saveComponentType(await actorOf(ids.hr), { name: 'Uang Makan', sortOrder: 9 })).toMatchObject({ ok: false, status: 403 });
  });

  it('promosi Training: Gaji Standar Karyawan dijadwalkan, komponen lain dibawa (GAJ-64)', async () => {
    const owner = await actorOf(ids.owner);
    expect((await change(ids.owner, ids.tia, choices[0], lines(1_800_000, { tetap: 100_000 }))).ok).toBe(true);
    expect((await write.saveStandard(owner, { kind: 'EMPLOYEE', effectiveFrom: choices[0], lines: lines(2_400_000, { jabatan: 150_000 }), reason: REASON })).ok).toBe(true);
    const { db } = await import('@/lib/db');
    await db.transaction((tx) => write.schedulePromotionSalary(tx, { employeeId: ids.tia, effectiveOn: choices[1], actorAccountId: ids.owner + 1000 }));
    const [pkg] = await sql`select id, origin::text as origin from hris.salary_changes where employee_id = ${ids.tia} and effective_from = ${choices[1]} and cancelled_at is null`;
    expect(pkg.origin).toBe('STANDARD_PROMOTION');
    const amounts = await sql`select component_type_id, amount from hris.salary_change_lines where change_id = ${pkg.id} order by component_type_id`;
    expect(amounts.map((a) => [Number(a.component_type_id), a.amount])).toEqual([[types.pokok, 2_400_000], [types.jabatan, 150_000], [types.tetap, 100_000]]);
  });

  it('usulan lewat batas menjadi Hangus lewat mesin (spec L4a §6)', async () => {
    const sent = await propose(ids.hr, ids.ani, choices[2], lines(2_700_000));
    expect(sent.ok).toBe(true);
    const requestId = (sent as { ok: true; data: { id: number } }).data.id;
    await sql`update hris.salary_change_proposals set deadline_on = '2020-01-29' where request_id = ${requestId}`;
    expect((await write.runSalaryProposalExpire()).expired).toBe(1);
    const [row] = await sql`select r.status::text as status, p.state from hris.requests r join hris.salary_change_proposals p on p.request_id = r.id where r.id = ${requestId}`;
    expect(row).toMatchObject({ status: 'EXPIRED', state: 'CLOSED' });
  });

  it('pagar DB: tanggal harus 26, isi paket tidak bisa diubah atau dihapus', async () => {
    await expect(sql`insert into hris.salary_changes (employee_id, effective_from, origin, reason, created_by_account_id)
      values (${ids.ani}, '2027-05-01', 'DIRECT', 'x', 1)`).rejects.toThrow();
    await expect(sql`update hris.salary_change_lines set amount = 1`).rejects.toThrow();
    await expect(sql`delete from hris.salary_changes`).rejects.toThrow();
    await expect(sql`update hris.salary_changes set reason = 'diubah' where employee_id = ${ids.ani}`).rejects.toThrow();
  });
});
