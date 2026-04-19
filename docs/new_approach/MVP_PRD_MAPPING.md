# 📘 MVP PRD MAPPING - Referensi Lengkap ke PRD

## 🎯 TUJUAN DOKUMEN

Dokumen ini memetakan **17 fitur MVP** ke **PRD reference** yang detail, sehingga developer tahu:
- 📖 PRD mana yang harus dibaca
- 📄 Section berapa yang relevan
- ✂️ Apa yang diambil (Take)
- 🚫 Apa yang di-skip (Skip untuk Phase 2)
- 🔧 Simplifikasi apa yang dilakukan

---

## 📋 QUICK REFERENCE TABLE

| Fitur | PRD File | Section | Sprint |
|-------|----------|---------|--------|
| **POS FITUR** | | | |
| POS-1: Login User | POS_PRD.md | 5.9 | Sprint 1 |
| POS-2: Penjualan | POS_PRD.md | 5.1-5.4 | Sprint 4-5 |
| POS-3: Stock Opname Harian | POS_PRD.md | 5.10 | Sprint 7 |
| POS-4: Input Barang Rusak | POS_PRD.md | 5.11.4 | Sprint 7 |
| POS-5: Settlement | POS_PRD.md | 5.6 (v1.1) | Sprint 6 |
| POS-6: Pengeluaran Harian | POS_PRD.md | 5.6.3 | Sprint 6 |
| POS-7: PO Request | POS_PRD.md | 5.11 | Sprint 8 |
| POS-8: Open Bill | POS_PRD.md | 5.4.4 | Sprint 5 |
| POS-9: Shift Management | POS_PRD.md | 5.6.1 | Sprint 6 |
| POS-10: Multi-Kasir | POS_PRD.md | 5.6 (v1.1) | Sprint 6 |
| POS-11: Tampilan Berat | BACKOFFICE_PRD_2 | 3.1.1 | Sprint 5 |
| **BACKOFFICE FITUR** | | | |
| BO-1: Login & User Role | BACKOFFICE_PRD_1 | 3.2 | Sprint 1 |
| BO-2: Dashboard KPI | BACKOFFICE_PRD_1 | 3.1 | Sprint 3 |
| BO-3: Master Data | BACKOFFICE_PRD_2 | Full | Sprint 2-3 |
| BO-4: Inventory per Cabang | BACKOFFICE_PRD_3 | 3.1 | Sprint 3 |
| BO-5: SO Bulanan | BACKOFFICE_PRD_3 | 3.6 | Sprint 7 |
| BO-6: Laporan Keuangan | BACKOFFICE_PRD_5 | 3.1,3.3,3.4 | Sprint 8 |

---

# POS FITUR MAPPING

## POS-1: Login User

### 📖 PRD Reference
- **File**: `POS_PRD.md`
- **Section**: 5.9 User Authentication
- **Related**: `BACKOFFICE_PRD_1_FOUNDATION.md` Section 3.2

### ✅ Take (Ambil untuk MVP)
```
✅ User authentication (email + password)
✅ Session management (JWT token, 30 min idle timeout)
✅ 4 roles: Owner, Manager, Kasir, Gudang
✅ Login flow: Email → Password → Validate → Create session
✅ Logout flow: Clear session
✅ Auto-logout after 30 min idle
```

### ❌ Skip (Phase 2)
```
❌ PIN authentication (pakai password only di MVP)
❌ 2FA / OTP
❌ Biometric login
❌ IP whitelist
❌ 7 roles (cukup 4 di MVP)
❌ Custom RBAC (permission fixed per role)
```

### 🔧 Simplified
- **Password only** (no PIN option)
- **4 roles fixed** dengan permission hardcoded
- **Basic session** (no advanced security features)

---

## POS-2: Penjualan (Checkout)

### 📖 PRD Reference
- **File**: `POS_PRD.md`
- **Section**: 5.1 (Product Selection), 5.2 (Pricing), 5.3 (FIFO), 5.4 (Payment)
- **Related**: `BACKOFFICE_PRD_3_INVENTORY.md` Section 3.2 (FIFO Batch)

