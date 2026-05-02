---
epic_id: 3
story_id: 3.3
story_key: 3-3-filter-history-by-shift
status: done
created_at: 2026-04-30
---

# Story 3.3: Filter History by Shift

## Story

As a Kasir,
I want menyaring riwayat transaksi berdasarkan shift operasional,
So that saya dapat mencocokkan total transaksi dengan uang di laci kasir pada akhir shift saya.

## Acceptance Criteria

1. **Given** Kasir berada di halaman History
   **When** mereka membuka dropdown filter shift
   **Then** dropdown menampilkan daftar shift yang tersedia berdasarkan transaksi pada tanggal yang sedang dipilih, serta opsi "Semua Shift" sebagai default

2. **Given** Kasir memilih shift tertentu dari dropdown
   **When** filter diterapkan
   **Then** daftar hanya menampilkan transaksi yang `shiftId`-nya sesuai dengan shift yang dipilih

3. **Given** Kasir memilih shift tertentu
   **When** tanggal berubah (filter tanggal diubah)
   **Then** filter shift direset ke "Semua Shift" otomatis agar kasir tidak melihat hasil kosong yang membingungkan

4. **Given** filter tanggal aktif (misal: 2026-04-29) dan filter shift aktif (misal: Shift 1)
   **When** kedua filter aktif bersamaan
   **Then** hanya transaksi yang terjadi pada tanggal tersebut DAN pada shift tersebut yang ditampilkan

5. **Given** shift yang dipilih tidak memiliki transaksi pada tanggal itu
   **When** filter diterapkan
   **Then** layar menampilkan pesan "Tidak ada transaksi untuk shift ini"

6. **Given** halaman History sedang loading atau tidak ada transaksi sama sekali pada tanggal itu
   **When** kondisi tersebut aktif
   **Then** dropdown shift dinonaktifkan (disabled)

## Tasks / Subtasks

- [x] **Fix import `useMemo` yang hilang di `History.tsx`** (Pre-condition: Bug Fix)
  - [x] Ubah baris 1: `import React, { useEffect, useState } from 'react'`
    → `import React, { useEffect, useMemo, useState } from 'react'`
  - [x] Verifikasi `dateLabel` (baris 73) tidak lagi menimbulkan runtime error

- [x] **Tambah state `selectedShiftId` di `History.tsx`** (AC: 1, 2)
  - [x] Tambah: `const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null)`
  - [x] Tempatkan setelah state `selectedDate` untuk kejelasan urutan state

- [x] **Reset `selectedShiftId` saat `selectedDate` berubah di `useEffect`** (AC: 3)
  - [x] Tambahkan `setSelectedShiftId(null)` di dalam `useEffect` sebelum `setIsLoading(true)`
  - [x] Hasil: setiap kali tanggal berubah, shift filter kembali ke "Semua Shift"

- [x] **Tambah `shiftOptions` computed via `useMemo`** (AC: 1)
  - [x] Derivasi dari `transactions` yang sudah di-load (tidak ada Dexie query baru)
  - [x] Logika: group by `shiftId`, sort berdasarkan `createdAt` terkecil per shift, label sebagai `Shift N (HH:mm)`
  - [x] Lihat snippet lengkap di Dev Notes

- [x] **Replace logika filter di komponen** (AC: 2, 4)
  - [x] Hapus `const trimmedQuery = ...` dan `const filteredTransactions = ...` yang saat ini ada (baris 66–71)
  - [x] Ganti dengan dua `useMemo` bertingkat: `shiftFilteredTransactions` lalu `filteredTransactions`
  - [x] Lihat snippet lengkap di Dev Notes

- [x] **Tambah dropdown shift di Filter Bar** (AC: 1, 2, 6)
  - [x] Tambahkan `<select>` di Filter Bar tepat setelah Date Picker (urutan: Search | Date | Shift)
  - [x] `disabled={isLoading || shiftOptions.length === 0}`
  - [x] Styling konsisten dengan Date Picker (`bg-white/5 border border-white/10 rounded-xl ...`)
  - [x] Lihat snippet lengkap di Dev Notes

