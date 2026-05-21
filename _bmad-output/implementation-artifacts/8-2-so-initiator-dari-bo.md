# Story 8.2: SO Initiator dari BO

**Story ID:** 8.2
**Story Key:** 8-2-so-initiator-dari-bo
**Epic:** 8 - Backoffice Operational Quick Wins (P1 — Backend Ready)
**Status:** done
**Created:** 2026-05-10

---

## User Story

Sebagai Owner/Manager,
saya ingin memulai Stock Opname Besar dari Backoffice (pilih kategori, cabang, petugas yang ditugaskan),
Agar SO Besar dapat diinisiasi secara terpusat tanpa harus datang langsung ke toko.

---

## Acceptance Criteria

**AC1 — Form Inisiasi SO Besar**
Given Owner membuka form "Mulai SO Besar" di Backoffice
When form dimuat
Then form menampilkan field: Cabang (wajib, select), Kategori Produk (opsional, multi-select), Petugas Ditugaskan (opsional, multi-select), Catatan (opsional, textarea)

**AC2 — Submit Berhasil**
Given Owner mengisi Cabang (wajib) dan menekan "Mulai"
When dikonfirmasi
Then API `POST /api/bo/stock-opnames` dipanggil dengan payload yang valid
And SO Besar berstatus PENDING terbuat di database
And pengguna diarahkan kembali ke halaman `/inventory/stock-opname` dengan pesan sukses

**AC3 — Validasi Cabang Wajib**
Given Owner tidak memilih Cabang
When menekan "Mulai"
Then tombol submit tidak aktif atau error "Cabang wajib dipilih" ditampilkan

**AC4 — Auth & Role**
Given akses tanpa autentikasi
When API POST diakses
Then return 401
Given user role bukan OWNER/MANAGER
When request dikirim
Then return 403

---

## Scope & Batasan

**In scope:**
- Halaman form `/inventory/stock-opname/new` (Server Component + Client Component)
- Tombol "Mulai SO Besar" di halaman `/inventory/stock-opname` yang mengarah ke `/inventory/stock-opname/new`
- Fix `POST /api/bo/stock-opnames/route.ts` — tambahkan auth check, role check, Zod validation, Bahasa Indonesia error messages
- `createdById` diambil dari JWT payload (`payload.userId`), BUKAN dari form input user
- Fetch data untuk form: daftar branches aktif, daftar users aktif, daftar categories dari DB langsung di server component
- Setelah submit berhasil: redirect ke `/inventory/stock-opname?success=1`
- Halaman SO list (`page.tsx`) menampilkan banner sukses jika URL param `?success=1` ada

**Out of scope:**
- Detail item SO / manajemen item per produk
- Pemilihan method SO (BEST_SELLER, SOLD_TODAY, MANUAL) — gunakan default FULL
- Edit / cancel SO yang sudah dibuat
- Notifikasi real-time ke POS

---

## Skema Database yang Relevan

**Tabel utama:** `stock_opnames` — `packages/db/src/schema/stock_opnames.ts`

```typescript
// Field yang relevan untuk story ini:
{
  soNumber: varchar(50).notNull().unique(),  // auto-generated
  branchId: integer.notNull(),               // dari form select
  type: varchar(20).notNull(),               // selalu 'FULL'
  status: varchar(20).default('PENDING'),    // selalu 'PENDING' saat create
  categoryScope: jsonb,                      // number[] — array of category IDs, atau null jika semua kategori
  assignedUserIds: jsonb,                    // number[] — array of user IDs, atau null
  createdById: integer.notNull(),            // dari JWT payload.userId
  notes: text,                               // dari form textarea
}
```

**Tabel lookup untuk form:**
```typescript
// packages/db/src/schema/branches.ts
branches: { id, name, code, isActive }

// packages/db/src/schema/users.ts
users: { id, name, staffNumber, roleId, branchId, isActive }

// packages/db/src/schema/master.ts
categories: { id, name }
```

---

## Dev Notes & Guardrails

### File Baru yang Harus Dibuat

```
apps/backoffice/app/(dashboard)/inventory/stock-opname/new/
  page.tsx                                  ← Server Component: fetch data + render form
  _components/
    so-initiator-client.tsx                 ← Client Component: form UI + submit logic
```

### File yang Dimodifikasi

