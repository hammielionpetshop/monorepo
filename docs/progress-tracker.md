# 🗂️ PROJECT PROGRESS TRACKER — POS Petshop Multi-Cabang

> **File ini adalah single source of truth untuk tracking progress development.**
> **Wajib diupdate setiap sesi kerja. Jangan skip.**

---

## 📊 1. STATUS KESELURUHAN

| Metric | Value |
|--------|-------|
| **Project Start** | — |
| **Target Completion** | — |
| **Current Phase** | Pre-Development |
| **Overall Progress** | 🔴 0% |
| **Last Updated** | 2026-04-18 |
| **Last Updated By** | AI Assistant (Initial Setup) |

### 🗺️ Phase Overview

| # | Phase | Scope Singkat | Status | Progress |
|---|-------|---------------|--------|----------|
| 1 | Foundation | Monorepo, DB, Auth, RBAC | 🔴 Not Started | 0% |
| 2 | Core POS Sales | Multi-UOM, Pricing, Kasir UI, Struk | 🔴 Not Started | 0% |
| 3 | Settlement & Expenses | Shift, Multi-Kasir, Pengeluaran | 🔴 Not Started | 0% |
| 4 | Stock Opname | Harian, Bulanan, FIFO shrinkage | 🔴 Not Started | 0% |
| 5 | Purchase Order | PO workflow, Gudang, Supplier payable | 🔴 Not Started | 0% |
| 6 | Void, Debt, Discount | Void request, Piutang, Promo engine | 🔴 Not Started | 0% |
| 7 | Offline Sync | Dexie.js, Write queue, Conflict resolution | 🔴 Not Started | 0% |
| 8 | Polish & Testing | UI polish, Testing, Performance | 🔴 Not Started | 0% |

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
| T-001 | Setup monorepo (pnpm workspaces + Turborepo) | 🔥 | 🔴 | 0% | — |
| T-002 | Setup PostgreSQL + Drizzle ORM + migrations | 🔥 | 🔴 | 0% | — |
| T-003 | Implement autentikasi (JWT — email & PIN login) | 🔥 | 🔴 | 0% | — |
| T-004 | Implement RBAC (Role, Permission, role-permission) | 🔥 | 🔴 | 0% | — |
| T-005 | Create full DB schema via Drizzle migrations | 🔥 | 🔴 | 0% | — |
| T-006 | Seed data awal (UOM, Price Category, Default Admin) | ⚠️ | 🔴 | 0% | — |
| T-007 | Setup `packages/shared` (types, zod schemas, utils) | ⚠️ | 🔴 | 0% | — |
| T-008 | Setup `packages/db` (Drizzle schema + migration runner) | 🔥 | 🔴 | 0% | — |

### Phase 2 — Core POS Sales

| Task ID | Deskripsi | Priority | Status | Progress | Assignee |
|---------|-----------|----------|--------|----------|----------|
| T-010 | Implementasi algoritma Auto-Break Multi-UOM | 🔥 | 🔴 | 0% | — |
| T-011 | Unit test Auto-Break (6+ edge cases dari PRD §5.1.4) | 🔥 | 🔴 | 0% | — |
| T-012 | Implementasi FIFO costing (strict, per batch) | 🔥 | 🔴 | 0% | — |
| T-013 | Implementasi 6-tier pricing per produk per cabang | 🔥 | 🔴 | 0% | — |
| T-014 | Implementasi Owner Price Override (Tier 7 + PIN auth) | ⚠️ | 🔴 | 0% | — |
| T-015 | API: Bootstrap endpoint (products, prices, customers) | 🔥 | 🔴 | 0% | — |
| T-016 | POS UI: Product search (barcode + nama) | 🔥 | 🔴 | 0% | — |
| T-017 | POS UI: Cart management (multi-item, UOM selector) | 🔥 | 🔴 | 0% | — |
| T-018 | POS UI: Payment processing (cash, QRIS, debit, kredit) | 🔥 | 🔴 | 0% | — |
| T-019 | Split payment | ⚠️ | 🔴 | 0% | — |
| T-020 | Open Bill (tahan & lanjutkan transaksi) | ⚠️ | 🔴 | 0% | — |
| T-021 | Print struk thermal 58mm & 80mm | 🔥 | 🔴 | 0% | — |
| T-022 | Loyalty points (earn saat transaksi, display di struk) | ⏸️ | 🔴 | 0% | — |
| T-023 | Auto-apply promo dari Backoffice | ⚠️ | 🔴 | 0% | — |

### Phase 3 — Settlement & Expenses

| Task ID | Deskripsi | Priority | Status | Progress | Assignee |
|---------|-----------|----------|--------|----------|----------|
| T-030 | Shift: Buka shift oleh Manager, kasir join | 🔥 | 🔴 | 0% | — |
| T-031 | Shift: Multi-kasir (2-3 kasir per shift bersamaan) | 🔥 | 🔴 | 0% | — |
| T-032 | Settlement: Kalkulasi expected cash per kasir | 🔥 | 🔴 | 0% | — |
| T-033 | Settlement: Input real cash per kasir, hitung selisih | 🔥 | 🔴 | 0% | — |
| T-034 | Settlement: Print report multi-kasir (3 rangkap) | 🔥 | 🔴 | 0% | — |
| T-035 | UI: Input pengeluaran harian (shift expenses) | ⚠️ | 🔴 | 0% | — |
| T-036 | Logic: Force-close shift oleh Owner/Manager | ⚠️ | 🔴 | 0% | — |

