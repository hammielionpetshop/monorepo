# F2-6c Modul Finance — Utang Antar Cabang, Dana non-tunai belum cair, Setoran bebas vs laba

PRD: `docs/hris_planning/PRD/fase_2/07-modul-finance.md` §2, `04-pelunasan-otomatis.md` §3 & §5,
`03-verifikasi-non-tunai.md` §3–§4. Lanjutan spec F2-6a (`2026-11-12-f2-6-modul-finance-design.md`) dan
F2-6b (`2026-11-12-f2-6b-laba-rugi-design.md`), keduanya di `origin/staging`.

Status: **disetujui owner 2026-11-12** ("ok", butir §0.1–7 mengikuti saran agent).

Tetap berlaku dari F2-6a/F2-6b: web Finance khusus staging, hanya Owner/GM, hanya membaca (role `finance_app`
SELECT saja); hitungan mulai **1 November 2026**; setiap angka punya **Cara membaca**; belum ada tutup bulan.

## 0. Keputusan yang diminta (saran agent)

| No | Hal | Keputusan (saran agent, ✅ owner 2026-11-12) |
|---|---|---|
| 1 | Urutan kerja | F2-6c dipecah dua: **F2-6c-1** Utang Antar Cabang + Dana non-tunai belum cair (membaca data yang sudah jelas) → uji owner → **F2-6c-2** Setoran bebas vs laba (layar penghubung, §4). Alasan: layar penghubung baru bisa dinilai owner setelah angka utang & setoran bebas di F2-6c-1 dipercaya |
| 2 | Utang lahir sebelum 1 Nov (utang lama, dilunasi manual / pelunasan susulan F2-3b) | **Ikut tampil** dengan tanda "utang lama"; bisa disaring. Tidak disembunyikan, karena itu yang paling ditakutkan owner (PRD 04 §7) |
| 3 | Kelompok umur & batas merah | Sama dengan BO › Utang Internal: **0–7 / 8–30 / >30 hari**, merah lewat batas pengaturan (sekarang **30 hari**, `auto_settlement_settings.redAgeDays`). Umur dihitung dari tanggal utang lahir |
| 4 | Tren | Sisa utang tiap cabang **per akhir minggu** (Senin–Minggu) sejak minggu 1 Nov s.d. minggu ini, dihitung ulang dari tanggal utang lahir & tanggal bayar — tanpa tabel baru |
| 5 | "Setoran bebas" di F2-6c-1 | Ditampilkan per cabang per bulan di halaman Utang Antar Cabang (angkanya sudah tercatat F2-3), bulan menurut **tanggal uang setoran**. Penjelasan "kenapa ≠ laba" menunggu F2-6c-2 |
| 6 | Dana non-tunai yang dihitung | Dua kelompok per rekening: **Belum cair** (Finance sudah menandai "Dana belum cair") dan **Belum diverifikasi** (penjualan non-tunai yang belum disentuh Finance). Merah lewat batas **2 hari** (`deposit_settings.awaitingFundsDays`) |
| 7 | Hubungan dengan halaman Saldo | Di Saldo, baris Rekening diberi keterangan kecil "+ Rp… dana belum cair/belum diverifikasi" dengan tautan; **saldo tidak berubah** (uang baru masuk saldo saat diverifikasi) |

## 1. Keadaan sekarang (diperiksa di kode `origin/dev_hris` 2026-11-12)

- Utang internal: `petshop.inter_branch_payables` (satu per kiriman PO Internal/IBT: `debtor_branch_id` penerima,
  `creditor_branch_id` pengirim, `total_amount`, `paid_amount`, status `UNPAID`/`PARTIAL`/`PAID`/`WAIVED`,
  `created_at` = tanggal lahir). Pembayaran `inter_branch_payments` (`amount`, `paid_at`, `source_type`: kosong =
  manual, `SETORAN`/`BATAL_SETORAN` otomatis F2-3, `RETUR_INTERNAL`/`SALDO_INTERNAL`/`BATAL_RETUR`, `BATAL_BAYAR`;
  pembalikan bernilai negatif). Penghapusan (`WAIVED`) tidak punya tanggal sendiri — memakai `updated_at`.
- Pelunasan otomatis & setoran bebas: `petshop.deposit_settlements` (`payable_id` kosong = **setoran bebas**
  `payer_branch_id`; sumber `CASH_DEPOSIT`/`NONCASH_VERIFICATION`/`LEGACY_RUN`; pembalikan negatif).
