# Story 7.5: User Management

**Story ID:** 7.5
**Story Key:** 7-5-user-management
**Epic:** 7 - Backoffice Master Data Management (P0 — Critical Blocker)
**Status:** done
**Created:** 2026-05-09

---

## User Story

Sebagai Owner,
saya ingin mengelola data pengguna sistem (tambah, edit, nonaktifkan) melalui Backoffice,
Agar karyawan baru dapat diberikan akses sistem tanpa bantuan teknis.

---

## Acceptance Criteria

**AC1 — Daftar Pengguna**
Given Owner membuka halaman `/settings/users`
When halaman dimuat
Then daftar pengguna ditampilkan dengan kolom: Nama, Nomor Staf, Email, Role, Cabang, Status (Aktif/Nonaktif)

**AC2 — Tambah Pengguna Baru**
Given Owner mengisi form tambah pengguna dengan data valid (nama, role, cabang, password awal)
When disimpan
Then pengguna baru tersimpan ke tabel `users` dengan `passwordHash` dari argon2.hash(password)

**AC3 — Edit Pengguna**
Given Owner memilih pengguna dan mengubah nama, email, nomor staf, role, atau cabang
When disimpan
Then data pengguna diperbarui di tabel `users`

**AC4 — Nonaktifkan Pengguna**
Given Owner menekan tombol "Nonaktifkan" pada pengguna aktif dan mengonfirmasi
When dikonfirmasi
Then `isActive` menjadi `false` dan pengguna tidak dapat login

**AC5 — Proteksi Self-Deactivation**
Given Owner mencoba menonaktifkan akun dirinya sendiri
When request dikirim
Then API menolak dengan error 400 dan pengguna tetap aktif

**AC6 — Auth & Role**
Given akses tanpa autentikasi
When API diakses
Then return 401
Given user role bukan OWNER mencoba POST atau PATCH
When request dikirim
Then return 403

---

## Scope & Batasan

**In scope:**
- Halaman `/settings/users` (list semua pengguna)
- Form tambah pengguna (nama, email opsional, nomor staf opsional, password awal wajib, role, cabang)
- Form edit pengguna (nama, email, nomor staf, role, cabang — tanpa reset password)
- Nonaktifkan pengguna via PATCH `isActive: false` dengan window.confirm()
- GET/POST API di `/api/bo/settings/users`
- PATCH API di `/api/bo/settings/users/[id]`
- Tambah link "Pengguna" di sidebar layout.tsx (bagian "Pengaturan")

**Out of scope:**
- Aktifkan kembali pengguna (reactivate) — tidak ada di AC
- Reset/ganti password via BO — tidak ada di AC
- Manajemen role dan permissions
- PIN management

---

## Skema Database yang Relevan

File: `packages/db/src/schema/users.ts` — **SUDAH ADA, tidak perlu migration**

