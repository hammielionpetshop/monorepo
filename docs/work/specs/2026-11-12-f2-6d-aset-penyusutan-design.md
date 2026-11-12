# F2-6d Aset & Penyusutan

PRD: `docs/hris_planning/PRD/fase_2/00-ringkasan-fase-2.md` §10 no. 4 ("Beli freezer bukan biaya satu bulan"),
`07-modul-finance.md`. Rujukan buku v3: `docs/hris_planning/reference_docs/docs/aturan/06-keuangan.md` KEU-86,
KEU-197 (aset kantor), KEU-22 (beli aset bukan biaya). Lanjutan F2-6b Laba Rugi
(`2026-11-12-f2-6b-laba-rugi-design.md` §6 "Beli aset tidak masuk biaya (penyusutan belum ada)") dan F2-6c-2
Setoran vs Laba, keduanya di `origin/staging`.

Status: **disetujui owner 2026-11-12** ("langsung kerjakan sampai di push"; butir §0.1–12 mengikuti saran agent).

Prinsip Fase 2 tetap berlaku: uang dicatat sekali di modul kejadiannya (pembelian aset = Back Office), Finance hanya
membaca, setiap angka Finance punya **Cara membaca**, biaya dicatat "untuk bulan apa" terpisah dari "dibayar kapan",
tidak ada hapus (batal beralasan).

## 0. Keputusan yang diminta (saran agent)

| No | Hal | Saran agent |
|---|---|---|
| 1 | Apa yang disebut aset | Barang tahan lama **Rp1.000.000 ke atas per barang** yang dipakai usaha (freezer, AC, rak, komputer, timbangan, renovasi toko sewaan). Di bawah batas tetap dicatat biasa di Arus Kas sebagai Biaya. Batas ditulis di kode (belum jadi pengaturan) |
| 2 | Tempat mencatat | Menu baru **Back Office › Keuangan › Aset**. Tombol **Catat Pembelian Aset** menulis data aset **dan** satu catatan Arus Kas keluar kategori sistem **"Beli aset"** (jenis Bukan biaya) dalam satu simpan, sama seperti "Sudah dibayar" di Biaya Rutin. Kategori "Beli aset" tidak bisa dipilih langsung di Arus Kas |
| 3 | Jenis & umur pakai | Pilihan jenis dengan umur bawaan v3: Elektronik 4 th, Mesin & alat 4 th, Perabot 8 th, Kendaraan 8 th, Perbaikan bangunan sewaan (umur diisi sendiri, mis. sampai kontrak berakhir). Umur boleh diubah per aset saat dicatat (1–120 bulan) |
| 4 | Cara menyusut | **Garis lurus**: harga ÷ umur (bulan), mulai **bulan pembelian**, sisa pembulatan di bulan terakhir, tanpa nilai sisa. Penyusutan **dihitung saat dibaca**, tidak ditulis ke tabel (belum ada tutup bulan; Finance hanya membaca) |
| 5 | Cabang penanggung | Dipilih saat mencatat: satu cabang atau **Kantor** (bersama). Penyusutan masuk ke kolom cabang itu di Laba Rugi |
| 6 | Keadaan aset | Dipakai → **Rusak / Hilang / Dijual** (Owner/GM, tanggal + alasan wajib, tidak bisa kembali). Penyusutan berhenti; di bulan kejadian **sisa nilai menjadi kerugian** ("Kerugian aset"). Dijual: uang jual dicatat bersamaan ke Arus Kas masuk kategori sistem **"Jual aset"** (Bukan pendapatan) dan mengurangi kerugian; bila uang jual > sisa nilai, kelebihannya tampil sebagai **Untung jual aset** (pendapatan lain) |
| 7 | Salah catat | **Batalkan** (Owner/GM, alasan wajib, tanpa batas waktu) membatalkan aset beserta catatan Arus Kas "Beli aset"/"Jual aset" tertaut; penyusutan bulan-bulan sebelumnya ikut hilang dari Laba Rugi (belum ada tutup bulan). Isi aset tidak bisa diubah; betulkan dengan batal lalu catat ulang |
| 8 | Aset yang dibeli sebelum hari mulai | **Tidak dicatat** (sesuai KEU-205 v3). Pembelian sejak **1 Nov 2026** yang terlanjur dicatat sebagai Biaya di Arus Kas: Owner/GM membatalkan catatan Arus Kas itu (alasan "dicatat ulang sebagai aset"), lalu mencatatnya di Aset dengan tanggal beli aslinya. Tanggal beli paling awal 1 Nov 2026 |
| 9 | Pengingat di Arus Kas | Saat mencatat Biaya Rp1 juta ke atas, muncul kalimat bantu (tidak menolak): "Barang tahan lama? Catat di Keuangan › Aset agar biayanya dibagi per bulan" |
| 10 | Hak | Catat pembelian: Owner, GM, Finance. Ubah keadaan & Batalkan: Owner, GM. Lihat daftar & nilai: Owner, GM, Finance. Kepala cabang tidak melihat |
| 11 | Di luar langkah ini | Cek Aset tahunan, pindah aset antar cabang, aset milik Owner yang disewa kantor + Buku Ibu, laporan Harta/posisi modal, umur bawaan sebagai pengaturan. Diangkat belakangan bila owner membutuhkan |
| 12 | Pembagian kerja | **F2-6d-1** Back Office (dasar `origin/main`, migrasi petshop `0068`, bisa rilis produksi). **F2-6d-2** web Finance (dasar `origin/dev_hris`, tanpa migrasi, khusus staging): penyusutan & kerugian aset di Laba Rugi dan Setoran vs Laba. 6d-2 dikerjakan sesudah 6d-1 terintegrasi di staging |

