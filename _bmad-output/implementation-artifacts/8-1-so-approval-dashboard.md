# Story 8.1: SO Approval Dashboard

**Story ID:** 8.1
**Story Key:** 8-1-so-approval-dashboard
**Epic:** 8 - Backoffice Operational Quick Wins (P1 — Backend Ready)
**Status:** done
**Created:** 2026-05-09

---

## User Story

Sebagai Owner/Manager,
saya ingin melihat daftar Stock Opname yang sudah disubmit kasir dan menyetujui atau menolaknya melalui Backoffice,
Agar selisih stok dapat ditindaklanjuti tanpa harus hadir langsung di toko.

---

## Acceptance Criteria

**AC1 — Daftar SO Pending**
Given Owner membuka halaman `/inventory/stock-opname`
When halaman dimuat
Then daftar SO berstatus `PENDING` ditampilkan beserta: tanggal, cabang, jumlah item, petugas

**AC2 — Approve SO**
Given Owner memilih SO dan menekan "Setujui"
When dikonfirmasi
Then API `PATCH /api/bo/stock-opnames/[id]/approve` dipanggil dan stok diperbarui via FIFO

**AC3 — Reject SO**
Given Owner menekan "Tolak" dan mengisi alasan
When dikonfirmasi
Then API `PATCH /api/bo/stock-opnames/[id]/reject` dipanggil

**AC4 — Auth & Role**
Given akses tanpa autentikasi
When API diakses
Then return 401
Given user role bukan OWNER/MANAGER mencoba approve/reject
When request dikirim
Then return 403

---

## Scope & Batasan

**In scope:**
- Halaman `/inventory/stock-opname` (list SO berstatus PENDING)
- Tombol "Setujui" dengan window.confirm()
- Dialog "Tolak" dengan input alasan (wajib diisi)
- `GET /api/bo/stock-opnames/pending` — list PENDING SOs dengan join ke branches & users
- `PATCH /api/bo/stock-opnames/[id]/approve` — set status APPROVED, update stok via FIFO
- `PATCH /api/bo/stock-opnames/[id]/reject` — set status REJECTED + rejectionNote
- Auth: token wajib; approve/reject hanya OWNER atau MANAGER
- Tambah link "Stock Opname" di sidebar layout.tsx (bagian "Pengaturan Stok" atau setelah Penyesuaian Stok)
- SO yang sudah tidak PENDING hilang dari list setelah aksi (refresh otomatis)

**Out of scope:**
- Detail item-level SO (variance per produk)
- Filter by branch atau date range
- Pagination
- Revert/undo approve

---

## Skema Database yang Relevan

**Tabel utama:** `stock_opnames` — `packages/db/src/schema/stock_opnames.ts`

```typescript
export const stockOpnames = petshop.table('stock_opnames', {
  id: serial('id').primaryKey(),
  soNumber: varchar('so_number', { length: 50 }).notNull().unique(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  shiftId: integer('shift_id').references(() => shifts.id),
  type: varchar('type', { length: 20 }).notNull(),       // DAILY, FULL
  method: varchar('method', { length: 20 }),
  status: varchar('status', { length: 20 }).default('PENDING').notNull(), // PENDING, APPROVED, REJECTED
  assignedUserIds: jsonb('assigned_user_ids'),            // array of user IDs
  createdById: integer('created_by_id').references(() => users.id).notNull(),
  approvedById: integer('approved_by_id').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectedById: integer('rejected_by_id').references(() => users.id),
  rejectedAt: timestamp('rejected_at'),
  rejectionNote: text('rejection_note'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

export const stockOpnameItems = petshop.table('stock_opname_items', {
  id: serial('id').primaryKey(),
  soId: integer('so_id').references(() => stockOpnames.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  systemQty: decimal('system_qty', { precision: 12, scale: 2 }).notNull(),
  physicalQty: decimal('physical_qty', { precision: 12, scale: 2 }).notNull(),
  varianceQty: decimal('variance_qty', { precision: 12, scale: 2 }).notNull(),
  varianceCostValue: decimal('variance_cost_value', { precision: 15, scale: 2 }),
  varianceCategory: varchar('variance_category', { length: 20 }),
  varianceReason: text('variance_reason'),
  isRecounted: boolean('is_recounted').default(false).notNull(),
  recountPhysicalQty: decimal('recount_physical_qty', { precision: 12, scale: 2 }),
});
```

**FIFO stok:** `product_stocks` (qty aktual), `product_stock_batches` (FIFO batches)
— kedua tabel ada di `packages/db/src/schema/inventory.ts`

**Semua tabel sudah ter-export dari `packages/db/src/schema/index.ts`** → tersedia via `import { stockOpnames, stockOpnameItems, productStocks, productStockBatches, ... } from '@/lib/db'`

