---
epic_id: 3
story_id: 3.1
story_key: 3-1-search-transaction-by-customer-name
status: done
created_at: 2026-04-28
---

# Story 3.1: Search Transaction by Customer Name

## Story

As a Kasir,
I want mencari riwayat transaksi menggunakan nama pelanggan,
So that saya dapat dengan mudah menemukan struk spesifik untuk pelanggan yang kembali.

## Acceptance Criteria

1. **Given** Kasir berada di halaman History
   **When** mereka mengetik nama pelanggan di kolom pencarian
   **Then** daftar akan langsung disaring (filtered) untuk menampilkan transaksi yang cocok dengan nama tersebut
   **And** hasil pencarian harus muncul dalam waktu kurang dari 200ms

2. **Given** kolom pencarian diisi dengan keyword
   **When** tidak ada transaksi yang cocok
   **Then** layar menampilkan pesan "Tidak ada transaksi untuk "[keyword]""

3. **Given** kolom pencarian berisi keyword
   **When** Kasir menghapus/mengosongkan input
   **Then** daftar kembali menampilkan seluruh transaksi hari ini tanpa filter

4. **Given** kolom pencarian aktif
   **When** Kasir klik tombol "X" (clear)
   **Then** input dikosongkan dan daftar kembali ke full list

5. **Given** transaksi tidak memiliki nama pelanggan (kolom `customerName` kosong/null)
   **When** Kasir mengetik keyword apapun
   **Then** transaksi tersebut TIDAK muncul di hasil pencarian (kosong tidak cocok dengan keyword)

## Tasks / Subtasks

- [x] **Tambah state dan logika filter di `History.tsx`** (AC: 1, 2, 3, 4, 5)
  - [x] Tambah `searchQuery` state: `const [searchQuery, setSearchQuery] = useState('')`
  - [x] Tambah `filteredTransactions` computed value: filter `transactions` by `customerName.toLowerCase().includes(searchQuery.toLowerCase())` jika `searchQuery` tidak kosong
  - [x] Ganti `transactions.map(...)` di render menjadi `filteredTransactions.map(...)`
  - [x] Update empty state logic: tampilkan pesan berbeda untuk "tidak ada transaksi hari ini" vs "tidak ada hasil pencarian"

- [x] **Tambah UI kolom pencarian di `History.tsx`** (AC: 1, 4)
  - [x] Tambah search input di antara header dan tabel, di atas "Table Header"
  - [x] Input menggunakan icon `Search` dari lucide-react (sudah tersedia)
  - [x] Tambah tombol clear "X" (`X` icon dari lucide-react) yang muncul saat `searchQuery` tidak kosong
  - [x] Styling konsisten dengan design system: `bg-white/5 border border-white/10 rounded-xl`

- [x] **Tambah method `searchByCustomerName` di `history-service.ts`** (testability)
  - [x] Method ini mengambil keyword + date opsional
  - [x] Implementasi: query by date range dulu, lalu filter JS dengan `.includes()`
  - [x] Error message dalam Bahasa Indonesia

- [x] **Update test `history-service.test.ts`**
  - [x] Tambah describe block `searchByCustomerName`
  - [x] Test: keyword ditemukan, partial match
  - [x] Test: keyword tidak ditemukan → array kosong
  - [x] Test: keyword kosong → semua transaksi hari ini (fallback ke `getTodayTransactions`)

### Review Findings

- [x] [Review][Patch] Redundant string operations in filter [History.tsx:41-45]
- [x] [Review][Patch] Disable search input when loading [History.tsx:66]
- [x] [Review][Patch] Add maxLength to search input [History.tsx:66]
- [x] [Review][Patch] Improve type safety in filter (`String(trx.customerName ?? '')`) [History.tsx:43]
- [x] [Review][Patch] Fix lazy type cast in tests [history-service.test.ts:21]
- [x] [Review][Patch] Use `this.getTransactionsByDate` in `history-service.ts` [history-service.ts:33]
- [x] [Review][Defer] Search Bar lack of Focus [History.tsx:64] — deferred, UX polish


## Dev Notes

### Pendekatan: In-Memory Filter (BUKAN Dexie Query)

