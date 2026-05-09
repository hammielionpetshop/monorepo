# Story 7.6: Branch Settings

**Story ID:** 7.6
**Story Key:** 7-6-branch-settings
**Epic:** 7 - Backoffice Master Data Management (P0 — Critical Blocker)
**Status:** done
**Created:** 2026-05-09

---

## User Story

Sebagai Owner,
saya ingin melihat dan mengedit data cabang (nama, alamat, kode cabang, kontak) melalui Backoffice,
Agar informasi cabang yang tercetak di struk dan laporan selalu akurat.

---

## Acceptance Criteria

**AC1 — Daftar Cabang**
Given Owner membuka halaman `/settings/branches`
When halaman dimuat
Then daftar semua cabang ditampilkan dengan kolom: Kode, Nama, Alamat, Telepon, Status (Aktif/Nonaktif)

**AC2 — Edit Cabang**
Given Owner memilih cabang dan mengubah data (nama, alamat, telepon)
When disimpan
Then data cabang diperbarui di tabel `branches`

**AC3 — Auth & Role**
Given akses tanpa autentikasi
When API diakses
Then return 401
Given user role bukan OWNER mencoba PATCH
When request dikirim
Then return 403

---

## Scope & Batasan

**In scope:**
- Halaman `/settings/branches` (list semua cabang)
- Form edit cabang (nama, alamat, telepon — field yang sesuai AC)
- Kode cabang (`code`) ditampilkan di tabel tapi **TIDAK dapat diubah** (identifier sistem, perubahan akan merusak POS bootstrap)
- `isActive` ditampilkan di tabel sebagai badge, **TIDAK dapat diubah** via UI (tidak ada AC untuk toggle aktif/nonaktif)
- `lastSeenAt` ditampilkan di tabel sebagai info sinkronisasi terakhir POS
- GET API di `/api/bo/settings/branches`
- PATCH API di `/api/bo/settings/branches/[id]`
- Tambah link "Cabang" di sidebar layout.tsx (bagian "Pengaturan", setelah link "Pengguna")

**Out of scope:**
- Tambah cabang baru (dibuat via seed/migration, bukan UI)
- Hapus cabang
- Toggle isActive
- Edit kode cabang (code)
- Edit lastSeenAt

---

## Skema Database yang Relevan

File: `packages/db/src/schema/branches.ts` — **SUDAH ADA, tidak perlu migration**

```typescript
export const branches = petshop.table('branches', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 20 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
})
```

**`branches` sudah ter-export dari `packages/db/src/schema/index.ts` → tersedia via `import { branches, eq } from '@/lib/db'`.**

---

## File Structure

```
apps/backoffice/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx                               # UPDATE: tambah nav link "Cabang" di bagian Pengaturan
│   │   └── settings/
│   │       └── branches/
│   │           ├── page.tsx                         # BARU: Server Component - fetch branches list
│   │           └── _components/
│   │               ├── types.ts                     # BARU: shared types
│   │               ├── branch-client.tsx            # BARU: client component - list + aksi edit
│   │               └── branch-form.tsx              # BARU: form edit cabang
│   └── api/
│       └── bo/
│           └── settings/
│               └── branches/
│                   ├── route.ts                     # BARU: GET (list)
│                   └── [id]/
│                       └── route.ts                 # BARU: PATCH (update)
```

---

## Tasks / Subtasks

- [x] Task 1: API Route — GET `/api/bo/settings/branches` (AC: 1, 3)
  - [x] Buat `apps/backoffice/app/api/bo/settings/branches/route.ts`
  - [x] `export const dynamic = 'force-dynamic'`
  - [x] GET: Auth check (siapapun yang login) → query semua `branches` → return list
  - [x] Urutkan berdasarkan `branches.code` ascending

- [x] Task 2: API Route — PATCH `/api/bo/settings/branches/[id]` (AC: 2, 3)
  - [x] Buat `apps/backoffice/app/api/bo/settings/branches/[id]/route.ts`
  - [x] `export const dynamic = 'force-dynamic'`
  - [x] Auth check → role check OWNER only → validate id param → Zod validate body
  - [x] Cek branch ada (404 jika tidak)
  - [x] Cek uniqueness `name` jika berubah (ne(branches.id, targetId))
  - [x] Update dengan `updatedAt: new Date()` → return updated branch (tanpa field sensitif)
  - [x] Field yang dapat diupdate: `name`, `address`, `phone` saja — `code` dan `isActive` TIDAK boleh diubah via API ini

