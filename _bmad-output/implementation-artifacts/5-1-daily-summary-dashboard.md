# Story 5.1: Daily Summary Dashboard

Status: done

## Story

As an Owner,
I want melihat ringkasan penjualan, pengeluaran, jumlah transaksi, laba kotor harian, dan status shift dari seluruh cabang di dashboard backoffice,
so that saya dapat memantau kesehatan bisnis secara cepat setiap harinya.

## Acceptance Criteria

1. **Given** Owner masuk ke Backoffice (terautentikasi)
   **When** halaman dashboard dimuat
   **Then** layar menampilkan metrik agregat untuk hari ini dari seluruh cabang
   **And** metrik tersebut mencakup: Total Pendapatan, Jumlah Transaksi, dan Estimasi Laba Kotor
   **And** hanya transaksi berstatus `COMPLETED` yang masuk ke kalkulasi (transaksi `VOIDED` / `PENDING_VOID` dikecualikan)

2. **Given** dashboard dimuat
   **When** data berhasil diambil dari server
   **Then** Total Pengeluaran hari ini (agregasi dari `shift_expenses`) ditampilkan
   **And** status shift per cabang ditampilkan (OPEN / CLOSED / FORCE_CLOSED)

3. **Given** tidak ada transaksi `COMPLETED` untuk hari ini
   **When** halaman dashboard dimuat
   **Then** semua metrik finansial menampilkan nilai Rp 0 (bukan loading spinner atau layar kosong)
   **And** widget status shift tetap menampilkan status shift yang ada (jika shift sudah dibuka)

4. **Given** terdapat 2 atau lebih cabang dengan transaksi hari ini
   **When** halaman dashboard dimuat
   **Then** Total Pendapatan menampilkan jumlah dari seluruh cabang yang teragregasi
   **And** Total Pengeluaran menampilkan jumlah dari seluruh cabang yang teragregasi

5. **Given** dashboard dimuat
   **When** data selesai di-render
   **Then** seluruh data finansial tampil dalam waktu kurang dari 3 detik (NFR-P2)

6. **Given** pengguna mengakses rute `/dashboard` tanpa sesi aktif
   **When** permintaan halaman diterima
   **Then** pengguna diarahkan (redirect) ke halaman `/login`

## Tasks / Subtasks

- [x] Task 0: Auth Foundation (prasyarat semua task lain)
  - [x] Buat halaman login: `apps/backoffice/app/(auth)/login/page.tsx` dengan form email + password yang memanggil `POST /api/auth/login`.
  - [x] Setelah login sukses, simpan `accessToken` di cookie client-side (`js-cookie` atau `document.cookie`) dengan nama `access_token`.
  - [x] Buat `apps/backoffice/middleware.ts` — baca cookie `access_token`, panggil `verifyAccessToken()` dari `lib/auth.ts`; jika null, redirect ke `/login`. Proteksi matcher: `'/dashboard/:path*'`.
  - [x] Buat route group protected: `apps/backoffice/app/(dashboard)/layout.tsx` (Sidebar + Header) dan pindahkan entry point dashboard ke `app/(dashboard)/dashboard/page.tsx`.

- [x] Task 1: Setup Backoffice Dashboard Layout
  - [x] Implementasi layout `(dashboard)/layout.tsx` dengan Sidebar (navigasi utama) dan Header (nama user, logout) menggunakan Radix UI + Tailwind CSS 4.
  - [x] Buat halaman dashboard `(dashboard)/dashboard/page.tsx` sebagai Server Component default.
  - [x] Pastikan route `/` di `app/page.tsx` melakukan redirect ke `/dashboard` (atau `/login` jika belum auth).