- [x] **Update empty state** (AC: 5)
  - [x] Tambahkan kondisi baru untuk `selectedShiftId !== null` di antara kondisi `searchQuery` dan kondisi "tanggal kosong"
  - [x] Lihat snippet lengkap di Dev Notes

- [ ] **Tidak ada perubahan di `history-service.ts`**
  - [ ] Shift filtering dilakukan in-memory atas hasil `getTransactionsByDate` yang sudah ada
  - [ ] Schema Dexie tidak berubah — `shiftId` sudah diindex sejak awal

- [x] **Tambah test minimal di `history-service.test.ts`** (dokumentasi kontrak)
  - [x] Tambah `describe` block baru: `'getTransactionsByDate - returns shiftId per transaction'`
  - [x] Verifikasi bahwa hasil `getTransactionsByDate` mempertahankan field `shiftId` dari Dexie
  - [x] Ini mendokumentasikan bahwa Story 3.3 bergantung pada `shiftId` ada di setiap record yang dikembalikan

## Dev Notes

### Arsitektur Filter: Berlapis In-Memory

Story ini memperluas pola dari Story 3.2. Urutan pipeline filter:

```
selectedDate berubah
  → useEffect reset selectedShiftId ke null
  → query Dexie: historyService.getTransactionsByDate(selectedDate)
  → set transactions state

transactions state berubah atau selectedShiftId berubah
  → shiftFilteredTransactions = filter in-memory (shiftId === selectedShiftId)

shiftFilteredTransactions berubah atau searchQuery berubah
  → filteredTransactions = filter in-memory (customerName includes query)
  → render daftar
```

**JANGAN** membuat Dexie query baru untuk shift filter. `shiftId` sudah ada di setiap record `localTransactions` yang dikembalikan oleh `getTransactionsByDate`.

### Bug Pre-existing: `useMemo` Tidak Diimport

`History.tsx` saat ini menggunakan `useMemo` (baris 73 untuk `dateLabel`) tapi **tidak ada** di import baris 1. Ini akan menyebabkan `ReferenceError: useMemo is not defined` di runtime.

**WAJIB perbaiki dulu sebelum menambah kode baru:**
```typescript
// Sebelum (BUGGY):
import React, { useEffect, useState } from 'react'

// Sesudah (BENAR):
import React, { useEffect, useMemo, useState } from 'react'
```

### Snapshot `History.tsx` Saat Ini (Post Story 3.2)

File terletak di: `apps/pos-desktop/src/pages/History.tsx`

State yang sudah ada:
```typescript
const [transactions, setTransactions] = useState<LocalTransaction[]>([])
const [isLoading, setIsLoading] = useState(true)
const [selectedTransaction, setSelectedTransaction] = useState<LocalTransaction | null>(null)
const [searchQuery, setSearchQuery] = useState('')
const [selectedDate, setSelectedDate] = useState<Date>(new Date())
```

useEffect saat ini (baris 27–51): mendeteksi perubahan `selectedDate`, panggil `historyService.getTransactionsByDate`, set `transactions`. Pola `isCancelled` sudah ada untuk menangani race condition.

Filter bar saat ini: flex row berisi Search + Date Picker. Shift dropdown cukup ditambahkan di akhir flex row yang sama — **tidak perlu restructuring layout**.

### State Baru

Tambahkan tepat setelah `selectedDate`:
```typescript
const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null)
```

### Update `useEffect` — Reset Shift saat Tanggal Berubah

```typescript
useEffect(() => {
  let isCancelled = false
  setSelectedShiftId(null)  // ← TAMBAHAN baru
  setIsLoading(true)
  historyService.getTransactionsByDate(selectedDate)
    .then((data) => {
      if (!isCancelled) {
        setTransactions(data)
      }
    })
    .catch((err) => {
      if (!isCancelled) {
        console.error(err)
        toast.error('Gagal memuat riwayat transaksi')
      }
    })
    .finally(() => {
      if (!isCancelled) {
        setIsLoading(false)
      }
    })

  return () => {
    isCancelled = true
  }
}, [selectedDate])
```

