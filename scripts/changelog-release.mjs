#!/usr/bin/env node
/**
 * Gabungkan potongan changelog dari `apps/backoffice/changelog.d/` menjadi satu
 * versi baru di `apps/backoffice/CHANGELOG.md`.
 *
 *   node scripts/changelog-release.mjs 1.95.0        rilis versi eksplisit
 *   node scripts/changelog-release.mjs minor         naikkan dari versi terakhir
 *   node scripts/changelog-release.mjs --check       hanya validasi potongan (dipakai CI)
 *   node scripts/changelog-release.mjs 1.95.0 --dry-run   tampilkan hasil, jangan tulis
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
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FRAGMENT_DIR = join(ROOT, 'apps', 'backoffice', 'changelog.d')
const CHANGELOG = join(ROOT, 'apps', 'backoffice', 'CHANGELOG.md')

/** Urutan section mengikuti Keep a Changelog. Section di luar daftar ini ditolak. */
const SECTIONS = ['Added', 'Changed', 'Fixed', 'Removed']

function fail(pesan) {
  console.error(`\n  ${pesan}\n`)
  process.exit(1)
}

/** Baca semua potongan. README.md dan file berawalan `_` diabaikan. */
function bacaPotongan() {
  let entries
  try {
    entries = readdirSync(FRAGMENT_DIR)
  } catch {
    fail(`Direktori potongan tidak ada: ${FRAGMENT_DIR}`)
  }
  return entries
    .filter((f) => f.endsWith('.md') && f !== 'README.md' && !f.startsWith('_'))
    .sort()
    .map((f) => ({ nama: f, isi: readFileSync(join(FRAGMENT_DIR, f), 'utf8') }))
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
  if (!m) fail('Tidak menemukan versi mana pun di CHANGELOG.md.')
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
const posisi = argv.filter((a, i) => !a.startsWith('--') && !(dateIdx !== -1 && i === dateIdx + 1))

if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) fail(`--date harus format YYYY-MM-DD, dapat "${tanggal}".`)

// --- jalan -----------------------------------------------------------------

const potongan = bacaPotongan()
const terurai = potongan.map(parsePotongan)

if (cek) {
  if (potongan.length === 0) {
    console.log('changelog.d kosong — tidak ada yang perlu divalidasi.')
  } else {
    console.log(`${potongan.length} potongan changelog valid:`)
    for (const { nama } of potongan) console.log(`  - ${nama}`)
  }
  process.exit(0)
}

if (potongan.length === 0) {
  fail('Tidak ada potongan di apps/backoffice/changelog.d/ — tidak ada yang bisa dirilis.')
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
if (anchor === -1) fail('Struktur CHANGELOG.md tidak dikenali (tidak ada heading "## [...").')
let hasil = `${isi.slice(0, anchor + 1)}${entriBaru}\n\n${isi.slice(anchor + 1)}`
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
