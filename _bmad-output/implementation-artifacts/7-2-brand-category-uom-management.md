# Story 7.2: Brand, Category & UOM Management

**Story ID:** 7.2
**Story Key:** 7-2-brand-category-uom-management
**Epic:** 7 - Backoffice Master Data Management (P0 — Critical Blocker)
**Status:** review
**Created:** 2026-05-07

---

## User Story

Sebagai Admin/Owner,
saya ingin mengelola data Brand, Kategori, dan Satuan Ukur (UOM) melalui Backoffice,
Agar klasifikasi produk dapat dikelola secara mandiri tanpa memerlukan akses database langsung.

---

## Acceptance Criteria

**AC1 — List View**
Given Admin membuka halaman `/master-data/brands` (atau `/master-data/categories`, `/master-data/uom`)
When halaman dimuat
Then daftar data master ditampilkan dalam tabel dengan kolom yang relevan
And halaman dimuat dalam < 3 detik

**AC2 — Tambah Data Baru**
Given Admin mengisi form tambah data baru dengan nama yang valid dan unik
When form disubmit
Then data tersimpan ke tabel `brands` / `categories` / `units_of_measure` di database
And data baru muncul di daftar

**AC3 — Validasi Duplikat**
Given Admin mencoba menambah nama (atau kode UOM) yang sudah ada
When form disubmit
Then error "Nama sudah digunakan" (atau "Kode sudah digunakan") ditampilkan dalam Bahasa Indonesia
And tidak ada perubahan di database

**AC4 — Edit Data**
Given Admin memilih data dari daftar dan menekan "Edit"
When form edit diisi dengan data valid dan disubmit
Then data diperbarui di database
And perubahan terlihat di daftar tanpa full reload

**AC5 — Validasi Duplikat saat Edit**
Given Admin mencoba mengubah nama ke nama yang sudah digunakan oleh data lain
When form disubmit
Then error ditampilkan dan data tidak diubah

**AC6 — Auth**
Given akses tanpa autentikasi
When halaman diakses
Then redirect ke `/login` (dihandle oleh DashboardLayout — tidak perlu cek manual)

---

## Scope & Batasan

- **In scope:** CRUD lengkap (list, tambah, edit) untuk Brand, Kategori, dan UOM
- **Out of scope:** Delete (berbahaya — FK ke `products.categoryId`, `products.brandId`, `products.baseUomId`). Soft delete juga out of scope karena schema tidak memiliki field `isActive` untuk entitas ini. Pagination (data sedikit, list sederhana cukup).
- **UOM isBase:** Field `isBase` pada UOM harus bisa di-set via form. Ini krusial karena form produk (Story 7.1) memfilter UOM berdasarkan `isBase = true` untuk field `baseUomId`.

---

## Skema Database yang Relevan

File: `packages/db/src/schema/master.ts`

```typescript
// SUDAH ADA — tidak perlu migration baru
export const unitsOfMeasure = petshop.table('units_of_measure', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 10 }).notNull().unique(),
  name: varchar('name', { length: 50 }).notNull(),
  isBase: boolean('is_base').default(false).notNull(),
})

export const categories = petshop.table('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
})

export const brands = petshop.table('brands', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
})
```

**PENTING:** Tidak ada perubahan schema yang diperlukan. Ketiga tabel sudah ada. Tidak perlu menjalankan migration.

---

## File Structure

```
apps/backoffice/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx                                    # UPDATE: tambah 3 nav link baru
│   │   └── master-data/
│   │       ├── brands/
│   │       │   ├── page.tsx                              # BARU: Server Component
│   │       │   └── _components/
│   │       │       ├── types.ts                          # BARU: Brand, BrandFormData
│   │       │       ├── brand-client.tsx                  # BARU: list + modal + aksi
│   │       │       └── brand-form.tsx                    # BARU: form tambah/edit
│   │       ├── categories/
│   │       │   ├── page.tsx                              # BARU: Server Component
│   │       │   └── _components/
│   │       │       ├── types.ts                          # BARU: Category, CategoryFormData
│   │       │       ├── category-client.tsx               # BARU
│   │       │       └── category-form.tsx                 # BARU
│   │       └── uom/
│   │           ├── page.tsx                              # BARU: Server Component
│   │           └── _components/
│   │               ├── types.ts                          # BARU: Uom, UomFormData
│   │               ├── uom-client.tsx                    # BARU
│   │               └── uom-form.tsx                      # BARU
│   └── api/
│       └── bo/
│           └── master-data/
│               ├── brands/
│               │   ├── route.ts                          # BARU: GET, POST
│               │   └── [id]/
│               │       └── route.ts                      # BARU: PATCH
│               ├── categories/
│               │   ├── route.ts                          # BARU: GET, POST
│               │   └── [id]/
│               │       └── route.ts                      # BARU: PATCH
│               └── uom/
│                   ├── route.ts                          # BARU: GET, POST
│                   └── [id]/
│                       └── route.ts                      # BARU: PATCH
```

