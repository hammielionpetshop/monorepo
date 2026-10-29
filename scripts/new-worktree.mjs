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
 *   2. pilih port kosong untuk tiap app (tidak menabrak worktree lain)
 *   3. buat database sendiri dari template `petshop_db` di container lokal
 *   4. salin `.env` root & `.env.local` tiap app, lalu arahkan DATABASE_URL + PORT-nya
 *   5. `pnpm install`
 *
 * Kenapa langkah 4 wajib: berkas env itu gitignored, jadi worktree baru lahir
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
const ENV_FILES = [
  { path: '.env', port: null },
  { path: join('apps', 'backoffice', '.env.local'), port: 6969 },
  { path: join('apps', 'order-web', '.env.local'), port: 7070 },
  { path: join('apps', 'hris', '.env.local'), port: 7171 },
]

function fail(message) {
  console.error(`\n  ${message}\n`)
  process.exit(1)
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

// --- argumen ---------------------------------------------------------------

const argv = process.argv.slice(2)
const VALUE_OPTIONS = new Set(['--from', '--dir'])
const options = { '--from': 'main', '--dir': undefined }
let branch
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i]
  if (VALUE_OPTIONS.has(arg)) {
    if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) fail(`${arg} butuh nilai.`)
    options[arg] = argv[++i]
  } else if (arg === '--no-db' || arg === '--no-install') {
    options[arg] = true
  } else if (arg.startsWith('--')) {
    fail(`Opsi tidak dikenal: ${arg}`)
  } else if (branch === undefined) {
    branch = arg
  } else {
    fail(`Argumen berlebih: "${arg}"`)
  }
}
const baseRef = options['--from']
const skipDb = options['--no-db'] === true
const skipInstall = options['--no-install'] === true

if (!branch) {
  fail('Pemakaian: node scripts/new-worktree.mjs <nama-branch> [--from main] [--dir ../folder] [--no-db] [--no-install]')
}
if (!/^[A-Za-z0-9._\/-]+$/.test(branch)) fail(`Nama branch "${branch}" mengandung karakter yang tidak aman.`)

const slug = branch.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
const dir = resolve(ROOT, options['--dir'] ?? join('..', `hammielion-${slug}`))
const dbName = `petshop_wt_${slug.replace(/-/g, '_')}`.slice(0, 63)

if (existsSync(dir)) fail(`Folder tujuan sudah ada: ${dir}`)

const branchCheck = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: ROOT })
if (branchCheck.status === 0) fail(`Branch "${branch}" sudah ada. Pakai nama lain, atau checkout worktree yang sudah ada.`)

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
    const longestFile = git('ls-files').split('\n').reduce((max, f) => Math.max(max, f.length), 0)
    const total = dir.length + 1 + longestFile
    if (total > 259) {
      fail(
        `Path terlalu panjang untuk Windows: "${dir}" + berkas terpanjang (${longestFile} karakter) = ${total}, batasnya 259.\n` +
          `  Pilih folder yang lebih pendek lewat --dir (mis. C:\\wt\\${slug}),\n` +
          '  atau aktifkan path panjang sekali untuk selamanya:  git config --global core.longpaths true',
      )
    }
  }
}

// --- 2. port ---------------------------------------------------------------

/** Port yang sudah dipesan worktree lain, dibaca dari .env.local masing-masing. */
function findReservedPorts() {
  // Port bawaan tiap app selalu dianggap milik worktree utama, walau `.env.local`-nya
  // tidak menyebut PORT sama sekali — di sanalah `pnpm dev` mendarat kalau tidak diatur.
  const reserved = new Set(ENV_FILES.map((f) => f.port).filter((p) => p !== null))
  const worktreePaths = git('worktree', 'list', '--porcelain')
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length))
  for (const worktree of worktreePaths) {
    for (const { path: rel, port } of ENV_FILES) {
      if (port === null) continue
      const file = join(worktree, rel)
      if (!existsSync(file)) continue
      const match = readFileSync(file, 'utf8').match(/^\s*PORT\s*=\s*(\d+)/m)
      if (match) reserved.add(Number(match[1]))
    }
  }
  return reserved
}

/**
 * Port dianggap bebas kalau (a) bisa di-listen dan (b) tidak ada yang menjawab koneksi.
 *
 * Dua-duanya perlu di Windows: `listen(port, '0.0.0.0')` BERHASIL walau sudah ada
 * proses lain yang mendengarkan di `[::]` port yang sama (dual-stack), jadi pengecekan
 * bind saja bisa membagikan port yang sebetulnya sudah dipakai. Karena itu bind-nya
 * dilakukan tanpa host — sama seperti yang dilakukan Next — dan ditambah probe koneksi.
 */
function isPortFree(port) {
  const canBind = new Promise((res) => {
    const server = createServer()
    server.once('error', () => res(false))
    server.once('listening', () => server.close(() => res(true)))
    server.listen(port)
  })
  const nobodyListening = new Promise((res) => {
    const socket = connect({ port, host: '127.0.0.1' })
    const finish = (result) => {
      socket.destroy()
      res(result)
    }
    socket.setTimeout(500)
    socket.once('connect', () => finish(false))
    socket.once('timeout', () => finish(true))
    socket.once('error', () => finish(true))
  })
  return Promise.all([canBind, nobodyListening]).then(([a, b]) => a && b)
}