```typescript
export const users = petshop.table('users', {
  id: serial('id').primaryKey(),
  staffNumber: varchar('staff_number', { length: 50 }).unique(),
  email: varchar('email', { length: 255 }).unique(),
  passwordHash: text('password_hash'),
  pinHash: text('pin_hash'),
  name: varchar('name', { length: 100 }).notNull(),
  roleId: integer('role_id').references(() => roles.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const roles = petshop.table('roles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Semua tabel sudah ter-export dari `packages/db/src/schema/index.ts` → tersedia via `import { users, roles, branches } from '@/lib/db'`.**

Role name yang valid (dari `UserRole` di `@petshop/shared`): `'OWNER' | 'GM' | 'MANAGER' | 'KASIR' | 'GUDANG' | 'FINANCE'`

---

## File Structure

```
apps/backoffice/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx                               # UPDATE: tambah nav link "Pengguna" di sidebar
│   │   └── settings/
│   │       └── users/
│   │           ├── page.tsx                         # BARU: Server Component - fetch users list
│   │           └── _components/
│   │               ├── types.ts                     # BARU: shared types untuk halaman ini
│   │               ├── user-client.tsx              # BARU: client component - list + aksi
│   │               └── user-form.tsx                # BARU: form tambah/edit pengguna
│   └── api/
│       └── bo/
│           └── settings/
│               └── users/
│                   ├── route.ts                     # BARU: GET (list), POST (create)
│                   └── [id]/
│                       └── route.ts                 # BARU: PATCH (update/deactivate)
```

---

## Tasks / Subtasks

- [x] Task 1: API Route — GET & POST `/api/bo/settings/users` (AC: 1, 2, 6)
  - [x] Buat `apps/backoffice/app/api/bo/settings/users/route.ts`
  - [x] `export const dynamic = 'force-dynamic'`
  - [x] GET: Auth check → query `users` JOIN `roles` JOIN `branches` → return list
  - [x] POST: Auth check → role check OWNER only → Zod validate body → cek uniqueness email/staffNumber → `argon2.hash(password)` → insert users → return 201

- [x] Task 2: API Route — PATCH `/api/bo/settings/users/[id]` (AC: 3, 4, 5, 6)
  - [x] Buat `apps/backoffice/app/api/bo/settings/users/[id]/route.ts`
  - [x] `export const dynamic = 'force-dynamic'`
  - [x] Auth check → role check OWNER only → validate id param → Zod validate body
  - [x] Cek user ada (404 jika tidak)
  - [x] Jika `isActive: false`: cek `payload.userId !== targetUserId` (400 jika sama — self-deactivation)
  - [x] Cek uniqueness email/staffNumber jika berubah (ne(users.id, targetId))
  - [x] Update dengan `updatedAt: new Date()` → return updated user

- [x] Task 3: Server Component page.tsx — `/settings/users` (AC: 1)
  - [x] Buat `apps/backoffice/app/(dashboard)/settings/users/page.tsx`
  - [x] `export const dynamic = 'force-dynamic'`
  - [x] Fetch users (JOIN roles + branches) + roles list + branches list (untuk dropdown form)
  - [x] Render `UserClient` dengan initial data
  - [x] Error boundary: tampilkan error message jika fetch gagal

- [x] Task 4: Buat `types.ts` — shared types
  - [x] Buat `apps/backoffice/app/(dashboard)/settings/users/_components/types.ts`
  - [x] Definisikan `UserListItem`, `RoleOption`, `BranchOption`, `UserFormData`

- [x] Task 5: Buat `UserClient` — client component (AC: 1, 3, 4)
  - [x] `'use client'`
  - [x] State: `users`, `showForm`, `editingUser`, `successMsg`, `errorMsg`, `isFormSubmittingRef`
  - [x] Render tabel dengan kolom: Nama, Nomor Staf, Email, Role, Cabang, Status, Aksi
  - [x] Status badge: hijau "Aktif" / abu "Nonaktif"
  - [x] Tombol "Edit" → buka form edit
  - [x] Tombol "+ Tambah Pengguna" → buka form tambah
  - [x] Tombol "Nonaktifkan" hanya muncul pada pengguna aktif → `window.confirm()` → PATCH `{ isActive: false }`
  - [x] `refreshUsers()` via fetch GET setelah setiap mutasi
  - [x] Success/error banner (mutually exclusive, auto-dismiss 3s/5s) — persis pola UomClient
  - [x] Modal overlay pattern persis sama dengan UomClient
  - [x] `aria-live="polite"` pada success, `aria-live="assertive"` pada error

- [x] Task 6: Buat `UserForm` — form tambah/edit (AC: 2, 3)
  - [x] `'use client'`
  - [x] Props: `user: UserListItem | null`, `roles: RoleOption[]`, `branches: BranchOption[]`, `onSuccess`, `onCancel`, `onSubmittingChange?`
  - [x] Form fields:
    - Nama (required, max 100)
    - Email (opsional, max 255, format email)
    - Nomor Staf (opsional, max 50)
    - Password Awal (required saat create, hidden saat edit)
    - Role (select dropdown dari `roles` prop)
    - Cabang (select dropdown dari `branches` prop — semua aktif)
  - [x] Submit: POST untuk tambah, PATCH untuk edit
  - [x] `isSubmitting` guard: disable form + tombol saat in-flight
  - [x] Error message inline di form

- [x] Task 7: Update `layout.tsx` — tambah nav link
  - [x] Update `apps/backoffice/app/(dashboard)/layout.tsx`
  - [x] Tambah section "Pengaturan" dengan link "Pengguna" ke `/settings/users` setelah section "Master Data"

---

## Dev Notes

### Pola Golden Template — Wajib Diikuti

Semua pola dari Story 7.1–7.4 sudah post-review. Ikuti:
- API auth pattern: `apps/backoffice/app/api/bo/master-data/uom/route.ts`
- API PATCH dengan param: `apps/backoffice/app/api/bo/master-data/uom/[id]/route.ts`
- Client component pattern: `apps/backoffice/app/(dashboard)/master-data/uom/_components/uom-client.tsx`
- Form pattern: `apps/backoffice/app/(dashboard)/master-data/uom/_components/uom-form.tsx`
- Server component page: `apps/backoffice/app/(dashboard)/master-data/uom/page.tsx`

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

### Role Check untuk Mutasi (POST, PATCH) — OWNER Only

User management lebih sensitif dari master data biasa. HANYA OWNER yang boleh membuat/mengubah/menonaktifkan pengguna.

```typescript
const ALLOWED_MUTATE_ROLES = ['OWNER']

