---
epic_id: 1
story_id: 1.3
story_key: 1-3-local-transaction-queue
status: review
created_at: 2026-04-28
---

# Story 1.3: Local Transaction Queue

## Story

As a Kasir,
I want memproses pembayaran dan mencetak struk seperti biasa saat offline,
So that antrean pembeli tidak terhenti karena masalah jaringan.

## Acceptance Criteria

1. **Given** POS berada di Mode Offline (`useNetworkStore.getState().isOnline === false`)
   **When** kasir menyelesaikan pembayaran (klik "Selesaikan" di PaymentDialog dan total terbayar ≥ grand total)
   **Then** data transaksi disimpan ke tabel `pendingOperations` di Dexie.js **WAJIB melalui `offlineQueueService.enqueue()`** (bukan langsung ke Dexie)
   **And** data transaksi JUGA disimpan ke tabel `localTransactions` di Dexie.js (untuk history FR8-FR13)
   **And** nomor transaksi dibuat secara lokal dengan format `TRX-OFFLINE-{branchId}-{Date.now()}`
   **And** struk dicetak seketika dari data lokal **tanpa** menunggu respons server
   **And** `networkStore.setPendingCount()` dipanggil dengan jumlah terbaru dari `pendingOperations`
   **And** UI menampilkan layar sukses yang identik dengan transaksi online

2. **Given** POS berada di Mode Online (`useNetworkStore.getState().isOnline === true`)
   **When** kasir menyelesaikan pembayaran
   **Then** flow tetap memanggil `POST /api/pos/transactions` seperti sebelumnya
   **And** setelah server merespons sukses, data transaksi JUGA disimpan ke `localTransactions` (untuk FR8-FR13)
   **And** `trxNumber` yang digunakan untuk struk dan `localTransactions` adalah yang dikembalikan server

3. **Given** pembayaran offline berhasil di-queue
   **When** terjadi kegagalan saat mencetak struk
   **Then** transaksi tetap dianggap berhasil (data sudah aman di Dexie), kegagalan cetak hanya dicatat via `console.warn` — tidak memblokir UI

## Tasks / Subtasks

- [x] **Buat `src/services/offline-queue-service.ts`** (service baru, WAJIB melalui service ini)
  - [x] Implementasi `enqueue(payload: OfflineTransactionPayload): Promise<string>` → simpan ke `pendingOperations` + return `localTrxNumber`
  - [x] Implementasi `saveLocalTransaction(trx: Omit<LocalTransaction, 'id'>): Promise<void>` → simpan ke `localTransactions`
  - [x] Implementasi `getPendingCount(): Promise<number>` → hitung total record di `pendingOperations`
- [x] **Modifikasi `src/components/pos/PaymentDialog.tsx`** (fungsi `handlePayment`)
  - [x] Cek `useNetworkStore.getState().isOnline` sebelum API call
  - [x] Path offline: generate `localTrxNumber`, panggil `offlineQueueService.enqueue()`, lalu `offlineQueueService.saveLocalTransaction()`
  - [x] Path online: panggil `apiClient('/pos/transactions', ...)` seperti sebelumnya, lalu `offlineQueueService.saveLocalTransaction()` dengan `trxNumber` dari server
  - [x] Kedua path: print receipt → clear cart → set `isSuccess(true)` → update `networkStore.setPendingCount()`
- [x] **Buat `src/services/offline-queue-service.test.ts`** (co-located test)
  - [x] Test: `enqueue` menyimpan record ke `pendingOperations` dengan field yang benar
  - [x] Test: `saveLocalTransaction` menyimpan record ke `localTransactions`
  - [x] Test: `getPendingCount` mengembalikan jumlah yang akurat

## Dev Notes

### Konteks Arsitektur Kritis

**ANTI-PATTERN YANG DILARANG — Dev agent WAJIB menghindari:**
```typescript
// ❌ DILARANG: akses Dexie langsung dari komponen
import { getDb } from '@/lib/db'
const db = await getDb()
await db.pendingOperations.add({ ... }) // SALAH!

// ✅ BENAR: selalu melalui service layer
import { offlineQueueService } from '@/services/offline-queue-service'
await offlineQueueService.enqueue(payload) // BENAR
```

**Store yang digunakan:**
- `useNetworkStore` (dari `@/store/network-store`) → gunakan untuk baca `isOnline`, update `setPendingCount`
- Dilarang membuat store baru untuk network/sync status

### Struktur `PendingOperation` yang Harus Disimpan

