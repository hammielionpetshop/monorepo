import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { ACTIONS } from '../../../apps/hris/modules/access/rules/actions.ts'
import { REQUEST_STATUSES, canTransition } from '../../../apps/hris/modules/requests/rules/status.ts'
import { REQUEST_TYPES } from '../../../apps/hris/modules/requests/rules/types.ts'

// HRIS L2f-1 (migrasi hris 0005): pagar Mesin Pengajuan, berkas, dan pemberitahuan.
const requireAuth = createRequire(new URL('../../auth/package.json', import.meta.url))
const { drizzle } = requireAuth('drizzle-orm/postgres-js')
const { migrate } = requireAuth('drizzle-orm/postgres-js/migrator')
const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL
const databaseName = `hris_requests_test_${process.pid}_${Date.now()}`
const hrisMigrations = new URL('../../hris-db/src/migrations/', import.meta.url)
const authMigrations = new URL('../../auth/src/migrations/', import.meta.url)
let admin
let sql

const rejects = (statement) => expect(sql.begin((tx) => tx.unsafe(statement))).rejects.toThrow()

async function request(status = 'PENDING', dedupe = null) {
  const [row] = await sql`insert into hris.requests (type_key, subject_employee_id, submitted_by_account_id, submitted_by_employee_id, status, summary, dedupe_key, decision_reason)
    values ('identity_change', 1, 1, 1, ${status}, 'Ganti nama', ${dedupe}, ${status === 'REJECTED' || status === 'REVOKED' ? 'alasan cukup panjang' : null}) returning id, version`
  return row
}

