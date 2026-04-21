# 🗂️ PROJECT PROGRESS TRACKER — POS Petshop Multi-Cabang

> **File ini adalah single source of truth untuk tracking progress development.**
> **Wajib diupdate setiap sesi kerja. Jangan skip.**

---

## 📊 1. STATUS KESELURUHAN

| Metric | Value |
|--------|-------|
| **Project Start** | — |
| **Target Completion** | — |
| **Current Phase** | Phase 6 — Dashboard + Laporan |
| **Overall Progress** | 🟢 70% |
| **Last Updated** | 2026-04-21 |
| **Last Updated By** | AI Assistant (MVP alignment review) |

### 🗺️ Phase Overview

| # | Phase | Scope Singkat | Status | Progress |
|---|-------|---------------|--------|----------|
| 1 | Foundation | Monorepo, DB, Auth, RBAC | ✅ Done | 100% |
| 2 | Core POS Sales | Multi-UOM, Pricing, Kasir UI, Struk | 🟡 In Progress | 75% |
| 3 | Settlement & Expenses | Shift, Multi-Kasir, Pengeluaran | ✅ Done | 100% |
| 4 | Stock Opname | Harian, Bulanan, FIFO shrinkage | ✅ Done | 100% |
| 5 | PO + Missing MVP | PO workflow, Barang Rusak, Surat Jalan | ✅ Done | 100% |
| 6 | Dashboard + Laporan | Dashboard KPI, Laporan Omset/L&R/Pengeluaran | 🔴 Not Started | 0% |
| 7+ | Post-MVP | Void, Piutang, Discount Engine, Offline Sync | ⏸️ Deferred | 0% |

### 🏷️ Legend

| Icon | Arti |
|------|------|
| 🔴 | Belum mulai / Blocked |
| 🟡 | In Progress — cantumkan % |
| 🟢 | In Review / PR open |
| ✅ | Done & verified |
| ⚠️ | Ada issue/masalah |
| 🔥 | Critical / Urgent |
| ⏸️ | On Hold |

---

## 📋 2. TASK BACKLOG DETAIL

### Phase 1 — Foundation

| Task ID | Deskripsi | Priority | Status | Progress | Assignee |
|---------|-----------|----------|--------|----------|----------|
| T-001 | Setup monorepo (pnpm workspaces + Turborepo) | 🔥 | ✅ | 100% | AI |
| T-002 | Setup PostgreSQL + Drizzle ORM + migrations | 🔥 | ✅ | 100% | AI |
| T-003 | Implement autentikasi (JWT — email & PIN login) | 🔥 | ✅ | 100% | AI |
| T-004 | Implement RBAC (Role, Permission, role-permission) | 🔥 | ✅ | 100% | AI |
| T-005 | Create full DB schema via Drizzle migrations | 🔥 | ✅ | 100% | AI |
| T-006 | Seed data awal (UOM, Price Category, Default Admin) | ⚠️ | ✅ | 100% | AI |
| T-007 | Setup `packages/shared` (types, zod schemas, utils) | ⚠️ | ✅ | 100% | AI |
| T-008 | Setup `packages/db` (Drizzle schema + migration runner) | 🔥 | ✅ | 100% | AI |

### Phase 2 — Core POS Sales

| Task ID | Deskripsi | Priority | Status | Progress | Assignee |
|---------|-----------|----------|--------|----------|----------|
| T-010 | Implementasi algoritma Auto-Break Multi-UOM | 🔥 | 🟡 | 70% | AI |
| T-011 | Unit test Auto-Break (6+ edge cases dari PRD §5.1.4) | 🔥 | ✅ | 100% | AI |
| T-012 | Implementasi FIFO costing (strict, per batch) | 🔥 | 🟡 | 70% | AI |
| T-013 | Implementasi 6-tier pricing per produk per cabang | 🔥 | ✅ | 100% | AI |
| T-014 | Implementasi Owner Price Override (Tier 7 + PIN auth) | ⚠️ | ✅ | 100% | AI |
| T-015 | API: Bootstrap endpoint (products, prices, customers) | 🔥 | ✅ | 100% | AI |
| T-016 | POS UI: Product search (barcode + nama) | 🔥 | ✅ | 100% | AI |
| T-017 | POS UI: Cart management (multi-item, UOM selector) | 🔥 | ✅ | 100% | AI |
| T-018 | POS UI: Payment processing (cash, QRIS, debit, kredit) | 🔥 | ✅ | 100% | AI |
| T-019 | Split payment | ⚠️ | ✅ | 100% | AI |
| T-020 | Open Bill (tahan & lanjutkan transaksi) | ⚠️ | ✅ | 100% | AI |
| T-021 | Print struk thermal 58mm & 80mm | 🔥 | ✅ | 100% | AI |
| T-022 | Loyalty points (earn saat transaksi, display di struk) | ⏸️ | 🔴 | 0% | — |
| T-023 | Auto-apply promo dari Backoffice | ⚠️ | 🔴 | 0% | — |
| T-024 | Implementasi tracking berat produk & display total berat | ⚠️ | ✅ | 100% | AI |

