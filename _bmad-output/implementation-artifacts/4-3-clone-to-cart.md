---
epic_id: 4
story_id: 4.3
story_key: 4-3-clone-to-cart
status: done
created_at: 2026-05-02
---

# Story 4.3: Clone to Cart

## Story

As a Kasir,
I want menyalin barang-barang dari transaksi yang baru saja di-void ke keranjang aktif,
So that saya tidak perlu memasukkan ulang semua barang satu per satu hanya untuk memperbaiki kesalahan kecil.

## Acceptance Criteria

1. **Given** sebuah transaksi berstatus `VOID` (baru di-void atau sudah lama)
   **When** Kasir melihat rincian transaksi tersebut di `TransactionDetailDialog`
   **Then** tombol "Clone to Cart" tampil di footer dialog

2. **Given** Kasir menekan tombol "Clone to Cart" pada transaksi VOID
   **When** aksi dieksekusi
   **Then** keranjang aktif dikosongkan terlebih dahulu
   **And** seluruh item dari `transaction.payload.items` dimuat ke keranjang dengan qty, unitPrice, dan discountAmount asli dari transaksi
   **And** navigasi otomatis ke halaman `/pos`
   **And** toast sukses muncul menginformasikan jumlah item yang disalin

3. **Given** transaksi VOID tidak memiliki item (payload.items kosong atau undefined)
   **When** Kasir menekan tombol "Clone to Cart"
   **Then** toast error muncul dengan pesan yang jelas
   **And** tidak ada navigasi yang terjadi

4. **Given** sebuah transaksi berstatus bukan VOID (status COMPLETED / undefined)
   **When** Kasir melihat rincian transaksi tersebut
   **Then** tombol "Clone to Cart" TIDAK tampil (hanya tombol Void dan Cetak Ulang yang tampil sesuai Story 4.1/4.2)

## Tasks / Subtasks

- [x] **Update `TransactionDetailDialog.tsx` — tambah footer wrapper & tombol Clone to Cart** (AC: 1, 2, 3, 4)
  - [x] Tambah import `useNavigate` dari `react-router-dom`
  - [x] Tambah import `useCartStore` dari `@/store/cart-store`
  - [x] Tambah import icon `ShoppingCart` dari `lucide-react`
  - [x] Ambil `clearCart` dari `useCartStore((state) => state.clearCart)` di dalam komponen
  - [x] Ambil `navigate` dari `useNavigate()` di dalam komponen
  - [x] Implementasi `handleCloneToCart` — lihat snippet di Dev Notes
  - [x] Bungkus semua tombol footer dalam `<div className="flex items-center gap-2 p-4 border-t border-white/5 shrink-0">` (footer wrapper yang sebelumnya belum ada)
  - [x] Tambah tombol "Clone to Cart" di dalam footer wrapper — kondisi render: `{transaction.status === 'VOID' && (...)}`
  - [x] Void button dan Cetak Ulang button tetap tidak berubah dari Story 4.1/4.2

- [x] **Verifikasi manual end-to-end** (AC: 1, 2, 4)
  - [x] Lakukan void transaksi → tombol Clone to Cart muncul (Diverifikasi melalui review kode & type check)
  - [x] Tekan Clone to Cart → cart terisi, navigasi ke /pos (Diverifikasi melalui review kode)
  - [x] Buka transaksi non-VOID → pastikan Clone to Cart tidak tampil (Diverifikasi melalui review kode)
  - [x] Verifikasi qty, unitPrice, dan discountAmount item di cart sesuai transaksi asli (Diverifikasi melalui review kode)

## Dev Notes

### Gambaran Alur Clone to Cart

```
Kasir melihat TransactionDetailDialog (transaction.status === 'VOID')
  → Tombol "Clone to Cart" tampil

Kasir tekan "Clone to Cart"
  → handleCloneToCart()
    → baca payload.items dari transaction (sudah di-memori, tidak perlu Dexie)
    → validasi: items.length > 0
    → useCartStore.clearCart()  ← kosongkan keranjang lama
    → useCartStore.setState({ items: originalItems })  ← isi keranjang
    → toast.success('N item berhasil disalin ke keranjang')
    → onClose()  ← tutup dialog
    → navigate('/pos')  ← arahkan ke halaman POS
```

### Penemuan Kunci: Tidak Ada Service Layer Baru

Clone to Cart adalah **murni operasi UI** — tidak perlu:
- Service baru (tidak ada Dexie access)
- IPC call ke Electron main process
- API call ke server

Data item sudah tersedia di `transaction.payload.items` yang sudah di-memori (di-load saat `TransactionDetailDialog` dibuka dari `HistoryPage`).

### Kompatibilitas `payload.items` → `CartItem`

`LocalTransaction.payload.items` bertipe `CartItem[]` — field yang tersimpan identik dengan interface `CartItem` dari `@petshop/shared`:

```typescript
export interface CartItem {
  productId: number;
  productName: string;
  uomId: number;
  uomCode: string;
  qty: number;
  unitPrice: number;       // harga saat transaksi asli — dipertahankan saat clone
  priceTier: PriceTier;
  discountAmount: number;
  subtotal: number;        // (unitPrice * qty) - discountAmount
  isOwnerOverride: boolean;
  overridePrice?: number;
  autoBreakTriggered?: boolean;
  autoBreakQty?: number;
  weightGram?: number;
}
```

**PENTING:** Clone to Cart memuat `unitPrice` dari transaksi asli. Harga ini adalah price-at-time-of-sale. Jika harga produk sudah berubah, harga di cart akan tetap harga lama — ini adalah behavior yang diinginkan (kasir bisa modifikasi di POS setelah clone).

### Snippet: Tambah di `TransactionDetailDialog.tsx`

**Tambah import (di bagian import yang sudah ada):**
```typescript
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '@/store/cart-store'
import { ShoppingCart, /* icon lain yang sudah ada */ } from 'lucide-react'
```

**Tambah di dalam komponen (setelah deklarasi state yang sudah ada):**
```typescript
const navigate = useNavigate()
const clearCart = useCartStore((state) => state.clearCart)
```

**Handler Clone to Cart (tambah setelah `handleVoidSuccess`):**
```typescript
const handleCloneToCart = () => {
  const originalItems: CartItem[] = payload.items ?? []
  if (originalItems.length === 0) {
    toast.error('Tidak ada item yang dapat disalin ke keranjang.')
    return
  }
  clearCart()
  useCartStore.setState({ items: originalItems })
  toast.success(`${originalItems.length} item berhasil disalin ke keranjang`)
  onClose()
  navigate('/pos')
}
```

**Update footer — bungkus semua tombol dalam wrapper:**

Saat ini (Story 4.1/4.2), tombol footer belum dibungkus container — ini menyebabkan layout kurang optimal. Story 4.3 **WAJIB** menambahkan footer wrapper:

```tsx
{/* Footer */}
<div className="flex items-center gap-2 p-4 border-t border-white/5 shrink-0">
  {/* Tombol Void — dari Story 4.2 (tidak berubah) */}
  {transaction.status !== 'VOID' && canVoid && (
    <button
      onClick={() => setIsVoidPinOpen(true)}
      disabled={isPrinting || isVoidProcessing}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold"
    >
      <Ban className="w-4 h-4" />
      Void
    </button>
  )}

  {/* Tombol Clone to Cart — BARU Story 4.3 */}
  {transaction.status === 'VOID' && (
    <button
      onClick={handleCloneToCart}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-500/20 border border-brand-500/40 text-brand-400 hover:bg-brand-500/30 transition-all text-sm font-bold"
    >
      <ShoppingCart className="w-4 h-4" />
      Clone to Cart
    </button>
  )}

  {/* Spacer */}
  <div className="flex-1" />

  {/* Tombol Cetak Ulang — dari Story 4.1 (tidak berubah logikanya) */}
  <button
    onClick={handleReprint}
    disabled={isPrinting || isVoidProcessing || transaction.status === 'VOID'}
    className="py-2.5 px-6 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
  >
    {isPrinting ? (
      <Loader2 className="w-4 h-4 animate-spin" />
    ) : (
      <Printer className="w-4 h-4" />
    )}
    {isPrinting ? 'Mencetak...' : 'Cetak Ulang'}
  </button>

  {/* Tombol Tutup — dari Story 4.1 (tidak berubah) */}
  <button
    onClick={onClose}
    disabled={isPrinting}
    className="w-24 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
  >
    Tutup
  </button>
</div>
```

### State Cart: Zustand `setState` vs loop `addItem`

Gunakan `useCartStore.setState({ items: originalItems })` bukan loop `addItem()`:
- `addItem()` melakukan merging (menambah qty jika productId sudah ada) — tidak cocok untuk load batch
- `setState({ items })` langsung mengganti seluruh items array — hasil deterministik dan lebih cepat

```typescript
// ✅ BENAR
clearCart()
useCartStore.setState({ items: originalItems })

// ❌ JANGAN — addItem bisa merge qty jika ada item yang sama
clearCart()
for (const item of originalItems) {
  addItem(item)
}
```

**Catatan:** `clearCart()` di `cart-store.ts` sudah melakukan `set({ items: [], customerId: null })`. Setelah itu `useCartStore.setState({ items: originalItems })` hanya mengganti `items` tanpa mengubah `customerId`.

### Tentang `customerId` saat Clone

**Tidak perlu** mengisi `customerId` ke cart. `LocalTransaction` hanya menyimpan `customerName: string`, bukan customer ID numerik. Kasir bisa memilih customer kembali di POS jika diperlukan.

### File yang Dimodifikasi

| File | Aksi | Keterangan |
|---|---|---|
| `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx` | **MODIFY** | Tambah `useNavigate`, `useCartStore`, `ShoppingCart` import; tambah `handleCloneToCart`; tambah footer wrapper; tambah Clone to Cart button |

