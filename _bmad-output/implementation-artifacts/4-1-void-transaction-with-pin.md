---
epic_id: 4
story_id: 4.1
story_key: 4-1-void-transaction-with-pin
status: done
created_at: 2026-05-02
---

# Story 4.1: Void Transaction with PIN

## Story

As a Kasir,
I want membatalkan (Void) transaksi yang salah jika saya mendapatkan PIN Otorisasi dari Owner,
So that saya dapat mengoreksi kesalahan input tanpa merusak catatan finansial permanen.

## Acceptance Criteria

1. **Given** Kasir sedang melihat rincian transaksi di halaman History  
   **When** mereka menekan tombol "Void"  
   **Then** muncul modal `PinChallengeDialog` yang meminta PIN Otorisasi Owner

2. **Given** PIN dimasukkan dengan benar  
   **When** form dikirim  
   **Then** status transaksi berubah menjadi `'VOID'` di IndexedDB (record tidak dihapus)  
   **And** sebuah `pendingOperation` bertipe `'VOID_TRANSACTION'` ditambahkan ke antrian sync

3. **Given** transaksi berhasil di-void  
   **When** dialog detail transaksi masih terbuka  
   **Then** badge "VOID" merah muncul di header dialog  
   **And** tombol "Void" dihilangkan  
   **And** tombol "Cetak Ulang" dinonaktifkan

4. **Given** transaksi sudah berstatus `VOID`  
   **When** Kasir membuka kembali transaksi tersebut dari daftar History  
   **Then** baris di daftar History menampilkan badge "VOID" berwarna merah  
   **And** tombol "Void" tidak tersedia di dialog detail

5. **Given** PIN yang dimasukkan salah  
   **When** form dikirim  
   **Then** pesan error "PIN tidak valid. Pastikan PIN Owner yang dimasukkan benar." muncul di bawah input  
   **And** status transaksi tidak berubah

6. **Given** Owner PIN belum dikonfigurasi di perangkat  
   **When** PIN apapun dimasukkan dan form dikirim  
   **Then** muncul pesan error "PIN Owner belum dikonfigurasi. Hubungi Administrator."  
   **And** tombol Void tetap aktif agar kasir bisa coba lagi

## Tasks / Subtasks

- [x] **Install `bcryptjs` dependency** (Prasyarat: PIN Validation)
  - [x] Jalankan: `pnpm --filter petshop-pos add bcryptjs`
  - [x] Jalankan: `pnpm --filter petshop-pos add -D @types/bcryptjs`
  - [x] Verifikasi entry muncul di `apps/pos-desktop/package.json`

- [x] **Tambah `pin:validate` & `pin:set-hash` IPC handlers di `main.ts`** (AC: 2, 5, 6)
  - [x] Di bagian atas `main.ts`, tambah import: `import bcrypt from 'bcryptjs'`
  - [x] Tambah handler `ipcMain.handle('pin:validate', ...)` — lihat snippet di Dev Notes
  - [x] Tambah helper handler `ipcMain.handle('pin:set-hash', ...)` untuk setup PIN — lihat snippet di Dev Notes
  - [x] Pastikan tidak ada konflik dengan handler `secure-storage:*` yang ada

- [x] **Update `LocalTransaction` interface & Dexie schema v2 di `db.ts`** (AC: 2, 4)
  - [x] Tambah field `status?: 'COMPLETED' | 'VOID'` pada interface `LocalTransaction`
  - [x] Tambah `'VOID_TRANSACTION'` pada union type field `type` di interface `PendingOperation`
  - [x] Tambah `db.version(2).stores(...)` dengan penambahan index `status` di `localTransactions` — lihat snippet di Dev Notes
  - [x] Pastikan `db.version(1).stores(...)` tetap ada (diperlukan untuk migration)
  - [x] `undefined` status diinterpretasi sebagai `'COMPLETED'` (backward compatible)

- [x] **Buat `void-service.ts` di `apps/pos-desktop/src/services/`** (AC: 2)
  - [x] Buat file baru: `apps/pos-desktop/src/services/void-service.ts`
  - [x] Implementasi `voidTransaction(transactionId: number): Promise<void>` — lihat snippet di Dev Notes
  - [x] Guard: lempar error jika transaksi tidak ditemukan atau sudah `VOID`
  - [x] Update `status` ke `'VOID'` via `db.localTransactions.update(id, { status: 'VOID' })`
  - [x] Tambah `pendingOperation` bertipe `'VOID_TRANSACTION'` dengan UUID id
  - [x] Semua operasi Dexie harus dibungkus `db.transaction('rw', ...)` agar atomik

