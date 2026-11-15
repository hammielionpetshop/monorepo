import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import {
  completeRecoveryWithCode, completeRecoveryWithTicket, createRecoveryCode, findRecoveryAccount, issueRecoveryTicket,
  purgeRecoveryRecords, recordRecoveryFailure, recoveryGate,
} from '../../auth/src/recovery.ts'
import { passwordLogin } from '../../auth/src/sessions.ts'

// HRIS L2f-2: jeda, tiket, dan kode lupa password (spec L2f-2 §4).
const requireAuth = createRequire(new URL('../../auth/package.json', import.meta.url))
const { drizzle } = requireAuth('drizzle-orm/postgres-js')
const { migrate } = requireAuth('drizzle-orm/postgres-js/migrator')
const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL
const databaseName = `auth_recovery_test_${process.pid}_${Date.now()}`
const authMigrations = new URL('../../auth/src/migrations/', import.meta.url)
const NEW_PASSWORD = 'passwordbaru123'
let admin
let sql
let nextEmployee = 100

async function account(email, { linked = true, active = true } = {}) {
  const [row] = await sql`insert into auth.accounts (email, password_hash, must_change_password, is_active)
    values (${email}, 'tidak-dipakai', true, ${active}) returning id`
  if (linked) await sql`insert into auth.account_links (account_id, app_code, local_user_id) values (${row.id}, 'hris', ${nextEmployee++})`
  return row.id
}

async function liveSession(accountId) {
  const [row] = await sql`insert into auth.sessions (account_id, token_hash, auth_method, expires_at)
    values (${accountId}, ${`${accountId}`.padEnd(64, 'b').slice(0, 64)}, 'PASSWORD', now() + interval '1 day') returning id`
  return row.id
}

