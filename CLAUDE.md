# CLAUDE.md — Hammielion Monorepo

## Aturan Wajib

- **Setiap ada perubahan fitur, penambahan fitur, atau bug fix → WAJIB update `apps/backoffice/CHANGELOG.md`**
  - Format versi: `[MAJOR.MINOR.PATCH] - YYYY-MM-DD`
  - Gunakan section: `### Added`, `### Fixed`, `### Changed`, `### Removed`
  - Tulis dalam Bahasa Indonesia
  - Tambahkan entry baru di atas versi sebelumnya

---

## Monorepo Overview

```
hammielion-monorepo/
├── apps/
│   ├── backoffice/       # Next.js 15 — dashboard admin & manajemen
│   ├── pos-desktop/      # Electron + Vite + React 19 — POS offline desktop
│   └── db-compare/       # CLI utility — compare & migrate DB
├── packages/
│   ├── @petshop/db       # Drizzle ORM — schema & DB factory
│   └── @petshop/shared   # Shared types, Zod schemas, utilities
└── docs/
```

**Package manager:** pnpm 9.15.9  
**Build orchestrator:** Turbo

---

## Tech Stack

| Layer | Library | Versi |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.15 |
| Runtime | React | 19.1.0 |
| Language | TypeScript | ^5.0.0 |
| ORM | Drizzle ORM | ^0.45.2 |
| Database | PostgreSQL (self-host) | — |
| Auth | jose (JWT HS256) + argon2 | Latest |
| Validation | Zod | Latest |
| Kalkulasi harga | big.js | ^7.0.1 |
| Styling | Tailwind CSS | ^4 |
| Icons | Lucide React | Latest |
| Desktop POS | Electron + Dexie (IndexedDB) | ^30 + ^4.4.2 |
| State (POS) | Zustand | ^5.0.13 |

---

## Struktur Backoffice

### App Router
```
apps/backoffice/app/
├── (dashboard)/          # Route group — semua halaman yang butuh auth
│   ├── master-data/      # Produk, kategori, brand, satuan ukur
│   ├── inventory/        # Stok, stock adjustment, stock opname
│   ├── purchase-orders/  # Purchase order & penerimaan barang
│   ├── transactions/     # Riwayat transaksi & retur
│   ├── shifts/           # Manajemen shift kasir
│   ├── reports/          # Laporan laba rugi & nilai stok
│   └── settings/         # User & cabang
├── api/
│   ├── auth/             # Login (email/password & staff PIN)
│   ├── bo/               # Back office API (butuh auth)
│   ├── pos/              # POS sync API (desktop ↔ server)
│   ├── products/         # Public product search
│   └── customers/        # Public customer search
└── pos/                  # Web POS (select-branch, login, shift, dll)
```

### Konvensi File per Halaman
```
[halaman]/
├── page.tsx              # Server component — fetch awal, pass ke client
└── _components/
    ├── types.ts          # Interface & type lokal
    ├── [nama]-client.tsx # Client component — state & interaktivitas
    └── [nama]-form.tsx   # Form component
```

### Lib Utilities
```
apps/backoffice/lib/
├── auth.ts               # signAccessToken, signRefreshToken, verifyAccessToken
├── db.ts                 # Drizzle instance (import `db` dari sini)
├── pos-branch.ts         # getPosBranchId(), getPosBranchName()
└── services/             # dashboard, report, retur, stock, transaction
```

---

## Database Schema

**Semua schema:** `packages/db/src/schema/`  
**Namespace PostgreSQL:** `petshop`