- [x] Task 2: Implement Dashboard Data Fetching (Server Component)
  - [x] Buat API route `GET /api/bo/dashboard/daily-summary` di `apps/backoffice/app/api/bo/dashboard/daily-summary/route.ts`.
  - [x] Implement satu query Drizzle dengan JOIN + aggregation (lihat spesifikasi query di Dev Notes) — JANGAN buat multiple roundtrip query.
  - [x] Kalkulasi `Estimasi Laba Kotor`: `SUM(transaction_items.payable_amount) - SUM(transaction_items.cogs)` menggunakan `big.js` di server layer.
  - [x] Kalkulasi `Total Pengeluaran`: `SUM(shift_expenses.amount)` untuk shift yang `DATE(shifts.opened_at) = today`.
  - [x] Ambil `Status Shift` per cabang dari `shifts.status` untuk shift yang dibuka hari ini.
  - [x] Terapkan caching `revalidate: 60` pada route handler agar memenuhi NFR-P2 tanpa query ulang setiap request.

- [x] Task 3: Build Dashboard UI
  - [x] Buat Metric Cards: Total Pendapatan, Jumlah Transaksi, Estimasi Laba Kotor, Total Pengeluaran — gunakan Radix UI primitives.
  - [x] Buat widget Status Shift per cabang (nama cabang + badge OPEN/CLOSED/FORCE_CLOSED).
  - [x] Implementasi empty state: tampilkan "Belum ada transaksi hari ini" dengan nilai Rp 0 ketika data kosong.
  - [x] Implementasi mobile-first responsiveness (PRD: "Mobile-first for Monitoring") — metric cards harus readable di HP.
  - [x] Semua nilai finansial di-render sebagai string (hasil `.toString()` dari `big.js`) — JANGAN parse ulang ke float di sisi client.

### Review Findings
- [x] [Review][Patch] Invalid Date comparison in SQL using CURRENT_DATE AT TIME ZONE [apps/backoffice/lib/services/dashboard-service.ts]
- [x] [Review][Defer] JWT Token stored in non-HttpOnly cookie [apps/backoffice/app/(auth)/login/page.tsx] — deferred, pre-existing

## Dev Notes

### Struktur Folder Backoffice yang Diharapkan

```
apps/backoffice/app/
  (auth)/
    login/
      page.tsx            ← Task 0: halaman login
  (dashboard)/
    layout.tsx            ← Task 0/1: protected layout (Sidebar + Header)
    dashboard/
      page.tsx            ← Task 1/3: halaman metrik utama
  api/
    auth/login/route.ts   ← sudah ada
    bo/
      dashboard/
        daily-summary/
          route.ts        ← Task 2: endpoint baru
  middleware.ts           ← sudah ada (verifyAccessToken)
  lib/
    auth.ts               ← sudah ada (verifyAccessToken)
```

### Auth: Cara Membaca Token di Middleware

`lib/auth.ts` sudah menyediakan `verifyAccessToken(token)`. Gunakan di `middleware.ts`:

```typescript
// apps/backoffice/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAccessToken } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

**Catatan Discrepancy:** `POST /api/auth/login` saat ini mengembalikan token di JSON body (bukan Set-Cookie). Halaman login harus menyimpan token ke cookie client-side setelah menerima response, sebelum redirect ke `/dashboard`.

### Spesifikasi API Endpoint Baru

```
GET /api/bo/dashboard/daily-summary
Auth: Cookie 'access_token' (diverifikasi via middleware)
Response shape:
{
  data: {
    totalRevenue: string          // big.js .toString()
    totalTransactions: number
    grossProfitEstimate: string   // big.js .toString()
    totalExpenses: string         // big.js .toString()
    shiftStatuses: Array<{
      branchId: number
      branchName: string
      shiftId: number | null
      status: 'OPEN' | 'CLOSED' | 'FORCE_CLOSED' | null  // null = belum ada shift hari ini
    }>
  }
}
```

### Spesifikasi Query Drizzle (SATU query — jangan buat multiple roundtrips)

Tabel yang terlibat (semua di `packages/db/src/schema/`):
- `transactions.ts` → `transactions` (filter: `status='COMPLETED'`, `DATE(created_at)=today`)
- `transactions.ts` → `transaction_items` (JOIN ke transactions, ambil `cogs`)
- `shifts.ts` → `shifts` (filter: `DATE(opened_at)=today`, ambil `status` per branch)
- `shifts.ts` → `shift_expenses` (JOIN ke shifts, ambil `amount`)
- `branches.ts` → `branches` (JOIN ke shifts, ambil `name`)

```typescript
// Pendekatan: 2 parallel queries (bukan nested subquery yang complex)
// Query 1: Finansial (revenue + COGS dari transactions)
// Query 2: Shift status + expenses (dari shifts + shift_expenses)
// Gabungkan hasilnya di service layer dengan big.js