describe.skipIf(!ADMIN_URL)('HRIS L2f-2: lupa password', () => {
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
  })

  afterAll(async () => {
    await sql?.end()
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`)
    await admin?.end()
  })

  it('3 salah = jeda 5 menit; jeda ke-3 dalam 24 jam menutup jalur selama 24 jam', async () => {
    const id = 'tebak@contoh.id'
    expect(await recoveryGate(sql, id)).toEqual({ state: 'OPEN' })
    for (let round = 1; round <= 3; round += 1) {
      expect((await recordRecoveryFailure(sql, id)).newlyBlocked).toBe(false)
      expect((await recordRecoveryFailure(sql, id)).gate.state).toBe('OPEN')
      const third = await recordRecoveryFailure(sql, id)
      expect(third.newlyBlocked).toBe(true)
      expect(third.gate.state).toBe(round === 3 ? 'CLOSED' : 'LOCKED')
      // Selama diblok, salah lagi tidak menambah hitungan dan tidak mengirim kabar lagi.
      expect((await recordRecoveryFailure(sql, id)).newlyBlocked).toBe(false)
      if (round < 3) await sql`update auth.recovery_throttles set locked_until = now() - interval '1 second' where identifier = ${id}`
    }
    const gate = await recoveryGate(sql, ' TEBAK@contoh.id ')
    expect(gate.state).toBe('CLOSED')
    expect(gate.until.getTime() - Date.now()).toBeGreaterThan(23 * 3600 * 1000)
  })

  it('jeda lama di luar 24 jam tidak ikut dihitung', async () => {
    const id = 'lama@contoh.id'
    await sql`insert into auth.recovery_throttles (identifier, lock_count, first_lock_at) values (${id}, 2, now() - interval '25 hours')`
    await recordRecoveryFailure(sql, id)
    await recordRecoveryFailure(sql, id)
    expect((await recordRecoveryFailure(sql, id)).gate.state).toBe('LOCKED')
  })

  it('tiket: sekali pakai, password berganti, semua sesi keluar, masuk lagi tanpa wajib ganti', async () => {
    const accountId = await account('tiket@contoh.id')
    const old = await liveSession(accountId)
    await recordRecoveryFailure(sql, 'tiket@contoh.id')
    const { ticket } = await issueRecoveryTicket(sql, { accountId, identifier: 'tiket@contoh.id' })
    const [stored] = await sql`select token_hash from auth.recovery_tickets where account_id = ${accountId}`
    expect(stored.token_hash).not.toBe(ticket)
    expect((await completeRecoveryWithTicket(sql, { ticket, newPassword: 'pendek' })).code).toBe('RECOVERY_PASSWORD_INVALID')

    const done = await completeRecoveryWithTicket(sql, { ticket, newPassword: NEW_PASSWORD, deviceLabel: 'tes' })
    expect(done).toMatchObject({ ok: true, accountId })
    const [oldSession] = await sql`select revoked_reason from auth.sessions where id = ${old}`
    expect(oldSession.revoked_reason).toBe('PASSWORD_RECOVERED')
    const [row] = await sql`select must_change_password from auth.accounts where id = ${accountId}`
    expect(row.must_change_password).toBe(false)
    const live = await sql`select id from auth.sessions where account_id = ${accountId} and revoked_at is null`
    expect(live).toHaveLength(1)
    const [event] = await sql`select metadata from auth.audit_events where account_id = ${accountId} and action = 'PASSWORD_RECOVERED'`
    expect(event.metadata).toMatchObject({ method: 'SELF' })
    expect(await sql`select 1 from auth.recovery_throttles where identifier = 'tiket@contoh.id'`).toHaveLength(0)
    expect(await passwordLogin(sql, { identifier: 'tiket@contoh.id', password: NEW_PASSWORD, appCode: 'hris' })).toMatchObject({ ok: true, mustChangePassword: false })

    expect((await completeRecoveryWithTicket(sql, { ticket, newPassword: NEW_PASSWORD })).code).toBe('RECOVERY_TICKET_INVALID')
  })

  it('tiket kedaluwarsa dan tiket lama sesudah tiket baru ditolak', async () => {
    const accountId = await account('kedaluwarsa@contoh.id')
    const first = await issueRecoveryTicket(sql, { accountId, identifier: 'kedaluwarsa@contoh.id' })
    const second = await issueRecoveryTicket(sql, { accountId, identifier: 'kedaluwarsa@contoh.id' })
    expect((await completeRecoveryWithTicket(sql, { ticket: first.ticket, newPassword: NEW_PASSWORD })).code).toBe('RECOVERY_TICKET_INVALID')
    await sql`update auth.recovery_tickets set expires_at = now() - interval '1 second' where account_id = ${accountId}`
    expect((await completeRecoveryWithTicket(sql, { ticket: second.ticket, newPassword: NEW_PASSWORD })).code).toBe('RECOVERY_TICKET_INVALID')
  })

  it('akun yang dinonaktifkan sesudah tiket terbit tidak bisa mengganti password', async () => {
    const accountId = await account('nonaktif@contoh.id')
    const { ticket } = await issueRecoveryTicket(sql, { accountId, identifier: 'nonaktif@contoh.id' })
    await sql`update auth.accounts set is_active = false where id = ${accountId}`
    expect((await completeRecoveryWithTicket(sql, { ticket, newPassword: NEW_PASSWORD })).code).toBe('RECOVERY_ACCOUNT_DISABLED')
    const [row] = await sql`select password_hash from auth.accounts where id = ${accountId}`
    expect(row.password_hash).toBe('tidak-dipakai')
  })

  it('kode: tersimpan sebagai hash, salah lalu benar, sekali pakai; atas diri sendiri ditolak', async () => {
    const actor = await account('gm@contoh.id')
    const accountId = await account('kode@contoh.id')
    expect((await createRecoveryCode(sql, { accountId: actor, actorAccountId: actor })).code).toBe('SELF_FORBIDDEN')
    const made = await createRecoveryCode(sql, { accountId, actorAccountId: actor })
    expect(made.code).toMatch(/^\d{6}$/)
    const [stored] = await sql`select code_hash from auth.recovery_codes where account_id = ${accountId}`
    expect(stored.code_hash).not.toContain(made.code)
    const [trail] = await sql`select metadata, description from auth.audit_events where account_id = ${accountId} and action = 'RECOVERY_CODE_CREATED'`
    expect(JSON.stringify(trail)).not.toContain(made.code)

    const wrong = made.code === '000000' ? '000001' : '000000'
    const input = { identifier: 'kode@contoh.id', newPassword: NEW_PASSWORD }
    expect((await completeRecoveryWithCode(sql, { ...input, code: wrong })).code).toBe('RECOVERY_CODE_INVALID')
    expect(await completeRecoveryWithCode(sql, { ...input, code: made.code })).toMatchObject({ ok: true, accountId })
    expect((await completeRecoveryWithCode(sql, { ...input, code: made.code })).code).toBe('RECOVERY_CODE_INVALID')
    const [event] = await sql`select metadata from auth.audit_events where account_id = ${accountId} and action = 'PASSWORD_RECOVERED'`
    expect(event.metadata).toMatchObject({ method: 'CODE' })
  })

  it('kode: kedaluwarsa, kode lama batal oleh kode baru, 5 salah = hangus', async () => {
    const actor = await account('gm2@contoh.id')
    const accountId = await account('hangus@contoh.id')
    const input = { identifier: 'hangus@contoh.id', newPassword: NEW_PASSWORD }

    const expired = await createRecoveryCode(sql, { accountId, actorAccountId: actor })
    await sql`update auth.recovery_codes set expires_at = now() - interval '1 second' where account_id = ${accountId} and voided_at is null`
    expect((await completeRecoveryWithCode(sql, { ...input, code: expired.code })).code).toBe('RECOVERY_CODE_EXPIRED')

    const oldCode = await createRecoveryCode(sql, { accountId, actorAccountId: actor })
    const newCode = await createRecoveryCode(sql, { accountId, actorAccountId: actor })
    if (oldCode.code !== newCode.code) {
      expect((await completeRecoveryWithCode(sql, { ...input, code: oldCode.code })).code).toBe('RECOVERY_CODE_INVALID')
    }
    await sql`update auth.recovery_codes set failed_count = 0 where account_id = ${accountId} and voided_at is null`

    const wrong = newCode.code === '000000' ? '000001' : '000000'
    for (let i = 0; i < 4; i += 1) {
      expect((await completeRecoveryWithCode(sql, { ...input, code: wrong })).code).toBe('RECOVERY_CODE_INVALID')
    }
    expect((await completeRecoveryWithCode(sql, { ...input, code: wrong })).code).toBe('RECOVERY_CODE_BURNED')
    expect((await completeRecoveryWithCode(sql, { ...input, code: newCode.code })).code).toBe('RECOVERY_CODE_INVALID')
  })

  it('cari akun: tanpa tautan HRIS terbaca, identifier tak dikenal = null', async () => {
    const accountId = await account('tanpatautan@contoh.id', { linked: false })
    expect(await findRecoveryAccount(sql, ' TanpaTautan@contoh.id ')).toEqual({ accountId, isActive: true, hrisEmployeeId: null })
    expect(await findRecoveryAccount(sql, 'tidakada@contoh.id')).toBeNull()
  })

  it('pembersihan hanya membuang yang 30 hari diam', async () => {
    await sql`insert into auth.recovery_throttles (identifier, updated_at) values ('tua@contoh.id', now() - interval '31 days'), ('muda@contoh.id', now())`
    const { throttles } = await purgeRecoveryRecords(sql)
    expect(throttles).toBe(1)
    expect(await sql`select 1 from auth.recovery_throttles where identifier = 'muda@contoh.id'`).toHaveLength(1)
  })
})
