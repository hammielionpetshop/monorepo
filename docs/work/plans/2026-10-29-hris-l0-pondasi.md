# Plan HRIS L0 — Pondasi

Tanggal: 2026-10-29 · Status: **draf, menunggu persetujuan spec**
Spec: [`../specs/2026-10-29-hris-l0-pondasi-design.md`](../specs/2026-10-29-hris-l0-pondasi-design.md)
Branch kerja: `feat/hris-l0-<bagian>` → PR ke `dev_hris`.

L0 dipecah menjadi 5 bagian. Tiap bagian = satu branch + satu PR kecil, dan selesai kalau kotak
"Bukti selesai"-nya terpenuhi. Centang di sini diperbarui di commit yang sama dengan pekerjaannya.

## L0a — Kerangka package & app

Branch: `feat/hris-l0a-kerangka`

- [ ] `packages/auth`, `packages/hris-db`, `packages/logistik`: `package.json`, `tsconfig.json`,
      `drizzle.config.ts` (`schemaFilter` & `migrations.table` sendiri), `src/index.ts`,
      migrasi `0000` berisi `CREATE SCHEMA`
- [ ] `hris.mesin_jalan` di `packages/hris-db/src/schema/bersama.ts` + migrasi `0001`
- [ ] `apps/hris`: Next 15.5.28 + React 19.1.0, `next.config.ts` (standalone + `outputFileTracingRoot`),
      Tailwind 4, `lib/db.ts`, `api/health`, layout & halaman kosong, port dev 7171
- [ ] Root: `pnpm dev:hris`; `db:migrate` & `db:local:migrate` menjalankan keempat aliran berurutan
- [ ] `scripts/check-migrations.mjs` memeriksa keempat aliran
- [ ] `turbo.json` `globalEnv` + `HRIS_DATABASE_URL`, `MESIN_KUNCI`
- [ ] `docs/agents/claims.md`: kunci migrasi per aliran

**Bukti selesai:** `pnpm typecheck lint test migrations:check` hijau; `pnpm db:local:migrate` membuat
ketiga schema baru di Postgres lokal; `pnpm dev:hris` membuka halaman kosong dan `/api/health` = 200.

## L0b — Pagar batas modul

Branch: `feat/hris-l0b-batas-modul`

- [ ] `apps/hris/eslint.config.mjs`: aturan `no-restricted-imports` (spec §4)
- [ ] `scripts/check-batas-modul.mjs` + dipanggil dari `lint` `apps/hris`
- [ ] Fixture pelanggaran + tes yang memastikan kedua pagar gagal pada fixture itu
- [ ] Kerangka `apps/hris/modules/bersama/{aturan,server,ui,index.ts}` sebagai contoh bentuk modul

**Bukti selesai:** tes pagar hijau; impor dalam ke modul lain membuat `pnpm lint` merah.

## L0c — Role database & CI Postgres

Branch: `feat/hris-l0c-role-db`

- [ ] `infra/db/roles.sql` (idempoten) + `infra/db/apply-roles.mjs` (password dari env)
- [ ] Migrator menjalankan keempat aliran + `roles.sql`; `infra/apps/Dockerfile` stage `deps` &
      `migrator` menyalin manifes/berkas package baru
- [ ] Job CI `migrasi-db` (service `postgres:14`): migrasi di DB kosong → roles → tes integrasi role
- [ ] Tes integrasi: `hris_app` tidak bisa menulis `petshop`; `bo_app` tidak bisa membaca `hris`;
      `stg_*` tidak bisa menyambung ke `petshop_db`
- [ ] Lokal: `db:local:migrate` ikut menjalankan `roles.sql`

**Bukti selesai:** job `migrasi-db` hijau di PR; menjalankan `roles.sql` dua kali tidak gagal.

## L0d — Mesin terjadwal

Branch: `feat/hris-l0d-mesin`

- [ ] `POST /api/mesin/[nama]` dengan `x-kunci-mesin`, pencatatan `mesin_jalan`, 404 untuk nama asing
- [ ] Daftar pekerjaan di `modules/bersama/server/mesin.ts` + pekerjaan `contoh-detak`
- [ ] Tes: kunci salah → 401; nama asing → 404; gagal → baris `GAGAL` dengan galat; ulang → idempoten
- [ ] Service `cron` (alpine) + crontab di `infra/apps/`

**Bukti selesai:** di lokal, `cron` memanggil `contoh-detak` tiap menit dan barisnya tercatat.

## L0e — Deploy produksi (dipagari) & staging

Branch: `feat/hris-l0e-deploy`. **Bagian staging menunggu domain dari owner.**

- [ ] `infra/apps/docker-compose.yml`: service `hris` & `cron` di profil `hris`, `mem_limit`,
      env `HRIS_DATABASE_URL`, volume foto HRIS tertutup
- [ ] `deploy-vps.yml`: matriks + `hris`, `paths` + `apps/hris/**`, migrator baru
- [ ] Caddy: blok `/api/mesin/*` ditolak; blok situs staging dengan `basic_auth` (aktif bila env domain terisi)
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
