# Implementation Plan — Phase 5: Purchase Order + Missing MVP Features

**Tanggal dibuat:** 2026-04-18  
**Direvisi:** 2026-04-21 — disesuaikan dengan `docs/new_approach/MVP_OVERVIEW_1.md`  
**Referensi PRD:** `docs/pos_prd_1/05.11-purchase-order.md`, `docs/bo_prd_1/05.2-user-rbac.md`, `docs/new_approach/MVP_SPRINT_8_PO_LAPORAN_HUTANG.md`, `docs/new_approach/MVP_SPRINT_7_SO_BARANG_RUSAK.md`, `docs/new_approach/MVP_SPRINT_5_PAYMENT_RECEIPT.md`  
**Tasks:** T-050, T-051, T-052, T-053, T-054, T-055, T-056, T-057, T-058, T-059, T-060

---

## 0. Konteks Revisi

Setelah review `MVP_OVERVIEW_1.md`, ditemukan:

1. **PO Request dibuat dari POS** (Sprint 8 Story 8.1) — bukan dari Backoffice. Alur MVP: Kasir/Gudang buat request di POS → Manager approve di Backoffice → Gudang receive di POS.
2. **Input Barang Rusak** (Sprint 7 Story 7.3) — fitur wajib MVP yang tidak masuk Phase 4. Dimasukkan ke Phase 5 sebagai T-059.
3. **Surat Jalan / Delivery Order** (Sprint 5) — fitur wajib MVP yang terlewat. Dimasukkan ke Phase 5 sebagai T-060.

---

## 1. Keputusan Desain (Confirmed)

| # | Keputusan |
|---|-----------|
| 1 | **Siapa buat PO** — Kasir atau Gudang dari **POS**. Approval dilakukan Manager/Owner dari **Backoffice**. *(Direvisi dari: Manager buat dari Backoffice)* |
| 2 | **Auto-suggest** — Sederhana: produk dengan stock < 10 muncul sebagai saran di form buat PO di POS. |
| 3 | **Merge PO** — Tidak diimplementasikan. |
| 4 | **Approval threshold** — Manager Backoffice bisa approve PO < Rp 5.000.000. Owner wajib approve jika total ≥ Rp 5.000.000. |
| 5 | **Kirim ke supplier** — Print saja (tidak ada email/WA). |
| 6 | **Invoice terlambat** — Gudang input qty saat surat jalan datang, pakai harga lama (harga PO). PO bisa di-edit harga invoice di kemudian hari. TIDAK ada recalculate COGS retroaktif. |
| 7 | **Supplier payment** — Hanya di Backoffice. |
| 8 | **Format PO Number** — `PO-YYYYMMDD-XXXX` (increment per hari per cabang). |
| 9 | **Barang Rusak** — Input dari POS (kasir/gudang), auto-hitung nilai kerugian (qty × harga modal FIFO), tidak perlu approval. |
| 10 | **Surat Jalan** — Ditrigger manual setelah checkout selesai. Format A4, include total berat, nama customer, list produk + qty. |

---

## 2. Kondisi Database Saat Ini

Schema `purchase_orders`, `purchase_order_items`, `po_receiving_logs`, `supplier_payables` sudah ada di `packages/db/src/schema/purchase_orders.ts`, tapi banyak kolom penting yang belum ada.

**Yang perlu ditambahkan via migration:**

