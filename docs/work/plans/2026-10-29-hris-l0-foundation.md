# Plan HRIS L0 — Pondasi

Tanggal: 2026-10-29 · Status: **disetujui, L0a berjalan**
Spec: [`../specs/2026-10-29-hris-l0-foundation-design.md`](../specs/2026-10-29-hris-l0-foundation-design.md)
Branch kerja: `feat/hris-l0<x>-<part>` → PR ke `dev_hris`.

L0 dipecah menjadi 5 bagian. Tiap bagian = satu branch + satu PR kecil, dan selesai kalau kotak
"Bukti selesai"-nya terpenuhi. Centang di sini diperbarui di commit yang sama dengan pekerjaannya.

## L0a — Kerangka package & app

Branch: `feat/hris-l0a-scaffold`

- [x] `packages/auth`, `packages/hris-db`, `packages/logistics`: `package.json`, `tsconfig.json`,
      `drizzle.config.ts` (`schemaFilter` & `migrations.table` sendiri), `src/index.ts`,
      migrasi `0000` berisi `CREATE SCHEMA`
- [x] `hris.job_runs` di `packages/hris-db/src/schema/shared.ts` (ikut migrasi `0000_init` aliran hris)
- [x] `apps/hris`: Next 15.5.28 + React 19.1.0, `next.config.ts` (standalone + `outputFileTracingRoot`),
      Tailwind 4, `lib/db.ts`, `api/health`, layout & halaman kosong, port dev 7171
- [x] Root: `pnpm dev:hris`; `db:migrate` & `db:local:migrate` menjalankan keempat aliran berurutan
- [x] `scripts/check-migrations.mjs` memeriksa keempat aliran
- [x] `turbo.json` `globalEnv` + `DB_POOL_MAX` (`JOB_SECRET` menyusul di L0d; HRIS memakai `DATABASE_URL` miliknya sendiri, lihat spec §10)
- [x] `infra/apps/Dockerfile` stage `deps` menyalin manifes `apps/hris` & 3 package baru (supaya `--frozen-lockfile` tetap lolos di `main`)
- [x] `scripts/new-worktree.mjs` ikut menyalin `apps/hris/.env.local` (port 7171)
- [x] `docs/agents/claims.md`: kunci migrasi per aliran (ditulis di `main` bersama klaim L0a)

**Bukti selesai:** `pnpm typecheck lint test migrations:check` hijau; `pnpm db:local:migrate` membuat
ketiga schema baru di Postgres lokal; `pnpm dev:hris` membuka halaman kosong dan `/api/health` = 200.

## L0b — Pagar batas modul

Branch: `feat/hris-l0b-module-boundaries`

- [ ] `apps/hris/eslint.config.mjs`: aturan `no-restricted-imports` (spec §4)
- [ ] `scripts/check-module-boundaries.mjs` + dipanggil dari `lint` `apps/hris`
- [ ] Fixture pelanggaran + tes yang memastikan kedua pagar gagal pada fixture itu
- [ ] Kerangka `apps/hris/modules/shared/{rules,server,ui,index.ts}` sebagai contoh bentuk modul

**Bukti selesai:** tes pagar hijau; impor dalam ke modul lain membuat `pnpm lint` merah.

## L0c — Role database & CI Postgres

Branch: `feat/hris-l0c-db-roles`

- [ ] `infra/db/roles.sql` (idempoten) + `infra/db/apply-roles.mjs` (password dari env)
- [ ] Migrator menjalankan keempat aliran + `roles.sql`; `infra/apps/Dockerfile` stage `deps` &
      `migrator` menyalin manifes/berkas package baru
- [ ] Job CI `db-migrations` (service `postgres:14`): migrasi di DB kosong → roles → tes integrasi role
- [ ] Tes integrasi: `hris_app` tidak bisa menulis `petshop`; `bo_app` tidak bisa membaca `hris`;
      `stg_*` tidak bisa menyambung ke `petshop_db`
- [ ] Lokal: `db:local:migrate` ikut menjalankan `roles.sql`

**Bukti selesai:** job `db-migrations` hijau di PR; menjalankan `roles.sql` dua kali tidak gagal.

## L0d — Mesin terjadwal

Branch: `feat/hris-l0d-jobs`

- [ ] `POST /api/jobs/[name]` dengan `x-job-key`, pencatatan `job_runs`, 404 untuk nama asing
- [ ] Daftar pekerjaan di `modules/shared/server/jobs.ts` + pekerjaan `heartbeat`
- [ ] Tes: kunci salah → 401; nama asing → 404; gagal → baris `FAILED` dengan error; ulang → idempoten
- [ ] Service `cron` (alpine) + crontab di `infra/apps/`

**Bukti selesai:** di lokal, `cron` memanggil `heartbeat` tiap menit dan barisnya tercatat.

## L0e — Deploy produksi (dipagari) & staging

Branch: `feat/hris-l0e-deploy`. **Bagian staging menunggu domain dari owner.**

- [ ] `infra/apps/docker-compose.yml`: service `hris` & `cron` di profil `hris`, `mem_limit`,
      env `DATABASE_URL` service hris diisi dari `HRIS_DATABASE_URL` di `.env` VPS, volume foto HRIS tertutup
- [ ] `deploy-vps.yml`: matriks + `hris`, `paths` + `apps/hris/**`, migrator baru
- [ ] Caddy: blok `/api/jobs/*` ditolak; blok situs staging dengan `basic_auth` (aktif bila env domain terisi)
- [ ] `infra/staging/docker-compose.yml`, `infra/staging/refresh-db.sh`, `.github/workflows/deploy-staging.yml`
- [ ] Anggaran koneksi via `DB_POOL_MAX` (spec §6), termasuk order-web turun ke 6
- [ ] Branch `staging` dibuat dari `main`
- [ ] Di VPS: buat `petshop_staging`, isi lewat `refresh-db.sh`, jalankan `roles.sql`
- [ ] Uji di staging: backoffice-staging & order-web memakai role baru (`stg_*`), HRIS-staging hidup
- [ ] Potongan changelog (perubahan infra yang terasa: deploy, pool order-web)

**Bukti selesai:** push ke `staging` tayang otomatis di domain staging; produksi tidak berubah
(service `hris` tidak menyala); `stg_*` terbukti tidak bisa membuka `petshop_db`.

## Sesudah L0

- Pemindahan role **produksi** (order-web → backoffice) sebagai langkah terpisah, setelah owner
  setuju berdasarkan hasil uji staging.
- Lanjut L1 (auth terpusat): spec & plan baru di folder ini.