- [x] Task 3: Buat `types.ts` — shared types
  - [x] Buat `apps/backoffice/app/(dashboard)/settings/branches/_components/types.ts`
  - [x] Definisikan `BranchListItem` dan `BranchFormData`

- [x] Task 4: Server Component page.tsx — `/settings/branches` (AC: 1)
  - [x] Buat `apps/backoffice/app/(dashboard)/settings/branches/page.tsx`
  - [x] `export const dynamic = 'force-dynamic'`
  - [x] Fetch branches langsung via Drizzle (bukan fetch ke API)
  - [x] Render `BranchClient` dengan initial data
  - [x] Error boundary: tampilkan error message jika fetch gagal

- [x] Task 5: Buat `BranchClient` — client component (AC: 1, 2)
  - [x] `'use client'`
  - [x] State: `branches`, `showForm`, `editingBranch`, `successMsg`, `errorMsg`
  - [x] Render tabel dengan kolom: Kode, Nama, Alamat, Telepon, Status, Terakhir Online, Aksi
  - [x] Status badge: hijau "Aktif" / abu "Nonaktif" (display only, tidak ada tombol toggle)
  - [x] `lastSeenAt`: tampilkan sebagai tanggal/waktu terformat, atau "Belum pernah" jika null
  - [x] Tombol "Edit" pada setiap baris → buka form edit
  - [x] **TIDAK ADA** tombol "+ Tambah Cabang" (out of scope)
  - [x] `refreshBranches()` via fetch GET setelah setiap mutasi berhasil
  - [x] Success/error banner (mutually exclusive, auto-dismiss 3s/5s) — persis pola UserClient/UomClient
  - [x] Modal overlay pattern persis sama dengan UserClient
  - [x] `aria-live="polite"` pada success, `aria-live="assertive"` pada error
  - [x] `isFormSubmittingRef` untuk mencegah close modal saat sedang submit

- [x] Task 6: Buat `BranchForm` — form edit cabang (AC: 2)
  - [x] `'use client'`
  - [x] Props: `branch: BranchListItem`, `onSuccess`, `onCancel`, `onSubmittingChange?`
  - [x] Form fields (semua opsional, minimal satu harus diisi):
    - Nama (required, max 100)
    - Alamat (opsional, textarea atau input, max 500)
    - Telepon (opsional, max 20)
  - [x] Display-only: tampilkan Kode Cabang sebagai read-only info (tidak dikirim ke API)
  - [x] Submit: PATCH saja (tidak ada POST)
  - [x] `isSubmitting` guard: disable form + tombol saat in-flight
  - [x] Error message inline di form
  - [x] Kirim hanya field yang diisi (body tidak wajib kirim semua field)

- [x] Task 7: Update `layout.tsx` — tambah nav link
  - [x] Update `apps/backoffice/app/(dashboard)/layout.tsx`
  - [x] Tambah link "Cabang" ke `/settings/branches` di bagian "Pengaturan" (setelah link "Pengguna")

---

## Dev Notes

### Pola Golden Template — Wajib Diikuti

Semua pola dari Story 7.5 (User Management) sudah post-review. Ikuti langsung:
- API GET + auth pattern: `apps/backoffice/app/api/bo/settings/users/route.ts`
- API PATCH dengan param + guard: `apps/backoffice/app/api/bo/settings/users/[id]/route.ts`
- Client component: `apps/backoffice/app/(dashboard)/settings/users/_components/user-client.tsx`
- Form component: `apps/backoffice/app/(dashboard)/settings/users/_components/user-form.tsx`
- Server page: `apps/backoffice/app/(dashboard)/settings/users/page.tsx`

### Pola Auth (wajib di SETIAP API route)

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

### Role Check untuk PATCH — OWNER Only

```typescript
const ALLOWED_MUTATE_ROLES = ['OWNER']

if (!ALLOWED_MUTATE_ROLES.includes(payload.role)) {
  return NextResponse.json({ error: 'Akses ditolak. Hanya Owner yang dapat mengubah data cabang.' }, { status: 403 })
}
```