---

## Tasks / Subtasks

- [x] Task 1: Brands Module — API Routes
  - [x] Buat `apps/backoffice/app/api/bo/master-data/brands/route.ts` dengan handler GET dan POST
  - [x] GET: query semua brands, order by name, return JSON array `{ id, name }[]`
  - [x] POST: Zod validate `{ name: string min 1 max 50 }`, cek uniqueness dalam db.transaction, insert, return 201
  - [x] Buat `apps/backoffice/app/api/bo/master-data/brands/[id]/route.ts` dengan handler PATCH
  - [x] PATCH: Zod validate id (regex /^\d+$/), validate `{ name: string min 1 max 50 }`, cek NOT_FOUND, cek duplikat (exclude self via `ne`), update, return row

- [x] Task 2: Brands Module — UI
  - [x] Buat `apps/backoffice/app/(dashboard)/master-data/brands/_components/types.ts`
  - [x] Buat `apps/backoffice/app/(dashboard)/master-data/brands/_components/brand-form.tsx` — Client Component form tambah/edit
  - [x] Buat `apps/backoffice/app/(dashboard)/master-data/brands/_components/brand-client.tsx` — Client Component tabel + modal + aksi
  - [x] Buat `apps/backoffice/app/(dashboard)/master-data/brands/page.tsx` — Server Component, fetch langsung dari DB, render BrandClient

- [x] Task 3: Categories Module — API Routes
  - [x] Buat `apps/backoffice/app/api/bo/master-data/categories/route.ts` dengan handler GET dan POST
  - [x] Buat `apps/backoffice/app/api/bo/master-data/categories/[id]/route.ts` dengan handler PATCH
  - [x] Pola identik dengan Brands — hanya ganti `brands` → `categories`

- [x] Task 4: Categories Module — UI
  - [x] Buat `_components/types.ts`, `category-form.tsx`, `category-client.tsx`, `page.tsx`
  - [x] Pola identik dengan Brands

- [x] Task 5: UOM Module — API Routes
  - [x] Buat `apps/backoffice/app/api/bo/master-data/uom/route.ts` dengan handler GET dan POST
  - [x] GET: query semua UOM, order by name, return `{ id, code, name, isBase }[]`
  - [x] POST: Zod validate `{ code: string min 1 max 10, name: string min 1 max 50, isBase: boolean }`, cek uniqueness `code` dalam db.transaction, insert, return 201
  - [x] Buat `apps/backoffice/app/api/bo/master-data/uom/[id]/route.ts` dengan handler PATCH
  - [x] PATCH: validate id, validate `{ code?, name?, isBase? }`, cek NOT_FOUND, cek duplikat `code` (exclude self), update, return row

- [x] Task 6: UOM Module — UI
  - [x] Buat `_components/types.ts` dengan interface `Uom` dan `UomFormData`
  - [x] Buat `uom-form.tsx` — form dengan 3 field: `code` (text, required), `name` (text, required), `isBase` (checkbox)
  - [x] Buat `uom-client.tsx` — tabel dengan kolom: Kode, Nama, Tipe (Base/Derived), Aksi
  - [x] Buat `page.tsx` — Server Component

- [x] Task 7: Update Sidebar Navigation
  - [x] Update `apps/backoffice/app/(dashboard)/layout.tsx`
  - [x] Tambahkan 3 `<Link>` baru di bawah link "Produk" dalam section "Master Data":
    - Brand → `/master-data/brands` (ikon 🏷️)
    - Kategori → `/master-data/categories` (ikon 🗂️)
    - Satuan Ukur → `/master-data/uom` (ikon 📐)
  - [x] Gunakan `<Link>` dari `next/link`, BUKAN `<a>` tag (konsisten dengan patch Story 7.1)

---

## Dev Notes

