# F2-6b Modul Finance — Laba Rugi bersih per cabang, Kantor & Gabungan

PRD: `docs/hris_planning/PRD/fase_2/07-modul-finance.md` §2–§5, `06-biaya-rutin-dan-sewa-mobil.md`,
`00-ringkasan-fase-2.md` §10 butir 8. Lanjutan spec F2-6a
(`docs/work/specs/2026-11-12-f2-6-modul-finance-design.md`, di `origin/staging`).

Status: **disetujui owner 2026-11-12** (butir 1 "ok", butir 2–8 "ok saya setuju").

Sudah diputuskan sebelumnya (F2-6a, owner 2026-11-12): web Finance khusus staging, hanya Owner/GM, hanya
membaca; **biaya bersama berdiri sendiri sebagai "Kantor"** — laba tiap cabang tanpa biaya bersama,
Gabungan = jumlah cabang − Kantor; tutup bulan belakangan.

## 0. Keputusan yang diminta (saran agent)

| No | Hal | Saran |
|---|---|---|
| 1 | Gaji masuk Laba Rugi bulan apa | ✅ owner 2026-11-12 — Slip bulanan 26 Okt–25 Nov = **November** (bulan akhir periode). Slip mingguan = bulan hari terakhirnya |
| 2 | Angka gaji yang dihitung | ✅ **Pendapatan slip** (gaji kotor, termasuk ritase & bonus), hanya slip yang **sudah ditutup**. Potongan (kasbon, denda, minus kas) tidak mengubah biaya di tahap ini |
| 3 | Gaji orang yang tempat kerjanya bukan cabang kasir | ✅ Masuk **Kantor** |
| 4 | Bensin & sewa mobil ditanggung siapa | ✅ **Cabang garasi Logistik** (bensin sudah dicatat begitu; sewa mobil ikut) |
| 5 | Biaya Rutin bulan itu belum dibayar | ✅ Tetap dihitung sebesar **tagihannya**, bertanda "belum dibayar" (sesuai PRD 06 §4) |
| 6 | Sewa mobil bulan itu belum dibayar | ✅ Tidak dihitung, bertanda "ada ritase, sewa belum dibayar" (rekapnya baru pasti saat dibayar) |
| 7 | Penjualan ke cabang sendiri di Gabungan | ✅ **Dikeluarkan** dari Penjualan dan Harga pokok Gabungan (laba tidak berubah, omzet tidak berlipat) |
| 8 | Bulan pertama | ✅ **November 2026** (sama dengan saldo Finance); bulan sebelumnya tidak ditawarkan |

## 1. Keadaan sekarang

- Back Office › **Laporan Laba Rugi** (`report-service.getProfitLossReport`) sudah menghitung per cabang:
  penjualan bersih (dikurangi retur dalam periode dan koreksi Revisi Harga Beli pengirim), harga pokok
  (HPP batch per baris nota), barang rusak, Penyesuaian Modal → "laba". **Belum ada biaya** di sana.
- Sumber biaya yang sudah tercatat:

| Biaya | Tabel | Cabang yang menanggung | Untuk bulan | Catatan |
|---|---|---|---|---|
| Arus Kas keluar jenis **Biaya** (termasuk Biaya Rutin yang dibayar) | `petshop.cash_flow_entries` + `cash_flow_categories.report_kind = 'COST'` | `branch_id`; kosong = **Bersama → Kantor** | `for_month` | Batal tidak dihitung |
| Arus Kas masuk jenis **Pendapatan lain** | sama, `report_kind = 'INCOME'` | sama | `for_month` | |
| Biaya Rutin belum dibayar | `recurring_costs` + `recurring_cost_amounts` − `recurring_cost_payments` | `branch_id`; kosong = Kantor | bulan tagihan | Yang sudah dibayar sudah ada di Arus Kas (tidak dihitung dua kali) |
| Pengeluaran Kasir (laci) | `petshop.shift_expenses` → `expense_categories.cash_flow_category_id` | cabang shift | tanggal shift (WIB) | Jenisnya ikut kategori Arus Kas pasangannya |
| Gaji | `hris.payslips` (CLOSED) | `payslips.branch_id` → `hris.branches.kasir_branch_id`; kosong = Kantor | §0 butir 1 | Ritase driver ada di slip (tidak dibaca lagi dari `trip_wages`) |
| Bongkaran | `hris.unloading_reports` aktif (`total_pay`) | `cost_branch_id` → cabang kasir; kosong = Kantor | `work_date` | Biaya menurut laporan, bukan pembayaran |
| Bensin | `logistics.fuel_fills` (tidak batal/diganti) | `charge_branch_id` → cabang kasir | `filled_on` | |
| Sewa mobil | `logistics.vehicle_rental_payments` (tidak batal, PAYMENT + TOP_UP) | cabang garasi (`logistics.config`) | `for_month` | |

