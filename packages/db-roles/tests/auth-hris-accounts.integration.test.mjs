import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import {
  findBackofficeUserOfAccount, findEmployeeAccount, linkBackofficeUser, linkExistingAccountToEmployee, listAccounts,
  listActiveSessions, listLoginEvents, provisionHrisAccount, resetPasswordByTrustedCaller, revokeAccountSessions,
  unlinkEmployeeAccount,
} from '../../auth/src/hris-accounts.ts'
import { passwordLogin } from '../../auth/src/sessions.ts'

// HRIS L2d: kelola akun dari HRIS lewat pemanggil tepercaya (tanpa migrasi baru).
const requireAuth = createRequire(new URL('../../auth/package.json', import.meta.url))
const { drizzle } = requireAuth('drizzle-orm/postgres-js')
const { migrate } = requireAuth('drizzle-orm/postgres-js/migrator')
const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL
const databaseName = `auth_hris_accounts_test_${process.pid}_${Date.now()}`
const authMigrations = new URL('../../auth/src/migrations/', import.meta.url)
let admin
let sql
let owner

async function session(accountId) {
  const [row] = await sql`insert into auth.sessions (account_id, token_hash, auth_method, expires_at)
    values (${accountId}, ${`${accountId}`.padEnd(64, 'a').slice(0, 64)}, 'PASSWORD', now() + interval '1 day') returning id`
  return row.id
}