if (!ALLOWED_MUTATE_ROLES.includes(payload.role)) {
  return NextResponse.json({ error: 'Akses ditolak. Hanya Owner yang dapat mengelola pengguna.' }, { status: 403 })
}
```

### Password Hashing — argon2 (sudah terinstall di backoffice)

```typescript
import * as argon2 from 'argon2'

// Hash password baru
const passwordHash = await argon2.hash(parsed.data.password)

// Verifikasi (tidak dibutuhkan di story ini, tapi referensi ada di login route)
// await argon2.verify(user.passwordHash, input.password)
```

Argon2 sudah ada di `apps/backoffice/package.json` (digunakan di `app/api/auth/login/route.ts`). **JANGAN install ulang atau gunakan bcrypt.**

### API Route GET users — Join dengan roles dan branches

```typescript
// GET /api/bo/settings/users
export async function GET(req: NextRequest) {
  // 1. Auth check (siapapun yang sudah login bisa lihat daftar)
  // 2. Query dengan join:
  const result = await db
    .select({
      id: users.id,
      name: users.name,
      staffNumber: users.staffNumber,
      email: users.email,
      roleId: users.roleId,
      roleName: roles.name,
      branchId: users.branchId,
      branchName: branches.name,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .innerJoin(branches, eq(users.branchId, branches.id))
    .orderBy(users.name)

  return NextResponse.json(result)
}
```

### API Route POST users — Buat pengguna baru

```typescript
const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(100, 'Nama maksimal 100 karakter'),
  email: z.string().trim().email('Format email tidak valid').max(255).optional().or(z.literal('')),
  staffNumber: z.string().trim().max(50, 'Nomor staf maksimal 50 karakter').optional().or(z.literal('')),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  roleId: z.number().int().positive('Role wajib dipilih'),
  branchId: z.number().int().positive('Cabang wajib dipilih'),
})

// Dalam handler POST:
// Normalisasi: email dan staffNumber kosong → null (agar unique constraint tidak conflict)
const emailValue = parsed.data.email?.trim() || null
const staffNumberValue = parsed.data.staffNumber?.trim() || null

