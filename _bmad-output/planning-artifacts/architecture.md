---
stepsCompleted: ['step-01-init', 'step-02-context', 'step-03-starter', 'step-04-decisions', 'step-05-patterns']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/project-context.md'
  - 'docs/architecture_strategies.md'
workflowType: 'architecture'
project_name: 'hammielion-monorepo'
user_name: 'Cundus'
date: '2026-04-27'
---

# Architecture Decision Document

_Dokumen ini dibangun secara kolaboratif melalui proses discovery langkah demi langkah. Setiap seksi ditambahkan seiring kita membuat keputusan arsitektur bersama._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
22 FRs terbagi dalam 4 kategori:
- Offline Sync & Bootstrap (FR1-FR7) — inti MVP, termasuk fix bootstrap blocker
- Transaction History di POS (FR8-FR13) — tampil dari data lokal, filter shift/tanggal
- Transaction Correction (FR14-FR17) — Post-MVP (Void & Clone to Cart)
- Reporting & Inventory (FR18-FR22) — Post-MVP (Dashboard, L&R, Stock Adjustment)

**Non-Functional Requirements:**
7 NFRs dengan implikasi arsitektur signifikan:
- NFR-P1: Search < 200ms → semua pencarian POS wajib dari IndexedDB lokal
- NFR-P2: Dashboard/Laporan < 3 detik → query dioptimasi di server
- NFR-R1: 100% offline uptime → POS tidak boleh bergantung pada API untuk operasi kasir
- NFR-R2: Exponential retry sync → 1min → 2min → 5min → 15min
- NFR-S1: AES-256 di Dexie.js → dexie-encrypted + key di Electron safeStorage
- NFR-S2: Device-unique PIN salt → UUID random di safeStorage + encrypted backup server
- NFR-S3: big.js wajib → semua kalkulasi finansial, tanpa terkecuali

**Scale & Complexity:**
- Primary domain: Hybrid Desktop (Electron) + Web App (Next.js)
- Complexity level: High
- Estimated architectural components: 10 area keputusan

### Technical Constraints & Dependencies

- Stack terkunci (brownfield): Electron 30, React 18, Next.js 15, Drizzle ORM, PostgreSQL
- Dexie.js sebagai IndexedDB layer — harus dienkripsi (ADR-001)
- big.js wajib untuk semua kalkulasi finansial tanpa terkecuali
- Pessimistic locking (`.for('update')`) untuk semua mutasi stok di server
- DevTools dinonaktifkan di build produksi

### Cross-Cutting Concerns Identified

1. **Financial Precision** — big.js di semua layer (POS store, API, sync payload)
2. **Offline Data Layer** — Dexie.js sebagai cache + write queue (ADR-002)
3. **Sync Integrity** — Price-at-time-of-sale preservation (ADR-003)
4. **Security** — AES-256 Dexie (ADR-001), device-unique PIN salt (ADR-004)
5. **Audit Trail** — Immutable log setiap mutasi stok/finansial + sync discrepancy log
6. **Stock Integrity** — Pessimistic locking + StockService sebagai satu-satunya jalur mutasi

### Architectural Decisions (From ADR Session)

| ADR | Keputusan | Rasional |
|---|---|---|
| ADR-001 | `dexie-encrypted` + key di `Electron safeStorage` | Balance security vs implementability |
| ADR-002 | Write queue di tabel Dexie `pendingOperations` | Durabilitas + enkripsi + ordering |
| ADR-003 | Simpan `priceAtSaleTime` + `currentPrice` + flag `hadPriceDiscrepancy` | Zero rejection + full auditability |
| ADR-004 | UUID salt di `safeStorage` + encrypted backup di server | Secure + recoverable saat reinstall |

## Starter Template & Foundation

### Primary Technology Domain

Hybrid Desktop + Web Full-Stack — Brownfield project, stack sudah established.
Tidak ada starter baru yang dibutuhkan; fondasi menggunakan existing monorepo.