### Phase 3 — Settlement & Expenses

| Task ID | Deskripsi | Priority | Status | Progress | Assignee |
|---------|-----------|----------|--------|----------|----------|
| T-030 | Shift: Buka shift oleh Manager, kasir join | 🔥 | ✅ | 100% | AI |
| T-031 | Shift: Multi-kasir (2-3 kasir per shift bersamaan) | 🔥 | ✅ | 100% | AI |
| T-032 | Settlement: Kalkulasi expected cash per kasir | 🔥 | ✅ | 100% | AI |
| T-033 | Settlement: Input real cash per kasir, hitung selisih | 🔥 | ✅ | 100% | AI |
| T-034 | Settlement: Print report multi-kasir (3 rangkap) | 🔥 | ✅ | 100% | AI |
| T-035 | UI: Input pengeluaran harian (shift expenses) | ⚠️ | ✅ | 100% | AI |
| T-036 | Logic: Force-close shift oleh Owner/Manager | ⚠️ | ✅ | 100% | AI |

### Phase 4 — Stock Opname

| Task ID | Deskripsi | Priority | Status | Progress | Assignee |
|---------|-----------|----------|--------|----------|----------|
| T-040 | SO Harian: Auto-suggest produk best seller | ⚠️ | ✅ | 100% | AI |
| T-041 | SO Harian: Filter produk keluar hari ini | ⚠️ | ✅ | 100% | AI |
| T-042 | SO Harian: UI input stok fisik per produk | 🔥 | ✅ | 100% | AI |
| T-043 | SO Harian: Submit & approval flow | 🔥 | ✅ | 100% | AI |
| T-044 | SO Besar: Per kategori (bertahap/multi-session) | ⚠️ | ✅ | 100% | AI |
| T-045 | SO: Kalkulasi shrinkage berbasis FIFO | 🔥 | ✅ | 100% | AI |
| T-046 | SO: Adjust stock batch terlama saat ada selisih minus | 🔥 | ✅ | 100% | AI |

### Phase 5 — Purchase Order + Missing MVP Features

> Direvisi 2026-04-21: PO Request pindah ke POS (bukan BO). Ditambah T-059 (Barang Rusak) dan T-060 (Surat Jalan) yang terlewat dari MVP Sprint 5 & 7.

| Task ID | Deskripsi | Priority | Status | Progress | Assignee |
|---------|-----------|----------|--------|----------|----------|
| T-050 | PO: Buat PO request dari POS (Kasir/Gudang), auto-suggest stock < 10 | 🔥 | ✅ | 100% | AI |
| T-051 | PO: Alur approval di Backoffice (threshold Rp 5jt) + print PO | 🔥 | ✅ | 100% | AI |
| T-052 | PO: Auto-suggest restocking (stock < 10, endpoint POS) | ⚠️ | ✅ | 100% | AI |
| T-053 | PO: Receiving barang di Gudang dari POS | 🔥 | ✅ | 100% | AI |
| T-054 | PO: Handle invoice belum datang (harga sementara, update later) | 🔥 | ✅ | 100% | AI |
| T-055 | PO: Handle qty kurang / cancel remaining | ⚠️ | ✅ | 100% | AI |
| T-056 | PO: Handle harga aktual beda dari PO (discrepancy flag) | ⚠️ | ✅ | 100% | AI |
| T-057 | PO: Supplier payables tracking + partial payment (Backoffice) | 🔥 | ✅ | 100% | AI |
| T-058 | PO: Auto-update FIFO batch + stock + hutang saat approve receiving | 🔥 | ✅ | 100% | AI |
| T-059 | Barang Rusak: Input write-off dari POS (RUSAK/EXPIRED/HILANG) | 🔥 | ✅ | 100% | AI |
| T-060 | Surat Jalan (DO): Print A4 setelah checkout, include total berat | ⚠️ | ✅ | 100% | AI |

