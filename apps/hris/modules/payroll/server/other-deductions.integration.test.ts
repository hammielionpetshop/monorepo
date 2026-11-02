import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import type { RequestHandler } from '@/modules/requests';

// L4c-2 Potongan Lain, Keberatan Potongan, urutan potongan (spec L4c §8) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l4c2_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const REASON = 'Uji potongan lain periode ini';
const noAnnounce = async () => {};

let admin: postgres.Sql;
let sql: postgres.Sql;
let svc: typeof import('./other-deductions');
let engine: typeof import('@/modules/requests');
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'hr' | 'ani' | 'budi', number>;
let handlers: Record<string, RequestHandler>;
let lainnya: number;

describe.skipIf(!ADMIN_URL)('L4c-2: Potongan Lain dan Keberatan', () => {
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
    ids = { owner: await person('Elan', 'Pemilik', null), hr: await person('Nadia HR', 'HR', 2_600_000), ani: await person('Ani', 'Kasir', 2_600_000), budi: await person('Budi', 'Kasir', 300_000) };
    [{ id: lainnya }] = await sql`select id from hris.other_deduction_types where name = 'Lainnya'`;
    svc = await import('./other-deductions');
    engine = await import('@/modules/requests');
    handlers = { other_deduction: svc.otherDeductionHandler(noAnnounce), deduction_objection: svc.deductionObjectionHandler(noAnnounce) } as Record<string, RequestHandler>;
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const input = (employeeId: number, amount: number, installments: number) => ({ employeeId, typeId: lainnya, amount, reason: 'Ganti rugi timbangan rusak di toko', installments, attachmentId: null });
  const versionOf = async (id: number) => Number((await sql`select version from hris.requests where id = ${id}`)[0].version);

  it('Pemilik menjalankan langsung: jadwal dibagi rata, sisa di cicilan terakhir; tidak untuk Pemilik/diri sendiri', async () => {
    const owner = await actorOf(ids.owner);
    expect((await svc.recordOtherDirect(owner, input(ids.owner, 100_000, 1), noAnnounce)).ok).toBe(false);
    expect((await svc.recordOtherDirect(owner, input(ids.ani, 100_000, 4), noAnnounce)).ok).toBe(false);
    const result = await svc.recordOtherDirect(owner, input(ids.ani, 100_000, 3), noAnnounce);
    expect(result.ok).toBe(true);
    const rows = await sql`select amount from hris.other_deduction_installments where deduction_id = ${result.ok ? result.data.id : 0} order by sequence`;
    expect(rows.map((r) => r.amount)).toEqual([33_333, 33_333, 33_334]);
    const [note] = await sql`select link from hris.notifications where kind = 'other_deduction.active'`;
    expect(note.link).toContain('/keberatan-potongan/ajukan?jenis=OTHER_DEDUCTION');
  });

  it('HR mengusulkan, Pemilik mengesahkan; HR tidak bisa membatalkan', async () => {
    const hr = await actorOf(ids.hr);
    const submitted = await engine.submitRequest(hr, 'other_deduction', handlers.other_deduction, { fields: input(ids.budi, 500_000, 1), attachmentIds: [] });
    expect(submitted.ok ? null : submitted.error).toBeNull();
    const requestId = submitted.ok ? submitted.data.id : 0;
    const decided = await engine.decideRequest(await actorOf(ids.owner), requestId, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(requestId) });
    expect(decided.ok).toBe(true);
    const [row] = await sql`select id, status from hris.other_deductions where request_id = ${requestId}`;
    expect(row.status).toBe('ACTIVE');
    expect((await svc.cancelOther(hr, row.id, 'Salah orang, mohon dibatalkan', noAnnounce)).ok).toBe(false);
  });

  it('Ubah jadwal mengganti cicilan yang belum terpotong', async () => {
    const [row] = await sql`select id from hris.other_deductions where employee_id = ${ids.ani} and status = 'ACTIVE'`;
    expect((await svc.rescheduleOther(await actorOf(ids.owner), row.id, { installments: 2, reason: 'Diminta dua kali saja' }, noAnnounce)).ok).toBe(true);
    const live = await sql`select amount from hris.other_deduction_installments where deduction_id = ${row.id} and cancelled_at is null order by sequence`;
    expect(live.map((r) => r.amount)).toEqual([50_000, 50_000]);
  });

  it('urutan potongan: pendapatan kecil → Potongan Lain terpotong sebagian, sisa dibawa', async () => {
    const { loadPayrollPeople } = await import('./data');
    const { periodStartOf } = await import('../rules/salary');
    const budi = (await loadPayrollPeople()).find((p) => p.id === ids.budi)!;
    const result = await svc.deductionsOf(budi, periodStartOf(new Date().toISOString().slice(0, 10)));
    const other = result!.items.find((i) => i.group === 'c')!;
    expect(other.amount).toBe(500_000);
    expect(result!.net).toBe(0);
    expect(other.left).toBeGreaterThan(0);
  });

  it('keberatan: hanya atas nama sendiri, disetujui = ditiadakan (cicilan ikut batal)', async () => {
    const [row] = await sql`select id from hris.other_deductions where employee_id = ${ids.budi} and status = 'ACTIVE'`;
    const fields = { target: 'OTHER_DEDUCTION', targetId: row.id, reason: 'Timbangan rusak sebelum shift saya mulai, ada saksi' };
    const notMine = await engine.submitRequest(await actorOf(ids.ani), 'deduction_objection', handlers.deduction_objection, { fields, attachmentIds: [] });
    expect(notMine.ok).toBe(false);
    const short = await engine.submitRequest(await actorOf(ids.budi), 'deduction_objection', handlers.deduction_objection, { fields: { ...fields, reason: 'tidak setuju' }, attachmentIds: [] });
    expect(short.ok).toBe(false);
    const sent = await engine.submitRequest(await actorOf(ids.budi), 'deduction_objection', handlers.deduction_objection, { fields, attachmentIds: [] });
    expect(sent.ok ? null : sent.error).toBeNull();
    const twice = await engine.submitRequest(await actorOf(ids.budi), 'deduction_objection', handlers.deduction_objection, { fields, attachmentIds: [] });
    expect(twice.ok).toBe(false);
    const requestId = sent.ok ? sent.data.id : 0;
    expect((await engine.decideRequest(await actorOf(ids.owner), requestId, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(requestId) })).ok).toBe(true);
    const [after] = await sql`select status from hris.other_deductions where id = ${row.id}`;
    expect(after.status).toBe('WAIVED');
    const [{ live }] = await sql`select count(*)::int as live from hris.other_deduction_installments where deduction_id = ${row.id} and cancelled_at is null`;
    expect(live).toBe(0);
  });

  it('keberatan lewat batas 3 hari ditolak', async () => {
    const [row] = await sql`select id from hris.other_deductions where employee_id = ${ids.ani} and status = 'ACTIVE'`;
    await sql`update hris.other_deductions set approved_at = now() - interval '5 days' where id = ${row.id}`;
    const late = await engine.submitRequest(await actorOf(ids.ani), 'deduction_objection', handlers.deduction_objection, {
      fields: { target: 'OTHER_DEDUCTION', targetId: row.id, reason: 'Saya baru tahu ada potongan ini sekarang' }, attachmentIds: [],
    });
    expect(!late.ok && late.error).toContain('Batas keberatan');
  });

  it('jenis yang dipakai tidak bisa dinonaktifkan; hanya Pemilik/GM yang mengubah', async () => {
    expect((await svc.saveDeductionType(await actorOf(ids.hr), { name: 'Ganti rugi seragam' })).ok).toBe(false);
    expect((await svc.saveDeductionType(await actorOf(ids.owner), { id: lainnya, name: 'Lainnya', active: false })).ok).toBe(false);
    expect((await svc.saveDeductionType(await actorOf(ids.owner), { name: 'Ganti rugi seragam' })).ok).toBe(true);
  });
});
