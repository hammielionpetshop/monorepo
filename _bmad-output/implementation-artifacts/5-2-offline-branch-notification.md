# Story 5.2: Offline Branch Notification

Status: done

## Story

As an Owner,
I want melihat daftar cabang mana saja yang sedang offline atau memiliki transaksi yang belum tersinkronisasi,
so that saya bisa memastikan semua pendapatan pada akhirnya tercatat di database pusat.

## Acceptance Criteria

1. **Given** satu atau lebih klien POS belum terhubung ke server lebih dari 30 menit
   **When** Owner melihat halaman dashboard Backoffice
   **Then** widget "Status Cabang" menampilkan daftar cabang tersebut beserta waktu terakhir mereka terhubung (`lastSeenAt`)

2. **Given** POS berhasil mengirim heartbeat atau sync batch ke server
   **When** request berhasil diproses
   **Then** `branches.lastSeenAt` diperbarui ke waktu sekarang untuk cabang tersebut

3. **Given** semua cabang aktif telah terhubung dalam 30 menit terakhir
   **When** Owner melihat dashboard
   **Then** widget menampilkan pesan "Semua cabang online" (bukan layar kosong atau error)

4. **Given** sebuah cabang aktif belum pernah mengirim heartbeat (`lastSeenAt = null`)
   **When** Owner melihat dashboard
   **Then** cabang tersebut ditampilkan dengan label "Belum pernah terhubung"

5. **Given** pengguna mengakses dashboard tanpa sesi aktif
   **When** permintaan halaman diterima
   **Then** pengguna diarahkan ke `/login` (perilaku auth existing tidak berubah)

## Tasks / Subtasks

- [x] Task 0: Schema & Migration — Tambahkan `lastSeenAt` ke tabel `branches`
  - [x] Di `packages/db/src/schema/branches.ts`: tambahkan kolom `lastSeenAt: timestamp('last_seen_at')` (nullable, tidak ada default) — lihat Dev Notes untuk snippet lengkap
  - [x] Buat file SQL migration baru: `packages/db/src/migrations/20260502_add_branch_last_seen_at.sql` — konten SQL di Dev Notes
  - [x] Tidak ada perubahan di `packages/db/src/schema/index.ts` — sudah re-export `branches` otomatis

- [x] Task 1: Server — Heartbeat Endpoint & Update Sync Batch
  - [x] Buat `apps/backoffice/app/api/pos/heartbeat/route.ts` — endpoint `POST /api/pos/heartbeat`
    - [x] Validasi body `{ branchId: number, deviceId: string }` dengan Zod
    - [x] UPDATE `branches.lastSeenAt = NOW()` WHERE `id = branchId AND is_active = true` — gunakan Drizzle (lihat Dev Notes)
    - [x] Return `{ ok: true, lastSeenAt: string }` (ISO string) — atau `404` jika branch tidak ditemukan
    - [x] Tambahkan `export const dynamic = 'force-dynamic'` (mutasi, tidak boleh di-cache)
  - [x] Modifikasi `apps/backoffice/app/api/pos/sync/batch/route.ts`:
    - [x] Setelah loop selesai, jika `synced.length > 0`: UPDATE `branches.lastSeenAt` untuk `branchId` dari transaksi pertama yang berhasil — lihat Dev Notes untuk snippet

- [x] Task 2: Server — API Status Offline Cabang
  - [x] Buat `apps/backoffice/app/api/bo/dashboard/offline-branches/route.ts` — endpoint `GET /api/bo/dashboard/offline-branches`
  - [x] Query semua `branches` WHERE `is_active = true`, ambil `id`, `name`, `lastSeenAt` — order by `name`
  - [x] Hitung `isOffline` dan `offlineMinutes` di server layer (bukan di SQL) — threshold 30 menit
  - [x] Return `{ data: BranchOfflineStatus[] }` — lihat Dev Notes untuk shape lengkap
  - [x] Tambahkan `export const revalidate = 60` (konsisten dengan daily-summary endpoint di Story 5.1)

