---
epic_id: UAT
story_id: BUG-4
story_key: bug-uat-dashboard-sync
status: done
created_at: 2026-05-06
---

# Bug Fix UAT: Dashboard Sync — Heartbeat, Status Shift & Real-Time Refresh

## Story

As an Owner,
I want dashboard Backoffice menampilkan data terkini secara otomatis,
So that saya dapat melihat status shift yang benar dan total transaksi yang up-to-date tanpa perlu muat ulang halaman secara manual.

## Acceptance Criteria

1. **Given** POS kembali online setelah offline
   **When** koneksi internet dipulihkan dan `window 'online'` event terjadi
   **Then** POS mengirim heartbeat ke server dalam 5 detik sehingga `branches.lastSeenAt` diperbarui, terlepas dari apakah `activeShift` sudah dimuat atau belum

2. **Given** Shift aktif sedang terbuka di POS (status = OPEN)
   **When** Owner membuka dashboard Backoffice
   **Then** widget "Status Shift per Cabang" menampilkan shift dengan status OPEN — BUKAN "BELUM BUKA" — meskipun shift dibuka pada hari sebelumnya (cross-midnight shift)

3. **Given** Owner sedang melihat dashboard Backoffice
   **When** kasir POS melakukan beberapa transaksi baru
   **Then** dalam waktu maksimal 60 detik, metrik "Total Pendapatan" dan "Jumlah Transaksi" di dashboard diperbarui secara otomatis TANPA perlu muat ulang halaman

4. **Given** dashboard Backoffice terbuka
   **When** ada pembaruan data
   **Then** tersedia tombol "Refresh" yang dapat diklik untuk memperbarui data secara manual seketika

## Tasks / Subtasks

### Task 1: Fix Heartbeat — Fallback branchId dari authStore atau login data

- [x] **Modifikasi `apps/pos-desktop/src/services/sync-service.ts`**
  - [x] Di `startAutoSync()` — dalam `onlineListener` dan startup check:
    - Ganti `useShiftStore.getState().activeShift?.branchId` dengan helper `getActiveBranchId()` yang memiliki fallback
  - [x] Tambahkan fungsi `getActiveBranchId(): number | null` yang mengambil branchId dari:
    1. `useShiftStore.getState().activeShift?.branchId` (primary)
    2. `useAuthStore.getState().user?.branchId` (fallback — user login data biasanya memiliki branchId)
    3. `null` jika keduanya tidak tersedia

### Task 2: Fix Shift Status Query — Include OPEN shifts dari hari mana pun

- [x] **Modifikasi `apps/backoffice/lib/services/dashboard-service.ts`**
  - [x] Ubah `SHIFT_TODAY_FILTER` menjadi kondisi yang juga mengambil shift OPEN dari hari lain
  - [x] Import `or` dari `@/lib/db` jika belum ada
  - [x] Join condition baru:
    ```typescript
    and(
      eq(shifts.branchId, branches.id),
      or(
        SHIFT_TODAY_FILTER,                 // shift dibuka hari ini (behavior saat ini)
        eq(shifts.status, 'OPEN'),          // ATAU shift OPEN dari hari lain (cross-midnight)
      )
    )
    ```
  - [x] Import `or` dari Drizzle: pastikan sudah ada di `@/lib/db` exports (cek `apps/backoffice/lib/db.ts`)

### Task 3: Auto-refresh Dashboard — Client Component Polling

- [x] **Buat `apps/backoffice/app/(dashboard)/dashboard/_components/dashboard-refresh.tsx`**
  - [x] `'use client'` directive
  - [x] Komponen menggunakan `useRouter` dari `next/navigation` dan `useEffect`
  - [x] Memanggil `router.refresh()` setiap 60 detik (menggunakan `setInterval`)
  - [x] TIDAK menampilkan UI (return null) — komponen ini hanya background refresh logic

