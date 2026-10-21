# Desain: Hitung Ulang SO Besar (verifikasi pasca-persetujuan)

Tanggal: 2026-10-21
Branch: `feat/so-hitung-ulang`
Domain: Inventory & opname
Status: dissetujui owner, dalam pengerjaan

## Masalah

Setelah SO Besar (`type = FULL`) disetujui dan stok berubah, owner kadang **ragu**
apakah hitungan fisiknya benar. Belum ada cara menguji ulang selisih yang sudah
disetujui tanpa membuat SO polos baru yang (a) tidak tertaut ke SO asal dan (b)
nilainya ikut terjumlah di laporan sebagai "kehilangan baru" — padahal maksudnya
cuma **verifikasi / koreksi salah hitung**, bukan kerugian baru.

## Tujuan

Tombol **"Hitung Ulang"** pada SO Besar yang sudah `APPROVED`, yang membuat
**dokumen koreksi tertaut ke SO induk**, berlabel "Hitung Ulang dari SO-…", untuk
menghitung ulang fisik dan — bila perlu — mengoreksi stok, tanpa mencemari angka
kehilangan di laporan.

## Keputusan desain

| # | Keputusan | Pilihan |
|---|---|---|
| D1 | Model dokumen | Baris `stock_opnames` baru `type=FULL` + kolom `recount_of_so_id` → induk |
| D2 | Pembanding (hitung#1) | **Stok sistem terkini** saat item dikunci — otomatis menyerap semua transaksi antara SO induk dan hitung ulang |
| D3 | Penomoran | Nomor khas `SOR-YYYYMMDD-NNNN` agar terbaca di daftar |
| D4 | Lokasi input hitung#2 | **Langsung di Back Office** (reuse tabel input SO Besar), tidak lewat POS |
| D5 | Efek ke stok | **Mengoreksi stok** saat disetujui per item (reuse `applySOStockAdjustment`) |
| D6 | Laporan | **Dikecualikan** dari ringkasan nilai selisih; ditampilkan terpisah sebagai koreksi/verifikasi, tertaut ke induk |
| D7 | Transparansi | Kolom **"Mutasi sejak SO induk"** per item (dari `stockLedgerUnion`) menjelaskan kenapa stok sistem kini berbeda dari hitung#1 |

## Kenapa pembanding = stok sistem terkini (bukan angka hitung#1)

Stok sistem bergerak otomatis mengikuti tiap transaksi tercatat (jual, PO masuk,
retur, transfer). Membandingkan hitung#2 ke **stok sistem terkini** membuat semua
transaksi tercatat **saling meniadakan** — jadi transaksi di antara dua tanggal
TIDAK merusak perbandingan.

Contoh: stok awal 100 → SO#1 fisik 98 (disetujui, sistem jadi 98) → antara dua
tanggal terjual 30 & PO masuk 20 (sistem jadi 88) → hitung ulang membandingkan ke
**88**, bukan 98. Fisik#2 = 88 berarti cocok; 90 berarti SO#1 salah hitung −2
(dikoreksi +2); 85 berarti ada 3 hilang/belum tercatat.

Selisih hitung ulang = **(kesalahan hitung SO induk) + (kehilangan baru yang belum
tercatat)**. Keduanya tak bisa dipisah oleh angka saja, maka:

- Transaksi **tercatat** bukan masalah; yang jadi selisih hanya keluar-barang yang
  tidak tercatat (itu memang kehilangan nyata).
- Makin dekat ke tanggal SO induk, makin bersih selisihnya sebagai murni "salah
  hitung". Peringatan UI menegaskan ini — bukan "harus tanpa transaksi".

## Perubahan data

Migrasi `0047_so_recount_link`:

- `stock_opnames.recount_of_so_id integer NULL REFERENCES petshop.stock_opnames(id)`
  - NULL = SO biasa; terisi = dokumen hitung ulang yang menunjuk ke SO induk.
- Index parsial untuk menemukan dokumen hitung ulang milik sebuah induk.

Tidak ada kolom baru di `stock_opname_items` — kolom `recount*` yang ada di sana
adalah untuk hitung ulang **pra-persetujuan** di POS dan tidak dipakai di sini.

## Alur

1. Owner membuka detail laporan SO Besar yang `APPROVED`
   (`/reports/stock-opname/[id]`), menekan **"Hitung Ulang"**, mengisi **catatan
   wajib**, opsional menambah item "cocok" (selisih 0) bila tetap curiga.
2. Server (`POST /api/bo/stock-opnames/[id]/recount`) membuat header `SOR-…`
   (`type=FULL`, `status=PENDING`, `recount_of_so_id = induk`) dan menyalin
   **hanya item induk ber-selisih** (`varianceQty ≠ 0` & `itemStatus=APPROVED`),
   dengan `systemQty` dibaca dari stok terkini (`readSystemQty`) dan
   `physicalQty = systemQty` awal (selisih 0) menunggu diisi owner.
3. Dokumen muncul di daftar persetujuan SO (`/inventory/stock-opname`) dengan badge
   "Hitung Ulang dari SO-xxxx" + tautan ke induk. Owner mengisi fisik#2 di tabel
   input SO Besar yang sudah ada, melihat kolom "Mutasi sejak SO induk".
4. Owner memutuskan per item (Setujui/Tolak) lewat alur `/items/decide` yang ada;
   `closeFullSoIfResolved` menutup header otomatis dan `applySOStockAdjustment`
   mengoreksi stok ke fisik#2 untuk item yang disetujui.
5. Di laporan, dokumen hitung ulang dikecualikan dari ringkasan nilai selisih dan
   dari daftar produk bermasalah; ditampilkan terpisah sebagai koreksi.

## Transparansi: "Mutasi sejak SO induk"

Helper `getMovementSinceParent(parentCompletedAt, branchId, productIds)` memanggil
`stockLedgerUnion` (JANGAN disalin — satu sumber tunggal) dan menjumlah `qty_change`
per `product_id`/`uom_id` dengan `created_at > <SO induk disetujui>`, lalu konversi
ke satuan item SO memakai pola rasio UOM yang sama dengan `readSystemQty`. Dihitung
live saat layar review dibuka (tidak disimpan). Baseline setelah SO induk disetujui
agar penyesuaian OPNAME milik induk sendiri tidak ikut terhitung.

## Dikecualikan dari laporan (D6)

Di `lib/services/stock-opname-report.ts`, saring `recount_of_so_id IS NULL` pada:
`fetchHeaders` (ringkasan & daftar utama), agregasi `minusValue`/`plusValue`, dan
`mismatchProducts`. Dokumen hitung ulang diambil terpisah untuk ditautkan dari
detail SO induk.

## Risiko & batasan

- **R1 Double-count laporan** — exclusion harus di satu tempat + tes.
- **R2 Kehilangan baru vs salah hitung** — tak terpisah oleh angka; peringatan UI +
  stempel waktu; dianjurkan hitung ulang sedekat mungkin dengan SO induk.
- **R3 Resolusi induk** — bila SO induk sudah lewat resolusi (kerugian dibebankan ke
  karyawan), membalik stok lewat hitung ulang TIDAK otomatis membalik pembebanan
  uangnya. **Di luar cakupan**, dicatat untuk owner.
- **R4 Berkas magnet** `schema/stock_opnames.ts` + migrations → pegang kunci migrasi.
- **R5 Satuan (UOM)** — item hitung ulang pakai `uomId` yang sama dengan item induk;
  mutasi ledger dikonversi ke satuan itu.

## Bahasa

Semua label, pesan error, komentar, dan changelog dalam Bahasa Indonesia.