- [x] **Upgrade `PinChallengeDialog.tsx` — ganti dummy PIN dengan validasi IPC** (AC: 1, 5, 6)
  - [x] Tambah state `isValidating: boolean` (untuk loading state saat IPC berjalan)
  - [x] Ganti `handleSubmit` synchronous menjadi `async` with IPC call — lihat snippet di Dev Notes
  - [x] Tambah loading indicator pada tombol Verifikasi saat `isValidating === true`
  - [x] Tambah `disabled={isValidating}` pada semua interactive elements saat validasi berlangsung
  - [x] Pesan error PIN tidak valid vs PIN belum dikonfigurasi berbeda (lihat Dev Notes)
  - [x] **PENTING:** Perubahan ini juga berlaku untuk POS.tsx (price override) — tidak ada regresi

- [x] **Update `TransactionDetailDialog.tsx` — tambah Void button & VOID badge** (AC: 1, 2, 3, 4)
  - [x] Tambah prop `onVoid: (updatedTx: LocalTransaction) => void` ke interface props
  - [x] Tambah state lokal `isVoidDialogOpen: boolean`
  - [x] Tambah state lokal `isVoidProcessing: boolean`
  - [x] Tambah tombol "Void" di footer dialog — lihat snippet di Dev Notes
  - [x] Tombol Void hanya tampil jika `transaction.status !== 'VOID'`
  - [x] Tambah `PinChallengeDialog` inline di dalam `TransactionDetailDialog`
  - [x] Saat PIN sukses: panggil `voidService.voidTransaction(transaction.id)`, lalu panggil `onVoid` callback
  - [x] Tambah badge "VOID" berwarna merah di header dialog jika `transaction.status === 'VOID'`
  - [x] Nonaktifkan tombol "Cetak Ulang" jika `transaction.status === 'VOID'`
  - [x] Gunakan `try/catch` dan tampilkan `toast.error` jika void gagal

- [x] **Update `History.tsx` — tampilkan badge VOID di daftar transaksi** (AC: 4)
  - [x] Tambah callback `onVoid` pada `TransactionDetailDialog` yang memperbarui `transactions` state secara optimistik
  - [x] Di baris transaksi di list, tambah badge "VOID" berwarna merah jika `trx.status === 'VOID'`
  - [x] VOID transactions tetap terlihat di list (tidak disembunyikan)
  - [x] Lihat snippet di Dev Notes

- [x] **Tulis test minimal di `history-service.test.ts`** (kontrak void)
  - [x] Verifikasi bahwa `localTransactions` dapat menyimpan dan mengambil field `status`
  - [x] Dokumentasi bahwa `undefined` status = `'COMPLETED'` (backward compat)

## Dev Notes

### Gambaran Alur Void

```
Kasir klik "Void" di TransactionDetailDialog
  → setIsVoidDialogOpen(true)
  → PinChallengeDialog terbuka

Kasir masuk PIN → handleSubmit
  → window.ipcRenderer.invoke('pin:validate', pin)
  → main.ts: bcrypt.compare(pin, storedHash)
  → return true/false

Jika true (onSuccess callback):
  → voidService.voidTransaction(transaction.id)
    → db.transaction('rw', ...):
      → db.localTransactions.update(id, { status: 'VOID' })
      → db.pendingOperations.add({ type: 'VOID_TRANSACTION', ... })
  → onVoid(updatedTx) dipanggil → History.tsx update transactions state
  → toast.success('Transaksi berhasil dibatalkan')
  → setIsVoidDialogOpen(false)
  → UI: badge VOID muncul, tombol Void hilang
```

### Penemuan Kunci: `PinChallengeDialog` Sudah Ada

`apps/pos-desktop/src/components/pos/PinChallengeDialog.tsx` sudah diimplementasi dan dipakai di `POS.tsx` (untuk price override Owner). Saat ini menggunakan PIN hardcoded `'123456'` sebagai placeholder.

**Story 4.1 WAJIB mengupgrade dialog ini ke validasi IPC nyata** (NFR-S2). Perubahan ini berlaku untuk SEMUA penggunaan `PinChallengeDialog` (price override + void) — tidak perlu buat dialog terpisah.

