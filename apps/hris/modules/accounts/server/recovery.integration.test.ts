import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/modules/access';

// Lupa password dari sisi HRIS (spec L2f-2 §4) dengan akun pusat sungguhan. Jalan bila ROLES_TEST_ADMIN_URL diisi.
const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL;
const databaseName = `hris_recovery_svc_${process.pid}_${Date.now()}`;
const root = new URL('../../../../../packages/', import.meta.url);
const requireAuth = createRequire(new URL('auth/package.json', root));

let admin: postgres.Sql;
let sql: postgres.Sql;
let recovery: typeof import('./recovery');
let actorOf: (employeeId: number) => Promise<Actor>;
let accountOf: Map<number, number>;
let ids: { owner: number; gm: number; hr: number; kasir: number; blank: number; gone: number };

const PHONE = '081234567890';
const BIRTH = '1995-03-04';
const facts = (identifier: string, over: object = {}) => ({ identifier, phone: PHONE, birthDate: BIRTH, ...over });
const emailOf = (id: number) => `orang${id}@contoh.id`;
const inbox = (employeeId: number) => sql`select kind, title, link from hris.notifications
  where recipient_account_id = ${accountOf.get(employeeId)!} and id > ${mark} order by id`;
let mark = 0;
const resetInbox = async () => {
  const [row] = await sql`select coalesce(max(id), 0)::int as id from hris.notifications`;
  mark = row.id;
};

