#!/usr/bin/env node
/**
 * Siapkan satu worktree baru yang langsung bisa dipakai kerja paralel.
 *
 *   node scripts/new-worktree.mjs feat/laporan-kas
 *   node scripts/new-worktree.mjs feat/x --from main --dir ../hm-x
 *   node scripts/new-worktree.mjs feat/x --no-db --no-install
 *
 * Yang dikerjakan, berurutan:
 *   1. `git worktree add` + branch baru
 *   2. pilih port kosong untuk backoffice & order-web (tidak menabrak worktree lain)
 *   3. buat database sendiri dari template `petshop_db` di container lokal
 *   4. salin `.env` root & `.env.local` tiap app, lalu arahkan DATABASE_URL + PORT-nya
 *   5. `pnpm install`
 *
 * Kenapa langkah 4 wajib: ketiga berkas env itu gitignored, jadi worktree baru lahir
 * tanpa satu pun — tanpa disalin, tidak ada yang bisa dijalankan di sana.
 *
 * Palang keselamatan: DATABASE_URL di worktree baru SELALU ditulis ulang ke Postgres
 * lokal. `.env` root di repo ini berisi URL produksi, dan menyalinnya apa adanya ke
 * tempat beberapa agent bekerja paralel adalah cara tercepat merusak data sungguhan.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, connect } from 'node:net'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTAINER = 'hammielion-db-local'
const DB_TEMPLATE = 'petshop_db'
const DB_HOST = 'postgresql://petshop:petshop@localhost:5433'

/** Berkas env yang harus ada di tiap worktree, beserta port bawaan app-nya. */
const BERKAS_ENV = [
  { path: '.env', port: null },
  { path: join('apps', 'backoffice', '.env.local'), port: 6969 },
  { path: join('apps', 'order-web', '.env.local'), port: 7070 },
]

function fail(pesan) {
  console.error(`\n  ${pesan}\n`)
  process.exit(1)
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

// --- argumen ---------------------------------------------------------------

const argv = process.argv.slice(2)
const BERNILAI = new Set(['--from', '--dir'])
const opsi = { '--from': 'main', '--dir': undefined }
let branch
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (BERNILAI.has(a)) {
    if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) fail(`${a} butuh nilai.`)
    opsi[a] = argv[++i]
  } else if (a === '--no-db' || a === '--no-install') {
    opsi[a] = true
  } else if (a.startsWith('--')) {
    fail(`Opsi tidak dikenal: ${a}`)
  } else if (branch === undefined) {
    branch = a
  } else {
    fail(`Argumen berlebih: "${a}"`)
  }
}
const dasar = opsi['--from']
const tanpaDb = opsi['--no-db'] === true
const tanpaInstall = opsi['--no-install'] === true

if (!branch) {
  fail('Pemakaian: node scripts/new-worktree.mjs <nama-branch> [--from main] [--dir ../folder] [--no-db] [--no-install]')
}
if (!/^[A-Za-z0-9._\/-]+$/.test(branch)) fail(`Nama branch "${branch}" mengandung karakter yang tidak aman.`)

const slug = branch.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
const dir = resolve(ROOT, opsi['--dir'] ?? join('..', `hammielion-${slug}`))
const namaDb = `petshop_wt_${slug.replace(/-/g, '_')}`.slice(0, 63)

if (existsSync(dir)) fail(`Folder tujuan sudah ada: ${dir}`)

const branchAda = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: ROOT })
if (branchAda.status === 0) fail(`Branch "${branch}" sudah ada. Pakai nama lain, atau checkout worktree yang sudah ada.`)

/**
 * Palang panjang path Windows. Batas MAX_PATH 260 karakter dihitung dari path folder
 * worktree DITAMBAH path terpanjang di dalam repo — dan repo ini punya nama berkas
 * yang panjang-panjang di `app/(dashboard)/...`. Kalau kelewat, `git worktree add`
 * baru gagal di tengah checkout dan meninggalkan folder setengah jadi; lebih baik
 * ditolak sebelum apa pun dibuat.
 */
