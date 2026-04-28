---
epic_id: 1
story_id: 1.4
story_key: 1-4-auto-sync-queue-to-server
status: done
created_at: 2026-04-28
---

# Story 1.4: Auto-Sync Queue to Server

## Story

As a System,
I want secara otomatis mengirim transaksi yang tertunda ke server saat online,
So that data pusat tetap akurat tanpa mengharuskan Kasir menekan tombol "Sinkronisasi Manual".

## Acceptance Criteria

1. **Given** ada transaksi di antrean lokal (`pendingOperations` di Dexie)
   **When** indikator kembali "Online" (event `window.online` terpicu)
   **Then** aplikasi otomatis memanggil `syncService.flush()` di latar belakang
   **And** `networkStore.isSyncing` diset `true` selama proses berlangsung
   **And** `POSHeader` menampilkan spinner `RefreshCw` berputar (UI sudah siap)
   **And** UI kasir tidak terblokir selama proses sync

2. **Given** `syncService.flush()` dipanggil dan ada pending operations
   **When** `checkConnectivity()` mengkonfirmasi koneksi nyata (ping `/api/health` sukses)
   **Then** semua item `pendingOperations` dikirim ke `POST /api/pos/sync/batch`
   **And** server memproses setiap transaksi menggunakan `unitPrice` dari payload (ADR-003 price-at-time-of-sale)
   **And** setiap transaksi yang berhasil dihapus dari `pendingOperations` di Dexie
   **And** `networkStore.pendingCount` diperbarui ke jumlah sisa
   **And** `networkStore.lastSyncAt` diperbarui ke `Date.now()`
   **And** `networkStore.isSyncing` diset kembali ke `false` (WAJIB di `finally`)

3. **Given** proses sync gagal (server down / jaringan labil / `checkConnectivity()` gagal)
   **When** request terputus atau server merespons error
   **Then** `networkStore.isSyncing` diset `false` (tidak stuck — fix deferred dari Story 1.1)
   **And** retry dijadwalkan secara eksponensial: 1 menit → 2 menit → 5 menit → 15 menit
   **And** tidak ada modal error atau toast berulang yang mengganggu kasir

4. **Given** batch sync menghasilkan respons partial `{ synced: string[], failed: { id: string, reason: string }[] }`
   **When** ada campuran sukses dan gagal
   **Then** hanya ID yang ada di `synced` yang dihapus dari `pendingOperations`
   **And** item di `failed` diperbarui `retryCount++` dan `lastError = reason`
   **And** `networkStore.pendingCount` mencerminkan jumlah yang masih tertunda

5. **Given** `POST /api/pos/sync/batch` menerima payload yang valid
   **When** server memproses batch
   **Then** setiap transaksi dibuat di database dengan `created_offline = true` dan `offline_timestamp` dari `payload.offlineAt`
   **And** stok dikurangi via `StockService.deductStock()` dengan pessimistic locking
   **And** response `{ synced: string[], failed: { id: string, reason: string }[] }` dikembalikan

## Tasks / Subtasks

### POS Desktop

- [x] **Modifikasi `apps/pos-desktop/src/store/network-store.ts`**
  - [x] Tambah `setLastSyncAt: (n: number) => void` ke interface `NetworkState` dan implementasi store

- [x] **Buat `apps/pos-desktop/src/services/sync-service.ts`** (service baru)
  - [x] Implementasi `checkConnectivity(): Promise<boolean>` — ping `GET /api/health`, return `true` jika 200
  - [x] Implementasi `flush(): Promise<void>` — baca semua `pendingOperations`, kirim batch, hapus yang sukses, update yang gagal
  - [x] Implementasi `startAutoSync(): void` — register `window.addEventListener('online', ...)`, trigger `flush()` segera jika online dan ada pending
  - [x] Implementasi `stopAutoSync(): void` — cleanup listener dan retry timer
  - [x] Retry schedule: `[60_000, 120_000, 300_000, 900_000]` ms (1m → 2m → 5m → 15m)
  - [x] `networkStore.setSyncing(false)` WAJIB dipanggil di blok `finally` (bukan hanya di catch)

