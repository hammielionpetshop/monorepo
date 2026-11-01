import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/modules/access';

// Jalur tulis pengaturan (spec L2e §7) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi (lokal);
// di CI aplikasi tanpa DB, tes ini dilewati — pagar DB-nya dites di packages/db-roles.
const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_settings_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));

let admin: postgres.Sql;
let sql: postgres.Sql;
let write: typeof import('./write');
let read: typeof import('./read');
let owner: Actor;
let hr: Actor;
let kasirPositionId: number;
let today: string;
let tomorrow: string;

const longReason = 'Uji perubahan pengaturan bertanggal';

describe.skipIf(!ADMIN_URL)('L2e: ubah dan batalkan pengaturan', () => {
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
    for (const file of ['0000_init.sql', '0001_access.sql', '0002_employees.sql', '0003_settings.sql']) {
      await sql.unsafe(readFileSync(new URL(`hris-db/src/migrations/${file}`, root), 'utf8')).simple();
    }
    const [dates] = await sql`select (now() at time zone 'Asia/Jakarta')::date::text as today,
      ((now() at time zone 'Asia/Jakarta')::date + 1)::text as tomorrow`;
    today = dates.today;
    tomorrow = dates.tomorrow;
    const positions = await sql`select id, name from hris.positions`;
    const id = (name: string) => Number(positions.find((p) => p.name === name)!.id);
    kasirPositionId = id('Kasir');
    owner = { accountId: 1, personId: 1, positionId: id('Pemilik'), fullAccess: true, highRights: true, branchId: null, departmentId: null, grants: new Map() };
    hr = {
      accountId: 2, personId: 2, positionId: id('HR'), fullAccess: false, highRights: true, branchId: null, departmentId: null,
      grants: new Map([['position_settings.propose', 'ALL'], ['settings.view', 'ALL']]),
    };
    process.env.DATABASE_URL = url.toString();
    write = await import('./write');
    read = await import('./read');
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const latestId = async (key: string, kind = 'ALL', targetId: number | null = null) => {
    const [row] = await sql`select max(id)::int as id from hris.setting_values
      where key = ${key} and target_kind = ${kind} and coalesce(target_id, 0) = ${targetId ?? 0}`;
    return row.id as number | null;
  };

  const months = (value: unknown, effectiveFrom: string, expectedLatestId: number | null, reason = longReason) =>
    write.setSetting(owner, {
      key: 'employees.training_review_months', targetKind: 'ALL', targetId: null, value, effectiveFrom, reason, expectedLatestId,
    });

  it('Pemilik mengubah masa training mulai besok: hari ini tetap nilai lama, besok nilai baru, tercatat di jejak', async () => {
    const result = await months(4, tomorrow, await latestId('employees.training_review_months'));
    expect(result.ok).toBe(true);
    expect(await read.settingOn('employees.training_review_months', today)).toBe(3);
    expect(await read.settingOn('employees.training_review_months', tomorrow)).toBe(4);
    const audit = await sql`select action, actor_account_id, source from hris.audit_events where entity = 'setting'`;
    expect(audit).toEqual([{ action: 'setting.set', actor_account_id: 1, source: 'USER' }]);
  });

  it('menolak: hari ini untuk pengaturan hitungan, tanggal sama, data basi, nilai sama, alasan pendek', async () => {
    const id = await latestId('employees.training_review_months');
    expect(await months(5, today, id)).toMatchObject({ ok: false, status: 400 });
    expect(await months(5, tomorrow, id)).toMatchObject({ ok: false, status: 409 });
    expect(await months(5, '2099-01-01', id! - 1)).toMatchObject({ ok: false, status: 409 });
    expect(await months(4, '2099-01-01', id)).toMatchObject({ ok: false, status: 400 });
    expect(await months(5, '2099-01-01', id, 'terlalu pendek')).toMatchObject({ ok: false, status: 400 });
    expect(await months(13, '2099-01-01', id)).toMatchObject({ ok: false, status: 400 });
  });

  it('Pengaturan Jabatan: HR hanya melihat, Pemilik langsung mengubah; jabatan lain ikut bawaan', async () => {
    const input = {
      key: 'position.backoffice_role_suggestion', targetKind: 'POSITION' as const, targetId: kasirPositionId, value: 'KASIR',
      effectiveFrom: today, reason: longReason, expectedLatestId: null,
    };
    expect(await write.setSetting(hr, input)).toMatchObject({ ok: false, status: 403 });
    expect(await write.setSetting(owner, { ...input, value: 'OWNER' })).toMatchObject({ ok: false, status: 400 });
    expect(await write.setSetting(owner, input)).toMatchObject({ ok: true });
    expect(await read.settingOn('position.backoffice_role_suggestion', today, { positionId: kasirPositionId })).toBe('KASIR');
    expect(await read.settingOn('position.backoffice_role_suggestion', today, { positionId: kasirPositionId + 1 })).toBe('NONE');
  });

  it('HR tidak bisa mengubah pengaturan langsung-berlaku', async () => {
    const result = await write.setSetting(hr, {
      key: 'shared.reason_min_length', targetKind: 'ALL', targetId: null, value: 20, effectiveFrom: today,
      reason: longReason, expectedLatestId: await latestId('shared.reason_min_length'),
    });
    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it('membatalkan nilai yang belum berlaku mengembalikan nilai lama; nilai yang sudah berlaku tidak bisa dibatalkan', async () => {
    const [future] = await sql`select id from hris.setting_values where key = 'employees.training_review_months' and effective_from = ${tomorrow}`;
    const [initial] = await sql`select id from hris.setting_values where key = 'employees.training_review_months' and effective_from = '2026-01-01'`;
    expect(await write.cancelSetting(owner, Number(initial.id), longReason)).toMatchObject({ ok: false, status: 409 });
    expect(await write.cancelSetting(hr, Number(future.id), longReason)).toMatchObject({ ok: false, status: 403 });
    expect(await write.cancelSetting(owner, Number(future.id), longReason)).toMatchObject({ ok: true });
    expect(await read.settingOn('employees.training_review_months', tomorrow)).toBe(3);
    expect(await write.cancelSetting(owner, Number(future.id), longReason)).toMatchObject({ ok: false, status: 409 });
  });

  it('alasan di semua layar mengikuti pengaturan panjang alasan', async () => {
    expect(await write.checkReason('terlalu pendek')).toMatchObject({ ok: false });
    expect(await write.checkReason('  alasan    cukup panjang  ')).toEqual({ ok: true, reason: 'alasan cukup panjang' });
  });
});
