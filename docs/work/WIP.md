# WIP

Last updated: 2026-10-12
Owner: repo session state

## Status 2026-10-11 (baca ini dulu)

Versi tayang: **1.107.74**. Push ke `main` yang menyentuh `apps/`, `packages/`, `infra/apps`
atau `pnpm-lock.yaml` = langsung deploy ke toko (`.github/workflows/deploy-vps.yml`).
Perubahan `docs/` saja tidak memicu deploy.

**Tayang belakangan ini (belum semuanya diuji di layar toko):**

| Versi | Isi | Dokumen |
|---|---|---|
| 1.107.55 | Hutang Supplier (halaman, catat bayar, jatuh tempo dari termin supplier) | [`specs/2026-10-10-hutang-supplier-design.md`](specs/2026-10-10-hutang-supplier-design.md) |
| 1.107.56 | Alur PO baru (tahap PO, harga menyusul / menunggu faktur, batalkan input penerimaan) | [`specs/2026-10-10-alur-po-baru-design.md`](specs/2026-10-10-alur-po-baru-design.md) |
| 1.107.74 | Pencarian produk **per kata** diratakan ke Master Harga (+ ekspor), Cetak Barcode, Stock Opname, kotak pilih produk, Log Penyesuaian Stok, Peringatan Margin, laporan Utang Stok (atas perintah owner: "ratakan dulu pencarian produk"). Tanpa migrasi. **Tayang — menunggu uji coba owner**. Belum: pencarian bukan produk, reset halaman di layar lain | `apps/backoffice/lib/search-words.ts`, `lib/product-search.ts` |
| 1.107.73 | Master Data Produk: daftar tidak lagi lompat ke halaman 1 saat mencentang/edit/aktif-nonaktif/hapus (hanya saat filter atau pencarian diganti); pencarian **per kata** ("bolt ikan" menemukan "BOLT DRY IKAN ..."). Tanpa migrasi. **Tayang — menunggu uji coba owner**. Layar daftar lain belum diratakan (menunggu keputusan owner) | `apps/backoffice/lib/search-words.ts`, `components/ui/data-table.tsx` (`resetPageKey`) |
| 1.107.72 | **Mesin berat** — berat satuan besar (dus, sak) selalu dihitung isi × berat 1 satuan terkecil (isian berat di tab Satuan jadi tampilan hitungan; angka lama tidak dibaca lagi); satuan terkecil GRAM/KG beratnya pasti; tonase surat jalan Penjualan Grosir memakai hitungan ini; tanda **"Belum ada berat"** di daftar & detail Master Data Produk. Tanpa migrasi. **Tayang — menunggu uji coba owner** | [`specs/2026-10-12-mesin-berat-design.md`](specs/2026-10-12-mesin-berat-design.md) |
| 1.107.71 | **Mesin ongkir** — gratis ongkir selalu bernilai ongkir standar dari Pengaturan (bawaan Rp 10.000, Owner/GM); struk "Ongkos kirim" / "GRATIS ONGKIR" / "Anda hemat" di semua jalur cetak & cetak ulang; ringkasan antaran berbayar/gratis di laporan; **perbaikan** rumus Penjualan per Produk (diskon baris dikurangi dua kali). Tanpa migrasi. **Tayang — menunggu uji coba owner** | [`specs/2026-10-11-jasa-grooming-design.md`](specs/2026-10-11-jasa-grooming-design.md) butir 35–38 |
| 1.107.70 | **Pengantar untuk setiap ongkir** — layar bayar tab Kasir meminta pengantar internal bila nota berisi ongkir (bonus 50% ongkir, sama dengan delivery grooming); **Gratis ongkir** (centang oleh kasir, nilai tercatat sebagai ditanggung toko, tanpa bonus) di tab Kasir & tab Grooming; laporan "Delivery & Antar Barang". Migrasi 0042. **Tayang — menunggu uji coba owner** | [`specs/2026-10-11-jasa-grooming-design.md`](specs/2026-10-11-jasa-grooming-design.md) butir 28–34 |
| 1.107.69 | **Jasa (Grooming) J1–J4** — produk jasa tanpa stok; Pengaturan → Groomer & Pengantar; Data Kucing; tab **Grooming** di kasir (terima kucing, delivery, karcis, Lunas sekarang / Bayar saat ambil / Tambah belanja, Bayar & Ambil); grooming hanya lewat tab Grooming; **ongkir = qty × Rp 1.000**; Laporan → Riwayat Grooming & Bonus; Ganti Groomer; tanda Grooming di Laporan Piutang. Migrasi 0037–0041. **Tayang — menunggu uji coba owner** (dirilis tanpa uji di layar lebih dulu, atas perintah owner) | [`specs/2026-10-11-jasa-grooming-design.md`](specs/2026-10-11-jasa-grooming-design.md) · [`backlog/2026-10-11-jasa-grooming.md`](backlog/2026-10-11-jasa-grooming.md) |
| 1.107.68 | Nomor transaksi kembar dicoba ulang otomatis (kasir tidak lagi melihat "Gagal menyimpan transaksi" karena itu); format nomor tetap. **Tayang — menunggu uji coba owner** | [`backlog/2026-10-11-daftar-tunda-owner.md`](backlog/2026-10-11-daftar-tunda-owner.md) |
| 1.107.67 | Tanda "Baru" juga di tambahan dalam halaman (foto bukti, daftar pilih kiriman, Saldo Internal, Estafet, tab Belum Ada Harga). **Tayang — menunggu uji coba owner** | `apps/backoffice/lib/new-features.ts` |
| 1.107.66 | Tanda "Baru" di menu/fitur yang baru rilis (7 hari); daftar pilih kiriman (terbaru di atas) di form Retur Internal. **Tayang — menunggu uji coba owner** | [`backlog/2026-10-11-daftar-tunda-owner.md`](backlog/2026-10-11-daftar-tunda-owner.md) |
| 1.107.65 | Proses rilis membuang image aplikasi lama di server otomatis (sisakan 6 terbaru) — tanpa perubahan aplikasi/DB | [`../ops/README.md`](../ops/README.md) |
| 1.107.64 | Foto bukti transfer opsional di pelunasan piutang pelanggan & bayar hutang supplier (Back Office, metode non-tunai); unggah foto hanya menerima gambar — migrasi 0036. **Tayang — menunggu uji coba owner** | [`specs/2026-10-11-foto-bukti-transfer-design.md`](specs/2026-10-11-foto-bukti-transfer-design.md) |
| 1.107.63 | Mutasi Stok mencatat pembatalan retur pelanggan (baris "Batal Retur"; hanya laporan, tanpa migrasi) — belum diuji di layar sebelum rilis | [`backlog/2026-10-11-retur-internal.md`](backlog/2026-10-11-retur-internal.md) ("Perbaikan terpisah") |
| 1.107.62 | Rilis gabungan RI3–RI9: pintu dua kotak retur, Batalkan Retur Supplier Luar + tarik pengajuan, Retur Internal (Barang Dikembalikan, Saldo Internal otomatis, Revisi Harga Beli + koreksi laporan) — migrasi 0033–0035, **belum diuji di layar sebelum rilis** | [`specs/2026-10-11-retur-internal-design.md`](specs/2026-10-11-retur-internal-design.md) · [`backlog/2026-10-11-retur-internal.md`](backlog/2026-10-11-retur-internal.md) |
| 1.107.61 | Alasan retur "Barang tidak datang / kurang kirim" di Retur ke Supplier (RI2) | [`backlog/2026-10-11-retur-internal.md`](backlog/2026-10-11-retur-internal.md) |
| 1.107.60 | Tombol Hapus supplier diganti Nonaktifkan (RI1b) | [`backlog/2026-10-11-retur-internal.md`](backlog/2026-10-11-retur-internal.md) |
| 1.107.59 | Supplier aktif/nonaktif; Gudang/Repack/Return dinonaktifkan (RI1, migrasi 0032) | [`backlog/2026-10-11-retur-internal.md`](backlog/2026-10-11-retur-internal.md) |
| 1.107.58 | Retur ke Supplier + saldo supplier (migrasi 0031) — belum diuji di layar sebelum rilis | [`specs/2026-10-10-retur-supplier-design.md`](specs/2026-10-10-retur-supplier-design.md) |
| 1.107.57 | Estafet shift: rekap hari di struk shift 2, kotak Shift Ditutup dikunci, Riwayat Shift digabung | [`specs/2026-10-11-estafet-shift-design.md`](specs/2026-10-11-estafet-shift-design.md) |


