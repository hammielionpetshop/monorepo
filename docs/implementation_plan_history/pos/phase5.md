# Implementation Plan — Phase 5: Purchase Order

**Tanggal dibuat:** 2026-04-18
**Referensi PRD:** `docs/pos_prd_1/05.11-purchase-order.md`, `docs/bo_prd_1/05.2-user-rbac.md`
**Tasks:** T-050, T-051, T-052, T-053, T-054, T-055, T-056, T-057, T-058

---

## 1. Keputusan Desain (Confirmed)

| # | Keputusan |
|---|-----------|
| 1 | **Siapa buat PO** — Manager (termasuk Manager Toko). Buat PO dari Backoffice, bukan dari POS kasir biasa. |
| 2 | **Auto-suggest** — Sederhana: produk dengan stock < 10 muncul sebagai saran di form buat PO. Tidak ada konfigurasi threshold. |
| 3 | **Merge PO** — Tidak diimplementasikan. |
| 4 | **Approval threshold** — Manager Backoffice bisa approve PO < Rp 5.000.000. Owner wajib approve jika total ≥ Rp 5.000.000. |
| 5 | **Kirim ke supplier** — Print saja (tidak ada email/WA). |
| 6 | **Invoice terlambat** — Gudang input qty saat surat jalan datang, pakai harga lama (harga PO). PO bisa di-edit di kemudian hari untuk update harga invoice. TIDAK ada recalculate COGS retroaktif — harga hanya update forward. |
| 7 | **Supplier payment** — Hanya di Backoffice (bukan POS). |
| 8 | **Format PO Number** — `PO-YYYYMMDD-XXXX` (increment per hari per cabang). |

---

## 2. Kondisi Database Saat Ini

Schema `purchase_orders`, `purchase_order_items`, `po_receiving_logs`, `supplier_payables` sudah ada di `packages/db/src/schema/purchase_orders.ts`, tapi banyak kolom penting yang belum ada.

**Yang perlu ditambahkan via migration:**

```typescript
// purchaseOrders — tambah kolom:
status:             // extend ke: DRAFT | PENDING_APPROVAL | APPROVED | IN_TRANSIT | PARTIALLY_RECEIVED | FULLY_RECEIVED | CANCELLED
createdById:        integer           // FK users.id
approvedById:       integer           // FK users.id (nullable)
approvedAt:         timestamp         // (nullable)
rejectedById:       integer           // FK users.id (nullable)
rejectedAt:         timestamp         // (nullable)
rejectionNote:      text              // (nullable)
notes:              text              // catatan internal (nullable)
targetDeliveryDate: timestamp         // (nullable)
invoiceNumber:      varchar(100)      // diisi saat invoice datang (nullable)
invoiceUpdatedAt:   timestamp         // (nullable)

// purchaseOrderItems — tambah kolom:
qtyDamaged:         decimal(12,2)     // default 0 — qty rusak saat receiving
invoiceUnitCost:    decimal(12,2)     // harga actual dari invoice (nullable — berbeda dari unitCost PO)
expiryDate:         timestamp         // (nullable) tanggal expired batch yang diterima

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
  method varchar(20),         // CASH | TRANSFER | CEK
  referenceNumber varchar(100) nullable,  // no. transfer / no. cek
  note text nullable,
  paidById integer FK users.id,
  paidAt timestamp defaultNow
}
```

---

## 3. Task Breakdown

### T-050: Buat PO Baru (Draft)

**Endpoint (Backoffice):** `POST /api/bo/purchase-orders`

```typescript
// Request:
{
  branchId: number,
  supplierId: number,
  items: Array<{
    productId: number,
    uomId: number,
    qtyOrdered: number,
    unitCost: number,       // auto-filled dari harga beli terakhir, bisa di-edit
  }>,
  notes?: string,
  targetDeliveryDate?: string,
}

// Logic server:
// 1. Auto-generate poNumber: PO-YYYYMMDD-XXXX (increment per hari per cabang)
// 2. Hitung totalAmount = sum(qtyOrdered × unitCost)
// 3. Simpan status DRAFT
// 4. Return { poId, poNumber }
```

**Endpoint:** `GET /api/bo/purchase-orders` — list PO per cabang, filter by status

