#!/usr/bin/env node
/**
 * Bereskan worktree yang sudah selesai: folder, branch, dan database-nya.
 *
 *   node scripts/remove-worktree.mjs feat/laporan-kas
 *   node scripts/remove-worktree.mjs ../hammielion-feat-x --keep-branch
 *   node scripts/remove-worktree.mjs feat/x --force
 *
 * Kenapa tidak `git worktree remove` saja: perintah itu menolak folder yang tidak
 * bersih, dan worktree di sini selalu berisi `node_modules` — jadi selalu ditolak.
 * Skrip ini menghapus foldernya sendiri, lalu merapikan catatan git, branch, dan
 * database per-worktree yang dibuat `new-worktree.mjs`.
 *
 * Palang: menolak jalan kalau ada perubahan yang belum di-commit atau commit yang
 * belum masuk `main`, kecuali dipaksa dengan `--force`.
 *
 *   --keep-branch   jangan hapus branch-nya
 *   --keep-db       jangan hapus database-nya
 *   --force         hapus walau masih ada pekerjaan yang belum tersimpan
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { rmSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTAINER = 'hammielion-db-local'

function fail(pesan) {
  console.error(`\n  ${pesan}\n`)
  process.exit(1)
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

const argv = process.argv.slice(2)
const target = argv.find((a) => !a.startsWith('--'))
const keepBranch = argv.includes('--keep-branch')
const keepDb = argv.includes('--keep-db')
const force = argv.includes('--force')

if (!target) fail('Pemakaian: node scripts/remove-worktree.mjs <branch|folder> [--keep-branch] [--keep-db] [--force]')

// --- cari worktree-nya ------------------------------------------------------

const daftar = []
let sekarang = null
for (const baris of git('worktree', 'list', '--porcelain').split('\n')) {
  if (baris.startsWith('worktree ')) sekarang = { dir: baris.slice(9).trim(), branch: null }
  else if (baris.startsWith('branch ')) sekarang.branch = baris.slice(7).trim().replace('refs/heads/', '')
  else if (baris.trim() === '' && sekarang) {
    daftar.push(sekarang)
    sekarang = null
  }
}
if (sekarang) daftar.push(sekarang)

const utama = daftar[0]
const targetPath = resolve(ROOT, target)
const wt = daftar.find((w) => w.branch === target || resolve(w.dir) === targetPath)

if (!wt) {
  console.error(`\n  Tidak menemukan worktree "${target}". Yang ada:`)
  for (const w of daftar) console.error(`    ${w.branch ?? '(detached)'}  →  ${w.dir}`)
  console.error()
  process.exit(1)
}
if (resolve(wt.dir) === resolve(utama.dir)) fail('Itu worktree utama — tidak akan dihapus.')

// --- palang keselamatan -----------------------------------------------------

if (!force) {
  if (existsSync(wt.dir)) {
    const kotor = spawnSync('git', ['-C', wt.dir, 'status', '--porcelain'], { encoding: 'utf8' }).stdout?.trim()
    if (kotor) {
      const n = kotor.split('\n').length
      fail(`${wt.dir} masih punya ${n} perubahan yang belum di-commit. Commit dulu, atau paksa dengan --force.`)
    }
  }
  if (wt.branch) {
    const belumMasuk = spawnSync('git', ['log', '--oneline', `main..${wt.branch}`], { cwd: ROOT, encoding: 'utf8' })
      .stdout?.trim()
    if (belumMasuk) {
      const n = belumMasuk.split('\n').length
      fail(
        `Branch "${wt.branch}" punya ${n} commit yang belum ada di main:\n    ` +
          `${belumMasuk.split('\n').slice(0, 5).join('\n    ')}\n\n` +
          '  Merge atau push dulu, atau paksa dengan --force.',
      )
    }
  }
}

// --- jalan ------------------------------------------------------------------

console.log(`\nMenghapus worktree : ${wt.dir}`)

if (existsSync(wt.dir)) {
  rmSync(wt.dir, { recursive: true, force: true, maxRetries: 3 })
  console.log('  folder dihapus')
}
git('worktree', 'prune')
console.log('  catatan git dirapikan')

if (wt.branch && !keepBranch) {
  const hapus = spawnSync('git', ['branch', '-D', wt.branch], { cwd: ROOT, encoding: 'utf8' })
  console.log(hapus.status === 0 ? `  branch ${wt.branch} dihapus` : `  ! gagal menghapus branch: ${hapus.stderr?.trim()}`)
}

if (!keepDb && wt.branch) {
  // Turunan nama harus persis sama dengan new-worktree.mjs, kalau tidak yang dihapus
  // bukan database yang dibuat.
  const slug = wt.branch.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  const namaDb = `petshop_wt_${slug.replace(/-/g, '_')}`.slice(0, 63)
  const drop = spawnSync(
    'docker',
    ['exec', CONTAINER, 'psql', '-U', 'petshop', '-d', 'postgres', '-c', `DROP DATABASE IF EXISTS ${namaDb}`],
    { encoding: 'utf8' },
  )
  if (drop.status === 0) console.log(`  database ${namaDb} dihapus`)
  else console.log(`  ! database ${namaDb} tidak dihapus: ${(drop.stderr || '').trim() || 'container tidak jalan'}`)
}

console.log()
