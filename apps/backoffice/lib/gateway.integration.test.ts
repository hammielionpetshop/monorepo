import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import * as argon2 from 'argon2'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db, branches, roles, users, eq, inArray } from './db'

// Tes API gateway F2-7a §2a pada DB worktree nyata. Cookie jar per "browser" seperti tes adapter pusat.
type Jar = Map<string, string>
let activeJar: Jar = new Map()
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (activeJar.has(name) ? { name, value: activeJar.get(name) } : undefined),
    set: (name: string, value: string) => void activeJar.set(name, value),
    delete: (arg: string | { name: string }) => void activeJar.delete(typeof arg === 'string' ? arg : arg.name),
  }),
}))

const GATEWAY = 'http://localhost:6980'
const PASSWORD = 'password-uji-1234'
const run = randomUUID().slice(0, 8)
const accountIds: number[] = []
const userIds: number[] = []
let branchId: number
let sql: postgres.Sql
let hash: string
const roleIds = new Map<string, number>()

const { GET: csrfRoute } = await import('../app/api/gateway/csrf/route')
const { POST: loginRoute } = await import('../app/api/gateway/login/route')
const { GET: appsRoute } = await import('../app/api/gateway/apps/route')
const { POST: openRoute } = await import('../app/api/gateway/open/route')
const { POST: logoutRoute } = await import('../app/api/gateway/logout/route')
const { getAuthSql } = await import('./central-auth')

function applyResponse(jar: Jar, response: Response) {
  const cookies = (response as unknown as { cookies: { getAll(): { name: string; value: string }[] } }).cookies
  for (const cookie of cookies.getAll()) {
    if (cookie.value === '') jar.delete(cookie.name)
    else jar.set(cookie.name, cookie.value)
  }
}