**Endpoint:** `GET /api/bo/purchase-orders/[id]` — detail PO + items

**Endpoint:** `PATCH /api/bo/purchase-orders/[id]` — edit PO (hanya jika status DRAFT/PENDING_APPROVAL/APPROVED)

---

### T-051: Alur Approval (Draft → Approved → IN_TRANSIT)

**PATCH `/api/bo/purchase-orders/[id]/submit`** — Manager submit PO

```typescript
// DRAFT → PENDING_APPROVAL
// Validasi: setidaknya 1 item, supplierId valid
```

**PATCH `/api/bo/purchase-orders/[id]/approve`** — Approve PO

```typescript
// Request:
{ approvedById: number, notes?: string }

// Logic:
// 1. Cek threshold: jika totalAmount >= 5_000_000 → hanya Owner yang bisa approve
//    Jika totalAmount < 5_000_000 → Manager Backoffice atau Owner bisa approve
// 2. PENDING_APPROVAL → APPROVED
// 3. Simpan approvedById, approvedAt
```

**PATCH `/api/bo/purchase-orders/[id]/reject`** — Reject PO

```typescript
// Request:
{ rejectedById: number, rejectionNote: string }
// PENDING_APPROVAL → DRAFT (bukan REJECTED — bisa diperbaiki dan submit ulang)
```

**PATCH `/api/bo/purchase-orders/[id]/mark-transit`** — Manager tandai sudah dikirim supplier

```typescript
// APPROVED → IN_TRANSIT
// Hanya Manager / Owner
```

**GET `/api/bo/purchase-orders/[id]/print`** — Generate data untuk print PO document

```typescript
// Return semua data PO + items + supplier + branch untuk di-render di print template
```

---

### T-052: Auto-Suggest Restocking

**Endpoint:** `GET /api/bo/purchase-orders/suggestions?branchId=1&supplierId=2`

```typescript
// Logic:
// 1. Query productStocks WHERE branchId = X AND qty < 10
// 2. Join products, unitsOfMeasure (base UOM)
// 3. Join productStockBatches ORDER BY receivedAt DESC LIMIT 1
//    → ambil unitCost terakhir sebagai harga beli terakhir
// 4. Return:
{
  productId, productName, sku,
  currentStock, baseUomCode,
  lastPurchasePrice,         // dari batch terakhir
  lastSupplierId,            // supplier terakhir beli produk ini
}
// Filter opsional: jika supplierId di-pass, return hanya produk dari supplier tersebut
```

**Cara pakai di UI:** Saat buka form buat PO, ada tab "Saran Restocking" yang load endpoint ini. Manager bisa checklist produk → klik "Tambahkan ke PO".

---

### T-053: Receiving Barang di Gudang (POS)

**File baru di POS:**
- `apps/pos-desktop/src/pages/Receiving.tsx` — halaman utama receiving
- `apps/pos-desktop/src/components/receiving/POList.tsx` — list PO yang siap diterima
- `apps/pos-desktop/src/components/receiving/ReceivingForm.tsx` — form input qty per item

**Alur UI:**

```
Halaman Receiving:
  List PO dengan status APPROVED / IN_TRANSIT (untuk cabang ini)
  Per baris: PO number, supplier, tanggal, total item, status

Klik PO → ReceivingForm:
  Header: PO info, toggle "Invoice sudah diterima?"
  Tabel per item:
  | Produk      | Qty PO | Qty Terima | Qty Rusak | Expired   |
  | Royal Canin | 50 Sak | [  48   ]  | [  2   ]  | [optional]|
  Tombol: "Submit Penerimaan"
```

**Endpoint (Backoffice):** `GET /api/pos/purchase-orders?branchId=1&status=APPROVED,IN_TRANSIT`

**Endpoint (Backoffice):** `POST /api/pos/purchase-orders/[id]/receive`

```typescript
// Request:
{
  receivedById: number,
  invoiceReceived: boolean,
  photoUrls?: string[],
  note?: string,
  items: Array<{
    poItemId: number,
    qtyReceived: number,
    qtyDamaged: number,     // default 0
    expiryDate?: string,    // ISO date string
  }>,
}

// Logic:
// 1. Insert poReceivingLogs (header)
// 2. Insert poReceivingItems (per item)
// 3. Update purchaseOrderItems.qtyReceived += qtyReceived (per item)
// 4. Cek apakah semua item sudah fully received:
//    → Semua qtyReceived >= qtyOrdered: status FULLY_RECEIVED
//    → Ada yang kurang: status PARTIALLY_RECEIVED
// 5. BELUM update stock — stock update terjadi saat Backoffice approve receiving
```

