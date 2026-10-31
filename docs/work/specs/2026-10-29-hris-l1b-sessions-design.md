---
title: 'Mesin sesi dan kredensial pusat HRIS L1b'
type: feature
created: '2026-10-29'
status: in-review
baseline_commit: 1aa19ddf
context:
  - docs/work/specs/2026-10-29-hris-l1-auth-design.md
  - docs/work/specs/2026-10-29-hris-l1a-accounts-design.md
---

<frozen-after-approval reason="cakupan pelaksanaan L1b untuk review owner">

## Intent

Akun pusat L1a belum memiliki autentikasi atau sesi. Tambahkan layanan server auth
beserta migrasi dan tes PostgreSQL; adapter aplikasi menyusul pada L1c/L1d.

## Batas dan kendala

**Selalu:** token acak kriptografis disimpan sebagai hash; validasi DB memeriksa akun,
sesi, tautan dan akses app. Password argon2; password baru minimal delapan karakter.
Lima kegagalan beruntun mengunci lima menit. Password awal wajib diganti sebelum
akses app. PIN khusus BO, diverifikasi adapter server BO. HRIS memakai password,
idle 30 hari berdasarkan aktivitas HRIS. Takeover hanya mencabut BO; OWNER dikecualikan.
Logout mencabut seluruh akses sesi perangkat. Dokumen/pesan/tes Bahasa Indonesia.

**Persetujuan terpisah:** cutover/domain/aktivasi produksi, umur sesi BO dan sesi lain
saat ganti password normal. Dua kebijakan terakhir wajib menjadi parameter adapter server.

**Dilarang:** cutover runtime/UI, auto-link, FK lintas schema, tulis petshop dari HRIS,
role/bukti PIN dari browser, edit migrasi lama, atau rahasia dalam audit.

## Matriks masukan dan tepi

| Keadaan | Hasil |
|---|---|
| Identifier trim/case | Tepat satu akun; hasil ambigu lintas kolom ditolak |
| Akun tak dikenal/nonaktif/password salah | Gagal seragam, tanpa token |
| Gagal kelima; tepat akhir lock | Jeda lima menit; boleh mencoba pada batas tepat |
| Password awal | Konteks perubahan password saja |
| Dua login BO non-OWNER serentak | Satu akses BO hidup; HRIS lain tetap hidup |
| OWNER dua perangkat | Keduanya hidup |
| BO TAKEN_OVER; bootstrap cookie lama | Tidak bangkit; perlu login eksplisit |
| PIN meminta HRIS | Memerlukan password |
| Ganti akun di browser | Sesi akun sebelumnya dicabut atomik saat login sukses |
| HRIS tepat 30 hari idle | Ditolak; aktivitas BO/bootstrap tidak membangkitkan |
| Logout/reset/nonaktif | Sesi terkait langsung ditolak |
| Putus tautan lalu tautkan ulang | Akses lama tetap tercabut |
| Origin/CSRF salah atau hilang | Tolak sebelum mutasi |
| Insert/audit gagal | Rollback seluruh mutasi |

</frozen-after-approval>

## Peta kode dan task

- [x] `packages/auth/src/schema/accounts.ts`: kolom lockout/waktu kredensial;
  `schema/sessions.ts`: sessions, session_app_access, login_events, audit_events.
- [x] `packages/auth/src/migrations/0002_sessions.sql` dan `meta/`: migrasi aditif.
- [x] `packages/auth/src/sessions.ts`: token, login, validasi, aktivitas, takeover,
  konteks PIN internal, pergantian akun dan logout.
- [x] `packages/auth/src/credentials.ts`: onboarding, password, reset, nonaktif, unlink/audit.
- [x] `packages/auth/src/http.ts`: cookie per lingkungan, HttpOnly/Secure/Lax/Path=/;
  pengecualian Secure hanya lokal eksplisit. Guard Origin cocok persis daftar tepercaya
  dan CSRF terikat konteks, termasuk login.
- [x] `packages/auth/src/index.ts`, `packages/auth/src/schema/index.ts`,
  `packages/auth/package.json`, `pnpm-lock.yaml`: ekspor server dan dependensi argon2.
- [x] `packages/db-roles/tests/auth-sessions.integration.test.mjs`: matriks di atas;
  `auth-accounts.integration.test.mjs`: sesuaikan truncate fixture; `roles.integration.test.mjs`:
  grant tabel baru. Pertahankan tes backfill L1a.
- [x] `docs/work/plans/2026-10-29-hris-l1-auth.md`, spec L1, `docs/work/WIP.md`,
  `apps/backoffice/changelog.d/feat-hris-l1b-sessions.md`: catat hasil faktual.