// Cek uniqueness dalam transaction
await db.transaction(async (trx) => {
  if (emailValue) {
    const existing = await trx.select({ id: users.id }).from(users)
      .where(eq(users.email, emailValue)).limit(1)
    if (existing.length > 0) throw new Error('DUPLICATE_EMAIL')
  }
  if (staffNumberValue) {
    const existing = await trx.select({ id: users.id }).from(users)
      .where(eq(users.staffNumber, staffNumberValue)).limit(1)
    if (existing.length > 0) throw new Error('DUPLICATE_STAFF_NUMBER')
  }
  // Cek roleId valid
  const role = await trx.select({ id: roles.id }).from(roles)
    .where(eq(roles.id, parsed.data.roleId)).limit(1)
  if (role.length === 0) throw new Error('ROLE_NOT_FOUND')

  // Cek branchId aktif
  const branch = await trx.select({ id: branches.id }).from(branches)
    .where(and(eq(branches.id, parsed.data.branchId), eq(branches.isActive, true))).limit(1)
  if (branch.length === 0) throw new Error('BRANCH_NOT_FOUND')

  const passwordHash = await argon2.hash(parsed.data.password)

  const [newUser] = await trx.insert(users).values({
    name: parsed.data.name.trim(),
    email: emailValue,
    staffNumber: staffNumberValue,
    passwordHash,
    roleId: parsed.data.roleId,
    branchId: parsed.data.branchId,
    isActive: true,
  }).returning({ id: users.id, name: users.name })

  return newUser
})
// Return 201
```

### API Route PATCH users/[id] — Edit dan Nonaktifkan

```typescript
const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(255).optional().or(z.literal('')).or(z.null()),
  staffNumber: z.string().trim().max(50).optional().or(z.literal('')).or(z.null()),
  roleId: z.number().int().positive().optional(),
  branchId: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'Minimal satu field harus diisi',
})

// Dalam handler PATCH:
// Proteksi self-deactivation
if (parsed.data.isActive === false && payload.userId === targetUserId) {
  return NextResponse.json(
    { error: 'Tidak dapat menonaktifkan akun sendiri' },
    { status: 400 }
  )
}

