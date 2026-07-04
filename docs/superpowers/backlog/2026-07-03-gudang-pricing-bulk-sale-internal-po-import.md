# Backlog — Harga Modal Gudang + Import Internal PO ke Bulk Sale

**Tanggal:** 2026-07-03
**Konteks:** Cabang **Gudang** = "tangan pertama" (modal lebih kecil dari toko), menjual satuan besar
(sak, dus, dll) dan **hanya menginput transaksi lewat halaman Bulk Sale**.
**Sumber katalog:** `excel tools/DAFTAR PRODUK 03-07-2026.xlsx`

**Halaman terkait:**
- Bulk Sale: `apps/backoffice/app/(dashboard)/transactions/bulk-sale/`
- Bulk Sale API: `apps/backoffice/app/api/bo/bulk-sales/route.ts`, `.../bulk-sale-products/route.ts`
- Internal PO (IBT): `apps/backoffice/app/pos/(authenticated)/internal-order/`,
  `apps/backoffice/app/api/bo/internal-transfers/`
- Cost matrix: `apps/backoffice/app/(dashboard)/master-data/products/[id]/_components/cost-matrix-client.tsx`
- Harga jual: `apps/backoffice/app/(dashboard)/master-data/prices/`

---

## Yang sudah ada di kodebase (tidak perlu dibangun ulang)

| Kapabilitas | Lokasi | Catatan |
|---|---|---|
| Harga **jual** per cabang/UOM/tier | `productPrices` (`packages/db/src/schema/products.ts`) | unik per (produk, cabang, uom, tier) |
| Harga **modal** per cabang/UOM | `productUomCosts` | unik per (produk, cabang, uom) — inilah "modal gudang per UOM besar" |
| **HPP FIFO** per cabang | `productStockBatches.costPrice` + `packages/shared/src/utils/fifo-costing.ts` | Bulk sale sudah pakai ini via `TransactionService` → `StockService.deductStock` |
| **Internal PO (IBT)** end-to-end | `interBranchTransfers` + `.../internal-transfers/[id]/status/route.ts` | lifecycle `PENDING_APPROVAL → APPROVED → PREPARING → IN_TRANSIT → FULLY_RECEIVED` |
| Daftar IBT pending per cabang sumber | `GET /api/bo/internal-transfers?sourceBranchId=&status=` | siap dipakai untuk fitur import |
| Bulk sale matang | harga custom, diskon transaksi, hutang+DP, review dialog | lihat `2026-07-03-bulk-sale-enhancements.md` |

**Kesimpulan penting:** Infrastruktur harga per-cabang **sudah lengkap**. Kebingungan soal "harga modal
gudang" terjawab: modal gudang disimpan terpisah dari toko di `productUomCosts` (per UOM besar) dan/atau
otomatis dari FIFO batch penerimaan gudang. Perhitungan HPP-nya memang **mekanisme yang sama**, hanya
**nilainya berbeda** karena batch/cost gudang berbeda dari toko. Sisanya adalah pengisian data + fitur
import + penyesuaian akuntansi.

---

## Keputusan desain yang sudah dikunci (2026-07-03)

1. **Model gudang→toko = PENJUALAN (revenue gudang).** Desentralisasi P&L: gudang membukukan omzet & HPP
   gudang; harga jual gudang menjadi **harga modal toko**. Karena itu gudang input via Bulk Sale
   (masuk tabel `transactions`).
2. **Import IBT ke Bulk Sale = copy item saja; IBT tetap jalan terpisah** (lifecycle IBT sendiri).
   → **⚠️ Risiko dobel-potong stok** (lihat bagian Risiko). Wajib ada guard (item **G5**).
3. **HPP gudang = FIFO batch utama, `productUomCosts` (cost matrix) sebagai fallback/override** saat
   batch kosong.
4. **Entry point import = Opsi B** (mulai dari halaman Internal PO). Tombol **"Proses via Bulk Sale"**
   di detail IBT → navigasi ke bulk sale dengan `?fromIbt={id}`; cabang, item, customer auto-fill.
   Bulk sale langsung (grosir walk-in tanpa IBT) tetap ada. Alasan: tanpa picker, cabang auto dari
   `sourceBranchId`, dan "hapus validasi + tombol" terlokalisir di satu file.
5. **Validasi stok saat konfirmasi IBT dihapus** untuk alur ini — validasi stok terjadi di transaksi
   bulk sale (FIFO). Lihat item **G8**.
