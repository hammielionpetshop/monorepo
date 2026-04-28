---
epic_id: 2
story_id: 2.1
story_key: 2-1-view-local-transaction-history
status: ready-for-dev
created_at: 2026-04-28
---

# Story 2.1: View Local Transaction History

## Story

As a Kasir,
I want melihat daftar transaksi yang diproses di perangkat ini pada hari yang sama,
So that saya dapat memverifikasi penjualan terbaru secara instan.

## Acceptance Criteria

1. **Given** Kasir membuka halaman History (via `/history`)
   **When** halaman dimuat
   **Then** aplikasi menampilkan daftar transaksi hari ini dari `localTransactions` di Dexie.js lokal
   **And** setiap baris memuat: waktu transaksi, nomor struk, total harga, dan metode pembayaran
   **And** daftar diurutkan terbaru di atas (descending `createdAt`)
   **And** data dimuat dalam waktu < 200ms (NFR-P1)

2. **Given** tidak ada transaksi hari ini di `localTransactions`
   **When** halaman History dimuat
   **Then** aplikasi menampilkan pesan kosong "Tidak ada transaksi hari ini"
   **And** tidak ada error yang muncul

3. **Given** kasir sedang di halaman POS, Dashboard, atau halaman lain
   **When** mereka mengklik link/ikon "History" di header
   **Then** navigasi menuju `/history` dan halaman History dimuat

## Tasks / Subtasks

- [ ] **Buat `apps/pos-desktop/src/services/history-service.ts`** (service baru, sesuai arsitektur)
  - [ ] Implementasi `getTodayTransactions(): Promise<LocalTransaction[]>` — query `createdAt` antara awal dan akhir hari ini, urutan descending
  - [ ] Implementasi `getTransactionsByDate(date: Date): Promise<LocalTransaction[]>` — query untuk tanggal tertentu (dipakai Story 3.2, buat sekarang agar Story 3.2 tidak perlu rewrite service)

- [ ] **Buat `apps/pos-desktop/src/services/history-service.test.ts`** (co-located)
  - [ ] Test: `getTodayTransactions()` hanya mengembalikan record yang `createdAt` ada di hari ini
  - [ ] Test: `getTodayTransactions()` mengembalikan array kosong jika tidak ada data
  - [ ] Test: urutan hasil — terbaru dahulu (descending)

- [ ] **Buat `apps/pos-desktop/src/pages/History.tsx`** (page baru)
  - [ ] Load data via `historyService.getTodayTransactions()` dengan `useEffect`
  - [ ] Tampilkan loading state selama fetch
  - [ ] Tampilkan daftar transaksi: Waktu | Nomor Struk | Pelanggan | Total | Metode Pembayaran
  - [ ] Tampilkan empty state jika tidak ada data
  - [ ] Mapping `paymentMethodId` → nama metode via `usePOSStore().paymentMethods`
  - [ ] Gunakan `POSLayout` sebagai wrapper

- [ ] **Modifikasi `apps/pos-desktop/src/App.tsx`**
  - [ ] Tambahkan route `/history` yang merender `<History />`

- [ ] **Modifikasi `apps/pos-desktop/src/components/layout/POSHeader.tsx`**
  - [ ] Tambahkan link navigasi ke `/history` dengan ikon `ClipboardList`

- [ ] **Modifikasi `apps/pos-desktop/src/pages/Dashboard.tsx`**
  - [ ] Tambahkan menu item "Riwayat Transaksi" dengan path `/history`, icon `ClipboardList`

## Dev Notes

### Konteks Kritis

**`localTransactions` di Dexie — sumber data utama story ini:**

Tabel: `localTransactions: "++id, *shiftId, createdAt, customerName"`

Interface dari `src/lib/db.ts`:
```typescript
interface LocalTransaction {
  id: number              // auto-increment
  shiftId: number
  trxNumber: string       // dari server (online) atau TRX-OFFLINE-* (offline)
  createdAt: number       // Unix timestamp ms — Date.now()
  customerName: string    // nama customer atau string kosong
  totalAmount: string     // big.js string (ex: "150000")
  payload: any            // full transaction data untuk Story 2.2 detail
}
```