### ✅ Take (Ambil untuk MVP)
```
✅ Checkout flow:
   1. Scan barcode / search produk
   2. Pilih UOM (5 UOM: Pcs, Sak, Dus, Box, Pack)
   3. Pilih tier harga (Retail/Grosir/Member/Owner Manual)
   4. Input qty
   5. Auto-break logic (Sak → Pcs jika Sak habis)
   6. FIFO COGS calculation (dari batch terlama)
   7. Calculate subtotal & total
   8. Payment (Cash, QRIS only)
   9. Calculate change
   10. Print receipt (thermal 58mm/80mm)

✅ Multi-UOM (5 UOM):
   - Pcs (unit terkecil)
   - Sak (karung)
   - Dus (box besar)
   - Box (box sedang)
   - Pack (kemasan)
   - Conversion ratio per produk (configurable)
   - Auto-break: Jual Sak, stock Sak habis → pecah dari Pcs

✅ Multi-Harga (4 tier):
   - Tier 1: Retail (harga normal)
   - Tier 2: Grosir (untuk reseller)
   - Tier 3: Member (untuk member card)
   - Tier 4: Owner Manual Input (owner override saat transaksi)
   - Harga tidak harus proporsional antar UOM
   - Same price semua cabang (di MVP)

✅ FIFO STRICT:
   - Batch tracking per PO received
   - Each batch: batch_number, qty_in, qty_balance, cogs_per_unit, received_date
   - Saat penjualan: Ambil dari batch TERLAMA (ORDER BY received_date ASC)
   - Kurangi qty_balance batch tersebut
   - Jika batch habis → lanjut batch berikutnya
   - COGS = weighted average dari batch yang dipakai
   - Auto-break batch: Child batch link parent_batch_id

✅ Payment Method:
   - Cash (input bayar, hitung kembalian)
   - QRIS (scan QR, confirm payment)

✅ Print Receipt:
   - Thermal 58mm atau 80mm
   - Header: Logo, nama toko, alamat, phone
   - Body: List item (nama, qty, UOM, harga satuan, subtotal)
   - Footer: Total, discount (if any), payment method, change
   - Tanggal, waktu, kasir name, invoice number
```

### ❌ Skip (Phase 2)
```
❌ Credit card payment
❌ Debit card payment
❌ Installment payment
❌ Void transaction (owner bisa void di database manual dulu)
❌ Retur customer (fitur terpisah Phase 2)
❌ Piutang customer / kredit
❌ Multiple barcodes per produk (1 barcode only)
❌ Discount per item (discount global only)
❌ Custom receipt template
❌ Email receipt
❌ Harga per cabang berbeda (same price all branches)
```

### 🔧 Simplified
- **2 payment method** only (Cash, QRIS)
- **1 barcode** per produk
- **Fixed receipt template** (tidak customizable)
- **Same price** semua cabang
- **No void di POS** (owner handle manual via database)

### ⚠️ CRITICAL NOTES
```
FIFO Implementation = MOST CRITICAL FEATURE
- Sprint 4 dedicated untuk FIFO
- Allocate 2 developers
- Extra testing required
- Edge cases:
  1. Multiple batches dengan qty berbeda
  2. Auto-break (Sak → Pcs) maintain parent batch
  3. Batch habis mid-transaction
  4. Negative stock prevention
  5. COGS calculation accuracy
```

---

## POS-3: Stock Opname Harian

### 📖 PRD Reference
- **File**: `POS_PRD.md`
- **Section**: 5.10 Stock Opname
- **Related**: `BACKOFFICE_PRD_3_INVENTORY.md` Section 3.6

### ✅ Take (Ambil untuk MVP)
```
✅ SO Harian flow:
   1. Kasir pilih 20-30 item (fast-moving items)
   2. Input actual qty (count fisik)
   3. System calculate variance = actual_qty - system_qty
   4. Submit → Auto-adjust stock (no approval di MVP)
   5. Variance recorded as shrinkage/surplus

✅ Auto-adjust stock:
   - IF actual > system: Stock bertambah (surplus)
   - IF actual < system: Stock berkurang (shrinkage)
   - No manual intervention needed

✅ Variance tracking:
   - Positive variance (+): Surplus recorded
   - Negative variance (-): Shrinkage recorded
   - Tercatat di laporan pengeluaran
```

### ❌ Skip (Phase 2)
```
❌ Approval workflow untuk SO
❌ SO Besar (semua SKU) → ini jadi BO-5
❌ SO by batch (track batch mana yang variance)
❌ Upload foto stock count
❌ Notes per item variance
```