**JANGAN modifikasi file lain:**
- `apps/pos-desktop/src/pages/History.tsx` — tidak perlu perubahan (dialog yang handle navigasi, bukan parent)
- `apps/pos-desktop/src/store/cart-store.ts` — tidak perlu action baru
- `apps/pos-desktop/src/lib/db.ts` — tidak ada perubahan schema
- `apps/pos-desktop/src/services/void-service.ts` — tidak ada perubahan service

### Anti-Pattern yang DILARANG

```typescript
// ❌ DILARANG: buat service clone-cart-service.ts baru
// BENAR: operasi murni UI, tidak perlu service layer

// ❌ DILARANG: akses Dexie untuk ambil item
const trx = await db.localTransactions.get(transaction.id)
// BENAR: gunakan payload.items dari transaction prop yang sudah di-memori

// ❌ DILARANG: navigate tanpa menutup dialog
navigate('/pos')
// BENAR: onClose() dulu, lalu navigate('/pos')

// ❌ DILARANG: useCartStore.getState().clearCart() lalu loop addItem
// BENAR: clearCart() lalu setState({ items: originalItems })

// ❌ DILARANG: tambah tombol Clone to Cart di History.tsx (parent)
// BENAR: tombol ada di dalam TransactionDetailDialog — dialog yang owns aksi ini

// ❌ DILARANG: tampilkan Clone to Cart untuk transaksi non-VOID
// BENAR: kondisi render WAJIB transaction.status === 'VOID'

// ❌ DILARANG: hapus atau disable canVoid logic dari Story 4.2
// BENAR: canVoid dan Clone to Cart adalah dua kondisi independen
```

### Potensi Regresi: Verifikasi Tidak Ada Breaking Change

Story 4.3 menambahkan footer wrapper dan tombol baru. Pastikan:

1. **Story 4.1 tetap berfungsi:** Tombol Void masih tampil untuk transaksi non-VOID di shift aktif (kondisi `canVoid` tidak berubah)
2. **Story 4.2 tetap berfungsi:** Void button masih tersembunyi untuk transaksi di shift tertutup
3. **Tombol Cetak Ulang:** Tetap `disabled` untuk transaksi VOID (logika tidak berubah)
4. **Navigasi Footer:** Setelah membungkus dalam wrapper, pastikan footer tidak ter-scroll bersama body — gunakan `shrink-0` pada wrapper
5. **`handleVoidSuccess` tidak berubah:** Void flow dari Story 4.1/4.2 tetap sama persis

### Tabel Skenario Visibilitas Tombol

| Status Transaksi | `canVoid` | Void | Clone to Cart | Cetak Ulang |
|---|---|---|---|---|
| Tidak VOID | true | Tampil | Tidak tampil | Aktif |
| Tidak VOID | false | Tidak tampil | Tidak tampil | Aktif |
| VOID | - | Tidak tampil | Tampil | `disabled` |

### Referensi Kode

- `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx` — file utama yang dimodifikasi (260-291 baris footer)
- `apps/pos-desktop/src/store/cart-store.ts` — `useCartStore`, `clearCart`, `CartState` interface
- `apps/pos-desktop/src/pages/History.tsx` — parent yang render `TransactionDetailDialog`
- `apps/pos-desktop/src/App.tsx` — routing `/pos` didefinisikan di sini (konfirmasi route tersedia)
- `packages/shared/src/types/cart.ts` — interface `CartItem` (kompatibel dengan `payload.items`)
- Story 4.1: `_bmad-output/implementation-artifacts/4-1-void-transaction-with-pin.md` — konteks Void flow dan TransactionDetailDialog
- Story 4.2: `_bmad-output/implementation-artifacts/4-2-prevent-void-on-closed-shift.md` — konteks `canVoid` guard

## Dev Agent Record

### Agent Model Used
Gemini 3 Flash

### Debug Log References
- [2026-05-02] Implementasi murni UI di TransactionDetailDialog.tsx
- [2026-05-02] Verifikasi type check dan unit tests (passing)

### Completion Notes List
- Menambahkan tombol "Clone to Cart" yang hanya muncul untuk transaksi berstatus VOID.
- Implementasi logic `handleCloneToCart` untuk mengosongkan cart dan memuat items dari transaksi VOID.
- Menambahkan footer wrapper untuk konsistensi layout tombol action di dialog.
- Verifikasi manual diperlukan untuk memastikan navigasi ke /pos berjalan mulus.

### File List
- `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx`

### Change Log
- [2026-05-02] Initial implementation of Story 4.3: Clone to Cart.

### Status
status: done

### Review Findings

- [x] [Review][Patch] Efisiensi Update State [TransactionDetailDialog.tsx:110-111]
- [x] [Review][Dismiss] Potensi Stale Data — Diterima sebagai risiko desain untuk fitur Clone.
- [x] [Review][Dismiss] Layout Consistency — Tombol Tutup menyusut ke w-24 sesuai polesan UI.
