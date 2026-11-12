# F2-6c-2 Modul Finance — Setoran bebas vs laba

PRD: `docs/hris_planning/PRD/fase_2/07-modul-finance.md` §2 (baris "Setoran bebas vs laba") & §3,
`04-pelunasan-otomatis.md` §3. Lanjutan spec F2-6c (`2026-11-12-f2-6c-utang-setoran-bebas-dana-belum-cair-design.md`
§4, garis besar) dan F2-6b (`2026-11-12-f2-6b-laba-rugi-design.md`), keduanya di `origin/staging`.

Status: **disetujui owner 2026-11-12** ("ok", butir §0.1–7 mengikuti saran agent). Catatan urutan: spec F2-6c §0 butir 1 menaruh spec rinci ini sesudah
F2-6c-1 lolos uji. Owner 2026-11-12 meminta lanjut ke fase berikutnya sebelum F2-6c-1 di-push/diuji, jadi spec
ini disusun lebih dulu. **Implementasi tetap menunggu F2-6c-1 tayang staging dan lolos uji owner**, karena
jembatan ini memakai angka Laba bersih (F2-6b) dan Setoran bebas (F2-6c-1) apa adanya.

Tetap berlaku: web Finance khusus staging, hanya Owner/GM, hanya membaca (`finance_app` SELECT saja); mulai
**November 2026**; setiap angka punya **Cara membaca**; belum ada tutup bulan.

## 0. Keputusan yang diminta (saran agent)

| No | Hal | Keputusan (saran agent, ✅ owner 2026-11-12) |
|---|---|---|
| 1 | Susunan jembatan | Lima kelompok tetap (§2): **Barang**, **Biaya & pendapatan di luar setoran**, **Penjualan yang belum jadi setoran**, **Utang internal & rantai**, lalu **Selisih belum terjelaskan**. Setiap baris dihitung dari catatan sumbernya; selisih adalah sisa yang tampil terbuka |
| 2 | Baris "Barang" | Dihitung tepat sebagai *harga pokok + barang rusak ± penyesuaian modal − pelunasan utang belanja internal dari setoran*. Penjelasan "stok naik / utang internal bertambah / belanja supplier dibayar dari tempat lain" tampil sebagai **rincian bantu** di Cara membaca, dengan baris "lain-lain (opname, koreksi stok)" bila arus barang tidak pas. Alasan: potret stok awal bulan tidak tersimpan, jadi stok naik hanya bisa diperkirakan dari arus barang; angka jembatan utamanya tidak boleh ikut meleset |
| 3 | Beda bulan (laba menurut tanggal nota, setoran menurut tanggal setoran) | Baris sendiri **"Setoran bulan lalu masuk bulan ini / setoran bulan ini masuk bulan depan"** (tunai: tanggal tutup shift vs tanggal setor). Non-tunai tidak berpindah bulan karena setoran bebasnya memakai tanggal shift/hari; yang belum diverifikasi masuk baris "non-tunai belum diverifikasi / belum cair" |
| 4 | Batas selisih belum terjelaskan | **Kuning** bila > Rp100.000 **dan** > 1% penjualan bersih cabang; **merah** bila > 5%. Di bawah batas tetap tampil angkanya |
| 5 | Kolom Kantor & Gabungan | **Gabungan** ditampilkan (setoran bebas Gabungan = Σ cabang). Kantor tidak menyetor, jadi biaya Kantor muncul di Gabungan sebagai "biaya dibayar dari tempat lain". Kolom Kantor sendiri tidak ditampilkan |
| 6 | Pelunasan susulan (utang lama, F2-3b) | Baris sendiri **"Pelunasan susulan memakai setoran bulan-bulan lalu"** di bulan pelunasan itu dijalankan, karena uangnya berasal dari setoran Oktober, bukan penjualan bulan ini |
| 7 | Letak | Menu baru **Setoran vs Laba** di web Finance, plus tautan "Kenapa bukan laba?" dari Laba Rugi (baris Laba bersih) dan dari kotak Setoran bebas di Utang Antar Cabang |

## 1. Rumus dasar

Untuk satu cabang dan satu bulan:

- **Laba bersih** = angka F2-6b (penjualan bersih − harga pokok − barang rusak ± penyesuaian modal − biaya + pendapatan lain).
- **Setoran bebas** = angka F2-6c-1: setoran sendiri tingkat 1 + uang diteruskan dari rantai − dipakai melunasi utang internal.

Setoran bebas hanya bergerak lewat uang yang **benar-benar sampai** di Tempat Uang yang dipegang Finance. Laba
bergerak saat nota dibuat dan biaya dicatat. Jembatan menjelaskan setiap jalan uang yang berbeda di antara
keduanya.

## 2. Susunan layar (per cabang, satu bulan)

```
Laba bersih cabang (F2-6b)                                                   Rp …
A. Barang
   + Harga pokok, barang rusak, penyesuaian modal (bukan uang keluar dari setoran)
   − Pelunasan utang belanja ke cabang lain dari setoran (otomatis, F2-3)
B. Biaya & pendapatan di luar setoran
   + Biaya yang dibayar dari tempat lain (gaji, bongkaran, bensin, sewa mobil, Arus Kas, Biaya Rutin
     — semua biaya kecuali Pengeluaran Kasir)
   − Pendapatan lain (masuk lewat Arus Kas, bukan lewat setoran)
C. Penjualan yang belum jadi setoran terverifikasi
   − Penjualan ke cabang lain (dibayar lewat utang internal, bukan uang)
   − Piutang pelanggan bertambah (nota kredit − pelunasan piutang; bisa plus bila piutang turun)
   − Pengeluaran Kasir dari laci (termasuk yang belum dipasangkan kategori)
   − Selisih kas shift & selisih setoran (kurang/lebih)
   − Tunai shift bulan ini belum disetor / menunggu verifikasi
   + Tunai shift bulan lalu yang disetor bulan ini                 (§0 butir 3)
   − Non-tunai belum diverifikasi / belum cair
   − Setoran ke Tempat Uang yang tidak dipegang Finance (tidak melunasi, tidak jadi setoran bebas)
D. Utang internal & rantai
   + Uang setoran cabang lain yang diteruskan ke cabang ini (Toko Pusat/Gudang)
   + Pelunasan susulan memakai setoran bulan-bulan lalu            (§0 butir 6)
± Selisih belum terjelaskan
= Setoran bebas cabang (F2-6c-1)                                             Rp …
```

- Satu tabel: baris di atas × kolom cabang + Gabungan (seperti Laba Rugi). Baris bernilai nol di semua kolom disembunyikan.
- Setiap baris membuka **Cara membaca** (artinya, asal angka, hitungan dengan angka yang tampil, perlu diketahui)
  dan **rincian** daftar catatan asalnya (nota, shift, setoran, utang, biaya) dengan tautan ke BO/HRIS staging.
- Selisih belum terjelaskan diberi warna sesuai §0 butir 4 dan Cara membaca berisi daftar kemungkinan sebab
  (misalnya nota dibatalkan setelah setoran, refund tunai, setoran dikoreksi bulan berikutnya, pembulatan).
- Tanda di atas tabel memakai tanda Laba Rugi F2-6b (slip belum ditutup, Biaya Rutin belum dibayar, dll.)
  ditambah "Setoran bulan ini masih bisa berubah" bila ada shift/non-tunai yang belum diverifikasi.

## 3. Asal angka tiap baris

