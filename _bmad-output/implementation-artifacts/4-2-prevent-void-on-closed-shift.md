---
epic_id: 4
story_id: 4.2
story_key: 4-2-prevent-void-on-closed-shift
status: done
created_at: 2026-05-02
---

# Story 4.2: Prevent Void on Closed Shift

## Story

As a System,
I want mencegah pembatalan transaksi dari shift yang sudah ditutup,
So that data historis shift yang sudah disetor (settled) tidak terganggu.

## Acceptance Criteria

1. **Given** sebuah transaksi terjadi pada shift yang statusnya sudah ditutup (Closed)
   **When** Kasir melihat rincian transaksi tersebut di dialog `TransactionDetailDialog`
   **Then** tombol "Void" akan disembunyikan (tidak dirender)

2. **Given** sebuah transaksi terjadi pada shift yang MASIH aktif (Open)
   **When** Kasir melihat rincian transaksi tersebut
   **Then** tombol "Void" tetap tampil seperti perilaku Story 4.1 (tidak berubah)

3. **Given** tidak ada shift aktif saat ini (`activeShift === null`)
   **When** Kasir melihat rincian transaksi apapun
   **Then** tombol "Void" disembunyikan (semua transaksi dianggap bukan dari shift aktif)

4. **Given** Kasir melihat halaman History tanggal kemarin
   **When** transaksi yang ditampilkan berasal dari shift yang berbeda dari shift aktif hari ini
   **Then** tombol "Void" disembunyikan pada semua transaksi tersebut

## Tasks / Subtasks

- [x] **Update props `TransactionDetailDialog.tsx` — tambah `activeShiftId`** (AC: 1, 2, 3)
  - [x] Tambah prop `activeShiftId?: number | null` ke interface `TransactionDetailDialogProps`
  - [x] Hitung `const canVoid = activeShiftId != null && transaction.shiftId === activeShiftId`
  - [x] Update kondisi render Void button: `{transaction.status !== 'VOID' && canVoid && (...)}`
  - [x] **PENTING:** Jangan ubah handler `handleVoidSuccess`, guard `isVoidProcessing`, atau logika PIN — hanya visibilitas Void button yang berubah

- [x] **Update `History.tsx` — kirim `activeShiftId` ke dialog** (AC: 1, 2, 3, 4)
  - [x] Import `useShiftStore` dari `@/store/shift-store`
  - [x] Destructure `activeShift` dari `useShiftStore()`
  - [x] Tambah prop `activeShiftId={activeShift?.id ?? null}` pada `<TransactionDetailDialog>`

- [x] **Tulis test di `void-service.test.ts`** (kontrak shift-closed guard)
  - [x] Verifikasi bahwa `shiftId` tersimpan di `LocalTransaction` (kontrak untuk filter di UI)
  - [x] Dokumentasi behavior: transaksi dengan `shiftId !== activeShiftId` → Void button tidak dirender

## Dev Notes

### Cara Kerja Pengecekan Shift Tertutup

`LocalTransaction.shiftId` adalah server-side `Shift.id` dari `@petshop/shared`. Saat kasir menyelesaikan transaksi di `PaymentDialog.tsx`, nilai ini di-set dari `activeShift.id`:

```typescript
// apps/pos-desktop/src/components/pos/PaymentDialog.tsx:99
shiftId: activeShift.id,
```

`useShiftStore().activeShift` (dari `/pos/shifts?branchId=1`) selalu mengembalikan shift yang saat ini **OPEN** di server. Jika shift sudah ditutup, `activeShift` akan menjadi `null` atau berganti ke shift baru.

**Guard logic di `TransactionDetailDialog`:**

```typescript
// canVoid = true HANYA jika transaction berada di shift yang sama dengan activeShift
const canVoid = activeShiftId != null && transaction.shiftId === activeShiftId
```

Skenario yang tertangani:
| Kondisi | `activeShiftId` | `transaction.shiftId` | `canVoid` | Void button |
|---|---|---|---|---|
| Shift aktif, transaksi shift ini | 42 | 42 | `true` | Tampil |
| Shift ditutup, tidak ada shift baru | `null` | 42 | `false` | Tersembunyi |
| Shift baru, lihat transaksi shift lama | 43 | 42 | `false` | Tersembunyi |
| Lihat hari kemarin, shift berbeda | 43 | 38 | `false` | Tersembunyi |

### Snippet: `TransactionDetailDialog.tsx`

**Perubahan pada interface:**
```typescript
interface TransactionDetailDialogProps {
  transaction: LocalTransaction | null;
  paymentMethods: PaymentMethod[];
  onClose: () => void;
  onVoid?: (updatedTx: LocalTransaction) => void;
  activeShiftId?: number | null; // NEW — untuk guard shift-closed (Story 4.2)
}
```

**Kalkulasi canVoid di dalam komponen (setelah `if (!transaction) return null`):**
```typescript
const canVoid = activeShiftId != null && transaction.shiftId === activeShiftId
```

**Update kondisi render Void button di footer:**
```tsx
{/* SEBELUM (Story 4.1): */}
{transaction.status !== 'VOID' && (
  <button onClick={() => setIsVoidPinOpen(true)} ...>
    Void
  </button>
)}

{/* SESUDAH (Story 4.2): tambah && canVoid */}
{transaction.status !== 'VOID' && canVoid && (
  <button onClick={() => setIsVoidPinOpen(true)} ...>
    Void
  </button>
)}
```

