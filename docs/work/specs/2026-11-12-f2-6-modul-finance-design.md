# F2-6 Modul Finance — F2-6a Saldo Tempat Uang & Arus Uang

PRD: `docs/hris_planning/PRD/fase_2/07-modul-finance.md`, `01-susunan-web.md` §5, `02-tempat-uang.md`,
`00-ringkasan-fase-2.md` §10.

Status: **disetujui owner 2026-11-12** ("ok setuju, kerjakan semua nya").

Sudah diputuskan owner 2026-11-12 (pilihan yang disarankan agent):

1. **Web Finance khusus staging** di `https://finance.staginghml.my.id` (domain dari owner), hanya Owner/GM,
   hanya membaca. Tidak masuk produksi sampai Halaman Awal / web resmi siap (01 §5).
2. **Bertahap**: F2-6a Saldo Tempat Uang + Arus Uang → F2-6b Laba Rugi bersih per cabang & gabungan →
   F2-6c Utang antar cabang, Setoran bebas vs laba, Dana non-tunai belum cair. Satu tahap diuji owner
   sebelum tahap berikutnya.
3. **Biaya bersama berdiri sendiri sebagai "Kantor"** (dipakai di F2-6b): laba tiap cabang tanpa biaya
   bersama; Gabungan = jumlah cabang − Kantor.
4. **Tutup bulan belakangan** (sesudah F2-6b dipercaya); sementara itu "Cara membaca" menyebut bahwa angka
   bulan lalu bisa berubah bila ada koreksi.
5. **Saldo awal dicatat di Back Office › Tempat Uang** (Finance tetap hanya membaca).
6. **Hitungan saldo mulai 1 November 2026** untuk semua Tempat Uang (sejalan dengan Setoran & pelunasan
   otomatis).

## 1. Keadaan sekarang

- Tempat Uang (`petshop.money_places`, F2-1): Laci (`DRAWER`, otomatis per cabang), Tunai (`CASH`),
  Rekening (`BANK`); tidak dihapus, hanya nonaktif. Belum ada saldo awal.
- Catatan uang yang sudah menyebut Tempat Uang:

| Sumber | Tabel | Arah | Tanggal uang |
|---|---|---|---|
| Setoran tunai terverifikasi (F2-2) | `money_movements` `CASH_DEPOSIT` | masuk ke tujuan | `occurred_on` |
| Verifikasi non-tunai (F2-2) | `money_movements` `NONCASH_VERIFICATION` | masuk ke rekening | `occurred_on` |
| Pindah Dana (F2-4c) | `money_movements` `TRANSFER` | keluar dari asal, masuk ke tujuan | `occurred_on` |
| Arus Kas masuk/keluar, termasuk Biaya Rutin (F2-4b, F2-5a) | `cash_flow_entries` | sesuai jenis; batal tidak dihitung | `occurred_on` |
| Bayar supplier (F2-4a) | `supplier_payable_payments.money_place_id` | keluar | `paid_at` (WIB) |
| Gaji, kasbon, bongkaran (+ uang kembali bongkaran) — HRIS, **belum produksi** | `hris.payslip_payment_batches`/`payslip_payments`, `advance_handovers`, `unloading_payments` | keluar (uang kembali = masuk) | tanggal uang masing-masing |
| Sewa mobil (F2-5b) — Logistik, **belum produksi** | `logistics` pembayaran sewa | keluar | tanggal uang |

- **Belum menyebut Tempat Uang**: bensin Logistik (`logistics.fuel_expenses`), catatan lama sebelum F2-4
  ("belum diketahui"), bayar utang internal manual. Uang laci dihitung per shift (Riwayat Shift), bukan di
  saldo Tempat Uang.
- Pembalikan di `money_movements` bernilai negatif; batal di tabel lain ditandai kolom batal — keduanya
  sudah dipakai F2-2 s.d. F2-5.

## 2. F2-6a-1 — Saldo awal (Back Office, ke produksi)

Pekerjaan kecil terpisah: `feat/money-place-opening-balance`, dasar `origin/main`, migrasi petshop `0067`,
→ staging → uji owner → PR rilis Back Office.

- Pengaturan › **Tempat Uang**: kolom baru **Saldo awal 1 Nov 2026** untuk Tunai dan Rekening (Laci tidak).
  Kosong = "belum diisi" (kuning).
- Tombol **Isi saldo awal** — hanya **Owner/GM** (lewat peran, tanpa hak baru):