### Phase 4 — Stock Opname

| Task ID | Deskripsi | Priority | Status | Progress | Assignee |
|---------|-----------|----------|--------|----------|----------|
| T-040 | SO Harian: Auto-suggest produk best seller | ⚠️ | 🔴 | 0% | — |
| T-041 | SO Harian: Filter produk keluar hari ini | ⚠️ | 🔴 | 0% | — |
| T-042 | SO Harian: UI input stok fisik per produk | 🔥 | 🔴 | 0% | — |
| T-043 | SO Harian: Submit & approval flow | 🔥 | 🔴 | 0% | — |
| T-044 | SO Besar: Per kategori (bertahap/multi-session) | ⚠️ | 🔴 | 0% | — |
| T-045 | SO: Kalkulasi shrinkage berbasis FIFO | 🔥 | 🔴 | 0% | — |
| T-046 | SO: Adjust stock batch terlama saat ada selisih minus | 🔥 | 🔴 | 0% | — |

### Phase 5 — Purchase Order

| Task ID | Deskripsi | Priority | Status | Progress | Assignee |
|---------|-----------|----------|--------|----------|----------|
| T-050 | PO: Buat PO baru (draft, pilih supplier & produk) | 🔥 | 🔴 | 0% | — |
| T-051 | PO: Alur approval (Draft → Approved) | 🔥 | 🔴 | 0% | — |
| T-052 | PO: Auto-suggest restocking (by threshold) | ⚠️ | 🔴 | 0% | — |
| T-053 | PO: Receiving barang di gudang (qty, harga actual) | 🔥 | 🔴 | 0% | — |
| T-054 | PO: Handle invoice belum datang | 🔥 | 🔴 | 0% | — |
| T-055 | PO: Handle qty kurang / backorder | ⚠️ | 🔴 | 0% | — |
| T-056 | PO: Handle harga aktual beda dengan PO | ⚠️ | 🔴 | 0% | — |
| T-057 | PO: Supplier payables tracking | 🔥 | 🔴 | 0% | — |
| T-058 | PO: auto-update FIFO batch saat barang diterima | 🔥 | 🔴 | 0% | — |

### Phase 6 — Void, Debt, Discount

| Task ID | Deskripsi | Priority | Status | Progress | Assignee |
|---------|-----------|----------|--------|----------|----------|
| T-060 | Void: Request void transaksi & alur approval | 🔥 | 🔴 | 0% | — |
| T-061 | Void: Owner-only approval untuk >30 hari | 🔥 | 🔴 | 0% | — |
| T-062 | Void: Restock otomatis saat void disetujui | 🔥 | 🔴 | 0% | — |
| T-063 | Piutang: Create debt saat payment = "piutang" | 🔥 | 🔴 | 0% | — |
| T-064 | Piutang: Limit per customer (toggle + max limit) | 🔥 | 🔴 | 0% | — |
| T-065 | Piutang: UI bayar piutang / cicilan | 🔥 | 🔴 | 0% | — |
| T-066 | Discount Engine: 4 tipe diskon (%, nominal, BxGy, bundle) | 🔥 | 🔴 | 0% | — |
| T-067 | Discount: Conflict resolution (ambil terbesar) | 🔥 | 🔴 | 0% | — |
| T-068 | Discount: Stackable override + threshold approval | ⚠️ | 🔴 | 0% | — |
| T-069 | Discount: Sync promo dari Backoffice ke cache POS | ⚠️ | 🔴 | 0% | — |

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

---

### 📅 [YYYY-MM-DD] — [Nama / Session]

**Phase:** [Nomor Phase]
**Task IDs:** [T-XXX, T-XXX]

#### 🎯 Tasks Planned:
- [ ] T-XXX: Deskripsi task

#### ✅ Completed:
- [x] T-XXX: [Deskripsi] — 100% ✅
  - Notes: [Apa yang dikerjakan]
  - Files changed: [list file]
  - Tests: [passed/failed/pending]

#### 🟡 In Progress:
- [ ] T-XXX: [Deskripsi] — 🟡 60%
  - Sudah: [apa yang sudah selesai]
  - Belum: [apa yang belum]
  - Estimasi selesai: [kapan]

#### 🐛 Bugs Found:
- BUG-XXX | 🔥 Critical | [Deskripsi] | Status: OPEN

#### 🔧 Bugs Fixed:
- BUG-XXX | [Deskripsi] | Fix: [Summary fix]

#### 🚧 Blockers:
- [Issue description]
  - Impact: [apa yang terpengaruh]
  - Waiting On: [siapa/apa]

#### 💡 Suggestions / Observations:
- [Observasi/saran yang perlu dibahas dengan user]

#### 📝 Notes for Next Session:
- [Reminder penting]

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
| OQ-004 | Apakah approval SO Harian bisa dari POS app, atau harus via Backoffice? | §05.10 | ❓ Open | — |
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

---

*Dibuat: 2026-04-18 | Versi: 1.0 | Source: pos_prd_1 v1.1*
