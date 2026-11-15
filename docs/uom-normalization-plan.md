# Migrasi Normalisasi Stok ke Base UOM

> Status: **Planning — belum diimplementasi**
> Dibuat: 2026-06-11
> Prioritas: Tinggi (bug aktif di stock valuation + potensi salah hitung stok di POS)

---

## Latar Belakang

Ditemukan saat debugging internal transfer (PO antar cabang): sistem menampilkan stok 0 padahal stok fisik ada, karena `productStocks` menyimpan stok **per UOM** (baris terpisah untuk SAK dan PCS dari produk yang sama). Ketika UOM transfer berbeda dari UOM stok yang tersimpan, query exact-match tidak menemukan data.

Ini bukan hanya masalah internal transfer — ini adalah **desain yang inkonsisten** di seluruh sistem stok.

---

## Root Cause

`productStocks` dan `productStockBatches` menyimpan stok dengan kolom `uomId`. Akibatnya:

```
Produk: Makanan Kucing X
  productStocks row 1: { branchId: HQ, uomId: SAK,  qty: 2  }  → 2 SAK = 100 PCS
  productStocks row 2: { branchId: HQ, uomId: PCS,  qty: 20 }  → 20 PCS terpisah
```

Tidak ada mekanisme yang memastikan kedua baris ini tidak double-count. Sistem bergantung pada caller yang "tahu" UOM mana yang harus di-query.

### Kondisi Kode Saat Ini (Sebelum Migrasi)

Dari hasil analisis `stock-service.ts`:

- `getProductsWithStock()` sudah filter `uomId = baseUomId` → produk yang stoknya tersimpan dalam SAK sudah tampil 0 dari awal, bahkan tanpa ada bug baru
- `deductStock()` query batches **tanpa** filter uomId (sudah benar), tapi update `productStocks` dengan `eq(uomId, uomId_param)` → bergantung pada caller mengirim base UOM yang benar
- `addStock()` insert batch dan upsert `productStocks` dengan UOM apapun yang dikirim → tidak ada enforcement ke base UOM

### Konsekuensi Bug yang Sudah Aktif

| Masalah | Dampak |
|---|---|
| Produk stok tersimpan dalam SAK tampil 0 di POS/listing | User tidak tahu ada stok |
| Internal transfer stock-check tampil 0 jika UOM mismatch | Sudah di-workaround dengan konversi cross-UOM |
| `asyncValidateInventory` baca productStocks tanpa filter UOM | Bisa aggregate SAK + PCS → qty validasi POS salah |
| `getStockValuationReport` sum semua batch tanpa konversi UOM | Laporan nilai stok salah jika ada batch multi-UOM |

---

## Target State

Setelah migrasi:

1. `productStocks` hanya boleh punya **satu row per `(productId, branchId)`** — selalu dalam `baseUomId`, dijamin oleh UNIQUE constraint di schema
2. `productStockBatches` menyimpan `qtyReceived` dan `qtyRemaining` dalam **base UOM**; kolom `uomId` tetap ada sebagai referensi UOM penerimaan asli untuk audit trail
3. Semua operasi tulis ke `productStocks` / `productStockBatches` wajib konversi ke base UOM sebelum simpan
4. Display ke user konversi dari base UOM ke UOM tampilan yang diinginkan di layer presentasi

---

## Catatan Kritis: Mengapa Tidak Bisa Deploy Bertahap

> **Versi lama rencana ini salah** — Phase kode dan Phase data migration diklaim bisa di-deploy terpisah. Ini tidak benar.

Jika code changes (addStock → base UOM) di-deploy **tanpa** data migration serentak:

```
State setelah code deploy, sebelum data migration:
  Tulis baru    → row (productId, branchId, PCS/base)  ✓ benar
  Data lama     → row (productId, branchId, SAK)       masih ada

  deductStock dipanggil:
    → batch ter-deduct ✓
    → productStocks update WHERE uomId=baseUomId → row lama (SAK) tidak ketemu
    → productStocks.qty TIDAK berkurang
    → INKONSISTENSI antara batch dan aggregate stok
```

**Kesimpulan: code changes dan data migration HARUS dijalankan dalam satu maintenance window yang sama.**

---

## Prasyarat Wajib Sebelum Mulai

