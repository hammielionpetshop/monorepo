# Story 13.3: Menu Shift di Web POS

Status: done

## Story

**As a** Kasir,
**I want** melihat tab "Shift" di navigasi Web POS,
**So that** saya bisa mengakses informasi shift aktif, mencatat expense, dan melakukan settlement dari satu tempat tanpa harus tahu URL-nya.

## Acceptance Criteria

**AC-1: Tab "Shift" muncul di nav POS**
**Given** Kasir sudah login ke Web POS
**When** melihat navigasi POS
**Then** terdapat tab "Shift" di nav bar di samping "Kasir" dan "History"

**AC-2: Halaman Shift menampilkan info shift aktif**
**Given** Kasir sudah join shift aktif dan membuka tab "Shift"
**When** halaman dimuat
**Then** halaman menampilkan: nomor shift, jam buka, modal awal, tombol "Catat Expense", dan tombol "Settlement / Tutup Shift"

**AC-3: Catat Expense dari halaman Shift**
**Given** Kasir menekan tombol "Catat Expense" di halaman Shift
**When** tombol diklik
**Then** ExpenseDialog terbuka (reuse component yang sudah ada)

**AC-4: Navigasi ke Settlement**
**Given** Kasir menekan tombol "Settlement / Tutup Shift"
**When** tombol diklik
**Then** user diarahkan ke `/pos/settlement`

**AC-5: Tidak ada shift aktif**
**Given** Kasir mengakses tab Shift saat tidak ada shift aktif atau belum join
**When** halaman dimuat
**Then** halaman menampilkan pesan "Tidak ada shift aktif"

## Dev Notes

### File Baru (CREATE)

1. `apps/backoffice/app/pos/(authenticated)/shift/page.tsx` — Server Component
2. `apps/backoffice/components/pos/shift-dashboard-client.tsx` — Client Component

### File yang Dimodifikasi (UPDATE)

- `apps/backoffice/components/pos/pos-nav-tabs.tsx` — tambah tab "Shift"

### Interface untuk ShiftDashboardClient

```typescript
interface ShiftInfo {
  id: number
  shiftNumber: number
  openedAt: Date | string
  openingCash: number
  targetEndTime?: Date | string | null
}

interface ShiftDashboardClientProps {
  shift: ShiftInfo | null
  cashierId: number
}
```

### Pola dari settlement/page.tsx (ikuti persis)

```typescript
// apps/backoffice/app/pos/(authenticated)/shift/page.tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { db, shifts, shiftCashierSessions, eq, and } from '@/lib/db'
import ShiftDashboardClient from '@/components/pos/shift-dashboard-client'

export default async function ShiftPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null

  if (!payload) {
    redirect('/pos/login')
  }

  const activeShift = await db.query.shifts.findFirst({
    where: and(eq(shifts.branchId, payload.branchId), eq(shifts.status, 'OPEN')),
  })

  // Cek apakah kasir sudah join (sama seperti page.tsx utama)
  const isCashierInShift = activeShift
    ? await db.query.shiftCashierSessions
        .findFirst({
          where: and(
            eq(shiftCashierSessions.shiftId, activeShift.id),
            eq(shiftCashierSessions.cashierId, payload.userId)
          ),
        })
        .then((s) => !!s)
    : false

  return (
    <ShiftDashboardClient
      shift={activeShift && isCashierInShift ? {
        id: activeShift.id,
        shiftNumber: activeShift.shiftNumber,
        openedAt: activeShift.openedAt,
        openingCash: activeShift.openingCash as unknown as number,
        targetEndTime: activeShift.targetEndTime,
      } : null}
      cashierId={payload.userId}
    />
  )
}
```

### ShiftDashboardClient — helper functions

Reuse pola `formatCurrency` dan `formatTime` dari `shift-gate-client.tsx` (copy persis).

### pos-nav-tabs.tsx — tambah tab Shift

```tsx
<Link href="/pos/shift" className={tabClass(pathname.startsWith('/pos/shift'))}>
  Shift
</Link>
```

Tambahkan **setelah** tab History (urutan: Kasir | History | Shift).

### Yang Tidak Boleh Diubah

- Tab "Kasir" dan "History" yang sudah ada
- Logic auth/redirect di settlement page dan page utama POS

## Tasks / Subtasks

- [x] Task 1: Tambah tab "Shift" di `pos-nav-tabs.tsx`
- [x] Task 2: Buat `shift/page.tsx` (Server Component)
- [x] Task 3: Buat `shift-dashboard-client.tsx` (Client Component)
  - [x] 3.1 Tampilkan info shift (AC-2)
  - [x] 3.2 Tombol Catat Expense dengan ExpenseDialog (AC-3)
  - [x] 3.3 Tombol Settlement / navigasi ke /pos/settlement (AC-4)
  - [x] 3.4 State tidak ada shift aktif (AC-5)
- [x] Task 4: Verifikasi TypeScript zero error

## Dev Agent Record

### Completion Notes

Implementasi Story 13.3 selesai:
- `pos-nav-tabs.tsx`: tambah tab "Shift" → `/pos/shift`, active state via `pathname.startsWith('/pos/shift')`
- `shift/page.tsx`: Server Component, query active shift + cek isCashierInShift via `shiftCashierSessions`, pass ke `ShiftDashboardClient`
- `shift-dashboard-client.tsx`: Client Component — tampilkan info shift (nomor, jam buka, modal awal, target selesai), tombol Catat Expense (reuse `ExpenseDialog`), tombol Settlement (Link ke `/pos/settlement`), state kosong jika tidak ada shift aktif
- TypeScript zero error

## File List

- apps/backoffice/components/pos/pos-nav-tabs.tsx (UPDATE)
- apps/backoffice/app/pos/(authenticated)/shift/page.tsx (CREATE)
- apps/backoffice/components/pos/shift-dashboard-client.tsx (CREATE)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-06-03 | Story created & implemented | bmad-dev-story |
