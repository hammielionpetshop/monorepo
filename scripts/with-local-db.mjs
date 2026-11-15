#!/usr/bin/env node
/**
 * Jalankan sebuah perintah dengan DATABASE_URL diarahkan ke Postgres lokal (Docker).
 *
 *   node scripts/with-local-db.mjs pnpm --filter @petshop/db db:migrate
 *
 * Kenapa perlu pembungkus ini: `.env` di root berisi URL PRODUKSI, dan drizzle-kit
 * maupun skrip seed membacanya lewat dotenv. Menyetel DATABASE_URL sebelum perintah
 * jalan membuat dotenv tidak menimpanya (dotenv tidak pernah menimpa env yang sudah ada),
 * sehingga seluruh perkakas DB otomatis menunjuk ke lokal tanpa mengubah `.env`.
 *
 * Palangnya: perintah ditolak kalau URL yang terpakai ternyata bukan host lokal.
 * Skrip seed melakukan TRUNCATE, jadi salah arah sekali saja sudah fatal.
 */
import { spawn } from 'node:child_process'

export const LOCAL_DATABASE_URL =
  process.env.LOCAL_DATABASE_URL ?? 'postgresql://petshop:petshop@localhost:5433/petshop_db'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])

export function assertLocal(url) {
  let host
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error(`DATABASE_URL tidak bisa dibaca sebagai URL: ${url}`)
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Ditolak: DATABASE_URL menunjuk ke "${host}", bukan database lokal.\n` +
        'Skrip ini hanya untuk Postgres lokal (Docker). Untuk produksi, jalankan perintahnya langsung.',
    )
  }
  return host
}

const [command, ...args] = process.argv.slice(2)
if (!command) {
  console.error('Pemakaian: node scripts/with-local-db.mjs <perintah> [argumen...]')
  process.exit(1)
}

try {
  assertLocal(LOCAL_DATABASE_URL)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

console.log(`→ DATABASE_URL diarahkan ke lokal (${new URL(LOCAL_DATABASE_URL).host})`)

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, DATABASE_URL: LOCAL_DATABASE_URL },
})

child.on('exit', (code) => process.exit(code ?? 1))
child.on('error', (error) => {
  console.error(`Gagal menjalankan "${command}": ${error.message}`)
  process.exit(1)
})
