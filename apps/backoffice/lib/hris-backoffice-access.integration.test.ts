import { randomBytes, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import * as argon2 from 'argon2'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { hashSessionToken } from '@petshop/auth'
import { db, branches, roles, users, userBranchAssignments, eq, inArray } from './db'

// HRIS L2d §4: akses kasir dari HRIS lewat pintu internal backoffice.
vi.mock('@/lib/app-settings', () => ({ getDefaultCredentials: async () => ({ password: 'PasswordDefault1', pin: '000000' }) }))

const run = randomUUID().slice(0, 8)
const KEY = 'k'.repeat(40)
const accountIds: number[] = []
const userIds: number[] = []
const branchIds: number[] = []
const roleIds = new Map<string, number>()
let sql: postgres.Sql
let hash: string

const { setBackofficeAccess } = await import('./services/hris-backoffice-access')
const { authorizeInternalRequest } = await import('./internal-gate')
const { getAuthSql } = await import('./central-auth')

async function account(label: string, email: string | null = `${label}${run}@contoh.id`) {
  const [row] = await sql`insert into auth.accounts (username, email, password_hash, must_change_password)
    values (${`${label}${run}`}, ${email}, ${hash}, false) returning id`
  accountIds.push(row.id)
  return row.id as number
}

async function boUser(label: string, roleName: string, accountId?: number) {
  const [user] = await db.insert(users).values({
    name: label, username: `${label}${run}`, roleId: roleIds.get(roleName)!, branchId: branchIds[0], passwordHash: hash,
  }).returning()
  userIds.push(user.id)
  if (accountId) await sql`insert into auth.account_links (account_id, app_code, local_user_id) values (${accountId}, 'backoffice', ${user.id})`
  return user.id
}

/** Sesi pusat yang sudah membuka HRIS (tanpa backoffice), seperti Pemilik yang bekerja di HRIS. */
async function hrisSession(accountId: number, employeeId: number) {
  const token = randomBytes(32).toString('base64url')
  const [session] = await sql`insert into auth.sessions (account_id, token_hash, auth_method, expires_at)
    values (${accountId}, ${hashSessionToken(token)}, 'PASSWORD', now() + interval '1 day') returning id`
  const [link] = await sql`insert into auth.account_links (account_id, app_code, local_user_id)
    values (${accountId}, 'hris', ${employeeId}) returning id`
  await sql`insert into auth.session_app_access (session_id, app_code, account_link_id, local_user_id, last_active_at, expires_at)
    values (${session.id}, 'hris', ${link.id}, ${employeeId}, now(), now() + interval '1 day')`
  return token
}

beforeAll(async () => {
  hash = await argon2.hash('password-uji-1234')
  sql = getAuthSql()
  const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} })
  await migrate(drizzle(migrationClient), {
    migrationsFolder: fileURLToPath(new URL('../../../packages/auth/src/migrations/', import.meta.url)),
    migrationsSchema: 'drizzle',
    migrationsTable: '__migrations_auth',
  })
  await migrationClient.end()
  for (const code of ['A', 'B']) {
    const [branch] = await db.insert(branches).values({ code: `HB${code}${run}`, name: `Akses ${code} ${run}` }).returning()
    branchIds.push(branch.id)
  }
  for (const name of ['KASIR', 'OWNER', 'GUDANG']) {
    const [existing] = await db.select().from(roles).where(eq(roles.name, name)).limit(1)
    roleIds.set(name, existing ? existing.id : (await db.insert(roles).values({ name }).returning())[0].id)
  }
})

afterAll(async () => {
  const created = await sql`select local_user_id from auth.account_links where app_code = 'backoffice' and account_id in ${sql(accountIds)}`
  const allUsers = [...new Set([...userIds, ...created.map((r) => Number(r.local_user_id))])]
  await sql`delete from auth.audit_events where account_id in ${sql(accountIds)}`
  await sql`delete from auth.session_app_access where session_id in (select id from auth.sessions where account_id in ${sql(accountIds)})`
  await sql`delete from auth.sessions where account_id in ${sql(accountIds)}`
  await sql`delete from auth.account_links where account_id in ${sql(accountIds)}`
  await sql`delete from auth.accounts where id in ${sql(accountIds)}`
  if (allUsers.length) {
    await db.delete(userBranchAssignments).where(inArray(userBranchAssignments.userId, allUsers))
    await db.delete(users).where(inArray(users.id, allUsers))
  }
  await db.delete(branches).where(inArray(branches.id, branchIds))
  await sql.end()
})