**Belum dikerjakan / menggantung:**

- `docs/koreksi-ibt-20261006-0004.sql` — koreksi stok Gudang: **sudah dijalankan 2026-10-08** (dicek 2026-10-11, retur `RTN-20261008-0001`); tidak perlu diulang.
- [`backlog/2026-10-03-hasil-rekonsiliasi-stok.md`](backlog/2026-10-03-hasil-rekonsiliasi-stok.md)
  — ratusan pasangan produk/cabang stok ringkas ≠ rincian batch; usulan hitung ulang fisik.
- `docs/progress-tracker.md` & `docs/outstanding-bo-tasks.md` sudah diberi tanda **BASI** (2026-10-11) — jangan jadi acuan.

**Perawatan server:** disk server dibersihkan 2026-10-11 (83% → 27%, image aplikasi lama) — cara mengulang & perbaikan permanen yang belum dikerjakan ada di [`../ops/README.md`](../ops/README.md).

**Daftar tunda & daftar bahas (keputusan owner 2026-10-11):** [`backlog/2026-10-11-daftar-tunda-owner.md`](backlog/2026-10-11-daftar-tunda-owner.md) — baca di awal sesi; berisi apa yang menunggu uji coba owner, apa yang wajib dibahas dulu, dan apa yang sengaja ditunda.