- [x] **Buat `apps/pos-desktop/src/services/sync-service.test.ts`** (co-located)
  - [x] Test: `flush()` tanpa pending ops — langsung return tanpa API call
  - [x] Test: `flush()` happy path — hapus synced dari Dexie, update `lastSyncAt`
  - [x] Test: `flush()` partial failure — hanya synced dihapus, failed diupdate `retryCount`
  - [x] Test: `checkConnectivity()` return `false` jika `/api/health` gagal

- [x] **Modifikasi `apps/pos-desktop/src/hooks/useBootstrap.ts`**
  - [x] Tambah `useEffect` terpisah: panggil `syncService.startAutoSync()` saat `user` tersedia
  - [x] Return cleanup: `syncService.stopAutoSync()` saat unmount

### Server (Backoffice)

- [x] **Buat `apps/backoffice/app/api/pos/sync/batch/route.ts`**
  - [x] Definisikan Zod schema: `{ deviceId: string, transactions: Array<{ id: string, payload: OfflineTransactionPayload }> }`
  - [x] Loop setiap transaksi: panggil `TransactionService.createTransaction()` dengan `createdOffline: true`
  - [x] Kumpulkan `synced` dan `failed`, return response
  - [x] Error per-item TIDAK boleh menghentikan pemrosesan item berikutnya (try/catch per item)

- [x] **Modifikasi `apps/backoffice/lib/services/transaction-service.ts`**
  - [x] Tambah field opsional `createdOffline?: boolean` dan `offlineTimestamp?: Date` ke parameter `createTransaction`
  - [x] Pass ke `INSERT` statement: `createdOffline: payload.createdOffline ?? false`, `offlineTimestamp: payload.offlineTimestamp ?? null`

## Dev Notes

### Konteks Kritis: Yang Sudah Ada dari Story 1.3 (JANGAN dibuat ulang)

| Yang Ada | Lokasi |
|---|---|
| `offlineQueueService.enqueue()`, `saveLocalTransaction()`, `getPendingCount()` | `src/services/offline-queue-service.ts` |
| `OfflineTransactionPayload` interface (sudah export) | `src/services/offline-queue-service.ts` |
| `PendingOperation` interface (field `retryCount`, `lastError` sudah ada) | `src/lib/db.ts` |
| `networkStore.setSyncing()`, `networkStore.setPendingCount()` | `src/store/network-store.ts` |
| `networkStore.isSyncing` spinner di POSHeader | `src/components/layout/POSHeader.tsx:103-106` |
| `pendingCount` badge saat offline | `src/components/layout/POSHeader.tsx:111-116` |
| `TransactionService.createTransaction()` (server) | `apps/backoffice/lib/services/transaction-service.ts` |
| `/api/health` endpoint | `apps/backoffice/app/api/health/route.ts` |

**Yang BELUM ada — harus dibuat di Story 1.4:**
- `setLastSyncAt` di `networkStore`
- `syncService` (keseluruhan)
- `POST /api/pos/sync/batch` endpoint
- `createdOffline`/`offlineTimestamp` parameter di `TransactionService.createTransaction`

### Anti-Pattern yang DILARANG

```typescript
// ❌ DILARANG: akses Dexie langsung dari luar service
import { getDb } from '@/lib/db'
const db = await getDb()
await db.pendingOperations.toArray() // SALAH

// ✅ BENAR: melalui syncService
import { syncService } from '@/services/sync-service'
await syncService.flush()
```

```typescript
// ❌ DILARANG: isSyncing stuck tanpa finally
setSyncing(true)
try {
  await apiClient(...)
  setSyncing(false) // SALAH — tidak dipanggil jika throw
} catch { }

// ✅ BENAR
setSyncing(true)
try {
  await apiClient(...)
} catch { ... } finally {
  setSyncing(false) // SELALU dipanggil
}
```

### Implementasi `sync-service.ts` yang Diharapkan

