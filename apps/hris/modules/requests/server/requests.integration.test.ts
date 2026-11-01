import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// Alur Mesin Pengajuan + Ubah data diri (spec L2f-1 §7) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi;
// pagar DB-nya dites di packages/db-roles. Akun pusat digantikan peta karyawan → akun (id akun = id karyawan + 1000).
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_requests_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const REASON = 'Alasan yang cukup panjang untuk uji';

let admin: postgres.Sql;
let sql: postgres.Sql;
let uploadDir: string;
let engine: typeof import('./engine');
let queries: typeof import('./queries');
let files: typeof import('@/modules/files');
let notifications: typeof import('@/modules/notifications');
let handlers: Record<string, import('./handler').RequestHandler>;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: { owner: number; owner2: number; hr: number; admin: number; kasir: number; kasir2: number; finance: number };

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

async function upload(actor: Actor) {
  const result = await files.saveUpload(actor, new File([PNG], 'foto.png'));
  if (!result.ok) throw new Error(result.error);
  return result.data.id;
}

async function submitName(employeeId: number, name: string) {
  const actor = await actorOf(employeeId);
  const result = await engine.submitRequest(actor, 'identity_change', handlers.identity_change, { fields: { name }, attachmentIds: [] });
  if (!result.ok) throw new Error(result.error);
  return result.data.id;
}

const inbox = (employeeId: number) => sql`select kind, title, body, link from hris.notifications
  where recipient_account_id = ${employeeId + 1000} order by id`;