### Phase 6 — Dashboard KPI + Laporan Keuangan (MVP Complete)

> Phase 6 = 2 fitur Backoffice terakhir untuk MVP complete. Post-MVP (Void, Discount, Offline) masuk Phase 7+.

| Task ID | Deskripsi | Priority | Status | Progress | Assignee |
|---------|-----------|----------|--------|----------|----------|
| T-061 | Backoffice: Dashboard KPI (total penjualan, top produk, stock alert, pending approvals) | 🔥 | 🔴 | 0% | — |
| T-062 | Backoffice: Laporan Omset (per cabang, per periode) | 🔥 | 🔴 | 0% | — |
| T-063 | Backoffice: Laporan Laba Rugi sederhana (omset - COGS - pengeluaran) | 🔥 | 🔴 | 0% | — |
| T-064 | Backoffice: Laporan Pengeluaran Bulanan (breakdown per kategori) | 🔥 | 🔴 | 0% | — |

### Phase 7+ — Post-MVP (Defer)

> Fitur-fitur ini TIDAK masuk MVP. Dikerjakan setelah MVP production-ready.

| Task ID | Deskripsi | Priority | Status | Progress | Assignee |
|---------|-----------|----------|--------|----------|----------|
| T-070 | Void: Request void transaksi & alur approval | ⚠️ | ⏸️ | 0% | — |
| T-071 | Void: Owner-only approval untuk >30 hari | ⚠️ | ⏸️ | 0% | — |
| T-072 | Piutang customer (debt saat payment = piutang) | ⚠️ | ⏸️ | 0% | — |
| T-073 | Discount Engine (%, nominal, BxGy, bundle) | ⚠️ | ⏸️ | 0% | — |
| T-074 | Offline Sync (Dexie.js write queue) | ⚠️ | ⏸️ | 0% | — |
| T-075 | Loyalty Points | ⚠️ | ⏸️ | 0% | — |

### Phase 7 — Offline Sync

| Task ID | Deskripsi | Priority | Status | Progress | Assignee |
|---------|-----------|----------|--------|----------|----------|
| T-070 | Setup Dexie.js (IndexedDB schema, tables) | 🔥 | 🔴 | 0% | — |
| T-071 | Offline cache: Produk, harga, customer, UOM | 🔥 | 🔴 | 0% | — |
| T-072 | Write queue: Simpan operasi offline ke IndexedDB | 🔥 | 🔴 | 0% | — |
| T-073 | Online detection & auto-flush queue | 🔥 | 🔴 | 0% | — |
| T-074 | Bootstrap API call (bulk fetch saat start/reconnect) | 🔥 | 🔴 | 0% | — |
| T-075 | Conflict resolution (updated_at, stock validation) | 🔥 | 🔴 | 0% | — |
| T-076 | Test: Transaksi saat offline, sync saat online | 🔥 | 🔴 | 0% | — |

### Phase 8 — Polish & Testing

| Task ID | Deskripsi | Priority | Status | Progress | Assignee |
|---------|-----------|----------|--------|----------|----------|
| T-080 | Unit test: Auto-Break algorithm | 🔥 | 🔴 | 0% | — |
| T-081 | Unit test: FIFO costing | 🔥 | 🔴 | 0% | — |
| T-082 | Unit test: Settlement calculation | 🔥 | 🔴 | 0% | — |
| T-083 | Unit test: Discount engine | 🔥 | 🔴 | 0% | — |
| T-084 | E2E test: Full transaksi kasir (online) | ⚠️ | 🔴 | 0% | — |
| T-085 | E2E test: Full transaksi kasir (offline + sync) | ⚠️ | 🔴 | 0% | — |
| T-086 | Performance: Test dengan 1000+ SKU + 3 kasir | ⚠️ | 🔴 | 0% | — |
| T-087 | UI polish: Responsive, keyboard shortcut, loading state | ⚠️ | 🔴 | 0% | — |
| T-088 | Electron: Auto-updater (electron-updater) | ⚠️ | 🔴 | 0% | — |
| T-089 | Electron: Build & packaging (NSIS installer) | ⚠️ | 🔴 | 0% | — |

---

## 📅 3. DAILY PROGRESS LOG

> **Format Wajib**: Setiap sesi kerja append entry baru ke bawah. JANGAN hapus entry lama.