```
apps/backoffice/app/api/bo/stock-opnames/route.ts
  ← FIX: tambah auth check + role check + Zod validation + BI error messages
  ← UBAH: createdById dari JWT, bukan dari body

apps/backoffice/app/(dashboard)/inventory/stock-opname/page.tsx
  ← Tambah tombol link "Mulai SO Besar" dan handler success param
```

### CRITICAL: Fix API Route — Prioritas Tinggi

`POST /api/bo/stock-opnames/route.ts` saat ini TIDAK memiliki auth check. Ini harus diperbaiki sebagai bagian dari story ini. Pola yang benar:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, stockOpnames } from '@/lib/db'

export const dynamic = 'force-dynamic'

const createSOSchema = z.object({
  branchId: z.number().int().positive('Cabang wajib dipilih'),
  categoryScope: z.array(z.number().int().positive()).optional().nullable(),
  assignedUserIds: z.array(z.number().int().positive()).optional().nullable(),
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter').optional().nullable(),
})

function generateSONumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `SO-FULL-${dateStr}-${random}`
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    if (payload.role !== 'OWNER' && payload.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Hanya Owner atau Manager yang dapat membuat Stock Opname' }, { status: 403 })
    }

    const userId = Number(payload.userId)
    if (Number.isNaN(userId)) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = createSOSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? 'Data tidak valid'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { branchId, categoryScope, assignedUserIds, notes } = parsed.data

    const [header] = await db.insert(stockOpnames).values({
      soNumber: generateSONumber(),
      branchId,
      type: 'FULL',
      status: 'PENDING',
      createdById: userId,                        // SELALU dari JWT, bukan dari body
      categoryScope: categoryScope ?? null,
      assignedUserIds: assignedUserIds ?? null,
      notes: notes ?? null,
    }).returning({ id: stockOpnames.id, soNumber: stockOpnames.soNumber })

    return NextResponse.json({ success: true, so: header }, { status: 201 })
  } catch (error: unknown) {
    console.error('POST /api/bo/stock-opnames error:', error)
    return NextResponse.json({ error: 'Gagal membuat stock opname, silakan coba lagi' }, { status: 500 })
  }
}
```

> **Penting:** `createdById` HARUS diambil dari `payload.userId` (JWT), bukan dari body request. API lama mengambil dari body (`createdById`) yang adalah security vulnerability.

### Server Component: new/page.tsx

Fetch semua data yang dibutuhkan form sekaligus dari DB, pass ke client component:

```typescript
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { db, branches, users, categories, eq, and } from '@/lib/db'
import SOInitiatorClient from './_components/so-initiator-client'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export interface BranchOption { id: number; name: string }
export interface UserOption   { id: number; name: string; staffNumber: string | null }
export interface CategoryOption { id: number; name: string }