**NFR-P1 < 200ms dipenuhi dengan in-memory filtering**, bukan query Dexie baru setiap keystroke:

```
1. Saat halaman dimuat: load ALL transaksi hari ini ke state (seperti sebelumnya)
2. Saat user mengetik: filter array yang sudah di-load di JavaScript — tidak ada query Dexie
3. Hasil: < 5ms untuk ratusan transaksi, jauh di bawah limit 200ms
```

**Alasan in-memory lebih baik dari Dexie query per keystroke:**
- POS transaksi per hari = ratusan record (bukan jutaan)
- Dexie query overhead ~10-50ms per query (buka koneksi, decode enkripsi AES-256)
- JS `.filter()` + `.includes()` pada 1000 record ≈ < 1ms
- Tidak ada tambahan kompleksitas query Dexie

**Anti-pattern yang DILARANG:**
```typescript
// ❌ DILARANG: query Dexie setiap user mengetik
useEffect(() => {
  historyService.searchByCustomerName(searchQuery) // terlalu mahal
    .then(setFilteredTransactions)
}, [searchQuery])

// ✅ BENAR: filter in-memory dari state yang sudah ada
const filteredTransactions = searchQuery.trim()
  ? transactions.filter(trx =>
      (trx.customerName ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  : transactions
```

### File yang Dimodifikasi

| File | Status | Keterangan |
|---|---|---|
| `src/pages/History.tsx` | **MODIFY** | Tambah search state + UI + filter logic |
| `src/services/history-service.ts` | **MODIFY** | Tambah `searchByCustomerName` (untuk testability) |
| `src/services/history-service.test.ts` | **MODIFY** | Tambah test untuk `searchByCustomerName` |

**Jangan modifikasi:**
- `src/lib/db.ts` — schema tidak perlu berubah (`customerName` sudah terindex)
- `src/components/history/TransactionDetailDialog.tsx` — tidak ada perubahan
- `electron/main.ts` — tidak ada perubahan

### Implementasi Filter di `History.tsx`

**State yang ditambahkan:**
```typescript
const [searchQuery, setSearchQuery] = useState('')
```

**Computed filtered list (bukan state):**
```typescript
const filteredTransactions = searchQuery.trim()
  ? transactions.filter(trx =>
      (trx.customerName ?? '').toLowerCase().includes(searchQuery.toLowerCase().trim())
    )
  : transactions
```

**Search UI — ditempatkan SETELAH header section, SEBELUM content section:**
```tsx
{/* Search Bar */}
<div className="mb-6 relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
  <input
    type="text"
    placeholder="Cari nama pelanggan..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="w-full pl-9 pr-9 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-brand-500/50 transition-colors"
  />
  {searchQuery && (
    <button
      onClick={() => setSearchQuery('')}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
    >
      <X className="w-4 h-4" />
    </button>
  )}
</div>
```

**Logika empty state yang diperbarui:**
```tsx
{/* Content */}
{isLoading ? (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
  </div>
) : filteredTransactions.length === 0 ? (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <ClipboardList className="w-12 h-12 text-neutral-700 mb-4" />
    {searchQuery ? (
      <>
        <p className="text-neutral-500 font-bold">Tidak ada transaksi untuk "{searchQuery}"</p>
        <p className="text-neutral-600 text-sm mt-1">Coba kata kunci lain atau kosongkan pencarian</p>
      </>
    ) : (
      <>
        <p className="text-neutral-500 font-bold">Tidak ada transaksi hari ini</p>
        <p className="text-neutral-600 text-sm mt-1">Transaksi yang diproses akan muncul di sini</p>
      </>
    )}
  </div>
) : (
  // ... render filteredTransactions (bukan transactions)
)}
```

**Import tambahan yang dibutuhkan di `History.tsx`:**
```typescript
import { ClipboardList, Loader2, Search, X } from 'lucide-react'
// Search dan X adalah icon baru — sisanya sudah ada
```

### Implementasi `searchByCustomerName` di `history-service.ts`

Method ini ditambahkan untuk **testability** dan future use (Story 3.2 date filter):

