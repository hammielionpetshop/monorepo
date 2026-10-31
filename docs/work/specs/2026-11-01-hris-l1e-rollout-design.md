# Spec HRIS L1e — Kesiapan Staging dan Rilis

Tanggal: 2026-11-01 · Status: **tayang staging (mode central) — owner menyatakan uji sesuai 2026-11-01, kandidat `426bea3d`; produksi belum disentuh**
Induk: [spec L1](2026-10-29-hris-l1-auth-design.md) §6–§7 · Runbook: [auth-pusat](../../ops/auth-pusat.md)

## Yang dikerjakan

- `infra/staging/docker-compose.yml`: env auth untuk `bo-staging` dan `hris-staging`.
  Bawaan `BO_AUTH_MODE=legacy`, sehingga deploy staging tidak mengubah cara login.
  `AUTH_COOKIE_ENV` ditulis tetap `staging` (tidak bisa diisi dari luar).
- `infra/staging/check-env.mjs`: pada mode `central` menolak domain cookie selain
  `.staginghml.my.id`, origin non-https atau di luar `staginghml.my.id`, origin backoffice = HRIS,
  rahasia pendek, saling sama, atau sama dengan `STAGING_JOB_SECRET`. Dijalankan migrator sebelum migrasi.
- Runbook cutover dan rollback: `docs/ops/auth-pusat.md`.
- Uji rollback dengan perubahan akun/kredensial nyata sudah ada (L1c, 16 tes adapter lulus pada DB lokal).

## Mengaktifkan mode central di staging (setelah L1d terintegrasi ke staging)

Di `.env` server staging, mode 600, rahasia baru khusus staging:

```text
STAGING_BO_AUTH_MODE=central
STAGING_AUTH_COOKIE_DOMAIN=.staginghml.my.id
STAGING_BO_ORIGIN=https://<domain backoffice staging>
STAGING_HRIS_ORIGIN=https://<domain HRIS staging>
STAGING_BO_CSRF_SECRET=<acak ≥32>
STAGING_HRIS_CSRF_SECRET=<acak ≥32, berbeda>
STAGING_HRIS_INTERNAL_KEY=<acak ≥32, berbeda>
```

Lalu deploy. Urutan data sebelum uji: preflight → (persetujuan) backfill → tautan HRIS fixture untuk
akun uji (`packages/auth/scripts/link-hris-fixture.mjs <username> --confirm-fixture`, hanya staging/local).

## Langkah uji owner (matriks spec L1 §7)

Dua PC/profil browser (A dan B) dan satu HP. Catat hasil per baris; kandidat yang diuji dicatat
dengan commit/tag staging.

| # | Langkah | Hasil yang benar |
|---|---|---|
| 1 | PC A login backoffice dengan password; buka HRIS di PC A | Masuk HRIS tanpa login ulang bila akun bertaut HRIS; jika tidak bertaut, pesan "Akses HRIS belum tersedia" |
| 2 | PC A login backoffice dengan PIN; buka HRIS | HRIS meminta password |
| 3 | HP login HRIS; PC A tetap di POS | Keduanya tetap aktif |
| 4 | PC B login backoffice dengan akun kasir yang sama | PC A ditolak pada permintaan berikutnya; HP HRIS tetap aktif |
| 5 | Akun OWNER login di PC A dan B | Keduanya tetap aktif |
| 6 | Keluar dari HRIS (atau backoffice) | Akses di perangkat itu ditolak pada permintaan berikutnya |
| 7 | Nonaktifkan akun / reset password lewat Pengaturan > Pengguna | Sesi akun itu langsung ditolak |
| 8 | Tambah pengguna baru, login pertama | Wajib ganti password; akun muncul sekali (tidak dobel) |
| 9 | Kasir lama: login PIN, pilih cabang, reset PIN | Perilaku bisnis seperti sebelumnya |
| 10 | Kirim login dari halaman lain/origin asing | Ditolak, tanpa kredensial di respons |

Belum dapat dibuktikan tanpa data karyawan (L2): pemulihan mandiri dan layar riwayat.

## Belum diputuskan (memblokir cutover, bukan staging)

Login ulang sekali atau jembatan token lama · domain HRIS produksi · masa stabil sebelum fallback
dilepas · nasib sesi lain saat ganti password normal.
