// Butuh Postgres sungguhan dengan dua database yang sudah dimigrasi (job CI `db-migrations`).
// Dilewati bila ROLES_TEST_ADMIN_URL kosong, jadi `pnpm test` biasa tidak memerlukannya.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { applyRoles } from '../src/apply-roles.mjs'

const ADMIN_URL = process.env.ROLES_TEST_ADMIN_URL
const PROD_DB = process.env.ROLES_TEST_DB ?? 'petshop_db'
const STAGING_DB = process.env.ROLES_TEST_STAGING_DB ?? 'petshop_staging'
const TEST_PASSWORD = 'roles-test-password'

const allPasswords = Object.fromEntries(
  ['bo_app', 'order_app', 'hris_app', 'stg_bo_app', 'stg_order_app', 'stg_hris_app'].map((role) => [
    `${role.toUpperCase()}_DB_PASSWORD`,
    TEST_PASSWORD,
  ]),
)

function dbUrl(db, role) {
  const url = new URL(ADMIN_URL)
  url.pathname = `/${db}`
  if (role) {
    url.username = role
    url.password = TEST_PASSWORD
  }
  return url.toString()
}

const openClients = []
function connectAs(role, db = PROD_DB) {
  const sql = postgres(dbUrl(db, role), { max: 1, onnotice: () => {} })
  openClients.push(sql)
  return sql
}

const silent = () => {}

describe.skipIf(!ADMIN_URL)('roles.sql', () => {
  beforeAll(async () => {
    await applyRoles(dbUrl(PROD_DB), allPasswords, silent)
    await applyRoles(dbUrl(STAGING_DB), allPasswords, silent)
  })
  afterAll(async () => {
    await Promise.all(openClients.map((client) => client.end()))
  })

  it('aman dijalankan ulang', async () => {
    await expect(applyRoles(dbUrl(PROD_DB), allPasswords, silent)).resolves.toBeUndefined()
  })

  it('hris_app tidak bisa membaca maupun menulis petshop', async () => {
    const sql = connectAs('hris_app')
    await expect(sql`select 1 from petshop.branches limit 1`).rejects.toThrow(/permission denied/)
    await expect(sql`insert into petshop.branches (name) values ('x')`).rejects.toThrow(/permission denied/)
  })

  it('hris_app bisa menulis tabel hris', async () => {
    const sql = connectAs('hris_app')
    const result = sql.begin(async (trx) => {
      await trx`insert into hris.job_runs (name) values ('role-test')`
      throw new Error('rollback')
    })
    await expect(result).rejects.toThrow('rollback')
  })

  it('bo_app membaca petshop tetapi tidak hris', async () => {
    const sql = connectAs('bo_app')
    await expect(sql`select count(*) from petshop.branches`).resolves.toBeDefined()
    await expect(sql`select 1 from hris.job_runs limit 1`).rejects.toThrow(/permission denied/)
  })

  it('order_app tidak bisa membaca hris', async () => {
    const sql = connectAs('order_app')
    await expect(sql`select count(*) from petshop.branches`).resolves.toBeDefined()
    await expect(sql`select 1 from hris.job_runs limit 1`).rejects.toThrow(/permission denied/)
  })

  it('tabel sesi dan audit auth bisa diakses BO/HRIS tetapi ditolak portal', async () => {
    for (const role of ['bo_app', 'hris_app']) {
      const sql = connectAs(role)
      await expect(sql`select 1 from auth.sessions limit 1`).resolves.toBeDefined()
      await expect(sql`select 1 from auth.session_app_access limit 1`).resolves.toBeDefined()
      await expect(sql`select 1 from auth.login_events limit 1`).resolves.toBeDefined()
      await expect(sql`select 1 from auth.audit_events limit 1`).resolves.toBeDefined()
    }
    const portal = connectAs('order_app')
    await expect(portal`select 1 from auth.sessions limit 1`).rejects.toThrow(/permission denied/)
    await expect(portal`select 1 from auth.session_app_access limit 1`).rejects.toThrow(/permission denied/)
    await expect(portal`select 1 from auth.login_events limit 1`).rejects.toThrow(/permission denied/)
    await expect(portal`select 1 from auth.audit_events limit 1`).rejects.toThrow(/permission denied/)
  })

  it('role staging tidak bisa membuka database produksi, dan sebaliknya', async () => {
    await expect(connectAs('stg_bo_app', PROD_DB)`select 1`).rejects.toThrow(/permission denied for database/)
    await expect(connectAs('bo_app', STAGING_DB)`select 1`).rejects.toThrow(/permission denied for database/)
    await expect(connectAs('stg_bo_app', STAGING_DB)`select count(*) from petshop.branches`).resolves.toBeDefined()
  })
})