describe.skipIf(!ADMIN_URL)('HRIS L2d: akun dari HRIS', () => {
  beforeAll(async () => {
    const adminUrl = new URL(ADMIN_URL)
    adminUrl.pathname = '/postgres'
    admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} })
    await admin.unsafe(`create database "${databaseName}"`)
    const url = new URL(ADMIN_URL)
    url.pathname = `/${databaseName}`
    sql = postgres(url.toString(), { max: 8, onnotice: () => {} })
    const migrationClient = postgres(url.toString(), { max: 1, onnotice: () => {} })
    await migrate(drizzle(migrationClient), { migrationsFolder: fileURLToPath(authMigrations), migrationsSchema: 'drizzle', migrationsTable: '__migrations_auth' })
    await migrationClient.end()
    ;[owner] = await sql`insert into auth.accounts (username, must_change_password) values ('pemilik', false) returning id`
    await sql`insert into auth.account_links (account_id, app_code, local_user_id) values (${owner.id}, 'hris', 1)`
  })

  afterAll(async () => {
    await sql?.end()
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`)
    await admin?.end()
  })

  it('buat akun karyawan: wajib ganti password, aman diulang, email kembar ditolak', async () => {
    const input = { idempotencyKey: 'hris-account:10:a', employeeId: 10, email: ' Rina@Contoh.id ', initialPassword: 'rahasia123', actorAccountId: owner.id }
    const first = await provisionHrisAccount(sql, input)
    expect(first).toMatchObject({ ok: true, created: true })
    expect(await provisionHrisAccount(sql, input)).toEqual({ ok: true, accountId: first.accountId, created: false })
    const [account] = await sql`select email, must_change_password, is_active from auth.accounts where id = ${first.accountId}`
    expect(account).toEqual({ email: 'rina@contoh.id', must_change_password: true, is_active: true })
    expect((await findEmployeeAccount(sql, 10))?.accountId).toBe(first.accountId)

    // Kunci lain untuk karyawan yang sama: sudah bertaut. Email yang sama untuk karyawan lain: ditolak.
    expect((await provisionHrisAccount(sql, { ...input, idempotencyKey: 'hris-account:10:b' })).code).toBe('LINK_CONFLICT')
    expect((await provisionHrisAccount(sql, { ...input, idempotencyKey: 'hris-account:11:a', employeeId: 11 })).code).toBe('EMAIL_TAKEN')
    expect((await provisionHrisAccount(sql, { ...input, idempotencyKey: 'hris-account:12:a', employeeId: 12, initialPassword: 'pendek' })).code).toBe('INVALID_REQUEST')

    const login = await passwordLogin(sql, { identifier: 'rina@contoh.id', password: 'rahasia123', appCode: 'hris' })
    // Masuk pertama hanya membuka langkah ganti password (sesi onboarding), belum akses HRIS.
    expect(login).toMatchObject({ ok: true, mustChangePassword: true })
  })

  it('tautkan akun lama, lepas, lalu tautkan ke akun yang benar', async () => {
    const [lama] = await sql`insert into auth.accounts (username) values ('kasirlama') returning id`
    const [salah] = await sql`insert into auth.accounts (username) values ('salahorang') returning id`
    expect(await linkExistingAccountToEmployee(sql, { accountId: salah.id, employeeId: 20, actorAccountId: owner.id })).toEqual({ ok: true, changed: true })
    // Karyawan sudah bertaut: akun lain ditolak; tautan yang sama: tidak berubah.
    expect((await linkExistingAccountToEmployee(sql, { accountId: lama.id, employeeId: 20, actorAccountId: owner.id })).code).toBe('LINK_CONFLICT')
    expect(await linkExistingAccountToEmployee(sql, { accountId: salah.id, employeeId: 20, actorAccountId: owner.id })).toEqual({ ok: true, changed: false })

    const sessionId = await session(salah.id)
    const [link] = await sql`select id from auth.account_links where account_id = ${salah.id} and app_code = 'hris'`
    await sql`insert into auth.session_app_access (session_id, app_code, account_link_id, local_user_id, last_active_at, expires_at)
      values (${sessionId}, 'hris', ${link.id}, 20, now(), now() + interval '1 day')`
    expect((await unlinkEmployeeAccount(sql, { employeeId: 20, actorAccountId: owner.id, reason: 'salah orang' })).ok).toBe(true)
    const [access] = await sql`select revoked_reason from auth.session_app_access where session_id = ${sessionId}`
    expect(access.revoked_reason).toBe('LINK_REVOKED')
    expect((await unlinkEmployeeAccount(sql, { employeeId: 20, actorAccountId: owner.id, reason: 'ulang' })).code).toBe('NOT_FOUND')

    expect(await linkExistingAccountToEmployee(sql, { accountId: lama.id, employeeId: 20, actorAccountId: owner.id })).toEqual({ ok: true, changed: true })
    expect((await findEmployeeAccount(sql, 20))?.accountId).toBe(lama.id)
    // Akun yang salah sekarang bebas dan bisa ditautkan ke orang lain.
    expect((await linkExistingAccountToEmployee(sql, { accountId: salah.id, employeeId: 21, actorAccountId: owner.id })).ok).toBe(true)
  })

  it('tidak bisa menautkan, melepas, mereset, atau mengeluarkan akun sendiri', async () => {
    expect((await linkExistingAccountToEmployee(sql, { accountId: owner.id, employeeId: 30, actorAccountId: owner.id })).code).toBe('SELF_FORBIDDEN')
    expect((await unlinkEmployeeAccount(sql, { employeeId: 1, actorAccountId: owner.id, reason: 'x' })).code).toBe('SELF_FORBIDDEN')
    expect((await resetPasswordByTrustedCaller(sql, { accountId: owner.id, newPassword: 'passwordbaru', actorAccountId: owner.id })).code).toBe('SELF_FORBIDDEN')
    expect((await revokeAccountSessions(sql, { accountId: owner.id, actorAccountId: owner.id })).code).toBe('SELF_FORBIDDEN')
  })

  it('reset password: wajib ganti dan semua sesi dicabut; keluarkan perangkat lain menyisakan sesi ini', async () => {
    const target = await findEmployeeAccount(sql, 10)
    await sql`update auth.accounts set must_change_password = false where id = ${target.accountId}`
    const a = await session(target.accountId)
    expect(await resetPasswordByTrustedCaller(sql, { accountId: target.accountId, newPassword: 'passwordbaru', actorAccountId: owner.id })).toEqual({ ok: true })
    const [state] = await sql`select a.must_change_password, s.revoked_reason from auth.accounts a join auth.sessions s on s.account_id = a.id where s.id = ${a}`
    expect(state).toEqual({ must_change_password: true, revoked_reason: 'PASSWORD_RESET' })

    const mine = await session(owner.id)
    const other = await sql`insert into auth.sessions (account_id, token_hash, auth_method, expires_at)
      values (${owner.id}, ${'b'.repeat(64)}, 'PASSWORD', now() + interval '1 day') returning id`
    expect(await revokeAccountSessions(sql, { accountId: owner.id, actorAccountId: owner.id, exceptSessionId: mine })).toEqual({ ok: true, revoked: 1 })
    expect((await listActiveSessions(sql, owner.id)).map((s) => s.sessionId)).toEqual([mine])
    const [revoked] = await sql`select revoked_reason from auth.sessions where id = ${other[0].id}`
    expect(revoked.revoked_reason).toBe('REVOKED_BY_USER')
  })

  it('tautan backoffice untuk pengguna kasir baru dari akun yang sudah ada', async () => {
    const target = await findEmployeeAccount(sql, 10)
    expect(await linkBackofficeUser(sql, { accountId: target.accountId, localUserId: 500, actorAccountId: owner.id })).toEqual({ ok: true, changed: true })
    expect(await linkBackofficeUser(sql, { accountId: target.accountId, localUserId: 500, actorAccountId: owner.id })).toEqual({ ok: true, changed: false })
    expect((await linkBackofficeUser(sql, { accountId: target.accountId, localUserId: 501, actorAccountId: owner.id })).code).toBe('LINK_CONFLICT')
    expect((await linkBackofficeUser(sql, { accountId: owner.id, localUserId: 500, actorAccountId: owner.id })).code).toBe('LINK_CONFLICT')
    expect(await findBackofficeUserOfAccount(sql, target.accountId)).toBe(500)
    const [row] = (await listAccounts(sql, { accountIds: [target.accountId] }))
    expect(row).toMatchObject({ hrisEmployeeId: 10, backofficeUserId: 500 })
  })

  it('riwayat masuk tersaring per akun dan hasil', async () => {
    await sql`insert into auth.login_events (account_id, app_code, auth_method, outcome) values
      (${owner.id}, 'hris', 'PASSWORD', 'SUCCESS'), (${owner.id}, 'hris', 'PASSWORD', 'REJECTED'), (null, 'hris', 'PASSWORD', 'REJECTED')`
    const window = { from: new Date(Date.now() - 3_600_000), to: new Date(Date.now() + 3_600_000), limit: 50, offset: 0 }
    expect((await listLoginEvents(sql, { ...window, accountId: owner.id })).total).toBe(2)
    expect((await listLoginEvents(sql, { ...window, outcome: 'REJECTED' })).total).toBeGreaterThanOrEqual(2)
    const all = await listLoginEvents(sql, window)
    expect(all.rows[0].id).toBeGreaterThan(all.rows[all.rows.length - 1].id)
  })
})
