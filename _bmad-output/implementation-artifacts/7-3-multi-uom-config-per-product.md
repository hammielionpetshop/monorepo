# Story 7.3: Multi-UOM Config per Produk

**Story ID:** 7.3
**Story Key:** 7-3-multi-uom-config-per-product
**Epic:** 7 - Backoffice Master Data Management (P0 — Critical Blocker)
**Status:** done
**Created:** 2026-05-08

---

## User Story

Sebagai Admin/Owner,
saya ingin mengkonfigurasi konversi satuan (UOM) per produk di Backoffice,
Agar kasir dapat menjual produk dalam satuan yang berbeda (misal: Pcs, Lusin, Karton) dengan harga yang tepat.

---

## Acceptance Criteria

**AC1 — List View UOM Conversions**
Given Admin membuka halaman detail produk dan mengakses tab "Satuan"
When halaman dimuat
Then daftar UOM conversion yang sudah ada ditampilkan dengan kolom: UOM, Kode, Ratio, Berat (gram), Aksi

**AC2 — Tambah UOM Conversion**
Given Admin mengisi form UOM baru dengan ratio yang valid (> 0)
When form disubmit
Then entri tersimpan ke tabel `product_uom_conversions`
And entri baru muncul di daftar tanpa full page reload

**AC3 — Validasi Ratio 0 atau Negatif**
Given Admin mencoba menyimpan ratio 0 atau negatif
When form disubmit
Then error validasi "Ratio harus lebih dari 0" ditampilkan
And tidak ada perubahan di database

**AC4 — Validasi UOM Wajib**
Given Admin mencoba menyimpan tanpa memilih UOM
When form disubmit
Then error "UOM wajib dipilih" ditampilkan

**AC5 — Validasi Duplikat UOM**
Given Admin mencoba menambah UOM yang sudah ada di daftar konversi produk ini
When form disubmit
Then error "UOM ini sudah dikonfigurasi untuk produk ini" ditampilkan
And tidak ada perubahan di database

**AC6 — Hapus UOM Conversion**
Given Admin menekan tombol "Hapus" pada salah satu entri konversi
When dikonfirmasi
Then entri dihapus dari `product_uom_conversions`
And daftar terupdate

**AC7 — Auth**
Given akses tanpa autentikasi
When halaman atau API diakses
Then redirect ke `/login` atau return 401 (dihandle oleh DashboardLayout + API auth check)

---

## Scope & Batasan

- **In scope:**
  - Halaman detail produk `/master-data/products/[id]` dengan tab "Satuan"
  - List, tambah, dan hapus `productUomConversions`
  - Navigasi dari halaman daftar produk ke halaman detail (tombol "Detail" di tabel)
- **Out of scope:**
  - Edit konversi yang sudah ada (hapus + tambah ulang cukup untuk backoffice internal)
  - Validasi apakah UOM conversion memiliki entry harga (itu domain Story 7.4)
  - Delete produk (sudah di-soft-delete via isActive di Story 7.1)
  - Tab "Harga" (Story 7.4)
  - UOM yang sama dengan `baseUomId` produk BOLEH ditambahkan sebagai conversion jika admin ingin mendefinisikan ratio-nya — NAMUN, secara bisnis hal ini tidak berguna. Tampilkan peringatan ringan di form jika UOM dipilih sama dengan base UOM produk, tapi jangan blokir.

---

## Skema Database yang Relevan

File: `packages/db/src/schema/products.ts` — **SUDAH ADA, tidak perlu migration baru**

```typescript
export const productUomConversions = petshop.table('product_uom_conversions', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  uomId: integer('uom_id').references(() => unitsOfMeasure.id).notNull(),
  ratio: decimal('ratio', { precision: 10, scale: 2 }).notNull(), // 1 UOM ini = ratio * Base UOM
  weightGram: decimal('weight_gram', { precision: 10, scale: 2 }), // opsional, nullable
})
```