### 🔧 Simplified
- **20-30 item** only (fast-moving)
- **Direct adjust** (no approval)
- **Simple variance** (no batch-level tracking)

---

## POS-4: Input Barang Rusak

### 📖 PRD Reference
- **File**: `POS_PRD.md`
- **Section**: 5.11.4 Damaged Goods
- **Related**: `BACKOFFICE_PRD_3_INVENTORY.md` Section 3.5

### ✅ Take (Ambil untuk MVP)
```
✅ Input barang rusak flow:
   1. Select product
   2. Select UOM
   3. Input qty rusak
   4. Select reason (dropdown):
      - Expired
      - Damaged (rusak fisik)
      - Defect (cacat produk)
      - Other (input manual)
   5. Submit → Auto write-off

✅ Auto write-off:
   - Stock berkurang otomatis
   - Loss = Qty × COGS (dari FIFO batch terlama)
   - Tercatat sebagai expense di laporan
   - No stock return (permanent write-off)
```

### ❌ Skip (Phase 2)
```
❌ Upload foto barang rusak
❌ Approval workflow
❌ Damaged goods inventory (simpan barang rusak)
❌ Retur ke supplier untuk barang rusak
❌ Notes detail per barang rusak
```

### 🔧 Simplified
- **4 reason** dropdown fixed
- **Direct write-off** (no approval)
- **No photo** upload

---

## POS-5: Settlement Multi-Kasir

### 📖 PRD Reference
- **File**: `POS_PRD.md`
- **Section**: 5.6 Settlement (v1.1 Multi-Kasir)
- **Related**: `BACKOFFICE_PRD_6_OPERATIONS.md` Section 3.2

### ✅ Take (Ambil untuk MVP)
```
✅ Multi-kasir settlement flow:
   1. End of shift: Manager trigger "Settlement"
   2. System calculate expected cash per kasir:
      Expected Cash = Modal + Sales Cash - Daily Expenses
   3. Each kasir input real cash counted
   4. System calculate variance per kasir:
      Variance = Real Cash - Expected Cash
   5. Generate settlement report dengan breakdown per kasir
   6. Manager review & approve settlement
   7. Close shift

✅ Modal shared:
   - Modal awal: Rp 200.000 (shared untuk 2-3 kasir)
   - Tidak per kasir (simplified)

✅ Breakdown per kasir:
   - Kasir A: Sales Cash, Expected, Real, Variance
   - Kasir B: Sales Cash, Expected, Real, Variance
   - Kasir C: Sales Cash, Expected, Real, Variance
   - Total Shift: Total sales, Total variance

✅ Variance tracking:
   - Positive variance (+): Uang lebih
   - Negative variance (-): Uang kurang
   - Tracked per kasir untuk accountability
```

### ❌ Skip (Phase 2)
```
❌ Force close shift (owner close paksa shift yang lupa ditutup)
❌ Grace period untuk variance
❌ Settlement approval workflow
❌ Edit settlement setelah submit
❌ Cash terpisah per kasir (modal individual)
```

### 🔧 Simplified
- **Modal shared** Rp 200k (bukan per kasir)
- **Manual settlement** only (no force close)
- **No approval** (direct submit)

---

## POS-6: Pengeluaran Harian

### 📖 PRD Reference
- **File**: `POS_PRD.md`
- **Section**: 5.6.3 Daily Expenses
- **Related**: `BACKOFFICE_PRD_5_FINANCE.md` Section 3.4

### ✅ Take (Ambil untuk MVP)
```
✅ Input daily expenses saat settlement:
   1. During settlement flow
   2. Kasir/Manager input pengeluaran harian
   3. Category (dropdown):
      - Transport
      - Konsumsi
      - Perlengkapan
      - Lain-lain
   4. Amount (Rp)
   5. Notes (optional)
   6. Submit → Tercatat di laporan pengeluaran

✅ Integration dengan settlement:
   - Pengeluaran dikurangi dari expected cash
   - Expected Cash = Modal + Sales Cash - Daily Expenses
```

### ❌ Skip (Phase 2)
```
❌ Upload bukti pengeluaran (foto/receipt)
❌ Approval workflow untuk pengeluaran
❌ Input pengeluaran di luar settlement (flexible timing)
❌ Custom category pengeluaran
```