---

## Dev Notes & Guardrails

### File Baru yang Harus Dibuat

```
apps/backoffice/app/(dashboard)/inventory/stock-opname/
  page.tsx                          ← Server Component: fetch + render
  _components/
    so-client.tsx                   ← Client Component: tabel + approve/reject UI
apps/backoffice/app/api/bo/stock-opnames/
  pending/route.ts                  ← GET list PENDING SOs
  [id]/approve/route.ts             ← PATCH approve
  [id]/reject/route.ts              ← PATCH reject
```

### File yang Dimodifikasi

```
apps/backoffice/app/(dashboard)/layout.tsx  ← tambah link "Stock Opname"
```

### Pattern Golden Template — WAJIB diikuti

Pola dari **Story 7.5 (User Management)** dan **7.6 (Branch Settings)** adalah golden template:

**page.tsx (Server Component):**
```tsx
import { db, stockOpnames, branches, users, eq, and } from '@/lib/db'
import SOClient from './_components/so-client'

export const dynamic = 'force-dynamic'

export default async function StockOpnamePage() {
  let soList: SOListItem[] = []
  let error: string | null = null
  try {
    soList = await db.select({
      id: stockOpnames.id,
      soNumber: stockOpnames.soNumber,
      type: stockOpnames.type,
      branchName: branches.name,
      createdByName: users.name,
      createdAt: stockOpnames.createdAt,
      // item count via subquery — lihat catatan di bawah
    })
    .from(stockOpnames)
    .innerJoin(branches, eq(stockOpnames.branchId, branches.id))
    .innerJoin(users, eq(stockOpnames.createdById, users.id))
    .where(eq(stockOpnames.status, 'PENDING'))
    .orderBy(stockOpnames.createdAt)
  } catch (e) {
    console.error('StockOpnamePage error:', e)
    error = 'Terjadi kesalahan saat mengambil data stock opname'
  }
  ...
}
```

> **Catatan item count:** Drizzle ORM tidak support subquery dalam `.select()` secara langsung untuk join agregasi. Alternatif paling sederhana: lakukan dua query terpisah — satu untuk SO headers, satu untuk count per soId menggunakan `sql` helper — lalu merge di JS/TS. Atau gunakan raw SQL fragment via `sql<number>\`(SELECT COUNT(*) FROM ...)\`` di select proyeksi. Lihat pola di `apps/backoffice/lib/services/report-service.ts` untuk contoh `sql` helper.

**API Routes — pola konsisten:**
```ts
export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Role check: hanya OWNER dan MANAGER
  if (payload.role !== 'OWNER' && payload.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  ...
}
```

**Import path yang benar:**
```ts
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { db, stockOpnames, stockOpnameItems, productStocks, productStockBatches, eq, and, inArray, sql } from '@/lib/db'
```

### FIFO Stock Update Logic (Approve)

Saat approve, untuk setiap item di `stock_opname_items` yang memiliki `varianceQty != 0`:
1. Hitung variance (physicalQty − systemQty) — sudah ada di kolom `varianceQty`
2. Update `product_stocks.qty` += varianceQty untuk (productId, branchId, uomId)
3. Jika varianceQty < 0 (stok berkurang): kurangi dari `product_stock_batches` FIFO (consume oldest batch first)
4. Jika varianceQty > 0 (stok bertambah): tambah ke batch terbaru atau buat batch baru dengan costPrice = 0 (karena tidak ada PO)

**Semua update stok HARUS dalam satu database transaction** (`db.transaction(async (tx) => { ... })`).

> **Scope simplifikasi:** Jika logika FIFO batch manipulation terlalu kompleks untuk scope ini, boleh implement versi simplified: hanya update `product_stocks.qty` tanpa modifikasi batch (seperti yang dilakukan `manual stock adjustment` di Story 6.1). Ini konsisten dengan pattern yang sudah ada di `apps/backoffice/lib/stock-adjustment.ts`.

### Reject Logic

Reject jauh lebih sederhana — hanya update header SO:
```ts
await db.update(stockOpnames)
  .set({
    status: 'REJECTED',
    rejectedById: Number(payload.userId),
    rejectedAt: new Date(),
    rejectionNote: body.reason,
  })
  .where(eq(stockOpnames.id, targetId))
```

### UI Patterns dari Golden Template

**SOClient (Client Component):**
- State: `processingId: number | null` — untuk disable tombol saat request in-flight
- Approve: `window.confirm('Setujui SO ini? Stok akan diperbarui.')` sebelum fetch
- Reject: modal kecil inline dengan textarea wajib isi alasan, bukan `window.prompt`
- Setelah berhasil approve/reject: refetch list (`router.refresh()`) atau remove SO dari state lokal

