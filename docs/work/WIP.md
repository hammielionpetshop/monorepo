# WIP

Last updated: 2026-11-01
Owner: repo session state

## Current Focus

- Backoffice 1.107.101: filter PO/piutang/kasir dan pagination bersama **tayang produksi — uji owner lokal lulus**. PR #56 ter-merge ke main (`a60e0e60`); deploy `41173534906` sukses dan layanan sehat. Backup prarilis tervalidasi.
- Produk: HRIS L0, L1a, L1b lolos uji owner (2026-10-31). HRIS L1c–L1f (adapter sesi pusat backoffice, login HRIS, pintu provisioning, jembatan token lama bertenggat) lolos uji owner di staging mode `central` (2026-11-01, kandidat `d7389479`). **Backoffice 1.107.102 tayang produksi (2026-11-01) dalam keadaan tidak aktif** — PR #62, deploy `41229708059` sukses; backoffice/order-web sehat, migrasi auth 0001–0003 terpasang, tanpa `BO_AUTH_MODE` login tetap `legacy`, tidak ada container HRIS produksi, akun pusat produksi belum di-backfill (0 akun). Backup prarilis tervalidasi. Temuan: Caddy produksi yang berjalan belum memuat blok `/api/internal` (file di disk sudah, container belum direload) — muat ulang Caddy sebelum cutover. Fitur ini **tayang produksi — menunggu cutover**; uji owner atas login produksi belum ada.
- Backoffice: cari nama produk di daftar PO Supplier (`feat/po-product-search`, baris PO menampilkan "cocok: …") dan di Detail Hasil Stock Opname (`feat/so-detail-product-search`, nama/SKU; ringkasan & CSV tetap seluruh SO) — tanpa migrasi; terintegrasi ke staging 2026-11-01 (deploy staging run `41277887917` sukses; check:candidate migrations/changelog/typecheck lulus, 5 tes PO lulus); klaim dilepas. **Tayang staging — menunggu uji owner.** Saat rilis: daftarkan `fitur/po-cari-produk` dan `fitur/so-detail-cari-produk` di `lib/new-features.ts` dengan tanggal produksi WIB. PO Internal belum tercakup (permintaan owner, menyusul).
- Backoffice: pagination Riwayat Shift **tayang produksi 1.107.100 — uji staging owner lulus**. Fondasi HRIS ikut main atas izin owner; layanan HRIS/cron produksi tetap nonaktif.
- Aturan/tooling: development rules sudah terintegrasi ke staging (PR #32), main (PR #33), branch fix shift, dan dev_hris (PR #44). `AGENTS.md` menjadi sumber tunggal; `CLAUDE.md` mengimpornya.

## In Progress

- L1b: layanan sesi/kredensial dan migrasi auth 0002 terintegrasi ke dev_hris dan staging lewat merge lokal; typecheck, migrations/changelog check, dan 25 tes sesi lolos. 1 tes grant di `auth-accounts` tidak bisa jalan di DB lokal tanpa role aplikasi (jalur CI `db-migrations`). Klaim/kunci auth dilepas.
- Rilis 1.107.100 masuk main lewat PR #38 (`df1619f5`), sesudah persiapan staging PR #37 (`d0be34a0`). Tree kandidat identik dengan staging; tiga fragment digabung lewat script.
- CI PR dan main, typecheck root, changelog/migrations check lulus. Owner menyatakan uji shift cocok dan mengizinkan HRIS ikut main. Backup prarilis tervalidasi. Deployment produksi `40863260804` sukses; Backoffice/portal/DB healthy, health publik 200, staging anonim 401 dan job publik 404.
- Planning L1 terintegrasi ke dev_hris melalui PR #42. L1a masuk dev_hris melalui PR #45; 22 tes integrasi akun/role, typecheck dan pemeriksaan migrasi/changelog lulus. Klaim/kunci auth awal melalui PR #43.
- L0 staging tersedia di `bo.staginghml.my.id`, `hris.staginghml.my.id`, `order.staginghml.my.id`; pipeline 40829443028 hijau, tag `staging-08f81aa589c94e75089c389525aec7899081b730`. Role staging terisolasi, upload terlindungi, job publik 404, heartbeat berhasil; detail di `docs/work/plans/2026-10-29-hris-l0-foundation.md`.
- Layanan HRIS/cron produksi belum diaktifkan. Migrasi fondasi auth/logistics/hris dan role sudah diterapkan migrator; akun koneksi aplikasi produksi tidak diganti dan tidak ada seed/koreksi data tambahan.
- Beberapa fitur produksi lama masih menunggu uji owner; daftar rinci ada di backlog tunda, spec terkait, dan changelog. Jangan menyimpulkan sudah diuji dari status deploy hijau.

## Next Actions

- Cutover akun pusat produksi (backfill, `BO_AUTH_MODE=central`, jembatan token, domain `hris.hammielion.com`, muat ulang Caddy) mengikuti `docs/ops/auth-pusat.md` dan butuh persetujuan owner terpisah; masa stabil 30 hari dihitung dari cutover. Lalu L2 dimulai dengan sistem komponen/tampilan dasar HRIS; rencana L2a–L2g ada di `docs/work/plans/2026-11-01-hris-l2.md` (keputusan owner 2026-11-01 sudah diberikan). L2a (komponen dan kerangka tampilan HRIS, halaman acuan `/komponen`) terintegrasi ke dev_hris dan staging — **menunggu uji owner di staging**. L2b (cabang, departemen, jabatan, hak akses per jabatan, layar Cabang & Jabatan dan Hak Akses Jabatan, migrasi hris `0001`) terintegrasi ke dev_hris dan staging 2026-11-01; spec `docs/work/specs/2026-11-01-hris-l2b-access-design.md` disetujui owner; tes unit 13 dan integrasi DB 8 lulus; klaim/kunci `hris` dilepas. **Lolos uji owner di staging (2026-11-01)**: kandidat `ac1ebd42`, deployment staging run `41234424294`; `sundus` dan `fauzan` ditetapkan Pemilik lewat fixture `assign-interim-position`; owner menyatakan layar Cabang & Jabatan dan Hak Akses Jabatan "sudah dicoba, lancar". Belum diuji di layar: menu/halaman tertutup untuk jabatan non-penuh (dicakup tes otomatis). L2c (data induk karyawan: Daftar Karyawan, Tambah Karyawan, Halaman orang, penempatan bertanggal, nonaktif/aktif lagi + akun pusat ikut, izin tugas lapangan, Promosi Training, Profil saya; migrasi hris `0002`, job `employee-status-apply`) terintegrasi ke dev_hris dan staging 2026-11-01; spec `docs/work/specs/2026-11-01-hris-l2c-employees-design.md` disetujui owner (lingkup dipangkas, kode `HML-0001`); tes unit 22 dan integrasi DB 8 (+8 L2b) lulus; klaim/kunci `hris` dilepas. **Lolos uji fungsi owner di staging (2026-11-01)**: kandidat `21959ed6`, deployment staging run `41240547704`; owner menyatakan "sudah dicoba" dan fungsi lancar, lalu meminta poles UI. Poles pertama: ikon menu samping/bawah jadi ikon garis satu warna (`feat/hris-nav-icons`, tanpa dependensi baru). Pematenan tampilan tahap 1 (plan `docs/work/plans/2026-11-01-hris-ui-polish.md`): toggle tema terang/gelap/ikuti perangkat, isi selebar layar, menu berkelompok yang bisa dilipat + tombol Menu di HP (`feat/hris-ui-shell`), dan Hak Akses Jabatan ringkas dua panel (`feat/hris-access-compact`) terintegrasi ke dev_hris dan staging 2026-11-01; tanpa migrasi/API baru; typecheck + 19 tes menu/hak lulus. Temuan owner: menu samping ikut tergulir di halaman panjang → diperbaiki `fix/hris-shell-scroll` (kerangka desktop setinggi layar, hanya isi yang digulir). **Seluruh poles tampilan ini lolos uji owner di staging (2026-11-01)**: owner menyatakan "sudah dicoba dan ok" pada deployment staging `8768cfc8`; klaimnya sudah dilepas dan worktree-nya dibersihkan (branch disimpan). Migrasi mengubah penetapan sementara `sundus`/`fauzan` menjadi karyawan fixture (Pemilik); fixture baru lewat `assign-fixture-employee.mjs`. L2d (Akun & Tautan: buat akun karyawan, tautkan/lepas akun lama, reset password, keluarkan dari perangkat, akses kasir lewat pintu internal backoffice `backoffice-access`, Riwayat Masuk Semua Orang, Perangkat dan riwayat masuk saya; tanpa migrasi) dikode di `feat/hris-l2d-accounts`; spec `docs/work/specs/2026-11-01-hris-l2d-accounts-design.md` disetujui owner 2026-11-01 (lupa password mandiri + kode GM ke L2f, saran role per jabatan ke L2e); klaim path dipublikasikan di staging. Tes integrasi auth 6 + backoffice 6, unit HRIS lulus — **belum terintegrasi**. Setelah terintegrasi, staging perlu `STAGING_HRIS_INTERNAL_KEY` terisi (sudah divalidasi `check-env`) dan `STAGING_BO_AUTH_MODE=central` supaya akses kasir dari HRIS jalan.
- Pemindahan role DB produksi (order-web lalu backoffice) dikerjakan terpisah setelah persetujuan owner berdasarkan hasil staging.
- Sebelum melanjutkan fitur produk, periksa papan klaim terbaru dan backlog tunda owner; jangan mengambil status lama sebagai klaim aktif.

## Open Decisions

- L1 sebelum cutover: owner memutuskan (2026-11-01) jembatan token lama bertenggat (L1f, terintegrasi di dev_hris, belum staging), domain HRIS produksi `hris.hammielion.com`, sesi lain dicabut saat ganti password, dan masa stabil 30 hari. Masih terbuka: umur sesi BO sesudah JWT habis. PIN hanya BO/POS serta HRIS idle 30 hari sudah diputuskan.
- Penanggung minus kas per shift POS sebelum HRIS L4; kolom per kasir bukan sumber yang sudah tersedia.
- Proteksi GitHub dan penguncian gerbang CI/deploy belum dikonfigurasi/diverifikasi dalam pekerjaan aturan ini.

## Deferred / Parked

- Promo P5 (grooming gratis makanan pilihan) belum dimulai; `docs/work/backlog/2026-10-12-promo-otomatis.md`.
- Rekonsiliasi stok/batch lama dan tindak lanjut hitung fisik: `docs/work/backlog/2026-10-03-hasil-rekonsiliasi-stok.md`.
- Keputusan tunda/bahas owner, termasuk kebijakan kas pembayaran hutang internal: `docs/work/backlog/2026-10-11-daftar-tunda-owner.md`. Jangan mengangkat kembali hal yang sengaja ditunda sebelum owner membukanya.
- Validasi cetak pada perangkat asli, konfigurasi OTP sungguhan/WAHA, dan pemeriksaan data produk oleh admin masih memerlukan pihak terkait; cek ulang status sebelum bertindak.
- Temuan Juli (seed permission/RBAC, integrasi kas pelunasan, audit pembayaran supplier, dan polish portal) belum diaudit ulang pada sesi ini; jangan menganggapnya pekerjaan baru atau fakta produksi saat ini. Rujukan: `docs/work/plans/2026-07-13-rbac-manual-role-matrix-verification.md` dan backlog terkait.

## Source Of Truth

- Aturan development: `AGENTS.md`; entry point Claude: `CLAUDE.md`; referensi teknis: `docs/agents/project-reference.md`.
- Klaim/kunci/peta domain: `docs/agents/claims.md` dari staging terbaru.
- Dokumen kerja: `docs/work/README.md`, `docs/work/{specs,plans,backlog}/`.
- HRIS: `docs/hris_planning/PRD/fase_1/README.md`, `docs/work/plans/2026-10-29-hris-l1-auth.md`, `docs/work/specs/2026-10-29-hris-l1a-accounts-design.md`.
- Perubahan produk: `apps/backoffice/CHANGELOG.md` dan fragment `apps/backoffice/changelog.d/`.
- Glosarium: `docs/glosarium-bisnis.md`; staging: `infra/staging/README.md`; perawatan server: `docs/ops/README.md`.

## Notes For New Session

- Rilis 1.107.100 sudah mempertahankan import gerbang dan mount upload staging saat deploy produksi. Konfigurasi opt-in HRIS/cron dan migrasi fondasi ikut scope yang diizinkan owner; aktivasi layanan HRIS produksi adalah pekerjaan terpisah.
- WIP menyimpan status, bukan salinan aturan. Riwayat panjang WIP sebelum perapihan tersedia di Git; aturan dan izin rilis historis tidak berlaku untuk pekerjaan baru.
- Rujukan HRIS pada WIP ini adalah konteks lintas branch: buka dari `origin/dev_hris`/`origin/staging` bila file belum ada pada checkout `main`. Integrasi aturan tidak membawa kode atau aktivasi HRIS ke produksi.
- `docs/progress-tracker.md` dan `docs/outstanding-bo-tasks.md` bertanda BASI; `_bmad-output/` lokal saja.
- Koreksi `docs/koreksi-ibt-20261006-0004.sql` sudah dijalankan 2026-10-08; jangan diulang. Status koreksi shift 344 harus diperiksa sebelum tindakan produksi.
- Pelunasan piutang bukan pendapatan baru di Laba Rugi; penjualan kredit sudah diakui saat transaksi. Perubahan integrasi pelunasan harus mengikuti aturan kas/shift dan backlog terkait.