### Existing Foundation (Brownfield Baseline)

**Monorepo Structure (pnpm + Turborepo):**
- `apps/backoffice` — Next.js 15 (App Router, Server Components)
- `apps/pos-desktop` — Electron 30 + Vite 5 + React 18
- `packages/db` — Drizzle ORM schema + migrations
- `packages/shared` — Shared types, schemas, utils

**New Packages Required for MVP Features:**

| Package | Tujuan | Layer |
|---|---|---|
| `dexie-encrypted` (atau fork aktif) | Enkripsi AES-256 IndexedDB (ADR-001) | POS Desktop |
| `argon2` / `bcrypt` | PIN salted hash (ADR-004) | Electron main process |
| `p-retry` atau native | Exponential backoff sync (NFR-R2) | POS Desktop |

**Note:** Network detection menggunakan `navigator.onLine` + event listener bawaan browser/Electron — tidak memerlukan package tambahan.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Bootstrap fix: `bulkPut` dalam satu transaksi Dexie atomic
- Dexie schema MVP: 10 tabel (cache + operational + write queue + history)
- Sync endpoint: batch endpoint baru `POST /api/pos/sync/batch`

**Important Decisions (Shape Architecture):**
- Transaction History: 100% dari IndexedDB lokal (NFR-P1 compliant)
- Write queue: tabel `pendingOperations` di Dexie (ADR-002)

**Deferred Decisions (Post-MVP):**
- Dexie schema extension (`voidRequests`, `stockLevels`) — ditambah saat Post-MVP
- Real-time push notification untuk sync status Owner

### Data Architecture

**PostgreSQL (Server — Single Source of Truth):**
- ORM: Drizzle ORM, strict TypeScript
- Mutasi stok: WAJIB melalui StockService + `.for('update')` pessimistic lock
- Audit: Setiap mutasi stok/finansial dilog ke tabel `audit_logs` (immutable)
- Kolom tambahan di tabel `transactions` untuk sync integrity (ADR-003):
  - `price_at_sale_time` — dari POS payload
  - `current_price_at_sync` — harga server saat sync diterima
  - `had_price_discrepancy` — boolean flag

**Dexie.js MVP Schema (IndexedDB — POS Local):**

```typescript
// Read-only cache (di-populate saat bootstrap)
products          // ++id, sku, name, *branchId
productUoms       // ++id, *productId
productPrices     // ++id, *productId, *priceCategoryId
customers         // ++id, phone, name
paymentMethods    // ++id
taxSettings       // ++id

// Operational
currentShift      // ++id (satu record aktif)
openBills         // ++id, *cashierId

// Write queue (ADR-002)
pendingOperations // ++id, type, createdAt, retryCount, lastError

// History Transaksi (FR8-FR13)
localTransactions // ++id, *shiftId, createdAt, customerName
```

**Bootstrap Fix Strategy:**

```typescript
// Atomic upsert dalam satu transaksi Dexie — tidak ada window data kosong
await db.transaction('rw', [db.products, db.productPrices, db.customers, ...], async () => {
  await db.products.bulkPut(data.products)
  await db.productPrices.bulkPut(data.prices)
  await db.customers.bulkPut(data.customers)
  await db.paymentMethods.bulkPut(data.paymentMethods)
  await db.taxSettings.bulkPut(data.taxSettings)
})
```

### Authentication & Security

- **JWT POS:** Disimpan di `Electron safeStorage` (OS keychain terenkripsi)
- **JWT Backoffice:** HTTP-only cookie, session-based
- **Dexie Encryption:** `dexie-encrypted` + encryption key dari `safeStorage` (ADR-001)
- **PIN Owner:** Argon2/bcrypt dengan UUID salt di `safeStorage` + encrypted backup server (ADR-004)
- **DevTools:** Dinonaktifkan di production build (`webPreferences.devTools: false`)
- **Node Integration:** `nodeIntegration: false`, `contextIsolation: true`