**`payload` yang tersimpan di `localTransactions`** (ditulis oleh `PaymentDialog.tsx`):
```typescript
payload: {
  ...basePayload,         // branchId, shiftId, cashierId, customerId
  trxNumber: finalTrxNumber,
  items: CartItem[],      // detail barang
  totals: CartTotals,     // subtotal, discountTotal, grandTotal, itemCount
  amountPaid: number,
  change: number,
  payments: [{ paymentMethodId: number, amount: number, referenceNumber: null }]
}
```

**Untuk Story 2.1**, field yang digunakan dari `LocalTransaction`:
- `trxNumber` — nomor struk
- `createdAt` → format ke `HH:mm`
- `customerName` — nama pelanggan (string kosong jika guest)
- `totalAmount` → `formatRupiah(parseFloat(trx.totalAmount))`
- `payload.payments` → lookup nama via `paymentMethods`

### Anti-Pattern yang DILARANG

```typescript
// ❌ DILARANG: akses Dexie langsung dari komponen
import { getDb } from '@/lib/db'
const db = await getDb()
await db.localTransactions.toArray() // SALAH

// ✅ BENAR: melalui historyService
import { historyService } from '@/services/history-service'
const trxList = await historyService.getTodayTransactions()
```

### Implementasi `history-service.ts` yang Diharapkan

```typescript
// apps/pos-desktop/src/services/history-service.ts
import { getDb } from '@/lib/db'
import type { LocalTransaction } from '@/lib/db'

function getDayRange(date: Date): { startMs: number; endMs: number } {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return { startMs: start.getTime(), endMs: end.getTime() }
}

export const historyService = {
  async getTodayTransactions(): Promise<LocalTransaction[]> {
    return historyService.getTransactionsByDate(new Date())
  },

  async getTransactionsByDate(date: Date): Promise<LocalTransaction[]> {
    const db = await getDb()
    const { startMs, endMs } = getDayRange(date)
    try {
      // where('createdAt') menggunakan index — O(log n), memenuhi NFR-P1 < 200ms
      return await db.localTransactions
        .where('createdAt')
        .between(startMs, endMs, true, true)
        .reverse()   // descending: terbaru di atas
        .toArray()
    } catch (error) {
      throw new Error('Gagal memuat riwayat transaksi.', { cause: error })
    }
  },
}
```

### Implementasi `History.tsx` yang Diharapkan

```typescript
// apps/pos-desktop/src/pages/History.tsx
import React, { useEffect, useState } from 'react'
import { POSLayout } from '@/components/layout/POSLayout'
import { historyService } from '@/services/history-service'
import { usePOSStore } from '@/store/pos-store'
import { formatRupiah } from '@/lib/utils'
import type { LocalTransaction } from '@/lib/db'
import { ClipboardList, Loader2 } from 'lucide-react'

export const HistoryPage: React.FC = () => {
  const { paymentMethods } = usePOSStore()
  const [transactions, setTransactions] = useState<LocalTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    historyService.getTodayTransactions()
      .then(setTransactions)
      .catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  const getPaymentMethodName = (trx: LocalTransaction): string => {
    const payments = trx.payload?.payments ?? []
    if (payments.length === 0) return '—'
    if (payments.length > 1) return 'Split'
    const method = paymentMethods.find((m: any) => m.id === payments[0].paymentMethodId)
    return method?.name ?? '—'
  }

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <POSLayout>
      <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="mb-8 pb-4 border-b border-white/5">
          <div className="flex items-center space-x-3 mb-1">
            <ClipboardList className="w-6 h-6 text-brand-400" />
            <h1 className="text-2xl font-black text-white">Riwayat Transaksi</h1>
          </div>
          <p className="text-neutral-500 text-sm font-medium">{today}</p>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ClipboardList className="w-12 h-12 text-neutral-700 mb-4" />
            <p className="text-neutral-500 font-bold">Tidak ada transaksi hari ini</p>
            <p className="text-neutral-600 text-sm mt-1">Transaksi yang diproses akan muncul di sini</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table Header */}
            <div className="grid grid-cols-5 gap-4 px-4 py-2 text-[11px] font-black text-neutral-500 uppercase tracking-widest">
              <span>Waktu</span>
              <span>Nomor Struk</span>
              <span>Pelanggan</span>
              <span className="text-right">Total</span>
              <span>Metode Bayar</span>
            </div>

            {/* Transaction Rows */}
            {transactions.map((trx) => (
              <div
                key={trx.id}
                className="grid grid-cols-5 gap-4 px-4 py-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors cursor-default"
              >
                <span className="text-sm font-mono text-neutral-300">{formatTime(trx.createdAt)}</span>
                <span className="text-sm font-bold text-white truncate">{trx.trxNumber}</span>
                <span className="text-sm text-neutral-400 truncate">{trx.customerName || '—'}</span>
                <span className="text-sm font-bold text-emerald-400 text-right">{formatRupiah(parseFloat(trx.totalAmount))}</span>
                <span className="text-sm text-neutral-300">{getPaymentMethodName(trx)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </POSLayout>
  )
}

export default HistoryPage
```