**Penting:**
- `ratio` adalah decimal string dari Drizzle (bukan number). Validasi nilai > 0 harus menggunakan **big.js**.
- `weightGram` nullable — form bisa kosong, kirim `null` ke API.
- Tidak ada unique constraint di level DB untuk `(productId, uomId)`. Cek duplikat WAJIB dilakukan di aplikasi level (dalam `db.transaction()`).
- `productUomConversions` sudah ter-export melalui `packages/db/src/schema/index.ts` → tersedia via `import { productUomConversions } from '@/lib/db'`.

Referensi tabel produk (untuk join di halaman detail):
```typescript
export const products = petshop.table('products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  sku: varchar('sku', { length: 50 }).unique(),
  baseUomId: integer('base_uom_id').references(() => unitsOfMeasure.id).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  // ... field lainnya
})
```

---

## File Structure

```
apps/backoffice/
├── app/
│   ├── (dashboard)/
│   │   └── master-data/
│   │       └── products/
│   │           ├── [id]/
│   │           │   ├── page.tsx                          # BARU: Product detail page (Server Component)
│   │           │   └── _components/
│   │           │       ├── uom-conversion-client.tsx     # BARU: List + form UOM conversions
│   │           │       └── uom-conversion-form.tsx       # BARU: Form tambah konversi
│   │           └── _components/
│   │               └── product-table.tsx                 # UPDATE: tambah tombol "Detail" per baris
│   └── api/
│       └── bo/
│           └── master-data/
│               └── products/
│                   └── [id]/
│                       ├── route.ts                      # EXISTING — jangan diubah
│                       └── uom-conversions/
│                           ├── route.ts                  # BARU: GET, POST
│                           └── [convId]/
│                               └── route.ts              # BARU: DELETE
```

---

## Tasks / Subtasks

- [x] Task 1: API Route — GET & POST `/api/bo/master-data/products/[id]/uom-conversions`
  - [x] Buat `apps/backoffice/app/api/bo/master-data/products/[id]/uom-conversions/route.ts`
  - [x] `export const dynamic = 'force-dynamic'`
  - [x] GET: Auth check → query `productUomConversions` WHERE `productId = id`, join `unitsOfMeasure` → return `{ id, uomId, uomCode, uomName, ratio, weightGram }[]`
  - [x] POST: Auth check → Zod validate body `{ uomId: number, ratio: string, weightGram?: string | null }` → big.js validate ratio > 0 → `db.transaction()` cek duplikat → insert → return 201

- [x] Task 2: API Route — DELETE `/api/bo/master-data/products/[id]/uom-conversions/[convId]`
  - [x] Buat `apps/backoffice/app/api/bo/master-data/products/[id]/uom-conversions/[convId]/route.ts`
  - [x] `export const dynamic = 'force-dynamic'`
  - [x] DELETE: Auth check → Zod validate params `{ id: /^\d+$/, convId: /^\d+$/ }` → cek entri ada + milik produk ini → delete → return 200

- [x] Task 3: Halaman Detail Produk — Server Component
  - [x] Buat `apps/backoffice/app/(dashboard)/master-data/products/[id]/page.tsx`
  - [x] Fetch data: product detail (join categories, brands, unitsOfMeasure) + semua UOM conversions (join unitsOfMeasure) + semua UOM (untuk dropdown form)
  - [x] Jika produk tidak ditemukan → `notFound()` dari `next/navigation`
  - [x] Render: header (nama produk + badge status) + back link ke `/master-data/products` + tab UI
  - [x] Tab "Satuan" aktif secara default (satu-satunya tab saat ini)
  - [x] Render `UomConversionClient` di dalam tab "Satuan"

- [x] Task 4: UOM Conversion Client Component
  - [x] Buat `apps/backoffice/app/(dashboard)/master-data/products/[id]/_components/uom-conversion-client.tsx`
  - [x] Props: `productId`, `initialConversions`, `availableUoms` (semua UOM dari DB), `baseUomId`
  - [x] Tabel: kolom UOM (nama + kode), Ratio, Berat (gram), Aksi (Hapus)
  - [x] Tombol "Tambah UOM" membuka form inline atau toggle visibility
  - [x] Hapus: `window.confirm()` → DELETE → refresh list
  - [x] Success/error banner dengan auto-dismiss (pattern dari Story 7.2)

