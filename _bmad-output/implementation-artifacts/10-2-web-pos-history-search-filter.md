# Story 10.2: Web POS History Search & Filter

Status: done

## Story

As a Kasir,
I want mencari dan memfilter riwayat transaksi berdasarkan nomor struk atau rentang waktu,
so that saya bisa menemukan transaksi tertentu dengan cepat tanpa scroll panjang.

## Acceptance Criteria

1. **Given** Kasir berada di halaman History
   **When** mereka mengetik nomor struk atau kata kunci di kolom pencarian
   **Then** daftar transaksi difilter secara real-time, hasil muncul dalam < 200ms (client-side dari data yang sudah dimuat)

2. **Given** Kasir memilih filter tanggal
   **When** mereka memilih rentang tanggal tertentu
   **Then** sistem melakukan fetch ulang ke server dengan parameter tanggal, dan menampilkan transaksi dalam rentang tersebut

3. **Given** Kasir memilih filter "Shift ini"
   **When** filter aktif
   **Then** hanya transaksi dalam shift aktif yang ditampilkan (default view)

## Tasks / Subtasks

- [x] Task 1: Modifikasi `history/page.tsx` untuk menerima `searchParams` (AC: 2, 3)
  - [x] Tambah parameter `searchParams: Promise<{ from?: string; to?: string; mode?: string }>` ke fungsi `HistoryPage`
  - [x] Jika `mode=date` DAN `from` + `to` tersedia → query DB dengan `gte(transactions.createdAt, fromDate) AND lte(transactions.createdAt, toDate)` tanpa filter `shiftId`
  - [x] Jika tidak ada params atau `mode=shift` → query default berdasarkan `shiftId` (perilaku saat ini, tidak berubah)
  - [x] Jika mode=date tapi tidak ada shift aktif → **tetap lakukan query date range** (tidak error), karena date filter tidak memerlukan shift
  - [x] Pass `activeShiftId` dan `currentMode` ke `TransactionHistoryClient` sebagai props baru
  - [x] Impor `gte`, `lte` dari `@/lib/db` (sudah tersedia di index Drizzle)

- [x] Task 2: Tambah search bar client-side ke `TransactionHistoryClient` (AC: 1)
  - [x] Tambah state `searchQuery: string` (default `''`)
  - [x] Tambah `<input type="search">` di atas daftar transaksi — placeholder "Cari nomor struk..."
  - [x] Filter `transactions` prop berdasarkan `tx.trxNumber.toLowerCase().includes(searchQuery.toLowerCase())` — gunakan `useMemo` agar performa O(n) tidak memblokir render
  - [x] Hasil muncul tanpa debounce (data sudah di memory, langsung < 200ms)
  - [x] Jika hasil filter kosong → tampilkan empty state "Tidak ada transaksi yang cocok"
  - [x] Search bar harus memiliki min-height 44px (touch target)

- [x] Task 3: Tambah filter tanggal server-side ke `TransactionHistoryClient` (AC: 2, 3)
  - [x] Tambah dua `<input type="date">` — "Dari Tanggal" dan "Sampai Tanggal"
  - [x] Tambah toggle/button "Shift Aktif" vs "Pilih Tanggal" untuk switch mode filter
  - [x] Saat mode "Shift Aktif" aktif → navigasi ke `/pos/history` (hapus searchParams)
  - [x] Saat mode "Pilih Tanggal" dan tanggal dipilih → navigasi ke `/pos/history?mode=date&from=YYYY-MM-DD&to=YYYY-MM-DD`
  - [x] Gunakan `useRouter` dari `next/navigation` dan `router.push()` untuk trigger server re-fetch
  - [x] Tampilkan label aktif: "Shift Aktif" atau "tgl X – tgl Y" sesuai mode yang dipilih
  - [x] Semua tombol filter min-height 44px

- [x] Task 4: Update header info di `TransactionHistoryClient` (AC: 1, 2, 3)
  - [x] Ganti teks "X transaksi pada shift aktif" menjadi dinamis berdasarkan mode:
    - mode shift: "X transaksi pada shift aktif"
    - mode date: "X transaksi dari [from] hingga [to]"
  - [x] Jika filter search aktif: tambahkan "(menampilkan Y dari X)"