### 🔧 Simplified
- **4 category** fixed
- **Input saat settlement** only (tidak bisa input kapan saja)
- **No attachment**

---

## POS-7: Pemesanan Barang ke Supplier (PO Request)

### 📖 PRD Reference
- **File**: `POS_PRD.md`
- **Section**: 5.11 PO Request
- **Related**: `BACKOFFICE_PRD_4_PURCHASING.md` Section 3.1

### ✅ Take (Ambil untuk MVP)
```
✅ PO Request flow (di POS):
   1. Kasir klik "Buat PO Request"
   2. Select supplier (dropdown)
   3. Add products:
      - Select product
      - Select UOM
      - Input qty needed
      - Harga auto-fill dari last PO (read-only)
   4. Submit PO Request → Status: PENDING_APPROVAL
   5. Notification sent ke Backoffice (Manager BO/Owner)

✅ PO Approval (di Backoffice):
   - Manager BO/Owner review PO Request
   - Approve or Reject
   - IF Approved → Status: APPROVED, ready for receiving

✅ PO Receiving (di POS):
   - Kasir receive barang dari supplier
   - Input qty received (might differ from qty ordered)
   - Submit receiving
   - System:
     1. Create FIFO batch per product received
     2. Update stock
     3. Auto-create hutang supplier
```

### ❌ Skip (Phase 2)
```
❌ PO full creation di POS (request only, approval di BO)
❌ Input harga manual di POS saat PO request
❌ Multiple suppliers per PO
❌ Partial receiving (1 PO di-receive multiple times)
❌ QC notes saat receiving
❌ Invoice handling (invoice datang/belum)
```

### 🔧 Simplified
- **Request only** di POS (approval tetap di Backoffice)
- **1 supplier** per PO
- **Harga auto-fill** dari last PO (tidak editable di POS)
- **Simple receiving** (input qty only, no QC)

---

## POS-8: Open Bill (Pending Transaction)

### 📖 PRD Reference
- **File**: `POS_PRD.md`
- **Section**: 5.4.4 Pending Transaction (implied)

### ✅ Take (Ambil untuk MVP)
```
✅ Open Bill flow:
   1. Customer belanja tapi belum bayar (misal: ambil barang dulu)
   2. Kasir klik "Pending Bill" / "Simpan untuk Nanti"
   3. Input customer info:
      - Nama customer
      - Phone (optional)
   4. Save transaction dengan status: PENDING
   5. Customer pergi

   6. Customer datang lagi (dalam 24 jam)
   7. Kasir recall pending bill:
      - Search by customer name atau phone
      - Pilih pending transaction
   8. Lanjut checkout normal
   9. Complete transaction

✅ Auto-void after 24 jam:
   - Pending bill > 24 jam → Auto-void
   - Stock dikembalikan
   - Notification ke kasir
```

### ❌ Skip (Phase 2)
```
❌ Bill splitting (1 bill jadi 2-3 bill)
❌ Multiple pending bills per customer (max 1 pending per customer)
❌ Merge pending bills
❌ Transfer pending bill ke kasir lain
❌ Edit pending bill
```

### 🔧 Simplified
- **Simple pending** status
- **1 pending** per customer max
- **24 jam** auto-void
- **Recall by name/phone** only

---

## POS-9: Shift Management

### 📖 PRD Reference
- **File**: `POS_PRD.md`
- **Section**: 5.6.1 Shift Management
- **Related**: `BACKOFFICE_PRD_6_OPERATIONS.md` Section 3.2

### ✅ Take (Ambil untuk MVP)
```
✅ Open Shift (Manager/Owner only):
   1. Manager login di POS
   2. Klik "Open Shift"
   3. Input modal awal: Rp 200.000 (default)
   4. Confirm → Shift opened
   5. Kasir bisa mulai checkout

✅ Close Shift (Manager/Owner only):
   1. After all kasir settlement
   2. Manager klik "Close Shift"
   3. System validate: All kasir sudah settle?
   4. IF yes → Close shift
   5. IF no → Warning: "Kasir X belum settle"
   6. Generate shift report

✅ Shift validation:
   - Only 1 shift open per cabang per hari (di MVP)
   - Cannot open new shift if previous shift masih open
   - Kasir cannot checkout jika shift belum open
```