**Komponen ini di-import dan dirender langsung di `TransactionDetailDialog`**, bukan melalui global store seperti di `POS.tsx`. Cukup gunakan state lokal `isVoidDialogOpen`.

### 1. Install bcryptjs

```bash
pnpm --filter petshop-pos add bcryptjs
pnpm --filter petshop-pos add -D @types/bcryptjs
```

bcryptjs dipilih (bukan argon2) karena:
- Pure JavaScript — tidak memerlukan native compilation
- Tidak ada masalah Electron rebuild di Windows
- Kompatibel dengan arsitektur Electron main process (ADR-004)

### 2. Snippet: IPC Handlers di `main.ts`

Tambahkan setelah block `ipcMain.handle('secure-storage:remove', ...)`:

```typescript
import bcrypt from 'bcryptjs'

// Validasi PIN Owner (ADR-004)
ipcMain.handle('pin:validate', async (_, pin: string) => {
  if (!pin || typeof pin !== 'string') return false
  if (!safeStorage.isEncryptionAvailable()) return false
  const config = getSecureConfig()
  const encrypted = config['owner-pin-hash']
  if (!encrypted) return null // null = PIN belum dikonfigurasi (berbeda dari false = PIN salah)
  try {
    const storedHash = safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    return await bcrypt.compare(pin, storedHash)
  } catch {
    return false
  }
})

// Setup PIN Owner — dipanggil saat bootstrap atau oleh Administrator
ipcMain.handle('pin:set-hash', async (_, plainPin: string) => {
  if (!safeStorage.isEncryptionAvailable()) return false
  try {
    const hash = await bcrypt.hash(plainPin, 12)
    const encrypted = safeStorage.encryptString(hash).toString('base64')
    const config = getSecureConfig()
    config['owner-pin-hash'] = encrypted
    saveSecureConfig(config)
    return true
  } catch {
    return false
  }
})
```

**Catatan penting:** `pin:validate` mengembalikan `null` jika PIN belum dikonfigurasi, `true` jika valid, `false` jika tidak valid. Renderer harus membedakan `null` vs `false` untuk pesan error yang berbeda.

### 3. Snippet: Update `LocalTransaction` & `PendingOperation` di `db.ts`

```typescript
// Update interface LocalTransaction
export interface LocalTransaction {
  id: number;
  shiftId: number;
  trxNumber: string;
  createdAt: number;
  customerName: string;
  totalAmount: string; // big.js string
  payload: any;
  status?: 'COMPLETED' | 'VOID'; // NEW — undefined = COMPLETED (backward compat)
}

// Update interface PendingOperation
export interface PendingOperation {
  id: string;
  type: "TRANSACTION" | "EXPENSE" | "SHIFT_CLOSE" | "VOID_TRANSACTION"; // tambah VOID_TRANSACTION
  payload: any;
  createdAt: number;
  retryCount: number;
  lastError?: string;
}
```

**Dexie Schema Migration — Tambahkan di `getDb()` SEBELUM `db.open()`:**

```typescript
// Versi 1 — tetap ada (diperlukan untuk migration path)
db.version(1).stores({
  products: "++id, sku, name, branchId, categoryId",
  categories: "++id, name",
  productUoms: "++id, productId",
  productPrices: "++id, productId, priceCategoryId, [productId+uomId+tierType]",
  customers: "++id, phone, name",
  paymentMethods: "++id",
  taxSettings: "++id",
  currentShift: "++id",
  pendingOperations: "++id, type, createdAt",
  localTransactions: "++id, shiftId, createdAt, customerName",
});

// Versi 2 — tambah index status di localTransactions (Post-MVP void support)
db.version(2).stores({
  localTransactions: "++id, shiftId, createdAt, customerName, status",
  // Tabel lain tidak berubah — tidak perlu didefinisikan ulang
});
```

### 4. Snippet: `void-service.ts` (file baru)

```typescript
// apps/pos-desktop/src/services/void-service.ts
import { getDb } from '@/lib/db'
import type { LocalTransaction } from '@/lib/db'

export const voidService = {
  async voidTransaction(transactionId: number): Promise<LocalTransaction> {
    const db = await getDb()

    return await db.transaction('rw', [db.localTransactions, db.pendingOperations], async () => {
      const trx = await db.localTransactions.get(transactionId)
      if (!trx) throw new Error('Transaksi tidak ditemukan.')
      if (trx.status === 'VOID') throw new Error('Transaksi sudah dibatalkan.')

      await db.localTransactions.update(transactionId, { status: 'VOID' })

      await db.pendingOperations.add({
        id: crypto.randomUUID(),
        type: 'VOID_TRANSACTION',
        payload: {
          transactionId,
          trxNumber: trx.trxNumber,
          voidedAt: Date.now(),
        },
        createdAt: Date.now(),
        retryCount: 0,
      })

      return { ...trx, status: 'VOID' as const }
    })
  },
}
```

