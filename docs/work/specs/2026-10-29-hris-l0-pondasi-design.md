# HRIS L0 — Pondasi (desain teknis)

Tanggal: 2026-10-29 · Status: **draf, menunggu persetujuan owner**
PRD: [`docs/hris_planning/PRD/fase_1/01-arsitektur.md`](../../hris_planning/PRD/fase_1/01-arsitektur.md)
Plan: [`docs/work/plans/2026-10-29-hris-l0-pondasi.md`](../plans/2026-10-29-hris-l0-pondasi.md)

L0 tidak menghasilkan fitur untuk karyawan. Hasilnya adalah **kerangka yang memagari batas modul**,
**role database per app**, **mesin terjadwal**, dan **lingkungan staging**, sehingga L1 (auth) dan
seterusnya tinggal mengisi.

## 1. Fakta repo & server yang membentuk desain ini

| Fakta | Sumber | Akibat |
|---|---|---|
| Satu Dockerfile untuk semua app (`infra/apps/Dockerfile`, `ARG APP_NAME`), stage `deps` hanya menyalin manifes app yang dikenal | Dockerfile | Manifes `apps/hris` & 3 package baru harus ditambah di stage `deps` dan `migrator` |
| Image `migrator` hanya menjalankan `pnpm db:migrate` milik `@petshop/db` | Dockerfile, deploy-vps.yml | Migrator diperluas untuk 4 aliran migrasi + skrip role |
| Deploy produksi = push ke `main` yang menyentuh `apps/`, `packages/`, `infra/apps/` | deploy-vps.yml | Kode HRIS yang masuk `main` ikut terbangun → service `hris` produksi dipagari profil sampai siap |
| Postgres produksi `max_connections = 40`; backoffice & order-web masing-masing pool 10 | `packages/db/src/index.ts`, `apps/*/lib/db.ts` | Anggaran koneksi baru (§6) |
| Satu-satunya role DB = `admin` (superuser), dipakai backoffice & order-web | dicek di VPS 2026-10-29 | Role per app (§5) |
| Caddy produksi memegang port 80/443 | `infra/apps/docker-compose.yml` | Staging menumpang Caddy produksi (§8) |
| Port dev 6969 (backoffice) & 7070 (order-web) dicadangkan | `CLAUDE.md`, `scripts/next-with-port.mjs` | HRIS dev di **7171** |
| `migrations:check` hanya membaca `packages/db/src/migrations` | `scripts/check-migrations.mjs` | Diperluas ke semua aliran (§3) |
| CI tidak punya Postgres | `.github/workflows/ci.yml` | Job baru dengan service Postgres untuk uji migrasi & role (§9) |

## 2. Struktur berkas baru

```
apps/hris/                         # Next.js 15.5.28, React 19.1.0 (sama dengan backoffice)
├── app/
│   ├── (portal)/                  # kosong di L0
│   ├── (kantor)/                  # kosong di L0
│   ├── api/health/route.ts        # dipakai HEALTHCHECK Dockerfile
│   └── api/mesin/[nama]/route.ts  # pintu mesin terjadwal (§7)
├── modules/
│   └── bersama/                   # hanya kerangka mesin terjadwal di L0
│       ├── aturan/  server/  ui/  index.ts
├── lib/db.ts                      # createDb(HRIS_DATABASE_URL), pool dari env
├── eslint.config.mjs  next.config.ts  vitest.config.ts  package.json  tsconfig.json
packages/
├── auth/        # @petshop/auth — schema `auth` (tabel diisi L1), drizzle.config.ts, src/migrations/
├── hris-db/     # @petshop/hris-db — schema `hris`, src/schema/<modul>.ts, src/migrations/
└── logistik/    # @petshop/logistik — schema `logistik` (tabel diisi L6), src/migrations/
infra/db/
├── roles.sql                      # role & GRANT idempoten (§5)
└── apply-roles.mjs                # menjalankan roles.sql dengan password dari env
infra/staging/
├── docker-compose.yml             # project `hammielion-staging` (§8)
└── refresh-db.sh                  # salin petshop_db → petshop_staging
scripts/check-batas-modul.mjs      # pagar batas modul (§4)
```

Nama package mengikuti pola `@petshop/*` yang sudah ada. Semua package tanpa build step
(`main: ./src/index.ts`), sama seperti `@petshop/db`.

## 3. Aliran migrasi

| Aliran | Package | `schemaFilter` | Tabel pencatat migrasi | Isi L0 |
|---|---|---|---|---|
| petshop | `@petshop/db` | `petshop` | `drizzle.__drizzle_migrations` (tetap) | tidak berubah |
| auth | `@petshop/auth` | `auth` | `drizzle.__migrations_auth` | `CREATE SCHEMA auth` |
| hris | `@petshop/hris-db` | `hris` | `drizzle.__migrations_hris` | `CREATE SCHEMA hris` + tabel `mesin_jalan` (§7) |
| logistik | `@petshop/logistik` | `logistik` | `drizzle.__migrations_logistik` | `CREATE SCHEMA logistik` |

