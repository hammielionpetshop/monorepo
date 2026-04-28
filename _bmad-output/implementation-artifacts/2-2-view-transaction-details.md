---
epic_id: 2
story_id: 2.2
story_key: 2-2-view-transaction-details
status: review
created_at: 2026-04-28
---

# Story 2.2: View Transaction Details

## Story

As a Kasir,
I want melihat rincian sebuah transaksi dari daftar riwayat,
So that saya bisa melihat barang apa saja yang dibeli dan berapa pajaknya.

## Acceptance Criteria

1. **Given** Kasir berada di halaman daftar History (`/history`)
   **When** mereka mengklik salah satu baris transaksi
   **Then** sebuah dialog/modal muncul menampilkan detail transaksi tersebut
   **And** dialog berisi: nomor struk, waktu transaksi, nama pelanggan (jika ada)
   **And** dialog berisi tabel item: nama produk, kuantitas+satuan, harga satuan, diskon per item, subtotal per item
   **And** dialog berisi ringkasan: Subtotal, Diskon, Grand Total
   **And** dialog berisi info pembayaran: metode pembayaran, nominal, total dibayar, kembalian

2. **Given** dialog detail sedang terbuka
   **When** Kasir menekan tombol "Tutup" atau mengklik area di luar dialog
   **Then** dialog tertutup dan kembali ke halaman daftar History

## Tasks / Subtasks

- [x] **Buat `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx`** (komponen baru)
  - [x] Props: `transaction: LocalTransaction | null`, `paymentMethods: PaymentMethod[]`, `onClose: () => void`
  - [x] Render `null` jika `transaction === null`
  - [x] Header dialog: nomor struk, waktu (date + time), nama pelanggan
  - [x] Tabel item: No | Produk | Qty Satuan | Harga Satuan | Diskon | Subtotal
  - [x] Ringkasan: Subtotal | Diskon Total | Grand Total
  - [x] Info pembayaran: setiap metode + nominal, Total Dibayar, Kembalian
  - [x] Tombol "Tutup" di footer
  - [x] Klik overlay (backdrop) menutup dialog

- [x] **Modifikasi `apps/pos-desktop/src/pages/History.tsx`**
  - [x] Tambah state: `selectedTransaction: LocalTransaction | null` (init `null`)
  - [x] Ganti `cursor-default` menjadi `cursor-pointer` pada baris transaksi
  - [x] Tambah `onClick={() => setSelectedTransaction(trx)}` pada setiap baris
  - [x] Render `<TransactionDetailDialog>` di bawah daftar

## Dev Notes

### Konteks Kritis

**`localTransactions.payload` — sudah tersedia, tidak butuh query tambahan:**

Saat baris diklik, `LocalTransaction` sudah ada di state `transactions`. Pass langsung ke dialog tanpa query DB baru.

```typescript
// payload structure yang ditulis PaymentDialog.tsx:
payload: {
  branchId: number,
  shiftId: number,
  cashierId: number | null,
  customerId: number | null,
  trxNumber: string,
  items: CartItem[],      // GUNAKAN INI untuk tabel item
  totals: CartTotals,     // subtotal, discountTotal, grandTotal, itemCount
  amountPaid: number,     // total yang dibayar kasir
  change: number,         // kembalian
  payments: Array<{
    paymentMethodId: number,
    amount: number,
    referenceNumber: null
  }>
}
```

**`CartItem` interface dari `@petshop/shared`:**
```typescript
interface CartItem {
  productId: number
  productName: string
  uomId: number
  uomCode: string        // satuan (pcs, kg, dll)
  qty: number
  unitPrice: number      // harga satuan (big.js—tersimpan sebagai number)
  priceTier: string
  discountAmount: number // diskon per item (total, bukan per unit)
  subtotal: number       // (unitPrice * qty) - discountAmount
  isOwnerOverride: boolean
}
```

**`CartTotals` interface:**
```typescript
interface CartTotals {
  subtotal: number       // sum of item subtotals sebelum pajak
  discountTotal: number  // sum of discountAmount semua item
  grandTotal: number     // yang harus dibayar
  itemCount: number
  totalWeightGram: number
}
```

**Kalkulasi Pajak:**
Saat ini `TransactionService.createTransaction()` mengisi `taxAmount = '0'`. `CartTotals` tidak menyimpan tax secara eksplisit. Hitung derivatif:
```typescript
const taxAmount = payload.totals.grandTotal - (payload.totals.subtotal - payload.totals.discountTotal)
// Jika taxAmount <= 0 atau NaN: sembunyikan baris pajak
```

**Lookup nama metode pembayaran:**
```typescript
// paymentMethods dari usePOSStore() — sudah tersedia di History.tsx, pass ke dialog via props
const methodName = paymentMethods.find((m: any) => m.id === p.paymentMethodId)?.name ?? '—'
```

### Anti-Pattern yang DILARANG

```typescript
// ❌ DILARANG: query ulang ke Dexie untuk data yang sudah ada
const detail = await historyService.getById(trx.id) // TIDAK PERLU — payload sudah ada

// ✅ BENAR: gunakan data yang sudah di-load saat klik
onClick={() => setSelectedTransaction(trx)} // trx sudah punya payload lengkap
```