### Modifikasi `App.tsx`

```typescript
// Tambahkan import
import { HistoryPage } from './pages/History'

// Tambahkan route (di dalam <Routes>, setelah route /dashboard):
<Route
  path="/history"
  element={
    <ProtectedRoute>
      <HistoryPage />
    </ProtectedRoute>
  }
/>
```

### Modifikasi `POSHeader.tsx`

Tambahkan import `ClipboardList` dan link navigasi ke History:

```typescript
// Tambahkan ClipboardList ke import lucide-react
import { ..., ClipboardList } from 'lucide-react'

// Tambahkan Link setelah link Dashboard (baris ~83):
<Link
  to="/history"
  className={cn(
    "p-2 rounded-lg transition-all",
    location.pathname === '/history' ? "bg-white/10 text-white" : "text-neutral-500 hover:text-white"
  )}
  title="Riwayat Transaksi"
>
  <ClipboardList className="w-5 h-5" />
</Link>
```

### Modifikasi `Dashboard.tsx`

Tambahkan menu item History ke array `menuItems`:

```typescript
// Tambahkan import ClipboardList dari lucide-react
import { ..., ClipboardList } from 'lucide-react'

// Tambahkan ke menuItems array (setelah Point of Sale):
{
  title: 'Riwayat Transaksi',
  description: 'Lihat daftar transaksi hari ini',
  icon: ClipboardList,
  path: '/history',
  color: 'bg-blue-500',
  allowed: true,
},
```

### Display: Metode Pembayaran

`payload.payments` menyimpan `paymentMethodId` (number) tanpa nama. Lakukan lookup di komponen:

```typescript
// Di History.tsx — paymentMethods dari usePOSStore() sudah di-load saat bootstrap
const method = paymentMethods.find((m: any) => m.id === payments[0].paymentMethodId)
return method?.name ?? '—'
```

Jika `payload.payments.length > 1` → tampilkan `"Split"`.

Jika `paymentMethods` kosong (bootstrap belum selesai) → tampilkan `"—"`, bukan crash.

### Format `totalAmount`

`totalAmount` adalah big.js string (contoh: `"150000.00"`). Untuk display:
```typescript
// ✅ BENAR
formatRupiah(parseFloat(trx.totalAmount))

// ❌ SALAH — bisa crash jika string non-numeric
Number(trx.totalAmount)
```

`parseFloat()` aman untuk big.js string karena format-nya adalah angka desimal standar.

### Date Filtering — Perhatian Timezone

`createdAt` disimpan sebagai `Date.now()` (UTC ms). Saat membuat `startOfDay`:
```typescript
const start = new Date()
start.setHours(0, 0, 0, 0) // set ke midnight LOCAL time
```

Ini sudah benar — `setHours` bekerja dalam local timezone, sehingga "hari ini" adalah hari dalam timezone lokal mesin Electron. Tidak perlu konversi timezone manual.

### NFR-P1: < 200ms Load Time