if (process.platform === 'win32') {
  const longpaths = spawnSync('git', ['config', '--get', 'core.longpaths'], { cwd: ROOT, encoding: 'utf8' })
  if (longpaths.stdout?.trim() !== 'true') {
    const terpanjang = git('ls-files').split('\n').reduce((m, f) => Math.max(m, f.length), 0)
    const total = dir.length + 1 + terpanjang
    if (total > 259) {
      fail(
        `Path terlalu panjang untuk Windows: "${dir}" + berkas terpanjang (${terpanjang} karakter) = ${total}, batasnya 259.\n` +
          `  Pilih folder yang lebih pendek lewat --dir (mis. C:\\wt\\${slug}),\n` +
          '  atau aktifkan path panjang sekali untuk selamanya:  git config --global core.longpaths true',
      )
    }
  }
}

// --- 2. port ---------------------------------------------------------------

/** Port yang sudah dipesan worktree lain, dibaca dari .env.local masing-masing. */
function portTerpakai() {
  // Port bawaan tiap app selalu dianggap milik worktree utama, walau `.env.local`-nya
  // tidak menyebut PORT sama sekali — di sanalah `pnpm dev` mendarat kalau tidak diatur.
  const terpakai = new Set(BERKAS_ENV.map((b) => b.port).filter((p) => p !== null))
  const daftar = git('worktree', 'list', '--porcelain')
    .split('\n')
    .filter((b) => b.startsWith('worktree '))
    .map((b) => b.slice('worktree '.length))
  for (const wt of daftar) {
    for (const { path: rel, port } of BERKAS_ENV) {
      if (port === null) continue
      const f = join(wt, rel)
      if (!existsSync(f)) continue
      const m = readFileSync(f, 'utf8').match(/^\s*PORT\s*=\s*(\d+)/m)
      if (m) terpakai.add(Number(m[1]))
    }
  }
  return terpakai
}

/**
 * Port dianggap bebas kalau (a) bisa di-listen dan (b) tidak ada yang menjawab koneksi.
 *
 * Dua-duanya perlu di Windows: `listen(port, '0.0.0.0')` BERHASIL walau sudah ada
 * proses lain yang mendengarkan di `[::]` port yang sama (dual-stack), jadi pengecekan
 * bind saja bisa membagikan port yang sebetulnya sudah dipakai. Karena itu bind-nya
 * dilakukan tanpa host — sama seperti yang dilakukan Next — dan ditambah probe koneksi.
 */
function bisaDipakai(port) {
  const bind = new Promise((res) => {
    const s = createServer()
    s.once('error', () => res(false))
    s.once('listening', () => s.close(() => res(true)))
    s.listen(port)
  })
  const kosong = new Promise((res) => {
    const c = connect({ port, host: '127.0.0.1' })
    const selesai = (hasil) => {
      c.destroy()
      res(hasil)
    }
    c.setTimeout(500)
    c.once('connect', () => selesai(false))
    c.once('timeout', () => selesai(true))
    c.once('error', () => selesai(true))
  })
  return Promise.all([bind, kosong]).then(([a, b]) => a && b)
}

async function pilihPort(awal, terpakai) {
  for (let p = awal; p < awal + 100; p++) {
    if (terpakai.has(p)) continue
    if (await bisaDipakai(p)) {
      terpakai.add(p)
      return p
    }
  }
  fail(`Tidak menemukan port kosong mulai dari ${awal}.`)
}

// --- jalan -----------------------------------------------------------------

const terpakai = portTerpakai()
const portBaru = new Map()
for (const { path: rel, port } of BERKAS_ENV) {
  if (port !== null) portBaru.set(rel, await pilihPort(port, terpakai))
}

console.log(`\nWorktree  : ${dir}`)
console.log(`Branch    : ${branch} (dari ${dasar})`)
console.log(`Database  : ${tanpaDb ? `${DB_TEMPLATE} (dipakai bersama, --no-db)` : namaDb}`)
for (const [rel, p] of portBaru) console.log(`Port      : ${basename(dirname(rel))} → ${p}`)
console.log()

