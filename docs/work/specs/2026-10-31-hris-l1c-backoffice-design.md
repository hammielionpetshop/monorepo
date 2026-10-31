---
title: 'Integrasi backoffice dengan sesi pusat HRIS L1c'
type: feature
created: '2026-10-31'
status: draft
baseline_commit: 2302f88b
context:
  - docs/work/specs/2026-10-29-hris-l1-auth-design.md
  - docs/work/specs/2026-10-29-hris-l1b-sessions-design.md
---

<frozen-after-approval reason="cakupan pelaksanaan L1c untuk review owner">

## Intent

Layanan sesi/kredensial pusat L1b belum dipakai aplikasi. Pasang adapter server di
backoffice dengan mode `legacy` (perilaku sekarang, default) dan `central` (sesi pusat),
tanpa mengubah antarmuka `verifyAccessToken` bagi 97 pemanggilnya. Tidak ada migrasi,
tidak ada perubahan HRIS (L1d), dan mode `central` tidak diaktifkan oleh pekerjaan ini.

## Keputusan owner (2026-10-31)

- Umur akses backoffice mode `central`: **30 hari** (maksimum teknis L1b).
- Ganti password normal: **sesi perangkat lain wajib dicabut**; token perangkat pemanggil dirotasi.
- Uji owner L0, L1a, L1b dinyatakan lulus.
- Cutover: **login ulang satu kali** (default usulan; jembatan token lama tidak dibangun).
  Owner masih dapat mengubahnya sebelum cutover; menambah jembatan = pekerjaan terpisah.

## Batas dan kendala

**Selalu:** mode dibaca dari env, konsisten per proses, dan `central` gagal keras saat boot
bila konfigurasi tidak lengkap (koneksi auth, secret CSRF ≥ 32 karakter, nama/domain cookie,
daftar origin tepercaya). Mode `legacy` tidak boleh menyentuh tabel auth. Peran, izin, dan
cabang tetap dihitung server backoffice dari tabel petshop; JWT lokal tetap diterbitkan
backoffice. Mutasi cookie memanggil guard Origin/CSRF sebelum layanan DB. Pesan error generik
tidak membocorkan keberadaan akun. Pesan, komentar, dan tes Bahasa Indonesia.

**Dilarang:** auto-link akun, mengganti token lama menjadi id sesi pusat, menyentuh
`apps/hris`, migrasi baru, menebak domain produksi, mengaktifkan `central` di produksi,
menulis password lintas dua sumber tanpa transaksi, mengedit migrasi lama.

## Matriks masukan dan tepi

| Keadaan | Hasil |
|---|---|
| Mode `legacy` | Perilaku identik dengan sekarang; tes regresi lama lulus |
| `central`, konfigurasi tidak lengkap | Proses menolak berjalan dengan pesan jelas |
| `central`, token lama tanpa sesi pusat | Ditolak; pengguna login ulang |
| `central`, JWT kedaluwarsa, sesi pusat dicabut | Tidak ada akses; tidak bangkit dari cookie |
| Login password sah, akun tertaut | Sesi pusat + JWT lokal; onboarding bila `must_change_password` |
| Login PIN / nomor staf | PIN diverifikasi BO, `startVerifiedPinSession`; HRIS tetap minta password |
| Akun BO tanpa akun pusat / tanpa tautan | Gagal dengan pesan jelas, tanpa auto-link |
| Dua login non-OWNER serentak | Satu akses backoffice hidup |
| OWNER dua perangkat | Keduanya hidup |
| Bootstrap dari cookie pusat, akses `TAKEN_OVER` | Tidak bangkit; arahkan ke login eksplisit |
| Bootstrap, tanpa tautan backoffice | 403 jelas, tanpa loop redirect |
| Logout (dashboard, POS, idle) | `logoutSession` pusat di mode `central`; cookie dibersihkan |
| `session-ended` di mode `central` | Hapus cookie JWT dan cookie sesi pusat; tanpa loop |
| Ganti password normal | Sesi perangkat lain dicabut, token pemanggil dirotasi |
| Reset/nonaktif/putus tautan lewat UI Pengguna | Sesi terkait langsung ditolak (`resetPassword`, `deactivateAccount`, `revokeAccountLink`) |
| Password diganti di mode `central` lalu kembali `legacy` | Password sama dapat dipakai di kedua mode |
| Pilih cabang | JWT ditandatangani ulang dengan referensi sesi pusat yang sama |
| Origin/CSRF salah atau hilang pada mutasi | Ditolak sebelum DB |
| Insert/audit gagal | Rollback; tidak ada sesi separuh |

</frozen-after-approval>

## Peta kode dan task

- [ ] `apps/backoffice/lib/central-auth.ts`: konfigurasi mode, koneksi `postgres` auth,
  kebijakan backoffice (`role`, `ttlMs` 30 hari), cookie per lingkungan, helper guard.
- [ ] `apps/backoffice/lib/auth.ts`: `verifyAccessToken` dua mode; middleware tetap tanpa DB.
  JWT membawa referensi sesi pusat; `legacy` tetap memakai `isSessionActive`.
- [ ] `apps/backoffice/app/api/auth/login/route.ts` (+ `session-response.ts`): jalur `central`.
- [ ] `onboarding/route.ts`, `change-pin/route.ts`, jalur ganti password dan reset PIN:
  sinkronkan hash `users` dan `auth.accounts` dalam satu transaksi di mode `central`.
- [ ] `switch-branch/route.ts`: pertahankan referensi sesi pusat saat tanda tangan ulang.
- [ ] `app/api/auth/bootstrap/route.ts` baru + `middleware.ts`: publik, tanpa loop.
- [ ] `app/(dashboard)/layout.tsx`, `app/pos/(authenticated)/layout.tsx`, `idle-logout`,
  `session-ended`: pencabutan di server pada mode `central`.
- [ ] UI/API Pengguna di `settings`: reset password, nonaktif, putus tautan memanggil
  layanan pusat; pastikan pelaku Owner/GM dan token BO pelaku diteruskan.
- [ ] Skrip operator pencabutan sesi untuk rollback (tanpa menyentuh produksi dari laptop).
- [ ] Tes terarah, fragment `apps/backoffice/changelog.d/feat-hris-l1c-backoffice.md`,
  pembaruan plan L1 dan `docs/work/WIP.md`.

## Verifikasi

`pnpm typecheck` root, `pnpm changelog:check`, tes terarah non-UI (dua mode, login serentak,
takeover, bootstrap tanpa loop, sinkron password, rollback ke `legacy`) memakai DB lokal
terisolasi. Tidak ada migrasi, jadi `migrations:check` tidak diperlukan. Uji UI dan lintas
perangkat dilakukan owner di staging dengan mode `central` hanya bila owner meminta;
default tetap `legacy`. Suite luas lokal dilewati.

## Riwayat perubahan spec

Diturunkan dari plan L1c, spec L1/L1b, dan pemeriksaan kode backoffice di `origin/dev_hris`.
