# WIP

Last updated: 2026-11-24
Owner: repo session state

WIP hanya berisi fokus dan langkah berikutnya. Riwayat rilis ada di `apps/backoffice/CHANGELOG.md`
(dan `apps/hris/CHANGELOG.md`), rincian tiap pekerjaan di spec/plan-nya, dan WIP panjang sebelum
dirapikan 2026-11-14 tersimpan di riwayat Git (`git show 265d0f0f:docs/work/WIP.md`).

## Current Focus

- **Diskon PO (Rp)** (`feat/po-diskon`, migrasi petshop `0073`; permintaan owner 2026-11-25): kolom Diskon rupiah di Buat/Ubah Isi PO dan Cocokkan Harga Faktur; diskon dibagi rata persentasenya ke semua barang (modal turun, hutang proporsional barang bagus yang datang, harga klaim retur supplier ikut). Terintegrasi ke staging `ed552d31` — **tayang staging, menunggu uji owner**. Tes unit + integrasi DB PO/retur supplier 51 lulus; typecheck root lulus; klaim/kunci `petshop` dilepas. Tanggal `fitur/po-diskon` di `new-features.ts` disamakan dengan tanggal rilis produksi.
- Backoffice 1.107.139 (**tayang produksi**): **PO Internal — selisih terima jelas terlihat** (`fix/ibt-selisih-terima-tampil`, tanpa migrasi; keluhan kasir/admin 2026-11-24 "koreksi qty penerima tidak berfungsi", kasus IBT-20261123-0003 Toko Depan — cek DB produksi baca-saja: backend benar (retur otomatis RTN-20261123-0001, stok balik ke Toko Pusat, utang = nilai diterima; 12 kasus sejak pertengahan Okt cocok), yang membingungkan tampilannya): status "Diterima – Ada Selisih", qty terima 0 tampil "0", kolom Selisih + baris diwarnai, Nilai Dikirim/Diterima/Tidak Diterima di POS, kotak keterangan + nomor retur selisih (Back Office: tautan ke nota Bulk Sale). Label di halaman Panduan masih "Diterima Sebagian" (di luar lingkup). Staging `6c2f7f72` (deploy run 45436043172 sukses sesudah `STAGING_BO_AUTH_BRIDGE_UNTIL` diperpanjang ke 2026-12-01 12:00 WIB atas izin owner — batas check-env 7 hari, owner minta 1 bulan); uji owner di deployment staging (IBT-20261026-0002): "ok sudah aman" (2026-11-24, skenario tidak dirinci); izin rilis owner: "jalankan di produksi" (2026-11-24).
- Backoffice 1.107.138 (**tayang produksi**): **Satuan PO Internal divalidasi + Riwayat Satuan + Pemeriksaan Satuan** (`fix/ibt-create-uom-validation`, `feat/uom-change-audit`, tanpa migrasi; permintaan owner 2026-11-19 dari kasus TRX-20261104-2629 — VITACIK tercatat "Box" Rp0 lewat IBT-20261103-0001): PO Internal menolak satuan yang tidak dimiliki produk, form POS memberi peringatan & tanda merah per baris; tambah/ubah/hapus konversi, salin konversi, dan ubah master Satuan Ukur tercatat di Audit Log (grup Satuan Produk) dan tab Riwayat Satuan di detail produk; menu Master Data › Pemeriksaan Satuan (Owner/GM/Manager) mendaftar baris transaksi/PO Internal bersatuan tidak valid (produksi 2026-11-19: 37 baris transaksi, 9 baris IBT). Pemicu di sisi form yang mengirim "Box" untuk VITACIK tidak terbukti; penolakan server kini mencatat log `satuan tidak sesuai master produk`. Staging `9b14b2c0` (deploy run 44469519197 sukses 13:08 WIB); owner: "ok aman" (dikirim sebelum deploy itu selesai) lalu, sesudah diminta uji ulang, "ok rilis" (2026-11-19; skenario tidak dirinci). **Berikutnya (owner):** putuskan koreksi untuk baris di Pemeriksaan Satuan, termasuk TRX-20261104-2629.
- Backoffice 1.107.137 (**tayang produksi**): **Tinjau Modal & Margin — cari, filter, cetak lembar ACC, ubah harga di tab Margin** (`fix/cost-review-search`, tanpa migrasi; permintaan owner 2026-11-17): cari produk & filter cabang/sumber (Harga Jual, Modal), filter jenis harga & kondisi (Margin), tombol Cetak / PDF lembar ACC owner di ketiga tab; tab Margin per barang dengan semua harga jual, bisa disimpan langsung (harga di bawah modal ditolak — jual rugi pakai diskon). Ditambah **Simpan PDF** A4 berhalaman di preview Bulk Sale & keranjang Kasir (`feat/bulk-sale-preview-pdf`). Staging `8a5c4881` (deploy sukses 2026-11-17); uji owner di deployment staging: "saya sudah check dan aman kedua nya" (2026-11-17, skenario tidak dirinci); izin rilis owner: "ok push" (2026-11-17).
- **Fase 3 (fitur pendukung HRIS)** — owner cukup mengetik "lanjutkan fase 3". PRD `hris_planning/PRD/fase_3/`
  (langkah F3-1..F3-5). **F3-1 Antrean Berantai** (spec `specs/2026-11-15-f3-1-antrean-berantai-design.md`,
  `feat/hris-f3-1-queue`, migrasi hris `0058`) terintegrasi ke dev_hris dan staging; **lolos uji owner di staging
  2026-11-15** (deployment `1df61f1b`, run `43661721129`; owner: "saya sudah uji"); ikut rilis HRIS. Catatan
  implementasi: catatan tampil > 90 hari dibuang saat akun menekan OK berikutnya (bukan mesin terjadwal).
  **F3-2 Pengumuman Darurat** (spec `specs/2026-11-15-f3-2-pengumuman-darurat-design.md`, disetujui owner
  2026-11-15; `feat/hris-f3-2-emergency`, migrasi hris `0059`) terintegrasi ke dev_hris dan staging —
  **lolos uji owner di staging 2026-11-15** (deployment `1c87151c`, run `43710630098`; owner: "sudah saya check dan ok"); ikut rilis HRIS. Tes aturan 11 + integrasi DB 7 lulus; typecheck root lulus.
  **F3-3 Papan Perubahan Aturan** (spec `specs/2026-11-15-f3-3-papan-perubahan-aturan-design.md`, disetujui owner
  2026-11-15, dipecah F3-3a/F3-3b). **F3-3a** (`feat/hris-f3-3a-rule-board`, migrasi hris `0060`: papan Berlaku/Riwayat,
  tulis perubahan aturan, persetujuan uang lewat pengajuan `rule_announcement`, ralat/tarik, kartu Beranda + antrean
  RULE) terintegrasi ke dev_hris dan staging — **lolos uji owner di staging 2026-11-16** (deployment `c597c884`, run `43722009105`; owner memilih "F3-3a sudah lolos uji", skenario tidak dirinci); ikut rilis HRIS. Tes aturan 10 +
  integrasi DB 9 lulus; typecheck root lulus. Catatan implementasi: kolom `message` = "Sekarang"; konsep yang sudah
  dikirim untuk disetujui dibatalkan dari Pengajuan Saya (status konsep "Ditolak / dibatalkan").
  **F3-3b Wajib umumkan** (spec §4, `feat/hris-f3-3b-must-announce`, migrasi hris `0061`: langkah Pengumuman saat
  pengaturan `mustAnnounce`/tarif ritase disimpan, tarik ↔ batal nilai, usulan HR membawa konsep, daftar §4.3)
  terintegrasi ke dev_hris dan staging — **tayang staging, menunggu uji owner** (spec §8 F3-3b). Tes integrasi DB 6 +
  settings/announcements/trip-wages lulus; typecheck root lulus; klaim/kunci `hris` dilepas. Catatan implementasi di
  spec §4.4. **Langkah berikutnya Fase 3: F3-4** (pengingat modul ke antrean, PRD 01 §5) atau **F3-5** (menu Panduan),
  spec dulu.
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
