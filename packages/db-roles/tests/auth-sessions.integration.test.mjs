import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { passwordLogin, startVerifiedPinSession, openAppAccess, validateSession, logoutSession, HRIS_IDLE_MS } from '../../auth/src/sessions.ts'
import { changePassword, resetPassword, deactivateAccount, revokeAccountLink } from '../../auth/src/credentials.ts'
import { sessionCookieOptions, issueCsrfToken, assertTrustedMutation } from '../../auth/src/http.ts'

const requireAuth = createRequire(new URL('../../auth/package.json', import.meta.url))
const argon2 = requireAuth('argon2')
const { drizzle } = requireAuth('drizzle-orm/postgres-js')
const { migrate } = requireAuth('drizzle-orm/postgres-js/migrator')
const migrationDirectory = new URL('../../auth/src/migrations/', import.meta.url)
const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL
const databaseName = `auth_sessions_test_${process.pid}_${Date.now()}`
const policy = { role: 'KASIR', ttlMs: 86_400_000 }
const password = 'password-uji-lama'
let sql, admin, passwordHash, testUrl

// Hanya hasil pembacaan jam diganti; transaksi, kunci dan mutasi tetap PostgreSQL nyata.
function clocked(client, now) {
  return new Proxy(client, {
    get(target, key) {
      if (key === 'begin') return (callback) => target.begin((tx) => callback(clocked(tx, now)))
      const value = Reflect.get(target, key)
      return typeof value === 'function' ? value.bind(target) : value
    },
    apply(target, receiver, args) {
      if (args[0]?.[0] === 'select clock_timestamp() as now') return Promise.resolve([{ now }])
      return Reflect.apply(target, receiver, args)
    },
  })
}

async function account(username = 'staff', values = {}) {
  const [row] = await sql`insert into auth.accounts ${sql({
    username, password_hash: passwordHash, must_change_password: false, ...values,
  })} returning id`
  await sql`insert into auth.account_links (account_id, app_code, local_user_id)
    values (${row.id}, 'backoffice', ${row.id}), (${row.id}, 'hris', ${row.id})`
  return row.id
}

async function login(appCode = 'backoffice', overrides = {}) {
  return passwordLogin(sql, { identifier: 'staff', password, appCode, backoffice: policy, ...overrides })
}

async function owner() {
  await account('owner')
  const session = await login('backoffice', { identifier: 'owner', backoffice: { ...policy, role: 'OWNER' } })
  expect(session.ok).toBe(true)
  return { token: session.token, role: 'OWNER' }
}