describe('akses kasir dari HRIS', () => {
  it('membuat pengguna kasir untuk akun HRIS, menautkannya, dan aman diulang', async () => {
    const actor = await account('pelaku')
    const target = await account('rina')
    const input = {
      accountId: target, employeeName: 'Rina', employeeCode: `HML-${run}`, roleName: 'KASIR' as const,
      branchId: branchIds[0], assignedBranchIds: [branchIds[1]], active: true, actorUserId: await boUser('pelakubo', 'OWNER', actor),
      actorAccountId: actor,
    }
    const first = await setBackofficeAccess(input)
    expect(first).toMatchObject({ ok: true, created: true })
    const userId = (first as { userId: number }).userId
    const [user] = await db.select().from(users).where(eq(users.id, userId))
    expect(user).toMatchObject({
      staffNumber: `HML-${run}`, username: `rina${run}`, email: `rina${run}@contoh.id`, roleId: roleIds.get('KASIR'),
      branchId: branchIds[0], isActive: true, mustChangeCredentials: true, passwordHash: hash,
    })
    const assigned = await db.select().from(userBranchAssignments).where(eq(userBranchAssignments.userId, userId))
    expect(assigned.map((a) => a.branchId).sort()).toEqual([...branchIds].sort())

    expect(await setBackofficeAccess(input)).toEqual({ ok: true, userId, created: false })
    const [{ total }] = await sql`select count(*)::int as total from auth.account_links where account_id = ${target} and app_code = 'backoffice'`
    expect(total).toBe(1)
  })

  it('mengubah role mencabut akses backoffice yang terbuka; mencabut akses menonaktifkan pengguna, akun tetap aktif', async () => {
    const actor = await account('pelaku2')
    const actorUserId = await boUser('pelaku2bo', 'OWNER', actor)
    const target = await account('budi')
    const userId = await boUser('budibo', 'KASIR', target)
    const token = randomBytes(32).toString('base64url')
    const [session] = await sql`insert into auth.sessions (account_id, token_hash, auth_method, expires_at)
      values (${target}, ${hashSessionToken(token)}, 'PIN', now() + interval '1 day') returning id`
    const [link] = await sql`select id from auth.account_links where account_id = ${target} and app_code = 'backoffice'`
    await sql`insert into auth.session_app_access (session_id, app_code, account_link_id, local_user_id, last_active_at, expires_at)
      values (${session.id}, 'backoffice', ${link.id}, ${userId}, now(), now() + interval '1 day')`

    const base = { accountId: target, employeeName: 'Budi', employeeCode: `HMLB-${run}`, branchId: branchIds[0], assignedBranchIds: [], actorUserId, actorAccountId: actor }
    expect(await setBackofficeAccess({ ...base, roleName: 'GUDANG', active: true })).toEqual({ ok: true, userId, created: false })
    const [access] = await sql`select revoked_reason from auth.session_app_access where session_id = ${session.id}`
    expect(access.revoked_reason).toBe('ACCESS_CHANGED')
    expect((await db.select().from(users).where(eq(users.id, userId)))[0].roleId).toBe(roleIds.get('GUDANG'))

    expect(await setBackofficeAccess({ ...base, roleName: 'GUDANG', active: false })).toEqual({ ok: true, userId, created: false })
    expect((await db.select().from(users).where(eq(users.id, userId)))[0].isActive).toBe(false)
    const [acc] = await sql`select is_active from auth.accounts where id = ${target}`
    expect(acc.is_active).toBe(true)
  })

  it('menolak akun sendiri, cabang tak aktif, dan nomor staf milik akun lain; memakai ulang pengguna yatim', async () => {
    const actor = await account('pelaku3')
    const actorUserId = await boUser('pelaku3bo', 'OWNER', actor)
    const base = { employeeName: 'X', roleName: 'KASIR' as const, branchId: branchIds[0], assignedBranchIds: [], active: true, actorUserId, actorAccountId: actor }
    expect(await setBackofficeAccess({ ...base, accountId: actor, employeeCode: `S-${run}` })).toMatchObject({ ok: false, status: 400 })

    const target = await account('sari')
    expect(await setBackofficeAccess({ ...base, accountId: target, employeeCode: `S-${run}`, branchId: 999999 })).toMatchObject({ ok: false, status: 400 })

    // Pengguna dengan nomor staf ini sudah bertaut ke akun lain.
    const someone = await account('lain')
    const taken = await boUser('lainbo', 'KASIR', someone)
    await db.update(users).set({ staffNumber: `T-${run}` }).where(eq(users.id, taken))
    expect(await setBackofficeAccess({ ...base, accountId: target, employeeCode: `T-${run}` })).toMatchObject({ ok: false, status: 409 })

    // Pengguna yatim (terbuat, gagal ditautkan) dipakai ulang lewat nomor staf.
    const orphan = await boUser('yatim', 'KASIR')
    await db.update(users).set({ staffNumber: `Y-${run}` }).where(eq(users.id, orphan))
    expect(await setBackofficeAccess({ ...base, accountId: target, employeeCode: `Y-${run}` })).toEqual({ ok: true, userId: orphan, created: false })
  })

  it('tidak menurunkan Owner aktif terakhir', async () => {
    const actor = await account('pelaku4')
    const actorUserId = await boUser('pelaku4bo', 'KASIR', actor)
    const target = await account('ownerterakhir')
    const ownerUser = await boUser('ownerterakhirbo', 'OWNER', target)
    // Pastikan hanya pengguna ini Owner aktif selama tes.
    const others = await db.select({ id: users.id }).from(users).where(eq(users.roleId, roleIds.get('OWNER')!))
    const otherOwners = others.map((o) => o.id).filter((id) => id !== ownerUser)
    if (otherOwners.length) await db.update(users).set({ isActive: false }).where(inArray(users.id, otherOwners))
    try {
      const result = await setBackofficeAccess({
        accountId: target, employeeName: 'O', employeeCode: `O-${run}`, roleName: 'KASIR', branchId: branchIds[0],
        assignedBranchIds: [], active: true, actorUserId, actorAccountId: actor,
      })
      expect(result).toMatchObject({ ok: false, status: 409 })
    } finally {
      if (otherOwners.length) await db.update(users).set({ isActive: true }).where(inArray(users.id, otherOwners))
    }
  })
})

