---
epic_id: UAT
story_id: BUG-5
story_key: bug-uat-audit-log-ui
status: done
created_at: 2026-05-06
---

# Bug Fix UAT: Audit Log UI — Halaman Riwayat Aktivitas di Backoffice

## Story

As an Owner,
I want melihat riwayat aktivitas penyesuaian stok dan perubahan penting lainnya di Backoffice,
So that saya bisa memverifikasi bahwa operasi seperti `MANUAL_STOCK_ADJUSTMENT` dan `RETURN_PROCESSED` tercatat dengan benar.

## Acceptance Criteria

1. **Given** Owner login ke Backoffice
   **When** Owner mengakses menu "Audit Log" di sidebar
   **Then** halaman `/audit-log` terbuka menampilkan daftar entri audit terbaru

2. **Given** halaman Audit Log terbuka
   **When** Owner melihat tabel entri
   **Then** setiap baris menampilkan: Waktu, Cabang, Pengguna, Aksi (`action`), Tabel (`table_name`), ID Record (`record_id`)

3. **Given** halaman Audit Log terbuka
   **When** Owner ingin mencari entri tertentu
   **Then** tersedia filter berdasarkan `action` (dropdown: semua / MANUAL_STOCK_ADJUSTMENT / RETURN_PROCESSED / dll) dan filter rentang tanggal (date picker)

4. **Given** Owner ingin memverifikasi entri `MANUAL_STOCK_ADJUSTMENT`
   **When** Owner mengklik baris entri audit
   **Then** detail entri ditampilkan termasuk `oldData` dan `newData` (pretty-printed JSON) agar Owner bisa melihat nilai sebelum dan sesudah perubahan

5. **Given** tidak ada entri audit di rentang tanggal yang dipilih
   **When** tabel dimuat
   **Then** pesan "Tidak ada data audit untuk periode yang dipilih" ditampilkan (bukan tabel kosong atau error)

6. **Given** Owner mengakses `/audit-log` tanpa sesi aktif
   **When** permintaan diterima
   **Then** redirect ke `/login` (middleware existing sudah handle ini secara otomatis)

## Tasks / Subtasks

### Task 1: API Endpoint untuk Audit Log

- [x] **Buat `apps/backoffice/app/api/bo/audit-log/route.ts`**
  - [x] Query `auditLogs` tabel dengan filter `action`, `startDate`, `endDate` (optional params dari URL query)
  - [x] LEFT JOIN dengan `users` (untuk `userName`) dan `branches` (untuk `branchName`)
  - [x] Order by `createdAt` DESC, limit 100 entri per request (pagination minimal)
  - [x] Return shape: `{ data: AuditLogEntry[], total: number }`
  - [x] `export const dynamic = 'force-dynamic'` (jangan cache data audit)

### Task 2: Halaman Audit Log

- [x] **Buat `apps/backoffice/app/(dashboard)/audit-log/page.tsx`**
  - [x] Server Component untuk initial data load
  - [x] Tampilkan tabel: Waktu | Cabang | Pengguna | Aksi | Tabel | ID Record
  - [x] Filter bar (client component): dropdown action + date range picker
  - [x] Klik baris: tampilkan detail di dialog/panel samping dengan `oldData` dan `newData`

- [x] **Buat `apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.tsx`**
  - [x] Client Component dengan state untuk filter dan selected entry
  - [x] Fetch data via `/api/bo/audit-log?action=X&startDate=Y&endDate=Z`
  - [x] Menggunakan `useRouter` + URL params untuk filter state persistence
  - [x] Detail dialog: modal/sheet dengan JSON display

### Task 3: Tambahkan Link ke Sidebar

- [x] **Modifikasi `apps/backoffice/app/(dashboard)/layout.tsx`**
  - [x] Tambahkan link "Audit Log" di sidebar navigation:
    ```tsx
    <a href="/audit-log" className="flex items-center gap-2 px-3 py-2 ...">
      <span>📋</span>
      Audit Log
    </a>
    ```

## Dev Notes

### Schema yang Ada: `auditLogs`