- Urutan jalan selalu: **petshop → auth → logistik → hris → roles.sql**. View `hris` membaca
  `petshop`/`logistik`, jadi `hris` paling akhir; GRANT terakhir supaya mengenai objek terbaru.
- `pnpm db:migrate` root menjalankan keempatnya berurutan; `db:local:migrate` juga.
- `migrations:check` diperluas: pemeriksaan yang sama (journal ↔ berkas, idx berurutan) untuk tiap
  aliran.
- Kunci migrasi di `docs/agents/claims.md` menjadi **satu kunci per aliran**.

## 4. Pagar batas modul

Ditegakkan dua lapis, keduanya jalan di `pnpm lint` (CI):

1. **ESLint `no-restricted-imports`** di `apps/hris`:
   - Dilarang mengimpor `@/modules/<x>/<apa pun selain index>` dari mana pun.
   - Antarmodul hanya lewat `@/modules/<x>` (berkas `index.ts`).
   - Dari `@petshop/hris-db`, modul hanya boleh mengimpor schema miliknya:
     `@petshop/hris-db/schema/<modulnya>` (+ `bersama` untuk tabel bersama).
2. **`scripts/check-batas-modul.mjs`**: memindai `apps/hris/modules/**` dan menolak impor relatif
   yang keluar dari folder modulnya (`../../<modul lain>`), hal yang tidak bisa ditangkap pola
   ESLint. Dijalankan sebagai skrip `lint` tambahan di `apps/hris/package.json`.
3. Tes: satu berkas contoh pelanggaran di `scripts/__fixtures__/` memastikan keduanya benar-benar
   gagal (tes untuk pagar itu sendiri).

Akses data lintas modul **selalu lewat fungsi** di `index.ts` modul pemilik, tidak pernah lewat tabel.

## 5. Role database

| Role | Database | Hak |
|---|---|---|
| `admin` | semua | Superuser; hanya migrator & perawatan |
| `bo_app` | `petshop_db` | CRUD semua tabel & sequence `petshop` dan `auth` (+ default privileges untuk tabel baru) |
| `order_app` | `petshop_db` | CRUD semua tabel `petshop` (sama dengan sekarang); dipersempit belakangan setelah daftar tabel order-web dipetakan |
| `hris_app` | `petshop_db` | CRUD `hris`, `logistik`, `auth`; **SELECT saja** pada tabel `petshop` yang dibaca view (daftar eksplisit di `roles.sql`) |
| `stg_bo_app`, `stg_hris_app`, `stg_order_app` | `petshop_staging` | Sama seperti padanannya, tetapi hanya di `petshop_staging` |

- `REVOKE CONNECT ON DATABASE petshop_db FROM PUBLIC`, lalu `GRANT CONNECT` hanya ke role produksi;
  hal yang sama untuk `petshop_staging`. Role staging **tidak bisa** menyambung ke `petshop_db`.
- `roles.sql` **idempoten** (cek `pg_roles` sebelum `CREATE ROLE`; `GRANT` aman diulang) dan
  dijalankan migrator di **setiap** deploy, setelah keempat aliran migrasi.
- Password role tidak pernah ada di repo: `apply-roles.mjs` membacanya dari env migrator
  (`BO_APP_DB_PASSWORD`, `ORDER_APP_DB_PASSWORD`, `HRIS_APP_DB_PASSWORD`, `STG_*`) dan menyetelnya
  dengan `ALTER ROLE … PASSWORD`. Role yang password-nya kosong di env dilewati.
- **Pemindahan app ke role-nya** (ganti `DATABASE_URL`) dilakukan **di staging dulu**, lalu
  produksi satu app per deploy: order-web → backoffice. Jalan kembali: kembalikan `DATABASE_URL` ke
  `admin` (role baru tidak menghapus apa pun).
- Tes integrasi (CI, §9): `hris_app` gagal `INSERT` ke `petshop.*`; `bo_app` gagal `SELECT` dari
  `hris.*`; `stg_*` gagal menyambung ke `petshop_db`.

## 6. Anggaran koneksi (`max_connections = 40`, tidak diubah)

| Pemakai | Pool | Env |
|---|---|---|
| backoffice | 10 | `DB_POOL_MAX` (sudah ada) |
| order-web | 6 | `DB_POOL_MAX` (turun dari 10; trafik portal kecil) |
| hris | 8 | `DB_POOL_MAX` |
| backoffice-staging | 3 | `DB_POOL_MAX` |
| hris-staging | 3 | `DB_POOL_MAX` |
| cadangan (migrator, psql, refresh staging) | 10 | — |

Menaikkan `max_connections` butuh restart Postgres produksi, jadi dihindari. Angka di atas bisa
diubah lewat env tanpa build ulang.

## 7. Mesin terjadwal

- Tabel `hris.mesin_jalan`: `id`, `nama`, `mulai`, `selesai`, `status` (`JALAN|BERHASIL|GAGAL`),
  `ringkasan` (jsonb), `galat` (text). Tidak pernah dihapus.