6. **History bulk sale dipisah via diskriminator, BUKAN tabel terpisah.** Tambah
   `transactions.sale_type` (`'RETAIL'` default | `'BULK'`) + `source_ibt_id` nullable. Field khusus
   bulk yang akan datang → tabel satelit 1:1 `bulk_sale_meta`, bukan fork mesin transaksi. Lihat **G9**.

---

## Sub-keputusan yang sudah dikunci (semula R1/R2/R3)

### R1 — Dobel-potong stok gudang → **DIKUNCI: skip pemotongan kedua**
Bulk sale memotong stok gudang (FIFO). IBT `ship` untuk IBT yang **sudah terkonversi** (punya
`converted_transaction_id`) **tidak** memotong stok gudang lagi; hanya menjalankan bagian stok-masuk
toko. → item **G5**.

### R2 — Stok masuk & modal toko → **DIKUNCI: Opsi (a)**
Toko terima lewat IBT `receive`, tapi `costPriceAtTransfer` diisi **harga jual gudang** (bukan HPP FIFO
gudang) agar modal toko = harga beli dari gudang. IBT `ship` tidak memotong stok gudang (sudah dipotong
bulk sale). → item **G7**.

### R3 — Toko sebagai customer → **DIKUNCI: 1 customer internal per cabang**
Buat 1 record `customers` per cabang internal (flag `is_internal_branch` + `linked_branch_id`) dan
mapping `branchId → customerId`. Saat import IBT, customer auto = customer milik `destinationBranchId`.
→ item **G6**.

---

## Urutan pengerjaan yang disarankan

`G1 → G2 → G3 → G9 → G4 → G8 → G5 → G6 → G7`

Alasan: benahi akurasi HPP dulu (G1), import data harga+modal gudang (G2), longgarkan guard tier (G3),
siapkan diskriminator history (G9) sebelum bulk sale gudang dipakai nyata. Baru fitur import IBT (G4) +
hapus validasi IBT (G8) + guard dobel-stok (G5). Loop akuntansi antar-cabang (G6, G7) terakhir.

---

## G1 — Fallback HPP ke cost matrix saat FIFO batch kosong
**Prioritas:** Tinggi · **Effort:** M · **Depends:** —

### Masalah
`TransactionService.createTransaction` menghitung COGS dari FIFO batch cabang. Saat batch gudang habis /
belum ada (oversell atau belum pernah terima supplier), `fifoDeduct` mengembalikan `shortfallQty` dan
porsi kekurangan itu **tidak diberi cost** → COGS understated → laba gudang menggelembung.

### Keputusan (dari #3)
Untuk porsi `shortfallQty`, ambil cost dari `productUomCosts` (cabang + UOM) sebagai fallback; jika tak
ada, pakai `products.defaultCostPrice`. Tetap catat shortfall untuk audit stok.

### Konvensi UOM yang WAJIB dipatuhi (terverifikasi di kode)
- `productUomCosts` menyimpan modal **per satuannya sendiri, apa adanya** (mis. SAK = 159.000), dibaca
  `eq(productUomCosts.uomId, uomId)` (`stock-service.ts:43`).
- Batch & COGS selalu **per base UOM**. Pembagian ÷ratio → per-base terjadi saat konsumsi
  (`stock-service.ts:300`: `cost_per_uomId / ratio`); perkalian ×ratio saat jual (`transaction-service.ts:110`).
- ⇒ Fallback ini **harus ÷ratio ke base**, bukan pakai angka matrix mentah.

### Scope teknis
- Pre-fetch `productUomCosts` untuk (branchId, productIds) di `transaction-service.ts` (sejajar dengan
  pre-fetch batch di sekitar baris 60–75).
- Saat `cogsResult.shortfallQty > 0`: `costPerBaseUom` = `productUomCosts(uom base)` **atau**
  `productUomCosts(uom besar) ÷ ratio` **atau** `defaultCostPrice`. Tambahkan
  `shortfallQty(base) × costPerBaseUom` ke `cogs` item. Pakai `big.js`, simpan integer.
- Verifikasi `StockService.deductStock` mengembalikan `shortfallQty` dalam base UOM (sudah, lihat
  `fifo-costing.ts:23`).

### Kriteria selesai
- [x] Bulk sale produk tanpa batch → COGS item = qty × cost matrix (bukan 0).
- [x] Ada batch tapi kurang → COGS = (batch FIFO) + (shortfall × cost fallback).
- [x] Laba-rugi (`report-service`) mencerminkan HPP fallback ini (agregasi `transactionItems.cogs`).
- [x] Unit test skenario: batch penuh, batch kurang, tanpa batch (+ fallback bertingkat, modal 0 diabaikan).
- [x] Update `CHANGELOG.md` (entri 1.39.0).