- [x] **Tambahkan tombol Refresh manual ke `apps/backoffice/app/(dashboard)/dashboard/page.tsx`**
  - [x] Buat client component `RefreshButton` (inline di file atau file terpisah):
    - Menggunakan `useRouter` dan `useTransition`
    - Tombol "Refresh" dengan ikon `RefreshCw` dari lucide-react
    - Saat diklik: panggil `router.refresh()` dan tampilkan loading state via `isPending` dari `useTransition`
  - [x] Render `<DashboardAutoRefresh />` dan `<RefreshButton />` di `DashboardPage`

### Task 4: Ubah Revalidasi Dashboard ke Strategi yang Lebih Agresif

- [x] **Modifikasi `apps/backoffice/app/(dashboard)/dashboard/page.tsx`**
  - [x] Ubah `export const revalidate = 60` menjadi `export const revalidate = 30` (lebih agresif: 30 detik)
  - [x] Atau pertimbangkan `export const dynamic = 'force-dynamic'` untuk selalu fetch terbaru (trade-off: tidak ada cache, setiap request ke DB)
  - [x] Rekomendasi: gunakan `revalidate = 30` + client-side polling setiap 60 detik (Task 3)

## Dev Notes

### Root Cause Analysis

**Bug #9 (heartbeat tidak terkirim saat reconnect):**
Di `sync-service.ts`, `onlineListener`:
```typescript
const branchId = useShiftStore.getState().activeShift?.branchId;
if (branchId) {
  syncService.heartbeat(branchId).catch(() => {});
}
```
Jika POS reconnect sebelum `checkActiveShift()` selesai (atau jika shift belum dimuat sama sekali), `activeShift` adalah `null` dan heartbeat tidak dikirim.

**Bug #8 (shift status "BELUM BUKA"):**
Di `dashboard-service.ts`, query shifts menggunakan `SHIFT_TODAY_FILTER` yang hanya mengambil shift dibuka HARI INI:
```typescript
const SHIFT_TODAY_FILTER = sql`(${shifts.openedAt} AT TIME ZONE 'Asia/Jakarta')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date`
```
Jika shift dibuka kemarin dan masih OPEN hari ini (cross-midnight), query ini tidak menemukannya → status `null` → badge "BELUM BUKA".

**Bug #11 (dashboard tidak real-time):**
Dashboard adalah Server Component dengan `revalidate = 60`. ISR (Incremental Static Regeneration) Next.js membutuhkan request baru untuk trigger background re-fetch. Jika pengguna tidak navigasi ulang, halaman tetap menampilkan data lama. Tidak ada client-side polling yang berjalan.

### Fix Task 1: getActiveBranchId helper

```typescript
// Di apps/pos-desktop/src/services/sync-service.ts
// Tambahkan import:
import { useAuthStore } from '@/store/auth-store';

function getActiveBranchId(): number | null {
  return (
    useShiftStore.getState().activeShift?.branchId ??
    (useAuthStore.getState().user as any)?.branchId ??
    null
  );
}

// Ganti semua usage:
// Sebelum: const branchId = useShiftStore.getState().activeShift?.branchId;
// Sesudah: const branchId = getActiveBranchId();
```

**Lokasi yang perlu diganti (2 tempat di startAutoSync):**
1. Di dalam `onlineListener` callback
2. Di startup check `if (navigator.onLine)`

### Fix Task 2: Shift Status Query

```typescript
// Di apps/backoffice/lib/services/dashboard-service.ts
// Tambahkan import or:
import { db, transactions, transactionItems, shifts, shiftExpenses, branches, eq, and, sql, desc, or } from '@/lib/db'

// Ubah LEFT JOIN condition:
.leftJoin(
  shifts,
  and(
    eq(shifts.branchId, branches.id),
    or(
      SHIFT_TODAY_FILTER,
      eq(shifts.status, 'OPEN'),
    )
  )
)
```

**Catatan ORDER BY:** Tetap gunakan `desc(shifts.id)` untuk memastikan shift paling baru per cabang muncul pertama. Jika ada multiple shifts OPEN (edge case), yang terbaru (ID terbesar) yang diambil.

**Cek apakah `or` sudah di-export dari `@/lib/db`:**
```typescript
// Cek apps/backoffice/lib/db.ts — biasanya:
export * from '@petshop/db'  // jika ini ada, 'or' dari drizzle-orm sudah tersedia
// Atau cek: import { or } from 'drizzle-orm'
```