### ❌ Skip (Phase 2)
```
❌ Multiple shift per hari (shift pagi/siang/malam)
❌ Auto-close shift (manual close only)
❌ Shift history detail
❌ Shift transfer (ganti manager mid-shift)
```

### 🔧 Simplified
- **1 shift per day** max
- **Manual open/close** only
- **Fixed modal** Rp 200k

---

## POS-10: Multi-Kasir per Shift

### 📖 PRD Reference
- **File**: `POS_PRD.md`
- **Section**: 5.6 Multi-Kasir (v1.1)
- **Related**: `BACKOFFICE_PRD_6_OPERATIONS.md` Section 3.2

### ✅ Take (Ambil untuk MVP)
```
✅ Multi-kasir concurrent:
   - 1 shift = 2-3 kasir bisa login bersamaan
   - Each kasir punya session sendiri
   - Each kasir bisa checkout independent
   - Modal shared Rp 200k (tidak per kasir)

✅ Settlement breakdown:
   - Saat settlement, breakdown per kasir:
     * Kasir A: X transactions, Rp Y sales
     * Kasir B: X transactions, Rp Y sales
     * Kasir C: X transactions, Rp Y sales
   - Each kasir input real cash mereka
   - Variance tracked per kasir

✅ Shared modal logic:
   - Modal Rp 200k dibagi 2-3 kasir
   - Tidak enforce split (kasir manage sendiri)
   - Settlement tetap breakdown per kasir untuk accountability
```

### ❌ Skip (Phase 2)
```
❌ Cash drawer terpisah per kasir
❌ Modal individual per kasir
❌ Enforcement cash limit per kasir
❌ Transfer cash antar kasir mid-shift
```

### 🔧 Simplified
- **Shared modal** (tidak enforce split)
- **Breakdown for tracking** only (bukan enforcement)

---

## POS-11: Tampilan Berat Pesanan

### 📖 PRD Reference
- **File**: `BACKOFFICE_PRD_2_PRODUCTS.md`
- **Section**: 3.1.1 Product Master (weight field)

### ✅ Take (Ambil untuk MVP)
```
✅ Product weight field:
   - Master product punya field "berat" (dalam gram)
   - Mandatory untuk semua product

✅ Calculate total berat:
   - Saat checkout, system calculate:
     Total Berat = SUM(qty × berat_per_item)
   - Displayed in Kg (convert dari gram)

✅ Display locations:
   1. Layar POS saat checkout:
      - Real-time display total berat
      - Update setiap add/remove item
   
   2. Receipt (struk):
      - Di footer: "Total Berat: X Kg"
   
   3. Surat Jalan (DO):
      - Di header atau footer: "Total Berat: X Kg"
```

### ❌ Skip (Phase 2)
```
❌ Weight-based shipping calculation
❌ Weight-based pricing
❌ Maximum weight limit alert
❌ Weight per UOM berbeda (weight fixed per product)
```

### 🔧 Simplified
- **Display only** (no logic based on weight)
- **Fixed weight** per product (tidak per UOM)
- **Unit: Kg** only (auto-convert dari gram)

---

# BACKOFFICE FITUR MAPPING

## BO-1: Login & User Role

### 📖 PRD Reference
- **File**: `BACKOFFICE_PRD_1_FOUNDATION.md`
- **Section**: 3.2 Authentication & Authorization

### ✅ Take (Ambil untuk MVP)
```
✅ Login flow:
   - Email + Password
   - JWT token (30 min idle timeout)
   - Session management

✅ 4 Roles:
   1. Owner (full access)
   2. Manager Backoffice (POS + BO, no delete master data)
   3. Manager Toko (per cabang, limited BO access)
   4. Kasir (POS only, no BO access)
   5. Gudang (receiving only)

✅ Permission matrix (fixed per role):
   Owner:
   - ✅ All features
   - ✅ Delete data
   - ✅ View all branches

   Manager Backoffice:
   - ✅ POS + Backoffice
   - ❌ Delete master data
   - ✅ View all branches

   Manager Toko:
   - ✅ POS full access
   - ✅ Limited BO (view stock, view reports for their branch)
   - ❌ Master data edit
   - ✅ View own branch only

   Kasir:
   - ✅ POS only
   - ❌ No Backoffice access

   Gudang:
   - ✅ PO Receiving only
   - ❌ No POS, limited BO
```