```typescript
// apps/pos-desktop/src/services/sync-service.ts
import { getDb } from '@/lib/db'
import { useNetworkStore } from '@/store/network-store'
import { apiClient } from '@/lib/api-client'

const RETRY_DELAYS = [60_000, 120_000, 300_000, 900_000] // 1m, 2m, 5m, 15m

let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryAttempt = 0
let onlineListener: (() => void) | null = null

export const syncService = {
  async checkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  },

  async flush(): Promise<void> {
    const { setSyncing, setPendingCount, setLastSyncAt } = useNetworkStore.getState()

    const db = await getDb()
    const pending = await db.pendingOperations.toArray()

    if (pending.length === 0) return

    const isConnected = await syncService.checkConnectivity()
    if (!isConnected) {
      scheduleRetry()
      return
    }

    setSyncing(true)
    try {
      const result = await apiClient('/pos/sync/batch', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: crypto.randomUUID(), // TODO: ganti dengan persistent device ID saat multi-branch
          transactions: pending.map(op => ({ id: op.id, payload: op.payload })),
        }),
      })

      // Hapus yang berhasil
      if (result.synced?.length > 0) {
        await db.pendingOperations.where('id').anyOf(result.synced).delete()
      }

      // Update yang gagal — increment retryCount dan catat lastError
      for (const failed of result.failed ?? []) {
        const op = pending.find(p => p.id === failed.id)
        if (op) {
          await db.pendingOperations.update(op.id, {
            retryCount: op.retryCount + 1,
            lastError: failed.reason,
          })
        }
      }

      const remainingCount = await db.pendingOperations.count()
      setPendingCount(remainingCount)
      setLastSyncAt(Date.now())
      retryAttempt = 0 // reset pada sukses parsial atau penuh
    } catch (error) {
      scheduleRetry()
      throw new Error('Gagal melakukan sinkronisasi antrean.', { cause: error })
    } finally {
      setSyncing(false) // WAJIB: tidak pernah stuck
    }
  },

  startAutoSync(): void {
    if (onlineListener) return // guard: tidak register dua kali

    onlineListener = () => {
      retryAttempt = 0
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
      syncService.flush().catch(() => {}) // fire-and-forget, error sudah ditangani internal
    }

    window.addEventListener('online', onlineListener)

    // Cek segera saat startup jika sudah online
    if (navigator.onLine) {
      syncService.flush().catch(() => {})
    }
  },

  stopAutoSync(): void {
    if (onlineListener) {
      window.removeEventListener('online', onlineListener)
      onlineListener = null
    }
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    retryAttempt = 0
  },
}

function scheduleRetry(): void {
  const delay = RETRY_DELAYS[Math.min(retryAttempt, RETRY_DELAYS.length - 1)]
  retryAttempt++
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = setTimeout(() => {
    syncService.flush().catch(() => {})
  }, delay)
}
```

**Catatan `apiClient`:** Gunakan instance yang sama dengan `useBootstrap.ts` (`import { apiClient } from '@/lib/api-client'`). Jangan buat HTTP client baru.

**Catatan `checkConnectivity`:** Gunakan `fetch` native bukan `apiClient` untuk health check karena tidak butuh auth header dan perlu AbortSignal timeout. URL `/api/health` mengasumsikan base URL dari environment (sama seperti `apiClient`). Verifikasi base URL dari `apiClient` jika endpoint tidak relative.

### Modifikasi `network-store.ts`

```typescript
// Tambahkan ke interface NetworkState:
setLastSyncAt: (n: number) => void

// Tambahkan ke implementasi store:
setLastSyncAt: (n) => set({ lastSyncAt: n }),
```

### Modifikasi `useBootstrap.ts`

```typescript
import { syncService } from '@/services/sync-service'

export function useBootstrap() {
  // ... existing code tidak berubah ...

  // Tambahkan useEffect baru (TERPISAH dari useEffect bootstrap yang ada):
  useEffect(() => {
    if (!user) return
    syncService.startAutoSync()
    return () => syncService.stopAutoSync()
  }, [user])
}
```

**PENTING:** Jangan modifikasi `useEffect` bootstrap yang sudah ada. Tambahkan `useEffect` baru yang terpisah.

### Server: `POST /api/pos/sync/batch` Route

