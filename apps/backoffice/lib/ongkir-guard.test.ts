import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// Penjaga mesin ongkir (permintaan owner 2026-10-12): aturan & tampilan ongkir hanya boleh ada
// di lib/ongkir.ts (+ bagian servernya). Tes ini gagal bila kode lain mengenali ongkir lewat
// teks jenis produknya sendiri, atau menulis teks struk gratis ongkir sendiri — supaya tidak
// ada lagi tempat yang tertinggal saat aturan ongkir berubah (seperti rumus laporan dulu).
const ROOT = join(__dirname, '..')
const SCAN = ['app', 'lib', 'components']
const ALLOWED = new Set(['lib/ongkir.ts', 'lib/ongkir-server.ts', 'lib/product-kind.ts', 'lib/receipt-lines.ts'])
const FORBIDDEN: [RegExp, string][] = [
  [/['"`]JASA_ONGKIR['"`]/, "teks jenis 'JASA_ONGKIR' (pakai ONGKIR_KIND / isOngkirKind dari lib/ongkir)"],
  [/GRATIS ONGKIR/, 'teks struk "GRATIS ONGKIR" (pakai ongkirReceiptRows dari lib/ongkir)'],
  [/Anda hemat/, 'teks "Anda hemat" (pakai savingsText dari lib/receipt-lines)'],
]

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

describe('penjaga mesin ongkir', () => {
  it('tidak ada kode di luar lib/ongkir.ts yang mengenali atau mencetak ongkir sendiri', () => {
    const violations: string[] = []
    for (const top of SCAN) {
      for (const file of sourceFiles(join(ROOT, top))) {
        const rel = relative(ROOT, file).replace(/\\/g, '/')
        if (ALLOWED.has(rel)) continue
        const text = readFileSync(file, 'utf8')
        for (const [pattern, what] of FORBIDDEN) {
          if (pattern.test(text)) violations.push(`${rel}: ${what}`)
        }
      }
    }
    expect(violations).toEqual([])
  })
})