### ❌ Skip (Phase 2)
```
❌ 7 roles (cukup 4-5 di MVP)
❌ Customizable RBAC (permission per user)
❌ PIN authentication
❌ 2FA
❌ Audit log 5 tahun (cukup 30 hari di MVP)
❌ IP whitelist
```

### 🔧 Simplified
- **4-5 roles** fixed
- **Hardcoded permissions**
- **Password only**
- **30 days audit log**

---

## BO-2: Dashboard KPI

### 📖 PRD Reference
- **File**: `BACKOFFICE_PRD_1_FOUNDATION.md`
- **Section**: 3.1 Dashboard

### ✅ Take (Ambil untuk MVP)
```
✅ KPI Cards (4 cards):
   1. Total Penjualan Hari Ini
      - Gross sales
      - Net sales (after discount)
      - % vs yesterday

   2. Total Produk
      - Total SKU
      - Low stock items count
      - Out of stock items count

   3. Stock Low Alert
      - List products below minimum stock
      - Quick action: Create PO

   4. Pending Approval
      - PO pending approval count
      - Quick action: Go to approval

✅ Mode selection:
   - Per Cabang (dropdown select branch)
   - Konsolidasi (All branches)

✅ Time range:
   - Hari Ini
   - Minggu Ini
   - Bulan Ini
```

### ❌ Skip (Phase 2)
```
❌ Charts (line, pie, bar graphs)
❌ Profit margin card (Owner only)
❌ Custom KPI builder
❌ Real-time alert notifications
❌ Drill-down per card
```

### 🔧 Simplified
- **4 KPI cards** only (no charts)
- **3 time range** fixed
- **Basic display** (no drill-down)

---

## BO-3: Master Data

### 📖 PRD Reference
- **File**: `BACKOFFICE_PRD_2_PRODUCTS.md`
- **Section**: Full document (all sections)

### ✅ Take (Ambil untuk MVP)

#### **BO-3a: Master Kategori**
```
✅ Kategori 1 level only:
   - CRUD: Create, Read, Update, Delete
   - Fields: Nama kategori, Status (Active/Inactive)
   - Examples: Makanan, Obat, Aksesoris
```

#### **BO-3b: Master Cabang**
```
✅ Cabang CRUD:
   - Fields:
     * Nama cabang
     * Alamat
     * Phone
     * Manager (link to user)
     * Status (Active/Inactive)
```

#### **BO-3c: Master User & Role**
```
✅ User CRUD:
   - Fields:
     * Name
     * Email
     * Password
     * Role (dropdown: Owner/Manager BO/Manager Toko/Kasir/Gudang)
     * Branch (link to branch, kecuali Owner & Manager BO)
     * Status (Active/Inactive)
```

#### **BO-3d: Master UOM**
```
✅ 5 UOM Fixed (tidak bisa tambah):
   - Pcs (pieces - unit terkecil)
   - Sak (karung)
   - Dus (box besar)
   - Box (box sedang)
   - Pack (kemasan)
```

#### **BO-3e: Master Produk**
```
✅ Product CRUD:
   - Basic Fields:
     * SKU (auto-generate)
     * Barcode (1 barcode only)
     * Nama produk
     * Kategori (dropdown)
     * Brand (text input, simple)
     * Berat (gram) ← untuk tampilan berat pesanan
     * Has Expiry? (boolean checkbox)
     * Status (Active/Inactive)
   
   - Photo:
     * 1 photo only
     * Upload image (jpg/png)
```

#### **BO-3f: Multi-UOM per Produk**
```
✅ Setup UOM per produk:
   - Select UOM yang applicable (dari 5 UOM master)
   - Input conversion ratio per UOM
   - Example:
     * 1 Sak = 30 Pcs
     * 1 Dus = 12 Box
     * 1 Box = 6 Pack
     * 1 Pack = 10 Pcs
   
   - Auto-break logic:
     * Jual Sak, stock Sak habis → pecah dari Pcs
     * System auto-calculate: 1 Sak = 30 Pcs → ambil 30 Pcs dari stock
```