- Non-tunai: `petshop.noncash_verifications` (aktif = `superseded_at IS NULL`; `AWAITING_FUNDS` atau `VERIFIED`;
  `money_place_id` rekening tujuan, `expected_amount`). Baris yang belum disentuh Finance tidak punya catatan —
  BO menghitungnya dari nota `COMPLETED` + pelunasan piutang per shift/metode (`deposit-queries.listNoncashRows`)
  dan rekening tautan `payment_method_money_places`.
- Finance sekarang: Saldo, Mutasi, Arus Uang (F2-6a), Laba Rugi (F2-6b). Belum ada halaman utang/dana belum cair.

## 2. F2-6c-1 — Halaman **Utang Antar Cabang**

Menu baru di web Finance staging.

- **Ringkasan per cabang** (yang berutang): sisa utang total, banyak tagihan, tagihan paling lama (tanggal &
  umur), pembagian umur **0–7 / 8–30 / >30 hari**, merah bila ada yang lewat batas. Baris **Total semua**.
- **Pasangan cabang**: buka satu cabang → sisa per pemasok (mis. Toko A → Toko Pusat Rp…, Toko A → Gudang Rp…).
- **Daftar tagihan terbuka**: nomor IBT, tanggal lahir, umur, pemasok, total, sudah dibayar (dipisah: otomatis
  dari Setoran / manual / retur & saldo internal), sisa, tanda **utang lama** bila lahir sebelum 1 Nov. Tautan ke
  BO staging › Utang Internal. Saringan cabang, pemasok, umur, "utang lama".
- **Tren**: sisa utang tiap cabang per akhir minggu (§0 butir 4) dalam tabel kecil + garis sederhana. Sisa per
  tanggal T = Σ total utang lahir ≤ T − Σ pembayaran (termasuk pembalikan) dibayar ≤ T − utang `WAIVED` dengan
  `updated_at` ≤ T.
- **Setoran bebas per cabang** bulan pilihan (§0 butir 5): setoran terverifikasi masuk tingkat 1, dipakai melunasi
  utang (per pemasok), diteruskan ke pemasok berikutnya (rantai), sisa = setoran bebas. Tautan ke rincian Pelunasan
  setoran di BO staging.
- **Cara membaca** di tiap angka (susunan F2-6a). Wajib disebut terus terang bila berlaku: utang lama sebelum
  November hanya berkurang lewat bayar manual/pelunasan susulan; setoran ke tempat yang tidak dipegang Finance
  belum melunasi; penghapusan utang memakai tanggal terakhir diubah; setoran bebas bukan laba (menunggu F2-6c-2).

## 3. F2-6c-1 — Halaman **Dana Belum Cair**

Menu baru (atau tab di Saldo — dipilih saat implementasi sesuai ruang layar).

- **Per rekening** (Tempat Uang tujuan): jumlah & banyaknya baris **Belum cair** dan **Belum diverifikasi**,
  baris tertua & umurnya, merah lewat 2 hari. Total semua.
- Buka satu rekening → daftar per shift/hari × metode: cabang, tanggal, metode, angka sistem, status, umur;
  tautan ke BO staging › Setoran › Non-tunai.
- "Belum diverifikasi" untuk metode yang **belum ditautkan** ke rekening di cabang itu dikumpulkan di kelompok
  **"Rekening belum ditautkan"** (tidak hilang).
- Hitungan "belum diverifikasi" memakai rumus BO yang sama (disalin dengan tes kesetaraan terhadap
  `listNoncashRows`, atau dipindah ke package bersama bila tidak mengubah perilaku BO — pola F2-6b).
- Saldo: keterangan per rekening (§0 butir 7).
- **Cara membaca**: artinya (penjualan non-tunai yang uangnya belum dipastikan masuk rekening), asal angka
  (nota & pelunasan piutang non-tunai, catatan verifikasi Finance), hitungan, perlu diketahui (non-tunai baru
  dihitung sejak tanggal mulai Setoran 8 Nov; baris lewat batas biasanya dana tertahan atau lupa diverifikasi).

## 4. F2-6c-2 — **Setoran bebas vs laba** (garis besar; spec rinci sesudah F2-6c-1 lolos)

Satu layar per cabang per bulan yang menjelaskan selisih antara **Laba bersih** (F2-6b) dan **Setoran bebas**
(F2-6c-1) dengan baris yang bisa ditelusuri:

```
Laba bersih cabang (F2-6b)
+ Biaya yang dibayar dari tempat lain, bukan dari setoran cabang (gaji, bensin, sewa, Arus Kas, Biaya Rutin)
− Penjualan yang belum menjadi setoran terverifikasi bulan ini
     (piutang pelanggan bertambah, tunai belum disetor/menunggu, non-tunai belum diverifikasi/belum cair,
      selisih setoran, Pengeluaran Kasir dari laci) ± setoran bulan ini atas penjualan bulan lalu
− Stok naik (barang masuk dari supplier & cabang lain − harga pokok terjual − barang rusak)
+ Utang internal bertambah (barang sudah masuk, belum dilunasi)
− Belanja supplier yang dibayar dari tempat lain (cabang yang belanja langsung)
+ Uang setoran cabang lain yang diteruskan ke cabang ini (rantai pelunasan; Toko Pusat/Gudang)
± Selisih belum terjelaskan (ditampilkan terbuka, bukan disembunyikan)
= Setoran bebas cabang
```

Nilai stok bulanan dihitung dari arus barang (bukan potret stok), karena potret stok awal bulan tidak tersimpan.
Bila selisih belum terjelaskan besar, itu tanda ada sumber yang belum terbaca — dibahas bersama owner di spec
F2-6c-2.

## 5. Teknis F2-6c-1

- Branch `feat/finance-debts-pending-funds`, dasar `origin/dev_hris`; integrasi seperti F2-6a/F2-6b: merge lokal
  ke `dev_hris` → `staging`. **Tanpa migrasi, tanpa PR ke `main`.**
- Rumus murni di `apps/finance/modules/inter-branch-debts/` dan `apps/finance/modules/pending-funds/` (bertes),
  pembaca sumber terpisah dari layar.
- `packages/db-roles`: tambah SELECT `finance_app` untuk `petshop.inter_branch_payables`,
  `inter_branch_payments`, `inter_branch_transfers`, `deposit_settlements`, `transaction_payments`,
  `debt_payments`, `customer_debts`, `payment_method_money_places`, `shift_cashier_breakdown` (bila perlu), dan
  `app_settings` (hanya baris pengaturan yang dibaca; bila tidak bisa dibatasi baris, batas umur & batas hari
  disalin sebagai bawaan dengan catatan). Tetap SELECT saja.

### 5.1 Tes (non-UI)

- Rumus: kelompok umur & merah; sisa per tanggal (tren) dengan pembayaran, pembalikan, retur, `WAIVED`;
  utang lama bertanda; setoran bebas per cabang per bulan termasuk pembalikan koreksi; dana belum cair vs belum
  diverifikasi, metode belum ditautkan, merah lewat batas.
- Integrasi DB lokal: pembaca memberi baris yang benar untuk contoh data; sisa utang sama dengan BO › Utang
  Internal; angka belum diverifikasi sama dengan `listNoncashRows`; `finance_app` tetap ditolak menulis.
- Typecheck root sekali pada kandidat akhir.

### 5.2 Langkah uji owner (staging)

1. Finance › Utang Antar Cabang: sisa per cabang sama dengan BO staging › Utang Internal; utang lama bertanda.
2. Verifikasi satu setoran tunai cabang yang berutang di BO staging → sisa utang turun, setoran bebas muncul
   sesuai rincian Pelunasan; tren minggu ini berubah.
3. BO staging › Setoran › Non-tunai: tandai satu baris "Dana belum cair" → muncul di Dana Belum Cair rekening
   itu (kelompok Belum cair); verifikasi → hilang dan saldo rekening naik.
4. Cara membaca tiap angka menunjukkan hitungan dengan angka yang tampil dan tautan ke asalnya.

## 6. Klaim & urutan kerja

1. Spec disetujui → commit spec + WIP (F2-6b lolos uji owner; Pengeluaran Kasir tayang produksi 1.107.133) +
   klaim `feat/finance-debts-pending-funds` (`apps/finance`, `packages/db-roles`; tanpa kunci migrasi) dalam satu
   batch koordinasi → staging → push.
2. Implementasi → `dev_hris` → `staging` → uji owner. Tetap di staging.
3. Sesudah lolos: spec rinci F2-6c-2.

## 7. Di luar F2-6c

Tutup bulan; hitung fisik kas; tampilan Kepala Toko "utang ke Pusat"; mengubah batas umur/batas hari dari layar
Finance (Finance hanya membaca); web Finance produksi.