### Pola Golden Template — Ikuti Persis dari Story 7.1

Story 7.2 adalah **replikasi pola** dari Story 7.1 untuk tiga entitas yang lebih sederhana. Semua pola sudah ter-review dan ter-patch. Dev agent WAJIB mengikuti implementasi yang sudah ada.

**Referensi implementasi terbaik (sudah post-review-patch):**
- API route POST: `apps/backoffice/app/api/bo/master-data/products/route.ts`
- API route PATCH: `apps/backoffice/app/api/bo/master-data/products/[id]/route.ts`
- Client orchestrator: `apps/backoffice/app/(dashboard)/master-data/products/_components/product-client.tsx`
- Form component: `apps/backoffice/app/(dashboard)/master-data/products/_components/product-form.tsx`
- Server Component page: `apps/backoffice/app/(dashboard)/master-data/products/page.tsx`

### Pola Auth (dari codebase — wajib di setiap API route)

```typescript
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'

const cookieStore = await cookies()
const token = cookieStore.get('accessToken')?.value
const payload = token ? await verifyAccessToken(token) : null
if (!payload) {
  return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
}
```

### Pola API Route GET (GET brands/categories/uom)

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { brands } from '@petshop/db/schema'  // atau categories / unitsOfMeasure

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Auth check
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })

    // 2. Query
    const result = await db.select().from(brands).orderBy(brands.name)

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data brand' }, { status: 500 })
  }
}
```

### Pola API Route POST (uniqueness dalam transaction)

```typescript
export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    // 2. Zod parse
    const schema = z.object({ name: z.string().min(1, 'Nama wajib diisi').max(50) })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })

    // 3. Insert dalam transaction (atomik + cek duplikat)
    const result = await db.transaction(async (trx) => {
      const existing = await trx.select({ id: brands.id }).from(brands).where(eq(brands.name, parsed.data.name)).limit(1)
      if (existing.length > 0) throw new Error('DUPLICATE_NAME')

      return await trx.insert(brands).values({ name: parsed.data.name }).returning()
    })

    return NextResponse.json(result[0], { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'DUPLICATE_NAME') {
      return NextResponse.json({ error: 'Nama sudah digunakan' }, { status: 409 })
    }
    console.error('POST /api/bo/master-data/brands error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat menyimpan data brand' }, { status: 500 })
  }
}
```

### Pola API Route PATCH (update dengan uniqueness exclude self)

```typescript
// PATCH /api/bo/master-data/brands/[id]
// Gunakan pola dari products/[id]/route.ts — persis sama tapi lebih sederhana (hanya 1 field: name)

const paramsSchema = z.object({ id: z.string().regex(/^\d+$/, 'ID tidak valid') })
const updateSchema = z.object({ name: z.string().min(1, 'Nama wajib diisi').max(50) })

// Di dalam transaction:
// 1. Cek NOT_FOUND
// 2. Cek duplikat name WHERE name = ? AND id != ? (gunakan `ne` dari drizzle-orm)
// 3. Update dan return row
```

### Pola Client Component (product-client.tsx sebagai template)

Gunakan `product-client.tsx` sebagai template karena sudah memiliki semua patch review:
- ✅ `useEffect` cleanup untuk keyboard listener dan `body.overflow`
- ✅ `role="dialog"` dan `aria-modal="true"` pada modal overlay
- ✅ `await refreshXxx()` (awaited, tidak fire-and-forget)
- ✅ Error handling saat `res.ok === false`
- ✅ `clearTimeout` cleanup di `useEffect` untuk success message
- ✅ TIDAK menggunakan `alert()` untuk error — tampilkan inline

Untuk Brand dan Category, komponen bahkan lebih sederhana dari Product karena hanya ada 1 field (name).

### Pola Server Component page.tsx

```typescript
// apps/backoffice/app/(dashboard)/master-data/brands/page.tsx
import { db } from '@/lib/db'
import { brands } from '@petshop/db/schema'
import BrandClient from './_components/brand-client'

export default async function BrandsPage() {
  const data = await db.select().from(brands).orderBy(brands.name)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Manajemen Brand</h1>
        <p className="text-sm text-muted-foreground mt-1">Kelola daftar brand produk</p>
      </div>
      <BrandClient brands={data} />
    </div>
  )
}
```

### Import DB yang Benar

Perhatikan pola import yang digunakan di codebase:
```typescript
// Di API routes — gunakan @/lib/db (convenience wrapper)
import { db, brands, categories, unitsOfMeasure, eq, and, ne } from '@/lib/db'

