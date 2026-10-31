# Auth Pusat — Cutover dan Rollback

Runbook untuk memindahkan login backoffice dari sesi lama (`legacy`) ke akun pusat
(`central`), dan kembali bila perlu. Spesifikasi: `docs/work/specs/2026-10-29-hris-l1-auth-design.md`.
Repo ini publik — **jangan** menulis alamat server, password, atau rahasia di sini.

Masa stabil (keputusan owner 2026-11-01): **30 hari** setelah cutover. Selama itu tabel dan sesi lama, skrip rollback, dan sinkron password dipertahankan. Setelah 30 hari tanpa masalah, pelepasan fallback dan penghapusan jalur legacy diputuskan terpisah dengan persetujuan owner.

Prinsip: mode `central` hanya diaktifkan per lingkungan, serentak untuk backoffice dan HRIS,
setelah backup dan atas persetujuan eksplisit owner. Produksi tidak dijalankan dari laptop.

## Variabel

| Variabel | Backoffice | HRIS | Catatan |
|---|---|---|---|
| `BO_AUTH_MODE` | `legacy` (bawaan) / `central` | — | Satu-satunya saklar login |
| `BO_AUTH_BRIDGE_UNTIL` | waktu ISO, maks 7 hari ke depan; kosong = mati | — | Jembatan token lama (lihat bagian Cutover). Salah ketik/lewat/terlalu jauh = jembatan tertutup |
| `AUTH_COOKIE_ENV` | `staging` / `production` | sama | Bagian nama cookie (`hml_<env>_session`) sehingga staging dan produksi tidak saling terbaca |
| `AUTH_COOKIE_DOMAIN` | domain induk | sama | Staging: `.staginghml.my.id`. Produksi: **diperiksa dari konfigurasi aktual, tidak ditebak** |
| `AUTH_CSRF_SECRET` | ≥ 32 karakter | ≥ 32 karakter, berbeda | Rahasia berbeda per aplikasi |
| `AUTH_TRUSTED_ORIGINS` | origin backoffice | origin HRIS | Hanya origin aplikasi itu sendiri |
| `HRIS_INTERNAL_KEY` | ≥ 32 karakter | (pemanggil L2) | Pintu `/api/internal/hris/*`; tidak pernah lewat domain publik |
| `INTERNAL_ALLOWED_HOSTS` | host internal, mis. `bo-staging:3000` | — | Host publik ditolak 404 |

Di staging semuanya berasal dari `.env` server (`STAGING_*`) lewat `docker-compose.yml` dan
divalidasi `check-env.mjs` sebelum migrasi; lihat `infra/staging/README.md`.

## Prasyarat cutover

1. Backup database sesuai runbook server, hasilnya diperiksa dapat dipulihkan.
2. Migrasi auth `0000`–`0003` sudah diterapkan oleh migrator (bukan dari laptop).
3. Preflight akun (hanya baca) bersih:
   `node packages/auth/scripts/backfill.mjs` di container migrator.
   `canApply: false` atau daftar konflik → **berhenti**, laporkan ke owner; jangan memaksa.
4. Backfill (`... backfill.mjs --apply`) hanya setelah preflight bersih dan disetujui owner.
   Aman diulang; hash argon2 disalin apa adanya, tidak ada password baru yang dibuat.
5. Pengguna PIN-only tetap bisa masuk backoffice dengan PIN; HRIS menuntut password lewat
   jalur resmi (reset Owner/GM). Tidak ada password bawaan diam-diam.
6. Keputusan owner (2026-11-01): jembatan token lama bertenggat — lihat spec L1 §8. Jembatan harus sudah diimplementasikan dan diuji sebelum cutover; tanpa itu semua pengguna login ulang sekali.

## Cutover

1. Umumkan perubahan. Selama jembatan aktif pengguna tidak dipaksa login ulang; HRIS tetap meminta password.
2. Isi variabel di atas, set `BO_AUTH_MODE=central` dan `BO_AUTH_BRIDGE_UNTIL` (waktu cutover + yang dibutuhkan, maks 7 hari; token lama hidup ≤ 1 hari sehingga 2 hari cukup), deploy. Jembatan menerima token lama hanya bila sesi lamanya belum dicabut, user aktif, dan akun pusatnya bertaut serta aktif. Pemegang token lama tetap harus memasukkan password untuk membuka HRIS dan hanya mendapat akses pusat penuh (mis. mengubah akun pusat sebagai pelaku) setelah login ulang.
3. Setelah tenggat lewat (atau saat dikosongkan), token lama ditolak dan pemegangnya login ulang sekali. Jangan memperpanjang tenggat tanpa alasan tertulis.
4. Periksa: login password, login PIN, pilih cabang, onboarding akun baru, logout, dan sesi HRIS.
5. Pantau `auth.login_events` dan galat aplikasi selama jam sibuk pertama.

## Rollback

Membalik env saja **tidak cukup**: sesi yang hidup bisa menghidupkan kembali akses yang
sudah dicabut, dan password yang diganti selama `central` harus tetap berlaku.

1. Backup database.
2. Set `BO_AUTH_MODE=legacy` dan deploy.
3. Laporan dulu: `node packages/auth/scripts/rollback.mjs` (tanpa `--apply`) —
   periksa `passwordHashMismatches`, `activeStateMismatches`, `activeUsersWithoutLink`.
4. Terapkan: `node packages/auth/scripts/rollback.mjs --apply` — mencabut semua sesi pusat
   dan legacy, menyalin hash password dari akun pusat ke tabel lama. Aman diulang.
5. Beri tahu semua pengguna untuk login ulang.
6. Jangan menghapus tabel `auth.*` sampai masa stabil lewat dan ada persetujuan terpisah.

Bukti otomatis: tes `rollback ke legacy` (`apps/backoffice/lib/central-adapter.integration.test.ts`)
mengubah password dan status akun nyata saat `central`, lalu memastikan fallback memakainya.

## Yang tidak boleh

- Refresh DB staging, migrasi/seed produksi dari laptop, atau mengaktifkan HRIS produksi
  sebagai bagian verifikasi.
- Memakai cookie, domain, atau rahasia produksi di staging (dan sebaliknya).
- Menghapus akun atau sesi untuk "memperbaiki" kesalahan; koreksi lewat nonaktif/reset/cabut tautan.