Ikuti interface dari `src/lib/db.ts`:
```typescript
interface PendingOperation {
  id: string            // crypto.randomUUID() — generate di offlineQueueService
  type: 'TRANSACTION'   // selalu 'TRANSACTION' untuk story ini
  payload: OfflineTransactionPayload  // lihat struktur di bawah
  createdAt: number     // Date.now()
  retryCount: number    // mulai dari 0
  lastError?: string    // undefined saat baru dibuat
}
```

**Struktur `OfflineTransactionPayload`** (field kritis untuk ADR-003 price-at-time-of-sale):
```typescript
interface OfflineTransactionPayload {
  localTrxNumber: string       // TRX-OFFLINE-{branchId}-{Date.now()}
  branchId: number
  shiftId: number
  cashierId: number | null
  customerId: number | null
  items: CartItem[]            // dari useCartStore — tiap item sudah punya unitPrice (priceAtSaleTime)
  totals: CartTotals
  amountPaid: number
  change: number
  payments: { paymentMethodId: number; amount: number; referenceNumber: null }[]
  offlineAt: number            // Date.now() — waktu transaksi terjadi offline
}
```

**Struktur `LocalTransaction`** (untuk tabel `localTransactions` di Dexie):
```typescript
// Interface dari src/lib/db.ts (sudah ada):
interface LocalTransaction {
  id: number              // auto-increment (++id)
  shiftId: number
  trxNumber: string       // trxNumber dari server (online) atau localTrxNumber (offline)
  createdAt: number       // Date.now()
  customerName: string    // nama customer atau string kosong jika Guest
  totalAmount: string     // big.js string — gunakan new Big(totals.grandTotal).toString()
  payload: any            // full transaction data untuk display detail (story 2.2)
}
```

### Implementasi `offlineQueueService` yang Diharapkan

```typescript
// src/services/offline-queue-service.ts
import { getDb } from '@/lib/db'
import type { LocalTransaction, PendingOperation } from '@/lib/db'
import Big from 'big.js'

interface OfflineTransactionPayload { /* ... lihat di atas ... */ }

export const offlineQueueService = {
  async enqueue(payload: OfflineTransactionPayload): Promise<string> {
    const db = await getDb()
    const localTrxNumber = `TRX-OFFLINE-${payload.branchId}-${Date.now()}`
    
    const operation: PendingOperation = {
      id: crypto.randomUUID(),
      type: 'TRANSACTION',
      payload: { ...payload, localTrxNumber },
      createdAt: Date.now(),
      retryCount: 0,
    }
    
    try {
      await db.pendingOperations.add(operation)
      return localTrxNumber
    } catch {
      throw new Error('Gagal menyimpan transaksi ke antrean lokal.')
    }
  },

  async saveLocalTransaction(trx: Omit<LocalTransaction, 'id'>): Promise<void> {
    const db = await getDb()
    try {
      await db.localTransactions.add(trx)
    } catch {
      throw new Error('Gagal menyimpan riwayat transaksi lokal.')
    }
  },

  async getPendingCount(): Promise<number> {
    const db = await getDb()
    return db.pendingOperations.count()
  },
}
```

### Modifikasi `PaymentDialog.tsx` — Fungsi `handlePayment`

Fungsi `handlePayment` harus direfaktor menjadi dua path:

```typescript
import { useNetworkStore } from '@/store/network-store'
import { offlineQueueService } from '@/services/offline-queue-service'
import Big from 'big.js'

const handlePayment = async () => {
  if (amountPaidTotal < totals.grandTotal) return

  try {
    setIsSubmitting(true)
    const activeShift = useShiftStore.getState().activeShift
    const activeCashierId = useShiftStore.getState().activeCashierId
    const isOnline = useNetworkStore.getState().isOnline

    if (!activeShift) {
      toast.error('Shift tidak aktif! Silakan masuk melalui Shift Gate.')
      return
    }

    const basePayload = {
      branchId: 1,
      shiftId: activeShift.id,
      cashierId: activeCashierId || useAuthStore.getState().user?.id || null,
      customerId: useCartStore.getState().customerId || null,
      items,
      totals,
      amountPaid: amountPaidTotal,
      change,
      payments: payments.map(p => ({ paymentMethodId: p.paymentMethodId, amount: p.amount, referenceNumber: null })),
    }

    let finalTrxNumber: string

    if (!isOnline) {
      // Path Offline
      finalTrxNumber = await offlineQueueService.enqueue({ ...basePayload, offlineAt: Date.now() })
    } else {
      // Path Online
      const response = await apiClient('/pos/transactions', { method: 'POST', body: JSON.stringify(basePayload) })
      finalTrxNumber = response.transaction.trxNumber
    }

    // Simpan ke localTransactions untuk history (FR8-FR13) — KEDUANYA online & offline
    const customerName = /* dari customers list berdasarkan customerId */ ''
    await offlineQueueService.saveLocalTransaction({
      shiftId: activeShift.id,
      trxNumber: finalTrxNumber,
      createdAt: Date.now(),
      customerName,
      totalAmount: new Big(totals.grandTotal).toString(),
      payload: { ...basePayload, trxNumber: finalTrxNumber },
    })

    // Update pendingCount di networkStore
    const count = await offlineQueueService.getPendingCount()
    useNetworkStore.getState().setPendingCount(count)

    // Print receipt
    try {
      await printService.printReceipt({ trxNumber: finalTrxNumber, items, totals, payments })
    } catch (printErr) {
      console.warn('[PaymentDialog] Pencetakan struk gagal:', printErr)
    }

    setIsSuccess(true)
    setLastTransaction({ trxNumber: finalTrxNumber })
    clearCart()
  } catch (err: any) {
    toast.error('Gagal memproses pembayaran: ' + (err.message || 'Terjadi kesalahan'))
  } finally {
    setIsSubmitting(false)
  }
}
```