- [x] Task 5: UOM Conversion Form Component
  - [x] Buat `apps/backoffice/app/(dashboard)/master-data/products/[id]/_components/uom-conversion-form.tsx`
  - [x] Fields: UOM (select dari availableUoms), Ratio (text input, wajib), Berat gram (text input, opsional)
  - [x] Client-side validation sebelum submit: ratio > 0 (big.js), uomId required
  - [x] Submit via `fetch` POST ke `/api/bo/master-data/products/[productId]/uom-conversions`
  - [x] Disable tombol Submit saat in-flight
  - [x] Tampilkan error dari API secara inline

- [x] Task 6: Update ProductTable — tambah tombol "Detail"
  - [x] Update `apps/backoffice/app/(dashboard)/master-data/products/_components/product-table.tsx`
  - [x] Import `Link` dari `next/link`
  - [x] Tambah link "Detail" di kolom Aksi sebelum tombol Edit
  - [x] Link mengarah ke `/master-data/products/${p.id}`

---

## Dev Notes

### Pola Golden Template — Wajib Diikuti

Ikuti pola yang SUDAH ada di codebase (post-review-patch dari Story 7.1 dan 7.2):
- API route GET/POST: `apps/backoffice/app/api/bo/master-data/products/route.ts`
- API route PATCH dengan param: `apps/backoffice/app/api/bo/master-data/products/[id]/route.ts`
- Client Component: `apps/backoffice/app/(dashboard)/master-data/products/_components/product-client.tsx`
- Form Component: `apps/backoffice/app/(dashboard)/master-data/products/_components/product-form.tsx`
- Server Component page: `apps/backoffice/app/(dashboard)/master-data/products/page.tsx`

### Pola Auth (wajib di setiap API route)

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

### API Route GET uom-conversions

```typescript
// GET /api/bo/master-data/products/[id]/uom-conversions
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { db, productUomConversions, unitsOfMeasure, products, eq } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Auth check
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })

    // 2. Validate id param
    const { id } = await params
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400 })
    const productId = Number(id)

    // 3. Cek produk ada
    const product = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1)
    if (product.length === 0) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })

    // 4. Query conversions dengan join UOM
    const result = await db
      .select({
        id: productUomConversions.id,
        uomId: productUomConversions.uomId,
        uomCode: unitsOfMeasure.code,
        uomName: unitsOfMeasure.name,
        ratio: productUomConversions.ratio,
        weightGram: productUomConversions.weightGram,
      })
      .from(productUomConversions)
      .leftJoin(unitsOfMeasure, eq(productUomConversions.uomId, unitsOfMeasure.id))
      .where(eq(productUomConversions.productId, productId))

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data konversi UOM' }, { status: 500 })
  }
}
```

### API Route POST uom-conversions — Validasi big.js + Duplikat dalam Transaction