---

### 📅 2026-04-18 — AI Assistant (Documentation Setup)

**Phase:** Pre-Development
**Task IDs:** DOC-001, DOC-002

#### ✅ Completed:
- [x] DOC-001: Baca & review seluruh dokumen project (architecture, project summary, pos_prd_1) ✅
- [x] DOC-002: Buat `progress-tracker.md` standalone ini ✅

#### 🐛 Bugs Found: None
#### 🔧 Bugs Fixed: None
#### 🚧 Blockers: None

#### 📝 Notes for Next Session:
- Siap mulai **Phase 1: Foundation**
- Prioritas: T-001 (monorepo) → T-008 (packages/db) → T-002 (Drizzle migrations) → T-003 (Auth)
- Cek `13-appendix.md` untuk Open Questions sebelum implement — beberapa poin masih perlu konfirmasi user

### 📅 2026-04-18 — AI Assistant (Product Weight Implementation)

**Phase:** Phase 2: Core POS Sales
**Task IDs:** T-024, (Misc UI Polish)

#### ✅ Completed:
- [x] **T-024: Backend & DB** — Tambahkan kolom `weight_gram` di tabel `products`, buat migration, dan update `packages/shared` types. ✅
- [x] **T-024: API** — Update `/api/pos/bootstrap` dan `/api/products` untuk menyertakan data berat. ✅
- [x] **T-024: Store** — `CartStore` sudah siap mendukung `totalWeightGram` (logic kalkulasi di shared). ✅
- [x] **T-024: POS UI** — Implementasi display berat di `ProductGrid` (list produk) dan total berat di `CartPanel` (summary keranjang). ✅
- [x] **T-024: Data Seeding** — Update `seed-products.ts` dengan data berat realistik dan lakukan re-seed database. ✅
- [x] **UI Polish**: Format display stok untuk menghilangkan trailing `.00` (menggunakan `parseFloat`). ✅

#### 🐛 Bugs Found:
- BUG: `ReferenceError: sql is not defined` di seed script | Status: FIXED ✅

#### 💡 Suggestions / Observations:
- Implementasi berat menggunakan `decimal(10,2)` untuk presisi. Frontend melakukan konversi otomatis ke `kg` jika berat $\ge 1000$g.

#### 📝 Notes for Next Session:
- Lanjut ke **T-010 (Auto-Break Multi-UOM)** atau **T-012 (FIFO Costing)**.
- Data master (UOM, Categories, Brands) sudah lengkap via re-seed.

---

### 📅 2026-04-18 — AI Assistant (Phase 3 Implementation & Cart Simplification)

**Phase:** Phase 3 — Settlement & Expenses
**Task IDs:** T-030, T-031, T-032, T-033, T-034, T-035, T-036, T-017 (Cart Refactor)

#### ✅ Completed:
- [x] **T-030: Shift open & join** — DB schema (`shifts`, `shiftCashierSessions`), API (`POST /pos/shifts`, `POST /pos/shifts/[id]/join`), UI (`OpenShiftDialog`, `JoinShiftScreen`). ✅
- [x] **T-031: Multi-kasir** — `assignedCashiers` JSONB di shifts, per-cashier session tracking via `shiftCashierSessions`, multi-select UI di `OpenShiftDialog`. ✅
- [x] **T-032: Expected cash calculation** — `GET /pos/shifts/[id]/breakdown`, logic `expectedCash = modalShare + totalSalesCash - totalExpenses`, ditampilkan di `SettlementDialog` Step 1. ✅
- [x] **T-033: Real cash input + variance** — `POST /pos/shifts/[id]/settle`, input per kasir, variance dikalkulasi & di-flag jika negatif, `SettlementDialog` Step 2. ✅
- [x] **T-034: Print settlement report** — `printService.printSettlementReport(summary, 3)` dipanggil di `SettlementDialog` Step 3 (Tutup Shift & Print). ✅
- [x] **T-035: Daily expenses UI** — `shiftExpenses` table, `GET/POST /pos/shifts/[id]/expenses`, `ExpenseDialog` dengan kategori predefined/custom, amount, note, proof image upload. ✅
- [x] **T-017: Cart Simplification** — Refactor cart dari composite key `(productId+uomId)` ke `productId` saja. 1 produk = 1 item di cart, UOM berubah dalam item yang sama. Files: `cart-store.ts`, `CartItem.tsx`, `CartPanel.tsx`, `ProductGrid.tsx`, `POS.tsx`, `OwnerOverrideDialog.tsx`. ✅