- Route `POST /api/mesin/[nama]`: memeriksa header `x-kunci-mesin` = env `MESIN_KUNCI`, mencatat
  baris `JALAN`, menjalankan pekerjaan terdaftar, lalu menutup barisnya dengan `BERHASIL`/`GAGAL`.
  Nama yang tidak terdaftar → 404. Setiap pekerjaan wajib idempoten.
- Daftar pekerjaan ada di `modules/bersama/server/mesin.ts`; L0 hanya mendaftarkan `contoh-detak`
  (mencatat detak, tanpa efek lain) untuk membuktikan jalurnya.
- **Pemicu**: service `cron` kecil (image `alpine`, `crond` + `curl`, RAM beberapa MB) di compose,
  memanggil `http://hris:3000/api/mesin/<nama>` di jaringan internal. Caddy **menolak**
  `/api/mesin/*` dari luar.
- Pemberitahuan ke Owner/GM saat gagal menunggu modul Pemberitahuan (L2). Sampai saat itu,
  kegagalan cukup tercatat di tabel dan log container.

## 8. Deploy & staging

### Produksi
- Service `hris` di `infra/apps/docker-compose.yml` dengan **profil `hris`** (seperti WAHA): ikut
  terbangun, tetapi **tidak dinyalakan** di produksi sampai owner memutuskan HRIS siap. `mem_limit`
  diset (usulan awal 512m). Service `cron` ikut profil `hris`.
- Matriks build di `deploy-vps.yml` ditambah `hris`. Migrator membawa keempat aliran + `roles.sql`.
- `paths` pemicu deploy tetap; `apps/hris/**` ditambahkan.

### Staging
- Direktori VPS `/srv/hammielion-staging`, project compose `hammielion-staging`, berkas
  `infra/staging/docker-compose.yml`:
  - Service `bo-staging`, `hris-staging`, `cron-staging`, `migrator-staging` (profil `tools`).
  - **Tanpa Postgres & Caddy sendiri**: tersambung ke jaringan produksi `hammielion_default`
    sebagai `external network`, memakai Postgres produksi dengan database `petshop_staging`.
  - Volume upload/foto staging terpisah dari produksi.
  - `mem_limit` per service (usulan: 384m backoffice, 384m hris).
- **Caddy produksi** mendapat blok situs staging dari env `DOMAIN_STAGING_BACKOFFICE` dan
  `DOMAIN_STAGING_HRIS` (domain khusus staging, ❓ menunggu owner), plus `basic_auth` sebagai gerbang
  tambahan karena isinya data produksi. Bila env domain staging kosong, blok itu tidak aktif.
- **Workflow `deploy-staging.yml`**: push ke branch `staging` → build image bertanda `staging-<sha>`
  → salin compose staging → migrator-staging (keempat aliran + `roles.sql` untuk `petshop_staging`)
  → restart project staging → gerbang sehat. Concurrency group sendiri; tidak menyentuh
  `/srv/hammielion`.
- **`refresh-db.sh`** (dijalankan manual di VPS): `pg_dump -Fc petshop_db | pg_restore` ke
  `petshop_staging` yang dibuat ulang, lalu jalankan `roles.sql` untuk staging. Tidak pernah menulis
  ke `petshop_db`.

## 9. CI

- Script root `typecheck`, `lint`, `test` otomatis mencakup `apps/hris` dan package baru (turbo).
- `turbo.json`: tambah env `HRIS_DATABASE_URL`, `MESIN_KUNCI` ke `globalEnv`.
- **Job baru `migrasi-db`** dengan service `postgres:14`: jalankan keempat aliran migrasi di DB
  kosong, `roles.sql`, lalu tes integrasi role (§5) dan tes "view tidak patah". Ini juga jaring
  pengaman saat backoffice mengubah kolom yang dibaca view HRIS.
- CI dipicu juga oleh PR ke `dev_hris` dan `staging` (sudah, karena `pull_request` tanpa filter).

## 10. Pengembangan lokal

- `pnpm dev:hris` → port 7171. `.env.local` HRIS memakai `HRIS_DATABASE_URL` ke Postgres lokal
  (5433). `worktree:new` diperluas menyalin `apps/hris/.env.local` dan menulis ulang URL-nya.
- `db:local:migrate` menjalankan keempat aliran + `roles.sql` (password lokal dari `.env`).

## 11. Yang sengaja tidak dikerjakan di L0

- Isi tabel `auth` (L1), tabel modul HRIS (L2 dst.), view ke `petshop` (dibuat bersama modul yang
  memakainya), komponen UI selain halaman kosong & layout dasar.
- Memindah backoffice/order-web ke role baru **di produksi** — disiapkan & diuji di staging pada L0,
  dieksekusi di produksi sebagai langkah terpisah setelah owner setuju.

## 12. Pertanyaan terbuka

- ❓ Domain staging (dibeli owner). Bagian staging menunggu ini; bagian lain L0 tidak.
- ❓ `mem_limit` awal: 512m untuk HRIS produksi, 384m per service staging. Disetel ulang setelah
  diukur.