### ✅ SELESAI (2026-07-04)
Implementasi: helper `resolveFallbackCostPerBase` di `stock-service.ts` (prioritas: cost matrix UOM
dasar → cost matrix UOM besar ÷ ratio terbesar → `defaultCostPrice`; nilai ≤ 0 diabaikan), dipakai
`deductStock` untuk porsi shortfall **dan** batch tanpa modal. `transaction-service.ts` mem-prefetch
`product_uom_costs` per transaksi + meneruskan ratio dari `conversionsMap` (prefetched array kosong =
sudah dicek; `undefined` = query lazy saat dibutuhkan — jalur retur/adjustment/damaged-goods).
11 unit test hijau, `tsc --noEmit` bersih.

---

## G2 — Import harga gudang (JUAL + MODAL) dari sheet GUDANG
**Prioritas:** Tinggi · **Effort:** M · **Depends:** — · **(gabungan G2+G3 lama)**

### Struktur sumber (`DAFTAR PRODUK 03-07-2026.xlsx`, sheet `GUDANG`) — TERVERIFIKASI
Layout **berbeda dari TOKO PUSAT** (HARGA BELI di depan tiap satuan), kolom (0-indexed):
```
0 NAMA
1 HARGA BELI(g1) | 2 SAT1 | 3 A | 4 B | 5 C | 6 KONV(g1)
7 HARGA BELI(g2) | 8 SAT2 | 9 A |10 B |11 C |12 KONV(g2)
                  13 SAT3 |14 A |15 B |16 C |17 KONV(g3)   ← grup 3 TANPA HARGA BELI
```
1.041 baris bernama. Baris SAT1 (mis. KG) sering kosong — gudang jual satuan besar (SAK/DUS/BOX/PACK).

### Keputusan
- **Tier: reuse yang sudah baku** — `A=RETAIL, B=RESELLER, C=GROSIR` (lihat `import-daftarproduk.js:41`).
  **Tidak ada tier baru**; cukup `branch_id = gudang` (id=2). Tanpa perubahan schema.
- **Modal (HARGA BELI) disimpan APA ADANYA per UOM** ke `productUomCosts` (keyed by UOM tsb) —
  **tidak dibagi konversi** (division ÷ratio terjadi otomatis saat konsumsi, lihat G1 & `stock-service.ts:300`).
- **Match produk by name** — hanya tambah harga/modal gudang, **jangan buat/ubah produk**.

### Keputusan hasil analisis data (2026-07-03) — profil temuan
| Temuan | Jumlah | Keputusan |
|---|---|---|
| Nama match `products` | 953 | impor |
| Nama tak match (gudang-only, mis. PW CRYSTAL 10L/25L/55L) | 86 | **Skip + laporkan** ke file; tak buat produk |
| Konversi hilang (gudang jual unit besar, konversi belum ada) | 26 | **Auto-buat** `product_uom_conversions` dari kolom KONVERSI **jika terisi**; jika KONVERSI kosong → skip unit + laporkan |
| Konversi bentrok (ratio DB ≠ sheet) | 26 | **Rekonsiliasi manual** — lihat hasil di bawah; default import tetap pertahankan DB |
| Jual tanpa HARGA BELI | 136 | Impor harga saja; modal kosong → fallback G1 (`defaultCostPrice`) |
| UOM tak dikenal (`DUS'` typo) | 1 | skip + laporkan |

⚠️ **Konversi itu global per-produk (bukan per-cabang)** — inilah sebab konflik ratio TIDAK boleh ditimpa sembarangan.

### Rekonsiliasi 26 konflik ratio (2026-07-04) — SELESAI
Metode: (a) hitung harga per-satuan-dasar dari harga paket ÷ tiap kandidat ratio, jangkar ke modal & retail
dasar di DB; (b) bandingkan konversi Gudang sheet vs **TOKO PUSAT sheet** vs DB.
Skrip: `_reconcile_ratio.js`, `_compare_tokopusat.js`, `_units_by_source.js`.

**Temuan kunci:** DB = TOKO PUSAT sheet **persis** di semua 26 baris. Jadi konflik itu bukan error DB, melainkan
**sheet Gudang vs sheet Toko Pusat** yang mengisi angka berbeda. Rincian satuan per sumber:

| Kelompok | Produk | Gudang | Toko Pusat = DB | Sifat konflik |
|---|---|---|---|---|
| **1** (5) | BERAS MERAH BIASA/SP (SAK), LIFECAT DRY, LUCKY CAT CURAH, PHOENIX PERKUTUT | 2 / 24 / 40 / 50 | 50 / 20 / 20 / 20 | Gudang **salah ketik** (ratio sheet bikin harga di bawah modal). |
| **2** (18) | Semua `MEO PC …` (DUS) | 12 | 24 | Beda **makna "DUS"** antar cabang (Gudang inner-box 12 vs Toko karton 24). |
| **3** (3) | PUSSBITE MB/SALMON/TUNA 400GR (SAK) | 40 | 50 | Beda **makna "SAK"** antar cabang. |

**KEPUTUSAN USER (2026-07-04): DB always win untuk satuan.** Ratio DB dipertahankan untuk semua 26
konflik (= perilaku skrip sekarang, tak perlu ubah kode). Gudang sheet yang bentrok diabaikan.

**Harga satuan besar MEO & PUSSBITE tetap diimpor apa adanya** (user: admin koreksi via management UI
nanti). Konsekuensi diketahui & diterima: dengan ratio DB, HPP/stok satuan-besar Gudang untuk 18 MEO
(DUS=24) & 3 PUSSBITE (SAK=50) tidak sinkron dengan harga paketnya → margin/paper-loss & potong-stok
salah sampai dikoreksi manual. **MEO paling parah** (jual 1 DUS potong 24 pcs, HPP ~135rb utk harga 70rb).

**PENDING terpisah (non-blocking):** base `GRAM` ambigu — sebagian produk maksudnya **500 gram**, sebagian
pure gram. User akan kirim daftar mana yang 500gr. Perlu review produk ber-base GRAM (mis. BERAS MERAH)
setelah daftar diterima; tidak menghalangi import.

### Scope teknis
- Skrip `apps/excel-tools/import-gudang.js` (pola `import-daftarproduk.js`, `branch=Gudang`): DRY-RUN default,
  `--execute` untuk commit. Per baris, per satuan (grup) →
  1. **Match by name** ke `products`; tak match → catat ke laporan, skip baris.
  2. **Konversi**: untuk unit non-base yang punya harga → jika konversi produk belum ada & KONVERSI sheet
     terisi → INSERT `product_uom_conversions`. Jika sudah ada & ratio beda → **jangan timpa**, catat konflik.
     Jika belum ada & KONVERSI kosong → skip unit + catat.
  3. **Harga**: upsert `product_prices` (A/B/C non-null) ON CONFLICT `product_prices_unique_tier`.
  4. **Modal**: upsert `product_uom_costs` (HARGA BELI non-null, apa adanya per UOM) ON CONFLICT
     `product_uom_costs_unique_product_branch_uom`.
- Idempotent, transaksional (`BEGIN`/`COMMIT`/`ROLLBACK`). Tulis laporan lengkap (unmatched, konv-hilang,
  konv-bentrok, tanpa-modal, UOM-tak-dikenal) ke `apps/excel-tools/import-gudang-report.txt`.
- **INSERT di-batch multi-row (chunk 1000) + dedupe kunci konflik**, bukan per-baris. Perbaikan 2026-07-04:
  versi awal (1.617 INSERT sekuensial dlm 1 transaksi) rapuh terhadap koneksi remote internet — pernah
  hang (proses di-background mid-transaksi → event-loop suspend, transaksi menggantung + lock) & pernah
  "Connection terminated". Batch → ~5 round-trip, <1 dtk, kokoh. **JALANKAN FOREGROUND, jangan di-background.**
- Audit `cost-matrix-client.tsx` + `.../products/[id]/costs/route.ts`: modal gudang per UOM besar tampil & editable.
- Verifikasi `bulk-sale-products/route.ts` mengembalikan harga & UOM besar gudang (sudah query per `branchId`).

### ✅ IMPORT DIJALANKAN (2026-07-04)
`node import-gudang.js --execute` sukses commit. Verifikasi DB cabang Gudang (id=2):
`product_prices=1214` (415 produk), `product_uom_costs=367`, `product_uom_conversions +19` (global 451→470).
Selisih dari rencana (1226/372) = dedupe kunci konflik dari 2 nama duplikat sheet. Ratio bentrok tak berubah.

