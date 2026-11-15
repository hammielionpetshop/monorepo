# Architecture Strategy: Backoffice + POS Split
> **Context**: Splitting `hml-desktop` (monolithic Electron) into 2 separate apps sharing one PostgreSQL database.
> **Goal**: Backoffice = fully online web app. POS = offline-capable desktop/PWA app.

---

## 1. Guiding Principle

> **Single Source of Truth**: One PostgreSQL database. Both apps read/write the same data. No SQLite sync complexity.

The current Electron app's biggest pain point is the dual-DB (SQLite ↔ PostgreSQL) bidirectional sync — race conditions, conflict resolution, stale data in reports. In the new architecture:

- **Backoffice** → talks directly to the DB (via API). Always online. Any browser.
- **POS** → primary writes go to PostgreSQL via API. Offline = local cache only. **No bidirectional sync needed** — just read cache + write queue.

---

## 2. Feature Split

### 🖥️ Backoffice (Web App)
Management and reporting features — used by owners, managers, admins, finance staff. Always requires internet.

| Module | Features |
|--------|---------|
| **Dashboard** | Sales summary, KPIs, top products, low stock alerts |
| **Product Management** | Product CRUD, multi-UOM, pricing (HQ + store override) |
| **Inventory** | Stock per store, batch tracking, expiry, stock opname, bulk adjustments, damaged goods |
| **Purchasing** | Purchase Orders (create, approve, receive), supplier management |
| **Master Data** | Categories, Suppliers, Stores/Branches, Customers, UOMs, Price Categories, Payment Methods, Sales Persons, Expense Categories |
| **User & RBAC** | Users, Roles, Permissions management |
| **Finance** | Cash Flow, Profit & Loss, Operational Expenses |
| **Operations** | Shift history, Shift expense review, Damaged goods |
| **Reporting** | Sales reports, stock reports, export to Excel/PDF |
| **Settings** | Point settings, Printer config (remote), Audit logs, App config |
| **Returns** | View returns, process return approval |
| **Delivery Orders** | View surat jalan list, print |

### 🧾 POS App (Desktop or PWA)
Cashier-focused. Must work offline. Minimal UI. Fast.

| Module | Features |
|--------|---------|
| **Kasir / POS** | Product search, multi-UOM, price category, discount, customer selection, Open Bill (hold/resume), payment, receipt print |
| **Shift** | Open/close shift, shift summary, shift expenses input |
| **Returns** | Create return from transaction |
| **Delivery Order** | Print surat jalan |
| **Customer Lookup** | Search customer, view points balance |
| **Quick Stock Check** | View own store stock levels only |
| **Auth** | Login (email/PIN), session persist |

---

## 3. Shared Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                     PostgreSQL Database                      │
│                   (Single source of truth)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
    ┌─────────▼──────────┐  ┌──────▼───────────────┐
    │   REST / tRPC API   │  │   REST / tRPC API    │
    │  (Backoffice API)   │  │     (POS API)        │
    │  Next.js API Routes │  │ Separate or same app │
    └─────────┬──────────┘  └──────┬───────────────┘
              │                    │
    ┌─────────▼──────────┐  ┌──────▼───────────────┐
    │   Backoffice Web    │  │     POS App           │
    │   (Next.js 15)      │  │ (Electron or PWA)    │
    │   Always online     │  │  Offline capable     │
    └────────────────────┘  └──────────────────────┘
```

> **Option A**: Both apps share **one backend** (monorepo, same API server — different route groups)  
> **Option B**: Each app has its **own API server** (simpler to scale independently)  
> **→ Recommendation: Option A** to start (shared API in Next.js monorepo), split later if needed.

---

## 4. POS Architecture Options

### Option 1: Keep Electron — But Simplified ⚡ (Recommended for now)

**Architecture**: Electron shell + React + IndexedDB for local cache. No sql.js. No bidirectional sync. Write queue only.

```
POS Electron App
├── Renderer (React)
│   ├── UI Components
│   └── IndexedDB cache (Dexie.js) for offline reads
├── Main Process (minimal)
│   ├── Printer integration (node-thermal-printer)
│   ├── Barcode scanner USB HID
│   └── Auto-updater
└── API calls → Backoffice API (REST/tRPC)
    └── Offline queue → flush when back online
