---
epic_id: 3
story_id: 3.2
story_key: 3-2-filter-history-by-date-range
status: done
created_at: 2026-04-29
---

# Story 3.2: Filter History by Date Range

## Story

As a Kasir,
I want menyaring riwayat transaksi berdasarkan tanggal tertentu,
So that saya dapat melihat penjualan dari hari-hari sebelumnya jika diperlukan.

## Acceptance Criteria

1. **Given** Kasir berada di halaman History
   **When** mereka memilih sebuah tanggal dari date picker
   **Then** daftar akan memuat dan menampilkan seluruh transaksi yang terjadi pada tanggal tersebut

2. **Given** tanggal yang dipilih tidak memiliki transaksi
   **When** filter diterapkan
   **Then** layar akan menampilkan pesan "Tidak ada transaksi pada tanggal ini"

3. **Given** halaman History pertama kali dibuka
   **When** belum ada filter diterapkan
   **Then** date picker menampilkan tanggal hari ini dan daftar menampilkan transaksi hari ini

4. **Given** date picker aktif
   **When** Kasir mencoba memilih tanggal di masa depan
   **Then** tanggal masa depan tidak dapat dipilih (disabled)

5. **Given** filter tanggal aktif menampilkan transaksi tanggal X
   **When** Kasir mengetik di kolom pencarian nama pelanggan
   **Then** hasil pencarian hanya menyaring transaksi pada tanggal X (kedua filter bekerja bersamaan)

## Tasks / Subtasks

- [x] **Ubah `useEffect` di `History.tsx` agar reaktif terhadap `selectedDate`** (AC: 1, 3)
  - [x] Ganti `const today = new Date()` hardcode di useEffect menjadi state `selectedDate`
  - [x] Tambah state: `const [selectedDate, setSelectedDate] = useState<Date>(new Date())`
  - [x] Update `useEffect` dependency array dari `[]` menjadi `[selectedDate]`
  - [x] Pastikan `setIsLoading(true)` dipanggil di awal useEffect sebelum fetch
  - [x] Ganti `historyService.getTodayTransactions()` dengan `historyService.getTransactionsByDate(selectedDate)`

- [x] **Tambah date picker UI di `History.tsx`** (AC: 1, 4)
  - [x] Tambah helper `formatDateForInput(date: Date): string` yang menghasilkan `YYYY-MM-DD`
  - [x] Tambah `<input type="date">` dengan `max={formatDateForInput(new Date())}` (blokir masa depan)
  - [x] Handler: `onChange={(e) => { if (e.target.value) setSelectedDate(new Date(e.target.value + 'T00:00:00')) }}`
    — suffix `T00:00:00` wajib untuk menghindari timezone offset (tanpa ini `new Date('YYYY-MM-DD')` di beberapa lingkungan akan menjadi UTC midnight, sehingga tampil sebagai hari sebelumnya di timezone +07)
  - [x] Tambah atribut `disabled={isLoading}` pada date picker
  - [x] Styling dark-theme: `bg-white/5 border border-white/10 rounded-xl text-sm text-white` + date picker custom CSS (lihat bagian Dev Notes)

- [x] **Update header date label** (AC: 3)
  - [x] Ganti `const today = new Date().toLocaleDateString(...)` (baris 49 di History.tsx saat ini) menjadi computed dari `selectedDate`
  - [x] Hasil: header selalu menampilkan tanggal yang sedang difilter, bukan selalu "hari ini"

- [x] **Update empty state messages** (AC: 2)
  - [x] Ubah kondisi empty state: jika `searchQuery` kosong, tampilkan "Tidak ada transaksi pada tanggal ini" (bukan "hari ini")

- [x] **Update test di `history-service.test.ts`** (AC: 1)
  - [x] Tidak ada service method baru — `getTransactionsByDate` sudah ada dan sudah ditest
  - [x] Verifikasi test `getTransactionsByDate` sudah cover: empty array result (sudah via `mockResolvedValue([])`)
  - [x] Tambah describe block `getTransactionsByDate - edge cases`:
    - [x] Test: tanggal di masa lalu — pastikan `between` dipanggil dengan range yang benar
    - [x] Test: `reverse()` dipanggil (sort descending) — verifikasi sudah ada di test `getTodayTransactions`

## Dev Notes

### Arsitektur Filter: Date → Dexie Query, Customer Name → In-Memory

