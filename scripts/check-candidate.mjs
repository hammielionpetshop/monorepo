#!/usr/bin/env node
/**
 * Pemeriksaan kandidat akhir dalam satu perintah dengan keluaran ringkas.
 *
 *   node scripts/check-candidate.mjs [--skip typecheck,migrations,changelog]
 *
 * Menjalankan `pnpm migrations:check`, `pnpm changelog:check`, dan `pnpm typecheck`.
 * Tes aplikasi tidak dijalankan di sini. Keluar dengan kode 1 bila ada yang gagal.
 */
import { spawnSync } from 'node:child_process'

const skipArgument = process.argv.indexOf('--skip')
const skipped = skipArgument === -1 ? [] : (process.argv[skipArgument + 1] ?? '').split(',')

const checks = [
  { name: 'migrations', command: 'pnpm migrations:check' },
  { name: 'changelog', command: 'pnpm changelog:check' },
  { name: 'typecheck', command: 'pnpm typecheck' },
]

let failed = 0
for (const check of checks) {
  if (skipped.includes(check.name)) {
    console.log(`SKIP  ${check.name}`)
    continue
  }
  const started = Date.now()
  const result = spawnSync(check.command, { shell: true, encoding: 'utf8' })
  const seconds = ((Date.now() - started) / 1000).toFixed(0)
  if (result.status === 0) {
    console.log(`LULUS ${check.name} (${seconds}s)`)
    continue
  }
  failed += 1
  console.log(`GAGAL ${check.name} (${seconds}s)`)
  const tail = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split(/\r?\n/).slice(-25)
  console.log(tail.join('\n'))
}
process.exit(failed > 0 ? 1 : 0)