```typescript
// purchaseOrders — tambah kolom:
status:             // extend ke: DRAFT | PENDING_APPROVAL | APPROVED | IN_TRANSIT | PARTIALLY_RECEIVED | FULLY_RECEIVED | CANCELLED
createdById:        integer           // FK users.id — kasir/gudang yang buat request
approvedById:       integer           // FK users.id (nullable)
approvedAt:         timestamp         // (nullable)
rejectedById:       integer           // FK users.id (nullable)
rejectedAt:         timestamp         // (nullable)
rejectionNote:      text              // (nullable)
notes:              text              // catatan dari kasir (nullable)
targetDeliveryDate: timestamp         // (nullable)
invoiceNumber:      varchar(100)      // diisi saat invoice datang (nullable)
invoiceUpdatedAt:   timestamp         // (nullable)

// purchaseOrderItems — tambah kolom:
qtyDamaged:         decimal(12,2)     // default 0 — qty rusak saat receiving
invoiceUnitCost:    decimal(12,2)     // harga actual dari invoice (nullable)
expiryDate:         timestamp         // (nullable) expired batch yang diterima

// suppliers (di master.ts) — tambah kolom:
email:              varchar(255)      // (nullable)
contactPerson:      varchar(100)      // (nullable)
bankAccount:        varchar(100)      // (nullable)
paymentTermDays:    integer           // default 30 (nullable)

// Tabel baru: poReceivingItems — detail per item saat receiving
{
  id, poItemId (FK purchase_order_items), logId (FK po_receiving_logs),
  qtyReceived decimal, qtyDamaged decimal default 0,
  expiryDate timestamp nullable, note text nullable
}

// Tabel baru: supplierPayablePayments — riwayat pembayaran hutang
{
  id, payableId (FK supplier_payables), amount decimal,
  method varchar(20),              // CASH | TRANSFER | CEK
  referenceNumber varchar(100) nullable,
  note text nullable,
  paidById integer FK users.id,
  paidAt timestamp defaultNow
}

// Tabel baru: damagedGoods — barang rusak / write-off
{
  id serial PK,
  branchId integer FK branches.id,
  shiftId integer FK shifts.id (nullable),
  reportedById integer FK users.id,
  reportedAt timestamp defaultNow,
  reason varchar(50),              // RUSAK | EXPIRED | HILANG
  notes text nullable,
  totalLossValue decimal(15,2),    // total nilai kerugian
}

// Tabel baru: damagedGoodsItems — detail per produk
{
  id serial PK,
  damagedGoodsId integer FK damaged_goods.id,
  productId integer FK products.id,
  uomId integer FK units_of_measure.id,
  qty decimal(12,2),
  costPrice decimal(12,2),         // harga modal FIFO saat itu
  lossValue decimal(15,2),         // qty × costPrice
}

// Tabel baru: deliveryOrders — surat jalan
{
  id serial PK,
  doNumber varchar(50) unique,     // DO-YYYYMMDD-XXXX
  transactionId integer FK transactions.id,
  branchId integer FK branches.id,
  customerName varchar(100),
  customerAddress text nullable,
  totalWeightGram decimal(12,2),
  printedById integer FK users.id,
  printedAt timestamp defaultNow,
  notes text nullable,
}
```

---

## 3. Task Breakdown

### T-050: PO Request dari POS (Buat PO)

**File baru di POS:**
- `apps/pos-desktop/src/pages/PORequest.tsx` — halaman buat PO request
- `apps/pos-desktop/src/components/po/POSuggestionList.tsx` — list produk stock < 10
- `apps/pos-desktop/src/components/po/POForm.tsx` — form tambah produk + qty + supplier
- `apps/pos-desktop/src/components/po/POReviewPanel.tsx` — review & submit

**Alur UI di POS:**

```
Halaman PO Request:
  Tab 1 "Saran Restocking":
    List produk stock < 10, auto-load dari endpoint suggestions
    Checklist produk → "Tambahkan ke PO"

  Tab 2 "Manual":
    Search produk by nama/SKU
    Input qty

  Form PO:
    Pilih Supplier (dropdown)
    List produk yang dipilih + qty + harga beli (auto-fill, bisa edit)
    Estimasi total: Rp XXX
    Notes (opsional)
    Tombol "Kirim PO Request"
```

**Endpoint:** `GET /api/pos/purchase-orders/suggestions?branchId=1`

```typescript
// Query productStocks WHERE qty < 10 AND branchId = X
// Join productStockBatches ORDER BY receivedAt DESC LIMIT 1 per produk
// Return: { productId, productName, sku, currentStock, baseUomCode, lastPurchasePrice, lastSupplierId }
```

**Endpoint:** `POST /api/pos/purchase-orders` — kasir/gudang submit PO request

```typescript
// Request:
{
  branchId: number,
  supplierId: number,
  createdById: number,
  items: Array<{ productId, uomId, qtyOrdered, unitCost }>,
  notes?: string,
  targetDeliveryDate?: string,
}

// Logic:
// 1. Auto-generate poNumber: PO-YYYYMMDD-XXXX
// 2. Hitung totalAmount
// 3. Simpan status PENDING_APPROVAL langsung (bukan DRAFT — kasir tidak perlu draft)
// 4. Return { poId, poNumber }
```

