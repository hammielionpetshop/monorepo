# Story 7.1: Product Master CRUD

Status: done

## Story

As an Admin/Owner,
I want mengelola data produk (tambah, lihat, edit, nonaktifkan) melalui Backoffice,
so that produk baru dapat ditambahkan ke sistem tanpa memerlukan akses database langsung atau seed script.

## Acceptance Criteria

1. **Given** Admin/Owner membuka halaman `/master-data/products`
   **When** halaman dimuat
   **Then** tabel produk menampilkan semua produk (aktif dan nonaktif) dengan kolom: Nama, SKU, Barcode, Kategori, Brand, UOM Dasar, Status (Aktif/Nonaktif)
   **And** halaman dimuat dalam waktu < 3 detik (NFR-P2)

2. **Given** Admin menekan tombol "Tambah Produk"
   **When** form diisi dengan data valid (nama wajib, SKU unik jika diisi, barcode unik jika diisi, UOM dasar wajib dipilih)
   **And** form disubmit
   **Then** produk baru tersimpan ke tabel `products` di database
   **And** produk muncul di daftar

3. **Given** Admin mencoba menyimpan produk dengan SKU yang sudah ada
   **When** form disubmit
   **Then** error "SKU sudah digunakan oleh produk lain" ditampilkan
   **And** tidak ada perubahan di database

4. **Given** Admin mencoba menyimpan produk dengan barcode yang sudah ada
   **When** form disubmit
   **Then** error "Barcode sudah digunakan oleh produk lain" ditampilkan
   **And** tidak ada perubahan di database

5. **Given** Admin memilih produk dari daftar dan menekan "Edit"
   **When** form edit diisi dengan data valid dan disubmit
   **Then** data produk diperbarui di database (nama, SKU, barcode, kategori, brand, berat)
   **And** `updatedAt` diperbarui

6. **Given** Admin memilih produk berstatus Aktif dan menekan "Nonaktifkan"
   **When** dikonfirmasi
   **Then** `isActive` produk menjadi `false`
   **And** produk tidak akan disertakan dalam POS Bootstrap response berikutnya

7. **Given** Admin memilih produk berstatus Nonaktif dan menekan "Aktifkan"
   **When** dikonfirmasi
   **Then** `isActive` produk menjadi `true`

8. **Given** Owner mengakses halaman tanpa sesi aktif
   **When** membuka `/master-data/products`
   **Then** diarahkan ke `/login` (via existing `DashboardLayout` auth check)

## Tasks / Subtasks

