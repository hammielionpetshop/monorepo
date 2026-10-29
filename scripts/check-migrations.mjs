#!/usr/bin/env node
/**
 * Periksa keutuhan direktori migrasi tiap aliran (`src/migrations/` di tiap package DB).
 *
 *   node scripts/check-migrations.mjs
 *
 * Kenapa perlu: dua branch yang jalan paralel akan sama-sama membuat migrasi
 * bernomor berikutnya (mis. dua-duanya `0013_*`). Git merge sering meloloskan itu
 * — file `.sql`-nya beda nama, jadi tidak konflik — dan yang gagal justru
 * `db:migrate` di server, sesudah kode ter-merge. Cek ini memindahkan kegagalan
 * itu ke PR, tempat memperbaikinya masih murah (renomori salah satu migrasi).
 *
 * Yang diperiksa:
 *   1. setiap file .sql punya entry di _journal.json, dan sebaliknya
 *   2. idx berurutan mulai 0, tanpa lompatan & tanpa duplikat
 *   3. awalan angka nama file cocok dengan idx-nya (idx 12 → 0012_*)
 *   4. tidak ada tag ganda
 *
 * Aliran petshop, auth, logistics, dan hris punya penomoran & journal sendiri, jadi
 * masing-masing diperiksa terpisah.
 *
 * File snapshot di meta/ sengaja TIDAK diwajibkan: migrasi yang ditulis tangan
 * (0009 ke atas) memang tidak punya snapshot, dan itu bukan kesalahan.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const STREAMS = [
  ['petshop', join(ROOT, 'packages', 'db', 'src', 'migrations')],
  ['auth', join(ROOT, 'packages', 'auth', 'src', 'migrations')],
  ['logistics', join(ROOT, 'packages', 'logistics', 'src', 'migrations')],
  ['hris', join(ROOT, 'packages', 'hris-db', 'src', 'migrations')],
]

const errors = []
const warnings = []
const summary = []

function checkStream(streamName, migrationsDir) {
  const journalPath = join(migrationsDir, 'meta', '_journal.json')
  const fail = (message) => errors.push(`[${streamName}] ${message}`)
  const warn = (message) => warnings.push(`[${streamName}] ${message}`)

  let journal
  try {
    journal = JSON.parse(readFileSync(journalPath, 'utf8'))
  } catch (e) {
    console.error(`\n  Tidak bisa membaca ${journalPath}: ${e.message}\n`)
    process.exit(1)
  }

  const entries = journal.entries ?? []
  summary.push(`${streamName} ${entries.length}`)
  const sqlFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  // 1 & 4 — pemetaan tag ↔ file
  const usedTags = new Map()
  for (const e of entries) {
    if (usedTags.has(e.tag)) {
      fail(`tag ganda di _journal.json: "${e.tag}" (idx ${usedTags.get(e.tag)} dan ${e.idx})`)
    }
    usedTags.set(e.tag, e.idx)
    if (!sqlFiles.includes(`${e.tag}.sql`)) {
      fail(`entry idx ${e.idx} menunjuk "${e.tag}.sql" yang tidak ada di direktori migrasi`)
    }
  }
  for (const f of sqlFiles) {
    const tag = f.replace(/\.sql$/, '')
    if (!usedTags.has(tag)) {
      fail(`"${f}" tidak terdaftar di _journal.json — migrasi ini tidak akan pernah dijalankan`)
    }
  }

  // 2 & 3 — nomor urut
  const sortedByIdx = [...entries].sort((a, b) => a.idx - b.idx)
  sortedByIdx.forEach((e, i) => {
    if (e.idx !== i) {
      fail(`idx tidak berurutan: harusnya ${i}, tapi "${e.tag}" memakai idx ${e.idx}`)
    }
    const numberPrefix = e.tag.match(/^(\d{4})_/)
    if (!numberPrefix) {
      fail(`nama "${e.tag}" tidak diawali 4 digit (mis. ${String(e.idx).padStart(4, '0')}_nama_migrasi)`)
    } else if (Number(numberPrefix[1]) !== e.idx) {
      fail(
        `awalan nama tidak cocok dengan idx: "${e.tag}" punya idx ${e.idx}, ` +
          `harusnya diberi nama ${String(e.idx).padStart(4, '0')}_...`,
      )
    }
  })

  // Urutan waktu — tanda khas dua branch paralel yang belum dinomori ulang.
  for (let i = 1; i < sortedByIdx.length; i++) {
    if (sortedByIdx[i].when < sortedByIdx[i - 1].when) {
      warn(
        `"${sortedByIdx[i].tag}" dibuat SEBELUM "${sortedByIdx[i - 1].tag}" tapi bernomor sesudahnya — ` +
          `wajar kalau memang baru dinomori ulang, mencurigakan kalau tidak.`,
      )
    }
  }
}

for (const [streamName, migrationsDir] of STREAMS) checkStream(streamName, migrationsDir)

for (const w of warnings) console.warn(`  ! ${w}`)

if (errors.length > 0) {
  console.error(`\n  Migrasi bermasalah (${errors.length}):`)
  for (const e of errors) console.error(`  x ${e}`)
  console.error(
    '\n  Kalau ini akibat dua branch sama-sama menambah migrasi: nomori ulang migrasi\n' +
      '  yang belum jalan di produksi (ubah nama file + tag & idx di _journal.json)\n' +
      '  supaya nomornya melanjutkan yang sudah ada.\n',
  )
  process.exit(1)
}

console.log(`Migrasi rapi (entry per aliran: ${summary.join(', ')}), semua cocok dengan file .sql.`)