**Endpoint:** `GET /api/pos/purchase-orders?branchId=1` — list PO milik cabang ini (untuk history)

---

### T-051: Alur Approval (Backoffice)

**Endpoint:** `GET /api/bo/purchase-orders` — list semua PO semua cabang, filter by status

**Endpoint:** `GET /api/bo/purchase-orders/[id]` — detail PO + items

**PATCH `/api/bo/purchase-orders/[id]/approve`**

```typescript
// Request: { approvedById: number, notes?: string }
// Logic:
// 1. Cek threshold: totalAmount >= 5_000_000 → hanya Owner
//                  totalAmount < 5_000_000 → Manager Backoffice atau Owner
// 2. PENDING_APPROVAL → APPROVED, simpan approvedById + approvedAt
```

**PATCH `/api/bo/purchase-orders/[id]/reject`**

```typescript
// Request: { rejectedById: number, rejectionNote: string }
// PENDING_APPROVAL → PENDING_APPROVAL tetap, tapi flag rejected
// Kasir di POS bisa lihat rejection note dan buat PO baru
```

**PATCH `/api/bo/purchase-orders/[id]/mark-transit`**

```typescript
// APPROVED → IN_TRANSIT
// Manager tandai bahwa barang sudah dikirim supplier
```

**GET `/api/bo/purchase-orders/[id]/print`** — return data lengkap untuk print PO document (A4)

**PATCH `/api/bo/purchase-orders/[id]`** — edit PO (hanya jika status PENDING_APPROVAL/APPROVED, belum received)

---

### T-052: Auto-Suggest di POS

Sudah tercakup di T-050 (`GET /api/pos/purchase-orders/suggestions`). Endpoint ini juga bisa dipanggil ulang saat kasir mau refresh saran.

---

### T-053: Receiving Barang di Gudang (POS)

**File baru di POS:**
- `apps/pos-desktop/src/pages/Receiving.tsx` — halaman utama receiving
- `apps/pos-desktop/src/components/receiving/POList.tsx` — list PO siap diterima
- `apps/pos-desktop/src/components/receiving/ReceivingForm.tsx` — form input qty per item

**Alur UI:**

```
Halaman Receiving:
  List PO status APPROVED / IN_TRANSIT untuk cabang ini
  Per baris: PO number, supplier, estimasi tgl, total item

Klik PO → ReceivingForm:
  Header: PO info, toggle "Surat jalan/invoice sudah diterima?"
  Tabel per item:
  | Produk      | Qty PO | Qty Terima | Qty Rusak | Tgl Expired |
  | Royal Canin | 50 Sak | [  48   ]  | [  2   ]  | [optional]  |
  Tombol: "Submit Penerimaan"
```

**Endpoint:** `GET /api/pos/purchase-orders?branchId=1&status=APPROVED,IN_TRANSIT`

**Endpoint:** `POST /api/pos/purchase-orders/[id]/receive`

```typescript
// Request:
{
  receivedById: number,
  invoiceReceived: boolean,
  note?: string,
  items: Array<{ poItemId, qtyReceived, qtyDamaged, expiryDate? }>,
}

// Logic:
// 1. Insert poReceivingLogs (header)
// 2. Insert poReceivingItems (per item)
// 3. Update purchaseOrderItems.qtyReceived += qtyReceived
// 4. Cek status: semua terpenuhi → FULLY_RECEIVED, ada sisa → PARTIALLY_RECEIVED
// 5. BELUM update stock — stock update saat Backoffice approve receiving (T-058)
```

---

### T-054: Handle Invoice Belum Datang

Saat `invoiceReceived = false`, harga yang dipakai di hutang supplier adalah `unitCost` dari PO (harga sementara). Manager bisa update kemudian saat invoice datang.

**Endpoint:** `PATCH /api/bo/purchase-orders/[id]/update-invoice`