```

| Pros | Cons |
|------|------|
| ✅ Thermal printer support (native) | ❌ Windows distribution/update needed |
| ✅ USB barcode scanner (HID) | ❌ More complex deployment |
| ✅ Full offline capability | ❌ Separate codebase |
| ✅ System tray, hotkeys | |
| ✅ No browser printer limitations | |

**Best for**: Store with physical hardware (thermal printer, barcode scanner, cash drawer)

---

### Option 2: New Electron (Clean Slate) 🔄

Same as Option 1, but rebuilt fresh with a cleaner separation:

```
packages/
├── shared/          ← shared types, utils, API client
├── backoffice/      ← Next.js 15 web app
└── pos-desktop/     ← Electron + Vite + React
    ├── src/main/    ← minimal: printer, updater, app window
    └── src/renderer/ ← React UI, API client, Dexie.js cache
```

**Key difference from current**: 
- Main process only handles: window management, printer, auto-update, USB HID
- All business logic moves to shared API (no more Main process services/controllers)
- Renderer fetches from API (not IPC) for most things
- IPC only for: printer, native HW access

---

### Option 3: PWA (Progressive Web App) 🌐

**Architecture**: Next.js 15 web app with offline service worker + IndexedDB

```
POS PWA (Next.js or Vite)
├── Service Worker (Workbox)
│   ├── Cache API responses (products, prices, shifts)
│   ├── Background sync (write queue)
│   └── Push notifications
├── IndexedDB (Dexie.js)  
│   ├── Products cache
│   ├── Customers cache
│   ├── Pending transactions queue
│   └── Open bills
└── Web Bluetooth / Web USB (for printers — limited)
```

| Pros | Cons |
|------|------|
| ✅ No installation needed | ❌ Web thermal printer support is very limited |
| ✅ Cross-platform (Windows, Android, iOS) | ❌ USB HID scanner needs workarounds |
| ✅ Easier updates | ❌ iOS Safari has strict service worker limits |
| ✅ Works on tablets/phones | ❌ No system tray / native OS integration |
| ✅ Shared codebase with backoffice | |

**Best for**: Tablet POS, stores without thermal printers or using web-compatible printers (Star, Epson WebPRNT)

---

### Option 4: Hybrid — PWA + Thin Electron Wrapper 🎯 (Best of both worlds)

Build the POS as a PWA, then wrap it in Electron **only** for native features.

```
pos-pwa/          ← Next.js or Vite PWA (works standalone in browser)
    └── Service Worker + Dexie.js offline
    └── Printer abstraction layer:
           ├── Web mode: WebPRNT / network printer
           └── Electron mode: node-thermal-printer (IPC bridge)

pos-desktop/      ← thin Electron wrapper
    └── Opens pos-pwa in BrowserWindow
    └── Exposes: window.nativePrinter, window.autoUpdater
    └── ~200 lines of main process code total