## 1. Back Office — Keuangan › Aset (F2-6d-1)

### 1.1 Daftar

Tabel per aset: Nama · Jenis · Cabang (atau Kantor) · Tanggal beli · Harga · Umur · Penyusutan per bulan ·
**Sisa nilai hari ini** · Keadaan · Dibayar dari. Saringan cabang & keadaan (bawaan: Dipakai). Baris Dibatalkan
tampil di tab tersendiri dengan alasan dan pembatalnya. Ringkasan di atas: jumlah aset Dipakai, total harga,
total sisa nilai.

Tombol **Rincian** per aset: jadwal penyusutan bulan demi bulan (bulan, bagian bulan itu, akumulasi, sisa nilai),
foto bukti, catatan Arus Kas tertaut, riwayat keadaan.

### 1.2 Catat Pembelian Aset

Isian: Nama barang · Jenis · Umur (bulan, terisi dari jenis) · Cabang/Kantor · Tanggal beli (≥ 1 Nov 2026,
≤ hari ini) · Harga (≥ Rp1.000.000) · Dibayar dari (Tempat Uang Tunai/Rekening aktif; laci kasir tidak) · Foto
bukti (opsional) · Catatan (opsional). Pratinjau: "Rp X per bulan selama N bulan, mulai <bulan>".

Simpan dalam satu transaksi DB:
1. Satu baris `cash_flow_entries` EXPENSE kategori "Beli aset", `amount` = harga, `occurred_on` = tanggal beli,
   `for_month` = bulan beli, `money_place_id` = dibayar dari, cabang = cabang aset (kosong untuk Kantor).
2. Satu baris `fixed_assets` yang menunjuk catatan itu.

Karena kategorinya Bukan biaya, Laba Rugi tidak menghitung uang keluarnya; Arus Uang (F2-6a) dan saldo Tempat Uang
tetap mencatat uang keluar seperti biasa.

### 1.3 Ubah keadaan (Owner/GM)