## Dev Notes

### 🔑 Modifikasi `history/page.tsx` — Cara Membaca `searchParams`

Di Next.js 15 (App Router), `searchParams` pada page.tsx adalah `Promise`:

```typescript
// apps/backoffice/app/pos/(authenticated)/history/page.tsx
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; mode?: string }>
}) {
  const params = await searchParams
  const mode = params.mode ?? 'shift'
  const fromDate = params.from ? new Date(params.from + 'T00:00:00') : null
  const toDate = params.to ? new Date(params.to + 'T23:59:59') : null
  // ...
}
```

### 🔑 Query DB untuk Mode Date Range

Impor yang diperlukan (tambahkan ke yang sudah ada):

```typescript
import {
  db, transactions, transactionItems, transactionPayments,
  products, unitsOfMeasure, paymentMethods, shifts,
  eq, and, desc, inArray,
  gte, lte,   // ← TAMBAH INI
} from '@/lib/db'
```

Query untuk mode date range:

```typescript
// Mode date: query tanpa shiftId, gunakan createdAt range
const conditions = [
  eq(transactions.branchId, branchId),
  eq(transactions.cashierId, payload.userId),
  inArray(transactions.status, ['COMPLETED', 'VOIDED']),
]
if (fromDate) conditions.push(gte(transactions.createdAt, fromDate))
if (toDate) conditions.push(lte(transactions.createdAt, toDate))

const txList = await db
  .select({ /* ... kolom sama dengan mode shift */ })
  .from(transactions)
  .where(and(...conditions))
  .orderBy(desc(transactions.createdAt))
  .limit(100)  // limit lebih besar untuk date range
```

### 🔑 Props Baru `TransactionHistoryClient`

Tambahkan props berikut:

```typescript
interface TransactionHistoryClientProps {
  transactions: TransactionWithDetails[]
  branchName: string
  cashierName: string
  activeShiftId: number | null  // ← BARU — null jika tidak ada shift aktif
  currentMode: 'shift' | 'date' // ← BARU
  currentFrom?: string           // ← BARU — format YYYY-MM-DD
  currentTo?: string             // ← BARU — format YYYY-MM-DD
}
```

Pass dari `history/page.tsx`:

```typescript
return (
  <TransactionHistoryClient
    transactions={transactionsWithDetails}
    branchName={payload.branchName}
    cashierName={payload.userName}
    activeShiftId={activeShift?.id ?? null}
    currentMode={mode === 'date' ? 'date' : 'shift'}
    currentFrom={params.from}
    currentTo={params.to}
  />
)
```

### 🔑 Navigasi Filter di Client Component

```typescript
'use client'
import { useRouter } from 'next/navigation'
import { useState, useMemo } from 'react'

// Di dalam TransactionHistoryClient:
const router = useRouter()

function applyDateFilter(from: string, to: string) {
  router.push(`/pos/history?mode=date&from=${from}&to=${to}`)
}

function resetToShiftMode() {
  router.push('/pos/history')
}
```

### 🔑 Client-side Search dengan `useMemo`

```typescript
const [searchQuery, setSearchQuery] = useState('')

const filteredTransactions = useMemo(() => {
  if (!searchQuery.trim()) return transactions
  const q = searchQuery.toLowerCase()
  return transactions.filter((tx) => tx.trxNumber.toLowerCase().includes(q))
}, [transactions, searchQuery])

// Gunakan `filteredTransactions` (bukan `transactions`) untuk render list
```

### ⚠️ Penanganan Kasus Tidak Ada Shift Aktif + Mode Date

Jika mode=date dan tidak ada shift aktif:
- **JANGAN redirect atau error** — date filter tidak perlu shift aktif
- Lakukan query date range tanpa `shiftId`
- Tampilkan hasil normal (mungkin kosong jika tidak ada transaksi)
- Hanya mode=shift yang memerlukan shift aktif untuk query