describe.skipIf(!ADMIN_URL)('HRIS L2f-1: pagar pengajuan', () => {
  beforeAll(async () => {
    const adminUrl = new URL(ADMIN_URL)
    adminUrl.pathname = '/postgres'
    admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} })
    await admin.unsafe(`create database "${databaseName}"`)
    const url = new URL(ADMIN_URL)
    url.pathname = `/${databaseName}`
    sql = postgres(url.toString(), { max: 4, onnotice: () => {} })
    await sql`create schema petshop`
    await sql`create table petshop.branches (id serial primary key, code varchar(20) not null, name varchar(100) not null, is_active boolean not null default true)`
    const migrationClient = postgres(url.toString(), { max: 1, onnotice: () => {} })
    await migrate(drizzle(migrationClient), { migrationsFolder: fileURLToPath(authMigrations), migrationsSchema: 'drizzle', migrationsTable: '__migrations_auth' })
    await migrationClient.end()
    for (const file of ['0000_init', '0001_access', '0002_employees', '0003_settings', '0004_new_badge_days', '0005_requests']) {
      await sql.unsafe(readFileSync(new URL(`${file}.sql`, hrisMigrations), 'utf8')).simple()
    }
  })

  afterAll(async () => {
    await sql?.end()
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`)
    await admin?.end()
  })

  it('tiap jenis pengajuan menunjuk tindakan terdaftar', () => {
    for (const [key, type] of Object.entries(REQUEST_TYPES)) {
      for (const action of [type.requestAction, type.decideAction, type.reviewAction, ...type.extraViewers]) {
        if (action) expect(Object.hasOwn(ACTIONS, action), `${key}: ${action}`).toBe(true)
      }
    }
  })

  it('trigger status sama persis dengan aturan kode, untuk semua pasangan status', async () => {
    for (const from of REQUEST_STATUSES) {
      for (const to of REQUEST_STATUSES) {
        const row = await request(from)
        const update = sql.begin((tx) => tx`update hris.requests set status = ${to}, version = version + 1,
          decision_reason = 'alasan cukup panjang' where id = ${row.id}`)
        if (canTransition(from, to)) await expect(update, `${from}→${to}`).resolves.toBeDefined()
        else await expect(update, `${from}→${to}`).rejects.toThrow()
      }
    }
  })

  it('isi pengajuan tidak bisa diubah, versi wajib naik satu, tidak bisa dihapus', async () => {
    const { id } = await request()
    await rejects(`update hris.requests set summary = 'lain', status = 'CANCELLED', version = version + 1 where id = ${id}`)
    await rejects(`update hris.requests set subject_employee_id = 2, status = 'CANCELLED', version = version + 1 where id = ${id}`)
    await rejects(`update hris.requests set status = 'CANCELLED' where id = ${id}`)
    await rejects(`delete from hris.requests where id = ${id}`)
    await rejects('truncate hris.requests cascade')
  })

  it('tolak wajib alasan', async () => {
    const { id } = await request()
    await rejects(`update hris.requests set status = 'REJECTED', version = version + 1 where id = ${id}`)
  })

  it('satu pengajuan terbuka per kunci; setelah ditutup boleh lagi', async () => {
    const first = await request('PENDING', 'employee:1')
    await expect(request('PENDING', 'employee:1')).rejects.toThrow()
    await sql`update hris.requests set status = 'CANCELLED', version = version + 1 where id = ${first.id}`
    await expect(request('PENDING', 'employee:1')).resolves.toBeDefined()
  })

  it('riwayat, lampiran, dan berkas hanya bertambah', async () => {
    const { id } = await request()
    const fileId = randomUUID()
    await sql`insert into hris.files (id, mime, size_bytes, sha256, uploaded_by_account_id) values (${fileId}, 'image/png', 10, 'x', 1)`
    await sql`insert into hris.request_attachments (request_id, file_id, label) values (${id}, ${fileId}, 'Foto')`
    await sql`insert into hris.request_events (request_id, to_status, actor_account_id, actor_employee_id) values (${id}, 'PENDING', 1, 1)`
    await rejects(`delete from hris.files where id = '${fileId}'`)
    await rejects(`update hris.files set mime = 'image/jpeg' where id = '${fileId}'`)
    await rejects(`delete from hris.request_attachments where request_id = ${id}`)
    await rejects(`update hris.request_events set reason = 'x' where request_id = ${id}`)
    await rejects(`delete from hris.request_events where request_id = ${id}`)
    await expect(sql`insert into hris.files (id, mime, size_bytes, sha256, uploaded_by_account_id) values (${randomUUID()}, 'image/svg+xml', 10, 'x', 1)`).rejects.toThrow()
    await expect(sql`insert into hris.files (id, mime, size_bytes, sha256, uploaded_by_account_id) values (${randomUUID()}, 'image/png', 10485761, 'x', 1)`).rejects.toThrow()
  })

  it('isi Ubah data diri: applied_at sekali saja, isi terkunci', async () => {
    const [emp] = await sql`insert into hris.employees (code, name, joined_on) values (hris.next_employee_code(), 'Budi', '2026-01-01') returning id`
    const { id } = await request()
    await sql`insert into hris.identity_changes (request_id, employee_id, before, after) values (${id}, ${emp.id}, '{"name":"Budi"}', '{"name":"Budi S"}')`
    await rejects(`update hris.identity_changes set after = '{}' where request_id = ${id}`)
    await sql`update hris.identity_changes set applied_at = now() where request_id = ${id}`
    await rejects(`update hris.identity_changes set applied_at = now() where request_id = ${id}`)
    await rejects(`delete from hris.identity_changes where request_id = ${id}`)
  })

  it('pemberitahuan: hanya ditandai terbaca; dibuang hanya setelah 90 hari', async () => {
    const [fresh] = await sql`insert into hris.notifications (recipient_account_id, kind, title) values (1, 'x', 'Kabar') returning id`
    const [old] = await sql`insert into hris.notifications (recipient_account_id, kind, title, created_at) values (1, 'x', 'Lama', now() - interval '91 days') returning id`
    await rejects(`update hris.notifications set title = 'lain' where id = ${fresh.id}`)
    await rejects(`delete from hris.notifications where id = ${fresh.id}`)
    await sql`update hris.notifications set read_at = now() where id = ${fresh.id}`
    await rejects(`update hris.notifications set read_at = null where id = ${fresh.id}`)
    await sql`delete from hris.notifications where id = ${old.id}`
    await expect(sql`insert into hris.notifications (recipient_account_id, kind, title, link) values (1, 'x', 'Kabar', 'https://luar.test')`).rejects.toThrow()
  })
})
