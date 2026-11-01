#!/usr/bin/env node
/**
 * Gabungkan potongan changelog dari `apps/backoffice/changelog.d/` menjadi satu
 * versi baru di `apps/backoffice/CHANGELOG.md`.
 *
 *   node scripts/changelog-release.mjs 1.95.0        rilis versi eksplisit
 *   node scripts/changelog-release.mjs minor         naikkan dari versi terakhir
 *   node scripts/changelog-release.mjs --check       hanya validasi potongan (dipakai CI)
 *   node scripts/changelog-release.mjs 1.95.0 --dry-run   tampilkan hasil, jangan tulis
 *   node scripts/changelog-release.mjs 0.1.0 --app hris   rilis changelog HRIS (apps/hris)
 *
 * HRIS punya changelog sendiri (permintaan owner 2026-11-01): potongan di `apps/hris/changelog.d/`,
 * hasil di `apps/hris/CHANGELOG.md`, tampil di halaman HRIS "Apa yang baru". `--check` memvalidasi
 * potongan kedua aplikasi dan menolak branch yang mengubah `apps/hris` tanpa potongan HRIS-nya.
 *
 * Kenapa perlu ini: aturan wajib repo menyuruh setiap perubahan menambah entry di
 * BARIS PALING ATAS `CHANGELOG.md`. Kalau beberapa branch/agent berjalan paralel,
 * mereka semua menulis di baris yang sama dan setiap merge pasti konflik. Dengan
 * satu file potongan per branch, tidak ada dua pekerjaan yang menyentuh file yang
 * sama, dan penggabungan baru terjadi sekali saat rilis.
 *
 * Flag lain:
 *   --date YYYY-MM-DD   tanggal rilis (default: hari ini, waktu lokal)
 *   --keep              jangan hapus file potongan setelah digabung
 */
import { existsSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const APPS = ['backoffice', 'hris']
const appIdx = process.argv.indexOf('--app')
const APP = appIdx !== -1 ? process.argv[appIdx + 1] : 'backoffice'
if (!APPS.includes(APP)) {
  console.error(`\n  --app harus salah satu dari: ${APPS.join(', ')}\n`)
  process.exit(1)
}
const fragmentDir = (app) => join(ROOT, 'apps', app, 'changelog.d')
const FRAGMENT_DIR = fragmentDir(APP)
const CHANGELOG = join(ROOT, 'apps', APP, 'CHANGELOG.md')

/** Urutan section mengikuti Keep a Changelog. Section di luar daftar ini ditolak. */
const SECTIONS = ['Added', 'Changed', 'Fixed', 'Removed']

function fail(pesan) {
  console.error(`\n  ${pesan}\n`)
  process.exit(1)
}

/** Baca semua potongan. README.md dan file berawalan `_` diabaikan. */
function bacaPotongan(dir = FRAGMENT_DIR) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    fail(`Direktori potongan tidak ada: ${dir}`)
  }
  return entries
    .filter((f) => f.endsWith('.md') && f !== 'README.md' && !f.startsWith('_'))
    .sort()
    .map((f) => ({ nama: f, isi: readFileSync(join(dir, f), 'utf8') }))
}

/**
 * Pecah satu potongan menjadi { Section: [baris...] }.
 * Baris apa pun sebelum heading `### ` pertama dianggap salah tulis — lebih baik
 * gagal keras daripada diam-diam membuang teks yang sudah ditulis orang.
 */