| Isian | Aturan |
|---|---|
| Jumlah | Bulat, ≥ 0 (tempat yang dibuka sesudah 1 Nov diisi 0) |
| Per tanggal | Tetap **1 November 2026 awal hari** (saldo sebelum transaksi tanggal 1). Ditampilkan, tidak dipilih |
| Catatan | Boleh kosong (mis. "sesuai mutasi BCA 31 Okt") |
| Foto bukti | Dianjurkan (mutasi bank / foto hitungan); tanpa foto bertanda "tanpa bukti" |

- **Tidak bisa diubah.** Salah = **Batalkan** dengan alasan wajib (Owner/GM), lalu isi ulang. Yang batal
  tetap terlihat di riwayat saldo awal tempat itu. Satu saldo awal berlaku per tempat (indeks unik).
- Data: tabel `petshop.money_place_opening_balances` (tempat, jumlah, `as_of date` = 2026-11-01, catatan,
  foto, pencatat, waktu, kolom batal). Trigger tolak hapus/ubah selain pengisian kolom batal (pola Arus Kas).
- Tes non-UI: aturan simpan/batal (peran, laci ditolak, dua yang berlaku ditolak, ubah/hapus ditolak DB).

## 3. F2-6a-2 — Web Finance staging: Saldo & Arus Uang

`feat/finance-web`, dasar `origin/dev_hris` (Finance membaca `petshop`, `hris`, `logistics`; semua ada di
`dev_hris`), integrasi seperti HRIS: merge lokal ke `dev_hris` → `staging`. **Tidak ada PR ke `main`**
selama web ini khusus staging. Tanpa migrasi.

### 3.1 Web & akses

- App baru `apps/finance` (Next.js, pola HRIS), tayang hanya di staging `https://finance.staginghml.my.id`
  di belakang gerbang Caddy + Basic Auth staging yang sama.
- Memakai **sesi auth pusat Back Office staging** (cookie `.staginghml.my.id`): masuk dulu di Back Office, lalu buka
  Finance. Boleh bila akses Back Office sesi itu milik pengguna berperan **OWNER** atau **GM**; selain itu halaman
  "Tidak bisa membuka Finance". Finance hanya membaca sesi (tidak memperpanjang/mencatat), karena role-nya baca saja.
- Tanpa menu di HRIS maupun Back Office (01 §5). Rumus ada di `apps/finance/modules/` (bertes), terpisah
  dari layar, supaya kelak tinggal dipindah ke web resmi.
- **Hanya membaca, dijaga database**: role baru `finance_app` hanya `SELECT` pada tabel/view yang
  terdaftar di `packages/db-roles` (daftar = pintu baca Finance). Tes membuktikan `finance_app` tidak bisa
  `INSERT/UPDATE/DELETE` di keempat schema.

### 3.2 Saldo Tempat Uang

Halaman **Saldo** (beranda):

- Pilih **per tanggal** (bawaan hari ini WIB, tidak sebelum 1 Nov 2026).
- Daftar Tempat Uang **Tunai & Rekening** (aktif + nonaktif yang masih bersaldo), dikelompokkan per cabang
  pemilik, berisi: nama, jenis, dipegang oleh, **saldo**, masuk & keluar sejak 1 Nov s.d. tanggal pilihan. Baris jumlah per
  cabang dan **Total semua**.
- Saldo = **saldo awal 1 Nov** + semua uang masuk − semua uang keluar dengan **tanggal uang** 1 Nov s.d.
  tanggal pilihan. Catatan batal dan pembalikan saling meniadakan (tidak tampil sebagai angka ganda).
- Tanda: **"Saldo awal belum diisi"** (saldo dihitung dari 0); **saldo minus** (merah — biasanya ada
  catatan yang salah Tempat Uang atau belum dicatat).
- Kotak **"Belum masuk saldo"**: jumlah & banyaknya catatan uang sejak 1 Nov tanpa Tempat Uang (bensin
  Logistik, catatan "belum diketahui"), dengan tautan ke daftarnya.
- Klik satu tempat → **Mutasi**: per baris tanggal uang, keterangan (mis. "Setoran tunai Toko B shift 12",
  "Bayar supplier PT X", "Gaji minggu 2 — 5 orang"), sumber (Back Office / HRIS / Logistik), masuk, keluar,
  **saldo berjalan**; baris pertama = saldo awal. Saringan periode. Tiap baris punya tautan ke layar asalnya
  (BO/HRIS staging).

### 3.3 Arus Uang

Halaman **Arus Uang**, per **bulan** (bawaan bulan berjalan), lingkup **Gabungan** / per cabang pemilik
Tempat Uang / satu Tempat Uang:

- **Uang masuk** per jenis: Setoran tunai, Non-tunai cair, Arus Kas masuk (per kategori), Uang kembali
  HRIS.