- **Bukan biaya** (tidak masuk Laba Rugi): bayar supplier (sudah menjadi harga pokok saat barang terjual),
  kasbon, Pindah Dana, Arus Kas jenis "bukan biaya"/"bukan pendapatan" (uang diambil Owner, modal, pinjaman,
  beli aset).
- **Belum jelas jenisnya**: kategori Arus Kas lama yang jenis laporannya belum dipilih, dan kategori
  Pengeluaran Kasir yang belum dipasangkan — tidak dihitung, tampil sebagai tanda.
- Tabel Biaya Rutin dan Saldo awal ada di `main` tetapi belum di `dev_hris`; `dev_hris` perlu disinkronkan
  dengan `origin/main` (5 commit rilis) sebelum implementasi.

## 2. Halaman Laba Rugi (web Finance staging)

Menu baru **Laba Rugi** di samping Saldo dan Arus Uang.

- Pilih **bulan** (bawaan bulan berjalan; paling awal November 2026).
- Tabel kolom: tiap **cabang** · **Kantor** · **Gabungan**. Bisa dibuka satu kolom saja di layar sempit.
- Baris:

```
Penjualan bersih                 (sesudah retur & koreksi harga internal)
− Harga pokok
= Laba kotor
− Barang rusak
± Penyesuaian Modal
− Biaya
    per kategori Arus Kas jenis Biaya (Pengeluaran Kasir & Biaya Rutin masuk kategorinya)
    Gaji · Bongkaran · Bensin · Sewa mobil
+ Pendapatan lain               (per kategori)
= Laba bersih
```

- Kolom cabang: penjualan s.d. Penyesuaian Modal **sama persis** dengan BO › Laporan Laba Rugi untuk
  bulan dan cabang itu; biaya yang ditanggung cabang itu.
- Kolom **Kantor**: hanya biaya Bersama/tanpa cabang (dan pendapatan lain Bersama); tanpa penjualan.
- Kolom **Gabungan** = jumlah semua cabang − Kantor. Penjualan ke cabang sendiri (nota PO Internal/IBT)
  dikeluarkan dari Penjualan dan Harga pokok Gabungan dengan jumlah yang sama, sehingga laba kotor tidak
  berubah.
- **Tanda** di atas tabel (kuning, dengan tautan ke daftarnya):
  - Slip gaji bulan itu yang belum ditutup (banyak orang) — "laba belum final";
  - Biaya Rutin belum dibayar (dihitung sebesar tagihan);
  - Mobil sewa dengan ritase bulan itu yang sewanya belum dibayar (tidak dihitung);
  - Catatan "Belum jelas jenisnya" (jumlah & banyaknya);
  - Bensin tanpa cabang yang dibebani.
- Laba bersih minus ditampilkan merah, tanpa kata lain.

### 2.1 Cara membaca

Setiap angka (tiap sel tabel) punya **Cara membaca** dengan susunan F2-6a: **Artinya** · **Asal angka** ·
**Hitungan** dengan angka yang tampil · **Perlu diketahui** · **Lihat rincian →**. Yang wajib disebut terus
terang di "Perlu diketahui" bila berlaku:

- Gaji, bongkaran, bensin, sewa mobil berasal dari HRIS/Logistik yang **belum produksi** (data staging).
- Biaya dicatat **untuk bulannya**, bukan tanggal bayar (sewa Oktober dibayar 1 Nov → Oktober).
- Gaji periode 26–25 (butir §0.1); potongan slip tidak mengurangi biaya.
- Harga pokok memakai modal terbaru dari nota Gudang; harga nota internal yang salah membuat laba toko salah
  sampai Revisi Harga Beli.