function parsePotongan({ nama, isi }) {
  const hasil = new Map()
  let aktif = null

  for (const baris of isi.split(/\r?\n/)) {
    const heading = baris.match(/^###\s+(.+?)\s*$/)
    if (heading) {
      const section = heading[1]
      if (!SECTIONS.includes(section)) {
        fail(
          `${nama}: section "${section}" tidak dikenal. ` +
            `Yang boleh: ${SECTIONS.map((s) => `### ${s}`).join(', ')}`,
        )
      }
      aktif = section
      if (!hasil.has(aktif)) hasil.set(aktif, [])
      continue
    }
    if (baris.startsWith('## ')) {
      fail(`${nama}: jangan tulis heading versi "## [x.y.z]" di potongan — itu diisi saat rilis.`)
    }
    if (aktif === null) {
      if (baris.trim() === '') continue
      fail(`${nama}: ada teks sebelum heading section. Mulai file dengan "### Added|Changed|Fixed|Removed".`)
    }
    hasil.get(aktif).push(baris)
  }

  if (hasil.size === 0) fail(`${nama}: tidak ada satu pun heading "### ..." — file ini tidak berisi apa-apa.`)

  for (const [section, baris] of hasil) {
    if (baris.every((b) => b.trim() === '')) fail(`${nama}: section "${section}" kosong.`)
  }
  return hasil
}

/** Buang baris kosong di awal & akhir sebuah blok. */
function rapikan(baris) {
  const out = [...baris]
  while (out.length && out[0].trim() === '') out.shift()
  while (out.length && out[out.length - 1].trim() === '') out.pop()
  return out
}

function versiTerakhir(changelog) {
  const m = changelog.match(/^##\s+\[(\d+)\.(\d+)\.(\d+)\]/m)
  // Changelog HRIS belum punya versi sampai rilis pertama: mulai dari 0.0.0.
  if (!m) return APP === 'hris' ? [0, 0, 0] : fail('Tidak menemukan versi mana pun di CHANGELOG.md.')
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function naikkan([major, minor, patch], jenis) {
  if (jenis === 'major') return `${major + 1}.0.0`
  if (jenis === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

function tanggalHariIni() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// --- argumen ---------------------------------------------------------------

const argv = process.argv.slice(2)
const cek = argv.includes('--check')
const dryRun = argv.includes('--dry-run')
const keep = argv.includes('--keep')
const dateIdx = argv.indexOf('--date')
const tanggal = dateIdx !== -1 ? argv[dateIdx + 1] : tanggalHariIni()
const appArgIdx = argv.indexOf('--app')
const posisi = argv.filter((a, i) => !a.startsWith('--') && !(dateIdx !== -1 && i === dateIdx + 1)
  && !(appArgIdx !== -1 && i === appArgIdx + 1))

if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) fail(`--date harus format YYYY-MM-DD, dapat "${tanggal}".`)

// --- jalan -----------------------------------------------------------------

function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' })
  return r.status === 0 ? r.stdout.trim() : null
}

/**
 * Branch kerja yang mengubah apps/hris (selain tes dan changelog itu sendiri) wajib punya
 * apps/hris/changelog.d/<branch>.md (permintaan owner 2026-11-01: jangan lupa tiap update).
 * Dilewati di main/staging/dev_hris/release/*, HEAD terlepas (CI), atau bila git tidak tersedia.
 */
function cekPotonganHris() {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  if (!branch || ['HEAD', 'main', 'staging', 'dev_hris'].includes(branch) || branch.startsWith('release/')) return
  const bases = ['origin/dev_hris', 'origin/main']
    .map((ref) => git(['merge-base', 'HEAD', ref]))
    .filter(Boolean)
    .map((sha) => ({ sha, jarak: Number(git(['rev-list', '--count', `${sha}..HEAD`]) ?? Infinity) }))
    .sort((a, b) => a.jarak - b.jarak)
  if (bases.length === 0) return
  const berubah = [
    git(['diff', '--name-only', `${bases[0].sha}...HEAD`]),
    git(['diff', '--name-only', 'HEAD']),
    git(['ls-files', '--others', '--exclude-standard']),
  ].join('\n').split('\n').filter(Boolean)
  const hris = berubah.filter((f) => f.startsWith('apps/hris/') && !f.startsWith('apps/hris/changelog.d/')
    && f !== 'apps/hris/CHANGELOG.md' && !/\.test\.(ts|tsx|mjs)$/.test(f))
  if (hris.length === 0) return
  const nama = `${branch.replace(/\//g, '-')}.md`
  if (!existsSync(join(fragmentDir('hris'), nama))) {
    fail(`Branch ${branch} mengubah HRIS (${hris[0]}${hris.length > 1 ? `, +${hris.length - 1} berkas` : ''}) tetapi belum punya ` +
      `apps/hris/changelog.d/${nama}. Tulis catatan perubahannya, dan tanda Baru di apps/hris/lib/new-features.ts bila ada menu/bagian baru.`)
  }
}

if (cek) {
  for (const app of APPS) {
    const daftar = bacaPotongan(fragmentDir(app))
    daftar.forEach(parsePotongan)
    if (daftar.length === 0) console.log(`${app}: changelog.d kosong — tidak ada yang perlu divalidasi.`)
    else {
      console.log(`${app}: ${daftar.length} potongan changelog valid:`)
      for (const { nama } of daftar) console.log(`  - ${nama}`)
    }
  }
  cekPotonganHris()
  process.exit(0)
}

const potongan = bacaPotongan()
const terurai = potongan.map(parsePotongan)

if (potongan.length === 0) {
  fail(`Tidak ada potongan di apps/${APP}/changelog.d/ — tidak ada yang bisa dirilis.`)
}

const changelogLama = readFileSync(CHANGELOG, 'utf8')
const crlf = changelogLama.includes('\r\n')
const isi = crlf ? changelogLama.replace(/\r\n/g, '\n') : changelogLama

const arg = posisi[0]
let versi
if (!arg) fail('Sebutkan versi (mis. 1.95.0) atau jenis kenaikan (major|minor|patch).')
if (['major', 'minor', 'patch'].includes(arg)) versi = naikkan(versiTerakhir(isi), arg)
else if (/^\d+\.\d+\.\d+$/.test(arg)) versi = arg
else fail(`Versi "${arg}" tidak valid. Pakai x.y.z atau major|minor|patch.`)

if (isi.includes(`## [${versi}]`)) fail(`Versi ${versi} sudah ada di CHANGELOG.md.`)

// Gabung per section, urut sesuai SECTIONS, isi urut nama file potongan.
const blok = [`## [${versi}] - ${tanggal}`]
for (const section of SECTIONS) {
  const baris = []
  for (const p of terurai) {
    if (p.has(section)) baris.push(...rapikan(p.get(section)))
  }
  if (baris.length === 0) continue
  blok.push('', `### ${section}`, ...baris)
}
const entriBaru = blok.join('\n')

const anchor = isi.indexOf('\n## [')
if (anchor === -1 && APP !== 'hris') fail('Struktur CHANGELOG.md tidak dikenali (tidak ada heading "## [...").')
// Rilis pertama HRIS: belum ada versi, entri ditaruh sesudah pengantar.
let hasil = anchor === -1
  ? `${isi.trimEnd()}\n\n${entriBaru}\n`
  : `${isi.slice(0, anchor + 1)}${entriBaru}\n\n${isi.slice(anchor + 1)}`
if (crlf) hasil = hasil.replace(/\n/g, '\r\n')

if (dryRun) {
  console.log(entriBaru)
  console.log(`\n[dry-run] ${potongan.length} potongan akan digabung ke ${versi} dan dihapus.`)
  process.exit(0)
}

writeFileSync(CHANGELOG, hasil)
if (!keep) for (const { nama } of potongan) rmSync(join(FRAGMENT_DIR, nama))

console.log(`CHANGELOG.md → [${versi}] - ${tanggal}`)
for (const { nama } of potongan) console.log(`  ${keep ? 'digabung' : 'digabung & dihapus'}: ${basename(nama)}`)