- **Uang keluar** per jenis: Bayar supplier, Arus Kas keluar (per kategori; Biaya Rutin terlihat dengan
  kategorinya), Gaji, Kasbon, Bongkaran, Sewa mobil.
- **Pindah antar tempat** dipisah ("bukan masuk/keluar"): di Gabungan saling meniadakan; di lingkup cabang/
  tempat tampil sebagai masuk/keluar pindahan.
- Ringkasan: saldo awal bulan + masuk − keluar ± pindahan = saldo akhir bulan (harus sama dengan halaman
  Saldo per akhir bulan; dijaga tes).
- Arus Uang di sini **menurut Tempat Uang**, bukan "cabang yang menanggung biaya". Tanggungan per cabang &
  Kantor adalah Laba Rugi (F2-6b).

### 3.4 "Cara membaca" (07 §3)

Setiap angka (saldo tiap tempat, total cabang, total semua, tiap baris Arus Uang) punya tombol **Cara
membaca** dengan susunan tetap: **Artinya** · **Asal angka** (nama layar & tabel dalam bahasa sehari-hari)
· **Hitungan** memakai angka yang sedang tampil (mis. "Saldo awal Rp12.350.000 + masuk Rp8.000.000 − keluar
Rp5.100.000 = Rp15.250.000") · **Perlu diketahui** (terus terang: data HRIS & Logistik belum produksi;
bensin belum punya Tempat Uang; angka bulan lalu bisa berubah bila ada pembatalan karena belum ada tutup
bulan) · **Lihat rincian →** (Mutasi / daftar asalnya).

### 3.5 Staging & deploy

- `infra/staging`: layanan `finance-staging` di compose (tanpa `env_file`, tidak ada rahasia sendiri),
  `STAGING_FINANCE_DATABASE_URL` + `DOMAIN_STAGING_FINANCE=finance.staginghml.my.id` di `.env`,
  `STG_FINANCE_APP_DB_PASSWORD` di `migrator.env`; `check-env` & gerbang Caddy menerima keduanya;
  `deploy-staging.yml` membangun image Finance. Role `stg_finance_app` dibuat lewat `db-roles` seperti role staging lain.
- Tidak menyentuh `deploy-vps.yml`/produksi.

### 3.6 Tes (non-UI)

- Rumus murni: saldo dari saldo awal + baris masuk/keluar, batal & pembalikan, batas tanggal 1 Nov,
  pindahan di Gabungan = 0, saldo akhir bulan Arus Uang = Saldo.
- Integrasi DB lokal: pembaca tiap sumber (BO, HRIS, Logistik) memberi baris yang benar untuk contoh
  data; `finance_app` ditolak menulis.
- Typecheck root sekali pada kandidat akhir.

### 3.7 Langkah uji owner (staging)

1. BO staging › Tempat Uang: isi saldo awal dua tempat (satu rekening, satu kas), batalkan satu, isi ulang.
2. Buka `finance.staginghml.my.id` dengan akun Owner/GM → Saldo tampil; akun non-Owner/GM ditolak.
3. Catat satu Arus Kas keluar, satu Pindah Dana, verifikasi satu setoran di BO staging → saldo & Mutasi
   berubah sesuai, Cara membaca menunjukkan hitungan dengan angka yang tampil.
4. Batalkan catatan Arus Kas tadi → saldo kembali.
5. Cocokkan satu rekening nyata satu periode dengan mutasi bank (data staging = salinan produksi pada
   tanggal refresh).

## 4. Klaim & urutan kerja

1. Batch koordinasi (`docs/claim-f2-6a` → staging): klaim `feat/money-place-opening-balance` (path BO Tempat
   Uang + kunci **petshop**; sekaligus **melepas kunci petshop `feat/recurring-costs`** yang sudah produksi)
   dan `feat/finance-web` (`apps/finance`, `packages/db-roles`, `infra/staging`, `deploy-staging.yml`;
   tanpa kunci migrasi).
2. F2-6a-1 → staging → uji owner → PR rilis Back Office (backup prarilis).
3. F2-6a-2 → `dev_hris` → staging → uji owner. Tetap di staging.
4. Sesudah lolos: spec F2-6b Laba Rugi (biaya bersama = Kantor).

## 5. Di luar F2-6a

Laba Rugi (F2-6b); Utang antar cabang, Setoran bebas vs laba, Dana belum cair (F2-6c); hitung fisik kas;
tutup bulan; saldo Laci; Tempat Uang untuk bensin (perlu perubahan Logistik tersendiri); web Finance
produksi & Halaman Awal.