---

### T-054: Handle Invoice Belum Datang

- Saat `invoiceReceived = false` di receiving → gunakan `unitCost` dari PO sebagai harga sementara di `supplierPayables`
- PO bisa di-edit harga invoice di kemudian hari

**Endpoint:** `PATCH /api/bo/purchase-orders/[id]/update-invoice`

```typescript
// Request:
{
  invoiceNumber: string,
  invoiceReceived: boolean,
  items: Array<{
    poItemId: number,
    invoiceUnitCost: number,   // harga actual dari invoice
  }>,
}

// Logic:
// 1. Update purchaseOrderItems.invoiceUnitCost per item
// 2. Recalculate supplierPayables.totalAmount = sum(qtyReceived × invoiceUnitCost)
// 3. Update invoiceNumber, invoiceUpdatedAt di purchaseOrders
// NOTE: TIDAK ubah batch cost yang sudah masuk stock (forward only)
```

---

### T-055: Handle Qty Kurang / Backorder

- Tidak ada tabel backorder terpisah — cukup track dari `qtyOrdered vs qtyReceived` di `purchaseOrderItems`
- Status PO `PARTIALLY_RECEIVED` sudah cukup sebagai sinyal

**Endpoint (Backoffice):** `PATCH /api/bo/purchase-orders/[id]/cancel-remaining`

```typescript
// Digunakan jika Manager memutuskan tidak tunggu sisa qty
// Logic: set semua item sisa (qtyOrdered - qtyReceived) menjadi di-cancel
//        Jika ada qty yang sudah diterima → status FULLY_RECEIVED
//        Jika belum ada yang diterima sama sekali → status CANCELLED
```

---

### T-056: Handle Harga Aktual Beda dengan PO

- Gudang saat receiving: tidak wajib input harga, cukup qty
- Discrepancy harga terdeteksi saat Manager input `invoiceUnitCost` di endpoint `update-invoice`
- UI Backoffice menampilkan flag ⚠️ jika `invoiceUnitCost` beda > 5% dari `unitCost`
- Manager bisa accept (update hutang supplier) atau reject item tersebut

Tidak ada flow otomatis untuk reject item — cukup catatan manual di `note` dan koordinasi offline dengan supplier.

---

### T-057: Supplier Payables Tracking

**Endpoint:** `GET /api/bo/supplier-payables?supplierId=&status=UNPAID,PARTIAL`

```typescript
// Return: list hutang per PO, per supplier
// Include: poNumber, supplierId, supplierName, totalAmount, paidAmount, remaining, dueAt, status
```

**Endpoint:** `POST /api/bo/supplier-payables/[id]/pay`

```typescript
// Request:
{
  amount: number,
  method: 'CASH' | 'TRANSFER' | 'CEK',
  referenceNumber?: string,
  note?: string,
  paidById: number,
}

// Logic:
// 1. Insert supplierPayablePayments
// 2. Update supplierPayables.paidAmount += amount
// 3. Update status:
//    paidAmount >= totalAmount → PAID
//    paidAmount > 0 → PARTIAL
// 4. Insert audit log
```

---

### T-058: Auto-Update FIFO Batch saat Approve Receiving

**Endpoint (Backoffice):** `PATCH /api/bo/purchase-orders/[id]/approve-receiving`

```typescript
// Request:
{ approvedById: number, notes?: string }

// Logic (per item yang diterima):
// costPrice = invoiceUnitCost ?? unitCost (harga PO jika invoice belum ada)
// qtyNet = qtyReceived - qtyDamaged

// Untuk setiap item:
// 1. Insert productStockBatches:
//    { productId, branchId, uomId, qtyReceived: qtyNet, qtyRemaining: qtyNet,
//      costPrice, receivedAt: now(), expiryDate }
// 2. Update productStocks.qty += qtyNet (upsert)
// 3. Insert audit log (type: 'PO_RECEIVING')

// Setelah semua item:
// 4. Insert supplierPayables:
//    { poId, supplierId, totalAmount: sum(qtyNet × costPrice), status: UNPAID }
// 5. Update purchaseOrders.status → FULLY_RECEIVED / PARTIALLY_RECEIVED (sesuai kondisi)
```