```typescript
// apps/backoffice/app/api/pos/sync/batch/route.ts
import { NextResponse } from 'next/server'
import { TransactionService } from '@/lib/services/transaction-service'
import { z } from 'zod'

const syncItemSchema = z.object({
  id: z.string(),           // PendingOperation.id dari Dexie (UUID string)
  payload: z.object({
    branchId: z.number(),
    shiftId: z.number(),
    cashierId: z.number().nullable(),
    customerId: z.number().nullable().optional(),
    items: z.array(z.object({
      productId: z.number(),
      productName: z.string(),
      uomId: z.number(),
      uomCode: z.string(),
      qty: z.number().positive(),
      unitPrice: z.number(),      // ADR-003: price-at-time-of-sale dari POS
      priceTier: z.string(),
      discountAmount: z.number(),
      subtotal: z.number(),
      isOwnerOverride: z.boolean(),
    })).min(1),
    totals: z.object({
      subtotal: z.number(),
      discountTotal: z.number(),
      grandTotal: z.number(),
      itemCount: z.number().optional(),
    }),
    amountPaid: z.number(),
    change: z.number(),
    payments: z.array(z.object({
      paymentMethodId: z.number(),
      amount: z.number(),
      referenceNumber: z.string().nullable().optional(),
    })),
    offlineAt: z.number(),        // Unix timestamp ms saat transaksi offline
    localTrxNumber: z.string().optional(),
  }),
})

const batchSyncSchema = z.object({
  deviceId: z.string(),
  transactions: z.array(syncItemSchema).min(1).max(100), // max 100 per batch
})

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = batchSyncSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Payload tidak valid', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { transactions } = parsed.data
    const synced: string[] = []
    const failed: { id: string; reason: string }[] = []

    // Proses satu per satu — error satu item TIDAK menghentikan item berikutnya
    for (const item of transactions) {
      try {
        await TransactionService.createTransaction({
          ...item.payload,
          cashierId: item.payload.cashierId ?? 0, // fallback jika null
          createdOffline: true,
          offlineTimestamp: new Date(item.payload.offlineAt),
        })
        synced.push(item.id)
      } catch (err: any) {
        failed.push({
          id: item.id,
          reason: err.message || 'Gagal memproses transaksi offline',
        })
      }
    }

    return NextResponse.json({ synced, failed })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Gagal memproses batch sinkronisasi' },
      { status: 500 }
    )
  }
}
```

### Modifikasi `TransactionService.createTransaction()`

Tambahkan dua field opsional ke INSERT:

```typescript
// Di dalam createTransaction, bagian INSERT ke tabel transactions:
const [trx] = await tx.insert(transactions).values({
  trxNumber: generateTrxNumber(),
  branchId,
  shiftId,
  cashierId,
  customerId: payload.customerId || null,
  totalAmount: totals.subtotal.toString(),
  discountAmount: totals.discountTotal.toString(),
  taxAmount: '0',
  payableAmount: totals.grandTotal.toString(),
  paidAmount: totalPaymentAmount.toString(),
  changeAmount: change.toString(),
  status: 'COMPLETED',
  createdOffline: payload.createdOffline ?? false,    // TAMBAHKAN
  offlineTimestamp: payload.offlineTimestamp ?? null, // TAMBAHKAN
}).returning()
```

**Catatan ADR-003:** `TransactionService.createTransaction()` sudah menggunakan `item.unitPrice` dari payload sebagai harga transaksi (`transactionItems`). Ini benar — server tidak perlu re-fetch harga saat ini. Price-at-time-of-sale sudah preserved karena `unitPrice` dikirim dari POS saat transaksi terjadi.

### Perhatian: Dexie `pendingOperations` Primary Key

Schema Dexie: `pendingOperations: "++id, type, createdAt"` — artinya `id` adalah auto-increment.
Namun `PendingOperation.id` didefinisikan sebagai `string` (UUID dari `crypto.randomUUID()`).

**Gunakan `where('id').anyOf(synced).delete()` untuk menghapus:**
```typescript
// ✅ Aman — query berbasis keyPath
await db.pendingOperations.where('id').anyOf(result.synced).delete()

// ⚠️  Hindari bulkDelete jika tidak yakin tentang key type
// await db.pendingOperations.bulkDelete(result.synced)
```

Gunakan juga `db.pendingOperations.where('id').equals(op.id).modify(...)` jika `update(op.id, ...)` bermasalah.

### `cashierId` Nullable di Sync Payload