### Fix Task 3: Dashboard Auto-Refresh

```typescript
// apps/backoffice/app/(dashboard)/dashboard/_components/dashboard-refresh.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const REFRESH_INTERVAL_MS = 60_000 // 60 detik

export function DashboardAutoRefresh() {
  const router = useRouter()
  
  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh()
    }, REFRESH_INTERVAL_MS)
    
    return () => clearInterval(timer)
  }, [router])
  
  return null
}
```

```tsx
// apps/backoffice/app/(dashboard)/dashboard/_components/refresh-button.tsx
'use client'

import { useRouter, useTransition } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  
  const handleRefresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }
  
  return (
    <button
      onClick={handleRefresh}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-md hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
      {isPending ? 'Memperbarui...' : 'Refresh'}
    </button>
  )
}
```

```tsx
// Modifikasi apps/backoffice/app/(dashboard)/dashboard/page.tsx
import { DashboardAutoRefresh } from './_components/dashboard-refresh'
import { RefreshButton } from './_components/refresh-button'

// Ubah revalidate:
export const revalidate = 30 // turunkan dari 60 ke 30

// Di DashboardPage component, tambahkan:
export default function DashboardPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <DashboardAutoRefresh />  {/* background polling */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString('id-ID', { ... })}
          </p>
        </div>
        <RefreshButton />  {/* manual refresh button */}
      </div>
      <DashboardContent />
    </div>
  )
}
```

### Architecture Compliance

- **Server Component tetap Server Component** — `DashboardContent` dan `OfflineBranchWidget` tidak diubah ke Client Component
- **Client Components minimal** — hanya `DashboardAutoRefresh` dan `RefreshButton` yang menjadi `'use client'`
- **`router.refresh()`** adalah cara resmi Next.js App Router untuk re-fetch data Server Component dari Client Component tanpa full navigation
- **Drizzle ORM** untuk semua DB access — tidak ada raw SQL baru
- **import `or`** dari drizzle-orm sudah tersedia via `@/lib/db` (cek ulang sebelum implementasi)

### Anti-Patterns (DILARANG)

- JANGAN convert `DashboardContent` ke Client Component untuk polling — gunakan `router.refresh()` pattern
- JANGAN gunakan `window.location.reload()` — ini akan reload seluruh halaman dan kehilangan state
- JANGAN polling langsung ke API endpoint dari client — gunakan Server Component dengan `router.refresh()`
- JANGAN buat endpoint baru untuk dashboard data — `getDailySummary()` sudah cukup

### Files yang Dimodifikasi/Dibuat

| File | Status | Keterangan |
|------|--------|-----------|
| `apps/pos-desktop/src/services/sync-service.ts` | MODIFY | Tambah `getActiveBranchId()` helper, gunakan di 2 tempat |
| `apps/backoffice/lib/services/dashboard-service.ts` | MODIFY | Fix SHIFT query: tambah `or(SHIFT_TODAY_FILTER, eq(shifts.status, 'OPEN'))` |
| `apps/backoffice/app/(dashboard)/dashboard/page.tsx` | MODIFY | Ubah `revalidate = 30`, tambah `DashboardAutoRefresh` + `RefreshButton` |
| `apps/backoffice/app/(dashboard)/dashboard/_components/dashboard-refresh.tsx` | NEW | Client component auto-polling setiap 60 detik |
| `apps/backoffice/app/(dashboard)/dashboard/_components/refresh-button.tsx` | NEW | Tombol refresh manual |

**Jangan modifikasi:**
- `apps/backoffice/app/(dashboard)/dashboard/_components/offline-branch-widget.tsx` — tidak ada perubahan
- `packages/db/src/schema/` — tidak ada schema change
- `apps/pos-desktop/src/store/shift-store.ts` — tidak ada perubahan

### Scope Batasan

- Story ini TIDAK menambahkan WebSocket real-time — polling sudah cukup untuk MVP
- Story ini TIDAK mengubah cara shift dibuka/ditutup di POS
- Story ini TIDAK mengubah `lastSeenAt` detection threshold (tetap 30 menit)
- `revalidate = 30` adalah tradeoff: DB query setiap 30 detik saat ada request, bukan setiap request

