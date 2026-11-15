#!/usr/bin/env node
/**
 * Jalankan Next.js pada port yang bisa diatur per worktree.
 *
 *   node ../../scripts/next-with-port.mjs 6969 dev --turbopack
 *   node ../../scripts/next-with-port.mjs 6969 start
 *
 * Argumen pertama = port bawaan; sisanya diteruskan apa adanya ke `next`.
 *
 * Urutan penentuan port:
 *   1. env `PORT`
 *   2. baris `PORT=` di `.env.local` app ini
 *   3. port bawaan dari argumen
 *
 * Kenapa perlu pembungkus: port dulu ditulis mati (`next dev -p 6969`), jadi worktree
 * kedua yang menjalankan app yang sama langsung bentrok. `.env.local` tidak bisa
 * diandalkan untuk ini karena Next menentukan port sebelum memuat berkas env-nya,
 * jadi pembacaannya dilakukan di sini — sekali, eksplisit, dan sama di semua OS.
 */
import { spawn } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const [portBawaan, ...argsNext] = process.argv.slice(2)

if (!portBawaan || !/^\d+$/.test(portBawaan) || argsNext.length === 0) {
  console.error('Pemakaian: node scripts/next-with-port.mjs <port-bawaan> <argumen next...>')
  process.exit(1)
}

/** Baca satu kunci dari .env.local milik app (cwd), tanpa memuat dotenv. */
function dariEnvLocal(kunci) {
  const berkas = join(process.cwd(), '.env.local')
  if (!existsSync(berkas)) return undefined
  for (const baris of readFileSync(berkas, 'utf8').split(/\r?\n/)) {
    const m = baris.match(new RegExp(`^\\s*${kunci}\\s*=\\s*(.*?)\\s*$`))
    if (m) return m[1].replace(/^["']|["']$/g, '')
  }
  return undefined
}

const port = process.env.PORT || dariEnvLocal('PORT') || portBawaan

if (!/^\d+$/.test(port)) {
  console.error(`PORT tidak valid: "${port}"`)
  process.exit(1)
}

// Panggil binari next lewat Node langsung supaya tidak bergantung pada shell
// maupun berkas .cmd di Windows.
const require = createRequire(join(process.cwd(), 'package.json'))
let binNext
try {
  binNext = require.resolve('next/dist/bin/next')
} catch {
  console.error('Paket `next` tidak ditemukan. Jalankan `pnpm install` dulu.')
  process.exit(1)
}

const anak = spawn(process.execPath, [binNext, ...argsNext, '-p', port], {
  stdio: 'inherit',
  env: { ...process.env, PORT: port },
})

anak.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
