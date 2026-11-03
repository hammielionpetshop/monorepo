import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// L4g-3 akses terbatas mantan karyawan + Total Diterima per Orang (spec L4g §8) pada DB sintetis. Jalan bila
// ROLES_TEST_ADMIN_URL diisi. Tanggal lampau: periode 26 Okt – 25 Nov 2026; "sekarang" 10 November 2026.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));
let requestPath: string | null = null;
vi.mock('next/headers', () => ({
  headers: async () => new Headers(requestPath ? { 'x-hris-path': requestPath } : {}),
  cookies: async () => ({ get: () => undefined }),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l4g3_svc_${process.pid}_${Date.now()}`;
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
let former: typeof import('./former');
let actorOf: (employeeId: number) => Promise<Actor>;
let sessionActor: (employeeId: number) => Promise<Actor>;
let ids: Record<'owner' | 'gm' | 'hr' | 'finance' | 'ani' | 'dodi' | 'eka', number>;
let rekening: number;

describe.skipIf(!ADMIN_URL)('L4g-3: akses terbatas mantan karyawan dan Total Diterima', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    const adminUrl = new URL(ADMIN_URL!);
    adminUrl.pathname = '/postgres';
    admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database "${databaseName}"`);
    const url = new URL(ADMIN_URL!);
    url.pathname = `/${databaseName}`;
    Object.assign(process.env, {
      AUTH_COOKIE_ENV: 'staging', AUTH_COOKIE_DOMAIN: 'staginghml.my.id', AUTH_CSRF_SECRET: 'x'.repeat(40),
      AUTH_TRUSTED_ORIGINS: 'https://hris.staginghml.my.id', AUTH_DATABASE_URL: url.toString(),
    });
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
      ani: await person('Ani', 'Kasir'), dodi: await person('Dodi', 'Kasir'), eka: await person('Eka', 'Kasir'),
    };
    // Dodi berhenti (hari terakhir 31 Oktober), Eka nonaktif alasan Lainnya. Tanggal lampau: view penempatan memakai jam DB.
    await sql`insert into hris.employment_events (employee_id, kind, effective_on, reason_kind, resignation_notice, note, created_by_account_id)
      values (${ids.dodi}, 'DEACTIVATE', '2026-11-01', 'RESIGNED', 'WITH_NOTICE', 'Pindah kota bersama keluarga', 1),
             (${ids.eka}, 'DEACTIVATE', '2026-11-01', 'OTHER', null, 'Kontrak proyek selesai', 1)`;
    rekening = Number((await sql`select id from hris.payment_sources where name = 'Rekening Kantor'`)[0].id);
    slip = await import('./payslip');
    pay = await import('./payment');
    former = await import('./former');
    const { loadActor } = await import('@/modules/access');
    const { actorForSession } = await import('@/lib/authz');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
    sessionActor = (employeeId) => actorForSession(employeeId + 1000, employeeId);
  });

  afterAll(async () => {
    vi.useRealTimers();
    for (const key of ['AUTH_COOKIE_ENV', 'AUTH_COOKIE_DOMAIN', 'AUTH_CSRF_SECRET', 'AUTH_TRUSTED_ORIGINS', 'AUTH_DATABASE_URL']) delete process.env[key];
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const slipIdOf = async (employeeId: number) => Number((await sql`select id from hris.payslips where employee_id = ${employeeId} and period_start = ${P}`)[0]?.id);
  const close = async (employeeIds: number[]) => {
    const gm = await actorOf(ids.gm);
    await slip.periodScreen(gm, P);
    const result = await slip.closeSlips(gm, { slipIds: await Promise.all(employeeIds.map(slipIdOf)), periodStart: null }, noAnnounce);
    if (!result.ok) throw new Error(result.error);
  };

  it('slip terakhir masih Perkiraan: mantan karyawan (Berhenti) punya urusan; alasan Lainnya dan karyawan aktif tidak', async () => {
    await slip.periodScreen(await actorOf(ids.gm), P);
    expect(await former.hasMoneyMatters(ids.dodi)).toBe(true);
    expect(await former.hasMoneyMatters(ids.eka)).toBe(false);
    expect(await former.hasMoneyMatters(ids.ani)).toBe(false);
  });

  it('pelaku terbatas: hanya lihat diri sendiri di alamat yang dibuka; alamat lain tanpa hak; pengajuan selain keberatan slip ditolak', async () => {
    const { can } = await import('@/modules/access');
    requestPath = '/pendapatan';
    const open = await sessionActor(ids.dodi);
    expect(open.limited).toEqual({ since: '2026-11-01' });
    expect(can(open, 'profile.view', { personId: ids.dodi })).toBe(true);
    expect(can(open, 'profile.view', { personId: ids.ani })).toBe(false);
    expect(can(open, 'contact.update_own', { personId: ids.dodi })).toBe(false);
    requestPath = '/absen';
    const elsewhere = await sessionActor(ids.dodi);
    expect(elsewhere.limited).toBeTruthy();
    expect(can(elsewhere, 'profile.view', { personId: ids.dodi })).toBe(false);
    requestPath = '/api/requests';
    const { submitRequest } = await import('@/modules/requests');
    const handler = { prepare: async () => { throw new Error('tidak boleh sampai sini'); } } as never;
    const refused = await submitRequest(await sessionActor(ids.dodi), 'identity_change', handler, { fields: {}, attachmentIds: [] });
    expect(refused).toMatchObject({ ok: false, status: 403 });
    requestPath = '/pendapatan';
    const eka = await sessionActor(ids.eka);
    expect(eka.limited ?? null).toBeNull();
    expect(can(eka, 'profile.view', { personId: ids.eka })).toBe(false);
    requestPath = null;
  });

  it('Ditutup lalu Dibayar: urusan sampai 23.59 hari ke-7; tagihan luar slip menunggu menghidupkan lagi', async () => {
    await close([ids.ani, ids.dodi]);
    const paid = await pay.paySlips(await actorOf(ids.owner), { slipIds: [await slipIdOf(ids.ani), await slipIdOf(ids.dodi)], sourceId: rekening, moneyDate: TODAY }, noAnnounce);
    expect(paid.ok).toBe(true);
    // Jam DB nyata: samakan saat ditandai Dibayar dengan "sekarang" tes.
    await sql`update hris.payslip_payments set created_at = ${NOW}`;
    expect(await former.hasMoneyMatters(ids.dodi, new Date('2026-11-17T16:59:00Z'))).toBe(true);
    expect(await former.hasMoneyMatters(ids.dodi, new Date('2026-11-17T17:00:01Z'))).toBe(false);
    const dodiSlip = await slipIdOf(ids.dodi);
    const [claim] = await sql`insert into hris.off_slip_claims (employee_id, last_payslip_id, origin_key, source_key, kind, line_kind, label, amount)
      values (${ids.dodi}, ${dodiSlip}, 'corr:uji#1', 'corr:uji', 'CORRECTION', 'LATE', 'Koreksi terlambat', 50000) returning id`;
    expect(await former.hasMoneyMatters(ids.dodi, new Date('2026-12-30T00:00:00Z'))).toBe(true);
    await sql`update hris.off_slip_claims set status = 'CANCELLED', cancelled_at = now(), cancel_reason = 'uji' where id = ${claim.id}`;
  });

  it('akun pusat: mantan dengan urusan aktif khusus HRIS dan tautan backoffice dicabut; sesudah urusan selesai dinonaktifkan', async () => {
    const [account] = await sql`insert into auth.accounts (username, is_active) values ('dodi', false) returning id`;
    await sql`insert into auth.account_links (account_id, app_code, local_user_id) values (${account.id}, 'hris', ${ids.dodi}), (${account.id}, 'backoffice', 77)`;
    const { applyDueEmploymentStatus } = await import('@/modules/employees');
    await applyDueEmploymentStatus(former.hasMoneyMatters);
    const state = async () => (await sql`select a.is_active, (select revoked_at is not null from auth.account_links where account_id = a.id and app_code = 'backoffice') as bo_revoked
      from auth.accounts a where a.id = ${account.id}`)[0];
    expect(await state()).toEqual({ is_active: true, bo_revoked: true });
    vi.setSystemTime(new Date('2026-11-18T17:01:00Z')); // 19 November 00.01 WIB
    await applyDueEmploymentStatus(former.hasMoneyMatters);
    expect(await state()).toEqual({ is_active: false, bo_revoked: true });
    vi.setSystemTime(NOW);
  });

  it('Total Diterima: Pemilik/GM dan HR; Finance tidak; baris mantan karyawan; Diterima + Belum = Jumlah; unduh tercatat', async () => {
    const gm = await actorOf(ids.gm);
    const screen = await former.totalsScreen(gm, {}, new Date('2026-11-27T05:00:00Z'));
    expect(screen?.range).toMatchObject({ from: P, to: P, count: 1 });
    const dodi = screen!.rows.find((r) => r.employeeId === ids.dodi)!;
    expect(dodi).toMatchObject({ former: true, pending: 0 });
    expect(dodi.received).toBe(dodi.slipMonthly);
    for (const r of screen!.rows) expect(r.received + r.pending).toBe(r.total);
    expect((await former.totalsScreen(gm, { status: 'mantan' }))!.rows.map((r) => r.employeeId)).toEqual([ids.dodi]);
    expect((await former.totalsScreen(gm, { cari: 'ani' }))!.rows.map((r) => r.employeeId)).toEqual([ids.ani]);
    expect(await former.totalsScreen(await actorOf(ids.hr), {})).not.toBeNull();
    expect(await former.totalsScreen(await actorOf(ids.finance), {})).toBeNull();
    expect(await former.totalsDownload(await actorOf(ids.finance), {})).toBeNull();
    const detail = await former.totalsPersonScreen(gm, ids.dodi, {});
    expect(detail?.periods.map((p) => p.start)).toEqual([P]);
    const file = await former.totalsDownload(gm, {});
    expect(file?.csv.split('\r\n')[2]).toMatch(/^Kode;Nama;/);
    expect((await sql`select action from hris.payslip_steps where action = 'TOTALS_DOWNLOAD'`).length).toBe(1);
  });
});