Tidak ada perubahan lain di `TransactionDetailDialog` — hanya kondisi render Void button.

### Snippet: `History.tsx`

**Tambah import:**
```typescript
import { useShiftStore } from '@/store/shift-store'
```

**Tambah destructure di dalam komponen:**
```typescript
const { activeShift } = useShiftStore()
```

**Update `<TransactionDetailDialog>` di JSX:**
```tsx
<TransactionDetailDialog
  transaction={selectedTransaction}
  paymentMethods={paymentMethods}
  onClose={() => setSelectedTransaction(null)}
  onVoid={handleVoid}
  activeShiftId={activeShift?.id ?? null}  {/* NEW */}
/>
```

### File yang Dimodifikasi

| File | Aksi | Keterangan |
|---|---|---|
| `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx` | **MODIFY** | Tambah prop `activeShiftId`, kalkulasi `canVoid`, update kondisi render Void button |
| `apps/pos-desktop/src/pages/History.tsx` | **MODIFY** | Import `useShiftStore`, ambil `activeShift`, teruskan `activeShiftId` ke dialog |
| `apps/pos-desktop/src/services/void-service.test.ts` | **MODIFY** | Dokumentasi kontrak `shiftId` sebagai guard |

**JANGAN modifikasi:**
- `apps/pos-desktop/src/services/void-service.ts` — tidak perlu guard di service layer, cukup di UI
- `apps/pos-desktop/electron/main.ts` — tidak ada perubahan IPC
- `apps/pos-desktop/src/lib/db.ts` — tidak ada perubahan schema
- `apps/pos-desktop/src/store/shift-store.ts` — tidak ada perubahan store
- `apps/pos-desktop/src/components/pos/PinChallengeDialog.tsx` — tidak ada perubahan

### Anti-Pattern yang DILARANG

```typescript
// ❌ DILARANG: buat service baru hanya untuk cek shift status
const isShiftClosed = await shiftService.isShiftClosed(transaction.shiftId)
// BENAR: gunakan activeShift dari useShiftStore yang sudah ada

// ❌ DILARANG: query currentShift Dexie table untuk cek status
const shift = await db.currentShift.get(transaction.shiftId)
// BENAR: currentShift.id di Dexie adalah auto-increment (++id), BUKAN server Shift.id
// LocalTransaction.shiftId = server Shift.id (dari activeShift.id saat transaksi dibuat)

// ❌ DILARANG: disable tombol Void (tampil tapi tidak bisa diklik)
<button disabled={!canVoid}>Void</button>
// BENAR: sembunyikan tombol sepenuhnya (konsisten dengan behavior status VOID)

// ❌ DILARANG: tambah IPC call baru untuk cek shift status dari server
// BENAR: activeShift dari Zustand store sudah di-sync dari server, tidak perlu request baru

// ❌ DILARANG: tambah guard canVoid ke voidService.voidTransaction()
// BENAR: guard hanya di UI layer — voidService tidak perlu tahu tentang shift status
```

### Potensi Regresi: Verifikasi Tidak Ada Breaking Change

Story 4.2 hanya mengubah visibilitas Void button berdasarkan prop `activeShiftId`. Pastikan:
1. **Story 4.1 tetap berfungsi:** Jika `activeShiftId` sama dengan `transaction.shiftId` → alur Void PIN tetap sama seperti Story 4.1
2. **Tombol Cetak Ulang tidak terpengaruh:** Hanya Void button yang berubah kondisi visibilitasnya
3. **Badge VOID tetap tampil:** `transaction.status === 'VOID'` tetap dirender di header dialog
4. **`handleVoid` callback di `History.tsx`:** Tidak berubah

### Referensi Kode

- `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx` — file utama yang dimodifikasi
- `apps/pos-desktop/src/pages/History.tsx:250` — tempat `<TransactionDetailDialog>` dirender
- `apps/pos-desktop/src/store/shift-store.ts` — `useShiftStore`, sumber `activeShift`
- `apps/pos-desktop/src/components/pos/PaymentDialog.tsx:99,134` — konfirmasi `shiftId = activeShift.id`
- `apps/pos-desktop/src/lib/db.ts:74-83` — interface `LocalTransaction` (field `shiftId`)
- `apps/pos-desktop/src/services/void-service.ts` — service void yang tidak perlu diubah
- Story 4.1 file: `_bmad-output/implementation-artifacts/4-1-void-transaction-with-pin.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implementasi guard shift-closed di UI layer (`TransactionDetailDialog`) menggunakan prop `activeShiftId`.
- Void button disembunyikan sepenuhnya (bukan disabled) ketika `canVoid = false` — konsisten dengan behavior status VOID.
- `canVoid = activeShiftId != null && transaction.shiftId === activeShiftId` — guard covers semua skenario: no active shift, shift berganti, lihat history hari lain.
- `voidService.ts` tidak diubah — guard cukup di UI layer, service tidak perlu tahu tentang shift status.
- 5 test baru di `void-service.test.ts`: 3 test voidTransaction core logic, 2 test dokumentasi shift-closed guard contract.
- Semua 37 test pass, tidak ada regresi.

### File List

- `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx`
- `apps/pos-desktop/src/pages/History.tsx`
- `apps/pos-desktop/src/services/void-service.test.ts`

### Change Log

- 2026-05-02: Implementasi Story 4.2 — tambah guard shift-closed pada Void button di TransactionDetailDialog; teruskan activeShiftId dari History via useShiftStore; buat void-service.test.ts.