describe('pagar pintu internal: pelaku bersesi HRIS', () => {
  const request = (token: string) => new Request('http://bo-test:3000/api/internal/hris/backoffice-access', {
    headers: { host: 'bo-test:3000', 'x-internal-key': KEY, 'x-actor-session': token },
  })

  beforeAll(() => {
    process.env.HRIS_INTERNAL_KEY = KEY
    process.env.INTERNAL_ALLOWED_HOSTS = 'bo-test:3000'
  })

  it('Owner yang hanya membuka HRIS diterima lewat pengguna backoffice tertautnya', async () => {
    const owner = await account('ownerhris')
    const ownerUser = await boUser('ownerhrisbo', 'OWNER', owner)
    const result = await authorizeInternalRequest(request(await hrisSession(owner, 900001)))
    expect(result).toEqual({ accountId: owner, localUserId: ownerUser, role: 'OWNER' })
  })

  it('kasir bersesi HRIS, atau akun HRIS tanpa pengguna backoffice, ditolak 403', async () => {
    const kasir = await account('kasirhris')
    await boUser('kasirhrisbo', 'KASIR', kasir)
    expect(((await authorizeInternalRequest(request(await hrisSession(kasir, 900002)))) as Response).status).toBe(403)
    const lone = await account('tanpabo')
    expect(((await authorizeInternalRequest(request(await hrisSession(lone, 900003)))) as Response).status).toBe(403)
  })
})