`OfflineTransactionPayload.cashierId` bisa `null`. `TransactionService.createTransaction()` membutuhkan `cashierId: number` non-nullable (FK ke `users.id`). Pada route `/sync/batch`, gunakan fallback:
```typescript
cashierId: item.payload.cashierId ?? 0
```
Nilai `0` adalah fallback sementara — cashier seharusnya selalu ada saat shift aktif. Ini bukan bug baru (pre-existing dari PaymentDialog hardcoded `branchId: 1`).

### File yang Harus Dibuat / Dimodifikasi

| File | Status | Keterangan |
|---|---|---|
| `apps/pos-desktop/src/services/sync-service.ts` | **BARU** | Service utama story ini |
| `apps/pos-desktop/src/services/sync-service.test.ts` | **BARU** | Co-located test |
| `apps/pos-desktop/src/store/network-store.ts` | **MODIFY** | Tambah `setLastSyncAt` |
| `apps/pos-desktop/src/hooks/useBootstrap.ts` | **MODIFY** | Tambah useEffect sync lifecycle |
| `apps/backoffice/app/api/pos/sync/batch/route.ts` | **BARU** | Endpoint server batch sync |
| `apps/backoffice/lib/services/transaction-service.ts` | **MODIFY** | Tambah `createdOffline`/`offlineTimestamp` |

**Jangan modifikasi:**
- `src/lib/db.ts` — schema Dexie tidak berubah
- `src/services/offline-queue-service.ts` — sudah selesai di Story 1.3
- `src/components/layout/POSHeader.tsx` — UI sudah siap (spinner & badge sudah ada)
- `src/components/pos/PaymentDialog.tsx` — bukan scope story ini

### Learnings dari Story 1.3

- **Pattern service**: export sebagai object literal (`export const syncService = { ... }`) — bukan class
- **Error messages user-facing**: wajib Bahasa Indonesia di `throw new Error('...')`
- **`getDb()` concurrent safe**: menggunakan `dbInitPromise` pattern, aman dipanggil bersamaan
- **Test file**: co-located di sebelah source file, bukan folder `__tests__`
- **Hindari `any` type**: gunakan interface eksplisit
- **Bare `catch {}` DILARANG**: selalu `throw new Error('...', { cause: error })`
- **Module-level singleton state** (`retryTimer`, `retryAttempt`, `onlineListener`): reset di `stopAutoSync()` dan dalam test dengan `vi.resetModules()` atau reset manual

### Deferred Items yang Diselesaikan di Story 1.4

Dari `_bmad-output/implementation-artifacts/deferred-work.md`:
1. ✅ **`isSyncing` stuck spinner** — Fix: `setSyncing(false)` di blok `finally` di `syncService.flush()`
2. ✅ **`navigator.onLine` false positive** — Fix: `checkConnectivity()` ping ke `/api/health` sebelum sync
3. ✅ **Debounce 300ms stale window** — Sebagian dimitigasi: `checkConnectivity()` memverifikasi sebelum sync dimulai

### Pola Mock untuk Test (`sync-service.test.ts`)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock module-level state reset
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

vi.mock('@/lib/db', () => ({
  getDb: vi.fn().mockResolvedValue({
    pendingOperations: {
      toArray: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      where: vi.fn().mockReturnThis(),
      anyOf: vi.fn().mockReturnThis(),
      delete: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    },
  }),
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn(),
}))