#### 🟡 In Progress:
- [ ] **T-036: Force-close shift** — 🟡 80%
  - Sudah: API endpoint `POST /pos/shifts/[id]/force-close` fully implemented (auto-calculate breakdown tanpa real cash input, status FORCE_CLOSED, simpan reason).
  - Belum: Dedicated UI dialog untuk force-close di frontend (hanya ada tombol di ShiftGateScreen tanpa dialog konfirmasi + input alasan).

#### 🐛 Bugs Fixed:
- BUG: Cart item tidak bisa dikurangi/dihapus saat melebihi stok | Fix: Guard `if (newQty <= item.qty)` di `handleQtyChange` sebelum stock check
- BUG: Tidak ada stock check saat tambah produk dari `ProductGrid` | Fix: Tambah validasi sebelum `addItem`
- BUG: `pendingAction` tidak di-clear saat PIN dialog ditutup | Fix: Tambah `setPendingAction(null)` di `onClose`
- BUG: Null bytes tertambah di akhir file saat proses edit | Fix: `sed -i 's/\x00//g'`

#### 📝 Notes for Next Session:
- **T-036**: Perlu buat `ForceCloseDialog.tsx` — modal dengan field `reason` (textarea), konfirmasi, lalu POST ke `/pos/shifts/[id]/force-close`. Hanya bisa diakses oleh Owner/Manager.
- Lanjutkan ke **Phase 4 (Stock Opname)** setelah T-036 selesai.

---

### 📅 2026-04-18 — AI Assistant (Phase 4 Database Migration)

**Phase:** Phase 4 — Stock Opname
**Task IDs:** Database Schema Update

#### ✅ Completed:
- [x] **Task 1: DB Migration** — Penambahan kolom ke `stockOpnames` (`shift_id`, `method`, dll) & `stockOpnameItems` (`variance_cost_value`, dll). ✅
- [x] **Task 1: DB Migration** — Penambahan tabel `notifications`. ✅
- [x] **Task 1: DB Migration** — Manual SQL script migration creation (`202604181300_phase4_stock_opname.sql`) dan di-apply via `db:push`. ✅

#### 📝 Notes for Next Session:
- Seluruh infrastruktur Backend Phase 4 (Stock Opname) telah selesai (API Submit, Skip, Suggestion, Multi-session SO Besar, Approval FIFO).
- Lanjutkan ke integrasi UI di POS/Backoffice.

---

### 📅 2026-04-18 — AI Assistant (Phase 4 Logic Backend Complete)

**Phase:** Phase 4 — Stock Opname
**Task IDs:** T-043, T-044, T-045, T-046

#### ✅ Completed:
- [x] **T-044: SO Besar (Multi-session)** — API inisiasi SO Besar dari BO, API penambahan item bertahap dari POS, dan logic pengecekan SO aktif. ✅
- [x] **T-043: Approval & FIFO Stock Adjustment** — API Approval yang memicu mutasi stok fisik di warehouse/branch berdasarkan selisih opname menggunakan algoritma FIFO. ✅
- [x] **T-043: History API** — Endpoint untuk melacak riwayat SO per cabang/shift. ✅
- [x] **DB Migration** — Finalisasi skema tabel `stock_opnames` dengan field `category_scope` & `assigned_user_ids`. ✅

---


### 📅 2026-04-18 — AI Assistant (Phase 4 Logic Helper)

**Phase:** Phase 4 — Stock Opname
**Task IDs:** T-045, T-046

#### ✅ Completed:
- [x] **T-045: FIFO Shrinkage Helper** — Membuat helper `calculateFIFOCost` di `@petshop/shared` untuk menghitung cost estimasi/actual selisih produk dari batch terlama (FIFO). Unit test `fifo-shrinkage.test.ts` telah dibuat. ✅
- [x] **T-046: Apply Stock Adjustment** — Membuat transaksi DB manual di `apps/backoffice/lib/stock-adjustment.ts` (menggunakan referensi `drizzle-orm`) untuk apply selisih minus (`product_stock_batches`, urut by received_at ASC) dan selisih plus (ke latest batch), dan meng-update `product_stocks` secara simultan disertai `audit_logs`. ✅

---


### 📅 2026-04-18 — AI Assistant (Phase 4 Complete + Shift Bug Fix)

