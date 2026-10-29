// Butuh Postgres sungguhan dengan dua database yang sudah dimigrasi (job CI `db-migrations`).
// Dilewati bila ROLES_TEST_ADMIN_URL kosong, jadi `pnpm test` biasa tidak memerlukannya.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import postgres from 'postgres'
import { applyRoles } from '../src/apply-roles.mjs'

const ADMIN = process.env.ROLES_TEST_ADMIN_URL
const DB_PROD = process.env.ROLES_TEST_DB ?? 'petshop_db'
const DB_STG = process.env.ROLES_TEST_STAGING_DB ?? 'petshop_staging'
const SANDI = 'sandi-uji-roles'

const sandiSemua = Object.fromEntries(
  ['bo_app', 'order_app', 'hris_app', 'stg_bo_app', 'stg_order_app', 'stg_hris_app'].map((r) => [
    `${r.toUpperCase()}_DB_PASSWORD`,
    SANDI,
  ]),
)

function urlDb(db, peran) {
  const u = new URL(ADMIN)
  u.pathname = `/${db}`
  if (peran) {
    u.username = peran
    u.password = SANDI
  }
  return u.toString()
}

const koneksi = []
function sebagai(peran, db = DB_PROD) {
  const sql = postgres(urlDb(db, peran), { max: 1, onnotice: () => {} })
  koneksi.push(sql)
  return sql
}

describe.skipIf(!ADMIN)('roles.sql', () => {
  beforeAll(async () => {
    const diam = () => {}
    await applyRoles(urlDb(DB_PROD), sandiSemua, diam)
    await applyRoles(urlDb(DB_STG), sandiSemua, diam)
  })
  afterAll(async () => {
    await Promise.all(koneksi.map((k) => k.end()))
  })

  it('aman dijalankan ulang', async () => {
    await expect(applyRoles(urlDb(DB_PROD), sandiSemua, () => {})).resolves.toBeUndefined()
  })

  it('hris_app tidak bisa membaca maupun menulis petshop', async () => {
    const sql = sebagai('hris_app')
    await expect(sql`select 1 from petshop.branches limit 1`).rejects.toThrow(/permission denied/)
    await expect(sql`insert into petshop.branches (name) values ('x')`).rejects.toThrow(/permission denied/)
  })

  it('hris_app bisa menulis tabel hris', async () => {
    const sql = sebagai('hris_app')
    const hasil = sql.begin(async (trx) => {
      await trx`insert into hris.job_runs (name) values ('uji-role')`
      throw new Error('batalkan')
    })
    await expect(hasil).rejects.toThrow('batalkan')
  })

  it('bo_app membaca petshop tetapi tidak hris', async () => {
    const sql = sebagai('bo_app')
    await expect(sql`select count(*) from petshop.branches`).resolves.toBeDefined()
    await expect(sql`select 1 from hris.job_runs limit 1`).rejects.toThrow(/permission denied/)
  })

  it('order_app tidak bisa membaca hris', async () => {
    const sql = sebagai('order_app')
    await expect(sql`select count(*) from petshop.branches`).resolves.toBeDefined()
    await expect(sql`select 1 from hris.job_runs limit 1`).rejects.toThrow(/permission denied/)
  })

  it('role staging tidak bisa membuka database produksi, dan sebaliknya', async () => {
    await expect(sebagai('stg_bo_app', DB_PROD)`select 1`).rejects.toThrow(/permission denied for database/)
    await expect(sebagai('bo_app', DB_STG)`select 1`).rejects.toThrow(/permission denied for database/)
    await expect(sebagai('stg_bo_app', DB_STG)`select count(*) from petshop.branches`).resolves.toBeDefined()
  })
})