**CSV koreksi admin:** `apps/excel-tools/koreksi-admin-gudang.csv` (245 baris, action-oriented) — skrip
`export-admin-corrections.js`. Rincian: PRODUK_BARU 86, MODAL_KOSONG 125, RATIO_CEK_FISIK 21 (MEO+PUSSBITE),
SATUAN_DISKIP 7, SATUAN_TYPO 1, SHEET_TYPO_INFO 5 (kelompok-1, tak perlu tindakan).

### Kriteria selesai
- [x] Import mengisi `productPrices` (A/B/C) + `productUomCosts` + `productUomConversions` (baru) gudang.
- [x] Laporan `import-gudang-report.txt`: unmatched(86), konv-hilang(7), konv-bentrok(26), tanpa-modal(123).
- [x] Ratio konversi DB yang bentrok TIDAK berubah setelah import.
- [x] CSV koreksi admin (`koreksi-admin-gudang.csv`) untuk tindak lanjut manual.
- [x] Cari produk di bulk sale (cabang gudang) menampilkan harga jual UOM besar.
- [x] Modal gudang per UOM tampil & editable di cost matrix (tempat admin isi MODAL_KOSONG).
- [x] Update `CHANGELOG.md` (entri 1.38.1).

### ✅ VERIFIKASI UI (2026-07-04) — G2 SELESAI
- **Bulk sale:** `bulk-sale-products/route.ts` mengembalikan `prices` (semua tier) + `productUomCosts`
  per `branchId` dan `availableUoms` = base + semua konversi; `bulk-sale-item-row.tsx` merender dropdown
  UOM & tier dari data itu. Sampel DB Gudang valid (BERAS MERAH SAK 322,5–327,5rb; MEO PC DUS 62,5–70rb).
- **Cost matrix:** `page.tsx` membangun `uomsForPricing` = base + semua konversi; GET/PUT
  `master-data/products/[id]/costs` per cabang; edit hanya OWNER/GM.
- **Cek keamanan PUT delete-reinsert:** 0 baris modal/harga Gudang "yatim" (UOM tanpa konversi) —
  tidak ada data yang bisa terhapus diam-diam saat admin menyimpan cost matrix.
- ✅ Guard tier yang dulu membatasi MANAGER ke RETAIL saat menyimpan transaksi sudah dilonggarkan di **G3**
  (lihat di bawah) — kasir/manajer Gudang kini bisa jual tier GROSIR/RESELLER.

---

## G3 — Longgarkan guard tier bulk sale (semua role boleh semua tier)
**Prioritas:** Tinggi · **Effort:** S · **Depends:** —

### Masalah & keputusan
`isAllowedPriceTierForRole` (`bulk-sales/route.ts:85-88` & `bulk-sale-products/route.ts`) membatasi role
non-global hanya tier RETAIL. Gudang jual di GROSIR/RESELLER. **Keputusan: semua role yang diizinkan
bulk sale boleh memilih semua tier** (RETAIL/RESELLER/GROSIR). Aturan harga custom (B1) tetap berlaku.

### Scope teknis
- Longgarkan/hapus `isAllowedPriceTierForRole` sehingga tidak memblok tier per role di kedua route.
- Pastikan tidak melemahkan guard harga custom B1 (MANAGER hanya boleh menaikkan) — itu terpisah dari
  pemilihan tier.
- (Opsional UX) default tier gudang di bulk sale = GROSIR.

### Kriteria selesai
- [x] Role non-global bisa memilih tier GROSIR/RESELLER di bulk sale.
- [x] Guard harga custom B1 tetap utuh.
- [x] Test server untuk pemilihan tier lintas role.
- [x] Update `CHANGELOG.md` (entri 1.40.0).

### ✅ SELESAI (2026-07-04)
`isAllowedPriceTierForRole` **dihapus** dari `bulk-sales/route.ts` (satu-satunya gate; `bulk-sale-products`
ternyata tak pernah memfilter tier — mengembalikan semua tier per cabang). Tier yang tak punya harga di
cabang ditolak otomatis lewat guard `INVALID_PRICE` yang sudah ada (400). Guard harga custom B1
(`unitPrice < basePrice` untuk role non-global → `PRICE_BELOW_TIER`) tetap utuh. Client sudah menampilkan
semua tier dari `availablePrices` tanpa filter role → tanpa perubahan UI. Test: `route.test.ts` — MANAGER
pakai GROSIR kini 201 (dulu 403), + test baru "tier tanpa harga di cabang → 400". 17 test file hijau,
`tsc` bersih.
- **Opsi UX default tier Gudang = GROSIR: DITUNDA** (nice-to-have; berisiko bila produk tak punya tier
  itu — default sekarang = tier harga base UOM pertama).