**Istilah bisnis owner:** [`../glosarium-bisnis.md`](../glosarium-bisnis.md) — baca dulu.

**▶ Langkah berikutnya:** owner mencoba fitur rilis 1.107.62 di toko dengan **satu dokumen kecil dulu** (Barang Dikembalikan, lalu Revisi Harga Beli) dan mengawasi terima transfer + Hutang Piutang Internal (Saldo Internal otomatis, RI7). Item **"Perbaikan terpisah"**: foto bukti transfer opsional sudah **tayang 1.107.64 — menunggu uji coba owner** (belum dianggap selesai; nomor referensi tidak jadi diwajibkan). Mutasi Stok pembatalan retur pelanggan sudah tayang 1.107.63 (2026-10-11). RI3–RI9 dirilis gabungan 1.107.62 pada 2026-10-11 atas keputusan owner **tanpa uji di layar lebih dulu** (tes otomatis & tes DB di salinan data toko lulus).

**Jasa (Grooming) J1–J4 — TAYANG 1.107.69 (2026-10-12), menunggu uji coba owner.** Tujuh branch bertumpuk dirilis sekaligus atas perintah owner **tanpa uji di layar lebih dulu** (tes otomatis, tes DB di salinan data toko, build, dan uji asap halaman lulus). Rancangan & log: [`specs/2026-10-11-jasa-grooming-design.md`](specs/2026-10-11-jasa-grooming-design.md) · [`backlog/2026-10-11-jasa-grooming.md`](backlog/2026-10-11-jasa-grooming.md). **▶ Langkah berikutnya:** (1) kasir diberi tahu: ongkir sekarang diisi **qty × Rp 1.000**, dan grooming hanya dijual lewat tab Grooming; semua pengguna keluar lalu masuk lagi supaya izin baru terbaca; Owner/GM mendaftarkan groomer & pengantar di Pengaturan sebelum tab Grooming dipakai; (2) owner mencoba di toko dengan **satu nota kecil**: terima kucing → karcis (printer toko) → diambil; Tambah belanja; Bayar saat ambil → Bayar & Ambil; Ganti Groomer; laporan bonus. Belum dikerjakan (keputusan owner: dibahas nanti): Hotel Cat, promo otomatis, kirim data ke HRIS. Stok minus & utang stok lama grooming/ongkir dibiarkan (owner membereskan sendiri).