Story 3.1 menggunakan **in-memory filter** karena hanya mengoperasikan data yang sudah di-load (transaksi hari ini). Story 3.2 berbeda:

```
Date Filter:  selectedDate berubah → trigger useEffect → query Dexie baru (getTransactionsByDate)
Search Filter: searchQuery berubah → filter in-memory dari transactions yang sudah di-load
```

Kedua filter saling melengkapi secara natural:
1. `selectedDate` mengontrol apa yang ada di `transactions` state (via Dexie query)
2. `searchQuery` mem-filter `transactions` di JavaScript

Ini adalah pola yang benar — **JANGAN** mengubah searchQuery filter menjadi Dexie query per keystroke.

### File yang Dimodifikasi

| File | Status | Keterangan |
|---|---|---|
| `src/pages/History.tsx` | **MODIFY** | Tambah selectedDate state + date picker UI + update useEffect + update header |
| `src/services/history-service.test.ts` | **MODIFY** | Tambah edge case test untuk `getTransactionsByDate` |

**Jangan modifikasi:**
- `src/services/history-service.ts` — `getTransactionsByDate(date)` sudah tersedia dan cukup
- `src/lib/db.ts` — schema tidak berubah
- `src/components/history/TransactionDetailDialog.tsx` — tidak relevan
- `electron/main.ts` — tidak relevan

### Implementasi State di `History.tsx`

**Tambah state baru:**
```typescript
const [selectedDate, setSelectedDate] = useState<Date>(new Date())
```

**Update useEffect (ganti dari hardcode getTodayTransactions):**
```typescript
useEffect(() => {
  setIsLoading(true)
  historyService.getTransactionsByDate(selectedDate)
    .then(setTransactions)
    .catch((err) => {
      console.error(err)
      toast.error('Gagal memuat riwayat transaksi')
    })
    .finally(() => setIsLoading(false))
}, [selectedDate])
```

**Helper function (letakkan di luar komponen):**
```typescript
function formatDateForInput(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
```

**Update header label:**
```typescript
// Ganti baris 49 saat ini:
// const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const dateLabel = selectedDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
```

**Date picker input — ditempatkan SEJAJAR dengan search bar (dalam satu row flex):**

Story 3.3 (Filter by Shift) akan menambahkan dropdown di baris yang sama. Desain layout filter bar untuk Story 3.2 harus menggunakan `flex gap` agar Story 3.3 bisa menambahkan filter tanpa restructuring.

```tsx
{/* Filter Bar — search + date picker dalam satu row */}
<div className="mb-6 flex gap-3 items-center">
  {/* Search (existing, hanya pindahkan ke dalam flex) */}
  <div className="flex-1 relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
    <input
      type="text"
      placeholder="Cari nama pelanggan..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      disabled={isLoading}
      maxLength={100}
      className="w-full pl-9 pr-9 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-brand-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

  {/* Date Picker */}
  <input
    type="date"
    value={formatDateForInput(selectedDate)}
    max={formatDateForInput(new Date())}
    onChange={(e) => {
      if (e.target.value) {
        setSelectedDate(new Date(e.target.value + 'T00:00:00'))
      }
    }}
    disabled={isLoading}
    className="py-2.5 px-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:dark]"
  />
</div>
```

> **Penting:** Class `[color-scheme:dark]` pada `<input type="date">` diperlukan di Tailwind untuk membuat browser merender native date picker UI dalam tema gelap (menghindari kalender putih di atas background gelap). Ini Tailwind arbitrary property, tidak perlu plugin tambahan.

**Update empty state (hanya ubah satu baris pesan):**
```tsx
// Sebelum:
<p className="text-neutral-500 font-bold">Tidak ada transaksi hari ini</p>
// Sesudah:
<p className="text-neutral-500 font-bold">Tidak ada transaksi pada tanggal ini</p>
```

### Penanganan Timezone — Alasan `T00:00:00`

```typescript
// ❌ SALAH — timezone bug
new Date('2026-04-20')
// → Parsed sebagai UTC: 2026-04-20T00:00:00Z
// → Di WIB (UTC+7): menjadi 2026-04-19T07:00:00 local
// → getDayRange() akan menghitung range tanggal 19 April, bukan 20!

// ✅ BENAR — local time
new Date('2026-04-20T00:00:00')
// → Parsed sebagai local time: 2026-04-20T00:00:00 WIB
// → getDayRange() menghitung range tanggal 20 April dengan benar
```

### Anti-Pattern yang DILARANG