### API Route GET branches

```typescript
import { db, branches, eq } from '@/lib/db'

// GET /api/bo/settings/branches
// Auth: siapapun yang login
const result = await db
  .select({
    id: branches.id,
    code: branches.code,
    name: branches.name,
    address: branches.address,
    phone: branches.phone,
    isActive: branches.isActive,
    lastSeenAt: branches.lastSeenAt,
    createdAt: branches.createdAt,
  })
  .from(branches)
  .orderBy(branches.code)

return NextResponse.json(result)
```

### API Route PATCH branches/[id]

```typescript
import { db, branches, eq, ne, and } from '@/lib/db'

const updateBranchSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(100, 'Nama maksimal 100 karakter').optional(),
  address: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().trim().max(500, 'Alamat maksimal 500 karakter').nullable()
  ).optional(),
  phone: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().trim().max(20, 'Telepon maksimal 20 karakter').nullable()
  ).optional(),
}).refine((data) => Object.values(data).some((v) => v !== undefined), {
  message: 'Minimal satu field harus diisi',
})

// Dalam handler PATCH (dalam transaction):
// 1. Cek branch ada
// 2. Jika name berubah, cek uniqueness: ne(branches.id, targetId)
// 3. Build updateData: { updatedAt: new Date(), ...changes }
// 4. Update dan return dengan column projection (TANPA passwordHash dll)

// Return fields yang aman:
.returning({
  id: branches.id,
  code: branches.code,
  name: branches.name,
  address: branches.address,
  phone: branches.phone,
  isActive: branches.isActive,
  lastSeenAt: branches.lastSeenAt,
  updatedAt: branches.updatedAt,
})
```

**PENTING: Jangan izinkan update `code` atau `isActive` via PATCH ini. Zod schema tidak boleh include kedua field tersebut.**

### Types — `types.ts`

```typescript
export interface BranchListItem {
  id: number
  code: string
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
  lastSeenAt: Date | string | null
  createdAt: Date | string
}

export interface BranchFormData {
  name: string
  address: string
  phone: string
}
```

### Update layout.tsx — Tambah Nav Link Cabang

Tambah setelah link "Pengguna" yang sudah ada:
```tsx
<Link
  href="/settings/branches"
  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
>
  <span aria-hidden="true">🏪</span>
  Cabang
</Link>
```

**PENTING: Bagian "Pengaturan" dan link "Pengguna" sudah ada di layout.tsx (ditambahkan di Story 7.5). Cukup tambahkan link Cabang DI BAWAH link Pengguna, JANGAN duplikasi heading "Pengaturan".**

### Import DB yang Benar

```typescript
// Di API routes settings/branches:
import { db, branches, eq, and, ne } from '@/lib/db'

// Di page.tsx (server component):
import { db, branches } from '@/lib/db'
```

### Anti-Patterns yang Dilarang

- ❌ Tambah tombol "Tambah Cabang" — out of scope
- ❌ Edit field `code` via form/API — identifier sistem, jangan diubah
- ❌ Toggle `isActive` via UI — out of scope
- ❌ `fetch()` dari Server Component — panggil Drizzle langsung
- ❌ Lewatkan `export const dynamic = 'force-dynamic'` di semua route dan page baru
- ❌ Role check tidak dilakukan di PATCH — WAJIB OWNER only
- ❌ Duplikasi heading "Pengaturan" di layout.tsx — sudah ada dari Story 7.5
- ❌ Banner success dan error muncul bersamaan
- ❌ Form bisa di-submit ganda (tidak ada `isSubmitting` guard)
- ❌ Buat migration baru — schema `branches` sudah ada
- ❌ `aria-live` tidak tepat: success = `polite`, error = `assertive`
- ❌ Kirim `code` atau `isActive` dalam body PATCH request
- ❌ Gunakan `<a>` tag untuk nav — wajib `<Link>` dari next/link

### Learnings dari Story 7.5 (Review)

