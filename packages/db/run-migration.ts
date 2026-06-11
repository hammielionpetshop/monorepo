import * as dotenv from 'dotenv'
import { resolve } from 'path'
import postgres from 'postgres'
import { readFileSync } from 'fs'

dotenv.config({ path: resolve(__dirname, '../../.env') })

const sql = postgres(process.env.DATABASE_URL!)

const files = [
  resolve(__dirname, 'src/migrations/20260609000001_po_internal_schema.sql'),
  resolve(__dirname, 'src/migrations/20260609000002_inter_branch_transfers.sql'),
]

async function run() {
  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    console.log(`Running: ${file.split(/[\\/]/).pop()}`)
    try {
      await sql.unsafe(content)
      console.log('  ✓ OK')
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        console.log('  ⊘ Already exists, skipping')
      } else {
        console.error('  ✗ Error:', e.message)
        process.exit(1)
      }
    }
  }
  await sql.end()
  console.log('Done.')
}

run()
