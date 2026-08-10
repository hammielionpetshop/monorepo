#!/usr/bin/env node
/**
 * Periksa keutuhan direktori migrasi `packages/db/src/migrations/`.
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
 * File snapshot di meta/ sengaja TIDAK diwajibkan: migrasi yang ditulis tangan
 * (0009 ke atas) memang tidak punya snapshot, dan itu bukan kesalahan.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'packages', 'db', 'src', 'migrations')
const JOURNAL = join(DIR, 'meta', '_journal.json')

const galat = []
const peringatan = []

let journal
try {
  journal = JSON.parse(readFileSync(JOURNAL, 'utf8'))
} catch (e) {
  console.error(`\n  Tidak bisa membaca ${JOURNAL}: ${e.message}\n`)
  process.exit(1)
}

const entries = journal.entries ?? []
const berkas = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()

// 1 & 4 — pemetaan tag ↔ file
const tagTerpakai = new Map()
for (const e of entries) {
  if (tagTerpakai.has(e.tag)) {
    galat.push(`tag ganda di _journal.json: "${e.tag}" (idx ${tagTerpakai.get(e.tag)} dan ${e.idx})`)
  }
  tagTerpakai.set(e.tag, e.idx)
  if (!berkas.includes(`${e.tag}.sql`)) {
    galat.push(`entry idx ${e.idx} menunjuk "${e.tag}.sql" yang tidak ada di direktori migrasi`)
  }
}
for (const f of berkas) {
  const tag = f.replace(/\.sql$/, '')
  if (!tagTerpakai.has(tag)) {
    galat.push(`"${f}" tidak terdaftar di _journal.json — migrasi ini tidak akan pernah dijalankan`)
  }
}

// 2 & 3 — nomor urut
const idxTerurut = [...entries].sort((a, b) => a.idx - b.idx)
idxTerurut.forEach((e, i) => {
  if (e.idx !== i) {
    galat.push(`idx tidak berurutan: harusnya ${i}, tapi "${e.tag}" memakai idx ${e.idx}`)
  }
  const awalan = e.tag.match(/^(\d{4})_/)
  if (!awalan) {
    galat.push(`nama "${e.tag}" tidak diawali 4 digit (mis. ${String(e.idx).padStart(4, '0')}_nama_migrasi)`)
  } else if (Number(awalan[1]) !== e.idx) {
    galat.push(
      `awalan nama tidak cocok dengan idx: "${e.tag}" punya idx ${e.idx}, ` +
        `harusnya diberi nama ${String(e.idx).padStart(4, '0')}_...`,
    )
  }
})

// Urutan waktu — tanda khas dua branch paralel yang belum dinomori ulang.
for (let i = 1; i < idxTerurut.length; i++) {
  if (idxTerurut[i].when < idxTerurut[i - 1].when) {
    peringatan.push(
      `"${idxTerurut[i].tag}" dibuat SEBELUM "${idxTerurut[i - 1].tag}" tapi bernomor sesudahnya — ` +
        `wajar kalau memang baru dinomori ulang, mencurigakan kalau tidak.`,
    )
  }
}

for (const w of peringatan) console.warn(`  ! ${w}`)

if (galat.length > 0) {
  console.error(`\n  Migrasi bermasalah (${galat.length}):`)
  for (const g of galat) console.error(`  x ${g}`)
  console.error(
    '\n  Kalau ini akibat dua branch sama-sama menambah migrasi: nomori ulang migrasi\n' +
      '  yang belum jalan di produksi (ubah nama file + tag & idx di _journal.json)\n' +
      '  supaya nomornya melanjutkan yang sudah ada.\n',
  )
  process.exit(1)
}

console.log(`Migrasi rapi: ${entries.length} entry, idx 0..${entries.length - 1}, semua cocok dengan file .sql.`)