- [x] Task 1: API Route — GET /api/bo/master-data/products (AC: #1)
  - [x] Buat file `apps/backoffice/app/api/bo/master-data/products/route.ts`
  - [x] Query tabel `products` join `categories`, `brands`, `unitsOfMeasure` menggunakan Drizzle ORM
  - [x] Return array produk dengan semua field yang dibutuhkan tabel
  - [x] Auth via cookie `accessToken` (pola sama dengan route BO lainnya)

- [x] Task 2: API Route — POST /api/bo/master-data/products (AC: #2, #3, #4)
  - [x] Tambahkan handler `POST` di route yang sama
  - [x] Validasi: `name` wajib, `baseUomId` wajib, `sku` unik jika diisi, `barcode` unik jika diisi
  - [x] Insert ke tabel `products` menggunakan Drizzle ORM
  - [x] Return produk yang baru dibuat dengan status 201

- [x] Task 3: API Route — PATCH /api/bo/master-data/products/[id] (AC: #5, #6, #7)
  - [x] Buat file `apps/backoffice/app/api/bo/master-data/products/[id]/route.ts`
  - [x] Handler `PATCH` untuk update data produk (name, sku, barcode, categoryId, brandId, weightGram, isActive)
  - [x] Validasi uniqueness SKU/barcode saat update (exclude produk itu sendiri)
  - [x] Update `updatedAt` ke waktu sekarang

- [x] Task 4: Halaman List Produk (AC: #1, #8)
  - [x] Buat `apps/backoffice/app/(dashboard)/master-data/products/page.tsx` sebagai Server Component
  - [x] Fetch data produk dari database langsung (bukan via API route, gunakan Drizzle langsung di Server Component)
  - [x] Render tabel dengan kolom: Nama, SKU, Barcode, Kategori, Brand, UOM Dasar, Status badge (Aktif/Nonaktif)
  - [x] Tombol "Tambah Produk" yang membuka form (modal)
  - [x] Tombol "Edit" dan "Nonaktifkan/Aktifkan" per baris

- [x] Task 5: Form Tambah/Edit Produk — Client Component (AC: #2, #3, #4, #5)
  - [x] Buat `apps/backoffice/app/(dashboard)/master-data/products/_components/product-form.tsx`
  - [x] Field: Nama (text, required), SKU (text, optional), Barcode (text, optional), Kategori (select dari `categories`), Brand (select dari `brands`), UOM Dasar (select dari `unitsOfMeasure` dimana `isBase = true`), Berat gram (number, optional)
  - [x] Submit via `fetch` POST/PATCH ke API route
  - [x] Tampilkan error dari API di atas form
  - [x] Reset form dan refresh list setelah sukses

- [x] Task 6: Aksi Nonaktifkan/Aktifkan — Client fetch (AC: #6, #7)
  - [x] Tombol konfirmasi sebelum mengubah status
  - [x] PATCH ke `/api/bo/master-data/products/[id]` dengan `{ isActive: false/true }`
  - [x] Refresh list setelah sukses

- [x] Task 7: Tambah link navigasi ke sidebar (AC: #1)
  - [x] Update `apps/backoffice/app/(dashboard)/layout.tsx`
  - [x] Tambahkan section "Master Data" dengan link ke `/master-data/products`
  - [x] Gunakan ikon emoji yang konsisten dengan link lain

## Dev Notes

### Pola yang Harus Diikuti (dari codebase existing)

**Server Component + Client Component pattern:**
- Halaman utama (`page.tsx`) adalah Server Component — fetch data langsung dari DB via Drizzle
- Form/interaksi adalah Client Component (`'use client'`) — submit via `fetch` ke API route
- Contoh referensi: `apps/backoffice/app/(dashboard)/inventory/stock-adjustment/page.tsx` + `_components/adjustment-form.tsx`

**Auth pattern:**
- Auth sudah dihandle oleh `DashboardLayout` — semua route dalam `(dashboard)` group otomatis dilindungi
- Di API route, extract token dari cookie: `const token = cookieStore.get('accessToken')?.value`
- Gunakan `verifyAccessToken(token)` dari `@/lib/auth` untuk validasi

**API route pattern (dari `apps/backoffice/app/api/bo/inventory/stock-adjustment/route.ts`):**
```typescript
import { cookies } from 'next/headers'
import { db } from '@petshop/db'
import { verifyAccessToken } from '@/lib/auth'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  // ... logika
}
```

**Drizzle ORM pattern:**
```typescript
import { db } from '@petshop/db'
import { products, categories, brands, unitsOfMeasure } from '@petshop/db/schema'
import { eq, and } from 'drizzle-orm'

// Query dengan join
const result = await db
  .select({
    id: products.id,
    name: products.name,
    // ...
    categoryName: categories.name,
  })
  .from(products)
  .leftJoin(categories, eq(products.categoryId, categories.id))
  .leftJoin(brands, eq(products.brandId, brands.id))
  .leftJoin(unitsOfMeasure, eq(products.baseUomId, unitsOfMeasure.id))
```

**Validasi uniqueness SKU/barcode:**
- Saat CREATE: `WHERE sku = $1` — jika ada hasil, return error
- Saat UPDATE: `WHERE sku = $1 AND id != $2` — jika ada hasil, return error

### Skema Database yang Relevan

**Tabel `products`** (`packages/db/src/schema/products.ts`):
```typescript
products: {
  id: serial primaryKey,
  sku: varchar(50) unique nullable,
  barcode: varchar(50) unique nullable,
  name: varchar(255) notNull,
  categoryId: integer → categories.id nullable,
  brandId: integer → brands.id nullable,
  baseUomId: integer → units_of_measure.id notNull,
  weightGram: decimal(10,2) nullable,
  isActive: boolean default true notNull,
  createdAt: timestamp,
  updatedAt: timestamp,
}
```

**Tabel master** (`packages/db/src/schema/master.ts`):
- `categories`: id, name (unique)
- `brands`: id, name (unique)
- `units_of_measure`: id, code, name, isBase

### UI Pattern

- Gunakan Tailwind CSS + pola styling dari komponen existing (lihat `adjustment-form.tsx`)
- Warna status badge: Aktif = `bg-green-100 text-green-800`, Nonaktif = `bg-gray-100 text-gray-600`
- Tombol primary: `bg-primary text-primary-foreground hover:bg-primary/90`
- Error message: `bg-destructive/10 border border-destructive/20 text-destructive`
- Success message: `bg-green-50 border border-green-200 text-green-800`
- Semua pesan user-facing dalam **Bahasa Indonesia**

### Hal yang TIDAK Perlu Dikerjakan di Story Ini

- Multi-UOM Config per produk (Story 7.3)
- Price Tier per produk (Story 7.4)
- Upload foto produk (belum ada storage setup)
- Pagination (gunakan list sederhana dulu, produk tidak banyak di awal)

### Project Structure Notes

```
apps/backoffice/
  app/
    (dashboard)/
      master-data/
        products/
          page.tsx                    ← NEW (Server Component)
          _components/
            product-form.tsx          ← NEW (Client Component)
      layout.tsx                      ← UPDATE (tambah nav link)
    api/
      bo/
        master-data/
          products/
            route.ts                  ← NEW (GET, POST)
            [id]/
              route.ts                ← NEW (PATCH)
```

### References

- Auth pattern: `apps/backoffice/app/(dashboard)/layout.tsx`
- Server Component + Client Component: `apps/backoffice/app/(dashboard)/inventory/stock-adjustment/`
- Drizzle schema products: `packages/db/src/schema/products.ts`
- Drizzle schema master: `packages/db/src/schema/master.ts`
- Project context rules: `_bmad-output/project-context.md`

## Change Log

- 2026-05-06: Implementasi Product Master CRUD — API routes (GET, POST, PATCH), halaman list Server Component, form Client Component (tambah/edit), toggle aktif/nonaktif, sidebar navigasi.

## Dev Agent Record

### Agent Model Used

DeepSeek V4 Flash

### Debug Log References

- 2026-05-06: First type-check error — `uomCode` type mismatch (string vs string | null) pada page.tsx dan product-client.tsx. Diperbaiki dengan mengubah tipe menjadi `string | null`.
- 2026-05-06: Pre-existing error `lucide-react` pada refresh-button.tsx tidak disentuh.

### Completion Notes List

- **Task 1**: GET route di `apps/backoffice/app/api/bo/master-data/products/route.ts` — query products dengan leftJoin ke categories, brands, unitsOfMeasure. Auth via accessToken cookie.
- **Task 2**: POST handler di route yang sama — validasi Zod (name wajib, baseUomId wajib, sku/barcode unique), insert dan return 201.
- **Task 3**: PATCH route di `[id]/route.ts` — update data produk termasuk isActive untuk toggle status. Validasi uniqueness SKU/barcode saat update (exclude self via `ne`).
- **Task 4**: Halaman Server Component `page.tsx` — fetch data langsung dari Drizzle, render tabel dengan semua kolom yang diminta AC #1.
- **Task 5**: Client Component `product-form.tsx` — form lengkap dengan field sesuai spesifikasi, submit via fetch ke API, error handling di atas form, refresh setelah sukses.
- **Task 6**: Aksi toggle aktif/nonaktif di `product-client.tsx` — konfirmasi via `window.confirm`, PATCH ke API, refresh list.
- **Task 7**: Sidebar nav link — section "Master Data" dengan link "Produk" (📦) di layout.tsx.

### File List

**New files:**
- `apps/backoffice/app/api/bo/master-data/products/route.ts` — GET & POST handler
- `apps/backoffice/app/api/bo/master-data/products/[id]/route.ts` — PATCH handler
- `apps/backoffice/app/(dashboard)/master-data/products/page.tsx` — Server Component list produk
- `apps/backoffice/app/(dashboard)/master-data/products/_components/product-form.tsx` — Form tambah/edit Client Component
- `apps/backoffice/app/(dashboard)/master-data/products/_components/product-client.tsx` — Tabel + modal + aksi Client Component

**Modified files:**
- `apps/backoffice/app/(dashboard)/layout.tsx` — tambah sidebar nav link Master Data → Produk

### Review Findings

#### decision-needed

_No decision-needed findings._

#### patch

- [x] [Review][Patch] Race conditions on SKU/barcode uniqueness [route.ts:86-110, [id]/route.ts:67-89] — Manual select→insert/update is non-atomic; concurrent requests can bypass the existence check and create duplicates. No fallback handling for database unique-constraint violations.
- [x] [Review][Patch] Internal error messages leaked to clients [route.ts:61,117; [id]/route.ts:97; page.tsx:68] — Catch blocks return raw `Error.message` directly in JSON body, exposing database internals/driver errors to the caller. Violates project rule that all user-facing error messages must be in Bahasa Indonesia.
- [x] [Review][Patch] Navigation uses native `<a>` instead of Next.js `<Link>` [layout.tsx] — Triggers full document reload, destroying client state and bypassing Next.js router optimizations.
- [x] [Review][Patch] No foreign-key existence validation [route.ts:102-117, [id]/route.ts:91-97] — API accepts `categoryId`, `brandId`, and `baseUomId` without verifying referenced rows exist. `baseUomId` doesn't verify the UOM is actually a base unit. Violations surface as opaque 500s.
- [x] [Review][Patch] setTimeout callbacks never cleaned up [product-client.tsx:57-97] — Timeouts to clear success messages omit cleanup in useEffect return, risking state updates on unmounted component and React memory-leak warnings.
- [x] [Review][Patch] TypeScript interfaces duplicated across files [page.tsx, product-client.tsx, product-form.tsx] — `Product`, `Category`, `Brand`, `Uom` redefined independently, creating maintenance drag and silent type drift.
- [x] [Review][Patch] Modal lacks accessibility and keyboard UX [product-client.tsx] — No focus trap, no Escape key handler, no `role="dialog"` or `aria-modal`, and no body scroll lock.
- [x] [Review][Patch] PATCH payload built with `Record<string, unknown>` [[id]/route.ts:91-97] — Manual field-by-field construction abandons type safety and conflates "field not provided" with "field explicitly cleared".
- [x] [Review][Patch] parseInt without radix on route params [[id]/route.ts:40, product-form.tsx] — ID like "42abc" silently coerces to 42. Should use strict validation via Zod schema.
- [x] [Review][Patch] Optional fields cannot be cleared during edit [product-form.tsx:125-131, [id]/route.ts:64-71] — Empty-string optional values are omitted from PATCH payload. PATCH handler only writes fields when `!== undefined`, so once set, optional fields can never be nulled. Violates AC #5.
- [x] [Review][Patch] Native browser validation displays non-Indonesian messages [product-form.tsx:142,179] — HTML `required` attributes allow browser to render untranslated validation tooltips rather than the Indonesian error messages already implemented in JS validation. Violates project rule.
- [x] [Review][Patch] Component files exceed 200-line modularity limit [product-form.tsx, product-client.tsx] — `product-form.tsx` is 256 lines and `product-client.tsx` is 229 lines, exceeding the 200-line limit per project context rules.
- [x] [Review][Patch] Product deleted between check and update [[id]/route.ts:94-97] — Product could be deleted between existence check and update; `updated[0]` could be undefined.
- [x] [Review][Patch] refreshProducts fetch non-ok not handled [product-client.tsx:41-46] — If refreshProducts returns non-ok, no error feedback is shown and product list may become stale.
- [x] [Review][Patch] Unawaited async refreshProducts in handleSuccess [product-client.tsx:56-96] — `handleSuccess` calls `refreshProducts()` without await, creating unhandled promise rejection risk.

#### defer

- [x] [Review][Defer] Fetch requests lack timeout/AbortController [product-form.tsx, product-client.tsx] — Submit/toggle buttons could stay disabled forever if fetch hangs. UX enhancement, not a blocking bug for internal backoffice app. — deferred, not blocking