```typescript
// Di history/page.tsx
if (mode === 'shift') {
  if (!activeShift) {
    return <NoShiftErrorUI />
  }
  // query berdasarkan shiftId
} else {
  // mode date — query tanpa shiftId, tidak masalah jika activeShift null
}
```

### 🔑 Format Input Tanggal HTML

Gunakan `<input type="date">` native — tidak perlu library kalender eksternal:

```typescript
// Value format: YYYY-MM-DD (sesuai HTML date input)
<input
  type="date"
  value={localFrom}
  onChange={(e) => setLocalFrom(e.target.value)}
  className="border rounded-lg px-3 py-2 text-sm min-h-[44px] w-full"
  max={new Date().toISOString().split('T')[0]}  // tidak bisa pilih tanggal masa depan
/>
```

### Struktur File

**DIMODIFIKASI:**
- `apps/backoffice/app/pos/(authenticated)/history/page.tsx` — tambah `searchParams`, conditional query logic, props baru ke client
- `apps/backoffice/components/pos/transaction-history-client.tsx` — tambah search bar, filter UI, navigasi router

**TIDAK DIUBAH:**
- `apps/backoffice/components/pos/transaction-detail-modal.tsx` — tidak perlu disentuh
- `apps/backoffice/components/pos/pos-nav-tabs.tsx` — tidak perlu disentuh
- `apps/backoffice/components/pos/receipt-print.tsx` — tidak perlu disentuh
- `apps/backoffice/app/pos/(authenticated)/layout.tsx` — tidak perlu disentuh
- `apps/backoffice/app/api/pos/transactions/route.ts` — **JANGAN BUAT GET endpoint baru**, gunakan Server Component + URL params

### Checklist Anti-Regresi

- [ ] `/pos` (main POS page) masih bisa diakses dan tidak berubah
- [ ] `/pos/history` tanpa searchParams masih tampil daftar transaksi shift aktif (AC3 default)
- [ ] Modal detail transaksi masih bisa dibuka dari hasil filter search
- [ ] Cetak ulang struk masih berfungsi dari detail modal
- [ ] Navigasi tab "Kasir" ↔ "History" masih berfungsi

### Konvensi Wajib

- File names: **kebab-case**
- TypeScript: **strict mode**, tidak ada `any`
- Error messages user-facing: **Bahasa Indonesia**
- Server Components default; Client Component hanya saat perlu interaktivitas/hooks
- Komponen > 200 baris → pecah jadi modul lebih kecil (pertimbangkan buat `history-filter-bar.tsx` terpisah jika filter UI kompleks)

### Reference Files

- `apps/backoffice/app/pos/(authenticated)/history/page.tsx` — file utama yang dimodifikasi
- `apps/backoffice/components/pos/transaction-history-client.tsx` — client component yang dimodifikasi
- `apps/backoffice/lib/db.ts` — DB instance dan exports (pastikan `gte`, `lte` tersedia)
- `packages/db/src/schema/transactions.ts` — schema tabel `transactions` (kolom `createdAt: timestamp`)
- `apps/backoffice/app/pos/(authenticated)/page.tsx` — referensi pola Server Component + auth

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `gte` dan `lte` sudah di-export dari `@petshop/db` via `packages/db/src/index.ts` — tidak perlu package tambahan.
- TypeScript `tsc --noEmit` bersih tanpa error.
- Lint error yang ada adalah pre-existing issue di `audit-log/page.tsx` (bukan akibat perubahan story ini).
- Next.js 15 App Router: `searchParams` pada `page.tsx` adalah `Promise<...>` — wajib `await` sebelum akses property.

### Completion Notes List