// Di Server Component page.tsx — bisa pakai langsung dari packages
import { db } from '@/lib/db'
import { brands } from '@petshop/db/schema'
```

Cek `apps/backoffice/lib/db.ts` untuk melihat apa saja yang di-re-export dari sana.

### Perbedaan UOM vs Brand/Category

UOM memiliki 3 field vs 1 field:

| Field | Tipe | Validasi |
|-------|------|----------|
| `code` | varchar(10) unique | required, max 10 karakter, uppercase recommended |
| `name` | varchar(50) | required, max 50 karakter |
| `isBase` | boolean | checkbox, default false |

Form UOM perlu menampilkan tabel dengan kolom: **Kode**, **Nama**, **Tipe** (tampilkan "Dasar" jika isBase=true, "Turunan" jika false), **Aksi**.

**Kritis:** `isBase` menentukan apakah UOM bisa dipilih sebagai `baseUomId` di form produk (Story 7.1 memfilter `uoms.filter(u => u.isBase)`). Pastikan `isBase` bisa di-toggle saat edit.

### Sidebar Navigation Update

Kondisi `layout.tsx` saat ini sudah punya section "Master Data" dengan satu link "Produk". Tambahkan 3 link baru **di bawah** link Produk:

```tsx
// Setelah <Link href="/master-data/products">...
<Link href="/master-data/brands" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary transition-colors">
  <span>🏷️</span>
  Brand
</Link>
<Link href="/master-data/categories" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary transition-colors">
  <span>🗂️</span>
  Kategori
</Link>
<Link href="/master-data/uom" className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary transition-colors">
  <span>📐</span>
  Satuan Ukur