### `shiftOptions` — Derivasi dari `transactions`

```typescript
const shiftOptions = useMemo(() => {
  const shiftMap = new Map<number, number>() // shiftId → createdAt terkecil
  for (const trx of transactions) {
    const existing = shiftMap.get(trx.shiftId)
    if (existing === undefined || trx.createdAt < existing) {
      shiftMap.set(trx.shiftId, trx.createdAt)
    }
  }
  return Array.from(shiftMap.entries())
    .sort(([, a], [, b]) => a - b)
    .map(([shiftId, firstAt], i) => ({
      shiftId,
      label: `Shift ${i + 1} (${new Date(firstAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })})`,
    }))
}, [transactions])
```

Label yang dihasilkan: `"Shift 1 (08:15)"`, `"Shift 2 (14:30)"` — ordinal berbasis urutan munculnya dalam hari itu, waktu dari transaksi pertama di shift tersebut.

### Replace Logika Filter (Hapus Baris 66–71, Ganti dengan Ini)

```typescript
// Ganti dua baris lama (trimmedQuery + filteredTransactions) dengan:
const shiftFilteredTransactions = useMemo(
  () =>
    selectedShiftId !== null
      ? transactions.filter((trx) => trx.shiftId === selectedShiftId)
      : transactions,
  [transactions, selectedShiftId]
)

const filteredTransactions = useMemo(() => {
  const q = searchQuery.trim().toLowerCase()
  if (!q) return shiftFilteredTransactions
  return shiftFilteredTransactions.filter((trx) =>
    String(trx.customerName ?? '').toLowerCase().includes(q)
  )
}, [shiftFilteredTransactions, searchQuery])
```

Ini menggantikan:
```typescript
// HAPUS BARIS INI (baris 66–71 saat ini):
const trimmedQuery = searchQuery.trim().toLowerCase()
const filteredTransactions = trimmedQuery
  ? transactions.filter((trx) =>
      String(trx.customerName ?? '').toLowerCase().includes(trimmedQuery)
    )
  : transactions
```

### Dropdown Shift — Tambahkan di Filter Bar setelah Date Picker

```tsx
{/* Shift Filter — letakkan setelah Date Picker, dalam flex row yang sama */}
<select
  value={selectedShiftId ?? ''}
  onChange={(e) =>
    setSelectedShiftId(e.target.value ? Number(e.target.value) : null)
  }
  disabled={isLoading || shiftOptions.length === 0}
  className="py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:dark] min-w-[140px]"
>
  <option value="">Semua Shift</option>
  {shiftOptions.map(({ shiftId, label }) => (
    <option key={shiftId} value={shiftId}>
      {label}
    </option>
  ))}
</select>
```

`min-w-[140px]` mencegah dropdown terlalu sempit saat label "Semua Shift" dipilih.

### Update Empty State — Tambah Kondisi Shift

Ganti blok empty state yang ada (saat ini hanya cek `searchQuery`) dengan versi tiga kondisi:

```tsx
{searchQuery ? (
  <>
    <p className="text-neutral-500 font-bold">Tidak ada transaksi untuk "{searchQuery}"</p>
    <p className="text-neutral-600 text-sm mt-1">Coba kata kunci lain atau kosongkan pencarian</p>
  </>
) : selectedShiftId !== null ? (
  <>
    <p className="text-neutral-500 font-bold">Tidak ada transaksi untuk shift ini</p>
    <p className="text-neutral-600 text-sm mt-1">Pilih shift lain atau tampilkan semua shift</p>
  </>
) : (
  <>
    <p className="text-neutral-500 font-bold">Tidak ada transaksi pada tanggal ini</p>
    <p className="text-neutral-600 text-sm mt-1">Transaksi yang diproses akan muncul di sini</p>
  </>
)}
```

### File yang Dimodifikasi

| File | Aksi | Keterangan |
|---|---|---|
| `apps/pos-desktop/src/pages/History.tsx` | **MODIFY** | Fix useMemo import, tambah state + dropdown + filter logic |
| `apps/pos-desktop/src/services/history-service.test.ts` | **MODIFY** | Tambah 1 test dokumentasi kontrak shiftId |