---

## G4 — Import Internal PO (IBT) → Bulk Sale (Opsi B: mulai dari IBT) ✅ SELESAI (1.43.0)
**Prioritas:** Tinggi · **Effort:** L · **Depends:** G2 (harga gudang), G9 (diskriminator)

### Keputusan (dari #4)
Tombol **"Proses via Bulk Sale"** di halaman **detail IBT** (bukan picker di bulk sale). Klik →
navigasi `transactions/bulk-sale?fromIbt={id}`. Bulk sale membaca param saat mount → fetch IBT →
auto-fill **cabang** (`sourceBranchId`), **item** (produk, UOM, qty), **customer** (toko tujuan, G6).
Harga auto dari `productPrices` tier gudang (boleh diedit sesuai aturan role B1). Copy-only: **tidak**
mengubah status IBT; simpan `source_ibt_id` di transaksi untuk guard G5. Bulk sale langsung (tanpa
`fromIbt`) tetap jalan seperti biasa untuk grosir walk-in.

### Scope teknis
- **Tombol + akses:** `internal-transfer-detail-client.tsx` — tombol hanya untuk role cabang pengirim
  (gudang) / global, saat status IBT masih pending (`PENDING_APPROVAL`/`APPROVED`) & belum terkonversi.
- **API detail item:** reuse `GET /api/bo/internal-transfers/[id]` (ambil `interBranchTransferItems`).
- **Prefill bulk sale:** `bulk-sale-client.tsx` baca `fromIbt` (useSearchParams). Fetch IBT + resolve
  produk/harga via `bulk-sale-products` (atau endpoint batch by ids) → set cabang, keranjang, customer.
  Tampilkan banner "Dari Internal PO {ibtNumber}" + tombol batal (kembali ke bulk sale kosong).
- **Simpan tautan:** payload `POST /api/bo/bulk-sales` kirim `sourceIbtId` → `transactions.source_ibt_id`
  (kolom dari G9) + set `sale_type='BULK'`. Isi `converted_transaction_id` di IBT (untuk G5).
- Edge: qty > stok gudang → biarkan validasi/oversell existing; produk nonaktif/tanpa harga gudang →
  tandai & skip dengan pesan, tidak menggagalkan seluruh prefill.

### Kriteria selesai
- [x] Tombol "Proses via Bulk Sale" muncul di IBT pending milik gudang; tidak muncul untuk role toko.
- [x] Klik → bulk sale terbuka dengan cabang & item terisi otomatis (customer manual — auto toko tujuan menyusul di G6).
- [x] `source_ibt_id` & `sale_type='BULK'` tersimpan; IBT tertaut `converted_transaction_id`.
- [x] Item tanpa harga/nonaktif dilaporkan, tidak menggagalkan seluruh prefill.
- [x] Bulk sale tanpa `fromIbt` tetap berfungsi normal.
- [x] Test API + kalkulasi.
- [x] Update `CHANGELOG.md`.

### ✅ SELESAI (2026-07-04)
Migrasi drizzle `0003_cheerful_stellaris.sql` menambah `inter_branch_transfers.converted_transaction_id integer NULL`
(kolom polos di schema untuk hindari import melingkar dengan `transactions`; **belum di-apply ke DB remote**, jalankan
`pnpm --filter @petshop/db db:migrate`). Tombol "Proses via Bulk Sale" di `internal-transfer-detail-client.tsx`
(role OWNER/GM/MANAGER di cabang **pengirim mana pun** — tidak dikunci ke Gudang; toko→toko pun bisa —, status pending,
belum terkonversi) → `transactions/bulk-sale?fromIbt={id}`.
`bulk-sale-client.tsx` membaca `fromIbt` (Suspense), fetch IBT + `bulk-sale-products?ids=` (mode batch baru), set cabang
& baris; item tanpa harga/nonaktif di-skip + dilaporkan di banner. `POST /api/bo/bulk-sales` menerima `sourceIbtId`
dengan guard (cabang cocok, belum dibatalkan, belum terkonversi→409). Penautan `converted_transaction_id` dilakukan
`TransactionService.createTransaction` di dalam transaksi DB yang sama (atomik, hanya bila IBT belum terkonversi).
**Customer auto-pilih toko tujuan DITUNDA ke G6** (butuh `customers.linked_branch_id`); sekarang operator pilih manual,
banner menampilkan nama toko tujuan. 198 test backoffice hijau, `tsc` bersih, drizzle no-drift.