- [ ] Audit semua produk dengan stok multi-UOM: pastikan ada entry di `productUomConversions` untuk setiap non-base UOM
- [ ] Rekonsiliasi `productStocks.qty` vs SUM(`productStockBatches.qtyRemaining`) per produk per cabang — pastikan tidak ada gap sebelum migrasi
- [ ] Tidak ada transfer (status PREPARING/IN_TRANSIT) atau PO receiving yang in-progress
- [ ] Backup penuh DB dilakukan tepat sebelum Deployment B
- [ ] Test penuh di environment staging

---

## Struktur Deployment

### Deployment A — Transitional Read Layer (bisa masuk kapan saja, tidak ada breaking change)

**Goal:** Pastikan semua read path sudah menampilkan stok dengan benar terlepas dari UOM yang tersimpan, sebagai persiapan sebelum write layer diubah.

**Perubahan:**

1. `getProductsWithStock()` di `stock-service.ts` — ubah join agar ambil semua UOM row, aggregate ke base UOM dengan konversi:
   ```
   Sebelum: LEFT JOIN productStocks ON ... AND uomId = baseUomId
   Sesudah: LEFT JOIN semua UOM row + konversi SUM(qty × ratio) / 1
   ```

2. `asyncValidateInventory()` di `transaction-service.ts` — tambah filter atau konversi agar tidak double-count SAK + PCS

3. `getStockValuationReport()` di `report-service.ts` — konversi `qtyRemaining` ke base UOM saat sum nilai stok

4. Stock opname routes — query `productStocks` tanpa strict uomId filter, aggregate ke base

**Sifat:** Murni perubahan read layer, tidak mengubah cara data ditulis. Aman di-deploy ke production kapan saja tanpa risiko data corruption. Data lama tetap dibaca dengan benar; data baru juga dibaca dengan benar setelah Deployment B.

**Testing Deployment A:**
- [ ] Product listing POS tampilkan stok yang benar untuk semua produk (termasuk yang stok tersimpan dalam SAK)
- [ ] Laporan nilai stok menampilkan angka yang konsisten
- [ ] Stock opname create/add-items berjalan normal

---

### Deployment B — Atomic Cutover (maintenance window, jalankan sekaligus)

**Goal:** Ubah write layer + migrasi data dalam satu window. Setelah selesai, sistem sepenuhnya ternormalisasi.

**Wajib dilakukan dalam urutan ini, dalam satu deploy + maintenance window:**

#### Step B1 — Code changes (di-deploy bersamaan dengan B2)

**`stock-service.ts` — `addStock()`:**
- Terima parameter tambahan: `baseUomId: number` dan `conversionRatio: number` (atau lookup dari DB)
- Konversi sebelum simpan: `qtyInBase = qty × ratio`
- Insert batch dengan `qtyReceived = qtyInBase`, `qtyRemaining = qtyInBase`; simpan `uomId` asli untuk audit
- Upsert `productStocks` hanya untuk `uomId = baseUomId`

**`stock-service.ts` — `deductStock()`:**
- Update `productStocks` dengan filter `uomId = baseUomId` (bukan `uomId_param` yang dikirim caller)
- Caller tidak perlu berubah — param `uomId` tetap diterima tapi tidak dipakai untuk filter aggregate

**Bypass routes (semua dalam satu PR yang sama):**

| File | Perubahan |
|---|---|
| `lib/stock-adjustment.ts` — `applyManualStockAdjustment()` | Konversi qty ke base sebelum tulis; gunakan StockService atau inline konversi |
| `lib/stock-adjustment.ts` — `applySOStockAdjustment()` | Sama; hapus filter uomId dari query batch |
| `app/api/bo/internal-transfers/[id]/status/route.ts` — receive action | Konversi qty ke base sebelum insert productStockBatches dan update productStocks |
| `app/api/pos/stock-opnames/route.ts` | Hapus filter uomId dari query batch |
| `app/api/pos/stock-opnames/[id]/add-items/route.ts` | Sama |

#### Step B2 — Data migration (jalankan via script setelah B1 deploy, sebelum traffic dibuka kembali)

```sql
-- 1. Build konversi map (base UOM ratio = 1, non-base pakai productUomConversions)
-- 2. Untuk setiap (productId, branchId), hitung total stok dalam base UOM:
--    SUM(ps.qty * COALESCE(puc.ratio, 1)) GROUP BY productId, branchId
-- 3. DELETE semua row non-base di productStocks
-- 4. UPSERT satu row per (productId, branchId) dengan total base qty
-- 5. UPDATE productStockBatches:
--    qtyReceived = qtyReceived * ratio (dari uomId batch)
--    qtyRemaining = qtyRemaining * ratio
--    (uomId dibiarkan sebagai audit trail)
-- 6. Validasi: bandingkan total nilai stok (SUM qtyRemaining * costPrice) sebelum vs sesudah
```

