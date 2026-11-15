# WIP

Last updated: 2026-11-15
Owner: repo session state

WIP hanya berisi fokus dan langkah berikutnya. Riwayat rilis ada di `apps/backoffice/CHANGELOG.md`
(dan `apps/hris/CHANGELOG.md`), rincian tiap pekerjaan di spec/plan-nya, dan WIP panjang sebelum
dirapikan 2026-11-14 tersimpan di riwayat Git (`git show 265d0f0f:docs/work/WIP.md`).

## Current Focus

- **Fase 3 (fitur pendukung HRIS)** — owner cukup mengetik "lanjutkan fase 3". PRD `hris_planning/PRD/fase_3/`
  (langkah F3-1..F3-5). **F3-1 Antrean Berantai** (spec `specs/2026-11-15-f3-1-antrean-berantai-design.md`,
  `feat/hris-f3-1-queue`, migrasi hris `0058`) terintegrasi ke dev_hris dan staging; **lolos uji owner di staging
  2026-11-15** (deployment `1df61f1b`, run `43661721129`; owner: "saya sudah uji"); ikut rilis HRIS. Catatan
  implementasi: catatan tampil > 90 hari dibuang saat akun menekan OK berikutnya (bukan mesin terjadwal).
  **F3-2 Pengumuman Darurat** (spec `specs/2026-11-15-f3-2-pengumuman-darurat-design.md`, disetujui owner
  2026-11-15; `feat/hris-f3-2-emergency`, migrasi hris `0059`) terintegrasi ke dev_hris dan staging —
  **lolos uji owner di staging 2026-11-15** (deployment `1c87151c`, run `43710630098`; owner: "sudah saya check dan ok"); ikut rilis HRIS. Tes aturan 11 + integrasi DB 7 lulus; typecheck root lulus.
  **Langkah berikutnya: tulis spec F3-3 Papan Perubahan Aturan** (+ kartu "Pengumuman belum dibaca" di Beranda,
  daftar karyawan tab Berlaku/Riwayat termasuk darurat — PRD Fase 3 `03-papan-perubahan-aturan.md`, spec F3-1 §0),
  minta persetujuan owner, lalu klaim path + kunci `hris` sebelum koding dari `origin/dev_hris`.
  Catatan: `dev_hris` belum menarik rilis BO 1.107.135–136 dari `main` (merge memberi konflik journal migrasi
  petshop + `apps/backoffice/lib/new-features.ts`); selesaikan terpisah sebelum rilis HRIS.
- ⚠️ Jangan commit dengan `git -c core.autocrlf=false` di Windows: 2026-11-15 itu menyimpan 1591 file sebagai CRLF
  di staging (dipulihkan 9dd6b94a). Sesudah commit, cek `git show --stat HEAD`.