### 5. Snippet: Upgrade `PinChallengeDialog.tsx`

Ganti fungsi `handleSubmit` (sinkronus) dengan versi async berikut:

```typescript
import React, { useState } from 'react';
import { X, Lock, Loader2 } from 'lucide-react';

// ... interface sama ...

export const PinChallengeDialog: React.FC<PinChallengeDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4 || isValidating) return;
    setIsValidating(true);
    setError('');
    try {
      const result = await window.ipcRenderer.invoke('pin:validate', pin);
      if (result === null) {
        // null = PIN belum dikonfigurasi di safeStorage
        setError('PIN Owner belum dikonfigurasi. Hubungi Administrator.');
      } else if (result === true) {
        onSuccess();
        setPin('');
        setError('');
      } else {
        setError('PIN tidak valid. Pastikan PIN Owner yang dimasukkan benar.');
      }
    } catch {
      setError('Gagal memvalidasi PIN. Coba lagi.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0d0d0d] border border-white/5 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#111]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-brand-400" />
            Otorisasi Owner
          </h2>
          <button
            onClick={onClose}
            disabled={isValidating}
            className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <p className="text-sm text-neutral-400 text-center">Masukkan 6-digit PIN Owner untuk melanjutkan tindakan ini.</p>

          <div>
            <input
              type="password"
              maxLength={6}
              value={pin}
              onChange={(e) => { setPin(e.target.value); setError(''); }}
              disabled={isValidating}
              className="w-full bg-[#161616] border border-white/5 rounded-2xl py-4 text-center text-3xl tracking-[1em] font-black text-white focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all font-mono disabled:opacity-50"
              autoFocus
            />
            {error && <p className="text-red-500 text-xs text-center mt-2 font-bold">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={pin.length < 4 || isValidating}
            className="w-full bg-brand-500 hover:bg-brand-400 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-950 font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            {isValidating ? <><Loader2 className="w-4 h-4 animate-spin" /> Memverifikasi...</> : 'Verifikasi'}
          </button>
        </form>
      </div>
    </div>
  );
};
```

### 6. Snippet: Update `TransactionDetailDialog.tsx`

**Tambah import & props:**
```typescript
import { PinChallengeDialog } from '@/components/pos/PinChallengeDialog'
import { voidService } from '@/services/void-service'
import { Ban } from 'lucide-react' // icon void

interface TransactionDetailDialogProps {
  transaction: LocalTransaction | null
  paymentMethods: PaymentMethod[]
  onClose: () => void
  onVoid?: (updatedTx: LocalTransaction) => void // NEW
}
```

**Tambah state lokal di dalam komponen:**
```typescript
const [isVoidPinOpen, setIsVoidPinOpen] = useState(false)
const [isVoidProcessing, setIsVoidProcessing] = useState(false)
```

**Handler void:**
```typescript
const handleVoidSuccess = async () => {
  setIsVoidPinOpen(false)
  setIsVoidProcessing(true)
  try {
    const updated = await voidService.voidTransaction(transaction!.id)
    toast.success('Transaksi berhasil dibatalkan')
    onVoid?.(updated)
  } catch (err) {
    toast.error('Gagal membatalkan transaksi: ' + (err as Error).message)
  } finally {
    setIsVoidProcessing(false)
  }
}
```

**VOID badge di header dialog** (tambahkan setelah trxNumber):
```tsx
{transaction.status === 'VOID' && (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-black uppercase tracking-wide">
    <Ban className="w-3 h-3" />
    VOID
  </span>
)}
```

**Tombol Void di footer** (sebelum tombol Cetak Ulang):
```tsx
{transaction.status !== 'VOID' && (
  <button
    onClick={() => setIsVoidPinOpen(true)}
    disabled={isPrinting || isVoidProcessing}
    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold"
  >
    <Ban className="w-4 h-4" />
    Void
  </button>
)}
```

**Nonaktifkan tombol Cetak Ulang jika VOID:**
```tsx
// Tambahkan `|| transaction.status === 'VOID'` pada kondisi disabled tombol reprint
disabled={isPrinting || isVoidProcessing || transaction.status === 'VOID'}
```