| File | Tabel Utama |
|---|---|
| `master.ts` | `categories`, `brands`, `suppliers`, `customers`, `unitsOfMeasure`, `paymentMethods` |
| `products.ts` | `products`, `productUomConversions`, `productPrices` |
| `inventory.ts` | `productStocks`, `productStockBatches`, `stockAdjustments` |
| `transactions.ts` | `transactions`, `transactionItems`, `transactionPayments`, `openBills` |
| `shifts.ts` | `shifts`, `shiftExpenses`, `shiftCashierSessions` |
| `purchase_orders.ts` | `purchaseOrders`, `purchaseOrderItems`, `poReceivingLogs` |
| `stock_opnames.ts` | Stock opname / audit stok |
| `users.ts` | `users`, `roles`, `permissions`, `ownerAssignments` |
| `branches.ts` | `branches` |
| `audit.ts` | `auditLogs`, `voidRequests`, `ownerPriceOverrides` |
| `finance.ts` | `customerDebts`, `debtPayments` |
| `returns.ts` | Return management |

**Import di backoffice:**
```typescript
import { db, products, eq, and, or, ilike } from '@/lib/db'
```

---

## Auth Pattern

**JWT disimpan di cookie HTTP-only `accessToken`**

```typescript
// Verifikasi di setiap API route:
const cookieStore = await cookies()
const token = cookieStore.get('accessToken')?.value
const payload = token ? await verifyAccessToken(token) : null
if (!payload) {
  return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
}
```

**JWT Payload:**
```typescript
{
  userId: number
  userName: string
  staffNumber: string | null
  branchId: number
  branchName: string
  role: 'OWNER' | 'GM' | 'MANAGER' | 'KASIR' | 'GUDANG' | 'FINANCE'
  permissions: string[]
}
```

**Role hierarchy untuk mutasi data master:**
```typescript
const ALLOWED_MUTATE_ROLES = ['OWNER', 'GM']
```

---

## Pola API Route

### Response Shape
```typescript
// Success GET
return NextResponse.json(data)

// Success POST/CREATE
return NextResponse.json(created, { status: 201 })

// Error — SELALU format ini
return NextResponse.json({ error: 'Pesan dalam Bahasa Indonesia' }, { status: 4xx | 5xx })
```

### Status Code
| Code | Kondisi |
|---|---|
| 400 | Validasi gagal / data tidak valid |
| 401 | Token tidak ada / expired |
| 403 | Role tidak punya akses |
| 409 | Duplikat (SKU, kode, nama) |
| 415 | Content-Type bukan application/json |
| 500 | Server error |

### Validasi dengan Zod
```typescript
const parsed = schema.safeParse(body)
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
}
```

### Cek Duplikat dalam Transaksi DB
```typescript
const result = await db.transaction(async (trx) => {
  const existing = await trx.select({ id: table.id }).from(table).where(eq(table.code, value)).limit(1)
  if (existing.length > 0) throw new Error('DUPLICATE_CODE')
  return await trx.insert(table).values(data).returning()
})
```

---

## Konvensi Kode

- **Bahasa:** Semua pesan error, label, dan komentar dalam **Bahasa Indonesia**
- **Angka/harga:** Selalu gunakan `big.js` untuk kalkulasi; simpan sebagai **integer** di DB
- **Semua field yang sebelumnya decimal sudah dimigrasikan ke integer** (2026-05-21)
- **Drizzle query:** Gunakan `eq`, `and`, `or`, `ilike`, `inArray` dari `@/lib/db`
- **Tanpa komentar:** Tidak perlu komentar kecuali ada logika non-obvious
- **Client component:** Tambahkan `'use client'` di baris pertama
- **Server component:** Fetch data di sini, pass sebagai props ke client component

---

## Environment Variables

```
DATABASE_URL          # PostgreSQL connection string
JWT_SECRET            # Access token key (min 32 char)
JWT_REFRESH_SECRET    # Refresh token key (min 32 char)
```

---

## Dev Commands

```bash
pnpm dev:backoffice   # Jalankan backoffice di port 6969
pnpm dev:pos          # Jalankan pos-desktop
pnpm db:migrate       # Jalankan migrasi DB
pnpm db:studio        # Buka Drizzle Studio
pnpm db:push          # Push schema ke DB
pnpm typecheck        # TypeScript check semua app
```
