import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import * as argon2 from 'argon2'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { inspectRollback, rollbackToLegacy } from '../../../packages/auth/src/rollback.mjs'
import { db, branches, roles, users, userSessions, eq, inArray } from './db'

// Cookie jar per "browser". `cookies()` milik Next dialihkan ke jar yang sedang aktif.
type Jar = Map<string, string>
let activeJar: Jar = new Map()
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (activeJar.has(name) ? { name, value: activeJar.get(name) } : undefined),
    set: (name: string, value: string) => void activeJar.set(name, value),
    delete: (arg: string | { name: string }) => void activeJar.delete(typeof arg === 'string' ? arg : arg.name),
  }),
}))
vi.mock('@/lib/app-settings', () => ({ getDefaultCredentials: async () => ({ password: 'PasswordDefault1', pin: '000000' }) }))

const ORIGIN = 'http://localhost:6974'
const PASSWORD = 'password-uji-1234'
const run = randomUUID().slice(0, 8)
const accountIds: number[] = []
const userIds: number[] = []
let branchId: number
let sql: postgres.Sql
let hash: string
const roleIds = new Map<string, number>()

const { POST: loginRoute } = await import('../app/api/auth/login/route')
const { GET: csrfRoute } = await import('../app/api/auth/csrf/route')
const { GET: bootstrapRoute } = await import('../app/api/auth/bootstrap/route')
const { POST: onboardingRoute } = await import('../app/api/auth/onboarding/route')
const { verifyAccessToken, signAccessToken } = await import('./auth')
const { terminateSession } = await import('./services/logout')
const { applyAccountChange } = await import('./services/central-admin')
const { getAuthSql } = await import('./central-auth')

function applyResponse(jar: Jar, response: Response) {
  const cookies = (response as unknown as { cookies: { getAll(): { name: string; value: string }[] } }).cookies
  for (const cookie of cookies.getAll()) {
    if (cookie.value === '') jar.delete(cookie.name)
    else jar.set(cookie.name, cookie.value)
  }
}

async function csrf(jar: Jar): Promise<string> {
  activeJar = jar
  const response = await csrfRoute()
  applyResponse(jar, response)
  return (await response.json()).token
}

async function post(
  jar: Jar,
  route: (req: Request) => Promise<Response>,
  path: string,
  body: unknown,
  options: { origin?: string; token?: string | null } = {},
) {
  const token = options.token === undefined ? await csrf(jar) : options.token
  activeJar = jar
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: options.origin ?? ORIGIN,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120',
  }
  if (token) headers['x-csrf-token'] = token
  const response = await route(new Request(`${ORIGIN}${path}`, { method: 'POST', headers, body: JSON.stringify(body) }))
  applyResponse(jar, response)
  return response
}

const loginPassword = (jar: Jar, username: string, password = PASSWORD, options = {}) =>
  post(jar, loginRoute, '/api/auth/login', { mode: 'bo', identifier: username, credential: password, credentialType: 'password' }, options)
const loginPin = (jar: Jar, username: string, pin = '1234') =>
  post(jar, loginRoute, '/api/auth/login', { mode: 'bo', identifier: username, credential: pin, credentialType: 'pin' })

async function validJwt(jar: Jar): Promise<boolean> {
  activeJar = jar
  const jwt = jar.get('accessToken')
  return jwt ? (await verifyAccessToken(jwt)) !== null : false
}

async function makeUser(label: string, roleName: 'KASIR' | 'OWNER', options: { mustChange?: boolean; link?: boolean } = {}) {
  const username = `${label}${run}`
  const [user] = await db
    .insert(users)
    .values({
      name: username,
      username,
      roleId: roleIds.get(roleName)!,
      branchId,
      passwordHash: hash,
      pinHash: await argon2.hash('1234'),
      mustChangeCredentials: options.mustChange ?? false,
    })
    .returning()
  userIds.push(user.id)
  const [account] = await sql`insert into auth.accounts (username, password_hash, must_change_password)
    values (${username}, ${hash}, ${options.mustChange ?? false}) returning id`
  accountIds.push(account.id)
  if (options.link !== false) {
    await sql`insert into auth.account_links (account_id, app_code, local_user_id) values (${account.id}, 'backoffice', ${user.id})`
  }
  return { userId: user.id, accountId: account.id as number, username }
}