async function post(jar: Jar, route: (req: Request) => Promise<Response>, path: string, body: unknown, origin = GATEWAY) {
  activeJar = jar
  const csrf = await csrfRoute()
  applyResponse(jar, csrf)
  const { token } = await csrf.json()
  activeJar = jar
  const response = await route(new Request(`${GATEWAY}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, 'x-csrf-token': token, 'user-agent': 'Mozilla/5.0 Chrome/120' },
    body: JSON.stringify(body),
  }))
  applyResponse(jar, response)
  return response
}

const login = (jar: Jar, identifier: string, password = PASSWORD, origin = GATEWAY) =>
  post(jar, loginRoute, '/api/gateway/login', { identifier, password }, origin)

async function apps(jar: Jar) {
  activeJar = jar
  const response = await appsRoute()
  return { status: response.status, body: await response.json() }
}

async function makeAccount(label: string, options: { role?: 'OWNER' | 'KASIR'; hris?: boolean; mustChange?: boolean } = {}) {
  const username = `${label}${run}`
  const [account] = await sql`insert into auth.accounts (username, password_hash, must_change_password)
    values (${username}, ${hash}, ${options.mustChange ?? false}) returning id`
  accountIds.push(account.id)
  if (options.role) {
    const [user] = await db.insert(users).values({
      name: username, username, roleId: roleIds.get(options.role)!, branchId, passwordHash: hash,
    }).returning()
    userIds.push(user.id)
    await sql`insert into auth.account_links (account_id, app_code, local_user_id) values (${account.id}, 'backoffice', ${user.id})`
  }
  if (options.hris) {
    // Tautan HRIS cukup menunjuk nomor karyawan; tes ini tidak menyentuh schema hris.
    await sql`insert into auth.account_links (account_id, app_code, local_user_id)
      values (${account.id}, 'hris', ${900000 + accountIds.length + Math.floor(Math.random() * 90000)})`
  }
  return { accountId: account.id as number, username }
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
  const [branch] = await db.insert(branches).values({ code: `GW${run}`, name: `Gateway ${run}` }).returning()
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
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds))
  await db.delete(branches).where(eq(branches.id, branchId))
  await sql.end()
})

describe('API gateway (F2-7a)', () => {
  it('karyawan hanya HRIS bisa masuk di gateway, melihat HRIS saja, dan membukanya tanpa login ulang', async () => {
    const { username, accountId } = await makeAccount('driver', { hris: true })
    const jar: Jar = new Map()
    expect((await login(jar, username)).status).toBe(200)
    expect(jar.has('hml_local_session')).toBe(true)
    const list = await apps(jar)
    expect(list.status).toBe(200)
    expect(list.body.webs.map((web: { code: string }) => web.code)).toEqual(['hris'])
    // Login gateway tidak membuka web apa pun sampai dipilih.
    const [{ before }] = await sql`select count(*)::int as before from auth.session_app_access x
      join auth.sessions s on s.id = x.session_id where s.account_id = ${accountId}`
    expect(before).toBe(0)
    const opened = await post(jar, openRoute, '/api/gateway/open', { web: 'hris' })
    expect(opened.status).toBe(200)
    expect((await opened.json()).url).toBe('http://localhost:6976')
    const [{ after }] = await sql`select count(*)::int as after from auth.session_app_access x
      join auth.sessions s on s.id = x.session_id where s.account_id = ${accountId} and x.app_code = 'hris'`
    expect(after).toBe(1)
  })

  it('Owner melihat POS, HRIS, Finance; membuka Finance membuka akses Back Office di sesi itu', async () => {
    const { username, accountId } = await makeAccount('owner', { role: 'OWNER', hris: true })
    const jar: Jar = new Map()
    expect((await login(jar, username)).status).toBe(200)
    expect((await apps(jar)).body.webs.map((web: { code: string }) => web.code)).toEqual(['pos', 'hris', 'finance'])
    const opened = await post(jar, openRoute, '/api/gateway/open', { web: 'finance' })
    expect(opened.status).toBe(200)
    const [{ total }] = await sql`select count(*)::int as total from auth.session_app_access x
      join auth.sessions s on s.id = x.session_id where s.account_id = ${accountId} and x.app_code = 'backoffice'`
    expect(total).toBe(1)
  })

  it('kasir tidak melihat Finance dan ditolak bila memaksa membukanya', async () => {
    const { username } = await makeAccount('kasir', { role: 'KASIR' })
    const jar: Jar = new Map()
    await login(jar, username)
    expect((await apps(jar)).body.webs.map((web: { code: string }) => web.code)).toEqual(['pos'])
    expect((await post(jar, openRoute, '/api/gateway/open', { web: 'finance' })).status).toBe(403)
  })

  it('akun tanpa tautan web, password salah, dan origin asing ditolak tanpa membuat sesi', async () => {
    const none = await makeAccount('kosong')
    const noLink = await login(new Map(), none.username)
    expect(noLink.status).toBe(401)
    expect((await noLink.json()).error).toMatch(/belum punya akses web/)
    const other = await makeAccount('salah', { hris: true })
    expect((await login(new Map(), other.username, 'password-keliru-99')).status).toBe(401)
    expect((await login(new Map(), other.username, PASSWORD, 'https://jahat.example')).status).toBe(403)
    const [{ total }] = await sql`select count(*)::int as total from auth.sessions where account_id in ${sql([none.accountId, other.accountId])}`
    expect(total).toBe(0)
  })

  it('wajib ganti password awal: diarahkan ke POS, web belum bisa dibuka', async () => {
    const { username } = await makeAccount('baru', { role: 'KASIR', mustChange: true })
    const jar: Jar = new Map()
    const response = await login(jar, username)
    expect((await response.json()).mustChangePassword).toBe(true)
    const list = await apps(jar)
    expect(list.body.mustChangePassword).toBe(true)
    expect(list.body.changePasswordUrl).toBe('http://localhost:6974')
    expect((await post(jar, openRoute, '/api/gateway/open', { web: 'pos' })).status).toBe(403)
  })

  it('keluar mengakhiri sesi pusat', async () => {
    const { username } = await makeAccount('keluar', { hris: true })
    const jar: Jar = new Map()
    await login(jar, username)
    const token = jar.get('hml_local_session')!
    expect((await post(jar, logoutRoute, '/api/gateway/logout', {})).status).toBe(200)
    expect(jar.has('hml_local_session')).toBe(false)
    activeJar = new Map([['hml_local_session', token]])
    expect((await appsRoute()).status).toBe(401)
  })
})