### API & Communication Patterns

- **Style:** REST, Next.js API Routes
- **POS group:** `/api/pos/*` — optimized untuk Electron client
- **Backoffice group:** `/api/bo/*` — untuk web management
- **Error format:** `{ error: string }` dalam Bahasa Indonesia
- **Validation:** Zod schema di semua endpoint (input boundary)
- **Sync batch endpoint (baru):**

```
POST /api/pos/sync/batch
Body: {
  deviceId: string,
  transactions: PendingTransaction[]
}
Response: {
  synced: string[],       // IDs berhasil
  failed: { id: string, reason: string }[]
}
```

### Frontend Architecture

**POS Desktop (Electron + React 18):**
- State global: Zustand stores (`cartStore`, `shiftStore`, `syncStore`, `networkStore`)
- Data fetching: TanStack Query (`networkMode: 'offlineFirst'`)
- Offline detection: `window.addEventListener('online'|'offline')` + `navigator.onLine`
- Transaction History source: 100% IndexedDB lokal (`localTransactions` table) — NFR-P1
- Routing: HashRouter (Electron-compatible)

**Backoffice (Next.js 15):**
- Server Components untuk data fetching (default)
- Server Actions untuk mutasi
- Manual refresh untuk sekarang (polling di fase berikutnya)

### Infrastructure & Deployment

- **POS distribution:** Electron builder + NSIS installer (Windows x64)
- **Auto-update:** `electron-updater` — background download, apply saat restart
- **Backoffice hosting:** Server milik user (existing)
- **Build:** Turborepo parallelizes `dev`, `build`, `lint` antar workspace

### Decision Impact Analysis

**Implementation Sequence untuk MVP:**
1. Fix bootstrap sync — blocker semua fitur berikutnya
2. Setup Dexie schema + `SecureDb` abstraction layer (ADR-001)
3. Offline detection + status indicator UI (FR1)
4. `localTransactions` ditulis saat transaksi berhasil (FR8-FR13)
5. Transaction History UI — query dari IndexedDB
6. `pendingOperations` write saat offline (FR4)
7. Auto-sync + batch endpoint server (FR5, FR6, FR7)
8. Exponential retry + sync status indicator (NFR-R2)

**Cross-Component Dependencies:**
- History UI → `localTransactions` → bootstrap fix harus selesai lebih dulu
- Auto-sync → `pendingOperations` + `/api/pos/sync/batch` endpoint
- PIN offline → `safeStorage` salt → harus diinisialisasi saat pertama login online

## Implementation Patterns & Consistency Rules

### Critical Conflict Points: 7 area teridentifikasi

### Naming Patterns

**Database (PostgreSQL — Drizzle):**
- Tabel: `snake_case` plural (contoh: `pending_operations`, `local_transactions`)
- Kolom: `snake_case` (contoh: `price_at_sale_time`, `had_price_discrepancy`)
- Foreign key: `{table_singular}_id` (contoh: `shift_id`, `product_id`)
- Index: `idx_{table}_{column}` (contoh: `idx_transactions_shift_id`)

**Dexie.js (IndexedDB — stores):**
- Store names: `camelCase` (contoh: `localTransactions`, `pendingOperations`, `productPrices`)
- Index fields: `camelCase` (contoh: `*shiftId`, `createdAt`)

**API Endpoints:**
- Style: REST, kebab-case, plural noun
- POS: `/api/pos/{resource}` (contoh: `/api/pos/transactions`, `/api/pos/sync/batch`)
- Backoffice: `/api/bo/{resource}`
- Route params: `[id]` (Next.js convention)

**File & Code:**
- Files: `kebab-case.ts` / `kebab-case.tsx`
- Components/Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`

### Structure Patterns

**Dexie.js — Akses WAJIB melalui Service Layer:**

```typescript
// ✅ BENAR — melalui service
import { bootstrapService } from '@/services/bootstrap-service'
await bootstrapService.populate(data)