- Task 1: `history/page.tsx` dimodifikasi untuk menerima `searchParams` sebagai Promise. Dua mode query: `shift` (default, query berdasarkan `shiftId` aktif) dan `date` (query berdasarkan `createdAt` range dengan `gte`/`lte`). Mode date tidak memerlukan shift aktif — dapat query meski tidak ada shift. Props baru `activeShiftId`, `currentMode`, `currentFrom`, `currentTo` di-pass ke client.
- Task 2: `TransactionHistoryClient` mendapat search bar `<input type="search">` dengan `useMemo` untuk filter client-side berdasarkan `trxNumber`. Performa O(n) di memory tanpa debounce (< 200ms terpenuhi). Empty state berbeda antara "tidak ada hasil pencarian" vs "tidak ada transaksi".
- Task 3: Filter tanggal dengan dua `<input type="date">` native (tidak perlu library eksternal). Toggle "Shift Aktif" / "Pilih Tanggal" menggunakan `useRouter().push()`. Date picker hanya tampil saat mode date aktif. Max date = hari ini (tidak bisa pilih masa depan). Tombol "Terapkan" untuk submit date range.
- Task 4: Header label dinamis sesuai mode dan state search: "X transaksi pada shift aktif", "X transaksi dari [from] – [to]", atau "Menampilkan Y dari X transaksi (...)" saat search aktif.
- Semua AC terpenuhi: search real-time < 200ms (AC1), date filter server-side re-fetch (AC2), default view shift aktif (AC3).

### File List

- `apps/backoffice/app/pos/(authenticated)/history/page.tsx` (dimodifikasi — tambah searchParams, date range query, props baru)
- `apps/backoffice/components/pos/transaction-history-client.tsx` (dimodifikasi — tambah search bar, date filter UI, router navigation)

### Review Findings

#### Decision Needed (Resolved/Checked)
- [x] [Review][Decision] Status Transaksi `PENDING_VOID` — Inkonsistensi status penarikan data antara server (hanya COMPLETED/VOIDED) dan client (ada UI untuk PENDING_VOID). Apakah status PENDING_VOID harus didukung? (Diputuskan: Opsi A - didukung dan ditarik dari server)
- [x] [Review][Decision] Batasan Hardcoded 100 Data & Pencarian Client-side — Masalah skala data jika transaksi kasir > 100 per hari, karena pencarian hanya bekerja client-side pada data ter-load. Apakah perlu implementasi pagination? (Diputuskan: Opsi B - hybrid server-side search dengan limit 10000)

#### Patch Findings (Resolved/Checked)
- [x] [Review][Patch] Crash Runtime Akibat Pemanggilan `.toISOString()` Ganda pada `createdAt` [apps/backoffice/app/pos/(authenticated)/history/page.tsx:228]
- [x] [Review][Patch] Potensi Crash Saat `searchParams` Undefined [apps/backoffice/app/pos/(authenticated)/history/page.tsx:79]
- [x] [Review][Patch] Pemuatan Query Tanpa Batas / Query Leakage [apps/backoffice/app/pos/(authenticated)/history/page.tsx:110]
- [x] [Review][Patch] Crash & Kegagalan Query Akibat Invalid Date di URL [apps/backoffice/app/pos/(authenticated)/history/page.tsx:124-125]
- [x] [Review][Patch] Bug Zona Waktu (Timezone Drift) di Date Picker & Parsing [apps/backoffice/components/pos/transaction-history-client.tsx:75]
- [x] [Review][Patch] Rentang Tanggal Terbalik Tanpa Validasi [apps/backoffice/components/pos/transaction-history-client.tsx:142]
- [x] [Review][Patch] Inkonsistensi Format Teks Label Header Dinamis [apps/backoffice/components/pos/transaction-history-client.tsx:49]
- [x] [Review][Patch] Redundansi Pemetaan (Redundant Mapping) `.toISOString()` [apps/backoffice/app/pos/(authenticated)/history/page.tsx:110]

#### Deferred Findings (Resolved/Checked)
- [x] [Review][Defer] Ketiadaan Indikator Loading Visual [apps/backoffice/components/pos/transaction-history-client.tsx:60] — deferred, pre-existing
- [x] [Review][Defer] N+1 Query Relasional pada ID Transaksi [apps/backoffice/app/pos/(authenticated)/history/page.tsx:180] — deferred, pre-existing

