import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// LT3a Laporan Muat (spec LT1 §15.1) pada DB sintetis dengan stub kasir. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_lt3a_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const DAY = '2026-11-06';
const REASON = 'Salah pilih nota toko';
const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], 'foto.jpg', { type: 'image/jpeg' });

let admin: postgres.Sql;
let sql: postgres.Sql;
let actorOf: (employeeId: number) => Promise<Actor>;
let ids: Record<'tp1' | 'tp2' | 'gk' | 'mk' | 'owner', number>;
let lg: typeof import('@/modules/logistics');
let creatable: typeof import('./load-reports').creatableBranches;
const pos: Record<string, number> = {};
let tpBranch = 0;
let reportId = 0;

describe.skipIf(!ADMIN_URL)('LT3a: Laporan Muat', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ now: new Date(`${DAY}T09:00:00+07:00`), toFake: ['Date'] });
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
    await sql`insert into petshop.branches (code, name) values ('GDG', 'Gudang'), ('TP', 'Toko Pusat')`;
    for (const folder of [new URL('logistics/src/migrations/', root), new URL('hris-db/src/migrations/', root)]) {
      for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()) {
        if (folder.pathname.includes('hris-db') && file.startsWith('0031')) {
          await sql`insert into hris.branches (name, kasir_branch_id) values ('Gudang', 1), ('Toko Pusat', 2)`;
        }
        await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();
      }
    }
    process.env.DATABASE_URL = url.toString();
    process.env.AUTH_COOKIE_ENV = 'staging';
    const branchId = async (name: string) => Number((await sql`select id from hris.branches where name = ${name}`)[0].id);
    tpBranch = await branchId('Toko Pusat');
    const gudang = await branchId('Gudang');
    const person = async (name: string, position: string, branch: number) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on) values (hris.next_employee_code(), ${name}, '2026-01-01') returning id`;
      const [p] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${branch}, ${p.id}, 'EMPLOYEE', '2026-01-01')`;
      return Number(row.id);
    };
    ids = {
      tp1: await person('Kasir Pusat', 'Kasir', tpBranch), tp2: await person('Pramu Pusat', 'Pramuniaga', tpBranch),
      gk: await person('Kasir Gudang', 'Kasir', gudang), mk: await person('Marketing Uji', 'Marketing', gudang), owner: await person('Elan', 'Pemilik', gudang),
    };
    const customer = async (name: string) => Number((await sql`insert into petshop.customers (code, name) values (${name.slice(-3)}, ${name}) returning id`)[0].id);
    pos.sinar = await customer('Toko Sinar');
    pos.maju = await customer('Toko Maju');
    const sale = async (number: string, branch: number, customerId: number | null, opts: { status?: string; at?: string } = {}) => {
      const [row] = await sql`insert into petshop.transactions (trx_number, payable_amount, created_at, branch_id, customer_id, status, revision, delivery_method)
        values (${number}, 150000, ${opts.at ?? '2026-11-05 02:00:00'}::text::timestamp, ${branch}, ${customerId}, ${opts.status ?? 'COMPLETED'}, 1, 'PICKUP') returning id`;
      return Number(row.id);
    };
    pos.s1 = await sale('TRX-1', 2, pos.sinar);
    pos.s2 = await sale('TRX-2', 2, pos.sinar);
    pos.s3 = await sale('TRX-3', 2, pos.maju);
    pos.void = await sale('TRX-VOID', 2, pos.sinar, { status: 'VOIDED' });
    pos.old = await sale('TRX-OLD', 2, pos.sinar, { at: '2026-10-20 02:00:00' });
    pos.walkin = await sale('TRX-UMUM', 2, null);
    pos.gudang = await sale('TRX-GDG', 1, pos.sinar);

    lg = await import('@/modules/logistics');
    creatable = (await import('./load-reports')).creatableBranches;
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

  it('saklar cabang: hanya Toko Pusat yang menyala; pembuat cabang itu dan Pemilik', async () => {
    expect((await creatable(await actorOf(ids.tp1))).map((b) => b.name)).toEqual(['Toko Pusat']);
    expect(await creatable(await actorOf(ids.gk))).toEqual([]);
    expect((await creatable(await actorOf(ids.owner))).map((b) => b.name)).toEqual(['Toko Pusat']);
    expect(await creatable(await actorOf(ids.mk))).toEqual([]);
  });

  it('nota yang boleh dipilih: berpelanggan, tidak batal, 7 hari, cabang kasir sendiri', async () => {
    const rows = await lg.candidateNotes(await actorOf(ids.tp1), tpBranch);
    expect(rows!.map((r) => r.trxNumber).sort()).toEqual(['TRX-1', 'TRX-2', 'TRX-3']);
    expect(await lg.candidateNotes(await actorOf(ids.gk), tpBranch)).toBeNull();
    const onlySinar = await lg.candidateNotes(await actorOf(ids.tp1), tpBranch, { customerId: pos.maju });
    expect(onlySinar!.map((r) => r.trxNumber)).toEqual(['TRX-3']);
  });

  it('buat laporan: satu toko, nota batal / nota cabang lain ditolak, satu nota satu laporan', async () => {
    const tp1 = await actorOf(ids.tp1);
    expect(await lg.createLoadReport(tp1, { branchId: tpBranch, transactionIds: [pos.s1, pos.s3] })).toMatchObject({ ok: false, status: 400 });
    expect(await lg.createLoadReport(tp1, { branchId: tpBranch, transactionIds: [pos.void] })).toMatchObject({ ok: false, status: 400 });
    expect(await lg.createLoadReport(tp1, { branchId: tpBranch, transactionIds: [pos.gudang] })).toMatchObject({ ok: false, status: 400 });
    expect(await lg.createLoadReport(await actorOf(ids.gk), { branchId: tpBranch, transactionIds: [pos.s1] })).toMatchObject({ ok: false, status: 403 });
    const made = await lg.createLoadReport(tp1, { branchId: tpBranch, transactionIds: [pos.s1, pos.s2] });
    expect(made.ok).toBe(true);
    reportId = made.ok ? made.data.id : 0;
    const [row] = await sql`select customer_id, status, kasir_branch_id from logistics.load_reports where id = ${reportId}`;
    expect(row).toMatchObject({ customer_id: pos.sinar, status: 'DRAFT', kasir_branch_id: 2 });
    expect(await lg.createLoadReport(await actorOf(ids.tp2), { branchId: tpBranch, transactionIds: [pos.s1] })).toMatchObject({ ok: false, status: 409 });
    expect((await lg.candidateNotes(tp1, tpBranch))!.map((r) => r.trxNumber)).toEqual(['TRX-3']);
  });

  it('foto nota dulu baru barang; Selesai butuh keduanya; rekan satu cabang boleh melanjutkan', async () => {
    const tp1 = await actorOf(ids.tp1);
    expect(await lg.addLoadPhoto(tp1, reportId, 'GOODS', jpeg())).toMatchObject({ ok: false, status: 409 });
    expect((await lg.addLoadPhoto(tp1, reportId, 'NOTE', jpeg())).ok).toBe(true);
    expect(await lg.finishLoadReport(tp1, reportId)).toMatchObject({ ok: false, status: 409 });
    expect((await lg.addLoadPhoto(await actorOf(ids.tp2), reportId, 'GOODS', jpeg())).ok).toBe(true);
    expect(await lg.addLoadPhoto(await actorOf(ids.gk), reportId, 'GOODS', jpeg())).toMatchObject({ ok: false, status: 404 });
    expect(await lg.addLoadNotes(tp1, reportId, [pos.s3])).toMatchObject({ ok: false, status: 400 });
    // Foto nota terakhir tidak bisa dibuang selama masih ada foto barang.
    const [note] = await sql`select id from logistics.load_report_photos where report_id = ${reportId} and kind = 'NOTE'`;
    expect(await lg.removeLoadPhoto(tp1, reportId, Number(note.id))).toMatchObject({ ok: false, status: 400 });
    expect((await lg.finishLoadReport(tp1, reportId)).ok).toBe(true);
  });

  it('sesudah Selesai: foto terkunci, hanya susulan; tidak bisa dibatalkan', async () => {
    const tp1 = await actorOf(ids.tp1);
    const [photo] = await sql`select id from logistics.load_report_photos where report_id = ${reportId} and kind = 'GOODS'`;
    expect(await lg.removeLoadPhoto(tp1, reportId, Number(photo.id))).toMatchObject({ ok: false, status: 409 });
    expect((await lg.addLoadPhoto(tp1, reportId, 'GOODS', jpeg())).ok).toBe(true);
    const late = await sql`select late from logistics.load_report_photos where report_id = ${reportId} order by id`;
    expect(late.map((r) => r.late)).toEqual([false, false, true]);
    expect(await lg.cancelLoadReport(tp1, reportId, REASON)).toMatchObject({ ok: false, status: 409 });
    expect(await lg.releaseLoadNote(tp1, reportId, 1)).toMatchObject({ ok: false, status: 409 });
    await expect(sql`delete from logistics.load_report_photos where report_id = ${reportId}`).rejects.toThrow();
  });

  it('yang melihat: Marketing semua, pembuat sendiri; kasir cabang lain tidak', async () => {
    const [photo] = await sql`select id, file_id from logistics.load_report_photos where report_id = ${reportId} order by id limit 1`;
    expect(await lg.openLoadPhoto(await actorOf(ids.mk), Number(photo.id))).toBe(photo.file_id);
    expect(await lg.openLoadPhoto(await actorOf(ids.gk), Number(photo.id))).toBeNull();
    const filter = { tab: 'DONE' as const, from: '2026-11-01', to: DAY, q: 'TRX-2' };
    expect((await lg.loadReportList(await actorOf(ids.mk), filter))!.rows.map((r) => r.id)).toEqual([reportId]);
    expect((await lg.loadReportList(await actorOf(ids.tp1), filter))!.rows.map((r) => r.id)).toEqual([reportId]);
    expect((await lg.loadReportList(await actorOf(ids.gk), filter))!.rows).toEqual([]);
    expect(await lg.loadReportDetail(await actorOf(ids.gk), reportId)).toBeNull();
    const detail = await lg.loadReportDetail(await actorOf(ids.owner), reportId);
    expect(detail).toMatchObject({ store: 'Toko Sinar', status: 'DONE', counts: { NOTE: 1, GOODS: 2 } });
  });

  it('Batal selama Proses: alasan wajib, nota dilepas dan bisa dipakai lagi', async () => {
    const tp1 = await actorOf(ids.tp1);
    const made = await lg.createLoadReport(tp1, { branchId: tpBranch, transactionIds: [pos.s3] });
    const id = made.ok ? made.data.id : 0;
    expect(await lg.cancelLoadReport(tp1, id, 'ok')).toMatchObject({ ok: false, status: 400 });
    expect((await lg.cancelLoadReport(tp1, id, REASON)).ok).toBe(true);
    expect((await lg.candidateNotes(tp1, tpBranch))!.map((r) => r.trxNumber)).toEqual(['TRX-3']);
    expect(await lg.addLoadPhoto(tp1, id, 'NOTE', jpeg())).toMatchObject({ ok: false, status: 409 });
    expect((await lg.createLoadReport(tp1, { branchId: tpBranch, transactionIds: [pos.s3] })).ok).toBe(true);
  });
});
