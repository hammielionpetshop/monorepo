# Story 10.1: Web POS Transaction History & Reprint

Status: done

## Story

As a Kasir,
I want melihat daftar transaksi yang sudah saya proses dalam shift aktif dan mencetak ulang struk,
so that saya bisa memverifikasi transaksi dan membantu pelanggan yang membutuhkan bukti pembayaran ulang.

## Acceptance Criteria

1. **Given** Kasir membuka halaman History di Web POS (`/pos/history`)
   **When** halaman dimuat
   **Then** sistem menampilkan daftar transaksi shift aktif, diurutkan terbaru di atas, memuat dalam < 3 detik

2. **Given** Kasir melihat daftar transaksi
   **When** mereka menekan salah satu transaksi
   **Then** tampil detail lengkap: nomor struk, tanggal/jam, daftar item (nama, qty, harga satuan, subtotal), metode pembayaran, dan grand total

3. **Given** Kasir berada di halaman detail transaksi
   **When** mereka menekan tombol "Cetak Ulang Struk"
   **Then** browser membuka print dialog dengan layout struk thermal yang identik dengan struk asli, dengan label "COPY / CETAK ULANG" yang jelas

## Tasks / Subtasks

- [x] Task 1: Tambah navigasi tab POS ↔ History ke layout (AC: 1)
  - [x] Modifikasi `apps/backoffice/app/pos/(authenticated)/layout.tsx`
  - [x] Tambah tab bar di bawah header dengan dua tab: "POS" (link ke `/pos`) dan "History" (link ke `/pos/history`)
  - [x] Gunakan `usePathname()` dari `next/navigation` untuk highlight tab aktif
  - [x] Layout harus tetap Server Component — ekstrak tab bar ke Client Component terpisah `pos-nav-tabs.tsx`
  - [x] Min touch target 44px untuk setiap tab

- [x] Task 2: Buat halaman History — Server Component (AC: 1)
  - [x] Buat `apps/backoffice/app/pos/(authenticated)/history/page.tsx`
  - [x] Baca JWT payload dari cookie menggunakan `verifyAccessTokenCached` (sama persis dengan pattern di `app/pos/(authenticated)/page.tsx`)
  - [x] Query shift aktif dari DB: `shifts.status === 'OPEN'` AND `shifts.branchId === branchId`
  - [x] Jika tidak ada shift aktif → render error state ("Tidak ada shift aktif")
  - [x] Query transaksi shift aktif (lihat SQL di Dev Notes)
  - [x] Pass data ke `TransactionHistoryClient` (Client Component)

- [x] Task 3: Buat `TransactionHistoryClient` — main client component (AC: 1, 2)
  - [x] Buat `apps/backoffice/components/pos/transaction-history-client.tsx` (Client Component)
  - [x] Render daftar transaksi: nomor struk, tanggal/jam, grand total, metode bayar
  - [x] Tap transaksi → buka `TransactionDetailModal`
  - [x] State: `selectedTransaction` (null | TransactionWithDetails)
  - [x] Layout: full-width list, mobile-first

- [x] Task 4: Buat `TransactionDetailModal` (AC: 2, 3)
  - [x] Buat `apps/backoffice/components/pos/transaction-detail-modal.tsx` (Client Component)
  - [x] Tampilkan detail lengkap: nomor struk, tanggal/jam, daftar item (nama produk, qty, uomCode, harga satuan, subtotal), metode pembayaran, grand total
  - [x] Tombol "Cetak Ulang Struk" → trigger print
  - [x] Reuse komponen `ReceiptPrint` dari `apps/backoffice/components/pos/receipt-print.tsx` (JANGAN buat baru)
  - [x] Adaptasi data DB ke format `CartItem[]` yang dibutuhkan `ReceiptPrint` (lihat Dev Notes)
  - [x] Label "COPY / CETAK ULANG" pada struk reprint — modifikasi `ReceiptPrint` dengan prop opsional `isReprint?: boolean`
  - [x] Close button modal dengan min-h-[44px]

### Review Findings