**Tabel kolom:** No. SO | Tipe | Cabang | Petugas | Tanggal | Jml Item | Aksi

### Catatan Kritis

1. **`force-dynamic`** wajib di semua API routes dan `page.tsx`
2. **`verifyAccessToken`** dari `@/lib/auth` — pattern sama di semua routes
3. **`payload.role`** tersedia di JWT payload (lihat `lib/auth.ts` — field `role` sudah ada)
4. **Tidak ada migration** yang diperlukan — skema sudah ada
5. **Existing API routes** di `apps/backoffice/app/api/bo/stock-opnames/` JANGAN diubah (hanya tambah subfolder `pending/`, `[id]/approve/`, `[id]/reject/`)
6. **Sidebar link** — tambahkan di `layout.tsx` setelah link "Penyesuaian Stok", dalam section yang sama:
   ```tsx
   <Link href="/inventory/stock-opname" className="...">
     <span>📋</span>
     Stock Opname
   </Link>
   ```

### Learnings dari Story 7.5 & 7.6

- Gunakan `Number(payload.userId)` bukan `payload.userId` langsung untuk perbandingan integer
- `db.transaction(async (tx) => {...})` untuk operasi multi-table
- Kolom projection di `.returning()` — jangan expose field sensitif
- Error handling: throw Error dengan string sentinel (`'SO_NOT_FOUND'`, `'ALREADY_PROCESSED'`) lalu catch by message di top-level handler
- Loading state di client: `processingId` state di-set di try/finally
- `router.refresh()` dari `next/navigation` untuk refresh server component setelah mutasi

---

## Tasks / Subtasks

- [x] **Task 1: API GET `/api/bo/stock-opnames/pending/route.ts`**
  - [x] 1.1 Auth check (401 jika tidak ada token)
  - [x] 1.2 Query: SELECT SO berstatus PENDING dengan join branches (branchName) dan users (createdByName)
  - [x] 1.3 Hitung jumlah item per SO (COUNT dari stock_opname_items)
  - [x] 1.4 Return JSON array dengan field: id, soNumber, type, branchName, createdByName, createdAt, itemCount

- [x] **Task 2: API PATCH `/api/bo/stock-opnames/[id]/reject/route.ts`**
  - [x] 2.1 Auth check (401) + role check OWNER/MANAGER (403)
  - [x] 2.2 Validate body: `reason` wajib, tidak boleh kosong
  - [x] 2.3 Fetch SO by id, validasi status === 'PENDING' (400 jika sudah diproses)
  - [x] 2.4 Update stockOpnames: status='REJECTED', rejectedById, rejectedAt, rejectionNote

- [x] **Task 3: API PATCH `/api/bo/stock-opnames/[id]/approve/route.ts`**
  - [x] 3.1 Auth check (401) + role check OWNER/MANAGER (403)
  - [x] 3.2 Fetch SO by id, validasi status === 'PENDING'
  - [x] 3.3 Fetch semua items dari stock_opname_items WHERE soId = id
  - [x] 3.4 Dalam db.transaction: panggil `applySOStockAdjustment(tx, {...})` dari `@/lib/stock-adjustment` untuk setiap item dengan varianceQty != 0 (sama persis pola existing POS approve route)
  - [x] 3.5 Update stockOpnames: status='APPROVED', approvedById, approvedAt

- [x] **Task 4: Halaman `/inventory/stock-opname/page.tsx` (Server Component)**
  - [x] 4.1 `export const dynamic = 'force-dynamic'`
  - [x] 4.2 Query PENDING SOs dengan join + item count
  - [x] 4.3 Render SOClient dengan data

- [x] **Task 5: Komponen `_components/so-client.tsx` (Client Component)**
  - [x] 5.1 Tabel kolom: No. SO | Tipe | Cabang | Petugas | Tanggal | Jml Item | Aksi
  - [x] 5.2 Tombol "Setujui" + window.confirm() + loading state
  - [x] 5.3 Tombol "Tolak" + modal inline dengan textarea alasan wajib + loading state
  - [x] 5.4 Refresh setelah aksi berhasil (router.refresh() atau optimistic remove)
  - [x] 5.5 Banner sukses/error

- [x] **Task 6: Tambah link sidebar di `layout.tsx`**
  - [x] 6.1 Tambah `<Link href="/inventory/stock-opname">` setelah link Penyesuaian Stok

---

## Dev Agent Record

### Implementation Plan
Mengikuti golden template dari Story 7.5/7.6. API routes menggunakan pattern verifyAccessToken + role check. Approve menggunakan db.transaction dengan applySOStockAdjustment. UI pattern mengikuti stock-adjustment.

### Debug Log
Tidak ada error. TypeScript type-check lulus bersih.