// Update dengan updatedAt
const updateData: Record<string, unknown> = { updatedAt: new Date() }
if (parsed.data.name !== undefined) updateData.name = parsed.data.name.trim()
if (parsed.data.email !== undefined) updateData.email = parsed.data.email?.trim() || null
if (parsed.data.staffNumber !== undefined) updateData.staffNumber = parsed.data.staffNumber?.trim() || null
if (parsed.data.roleId !== undefined) updateData.roleId = parsed.data.roleId
if (parsed.data.branchId !== undefined) updateData.branchId = parsed.data.branchId
if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive
```

### Server Component page.tsx — Fetch Users, Roles, Branches

```typescript
import { db, users, roles, branches, eq } from '@/lib/db'
import UserClient from './_components/user-client'
import type { UserListItem, RoleOption, BranchOption } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  let userList: UserListItem[] = []
  let roleOptions: RoleOption[] = []
  let branchOptions: BranchOption[] = []
  let error: string | null = null

  try {
    ;[userList, roleOptions, branchOptions] = await Promise.all([
      db.select({
        id: users.id,
        name: users.name,
        staffNumber: users.staffNumber,
        email: users.email,
        roleId: users.roleId,
        roleName: roles.name,
        branchId: users.branchId,
        branchName: branches.name,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .innerJoin(branches, eq(users.branchId, branches.id))
      .orderBy(users.name),

      db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(roles.name),

      db.select({ id: branches.id, code: branches.code, name: branches.name })
        .from(branches)
        .where(eq(branches.isActive, true))
        .orderBy(branches.name),
    ])
  } catch (e) {
    console.error('UsersPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data pengguna'
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
        <h1 className="text-xl font-semibold text-foreground">Manajemen Pengguna</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola akun pengguna sistem</p>
      </div>
      <UserClient users={userList} roles={roleOptions} branches={branchOptions} />
    </div>
  )
}
```

### Types — `types.ts`

```typescript
export interface UserListItem {
  id: number
  name: string
  staffNumber: string | null
  email: string | null
  roleId: number
  roleName: string
  branchId: number
  branchName: string
  isActive: boolean
  createdAt: Date
}

export interface RoleOption {
  id: number
  name: string
}

export interface BranchOption {
  id: number
  code: string
  name: string
}

export interface UserFormData {
  name: string
  email: string
  staffNumber: string
  password: string
  roleId: number | ''
  branchId: number | ''
}
```

### UserClient — Pola dari UomClient (gunakan sebagai referensi langsung)

```typescript
'use client'
import { useState, useRef } from 'react'
import UserForm from './user-form'
import type { UserListItem, RoleOption, BranchOption } from './types'

interface Props {
  users: UserListItem[]
  roles: RoleOption[]
  branches: BranchOption[]
}

export default function UserClient({ users: initialUsers, roles, branches }: Props) {
  const [users, setUsers] = useState<UserListItem[]>(initialUsers)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const isFormSubmittingRef = useRef(false)

  // Auto-dismiss: 3s success, 5s error — persis UomClient
  // refreshUsers: GET /api/bo/settings/users
  // handleDeactivate: window.confirm() → PATCH { isActive: false }
```

Tabel header: `['Nama', 'Nomor Staf', 'Email', 'Role', 'Cabang', 'Status', 'Aksi']`

Status badge:
- Aktif: `bg-green-100 text-green-800`
- Nonaktif: `bg-muted text-muted-foreground`

Tombol "Nonaktifkan" HANYA tampil jika `user.isActive === true`.

### Update layout.tsx — Tambah Nav Link

Tambah setelah section "Master Data":
```tsx
<div className="pt-3 pb-1">
  <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
    Pengaturan
  </p>
</div>
<Link
  href="/settings/users"
  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
>
  <span>👥</span>
  Pengguna
</Link>
```

### Import DB yang Benar

```typescript
// Di API routes settings/users:
import { db, users, roles, branches, eq, and, ne } from '@/lib/db'
import * as argon2 from 'argon2'

// Di page.tsx (server component):
import { db, users, roles, branches, eq } from '@/lib/db'
```

**`users`, `roles`, `branches` semua ter-export dari `packages/db/src/schema/index.ts` via `@/lib/db`.**

### Anti-Patterns yang Dilarang

- ❌ Path API lain selain `/api/bo/settings/users` — WAJIB di path `bo/settings`
- ❌ Gunakan bcrypt, bukan argon2 — argon2 sudah ada di package.json backoffice
- ❌ PATCH tanpa cek self-deactivation — bisa lock-out owner
- ❌ `fetch()` dari Server Component — panggil Drizzle langsung
- ❌ Simpan email/staffNumber kosong sebagai `''` — simpan sebagai `null` (unique constraint DB)
- ❌ Lewatkan `export const dynamic = 'force-dynamic'` di semua route dan page baru
- ❌ Role check tidak dilakukan di setiap POST/PATCH — WAJIB OWNER only
- ❌ Gunakan `<a>` tag untuk nav — wajib `<Link>` dari next/link
- ❌ Banner success dan error muncul bersamaan — harus mutually exclusive
- ❌ Form bisa di-submit ganda (tidak ada `isSubmitting` guard)
- ❌ Buat migration baru — schema `users`, `roles`, `branches` sudah ada
- ❌ Hardcode daftar roles di frontend — ambil dari API (GET `/api/bo/settings/users` route sudah menyediakan data; roles fetch dari DB di page.tsx)
- ❌ `aria-live` tidak tepat: success = `polite`, error = `assertive`

### Learnings dari Story 7.4 (Review) — Jangan Diulangi

- ✅ `window.confirm()` diizinkan untuk destructive action (deactivate = destructive)
- ✅ Cek keberadaan foreign key (roleId, branchId) sebelum insert
- ✅ `export const dynamic = 'force-dynamic'` wajib di semua API route DAN di page.tsx
- ✅ Banner success dan error TIDAK bisa muncul bersamaan (set `setErrorMsg(null)` saat set success dan sebaliknya)
- ✅ `aria-live="polite"` pada banner success, `aria-live="assertive"` pada banner error
- ✅ Form tidak bisa disubmit ganda via keyboard saat in-flight (`isSubmitting` state)

### Architecture Compliance

| Rule | Implementation |
|------|---------------|
| Server Component page.tsx | ✅ Drizzle langsung, bukan fetch ke API |
| Client Component interaksi | ✅ `'use client'`, fetch ke `/api/bo/settings/users` |
| Auth setiap API route | ✅ `verifyAccessToken` dari `@/lib/auth` |
| Role check mutasi | ✅ OWNER only pada POST + PATCH |
| Zod validation input | ✅ Di API route handler |
| Error bahasa Indonesia | ✅ Semua pesan user-facing |
| `force-dynamic` route + page | ✅ Wajib |
| Tidak ada migration baru | ✅ Schema sudah ada |
| `Link` bukan `<a>` untuk nav | ✅ Di layout.tsx |
| argon2 untuk password hash | ✅ Gunakan yang sudah terinstall |

### Urutan Implementasi yang Disarankan

1. **Task 4** — `types.ts` (fondasi, digunakan semua komponen lain)
2. **Task 1** — API GET + POST (backend pertama)
3. **Task 2** — API PATCH (backend lengkap)
4. **Task 3** — `page.tsx` server component
5. **Task 5** — `UserClient` (sambungkan ke API)
6. **Task 6** — `UserForm`
7. **Task 7** — Update `layout.tsx` nav

---

## Context dari Story Sebelumnya (7.4)

### Review Findings dari Story 7.4 — Tidak Boleh Diulangi

- ✅ PUT dengan data kosong tanpa konfirmasi → gunakan `window.confirm()` untuk destructive action
- ✅ Duplikat entry dalam body → validasi uniqueness sebelum insert
- ✅ Race condition pada fetch → AbortController pattern bila ada concurrent fetch
- ✅ Overflow decimal → validasi batas atas value
- ✅ Empty state message wajib ada jika daftar kosong
- ✅ Gunakan konstanta dari shared package alih-alih hardcode lokal

---

## Review Findings

- [x] [Review][Patch] Guard last-OWNER: tolak PATCH jika action (role-change atau deactivation) akan membuat jumlah OWNER aktif di sistem menjadi 0 [users/[id]/route.ts — dalam transaction setelah cek existing user]

- [x] [Review][Patch] GET endpoint tidak ada role check — semua user terautentikasi dapat lihat semua data pengguna termasuk email, nomor staf [route.ts:21] — DISMISSED: spec eksplisit "GET: siapapun yang sudah login bisa akses"
- [x] [Review][Patch] PATCH `.returning()` tanpa column projection — mengembalikan `passwordHash` ke client [users/[id]/route.ts:116]
- [x] [Review][Patch] Self-deactivation guard `payload.userId === targetUserId` — `targetUserId` adalah `Number`, `payload.userId` dari JWT bisa `string`, strict equality selalu `false` [users/[id]/route.ts:68]
- [x] [Review][Patch] PATCH tidak memvalidasi `roleId` / `branchId` FK — bisa assign role/cabang yang tidak ada atau tidak aktif [users/[id]/route.ts:108]
- [x] [Review][Patch] Success banner menyembunyikan kegagalan `refreshUsers()` — `setSuccessMsg` dipanggil sebelum `refreshUsers`, jika refresh gagal error tertutup kondisi `!successMsg` [user-client.tsx:77]
- [x] [Review][Patch] `handleDeactivate` tidak ada loading/disabled state — double-click kirim dua PATCH bersamaan [user-client.tsx:84]
- [x] [Review][Patch] Edit form: `name` hanya dikirim jika `form.name.trim()` truthy — jika kosong, field diabaikan tanpa feedback ke user [user-form.tsx:76]
- [x] [Review][Patch] Zod schema menerima `z.literal('')` untuk email/staffNumber tanpa transform ke `null` — coercion `|| null` ada di handler bukan schema, rawan bypass [route.ts:13, [id]/route.ts:17]
- [x] [Review][Patch] POST uniqueness check tidak filter `isActive=false` — email/staffNumber milik user nonaktif terblokir permanen tanpa path reactivation [route.ts:88] — DEFER: membutuhkan partial unique index (DB migration), tidak bisa diperbaiki tanpa schema change
- [x] [Review][Patch] Emoji `👥` di nav sidebar tanpa `aria-hidden="true"` — dibaca screen reader [layout.tsx]
- [x] [Review][Patch] Password tidak di-`.trim()` sebelum hashing — password dengan spasi di ujung tersimpan berbeda dari yang diketik user saat login [route.ts:15]

- [x] [Review][Defer] page.tsx tidak ada explicit auth check [settings/users/page.tsx] — deferred, pola konsisten dengan semua halaman (dashboard) lainnya; auth ditangani middleware/layout
- [x] [Review][Defer] Tidak ada CSRF protection [users/route.ts, [id]/route.ts] — deferred, architectural gap yang sama di seluruh project (sudah ada di deferred dari story 4-4)
- [x] [Review][Defer] Tidak ada pagination di GET users — deferred, pola pre-existing di semua GET master-data
- [x] [Review][Defer] Error sentinel string sebagai control flow (`throw new Error('DUPLICATE_EMAIL')`) — deferred, pola pre-existing di semua routes
- [x] [Review][Defer] `updateData` bertipe `Record<string, unknown>` tanpa type-safety Drizzle — deferred, pola konsisten dengan golden template PATCH lainnya

## Dev Agent Record

### Agent Model Used

glm-5.1 (opencode)

### Debug Log References

### Completion Notes List

- ✅ Task 4: Created `types.ts` with UserListItem, RoleOption, BranchOption, UserFormData interfaces
- ✅ Task 1: Created GET & POST API route at `/api/bo/settings/users` with auth, OWNER-only mutation, argon2 password hashing, uniqueness checks for email/staffNumber, FK validation for roleId and branchId
- ✅ Task 2: Created PATCH API route at `/api/bo/settings/users/[id]` with self-deactivation protection, uniqueness checks with ne() filter, OWNER-only role check
- ✅ Task 3: Created server component page.tsx with parallel data fetching (users+roles+branches), JOIN queries, error handling, force-dynamic
- ✅ Task 5: Created UserClient with user table, status badges, deactivation with window.confirm(), modal form overlay, success/error banners (mutually exclusive, auto-dismiss), aria-live attributes, isFormSubmittingRef guard
- ✅ Task 6: Created UserForm with name, email (optional), staffNumber (optional), password (create only), role select, branch select fields; isSubmitting guard; proper PATCH vs POST handling
- ✅ Task 7: Added "Pengaturan" section with "Pengguna" link in layout.tsx sidebar
- ✅ TypeScript typecheck passes cleanly
- ✅ ESLint failure is pre-existing (plugin config issue), not related to this story

### File List

- apps/backoffice/app/(dashboard)/settings/users/page.tsx (NEW)
- apps/backoffice/app/(dashboard)/settings/users/_components/types.ts (NEW)
- apps/backoffice/app/(dashboard)/settings/users/_components/user-client.tsx (NEW)
- apps/backoffice/app/(dashboard)/settings/users/_components/user-form.tsx (NEW)
- apps/backoffice/app/api/bo/settings/users/route.ts (NEW)
- apps/backoffice/app/api/bo/settings/users/[id]/route.ts (NEW)
- apps/backoffice/app/(dashboard)/layout.tsx (MODIFIED)