- [x] Task 3: UI — Widget Status Cabang Offline di Dashboard
  - [x] Buat `apps/backoffice/app/(dashboard)/dashboard/_components/offline-branch-widget.tsx`
    - [x] Async Server Component — fetch data langsung dengan `fetch('/api/bo/dashboard/offline-branches')`
    - [x] Jika ada cabang offline (isOffline=true): tampilkan tabel dengan kolom [Nama Cabang | Terakhir Terhubung | Status]
    - [x] Jika `lastSeenAt = null`: tampilkan teks "Belum pernah terhubung" di kolom Terakhir Terhubung
    - [x] Status badge: "OFFLINE" (merah/destructive) jika `isOffline=true`, "ONLINE" (hijau) jika false
    - [x] Jika tidak ada cabang offline: tampilkan banner hijau "Semua cabang online"
    - [x] Format timestamp menggunakan `Intl.DateTimeFormat` WIB — lihat Dev Notes
  - [x] Modifikasi `apps/backoffice/app/(dashboard)/dashboard/page.tsx`:
    - [x] Import dan render `<OfflineBranchWidget />` di bawah section shiftStatuses yang sudah ada

- [x] Task 4: POS Desktop — Kirim Heartbeat saat Online
  - [x] Modifikasi `apps/pos-desktop/src/services/sync-service.ts`:
    - [x] Tambahkan fungsi `heartbeat()` yang memanggil `POST /api/pos/heartbeat` dengan `{ branchId, deviceId: getDeviceId() }`
    - [x] Panggil `heartbeat()` di handler `onOnline` (saat device reconnect) sebelum `flush()`
    - [x] `branchId` diambil dari `useAuthStore.getState().branchId` atau dari data shift aktif — lihat Dev Notes untuk referensi auth store
    - [x] Jika `heartbeat()` gagal, log warning tapi JANGAN blokir `flush()` — fire-and-forget

## Dev Notes

### Task 0: Schema Change

```typescript
// packages/db/src/schema/branches.ts — TAMBAHKAN satu kolom di akhir definisi tabel:
export const branches = petshop.table('branches', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 20 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at'),   // ← BARU: nullable, tanpa default
});
```

SQL Migration (file baru — gunakan format timestamp seperti migration existing lainnya):
```sql
-- packages/db/src/migrations/20260502_add_branch_last_seen_at.sql
ALTER TABLE petshop.branches ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
```

Cara run migration (manual): `psql $DATABASE_URL -f packages/db/src/migrations/20260502_add_branch_last_seen_at.sql`

### Task 1: Heartbeat Endpoint

```typescript
// apps/backoffice/app/api/pos/heartbeat/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db, branches, eq, and } from '@/lib/db'

const heartbeatSchema = z.object({
  branchId: z.number().int().positive(),
  deviceId: z.string().min(1),
})

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = heartbeatSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload tidak valid' }, { status: 400 })
    }

    const { branchId } = parsed.data
    const now = new Date()

    const [updated] = await db
      .update(branches)
      .set({ lastSeenAt: now })
      .where(and(eq(branches.id, branchId), eq(branches.isActive, true)))
      .returning({ id: branches.id, lastSeenAt: branches.lastSeenAt })

    if (!updated) {
      return NextResponse.json({ error: 'Cabang tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, lastSeenAt: now.toISOString() })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal memperbarui status cabang' },
      { status: 500 }
    )
  }
}
```

### Task 1: Update Sync Batch

Di `apps/backoffice/app/api/pos/sync/batch/route.ts`, tambahkan SETELAH `for` loop (sebelum return):

```typescript
// Tambahkan import di atas: import { db, branches, eq } from '@/lib/db' (jika belum ada)
// Tambahkan import TransactionService sudah ada

// Setelah loop:
if (synced.length > 0) {
  const firstSyncedItem = parsed.data.transactions.find(t => synced.includes(t.id))
  if (firstSyncedItem) {
    try {
      await db
        .update(branches)
        .set({ lastSeenAt: new Date() })
        .where(eq(branches.id, firstSyncedItem.payload.branchId))
    } catch (err) {
      console.error('[Sync] Gagal memperbarui lastSeenAt cabang:', err)
      // Non-fatal — jangan blokir response
    }
  }
}
```

**PENTING:** Tambahkan `import { branches } from '@petshop/db'` atau pastikan `@/lib/db` sudah re-export `branches`. File `apps/backoffice/lib/db.ts` melakukan `export * from '@petshop/db'` — jadi `branches` sudah tersedia via `import { branches } from '@/lib/db'`.

### Task 2: Offline Branches API

