import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { ACTIONS } from '../../../apps/hris/modules/access/rules/actions.ts'
import { SETTINGS, SETTING_KEYS } from '../../../apps/hris/modules/settings/rules/registry.ts'
import { resolveSetting, valueProblem } from '../../../apps/hris/modules/settings/rules/resolve.ts'

// HRIS L2e: pengaturan bertanggal (migrasi hris 0003) — isi awal cocok dengan daftar kode (H18), nilai tidak
// bisa ditimpa/dihapus, pembatalan hanya untuk nilai yang belum berlaku, dan jejak perubahan terkunci (H13).
const requireAuth = createRequire(new URL('../../auth/package.json', import.meta.url))
const { drizzle } = requireAuth('drizzle-orm/postgres-js')
const { migrate } = requireAuth('drizzle-orm/postgres-js/migrator')
const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL
const databaseName = `hris_settings_test_${process.pid}_${Date.now()}`
const hrisMigrations = new URL('../../hris-db/src/migrations/', import.meta.url)
const authMigrations = new URL('../../auth/src/migrations/', import.meta.url)
let admin
let sql
let today
let tomorrow

const runHris = async (file) => sql.unsafe(readFileSync(new URL(file, hrisMigrations), 'utf8')).simple()

async function rejects(statement) {
  await expect(sql.begin((tx) => tx.unsafe(statement))).rejects.toThrow()
}

const rowsOf = async (key) => (await sql`
  select id, key, target_kind as "targetKind", target_id as "targetId", value, effective_from::text as "effectiveFrom", status
  from hris.setting_values where key = ${key}`).map((r) => ({ ...r, targetId: r.targetId == null ? null : Number(r.targetId) }))