**Render PinChallengeDialog di akhir komponen** (sebelum closing `</>`):
```tsx
<PinChallengeDialog
  isOpen={isVoidPinOpen}
  onClose={() => setIsVoidPinOpen(false)}
  onSuccess={handleVoidSuccess}
/>
```

### 7. Snippet: Update `History.tsx` — badge VOID di list & callback onVoid

**Callback onVoid untuk update state:**
```typescript
const handleVoid = (updatedTx: LocalTransaction) => {
  setTransactions((prev) =>
    prev.map((trx) => (trx.id === updatedTx.id ? updatedTx : trx))
  )
  setSelectedTransaction(updatedTx) // refresh tampilan dialog jika masih terbuka
}
```

**Badge VOID di baris transaksi** (tambahkan di kolom nomor struk atau setelah total):
```tsx
{filteredTransactions.map((trx) => (
  <div
    key={trx.id}
    className={`grid grid-cols-5 gap-4 px-4 py-4 rounded-xl border transition-colors cursor-pointer
      ${trx.status === 'VOID'
        ? 'bg-red-500/5 border-red-500/15 hover:bg-red-500/10 opacity-70'
        : 'bg-white/5 border-white/5 hover:bg-white/10'
      }`}
    onClick={() => setSelectedTransaction(trx)}
  >
    <span className="text-sm font-mono text-neutral-300">{formatTime(trx.createdAt)}</span>
    <span className="text-sm font-bold text-white truncate flex items-center gap-1.5">
      {trx.trxNumber}
      {trx.status === 'VOID' && (
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-400 uppercase tracking-wide leading-none shrink-0">
          VOID
        </span>
      )}
    </span>
    {/* ... kolom lainnya sama ... */}
  </div>
))}
```

**Update prop di TransactionDetailDialog:**
```tsx
<TransactionDetailDialog
  transaction={selectedTransaction}
  paymentMethods={paymentMethods}
  onClose={() => setSelectedTransaction(null)}
  onVoid={handleVoid}
/>
```

### Catatan PIN Setup untuk Development & Testing

PIN Owner disimpan sebagai bcrypt hash terenkripsi di safeStorage (`owner-pin-hash`). Untuk menyetel PIN saat development/testing:

```typescript
// Dari DevTools atau Electron renderer console:
await window.ipcRenderer.invoke('pin:set-hash', '123456')
// → returns true jika berhasil

// Untuk verifikasi:
await window.ipcRenderer.invoke('pin:validate', '123456')
// → returns true
```

Untuk produksi: PIN Owner di-set saat proses onboarding perangkat melalui `pin:set-hash` yang dipanggil bootstrap service ketika menerima `ownerPinPlain` dari server. Update bootstrap service ini **DITARGETKAN di Sprint berikutnya** — **BUKAN bagian dari Story 4.1**.

### Stock Restoration via Server Sync

Architecture tidak menyimpan stock quantity di Dexie (hanya di server). `VOID_TRANSACTION` pendingOperation yang ditambahkan ke antrian akan diproses saat sync ke server — server yang mengembalikan stok secara server-side. Tidak ada perubahan `products` table lokal yang diperlukan.

### File yang Dimodifikasi

| File | Aksi | Keterangan |
|---|---|---|
| `apps/pos-desktop/package.json` | **MODIFY** | Tambah `bcryptjs` dan `@types/bcryptjs` |
| `apps/pos-desktop/electron/main.ts` | **MODIFY** | Tambah `pin:validate` dan `pin:set-hash` IPC handlers |
| `apps/pos-desktop/src/lib/db.ts` | **MODIFY** | `LocalTransaction.status`, `PendingOperation.type`, Dexie v2 |
| `apps/pos-desktop/src/services/void-service.ts` | **CREATE** | Service layer untuk operasi void |
| `apps/pos-desktop/src/components/pos/PinChallengeDialog.tsx` | **MODIFY** | Ganti dummy PIN → IPC validation, tambah loading state |
| `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx` | **MODIFY** | Tambah Void button, VOID badge, PIN dialog integration |
| `apps/pos-desktop/src/pages/History.tsx` | **MODIFY** | Badge VOID di list, `onVoid` callback, `handleVoid` handler |
| `apps/pos-desktop/src/services/history-service.test.ts` | **MODIFY** | Tambah test dokumentasi kontrak `status` field |