```typescript
// packages/db/src/schema/audit.ts
export const auditLogs = petshop.table('audit_logs', {
  id: serial('id').primaryKey(),
  branchId: integer('branch_id').references(() => branches.id),  // nullable
  userId: integer('user_id').references(() => users.id),          // nullable
  action: varchar('action', { length: 100 }).notNull(),
  tableName: varchar('table_name', { length: 50 }),
  recordId: text('record_id'),
  oldData: text('old_data'),  // JSON string — tampilkan sebagai pretty JSON
  newData: text('new_data'),  // JSON string
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

Pastikan `auditLogs` sudah di-export dari `@petshop/db` (cek `packages/db/src/schema/index.ts`).

### Fix Task 1: API Endpoint

```typescript
// apps/backoffice/app/api/bo/audit-log/route.ts
import { NextResponse } from 'next/server'
import { db, auditLogs, users, branches, eq, desc, and, gte, lte, sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')     // optional filter
    const startDate = searchParams.get('startDate') // optional: 'YYYY-MM-DD'
    const endDate = searchParams.get('endDate')     // optional: 'YYYY-MM-DD'

    const conditions = []
    if (action) conditions.push(eq(auditLogs.action, action))
    if (startDate) conditions.push(gte(auditLogs.createdAt, new Date(startDate)))
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      conditions.push(lte(auditLogs.createdAt, end))
    }

    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        tableName: auditLogs.tableName,
        recordId: auditLogs.recordId,
        oldData: auditLogs.oldData,
        newData: auditLogs.newData,
        createdAt: auditLogs.createdAt,
        branchName: branches.name,
        userName: users.name,
      })
      .from(auditLogs)
      .leftJoin(branches, eq(auditLogs.branchId, branches.id))
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(100)

    return NextResponse.json({ data: rows, total: rows.length })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengambil data audit log' },
      { status: 500 }
    )
  }
}
```

**Catatan import:** Cek apakah `auditLogs`, `users`, `gte`, `lte` sudah tersedia via `@/lib/db`. Jika tidak, import langsung dari `@petshop/db` dan `drizzle-orm`.

### Fix Task 2: Halaman dan Komponen

```typescript
// apps/backoffice/app/(dashboard)/audit-log/page.tsx
import { AuditLogTable } from './_components/audit-log-table'

export const dynamic = 'force-dynamic'

export default function AuditLogPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Riwayat aktivitas penyesuaian stok dan perubahan data penting
        </p>
      </div>
      <AuditLogTable />
    </div>
  )
}
```

**AuditLogTable** (client component) memiliki:
1. Filter bar: dropdown action + date range (2 input date)
2. Tabel dengan 6 kolom: Waktu | Cabang | Pengguna | Aksi | Tabel | ID Record
3. Klik baris → dialog detail dengan oldData + newData sebagai `<pre>` atau JSON viewer
4. Loading state dengan skeleton saat fetch

**Contoh badge warna per action:**
```typescript
const actionColors: Record<string, string> = {
  MANUAL_STOCK_ADJUSTMENT: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  RETURN_PROCESSED: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
}
// Default: bg-muted text-muted-foreground
```

**JSON display di detail dialog:**
```tsx
<pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-48 font-mono">
  {JSON.stringify(JSON.parse(entry.oldData ?? '{}'), null, 2)}