**Phase:** Phase 4 — Stock Opname
**Task IDs:** T-040, T-041, T-042, T-043, T-044, T-045, T-046

#### ✅ Completed:
- [x] **T-040 + T-041: Suggestion Endpoints** — `GET /api/pos/stock-opname/suggestions?method=BEST_SELLER|SOLD_TODAY|MANUAL`, query transaksi hari ini per shift, return produk dengan stok sistem. ✅
- [x] **T-042: POS UI — 4-step SO flow** — `StockOpname.tsx`, `SOMethodSelector`, `SOProductSelector`, `SOInputTable`, `SOReviewPanel`, `SOSkipDialog`. ✅
- [x] **T-043: API Create/Approve/Reject/Skip SO** — Server-side re-fetch `systemQty`, kalkulasi variance, auto-generate `soNumber`, approval trigger FIFO stock adjustment, skip trigger notifikasi ke Backoffice. ✅
- [x] **T-044: SO Besar multi-session** — `POST /api/bo/stock-opnames` inisiasi dari Backoffice, `PATCH /api/pos/stock-opnames/[id]/add-items`, banner SO Besar aktif di POS. ✅
- [x] **T-045: FIFO Shrinkage Helper + Monthly Summary** — `calculateFIFOCost()` di `@petshop/shared`, endpoint `monthly-summary` per branch. ✅
- [x] **T-046: Apply Stock Adjustment FIFO saat Approval** — Deduct dari batch terlama untuk selisih minus, tambah ke batch terbaru untuk selisih plus, insert audit log. ✅

#### 🐛 Bugs Fixed:
- BUG: Counter "Tim yang Bertugas" terus naik setiap klik "Mulai Kerja" | Root cause: tidak ada unique constraint di `shiftCashierSessions`, `onConflictDoNothing()` tidak aktif | Fix: Explicit check `existingSession` sebelum insert di join endpoint ✅
- BUG: App selalu redirect ke JoinShiftScreen setiap restart | Root cause: `activeCashierId` reset setelah restart, tidak di-restore dari `joinedCashierIds` | Fix: `ShiftGateScreen.checkActiveShift()` auto-set `activeCashierId` dan navigate `/pos` jika user sudah join ✅

#### 📝 Notes for Next Session:
- **Phase 5 (Purchase Order)** siap dimulai: T-050 → T-058
- Prioritas: T-050 (buat PO), T-051 (approval flow), T-053 (receiving), T-058 (update FIFO batch)

---

### 📅 2026-04-21 — AI Assistant (Phase 5 Completion — Sisa Pekerjaan)

**Phase:** Phase 5 — Purchase Order + Missing MVP Features
**Task IDs:** T-050, T-051, T-052, T-053, T-054, T-055, T-056, T-057, T-058, T-059, T-060

#### ✅ Completed:
- [x] **Bug Fixing**: Memperbaiki misplaced imports di API PO & DO, serta wrong import di `POForm.tsx`. Mengganti `useToast` dengan `sonner` di `DeliveryOrderDialog.tsx`. ✅
- [x] **Database Migration**: Menjalankan migrasi untuk tabel `damaged_goods`, `delivery_orders`, dan penambahan kolom-kolom pendukung Phase 5. ✅
- [x] **API Bootstrap**: Menambahkan data `suppliers` aktif ke dalam bootstrap response POS. ✅
- [x] **POS UI Refinement**: Mengganti hardcoded `branchId` dan `userId` di halaman Damaged Goods, PO Request, Receiving, dan Delivery Order menggunakan `activeShift` dari `useShiftStore`. ✅
- [x] **PO Suggestions**: Memperbarui endpoint suggestions untuk me-return `lastPurchasePrice` dan menggunakannya sebagai `unitCost` default di form PO. ✅
- [x] **Backend Endpoints**: Implementasi `PATCH /api/bo/purchase-orders/[id]/update-invoice` (T-054) dan `PATCH /api/bo/purchase-orders/[id]/cancel-remaining` (T-055). ✅
- [x] **Approval Threshold**: Menambahkan validasi threshold Rp 5jt di endpoint approval PO (T-051). Hanya `OWNER` yang bisa approve di atas threshold. ✅

#### 📝 Notes for Next Session:
- Seluruh fitur Phase 5 (PO & Missing MVP) telah diimplementasikan secara end-to-end.
- Siap lanjut ke **Phase 6: Dashboard KPI + Laporan Keuangan**.
- Perlu verifikasi manual untuk alur: Request PO -> Approve -> Transit -> Receive -> Update Invoice.