```typescript
// apps/backoffice/app/api/bo/dashboard/offline-branches/route.ts
import { NextResponse } from 'next/server'
import { db, branches, eq } from '@/lib/db'

export const revalidate = 60

const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000 // 30 menit

export async function GET() {
  try {
    const allBranches = await db
      .select({ id: branches.id, name: branches.name, lastSeenAt: branches.lastSeenAt })
      .from(branches)
      .where(eq(branches.isActive, true))
      .orderBy(branches.name)

    const now = Date.now()

    const data = allBranches.map(b => {
      const lastSeenAt = b.lastSeenAt ? b.lastSeenAt.toISOString() : null
      const isOffline = !b.lastSeenAt || (now - b.lastSeenAt.getTime()) > OFFLINE_THRESHOLD_MS
      const offlineMinutes = b.lastSeenAt
        ? Math.floor((now - b.lastSeenAt.getTime()) / 60_000)
        : null

      return {
        branchId: b.id,
        branchName: b.name,
        lastSeenAt,
        isOffline,
        offlineMinutes,
      }
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal mengambil status cabang' },
      { status: 500 }
    )
  }
}
```

**Response shape:**
```typescript
interface BranchOfflineStatus {
  branchId: number
  branchName: string
  lastSeenAt: string | null   // ISO string atau null (belum pernah connect)
  isOffline: boolean          // true jika > 30 menit atau null
  offlineMinutes: number | null  // menit sejak lastSeenAt, null = belum pernah
}
// Response: { data: BranchOfflineStatus[] }
```

### Task 3: UI Widget

```typescript
// apps/backoffice/app/(dashboard)/dashboard/_components/offline-branch-widget.tsx
import { formatWIB } from '../_lib/format'  // atau inline dengan Intl.DateTimeFormat

interface BranchOfflineStatus {
  branchId: number
  branchName: string
  lastSeenAt: string | null
  isOffline: boolean
  offlineMinutes: number | null
}

export default async function OfflineBranchWidget() {
  // Fetch di Server Component — gunakan URL absolut atau path relatif dengan base URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'
  const res = await fetch(`${baseUrl}/api/bo/dashboard/offline-branches`, {
    next: { revalidate: 60 },
  })

  if (!res.ok) return null  // silent fail — jangan error halaman utama

  const { data }: { data: BranchOfflineStatus[] } = await res.json()

  const offlineBranches = data.filter(b => b.isOffline)

  // Render widget ...
}
```

**Catatan fetch di Server Component:** Next.js 15 App Router mendukung `fetch()` langsung di Server Component dengan `{ next: { revalidate: 60 } }`. Pastikan menggunakan absolute URL (bukan relative) karena tidak ada browser context di server.

**Alternatif pattern (lebih clean — konsisten dengan daily-summary):** Buat service function di `apps/backoffice/lib/services/dashboard-service.ts` — tambahkan fungsi `getOfflineBranches()` yang query langsung ke DB (tanpa HTTP fetch internal). Ini lebih efisien karena tidak ada HTTP overhead.

**Rekomendasi: Gunakan service function langsung (bukan internal fetch):**
```typescript
// Di lib/services/dashboard-service.ts — tambahkan:
export async function getOfflineBranches(): Promise<BranchOfflineStatus[]> {
  const allBranches = await db
    .select({ id: branches.id, name: branches.name, lastSeenAt: branches.lastSeenAt })
    .from(branches)
    .where(eq(branches.isActive, true))
    .orderBy(branches.name)

  const now = Date.now()
  return allBranches.map(b => ({ ... }))  // sama seperti di route handler
}

// Di offline-branch-widget.tsx — import langsung:
import { getOfflineBranches } from '@/lib/services/dashboard-service'
const data = await getOfflineBranches()
```

**Intl.DateTimeFormat WIB (gunakan di widget):**
```typescript
function formatLastSeen(isoString: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(isoString))
}
```

**Integrasi ke page.tsx:**
```tsx
// apps/backoffice/app/(dashboard)/dashboard/page.tsx — tambahkan import dan render:
import OfflineBranchWidget from './_components/offline-branch-widget'

// Di JSX, setelah section shiftStatuses:
<OfflineBranchWidget />
```

**PENTING — Folder `_components`:** Cek apakah folder `apps/backoffice/app/(dashboard)/dashboard/_components/` sudah ada. Jika belum, buat folder tersebut. Di Next.js App Router, folder prefixed `_` tidak dijadikan route.

### Task 4: POS Heartbeat

