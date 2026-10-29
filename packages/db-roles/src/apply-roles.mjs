/**
 * Terapkan roles.sql ke database DATABASE_URL (pemilik migrasi), lalu setel password role.
 *
 *   DATABASE_URL=... node src/apply-roles.mjs
 *
 * Password tidak pernah ada di repo: dibaca dari env `<ROLE>_DB_PASSWORD`
 * (mis. BO_APP_DB_PASSWORD, STG_HRIS_APP_DB_PASSWORD). Env kosong = password role itu
 * tidak diubah — role tanpa password memang tidak bisa login.
 */
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import postgres from 'postgres'
import dotenv from 'dotenv'

const DIR = dirname(fileURLToPath(import.meta.url))
const BASE_ROLES = ['bo_app', 'order_app', 'hris_app']

export async function applyRoles(url, env = process.env, log = console.log) {
  const sql = postgres(url, { max: 1, onnotice: () => {} })
  try {
    const [{ name }] = await sql`select current_database() as name`
    const prefix = name.endsWith('_staging') ? 'stg_' : ''
    await sql.file(join(DIR, 'roles.sql'))
    log(`roles.sql diterapkan ke ${name} (${prefix ? 'role stg_*' : 'role produksi'})`)
    for (const baseRole of BASE_ROLES) {
      const role = prefix + baseRole
      const envKey = `${role.toUpperCase()}_DB_PASSWORD`
      const password = env[envKey]
      if (!password) {
        log(`  - ${role}: ${envKey} kosong, password tidak diubah`)
        continue
      }
      const [{ statement }] =
        await sql`select format('ALTER ROLE %I PASSWORD %L', ${role}::text, ${password}::text) as statement`
      await sql.unsafe(statement)
      log(`  - ${role}: password disetel`)
    }
  } finally {
    await sql.end()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  dotenv.config({ path: join(DIR, '../../../.env'), quiet: true })
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL kosong.')
    process.exit(1)
  }
  applyRoles(process.env.DATABASE_URL).catch((error) => {
    console.error(`Gagal menerapkan role: ${error.message}`)
    process.exit(1)
  })
}
