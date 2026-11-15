#!/usr/bin/env node
/**
 * Ringkasan awal sesi: posisi branch utama terhadap origin, worktree yang berubah,
 * serta pemegang kunci migrasi dan klaim aktif dari `origin/staging`.
 *
 *   node scripts/session-status.mjs [--no-fetch]
 *
 * Hanya membaca; satu-satunya efek samping adalah `git fetch`.
 */
import { spawnSync } from 'node:child_process'

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  return { ok: result.status === 0, out: (result.stdout ?? '').trim() }
}

if (!process.argv.includes('--no-fetch')) {
  const fetched = git(['fetch', '--quiet', 'origin'])
  if (!fetched.ok) console.log('PERINGATAN: fetch gagal, remote-tracking branch bisa usang.')
}

console.log('== Branch utama (lokal vs origin)')
for (const branch of ['main', 'staging', 'dev_hris']) {
  const local = git(['rev-parse', '--verify', '--quiet', branch])
  if (!local.ok) {
    console.log(`${branch}: tidak ada lokal`)
    continue
  }
  const counts = git(['rev-list', '--left-right', '--count', `${branch}...origin/${branch}`])
  const [ahead, behind] = counts.ok ? counts.out.split(/\s+/) : ['?', '?']
  console.log(`${branch}: ahead ${ahead}, behind ${behind} (${local.out.slice(0, 8)})`)
}

console.log('\n== Worktree')
const blocks = git(['worktree', 'list', '--porcelain']).out.split(/\r?\n\r?\n/)
let dirtyCount = 0
for (const block of blocks) {
  const path = block.match(/^worktree (.+)$/m)?.[1]
  const branch = block.match(/^branch refs\/heads\/(.+)$/m)?.[1] ?? '(detached)'
  if (!path) continue
  const changed = git(['status', '--porcelain'], path).out.split(/\r?\n/).filter(Boolean).length
  if (changed > 0) {
    dirtyCount += 1
    console.log(`BERUBAH ${changed} berkas: ${path} [${branch}]`)
  }
}
console.log(`${blocks.length} worktree, ${dirtyCount} dengan perubahan belum di-commit`)

console.log('\n== Kunci migrasi dan klaim aktif (origin/staging)')
const claims = git(['show', 'origin/staging:docs/agents/claims.md'])
if (!claims.ok) {
  console.log('claims.md tidak terbaca dari origin/staging')
} else {
  const lines = claims.out.split(/\r?\n/)
  const locks = lines.filter((line) => /^\| `(petshop|auth|logistics|hris)` \|/.test(line))
  for (const line of locks) console.log(line.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim())
  const start = lines.findIndex((line) => line.startsWith('## Klaim aktif'))
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '))
  const rows = lines
    .slice(start, end === -1 ? undefined : end)
    .filter((line) => /^\| `[^`]+` \|/.test(line))
  if (rows.length === 0) console.log('Klaim aktif: tidak ada')
  for (const row of rows) {
    const cells = row.split('|').map((cell) => cell.trim())
    console.log(`Klaim: ${cells[1]} — ${cells[2]} — ${cells[3]}`)
  }
}
