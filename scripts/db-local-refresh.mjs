#!/usr/bin/env node
/**
 * Tarik dump DB produksi dari VPS lalu restore ke Postgres lokal (Docker).
 *
 *   node scripts/db-local-refresh.mjs
 *
 * Prasyarat:
 *   - SSH ke `ubuntu@43.173.8.37` jalan tanpa password (public key sudah terdaftar).
 *   - Container Postgres lokal nyala: `pnpm db:local:up`.
 *   - `docker` tersedia di PATH (Docker Desktop running).
 *
 * Alur:
 *   1. ssh VPS -> sudo docker exec hammielion-postgres-1 pg_dump -U admin -Fc petshop_db
 *      -> simpan ke docs/snapshots/prod-YYYYMMDDHHMM.dump
 *   2. docker exec -i hammielion-db-local pg_restore --clean --if-exists
 *
 * File dump bisa puluhan MB — docs/snapshots/ masuk .gitignore, jangan di-commit.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync, createReadStream, createWriteStream } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { platform } from 'node:os'

function resolveDockerBin() {
  const probe = spawnSync(platform() === 'win32' ? 'where' : 'which', ['docker'], { encoding: 'utf8' })
  if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim().split(/\r?\n/)[0]
  if (platform() === 'win32') {
    const candidates = [
      'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
      'C:\\Program Files\\Docker\\Docker\\resources\\docker.exe',
    ]
    for (const c of candidates) if (existsSync(c)) return c
  }
  throw new Error('Tidak menemukan perintah "docker". Pastikan Docker Desktop sudah berjalan.')
}
const DOCKER = resolveDockerBin()

const VPS_HOST = process.env.VPS_HOST ?? 'ubuntu@43.173.8.37'
const VPS_CONTAINER = process.env.VPS_PG_CONTAINER ?? 'hammielion-postgres-1'
const VPS_DB_USER = process.env.VPS_DB_USER ?? 'admin'
const VPS_DB_NAME = process.env.VPS_DB_NAME ?? 'petshop_db'

const LOCAL_CONTAINER = process.env.LOCAL_PG_CONTAINER ?? 'hammielion-db-local'
const LOCAL_DB_USER = process.env.LOCAL_DB_USER ?? 'petshop'
const LOCAL_DB_NAME = process.env.LOCAL_DB_NAME ?? 'petshop_db'

const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
const dumpPath = resolve(process.cwd(), 'docs/snapshots', `prod-${stamp}.dump`)
mkdirSync(dirname(dumpPath), { recursive: true })

function runToFile(bin, args, outFile) {
  return new Promise((res, rej) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'inherit'] })
    const w = createWriteStream(outFile)
    p.stdout.pipe(w)
    p.on('error', rej)
    p.on('exit', (code) => (code === 0 ? w.end(() => res()) : rej(new Error(`${bin} keluar kode ${code}`))))
  })
}

function runFromFile(bin, args, inFile) {
  return new Promise((res, rej) => {
    const p = spawn(bin, args, { stdio: ['pipe', 'inherit', 'inherit'] })
    createReadStream(inFile).pipe(p.stdin)
    p.on('error', rej)
    p.on('exit', (code) => (code === 0 ? res() : rej(new Error(`${bin} keluar kode ${code}`))))
  })
}

async function main() {
  console.log(`[1/3] Tarik dump produksi via SSH -> ${dumpPath}`)
  await runToFile(
    'ssh',
    [VPS_HOST, `sudo docker exec ${VPS_CONTAINER} pg_dump -U ${VPS_DB_USER} -Fc ${VPS_DB_NAME}`],
    dumpPath,
  )
  const size = statSync(dumpPath).size
  const sizeMb = (size / 1024 / 1024).toFixed(1)
  console.log(`      Selesai: ${sizeMb} MB`)
  if (size < 100 * 1024) {
    throw new Error(`Dump terlalu kecil (${sizeMb} MB) — kemungkinan gagal`)
  }

  console.log(`[2/3] Pastikan container lokal "${LOCAL_CONTAINER}" nyala (${DOCKER})`)
  const ps = spawnSync(DOCKER, ['ps', '--filter', `name=${LOCAL_CONTAINER}`, '--format', '{{.Names}}'], {
    encoding: 'utf8',
  })
  if (ps.error) throw new Error(`Gagal panggil docker: ${ps.error.message}`)
  if (ps.status !== 0) throw new Error(`docker ps keluar kode ${ps.status}: ${ps.stderr ?? ''}`)
  if (!(ps.stdout ?? '').includes(LOCAL_CONTAINER)) {
    throw new Error(`Container "${LOCAL_CONTAINER}" tidak nyala. Jalankan "pnpm db:local:up" dulu.`)
  }
  console.log(`      OK, nyala`)

  console.log(`[3/3] Restore ke lokal (${LOCAL_DB_NAME}) — bisa 1–3 menit`)
  await runFromFile(
    DOCKER,
    [
      'exec', '-i', LOCAL_CONTAINER,
      'pg_restore',
      '--clean', '--if-exists',
      '--no-owner', '--no-acl',
      '-x',
      '-U', LOCAL_DB_USER,
      '-d', LOCAL_DB_NAME,
    ],
    dumpPath,
  )
  console.log(`\n✓ Selesai. DB lokal sekarang berisi salinan produksi per ${stamp}.`)
}

main().catch((e) => {
  console.error(`\n✗ GAGAL: ${e.message}`)
  process.exit(1)
})