---

## G5 — Guard dobel-potong stok (mitigasi R1)
**Prioritas:** Tinggi · **Effort:** M · **Depends:** G4

### Masalah
IBT yang sudah di-import & terjual via bulk sale (`source_ibt_id` terisi) tidak boleh lagi memotong
stok gudang saat `ship` — kalau tidak, stok keluar dua kali.

### Keputusan (DIKUNCI, dari R1)
Izinkan lifecycle IBT lanjut, tapi untuk IBT terkonversi (`converted_transaction_id` terisi) langkah
`ship` **skip pemotongan stok gudang** (sudah dipotong bulk sale); hanya jalankan bagian stok-masuk
toko (G7).

### Scope teknis
- Tandai IBT terkonversi: kolom `inter_branch_transfers.converted_transaction_id` (nullable) diisi saat
  bulk sale G4 disimpan.
- `.../internal-transfers/[id]/status/route.ts` aksi `ship`: jika IBT terkonversi → jangan panggil
  pemotongan stok gudang; beri badge/peringatan di UI detail IBT.
- UI `internal-transfer-detail-client.tsx`: badge "Sudah dijual via Bulk Sale #___" + peringatan
  sebelum ship.

### Kriteria selesai
- [ ] IBT terkonversi menampilkan tautan ke transaksi bulk sale.
- [ ] Ship IBT terkonversi tidak memotong stok gudang dua kali (sesuai keputusan final).
- [ ] Test transisi status untuk IBT terkonversi.
- [ ] Update `CHANGELOG.md`.

---

## G6 — Representasi toko sebagai customer (DIKUNCI: R3)
**Prioritas:** Sedang · **Effort:** M · **Depends:** G4

### Tujuan
Karena gudang→toko = penjualan, customer bulk sale hasil import IBT harus = **toko tujuan** IBT.

### Scope teknis (R3: 1 customer internal per cabang)
- Tambah kolom `customers.is_internal_branch` (boolean) + `customers.linked_branch_id` (nullable FK
  ke `branches`). Migrasi non-breaking.
- Seed 1 record customer per cabang internal (toko), tautkan `linked_branch_id`.
- Di G4, saat prefill dari IBT: auto-pilih customer yang `linked_branch_id = destinationBranchId`.

### Kriteria selesai
- [ ] Import IBT otomatis memilih customer = toko tujuan.
- [ ] Laporan penjualan gudang bisa difilter per toko (customer internal).
- [ ] Update `CHANGELOG.md`.

---

## G7 — Modal toko = harga jual gudang (DIKUNCI: R2 opsi a)
**Prioritas:** Sedang · **Effort:** L · **Depends:** G4, G6

### Tujuan
Menutup loop akuntansi desentralisasi: saat toko menerima barang (IBT `receive`), modal (HPP) toko =
**harga yang ditagihkan gudang** (harga jual bulk sale), bukan HPP FIFO gudang.

### Scope teknis (R2a)
- Saat konversi (G4): isi `interBranchTransferItems.costPriceAtTransfer` = harga jual gudang per base
  UOM (dari item bulk sale terkait), bukan HPP FIFO gudang.
- IBT `receive` membuat batch masuk toko `costPrice = costPriceAtTransfer` (perilaku existing sudah
  begitu — cukup pastikan nilainya harga jual gudang).
- IBT `ship` untuk IBT terkonversi tidak memotong stok gudang (selaras G5).

### Kriteria selesai
- [ ] Batch masuk toko memakai harga beli dari gudang sebagai modal.
- [ ] P&L gudang (untung) & P&L toko (modal lebih tinggi) konsisten, tanpa dobel stok.
- [ ] Test valuasi stok toko + laba-rugi kedua cabang.
- [ ] Update `CHANGELOG.md`.

---

## G8 — Hapus validasi stok di konfirmasi IBT (untuk alur bulk sale)
**Prioritas:** Sedang · **Effort:** S · **Depends:** G4

### Keputusan (dari #5)
Validasi/pengecekan stok saat konfirmasi IBT dihapus untuk IBT yang diproses via bulk sale — validasi
stok nyata terjadi di transaksi bulk sale (FIFO). Menghindari validasi ganda & menyederhanakan alur.