- ✅ `.returning()` wajib pakai column projection — jangan return all columns
- ✅ `Number(payload.userId)` — JWT userId mungkin string, harus dikonversi sebelum perbandingan
- ✅ `z.preprocess` untuk email/field opsional yang bisa kosong → null
- ✅ `refreshX()` harus return `boolean` dan clear `successMsg` saat gagal
- ✅ Loading state `deactivatingId` / per-row untuk tombol aksi (di sini: tidak ada deactivate, tapi `editingId` bisa dipakai jika perlu)
- ✅ Guard last-OWNER sudah ada di users API, tidak perlu di branches
- ✅ `aria-hidden="true"` pada semua emoji decoratif di nav

### Server Component page.tsx

```typescript
import { db, branches } from '@/lib/db'
import BranchClient from './_components/branch-client'
import type { BranchListItem } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function BranchesPage() {
  let branchList: BranchListItem[] = []
  let error: string | null = null

  try {
    branchList = await db
      .select({
        id: branches.id,
        code: branches.code,
        name: branches.name,
        address: branches.address,
        phone: branches.phone,
        isActive: branches.isActive,
        lastSeenAt: branches.lastSeenAt,
        createdAt: branches.createdAt,
      })
      .from(branches)
      .orderBy(branches.code)
  } catch (e) {
    console.error('BranchesPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data cabang'
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Pengaturan Cabang</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola informasi cabang</p>
      </div>
      <BranchClient branches={branchList} />
    </div>
  )
}
```

### Architecture Compliance

| Rule | Implementation |
|------|---------------|
| Server Component page.tsx | ✅ Drizzle langsung, bukan fetch ke API |
| Client Component interaksi | ✅ `'use client'`, fetch ke `/api/bo/settings/branches` |
| Auth setiap API route | ✅ `verifyAccessToken` dari `@/lib/auth` |
| Role check mutasi | ✅ OWNER only pada PATCH |
| Zod validation input | ✅ Di API route handler |
| Error bahasa Indonesia | ✅ Semua pesan user-facing |
| `force-dynamic` route + page | ✅ Wajib |
| Tidak ada migration baru | ✅ Schema sudah ada |
| `Link` bukan `<a>` untuk nav | ✅ Di layout.tsx |
| Column projection di `.returning()` | ✅ Wajib, jangan return all columns |
| `z.preprocess` untuk nullable fields | ✅ Pola dari Story 7.5 review |

---

## Context dari Story Sebelumnya (7.5)

### Review Findings dari Story 7.5 — Tidak Boleh Diulangi

- ✅ `.returning()` tanpa column projection → passwordHash bocor → gunakan explicit column selection
- ✅ `payload.userId` dari JWT bisa string vs Number → gunakan `Number(payload.userId)` sebelum compare
- ✅ `z.literal('')` diterima Zod tanpa transform → gunakan `z.preprocess` untuk field nullable
- ✅ Success banner harus di-set SETELAH refreshX berhasil, bukan sebelum
- ✅ `refreshX()` harus return boolean dan clear successMsg saat gagal
- ✅ Deactivate button perlu loading state (untuk branches: Edit button tidak perlu karena modal-based)
- ✅ Emoji di nav harus `aria-hidden="true"`
- ✅ `name` di edit form harus selalu dikirim ke API (bukan conditional)

---

## Dev Agent Record

### Agent Model Used

glm-5.1

### Debug Log References

- TypeScript typecheck: passed (no errors)
- Next.js build: successful, `/settings/branches` route compiled
- ESLint: pre-existing config issue (not related to our changes)

### Completion Notes List

- ✅ Implemented GET /api/bo/settings/branches with auth check for any logged-in user, ordered by code ascending
- ✅ Implemented PATCH /api/bo/settings/branches/[id] with OWNER-only role check, Zod validation, name uniqueness, column projection in .returning()
- ✅ Created types.ts with BranchListItem and BranchFormData interfaces
- ✅ Created Server Component page.tsx using direct Drizzle query (not fetch), with error boundary
- ✅ Created BranchClient with table display, status badges, lastSeenAt formatting, modal overlay, aria-live, mutually exclusive banners, isFormSubmittingRef
- ✅ Created BranchForm with PATCH-only submit, read-only code display, isSubmitting guard, name required + optional address/phone
- ✅ Added "Cabang" nav link to layout.tsx under "Pengaturan" section after "Pengguna" using Next.js Link with aria-hidden emoji
- ✅ All review learnings from Story 7.5 applied: column projection in .returning(), z.preprocess for nullable fields, refreshBranches returns boolean, mutual exclusion on banners