describe.skipIf(!ADMIN_URL)('HRIS L2e: pengaturan bertanggal', () => {
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
    // Jejak lama dari L2b–L2d harus tetap utuh setelah 0003.
    await runHris('0000_init.sql')
    await runHris('0001_access.sql')
    await sql`insert into hris.audit_events (actor_account_id, entity, entity_id, action) values (1, 'position_grant', 3, 'grant')`
    await runHris('0002_employees.sql')
    await runHris('0003_settings.sql')
    const [row] = await sql`select (now() at time zone 'Asia/Jakarta')::date::text as today,
      ((now() at time zone 'Asia/Jakarta')::date + 1)::text as tomorrow`
    today = row.today
    tomorrow = row.tomorrow
  })

  afterAll(async () => {
    await sql?.end()
    await admin?.unsafe(`drop database if exists "${databaseName}" with (force)`)
    await admin?.end()
  })

  it('H18: isi awal = daftar kode, satu baris ALL per kunci, nilainya lolos pemeriksa', async () => {
    const rows = await sql`select key, value, target_kind, effective_from::text as from, status, created_by_account_id
      from hris.setting_values order by key`
    expect(rows.map((r) => r.key).sort()).toEqual([...SETTING_KEYS].sort())
    for (const r of rows) {
      expect(r.target_kind, r.key).toBe('ALL')
      expect(r.status, r.key).toBe('ACTIVE')
      expect(r.from, r.key).toBe('2026-01-01')
      expect(r.created_by_account_id, r.key).toBeNull()
      expect(valueProblem(SETTINGS[r.key], r.value), r.key).toBeNull()
    }
  })

  it('H18: tindakan lihat/ubah tiap pengaturan terdaftar; pengubah langsung hanya Pemilik/GM', () => {
    for (const key of SETTING_KEYS) {
      const d = SETTINGS[key]
      expect(ACTIONS[d.viewAction], key).toBeDefined()
      expect(ACTIONS[d.editAction]?.ownerOnly, key).toBe(true)
      expect(d.targets.includes('ALL'), key).toBe(true)
    }
  })

  it('nilai baru bertanggal dibaca menurut tanggal; isi awal tetap untuk tanggal lama', async () => {
    await sql`insert into hris.setting_values (key, value, effective_from, status, reason, created_by_account_id)
      values ('employees.training_review_months', '4', ${tomorrow}, 'ACTIVE', 'Uji ubah masa training', 1)`
    const rows = await rowsOf('employees.training_review_months')
    expect(resolveSetting(rows, today)?.value).toBe(3)
    expect(resolveSetting(rows, tomorrow)?.value).toBe(4)
  })

  it('satu nilai ACTIVE per sasaran per tanggal', async () => {
    await rejects(`insert into hris.setting_values (key, value, effective_from, status, reason, created_by_account_id)
      values ('employees.training_review_months', '5', '${tomorrow}', 'ACTIVE', 'Uji kembar', 1)`)
    // Sasaran lain di tanggal yang sama boleh.
    await sql`insert into hris.setting_values (key, target_kind, target_id, value, effective_from, status, reason, created_by_account_id)
      values ('position.backoffice_role_suggestion', 'POSITION', 11, '"KASIR"', ${today}, 'ACTIVE', 'Uji saran', 1),
             ('position.backoffice_role_suggestion', 'POSITION', 12, '"GUDANG"', ${today}, 'ACTIVE', 'Uji saran', 1)`
    await rejects(`insert into hris.setting_values (key, target_kind, value, effective_from, status, reason) values
      ('position.backoffice_role_suggestion', 'POSITION', '"KASIR"', '${today}', 'ACTIVE', 'tanpa id sasaran')`)
  })

  it('nilai, tanggal, dan alasan tidak bisa ditimpa; baris tidak bisa dihapus', async () => {
    await rejects(`update hris.setting_values set value = '99' where key = 'shared.reason_min_length'`)
    await rejects(`update hris.setting_values set effective_from = '2025-01-01' where key = 'shared.reason_min_length'`)
    await rejects(`update hris.setting_values set reason = 'diganti' where key = 'shared.reason_min_length'`)
    await rejects(`delete from hris.setting_values where key = 'shared.reason_min_length'`)
    await rejects(`truncate hris.setting_values`)
  })

  it('pembatalan hanya untuk nilai yang belum berlaku, dan tidak bisa dikembalikan', async () => {
    await rejects(`update hris.setting_values set status = 'CANCELLED', cancelled_at = now(), cancelled_by_account_id = 1,
      cancel_reason = 'uji batal nilai lama' where key = 'shared.reason_min_length'`)
    const [future] = await sql`select id from hris.setting_values where key = 'employees.training_review_months' and effective_from = ${tomorrow}`
    // Pembatalan wajib lengkap (siapa, kapan, alasan).
    await rejects(`update hris.setting_values set status = 'CANCELLED' where id = ${future.id}`)
    await sql`update hris.setting_values set status = 'CANCELLED', cancelled_at = now(), cancelled_by_account_id = 1,
      cancel_reason = 'uji batal nilai depan' where id = ${future.id}`
    await rejects(`update hris.setting_values set status = 'ACTIVE', cancelled_at = null, cancelled_by_account_id = null,
      cancel_reason = null where id = ${future.id}`)
    expect(resolveSetting(await rowsOf('employees.training_review_months'), tomorrow)?.value).toBe(3)
  })

  it('H13: jejak perubahan tetap terkunci; pelaku mesin tanpa akun, pelaku orang wajib akun', async () => {
    const [{ n }] = await sql`select count(*)::int as n from hris.audit_events where entity = 'position_grant'`
    expect(n).toBe(1)
    await sql`insert into hris.audit_events (actor_account_id, source, job_name, entity, entity_id, action)
      values (null, 'JOB', 'employee-status-apply', 'employee', 1, 'status_apply')`
    await rejects(`insert into hris.audit_events (actor_account_id, entity, action) values (null, 'setting', 'setting.set')`)
    await rejects(`insert into hris.audit_events (actor_account_id, source, entity, action) values (null, 'JOB', 'setting', 'x')`)
    await rejects(`update hris.audit_events set reason = 'ubah' where entity = 'position_grant'`)
    await rejects(`delete from hris.audit_events`)
  })
})