```typescript
// ❌ DILARANG: query Dexie setiap searchQuery berubah
useEffect(() => {
  historyService.searchByCustomerName(searchQuery, selectedDate).then(setFilteredTransactions)
}, [searchQuery, selectedDate])

// ✅ BENAR: Dexie hanya di-query saat tanggal berubah
useEffect(() => {
  historyService.getTransactionsByDate(selectedDate).then(setTransactions)
}, [selectedDate])
// filter searchQuery tetap in-memory dari `transactions`
```

```typescript
// ❌ DILARANG: loading state tidak direset sebelum fetch baru
useEffect(() => {
  historyService.getTransactionsByDate(selectedDate).then(setTransactions) // spinner tidak muncul
}, [selectedDate])

// ✅ BENAR: setIsLoading(true) di awal
useEffect(() => {
  setIsLoading(true)
  historyService.getTransactionsByDate(selectedDate)
    .then(setTransactions)
    .finally(() => setIsLoading(false))
}, [selectedDate])
```

### Pola Test di `history-service.test.ts`

Tidak ada method baru di `history-service.ts`. Test yang perlu ditambahkan minimal:

```typescript
describe('getTransactionsByDate', () => {
  // Test yang sudah ada: tanggal spesifik, reverse dipanggil

  it('should return empty array when no transactions on selected date', async () => {
    mockDb.localTransactions.toArray.mockResolvedValue([])
    const result = await historyService.getTransactionsByDate(new Date('2026-01-01T00:00:00'))
    expect(result).toEqual([])
  })
})
```

> Mock `reverse` di `searchByCustomerName` TIDAK menggunakan `reverse()` (lihat Story 3.1 Dev Notes: "Untuk `searchByCustomerName`, `reverse()` TIDAK dipanggil"). `getTransactionsByDate` menggunakan `reverse()`.

### Scope Batasan — Story Ini TIDAK Mencakup

- Filter berdasarkan shift → Story 3.3
- Date range picker (dari-sampai) — AC hanya menyebut satu tanggal
- Tombol "Hari Ini" eksplisit (default sudah today)
- Pagination atau lazy-load untuk hari dengan banyak transaksi
- Integrasi dengan `searchByCustomerName` service method (tidak diperlukan untuk implementasi)

## Referensi Konteks Proyek

- `apps/pos-desktop/src/pages/History.tsx` — file utama (130 baris saat ini setelah Story 3.1)
- `apps/pos-desktop/src/services/history-service.ts` — `getTransactionsByDate(date)` baris 17, `getDayRange` baris 4
- `apps/pos-desktop/src/services/history-service.test.ts` — pola mock Dexie yang harus diikuti
- `apps/pos-desktop/src/lib/db.ts` baris ~177 — index `createdAt` di `localTransactions`
- Architecture: `_bmad-output/planning-artifacts/architecture.md` — NFR-P1, date storage pattern (Unix ms)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- Berhasil mengimplementasikan state `selectedDate` dan menghubungkannya dengan `historyService.getTransactionsByDate`.
- Menambahkan Date Picker UI yang diletakkan sejajar dengan Search Bar menggunakan Flexbox.
- Menambahkan proteksi `max` pada Date Picker untuk mencegah pemilihan tanggal di masa depan.
- Memperbarui label tanggal di header agar dinamis mengikuti tanggal yang dipilih.
- Memperbarui pesan empty state untuk konteks filter tanggal.
- Menambahkan unit test untuk skenario "no transactions on selected date" di `history-service.test.ts`.
- Memastikan semua tes (30 tes) di `petshop-pos` lulus.

### Change Log
- 2026-04-29: Implementasi filter tanggal di halaman History dan penambahan unit test edge case.

### File List
- `apps/pos-desktop/src/pages/History.tsx`
- `apps/pos-desktop/src/services/history-service.test.ts`

### Review Findings

- [x] [Review][Patch] Race Condition in `useEffect` [History.tsx:24]
- [x] [Review][Defer] Input "max" Stale if app left open [History.tsx:80] — deferred, pre-existing

### Review Findings

- [x] [Review][Patch] Race Condition in useEffect [History.tsx:24]
- [x] [Review][Patch] `finally` block logic in useEffect [History.tsx:43]
- [x] [Review][Patch] Memoize dateLabel & formatDate [History.tsx:73]
- [x] [Review][Defer] Stale "max" date if app left open [History.tsx:80] — deferred, pre-existing