export default async function NewStockOpnamePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload) redirect('/login')
  if (payload.role !== 'OWNER' && payload.role !== 'MANAGER') redirect('/inventory/stock-opname')

  // Fetch branches, users aktif, categories secara paralel
  const [branchList, userList, categoryList] = await Promise.all([
    db.select({ id: branches.id, name: branches.name })
      .from(branches)
      .orderBy(branches.name),

    db.select({ id: users.id, name: users.name, staffNumber: users.staffNumber })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(users.name),

    db.select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(categories.name),
  ])

  return (
    <div className="p-6 max-w-xl">
      <div className="mb-6">
        <a href="/inventory/stock-opname" className="text-sm text-muted-foreground hover:underline">
          ← Kembali ke Stock Opname
        </a>
      </div>
      <h1 className="text-xl font-semibold text-foreground mb-1">Mulai SO Besar</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Inisiasi Stock Opname Besar dari Backoffice. SO akan muncul di POS cabang yang dipilih.
      </p>
      <SOInitiatorClient
        branches={branchList}
        users={userList}
        categories={categoryList}
      />
    </div>
  )
}
```

### Client Component: so-initiator-client.tsx

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BranchOption, UserOption, CategoryOption } from '../page'

interface Props {
  branches: BranchOption[]
  users: UserOption[]
  categories: CategoryOption[]
}

export default function SOInitiatorClient({ branches, users, categories }: Props) {
  const router = useRouter()
  const [branchId, setBranchId] = useState<string>('')
  const [selectedCategories, setSelectedCategories] = useState<number[]>([])
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function toggleCategory(id: number) {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  function toggleUser(id: number) {
    setSelectedUsers(prev =>
      prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!branchId) return

    if (!window.confirm('Mulai Stock Opname Besar? SO akan muncul di POS cabang yang dipilih.')) return

    setSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/bo/stock-opnames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: Number(branchId),
          categoryScope: selectedCategories.length > 0 ? selectedCategories : null,
          assignedUserIds: selectedUsers.length > 0 ? selectedUsers : null,
          notes: notes.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? `Gagal membuat SO (${res.status})`)
        return
      }

      router.push('/inventory/stock-opname?success=1')
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      {/* Cabang — wajib */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Cabang <span className="text-destructive">*</span>
        </label>
        <select
          value={branchId}
          onChange={e => setBranchId(e.target.value)}
          required
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">-- Pilih Cabang --</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Kategori Produk — opsional (multi-checkbox) */}
      {categories.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Kategori Produk <span className="text-muted-foreground text-xs">(kosongkan = semua kategori)</span>
          </label>
          <div className="border border-input rounded-md p-3 max-h-48 overflow-y-auto space-y-1">
            {categories.map(c => (
              <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(c.id)}
                  onChange={() => toggleCategory(c.id)}
                  className="rounded"
                />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Petugas Ditugaskan — opsional (multi-checkbox) */}
      {users.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Petugas Ditugaskan <span className="text-muted-foreground text-xs">(opsional)</span>
          </label>
          <div className="border border-input rounded-md p-3 max-h-48 overflow-y-auto space-y-1">
            {users.map(u => (
              <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(u.id)}
                  onChange={() => toggleUser(u.id)}
                  className="rounded"
                />
                {u.name}{u.staffNumber ? ` (${u.staffNumber})` : ''}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Catatan — opsional */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Catatan <span className="text-muted-foreground text-xs">(opsional)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Catatan tambahan untuk SO ini..."
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !branchId}
          className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Membuat SO...' : 'Mulai SO Besar'}
        </button>
        <a
          href="/inventory/stock-opname"
          className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
        >
          Batal
        </a>
      </div>
    </form>
  )
}
```

### Modifikasi page.tsx SO List — Tambah Tombol + Success Banner

Di `apps/backoffice/app/(dashboard)/inventory/stock-opname/page.tsx`, tambahkan:

```typescript
// Tambahkan di signature fungsi — searchParams untuk success param
export default async function StockOpnamePage({
  searchParams,
}: {
  searchParams?: { success?: string }
}) {
  const showSuccess = searchParams?.success === '1'
  // ... existing fetch logic ...

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-foreground">Stock Opname — Persetujuan</h1>
        <a
          href="/inventory/stock-opname/new"
          className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          + Mulai SO Besar
        </a>
      </div>
      <p className="text-sm text-muted-foreground mb-4">...</p>

      {showSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm mb-4">
          Stock Opname Besar berhasil dibuat dan kini menunggu persetujuan.
        </div>
      )}

      <SOClient initialData={soList} />
    </div>
  )
}
```

### Import yang Benar

```typescript
// di new/page.tsx — gunakan import yang sudah ada di @/lib/db
import { db, branches, users, categories, eq } from '@/lib/db'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
```

> **Cek apakah `categories` sudah ter-export dari `@/lib/db`** — buka `packages/db/src/schema/index.ts` dan periksa. Jika belum, tambahkan export: `export * from './master'` (biasanya sudah ada).

### Catatan Kritis

1. **`force-dynamic`** wajib di `new/page.tsx` (ada cookie read)
2. **Redirect role guard di server component**: jika bukan OWNER/MANAGER, redirect ke `/inventory/stock-opname` (jangan render form)
3. **`createdById` dari JWT** — jangan pernah terima `createdById` dari body request (security fix)
4. **Tidak ada migration baru** — skema sudah ada, hanya fix API dan tambah UI
5. **`router.push('/inventory/stock-opname?success=1')`** — pakai push bukan replace agar back button berfungsi intuitif; success banner di SO list hanya muncul satu kali (URL param akan hilang setelah navigasi)
6. **Branches**: tidak ada filter `isActive` di schema — fetch semua cabang (pre-existing; jika perlu filter, cek apakah ada field tersebut di branches table terlebih dahulu)

### Learnings dari Story 8.1