#### **BO-3g: Multi-Harga (4 Tier)**
```
✅ Setup harga per UOM per produk:
   - Tier 1: Retail (harga normal)
   - Tier 2: Grosir (harga reseller)
   - Tier 3: Member (harga member)
   - Tier 4: Owner Manual Input (placeholder, actual input di POS)
   
   - Example for "Pakan Meow":
     UOM Sak:
       - Retail: Rp 100.000
       - Grosir: Rp 95.000
       - Member: Rp 90.000
       - Owner Manual: (input di POS saat transaksi)
     
     UOM Pcs:
       - Retail: Rp 3.500
       - Grosir: Rp 3.300
       - Member: Rp 3.000
       - Owner Manual: (input di POS)
   
   - Harga TIDAK harus proporsional (Tier 2 tidak harus 5% dari Tier 1)
   - Same price semua cabang (di MVP)
```

#### **BO-3h: Master Supplier**
```
✅ Supplier CRUD:
   - Fields:
     * Nama supplier
     * Contact person
     * Phone
     * Address (optional)
     * Payment term (dropdown: COD, NET 7, NET 14, NET 30)
     * Status (Active/Inactive)
```

### ❌ Skip (Phase 2)
```
❌ Kategori 3-level hierarchy (1 level only di MVP)
❌ Icon/image per kategori
❌ Multiple barcodes per produk (1 barcode only)
❌ Tags (auto + manual)
❌ Multiple photos (1 photo only)
❌ Bulk operations (import Excel, bulk update harga)
❌ Copy harga antar cabang (same price all branches di MVP)
❌ Harga per cabang berbeda
❌ Scheduled price change
❌ Price change approval workflow
❌ Supplier bank account detail
❌ Supplier credit limit
❌ Supplier performance tracking
```

### 🔧 Simplified
- **1-level category**
- **1 barcode, 1 photo** per product
- **5 UOM fixed** (tidak bisa custom UOM)
- **4 tier pricing** (same price all branches)
- **Basic supplier info** only

---

## BO-4: Inventory per Cabang

### 📖 PRD Reference
- **File**: `BACKOFFICE_PRD_3_INVENTORY.md`
- **Section**: 3.1 Stock Monitoring

### ✅ Take (Ambil untuk MVP)
```
✅ Stock monitoring UI:
   - View stock per cabang
   - Filter:
     * By kategori
     * By status (OK / Low Stock / Out of Stock)
   
   - Stock list columns:
     * SKU
     * Nama produk
     * UOM
     * Qty current
     * Min stock (threshold)
     * Stock value (Qty × COGS)
     * Status (icon: ✅ OK / ⚠️ Low / 🔴 Out)
   
   - Stock minimum setting:
     * Per product, set minimum stock qty
     * Alert jika stock < minimum

✅ FIFO Batch view:
   - Per product, bisa view batch list:
     * Batch number
     * Qty balance
     * COGS per unit
     * Received date
     * Status (Active / Depleted)
   - Sort by received_date ASC (terlama dulu)
```

### ❌ Skip (Phase 2)
```
❌ Auto-suggest minimum stock (based on sales velocity)
❌ Stock movement report (in/out detail)
❌ Stock valuation report
❌ Stock transfer antar cabang
❌ Stock reservation (hold stock untuk PO customer)
```

### 🔧 Simplified
- **View only** (monitoring)
- **Basic filtering**
- **Manual min stock setting**

---

## BO-5: Stock Opname Bulanan

### 📖 PRD Reference
- **File**: `BACKOFFICE_PRD_3_INVENTORY.md`
- **Section**: 3.6 Stock Opname

### ✅ Take (Ambil untuk MVP)
```
✅ SO Bulanan flow:
   1. Owner/Manager create SO (semua SKU)
   2. Generate SO document (list all products)
   3. Print SO sheet untuk count fisik
   4. Staff count stock fisik
   5. Input actual qty per product di Backoffice
   6. System calculate variance per product:
      Variance = Actual Qty - System Qty
   7. Review variance (especially negative variance)
   8. Approve SO → Stock adjusted automatically
   9. Variance recorded as shrinkage/surplus

✅ SO vs SO Harian (POS):
   - SO Bulanan (BO): Semua SKU, 1x per bulan, comprehensive
   - SO Harian (POS): 20-30 item fast-moving, daily, quick count
```