// ❌ SALAH — akses Dexie langsung dari komponen
import { db } from '@/lib/db'
await db.products.toArray()
```

Services wajib di `src/renderer/services/`:
- `bootstrap-service.ts` — populate + clear cache
- `offline-queue-service.ts` — enqueue, flush, retry
- `history-service.ts` — query `localTransactions`
- `sync-service.ts` — koordinasi online/offline detection

**Test location:** Co-located `foo.test.ts` di sebelah `foo.ts`

### Format Patterns

**API Response — Standard Wrapper:**

```typescript
// Success
{ data: T, meta?: { total?: number } }

// Error
{ error: string }  // dalam Bahasa Indonesia

// Sync batch response
{ synced: string[], failed: { id: string, reason: string }[] }
```

**Dexie `pendingOperations` payload:**

```typescript
interface PendingOperation {
  id: string            // crypto.randomUUID()
  type: 'TRANSACTION' | 'EXPENSE' | 'SHIFT_CLOSE'
  payload: unknown      // strongly typed per type
  createdAt: number     // Date.now()
  retryCount: number    // mulai dari 0
  lastError?: string
}
```

**Date/Time:**
- API payload: ISO 8601 string (`new Date().toISOString()`)
- Dexie storage: Unix timestamp ms (`Date.now()`)
- UI display: `dd/MM/yyyy HH:mm` (locale Indonesia)

### Communication Patterns

**Zustand Stores — Struktur yang Disepakati:**

```typescript
// networkStore — satu-satunya store untuk status koneksi & sync
interface NetworkStore {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncAt: number | null
  setOnline: (v: boolean) => void
  setSyncing: (v: boolean) => void
  setPendingCount: (n: number) => void
}
```

Stores yang ada: `cartStore`, `shiftStore`, `authStore`, `networkStore` (baru untuk MVP).
**Dilarang** membuat store baru untuk network/sync status.

**Bootstrap Trigger — Single Entry Point:**
Bootstrap HANYA dipanggil dari `src/renderer/hooks/use-bootstrap.ts`.
Dipanggil saat: app init + reconnect online event.
**Dilarang** dipanggil dari komponen individual.

### Process Patterns

**Offline Queue — WAJIB melalui `offline-queue-service`:**

```typescript
// ✅ BENAR
await offlineQueueService.enqueue({ type: 'TRANSACTION', payload: tx })

// ❌ SALAH — langsung ke Dexie dari action handler
await db.pendingOperations.add({ ... })
```

**Error Handling Dexie:**

```typescript
// Selalu wrap dengan pesan error dalam Bahasa Indonesia
try {
  await bootstrapService.populate(data)
} catch {
  throw new Error('Gagal menyimpan data lokal. Silakan coba lagi.')
}
// Jangan biarkan catch kosong
```

**Financial Calculations — big.js mandatory:**

```typescript
// ✅ BENAR
import Big from 'big.js'
const total = new Big(price).times(qty).toString()

// ❌ SALAH
const total = price * qty  // floating-point error
```

### Enforcement Guidelines

**Semua AI Agent WAJIB:**
- Akses Dexie hanya melalui service layer (tidak dari komponen/store)
- Gunakan `networkStore` untuk semua state online/offline/sync
- Panggil bootstrap hanya dari `use-bootstrap.ts` hook
- Gunakan `offlineQueueService.enqueue()` untuk semua operasi offline
- Wrap semua kalkulasi finansial dengan `big.js`
- Error messages user-facing dalam Bahasa Indonesia
- Bootstrap menggunakan atomic `db.transaction()` dengan `bulkPut`

**Anti-Patterns yang Dilarang:**
- `db.products.toArray()` langsung dari React component
- `navigator.onLine` check tanpa subscribe ke events
- `Math.round()` / `+` operator pada nilai finansial
- Store baru untuk network status selain `networkStore`
- Bootstrap dipanggil dari multiple entry points