#### Step B3 — Schema constraint (jalankan setelah B2 sukses)

```sql
ALTER TABLE petshop.product_stocks
  ADD CONSTRAINT product_stocks_unique_per_branch
  UNIQUE (product_id, branch_id);
```

Constraint ini adalah pengaman permanen — tidak ada kode baru yang bisa kembali membuat row multi-UOM.

**Testing Deployment B:**
- [ ] PO receiving: terima dalam SAK → `productStocks` bertambah dalam PCS (base)
- [ ] POS transaction: jual produk → stok berkurang benar, FIFO cost benar
- [ ] Stock adjustment manual: qty benar di DB
- [ ] Internal transfer: kirim dalam SAK, terima dalam SAK → stok source berkurang, destination bertambah dalam base UOM
- [ ] UNIQUE constraint: coba insert row kedua untuk (productId, branchId) yang sama → harus gagal
- [ ] Total nilai stok sebelum B2 = sesudah B2 (dalam toleransi pembulatan)

---

## File Index Lengkap

### Deployment A (read layer)
```
apps/backoffice/lib/
  services/stock-service.ts          ← getProductsWithStock()
  services/transaction-service.ts    ← asyncValidateInventory()
  services/report-service.ts         ← getStockValuationReport()

apps/backoffice/app/api/
  pos/stock-opnames/route.ts
  pos/stock-opnames/[id]/add-items/route.ts
```

### Deployment B (write layer + migration)
```
apps/backoffice/lib/
  services/stock-service.ts          ← addStock(), deductStock()
  stock-adjustment.ts                ← applyManualStockAdjustment(), applySOStockAdjustment()
  po-batch-updater.ts                ← review caller, mungkin tidak perlu ubah

apps/backoffice/app/api/
  bo/internal-transfers/[id]/status/route.ts   ← receive action
  bo/purchase-orders/[id]/reverse-receiving/route.ts  ← review
  pos/transactions/[id]/void/route.ts          ← review
  pos/stock-opnames/route.ts                   ← write path
  pos/stock-opnames/[id]/add-items/route.ts    ← write path

packages/db/src/schema/
  inventory.ts   ← UNIQUE constraint productStocks(productId, branchId)

scripts/
  migrate-stock-to-base-uom.ts   ← migration script baru (dijalankan manual)
```

### Tidak perlu diubah (read-only, sudah filter baseUomId, akan otomatis benar setelah migrasi)
```
app/api/products/route.ts
app/api/pos/products/route.ts
app/api/pos/bootstrap/route.ts
app/api/pos/stock-snapshot/route.ts
app/api/pos/purchase-orders/suggestions/route.ts
app/api/bo/internal-transfers/[id]/stock-check/route.ts  ← sudah ada cross-UOM workaround
```

---

## Tabel Risiko

| Risiko | Likelihood | Dampak | Mitigasi |
|---|---|---|---|
| Produk punya multi-UOM stok tapi belum ada di `productUomConversions` | Sedang | Tinggi | Audit dan lengkapi data konversi sebelum Deployment B |
| `productStocks.qty` tidak sinkron dengan SUM `productStockBatches.qtyRemaining` | Rendah | Tinggi | Rekonsiliasi sebelum B2, perbaiki gap manual jika ada |
| POS Electron punya cache stok lokal yang tidak ikut migrasi | Tinggi | Sedang | Paksa re-sync setelah Deployment B; tidak ada operasi saat window |
| Script migrasi B2 gagal di tengah jalan | Rendah | Tinggi | Jalankan dalam satu DB transaction; rollback otomatis jika gagal |
| UNIQUE constraint gagal karena ada duplicate key (data sebelum B2 tidak bersih) | Sedang | Sedang | Jalankan B2 dulu, validasi tidak ada row duplicate, baru jalankan B3 |

---

## Estimasi Effort

| Deployment | Estimasi | Catatan |
|---|---|---|
| Deployment A | 0.5–1 hari | Perubahan read-only, risiko rendah |
| Deployment B (code) | 1–1.5 hari | Perubahan write layer + bypass routes |
| Migration script + validasi | 0.5 hari | Termasuk dry-run di staging |
| Testing end-to-end | 0.5–1 hari | Per deployment |
| **Total** | **~3–4 hari kerja** | |
