import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';

// F3-3b Wajib umumkan (spec F3-3 §7) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));
const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_f3_3b_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));

let admin: postgres.Sql;
let sql: postgres.Sql;
let svc: typeof import('@/modules/announcements');
let settings: typeof import('@/modules/settings');
let logistics: typeof import('@/modules/logistics');
let requestsSvc: typeof import('@/modules/requests');
let actorOf: (employeeId: number) => Promise<Actor>;
let branchA: number;
let kasirPos: number;
let ids: Record<'owner' | 'hr' | 'kasirA', number>;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
const addDays = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

describe.skipIf(!ADMIN_URL)('F3-3b: wajib umumkan', () => {
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
    for (const folder of [new URL('logistics/src/migrations/', root), new URL('hris-db/src/migrations/', root)]) {
      for (const file of readdirSync(folder).filter((name) => name.endsWith('.sql')).sort()) {
        if (folder.pathname.includes('hris-db') && file.startsWith('0031')) {
          await sql`insert into hris.branches (name, latitude, longitude) values ('Singaparna', -7.35, 108.1)`;
        }
        await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();
      }
    }
    process.env.DATABASE_URL = url.toString();
    process.env.AUTH_COOKIE_ENV = 'staging';
    branchA = Number((await sql`select id from hris.branches where name = 'Singaparna'`)[0].id);
    const position = async (name: string) => Number((await sql`select id from hris.positions where name = ${name}`)[0].id);
    kasirPos = await position('Kasir');
    const person = async (name: string, positionName: string) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
        values (hris.next_employee_code(), ${name}, '2026-01-01', 'BCA', '1234567890') returning id`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${branchA}, ${await position(positionName)}, 'EMPLOYEE', '2026-01-01')`;
      return Number(row.id);
    };
    ids = { owner: await person('Elan', 'Pemilik'), hr: await person('Hana', 'HR'), kasirA: await person('Kiki', 'Kasir') };
    svc = await import('@/modules/announcements');
    settings = await import('@/modules/settings');
    logistics = await import('@/modules/logistics');
    requestsSvc = await import('@/modules/requests');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(employeeId + 1000, employeeId);
  });

  afterAll(async () => {
    delete process.env.AUTH_COOKIE_ENV;
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  const fields = (over: Record<string, unknown> = {}) => ({
    mode: 'announce' as const, title: 'Toleransi telat', beforeText: '10 menit', afterText: '5 menit', askWhom: 'HR',
    changeKind: 'UNFAVORABLE' as const, target: { all: true as const }, publishesAt: null, ...over,
  });
  const latestId = async (key: string) => {
    const [row] = await sql`select max(id)::int as id from hris.setting_values where key = ${key} and target_kind = 'ALL'`;
    return row.id == null ? null : Number(row.id);
  };
  const set = async (key: string, value: unknown, effectiveFrom: string, announcement?: unknown) => settings.setSetting(await actorOf(ids.owner), {
    key, targetKind: 'ALL', targetId: null, value, effectiveFrom, reason: 'Uji wajib umumkan', expectedLatestId: await latestId(key),
  }, undefined, svc.toAnnounceChoice(announcement));

  it('pengaturan wajib umumkan tanpa pengumuman/alasan ditolak; dengan alasan tersimpan dan tercatat di audit', async () => {
    const date = addDays(today(), 10);
    const missing = await set('attendance.late_tolerance_minutes', 7, date);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toContain('wajib diumumkan');
    const skipped = await set('attendance.late_tolerance_minutes', 7, date, { mode: 'skip', reason: 'Hanya merapikan angka uji' });
    if (!skipped.ok) throw new Error(skipped.error);
    const [audit] = await sql`select after->>'noAnnounceReason' as reason from hris.audit_events
      where entity = 'setting' and entity_id = ${skipped.data.id} and action = 'setting.set'`;
    expect(audit.reason).toBe('Hanya merapikan angka uji');
    expect((await sql`select count(*)::int as n from hris.announcements where ${skipped.data.id} = any(setting_value_ids)`)[0].n).toBe(0);
  });

  it('dengan pengumuman: nilai + pengumuman satu transaksi; jarak kurang ditolak tanpa menyimpan nilai', async () => {
    const tooClose = await set('attendance.earliest_in_minutes', 45, addDays(today(), 3), fields({ title: 'Absen masuk paling awal' }));
    expect(tooClose.ok).toBe(false);
    if (!tooClose.ok) expect(tooClose.error).toContain('Pilih tanggal berlaku paling cepat');
    expect((await sql`select count(*)::int as n from hris.setting_values where key = 'attendance.earliest_in_minutes' and effective_from = ${addDays(today(), 3)}`)[0].n).toBe(0);

    const date = addDays(today(), 8);
    const saved = await set('attendance.earliest_in_minutes', 45, date, fields({ title: 'Absen masuk paling awal' }));
    if (!saved.ok) throw new Error(saved.error);
    const [rule] = await sql`select id, effective_on::text as effective_on, change_kind, affects_money from hris.announcements
      where ${saved.data.id} = any(setting_value_ids)`;
    expect(rule.effective_on).toBe(date);
    expect(rule.affects_money).toBe(true);
    // Karyawan sasaran mendapat butir belum dibaca.
    expect((await svc.unreadAnnouncements(await actorOf(ids.kasirA))).some((i) => i.id === Number(rule.id))).toBe(true);
  });

  it('tarik pengumuman → nilai pengaturan batal; batal nilai → pengumuman ditarik; pengumuman baru menggantikan yang lama', async () => {
    const first = await set('attendance.min_out_minutes', 6, addDays(today(), 9), fields({ title: 'Jeda absen pulang' }));
    if (!first.ok) throw new Error(first.error);
    const [ruleA] = await sql`select id from hris.announcements where ${first.data.id} = any(setting_value_ids)`;
    const second = await set('attendance.min_out_minutes', 8, addDays(today(), 12), fields({ title: 'Jeda absen pulang' }));
    if (!second.ok) throw new Error(second.error);
    const [ruleB] = await sql`select id, supersedes_announcement_id from hris.announcements where ${second.data.id} = any(setting_value_ids)`;
    expect(Number(ruleB.supersedes_announcement_id)).toBe(Number(ruleA.id));

    const withdrawn = await svc.withdrawRule(await actorOf(ids.owner), Number(ruleB.id), 'Batal dibahas ulang');
    if (!withdrawn.ok) throw new Error(withdrawn.error);
    expect((await sql`select status from hris.setting_values where id = ${second.data.id}`)[0].status).toBe('CANCELLED');

    const cancelled = await settings.cancelSetting(await actorOf(ids.owner), first.data.id, 'Tidak jadi diubah');
    if (!cancelled.ok) throw new Error(cancelled.error);
    expect((await sql`select ended_at from hris.announcements where id = ${ruleA.id}`)[0].ended_at).not.toBeNull();
  });

  it('simpan beberapa angka sekaligus: satu pengumuman; batal satu angka ikut membatalkan yang lain', async () => {
    const date = addDays(today(), 14);
    const saved = await settings.setSettingsBatch(await actorOf(ids.owner), {
      values: { 'attendance.late_tolerance_minutes': 9, 'attendance.earliest_in_minutes': 50, 'shared.reason_min_length': 6 },
      effectiveFrom: date, reason: 'Uji simpan bersama',
    }, undefined, svc.toAnnounceChoice(fields({ title: 'Aturan absen' })));
    if (!saved.ok) throw new Error(saved.error);
    const [rule] = await sql`select id, setting_value_ids from hris.announcements where title = 'Aturan absen'`;
    expect(rule.setting_value_ids).toHaveLength(2);
    const [one] = rule.setting_value_ids as number[];
    const cancelled = await settings.cancelSetting(await actorOf(ids.owner), one, 'Batal semua angka absen');
    if (!cancelled.ok) throw new Error(cancelled.error);
    const statuses = await sql`select status from hris.setting_values where id = any(${rule.setting_value_ids})`;
    expect(statuses.every((r) => r.status === 'CANCELLED')).toBe(true);
    expect((await sql`select ended_at from hris.announcements where id = ${rule.id}`)[0].ended_at).not.toBeNull();
  });

  it('usulan HR disetujui → pengaturan aktif dan pengumuman terbit; usulan tanpa pengumuman ditolak saat diajukan', async () => {
    const handler = settings.positionSettingHandler(async () => {}, svc.proposalAnnouncer()) as unknown as Parameters<typeof requestsSvc.submitRequest>[2];
    const input = (announcement?: unknown) => ({
      fields: {
        key: 'position.late_applies', targetKind: 'POSITION', targetId: kasirPos, value: 'NO', effectiveFrom: addDays(today(), 10),
        reason: 'Kasir tidak kena telat', ...(announcement ? { announcement } : {}),
      },
      attachmentIds: [],
    });
    const missing = await requestsSvc.submitRequest(await actorOf(ids.hr), 'position_setting_change', handler, input());
    expect(missing.ok).toBe(false);
    const target = { all: false as const, branchIds: [], positionIds: [kasirPos] };
    const submitted = await requestsSvc.submitRequest(await actorOf(ids.hr), 'position_setting_change', handler,
      input(fields({ title: 'Kasir tidak kena telat', beforeText: 'Kena telat', afterText: 'Tidak kena telat', changeKind: 'FAVORABLE', target })));
    if (!submitted.ok) throw new Error(submitted.error);
    const [{ version }] = await sql`select version from hris.requests where id = ${submitted.data.id}`;
    const handlers = { position_setting_change: handler } as unknown as Parameters<typeof requestsSvc.decideRequest>[2];
    const approved = await requestsSvc.decideRequest(await actorOf(ids.owner), submitted.data.id, handlers, { decision: 'APPROVE', expectedVersion: Number(version) });
    if (!approved.ok) throw new Error(approved.error);
    const [value] = await sql`select v.status, a.id as announcement_id, a.request_id from hris.position_setting_proposals p
      join hris.setting_values v on v.id = p.setting_value_id
      left join hris.announcements a on v.id = any(a.setting_value_ids)
      where p.request_id = ${submitted.data.id}`;
    expect(value.status).toBe('ACTIVE');
    expect(value.announcement_id).not.toBeNull();
    expect(Number(value.request_id)).toBe(submitted.data.id);
  });

  it('tarif ritase turun → merugikan 7 hari; batal tarif ikut menarik pengumumannya', async () => {
    const [pair] = await sql`select vehicle_id, route_id, driver_with_assistant, driver_alone, assistant from logistics.trip_rates
      where status = 'ACTIVE' and driver_with_assistant > 1000 order by id limit 1`;
    const numbers = { driverWithAssistant: Number(pair.driver_with_assistant) - 1000, driverAlone: Number(pair.driver_alone), assistant: Number(pair.assistant) };
    const input = { vehicleId: Number(pair.vehicle_id), routeId: Number(pair.route_id), effectiveFrom: addDays(today(), 7), ...numbers };
    const owner = await actorOf(ids.owner);
    const preview = await logistics.ratePreview(owner, input.vehicleId, input.routeId, numbers, input.effectiveFrom);
    expect(preview?.announce?.required).toBe(true);
    expect(preview?.announce?.changeKind).toBe('UNFAVORABLE');
    expect((await logistics.createRate(owner, { ...input, effectiveFrom: addDays(today(), 7) })).ok).toBe(false);
    const created = await logistics.createRate(owner, input, svc.toAnnounceChoice(fields({ title: 'Tarif ritase turun', changeKind: 'FAVORABLE' })));
    if (!created.ok) throw new Error(created.error);
    const [rule] = await sql`select id, change_kind from hris.announcements where trip_rate_id = ${created.data.id}`;
    expect(rule.change_kind).toBe('UNFAVORABLE');
    const cancelled = await logistics.cancelRate(owner, created.data.id, 'Salah pilih tanggal');
    if (!cancelled.ok) throw new Error(cancelled.error);
    expect((await sql`select ended_at from hris.announcements where id = ${rule.id}`)[0].ended_at).not.toBeNull();
  });
});