```typescript
import Big from 'big.js'
import { z } from 'zod'

const createSchema = z.object({
  uomId: z.number().int().positive('UOM wajib dipilih'),
  ratio: z.string().min(1, 'Ratio wajib diisi'),
  weightGram: z.string().optional().nullable(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ... auth check + param validation ...

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
  }

  // Validasi ratio > 0 dengan big.js
  let ratioBig: Big
  try {
    ratioBig = new Big(parsed.data.ratio)
    if (ratioBig.lte(0)) throw new Error()
  } catch {
    return NextResponse.json({ error: 'Ratio harus lebih dari 0' }, { status: 400 })
  }

  // Validasi weightGram jika diisi
  if (parsed.data.weightGram) {
    try {
      const w = new Big(parsed.data.weightGram)
      if (w.lte(0)) throw new Error()
    } catch {
      return NextResponse.json({ error: 'Berat harus lebih dari 0' }, { status: 400 })
    }
  }

  const result = await db.transaction(async (trx) => {
    // Cek produk ada
    const product = await trx.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1)
    if (product.length === 0) throw new Error('NOT_FOUND')

    // Cek UOM ada
    const uom = await trx.select({ id: unitsOfMeasure.id }).from(unitsOfMeasure).where(eq(unitsOfMeasure.id, parsed.data.uomId)).limit(1)
    if (uom.length === 0) throw new Error('UOM tidak ditemukan')

    // Cek duplikat (uomId sudah ada untuk productId ini)
    const existing = await trx
      .select({ id: productUomConversions.id })
      .from(productUomConversions)
      .where(and(eq(productUomConversions.productId, productId), eq(productUomConversions.uomId, parsed.data.uomId)))
      .limit(1)
    if (existing.length > 0) throw new Error('DUPLICATE_UOM')

    return await trx.insert(productUomConversions).values({
      productId,
      uomId: parsed.data.uomId,
      ratio: ratioBig.toString(),
      weightGram: parsed.data.weightGram || null,
    }).returning()
  })
  // error handling: NOT_FOUND → 404, DUPLICATE_UOM → 409, UOM tidak ditemukan → 400
}
```

### API Route DELETE uom-conversions/[convId]

```typescript
// DELETE /api/bo/master-data/products/[id]/uom-conversions/[convId]
// Wajib validasi KEDUANYA: convId ada AND convId.productId === id
// Untuk mencegah delete konversi produk lain via URL manipulation

const existing = await db
  .select({ id: productUomConversions.id, productId: productUomConversions.productId })
  .from(productUomConversions)
  .where(eq(productUomConversions.id, convId))
  .limit(1)

if (existing.length === 0) return NOT_FOUND
if (existing[0].productId !== productId) return 404  // tidak boleh delete milik produk lain
```

### Halaman Detail Produk — Server Component

```typescript
// apps/backoffice/app/(dashboard)/master-data/products/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db, products, categories, brands, unitsOfMeasure, productUomConversions, eq } from '@/lib/db'
import UomConversionClient from './_components/uom-conversion-client'

export const dynamic = 'force-dynamic'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const productId = Number(id)

  // Fetch produk + join
  const [productResult, conversions, allUoms] = await Promise.all([
    db.select({ /* ... */ }).from(products).leftJoin(...).where(eq(products.id, productId)).limit(1),
    db.select({ id: productUomConversions.id, uomId: productUomConversions.uomId, uomCode: unitsOfMeasure.code, uomName: unitsOfMeasure.name, ratio: productUomConversions.ratio, weightGram: productUomConversions.weightGram })
      .from(productUomConversions)
      .leftJoin(unitsOfMeasure, eq(productUomConversions.uomId, unitsOfMeasure.id))
      .where(eq(productUomConversions.productId, productId)),
    db.select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code, name: unitsOfMeasure.name }).from(unitsOfMeasure).orderBy(unitsOfMeasure.name),
  ])

  if (productResult.length === 0) notFound()
  const product = productResult[0]

  return (
    <div className="p-6">
      {/* Back link */}
      <Link href="/master-data/products" className="...">← Kembali ke Daftar Produk</Link>

      {/* Header */}
      <h1>{product.name}</h1>
      <span>{product.isActive ? 'Aktif' : 'Nonaktif'}</span>

      {/* Tab UI — sederhana, client-side, hanya 1 tab untuk sekarang */}
      {/* Tab: Satuan (aktif) */}
      <UomConversionClient
        productId={productId}
        initialConversions={conversions}
        availableUoms={allUoms}
        baseUomId={product.baseUomId}
      />
    </div>
  )
}
```

### UomConversionClient — State Pattern

Ikuti pattern dari `product-client.tsx` yang sudah post-review-patch:
- `successMsg` dan `errorMsg` TIDAK boleh tampil bersamaan (hanya satu pada satu waktu)
- `clearTimeout` cleanup di `useEffect` untuk success message auto-dismiss (3 detik)
- Tombol submit disable saat `isSubmitting = true`
- Error API ditampilkan inline, bukan `alert()`
- `aria-live="polite"` pada banner success/error

