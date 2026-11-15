# Implementation Plan — Phase 4: Stock Opname

**Tanggal dibuat:** 2026-04-18
**Referensi PRD:** `docs/pos_prd_1/05.10-stock-opname.md`, `docs/bo_prd_1/05.2-user-rbac.md`
**Tasks:** T-040, T-041, T-042, T-043, T-044, T-045, T-046

---

## 1. Keputusan Desain (Confirmed)

| # | Keputusan |
|---|-----------|
| 1 | **Approval SO** — dilakukan dari Backoffice (Owner, Manager Backoffice, Manager Toko own cabang). Kasir POS hanya submit. |
| 2 | **SO Besar** — dibuat/diinisiasi oleh Manager dari Backoffice, kasir lanjutkan input per kategori dari POS. |
| 3 | **Selisih PLUS** — tidak ada hold 2 hari. Owner/Manager bisa langsung approve kapanpun. |
| 4 | **Skip SO Harian** — kasir input alasan, sistem kirim notifikasi ke Backoffice (via in-app notification jika memungkinkan). |

---

## 2. Kondisi Database Saat Ini

Schema `stock_opnames` dan `stock_opname_items` sudah ada di `packages/db/src/schema/stock_opnames.ts`, tapi masih minimal:

```typescript
// Yang sudah ada:
stockOpnames:     { id, soNumber, branchId, type, status, createdById, approvedById, createdAt, completedAt }
stockOpnameItems: { id, soId, productId, uomId, systemQty, physicalQty, varianceQty, varianceReason }
```

**Yang perlu ditambahkan via migration:**

```typescript
// stockOpnames — tambah kolom:
shiftId:              integer           // shift saat SO dilakukan (nullable — SO Besar tidak terikat shift)
method:               varchar(20)       // BEST_SELLER | SOLD_TODAY | MANUAL (nullable untuk SO Besar)
skipReason:           text              // diisi jika SO dilewati
isSkipped:            boolean           // default false
approvedAt:           timestamp
rejectedById:         integer           // FK users.id
rejectedAt:           timestamp
rejectionNote:        text
notes:                text

// stockOpnameItems — tambah kolom:
varianceCostValue:    decimal(15,2)     // |varianceQty| × harga modal FIFO
varianceCategory:     varchar(20)       // EXPIRED | RUSAK | HILANG | SALAH_INPUT | null (jika plus)
isRecounted:          boolean           // default false — true jika ada recount request
recountPhysicalQty:   decimal(12,2)     // qty setelah recount
```

---

## 3. Task Breakdown

### T-040: Auto-suggest Best Seller

**Endpoint:** `GET /api/pos/stock-opname/suggestions?branchId=1&method=BEST_SELLER&shiftId=X`

Logic:
1. Query `transactionItems` join `transactions` untuk semua transaksi dalam shift hari ini (`shiftId` atau tanggal hari ini)
2. Group by `productId`, sum qty, order DESC
3. Limit 30 produk teratas
4. Return: `{ productId, productName, sku, baseUomId, baseUomCode, currentStock, soldQtyToday }`

---

### T-041: Filter Produk Terjual Hari Ini & Manual

**Endpoint:** `GET /api/pos/stock-opname/suggestions?branchId=1&method=SOLD_TODAY`
- Sama dengan BEST_SELLER tapi return SEMUA produk terjual hari ini (tanpa limit 30)

**Endpoint:** `GET /api/pos/stock-opname/suggestions?branchId=1&method=MANUAL&q=keyword`
- Return semua produk aktif, support search by nama/SKU

---

### T-042: POS UI — Input Stok Fisik (SO Harian)

**File baru:**
- `apps/pos-desktop/src/pages/StockOpname.tsx` — halaman utama, orchestrate 4 step
- `apps/pos-desktop/src/components/so/SOMethodSelector.tsx` — Step 1
- `apps/pos-desktop/src/components/so/SOProductSelector.tsx` — Step 2
- `apps/pos-desktop/src/components/so/SOInputTable.tsx` — Step 3
- `apps/pos-desktop/src/components/so/SOReviewPanel.tsx` — Step 4
- `apps/pos-desktop/src/components/so/SOSkipDialog.tsx` — dialog skip SO

**Flow 4 Step:**

```
Step 1 — Pilih Metode:
  [ Best Seller (Top 30) ]  [ Terjual Hari Ini ]  [ Manual ]
  Tombol "Lewati SO Hari Ini" → buka SOSkipDialog

Step 2 — Pilih Produk:
  List produk dari suggestion endpoint
  Kasir checklist produk yang mau di-SO
  Search bar untuk manual method
  Tombol "Mulai Input (N produk)"

Step 3 — Input Fisik:
  Tabel per produk:
  | Produk        | Stok Sistem | Input Fisik | Selisih      |
  | Royal Canin   | 8 SAK       | [  7  ]     | -1 SAK 🔴   |
  | Whiskas Tuna  | 25 PCS      | [ 25  ]     |  0     🟢   |
  | Vitamin A     | 10 BOX      | [ 12  ]     | +2 BOX 🟡   |
  Indikator: 🟢 pas, 🟡 plus, 🔴 minus

Step 4 — Review & Submit:
  Summary:
    Total item di-check: N
    Pas: X  |  Lebih: Y  |  Kurang: Z
    Estimasi nilai selisih: Rp XXX (dari harga modal FIFO)
  Textarea catatan (opsional)
  Tombol "Submit untuk Approval"
```