### Completion Notes
Semua 6 task selesai: 3 API routes (GET pending, PATCH approve, PATCH reject), 1 server component page, 1 client component (SOClient), dan 1 sidebar link. Semua mengikuti golden template pattern yang ada.

---

## File List

- `apps/backoffice/app/api/bo/stock-opnames/pending/route.ts` (new)
- `apps/backoffice/app/api/bo/stock-opnames/[id]/approve/route.ts` (new)
- `apps/backoffice/app/api/bo/stock-opnames/[id]/reject/route.ts` (new)
- `apps/backoffice/app/(dashboard)/inventory/stock-opname/page.tsx` (new)
- `apps/backoffice/app/(dashboard)/inventory/stock-opname/_components/so-client.tsx` (new)
- `apps/backoffice/app/(dashboard)/layout.tsx` (modified)

---

### Review Findings

- [x] [Review][Patch] history/route.ts completely unauthenticated [apps/backoffice/app/api/bo/stock-opnames/history/route.ts:1] — Fixed: added verifyAccessToken auth check, Zod validation, column projection, Bahasa Indonesia error messages, and explicit conditions array.
- [x] [Review][Patch] Race condition on approve/reject (TOCTOU) [apps/backoffice/app/api/bo/stock-opnames/[id]/approve/route.ts, [id]/reject/route.ts] — Fixed: moved SO read + status check inside db.transaction with .for('update').
- [x] [Review][Patch] Approve reads SO items outside transaction [apps/backoffice/app/api/bo/stock-opnames/[id]/approve/route.ts] — Fixed: moved items query inside db.transaction block.
- [x] [Review][Patch] history/route.ts query inputs lack validation [apps/backoffice/app/api/bo/stock-opnames/history/route.ts] — Fixed: added Zod querySchema with regex validation for branchId/shiftId and enum for status.
- [x] [Review][Patch] history/route.ts passes undefined into Drizzle and() [apps/backoffice/app/api/bo/stock-opnames/history/route.ts] — Fixed: build conditions array explicitly and only call and(...) when array non-empty.
- [x] [Review][Patch] history/route.ts exposes all columns without projection [apps/backoffice/app/api/bo/stock-opnames/history/route.ts] — Fixed: select only safe columns (id, soNumber, branchId, type, status, createdById, createdAt).
- [x] [Review][Patch] history/route.ts returns English error messages [apps/backoffice/app/api/bo/stock-opnames/history/route.ts] — Fixed: error messages now in Bahasa Indonesia.
- [x] [Review][Patch] pending/route.ts fetches item counts for ALL SOs [apps/backoffice/app/api/bo/stock-opnames/pending/route.ts] — Fixed: added inArray WHERE clause limiting to pending SO IDs.
- [x] [Review][Patch] Unsafe numeric coercion (NaN userId) [apps/backoffice/app/api/bo/stock-opnames/[id]/approve/route.ts, [id]/reject/route.ts] — Fixed: added Number.isNaN guard on payload.userId before use.
- [x] [Review][Patch] Unbounded rejection reason [apps/backoffice/app/api/bo/stock-opnames/[id]/reject/route.ts] — Fixed: added .max(500) to Zod rejectSchema.
- [x] [Review][Patch] Date serialization mismatch (createdAt) [apps/backoffice/app/(dashboard)/inventory/stock-opname/page.tsx, so-client.tsx] — Fixed: SOListItem.createdAt typed as Date | string; added formatDate() helper with NaN guard.
- [x] [Review][Patch] Client state drifts from server after refresh [apps/backoffice/app/(dashboard)/inventory/stock-opname/_components/so-client.tsx] — Fixed: added useEffect to sync items state when initialData prop changes.
- [x] [Review][Patch] Missing abort controller in fetch [apps/backoffice/app/(dashboard)/inventory/stock-opname/_components/so-client.tsx] — Fixed: added AbortController per request with AbortError skip.
- [x] [Review][Patch] so-client.tsx invalid date crash [apps/backoffice/app/(dashboard)/inventory/stock-opname/_components/so-client.tsx] — Fixed: formatDate() helper guards against undefined/invalid dates.
- [x] [Review][Defer] innerJoin silently drops orphaned records [page.tsx, pending/route.ts] — deferred, pre-existing schema/data integrity concern.
- [x] [Review][Defer] Magic strings for business rules [multiple files] — deferred, pre-existing codebase-wide refactor.

## Change Log

| Date | Change |
|------|--------|
| 2026-05-09 | Story created |
| 2026-05-09 | Implementation complete: 3 API routes, 1 page, 1 component, 1 sidebar link |
| 2026-05-10 | Code review: 14 patch, 2 defer, 2 dismissed |