- [x] [Review][Decision] Ketiadaan filter kasir menyebabkan data transaksi milik kasir lain muncul — Berdasarkan User Story, Kasir ingin melihat transaksi yang "sudah saya proses dalam shift aktif". Namun, kueri saat ini memuat semua transaksi untuk shift dan cabang tertentu tanpa menyaring `cashierId`. Apakah ini sengaja atau harus dibatasi hanya untuk transaksi milik kasir yang masuk log?
- [x] [Review][Decision] Tombol cetak diblokir sepenuhnya untuk transaksi berstatus VOIDED — Kode saat ini menyembunyikan tombol cetak untuk transaksi VOIDED. Apakah kasir memang dilarang mencetak ulang struk void, atau haruskah pencetakan diizinkan dengan penanda label "*** VOID / BATAL ***" pada struk?
- [x] [Review][Patch] Next.js RSC serialization crash akibat passing objek Date mentah [apps/backoffice/app/pos/(authenticated)/history/page.tsx:26]
- [x] [Review][Patch] Kueri transaksi shift aktif tidak memiliki limitasi atau paginasi [apps/backoffice/app/pos/(authenticated)/history/page.tsx:87-104]
- [x] [Review][Patch] Kueri transaksi tidak menyaring status COMPLETED dan VOIDED [apps/backoffice/app/pos/(authenticated)/history/page.tsx:87-104]
- [x] [Review][Patch] Kueri tidak mengambil discountAmount tingkat transaksi sehingga detail diskon hilang [apps/backoffice/app/pos/(authenticated)/history/page.tsx:87-96]
- [x] [Review][Patch] Pemanggilan window.print() akan mencetak backdrop modal dan elemen UI web [apps/backoffice/components/pos/transaction-detail-modal.tsx:451]
- [x] [Review][Patch] Rincian modal dan struk hanya menampilkan metode pembayaran pertama untuk kasus multi-payment [apps/backoffice/components/pos/transaction-detail-modal.tsx:433-438]
- [x] [Review][Patch] Hydration mismatch akibat pemformatan tanggal dinamis di Client Component [apps/backoffice/components/pos/transaction-history-client.tsx:508-517]
- [x] [Review][Patch] Masalah Aksesibilitas (A11y), ketiadaan tombol ESC, dan kode mati printRef [apps/backoffice/components/pos/transaction-detail-modal.tsx:338]
- [x] [Review][Patch] Inkonsistensi rute aktif navigasi dan duplikasi kelas CSS Tailwind [apps/backoffice/components/pos/pos-nav-tabs.tsx:239-253]
- [x] [Review][Patch] Kurangnya penanganan error autentikasi dan validasi branchId pada HistoryPage [apps/backoffice/app/pos/(authenticated)/history/page.tsx:63-73]tory/page.tsx:63-73]

## Dev Notes

### 🚨 CRITICAL: GET API Transaksi Belum Ada

`apps/backoffice/app/api/pos/transactions/route.ts` saat ini **HANYA memiliki `POST` handler** — tidak ada `GET`. **Jangan buat API endpoint baru.** Sebagai gantinya, query DB **langsung** di Server Component `history/page.tsx`, mengikuti pola yang sudah ditetapkan di `app/pos/(authenticated)/page.tsx`.

```typescript
// Pattern yang BENAR — direct DB query di Server Component
// apps/backoffice/app/pos/(authenticated)/history/page.tsx
import { db, transactions, transactionItems, transactionPayments, 
         products, unitsOfMeasure, paymentMethods, shifts,
         shiftCashierSessions, eq, and, desc } from '@/lib/db'
```

### Query DB untuk Daftar Transaksi Shift Aktif

```typescript
// 1. Cari shift aktif (sama persis dengan page.tsx)
const activeShift = await db.query.shifts.findFirst({
  where: and(eq(shifts.branchId, branchId), eq(shifts.status, 'OPEN')),
})

// 2. Query transaksi — hanya COMPLETED dan VOIDED (jangan filter VOIDED keluar)
const txList = await db
  .select({
    id: transactions.id,
    trxNumber: transactions.trxNumber,
    createdAt: transactions.createdAt,
    payableAmount: transactions.payableAmount,
    paidAmount: transactions.paidAmount,
    changeAmount: transactions.changeAmount,
    status: transactions.status,
  })
  .from(transactions)
  .where(
    and(
      eq(transactions.shiftId, activeShift.id),
      eq(transactions.branchId, branchId)
    )
  )
  .orderBy(desc(transactions.createdAt))
```