```typescript
'use client'
import { useState, useEffect } from 'react'
import { UomConversionForm } from './uom-conversion-form'
import type { UomConversion, UomOption } from './types'  // buat types.ts jika diperlukan

interface Props {
  productId: number
  initialConversions: UomConversion[]
  availableUoms: UomOption[]
  baseUomId: number
}

export default function UomConversionClient({ productId, initialConversions, availableUoms, baseUomId }: Props) {
  const [conversions, setConversions] = useState(initialConversions)
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 3000)
    return () => clearTimeout(t)
  }, [successMsg])

  async function refreshConversions() {
    const res = await fetch(`/api/bo/master-data/products/${productId}/uom-conversions`)
    if (!res.ok) { setErrorMsg('Gagal memperbarui daftar konversi'); return }
    setConversions(await res.json())
  }

  async function handleDelete(convId: number) {
    if (!window.confirm('Hapus konversi UOM ini?')) return
    setDeletingId(convId)
    try {
      const res = await fetch(`/api/bo/master-data/products/${productId}/uom-conversions/${convId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setErrorMsg(data.error ?? 'Gagal menghapus konversi')
        setSuccessMsg(null)
      } else {
        setSuccessMsg('Konversi UOM berhasil dihapus')
        setErrorMsg(null)
        await refreshConversions()
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan')
      setSuccessMsg(null)
    } finally {
      setDeletingId(null)
    }
  }

  // ... render tabel + form
}
```

### UomConversionForm — Validasi Client-Side dengan big.js

```typescript
'use client'
import Big from 'big.js'

// Sebelum fetch ke API, validasi ratio di client terlebih dahulu:
let ratioBig: Big
try {
  ratioBig = new Big(ratio)
  if (ratioBig.lte(0)) throw new Error()
} catch {
  setError('Ratio harus lebih dari 0')
  return
}
```

### Update product-table.tsx — Tambah Tombol "Detail"

```typescript
import Link from 'next/link'

// Di dalam baris tabel, di kolom Aksi, SEBELUM tombol Edit:
<Link
  href={`/master-data/products/${p.id}`}
  className="px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors"
>
  Detail
</Link>
```

**PENTING:** Gunakan `<Link>` dari `next/link`, BUKAN `<a>` tag — konsisten dengan anti-pattern rules seluruh project.

### Import DB yang Benar

```typescript
// Di API routes:
import { db, products, productUomConversions, unitsOfMeasure, eq, and } from '@/lib/db'