async function pickPort(start, reserved) {
  for (let port = start; port < start + 100; port++) {
    if (reserved.has(port)) continue
    if (await isPortFree(port)) {
      reserved.add(port)
      return port
    }
  }
  fail(`Tidak menemukan port kosong mulai dari ${start}.`)
}

// --- jalan -----------------------------------------------------------------

const reservedPorts = findReservedPorts()
const newPorts = new Map()
for (const { path: rel, port } of ENV_FILES) {
  if (port !== null) newPorts.set(rel, await pickPort(port, reservedPorts))
}

console.log(`\nWorktree  : ${dir}`)
console.log(`Branch    : ${branch} (dari ${baseRef})`)
console.log(`Database  : ${skipDb ? `${DB_TEMPLATE} (dipakai bersama, --no-db)` : dbName}`)
for (const [rel, port] of newPorts) console.log(`Port      : ${basename(dirname(rel))} → ${port}`)
console.log()

// 1. worktree
try {
  git('worktree', 'add', '-b', branch, dir, baseRef)
} catch (e) {
  // Git bisa gagal setelah branch terlanjur dibuat; bereskan supaya percobaan
  // berikutnya tidak tertahan pesan "branch sudah ada".
  spawnSync('git', ['worktree', 'prune'], { cwd: ROOT })
  spawnSync('git', ['branch', '-D', branch], { cwd: ROOT })
  const gitOutput = (e.stderr?.toString() ?? e.message).split('\n').filter((line) => line.trim()).slice(-3).join('\n    ')
  fail(`git worktree add gagal:\n    ${gitOutput}`)
}
console.log('  worktree dibuat')

// 3. database
let targetDb = DB_TEMPLATE
if (!skipDb) {
  const ready = spawnSync('docker', ['exec', CONTAINER, 'pg_isready', '-U', 'petshop'], { encoding: 'utf8' })
  if (ready.status !== 0) {
    console.warn(`  ! container ${CONTAINER} tidak siap — lewati pembuatan DB, pakai ${DB_TEMPLATE}.`)
    console.warn('    (nyalakan dengan `pnpm db:local:up`, lalu buat DB-nya manual)')
  } else {
    const created = spawnSync(
      'docker',
      ['exec', CONTAINER, 'psql', '-U', 'petshop', '-d', 'postgres', '-c', `CREATE DATABASE ${dbName} TEMPLATE ${DB_TEMPLATE}`],
      { encoding: 'utf8' },
    )
    if (created.status !== 0) {
      const message = (created.stderr || '').trim()
      console.warn(`  ! gagal membuat ${dbName}: ${message}`)
      if (/being accessed by other users/.test(message)) {
        console.warn(`    Tutup dulu koneksi ke ${DB_TEMPLATE} (dev server / Drizzle Studio), lalu ulangi.`)
      }
      console.warn(`    Sementara memakai ${DB_TEMPLATE}.`)
    } else {
      targetDb = dbName
      console.log(`  database ${dbName} dibuat dari ${DB_TEMPLATE}`)
    }
  }
}

// 4. env
const localUrl = `${DB_HOST}/${targetDb}`
for (const { path: rel } of ENV_FILES) {
  const source = join(ROOT, rel)
  const target = join(dir, rel)
  if (!existsSync(source)) {
    console.warn(`  ! ${rel} tidak ada di worktree sumber — dilewati`)
    continue
  }
  let content = readFileSync(source, 'utf8')

  content = /^\s*DATABASE_URL\s*=/m.test(content)
    ? content.replace(/^\s*DATABASE_URL\s*=.*$/m, `DATABASE_URL=${localUrl}`)
    : `${content.replace(/\s*$/, '')}\nDATABASE_URL=${localUrl}\n`

  const port = newPorts.get(rel)
  if (port !== undefined) {
    content = /^\s*PORT\s*=/m.test(content)
      ? content.replace(/^\s*PORT\s*=.*$/m, `PORT=${port}`)
      : `${content.replace(/\s*$/, '')}\nPORT=${port}\n`
  }

  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
  console.log(`  ${rel} disalin (DATABASE_URL → ${targetDb}${port ? `, PORT → ${port}` : ''})`)
}

// 5. install
if (!skipInstall) {
  console.log('\n  pnpm install ...')
  const pnpm = spawnSync('pnpm', ['install'], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' })
  if (pnpm.status !== 0) console.warn('  ! pnpm install gagal — jalankan manual di worktree baru.')
}

console.log(`
Siap. Lanjutkan dengan:

  cd ${dir}
  ${skipInstall ? 'pnpm install\n  ' : ''}pnpm dev:backoffice     # port ${newPorts.get(join('apps', 'backoffice', '.env.local'))}

Kalau database barusan dibuat dari template, isinya sama persis dengan ${DB_TEMPLATE}
saat ini — bebas di-reset, di-seed, atau dimigrasi tanpa mengganggu worktree lain.
`)
