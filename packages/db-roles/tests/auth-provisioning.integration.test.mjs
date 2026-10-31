import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import postgres from 'postgres'
import { provisionBackofficeAccount, listAccountHistory } from '../../auth/src/provisioning.ts'

const requireAuth = createRequire(new URL('../../auth/package.json', import.meta.url))
const { drizzle } = requireAuth('drizzle-orm/postgres-js')
const { migrate } = requireAuth('drizzle-orm/postgres-js/migrator')
const migrationDirectory = new URL('../../auth/src/migrations/', import.meta.url)
const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL
const databaseName = `auth_provisioning_test_${process.pid}_${Date.now()}`
let admin, sql

const base = (overrides = {}) => ({
  idempotencyKey: 'kunci-uji-0001', localUserId: 7, username: 'Budi', email: null,
  passwordHash: '$argon2id$contoh', mustChangePassword: true, isActive: true, actorAccountId: null, ...overrides,
})

async function counts() {
  const [row] = await sql`select (select count(*)::integer from auth.accounts) as accounts,
    (select count(*)::integer from auth.account_links) as links,
    (select count(*)::integer from auth.provisioning_requests) as requests`
  return row
}

describe.skipIf(!ADMIN_URL)('pintu provisioning akun backoffice', () => {
  beforeAll(async () => {
    const adminUrl = new URL(ADMIN_URL)
    adminUrl.pathname = '/postgres'
    admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} })
    await admin.unsafe(`create database "${databaseName}"`)
    const url = new URL(ADMIN_URL)
    url.pathname = `/${databaseName}`
    sql = postgres(url.toString(), { max: 6, onnotice: () => {} })
    await migrate(drizzle(sql), { migrationsFolder: migrationDirectory.pathname.replace(/^\/([A-Za-z]:)/, '$1') })
  })
  afterAll(async () => {
    await sql?.end()
    await admin?.unsafe(`drop database if exists "${databaseName}"`)
    await admin?.end()
  })
  beforeEach(async () => {
    await sql`truncate auth.provisioning_requests, auth.audit_events, auth.account_links, auth.accounts restart identity cascade`
  })

  it('membuat akun dan tautan, identifier dinormalkan, hash disalin apa adanya', async () => {
    const result = await provisionBackofficeAccount(sql, base())
    expect(result).toMatchObject({ ok: true, created: true })
    const [account] = await sql`select * from auth.accounts`
    expect(account).toMatchObject({ username: 'budi', password_hash: '$argon2id$contoh', must_change_password: true, legacy_backoffice_user_id: 7 })
    expect(await counts()).toEqual({ accounts: 1, links: 1, requests: 1 })
  })

  it('kunci sama diulang: akun sama, tanpa duplikasi', async () => {
    const first = await provisionBackofficeAccount(sql, base())
    const second = await provisionBackofficeAccount(sql, base())
    expect(second).toMatchObject({ ok: true, created: false, accountId: first.accountId })
    expect(await counts()).toEqual({ accounts: 1, links: 1, requests: 1 })
  })

  it('kunci baru untuk user yang sama menemukan tautan lama', async () => {
    const first = await provisionBackofficeAccount(sql, base())
    const second = await provisionBackofficeAccount(sql, base({ idempotencyKey: 'kunci-uji-0002' }))
    expect(second).toMatchObject({ ok: true, created: false, accountId: first.accountId })
    expect(await counts()).toEqual({ accounts: 1, links: 1, requests: 2 })
  })

  it('kunci sama dengan isi berbeda ditolak', async () => {
    await provisionBackofficeAccount(sql, base())
    const result = await provisionBackofficeAccount(sql, base({ username: 'orang-lain' }))
    expect(result).toMatchObject({ ok: false, code: 'IDEMPOTENCY_CONFLICT' })
  })

  it('dua permintaan serentak dengan kunci berbeda tetap satu akun', async () => {
    const results = await Promise.all([1, 2, 3, 4].map((n) => provisionBackofficeAccount(sql, base({ idempotencyKey: `kunci-serentak-${n}` }))))
    expect(results.every((r) => r.ok)).toBe(true)
    expect(new Set(results.map((r) => r.accountId)).size).toBe(1)
    expect((await counts()).accounts).toBe(1)
  })

  it('gagal di tengah (tautan tak bisa dibuat) membatalkan semuanya, retry melengkapi', async () => {
    await sql`create or replace function auth.fail_link() returns trigger language plpgsql as $$ begin raise exception 'gagal sengaja'; end $$`
    await sql`create trigger fail_link before insert on auth.account_links for each row execute function auth.fail_link()`
    await expect(provisionBackofficeAccount(sql, base())).rejects.toThrow()
    expect(await counts()).toEqual({ accounts: 0, links: 0, requests: 0 })
    await sql`drop trigger fail_link on auth.account_links`
    const retry = await provisionBackofficeAccount(sql, base())
    expect(retry).toMatchObject({ ok: true, created: true })
    expect(await counts()).toEqual({ accounts: 1, links: 1, requests: 1 })
  })

  it('akun yatim hasil impor user yang sama dilengkapi tautannya; milik user lain 409-setara', async () => {
    await sql`insert into auth.accounts (username, legacy_backoffice_user_id) values ('budi', 7)`
    const completed = await provisionBackofficeAccount(sql, base())
    expect(completed).toMatchObject({ ok: true, created: false })
    expect((await counts()).accounts).toBe(1)

    await sql`insert into auth.accounts (username, legacy_backoffice_user_id) values ('sari', 99)`
    const conflict = await provisionBackofficeAccount(sql, base({ idempotencyKey: 'kunci-uji-0009', localUserId: 8, username: 'sari' }))
    expect(conflict).toMatchObject({ ok: false, code: 'LINK_CONFLICT' })
  })

  it('menolak masukan tidak valid dan mencatat riwayat tanpa rahasia', async () => {
    expect(await provisionBackofficeAccount(sql, base({ idempotencyKey: 'pendek' }))).toMatchObject({ ok: false, code: 'INVALID_REQUEST' })
    expect(await provisionBackofficeAccount(sql, base({ username: null, email: null }))).toMatchObject({ ok: false, code: 'INVALID_REQUEST' })
    const ok = await provisionBackofficeAccount(sql, base())
    const history = await listAccountHistory(sql, ok.accountId)
    expect(history).toHaveLength(1)
    expect(history[0].action).toBe('ACCOUNT_PROVISIONED')
    expect(JSON.stringify(history)).not.toContain('argon2')
  })
})