### Implementasi `TransactionDetailDialog.tsx` yang Diharapkan

```typescript
// apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx
import React from 'react'
import { X } from 'lucide-react'
import type { LocalTransaction } from '@/lib/db'
import { formatRupiah } from '@/lib/utils'

interface TransactionDetailDialogProps {
  transaction: LocalTransaction | null
  paymentMethods: any[]
  onClose: () => void
}

export const TransactionDetailDialog: React.FC<TransactionDetailDialogProps> = ({
  transaction,
  paymentMethods,
  onClose,
}) => {
  if (!transaction) return null

  const payload = transaction.payload ?? {}
  const items = payload.items ?? []
  const totals = payload.totals ?? {}
  const payments = payload.payments ?? []
  const amountPaid = payload.amountPaid ?? 0
  const change = payload.change ?? 0

  const taxAmount = (totals.grandTotal ?? 0) - ((totals.subtotal ?? 0) - (totals.discountTotal ?? 0))
  const showTax = taxAmount > 0.001

  const formatDateTime = (timestamp: number) => {
    if (!timestamp || isNaN(timestamp)) return '—'
    return new Date(timestamp).toLocaleString('id-ID', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const getMethodName = (paymentMethodId: number) =>
    paymentMethods.find((m: any) => m.id === paymentMethodId)?.name ?? '—'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[85vh] flex flex-col bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/5 shrink-0">
          <div>
            <h2 className="text-lg font-black text-white">{transaction.trxNumber}</h2>
            <p className="text-sm text-neutral-500 mt-0.5">{formatDateTime(transaction.createdAt)}</p>
            {transaction.customerName && (
              <p className="text-sm text-brand-400 mt-0.5">{transaction.customerName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">

          {/* Items Table */}
          <div>
            <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">Item Pembelian</h3>
            <div className="space-y-1">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] font-black text-neutral-600 uppercase tracking-widest">
                <span className="col-span-1">#</span>
                <span className="col-span-4">Produk</span>
                <span className="col-span-2 text-right">Qty</span>
                <span className="col-span-2 text-right">Harga</span>
                <span className="col-span-1 text-right">Disc</span>
                <span className="col-span-2 text-right">Subtotal</span>
              </div>
              {items.map((item: any, idx: number) => (
                <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2.5 bg-white/5 rounded-lg text-sm">
                  <span className="col-span-1 text-neutral-600">{idx + 1}</span>
                  <span className="col-span-4 text-white font-medium leading-tight">{item.productName}</span>
                  <span className="col-span-2 text-right text-neutral-300">
                    {item.qty} <span className="text-neutral-600 text-xs">{item.uomCode}</span>
                  </span>
                  <span className="col-span-2 text-right text-neutral-300">{formatRupiah(item.unitPrice)}</span>
                  <span className="col-span-1 text-right text-red-400 text-xs">
                    {item.discountAmount > 0 ? `-${formatRupiah(item.discountAmount)}` : '—'}
                  </span>
                  <span className="col-span-2 text-right text-white font-bold">{formatRupiah(item.subtotal)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div>
            <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">Ringkasan</h3>
            <div className="bg-white/5 rounded-xl px-5 py-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Subtotal</span>
                <span className="text-white">{formatRupiah(totals.subtotal ?? 0)}</span>
              </div>
              {(totals.discountTotal ?? 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Diskon</span>
                  <span className="text-red-400">-{formatRupiah(totals.discountTotal)}</span>
                </div>
              )}
              {showTax && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Pajak</span>
                  <span className="text-white">{formatRupiah(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black pt-2 border-t border-white/10">
                <span className="text-white">Grand Total</span>
                <span className="text-emerald-400">{formatRupiah(totals.grandTotal ?? 0)}</span>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div>
            <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">Pembayaran</h3>
            <div className="bg-white/5 rounded-xl px-5 py-4 space-y-2">
              {payments.map((p: any, idx: number) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-neutral-400">{getMethodName(p.paymentMethodId)}</span>
                  <span className="text-white">{formatRupiah(p.amount)}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Total Dibayar</span>
                  <span className="text-white font-bold">{formatRupiah(amountPaid)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Kembalian</span>
                  <span className="text-white font-bold">{formatRupiah(change)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 shrink-0">
          {/* Story 2.3 akan menambahkan tombol "Cetak Ulang" di sini */}
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </>
  )
}
```

### Modifikasi `History.tsx`

```typescript
// Tambahkan import
import { TransactionDetailDialog } from '@/components/history/TransactionDetailDialog'

// Tambahkan state di dalam HistoryPage:
const [selectedTransaction, setSelectedTransaction] = useState<LocalTransaction | null>(null)

// Ganti className pada div baris transaksi:
// Sebelum: "... cursor-default"
// Sesudah: "... cursor-pointer"

// Tambahkan onClick pada div baris:
onClick={() => setSelectedTransaction(trx)}

// Tambahkan komponen dialog (di dalam return, setelah div utama atau di luar POSLayout):
<TransactionDetailDialog
  transaction={selectedTransaction}
  paymentMethods={paymentMethods}
  onClose={() => setSelectedTransaction(null)}
/>
```

