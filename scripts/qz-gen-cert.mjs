#!/usr/bin/env node
// Buat sepasang kunci untuk tanda tangan QZ Tray. Jalankan SEKALI.
//
//   node scripts/qz-gen-cert.mjs
//
// Menghasilkan (di root repo, keduanya sudah di-.gitignore):
//   qz-private-key.pem          → isinya ke env QZ_PRIVATE_KEY (RAHASIA, jangan commit)
//   qz-digital-certificate.txt  → isinya ke env QZ_CERTIFICATE, DAN dipasang di tiap PC
//                                 pencetak sebagai C:\Program Files\QZ Tray\override.crt
//
// Butuh `openssl` di PATH (tersedia di Git Bash / Linux / macOS).

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const keyPath = resolve(root, 'qz-private-key.pem')
const certPath = resolve(root, 'qz-digital-certificate.txt')

if (existsSync(keyPath) || existsSync(certPath)) {
  console.error(
    'qz-private-key.pem / qz-digital-certificate.txt sudah ada. Hapus dulu kalau memang mau membuat ulang.\n' +
      'PERINGATAN: mengganti kunci berarti override.crt di semua PC pencetak harus diganti juga.'
  )
  process.exit(1)
}

try {
  execFileSync(
    'openssl',
    [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha512',
      '-days', '7300',
      '-keyout', keyPath,
      '-out', certPath,
      '-subj', '/CN=Hammielion POS/O=Hammielion',
    ],
    { stdio: ['ignore', 'ignore', 'inherit'] }
  )
} catch (err) {
  console.error('\nGagal menjalankan openssl. Pastikan openssl ada di PATH, atau jalankan manual:\n')
  console.error(
    `  openssl req -x509 -newkey rsa:2048 -nodes -sha512 -days 7300 \\\n` +
      `    -keyout qz-private-key.pem -out qz-digital-certificate.txt \\\n` +
      `    -subj "/CN=Hammielion POS/O=Hammielion"\n`
  )
  process.exit(1)
}

const key = readFileSync(keyPath, 'utf8').trim()
const cert = readFileSync(certPath, 'utf8').trim()

// Env satu baris: newline → \n literal. Endpoint mengembalikannya saat dibaca.
const oneLine = (pem) => pem.replace(/\r?\n/g, '\\n')

console.log('\n✔ Kunci dibuat.\n')
console.log('── Untuk .env / infra/apps/backoffice.env ──────────────────────────────\n')
console.log(`QZ_PRIVATE_KEY="${oneLine(key)}"`)
console.log(`QZ_CERTIFICATE="${oneLine(cert)}"`)
console.log('\n── Di TIAP PC pencetak (sekali) ────────────────────────────────────────\n')
console.log('  1. Salin isi qz-digital-certificate.txt ke:  C:\\Program Files\\QZ Tray\\override.crt')
console.log('  2. Restart QZ Tray (klik kanan ikon tray → Exit, lalu buka lagi).')
console.log('  Setelah itu dialog izin QZ tidak muncul lagi.\n')