describe.skipIf(!ADMIN_URL)('L2f-2: lupa password HRIS', () => {
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
    const { drizzle } = requireAuth('drizzle-orm/postgres-js');
    const { migrate } = requireAuth('drizzle-orm/postgres-js/migrator');
    const migrationClient = postgres(url.toString(), { max: 1, onnotice: () => {} });
    await migrate(drizzle(migrationClient), {
      migrationsFolder: fileURLToPath(new URL('auth/src/migrations/', root)), migrationsSchema: 'drizzle', migrationsTable: '__migrations_auth',
    });
    await migrationClient.end();
    for (const file of ['0000_init', '0001_access', '0002_employees', '0003_settings', '0004_new_badge_days', '0005_requests', '0006_position_proposals']) {
      await sql.unsafe(readFileSync(new URL(`hris-db/src/migrations/${file}.sql`, root), 'utf8')).simple();
    }
    const [branch] = await sql`insert into hris.branches (name) values ('Toko Pusat') returning id`;
    accountOf = new Map();
    const person = async (name: string, position: string, data = true) => {
      const [row] = await sql`insert into hris.employees (code, name, joined_on, phone, birth_date)
        values (hris.next_employee_code(), ${name}, '2026-01-01', ${data ? `0856000000${accountOf.size}` : null}, ${data ? BIRTH : null}) returning id`;
      const [pos] = await sql`select id from hris.positions where name = ${position}`;
      await sql`insert into hris.placements (employee_id, kind, branch_id, position_id, work_status, effective_from)
        values (${row.id}, 'INITIAL', ${branch.id}, ${pos.id}, 'EMPLOYEE', '2026-01-01')`;
      const [account] = await sql`insert into auth.accounts (email, password_hash, must_change_password)
        values (${emailOf(Number(row.id))}, 'lama', false) returning id`;
      await sql`insert into auth.account_links (account_id, app_code, local_user_id) values (${account.id}, 'hris', ${row.id})`;
      accountOf.set(Number(row.id), Number(account.id));
      return Number(row.id);
    };
    ids = {
      owner: await person('Pemilik Satu', 'Pemilik'), gm: await person('Gina GM', 'GM'), hr: await person('Nadia HR', 'HR'),
      kasir: await person('Budi Kasir', 'Kasir'), blank: await person('Tanpa Data', 'Kasir', false), gone: await person('Sudah Berhenti', 'Kasir'),
    };
    await sql`update hris.employees set phone = ${PHONE} where id = ${ids.kasir}`;
    await sql`update auth.accounts set is_active = false where id = ${accountOf.get(ids.gone)!}`;
    Object.assign(process.env, {
      DATABASE_URL: url.toString(), AUTH_DATABASE_URL: url.toString(), AUTH_COOKIE_ENV: 'local',
      AUTH_CSRF_SECRET: 'rahasia-tes-yang-cukup-panjang-untuk-csrf', AUTH_TRUSTED_ORIGINS: 'http://localhost',
    });
    recovery = await import('./recovery');
    const { loadActor } = await import('@/modules/access');
    actorOf = (employeeId) => loadActor(accountOf.get(employeeId)!, employeeId) as Promise<Actor>;
  });

  afterAll(async () => {
    const { getAuthSql } = await import('@/lib/auth');
    await getAuthSql().end();
    await sql?.end();
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`);
    await admin?.end();
  });

  it('pesan menyebut data yang salah, berurutan: email, HP, tanggal lahir', async () => {
    const email = emailOf(ids.kasir);
    expect(await recovery.verifyRecovery(facts('takada@contoh.id'))).toMatchObject({ ok: false, error: expect.stringContaining('tidak terdaftar') });
    expect(await recovery.verifyRecovery(facts(email, { phone: '089999999999' }))).toMatchObject({ ok: false, error: expect.stringContaining('Nomor HP') });
    expect(await recovery.verifyRecovery(facts(email, { birthDate: '2000-01-01' }))).toMatchObject({ ok: false, error: expect.stringContaining('Tanggal lahir') });
    await sql`delete from auth.recovery_throttles`;
  });

  it('HP ditulis format lain tetap cocok; sukses: password baru, penerima laporan dan orangnya diberi tahu', async () => {
    const verified = await recovery.verifyRecovery(facts(emailOf(ids.kasir), { phone: '+62 812-3456-7890' }));
    if (!verified.ok) throw new Error(verified.error);
    const done = await recovery.finishRecoveryWithTicket({ ticket: verified.ticket, newPassword: 'passwordbaru123', deviceLabel: 'tes' });
    expect(done).toMatchObject({ ok: true });
    expect((await inbox(ids.kasir)).at(-1)).toMatchObject({ kind: 'account.password_recovered' });
    expect((await inbox(ids.gm)).at(-1)).toMatchObject({ kind: 'account.password_recovered', title: expect.stringContaining('Budi Kasir') });
    // Penerima isi awal = jabatan GM saja.
    expect(await inbox(ids.owner)).toEqual([]);
  });

  it('salah 3 kali: jeda, sebut kode GM, penerima diberi tahu sekali', async () => {
    const email = emailOf(ids.hr);
    await resetInbox();
    for (let i = 0; i < 2; i += 1) expect(await recovery.verifyRecovery(facts(email))).toMatchObject({ status: 400 });
    const third = await recovery.verifyRecovery(facts(email));
    expect(third).toMatchObject({ ok: false, status: 429, useCode: true, blockedUntil: expect.any(String) });
    expect(await recovery.verifyRecovery(facts(email))).toMatchObject({ status: 429 });
    const reports = (await inbox(ids.gm)).filter((n) => n.kind === 'account.recovery_blocked');
    expect(reports).toHaveLength(1);
    expect(reports[0].link).toBe(`/karyawan/${ids.hr}`);
  });

  it('identifier tak terdaftar dijeda tetapi tidak mengirim kabar', async () => {
    await resetInbox();
    for (let i = 0; i < 3; i += 1) await recovery.verifyRecovery(facts('hantu@contoh.id'));
    expect(await recovery.verifyRecovery(facts('hantu@contoh.id'))).toMatchObject({ status: 429 });
    expect(await sql`select 1 from hris.notifications where id > ${mark}`).toHaveLength(0);
  });

  it('Pemilik/GM, akun nonaktif, dan data kosong tidak mendapat tiket', async () => {
    for (const id of [ids.owner, ids.gm]) {
      await sql`update hris.employees set phone = ${`0877000000${id}`} where id = ${id}`;
      const result = await recovery.verifyRecovery(facts(emailOf(id), { phone: `0877000000${id}` }));
      expect(result).toMatchObject({ ok: false, status: 403, error: expect.stringContaining('Pemilik dan GM') });
    }
    expect(await recovery.verifyRecovery(facts(emailOf(ids.gone)))).toMatchObject({ status: 403, error: expect.stringContaining('tidak aktif') });
    expect(await recovery.verifyRecovery(facts(emailOf(ids.blank)))).toMatchObject({ status: 403, useCode: true });
    expect(await sql`select 1 from auth.recovery_tickets t join auth.accounts a on a.id = t.account_id
      where a.id in (${accountOf.get(ids.owner)!}, ${accountOf.get(ids.gm)!}, ${accountOf.get(ids.gone)!}, ${accountOf.get(ids.blank)!})`).toHaveLength(0);
  });

  it('kode dari GM: berhasil untuk data kosong; jalur itu juga membuka Pemilik/GM; tidak atas diri sendiri', async () => {
    const gm = await actorOf(ids.gm);
    expect(await recovery.createRecoveryCodeFor(gm, ids.gm)).toMatchObject({ ok: false, status: 403 });
    const made = await recovery.createRecoveryCodeFor(gm, ids.blank);
    if (!made.ok) throw new Error(made.error);
    const done = await recovery.finishRecoveryWithCode({ identifier: emailOf(ids.blank), code: made.data.code, newPassword: 'passwordbaru123', deviceLabel: 'tes' });
    expect(done).toMatchObject({ ok: true });
    const trail = await sql`select after from hris.audit_events where action = 'account_recovery_code'`;
    expect(JSON.stringify(trail)).not.toContain(made.data.code);

    const forOwner = await recovery.createRecoveryCodeFor(gm, ids.owner);
    if (!forOwner.ok) throw new Error(forOwner.error);
    expect(await recovery.finishRecoveryWithCode({ identifier: emailOf(ids.owner), code: forOwner.data.code, newPassword: 'passwordbaru123', deviceLabel: 'tes' })).toMatchObject({ ok: true });
  });

  it('penerima laporan kosong: kabar ke Pemilik dan GM', async () => {
    const [hrPosition] = await sql`select id from hris.positions where name = 'Finance'`;
    await sql`insert into hris.setting_values (key, value, effective_from, status, reason)
      values ('accounts.recovery_contact_position', ${sql.json(String(hrPosition.id))}, '2026-01-02', 'ACTIVE', 'Uji jabatan tanpa orang')`;
    await resetInbox();
    const email = emailOf(ids.kasir);
    for (let i = 0; i < 3; i += 1) await recovery.verifyRecovery(facts(email, { birthDate: '2000-01-01' }));
    for (const id of [ids.owner, ids.gm]) expect((await inbox(id)).map((n) => n.kind)).toContain('account.recovery_blocked');
  });
});