### ❌ Skip (Phase 2)
```
❌ SO approval workflow (direct adjust di MVP)
❌ SO by batch (track variance per batch)
❌ Upload photo stock count
❌ Notes per item variance
❌ Compare SO history (month over month)
```

### 🔧 Simplified
- **Direct stock adjustment** (no approval)
- **Basic variance** calculation (no batch-level)

---

## BO-6: Laporan Keuangan Sederhana

### 📖 PRD Reference
- **File**: `BACKOFFICE_PRD_5_FINANCE.md`
- **Section**: 3.1 (Cash Flow), 3.3 (P&L), 3.4 (OpEx)

### ✅ Take (Ambil untuk MVP)

#### **Laporan 1: Omset (Sales Revenue)**
```
✅ Laporan Omset:
   - Gross Sales (total penjualan kotor)
   - Sales Discount (total discount given)
   - Net Sales (gross - discount)
   - Breakdown by payment method:
     * Cash
     * QRIS
   - Time range:
     * Harian
     * Mingguan
     * Bulanan
   - Mode:
     * Per cabang
     * Konsolidasi (all branches)
```

#### **Laporan 2: Laba Rugi Sederhana**
```
✅ Laporan Laba Rugi:
   REVENUE:
   - Net Sales                     Rp X

   COST OF GOODS SOLD:
   - COGS (dari FIFO)              Rp Y

   GROSS PROFIT:
   - = Net Sales - COGS            Rp Z

   OPERATING EXPENSES:
   - Daily Expenses (dari POS)     Rp A
   - Barang Rusak (write-off)      Rp B
   - Total OpEx                    Rp (A+B)

   NET PROFIT:
   - = Gross Profit - Total OpEx   Rp W

   Time range: Harian, Mingguan, Bulanan
   Mode: Per cabang, Konsolidasi
```

#### **Laporan 3: Pengeluaran Bulanan**
```
✅ Laporan Pengeluaran:
   - Total Daily Expenses (dari POS settlement)
   - Total Barang Rusak (write-off value)
   - Total Pengeluaran
   - Breakdown by category:
     * Transport
     * Konsumsi
     * Perlengkapan
     * Barang Rusak
     * Lain-lain
   
   Time range: Bulanan only
   Mode: Per cabang, Konsolidasi
```

### ❌ Skip (Phase 2)
```
❌ Cash Flow Forecast (7d/30d prediction)
❌ P&L Comparison (MoM, YoY)
❌ Balance Sheet
❌ OpEx recurring input (gaji, sewa, etc)
❌ Piutang customer tracking detail
❌ Hutang supplier aging detail (ada basic di Sprint 8)
❌ Export Excel/PDF
❌ Email report auto-send
```

### 🔧 Simplified
- **3 laporan basic** only
- **Simple calculation** (no forecast, no comparison)
- **View in browser** only (no export di MVP)

---

# 🎯 SIMPLIFIED vs FULL PRD SUMMARY

## What's INCLUDED in MVP (Take)
✅ 17 core features
✅ Multi-UOM (5 UOM) dengan auto-break
✅ Multi-Harga (4 tier) including owner manual input
✅ **FIFO strict** (batch tracking)
✅ Multi-kasir per shift (2-3 kasir)
✅ Settlement breakdown per kasir
✅ Hutang supplier tracking dengan partial payment
✅ Surat Jalan (DO) manual trigger
✅ Stock Opname (Harian di POS, Bulanan di BO)
✅ Barang rusak write-off
✅ PO workflow (Request → Approve → Receive)
✅ 3 laporan keuangan sederhana

## What's EXCLUDED from MVP (Skip to Phase 2)
❌ Approval workflows (void, SO, stock adj, PO kompleks)
❌ Piutang customer tracking detail
❌ Retur customer/supplier
❌ Force close shift
❌ Promo management
❌ Loyalty points
❌ Customer segmentation & member tier
❌ Custom report builder
❌ Advanced analytics (charts, trends, forecasts)
❌ Notification system (WA, SMS, Email)
❌ Audit log 5 tahun (cukup 30 hari)
❌ Multiple barcodes per product
❌ Tags, bulk operations, Excel import/export
❌ Harga per cabang berbeda
❌ Customizable RBAC

---

**Last Updated**: 18 April 2026  
**Version**: 1.0  
**Status**: Ready for Development 🚀