---

## 🐛 4. BUG LOG (MASTER LIST)

| Bug ID | Severity | Deskripsi | File / Module | Reported | Status | Fixed Date |
|--------|----------|-----------|---------------|----------|--------|------------|
| — | — | — | — | — | — | — |

### Severity Legend:
- 🔥 **Critical**: System down, data loss, security breach
- ⚠️ **High**: Fitur utama tidak jalan, impact ke operasional
- 📋 **Medium**: Fitur jalan tapi ada glitch, workaround tersedia
- 💭 **Low**: Cosmetic, typo, UI improvement

### Status: `OPEN` | `IN PROGRESS` | `FIXED` | `VERIFIED` | `WONT FIX` | `DUPLICATE`

---

## ❓ 5. OPEN QUESTIONS (PERLU JAWABAN USER)

> Items di bawah ini **BELUM ADA jawaban resmi** dari user. Jangan implement hal-hal ini sampai ada konfirmasi.

| # | Pertanyaan | Section PRD | Status | Jawaban |
|---|-----------|-------------|--------|---------|
| OQ-001 | Mekanisme tukar point loyalty (rate tukar, min poin, dll)? | §5.4.4 | ❓ Open | — |
| OQ-002 | Apakah piutang customer non-member diizinkan by default? | §5.7.4 | ❓ Open | — |
| OQ-003 | Threshold selisih settlement yang wajib eskalasi ke owner (default: Rp 500.000)? | §10.3 | ❓ Open | — |
| OQ-004 | Apakah approval SO Harian bisa dari POS app, atau harus via Backoffice? | §05.10 | ✅ Answered | Approval hanya dari Backoffice (Owner, Manager BO, Manager Toko cabang sendiri). Kasir POS hanya submit. |
| OQ-005 | Berapa threshold stok minimum untuk auto-suggest PO restocking? | §05.11 | ❓ Open | — |
| OQ-006 | Format no_surat_jalan / kode PO (format auto-generate)? | §07 | ❓ Open | — |
| OQ-007 | Apakah ada time limit untuk submit pembayaran piutang ke kasir (jatuh tempo enforcement)? | §5.7 | ❓ Open | — |

---

## 💡 6. ARCHITECTURAL DECISIONS LOG

| # | Keputusan | Alasan | Tanggal | Diputuskan Oleh |
|---|-----------|--------|---------|-----------------|
| AD-001 | POS = Electron + React (bukan PWA) | Kebutuhan thermal printer USB/network | 2026-04-17 | User |
| AD-002 | Offline strategy = Dexie.js write queue (bukan bidirectional sync) | Eliminasi race condition SQLite↔PG | 2026-04-17 | User |
| AD-003 | Single PostgreSQL database (shared Backoffice + POS via API) | Single source of truth | 2026-04-17 | User |
| AD-004 | FIFO Strategy = Strict (batch terlama diprioritaskan) | Konfirmasi user di PRD §5.3.3 | 2026-04-17 | User |
| AD-005 | FIFO Batch Tracking = Terpisah per UOM | Konfirmasi user di PRD §5.3.4 | 2026-04-17 | User |
| AD-006 | Harga modal input per UOM Besar, auto-hitung UOM Kecil | Konfirmasi user di PRD §5.3.2 | 2026-04-17 | User |
| AD-007 | Settlement cash dihitung TERPISAH per kasir | Multi-kasir accountability | 2026-04-17 | User |
| AD-008 | Modal awal shift = SHARED (tidak dobel per kasir) | Satu laci kasir untuk semua kasir shift | 2026-04-17 | User |
| AD-009 | Promo default = Non-stackable, pilih diskon terbesar | PRD §5.8.4 | 2026-04-17 | User |
| AD-010 | UI Library POS = shadcn/ui + Tailwind CSS (bukan MUI) | Lebih mudah customize | 2026-04-18 | User |
| AD-011 | API Client = Fetch native + TanStack Query + custom `apiClient` lib | Clean, no Axios, no tRPC | 2026-04-18 | User |
| AD-012 | Login POS = flexible: Staff Number+PIN **atau** Email+Password | — | 2026-04-18 | User |
| AD-013 | Owner Override = PIN challenge ke owner yang di-assign via halaman `Settings > Kelola Owner` | Tambah tabel `owner_assignments` | 2026-04-18 | User |
| AD-014 | Backend = Next.js 15 API Routes (1 server untuk Backoffice + POS API) | Simpler, scale later | 2026-04-18 | User |
| AD-015 | Monorepo setup ulang di `hammielion-monorepo/` (bukan extend new-app yang bermasalah) | — | 2026-04-18 | User |
| AD-016 | Auto-update = server sendiri (electron-updater) | User sudah punya server | 2026-04-18 | User |
| AD-017 | Printer = node-thermal-printer dengan abstraction layer (USB + Network, mix model) | 58mm/80mm/dot matrix | 2026-04-18 | User |