- **Rusak** / **Hilang**: tanggal kejadian (≥ tanggal beli, ≤ hari ini) + alasan.
- **Dijual**: tanggal, alasan/pembeli, uang jual (≥ 0), masuk ke Tempat Uang mana. Menulis `cash_flow_entries`
  INCOME kategori "Jual aset" bila uang jual > 0.
- Tidak bisa dibalik. Bila keliru: Batalkan aset (1.4) lalu catat ulang.

### 1.4 Batalkan (Owner/GM)

Alasan wajib. Mengisi `cancelled_*` di aset dan di semua catatan Arus Kas tertaut (pola batal Arus Kas yang sudah
ada; saldo Tempat Uang kembali lewat jalur batal yang sama). Catatan Arus Kas kategori "Beli aset"/"Jual aset"
tidak bisa dibatalkan dari layar Arus Kas; pesannya menunjuk ke Keuangan › Aset.

### 1.5 Data (migrasi petshop `0068`)

```
petshop.fixed_assets
  id, name, asset_type (ELECTRONICS | MACHINE | FURNITURE | VEHICLE | LEASEHOLD_IMPROVEMENT),
  branch_id (null = Kantor), purchase_price integer, purchased_on date, useful_life_months integer (1–120),
  purchase_cash_flow_entry_id → cash_flow_entries (unik, wajib), proof_photo_url, note,
  status (IN_USE | DAMAGED | LOST | SOLD), disposed_on, disposal_reason, sale_amount integer,
  sale_cash_flow_entry_id → cash_flow_entries (unik), disposed_by, disposed_at,
  created_by, created_at, cancelled_at, cancelled_by, cancel_reason
```

- CHECK: harga ≥ 1.000.000; umur 1–120; `disposed_*` terisi bila status ≠ IN_USE; `purchased_on ≥ 2026-11-01`.
- Trigger: tolak DELETE; UPDATE hanya untuk pindah status dari IN_USE dan pengisian batal (pola trigger 0061).
- Kategori sistem baru: "Beli aset" (EXPENSE, NON_COST, `is_system`) dan "Jual aset" (INCOME, NON_INCOME,
  `is_system`).
- Hak baru `asset.manage` (catat) dan `asset.dispose` (ubah keadaan & batal); diberikan ke peran sesuai §0 butir 10.
  Menu di `sidebar.tsx` hanya satu baris tambahan; badge Baru di `lib/new-features.ts`.
- Rumus penyusutan & kerugian ditulis sekali sebagai fungsi murni di `packages/` atau disalin kecil ke Finance
  (diputuskan saat implementasi, mengikuti cara F2-6b membaca BO) dengan tes aturan.

### 1.6 Rumus

Untuk aset dengan harga H, umur N bulan, bulan beli B:
- Bagian bulan ke-k (k = 1…N) = `floor(H / N)`; bulan ke-N = `H − floor(H / N) × (N − 1)`.
- Sisa nilai di akhir bulan M = H − Σ bagian bulan B…M.
- Dilepas (rusak/hilang/dijual) di bulan D: penyusutan dihitung **sampai bulan sebelum D**; di bulan D,
  **Kerugian aset** = sisa nilai akhir bulan D−1 − uang jual. Hasil negatif = **Untung jual aset**. Dilepas di
  bulan beli: sisa nilai = H.
- Aset Dibatalkan tidak dihitung sama sekali.

Contoh: freezer Rp7.500.000, 4 tahun (48 bulan), beli 10 Nov 2026 → Rp156.250 per bulan Nov 2026–Okt 2030.
Dijual Rp3.000.000 pada Maret 2028: sudah menyusut 16 bulan (Nov 2026–Feb 2028) = Rp2.500.000, sisa Rp5.000.000,
kerugian Maret 2028 = Rp2.000.000.

## 2. Web Finance (F2-6d-2, khusus staging)

