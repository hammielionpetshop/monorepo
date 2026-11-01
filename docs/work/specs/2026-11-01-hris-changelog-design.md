# Spec HRIS — Apa yang baru & tanda Baru

Tanggal: 2026-11-01 · Status: **disetujui owner 2026-11-01 (usulan di percakapan: "ok kerjakan"); terintegrasi ke dev_hris dan staging; lolos uji owner di staging 2026-11-01 (deployment `167e9e52`)**
Permintaan owner: "saya ingin ada change log seperti applikasi kasir (POS) dan juga ada tag baru, untuk setiap
update ... agar tidak lupa ketika setiap update". Padanan v3: BER-L11 "Apa yang baru" dan pengaturan
"Tanda Baru tampil 7 hari" (BER §8). Aliran migrasi: `hris` 0004 (isi awal pengaturan saja).

## 1. Batas

**Dikerjakan:**
- Changelog HRIS terpisah dari kasir: potongan `apps/hris/changelog.d/<branch>.md`, hasil rilis
  `apps/hris/CHANGELOG.md`. Potongan HRIS yang selama ini di `apps/backoffice/changelog.d/` disatukan menjadi
  satu potongan berbahasa pengguna dan dihapus dari kasir. `feat-hris-l2d-accounts.md` tetap di kasir karena
  isinya perubahan backoffice (pintu akses kasir).
- Halaman **Apa yang baru** `/apa-yang-baru` (menu Sistem, semua orang): bagian "Sedang diuji" dari potongan yang
  belum dirilis (hanya ada di dev_hris/staging; di main potongan sudah digabung saat rilis), lalu versi yang
  sudah rilis. Berkas ikut bundel lewat `outputFileTracingIncludes`.
- Tanda **Baru**: `apps/hris/lib/new-features.ts` (kunci = href menu atau `fitur/...`, nilai = tanggal WIB),
  komponen `NewBadge`, titik di bilah bawah HP dan di tombol Menu bila menu baru ada di dalamnya.
  Lama tampil = pengaturan bertanggal `shared.new_badge_days` (isi awal 7 hari, Pemilik/GM).
- Tanggal tanda Baru = tanggal tayang staging selama HRIS belum rilis; diganti tanggal rilis produksi di
  branch rilis.
- `pnpm changelog:release <versi> --app hris` untuk rilis HRIS (rilis pertama 0.1.0).
- **Supaya tidak lupa:** `pnpm changelog:check` (juga di `check:candidate`) memvalidasi potongan kedua aplikasi
  dan **gagal** bila branch kerja mengubah `apps/hris` (selain tes/changelog) tanpa
  `apps/hris/changelog.d/<branch>.md`. Dilewati di main/staging/dev_hris/release dan HEAD terlepas (CI).
- Aturan tertulis di `AGENTS.md` lewat branch aturan terpisah `docs/hris-changelog-rule` (dasar `origin/main`,
  integrasi staging, PR ke main).

**Tidak dikerjakan:** catatan rilis per jabatan dan tanda Baru per layar dari database (v3 `catatan_rilis`);
pengumuman ke karyawan (Papan, menyusul).

## 2. Tes

- Unit: pembaca changelog (versi/bagian/butir anak/sambungan), gabung potongan, teks tebal tanpa HTML mentah,
  potongan nyata terbaca; tanda Baru tampil `tanggal ≤ hari ini < tanggal + lama`; daftar tanda Baru hanya
  memuat menu yang ada atau `fitur/...`.
- DB/layanan: isi awal `shared.new_badge_days` ikut tes H18 yang sudah ada.
- Skrip: `--check` gagal tanpa potongan HRIS (dibuktikan manual), `--app hris --dry-run` menghasilkan 0.1.0.
- Uji owner di staging: menu Apa yang baru, tanda Baru di menu Pengaturan/Pengaturan Jabatan/Apa yang baru,
  di dialog Akses kasir dan kartu Izin tugas lapangan, titik di HP, dan ubah "Tanda Baru tampil".