## Dev Agent Record

### Agent Model Used
deepseek-v4-flash / opencode-go

### Completion Notes List
- **Bug #9 (heartbeat tidak terkirim saat reconnect)**: Di `sync-service.ts`, tambah helper `getActiveBranchId()` dengan fallback ke `useAuthStore.getState().user?.branchId` jika `activeShift?.branchId` null. Digunakan di 2 tempat: `onlineListener` dan startup check.
- **Bug #8 (shift status "BELUM BUKA" untuk cross-midnight shift)**: Di `dashboard-service.ts`, tambah `or(SHIFT_TODAY_FILTER, eq(shifts.status, 'OPEN'))` ke LEFT JOIN condition agar shift OPEN dari hari sebelumnya tetap terdeteksi.
- **Bug #11 (dashboard tidak real-time)**: Buat `DashboardAutoRefresh` (client component, polling `router.refresh()` setiap 60 detik) dan `RefreshButton` (manual refresh dengan `useTransition` loading state). Ubah `revalidate = 60` ke `revalidate = 30` untuk ISR lebih agresif.
- Semua acceptance criteria terpenuhi. 67 tests passing, 0 regresi.

### File List
- `apps/pos-desktop/src/services/sync-service.ts` (MODIFY) — tambah `getActiveBranchId()` helper, import `useAuthStore`
- `apps/backoffice/lib/services/dashboard-service.ts` (MODIFY) — tambah `or` import, fix JOIN condition untuk OPEN shifts
- `apps/backoffice/app/(dashboard)/dashboard/_components/dashboard-refresh.tsx` (NEW) — auto-polling client component
- `apps/backoffice/app/(dashboard)/dashboard/_components/refresh-button.tsx` (NEW) — manual refresh button
- `apps/backoffice/app/(dashboard)/dashboard/page.tsx` (MODIFY) — revalidate 30, render DashboardAutoRefresh + RefreshButton

### Review Findings

- [x] [Review][Patch] Cast `as any` pada `getActiveBranchId` melanggar strict mode TypeScript [apps/pos-desktop/src/services/sync-service.ts]
- [x] [Review][Patch] Error heartbeat di-silent tanpa logging [apps/pos-desktop/src/services/sync-service.ts]
- [x] [Review][Patch] `setInterval` tanpa backpressure bisa membanjiri server [apps/backoffice/app/(dashboard)/dashboard/_components/dashboard-refresh.tsx:12]
- [x] [Review][Patch] Tombol refresh kurang markup aksesibilitas [apps/backoffice/app/(dashboard)/dashboard/_components/refresh-button.tsx]
- [x] [Review][Patch] Timer auto-refresh tidak reset saat manual refresh
- [x] [Review][Patch] Tidak ada error handling saat `router.refresh()` gagal [apps/backoffice/app/(dashboard)/dashboard/_components/dashboard-refresh.tsx]
- [x] [Review][Patch] `branchId` bernilai `0` akan di-skip oleh check `if (branchId)` [apps/pos-desktop/src/services/sync-service.ts:140,152]
- [x] [Review][Patch] Polling tetap berjalan saat tab browser tidak aktif [apps/backoffice/app/(dashboard)/dashboard/_components/dashboard-refresh.tsx:12]
- [x] [Review][Patch] Fungsi `getActiveBranchId` kurang komentar konteks bisnis [apps/pos-desktop/src/services/sync-service.ts]
- [x] [Review][Defer] Shift OPEN dari hari sebelumnya bisa ikut masuk JOIN expenses [apps/backoffice/lib/services/dashboard-service.ts:84] — deferred, pre-existing
- [x] [Review][Defer] Tanggal header dirender server-side tanpa timezone safety [apps/backoffice/app/(dashboard)/dashboard/page.tsx] — deferred, pre-existing

### Change Log
2026-05-06: Implementasi bug fix dashboard sync — fix heartbeat fallback branchId, fix shift status query untuk cross-midnight OPEN shifts, tambah auto-refresh polling + manual refresh button, turunkan revalidate ke 30 detik.