**JANGAN modifikasi:**
- `apps/pos-desktop/src/services/history-service.ts` — tidak ada method baru
- `apps/pos-desktop/src/lib/db.ts` — schema sudah benar, `shiftId` sudah diindex
- `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx` — tidak relevan
- `electron/main.ts` — tidak relevan

### Test yang Harus Ditambahkan di `history-service.test.ts`

```typescript
describe('getTransactionsByDate - shiftId contract', () => {
  it('should return transactions with shiftId field (required by Story 3.3 in-memory filter)', async () => {
    const mockData = [
      { id: 1, shiftId: 10, trxNumber: 'TRX-001', createdAt: Date.now(), totalAmount: '100', customerName: 'Budi', payload: {} },
      { id: 2, shiftId: 11, trxNumber: 'TRX-002', createdAt: Date.now(), totalAmount: '200', customerName: 'Ani', payload: {} },
    ]
    mockDb.localTransactions.toArray.mockResolvedValue(mockData)

    const result = await historyService.getTransactionsByDate(new Date())

    expect(result[0].shiftId).toBe(10)
    expect(result[1].shiftId).toBe(11)
  })
})
```

### Anti-Pattern yang DILARANG

```typescript
// ❌ DILARANG: query Dexie baru untuk shift filter
useEffect(() => {
  db.localTransactions.where('shiftId').equals(selectedShiftId).toArray().then(setTransactions)
}, [selectedShiftId])
// Alasan: melanggar service layer pattern, break kombinasi dengan date filter

// ❌ DILARANG: akses db langsung dari komponen
import { getDb } from '@/lib/db'
const db = await getDb()
await db.localTransactions.where('shiftId').equals(selectedShiftId) ...
// Alasan: Architecture rule — Dexie hanya via service layer

// ❌ DILARANG: lupa reset selectedShiftId saat tanggal berubah
// Akibat: kasir memilih "Shift 1" pada hari A, lalu ganti ke hari B,
//         shift 1 mungkin tidak ada di hari B → tampil empty state yang membingungkan

// ❌ DILARANG: mengubah searchQuery filter menjadi Dexie query
// Pola yang benar sudah ditegaskan di Story 3.1 dan 3.2 — tetap in-memory
```

### Catatan: `shiftId` di `LocalTransaction`

`LocalTransaction.shiftId: number` (required, tidak optional). Nilai ini diisi oleh `PaymentDialog.tsx` dari `activeShift.id` saat transaksi berhasil diproses. Tidak ada risiko `undefined`/`null` pada data normal.

### Referensi Kode

- `apps/pos-desktop/src/pages/History.tsx` — file utama modifikasi
- `apps/pos-desktop/src/services/history-service.ts` baris 17 — `getTransactionsByDate`, tidak berubah
- `apps/pos-desktop/src/lib/db.ts` baris 177 — index `shiftId` di `localTransactions`
- `apps/pos-desktop/src/components/pos/PaymentDialog.tsx` baris 99 — sumber penulisan `shiftId` ke localTransaction

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Berhasil memperbaiki bug `useMemo` import di `History.tsx`.
- Implementasi filter shift in-memory di `History.tsx` menggunakan `useMemo` bertingkat untuk performa optimal.
- Dropdown shift otomatis muncul hanya jika ada transaksi pada tanggal terpilih, dan direset saat tanggal berubah.
- Update UI empty state untuk memberikan feedback yang jelas saat filter shift tidak menemukan hasil.
- Menambahkan unit test di `history-service.test.ts` untuk memverifikasi kontrak `shiftId` pada data transaksi.
- Semua acceptance criteria (1-6) telah terpenuhi.

### File List

- `apps/pos-desktop/src/pages/History.tsx` (MODIFIED)
- [x] `apps/pos-desktop/src/services/history-service.test.ts` (MODIFIED)

### Review Findings

- [x] [Review][Defer] Konsistensi Locale [History.tsx:80] — deferred, pre-existing (konsisten dengan kode lama)