describe.skipIf(!ADMIN_URL)('mesin sesi dan kredensial auth', () => {
  beforeAll(async () => {
    const url = new URL(ADMIN_URL)
    url.pathname = '/postgres'
    admin = postgres(url.toString(), { max: 1, onnotice: () => {} })
    await admin.unsafe(`create database "${databaseName}"`)
    url.pathname = `/${databaseName}`
    testUrl = url.toString()
    sql = postgres(url.toString(), { max: 8, onnotice: () => {} })
    // Migrator nyata mencakup DB kosong, lalu aman dipanggil kembali.
    const migrationClient = postgres(url.toString(), { max: 1, onnotice: () => {} })
    await migrate(drizzle(migrationClient), { migrationsFolder: fileURLToPath(migrationDirectory), migrationsSchema: 'drizzle', migrationsTable: '__migrations_auth' })
    await migrate(drizzle(migrationClient), { migrationsFolder: fileURLToPath(migrationDirectory), migrationsSchema: 'drizzle', migrationsTable: '__migrations_auth' })
    await migrationClient.end()
    passwordHash = await argon2.hash(password)
  })

  beforeEach(async () => {
    await sql`truncate auth.audit_events, auth.login_events, auth.session_app_access, auth.sessions,
      auth.account_links, auth.accounts restart identity`
  })

  afterAll(async () => {
    if (sql) await sql.end()
    if (admin) {
      if (/^auth_sessions_test_\d+_\d+$/.test(databaseName)) await admin.unsafe(`drop database if exists "${databaseName}"`)
      await admin.end()
    }
  })

  it('menormalisasi identifier, hanya menyimpan hash token, mencatat perangkat tanpa rahasia', async () => {
    await account()
    const result = await login('backoffice', { identifier: '\u00a0 STAFF\ufeff', deviceLabel: 'PC toko' })
    expect(result.ok).toBe(true)
    expect(await validateSession(sql, result.token, 'backoffice')).toMatchObject({ ok: true, localUserId: 1 })
    const [stored] = await sql`select * from auth.sessions`
    expect(stored.token_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(stored.token_hash).not.toBe(result.token)
    const events = await sql`select * from auth.login_events`
    const audit = await sql`select * from auth.audit_events`
    expect(events[0].device_label).toBe('PC toko')
    expect(JSON.stringify([...events, ...audit])).not.toContain(password)
    expect(JSON.stringify([...events, ...audit])).not.toContain(passwordHash)
    expect(JSON.stringify([...events, ...audit])).not.toContain(result.token)
  })

  it('tetap memvalidasi tanggal ketika koneksi postgres memakai parser string Drizzle', async () => {
    const id = await account()
    const actor = await owner()
    const parsed = postgres(testUrl, { max: 1, onnotice: () => {} })
    try {
      drizzle(parsed)
      const result = await passwordLogin(parsed, { identifier: 'staff', password, appCode: 'hris' })
      expect(result.ok).toBe(true)
      expect(await validateSession(parsed, result.token, 'hris')).toMatchObject({ ok: true })
      await parsed`update auth.session_app_access set expires_at = clock_timestamp() where session_id = ${result.sessionId}`
      expect(await validateSession(parsed, result.token, 'hris')).toMatchObject({ ok: false })
      expect(await resetPassword(parsed, { accountId: id, newPassword: 'password-baru', actor })).toMatchObject({ ok: true })
    } finally { await parsed.end() }
  })

  it('menolak akun tidak dikenal, nonaktif, PIN-only dan identifier ambigu dengan kegagalan seragam', async () => {
    const id = await account('staff', { email: 'other', is_active: false })
    const missing = await login('hris', { identifier: 'unknown' })
    expect(await login('hris')).toEqual(missing)
    await sql`update auth.accounts set is_active = true, password_hash = null where id = ${id}`
    expect(await login('hris')).toEqual(missing)
    await account('other')
    expect(await login('hris', { identifier: 'other' })).toEqual(missing)
    expect(await sql`select id from auth.sessions`).toHaveLength(0)
  })

  it('lima gagal paralel ter-commit, terkunci lima menit dan batas berakhir mengizinkan login', async () => {
    await account()
    const outcomes = await Promise.all(Array.from({ length: 5 }, () => login('hris', { password: 'salah' })))
    expect(outcomes.every((r) => !r.ok)).toBe(true)
    const [row] = await sql`select *, clock_timestamp() as now from auth.accounts`
    expect(row.failed_login_count).toBe(5)
    expect(row.locked_until.getTime() - row.now.getTime()).toBeGreaterThan(299_000)
    expect(await login('hris')).toMatchObject({ ok: false })
    await sql`update auth.accounts set locked_until = clock_timestamp()`
    expect(await login('hris')).toMatchObject({ ok: true })
    expect((await sql`select failed_login_count, locked_until from auth.accounts`)[0]).toMatchObject({ failed_login_count: 0, locked_until: null })
  })

  it('sisa lock tidak ditambah permintaan baru, kegagalan sesudah lock mulai menghitung ulang', async () => {
    await account('staff', { failed_login_count: 5, locked_until: new Date(Date.now() + 60_000) })
    const [before] = await sql`select locked_until from auth.accounts`
    await login('hris', { password: 'salah' })
    expect((await sql`select locked_until from auth.accounts`)[0].locked_until).toEqual(before.locked_until)
    await sql`update auth.accounts set locked_until = clock_timestamp()`
    await login('hris', { password: 'salah' })
    expect((await sql`select failed_login_count from auth.accounts`)[0].failed_login_count).toBe(1)
  })

  it('batas tepat lock dan expiry memakai jam terkendali tanpa jeda', async () => {
    await account()
    const start = new Date('2030-01-01T00:00:00.000Z')
    const input = { identifier: 'staff', password, appCode: 'backoffice', backoffice: policy }
    for (let i = 0; i < 5; i++) await passwordLogin(clocked(sql, start), { ...input, password: 'salah' })
    const end = new Date(start.getTime() + 300_000)
    expect(await passwordLogin(clocked(sql, new Date(end.getTime() - 1)), input)).toMatchObject({ ok: false })
    const a = await passwordLogin(clocked(sql, end), input)
    expect(a.ok).toBe(true)
    const expiry = new Date(end.getTime() + policy.ttlMs)
    expect(await validateSession(clocked(sql, new Date(expiry.getTime() - 1)), a.token, 'backoffice')).toMatchObject({ ok: true })
    expect(await validateSession(clocked(sql, expiry), a.token, 'backoffice')).toMatchObject({ ok: false })
    expect(await openAppAccess(clocked(sql, expiry), a.token, 'backoffice', policy)).toMatchObject({ ok: false })
    const b = await passwordLogin(clocked(sql, start), { ...input, appCode: 'hris' })
    await sql`update auth.sessions set expires_at = '2031-01-01' where id = ${b.sessionId}`
    const hrisExpiry = new Date(start.getTime() + HRIS_IDLE_MS)
    expect(await validateSession(clocked(sql, hrisExpiry), b.token, 'hris')).toMatchObject({ ok: false })
    expect(await openAppAccess(clocked(sql, hrisExpiry), b.token, 'hris')).toMatchObject({ ok: false })
    await sql`update auth.sessions set expires_at = ${hrisExpiry.toISOString()} where id = ${b.sessionId}`
    expect(await openAppAccess(clocked(sql, hrisExpiry), b.token, 'backoffice', policy)).toMatchObject({ ok: false })
  })

  it('dua login BO paralel menyisakan satu akses tanpa mematikan HRIS; takeover tidak bangkit', async () => {
    await account()
    const hris = await login('hris')
    const logins = await Promise.all([login(), login()])
    const valid = await Promise.all(logins.map((r) => validateSession(sql, r.token, 'backoffice')))
    expect(valid.filter((r) => r.ok)).toHaveLength(1)
    const rejected = logins[valid.findIndex((r) => !r.ok)]
    expect(await openAppAccess(sql, rejected.token, 'backoffice', policy)).toMatchObject({ ok: false })
    expect(await validateSession(sql, hris.token, 'hris')).toMatchObject({ ok: true })
    expect(await openAppAccess(sql, rejected.token, 'hris')).toMatchObject({ ok: true })
  })

  it('bootstrap BO paralel juga mengambil alih secara serial, OWNER boleh dua PC', async () => {
    await account()
    const a = await login('hris'), b = await login('hris')
    await Promise.all([openAppAccess(sql, a.token, 'backoffice', policy), openAppAccess(sql, b.token, 'backoffice', policy)])
    expect((await Promise.all([validateSession(sql, a.token, 'backoffice'), validateSession(sql, b.token, 'backoffice')])).filter((r) => r.ok)).toHaveLength(1)
    const c = await login('backoffice', { backoffice: { ...policy, role: 'OWNER' } })
    const d = await login('backoffice', { backoffice: { ...policy, role: 'OWNER' } })
    expect(await validateSession(sql, c.token, 'backoffice')).toMatchObject({ ok: true })
    expect(await validateSession(sql, d.token, 'backoffice')).toMatchObject({ ok: true })
  })

  it('PIN-only membuka BO tetapi tidak HRIS; PIN tidak melewati password awal/reset', async () => {
    const id = await account('staff', { password_hash: null, must_change_password: true })
    const pin = await startVerifiedPinSession(sql, { accountId: id, localUserId: id, backoffice: policy })
    expect(pin.ok).toBe(true)
    expect(await validateSession(sql, pin.token, 'backoffice')).toMatchObject({ ok: true })
    expect(await openAppAccess(sql, pin.token, 'hris')).toMatchObject({ ok: false, code: 'PASSWORD_REQUIRED' })
    await sql`update auth.accounts set password_hash = ${passwordHash} where id = ${id}`
    expect(await startVerifiedPinSession(sql, { accountId: id, localUserId: id, backoffice: policy })).toMatchObject({ ok: false, code: 'PASSWORD_CHANGE_REQUIRED' })
    expect(await startVerifiedPinSession(sql, { accountId: id, localUserId: 99, backoffice: policy })).toMatchObject({ ok: false })
  })

  it('onboarding membatasi akses dan mengganti password merotasi token tanpa melonggarkan kebijakan sesi lain', async () => {
    await account('staff', { must_change_password: true })
    const initial = await login('hris')
    expect(initial).toMatchObject({ ok: true, mustChangePassword: true })
    expect(await openAppAccess(sql, initial.token, 'hris')).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' })
    expect(await validateSession(sql, initial.token, 'hris')).toMatchObject({ ok: false })
    const changed = await changePassword(sql, { token: initial.token, currentPassword: password, newPassword: 'password-baru', revokeOtherSessions: true })
    expect(changed.ok).toBe(true)
    expect(await openAppAccess(sql, initial.token, 'hris')).toMatchObject({ ok: false })
    expect(await openAppAccess(sql, changed.token, 'hris')).toMatchObject({ ok: true })
    expect(await login('hris')).toMatchObject({ ok: false })
    expect(await login('hris', { password: 'password-baru' })).toMatchObject({ ok: true })
  })

  it('ganti password normal meminta kebijakan eksplisit dan mempertahankan/mencabut sesi sesuai pilihan', async () => {
    await account()
    const a = await login('hris'), b = await login('hris')
    await expect(changePassword(sql, { token: a.token, currentPassword: password, newPassword: 'password-baru' })).rejects.toThrow('Kebijakan')
    const first = await changePassword(sql, { token: a.token, currentPassword: password, newPassword: 'password-baru', revokeOtherSessions: false })
    expect(first.ok).toBe(true)
    expect(await validateSession(sql, b.token, 'hris')).toMatchObject({ ok: true })
    await changePassword(sql, { token: first.token, currentPassword: 'password-baru', newPassword: 'password-ketiga', revokeOtherSessions: true })
    expect(await validateSession(sql, b.token, 'hris')).toMatchObject({ ok: false })
  })

  it('pergantian akun mencabut seluruh konteks sebelumnya hanya sesudah login sukses', async () => {
    await account(), await account('second')
    const a = await login('hris')
    await login('hris', { identifier: 'second', password: 'salah', previousToken: a.token })
    expect(await validateSession(sql, a.token, 'hris')).toMatchObject({ ok: true })
    const b = await login('hris', { identifier: 'second', previousToken: a.token })
    expect(b.ok).toBe(true)
    expect(await validateSession(sql, a.token, 'hris')).toMatchObject({ ok: false })
    expect(await validateSession(sql, b.token, 'hris')).toMatchObject({ ok: true })
  })

  it('pergantian silang dua akun serentak tidak deadlock atau menghidupkan konteks lama', async () => {
    await account(), await account('second')
    const a = await login('hris'), b = await login('hris', { identifier: 'second' })
    const switched = await Promise.all([
      login('hris', { identifier: 'second', previousToken: a.token }),
      login('hris', { previousToken: b.token }),
    ])
    expect(switched.every((r) => r.ok)).toBe(true)
    expect(await validateSession(sql, a.token, 'hris')).toMatchObject({ ok: false })
    expect(await validateSession(sql, b.token, 'hris')).toMatchObject({ ok: false })
    expect((await Promise.all(switched.map((r) => validateSession(sql, r.token, 'hris')))).every((r) => r.ok)).toBe(true)
  })

  it('aktivitas BO tidak memperpanjang HRIS, HRIS rolling 30 hari dan bootstrap tua memperpanjang parent', async () => {
    await account()
    const a = await login('backoffice')
    await sql`update auth.sessions set expires_at = clock_timestamp() + interval '1 day' where id = ${a.sessionId}`
    expect(await openAppAccess(sql, a.token, 'hris')).toMatchObject({ ok: true })
    const [parent] = await sql`select expires_at, clock_timestamp() as now from auth.sessions where id = ${a.sessionId}`
    expect(parent.expires_at.getTime() - parent.now.getTime()).toBeGreaterThan(HRIS_IDLE_MS - 1000)
    const [before] = await sql`select expires_at from auth.session_app_access where app_code = 'hris'`
    await validateSession(sql, a.token, 'backoffice')
    expect((await sql`select expires_at from auth.session_app_access where app_code = 'hris'`)[0].expires_at).toEqual(before.expires_at)
    await sql`update auth.session_app_access set expires_at = clock_timestamp() + interval '1 day' where app_code = 'hris'`
    expect(await validateSession(sql, a.token, 'hris')).toMatchObject({ ok: true })
    const [rolling] = await sql`select expires_at, clock_timestamp() as now from auth.session_app_access where app_code = 'hris'`
    expect(rolling.expires_at.getTime() - rolling.now.getTime()).toBeGreaterThan(HRIS_IDLE_MS - 1000)
    await sql`update auth.session_app_access set expires_at = clock_timestamp() where app_code = 'hris'`
    expect(await validateSession(sql, a.token, 'hris')).toMatchObject({ ok: false })
    expect(await openAppAccess(sql, a.token, 'hris')).toMatchObject({ ok: false })
  })

  it('token/sesi kedaluwarsa dan tanpa tautan ditolak tanpa membuat akses', async () => {
    await account()
    expect(await validateSession(sql, 'token-palsu', 'hris')).toMatchObject({ ok: false })
    const a = await login('hris')
    await sql`update auth.sessions set expires_at = clock_timestamp() where id = ${a.sessionId}`
    expect(await validateSession(sql, a.token, 'hris')).toMatchObject({ ok: false })
    await sql`update auth.account_links set revoked_at = clock_timestamp() where app_code = 'hris'`
    expect(await login('hris')).toMatchObject({ ok: false, code: 'APP_ACCESS_DENIED' })
  })

  it('logout salah satu app mencabut kedua akses perangkat dan aman diulang', async () => {
    await account()
    const a = await login()
    await openAppAccess(sql, a.token, 'hris')
    await logoutSession(sql, a.token)
    await logoutSession(sql, a.token)
    expect(await validateSession(sql, a.token, 'backoffice')).toMatchObject({ ok: false })
    expect(await validateSession(sql, a.token, 'hris')).toMatchObject({ ok: false })
    expect(await sql`select id from auth.audit_events where action = 'LOGOUT'`).toHaveLength(1)
  })

  it('reset oleh pelaku berhak mencabut semua sesi dan menuntut onboarding', async () => {
    const id = await account()
    const a = await login('hris')
    const actor = await owner()
    expect(await resetPassword(sql, { accountId: id, newPassword: 'password-reset', actor: { ...actor, role: 'KASIR' } })).toMatchObject({ ok: false })
    expect(await resetPassword(sql, { accountId: id, newPassword: 'password-reset', actor })).toMatchObject({ ok: true })
    expect(await validateSession(sql, a.token, 'hris')).toMatchObject({ ok: false })
    expect(await login('hris', { password: 'password-reset' })).toMatchObject({ ok: true, mustChangePassword: true })
    const [event] = await sql`select * from auth.audit_events where action = 'PASSWORD_RESET'`
    expect(event.actor_account_id).not.toBe(id)
    expect(event.metadata).toMatchObject({ beforeMustChangePassword: false, afterMustChangePassword: true })
  })

  it('reset dan login lama yang saling tumpang tindih tidak menyisakan sesi lolos reset', async () => {
    const id = await account()
    const actor = await owner()
    const [reset, attempted] = await Promise.all([
      resetPassword(sql, { accountId: id, newPassword: 'password-reset', actor }), login('hris'),
    ])
    expect(reset.ok).toBe(true)
    if (attempted.ok) expect(await validateSession(sql, attempted.token, 'hris')).toMatchObject({ ok: false })
    expect(await login('hris')).toMatchObject({ ok: false })
  })

  it('nonaktif langsung mencabut sesi dan pengaktifan ulang tidak membangkitkan sesi lama', async () => {
    const id = await account()
    const a = await login('hris')
    expect(await deactivateAccount(sql, { accountId: id, actor: await owner() })).toMatchObject({ ok: true })
    await sql`update auth.accounts set is_active = true where id = ${id}`
    expect(await validateSession(sql, a.token, 'hris')).toMatchObject({ ok: false })
  })

  it('unlink dan penautan ulang tidak membangkitkan akses lama; app lain tetap hidup', async () => {
    const id = await account()
    const a = await login()
    await openAppAccess(sql, a.token, 'hris')
    expect(await revokeAccountLink(sql, { accountId: id, appCode: 'hris', actor: await owner() })).toMatchObject({ ok: true })
    await sql`update auth.account_links set revoked_at = null where account_id = ${id} and app_code = 'hris'`
    expect(await openAppAccess(sql, a.token, 'hris')).toMatchObject({ ok: false })
    expect(await validateSession(sql, a.token, 'backoffice')).toMatchObject({ ok: true })
  })

  it('perubahan snapshot tautan ditolak pada validasi dan bootstrap', async () => {
    const id = await account()
    const a = await login('hris')
    await sql`update auth.account_links set local_user_id = 999 where account_id = ${id} and app_code = 'hris'`
    expect(await validateSession(sql, a.token, 'hris')).toMatchObject({ ok: false })
    expect(await openAppAccess(sql, a.token, 'hris')).toMatchObject({ ok: false })
  })

  it('gagal audit membatalkan takeover, pergantian konteks dan sesi baru', async () => {
    await account()
    const a = await login()
    await sql`create function auth.reject_test_audit() returns trigger language plpgsql as $$ begin raise exception 'gagal-audit-uji'; end $$`
    await sql`create trigger reject_test_audit before insert on auth.audit_events for each row execute function auth.reject_test_audit()`
    try {
      await expect(login('backoffice', { previousToken: a.token })).rejects.toThrow('gagal-audit-uji')
      expect(await sql`select id from auth.sessions`).toHaveLength(1)
      expect(await validateSession(sql, a.token, 'backoffice')).toMatchObject({ ok: true })
    } finally {
      await sql`drop trigger reject_test_audit on auth.audit_events`
      await sql`drop function auth.reject_test_audit()`
    }
  })

  it('migrasi upgrade dari 0001 mempertahankan akun/tautan lama dan hash persis', async () => {
    await sql.begin(async (tx) => {
      await tx`create schema upgrade_probe`
      const old = readFileSync(new URL('0001_accounts.sql', migrationDirectory), 'utf8').replaceAll('"auth".', '"upgrade_probe".')
      await tx.unsafe(old).simple()
      await tx`insert into upgrade_probe.accounts (username, password_hash) values ('lama', ${passwordHash})`
      const newer = readFileSync(new URL('0002_sessions.sql', migrationDirectory), 'utf8').replaceAll('"auth".', '"upgrade_probe".')
      await tx.unsafe(newer).simple()
      expect((await tx`select password_hash, failed_login_count from upgrade_probe.accounts`)[0]).toMatchObject({ password_hash: passwordHash, failed_login_count: 0 })
      await tx`drop schema upgrade_probe cascade`
    })
  })
})

describe('cookie dan perlindungan mutasi auth', () => {
  const secret = 'rahasia-uji-untuk-csrf-minimal-32-karakter'
  const context = 'nonce-pra-login-http-only'
  function request(overrides = {}) {
    return { method: 'POST', origin: 'https://bo.staginghml.my.id',
      trustedOrigins: ['https://bo.staginghml.my.id', 'https://hris.staginghml.my.id'],
      csrfSecret: secret, context, csrfToken: issueCsrfToken(secret, context), ...overrides }
  }
  it('cookie memisahkan nama lingkungan, aman nonlokal dan memerlukan domain eksplisit', () => {
    const stg = sessionCookieOptions({ environment: 'staging', domain: '.staginghml.my.id' })
    expect(stg).toMatchObject({ name: 'hml_staging_session', httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
    expect(sessionCookieOptions({ environment: 'production', domain: '.example.test' }).name).not.toBe(stg.name)
    expect(sessionCookieOptions({ environment: 'local' }).secure).toBe(false)
    expect(() => sessionCookieOptions({ environment: 'production' })).toThrow('Domain')
  })
  it('origin penuh dan CSRF terikat konteks wajib termasuk sebelum login', () => {
    expect(() => assertTrustedMutation(request())).not.toThrow()
    for (const origin of [null, 'null', 'https://lain.staginghml.my.id', 'https://bo.staginghml.my.id.evil.test', 'https://bo.staginghml.my.id/']) {
      expect(() => assertTrustedMutation(request({ origin }))).toThrow()
    }
    for (const csrfToken of [null, '', 'palsu', issueCsrfToken(secret, 'konteks-lain')]) {
      expect(() => assertTrustedMutation(request({ csrfToken }))).toThrow()
    }
    expect(() => assertTrustedMutation(request({ method: 'GET' }))).toThrow()
    expect(() => assertTrustedMutation(request({ csrfSecret: 'pendek' }))).toThrow()
  })
})