</pre>
```
Wrap JSON.parse dalam try-catch: `JSON.parse(entry.oldData ?? '{}')` — jika oldData adalah null atau bukan JSON valid, fallback ke `{}`.

### Architecture Compliance

- **Server Component default** — `AuditLogPage` adalah Server Component (tidak ada `'use client'`)
- **Client Component untuk interaktivitas** — `AuditLogTable` adalah Client Component dengan fetch + filter state
- **Drizzle ORM** untuk semua DB access — tidak ada raw SQL
- **Auth protected** — route `/audit-log` otomatis dilindungi oleh `(dashboard)/layout.tsx` yang sudah ada
- **Error messages** dalam Bahasa Indonesia
- **`export const dynamic = 'force-dynamic'`** — data audit tidak boleh di-cache
- **Tailwind CSS 4 + pola UI yang ada** — ikuti komponen di halaman lain seperti `stock-adjustment` dan `retur`

### Referensi: Pola yang Harus Diikuti

- `apps/backoffice/app/(dashboard)/inventory/stock-adjustment/page.tsx` — pola halaman backoffice
- `apps/backoffice/app/(dashboard)/retur/_components/transaction-search-form.tsx` — pola client component dengan fetch
- `apps/backoffice/app/api/bo/dashboard/offline-branches/route.ts` — pola API route (GET + drizzle query)
- `apps/backoffice/app/(dashboard)/layout.tsx` — sidebar yang perlu ditambah link

### Anti-Patterns (DILARANG)

- JANGAN fetch audit log langsung di Server Component dengan `.limit(1000)` — gunakan limit 100
- JANGAN tampilkan `oldData`/`newData` raw di tabel — tampilkan hanya di detail dialog
- JANGAN buat endpoint tanpa `dynamic = 'force-dynamic'` — data audit harus selalu fresh
- JANGAN filter di client side — filter harus dikirim ke API sebagai query params

### Files yang Dibuat/Dimodifikasi

| File | Status | Keterangan |
|------|--------|-----------|
| `apps/backoffice/app/api/bo/audit-log/route.ts` | NEW | API endpoint dengan filter action + date range |
| `apps/backoffice/app/(dashboard)/audit-log/page.tsx` | NEW | Halaman audit log (Server Component wrapper) |
| `apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.tsx` | NEW | Client Component: tabel + filter + detail dialog |
| `apps/backoffice/app/(dashboard)/layout.tsx` | MODIFY | Tambah link "Audit Log" di sidebar |

### Scope Batasan

- Story ini TIDAK menambahkan pagination kompleks (infinite scroll, page number) — limit 100 cukup untuk MVP
- Story ini TIDAK menambahkan export CSV untuk audit log — di luar scope
- Story ini TIDAK mengubah cara audit log dibuat (logging sudah ada di service layer)
- Story ini TIDAK menambahkan filter per `userId` — filter `action` + date sudah cukup untuk UAT

## Dev Agent Record

### Agent Model Used
deepseek-v4-flash / opencode-go

### Completion Notes List
- Implemented API endpoint `/api/bo/audit-log` with filters (action, startDate, endDate), LEFT JOIN with users & branches, ordered by createdAt DESC, limit 100
- Created Audit Log page at `/audit-log` with Server Component wrapper and Client Component table
- Added filter bar with action dropdown and date range picker, filter state persisted via URL params
- Added detail dialog/modal with pretty-printed oldData and newData JSON
- Added "Audit Log" sidebar link to dashboard layout
- Empty state message: "Tidak ada data audit untuk periode yang dipilih"

### File List
| File | Status | Keterangan |
|------|--------|-----------|
| `apps/backoffice/app/api/bo/audit-log/route.ts` | NEW | API endpoint with filter action + date range |
| `apps/backoffice/app/(dashboard)/audit-log/page.tsx` | NEW | Audit log page (Server Component wrapper) |
| `apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.tsx` | NEW | Client Component: table + filter + detail dialog |
| `apps/backoffice/app/(dashboard)/layout.tsx` | MODIFY | Added "Audit Log" sidebar link |

### Change Log
- 2026-05-06: Implemented bug-uat-audit-log-ui — API endpoint, page, table component, and sidebar link

## Review Findings

- [x] [Review][Dismiss] Auth check di API route — middleware.ts sudah cover semua `/api/` routes via matcher universal; temuan false positive
- [x] [Review][Patch] Invalid date string tidak divalidasi sebelum `new Date()` — fixed: validasi ISO 8601 regex + 400 response [`apps/backoffice/app/api/bo/audit-log/route.ts`]
- [x] [Review][Patch] `setHours` menggunakan timezone server bukan UTC — fixed: ganti ke `setUTCHours` [`apps/backoffice/app/api/bo/audit-log/route.ts`]
- [x] [Review][Patch] `startDate > endDate` tidak divalidasi di client — fixed: validasi di `applyFilters()` sebelum fetch [`apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.tsx`]
- [x] [Review][Patch] Double fetch di `applyFilters()` — fixed: `fetchData` direfaktor menerima params eksplisit, useEffect tidak lagi reactive pada filter state [`apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.tsx`]
- [x] [Review][Patch] `resetFilters()` tidak langsung refetch — fixed: memanggil `fetchData('', '', '')` eksplisit [`apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.tsx`]
- [x] [Review][Patch] `useSearchParams()` tanpa `<Suspense>` boundary di parent — fixed: wrap `<AuditLogTable />` dengan `<Suspense>` di `page.tsx` [`apps/backoffice/app/(dashboard)/audit-log/page.tsx`]
- [x] [Review][Patch] `formatJSON` fallback `'{}'` saat data non-JSON valid — fixed: fallback ke raw string [`apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.tsx`]
- [x] [Review][Patch] `error.message` dari DB dikembalikan verbatim ke client — fixed: return pesan generik, log error di server [`apps/backoffice/app/api/bo/audit-log/route.ts`]
- [x] [Review][Patch] Tidak ada error state di UI saat fetch gagal — fixed: tambah `error` state + error banner UI [`apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.tsx`]
- [x] [Review][Patch] `any` type pada `conditions: any[]` dan `catch (error: any)` — fixed: gunakan `SQL<unknown>[]` dan `catch (error: unknown)` [`apps/backoffice/app/api/bo/audit-log/route.ts`]

- [x] [Review][Defer] `total` selalu = `rows.length` (max 100), teks "Menampilkan X dari Y" berpotensi menyesatkan [`apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.tsx:207-209`] — deferred, pagination explicitly out of scope per spec
- [x] [Review][Defer] URL filter params hanya dibaca on mount, tidak reaktif saat back navigation [`apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.tsx:46-48`] — deferred, UX enhancement beyond spec scope
- [x] [Review][Defer] Empty state "Tidak ada data audit..." muncul saat initial load tanpa filter aktif [`apps/backoffice/app/(dashboard)/audit-log/_components/audit-log-table.tsx:157-160`] — deferred, UX polish