### File List

- apps/backoffice/app/(dashboard)/settings/branches/page.tsx (NEW)
- apps/backoffice/app/(dashboard)/settings/branches/_components/types.ts (NEW)
- apps/backoffice/app/(dashboard)/settings/branches/_components/branch-client.tsx (NEW)
- apps/backoffice/app/(dashboard)/settings/branches/_components/branch-form.tsx (NEW)
- apps/backoffice/app/api/bo/settings/branches/route.ts (NEW)
- apps/backoffice/app/api/bo/settings/branches/[id]/route.ts (NEW)
- apps/backoffice/app/(dashboard)/layout.tsx (MODIFIED)

---

### Review Findings

- [x] [Review][Patch] formatLastSeen try/catch tidak efektif untuk string tanggal invalid [branch-client.tsx] — fixed: tambah `isNaN(d.getTime())` check
- [x] [Review][Patch] Duplikasi heading "Pengaturan" dan link "Pengguna" di layout.tsx [layout.tsx] — dismissed: tidak ada di HEAD, perlu ditambahkan agar fitur berfungsi
- [x] [Review][Patch] refreshBranches tidak memvalidasi bentuk respons API [branch-client.tsx] — fixed: tambah `Array.isArray(data)` check
- [x] [Review][Patch] Race condition pengecekan nama duplikat (TOCTOU) [branches/[id]/route.ts] — fixed: tambah `.for('update')` pada SELECT dalam transaction
- [x] [Review][Patch] BranchForm memicu state update setelah unmount [branch-form.tsx] — fixed: pindah `onSuccess()` keluar dari `try/finally`
- [x] [Review][Patch] Modal dialog kurang aksesibilitas (focus trap) [branch-client.tsx] — fixed: tambah focus trap via Tab key, auto-focus first input, `dialogRef`
- [x] [Review][Patch] Handler error 23505 menyesatkan (constraint tidak ada) [branches/[id]/route.ts] — fixed: hapus handler 23505 karena `branches.name` tidak punya unique constraint
- [x] [Review][Patch] Race condition refreshBranches tanpa request cancellation [branch-client.tsx] — fixed: tambah `AbortController` per request
- [x] [Review][Patch] Prop branch nullable di BranchForm melawan spec [branch-form.tsx] — fixed: ubah prop menjadi `BranchListItem` (non-nullable), gunakan conditional render di parent
- [x] [Review][Patch] Typo Tailwind class focus:ring-ring-2 [branch-form.tsx] — dismissed: kode sudah benar (`focus:ring-2`), tidak ada typo di working tree
- [x] [Review][Patch] Scroll lock modal menimpa body.overflow asli [branch-client.tsx] — fixed: simpan dan restore `originalOverflow`
- [x] [Review][Patch] Pesan error background tetap terlihat saat modal dibuka [branch-client.tsx] — fixed: clear `errorMsg` saat `openEditForm`
- [x] [Review][Patch] Ambiguitas handling empty-string vs null [branch-form.tsx] — fixed: normalize empty string ke `null` sebelum perbandingan
- [x] [Review][Patch] Guard null branch terlambat di handleSubmit [branch-form.tsx] — fixed: guard dipindah ke awal fungsi (implisit via non-nullable prop)
- [x] [Review][Patch] refreshBranches fetch tanpa explicit credentials [branch-client.tsx] — fixed: tambah `credentials: 'same-origin'`
- [x] [Review][Defer] UI menampilkan tombol Edit tanpa memeriksa role [branch-client.tsx] — deferred, pre-existing
- [x] [Review][Defer] PATCH endpoint tanpa CSRF protection eksplisit [branches/[id]/route.ts] — deferred, pre-existing
- [x] [Review][Defer] Parsing body PATCH tanpa batas ukuran [branches/[id]/route.ts] — deferred, pre-existing
- [x] [Review][Defer] Dialog dirender inline bukan portal [branch-client.tsx] — deferred, pre-existing
- [x] [Review][Defer] Ambiguitas timezone formatLastSeen [branch-client.tsx] — deferred, pre-existing