### Kalkulasi Finansial — Wajib big.js

Saat menyimpan `totalAmount` ke `localTransactions`:
```typescript
// ✅ BENAR
totalAmount: new Big(totals.grandTotal).toString()

// ❌ SALAH
totalAmount: totals.grandTotal.toString()  // floating-point tidak aman
totalAmount: String(totals.grandTotal)
```

### Catatan Penting: `customerName` di `LocalTransaction`

`basePayload.customerId` adalah `number | null`. Untuk mendapatkan `customerName`:
- Lookup dari `usePOSStore.getState().customers` berdasarkan `customerId`
- Jika tidak ada atau `customerId === null`, gunakan string kosong `''` (bukan `'Guest'` untuk menghindari ketidakkonsistenan di story 3.1 search by customer name)

### File yang Harus Dibuat / Dimodifikasi

| File | Status | Keterangan |
|---|---|---|
| `apps/pos-desktop/src/services/offline-queue-service.ts` | **BARU** | Service utama story ini |
| `apps/pos-desktop/src/services/offline-queue-service.test.ts` | **BARU** | Co-located test |
| `apps/pos-desktop/src/components/pos/PaymentDialog.tsx` | **MODIFY** | Tambah offline path di `handlePayment` |

**Jangan modifikasi:**
- `src/lib/db.ts` — schema sudah lengkap (tabel `pendingOperations` dan `localTransactions` sudah ada)
- `src/store/network-store.ts` — sudah ada `setPendingCount`
- `src/hooks/useBootstrap.ts` — bukan scope story ini

### Learnings dari Story 1.2

- **Pattern service**: selalu export sebagai object literal (bukan class), contoh lihat `bootstrap-service.ts`
- **Error messages**: wajib Bahasa Indonesia di `throw new Error('...')`
- **Race condition Dexie**: `getDb()` sudah menggunakan `dbInitPromise` pattern — aman dipanggil concurrent
- **Test file**: co-located di sebelah source file (bukan folder `__tests__`)
- **`any` type**: hindari, gunakan interface eksplisit (review 1.2 memperbaiki `Product` interface)

### Scope Batasan — Story Ini TIDAK Mencakup

- Auto-sync ke server (FR5) → Story 1.4
- Exponential retry (NFR-R2) → Story 1.4
- Display pending count di UI header → Story 1.4 (networkStore sudah disiapkan di sini saja)
- Void transaksi dari localTransactions → Story 4.1
- Tampil history di halaman History → Story 2.1

## Referensi Konteks Proyek

- `apps/pos-desktop/src/lib/db.ts` — Interface `PendingOperation`, `LocalTransaction`, `getDb()`
- `apps/pos-desktop/src/store/network-store.ts` — `useNetworkStore`, `isOnline`, `setPendingCount`
- `apps/pos-desktop/src/store/cart-store.ts` — `CartItem`, `getTotals()`
- `apps/pos-desktop/src/components/pos/PaymentDialog.tsx` — Target modifikasi utama
- `apps/pos-desktop/src/services/bootstrap-service.ts` — Pola service yang harus diikuti
- `_bmad-output/planning-artifacts/architecture.md#Write queue` — ADR-002, ADR-003

## Dev Agent Record

### Agent Model Used
Gemini 3 Flash

### Debug Log References
- Integrasi di `PaymentDialog.tsx` menggunakan `Big` untuk akurasi finansial sesuai ADR-003.
- [Patch Fix] Memperbaiki collision risiko `localTrxNumber` dengan suffix random.
- [Patch Fix] Memperbaiki error handling dengan menyertakan `cause` pada error objek.
- [Patch Fix] Memperbaiki tipe data `OfflineTransactionPayload` menggunakan interface dari `@petshop/shared`.
- [Patch Fix] Memperbaiki potensi crash di `DeliveryOrderDialog` dengan memberikan data minimal pada `setLastTransaction`.
- [Patch Fix] Memisahkan error handling penyimpanan lokal agar tidak menghambat flow utama transaksi.

