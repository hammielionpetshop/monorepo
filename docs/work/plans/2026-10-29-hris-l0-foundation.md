# Plan HRIS L0 — Pondasi

Tanggal: 2026-10-29 · Status: **L0a–L0e aktif di staging — menunggu uji coba owner**
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

- [x] `apps/hris/eslint.config.mjs`: aturan `no-restricted-imports` (spec §4) — juga melarang `@petshop/db`
- [x] `scripts/check-module-boundaries.mjs` + dipanggil dari `lint` `apps/hris`; `lib/db.ts` kini hanya mengekspor `db`
- [x] Tes `apps/hris/tests/module-boundaries.test.ts`: fixture dibuat di folder sementara saat tes (tidak di-commit, supaya tidak ikut typecheck/lint)
- [x] `apps/hris/modules/shared/index.ts` + `modules/README.md` (bentuk modul); folder `server/` dst. lahir bersama isinya di L0d

**Bukti selesai:** tes pagar hijau; impor dalam ke modul lain membuat `pnpm lint` merah.

## L0c — Role database & CI Postgres

Branch: `feat/hris-l0c-db-roles`

- [x] `packages/db-roles/src/roles.sql` (idempoten) + `apply-roles.mjs` (password dari env) — dipindah dari `infra/db/` karena butuh dependency `postgres` di image migrator
- [x] Migrator menjalankan keempat aliran + `roles.sql`; `infra/apps/Dockerfile` stage `migrator`
      menyalin package baru & menjalankan `pnpm db:migrate` root (image diuji lokal terhadap DB worktree)
- [x] Job CI `db-migrations` (service `postgres:14`): migrasi di DB kosong → roles → tes integrasi role
- [x] Tes integrasi: `hris_app` tidak bisa membaca/menulis `petshop`; `bo_app` & `order_app` tidak bisa
      membaca `hris`; `stg_*` tidak bisa menyambung ke DB produksi dan sebaliknya (6 tes, lulus lokal;
      uji mutasi: memberi hak berlebih membuat tes merah)
- [x] Lokal: `db:local:migrate` ikut menjalankan `roles.sql`

**Bukti selesai:** job `db-migrations` hijau di PR; menjalankan `roles.sql` dua kali tidak gagal.

## L0d — Mesin terjadwal

Branch: `feat/hris-l0d-jobs`

- [x] `POST /api/jobs/[name]` dengan `x-job-key`, pencatatan `job_runs`, 404 untuk nama asing
- [x] Daftar pekerjaan di `modules/shared/server/jobs.ts` + pekerjaan `heartbeat`
- [x] Tes: kunci salah → 401; nama asing → 404; gagal → baris `FAILED` dengan error; ulang → idempoten
- [x] Service `cron` (alpine) + crontab di `infra/apps/`

**Bukti selesai:** di lokal, `cron` memanggil `heartbeat` tiap menit dan barisnya tercatat.

Verifikasi 2026-10-29: typecheck root, lint HRIS, 18 tes job + batas modul, dan changelog lulus.
Next dev port 7172 + Postgres terisolasi port 55439 membuktikan 401/404/200 dan catatan SUCCEEDED.
Cron Alpine berjalan dengan batas 32 MB; detak otomatis tercatat di database. Pemicu menolak
secret kosong/salah, HTTP 404 dan redirect 302. Tidak ada migrasi baru atau deploy.
Spec pelaksanaan: [`../specs/2026-10-29-hris-l0d-jobs-design.md`](../specs/2026-10-29-hris-l0d-jobs-design.md).

## L0e — Deploy produksi (dipagari) & staging

Branch: `feat/hris-l0e-deploy`. Domain **staginghml.my.id** dan wildcard DNS sudah disiapkan owner.
Subdomain: **bo**, **hris**, **order**. Owner mengizinkan aktivasi dan push pada 2026-10-29;
deployment staging berhasil. HRIS produksi tetap tidak diaktifkan.