**Helper:** `apps/backoffice/src/lib/po-batch-updater.ts`

```typescript
export async function applyPOReceivingBatches(
  db: DrizzleClient,
  poId: number,
  approvedById: number
): Promise<void>
// Dipanggil dari approve-receiving endpoint
// Handle semua insert batch + update stock + create payable dalam 1 DB transaction
```

---

## 4. Urutan Implementasi

```
1. DB Migration — tambah kolom ke purchaseOrders, purchaseOrderItems, suppliers
                  + tabel baru: poReceivingItems, supplierPayablePayments
2. T-050: GET suggestions endpoint (butuh data stock & batch)
3. T-050: POST/GET/PATCH purchase-orders endpoints (CRUD PO)
4. T-051: submit, approve, reject, mark-transit endpoints
5. T-058: po-batch-updater helper
6. T-053: POST receive endpoint (POS side) — tanpa stock update dulu
7. T-058: approve-receiving endpoint (pakai helper — ini yang update stock)
8. T-054: update-invoice endpoint
9. T-055: cancel-remaining endpoint
10. T-057: supplier-payables GET + pay endpoints
11. T-053: POS UI — Receiving page (POList + ReceivingForm)
12. Integrasi POS: tambah route /receiving di App.tsx + tombol di POSHeader (role Gudang / Manager Toko)
13. Test end-to-end: buat PO → approve → terima di POS → approve receiving di BO → cek stock naik → cek hutang supplier tercatat
```

---

## 5. File yang Perlu Dibuat / Diubah

| File | Action | Task |
|------|--------|------|
| `packages/db/src/schema/purchase_orders.ts` | EDIT | Tambah kolom baru + tabel poReceivingItems + supplierPayablePayments |
| `packages/db/src/schema/master.ts` | EDIT | Tambah kolom ke suppliers |
| `packages/db/src/migrations/XXXX_phase5_po_schema.sql` | CREATE | Migration |
| `packages/shared/src/types/purchase-order.ts` | CREATE | Types PO |
| `apps/backoffice/src/lib/po-batch-updater.ts` | CREATE | T-058 helper |
| `apps/backoffice/app/api/bo/purchase-orders/route.ts` | CREATE | T-050 (list + create) |
| `apps/backoffice/app/api/bo/purchase-orders/suggestions/route.ts` | CREATE | T-052 |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/route.ts` | CREATE | T-050 (detail + edit) |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/submit/route.ts` | CREATE | T-051 |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/approve/route.ts` | CREATE | T-051 |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/reject/route.ts` | CREATE | T-051 |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/mark-transit/route.ts` | CREATE | T-051 |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/print/route.ts` | CREATE | T-051 (print data) |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/approve-receiving/route.ts` | CREATE | T-058 |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/update-invoice/route.ts` | CREATE | T-054, T-056 |
| `apps/backoffice/app/api/bo/purchase-orders/[id]/cancel-remaining/route.ts` | CREATE | T-055 |
| `apps/backoffice/app/api/pos/purchase-orders/route.ts` | CREATE | T-053 (POS list PO) |
| `apps/backoffice/app/api/pos/purchase-orders/[id]/receive/route.ts` | CREATE | T-053 (submit receiving) |
| `apps/backoffice/app/api/bo/supplier-payables/route.ts` | CREATE | T-057 (list) |
| `apps/backoffice/app/api/bo/supplier-payables/[id]/pay/route.ts` | CREATE | T-057 (add payment) |
| `apps/pos-desktop/src/pages/Receiving.tsx` | CREATE | T-053 |
| `apps/pos-desktop/src/components/receiving/POList.tsx` | CREATE | T-053 |
| `apps/pos-desktop/src/components/receiving/ReceivingForm.tsx` | CREATE | T-053 |
| `apps/pos-desktop/src/App.tsx` | EDIT | Tambah route `/receiving` |
| `apps/pos-desktop/src/components/layout/POSHeader.tsx` | EDIT | Tambah akses Receiving (Gudang / Manager Toko) |