**Auth Store — cara ambil `branchId`:**
```typescript
// Cek apakah ada authStore di apps/pos-desktop/src/store/ yang menyimpan branchId
// Atau ambil dari shiftStore: useShiftStore.getState().currentShift?.branchId
// Jika keduanya tidak ada, gunakan:
import { useAuthStore } from '@/store/auth-store'
const branchId = useAuthStore.getState().user?.branchId
```

**Pattern di sync-service.ts — tambahkan fungsi heartbeat:**
```typescript
// apps/pos-desktop/src/services/sync-service.ts — TAMBAHKAN:
async heartbeat(branchId: number): Promise<void> {
  try {
    await apiClient.post('/api/pos/heartbeat', {
      branchId,
      deviceId: getDeviceId(),
    })
  } catch {
    // fire-and-forget — jangan blokir operasi lain
  }
},
```

**Panggil di `onOnline` handler (sudah ada di sync-service atau network-store):**
```typescript
// Di tempat yang handle 'online' event (sync-service.ts atau network-store.ts):
// Panggil heartbeat SEBELUM flush:
const branchId = useShiftStore.getState().currentShift?.branchId
if (branchId) await syncService.heartbeat(branchId)
await syncService.flush()
```

**Cari implementasi current `onOnline` handler** di `sync-service.ts` atau `network-store.ts` — mungkin sudah ada listener untuk `window.addEventListener('online', ...)`. Tambahkan heartbeat call di sana.

### Architecture Compliance

- **Tidak ada big.js** — tidak ada kalkulasi finansial di story ini
- **Server Component** untuk UI widget (fetch/query di server, bukan client)
- **Drizzle ORM** untuk semua DB access — jangan raw SQL di server code
- **Zod validation** di heartbeat endpoint (input boundary dari POS)
- **Error messages** user-facing dalam Bahasa Indonesia
- **Tailwind CSS 4 + Radix UI** untuk UI komponen baru
- **POS endpoints `/api/pos/*`** tidak memerlukan auth middleware — konsisten dengan sync/batch
- **Backoffice API `/api/bo/*`** ikuti pola Story 5.1 — tidak ada auth di route level (protected via page middleware)
- **`export const dynamic = 'force-dynamic'`** untuk POST endpoints (mutasi)
- **`export const revalidate = 60`** untuk GET endpoints yang di-cache
- **File naming:** kebab-case untuk file, PascalCase untuk komponen

### Anti-Patterns (DILARANG)

- JANGAN buat tabel baru untuk heartbeat tracking — gunakan kolom `lastSeenAt` di `branches`
- JANGAN hitung `isOffline` di SQL/Drizzle — hitung di server layer JS (lebih readable)
- JANGAN gunakan Client Component untuk fetch data widget ini
- JANGAN update `lastSeenAt` di DALAM loop transaksi sync (satu update setelah semua berhasil)
- JANGAN tambahkan `heartbeat` endpoint ke middleware matcher
- JANGAN gunakan `Math.round()` — untuk `offlineMinutes` gunakan `Math.floor()`

### Previous Story Intelligence (Story 5.1)

- **Dashboard layout sudah ada:** `(dashboard)/layout.tsx` dengan Sidebar + Header, tidak perlu diubah
- **Auth pattern:** middleware.ts melindungi `/dashboard/:path*`, API routes tidak di-protect di level route
- **Server Component data fetching:** Story 5.1 menggunakan service functions (`lib/services/dashboard-service.ts`) yang di-call langsung di Server Component — GUNAKAN POLA SAMA, bukan internal `fetch()` call
- **Cookie name:** `accessToken` (bukan `access_token` seperti di story spec lama) — sudah dikonfirmasi di Story 5.1 implementation notes
- **`big.js` hanya di backoffice `package.json`** karena Story 5.1 menambahkannya — TIDAK diperlukan untuk story ini
- **TypeScript:** Story 5.1 menemukan pre-existing TS errors di route handlers lama — jangan fix kecuali diminta
- **Review finding dari Story 5.1:** Invalid Date comparison — pattern yang benar: `DATE(created_at AT TIME ZONE 'Asia/Jakarta') = CURRENT_DATE AT TIME ZONE 'Asia/Jakarta'`

### Project Structure