**Promo otomatis & diskon per barang — SEDANG DIKERJAKAN, belum tayang.** P0 (rancangan), **P1a** (migrasi `0043` tabel catatan potongan + mesin diskon manual + mesin nilai bersih baris) dan **P1b** (server menerima, memeriksa, dan mencatat diskon per barang; layar kasir belum mengirimnya, jadi kasir, retur, dan laporan belum berubah) ada di branch bertumpuk `docs/promo-rancangan` → `feat/diskon-per-barang-mesin` → `feat/diskon-per-barang-server`, belum di-push. Kunci migrasi dipegang `feat/diskon-per-barang-mesin`. Rancangan & log: [`specs/2026-10-12-promo-otomatis-design.md`](specs/2026-10-12-promo-otomatis-design.md) · [`backlog/2026-10-12-promo-otomatis.md`](backlog/2026-10-12-promo-otomatis.md). **▶ Langkah berikutnya:** P1c (retur mengikuti nilai yang benar-benar dibayar) — didahului dua pertanyaan untuk owner di backlog.

**Direncanakan (bertahap, dibahas 2026-10-11):** Retur Internal & Revisi Harga Beli ➡️ [`specs/2026-10-11-retur-internal-design.md`](specs/2026-10-11-retur-internal-design.md) · backlog RI0–RI9 [`backlog/2026-10-11-retur-internal.md`](backlog/2026-10-11-retur-internal.md)

**Aturan kerja yang berlaku (owner bukan programmer):** analisa & jelaskan risiko dulu,
kerja di branch, jalankan typecheck/lint/test/`changelog:check`/`migrations:check`, uji di DB
lokal salinan prod, owner coba di laptop, push ke `main` hanya dengan izin per perubahan,
backup DB produksi sebelum rilis. Fitur baru → dokumen desain di `docs/work/specs/`;
migrasi baru → ambil kunci di `docs/agents/claims.md` lebih dulu.

---

## Arsip status 2026-07-13

> Bagian di bawah ini tidak diperbarui sejak Juli; status tiap butir perlu dicek ulang.

### Current Focus (Juli)