```

| Pros | Cons |
|------|------|
| ✅ Works in browser (tablet) AND as desktop app | ❌ More initial setup |
| ✅ One codebase for PWA + Electron | ❌ Printer abstraction layer needed |
| ✅ Auto-updates via web (PWA) or electron-updater | |
| ✅ Deploy on any device with zero install (browser mode) | |
| ✅ Offline via service worker | |

---

## 5. ✅ Final Recommendation

| | Backoffice | POS |
|-|-----------|-----|
| **Type** | Web App | Desktop App (Electron) |
| **Framework** | Next.js 15 (App Router) | Electron + Vite + React |
| **Offline** | Not needed | Yes — Dexie.js + Queue |
| **API** | Server Actions + API Routes | REST API calls |
| **Auth** | NextAuth.js (session) | JWT (stored in Electron safeStorage) |
| **DB** | Drizzle ORM → PostgreSQL | Via API only (no direct DB) |
| **Printer** | PDF/browser print | node-thermal-printer |
| **Updates** | Deploy to Vercel (instant) | electron-updater |

> **Why keep Electron for POS?** Thermal printer via USB/network is the primary blocker for PWA. When stores upgrade to WebPRNT-compatible printers, you can migrate to Option 4 (PWA + thin wrapper) with minimal effort if you design the printer abstraction layer from the start.

---

## 6. Repository Structure

### Option A: Monorepo (Recommended)

```
petshop-system/                    ← root monorepo (pnpm workspaces)
├── packages/
│   ├── shared/                    ← shared types, utils, API client
│   │   ├── src/
│   │   │   ├── types/             ← Entity types (Product, Transaction, etc.)
│   │   │   ├── schemas/           ← zod validation schemas (shared)
│   │   │   ├── api-client/        ← typed API client (shared by POS + future web)
│   │   │   └── utils/             ← formatCurrency, formatDate, etc.
│   │   └── package.json
│   └── db/                        ← Drizzle schema + migrations (single source)
│       ├── src/schema/            ← all table definitions
│       ├── src/migrations/
│       └── package.json
│
├── apps/
│   ├── backoffice/                ← Next.js 15 web app
│   │   ├── src/app/               ← App Router pages
│   │   ├── src/components/
│   │   ├── src/lib/
│   │   └── package.json
│   │
│   └── pos-desktop/               ← Electron + Vite + React
│       ├── src/main/              ← minimal: window, printer, updater
│       ├── src/renderer/          ← React UI + Dexie.js
│       └── package.json
│
├── pnpm-workspace.yaml
└── turbo.json                     ← Turborepo for builds
```

### Option B: Polyrepo (Simpler to start)

```
petshop-backoffice/    ← Next.js web app (own git repo)
petshop-pos/           ← Electron POS (own git repo)
petshop-shared/        ← Shared types as npm package (private registry or git submodule)
```

> **Recommendation**: Start with **polyrepo** if teams are separate or you want to move fast. Migrate to monorepo later with Turborepo when shared code grows.

---

## 7. Tech Stack Details

### Backoffice (Next.js 15)

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Framework** | Next.js 15 (App Router) | Server Components + Server Actions |
| **Language** | TypeScript strict | |
| **UI** | shadcn/ui + Tailwind CSS | Or keep MUI v7 for familiarity |
| **Data Tables** | TanStack Table v8 | Or MUI DataGrid |
| **Forms** | react-hook-form + zod | Same as current |
| **Auth** | NextAuth.js v5 (Auth.js) | JWT + HTTP-only cookie session |
| **DB ORM** | Drizzle ORM | Maintain same schema |
| **DB** | PostgreSQL (Supabase/Neon) | |
| **Cache** | Redis (Upstash) | Session cache, rate limiting |
| **File upload** | Uploadthing / S3 | Product images (future) |
| **Charts** | Recharts / Tremor | Reports/dashboards |
| **Export** | xlsx (client) or @vercel/og (PDF) | |
| **Real-time** | Supabase Realtime / SSE | Stock updates, notifications |
| **Deployment** | Vercel + Neon PostgreSQL | |

### POS Desktop (Electron + React)

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Runtime** | Electron 39+ | |
| **Build** | electron-vite (maintain current) | |
| **Frontend** | React 19 + TypeScript | |
| **UI** | MUI v7 | Familiar, good component set |
| **Offline DB** | Dexie.js (IndexedDB) | Replaces sql.js — much simpler |
| **API Client** | Axios + React Query (TanStack Query) | Cache + offline detection |
| **Auth** | JWT stored in `safeStorage` (Electron) | Encrypted OS keychain |
| **Printer** | node-thermal-printer | From current app |
| **Auto-update** | electron-updater | From current app |
| **Offline Sync** | Background queue (localStorage → API) | Write queue for offline ops |
| **State** | Zustand | Replace complex Context |
| **Forms** | react-hook-form + zod | Same as current |

---

## 8. Database Connection Strategy

### Backoffice → PostgreSQL (Direct via Drizzle ORM)
```typescript
// backoffice/src/lib/db.ts
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from '@petshop/db/schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