- Pattern `SOClient` (state management, AbortController, router.refresh()) sudah establish — ikuti untuk SOInitiatorClient
- `Number.isNaN(Number(payload.userId))` — guard NaN sebelum insert
- Error sentinel string pattern (`'DUPLICATE_SO'`) jika diperlukan — tapi untuk CREATE ini tidak perlu
- `db.transaction()` tidak diperlukan di sini (single INSERT)
- Seluruh pesan error dalam **Bahasa Indonesia**

---

## Tasks / Subtasks

- [x] **Task 1: Fix `POST /api/bo/stock-opnames/route.ts`**
  - [x] 1.1 Tambah `cookies()` + `verifyAccessToken` auth check → 401 jika tidak ada token
  - [x] 1.2 Role check: hanya OWNER/MANAGER → 403 jika role lain
  - [x] 1.3 Tambah Zod schema `createSOSchema` untuk validasi body
  - [x] 1.4 Ambil `createdById` dari `payload.userId` (bukan dari body)
  - [x] 1.5 Ganti semua error message ke Bahasa Indonesia
  - [x] 1.6 Guard `Number.isNaN` pada userId dari payload

- [x] **Task 2: Server Component `new/page.tsx`**
  - [x] 2.1 Auth check + redirect jika tidak login
  - [x] 2.2 Role check + redirect ke SO list jika bukan OWNER/MANAGER
  - [x] 2.3 Fetch branches, users aktif, categories secara paralel (`Promise.all`)
  - [x] 2.4 `export const dynamic = 'force-dynamic'`
  - [x] 2.5 Render `SOInitiatorClient` dengan props branches, users, categories

- [x] **Task 3: Client Component `so-initiator-client.tsx`**
  - [x] 3.1 Form: Cabang select (wajib), Kategori multi-checkbox, Petugas multi-checkbox, Catatan textarea
  - [x] 3.2 Submit disabled jika `!branchId`
  - [x] 3.3 `window.confirm()` sebelum submit
  - [x] 3.4 Fetch `POST /api/bo/stock-opnames` dengan payload yang benar
  - [x] 3.5 Loading state (`submitting`) — disable form saat request in-flight
  - [x] 3.6 Error banner jika API gagal
  - [x] 3.7 `router.push('/inventory/stock-opname?success=1')` setelah berhasil

- [x] **Task 4: Modifikasi `page.tsx` SO List**
  - [x] 4.1 Tambah `searchParams` prop untuk deteksi `?success=1`
  - [x] 4.2 Tambah header section dengan tombol "Mulai SO Besar" link ke `/inventory/stock-opname/new`
  - [x] 4.3 Render success banner jika `showSuccess === true`

### Review Findings

**Decision Needed (butuh keputusan kamu):**
- [x] [Review][Decision] DN1: Cross-branch auth — resolved: OWNER boleh cross-branch, MANAGER dibatasi cabang sendiri. Fixed: branch check di approve & reject route [`[id]/approve/route.ts`, `[id]/reject/route.ts`]
- [x] [Review][Decision] DN2: Multiple PENDING per branch — resolved: blokir. Fixed: cek existing PENDING sebelum INSERT → 409 [`route.ts`]
- [x] [Review][Decision] DN3: Approval SO kosong — resolved: blokir. Fixed: `items.length === 0` → 400 [`[id]/approve/route.ts`]
- [x] [Review][Decision] DN4: Field Kategori/Petugas conditional — resolved: dismiss, UX OK
- [x] [Review][Decision] DN5: Semua user exposed — resolved: defer, show all valid; filter by branch nanti

**Patches (perlu diperbaiki):**
- [x] [Review][Patch] P1: `varianceQty` null/NaN coercion di approve — fixed: null/undefined skip, NaN guard ditambahkan [`[id]/approve/route.ts:72`]
- [x] [Review][Patch] P2: `page.tsx` SO list tidak ada auth check — fixed: tambah `verifyAccessToken` + `redirect('/login')` [`page.tsx`]
- [x] [Review][Patch] P3: `abortRef` di-share antara approve dan reject — fixed: pisah ke `approveAbortRef` dan `rejectAbortRef` [`so-client.tsx`]
- [x] [Review][Patch] P4: `systemQty`/`physicalQty` null crash `Big()` — fixed: null guard sebelum `applySOStockAdjustment` [`[id]/approve/route.ts`]
- [x] [Review][Patch] P5: `.returning()` bisa return array kosong — fixed: guard `if (!header)` sebelum response [`route.ts`]
- [x] [Review][Patch] P6: `innerJoin users` drop SO milik user dihapus — fixed: ganti ke `leftJoin` + COALESCE fallback [`page.tsx`, `pending/route.ts`]
- [x] [Review][Patch] P7: Reject form + Approve SO lain → processingId salah baris — fixed: Approve disabled jika `rejectingId !== null` [`so-client.tsx`]
- [x] [Review][Patch] P8: `req.json()` tidak di-wrap try/catch — fixed: malformed JSON → 400 [`route.ts`]
- [x] [Review][Patch] P9: `generateSONumber()` hanya 4 digit — fixed: 6 digit (1.000.000 kemungkinan) [`route.ts`]
- [x] [Review][Patch] P10: `pending/route.ts` tidak ada role check — fixed: tambah OWNER/MANAGER guard [`pending/route.ts`]