- Gabungan: laba dari barang yang dikirim Gudang tetapi belum terjual toko sudah terhitung di Gudang.
- Beli aset tidak masuk biaya (penyusutan belum ada); angka bulan lalu bisa berubah karena belum ada tutup
  bulan.

### 2.2 Rincian

**Lihat rincian** membuka daftar baris asal satu sel (tanggal, keterangan, cabang, jumlah, tautan ke layar
asal BO/HRIS/Logistik staging), mis. "Gaji — Toko A — November": per slip (nama, periode, pendapatan).
Penjualan & harga pokok menautkan ke BO › Laporan Laba Rugi dengan bulan & cabang yang sama.

## 3. Teknis

- Branch `feat/finance-profit-loss`, dasar `origin/dev_hris` **sesudah** `dev_hris` disinkronkan dengan
  `origin/main`. Integrasi seperti F2-6a: merge lokal ke `dev_hris` → `staging`. Tanpa migrasi, tanpa PR ke
  `main`.
- Rumus murni di `apps/finance/modules/profit-loss/` (bertes), pembaca sumber terpisah dari layar.
- Penjualan, retur, harga pokok, barang rusak, Penyesuaian Modal: Finance memakai rumus BO yang sama.
  Bila memungkinkan tanpa menyentuh perilaku BO, bagian query dipindah ke package bersama; bila tidak,
  disalin dengan tes kesetaraan terhadap `getProfitLossReport`.
- `packages/db-roles`: tambah daftar baca `finance_app` untuk tabel yang dibaca (penjualan/retur/barang
  rusak, `shift_expenses`, `expense_categories`, Biaya Rutin, `hris.payslips`, `hris.unloading_reports`,
  `hris.branches`, `logistics.fuel_fills`, `logistics.vehicle_rental_payments`, `logistics.config`).
  Tetap SELECT saja.

### 3.1 Tes (non-UI)

- Rumus: susunan baris & laba bersih; Kantor hanya biaya Bersama; Gabungan = cabang − Kantor; pengeluaran
  penjualan internal di Gabungan tidak mengubah laba kotor; batal tidak dihitung; Biaya Rutin dibayar tidak
  dihitung dua kali; bulan gaji 26–25 dan slip mingguan; kategori belum jelas tidak dihitung.
- Integrasi DB lokal: tiap pembaca memberi baris yang benar untuk contoh data; kolom penjualan s.d.
  Penyesuaian Modal sama dengan `getProfitLossReport`; `finance_app` tetap ditolak menulis.
- Typecheck root sekali pada kandidat akhir.

### 3.2 Langkah uji owner (staging)

1. Buka Finance › Laba Rugi bulan November → kolom per cabang, Kantor, Gabungan tampil.
2. Cocokkan Penjualan s.d. Penyesuaian Modal satu cabang dengan BO staging › Laporan Laba Rugi November.
3. Catat satu Arus Kas keluar jenis Biaya untuk satu cabang dan satu untuk Bersama → muncul di kolom cabang
   dan Kantor; batalkan → hilang.
4. Biaya Rutin yang belum dibayar tampil sebesar tagihan bertanda; tandai dibayar → angkanya tetap satu kali.
5. Telusuri laba bersih satu cabang lewat Cara membaca sampai ke catatan asal; nilai apakah masuk akal
   (kriteria selesai PRD 07 §5).

## 4. Klaim & urutan kerja

1. Spec ini disetujui → commit spec + batch koordinasi (`docs/claim-f2-6b` → staging): klaim
   `feat/finance-profit-loss` (`apps/finance`, `packages/db-roles`; tanpa kunci migrasi).
2. Sinkronkan `dev_hris` dengan `origin/main` (merge lokal).
3. Implementasi → `dev_hris` → `staging` → uji owner. Tetap di staging.
4. Sesudah lolos: spec F2-6c (Utang antar cabang, Setoran bebas vs laba, Dana non-tunai belum cair).

## 5. Di luar F2-6b

Tutup bulan; penyusutan aset; pembagian biaya Kantor ke cabang; potongan slip (denda, minus kas, barang
hilang) sebagai pengurang biaya; minus kas sebagai biaya; Laba Rugi per minggu/periode bebas; ekspor;
Finance produksi.