**JANGAN modifikasi:**
- `apps/pos-desktop/src/store/pos-store.ts` — void tidak butuh state global POS
- `apps/pos-desktop/electron/preload.ts` — generic `invoke` sudah tersedia
- Tabel Dexie lain selain `localTransactions` — tidak relevan untuk story ini

### Anti-Pattern yang DILARANG

```typescript
// ❌ DILARANG: akses Dexie langsung dari komponen
const db = await getDb()
await db.localTransactions.update(id, { status: 'VOID' })
// BENAR: gunakan void-service.voidTransaction(id)

// ❌ DILARANG: hardcoded PIN check
if (pin === '123456') { onSuccess() }
// BENAR: window.ipcRenderer.invoke('pin:validate', pin)

// ❌ DILARANG: delete/hapus record yang di-void
await db.localTransactions.delete(id)
// BENAR: update status ke 'VOID', record tetap ada (audit trail)

// ❌ DILARANG: buat VoidDialog baru yang terpisah dari PinChallengeDialog
// BENAR: reuse PinChallengeDialog yang sudah ada

// ❌ DILARANG: update stock lokal di Dexie saat void
// BENAR: stock restoration terjadi di server via VOID_TRANSACTION pendingOperation

// ❌ DILARANG: Dexie v1 tanpa v2 migration path
// BENAR: db.version(1).stores(...) tetap ada, db.version(2).stores(...) tambah di bawahnya
```

### Potensi Regresi: Verifikasi POS.tsx Tidak Broken

`PinChallengeDialog` yang diupgrade juga digunakan oleh `POS.tsx` (price override). Setelah upgrade:
1. Alur harga override di POS harus tetap berjalan
2. PIN yang dikonfigurasi via `pin:set-hash` berlaku untuk KEDUA use-case (void + price override)
3. Ini adalah behavior yang diinginkan — satu PIN Owner untuk semua otorisasi

### Referensi Kode

- `apps/pos-desktop/src/components/pos/PinChallengeDialog.tsx` — dialog PIN yang akan diupgrade
- `apps/pos-desktop/src/pages/POS.tsx:123` — penggunaan existing PinChallengeDialog
- `apps/pos-desktop/src/lib/db.ts:70` — interface `LocalTransaction` yang akan diupdate
- `apps/pos-desktop/src/lib/db.ts:57` — interface `PendingOperation` yang akan diupdate
- `apps/pos-desktop/electron/main.ts:56` — pattern IPC handler existing (secure-storage:set)
- `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx` — dialog detail yang diupdate
- `apps/pos-desktop/src/pages/History.tsx` — halaman History yang diupdate
- `_bmad-output/planning-artifacts/architecture.md` — ADR-004 (PIN salted hash), NFR-S2 (PIN validation)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List
- Berhasil mengimplementasikan alur Void Transaksi dengan otorisasi PIN Owner.
- PIN sekarang divalidasi menggunakan bcrypt hash yang disimpan di secure storage (Electron safeStorage) melalui IPC.
- Transaksi ditandai sebagai 'VOID' di IndexedDB (tidak dihapus) untuk audit trail.
- Antrian sinkronisasi (`pendingOperations`) ditambahkan untuk memberitahu server tentang pembatalan transaksi.
- UI diperbarui dengan badge "VOID" merah yang mencolok di daftar riwayat dan dialog detail.
- Tombol "Void" dihilangkan dan "Cetak Ulang" dinonaktifkan untuk transaksi yang sudah dibatalkan.
- Verifikasi regresi: Fitur price override di POS tetap berfungsi normal dengan upgrade dialog PIN ini.

### File List
- `apps/pos-desktop/package.json`
- `apps/pos-desktop/electron/main.ts`
- `apps/pos-desktop/src/lib/db.ts`
- `apps/pos-desktop/src/services/void-service.ts`
- `apps/pos-desktop/src/components/pos/PinChallengeDialog.tsx`
- `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx`
- `apps/pos-desktop/src/pages/History.tsx`
- `apps/pos-desktop/src/services/history-service.test.ts`

### Change Log
- 2026-05-02: Implementasi awal Story 4.1 Void Transaction with PIN.
- 2026-05-02: Integrasi bcryptjs untuk validasi PIN yang aman.
- 2026-05-02: Update skema Dexie v2 dengan index status.
- 2026-05-02: Penambahan service layer void-service.
- 2026-05-02: Pembaruan UI komponen History dan Detail Dialog.

### Status
Review```