**PERHATIAN posisi `TransactionDetailDialog`:** Letakkan di DALAM `<POSLayout>` tapi di LUAR div scrollable, atau di akhir `return` setelah `</POSLayout>`. Gunakan `fixed` positioning untuk overlay — tidak akan terpengaruh oleh parent container.

### Kalkulasi Pajak yang Benar

```typescript
// BENAR
const taxAmount = (totals.grandTotal ?? 0) - ((totals.subtotal ?? 0) - (totals.discountTotal ?? 0))
const showTax = taxAmount > 0.001 // threshold untuk floating point

// SALAH — bisa NaN atau Infinity jika payload corrupt
const taxAmount = totals.grandTotal - totals.subtotal + totals.discountTotal
```

### Defensive Coding untuk `payload`

`payload` di `LocalTransaction` adalah `any`. Gunakan optional chaining + nullish coalescing di seluruh dialog:
```typescript
const items = payload.items ?? []
const totals = payload.totals ?? {}
const payments = payload.payments ?? []
const amountPaid = payload.amountPaid ?? 0
const change = payload.change ?? 0
```

Jangan langsung akses `transaction.payload.items.map(...)` tanpa guard — bisa crash jika payload legacy/corrupt.

### Pola Dialog — Custom Implementation (bukan Radix)

Gunakan pola sama seperti `PaymentDialog.tsx` dan `ExpenseDialog.tsx` (custom `fixed` overlay, bukan `@radix-ui/react-dialog`). Alasan: Radix Dialog `DialogContent` memakai `max-w-lg` default yang terlalu sempit untuk tabel item. Dengan custom overlay, lebar dialog lebih mudah dikontrol.

### File yang Harus Dibuat / Dimodifikasi

| File | Status | Keterangan |
|---|---|---|
| `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx` | **BARU** | Dialog detail transaksi |
| `apps/pos-desktop/src/pages/History.tsx` | **MODIFY** | Tambah state + onClick + dialog |

**Jangan modifikasi:**
- `src/services/history-service.ts` — tidak ada query baru yang dibutuhkan
- `src/lib/db.ts` — schema tidak berubah
- `src/App.tsx` — route sudah ada
- `src/store/pos-store.ts` — tidak butuh perubahan

### Learnings dari Story 2.1 & Sebelumnya

- **Pattern service**: tidak ada service tambahan di story ini — data sudah di-load di History.tsx
- **Defensive coding**: `payload: any` → selalu guard dengan `?? []` / `?? 0`
- **Format timestamp**: `new Date(timestamp).toLocaleString('id-ID', ...)` — sudah divalidasi di History.tsx
- **`paymentMethods` lookup**: `paymentMethods.find(m => m.id === id)?.name ?? '—'`
- **Komponen folder**: buat folder `components/history/` baru (belum ada) — kebab-case

### Scope Batasan — Story Ini TIDAK Mencakup

- Tombol "Cetak Ulang" di dalam dialog → Story 2.3 (dialog yang dibuat di sini akan dimodifikasi)
- Filter berdasarkan tanggal → Story 3.2
- Search berdasarkan pelanggan → Story 3.1
- Void dari dialog detail → Story 4.1

## Referensi Konteks Proyek

- `apps/pos-desktop/src/pages/History.tsx` — target modifikasi utama (state + onClick)
- `apps/pos-desktop/src/lib/db.ts` — `LocalTransaction` interface, `payload: any`
- `apps/pos-desktop/src/store/pos-store.ts` — `paymentMethods: any[]`
- `apps/pos-desktop/src/lib/utils.ts` — `formatRupiah(value: number): string`
- `apps/pos-desktop/src/components/pos/PaymentDialog.tsx` — pola custom dialog overlay
- `apps/pos-desktop/src/components/shift/ExpenseDialog.tsx` — pola custom dialog overlay
- `packages/shared/src/types/cart.ts` — `CartItem`, `CartTotals`

## Dev Agent Record

### Agent Model Used
Gemini 2.0 Flash (Antigravity)

### Debug Log References
- Lint errors found initially (no-explicit-any) in the implementation provided by story snippet.
- Fixed lint errors by adding proper types from `@petshop/shared` and `lib/db.ts`.
- Attempted unit tests but `@testing-library/react` is missing in the environment. Relied on linting and static analysis for verification.

### Completion Notes List
- Berhasil membuat komponen `TransactionDetailDialog` dengan styling premium dark.
- Implementasi menggunakan custom modal overlay agar lebar dialog bisa menampung tabel item dengan nyaman (max-w-2xl).
- Kalkulasi pajak dilakukan secara derivatif dari `grandTotal`, `subtotal`, dan `discountTotal`.
- Integrasi ke `HistoryPage` berjalan lancar dengan state management sederhana.
- Semua file yang disentuh bebas dari error linting.

### File List
- `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx` (NEW)
- `apps/pos-desktop/src/pages/History.tsx` (MODIFY)

### Review Findings
_None yet_