### POS → Backoffice API (Never direct DB)
```typescript
// pos-desktop/src/renderer/lib/apiClient.ts
import axios from 'axios'

const apiClient = axios.create({
  baseURL: process.env.VITE_API_URL,  // backoffice API URL
  timeout: 10000,
  headers: { Authorization: `Bearer ${getStoredToken()}` }
})

// React Query wrapper with offline detection
export const useProducts = () => useQuery({
  queryKey: ['products'],
  queryFn: () => apiClient.get('/api/pos/products'),
  staleTime: 5 * 60 * 1000,         // 5 min cache
  networkMode: 'offlineFirst',        // use cached data when offline
})
```

---

## 9. API Design (Backoffice API)

Create dedicated POS API routes that are optimized for the POS use case:

```
/api/pos/
├── auth/
│   ├── POST login         ← email or PIN login
│   └── POST refresh
├── bootstrap/
│   └── GET                ← bulk fetch: products, prices, customers, payment methods, store info
├── transactions/
│   ├── POST create        ← create sale, update stock, earn points
│   └── GET :id
├── shifts/
│   ├── GET current        ← get own open shift
│   ├── POST open
│   └── POST :id/close
├── open-bills/
│   ├── GET                ← get own store's open bills
│   ├── POST               ← save open bill
│   ├── PUT :id
│   └── DELETE :id
├── expenses/
│   └── POST               ← create shift expense
└── returns/
    └── POST               ← create return

/api/backoffice/           ← separate routes for backoffice
├── products/
├── inventory/
├── purchasing/
├── reports/
└── ...
```

> **Bootstrap endpoint** is critical for POS: on app start or reconnect, fetch everything needed in one request → store in IndexedDB → POS works offline from this cache.

---

## 10. Offline Strategy for POS

### What to Cache (IndexedDB via Dexie.js)
```typescript
// Cached on startup/sync (read-only reference data)
products           // id, sku, name, unit, cost, is_active
product_uoms       // UOM configs per product
product_prices     // all price tiers per product
customers          // id, name, phone, category_id, total_points
payment_methods    // id, name
uoms               // id, code, name
price_categories   // id, name

// Cached and kept in sync (operational data)
current_shift      // active shift data
open_bills         // held carts

// Write queue (offline pending)
pending_transactions     // not yet submitted to API
pending_expenses         // not yet submitted
```

### Offline Write Queue Pattern
```typescript
// When offline: save to IndexedDB queue
// When online: flush queue to API in order

interface PendingOperation {
  id: string              // UUID
  type: 'CREATE_TRANSACTION' | 'CREATE_EXPENSE' | 'CLOSE_SHIFT'
  payload: unknown
  createdAt: number
  retries: number
  error?: string
}

class OfflineQueue {
  async enqueue(op: PendingOperation) { /* save to IndexedDB */ }
  async flush() { /* retry all pending ops in order */ }
  async onOnline() { this.flush() }  /* listen to network change */
}
```

### Conflict Resolution (Simplified vs current)
- **Write queue**: operations are replayed **in order** — no conflict possible for a single device
- **Multi-device conflict**: handled by `updated_at` timestamp check on the API side
- **Stock conflicts**: API validates stock availability at write time — rejects if insufficient

---

## 11. Auth Strategy

### Backoffice (NextAuth.js / Auth.js)
```typescript
// Session stored in HTTP-only cookie (secure)
// JWT with: userId, storeId, permissions[], role
// Refresh token rotation
// PIN login endpoint (no NextAuth — custom API route)
```

### POS Electron (JWT in safeStorage)
```typescript
// Login → receive JWT (access token + refresh token)
// Store in Electron's safeStorage (OS keychain encrypted)
// Never in localStorage or session storage (memory only)
// Auto-refresh before expiry
// Permissions embedded in JWT → no DB call needed for auth checks
```

### Shared JWT Payload
```typescript
interface JWTPayload {
  userId: string
  userName: string
  storeId: string             // POS: always scoped to one store
  storeName: string
  role: string
  permissions: string[]       // from permission catalog
  iat: number
  exp: number
}
```

---

## 12. Shared Code (`packages/shared`)

Extract these to a shared package used by **both** apps:

```typescript
// packages/shared/src/types/
export interface Product { id, sku, name, unit, cost, isActive, ... }
export interface Transaction { id, code, storeId, total, items, ... }
export interface CashierShift { id, userId, storeId, status, ... }
// ... all entity types

// packages/shared/src/schemas/
export const createTransactionSchema = z.object({ ... })
export const createExpenseSchema = z.object({ ... })
// ... all zod validation schemas

// packages/shared/src/utils/
export const formatCurrency = (amount: number) => `Rp ${amount.toLocaleString('id-ID')}`
export const generateTransactionCode = (storeCode: string) => ...
export const calculatePoints = (total: number, settings: PointSettings) => ...
export const calculateExpectedCash = (shift: CashierShift, transactions) => ...
```

---

## 13. Phased Implementation Roadmap

### Phase 1 — Foundation (2-3 weeks)
- [ ] Setup monorepo (pnpm + Turborepo)
- [ ] Extract `packages/db` — Drizzle schema, migrations, seed scripts
- [ ] Extract `packages/shared` — types, zod schemas, utils
- [ ] Setup PostgreSQL (Supabase/Neon)
- [ ] Run DB migrations from Drizzle schema

### Phase 2 — Backoffice Core (4-6 weeks)
- [ ] Next.js 15 project setup with shadcn/ui
- [ ] Auth (NextAuth.js v5) with RBAC
- [ ] Master Data CRUD pages (products, categories, stores, users, etc.)
- [ ] Product & Pricing management (multi-UOM, price categories)
- [ ] Basic Dashboard

### Phase 3 — Backoffice Management (4-5 weeks)
- [ ] Inventory management (stock, batches, adjustments, opname)
- [ ] Purchasing (PO workflow)
- [ ] Operations (shift history, expenses, damaged goods)
- [ ] Finance (Cash Flow, P&L reports)
- [ ] User/Role/Permission management

### Phase 4 — POS Desktop (4-5 weeks)
- [ ] Electron + Vite + React setup (minimal main process)
- [ ] Dexie.js local cache + Bootstrap API call
- [ ] POS UI (product search, cart, UOM selection, pricing)
- [ ] Shift open/close flow
- [ ] Payment + receipt printing
- [ ] Open Bill (hold/resume)
- [ ] Offline write queue
- [ ] Returns, shift expenses

### Phase 5 — Polish & Migration (2-3 weeks)
- [ ] Data migration from existing SQLite databases to PostgreSQL
- [ ] Audit logging
- [ ] Point/loyalty system
- [ ] Delivery orders
- [ ] Excel export
- [ ] Performance optimization
- [ ] User training + gradual rollout

**Total estimate: 16-22 weeks**

---

## 14. Key Design Decisions Summary

| Decision | Choice | Reason |
|----------|--------|--------|
| POS architecture | Electron (keep) | Thermal printer, USB HID scanner |
| Offline strategy | IndexedDB + write queue | No bidirectional sync needed |
| API | REST (Next.js API routes) | Simple, well-understood, easy to debug |
| Shared DB | Single PostgreSQL | Eliminates sync complexity |
| Auth | JWT (both apps) | Stateless, works offline for POS |
| Repo structure | Polyrepo → Monorepo | Start fast, consolidate later |
| UI framework | MUI v7 (both) or MUI POS + shadcn Backoffice | Familiarity, component richness |
| ORM | Drizzle ORM | Maintain schema compatibility, type-safe |
| POS state | Zustand | Simpler than Context for complex cart state |
| Backoffice fetch | React Query / server components | Natural Next.js 15 pattern |

---

## 15. What to Remove / Simplify

Compared to the current Electron app, **remove these complexities**:
- ❌ sql.js (SQLite WASM) → replace with Dexie.js IndexedDB (much simpler API)
- ❌ Bidirectional sync service (SyncService 33KB) → write queue only
- ❌ QueueService + QueueProcessorService complexity → simple queue in IndexedDB
- ❌ Cloud-first base service pattern → API calls are always cloud-first by definition
- ❌ IPC Controller/Service pattern → direct API calls from renderer
- ❌ Preload API bridge (contextBridge) → axios/fetch directly in renderer (or minimal IPC for printer only)
- ❌ CloudDb singleton management → Drizzle + Neon connection pooling handles it
- ❌ `device_id` tracking → not needed for web; for POS use JWT payload

---

*Generated: 2026-04-17 | Version: 1.0*
