import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Actor } from '@/modules/access';
import type { RequestHandler } from '@/modules/requests';

// L9a sisa kasbon bawaan sistem lama (spec L9 §3.1, SIS-28) pada DB sintetis. Jalan bila ROLES_TEST_ADMIN_URL diisi.
vi.mock('@/modules/accounts', () => ({
  activeHrisAccounts: async (ids: number[]) => new Map(ids.map((id) => [id, id + 1000])),
}));

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_l9a_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));
const noAnnounce = async () => {};

let admin: postgres.Sql;
let sql: postgres.Sql;
let ids: Record<'owner' | 'fin' | 'kasir', number>;
let adv: typeof import('@/modules/advances');
let engine: typeof import('@/modules/requests');
let handlers: Record<string, RequestHandler>;
let actorOf: (employeeId: number) => Promise<Actor>;
let advanceId: number;

describe.skipIf(!ADMIN_URL)('L9a: sisa kasbon bawaan sistem lama', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ now: new Date('2026-11-07T11:00:00+07:00'), toFake: ['Date'] });
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
          await sql`insert into hris.branches (name, latitude, longitude) values ('Gudang', -7.35, 108.1)`;
        }
        await sql.unsafe(readFileSync(new URL(file, folder), 'utf8')).simple();
      }
    }
    process.env.DATABASE_URL = url.toString();
    process.env.AUTH_COOKIE_ENV = 'staging';
    const [{ id: branch }] = await sql`select id from hris.branches where name = 'Gudang'`;
    const [{ id: pokok }] = await sql`select id from hris.salary_component_types order by sort_order limit 1`;
    const person = async (name: string, position: string) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, bank_name, bank_account_number)
        values (hris.next_employee_code(), ${name}, '2026-01-01', 'BCA', '1234567890') returning id`;
      const [p] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${branch}, ${p.id}, 'EMPLOYEE', '2026-01-01')`;
      const [pkg] = await sql`insert into hris.salary_changes (employee_id, effective_from, origin, reason, created_by_account_id)
        values (${row.id}, '2026-01-26', 'DIRECT', 'Gaji awal karyawan uji', 1) returning id`;
      await sql`insert into hris.salary_change_lines (change_id, component_type_id, amount) values (${pkg.id}, ${pokok}, 2600000)`;
      return Number(row.id);
    };
    ids = { owner: await person('Elan', 'Pemilik'), fin: await person('Fani', 'Finance'), kasir: await person('Kiki', 'Kasir') };
    adv = await import('@/modules/advances');
    engine = await import('@/modules/requests');
    handlers = { advance_legacy: adv.legacyAdvanceHandler() } as Record<string, RequestHandler>;
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

  const versionOf = async (id: number) => Number((await sql`select version from hris.requests where id = ${id}`)[0].version);
  const submit = async (employeeId: number, by: number, amount: number, installments = 3) =>
    engine.submitRequest(await actorOf(by), 'advance_legacy', handlers.advance_legacy, { fields: { employeeId, amount, installments, note: '' }, attachmentIds: [] });

  it('hari pindah awal dari migrasi = 26 Desember 2026', async () => {
    expect(await adv.cutoverOn('2026-11-07')).toBe('2026-12-26');
  });

  it('Finance mengetik sisa di atas batas orang; bukan untuk dirinya sendiri; satu orang satu', async () => {
    expect(await submit(ids.fin, ids.fin, 100_000)).toMatchObject({ ok: false, status: 403 });
    const sub = await submit(ids.kasir, ids.fin, 437_500);
    if (!sub.ok) throw new Error(sub.error);
    const again = await submit(ids.kasir, ids.fin, 100_000);
    expect(again.ok).toBe(false);
    const [row] = await sql`select id, kind, state, fund from hris.advances where request_id = ${sub.data.id}`;
    expect(row).toMatchObject({ kind: 'LEGACY', state: 'OPEN', fund: 'MONTHLY' });
    advanceId = Number(row.id);
    // Finance tidak bisa mengesahkan (advance.decide hanya Pemilik/GM).
    const byFin = await engine.decideRequest(await actorOf(ids.fin), sub.data.id, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(sub.data.id), fields: {} });
    expect(byFin.ok).toBe(false);
    const decided = await engine.decideRequest(await actorOf(ids.owner), sub.data.id, handlers, { decision: 'APPROVE', expectedVersion: await versionOf(sub.data.id), fields: {} });
    if (!decided.ok) throw new Error(decided.error);
  });

  it('disahkan = berjalan tanpa uang keluar; dipotong 3 kali mulai slip hari pindah; batas orang tertutup', async () => {
    const [view] = await adv.loadAdvances({ ids: [advanceId] });
    expect(view.stage).toBe('RUNNING');
    expect(view.remaining).toBe(437_500);
    expect(view.handover).toMatchObject({ method: 'LEGACY', sourceId: null, moneyDate: '2026-12-26' });
    const schedule = view.installments.filter((i) => i.status === 'SCHEDULED').map((i) => [i.periodStart, i.amount, i.slipKind]);
    expect(schedule.map((s) => s[0])).toEqual(['2026-12-26', '2027-01-26', '2027-02-26']);
    expect(schedule.reduce((sum, s) => sum + Number(s[1]), 0)).toBe(437_500);
    expect(await adv.checkAdvance(ids.kasir, 50_000, '2026-11-07')).toMatchObject({ ok: false, step: 'PERSON' });
    expect((await adv.advanceSlipItems(ids.kasir, ['2026-12-26'], '2026-12-26', false)).length).toBe(1);
  });

  it('tidak ada serah uang untuk dibatalkan; DB menolak dua bawaan berlaku dan serah LEGACY bersumber uang', async () => {
    const cancel = await adv.cancelHandover(await actorOf(ids.owner), advanceId, 'Coba batalkan serah bawaan', noAnnounce);
    expect(cancel).toMatchObject({ ok: false, status: 409 });
    await expect(sql`insert into hris.advances (number, employee_id, kind, filled_by_account_id, filled_by_employee_id, requested_amount, requested_installments, reason, fund, state, final_amount, final_installments, decided_at)
      values ('KB-9999', ${ids.kasir}, 'LEGACY', 1, ${ids.fin}, 1000, 1, 'Uji dobel', 'MONTHLY', 'APPROVED', 1000, 1, now())`).rejects.toThrow(/advances_one_legacy/);
    const source = Number((await sql`insert into petshop.money_places (name, kind, branch_id) values ('Brankas', 'CASH', 1) returning id`)[0].id);
    await expect(sql`insert into hris.advance_handovers (advance_id, amount, money_date, money_place_id, method, handed_by_account_id)
      values (${advanceId}, 1000, '2026-12-26', ${source}, 'LEGACY', 1)`).rejects.toThrow(/advance_handovers_legacy_source/);
  });
});