```typescript
// Request:
{
  invoiceNumber: string,
  items: Array<{ poItemId, invoiceUnitCost }>,
}

// Logic:
// 1. Update purchaseOrderItems.invoiceUnitCost per item
// 2. Recalculate supplierPayables.totalAmount = sum(qtyReceived × invoiceUnitCost)
// 3. Update purchaseOrders.invoiceNumber, invoiceUpdatedAt
// NOTE: Tidak ubah batch cost yang sudah di-insert ke stock (forward only)
```

---

### T-055: Handle Qty Kurang / Backorder

Track dari `qtyOrdered vs qtyReceived` di `purchaseOrderItems`. Status `PARTIALLY_RECEIVED` sebagai sinyal.

**Endpoint:** `PATCH /api/bo/purchase-orders/[id]/cancel-remaining`

```typescript
// Manager putuskan tidak tunggu sisa qty dari supplier
// Jika ada yang sudah received → FULLY_RECEIVED (anggap selesai)
// Jika belum ada yang received sama sekali → CANCELLED
```

---

### T-056: Handle Harga Aktual Beda dari PO

Discrepancy terdeteksi saat Manager input `invoiceUnitCost`. UI Backoffice tampilkan flag ⚠️ jika beda > 5% dari `unitCost`. Manager accept → hutang supplier diupdate. Tidak ada flow otomatis reject — koordinasi manual dengan supplier.

---

### T-057: Supplier Payables Tracking (Backoffice)

**Endpoint:** `GET /api/bo/supplier-payables?supplierId=&status=UNPAID,PARTIAL`

```typescript
// Return per hutang: poNumber, supplierName, totalAmount, paidAmount, remaining, dueAt, status
```

**Endpoint:** `POST /api/bo/supplier-payables/[id]/pay`

```typescript
// Request: { amount, method: 'CASH'|'TRANSFER'|'CEK', referenceNumber?, note?, paidById }
// Logic:
// 1. Insert supplierPayablePayments
// 2. Update paidAmount += amount
// 3. Update status: paidAmount >= totalAmount → PAID, > 0 → PARTIAL
// 4. Insert audit log
```

---

### T-058: Auto-Update FIFO Batch saat Approve Receiving (Backoffice)

**Endpoint:** `PATCH /api/bo/purchase-orders/[id]/approve-receiving`

```typescript
// Request: { approvedById: number, notes?: string }

// Logic per item (dalam 1 DB transaction):
// costPrice = invoiceUnitCost ?? unitCost
// qtyNet = qtyReceived - qtyDamaged

// 1. Insert productStockBatches:
//    { productId, branchId, uomId, qtyReceived: qtyNet, qtyRemaining: qtyNet,
//      costPrice, receivedAt: now(), expiryDate }
// 2. Upsert productStocks.qty += qtyNet
// 3. Insert audit log (type: 'PO_RECEIVING')

// Setelah semua item:
// 4. Insert supplierPayables:
//    { poId, supplierId, totalAmount: sum(qtyNet × costPrice), status: UNPAID }
// 5. Update status PO
```

**Helper:** `apps/backoffice/src/lib/po-batch-updater.ts`

```typescript
export async function applyPOReceivingBatches(
  db: DrizzleClient,
  poId: number,
  approvedById: number
): Promise<void>
```

---

### T-059: Input Barang Rusak (POS) — MVP Sprint 7 Story 7.3

**File baru di POS:**
- `apps/pos-desktop/src/pages/DamagedGoods.tsx`
- `apps/pos-desktop/src/components/damaged/DamagedForm.tsx`

**Alur UI:**

```
Halaman Barang Rusak:
  Pilih alasan: RUSAK | EXPIRED | HILANG
  List produk yang mau ditulis off:
  | Produk      | Qty   | Satuan | Harga Modal | Nilai Rugi  |
  | Obat XYZ    | [ 5 ] | BOX    | Rp 50.000   | Rp 250.000  |
  Notes (opsional)
  Summary: Total kerugian = Rp XXX
  Tombol "Submit Write-Off"
```

**Endpoint:** `POST /api/pos/damaged-goods`

```typescript
// Request:
{
  branchId: number,
  shiftId?: number,
  reportedById: number,
  reason: 'RUSAK' | 'EXPIRED' | 'HILANG',
  notes?: string,
  items: Array<{ productId, uomId, qty }>,
}

// Logic:
// 1. Untuk setiap item, ambil costPrice dari FIFO batch tertua (seperti di T-046)
// 2. Hitung lossValue = qty × costPrice per item
// 3. Kurangi stock dari FIFO batch (sama dengan SO variance minus)
// 4. Insert damagedGoods + damagedGoodsItems
// 5. Insert audit log
// 6. Return { totalLossValue, items dengan costPrice }
```