## Penerimaan dan desain

- Jika akun tertaut aktif, ketika password sah/onboarding selesai, maka akses diterima.
- Jika dua login BO non-OWNER selesai bersamaan, ketika diperiksa, maka satu BO hidup.
- Jika akses tercabut/kedaluwarsa, ketika divalidasi, maka ditolak tanpa bangkit.
- Jika transaksi gagal, ketika rollback, maka akun/sesi/audit tetap konsisten.
- Jika migrasi selesai, ketika tes role/backfill berjalan, maka L1a tetap lulus dan
  order_app tetap ditolak mengakses auth.

Lock akun konsisten untuk semua mutasi; ambil waktu setelah lock. Commit penghitung
gagal meski login ditolak. Akun tak dikenal memakai hash tiruan. Audit memakai allowlist.
OWNER/bukti PIN dari adapter server. Reset/nonaktif mencabut semua sesi. Pemulihan
data karyawan dan layar riwayat tetap L2.

## Verifikasi

`pnpm typecheck` root, `pnpm migrations:check`, `pnpm changelog:check`, lint relevan.
Tes auth/role terarah memakai ROLES_TEST_ADMIN_URL lokal dan DB sintetis sendiri;
uji migrasi kosong, upgrade 0001, pengulangan migrator, batas waktu, konkurensi dengan
koneksi berbeda dan rollback. Jangan reset DB worktree lain. Suite luas lokal dilewati;
CI wajib hijau. Uji browser lintas app mengikuti integrasi L1c/L1d.

## Riwayat perubahan spec

Diturunkan dari plan L1b, kode L1a dan pemeriksaan layanan sesi BO.


## Kontrak pelaksanaan

Layanan menerima koneksi postgres eksplisit; tidak membaca env repo. Data tanggal
normal dikonversi ke Date saat dibandingkan dan ISO saat dikirim ke DB agar parser
string Drizzle tidak melemahkan pemeriksaan expiry. Semua kunci akun diurutkan saat
pergantian konteks dan aksi pelaku terhadap akun lain.

Adapter server wajib menyediakan role lokal dan TTL BO (lebih dari nol, maksimum
30 hari). Batas maksimum teknis mengikuti horizon sesi pusat; nilai rollout tetap
keputusan owner. Password login pusat bertahan paling lama 30 hari sebelum akses
HRIS pertama; sesudah itu aktivitas HRIS memperpanjang akses dan sesi induk bersama.
Konteks onboarding dibatasi 15 menit. PIN-only warisan tetap dapat masuk BO; akun
berpassword awal/reset harus menyelesaikan onboarding sebelum PIN boleh dipakai.

Untuk admin reset/nonaktif/unlink, adapter memberikan role Owner/GM tepercaya dan
token sesi BO pelaku aktif. Perubahan password normal wajib memilih apakah sesi lain
dicabut; token perangkat pemanggil selalu dirotasi. Password awal selesai lewat
password lama dan token onboarding sah; pembukaan akses app menjadi langkah berikutnya.

Adapter mutasi cookie wajib memanggil guard Origin/CSRF sebelum layanan DB. CSRF
mengikat HMAC pada konteks: nonce acak pra-login yang tersimpan dalam cookie HttpOnly,
kemudian token sesi setelah login. Secret minimal 32 karakter berasal dari konfigurasi
server. Gunakan nama cookie per lingkungan dan domain induk eksplisit; helper tidak
menebak domain produksi. Pengujian endpoint/browser mengikuti L1c/L1d.

## Hasil verifikasi lokal

Typecheck root lulus; desktop POS dikecualikan. Tes auth/akun/role memakai PostgreSQL
14 pada container lokal dengan DB sintetis milik tes; migrator auth diuji kosong,
pengulangan dan upgrade dari 0001. Jam deterministik hanya pada wrapper koneksi tes
membuktikan equality lock/expiry tanpa sleep; kunci dan mutasi tetap DB nyata.
48 tes lulus: 25 sesi/HTTP, 16 akun/backfill, dan 7 hak role. Pemeriksaan migrasi dan
changelog lulus; generator Drizzle menyatakan snapshot sesuai schema. Tidak ada lint
khusus yang dikonfigurasi untuk package auth/db-roles. Parser tanggal/JSON dari koneksi
yang sudah dipakai Drizzle juga diuji pada login, validasi expiry dan reset password.
Suite luas lokal dilewati; CI dan integrasi development belum dijalankan tahap ini.
