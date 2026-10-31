import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import postgres from 'postgres'
import { backfillLegacyAccounts, preflightLegacyAccounts } from '../../auth/src/backfill.mjs'

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL
const databaseName = `auth_accounts_test_${process.pid}_${Date.now()}`
const migrationDirectory = new URL('../../auth/src/migrations/', import.meta.url)
const cliPath = fileURLToPath(new URL('../../auth/scripts/backfill.mjs', import.meta.url))
let admin
let sql
let testUrl

async function sourceUser(values = {}) {
  const [user] = await sql`
    insert into petshop.users ${sql({
      username: null, email: null, password_hash: null,
      is_active: true, must_change_credentials: false, ...values,
    })} returning id
  `
  return user.id
}

async function account(values = {}) {
  const [created] = await sql`insert into auth.accounts ${sql({ username: null, ...values })} returning id`
  return created.id
}

async function counts() {
  const [row] = await sql`select (select count(*)::integer from auth.accounts) as accounts,
    (select count(*)::integer from auth.account_links) as links`
  return row
}

function runCli(args = [], databaseUrl = testUrl) {
  const env = { ...process.env }
  delete env.DATABASE_URL
  if (databaseUrl) env.DATABASE_URL = databaseUrl
  return spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf8', env })
}

describe.skipIf(!ADMIN_URL)('fondasi akun auth dan impor pengguna lama', () => {
  beforeAll(async () => {
    const adminUrl = new URL(ADMIN_URL)
    adminUrl.pathname = '/postgres'
    admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} })
    // Database sintetis milik tes; sumber minimal menguji kontrak kolom tanpa menyentuh data app.
    await admin.unsafe(`create database "${databaseName}"`)
    const url = new URL(ADMIN_URL)
    url.pathname = `/${databaseName}`
    testUrl = url.toString()
    sql = postgres(testUrl, { max: 4, onnotice: () => {} })
    for (const file of readdirSync(migrationDirectory).filter((file) => file.endsWith('.sql')).sort()) {
      await sql.unsafe(readFileSync(new URL(file, migrationDirectory), 'utf8')).simple()
    }
    await sql`create schema petshop`
    await sql`create table petshop.users (
      id serial primary key, username varchar(50), email varchar(255), password_hash text,
      is_active boolean not null default true, must_change_credentials boolean not null default false
    )`
  })

  beforeEach(async () => {
    await sql`truncate auth.audit_events, auth.login_events, auth.session_app_access, auth.sessions, auth.account_links, auth.accounts, petshop.users restart identity`
  })

  afterAll(async () => {
    if (sql) await sql.end()
    if (admin) {
      if (/^auth_accounts_test_\d+_\d+$/.test(databaseName)) {
        await admin.unsafe(`drop database if exists "${databaseName}"`)
      }
      await admin.end()
    }
  })

  it('preflight hanya membaca; apply menyalin hash, status, onboarding dan akun PIN-only', async () => {
    await sourceUser({ username: ' Staff ', email: ' STAFF@EXAMPLE.TEST ', password_hash: '$argon2id$hash-disalin-persis', is_active: false, must_change_credentials: true })
    await sourceUser()
    const report = await preflightLegacyAccounts(sql)
    expect(report).toMatchObject({ canApply: true, pendingCount: 2, missingIdentifierCount: 1, passwordlessCount: 1,
      activeCount: 1, inactiveCount: 1, mustChangePasswordCount: 1 })
    expect(await counts()).toEqual({ accounts: 0, links: 0 })
    expect(await backfillLegacyAccounts(sql)).toMatchObject({ importedCount: 2 })
    const accounts = await sql`select * from auth.accounts order by id`
    expect(accounts[0]).toMatchObject({ username: 'staff', email: 'staff@example.test', password_hash: '$argon2id$hash-disalin-persis', is_active: false, must_change_password: true, legacy_backoffice_user_id: 1 })
    expect(accounts[0].imported_at).toBeInstanceOf(Date)
    expect(accounts[1]).toMatchObject({ username: null, email: null, password_hash: null })
    expect(await counts()).toEqual({ accounts: 2, links: 2 })
  })

  it('menolak seluruh muatan bila username/email bentrok setelah trim dan lower', async () => {
    const first = await sourceUser({ username: ' SHARED ' })
    const second = await sourceUser({ email: 'shared' })
    await sourceUser({ username: 'aman' })
    const report = await preflightLegacyAccounts(sql)
    expect(report.canApply).toBe(false)
    expect(report.conflicts[0].sourceUserIds).toEqual([first, second])
    await expect(backfillLegacyAccounts(sql)).rejects.toThrow('konflik')
    expect(await counts()).toEqual({ accounts: 0, links: 0 })
  })

  it('menerima username dan email yang sama pada satu orang', async () => {
    await sourceUser({ username: 'same', email: 'SAME' })
    await expect(backfillLegacyAccounts(sql)).resolves.toMatchObject({ importedCount: 1 })
  })

  it('trim tab, baris baru dan NBSP mendeteksi konflik lintas kolom sebelum menulis', async () => {
    const first = await sourceUser({ username: '\t\nSHARED\u00a0' })
    const second = await sourceUser({ email: '\u00a0shared\r\n' })
    expect((await preflightLegacyAccounts(sql)).conflicts[0].sourceUserIds).toEqual([first, second])
    await expect(backfillLegacyAccounts(sql)).rejects.toThrow('konflik')
    expect(await counts()).toEqual({ accounts: 0, links: 0 })
  })

  it('whitespace ECMAScript saja menjadi null dan constraint menolak identifier belum di-trim', async () => {
    const whitespace = '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff'
    await sourceUser({ username: whitespace, email: whitespace })
    expect(await backfillLegacyAccounts(sql)).toMatchObject({ importedCount: 1, missingIdentifierCount: 1 })
    const [imported] = await sql`select username, email from auth.accounts`
    expect(imported).toEqual({ username: null, email: null })
    for (const character of whitespace) {
      await expect(account({ username: `${character}value` })).rejects.toThrow()
      await expect(account({ email: `value${character}` })).rejects.toThrow()
    }
  })

  it('menolak identifier yang sudah dipakai akun pusat termasuk lintas kolom', async () => {
    await sourceUser({ username: 'used' })
    await account({ email: 'used' })
    await expect(backfillLegacyAccounts(sql)).rejects.toThrow('konflik')
    expect(await counts()).toEqual({ accounts: 1, links: 0 })
  })

  it('retry tidak menimpa password, status atau identifier pusat yang berubah', async () => {
    await sourceUser({ username: 'lama', password_hash: 'hash-lama' })
    await backfillLegacyAccounts(sql)
    await sql`update auth.accounts set username = 'baru', password_hash = 'hash-baru', is_active = false`
    expect(await backfillLegacyAccounts(sql)).toMatchObject({ importedCount: 0, linkedCount: 1 })
    const [existing] = await sql`select username, password_hash, is_active from auth.accounts`
    expect(existing).toEqual({ username: 'baru', password_hash: 'hash-baru', is_active: false })
  })

  it('mempertahankan tautan manual yang sah ke akun pusat tanpa jejak impor', async () => {
    const userId = await sourceUser({ username: 'local' })
    const accountId = await account({ username: 'central' })
    await sql`insert into auth.account_links (account_id, app_code, local_user_id) values (${accountId}, 'backoffice', ${userId})`
    expect(await backfillLegacyAccounts(sql)).toMatchObject({ importedCount: 0 })
  })

  it('menolak tautan impor yang menunjuk orang berbeda atau sumber yang hilang', async () => {
    const userId = await sourceUser()
    const accountId = await account({ legacy_backoffice_user_id: userId + 1, imported_at: new Date() })
    await sql`insert into auth.account_links (account_id, app_code, local_user_id) values (${accountId}, 'backoffice', ${userId})`
    expect((await preflightLegacyAccounts(sql)).conflicts[0].code).toBe('LINK_INCONSISTENT')
    await expect(backfillLegacyAccounts(sql)).rejects.toThrow('konflik')
    await sql`delete from petshop.users where id = ${userId}`
    expect((await preflightLegacyAccounts(sql)).conflicts[0].code).toBe('LINK_INCONSISTENT')
  })

  it('menolak jejak impor tanpa tautan sehingga tidak membuat akun kedua', async () => {
    const userId = await sourceUser()
    await account({ legacy_backoffice_user_id: userId, imported_at: new Date() })
    await expect(backfillLegacyAccounts(sql)).rejects.toThrow('konflik')
    expect(await counts()).toEqual({ accounts: 1, links: 0 })
  })

  it('dua apply serentak tetap membuat satu akun per pengguna', async () => {
    await sourceUser({ username: 'bersama' })
    const results = await Promise.all([backfillLegacyAccounts(sql), backfillLegacyAccounts(sql)])
    expect(results.map((result) => result.importedCount).sort()).toEqual([0, 1])
    expect(await counts()).toEqual({ accounts: 1, links: 1 })
  })

  it('kegagalan insert tautan membatalkan seluruh akun dalam transaksi', async () => {
    await sourceUser({ username: 'rollback' })
    await sql`create function auth.reject_test_link() returns trigger language plpgsql as $$ begin raise exception 'gagal-uji'; end $$`
    await sql`create trigger reject_test_link before insert on auth.account_links for each row execute function auth.reject_test_link()`
    try {
      await expect(backfillLegacyAccounts(sql)).rejects.toThrow('gagal-uji')
      expect(await counts()).toEqual({ accounts: 0, links: 0 })
    } finally {
      await sql`drop trigger reject_test_link on auth.account_links`
      await sql`drop function auth.reject_test_link()`
    }
  })

  it('constraint menjaga normalisasi serta satu tautan per akun/app dan id lokal/app', async () => {
    await expect(account({ username: 'UPPER' })).rejects.toThrow()
    const first = await account({ username: 'first' })
    const second = await account({ username: 'second' })
    await expect(account({ username: 'first' })).rejects.toThrow()
    await sql`insert into auth.account_links (account_id, app_code, local_user_id) values (${first}, 'backoffice', 1)`
    await expect(sql`insert into auth.account_links (account_id, app_code, local_user_id) values (${first}, 'backoffice', 2)`).rejects.toThrow()
    await expect(sql`insert into auth.account_links (account_id, app_code, local_user_id) values (${second}, 'backoffice', 1)`).rejects.toThrow()
    await expect(sql`insert into auth.account_links (account_id, app_code, local_user_id) values (${first}, 'hris', 1)`).resolves.toBeDefined()
  })

  it('CLI default readonly, apply eksplisit, dan keluaran tidak berisi kredensial', async () => {
    await sourceUser({ username: 'secret-identifier', password_hash: 'secret-password-hash' })
    const preflight = runCli()
    expect(preflight.status).toBe(0)
    expect(JSON.parse(preflight.stdout)).toMatchObject({ mode: 'preflight', pendingCount: 1 })
    expect(await counts()).toEqual({ accounts: 0, links: 0 })
    const apply = runCli(['--apply'])
    expect(apply.status).toBe(0)
    expect(JSON.parse(apply.stdout)).toMatchObject({ mode: 'apply', importedCount: 1 })
    expect(preflight.stdout + preflight.stderr + apply.stdout + apply.stderr).not.toMatch(/secret-identifier|secret-password-hash/)
  })

  it('CLI menolak DATABASE_URL kosong dan argumen asing tanpa membaca env repo', () => {
    const missingUrl = runCli([], '')
    expect(missingUrl.status).toBe(1)
    expect(missingUrl.stderr).toContain('DATABASE_URL wajib')
    expect(runCli(['--force']).status).toBe(1)
  })

  it('grant aktual memberi akses auth ke BO/HRIS dan menolak portal pelanggan', async () => {
    const url = new URL(ADMIN_URL)
    url.pathname = `/${process.env.ROLES_TEST_DB ?? 'petshop_db'}`
    const migrated = postgres(url.toString(), { max: 1, onnotice: () => {} })
    try {
      for (const role of ['bo_app', 'hris_app']) {
        await expect(migrated.begin(async (transaction) => {
          await transaction.unsafe(`set local role ${role}`)
          const [created] = await transaction`insert into auth.accounts default values returning id`
          await transaction`insert into auth.account_links (account_id, app_code, local_user_id)
            values (${created.id}, 'role_test', ${created.id})`
          await transaction`select 1 from auth.accounts limit 1`
          await transaction`select 1 from auth.account_links limit 1`
          throw new Error('rollback-uji-hak-auth')
        })).rejects.toThrow('rollback-uji-hak-auth')
      }
      await expect(migrated.begin(async (transaction) => {
        await transaction`set local role order_app`
        await transaction`select 1 from auth.accounts limit 1`
      })).rejects.toThrow(/permission denied/)
      await expect(migrated.begin(async (transaction) => {
        await transaction`set local role order_app`
        await transaction`select 1 from auth.account_links limit 1`
      })).rejects.toThrow(/permission denied/)
      await expect(migrated.begin(async (transaction) => {
        await transaction`set local role hris_app`
        await transaction`select 1 from petshop.users limit 1`
      })).rejects.toThrow(/permission denied/)
    } finally {
      await migrated.end()
    }
  })
})