beforeAll(async () => {
  hash = await argon2.hash(PASSWORD)
  sql = getAuthSql()
  const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })
  await migrate(drizzle(migrationClient), {
    migrationsFolder: fileURLToPath(new URL('../../../packages/auth/src/migrations/', import.meta.url)),
    migrationsSchema: 'drizzle',
    migrationsTable: '__migrations_auth',
  })
  await migrationClient.end()
  const [branch] = await db.insert(branches).values({ code: `CA${run}`, name: `Adapter ${run}` }).returning()
  branchId = branch.id
  for (const name of ['KASIR', 'OWNER']) {
    const [existing] = await db.select().from(roles).where(eq(roles.name, name)).limit(1)
    roleIds.set(name, existing ? existing.id : (await db.insert(roles).values({ name }).returning())[0].id)
  }
})

afterAll(async () => {
  if (accountIds.length) {
    await sql`delete from auth.audit_events where account_id in ${sql(accountIds)}`
    await sql`delete from auth.login_events where account_id in ${sql(accountIds)}`
    await sql`delete from auth.session_app_access where session_id in (select id from auth.sessions where account_id in ${sql(accountIds)})`
    await sql`delete from auth.sessions where account_id in ${sql(accountIds)}`
    await sql`delete from auth.account_links where account_id in ${sql(accountIds)}`
    await sql`delete from auth.accounts where id in ${sql(accountIds)}`
  }
  if (userIds.length) await db.delete(userSessions).where(inArray(userSessions.userId, userIds))
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds))
  await db.delete(branches).where(eq(branches.id, branchId))
  await sql.end()
})

describe('login mode central', () => {
  it('login password menerbitkan JWT bersesi pusat dan cookie sesi', async () => {
    const { username } = await makeUser('kasirlogin', 'KASIR')
    const jar: Jar = new Map()
    const response = await loginPassword(jar, username)
    expect(response.status).toBe(200)
    expect(jar.has('hml_local_session')).toBe(true)
    activeJar = jar
    const payload = await verifyAccessToken(jar.get('accessToken')!)
    expect(payload?.centralSessionId).toBeTypeOf('number')
    expect(payload?.sessionId).toBeUndefined()
  })

  it('menolak login tanpa token CSRF atau dari origin tak tepercaya, tanpa membuat sesi', async () => {
    const { username, accountId } = await makeUser('kasircsrf', 'KASIR')
    const noToken = await loginPassword(new Map(), username, PASSWORD, { token: null })
    const badOrigin = await loginPassword(new Map(), username, PASSWORD, { origin: 'https://jahat.example' })
    expect(noToken.status).toBe(403)
    expect(badOrigin.status).toBe(403)
    const [{ total }] = await sql`select count(*)::int as total from auth.sessions where account_id = ${accountId}`
    expect(total).toBe(0)
  })

  it('password salah gagal seragam; PIN benar masuk; akun tanpa tautan ditolak jelas', async () => {
    const { username } = await makeUser('kasirpin', 'KASIR')
    const wrong = await loginPassword(new Map(), username, 'salah-total-1')
    expect(wrong.status).toBe(401)
    const jar: Jar = new Map()
    expect((await loginPin(jar, username)).status).toBe(200)
    expect(await validJwt(jar)).toBe(true)
    const unlinked = await makeUser('kasirtanpa', 'KASIR', { link: false })
    const denied = await loginPin(new Map(), unlinked.username)
    expect(denied.status).toBe(403)
  })

  it('token legacy (tanpa sesi pusat) ditolak', async () => {
    activeJar = new Map()
    const legacy = await signAccessToken({
      userId: 1, sessionId: 1, userName: 'x', staffNumber: null, branchId, branchName: 'x', role: 'KASIR', permissions: [],
    })
    expect(await verifyAccessToken(legacy)).toBeNull()
  })
})