// Di Server Component page.tsx:
import { db, products, categories, brands, unitsOfMeasure, productUomConversions, eq } from '@/lib/db'
```

`productUomConversions` sudah tersedia via `@/lib/db` karena `@petshop/db` me-re-export semua dari `packages/db/src/schema/index.ts`.

### Jangan Lupa big.js di API Route

`ratio` adalah `decimal` field — Drizzle menerima input `string`. Gunakan big.js untuk validasi nilai, lalu simpan sebagai `ratioBig.toString()` ke database.

```typescript
import Big from 'big.js'
```

`big.js` sudah ada sebagai dependency di monorepo (digunakan di laporan dan stock adjustment). Verifikasi dengan `grep -r "from 'big.js'"` di `apps/backoffice` — jika belum ada, tambahkan ke `apps/backoffice/package.json`.

### Anti-Patterns yang Dilarang

- ❌ Gunakan `<a>` tag untuk navigasi — WAJIB `<Link>` dari next/link
- ❌ Kalkulasi ratio dengan JS native number — wajib **big.js**
- ❌ Cek duplikat UOM di luar `db.transaction()` — race condition
- ❌ `fetch()` ke API route dari Server Component — panggil Drizzle langsung di page.tsx
- ❌ `alert()` untuk error — tampilkan inline
- ❌ Lewatkan `export const dynamic = 'force-dynamic'` di API routes
- ❌ `ratio` disimpan sebagai JS number ke DB — harus `string` (Drizzle decimal)
- ❌ Delete tanpa verifikasi `convId.productId === productId` — security: URL manipulation
- ❌ Buat migration baru — schema `product_uom_conversions` sudah ada

### Architecture Compliance

| Rule | Implementation |
|------|---------------|
| Server Component page.tsx | ✅ Drizzle langsung, bukan fetch ke API |
| Client Component interaksi | ✅ `'use client'`, fetch ke API route |
| Auth setiap API route | ✅ `verifyAccessToken` dari `@/lib/auth` |
| Zod validation input | ✅ Di API route handler |
| big.js untuk decimal | ✅ Validasi ratio > 0 |
| Atomic cek duplikat | ✅ `db.transaction()` |
| Error bahasa Indonesia | ✅ Semua pesan user-facing |
| `force-dynamic` API routes | ✅ Semua route baru |
| `<Link>` bukan `<a>` | ✅ Di product-table dan back link |
| Tidak ada migration baru | ✅ Schema sudah ada |
| Security: cross-product delete check | ✅ Verifikasi productId di DELETE handler |

### Urutan Implementasi yang Disarankan

1. **Task 1** — API route GET + POST uom-conversions (core backend)
2. **Task 2** — API route DELETE (core backend)
3. **Task 3** — Halaman detail produk Server Component (page.tsx)
4. **Task 4** — UomConversionClient (orchestrator)
5. **Task 5** — UomConversionForm (form)
6. **Task 6** — Update ProductTable + tambah Link "Detail"

Test manual setelah Task 2 selesai: curl/Postman ke API routes untuk verifikasi GET, POST, DELETE sebelum lanjut ke UI.

---

## Context dari Story Sebelumnya (7.2)

### Review Findings yang Sudah Dilakukan dan Jangan Diulangi

Story 7.2 berhasil ditemukan beberapa pola yang harus diikuti:
- ✅ Race condition pada duplikat: gunakan `db.transaction()` dengan lock baca sebelum insert
- ✅ `export const dynamic = 'force-dynamic'` di SEMUA API routes (termasuk PATCH routes)
- ✅ `aria-labelledby` pada modal dialog
- ✅ `aria-live="polite"` pada success/error banner
- ✅ Banner sukses dan error TIDAK bisa muncul bersamaan (mutually exclusive)
- ✅ Form tidak bisa disubmit ganda via keyboard saat in-flight (`isSubmitting` state)

### Pola yang Sudah Teruji (Post-Review Story 7.1 & 7.2)

Seluruh pola API route dan Client Component di Story 7.1 dan 7.2 sudah melewati code review.
Dev agent **WAJIB** mengacu pada implementasi yang ada sebagai referensi — jangan reinvent.

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log

- TypeScript check (`tsc --noEmit`) lulus tanpa error pada semua file baru.
- Build Next.js sukses — `/master-data/products/[id]` terdaftar sebagai dynamic route.
- `big.js` sudah tersedia sebagai dependency di `apps/backoffice` (dipakai di reports dan retur).
- `productUomConversions` tersedia via `@/lib/db` (re-export dari `@petshop/db`).
- DELETE handler memverifikasi `convId.productId === productId` untuk cegah URL manipulation.

### Completion Notes

Implementasi Story 7.3 selesai. Semua 6 task terpenuhi:

- **API GET + POST** (`/api/bo/master-data/products/[id]/uom-conversions`): Auth check, Zod validate, big.js ratio validation, duplikat check dalam `db.transaction()`, insert + return 201.
- **API DELETE** (`/api/bo/master-data/products/[id]/uom-conversions/[convId]`): Auth check, validasi params, security check bahwa convId milik productId yang diminta, delete.
- **Server Component** (`/master-data/products/[id]/page.tsx`): Fetch paralel (product detail + conversions + all UOMs), `notFound()` untuk produk tidak ada, info ringkas produk, tab "Satuan".
- **UomConversionClient**: State management list + form visibility + delete, success/error banner mutually exclusive dengan auto-dismiss 3 detik.
- **UomConversionForm**: Client-side validation big.js sebelum fetch, isSubmitting guard, inline error, UOM yang sudah dikonfigurasi di-disable di select.
- **ProductTable update**: Tambah `<Link>` "Detail" sebelum tombol Edit menggunakan `next/link`.

---

## File List

**Baru (dibuat):**
- `apps/backoffice/app/api/bo/master-data/products/[id]/uom-conversions/route.ts`
- `apps/backoffice/app/api/bo/master-data/products/[id]/uom-conversions/[convId]/route.ts`
- `apps/backoffice/app/(dashboard)/master-data/products/[id]/page.tsx`
- `apps/backoffice/app/(dashboard)/master-data/products/[id]/_components/uom-conversion-client.tsx`
- `apps/backoffice/app/(dashboard)/master-data/products/[id]/_components/uom-conversion-form.tsx`

**Dimodifikasi:**
- `apps/backoffice/app/(dashboard)/master-data/products/_components/product-table.tsx` — tambah tombol/link "Detail"

---

## Change Log

- 2026-05-08: Story 7.3 dibuat — Multi-UOM Config per Produk
- 2026-05-08: Implementasi selesai — 5 file baru + 1 file dimodifikasi. API GET/POST/DELETE uom-conversions, halaman detail produk, UomConversionClient, UomConversionForm, update ProductTable.
- 2026-05-09: Code review round 1 — 0 decision-needed, 2 patch, 5 defer, 4 dismissed. Semua patch diterapkan. Status → done.

---

### Review Findings (2026-05-09 — Round 1)

**decision-needed:** 0 | **patch:** 2 | **defer:** 5 | **dismissed:** 4

#### decision-needed
*(tidak ada)*

#### patch

- [x] [Review][Patch] POST dan DELETE routes tidak ada OWNER/GM role check — semua user terautentikasi bisa create/delete konversi [apps/backoffice/app/api/bo/master-data/products/[id]/uom-conversions/route.ts + [convId]/route.ts] — **PATCHED 2026-05-09**: tambah `ALLOWED_MUTATE_ROLES = ['OWNER', 'GM']` check setelah auth check di POST dan DELETE
- [x] [Review][Patch] `notFound()` dipanggil di dalam blok `try/catch` di `page.tsx` — Next.js NEXT_NOT_FOUND error tertangkap oleh catch, produk tidak ditemukan menampilkan error banner bukan 404 [apps/backoffice/app/(dashboard)/master-data/products/[id]/page.tsx] — **PATCHED 2026-05-09**: restructure page.tsx — fetch productResult di luar try/catch, lalu panggil notFound() sebelum try/catch untuk conversions/allUoms

#### defer

- [x] [Review][Defer] Race condition: dua POST concurrent untuk (productId, uomId) yang sama bisa melewati duplicate check — tidak ada DB unique constraint sebagai safety net [uom-conversions/route.ts] — deferred, known design decision per spec ("tidak ada unique constraint di level DB")
- [x] [Review][Defer] `weightGram` tidak di-normalize via Big.js di client sebelum dikirim ke server — server menanganinya, konsistensi saja [uom-conversion-form.tsx] — deferred, server-side validation cukup
- [x] [Review][Defer] Tidak ada CSRF protection pada POST/DELETE routes — deferred, codebase-wide gap pre-existing
- [x] [Review][Defer] Produk soft-deleted (isActive=false) masih bisa diakses di halaman detail dan ditambah konversi [page.tsx + route.ts] — deferred, design decision tidak ada filter
- [x] [Review][Defer] DELETE ownership check + delete dalam 2 query terpisah (bukan transaction) — TOCTOU teoretis [convId/route.ts] — deferred, theoretical (productId tidak bisa di-update)

#### dismissed

- `window.confirm()` untuk delete — spec Dev Notes secara eksplisit mengizinkan pattern ini
- Same uomId as baseUomId tidak di-blokir server-side — spec eksplisit: "jangan blokir, tampilkan peringatan saja"
- `product.baseUomId` nullable concern — schema `.notNull()` menjamin non-null, bukan bug
- `refreshConversions` response tidak di-type-guard — `res.ok` check sudah cukup sebagai guard