- [x] `infra/apps/docker-compose.yml`: service `hris` & `cron` di profil `hris`, `mem_limit`,
      env `DATABASE_URL` service hris diisi dari `HRIS_DATABASE_URL` di `.env` VPS, volume foto HRIS tertutup
- [x] `deploy-vps.yml`: matriks + `hris`, `paths` + `apps/hris/**`, migrator baru;
      salin `infra/apps/cron/` ke VPS (mount `./cron`) dan isi `JOB_SECRET` yang sama pada HRIS & cron
- [x] Caddy: blok `/api/jobs/*` ditolak; fragment staging opsional dengan `basic_auth` dan rollback
- [x] `infra/staging/docker-compose.yml`, `infra/staging/refresh-db.sh`, `.github/workflows/deploy-staging.yml`
- [x] Anggaran koneksi via `DB_POOL_MAX` (spec §6), termasuk order-web turun ke 6
- [x] Branch `staging` dibuat dari `main`, menerima L0a–L0e, dan di-push
- [x] Di VPS: buat `petshop_staging`, isi lewat `refresh-db.sh --bootstrap`, jalankan migrasi & `roles.sql`
- [x] Uji di staging: backoffice-staging & order-web memakai role baru (`stg_*`), HRIS-staging hidup
- [x] Potongan changelog (perubahan infra yang terasa: deploy, pool order-web)

Verifikasi persiapan: typecheck root, 17 tes guard/refresh dan 3 tes gateway lulus;
image HRIS + migrator berhasil dibangun; migrasi keempat aliran dan role berhasil pada
database Docker terisolasi. HRIS container menjawab health 200 sebagai `stg_hris_app`;
role tersebut ditolak membuka `petshop_db`. Caddy diuji: anonim 401, akses sah 200,
upload juga dilindungi, dan job publik 404. Validasi Caddy tanpa fragment juga lulus.
Suite luas tidak dijalankan. Bukti dan urutan review: [`../specs/2026-10-29-hris-l0e-deploy-design.md`](../specs/2026-10-29-hris-l0e-deploy-design.md).

Prasyarat aktivasi pertama: backup; staging env baru; salinan DB; cabut `PUBLIC CONNECT`
produksi (saat pemeriksaan ACL masih bawaan, hanya `admin` digunakan), tanpa mengganti
akun produksi; pasang import dan volume upload pada Caddy dengan recreate Caddy saja.
Panduan: [`../../../infra/staging/README.md`](../../../infra/staging/README.md).

Aktivasi 2026-10-29: [workflow 40829443028](https://github.com/hammielionpetshop/monorepo/actions/runs/40829443028)
hijau. Ketiga domain HTTPS: anonim 401, akses gerbang sah 200, health 200.
Upload uji berhasil ditulis sebagai pengguna app dan hanya dapat dibaca sesudah autentikasi.
Job publik 404 dengan/tanpa autentikasi; heartbeat cron otomatis SUCCEEDED di DB staging.
Ketiga role `stg_*` diuji langsung: dapat masuk staging, ditolak ke `petshop_db`.
Backup produksi tervalidasi; aplikasi dan Postgres produksi tidak direstart, health publik tetap 200.
Yang diubah di produksi hanya ACL CONNECT (PUBLIC dicabut, admin tetap) dan konfigurasi Caddy
dengan image yang sama. Tidak ada migrasi schema produksi. **Menunggu uji coba owner.**

**Bukti selesai:** push ke `staging` tayang otomatis di domain staging; produksi tidak berubah
(service `hris` tidak menyala); `stg_*` terbukti tidak bisa membuka `petshop_db`.

## Sesudah L0

- Pemindahan role **produksi** (order-web → backoffice) sebagai langkah terpisah, setelah owner
  setuju berdasarkan hasil uji staging.
- Lanjut L1 (auth terpusat): spec & plan baru di folder ini.