describe('satu akses backoffice dan pergantian akun', () => {
  it('PC kedua mengambil alih non-OWNER; OWNER di dua PC tetap hidup', async () => {
    const kasir = await makeUser('kasirdua', 'KASIR')
    const pc1: Jar = new Map()
    const pc2: Jar = new Map()
    await loginPassword(pc1, kasir.username)
    await loginPassword(pc2, kasir.username)
    expect(await validJwt(pc1)).toBe(false)
    expect(await validJwt(pc2)).toBe(true)

    const owner = await makeUser('ownerdua', 'OWNER')
    const o1: Jar = new Map()
    const o2: Jar = new Map()
    await loginPassword(o1, owner.username)
    await loginPassword(o2, owner.username)
    expect(await validJwt(o1)).toBe(true)
    expect(await validJwt(o2)).toBe(true)
  })

  it('PC bersama: login kasir kedua mencabut sesi kasir pertama di browser yang sama', async () => {
    const a = await makeUser('kasira', 'KASIR')
    const b = await makeUser('kasirb', 'KASIR')
    const shared: Jar = new Map()
    await loginPassword(shared, a.username)
    const before = new Map(shared)
    await loginPassword(shared, b.username)
    expect(await validJwt(shared)).toBe(true)
    expect(await validJwt(before)).toBe(false) // cookie milik kasir A tak lagi sah
  })

  it('login serentak dari tiga PC menyisakan tepat satu akses backoffice', async () => {
    const kasir = await makeUser('kasirserentak', 'KASIR')
    const jars: Jar[] = [new Map(), new Map(), new Map()]
    await Promise.all(jars.map((jar) => loginPassword(jar, kasir.username)))
    const [{ total }] = await sql`select count(*)::int as total from auth.session_app_access x
      join auth.sessions s on s.id = x.session_id
      where s.account_id = ${kasir.accountId} and x.app_code = 'backoffice' and x.revoked_at is null`
    expect(total).toBe(1)
  })
})

describe('bootstrap dan logout', () => {
  it('JWT hilang tapi sesi pusat hidup: bootstrap menerbitkan JWT baru; akses TAKEN_OVER tidak bangkit', async () => {
    const kasir = await makeUser('kasirboot', 'KASIR')
    const pc1: Jar = new Map()
    const pc2: Jar = new Map()
    await loginPassword(pc1, kasir.username)
    pc1.delete('accessToken')
    activeJar = pc1
    const ok = await bootstrapRoute(new NextRequest(`${ORIGIN}/api/auth/bootstrap?next=/pos`))
    applyResponse(pc1, ok)
    expect(ok.headers.get('Location')).toBe('/pos')
    expect(await validJwt(pc1)).toBe(true)

    await loginPassword(pc2, kasir.username) // PC2 mengambil alih
    pc1.delete('accessToken')
    activeJar = pc1
    const taken = await bootstrapRoute(new NextRequest(`${ORIGIN}/api/auth/bootstrap?next=/pos`))
    applyResponse(pc1, taken)
    expect(taken.headers.get('Location')).toBe('/login?reason=taken_over')
    expect(pc1.has('accessToken')).toBe(false)
    expect(await validJwt(pc2)).toBe(true) // tidak diambil kembali
  })

  it('bootstrap menolak path eksternal di parameter next', async () => {
    const kasir = await makeUser('kasirnext', 'KASIR')
    const jar: Jar = new Map()
    await loginPassword(jar, kasir.username)
    jar.delete('accessToken')
    activeJar = jar
    const response = await bootstrapRoute(new NextRequest(`${ORIGIN}/api/auth/bootstrap?next=//jahat.example`))
    expect(response.headers.get('Location')).toBe('/dashboard')
  })

  it('logout mencabut sesi di server: salinan cookie lama ditolak', async () => {
    const kasir = await makeUser('kasirout', 'KASIR')
    const jar: Jar = new Map()
    await loginPassword(jar, kasir.username)
    const copy = new Map(jar)
    activeJar = jar
    await terminateSession(undefined, 'LOGOUT')
    expect(jar.has('hml_local_session')).toBe(false)
    expect(await validJwt(copy)).toBe(false)
  })
})