**Akses:** Kasir dan Gudang — hanya bisa dilakukan saat ada shift aktif

---

### T-060: Surat Jalan / Delivery Order (POS) — MVP Sprint 5

Surat Jalan di-trigger manual setelah transaksi checkout selesai.

**Alur:**

```
Setelah PaymentSuccess dialog:
  Tampil prompt: "Cetak Surat Jalan?"
  [Ya, Cetak Surat Jalan] [Tidak]

Jika Ya → form singkat:
  Nama penerima (auto-fill dari customer jika ada, bisa edit)
  Alamat pengiriman (optional)
  Notes (optional)
  Preview → Print
```

**Endpoint:** `POST /api/pos/delivery-orders`

```typescript
// Request:
{
  transactionId: number,
  branchId: number,
  printedById: number,
  customerName: string,
  customerAddress?: string,
  notes?: string,
}

// Logic:
// 1. Auto-generate doNumber: DO-YYYYMMDD-XXXX
// 2. Ambil totalWeightGram dari transaction items (sum product.weightGram × qty)
// 3. Insert deliveryOrders
// 4. Return data lengkap untuk print
```

**Print template A4:**

```
┌─────────────────────────────────────────────────────┐
│  SURAT JALAN                    No: DO-20260418-0001 │
│  Hammielion Petshop — Cabang [X]  Tgl: 18 April 2026│
├─────────────────────────────────────────────────────┤
│  Kepada:  [Nama Customer]                           │
│  Alamat:  [Alamat]                                  │
├─────────────────────────────────────────────────────┤
│  No | Produk          | Satuan | Qty  | Berat       │
│   1 | Royal Canin 8kg | Sak    |   2  | 16.0 kg     │
│   2 | Whiskas Tuna    | Pack   |   5  |  2.5 kg     │
├─────────────────────────────────────────────────────┤
│  Total Berat: 18.5 kg                               │
│  Catatan: [notes]                                   │
│  Diterima oleh: ________________  Tgl: __________   │
└─────────────────────────────────────────────────────┘
```

**File baru:**
- `apps/pos-desktop/src/components/pos/DeliveryOrderDialog.tsx` — dialog prompt + form setelah checkout
- `apps/pos-desktop/src/components/pos/DeliveryOrderPreview.tsx` — preview sebelum print

**Edit:** `apps/pos-desktop/src/components/pos/PaymentSuccessDialog.tsx` — tambah prompt surat jalan

---

## 4. Urutan Implementasi

```
1.  DB Migration — tambah kolom PO + tabel baru: poReceivingItems, supplierPayablePayments,
                   damagedGoods, damagedGoodsItems, deliveryOrders
2.  T-060: deliveryOrders endpoint + DeliveryOrderDialog di POS (kecil, independent)
3.  T-059: damagedGoods endpoint + DamagedGoods page di POS
4.  T-050: suggestions endpoint + POS UI buat PO (PORequest page)
5.  T-051: approve/reject/mark-transit/edit endpoints di Backoffice
6.  T-058: po-batch-updater helper
7.  T-053: receive endpoint (POS side)
8.  T-058: approve-receiving endpoint (Backoffice, pakai helper)
9.  T-054: update-invoice endpoint
10. T-055: cancel-remaining endpoint
11. T-057: supplier-payables GET + pay endpoints
12. T-053: POS UI — Receiving page
13. Integrasi: route /po-request, /receiving, /damaged-goods di App.tsx + tombol POSHeader
14. Test end-to-end: PO request POS → approve BO → terima POS → approve receiving BO →
    cek stock naik + hutang tercatat → bayar hutang → cek PAID
```

---

## 5. File yang Perlu Dibuat / Diubah