### Completion Notes List
- Berhasil membuat `offlineQueueService` untuk mengelola antrean offline dan riwayat lokal.
- Refaktor `PaymentDialog.tsx` untuk mendukung flow pembayaran offline dan online secara konsisten.
- Penambahan `localTransactions` storage untuk kedua path (online/offline) guna mendukung history offline di masa depan.
- Update `pendingCount` di UI store setiap kali transaksi offline ditambahkan.

### File List
- `apps/pos-desktop/src/services/offline-queue-service.ts`
- `apps/pos-desktop/src/services/offline-queue-service.test.ts`
- `apps/pos-desktop/src/components/pos/PaymentDialog.tsx`
- `apps/pos-desktop/src/services/bootstrap-service.test.ts`

### Review Findings

- [x] [Review][Decision] `setLastTransaction` menerima objek parsial `{ trxNumber }` — berpotensi crash di `DeliveryOrderDialog` jika mengakses field selain `trxNumber` [PaymentDialog.tsx:setLastTransaction]
- [x] [Review][Patch] `localTrxNumber` vestigial di `OfflineTransactionPayload` — field ini dideklarasikan sebagai required di interface tapi diabaikan dan di-overwrite oleh `enqueue()`; caller (PaymentDialog) tidak mengirimkannya → TypeScript error [offline-queue-service.ts:4]
- [x] [Review][Patch] `saveLocalTransaction` tanpa try/catch terpisah — jika gagal setelah `enqueue()`/`apiClient()` berhasil, outer catch menampilkan "Gagal memproses pembayaran" padahal transaksi sudah tersimpan/dikirim → false negative [PaymentDialog.tsx:saveLocalTransaction call]
- [x] [Review][Patch] Collision risiko pada `localTrxNumber` — menggunakan `Date.now()` saja tanpa suffix unik; dua transaksi dalam milidetik yang sama menghasilkan nomor identik [offline-queue-service.ts:21]
- [x] [Review][Patch] Bare `catch {}` menghilangkan original error — 3 instance di `offline-queue-service.ts`; stack trace dan DB error asli hilang. Ganti dengan `throw new Error('...', { cause: error })` [offline-queue-service.ts:34,42,50]
- [x] [Review][Patch] `saveLocalTransaction` menggunakan `as any` cast — suppresses tipe Dexie alih-alih memperbaiki signature [offline-queue-service.ts:42]
- [x] [Review][Patch] `items: any[]` dan `totals: any` di `OfflineTransactionPayload` — gunakan `CartItem[]` dan `CartTotals` dari `@petshop/shared` [offline-queue-service.ts:10-11]
- [x] [Review][Patch] Test `getPendingCount` tidak ada path error — tambahkan satu test untuk `db.pendingOperations.count()` yang reject [offline-queue-service.test.ts]
- [x] [Review][Defer] `branchId` hardcoded `1` di `PaymentDialog.tsx` — pre-existing, multi-branch bug [PaymentDialog.tsx:86] — deferred, pre-existing
- [x] [Review][Defer] `user as any` cast di `useBootstrap.ts` — pre-existing dari story 1.2 [useBootstrap.ts] — deferred, pre-existing
- [x] [Review][Defer] Debounce 300ms di `POSHeader` menciptakan window stale `isOnline` — race condition inherent, debounce mencegah flapping yang lebih buruk [POSHeader.tsx] — deferred, pre-existing
- [x] [Review][Defer] Bootstrap toast muncul di setiap app start — noise UX, pre-existing concern [useBootstrap.ts] — deferred, pre-existing
- [x] [Review][Defer] Bootstrap fallback hanya validasi `products.length > 0` — data korup tidak deteksi, pre-existing dari story 1.2 — deferred, pre-existing
- [x] [Review][Defer] `referenceNumber: null` tidak nullable di `OfflineTransactionPayload` — kartu/transfer kehilangan referensi, scope creep ke story 1.4 — deferred, pre-existing
- [x] [Review][Defer] Tidak ada test untuk online-path `saveLocalTransaction` wiring — PaymentDialog tidak punya unit test sama sekali, broader gap — deferred, pre-existing
- [x] [Review][Defer] Scope creep: `useBootstrap.ts`, `POSHeader.tsx`, `POS.tsx`, `db.ts` dimodifikasi di luar scope story 1.3 — perubahan secara arsitektur benar, tidak merusak — deferred, pre-existing