- **Laba Rugi**: kelompok biaya baru **Penyusutan aset** (per cabang/Kantor) dan baris **Kerugian aset**; Untung
  jual aset masuk Pendapatan lain. Rincian: per aset (nama, jenis, bagian bulan ini, sisa nilai) dengan tautan ke
  BO › Aset. Catatan Arus Kas "Beli aset" tetap tidak dihitung (sudah Bukan biaya). Kalimat "Beli aset tidak masuk
  biaya (penyusutan belum ada)" di Cara membaca diganti penjelasan penyusutan.
- **Setoran vs Laba**: penyusutan & kerugian aset masuk kelompok B sebagai "+ Penyusutan & kerugian aset (bukan
  uang keluar dari setoran)"; Untung jual aset ikut baris pendapatan lain. Pembelian aset sendiri tidak memengaruhi
  jembatan (tidak di laba, tidak dari setoran).
- `finance_app` diberi SELECT `petshop.fixed_assets`.

## 3. Tes

- Aturan (unit): bagian bulanan & sisa pembulatan; sisa nilai per bulan; kerugian/untung saat dilepas di bulan
  beli, tengah, dan sesudah umur habis (kerugian = 0 − uang jual → untung); aset batal tidak dihitung.
- Integrasi DB BO: catat aset menulis dua baris dalam satu transaksi; batal membatalkan Arus Kas tertaut; trigger
  menolak DELETE/ubah isi; kategori sistem tidak bisa dipakai/dibatalkan lewat Arus Kas.
- Integrasi DB Finance (sebagai `finance_app`): satu aset muncul di Laba Rugi cabangnya sebesar bagian bulanan.
- `pnpm migrations:check`, `pnpm typecheck` root. Tanpa tes UI otomatis (AGENTS.md).

## 4. Langkah uji owner

**F2-6d-1 (Back Office, staging):**
1. Catat aset "Freezer" Rp7.500.000, Elektronik/Mesin 48 bulan, satu cabang, dibayar dari satu rekening →
   tampil di daftar dengan Rp156.250/bulan; Arus Kas punya baris "Beli aset"; saldo rekening turun Rp7.500.000.
2. Catat aset Rp900.000 → ditolak (di bawah batas). Di Arus Kas, catat Biaya Rp1.200.000 → muncul kalimat bantu.
3. Ubah keadaan satu aset uji menjadi Dijual dengan uang jual → Arus Kas punya baris "Jual aset" masuk.
4. Batalkan satu aset → aset pindah ke tab Dibatalkan, baris Arus Kas tertaut berstatus Batal, saldo kembali.
5. Login sebagai Finance: bisa mencatat, tidak ada tombol ubah keadaan/batal.

**F2-6d-2 (Finance, staging):** Laba Rugi bulan ini menampilkan Penyusutan aset Rp156.250 di cabang freezer;
aset yang dijual menampilkan Kerugian/Untung aset; Setoran vs Laba tetap tanpa selisih baru dari aset.

## 5. Klaim & kunci

- F2-6d-1 `feat/fixed-assets` (dasar `origin/main`): kunci migrasi **petshop**; path
  `apps/backoffice/app/(dashboard)/assets/**`, `apps/backoffice/app/api/assets/**`,
  `apps/backoffice/lib/services/asset-*`, `packages/db/src/schema/fixed_assets.ts`, migrasi `0068_*`, baris tambahan
  di `sidebar.tsx`, `lib/authz.ts`, `lib/new-features.ts`, `packages/db/src/schema/index.ts`, entri Arus Kas
  (kalimat bantu & tolak batal kategori sistem).
- F2-6d-2 `feat/finance-asset-depreciation` (dasar `origin/dev_hris`): `apps/finance/modules/profit-loss/**`,
  `apps/finance/modules/deposit-bridge/**`, `apps/finance/app/laba-rugi/**`, `apps/finance/app/setoran-vs-laba/**`,
  grant `finance_app` di `packages/db-roles/src/roles.sql`.