describe.skipIf(!ADMIN_URL)('L2f-1: Mesin Pengajuan', () => {
  beforeAll(async () => {
    const adminUrl = new URL(ADMIN_URL!);
    adminUrl.pathname = '/postgres';
    admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database "${databaseName}"`);
    const url = new URL(ADMIN_URL!);
    url.pathname = `/${databaseName}`;
    sql = postgres(url.toString(), { max: 2, onnotice: () => {} });
    await sql`create schema petshop`;
    await sql`create table petshop.branches (id serial primary key, code varchar(20) not null, name varchar(100) not null, is_active boolean not null default true)`;
    const { drizzle } = requireAuth('drizzle-orm/postgres-js');
    const { migrate } = requireAuth('drizzle-orm/postgres-js/migrator');
    const migrationClient = postgres(url.toString(), { max: 1, onnotice: () => {} });
    await migrate(drizzle(migrationClient), {
      migrationsFolder: fileURLToPath(new URL('auth/src/migrations/', root)), migrationsSchema: 'drizzle', migrationsTable: '__migrations_auth',
    });
    await migrationClient.end();
    for (const file of ['0000_init', '0001_access', '0002_employees', '0003_settings', '0004_new_badge_days', '0005_requests']) {
      await sql.unsafe(readFileSync(new URL(`hris-db/src/migrations/${file}.sql`, root), 'utf8')).simple();
    }
    const [branch] = await sql`insert into hris.branches (name) values ('Toko Pusat') returning id`;
    const person = async (name: string, position: string) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
        values (hris.next_employee_code(), ${name}, '2026-01-01', 'BCA', '1234567890') returning id`;
      const [pos] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${branch.id}, ${pos.id}, 'EMPLOYEE', '2026-01-01')`;
      return Number(row.id);
    };
    ids = {
      owner: await person('Pemilik Satu', 'Pemilik'), owner2: await person('Pemilik Dua', 'Pemilik'),
      hr: await person('Nadia HR', 'HR'), admin: await person('Admin HR', 'Admin HR'),
      kasir: await person('Budi Kasir', 'Kasir'), kasir2: await person('Citra Kasir', 'Kasir'),
      finance: await person('Dewi Finance', 'Finance'),
    };
    uploadDir = mkdtempSync(path.join(tmpdir(), 'hris-test-'));
    process.env.UPLOAD_DIR = uploadDir;
    process.env.DATABASE_URL = url.toString();
    engine = await import('./engine');
    queries = await import('./queries');
    files = await import('@/modules/files');
    notifications = await import('@/modules/notifications');
    const { identityChangeHandler } = await import('@/modules/employees');
    handlers = { identity_change: identityChangeHandler };
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
    if (uploadDir) rmSync(uploadDir, { recursive: true, force: true });
  });

  const decide = async (employeeId: number, id: number, decision: 'APPROVE' | 'REJECT', reason?: string) => {
    const [row] = await sql`select version from hris.requests where id = ${id}`;
    return engine.decideRequest(await actorOf(employeeId), id, handlers, { decision, expectedVersion: row.version, reason });
  };

  it('ajukan: data lama tetap; penyetuju diberi tahu, pengaju tidak; disetujui: data berubah, tercatat, pengaju diberi tahu', async () => {
    const id = await submitName(ids.kasir, 'Budi Santoso');
    const [before] = await sql`select name from hris.employees where id = ${ids.kasir}`;
    expect(before.name).toBe('Budi Kasir');
    for (const decider of [ids.owner, ids.owner2, ids.hr, ids.admin]) {
      expect((await inbox(decider)).at(-1)).toMatchObject({ kind: 'request.submitted', link: `/persetujuan/${id}` });
    }
    expect(await inbox(ids.kasir)).toEqual([]);
    expect(await inbox(ids.finance)).toEqual([]);

    expect(await decide(ids.hr, id, 'APPROVE')).toMatchObject({ ok: true });
    const [after] = await sql`select name from hris.employees where id = ${ids.kasir}`;
    expect(after.name).toBe('Budi Santoso');
    const [row] = await sql`select status, decided_by_employee_id from hris.requests where id = ${id}`;
    expect(row).toMatchObject({ status: 'APPROVED', decided_by_employee_id: ids.hr });
    const events = await sql`select from_status, to_status from hris.request_events where request_id = ${id} order by id`;
    expect(events).toEqual([{ from_status: null, to_status: 'PENDING' }, { from_status: 'PENDING', to_status: 'APPROVED' }]);
    const audit = await sql`select before, after from hris.audit_events where entity = 'employee' and action = 'identity_change.apply'`;
    expect(audit).toEqual([{ before: { name: 'Budi Kasir' }, after: { name: 'Budi Santoso' } }]);
    expect((await inbox(ids.kasir)).at(-1)).toMatchObject({ kind: 'request.approved', link: `/pengajuan/${id}` });
  });

  it('KAR-72: HR dan Pemilik tidak memutuskan miliknya; penyetuju lain bisa', async () => {
    const hrOwn = await submitName(ids.hr, 'Nadia Baru');
    expect(await decide(ids.hr, hrOwn, 'APPROVE')).toMatchObject({ ok: false, status: 403 });
    expect((await inbox(ids.hr)).filter((n) => n.link === `/persetujuan/${hrOwn}`)).toEqual([]);
    expect(await decide(ids.admin, hrOwn, 'APPROVE')).toMatchObject({ ok: true });

    const ownerOwn = await submitName(ids.owner, 'Pemilik Baru');
    expect(await decide(ids.owner, ownerOwn, 'APPROVE')).toMatchObject({ ok: false, status: 403 });
    expect(await decide(ids.owner2, ownerOwn, 'APPROVE')).toMatchObject({ ok: true });
  });

  it('hak per jabatan: Kasir dan Finance tidak bisa memutuskan atau melihat milik orang lain', async () => {
    const id = await submitName(ids.kasir2, 'Citra Dewi');
    expect(await decide(ids.kasir, id, 'APPROVE')).toMatchObject({ ok: false, status: 403 });
    expect(await decide(ids.finance, id, 'REJECT', REASON)).toMatchObject({ ok: false, status: 403 });
    expect(await queries.getRequestDetail(await actorOf(ids.finance), id, handlers)).toBeNull();
    expect(await queries.getRequestDetail(await actorOf(ids.kasir), id, handlers)).toBeNull();
    expect(await queries.getRequestDetail(await actorOf(ids.hr), id, handlers)).toMatchObject({ canDecide: true });
    expect(await queries.getRequestDetail(await actorOf(ids.kasir2), id, handlers)).toMatchObject({ canDecide: false, canCancel: true });
    const waitingKasir = await queries.waitingSummary(await actorOf(ids.kasir));
    expect(waitingKasir.count).toBe(0);
    expect((await queries.waitingSummary(await actorOf(ids.hr))).count).toBeGreaterThan(0);
    expect(await engine.cancelRequest(await actorOf(ids.kasir), id, 1, REASON)).toMatchObject({ ok: false, status: 403 });
    expect(await engine.cancelRequest(await actorOf(ids.kasir2), id, 1, 'pendek')).toMatchObject({ ok: false, status: 400 });
    expect(await engine.cancelRequest(await actorOf(ids.kasir2), id, 1, REASON)).toMatchObject({ ok: true });
    expect(await decide(ids.hr, id, 'APPROVE')).toMatchObject({ ok: false, status: 409 });
  });

  it('kembar ditolak; tolak wajib alasan; Ajukan ulang membawa isian lama dan menaut pengajuan lama', async () => {
    const id = await submitName(ids.kasir2, 'Citra Ulang');
    await expect(submitName(ids.kasir2, 'Citra Lagi')).rejects.toThrow(/menunggu/);
    expect(await decide(ids.hr, id, 'REJECT')).toMatchObject({ ok: false, status: 400 });
    expect(await decide(ids.hr, id, 'REJECT', REASON)).toMatchObject({ ok: true });
    expect((await inbox(ids.kasir2)).at(-1)?.body).toContain(REASON);

    const actor = await actorOf(ids.kasir2);
    expect(await queries.resubmitSource(await actorOf(ids.kasir), id, handlers)).toBeNull();
    const source = await queries.resubmitSource(actor, id, handlers);
    expect(source?.values).toEqual({ name: 'Citra Ulang' });
    const again = await engine.submitRequest(actor, 'identity_change', handlers.identity_change, {
      fields: source!.values!, attachmentIds: [], resubmittedFromId: id,
    });
    expect(again).toMatchObject({ ok: true });
    if (!again.ok) return;
    const [row] = await sql`select resubmitted_from_id from hris.requests where id = ${again.data.id}`;
    expect(row.resubmitted_from_id).toBe(id);
    await engine.cancelRequest(actor, again.data.id, 1, REASON);
  });

  it('dua keputusan bersamaan: versi basi menyebut siapa yang sudah memutuskan', async () => {
    const id = await submitName(ids.kasir2, 'Citra Rebutan');
    expect(await decide(ids.hr, id, 'REJECT', REASON)).toMatchObject({ ok: true });
    const stale = await engine.decideRequest(await actorOf(ids.admin), id, handlers, { decision: 'APPROVE', expectedVersion: 1 });
    expect(stale).toMatchObject({ ok: false, status: 409 });
    if (!stale.ok) expect(stale.error).toContain('Nadia');
    const [row] = await sql`select name from hris.employees where id = ${ids.kasir2}`;
    expect(row.name).not.toBe('Citra Rebutan');
  });

  it('data diubah sejak diajukan: persetujuan ditolak, tidak ada yang berubah, status tetap Menunggu', async () => {
    const id = await submitName(ids.kasir2, 'Citra Basi');
    await sql`update hris.employees set name = 'Citra Diubah HR' where id = ${ids.kasir2}`;
    const result = await decide(ids.hr, id, 'APPROVE');
    expect(result).toMatchObject({ ok: false, status: 409 });
    const [emp] = await sql`select name from hris.employees where id = ${ids.kasir2}`;
    expect(emp.name).toBe('Citra Diubah HR');
    const [row] = await sql`select status, version from hris.requests where id = ${id}`;
    expect(row).toEqual({ status: 'PENDING', version: 1 });
    expect(await decide(ids.hr, id, 'REJECT', REASON)).toMatchObject({ ok: true });
  });

  it('ganti rekening wajib lampiran; lampiran orang lain ditolak; lampiran hanya terbuka bagi yang berhak; rekening disamarkan', async () => {
    const actor = await actorOf(ids.kasir);
    const fields = { bankAccountNumber: '9876543210' };
    const submit = (attachmentIds: string[]) => engine.submitRequest(actor, 'identity_change', handlers.identity_change, { fields, attachmentIds });
    expect(await submit([])).toMatchObject({ ok: false, status: 400 });
    const others = await upload(await actorOf(ids.kasir2));
    expect(await submit([others])).toMatchObject({ ok: false, status: 400 });
    const mine = await upload(actor);
    const result = await submit([mine]);
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    const id = result.data.id;
    expect(await queries.attachmentAllowed(actor, id, mine)).toBe(true);
    expect(await queries.attachmentAllowed(await actorOf(ids.hr), id, mine)).toBe(true);
    expect(await queries.attachmentAllowed(await actorOf(ids.owner), id, mine)).toBe(true);
    expect(await queries.attachmentAllowed(await actorOf(ids.kasir2), id, mine)).toBe(false);
    expect(await queries.attachmentAllowed(await actorOf(ids.finance), id, mine)).toBe(false);
    expect(await queries.attachmentAllowed(actor, id, others)).toBe(false);
    expect((await files.readStoredFile(mine))?.mime).toBe('image/png');
    const masked = await handlers.identity_change.describe(id, false);
    expect(JSON.stringify(masked)).not.toContain('9876543210');
    expect(JSON.stringify(await handlers.identity_change.describe(id, true))).toContain('9876543210');
    expect(await decide(ids.hr, id, 'APPROVE')).toMatchObject({ ok: true });
    const [emp] = await sql`select bank_account_number from hris.employees where id = ${ids.kasir}`;
    expect(emp.bank_account_number).toBe('9876543210');
  });

  it('unggah menolak bukan foto; pemberitahuan: tandai terbaca hanya milik sendiri, buang hanya yang lebih dari 90 hari', async () => {
    const actor = await actorOf(ids.kasir);
    expect(await files.saveUpload(actor, new File(['<svg></svg>'], 'x.png', { type: 'image/png' }))).toMatchObject({ ok: false, status: 400 });
    const [mine] = await sql`select id from hris.notifications where recipient_account_id = ${ids.kasir + 1000} and read_at is null limit 1`;
    expect(await notifications.markRead(ids.kasir2 + 1000, Number(mine.id))).toBeNull();
    expect(await notifications.markRead(ids.kasir + 1000, Number(mine.id))).toBeTruthy();
    const count = await sql`select count(*)::int as n from hris.notifications`;
    await sql`insert into hris.notifications (recipient_account_id, kind, title, created_at) values (1, 'x', 'Lama', now() - interval '91 days')`;
    expect(await notifications.purgeOldNotifications()).toEqual({ deleted: 1 });
    const [after] = await sql`select count(*)::int as n from hris.notifications`;
    expect(after.n).toBe(count[0].n);
  });
});