**Deferred:**
- [x] [Review][Defer] DFR1: `history/route.ts` tidak ada role/scope filter — pre-existing pattern, kemungkinan dilindungi dashboard layout auth
- [x] [Review][Defer] DFR2: `applySOStockAdjustment` error log tidak menyertakan item context — improvement kualitas, bukan blocking
- [x] [Review][Defer] DFR3: shiftId filter di history route — pre-existing dari kode sebelumnya
- [x] [Review][Defer] DFR4: UI optimistic removal race dengan `router.refresh()` — pola yang acceptable
- [x] [Review][Defer] DFR5: `applySOStockAdjustment` tidak handle stok tidak cukup untuk SO adjustment — pre-existing di `stock-adjustment.ts`
- [x] [Review][Defer] DFR6: `userId=0` lolos NaN guard tapi akan gagal di FK constraint DB — edge case ditangani DB

---

## Dev Agent Record

### Implementation Plan

1. Fix API route `POST /api/bo/stock-opnames/route.ts` — tambah auth check (401), role check OWNER/MANAGER (403), Zod v4 validation (`issues` bukan `errors`), `createdById` dari JWT, Bahasa Indonesia error messages, NaN guard
2. Buat Server Component `new/page.tsx` — auth + role guard redirect, `Promise.all` untuk fetch branches/users/categories, `force-dynamic`
3. Buat Client Component `so-initiator-client.tsx` — form UI dengan select/multi-checkbox/textarea, disabled submit jika `!branchId`, confirm dialog, error banner, router push sukses
4. Modifikasi SO List `page.tsx` — tambah `searchParams`, tombol "Mulai SO Besar", success banner

### Debug Log

- Perbaikan type error Zod v4: `{ required_error }` tidak didukung di `z.number()`, diganti ke `.positive('pesan')` saja
- Perbaikan type error Zod v4: `.errors` diganti ke `.issues` untuk akses error messages
- Perbaikan typo di `toggleUser`: `u` tidak terdefinisi di branch `[...prev, u]`, diganti ke `id`

### Completion Notes

✅ Semua 4 task dan subtask selesai diimplementasi
✅ Typecheck `tsc --noEmit` bersih (0 error)
✅ Lint crash adalah pre-existing issue (ESLint v9 + typescript-eslint compat), bukan dari perubahan ini
✅ AC1: Form menampilkan field Cabang (wajib), Kategori (multi-select opsional), Petugas (multi-select opsional), Catatan (textarea opsional)
✅ AC2: Submit memanggil `POST /api/bo/stock-opnames` dengan payload valid, SO berstatus PENDING dibuat, redirect ke `/inventory/stock-opname?success=1`
✅ AC3: Tombol submit disabled ketika Cabang belum dipilih (`!branchId`)
✅ AC4: Auth 401 jika tidak ada token, 403 jika role bukan OWNER/MANAGER

---

## File List

**Baru:**
- `apps/backoffice/app/(dashboard)/inventory/stock-opname/new/page.tsx`
- `apps/backoffice/app/(dashboard)/inventory/stock-opname/new/_components/so-initiator-client.tsx`

**Dimodifikasi:**
- `apps/backoffice/app/api/bo/stock-opnames/route.ts` (fix auth + validation)
- `apps/backoffice/app/(dashboard)/inventory/stock-opname/page.tsx` (tambah tombol + success banner)

---

## Change Log

| Date | Change |
|------|--------|
| 2026-05-10 | Story created |
| 2026-05-10 | Implementasi lengkap: fix API route (auth/role/Zod/BI), Server Component new/page.tsx, Client Component so-initiator-client.tsx, modifikasi SO list page (tombol + banner) |