File yang akan dibuat/dimodifikasi:
```
packages/db/src/schema/branches.ts                                          ← MODIFIKASI (tambah kolom)
packages/db/src/migrations/20260502_add_branch_last_seen_at.sql             ← BARU

apps/backoffice/app/api/pos/heartbeat/route.ts                              ← BARU
apps/backoffice/app/api/pos/sync/batch/route.ts                             ← MODIFIKASI (tambah lastSeenAt update)
apps/backoffice/app/api/bo/dashboard/offline-branches/route.ts              ← BARU
apps/backoffice/lib/services/dashboard-service.ts                           ← MODIFIKASI (tambah getOfflineBranches)
apps/backoffice/app/(dashboard)/dashboard/_components/offline-branch-widget.tsx  ← BARU
apps/backoffice/app/(dashboard)/dashboard/page.tsx                          ← MODIFIKASI (tambah widget)

apps/pos-desktop/src/services/sync-service.ts                              ← MODIFIKASI (tambah heartbeat)
```

### References

- [Epic 5, Story 5.2 — FR19](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/_bmad-output/planning-artifacts/epics.md)
- [Architecture: API Patterns, Auth Pattern](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/_bmad-output/planning-artifacts/architecture.md)
- [Story 5.1 — Dashboard & Auth Foundation (pola yang harus diikuti)](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/_bmad-output/implementation-artifacts/5-1-daily-summary-dashboard.md)
- [Schema: branches (file yang dimodifikasi)](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/packages/db/src/schema/branches.ts)
- [Schema: notifications (tersedia jika perlu extend)](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/packages/db/src/schema/notifications.ts)
- [Sync batch endpoint (file yang dimodifikasi)](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/apps/backoffice/app/api/pos/sync/batch/route.ts)
- [Sync service POS (file yang dimodifikasi)](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/apps/pos-desktop/src/services/sync-service.ts)
- [Dashboard service (file yang dimodifikasi)](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/apps/backoffice/lib/services/dashboard-service.ts)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Completion Notes List

- Diterapkan perbaikan dari checklist: schema change dengan kolom nullable, dua jalur update `lastSeenAt` (heartbeat + sync batch), service layer pattern sesuai Story 5.1.
- Rekomendasi: gunakan service function (`getOfflineBranches` di `dashboard-service.ts`) for widget, bukan internal HTTP fetch.
- POS-side heartbeat (Task 4) adalah enabler utama untuk deteksi "offline" yang akurat — tanpa ini, hanya sync batch yang mengupdate `lastSeenAt`.
- Threshold 30 menit sebagai konstanta di service layer, bukan di SQL.
- Implementasi widget menggunakan Tailwind CSS dengan visual cue (pulsing green dot untuk online, red text untuk offline).

### File List

- [MOD] `packages/db/src/schema/branches.ts`
- [NEW] `packages/db/src/migrations/20260502_add_branch_last_seen_at.sql`
- [NEW] `apps/backoffice/app/api/pos/heartbeat/route.ts`
- [MOD] `apps/backoffice/app/api/pos/sync/batch/route.ts`
- [MOD] `apps/backoffice/lib/services/dashboard-service.ts`
- [NEW] `apps/backoffice/app/api/bo/dashboard/offline-branches/route.ts`
- [NEW] `apps/backoffice/app/(dashboard)/dashboard/_components/offline-branch-widget.tsx`
- [MOD] `apps/backoffice/app/(dashboard)/dashboard/page.tsx`
- [MOD] `apps/pos-desktop/src/services/sync-service.ts`
- [MOD] `apps/pos-desktop/src/services/sync-service.test.ts`

### Review Findings

- [x] [Review][Decision] Badge OFFLINE untuk "Belum pernah terhubung" — Teknis benar tapi mungkin perlu pembedaan visual/label antara "Offline" vs "Never Connected".
- [x] [Review][Patch] Update lastSeenAt di Sync Batch di luar transaksi [sync/batch/route.ts]
- [x] [Review][Patch] Clock skew pada offlineMinutes [dashboard-service.ts]
- [x] [Review][Patch] Widget menampilkan semua cabang saat ada yang offline [offline-branch-widget.tsx]
- [x] [Review][Patch] Payload branchId tidak aman [sync/batch/route.ts]
- [x] [Review][Patch] Error handling req.json() [heartbeat/route.ts]
- [x] [Review][Patch] Status Branch Non-Aktif merespon 404 [heartbeat/route.ts]
- [x] [Review][Patch] Estetika UI kurang premium [offline-branch-widget.tsx]
- [x] [Review][Defer] Revalidate API dashboard mungkin terlalu lambat [offline-branches/route.ts] — deferred, pre-existing