describe('onboarding mode central', () => {
  it('ganti password: butuh password saat ini, mencabut sesi lain, menyinkronkan tabel lama', async () => {
    const kasir = await makeUser('kasironb', 'KASIR', { mustChange: true })
    const other: Jar = new Map()
    const jar: Jar = new Map()
    await loginPassword(other, kasir.username)
    const response = await loginPassword(jar, kasir.username)
    expect(response.status).toBe(200)
    expect(await validJwt(jar)).toBe(false) // konteks onboarding belum punya akses app

    const route = '/api/auth/onboarding'
    const wrong = await post(jar, onboardingRoute, route, { currentPassword: 'bukan-itu-1', newPassword: 'PasswordBaru123', newPin: '4321' })
    expect(wrong.status).toBe(400)
    const short = await post(jar, onboardingRoute, route, { currentPassword: PASSWORD, newPassword: 'pendek7', newPin: '4321' })
    expect(short.status).toBe(400)
    const missingCurrent = await post(jar, onboardingRoute, route, { newPassword: 'PasswordBaru123', newPin: '4321' })
    expect(missingCurrent.status).toBe(400)

    const done = await post(jar, onboardingRoute, route, { currentPassword: PASSWORD, newPassword: 'PasswordBaru123', newPin: '4321' })
    expect(done.status).toBe(200)
    expect(await validJwt(jar)).toBe(true)
    expect(await validJwt(other)).toBe(false)

    const [account] = await sql`select password_hash, must_change_password from auth.accounts where id = ${kasir.accountId}`
    const [local] = await db.select().from(users).where(eq(users.id, kasir.userId))
    expect(account.must_change_password).toBe(false)
    expect(local.passwordHash).toBe(account.password_hash)
    expect(local.mustChangeCredentials).toBe(false)
    expect((await loginPassword(new Map(), kasir.username)).status).toBe(401) // password lama mati
    expect((await loginPassword(new Map(), kasir.username, 'PasswordBaru123')).status).toBe(200)
  })

  it('menolak password baru sama dengan default', async () => {
    const kasir = await makeUser('kasirdef', 'KASIR', { mustChange: true })
    const jar: Jar = new Map()
    await loginPassword(jar, kasir.username)
    const response = await post(jar, onboardingRoute, '/api/auth/onboarding', {
      currentPassword: PASSWORD, newPassword: 'PasswordDefault1', newPin: '4321',
    })
    expect(response.status).toBe(400)
  })
})

describe('perubahan akun lewat Pengguna', () => {
  it('nonaktif mencabut sesi, aktif kembali memulihkan login, reset memaksa onboarding', async () => {
    const owner = await makeUser('ownerkelola', 'OWNER')
    const target = await makeUser('kasirkelola', 'KASIR')
    const ownerJar: Jar = new Map()
    const targetJar: Jar = new Map()
    await loginPassword(ownerJar, owner.username)
    await loginPassword(targetJar, target.username)

    activeJar = ownerJar
    expect(await applyAccountChange({ targetUserId: target.userId, actorRole: 'OWNER', isActive: false })).toBeNull()
    expect(await validJwt(targetJar)).toBe(false)
    expect((await loginPassword(new Map(), target.username)).status).toBe(401)

    activeJar = ownerJar
    expect(await applyAccountChange({ targetUserId: target.userId, actorRole: 'OWNER', isActive: true })).toBeNull()
    const [audit] = await sql`select action from auth.audit_events where account_id = ${target.accountId} and action = 'ACCOUNT_ENABLED'`
    expect(audit).toBeTruthy()
    expect((await loginPassword(new Map(), target.username)).status).toBe(200)

    const jar2: Jar = new Map()
    await loginPassword(jar2, target.username)
    activeJar = ownerJar
    expect(await applyAccountChange({ targetUserId: target.userId, actorRole: 'OWNER', resetCredentials: true })).toBeNull()
    expect(await validJwt(jar2)).toBe(false)
    expect((await loginPassword(new Map(), target.username, 'PasswordDefault1')).status).toBe(200)
  })

  it('pelaku non-OWNER/GM atau tanpa sesi pusat ditolak', async () => {
    const target = await makeUser('kasirditolak', 'KASIR')
    activeJar = new Map()
    expect(await applyAccountChange({ targetUserId: target.userId, actorRole: 'OWNER', isActive: false })).toMatch(/Owner atau GM/)
    const kasir = await makeUser('kasirpelaku', 'KASIR')
    const jar: Jar = new Map()
    await loginPassword(jar, kasir.username)
    activeJar = jar
    expect(await applyAccountChange({ targetUserId: target.userId, actorRole: 'KASIR', isActive: false })).toMatch(/Owner atau GM/)
  })

  it('user tanpa akun pusat: perubahan dilewati tanpa galat', async () => {
    const orphan = await makeUser('kasiryatim', 'KASIR', { link: false })
    activeJar = new Map()
    expect(await applyAccountChange({ targetUserId: orphan.userId, actorRole: 'OWNER', isActive: false })).toBeNull()
  })
})