**SOSkipDialog:**
- Textarea alasan wajib diisi
- POST `/api/pos/stock-opname/skip`
- Trigger notifikasi ke Backoffice

**Akses ke halaman SO:**
- Tambah tombol di `POSHeader` atau menu samping
- Hanya tampil saat ada shift aktif

---

### T-043: API Create SO + Approve / Reject

**POST `/api/pos/stock-opnames`** — kasir submit SO

```typescript
// Request:
{
  branchId: number,
  shiftId: number,
  type: 'DAILY' | 'FULL',
  method: 'BEST_SELLER' | 'SOLD_TODAY' | 'MANUAL',
  items: Array<{
    productId: number,
    uomId: number,
    systemQty: number,   // diambil dari DB saat submit (bukan saat mulai input)
    physicalQty: number,
  }>,
  notes?: string,
}

// Logic server:
// 1. Re-fetch systemQty dari DB saat submit (bukan dari client) → mencegah stale data
// 2. Hitung varianceQty = physicalQty - systemQty
// 3. Hitung varianceCostValue = |varianceQty| × harga modal dari FIFO batch tertua
// 4. Auto-generate soNumber: SO-YYYYMMDD-XXXX (increment per hari per cabang)
// 5. Simpan status PENDING
// 6. Return { soId, soNumber, items dengan variance & estimasi nilai }
```

**PATCH `/api/pos/stock-opnames/[id]/approve`** — Manager/Owner dari Backoffice

```typescript
// Request:
{ approvedById: number, notes?: string }

// Logic:
// 1. Validasi role (Owner | Manager Backoffice | Manager Toko)
// 2. Untuk setiap item dengan variance !== 0:
//    MINUS: kurangi dari FIFO batch tertua (lihat T-046)
//    PLUS:  tambah ke batch terakhir
// 3. Update aggregate productStocks
// 4. Update status → APPROVED, approvedById, approvedAt
// 5. Insert audit log (stock_auto_breaks) per item yang di-adjust
```

**PATCH `/api/pos/stock-opnames/[id]/reject`** — Manager/Owner dari Backoffice

```typescript
// Request:
{ rejectedById: number, rejectionNote: string }
// Update status → REJECTED
// Kasir bisa melihat rejection note dan submit ulang
```

**POST `/api/pos/stock-opname/skip`** — kasir skip SO harian

```typescript
// Request:
{ branchId: number, shiftId: number, cashierId: number, reason: string }

// Logic:
// 1. Insert ke stockOpnames dengan isSkipped=true, skipReason
// 2. Kirim notifikasi ke Backoffice:
//    - Insert ke tabel notifications: { type: 'SO_SKIPPED', branchId, message, createdAt }
//    - Backoffice polling atau SSE untuk tampilkan di dashboard
```

---

### T-044: SO Besar — Multi-session dari Backoffice + POS

**Alur:**
1. Manager buat SO Besar dari **Backoffice** — pilih kategori yang dicakup, assign tim
2. Kasir buka POS → ada banner "Ada SO Besar Aktif" → klik untuk lanjutkan
3. Kasir input per kategori, bisa multi-sesi (submit partial, lanjut besok)
4. Setelah semua kategori selesai → Manager final approve dari Backoffice

**Endpoint (Backoffice):** `POST /api/bo/stock-opnames` — buat SO Besar

```typescript
{
  branchId: number,
  type: 'FULL',
  categoryScope: number[],   // array categoryId yang dicakup
  assignedUserIds: number[],
  notes?: string,
}
```

**Endpoint (POS):** `GET /api/pos/stock-opnames/active-full?branchId=1`
- Return SO Besar yang sedang berjalan (status PENDING, type FULL)
- POS tampilkan banner/alert kalau ada SO Besar aktif

**Endpoint (POS):** `PATCH /api/pos/stock-opnames/[id]/add-items`
- Append items baru ke SO yang sudah ada
- Untuk skenario input per kategori per sesi
- Update `completedCategories` di SO

---

### T-045: Kalkulasi Shrinkage Berbasis FIFO

**Helper:** `packages/shared/src/utils/fifo-shrinkage.ts`

```typescript
export interface BatchUsage {
  batchId: number,
  qtyUsed: number,
  costPrice: number,
  subtotal: number,
}

export function calculateFIFOCost(
  batches: { id: number, qty: number, costPrice: number }[],  // sorted receivedDate ASC
  absVarianceQty: number
): { totalCost: number, batchesUsed: BatchUsage[] }
// Dipakai saat: (1) create SO untuk estimasi nilai selisih, (2) saat approval untuk catat nilai pasti
```