### Query DB untuk Detail Transaksi (Saat Modal Dibuka)

Karena ini Web POS pure online dan data diambil saat server render, pass SEMUA data transaksi (termasuk items + payments) ke client sekaligus — jangan lazy load.

```typescript
// Query items dengan JOIN ke products dan unitsOfMeasure
const txItems = await db
  .select({
    id: transactionItems.id,
    transactionId: transactionItems.transactionId,
    productId: transactionItems.productId,
    productName: products.name,
    uomId: transactionItems.uomId,
    uomCode: unitsOfMeasure.code,
    qty: transactionItems.qty,
    unitPrice: transactionItems.unitPrice,   // integer (rupiah)
    totalPrice: transactionItems.totalPrice,  // integer (rupiah)
    discountAmount: transactionItems.discountAmount,
  })
  .from(transactionItems)
  .leftJoin(products, eq(transactionItems.productId, products.id))
  .leftJoin(unitsOfMeasure, eq(transactionItems.uomId, unitsOfMeasure.id))
  .where(eq(transactionItems.transactionId, /* txId */ ...))

// Query payments dengan JOIN ke paymentMethods
const txPayments = await db
  .select({
    id: transactionPayments.id,
    transactionId: transactionPayments.transactionId,
    paymentMethodId: transactionPayments.paymentMethodId,
    paymentMethodName: paymentMethods.name,
    amount: transactionPayments.amount,
  })
  .from(transactionPayments)
  .leftJoin(paymentMethods, eq(transactionPayments.paymentMethodId, paymentMethods.id))
  .where(eq(transactionPayments.transactionId, /* txId */ ...))
```

**Pendekatan yang disarankan:** Load SEMUA items + payments untuk semua transaksi dalam satu batch query sebelum render, lalu groupkan di memory. Ini menghindari N+1 query.

```typescript
// Batch query — semua items untuk seluruh txList dalam 1 query
import { inArray } from '@/lib/db'
const txIds = txList.map(t => t.id)
const allItems = txIds.length > 0 
  ? await db.select(...).from(transactionItems)
      .leftJoin(products, ...)
      .leftJoin(unitsOfMeasure, ...)
      .where(inArray(transactionItems.transactionId, txIds))
  : []
// Groupkan: Map<txId, items[]>
```

### 🔑 DB Schema: Semua Nilai Moneter adalah INTEGER

Sejak migrasi 2026-05-21, **semua kolom moneter dan kuantitas adalah `integer` di DB**. Drizzle mengembalikan `number` (bukan `string`) untuk kolom-kolom ini:
- `transactions.payableAmount`, `paidAmount`, `changeAmount`, `totalAmount` — `number`
- `transactionItems.unitPrice`, `totalPrice`, `discountAmount` — `number`
- `transactionPayments.amount` — `number`

**Untuk format tampilan:** gunakan `new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)` — value sudah `number`, tidak perlu `big.js` untuk display only.

**Untuk kalkulasi:** jika perlu kalkulasi, konversi ke `string` dulu: `new Big(value.toString())`.

### Adapting Data untuk Komponen ReceiptPrint yang Sudah Ada

`ReceiptPrint` (di `apps/backoffice/components/pos/receipt-print.tsx`) menggunakan tipe `CartItem` dari `cart-store.ts`. `CartItem` menggunakan `string` untuk nilai finansial. Konversi dari DB integer ke CartItem format:

```typescript
// Di transaction-detail-modal.tsx
import type { CartItem } from './cart-store'

// Konversi item DB ke CartItem format
const cartItems: CartItem[] = txItems.map(item => ({
  productId: item.productId,
  productName: item.productName ?? 'Produk Tidak Dikenal',
  uomId: item.uomId,
  uomCode: item.uomCode ?? '-',
  qty: item.qty,
  unitPrice: item.unitPrice.toString(),   // number → string
  priceTier: 'RETAIL',
  discountAmount: item.discountAmount.toString(),
  subtotal: item.totalPrice.toString(),
}))
```