Tiga pekerjaan, hasil audit backlog menyeluruh 2026-07-13. Semua inisiatif besar (#1 RBAC, #2 Staff
Dashboard, #3 Customer Order Portal C0–C5) **sudah selesai di kode** — yang tersisa adalah
**verifikasi, kontrol akses, dan satu lubang akuntansi**.

1. **🔴 Verifikasi manual matriks otorisasi per role** — satu-satunya kriteria RBAC R6 yang masih terbuka.
   ➡️ [`plans/2026-07-13-rbac-manual-role-matrix-verification.md`](plans/2026-07-13-rbac-manual-role-matrix-verification.md)
2. **🟢 Editor Role → Permission di Settings** — prasyarat (R6) sudah beres, tak lagi ditunda.
   ➡️ [`backlog/2026-07-09-rbac-roles-permissions-editor.md`](backlog/2026-07-09-rbac-roles-permissions-editor.md)
3. **🔴 Pelunasan piutang masuk kas & rekonsiliasi shift** — ditunda sejak 2026-07-03, masih terbuka.
   ➡️ [`backlog/2026-07-13-debt-payment-cash-integration.md`](backlog/2026-07-13-debt-payment-cash-integration.md)

**Urutan yang disarankan: 1 → 2 → 3.** Verifikasi (1) dulu karena editor (2) membuat peta permission
jadi bergerak — tanpa baseline yang tepercaya, bug otorisasi tak bisa dibedakan antara salah-seed dan
salah-edit. Item (3) independen, boleh diparalelkan bila ada kapasitas.

## Temuan Kritis yang Belum Ditindaklanjuti

Dua hal ini muncul saat audit dan **berpotensi merusak produksi**. Baca sebelum mulai apa pun.

### 🚨 Seed permission kemungkinan belum dijalankan ulang setelah M6

M6 menambah kode permission **baru** `internal_transfer.approve`. `permissions` di JWT diisi saat login
dari tabel `role_permissions`. **Bila seed belum dijalankan ulang ke DB, approve/batalkan Transfer
Internal akan 403 untuk SEMUA role — termasuk OWNER.**

```bash
pnpm --filter @petshop/db db:seed-permissions   # idempotent, aman diulang
```

Ekspektasi setelah seed: **29 permission / 71 baris** `role_permissions` (OWNER 29, GM 26, MANAGER 11,
GUDANG 2, FINANCE 2, KASIR 1). Detail + query verifikasi ada di dokumen verifikasi (fokus #1, bagian P0).

Semua user juga **wajib login ulang** — `permissions` & `branchScope` disematkan di JWT saat login.

### 🚨 Pelunasan piutang JANGAN dimasukkan ke Laba Rugi

Framing lama keliru. `getProfitLossReport` menghitung omzet dari `SUM(transactions.payableAmount)` untuk
semua transaksi `COMPLETED` **tanpa memandang metode bayar** → penjualan kredit **sudah diakui sebagai
omzet saat penjualan** (akrual). Menambahkan pelunasan sebagai pendapatan = **omzet dobel-hitung**.

Yang bocor **hanya sumbu kas**: arus kas + rekonsiliasi shift. P&L jangan disentuh. Sudah dikunci sebagai
keputusan di backlog fokus #3.

## Selesai (audit 2026-07-13)

| Inisiatif | Status |
|---|---|
| Bulk Sale enhancements (B1–B7) | ✅ `1.37.1` |
| Harga Gudang + IBT→Bulk Sale (G1–G9) | ✅ s/d `1.47.0` |
| Manajemen satuan inline di grid harga | ✅ `1.41.0` |
| **#1** RBAC permission-level (R1–R5, M1–M8) | ✅ `1.48.0`–`1.56.0` — *kecuali uji manual (fokus #1)* |
| **#2** Staff dashboard & onboarding (S1–S8) | ✅ `1.57.0`–`1.64.0` |
| **#3** Customer Order Portal (C0–C5) | ✅ s/d `1.70.0` |
| Surat Jalan dot-matrix (QZ Tray) | ✅ `1.73.0`–`1.75.0` — *validasi printer fisik pending* |
| Owner Approval & Barang Rusak | ✅ void async inbox, fix celah auth, kerugian masuk P&L |

Checkbox di backlog staff-dashboard, bulk-sale, dan rbac-domain-migration sudah disinkronkan dengan
commit pada audit ini (sebelumnya tertinggal tak tercentang meski kode sudah merge).

## Menunggu Pihak Lain / Non-Koding

Bukan pekerjaan agent — butuh akses akun, perangkat fisik, atau keputusan Owner.

- **C6 Deployment Order Portal** — sisi repo ✅ selesai (`vercel.json`, workflow CI, `infra/waha/`).
  Sisanya manual: project Vercel + domain `order.hammielion.com`, WAHA di server + scan QR nomor toko,
  verifikasi OTP sungguhan. ➡️ [`specs/2026-07-10-order-web-deployment-runbook.md`](specs/2026-07-10-order-web-deployment-runbook.md)
- **Validasi Surat Jalan di printer dot-matrix asli** — kode siap, belum pernah dicetak di perangkat nyata.
- **`koreksi-admin-gudang.csv`** (245 baris) — 86 produk baru, 125 modal kosong, 21 ratio MEO/PUSSBITE
  perlu cek fisik. Tindak lanjut admin.
- **Daftar produk base GRAM yang sebenarnya 500gr** — menunggu Owner.

## Deferred / Parked

- **C7 — Polish Order Portal** (fast-follow, prioritas rendah): notifikasi WA saat order dikonfirmasi/
  ditolak, upload foto produk. ➡️ [`backlog/2026-07-08-customer-order-portal.md`](backlog/2026-07-08-customer-order-portal.md) §C7
- **Audit pembayaran hutang supplier** — apakah punya lubang kas serupa (uang **keluar** tanpa entri kas)?
  Belum diperiksa; ditangani sebagai bagian dari fokus #3 (D1).

## Source Of Truth

- Struktur dan aturan dokumen kerja: `docs/work/README.md`
- Backlog aktif: `docs/work/backlog/` · Plans: `docs/work/plans/` · Specs: `docs/work/specs/`
- `_bmad-output/` = lokal-only, **bukan** sumber kebenaran.

## Notes For New Session

- Untuk "apa WIP sekarang?" → baca file ini dulu, jangan menjelajah backlog penuh.
- Sebelum menyentuh RBAC apa pun: baca dua Temuan Kritis di atas.
- Setiap perubahan fitur/bugfix **wajib** update `apps/backoffice/CHANGELOG.md` (lihat `CLAUDE.md`).
  Perubahan dokumen kerja saja (seperti audit ini) **tidak** perlu entri CHANGELOG.