| Baris | Sumber | Bulan menurut |
|---|---|---|
| A harga pokok, rusak, penyesuaian | `profit-loss` F2-6b (dipakai ulang, bukan disalin) | sama dengan Laba Rugi |
| A pelunasan utang belanja | `deposit_settlements` tingkat cabang ini, `payable_id` terisi (pakai ulang `inter-branch-debts`) | tanggal uang setoran |
| B biaya / pendapatan lain | `profit-loss.loadCosts`, dikurangi butir `shift_expenses` | sama dengan Laba Rugi |
| C penjualan ke cabang lain | `profit-loss.loadInternalSales` per cabang | tanggal nota |
| C piutang pelanggan | nota `COMPLETED` dengan sisa kredit (`customer_debts`) − `debt_payments` (pelanggan non-internal) | tanggal nota / tanggal bayar |
| C Pengeluaran Kasir | `shift_expenses` semua kategori | tanggal catat |
| C selisih kas & setoran | shift: kas nyata − kas seharusnya; setoran: `cash_deposit_shortfalls` | tanggal tutup shift / tanggal setor |
| C tunai belum disetor & beda bulan | shift + `cash_deposit_shifts` + `cash_deposits` (rumus kas shift sama dengan BO `SHIFT_CASH`) | tanggal tutup shift vs tanggal setor |
| C non-tunai belum diverifikasi/cair | `pending-funds` F2-6c-1 dibatasi bulan | tanggal shift/hari |
| C setoran tidak ke Finance | `cash_deposits` / `noncash_verifications` terverifikasi dengan pemegang bukan Finance | tanggal setor |
| D diteruskan & susulan | `deposit_settlements` tingkat ≥ 2 / sumber `LEGACY_RUN` (pakai ulang `inter-branch-debts`) | tanggal uang setoran / tanggal jalan |

Tabel tambahan yang dibaca `finance_app` (SELECT): `cash_deposit_shifts`, `cash_deposit_shortfalls`, `shifts`
(bila belum), `customer_debts`, `debt_payments` (sudah dari F2-6c-1, diperiksa ulang saat implementasi). Bila
rincian bantu stok (§0 butir 2) disetujui: tabel penerimaan barang dari supplier dan penyesuaian stok — nama
pasti dicatat saat implementasi.

## 4. Teknis

- Branch `feat/finance-profit-deposit-bridge`, dasar `origin/dev_hris` **sesudah F2-6c-1 ada di sana**; merge
  lokal ke `dev_hris` → `staging`. Tanpa migrasi, tanpa PR ke `main`.
- Rumus murni di `apps/finance/modules/deposit-bridge/` (bertes), pembaca terpisah; memanggil `profit-loss`,
  `inter-branch-debts`, `pending-funds` yang sudah ada, tidak menyalin rumusnya lagi.
- Selisih belum terjelaskan = setoran bebas − (laba bersih + Σ baris A–D), dihitung dengan big.js.

### 4.1 Tes (non-UI)

- Rumus: satu bulan contoh dengan semua jenis baris → jumlah baris + selisih sama persis dengan setoran bebas;
  beda bulan tunai; pelunasan susulan; Gabungan = Σ cabang dan biaya Kantor masuk B; ambang warna selisih.
- Integrasi DB lokal: contoh data sederhana (nota tunai, nota kredit, Pengeluaran Kasir, setoran terverifikasi ke
  Finance, utang internal dilunasi) memberi **selisih nol**; `finance_app` tetap ditolak menulis.
- Typecheck root sekali pada kandidat akhir.

### 4.2 Langkah uji owner (staging)

1. Finance › Setoran vs Laba, bulan November, satu cabang: baris paling atas sama dengan Laba bersih di Laba
   Rugi, baris paling bawah sama dengan Setoran bebas di Utang Antar Cabang.
2. Buka baris Pengeluaran Kasir dan Piutang pelanggan: rinciannya cocok dengan BO staging.
3. Buat satu nota kredit di kasir staging → baris Piutang pelanggan bertambah sebesar nota, selisih tidak berubah.
4. Lihat Selisih belum terjelaskan tiap cabang; bila besar, bahas bersama sumbernya sebelum lanjut.

## 5. Klaim & urutan kerja

1. Spec disetujui → commit spec + klaim `feat/finance-profit-deposit-bridge` (`apps/finance`,
   `packages/db-roles`; tanpa kunci migrasi) dalam satu batch koordinasi → staging → push, **bersama atau sesudah
   push F2-6c-1** yang tertunda.
2. Implementasi sesudah F2-6c-1 lolos uji owner → `dev_hris` → `staging` → uji owner. Tetap di staging.

## 6. Di luar F2-6c-2

Tutup bulan; potret stok awal bulan (agar stok naik bisa dihitung pasti); hitung fisik kas; tampilan untuk Kepala
Toko; mengubah ambang warna dari layar Finance; web Finance produksi.