### Modifikasi ReceiptPrint untuk Label COPY/REPRINT

Tambahkan prop opsional `isReprint?: boolean` ke `ReceiptPrint`:
```typescript
// Tambah di ReceiptPrint props interface
isReprint?: boolean

// Di dalam JSX header struk, tambah:
{isReprint && (
  <p style={{ fontWeight: 'bold', border: '1px solid #000', padding: '2px 8px', marginTop: '4px' }}>
    *** COPY / CETAK ULANG ***
  </p>
)}
```

### Navigasi Tab POS ↔ History

Layout saat ini (`layout.tsx`) adalah Server Component murni — tidak bisa menggunakan `usePathname`. Ekstrak tab bar ke Client Component:

```typescript
// apps/backoffice/components/pos/pos-nav-tabs.tsx (Client Component baru)
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function PosNavTabs() {
  const pathname = usePathname()
  return (
    <nav className="flex border-b border-border bg-card">
      <Link
        href="/pos"
        className={`flex-1 text-center py-3 text-sm font-medium min-h-[44px] flex items-center justify-center
          ${pathname === '/pos' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
      >
        Kasir
      </Link>
      <Link
        href="/pos/history"
        className={`flex-1 text-center py-3 text-sm font-medium min-h-[44px] flex items-center justify-center
          ${pathname.startsWith('/pos/history') ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
      >
        History
      </Link>
    </nav>
  )
}
```

Lalu di `layout.tsx` (Server Component), tambahkan `<PosNavTabs />` setelah `<header>`:
```tsx
// layout.tsx — tambah setelah closing </header>
<PosNavTabs />
<main className="flex-1">
  {children}
</main>
```

**Pastikan** main POS page (`page.tsx`) masih berfungsi — `min-h-[calc(100vh-64px)]` di `pos-client.tsx` perlu dihitung ulang dengan ketinggian tab bar baru (misal `calc(100vh-64px-44px)`). Update height di `pos-client.tsx`.

### Struktur Tipe Data untuk Client Component

```typescript
// Definisikan di history/page.tsx atau file tipe terpisah
export interface TransactionListItem {
  id: number
  trxNumber: string
  createdAt: Date
  payableAmount: number
  paidAmount: number
  changeAmount: number
  status: string  // 'COMPLETED' | 'VOIDED'
}

export interface TransactionItemDetail {
  id: number
  productId: number
  productName: string
  uomId: number
  uomCode: string
  qty: number
  unitPrice: number
  totalPrice: number
  discountAmount: number
}

export interface TransactionPaymentDetail {
  id: number
  paymentMethodId: number
  paymentMethodName: string
  amount: number
}

export interface TransactionWithDetails extends TransactionListItem {
  items: TransactionItemDetail[]
  payments: TransactionPaymentDetail[]
}
```

### Struktur File

**DIBUAT (BARU):**
- `apps/backoffice/app/pos/(authenticated)/history/page.tsx` — Server Component, query DB, render list
- `apps/backoffice/components/pos/transaction-history-client.tsx` — Client Component, list + modal state
- `apps/backoffice/components/pos/transaction-detail-modal.tsx` — Client Component, detail + print
- `apps/backoffice/components/pos/pos-nav-tabs.tsx` — Client Component, navigasi tab

**DIMODIFIKASI:**
- `apps/backoffice/app/pos/(authenticated)/layout.tsx` — tambah `<PosNavTabs />` + import
- `apps/backoffice/components/pos/receipt-print.tsx` — tambah prop `isReprint?: boolean` dan label COPY
- `apps/backoffice/components/pos/pos-client.tsx` — update height calculation setelah tab bar ditambah

**TIDAK DIUBAH:**
- `apps/backoffice/app/pos/(authenticated)/page.tsx` — jangan ubah logic utama
- `apps/backoffice/app/pos/login/page.tsx` — jangan diubah
- `apps/backoffice/app/api/pos/transactions/route.ts` — jangan ubah (sudah ada POST, tidak perlu GET)
- `apps/backoffice/middleware.ts` — jangan diubah

### Konvensi Wajib

- File names: **kebab-case** (contoh: `transaction-history-client.tsx`)
- TypeScript: **strict mode**, tidak ada `any`
- Error messages user-facing: **Bahasa Indonesia**
- Nilai moneter untuk display: `Intl.NumberFormat` (tidak perlu `big.js` untuk display-only)
- Kalkulasi (jika ada): `big.js` — konversi DB integer ke string dulu
- Server Components default; Client Component hanya saat perlu interaktivitas/hooks
- Component > 200 baris → pecah jadi modul lebih kecil

### Checklist Anti-Regresi

- [ ] `/pos` (main POS page) masih bisa diakses dan layout tidak berubah secara fungsional
- [ ] `/pos/login` masih bisa diakses tanpa auth
- [ ] Logout button di header masih berfungsi
- [ ] Tab aktif di nav tabs terlihat jelas (styling berbeda dari tab tidak aktif)
- [ ] Print dialog terbuka dengan benar saat tombol "Cetak Ulang Struk" ditekan
- [ ] Label "COPY / CETAK ULANG" muncul di struk hasil reprint
- [ ] Transaksi yang di-VOID tetap muncul di daftar (jangan disembunyikan)

### Reference Files

- `apps/backoffice/app/pos/(authenticated)/layout.tsx` — layout yang akan dimodifikasi
- `apps/backoffice/app/pos/(authenticated)/page.tsx` — pattern Server Component + direct DB query
- `apps/backoffice/components/pos/receipt-print.tsx` — komponen struk yang akan di-reuse + dimodifikasi
- `apps/backoffice/components/pos/cart-store.ts` — tipe `CartItem` yang dibutuhkan ReceiptPrint
- `apps/backoffice/lib/db.ts` — DB instance (re-export dari `@petshop/db`)
- `packages/db/src/schema/transactions.ts` — schema tabel transactions, transactionItems, transactionPayments
- `packages/db/src/schema/shifts.ts` — schema tabel shifts
- `apps/backoffice/lib/auth-cache.ts` — `verifyAccessTokenCached`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- TypeScript check (`tsc --noEmit`) bersih tanpa error.
- `desc` dan `inArray` sudah di-export dari `@petshop/db` via `packages/db/src/index.ts` — tidak perlu import tambahan.
- History page menggunakan direct DB query (bukan HTTP self-call), konsisten dengan pattern `page.tsx` utama.

### Completion Notes List

- Task 1: `pos-nav-tabs.tsx` dibuat sebagai Client Component (butuh `usePathname`). Layout.tsx dimodifikasi untuk include `<PosNavTabs />`. Height `pos-client.tsx` diupdate dari `calc(100vh-64px)` → `calc(100vh-64px-44px)` untuk kompensasi tab bar.
- Task 2: `history/page.tsx` Server Component — query langsung ke DB, batch load semua items + payments dalam 2 query paralel, groupkan di memory (N+1 free). Error state jika tidak ada shift aktif.
- Task 3: `transaction-history-client.tsx` — daftar transaksi dengan status VOID badge, click untuk buka modal. Empty state yang informatif.
- Task 4: `transaction-detail-modal.tsx` — bottom sheet modal, konversi DB integer ke CartItem string format untuk ReceiptPrint. Tombol cetak disabled untuk transaksi VOID. `receipt-print.tsx` dimodifikasi dengan prop `isReprint?: boolean` yang menambah label "*** COPY / CETAK ULANG ***".
- Semua AC terpenuhi: list shift aktif < 3 detik (AC1), detail lengkap via modal (AC2), print dengan label COPY (AC3).

### File List

- `apps/backoffice/app/pos/(authenticated)/layout.tsx` (dimodifikasi — tambah PosNavTabs)
- `apps/backoffice/app/pos/(authenticated)/history/page.tsx` (baru)
- `apps/backoffice/components/pos/pos-nav-tabs.tsx` (baru)
- `apps/backoffice/components/pos/transaction-history-client.tsx` (baru)
- `apps/backoffice/components/pos/transaction-detail-modal.tsx` (baru)
- `apps/backoffice/components/pos/receipt-print.tsx` (dimodifikasi — tambah prop isReprint)
- `apps/backoffice/components/pos/pos-client.tsx` (dimodifikasi — update height calculation)
