#!/usr/bin/env node
/**
 * Merge lokal berurutan ke `staging` atau `dev_hris`. TIDAK pernah push.
 *
 *   node scripts/merge-local.mjs <target> <sumber...>
 *   node scripts/merge-local.mjs staging dev_hris docs/release-x-claim
 *
 * Aturan yang ditegakkan: target hanya `staging` atau `dev_hris`; worktree target harus
 * bersih; target lokal tidak boleh diverge dari origin (bila hanya tertinggal, di-fast-forward);
 * merge memakai --no-ff; berhenti di konflik dan menyebut berkasnya, tanpa menyelesaikannya.
 * Push dilakukan manual sesudah seluruh batch dan pemeriksaannya selesai.
 */
import { spawnSync } from 'node:child_process'

const ALLOWED_TARGETS = ['staging', 'dev_hris']

function git(args, cwd) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' })
  return { ok: result.status === 0, out: (result.stdout ?? '').trim(), err: (result.stderr ?? '').trim() }
}

function fail(message) {
  console.error(`GAGAL: ${message}`)
  process.exit(1)
}

const [target, ...sources] = process.argv.slice(2)
if (!target || sources.length === 0) fail('pemakaian: merge-local <target> <sumber...>')
if (!ALLOWED_TARGETS.includes(target)) {
  fail(`target harus salah satu dari ${ALLOWED_TARGETS.join(', ')}; tidak boleh ${target}`)
}

if (!git(['fetch', '--quiet', 'origin']).ok) {
  fail('fetch gagal; tidak melanjutkan dengan remote-tracking yang mungkin usang')
}

const blocks = git(['worktree', 'list', '--porcelain']).out.split(/\r?\n\r?\n/)
const holder = blocks.find((block) => block.includes(`branch refs/heads/${target}`))
let cwd = holder?.match(/^worktree (.+)$/m)?.[1]
if (!cwd) {
  cwd = process.cwd()
  if (git(['status', '--porcelain'], cwd).out) {
    fail(`worktree ${cwd} tidak bersih; ${target} belum di-checkout di mana pun`)
  }
  const checkout = git(['checkout', target], cwd)
  if (!checkout.ok) fail(`checkout ${target} gagal: ${checkout.err}`)
}
if (git(['status', '--porcelain'], cwd).out) fail(`worktree ${cwd} (${target}) tidak bersih`)

const counts = git(['rev-list', '--left-right', '--count', `${target}...origin/${target}`], cwd)
const [ahead, behind] = counts.out.split(/\s+/).map(Number)
if (behind > 0) {
  if (ahead > 0) fail(`${target} lokal diverge dari origin (ahead ${ahead}, behind ${behind}); selesaikan manual`)
  const forwarded = git(['merge', '--ff-only', `origin/${target}`], cwd)
  if (!forwarded.ok) fail(`fast-forward ${target} gagal: ${forwarded.err}`)
  console.log(`${target}: di-fast-forward ${behind} commit dari origin`)
}

for (const source of sources) {
  if (!git(['rev-parse', '--verify', '--quiet', source], cwd).ok) fail(`sumber ${source} tidak ditemukan`)
  if (git(['merge-base', '--is-ancestor', source, 'HEAD'], cwd).ok) {
    console.log(`${source}: sudah ada di ${target}, dilewati`)
    continue
  }
  const merged = git(['merge', '--no-ff', '-m', `Merge branch '${source}' into ${target}`, source], cwd)
  if (!merged.ok) {
    const conflicts = git(['diff', '--name-only', '--diff-filter=U'], cwd).out
    console.error(`KONFLIK saat merge ${source} ke ${target} di ${cwd}:\n${conflicts || merged.err}`)
    console.error('Selesaikan manual lalu commit; batch dihentikan.')
    process.exit(2)
  }
  console.log(`${source}: ter-merge ke ${target}`)
}

const final = git(['rev-list', '--left-right', '--count', `${target}...origin/${target}`], cwd).out.split(/\s+/)
console.log(`\nSelesai. ${target}: ahead ${final[0]} dari origin. Belum di-push; periksa batch lalu push manual.`)