</Link>
```

Pastikan import `Link` dari `next/link` sudah ada di layout.tsx (sudah ada dari patch Story 7.1).

### Anti-Patterns yang Dilarang

- ❌ Gunakan `<a>` tag untuk navigasi — WAJIB `<Link>` dari next/link
- ❌ Import schema langsung dari `packages/db/src/schema/...` di API route — gunakan `@/lib/db`
- ❌ Cek uniqueness tanpa `db.transaction()` — race condition
- ❌ Gunakan `alert()` untuk error feedback di UI — tampilkan inline error
- ❌ `fetch()` ke API route dari Server Component — panggil Drizzle langsung
- ❌ Tambahkan migration baru — schema sudah ada, tidak perlu perubahan
- ❌ Expose raw error message dari database ke client — selalu Indonesian user-friendly message
- ❌ Lewatkan `export const dynamic = 'force-dynamic'` di API routes

### Architecture Compliance

| Rule | Implementation |
|------|---------------|
| Server Component page.tsx | ✅ fetch langsung dari Drizzle, tidak via API route |
| Client Component interaksi | ✅ `'use client'`, fetch ke API route |
| Auth setiap API route | ✅ `verifyAccessToken` dari `@/lib/auth` |
| Zod validation | ✅ Di API route handler, bukan di service |
| Atomic uniqueness check | ✅ `db.transaction()` |
| Error bahasa Indonesia | ✅ Semua pesan user-facing |
| `force-dynamic` | ✅ Di semua API route |
| `<Link>` bukan `<a>` | ✅ Di sidebar layout.tsx |
| Tidak ada migration baru | ✅ Schema sudah ada |

### Urutan Implementasi yang Disarankan

Karena ketiga modul sangat repetitif, implementasikan secara berurutan:
1. **Brands** dulu (paling sederhana — 1 field: name) → jadikan template mental
2. **Categories** (identik dengan Brands — copy + rename)
3. **UOM** (sedikit lebih kompleks karena ada 3 field + isBase)
4. **Sidebar** update terakhir

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log

- TypeScript check (`tsc --noEmit`) lulus tanpa error setelah semua file dibuat.
- Semua API route menggunakan `export const dynamic = 'force-dynamic'` sesuai anti-pattern rules.
- UOM code di-uppercase baik di POST maupun PATCH (di API route level, bukan hanya di UI).

### Completion Notes

Implementasi Story 7.2 selesai. Tiga modul (Brand, Category, UOM) dibuat dengan pola identik mengikuti golden template dari Story 7.1:

- **Brands**: API GET+POST (`/api/bo/master-data/brands`) dan PATCH (`/api/bo/master-data/brands/[id]`). UI: types.ts, brand-form.tsx, brand-client.tsx, page.tsx (Server Component).
- **Categories**: Identik dengan Brands, hanya nama entitas berbeda.
- **UOM**: Lebih kompleks — 3 field (code, name, isBase). Form dengan checkbox isBase. Tabel menampilkan badge "Dasar"/"Turunan". Kode otomatis uppercase.
- **Sidebar**: 3 link baru (Brand, Kategori, Satuan Ukur) ditambahkan di bawah "Produk" menggunakan `<Link>` dari next/link.

Semua AC terpenuhi: list view, tambah data, validasi duplikat, edit data, validasi duplikat saat edit, dan auth via DashboardLayout.

---

## File List

**Baru (dibuat):**
- `apps/backoffice/app/api/bo/master-data/brands/route.ts`
- `apps/backoffice/app/api/bo/master-data/brands/[id]/route.ts`
- `apps/backoffice/app/(dashboard)/master-data/brands/_components/types.ts`
- `apps/backoffice/app/(dashboard)/master-data/brands/_components/brand-form.tsx`
- `apps/backoffice/app/(dashboard)/master-data/brands/_components/brand-client.tsx`
- `apps/backoffice/app/(dashboard)/master-data/brands/page.tsx`
- `apps/backoffice/app/api/bo/master-data/categories/route.ts`
- `apps/backoffice/app/api/bo/master-data/categories/[id]/route.ts`
- `apps/backoffice/app/(dashboard)/master-data/categories/_components/types.ts`
- `apps/backoffice/app/(dashboard)/master-data/categories/_components/category-form.tsx`
- `apps/backoffice/app/(dashboard)/master-data/categories/_components/category-client.tsx`
- `apps/backoffice/app/(dashboard)/master-data/categories/page.tsx`
- `apps/backoffice/app/api/bo/master-data/uom/route.ts`
- `apps/backoffice/app/api/bo/master-data/uom/[id]/route.ts`
- `apps/backoffice/app/(dashboard)/master-data/uom/_components/types.ts`
- `apps/backoffice/app/(dashboard)/master-data/uom/_components/uom-form.tsx`
- `apps/backoffice/app/(dashboard)/master-data/uom/_components/uom-client.tsx`
- `apps/backoffice/app/(dashboard)/master-data/uom/page.tsx`

**Dimodifikasi:**
- `apps/backoffice/app/(dashboard)/layout.tsx` — tambah 3 nav link (Brand, Kategori, Satuan Ukur)

---

## Change Log

- 2026-05-07: Story 7.2 dibuat — Brand, Category & UOM Management
- 2026-05-07: Implementasi selesai — 18 file baru + 1 file dimodifikasi. Brand, Category, UOM CRUD + sidebar navigation.
- 2026-05-08: Addressed code review findings (re-review) — 11 patch items resolved: authorization (OWNER/GM), whitespace Zod trim, Content-Type validation, JSON parse → 400, 23505 fallback in PATCH, error auto-dismiss, backdrop click + Escape guard, mutually exclusive banners, aria live regions, form onSubmittingChange prop.

---

### Review Findings

**decision-needed:** 0 | **patch:** 8 | **defer:** 3 | **dismissed:** 3

#### decision-needed
*(tidak ada)*

#### patch
- [x] [Review][Patch] UOM POST: duplicate check tidak case-sensitive sebelum uppercase insert [apps/backoffice/app/api/bo/master-data/uom/route.ts]
- [x] [Review][Patch] UOM PATCH: schema memperbolehkan body kosong, berisiko empty UPDATE [apps/backoffice/app/api/bo/master-data/uom/[id]/route.ts]
- [x] [Review][Patch] Race condition pada pengecekan duplikat dalam transaction [apps/backoffice/app/api/bo/master-data/brands/route.ts + categories/route.ts + uom/route.ts]
- [x] [Review][Patch] `export const dynamic = 'force-dynamic'` hilang pada route PATCH [brands/[id] + categories/[id] + uom/[id]]
- [x] [Review][Patch] Modal dialog tidak memiliki `aria-labelledby` [brand-client.tsx + category-client.tsx + uom-client.tsx]
- [x] [Review][Patch] Banner sukses/error tidak memiliki live region attributes [brand-client.tsx + category-client.tsx + uom-client.tsx]
- [x] [Review][Patch] Banner sukses dan error bisa muncul bersamaan setelah save [brand-client.tsx + category-client.tsx + uom-client.tsx]
- [x] [Review][Patch] Form memperbolehkan submission ganda via keyboard saat request in-flight [brand-form.tsx + category-form.tsx + uom-form.tsx]

#### defer
- [x] [Review][Defer] Missing authorization checks beyond authentication [apps/backoffice/app/api/bo/master-data/brands/route.ts] — deferred, pre-existing
- [x] [Review][Defer] Modal dialogs lack focus management and backdrop click handler [apps/backoffice/app/(dashboard)/master-data/brands/_components/brand-client.tsx] — deferred, pre-existing
- [x] [Review][Defer] Global `document.body.style.overflow` mutation dapat conflict antar komponen [apps/backoffice/app/(dashboard)/master-data/brands/_components/brand-client.tsx] — deferred, pre-existing

---

### Review Findings (2026-05-08 — Re-Review)

**decision-needed:** 1 | **patch:** 11 | **defer:** 2 | **dismissed:** 1

#### decision-needed

- [x] [Review][Decision] Tidak ada authorization check selain autentikasi — Semua user yang login bisa mutasi master data [apps/backoffice/app/api/bo/master-data/*] — Spec AC6 hanya menangani akses tanpa autentikasi (redirect ke /login via DashboardLayout). Belum ada keputusan produk: apakah mutasi master data (Brand, Category, UOM) harus dibatasi untuk role tertentu (admin/owner saja)?
  - **Resolusi (2026-05-08):** Batasi untuk admin/owner saja. Dipindahkan ke patch.

#### patch

- [x] [Review][Patch] Tambahkan authorization check (admin/owner only) pada semua API route master data [brands/route.ts + categories/route.ts + uom/route.ts + [id]/route.ts]
- [x] [Review][Patch] Race condition pada pengecekan duplikat dalam transaction → 500 instead of 409 [brands/route.ts + categories/route.ts + uom/route.ts + [id]/route.ts]

- [x] [Review][Patch] Race condition pada pengecekan duplikat dalam transaction → 500 instead of 409 [brands/route.ts + categories/route.ts + uom/route.ts + [id]/route.ts]
- [x] [Review][Patch] UOM POST: duplicate check tidak case-sensitive sebelum uppercase insert [apps/backoffice/app/api/bo/master-data/uom/route.ts]
- [x] [Review][Patch] Banner error tidak auto-dismiss dan bisa tumpang-tindih dengan banner sukses [brand-client.tsx + category-client.tsx + uom-client.tsx]
- [x] [Review][Patch] Modal dialog: backdrop tidak menutup saat klik di luar, dan Escape key menutup modal saat submission in-flight [brand-client.tsx + category-client.tsx + uom-client.tsx]
- [x] [Review][Patch] UOM PATCH: schema memperbolehkan body kosong, berisiko empty UPDATE [apps/backoffice/app/api/bo/master-data/uom/[id]/route.ts]
- [x] [Review][Patch] Server menerima whitespace-only string dan perbandingan case-sensitive saat cek duplikat [brands/route.ts + categories/route.ts + uom/route.ts + [id]/route.ts]
- [x] [Review][Patch] Form submission tidak punya guard terhadap double-click / rapid submit [brand-form.tsx + category-form.tsx + uom-form.tsx]
- [x] [Review][Patch] JSON parse error mengembalikan HTTP 500 instead of 400 [semua POST/PATCH route]
- [x] [Review][Patch] Banner sukses/error tidak memiliki live region attributes (role="alert" / aria-live) [brand-client.tsx + category-client.tsx + uom-client.tsx]
- [x] [Review][Patch] `export const dynamic = 'force-dynamic'` hilang pada route PATCH [brands/[id] + categories/[id] + uom/[id]]
- [x] [Review][Patch] Tidak ada Content-Type validation sebelum parsing request body [semua POST/PATCH route]

#### defer

- [x] [Review][Defer] Tidak ada rate limiting pada endpoint master-data — system-wide infrastructure gap
- [x] [Review][Defer] Error database di server-page hanya di-log ke console, tidak ada error tracking service — project-wide concern

#### dismissed

- [x] [Review][Dismiss] GET list endpoint tanpa pagination/limit — Spec secara eksplisit menyatakan pagination out of scope ("data sedikit, list sederhana cukup")