### Scope teknis
- `internal-transfer-detail-client.tsx` + `.../internal-transfers/[id]/stock-check/route.ts`: untuk IBT
  yang diarahkan ke bulk sale, lewati langkah stock-check di konfirmasi.
- Pastikan tidak menghapus stock-check untuk IBT non-bulk (transfer murni tetap butuh cek stok saat
  ship). Bedakan via `converted_transaction_id`/jalur bulk sale.

### Kriteria selesai
- [ ] IBT jalur bulk sale tidak lagi menampilkan/blokir di stock-check konfirmasi.
- [ ] IBT transfer murni (non-bulk) tetap tervalidasi seperti sebelumnya.
- [ ] Update `CHANGELOG.md`.

---

## G9 — Pisahkan history bulk sale via diskriminator ✅ SELESAI (1.42.0)
**Prioritas:** Tinggi · **Effort:** M · **Depends:** — (fondasi untuk G4)

### Keputusan (dari #6)
Bukan tabel terpisah. Tambah diskriminator + tautan IBT di `transactions`; field khusus bulk yang akan
datang → tabel satelit 1:1 `bulk_sale_meta`.

### Scope teknis
- Migrasi: `transactions.sale_type varchar(10) NOT NULL DEFAULT 'RETAIL'` (`'RETAIL' | 'BULK'`) +
  `transactions.source_ibt_id integer NULL` (FK `inter_branch_transfers`). Index pada `sale_type`.
- `TransactionService.createTransaction` & `bulk-sales/route.ts`: set `sale_type='BULK'` + `source_ibt_id`.
- History & laporan: bulk sale punya view/filter sendiri; pastikan laba-rugi (`report-service`) tetap
  mengagregasi kedua tipe (atau bisa dipisah per tipe sesuai kebutuhan).
- (Opsional, saat dibutuhkan) tabel `bulk_sale_meta(transaction_id PK/FK, …field khusus…)`.

### Kriteria selesai
- [x] Semua transaksi retail existing tetap `sale_type='RETAIL'`; bulk sale baru `'BULK'`.
- [x] History bulk sale bisa ditampilkan terpisah dari retail.
- [x] Laporan laba-rugi tidak berubah nilainya akibat migrasi (backfill benar).
- [x] Update `CHANGELOG.md`.

### ✅ SELESAI (2026-07-04)
Migrasi drizzle `0002_deep_sue_storm.sql` menambah `transactions.sale_type varchar(10) DEFAULT 'RETAIL' NOT NULL`
+ index `idx_transactions_sale_type` + `transactions.source_ibt_id integer NULL` (FK `inter_branch_transfers`).
Non-breaking: DEFAULT membackfill semua baris lama ke `RETAIL`. **Migrasi belum di-apply ke DB remote**
(jalankan `pnpm --filter @petshop/db db:migrate` saat siap).
- **Write:** `TransactionService.createTransaction` set `sale_type` (`'BULK'` bila payload minta, else `'RETAIL'`)
  + `source_ibt_id`; `bulk-sales/route.ts` kirim `saleType:'BULK'` + terima `sourceIbtId` opsional (dipakai G4).
- **Read/history:** `GET /api/bo/transactions?saleType=RETAIL|BULK` (validasi 400 bila lain) + field `saleType`
  per baris; UI Riwayat Transaksi punya filter "Jenis Penjualan" + badge "Bulk".
- **Laba-rugi:** `report-service` tidak diubah — tetap mengagregasi semua `COMPLETED` lintas tipe → nilai tak berubah.
- Test: `bulk-sales/route.test.ts` (18 hijau) memverifikasi `saleType:'BULK'` + penerusan `sourceIbtId`. `tsc` bersih.
- Tabel satelit opsional `bulk_sale_meta` **belum dibuat** (baru saat ada field khusus bulk — sesuai keputusan #6).

---

## Catatan lintas-item
- Semua pesan error/label dalam **Bahasa Indonesia**.
- Kalkulasi harga/HPP pakai **big.js**, simpan **integer**.
- Query Drizzle pakai helper dari `@/lib/db`.
- Setiap item WAJIB menambah entry `apps/backoffice/CHANGELOG.md` saat selesai
  (format `[MAJOR.MINOR.PATCH] - YYYY-MM-DD`).
- Migrasi schema baru (`transactions.sale_type` + `source_ibt_id`, `inter_branch_transfers.converted_transaction_id`,
  `customers.is_internal_branch` + `linked_branch_id`) pakai drizzle-kit; non-breaking (nullable/default),
  lihat pola `packages/db/src/migrations/`.