describe('rollback ke legacy', () => {
  it('mencabut sesi pusat dan legacy, menyalin hash password, dan idempoten', async () => {
    const kasir = await makeUser('kasirroll', 'KASIR')
    const jar: Jar = new Map()
    await loginPassword(jar, kasir.username)
    await db.insert(userSessions).values({ userId: kasir.userId, deviceLabel: 'sesi lama' })
    // Password diganti di sisi pusat saja → tabel lama tertinggal.
    const newHash = await argon2.hash('PasswordSelamaCentral1')
    await sql`update auth.accounts set password_hash = ${newHash} where id = ${kasir.accountId}`

    const before = await inspectRollback(sql)
    expect(before.activeCentralSessions).toBeGreaterThanOrEqual(1)
    expect(before.activeLegacySessions).toBeGreaterThanOrEqual(1)
    expect(before.passwordHashMismatches).toBeGreaterThanOrEqual(1)

    const result = await rollbackToLegacy(sql)
    expect(result.centralSessionsRevoked).toBeGreaterThanOrEqual(1)
    expect(result.legacySessionsRevoked).toBeGreaterThanOrEqual(1)
    expect(result.passwordHashesSynced).toBeGreaterThanOrEqual(1)

    expect(await validJwt(jar)).toBe(false)
    const [local] = await db.select().from(users).where(eq(users.id, kasir.userId))
    expect(await argon2.verify(local.passwordHash!, 'PasswordSelamaCentral1')).toBe(true)
    const [legacy] = await db.select().from(userSessions).where(eq(userSessions.userId, kasir.userId))
    expect(legacy.revokedReason).toBe('ROLLBACK')
    const [audit] = await sql`select action from auth.audit_events where account_id = ${kasir.accountId} and action = 'ROLLBACK_REVOKED'`
    expect(audit).toBeTruthy()

    const after = await inspectRollback(sql)
    expect(after).toMatchObject({ activeCentralSessions: 0, activeLegacySessions: 0, passwordHashMismatches: 0 })
    expect(await rollbackToLegacy(sql)).toEqual({ centralSessionsRevoked: 0, legacySessionsRevoked: 0, passwordHashesSynced: 0 })
  })
})