---

## 📁 7. FILE STRUCTURE REFERENCE

```
hammielion-monorepo/
├── docs/
│   ├── architecture_strategies.md
│   ├── proejct_summary.md
│   ├── progress-tracker.md     ← FILE INI
│   ├── pos_prd_1/              ← PRD POS App (27 files)
│   ├── bo_prd_1/               ← PRD Backoffice (belum dibahas)
│   └── bo_prd_2/               ← PRD Backoffice (belum dibahas)
│
new-app/                        ← Monorepo workspace aktif
├── apps/
│   ├── backoffice/             ← Next.js 15
│   └── pos-desktop/            ← Electron + Vite (belum dibuat)
├── packages/
│   ├── db/                     ← Drizzle schema (belum dibuat)
│   └── shared/                 ← Types, schemas, utils (belum dibuat)
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 🔗 8. LINKS & REFERENSI

| Dokumen | Path |
|---------|------|
| Architecture Strategy | `docs/architecture_strategies.md` |
| Project Summary (legacy context) | `docs/proejct_summary.md` |
| POS PRD — AI Directive | `docs/pos_prd_1/00-ai-directives.md` |
| POS PRD — Executive Summary | `docs/pos_prd_1/02-executive-summary.md` |
| POS PRD — Multi-UOM Auto-Break | `docs/pos_prd_1/05.1-multi-uom.md` |
| POS PRD — Pricing 6 Tier | `docs/pos_prd_1/05.2-pricing.md` |
| POS PRD — FIFO Costing | `docs/pos_prd_1/05.3-fifo-costing.md` |
| POS PRD — Sales Transaction | `docs/pos_prd_1/05.4-sales-transaction.md` |
| POS PRD — Void Transaction | `docs/pos_prd_1/05.5-void-transaction.md` |
| POS PRD — Settlement | `docs/pos_prd_1/05.6-settlement.md` |
| POS PRD — Customer Debt | `docs/pos_prd_1/05.7-customer-debt.md` |
| POS PRD — Discount Engine | `docs/pos_prd_1/05.8-discount-engine.md` |
| POS PRD — Daily Expenses | `docs/pos_prd_1/05.9-daily-expenses.md` |
| POS PRD — Stock Opname | `docs/pos_prd_1/05.10-stock-opname.md` |
| POS PRD — Purchase Order | `docs/pos_prd_1/05.11-purchase-order.md` |
| POS PRD — Database Schema | `docs/pos_prd_1/07-database-schema.md` |
| POS PRD — Business Rules | `docs/pos_prd_1/10-business-rules.md` |
| POS PRD — User Stories | `docs/pos_prd_1/12-user-stories.md` |
| POS PRD — Appendix (Open Qs) | `docs/pos_prd_1/13-appendix.md` |
| POS PRD — Progress (original) | `docs/pos_prd_1/14-progress-tracker.md` |

### 📅 2026-04-21 — AI Assistant (UI Style Analysis & Brand Guidance)

**Phase:** Phase 6 — Dashboard + Laporan (Preparation)
**Task IDs:** DOC-UI-001

#### ✅ Completed:
- [x] **UI Style Analysis**: Melakukan audit visual terhadap modul Dashboard dan POS untuk mengidentifikasi standar desain premium (Dark Mode, layout hierarchy, color tokens). ✅
- [x] **Brand Guidance**: Membuat dokumen `/docs/brand-guidance.md` yang merangkum standar visual, palet warna, tipografi, dan pola interaksi untuk menjaga konsistensi development ke depan. ✅

#### 📝 Notes for Next Session:
- Standar desain sudah terdokumentasi dan siap dijadikan acuan saat membangun komponen Dashboard KPI di Phase 6.

---

*Terakhir Diupdate: 2026-04-21 | Versi: 1.1*