**Endpoint Monthly Summary:** `GET /api/pos/stock-opnames/monthly-summary?branchId=1&month=2026-04`

```typescript
// Return:
{
  totalShrinkageCost: number,     // total kerugian (selisih minus)
  totalSurplusOffset: number,     // total lebih stock
  netShrinkage: number,
  soCount: number,                // jumlah SO selesai bulan ini
  skipCount: number,              // jumlah SO dilewati
  byReason: { reason, count, totalCost }[],
  byCategory: { categoryName, shrinkage, surplus }[],
}
```

---

### T-046: Apply Stock Adjustment FIFO saat Approval

**Helper:** `apps/backoffice/src/lib/stock-adjustment.ts`

```typescript
export async function applySOStockAdjustment(
  db: DrizzleClient,
  item: { productId, branchId, uomId, systemQty, physicalQty },
  fifoFetcher: (productId, branchId, uomId) => Promise<StockBatch[]>
): Promise<void>

// Logic:
// variance = physicalQty - systemQty

// Jika variance < 0 (kurang):
//   Kurangi dari batch FIFO tertua (receivedDate ASC)
//   Loop batch: deduct = min(batch.qty, remaining)
//   Jika batch.qty habis → lanjut batch berikutnya
//   Update aggregate productStocks.qty -= |variance|

// Jika variance > 0 (lebih):
//   Tambah ke batch terakhir (receivedDate DESC limit 1)
//   Jika tidak ada batch → buat batch baru costPrice=0
//   Update aggregate productStocks.qty += variance

// Insert ke stock_auto_breaks (audit log) untuk setiap batch yang tersentuh
```

---

## 4. Urutan Implementasi

```
1. DB Migration — tambah kolom ke stockOpnames & stockOpnameItems + tabel notifications
2. T-045: fifo-shrinkage helper (shared, unit-testable)
3. T-046: stock-adjustment helper
4. T-040 + T-041: suggestion endpoints (BEST_SELLER, SOLD_TODAY, MANUAL)
5. T-043: POST /stock-opnames + skip endpoint
6. T-044: active-full + add-items endpoints + Backoffice create SO Besar
7. T-043: approve + reject endpoints (butuh T-046)
8. T-045: monthly-summary endpoint
9. T-042: POS UI — StockOpname page + semua components
10. Integrasi: tambah route /stock-opname di App.tsx + tombol di POSHeader
11. Test end-to-end: submit SO → approve di Backoffice → cek stock berkurang
```

---

## 5. File yang Perlu Dibuat / Diubah

| File | Action | Task |
|------|--------|------|
| `packages/db/src/schema/stock_opnames.ts` | EDIT | Tambah kolom baru |
| `packages/db/src/schema/notifications.ts` | CREATE | Tabel notifikasi SO skip |
| `packages/db/src/migrations/XXXX_so_columns.ts` | CREATE | Migration |
| `packages/shared/src/types/stock-opname.ts` | CREATE | Types SO |
| `packages/shared/src/utils/fifo-shrinkage.ts` | CREATE | T-045 |
| `apps/backoffice/src/lib/stock-adjustment.ts` | CREATE | T-046 |
| `apps/backoffice/app/api/pos/stock-opname/suggestions/route.ts` | CREATE | T-040, T-041 |
| `apps/backoffice/app/api/pos/stock-opname/skip/route.ts` | CREATE | T-043 |
| `apps/backoffice/app/api/pos/stock-opnames/route.ts` | CREATE | T-043 |
| `apps/backoffice/app/api/pos/stock-opnames/[id]/approve/route.ts` | CREATE | T-043 |
| `apps/backoffice/app/api/pos/stock-opnames/[id]/reject/route.ts` | CREATE | T-043 |
| `apps/backoffice/app/api/pos/stock-opnames/[id]/add-items/route.ts` | CREATE | T-044 |
| `apps/backoffice/app/api/pos/stock-opnames/active-full/route.ts` | CREATE | T-044 |
| `apps/backoffice/app/api/pos/stock-opnames/monthly-summary/route.ts` | CREATE | T-045 |
| `apps/backoffice/app/api/bo/stock-opnames/route.ts` | CREATE | T-044 (Backoffice buat SO Besar) |
| `apps/pos-desktop/src/pages/StockOpname.tsx` | CREATE | T-042 |
| `apps/pos-desktop/src/components/so/SOMethodSelector.tsx` | CREATE | T-042 |
| `apps/pos-desktop/src/components/so/SOProductSelector.tsx` | CREATE | T-042 |
| `apps/pos-desktop/src/components/so/SOInputTable.tsx` | CREATE | T-042 |
| `apps/pos-desktop/src/components/so/SOReviewPanel.tsx` | CREATE | T-042 |
| `apps/pos-desktop/src/components/so/SOSkipDialog.tsx` | CREATE | T-042 |
| `apps/pos-desktop/src/App.tsx` | EDIT | Tambah route `/stock-opname` |
| `apps/pos-desktop/src/components/layout/POSHeader.tsx` | EDIT | Tambah tombol akses SO |