// 1. worktree
try {
  git('worktree', 'add', '-b', branch, dir, dasar)
} catch (e) {
  // Git bisa gagal setelah branch terlanjur dibuat; bereskan supaya percobaan
  // berikutnya tidak tertahan pesan "branch sudah ada".
  spawnSync('git', ['worktree', 'prune'], { cwd: ROOT })
  spawnSync('git', ['branch', '-D', branch], { cwd: ROOT })
  const keluaran = (e.stderr?.toString() ?? e.message).split('\n').filter((b) => b.trim()).slice(-3).join('\n    ')
  fail(`git worktree add gagal:\n    ${keluaran}`)
}
console.log('  worktree dibuat')

// 3. database
let dbTujuan = DB_TEMPLATE
if (!tanpaDb) {
  const siap = spawnSync('docker', ['exec', CONTAINER, 'pg_isready', '-U', 'petshop'], { encoding: 'utf8' })
  if (siap.status !== 0) {
    console.warn(`  ! container ${CONTAINER} tidak siap — lewati pembuatan DB, pakai ${DB_TEMPLATE}.`)
    console.warn('    (nyalakan dengan `pnpm db:local:up`, lalu buat DB-nya manual)')
  } else {
    const buat = spawnSync(
      'docker',
      ['exec', CONTAINER, 'psql', '-U', 'petshop', '-d', 'postgres', '-c', `CREATE DATABASE ${namaDb} TEMPLATE ${DB_TEMPLATE}`],
      { encoding: 'utf8' },
    )
    if (buat.status !== 0) {
      const pesan = (buat.stderr || '').trim()
      console.warn(`  ! gagal membuat ${namaDb}: ${pesan}`)
      if (/being accessed by other users/.test(pesan)) {
        console.warn(`    Tutup dulu koneksi ke ${DB_TEMPLATE} (dev server / Drizzle Studio), lalu ulangi.`)
      }
      console.warn(`    Sementara memakai ${DB_TEMPLATE}.`)
    } else {
      dbTujuan = namaDb
      console.log(`  database ${namaDb} dibuat dari ${DB_TEMPLATE}`)
    }
  }
}

// 4. env
const urlLokal = `${DB_HOST}/${dbTujuan}`
for (const { path: rel } of BERKAS_ENV) {
  const sumber = join(ROOT, rel)
  const tujuan = join(dir, rel)
  if (!existsSync(sumber)) {
    console.warn(`  ! ${rel} tidak ada di worktree sumber — dilewati`)
    continue
  }
  let isi = readFileSync(sumber, 'utf8')

  isi = /^\s*DATABASE_URL\s*=/m.test(isi)
    ? isi.replace(/^\s*DATABASE_URL\s*=.*$/m, `DATABASE_URL=${urlLokal}`)
    : `${isi.replace(/\s*$/, '')}\nDATABASE_URL=${urlLokal}\n`

  const port = portBaru.get(rel)
  if (port !== undefined) {
    isi = /^\s*PORT\s*=/m.test(isi)
      ? isi.replace(/^\s*PORT\s*=.*$/m, `PORT=${port}`)
      : `${isi.replace(/\s*$/, '')}\nPORT=${port}\n`
  }

  mkdirSync(dirname(tujuan), { recursive: true })
  writeFileSync(tujuan, isi)
  console.log(`  ${rel} disalin (DATABASE_URL → ${dbTujuan}${port ? `, PORT → ${port}` : ''})`)
}

// 5. install
if (!tanpaInstall) {
  console.log('\n  pnpm install ...')
  const pnpm = spawnSync('pnpm', ['install'], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' })
  if (pnpm.status !== 0) console.warn('  ! pnpm install gagal — jalankan manual di worktree baru.')
}

console.log(`
Siap. Lanjutkan dengan:

  cd ${dir}
  ${tanpaInstall ? 'pnpm install\n  ' : ''}pnpm dev:backoffice     # port ${portBaru.get(join('apps', 'backoffice', '.env.local'))}

Kalau database barusan dibuat dari template, isinya sama persis dengan ${DB_TEMPLATE}
saat ini — bebas di-reset, di-seed, atau dimigrasi tanpa mengganggu worktree lain.
`)