// Untuk "hari ini": gunakan timezone server WIB (UTC+7)
// PostgreSQL: WHERE DATE(created_at AT TIME ZONE 'Asia/Jakarta') = CURRENT_DATE AT TIME ZONE 'Asia/Jakarta'
```

### Formula Kalkulasi Finansial (WAJIB big.js)

```typescript
import Big from 'big.js'

// Total Pendapatan
const totalRevenue = transactions.reduce(
  (acc, trx) => acc.plus(new Big(trx.payableAmount)),
  new Big(0)
)

// Total COGS (dari transaction_items.cogs — kolom ini sudah ada di schema)
const totalCogs = transactionItems.reduce(
  (acc, item) => item.cogs ? acc.plus(new Big(item.cogs)) : acc,
  new Big(0)
)

// Estimasi Laba Kotor
const grossProfit = totalRevenue.minus(totalCogs)

// Total Pengeluaran (dari shift_expenses.amount)
const totalExpenses = shiftExpenses.reduce(
  (acc, exp) => acc.plus(new Big(exp.amount)),
  new Big(0)
)

// Return sebagai string — JANGAN parseFloat
return {
  totalRevenue: totalRevenue.toString(),
  grossProfitEstimate: grossProfit.toString(),
  totalExpenses: totalExpenses.toString(),
}
```

**PENTING:** `transaction_items.cogs` bisa `null` (item lama sebelum FIFO costing diimplementasi). Handle dengan `item.cogs ? new Big(item.cogs) : new Big(0)`.

### Transactions Status Filter (WAJIB)

Hanya transaksi `status = 'COMPLETED'` yang masuk ke semua kalkulasi finansial. Eksklusi eksplisit:
- `VOIDED` — transaksi yang dibatalkan
- `PENDING_VOID` — transaksi dalam proses pembatalan

```typescript
// Drizzle filter
where(
  and(
    eq(transactions.status, 'COMPLETED'),
    sql`DATE(${transactions.createdAt} AT TIME ZONE 'Asia/Jakarta') = CURRENT_DATE AT TIME ZONE 'Asia/Jakarta'`
  )
)
```

### Architecture Compliance & Technical Requirements

- **Framework:** Backoffice = Next.js 15.5 App Router. Default ke Server Components untuk data fetching.
- **Next.js 15 Caching:** `fetch` dan route handlers tidak di-cache by default. Untuk memenuhi NFR-P2 (< 3 detik), gunakan `export const revalidate = 60` di route handler (refresh setiap 60 detik) atau `unstable_cache()` dari `next/cache`.
- **Financial Precision (CRITICAL):** SEMUA kalkulasi finansial WAJIB `big.js`. Jangan gunakan operator `+`, `-` native JS pada nilai finansial. Return `.toString()` — jangan parseFloat di client.
- **Styling:** Tailwind CSS 4 + Radix UI primitives.
- **Auth:** Middleware-based di `apps/backoffice/middleware.ts`. Gunakan `verifyAccessToken()` dari `lib/auth.ts` yang sudah ada.

### Previous Story Intelligence (From Epic 4 Retro)

- **Backoffice Foundation:** Story 4.4 (Retur) ditunda ke Epic 5 karena membutuhkan fondasi Backoffice yang dibangun di story ini. Task 0 di story ini adalah fondasi tersebut.
- **bcryptjs vs argon2:** Epic 4 menggunakan `bcryptjs` untuk POS Desktop. Backoffice (server-side) menggunakan `argon2` (sudah ada di login route) — JANGAN mix keduanya.
- **Atomic state update:** Untuk dashboard UI, hindari multiple state updates terpisah. Gunakan satu fetch → satu state update untuk semua metrik.

### Project Structure Notes

- Next.js/Backoffice: `apps/backoffice/`
- Schema Drizzle: `packages/db/src/schema/transactions.ts`, `packages/db/src/schema/shifts.ts`, `packages/db/src/schema/branches.ts`
- Shared types & utils: `packages/shared/src/`
- Kalkulasi finansial shared (big.js wrappers) di `packages/shared/` jika belum ada

### References

- [PRD: FR18, Epic 5, NFR-P2](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/_bmad-output/planning-artifacts/prd.md)
- [Architecture: Backoffice Web App, Auth Pattern](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/_bmad-output/planning-artifacts/architecture.md)
- [Epic 4 Retro Action Items](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/_bmad-output/implementation-artifacts/epic-4-retro.md)
- [Schema: transactions + transaction_items](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/packages/db/src/schema/transactions.ts)
- [Schema: shifts + shift_expenses](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/packages/db/src/schema/shifts.ts)

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6 (Validate Story pass + Implementation)

### Completion Notes List
- Diterapkan perbaikan dari validasi: C1–C6, E1–E7, O1–O2, LLM1–LLM2.
- Ditambahkan AC untuk pengeluaran, status shift, empty state, multi-branch, NFR-P2, dan auth.
- Formula COGS eksplisit menggunakan `transaction_items.cogs` yang sudah ada di schema.
- Auth foundation (Task 0) ditambahkan: middleware.ts, login page, protected route group.
- Discrepancy antara architecture doc (HTTP-only cookie) dan login route aktual (JSON body) didokumentasikan dengan solusi konkret.
- Spesifikasi endpoint API dan struktur folder Backoffice ditambahkan ke Dev Notes.

**Implementation (2026-05-02):**
- **Task 0 (Auth Foundation):** Halaman login dibuat sebagai Client Component (`(auth)/login/page.tsx`). Login via `POST /api/auth/login` mode `email_password`, token disimpan di cookie `accessToken` (sesuai `middleware.ts` yang sudah ada — bukan `access_token` seperti di story spec, karena middleware membaca `accessToken`). Middleware existing sudah handle proteksi route + CORS, tidak perlu dibuat ulang.
- **Task 1 (Layout):** Layout `(dashboard)/layout.tsx` Server Component dengan sidebar + header. User info dari JWT cookie. Logout via Server Action. Route `/` redirect ke `/dashboard`.
- **Task 2 (API):** Service `lib/services/dashboard-service.ts` dengan 3 query parallel (Promise.all): revenue query, COGS query (separate untuk hindari double-count dari JOIN), dan shift/expenses query. Kalkulasi big.js di service layer. API route `app/api/bo/dashboard/daily-summary/route.ts` dengan `revalidate = 60`.
- **Task 3 (UI):** Dashboard page Server Component dengan MetricCard dan ShiftBadge components. Grid 2-col di mobile, 4-col di desktop. Empty state saat `totalTransactions === 0`. Semua nilai finansial format Intl.NumberFormat IDR dari string big.js (tanpa parseFloat ke float intermediate).
- **Catatan teknis:** `big.js` ditambahkan ke backoffice package.json (sebelumnya hanya di pos-desktop). TypeScript clean pada file baru — error yang ada adalah pre-existing di route handlers lama.

### File List
- `_bmad-output/implementation-artifacts/5-1-daily-summary-dashboard.md`
- `apps/backoffice/package.json`
- `apps/backoffice/app/page.tsx`
- `apps/backoffice/app/(auth)/login/page.tsx`
- `apps/backoffice/app/(dashboard)/layout.tsx`
- `apps/backoffice/app/(dashboard)/dashboard/page.tsx`
- `apps/backoffice/app/api/bo/dashboard/daily-summary/route.ts`
- `apps/backoffice/lib/services/dashboard-service.ts`

### Change Log
- 2026-05-02: Implementasi Story 5.1 — Daily Summary Dashboard. Buat halaman login, protected dashboard layout, dashboard page dengan metric cards dan shift status widget, API endpoint daily-summary, dan service layer dengan kalkulasi big.js. Tambahkan big.js dependency ke backoffice.
