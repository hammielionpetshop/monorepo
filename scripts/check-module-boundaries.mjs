/**
 * Pagar batas modul HRIS yang tidak bisa ditulis sebagai pola ESLint (spec L0 §4).
 *
 *   node scripts/check-module-boundaries.mjs [folder-modules]
 *
 * Untuk tiap berkas di `apps/hris/modules/<m>/**`:
 *   1. impor relatif tidak boleh keluar dari folder `<m>`
 *   2. `@petshop/hris-db` (root, berisi semua tabel) dilarang
 *   3. `@petshop/hris-db/schema/<x>` hanya boleh untuk x = <m> atau `shared`
 *
 * Pagar sisanya (impor `@/modules/<x>/...` & `@petshop/db`) ada di eslint.config.mjs apps/hris.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BAWAAN = join(ROOT, 'apps', 'hris', 'modules')

const POLA_IMPOR = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g

function daftarBerkas(dir) {
  const hasil = []
  for (const nama of readdirSync(dir)) {
    const p = join(dir, nama)
    if (statSync(p).isDirectory()) hasil.push(...daftarBerkas(p))
    else if (/\.(ts|tsx|mts|js|mjs)$/.test(nama)) hasil.push(p)
  }
  return hasil
}

export function findViolations(modulesDir) {
  const pelanggaran = []
  if (!existsSync(modulesDir)) return pelanggaran
  for (const modul of readdirSync(modulesDir)) {
    const dirModul = join(modulesDir, modul)
    if (!statSync(dirModul).isDirectory()) continue
    for (const berkas of daftarBerkas(dirModul)) {
      const isi = readFileSync(berkas, 'utf8')
      const lokasi = relative(modulesDir, berkas).split(sep).join('/')
      for (const m of isi.matchAll(POLA_IMPOR)) {
        const sumber = m[1] ?? m[2] ?? m[3]
        if (sumber.startsWith('.')) {
          const tujuan = resolve(dirname(berkas), sumber)
          const rel = relative(dirModul, tujuan)
          if (rel.startsWith('..')) {
            pelanggaran.push(`${lokasi}: impor relatif "${sumber}" keluar dari modul "${modul}"`)
          }
        } else if (sumber === '@petshop/hris-db') {
          pelanggaran.push(`${lokasi}: "@petshop/hris-db" berisi semua tabel — impor @petshop/hris-db/schema/${modul}`)
        } else if (sumber.startsWith('@petshop/hris-db/schema/')) {
          const milik = sumber.slice('@petshop/hris-db/schema/'.length)
          if (milik !== modul && milik !== 'shared') {
            pelanggaran.push(`${lokasi}: tabel modul "${milik}" tidak boleh diakses modul "${modul}" — minta lewat @/modules/${milik}`)
          }
        }
      }
    }
  }
  return pelanggaran
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2] ? resolve(process.argv[2]) : BAWAAN
  const pelanggaran = findViolations(dir)
  if (pelanggaran.length > 0) {
    console.error(`\n  Pelanggaran batas modul (${pelanggaran.length}):`)
    for (const p of pelanggaran) console.error(`  x ${p}`)
    console.error('\n  Lihat apps/hris/modules/README.md.\n')
    process.exit(1)
  }
  console.log('Batas modul HRIS rapi.')
}