Query `where('createdAt').between(...)` menggunakan index Dexie `createdAt` → O(log n). Dengan volume transaksi harian normal (< 1000 per hari), ini jauh di bawah 200ms.

JANGAN gunakan `toArray().filter(...)` karena ini full-scan O(n).

### File yang Harus Dibuat / Dimodifikasi

| File | Status | Keterangan |
|---|---|---|
| `apps/pos-desktop/src/services/history-service.ts` | **BARU** | Service query localTransactions |
| `apps/pos-desktop/src/services/history-service.test.ts` | **BARU** | Co-located test |
| `apps/pos-desktop/src/pages/History.tsx` | **BARU** | Halaman riwayat transaksi |
| `apps/pos-desktop/src/App.tsx` | **MODIFY** | Tambah route `/history` |
| `apps/pos-desktop/src/components/layout/POSHeader.tsx` | **MODIFY** | Tambah link History |
| `apps/pos-desktop/src/pages/Dashboard.tsx` | **MODIFY** | Tambah menu item History |

**Jangan modifikasi:**
- `src/lib/db.ts` — schema sudah ada `localTransactions`
- `src/services/offline-queue-service.ts` — sudah selesai
- `src/services/sync-service.ts` — sudah selesai
- `src/components/pos/PaymentDialog.tsx` — bukan scope

### Learnings dari Story 1.3 & 1.4

- **Pattern service**: export sebagai object literal (`export const historyService = { ... }`) — bukan class
- **Error messages**: wajib Bahasa Indonesia di `throw new Error('...')`
- **`getDb()` safe concurrent**: aman dipanggil bersamaan, menggunakan `dbInitPromise`
- **Test file**: co-located di sebelah source (bukan `__tests__`)
- **Hindari `any` type**: gunakan `LocalTransaction` dari `@/lib/db`
- **Catch kosong DILARANG**: `throw new Error('...', { cause: error })`
- **Dexie index query**: selalu gunakan `.where(indexedField)` bukan `.filter()` untuk performa

### Pola Mock untuk Test (`history-service.test.ts`)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTransactions = [
  { id: 1, shiftId: 1, trxNumber: 'TRX-001', createdAt: Date.now(), customerName: '', totalAmount: '100000', payload: {} },
]

vi.mock('@/lib/db', () => ({
  getDb: vi.fn().mockResolvedValue({
    localTransactions: {
      where: vi.fn().mockReturnThis(),
      between: vi.fn().mockReturnThis(),
      reverse: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue(mockTransactions),
    },
  }),
}))
```

### Scope Batasan — Story Ini TIDAK Mencakup

- Klik baris untuk detail transaksi → Story 2.2
- Tombol cetak ulang struk → Story 2.3
- Filter berdasarkan tanggal lain → Story 3.2 (tapi `getTransactionsByDate()` sudah disiapkan)
- Filter berdasarkan shift → Story 3.3
- Pencarian berdasarkan nama pelanggan → Story 3.1
- Void transaksi dari history → Story 4.1

## Referensi Konteks Proyek

- `apps/pos-desktop/src/lib/db.ts` — `LocalTransaction` interface, schema `localTransactions`, `getDb()`
- `apps/pos-desktop/src/services/bootstrap-service.ts` — pola object literal service
- `apps/pos-desktop/src/store/pos-store.ts` — `usePOSStore().paymentMethods`
- `apps/pos-desktop/src/components/layout/POSLayout.tsx` — wrapper layout untuk page
- `apps/pos-desktop/src/components/layout/POSHeader.tsx` — tambah link navigasi
- `apps/pos-desktop/src/pages/Dashboard.tsx` — pola page + menu items, tambah History entry
- `apps/pos-desktop/src/App.tsx` — tambah route `/history`
- `apps/pos-desktop/src/lib/utils.ts` — `formatRupiah(value: number): string`
- `_bmad-output/planning-artifacts/architecture.md` — NFR-P1 (< 200ms), `history-service.ts` planned

## Dev Agent Record

### Agent Model Used
_TBD_

### Debug Log References
_TBD_

### Completion Notes List
_TBD_

### File List
_TBD_

### Review Findings
_TBD_