```typescript
async searchByCustomerName(keyword: string, date?: Date): Promise<LocalTransaction[]> {
  if (!keyword.trim()) {
    return this.getTransactionsByDate(date ?? new Date())
  }
  const db = await getDb()
  const { startMs, endMs } = getDayRange(date ?? new Date())
  try {
    const allInRange = await db.localTransactions
      .where('createdAt')
      .between(startMs, endMs, true, true)
      .toArray()
    const lowerKeyword = keyword.toLowerCase().trim()
    return allInRange.filter(trx =>
      (trx.customerName ?? '').toLowerCase().includes(lowerKeyword)
    )
  } catch (error) {
    throw new Error('Gagal mencari transaksi.', { cause: error })
  }
},
```

### Mock Dexie di Test — Pola yang Sudah Ada

Lihat `history-service.test.ts` untuk pola mock yang harus diikuti:

```typescript
const mockDb = {
  localTransactions: {
    where: vi.fn().mockReturnThis(),
    between: vi.fn().mockReturnThis(),
    reverse: vi.fn().mockReturnThis(),
    toArray: vi.fn(),
  },
}
```

Untuk `searchByCustomerName`, `reverse()` TIDAK dipanggil (tidak ada `.reverse()` di method baru). Mock harus merefleksikan ini.

### Dexie Schema: `customerName` Sudah Terindex

Dari `src/lib/db.ts` line 177:
```typescript
localTransactions: "++id, shiftId, createdAt, customerName",
```

`customerName` sudah memiliki Dexie index — tidak perlu migration schema. Namun untuk story ini, kita TIDAK menggunakan index ini secara langsung karena kita filter di JavaScript setelah query range `createdAt`.

### Design System Reference

- Background input: `bg-white/5`
- Border: `border border-white/10`, focus: `focus:border-brand-500/50`
- Rounded: `rounded-xl` (konsisten dengan card transaksi)
- Icon color: `text-neutral-500`, hover: `hover:text-white`
- Placeholder color: `placeholder:text-neutral-600`
- Icon size: `w-4 h-4` (konsisten dengan ikon-ikon lain di halaman)

Pola UI ini selaras dengan input yang sudah ada di app (lihat `PaymentDialog.tsx` untuk referensi input style).

### Scope Batasan — Story Ini TIDAK Mencakup

- Filter berdasarkan tanggal → Story 3.2
- Filter berdasarkan shift → Story 3.3
- Debounce / throttle pada input (tidak diperlukan karena in-memory filter)
- Pencarian di seluruh transaksi historis (multi-tanggal) — hanya hari ini
- Pencarian berdasarkan nomor struk atau jumlah

## Referensi Konteks Proyek

- `apps/pos-desktop/src/pages/History.tsx` — file utama yang dimodifikasi (tambah search bar + filter logic)
- `apps/pos-desktop/src/services/history-service.ts` — tambah `searchByCustomerName`
- `apps/pos-desktop/src/services/history-service.test.ts` — tambah test untuk method baru
- `apps/pos-desktop/src/lib/db.ts` line 177 — schema `localTransactions` (referensi, tidak diubah)
- `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx` — referensi, tidak diubah
- `apps/pos-desktop/src/components/pos/PaymentDialog.tsx` — referensi pola input style + lucide icon

## Dev Agent Record

### Agent Model Used
Gemini 3 Flash

### Debug Log References
- Fixed lint errors in `history-service.test.ts` (unused variables and `any` cast).
- Verified unit tests for `historyService.searchByCustomerName` pass 100%.

### Completion Notes List
- Berhasil menambahkan fitur pencarian transaksi berdasarkan nama pelanggan di halaman History.
- Implementasi menggunakan in-memory filtering untuk performa optimal (< 200ms).
- Menambahkan method `searchByCustomerName` di `history-service.ts` untuk mendukung testing dan kebutuhan masa depan.
- UI diperbarui dengan search bar yang responsif, icon Search, tombol Clear, dan empty state yang informatif.

### File List
- `apps/pos-desktop/src/pages/History.tsx` (MODIFIED)
- `apps/pos-desktop/src/services/history-service.ts` (MODIFIED)
- `apps/pos-desktop/src/services/history-service.test.ts` (MODIFIED)

### Change Log
- 2026-04-28: Implemented search by customer name feature. Added service method, unit tests, and UI search bar.
