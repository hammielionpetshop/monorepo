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
const DEFAULT_MODULES_DIR = join(ROOT, 'apps', 'hris', 'modules')
const SCHEMA_PREFIX = '@petshop/hris-db/schema/'

const IMPORT_PATTERN =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g

function listSourceFiles(dir) {
  const files = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) files.push(...listSourceFiles(path))
    else if (/\.(ts|tsx|mts|js|mjs)$/.test(name)) files.push(path)
  }
  return files
}

export function findViolations(modulesDir) {
  const violations = []
  if (!existsSync(modulesDir)) return violations
  for (const moduleName of readdirSync(modulesDir)) {
    const moduleDir = join(modulesDir, moduleName)
    if (!statSync(moduleDir).isDirectory()) continue
    for (const file of listSourceFiles(moduleDir)) {
      const content = readFileSync(file, 'utf8')
      const location = relative(modulesDir, file).split(sep).join('/')
      for (const match of content.matchAll(IMPORT_PATTERN)) {
        const specifier = match[1] ?? match[2] ?? match[3]
        if (specifier.startsWith('.')) {
          const target = relative(moduleDir, resolve(dirname(file), specifier))
          if (target.startsWith('..')) {
            violations.push(`${location}: impor relatif "${specifier}" keluar dari modul "${moduleName}"`)
          }
        } else if (specifier === '@petshop/hris-db') {
          violations.push(`${location}: "@petshop/hris-db" berisi semua tabel — impor ${SCHEMA_PREFIX}${moduleName}`)
        } else if (specifier.startsWith(SCHEMA_PREFIX)) {
          const owner = specifier.slice(SCHEMA_PREFIX.length)
          if (owner !== moduleName && owner !== 'shared') {
            violations.push(
              `${location}: tabel modul "${owner}" tidak boleh diakses modul "${moduleName}" — minta lewat @/modules/${owner}`,
            )
          }
        }
      }
    }
  }
  return violations
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_MODULES_DIR
  const violations = findViolations(dir)
  if (violations.length > 0) {
    console.error(`\n  Pelanggaran batas modul (${violations.length}):`)
    for (const violation of violations) console.error(`  x ${violation}`)
    console.error('\n  Lihat apps/hris/modules/README.md.\n')
    process.exit(1)
  }
  console.log('Batas modul HRIS rapi.')
}