describe('jembatan token lama', () => {
  const soon = () => new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  const original = process.env.BO_AUTH_BRIDGE_UNTIL

  async function legacyToken(userId: number, sessionId: number, role: 'KASIR' | 'OWNER' = 'KASIR') {
    return signAccessToken({
      userId, sessionId, userName: 'x', staffNumber: null, branchId, branchName: 'x', role, permissions: [],
    })
  }
  async function legacySession(userId: number) {
    const [created] = await db.insert(userSessions).values({ userId, deviceLabel: 'sesi lama' }).returning({ id: userSessions.id })
    return created.id
  }
  const verify = async (token: string) => {
    activeJar = new Map()
    return (await verifyAccessToken(token)) !== null
  }

  afterAll(() => {
    if (original === undefined) delete process.env.BO_AUTH_BRIDGE_UNTIL
    else process.env.BO_AUTH_BRIDGE_UNTIL = original
  })

  it('tanpa tenggat jembatan, atau tenggat tak valid/lewat/terlalu jauh: token lama ditolak', async () => {
    const { userId } = await makeUser('bridgeoff', 'KASIR')
    const token = await legacyToken(userId, await legacySession(userId))
    for (const value of [undefined, '', 'bukan-tanggal', new Date(Date.now() - 1000).toISOString(),
      new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString()]) {
      if (value === undefined) delete process.env.BO_AUTH_BRIDGE_UNTIL
      else process.env.BO_AUTH_BRIDGE_UNTIL = value
      expect(await verify(token)).toBe(false)
    }
  })

  it('dalam tenggat: token lama dengan sesi lama hidup diterima; tanpa sessionId ditolak', async () => {
    process.env.BO_AUTH_BRIDGE_UNTIL = soon()
    const { userId } = await makeUser('bridgeon', 'KASIR')
    const sessionId = await legacySession(userId)
    expect(await verify(await legacyToken(userId, sessionId))).toBe(true)
    const noSession = await signAccessToken({
      userId, userName: 'x', staffNumber: null, branchId, branchName: 'x', role: 'KASIR', permissions: [],
    })
    expect(await verify(noSession)).toBe(false)
  })

  it('sesi lama dicabut, milik user lain, atau user nonaktif: ditolak', async () => {
    process.env.BO_AUTH_BRIDGE_UNTIL = soon()
    const a = await makeUser('bridgea', 'KASIR')
    const b = await makeUser('bridgeb', 'KASIR')
    const sessionA = await legacySession(a.userId)
    expect(await verify(await legacyToken(b.userId, sessionA))).toBe(false)

    await db.update(userSessions).set({ revokedAt: new Date(), revokedReason: 'LOGOUT' }).where(eq(userSessions.id, sessionA))
    expect(await verify(await legacyToken(a.userId, sessionA))).toBe(false)

    const sessionB = await legacySession(b.userId)
    await db.update(users).set({ isActive: false }).where(eq(users.id, b.userId))
    expect(await verify(await legacyToken(b.userId, sessionB))).toBe(false)
  })

  it('user tanpa tautan akun pusat atau akun pusat nonaktif: ditolak', async () => {
    process.env.BO_AUTH_BRIDGE_UNTIL = soon()
    const orphan = await makeUser('bridgeorf', 'KASIR', { link: false })
    expect(await verify(await legacyToken(orphan.userId, await legacySession(orphan.userId)))).toBe(false)
    const inactive = await makeUser('bridgeacc', 'KASIR')
    await sql`update auth.accounts set is_active = false where id = ${inactive.accountId}`
    expect(await verify(await legacyToken(inactive.userId, await legacySession(inactive.userId)))).toBe(false)
  })

  it('nonaktif dan reset lewat Pengguna mencabut sesi lama; logout mencabut sesi lama', async () => {
    process.env.BO_AUTH_BRIDGE_UNTIL = soon()
    const owner = await makeUser('bridgeown', 'OWNER')
    const ownerJar: Jar = new Map()
    await loginPassword(ownerJar, owner.username)

    const target = await makeUser('bridget', 'KASIR')
    const session = await legacySession(target.userId)
    const token = await legacyToken(target.userId, session)
    expect(await verify(token)).toBe(true)
    activeJar = ownerJar
    expect(await applyAccountChange({ targetUserId: target.userId, actorRole: 'OWNER', resetCredentials: true })).toBeNull()
    expect(await verify(token)).toBe(false)
    const [row] = await db.select().from(userSessions).where(eq(userSessions.id, session))
    expect(row.revokedReason).toBe('PASSWORD_RESET')

    const other = await makeUser('bridgelo', 'KASIR')
    const otherSession = await legacySession(other.userId)
    activeJar = new Map()
    await terminateSession(otherSession, 'LOGOUT')
    expect(await verify(await legacyToken(other.userId, otherSession))).toBe(false)
  })
})