// Mock fetch untuk checkConnectivity
global.fetch = vi.fn().mockResolvedValue({ ok: true })
```

### Scope Batasan — Story Ini TIDAK Mencakup

- Tampil riwayat transaksi di halaman History → Story 2.1
- Void transaksi → Story 4.1
- Notifikasi Owner untuk status sinkronisasi → Story 5.2
- `referenceNumber` fix untuk kartu/transfer (deferred dari 1.3)
- `branchId` hardcoded fix (deferred, pre-existing)
- Kolom schema baru `price_at_sale_time`/`had_price_discrepancy` di PostgreSQL → Post-MVP
- Persistent `deviceId` untuk multi-branch → Post-MVP

## Referensi Konteks Proyek

- `apps/pos-desktop/src/services/offline-queue-service.ts` — `OfflineTransactionPayload`, `getPendingCount()`
- `apps/pos-desktop/src/lib/db.ts` — `PendingOperation` interface, `getDb()`, schema Dexie
- `apps/pos-desktop/src/store/network-store.ts` — `useNetworkStore`, target modifikasi
- `apps/pos-desktop/src/hooks/useBootstrap.ts` — target modifikasi lifecycle
- `apps/pos-desktop/src/services/bootstrap-service.ts` — pola object literal service
- `apps/backoffice/app/api/pos/transactions/route.ts` — pola endpoint yang diikuti
- `apps/backoffice/lib/services/transaction-service.ts` — `TransactionService.createTransaction()`
- `apps/backoffice/app/api/health/route.ts` — endpoint heartbeat check
- `packages/shared/src/types/cart.ts` — `CartItem`, `CartTotals`
- `_bmad-output/planning-artifacts/architecture.md` — ADR-002, ADR-003, NFR-R2
- `_bmad-output/implementation-artifacts/deferred-work.md` — deferred items yang diselesaikan di story ini

## Dev Agent Record

### Agent Model Used
Gemini 3 Flash (Antigravity)

### Debug Log References
_TBD_

### Completion Notes List
- Implementasi `syncService` untuk sinkronisasi otomatis transaksi offline ke server.
- Penanganan konektivitas riil menggunakan ping `/api/health`.
- Pengiriman batch ke endpoint server baru `/api/pos/sync/batch`.
- Mekanisme retry eksponensial (1m, 2m, 5m, 15m) untuk kegagalan sinkronisasi.
- Update `networkStore` untuk melacak `lastSyncAt` dan status `isSyncing`.
- Integrasi lifecycle di `useBootstrap` untuk memulai/menghentikan sinkronisasi otomatis.
- Server-side support untuk menyimpan transaksi dengan flag `created_offline`.

### File List
- `apps/pos-desktop/src/services/sync-service.ts`
- `apps/pos-desktop/src/services/sync-service.test.ts`
- `apps/pos-desktop/src/store/network-store.ts`
- `apps/pos-desktop/src/hooks/useBootstrap.ts`
- `apps/backoffice/app/api/pos/sync/batch/route.ts`
- `apps/backoffice/lib/services/transaction-service.ts`

### Review Findings

- [x] [Review][Patch] ID Perangkat Acak: deviceId menggunakan UUID baru setiap kali sinkronisasi dilakukan [sync-service.ts:46]
- [x] [Review][Patch] Loop Retry Tak Terbatas: Item yang gagal ditandai dengan retryCount++ tapi tetap dikirim di setiap batch berikutnya tanpa batas maksimum [sync-service.ts:54-62]
- [x] [Review][Patch] Reset Retry Attempt: retryAttempt tidak direset jika terjadi error konektivitas di luar API call [sync-service.ts:35-38]
- [x] [Review][Patch] Fallback Cashier ID: Penggunaan 0 sebagai fallback berisiko menyebabkan error Foreign Key [route.ts:70]
- [x] [Review][Patch] Race Condition Startup: Sinkronisasi bisa dimulai sebelum data master selesai dimuat [useBootstrap.ts:13-17]
- [x] [Review][Patch] Validasi Health Check: Hanya mengecek response.ok, tidak memverifikasi asal response [sync-service.ts:18-20]
- [x] [Review][Patch] Penanganan Error DB: Jika database korup, pembacaan pendingOperations akan crash [sync-service.ts:31-33]
- [x] [Review][Defer] Risiko Kehilangan Key Enkripsi [db.ts:140-155] — deferred, pre-existing
- [x] [Review][Defer] Verifikasi Skema Server [transaction-service.ts] — deferred, pre-existing

### Additional Findings (2026-04-28)

- [x] [Review][Patch] Duplicate Transactions during Sync Retry [transaction-service.ts] — FIXED: Use localTrxNumber as trxNumber for offline transactions to prevent duplicates.
- [x] [Review][Patch] Race Condition in flush() [sync-service.ts] — FIXED: Added isSyncing check at the beginning of flush().
- [x] [Review][Patch] Missing Error Cause [sync-service.ts] — FIXED: Added { cause: error } to throw statement.
- [ ] [Review][Decision] Handling of "Dead" Transactions — Transactions failing > 10 times are hidden from sync. Need UI/Notification plan.