| File | Action | Task |
|------|--------|------|
| `packages/db/src/schema/purchase_orders.ts` | EDIT | Tambah kolom + tabel poReceivingItems + supplierPayablePayments |
| `packages/db/src/schema/master.ts` | EDIT | Tambah kolom ke suppliers |
| `packages/db/src/schema/damaged_goods.ts` | CREATE | Tabel damagedGoods + damagedGoodsItems |
| `packages/db/src/schema/delivery_orders.ts` | CREATE | Tabel deliveryOrders |
| `packages/db/src/migrations/XXXX_phase5_schema.sql` | CREATE | Migration semua tabel baru |
| `packages/shared/src/types/purchase-order.ts` | CREATE | Types PO |
| `packages/shared/src/types/damaged-goods.ts` | CREATE | Types Barang Rusak |
| `apps/backoffice/src/lib/po-batch-updater.ts` | CREATE | T-058 helper |
| `apps/backoffice/app/api/pos/purchase-orders/route.ts` | CREATE | T-050 (POS buat + list PO) |
| `apps/backoffice/app/api/pos/purchase-orders/suggestions/route.ts` | CREATE | T-052 |
| `apps/backoffice/app/api/pos/purchase-orders/[id]/receive/route.ts` | CREATE | T-053 |
| `apps/backoffice/app/api/pos/damaged-goods/route.ts` | CREATE | T-059 |
| `apps/backoffice/app/api/pos/delivery-orders/route.ts` | CREATE | T-060 |
| `apps/backoffice/app/api/bo/purchase-orders/route.ts` | CREATE | T-051 (list semua PO) |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/route.ts` | CREATE | T-051 (detail + edit) |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/approve/route.ts` | CREATE | T-051 |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/reject/route.ts` | CREATE | T-051 |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/mark-transit/route.ts` | CREATE | T-051 |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/print/route.ts` | CREATE | T-051 |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/approve-receiving/route.ts` | CREATE | T-058 |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/update-invoice/route.ts` | CREATE | T-054, T-056 |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/cancel-remaining/route.ts` | CREATE | T-055 |
| `apps/backoffice/app/api/bo/supplier-payables/route.ts` | CREATE | T-057 |
| `apps/backoffice/app/api/bo/supplier-payables/[id]/pay/route.ts` | CREATE | T-057 |
| `apps/pos-desktop/src/pages/PORequest.tsx` | CREATE | T-050 |
| `apps/pos-desktop/src/components/po/POSuggestionList.tsx` | CREATE | T-050 |
| `apps/pos-desktop/src/components/po/POForm.tsx` | CREATE | T-050 |
| `apps/pos-desktop/src/components/po/POReviewPanel.tsx` | CREATE | T-050 |
| `apps/pos-desktop/src/pages/Receiving.tsx` | CREATE | T-053 |
| `apps/pos-desktop/src/components/receiving/POList.tsx` | CREATE | T-053 |
| `apps/pos-desktop/src/components/receiving/ReceivingForm.tsx` | CREATE | T-053 |
| `apps/pos-desktop/src/pages/DamagedGoods.tsx` | CREATE | T-059 |
| `apps/pos-desktop/src/components/damaged/DamagedForm.tsx` | CREATE | T-059 |
| `apps/pos-desktop/src/components/pos/DeliveryOrderDialog.tsx` | CREATE | T-060 |
| `apps/pos-desktop/src/components/pos/DeliveryOrderPreview.tsx` | CREATE | T-060 |
| `apps/pos-desktop/src/components/pos/PaymentSuccessDialog.tsx` | EDIT | T-060 tambah prompt DO |
| `apps/pos-desktop/src/App.tsx` | EDIT | Tambah route /po-request, /receiving, /damaged-goods |
| `apps/pos-desktop/src/components/layout/POSHeader.tsx` | EDIT | Tambah akses PO Request, Receiving, Barang Rusak |

---

## 6. Catatan untuk Phase 6

Setelah Phase 5 selesai, **MVP masih kurang 2 fitur Backoffice**:

| Fitur | MVP Sprint | Notes |
|-------|-----------|-------|
| Dashboard KPI | Sprint 3 | Total penjualan, top produk, stock alert, pending approvals |
| Laporan Keuangan | Sprint 8 | Laporan Omset, Laba Rugi, Pengeluaran Bulanan |

Phase 6 = kedua fitur ini → MVP **COMPLETE**.  
Phase 7+ (Void, Discount Engine, Offline Sync, Loyalty) = post-MVP.