- **Fase 2 Keuangan & Susunan Web — fitur selesai dibangun.** Owner cukup mengetik "lanjutkan fase 2"
  (bisa dari komputer lain; sumbernya dokumen ini). Status per langkah F2-1 s.d. F2-7b ada di tabel
  [PRD Fase 2 README](../hris_planning/PRD/fase_2/README.md#status-langkah-2026-11-14); semua spec sudah
  disetujui owner dan semua pertanyaan PRD sudah dijawab di spec. Bagian Back Office sudah produksi
  (1.107.118–1.107.136); bagian HRIS, Logistik, Finance, dan Gateway lolos uji di staging dan menunggu
  rilis HRIS.
- **Keputusan owner 2026-11-14 soal HRIS ke produksi:** tanpa uji banding dengan sistem lama (slip
  memakai format HRIS baru, sistem lama tidak dibahas), tanpa runbook hari pindah, tanpa jadwal tetap —
  dikerjakan bertahap. Rilis `dev_hris` → `main`, cutover akun pusat, muat data karyawan, isi
  gaji/jadwal/QR, dan hari pindah **ditunda sampai owner memutuskan**. Finance, Gateway, dan web
  Logistik **ikut ke produksi** saat rilis HRIS. Domain produksi sudah ada (wildcard DNS
  `*.hammielion.com` → VPS), tinggal situs Caddy saat rilis.
- **Uji pulihkan backup** `petshop_20261114_224306.sql.gz` ke DB sementara (bukan staging) berhasil
  2026-11-14: 0 galat, jumlah baris & total transaksi sama; DB sementara dihapus. Celah: backup hanya DB
  (foto upload/HRIS tidak ikut) dan hanya disimpan di VPS yang sama.
- HRIS Fase 1 (L0–L8) dan Logistik penuh (LT1–LT5 + 6 perbaikan, backlog
  [`2026-11-08-perbaikan-logistik-hris.md`](backlog/2026-11-08-perbaikan-logistik-hris.md) — antrean
  selesai) lolos uji owner di staging; belum produksi.

## Menunggu uji owner

- **F2-6f Tutup Bulan + Koreksi bulan lalu** (spec `specs/2026-11-12-f2-6f-tutup-bulan-design.md`,
  langkah uji §4 dan §5.6): tayang staging; menutup bulan baru bisa dicoba **mulai 1 Desember 2026**.
  BO-nya (`0070`/`0071`) sudah produksi 1.107.136 dalam keadaan tidak aktif (`month_closings` kosong).
- **Kelola Kategori Pengeluaran Kasir + Biaya Rutin nominal berubah** (`feat/expense-category-manage`,
  migrasi petshop `0072`): sudah **tayang produksi 1.107.136** atas izin owner; uji owner di
  staging/produksi belum tercatat.
- **Alamat halaman HRIS/Logistik/Finance ke bahasa Inggris** (owner 2026-11-14 "perbaiki sekarang saja";
  spec `specs/2026-11-14-english-routes-design.md`, `feat/english-routes`, tanpa migrasi): terintegrasi
  `dev_hris` & `staging` — **tayang staging — menunggu uji owner** (langkah uji spec §5). Alamat lama dialihkan
  otomatis. Tes: aturan alamat/menu/akses/jadwal HRIS 167 + Finance 3; typecheck root lulus.
- Rilis lama **tayang produksi — menunggu uji owner**: 1.107.113 (Grooming Ditahan + shortcut langkah
  Pengiriman) dan 1.107.106 (rincian Minus Kasir per cabang). HRIS L2a (komponen & kerangka tampilan,
  `/komponen`) tercatat menunggu uji owner di staging.

## Next Actions

- **Owner (data produksi):** saldo awal 7 Tempat Uang (ditunda, owner tidak di kantor); Bebaskan Hutang
  PO-20261110-0006 & PO-20261111-0007 (Rumah Petshop); Biaya Rutin listrik/air per
  cabang (butuh nominal); cocokkan satu hari nyata setoran dua toko (F2-3); baca Pratinjau Utang Lama
  sebelum menekan Jalankan pelunasan susulan (Owner sendiri, bukan agent).
- **Staging:** `STAGING_BO_AUTH_BRIDGE_UNTIL` berlaku s.d. **2026-11-17 12:00 WIB**; sesudahnya deploy
  staging gagal sampai dikosongkan/diperpanjang atas izin owner.
- **Sebelum rilis HRIS ke produksi** (saat owner memutuskan): cutover akun pusat mengikuti
  `docs/ops/auth-pusat.md` (persetujuan owner terpisah; masa stabil 30 hari dari cutover);
  `CASH_SHORTAGE_FROM`, `BONUS_FROM`, `PAYSLIP_FROM` diganti ke periode gaji HRIS pertama (spec L4c/L4d/L4e
  §11); muat data karyawan (L2g, Excel sumber di tangan owner); situs Caddy produksi untuk
  `app.`/`finance.`/`logistik.`/`hris.hammielion.com`.
- **Tugas teknis untuk developer owner** (backup foto + salinan luar server, proteksi GitHub, pengerasan
  server, persiapan produksi HRIS, utang teknis): [`backlog/2026-11-14-tugas-dev.md`](backlog/2026-11-14-tugas-dev.md).
- Usulan agent yang ditunda owner ("nanti saja", 2026-11-14): panduan pengguna Fase 2 (Setor Tunai, Hitung Kas,
  Tutup Bulan, Tempat Uang, Biaya Rutin, Aset, Halaman Awal).
- Pemindahan role DB produksi (order-web lalu backoffice) dikerjakan terpisah setelah persetujuan owner.
- Sebelum melanjutkan fitur produk, periksa papan klaim terbaru dan backlog tunda owner; jangan mengambil
  status lama sebagai klaim aktif.

## Open Decisions

- Cutover akun pusat: login ulang sekali atau jembatan token lama, kebijakan fallback, umur sesi BO
  setelah JWT habis, dan sesi lain saat perubahan password normal. Domain sudah diputuskan di spec
  F2-7a/F2-7b; PIN hanya BO/POS serta HRIS idle 30 hari sudah diputuskan.
- Kembalikan Modal: pilihan "hanya barang yang modalnya naik" belum diputuskan owner (sekarang
  "kembalikan semua").
- Proteksi GitHub dan penguncian gerbang CI/deploy belum dikonfigurasi/diverifikasi.

## Deferred / Parked

- Promo P5 (grooming gratis makanan pilihan) belum dimulai; `docs/work/backlog/2026-10-12-promo-otomatis.md`.
- Terima Barang Tahap 2 (barang gratis, diskon nota/per item/bertingkat, bonus di luar PO) perlu spec.
- Rekonsiliasi stok/batch lama dan tindak lanjut hitung fisik: `docs/work/backlog/2026-10-03-hasil-rekonsiliasi-stok.md`.
- Keputusan tunda/bahas owner: `docs/work/backlog/2026-10-11-daftar-tunda-owner.md`. Jangan mengangkat
  kembali hal yang sengaja ditunda sebelum owner membukanya.
- Validasi cetak pada perangkat asli, konfigurasi OTP sungguhan/WAHA, dan pemeriksaan data produk oleh
  admin masih memerlukan pihak terkait; cek ulang status sebelum bertindak.
- Temuan Juli (seed permission/RBAC, integrasi kas pelunasan, audit pembayaran supplier, polish portal)
  belum diaudit ulang; rujukan `docs/work/plans/2026-07-13-rbac-manual-role-matrix-verification.md`.
- Tes `unloading-pay` "lebih bayar: terima pengembalian" di `dev_hris` gagal karena tanggal tes dipatok
  2026-11-07 vs `now()` DB; belum diperbaiki.

## Source Of Truth

- Aturan development: `AGENTS.md`; entry point Claude: `CLAUDE.md`; referensi teknis: `docs/agents/project-reference.md`.
- Klaim/kunci/peta domain: `docs/agents/claims.md` dari staging terbaru.
- Dokumen kerja: `docs/work/README.md`, `docs/work/{specs,plans,backlog}/`.
- PRD: Fase 1 `docs/hris_planning/PRD/fase_1/README.md`, Fase 2 `docs/hris_planning/PRD/fase_2/README.md`.
- Perubahan produk: `apps/backoffice/CHANGELOG.md` + `changelog.d/`, `apps/hris/CHANGELOG.md` + `changelog.d/`.
- Glosarium: `docs/glosarium-bisnis.md`; staging: `infra/staging/README.md`; perawatan server & akun pusat: `docs/ops/`.

## Notes For New Session

- Rujukan HRIS/Finance/Gateway di WIP ini adalah konteks lintas branch: buka dari `origin/dev_hris`/
  `origin/staging` bila file belum ada pada checkout `main`.
- `docs/progress-tracker.md` dan `docs/outstanding-bo-tasks.md` bertanda BASI; `_bmad-output/` lokal saja.
- Koreksi `docs/koreksi-ibt-20261006-0004.sql` sudah dijalankan 2026-10-08; jangan diulang. Status koreksi
  shift 344 harus diperiksa sebelum tindakan produksi.
- Pelunasan piutang bukan pendapatan baru di Laba Rugi; penjualan kredit sudah diakui saat transaksi.
- Cek Vercel di PR rilis selalu gagal (preview lama, bukan jalur produksi); yang wajib: verifikasi + db-migrations.
