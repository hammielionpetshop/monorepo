# Story 10.3: Web POS Void Transaction

Status: done

## Story

As a Kasir,
I want membatalkan transaksi yang salah dengan otorisasi PIN Owner,
So that kesalahan input dapat dikoreksi tanpa merusak data finansial shift.

## Acceptance Criteria

1. **Given** Kasir melihat detail transaksi di halaman History
   **When** mereka menekan tombol "Void Transaksi"
   **Then** sistem menampilkan dialog konfirmasi dan kolom input PIN Owner

2. **Given** Kasir memasukkan PIN Owner yang benar
   **When** mereka mengkonfirmasi void
   **Then** sistem mengirim request `POST /api/pos/transactions/{id}/void` ke server
   **And** transaksi ditandai sebagai `VOIDED` dan tidak bisa di-void ulang
   **And** stok yang terkait dikembalikan secara otomatis oleh server

3. **Given** Kasir mencoba void transaksi dari shift yang sudah ditutup (status bukan `OPEN`)
   **When** mereka membuka detail transaksi tersebut
   **Then** tombol void tidak aktif (disabled) dan ditampilkan pesan "Transaksi dari shift yang sudah ditutup tidak dapat di-void dari POS. Gunakan Retur di Backoffice."

4. **Given** PIN Owner yang dimasukkan salah
   **When** konfirmasi void dikirim
   **Then** sistem menampilkan pesan error "PIN tidak valid" dan Kasir dapat mencoba ulang

5. **Given** Void berhasil diproses
   **When** server merespons sukses
   **Then** tampil opsi "Clone to Cart" — load item transaksi ke keranjang POS baru, redirect ke `/pos`

## Tasks / Subtasks

- [x] Task 1: Tambah `shiftId` ke `TransactionListItem` di `history/page.tsx` (AC: 3)
  - [x] Tambah field `shiftId: number` ke interface `TransactionListItem`
  - [x] Tambah kolom `shiftId: transactions.shiftId` ke semua DB select query (mode shift + mode date)
  - [x] Pastikan field `shiftId` diteruskan ke `transactionsWithDetails` mapping

- [x] Task 2: Buat API endpoint `POST /api/pos/void/validate-pin/route.ts` (AC: 1, 4)
  - [x] Auth: Verifikasi JWT via `cookies()` + `verifyAccessToken(token)`
  - [x] Body schema Zod: `{ pin: z.string().min(4).max(6) }`
  - [x] Logic: Query `ownerAssignments` untuk branch dari JWT payload → dapatkan `userId` owner aktif
  - [x] Query `users` untuk mendapatkan `pinHash` owner tersebut
  - [x] Validasi dengan `argon2.verify(owner.pinHash, pin)` (library: `argon2`, sama dengan login)
  - [x] Response sukses: `{ valid: true }` dengan status 200
  - [x] Response gagal: `{ error: 'PIN tidak valid' }` dengan status 400
  - [x] Jika owner tidak ditemukan: `{ error: 'Owner tidak dikonfigurasi untuk cabang ini' }` status 404

- [x] Task 3: Buat API endpoint `POST /api/pos/transactions/[id]/void/route.ts` (AC: 2, 3)
  - [x] Auth: Verifikasi JWT via `cookies()` + `verifyAccessToken(token)`
  - [x] Ambil `id` dari params (integer, validasi dengan `parseInt`)
  - [x] Fetch transaksi — pastikan `branchId === payload.branchId` (security check)
  - [x] Cek `transaction.status !== 'COMPLETED'` → throw `'Transaksi sudah dibatalkan atau tidak dapat di-void'`
  - [x] Fetch shift → cek `shift.status !== 'OPEN'` → throw `'Shift sudah ditutup, void tidak diizinkan'`
  - [x] Jalankan `db.transaction(async (tx) => { ... })`:
    - [x] Pessimistic lock: SELECT `productStocks` dengan `.for('update')` untuk semua productId dari items
    - [x] Update `transactions.status = 'VOIDED'`, `transactions.updatedAt = new Date()`
    - [x] Untuk setiap item di `transactionItems`: kembalikan stok dengan `StockService.addStock()`
    - [x] Insert `auditLogs` entry dengan action `'VOID_TRANSACTION'`
  - [x] Response: `{ success: true, trxNumber, status: 'VOIDED' }`

- [x] Task 4: Buat komponen `void-pin-dialog.tsx` (AC: 1, 4)
  - [x] Props: `{ isOpen: boolean; transactionId: number; trxNumber: string; onClose: () => void; onSuccess: () => void }`
  - [x] Input PIN: `type="password"`, `maxLength={6}`, digit-only filter, `autoFocus`
  - [x] Submit: call `POST /api/pos/void/validate-pin` lalu jika valid call `POST /api/pos/transactions/{id}/void`
  - [x] State: `pin`, `error`, `isProcessing` — reset saat `isOpen` berubah jadi true
  - [x] Error display: "PIN tidak valid. Pastikan PIN Owner yang dimasukkan benar."
  - [x] Touch target: semua button min-height 44px, input min-height 52px
  - [x] Tutup via tombol X atau ESC (tapi tidak saat processing)

- [x] Task 5: Update `transaction-detail-modal.tsx` — tambah void + clone-to-cart (AC: 1, 2, 3, 5)
  - [x] Tambah props: `activeShiftId: number | null`
  - [x] Tambah state: `isVoidDialogOpen`, `localStatus` (untuk optimistic update)
  - [x] Logika `canVoid`: `localStatus === 'COMPLETED' && transaction.shiftId === activeShiftId`
  - [x] Tombol "Void Transaksi": tampil jika `localStatus !== 'VOIDED'`, disabled jika `!canVoid`
  - [x] Pesan disable: jika `transaction.shiftId !== activeShiftId` → "Transaksi dari shift yang sudah ditutup tidak dapat di-void dari POS. Gunakan Retur di Backoffice."
  - [x] Setelah void sukses: update `localStatus = 'VOIDED'`, tampilkan tombol "Clone to Cart"
  - [x] Tombol "Clone to Cart": map items ke `CartItem` format, call `useCartStore.setState({ items: cartItems })`, `router.push('/pos')`
  - [x] Render `<VoidPinDialog>` dengan props yang sesuai

- [x] Task 6: Update `transaction-history-client.tsx` — pass `activeShiftId` ke modal (AC: 3)
  - [x] Teruskan prop `activeShiftId` ke `<TransactionDetailModal activeShiftId={activeShiftId} ... />`

## Dev Notes

### 🔑 Struktur File

**FILE BARU:**
- `apps/backoffice/app/api/pos/void/validate-pin/route.ts`
- `apps/backoffice/app/api/pos/transactions/[id]/void/route.ts`
- `apps/backoffice/components/pos/void-pin-dialog.tsx`

**DIMODIFIKASI:**
- `apps/backoffice/app/pos/(authenticated)/history/page.tsx` — tambah `shiftId` ke type + query
- `apps/backoffice/components/pos/transaction-detail-modal.tsx` — tambah void/clone logic
- `apps/backoffice/components/pos/transaction-history-client.tsx` — teruskan `activeShiftId` ke modal

**TIDAK DIUBAH:**
- `apps/backoffice/components/pos/cart-store.ts` — tidak perlu modifikasi
- `apps/backoffice/components/pos/receipt-print.tsx` — tidak perlu disentuh
- `apps/backoffice/components/pos/pos-nav-tabs.tsx` — tidak perlu disentuh
- `apps/backoffice/lib/services/transaction-service.ts` — tidak perlu modifikasi
- `apps/backoffice/lib/services/stock-service.ts` — tidak perlu modifikasi (gunakan apa adanya)

---

### 🔑 Tambah `shiftId` ke `history/page.tsx`

Interface dan query update:

```typescript
// Di history/page.tsx — TAMBAH shiftId ke interface
export interface TransactionListItem {
  id: number
  trxNumber: string
  createdAt: string
  payableAmount: number
  paidAmount: number
  changeAmount: number
  status: string
  discountAmount: number
  totalAmount: number
  shiftId: number   // ← BARU
}

// Di DbTransactionRow — TAMBAH shiftId
interface DbTransactionRow {
  id: number
  trxNumber: string
  createdAt: Date
  // ... kolom lain ...
  shiftId: number   // ← BARU
}

// Di DB select query (kedua mode: shift DAN date) — TAMBAH:
shiftId: transactions.shiftId,
```

---

### 🔑 API: `POST /api/pos/void/validate-pin/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import * as argon2 from 'argon2'
import { verifyAccessToken } from '@/lib/auth'
import { db, users, ownerAssignments, eq, and } from '@/lib/db'

export const dynamic = 'force-dynamic'

const schema = z.object({
  pin: z.string().min(4).max(6),
})

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null

    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 })
    }

    // Cari owner aktif untuk branch kasir ini
    const [ownerAssignment] = await db
      .select({ userId: ownerAssignments.userId })
      .from(ownerAssignments)
      .where(and(eq(ownerAssignments.branchId, payload.branchId), eq(ownerAssignments.isActive, true)))
      .limit(1)

    if (!ownerAssignment) {
      return NextResponse.json({ error: 'Owner tidak dikonfigurasi untuk cabang ini' }, { status: 404 })
    }

    const [owner] = await db
      .select({ pinHash: users.pinHash })
      .from(users)
      .where(eq(users.id, ownerAssignment.userId))
      .limit(1)

    if (!owner?.pinHash) {
      return NextResponse.json({ error: 'PIN Owner belum dikonfigurasi' }, { status: 404 })
    }

    const isValid = await argon2.verify(owner.pinHash, parsed.data.pin)
    if (!isValid) {
      return NextResponse.json({ error: 'PIN tidak valid' }, { status: 400 })
    }

    return NextResponse.json({ valid: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memvalidasi PIN'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

---

### 🔑 API: `POST /api/pos/transactions/[id]/void/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import * as argon2 from 'argon2'  // tidak digunakan di sini, PIN sudah divalidasi sebelumnya
import { verifyAccessToken } from '@/lib/auth'
import {
  db, transactions, transactionItems, productStocks, products,
  productUomConversions, auditLogs, shifts,
  eq, and, inArray,
} from '@/lib/db'
import { StockService } from '@/lib/services/stock-service'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null

    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const txId = parseInt(params.id, 10)
    if (isNaN(txId) || txId <= 0) {
      return NextResponse.json({ error: 'ID transaksi tidak valid' }, { status: 400 })
    }

    // Ambil transaksi + validasi kepemilikan branch
    const [trx] = await db
      .select({
        id: transactions.id,
        trxNumber: transactions.trxNumber,
        branchId: transactions.branchId,
        shiftId: transactions.shiftId,
        status: transactions.status,
      })
      .from(transactions)
      .where(and(eq(transactions.id, txId), eq(transactions.branchId, payload.branchId)))
      .limit(1)

    if (!trx) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }
    if (trx.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Transaksi sudah dibatalkan atau tidak dapat di-void' }, { status: 400 })
    }

    // Cek shift masih OPEN
    const [shift] = await db
      .select({ status: shifts.status })
      .from(shifts)
      .where(eq(shifts.id, trx.shiftId))
      .limit(1)

    if (!shift || shift.status !== 'OPEN') {
      return NextResponse.json({ error: 'Shift sudah ditutup, void tidak diizinkan' }, { status: 400 })
    }

    // Ambil items transaksi
    const items = await db
      .select({
        id: transactionItems.id,
        productId: transactionItems.productId,
        uomId: transactionItems.uomId,
        qty: transactionItems.qty,
        cogs: transactionItems.cogs,
      })
      .from(transactionItems)
      .where(eq(transactionItems.transactionId, txId))

    // Ambil baseUomId semua produk (untuk konversi UOM)
    const productIds = [...new Set(items.map((i) => i.productId))]
    const productRows = await db
      .select({ id: products.id, baseUomId: products.baseUomId })
      .from(products)
      .where(inArray(products.id, productIds))
    const productBaseUomMap = new Map(productRows.map((p) => [p.id, p.baseUomId]))

    // Ambil semua konversi UOM yang diperlukan
    const conversionRows = await db
      .select({
        productId: productUomConversions.productId,
        uomId: productUomConversions.uomId,
        ratio: productUomConversions.ratio,
      })
      .from(productUomConversions)
      .where(inArray(productUomConversions.productId, productIds))
    const conversionMap = new Map(
      conversionRows.map((c) => [`${c.productId}:${c.uomId}`, c.ratio])
    )

    await db.transaction(async (tx) => {
      // Pessimistic lock pada product stocks (anti race condition)
      if (productIds.length > 0) {
        await tx
          .select({ id: productStocks.id })
          .from(productStocks)
          .where(and(inArray(productStocks.productId, productIds), eq(productStocks.branchId, trx.branchId)))
          .for('update')
      }

      // 1. Update status transaksi menjadi VOIDED
      await tx
        .update(transactions)
        .set({ status: 'VOIDED', updatedAt: new Date() })
        .where(eq(transactions.id, txId))

      // 2. Kembalikan stok tiap item (FIFO reversal — masukkan batch baru)
      for (const item of items) {
        const baseUomId = productBaseUomMap.get(item.productId)
        if (!baseUomId) continue

        let ratioToBase = 1
        if (item.uomId !== baseUomId) {
          const convKey = `${item.productId}:${item.uomId}`
          const ratio = conversionMap.get(convKey)
          if (ratio) ratioToBase = Number(ratio)
        }

        const baseQtyToReturn = item.qty * ratioToBase

        await StockService.addStock(
          tx,
          trx.branchId,
          item.productId,
          baseUomId,
          String(baseQtyToReturn),
          String(item.cogs ?? 0),
        )
      }

      // 3. Audit log
      await tx.insert(auditLogs).values({
        branchId: trx.branchId,
        userId: payload.userId,
        action: 'VOID_TRANSACTION',
        tableName: 'transactions',
        recordId: txId,
        newData: JSON.stringify({ trxNumber: trx.trxNumber, voidedBy: payload.userId }),
      })
    })

    return NextResponse.json({ success: true, trxNumber: trx.trxNumber, status: 'VOIDED' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memvoid transaksi'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

---

### 🔑 Komponen `void-pin-dialog.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'

interface VoidPinDialogProps {
  isOpen: boolean
  transactionId: number
  trxNumber: string
  onClose: () => void
  onSuccess: () => void
}

export default function VoidPinDialog({
  isOpen,
  transactionId,
  trxNumber,
  onClose,
  onSuccess,
}: VoidPinDialogProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Reset state saat dialog dibuka
  useEffect(() => {
    if (isOpen) {
      setPin('')
      setError('')
      setIsProcessing(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length < 4 || isProcessing) return
    setIsProcessing(true)
    setError('')

    try {
      // Step 1: Validasi PIN
      const pinRes = await fetch('/api/pos/void/validate-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!pinRes.ok) {
        const data = await pinRes.json()
        setError(data.error ?? 'PIN tidak valid. Pastikan PIN Owner yang dimasukkan benar.')
        return
      }

      // Step 2: Eksekusi void
      const voidRes = await fetch(`/api/pos/transactions/${transactionId}/void`, {
        method: 'POST',
      })
      if (!voidRes.ok) {
        const data = await voidRes.json()
        setError(data.error ?? 'Gagal memvoid transaksi. Coba lagi.')
        return
      }

      onSuccess()
    } catch {
      setError('Terjadi kesalahan jaringan. Coba lagi.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60" onClick={() => !isProcessing && onClose()} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[70] bg-background rounded-2xl shadow-xl max-w-sm mx-auto">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Otorisasi Void</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground rounded-full disabled:opacity-40"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Masukkan PIN Owner untuk membatalkan transaksi <strong>{trxNumber}</strong>
          </p>

          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''))
              setError('')
            }}
            disabled={isProcessing}
            autoFocus
            className="w-full bg-muted border border-border rounded-xl py-3 text-center text-2xl tracking-[0.5em] font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 min-h-[52px]"
            placeholder="••••••"
          />

          {error && (
            <p className="text-xs text-destructive font-medium text-center">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 min-h-[44px] border border-border text-foreground font-semibold rounded-xl hover:bg-accent disabled:opacity-40 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={pin.length < 4 || isProcessing}
              className="flex-1 min-h-[44px] bg-destructive text-destructive-foreground font-semibold rounded-xl hover:bg-destructive/90 disabled:opacity-40 transition-colors"
            >
              {isProcessing ? 'Memproses...' : 'Konfirmasi Void'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
```

---

### 🔑 Update `transaction-detail-modal.tsx`

Tambahkan prop `activeShiftId`, import `VoidPinDialog`, `useCartStore`, dan `useRouter`:

```typescript
// Tambah import
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from './cart-store'
import type { CartItem } from './cart-store'
import VoidPinDialog from './void-pin-dialog'

// Update interface props
interface TransactionDetailModalProps {
  transaction: TransactionWithDetails
  branchName: string
  cashierName: string
  onClose: () => void
  activeShiftId: number | null   // ← BARU
}

export default function TransactionDetailModal({
  transaction,
  branchName,
  cashierName,
  onClose,
  activeShiftId,
}: TransactionDetailModalProps) {
  const router = useRouter()
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false)
  const [localStatus, setLocalStatus] = useState(transaction.status)

  const isVoided = localStatus === 'VOIDED'
  // Void diizinkan hanya jika transaksi ada di shift aktif saat ini
  const canVoid = !isVoided && transaction.shiftId === activeShiftId
  // Shift sudah ditutup = transaksi dari shift lain
  const isFromClosedShift = !isVoided && transaction.shiftId !== activeShiftId

  const handleVoidSuccess = () => {
    setIsVoidDialogOpen(false)
    setLocalStatus('VOIDED')
  }

  const handleCloneToCart = () => {
    const cartItems: CartItem[] = transaction.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      uomId: item.uomId,
      uomCode: item.uomCode,
      qty: item.qty,
      unitPrice: item.unitPrice.toString(),
      priceTier: 'RETAIL',
      discountAmount: item.discountAmount.toString(),
      subtotal: item.totalPrice.toString(),
    }))
    useCartStore.setState({ items: cartItems })
    onClose()
    router.push('/pos')
  }

  // ... sisa komponen ...

  // Di footer modal, tambahkan tombol-tombol:
  // Void button:
  // {!isVoided && (
  //   <button
  //     type="button"
  //     onClick={() => setIsVoidDialogOpen(true)}
  //     disabled={!canVoid}
  //     title={isFromClosedShift ? "Transaksi dari shift yang sudah ditutup tidak dapat di-void dari POS. Gunakan Retur di Backoffice." : undefined}
  //     className="..."
  //   >
  //     Void Transaksi
  //   </button>
  // )}
  // {isFromClosedShift && (
  //   <p className="text-xs text-muted-foreground">
  //     Transaksi dari shift yang sudah ditutup tidak dapat di-void dari POS. Gunakan Retur di Backoffice.
  //   </p>
  // )}
  // Clone to Cart button (setelah void):
  // {isVoided && (
  //   <button type="button" onClick={handleCloneToCart}>Clone to Cart</button>
  // )}

  // Render VoidPinDialog:
  // <VoidPinDialog
  //   isOpen={isVoidDialogOpen}
  //   transactionId={transaction.id}
  //   trxNumber={transaction.trxNumber}
  //   onClose={() => setIsVoidDialogOpen(false)}
  //   onSuccess={handleVoidSuccess}
  // />
}
```

---

### 🔑 Update `transaction-history-client.tsx`

Tambahkan `activeShiftId` ke props `<TransactionDetailModal>`:

```typescript
{selectedTransaction && (
  <TransactionDetailModal
    transaction={selectedTransaction}
    branchName={branchName}
    cashierName={cashierName}
    activeShiftId={activeShiftId}   // ← BARU
    onClose={() => setSelectedTransaction(null)}
  />
)}
```

---

### 🔑 DB Import yang Diperlukan di Void Endpoint

Endpoint `[id]/void/route.ts` memerlukan import dari `@/lib/db`:

```typescript
import {
  db,
  transactions,
  transactionItems,
  productStocks,
  products,
  productUomConversions,
  auditLogs,
  shifts,
  eq,
  and,
  inArray,
} from '@/lib/db'
```

Verifikasi bahwa semua export ini tersedia di `apps/backoffice/lib/db.ts`. Jika ada yang belum di-export, tambahkan di file tersebut.

---

### 🔑 Logika Konversi UOM untuk Stock Reversal

Ikuti pola yang sama dengan `TransactionService.createTransaction`:

```typescript
// Di void route — konversi qty ke base UOM sebelum addStock
const baseQtyToReturn = item.qty * ratioToBase
await StockService.addStock(
  tx,
  trx.branchId,
  item.productId,
  baseUomId,              // ← WAJIB base UOM (bukan purchase UOM)
  String(baseQtyToReturn),
  String(item.cogs ?? 0),
)
```

**Perbedaan dengan `ReturService`**: ReturService menggunakan `item.uomId` (purchase UOM) — ini inkonsisten dengan cara TransactionService mendeduct stok. Untuk story 10.3, gunakan pola TransactionService (base UOM) agar consistent dengan cara stok dideduct. Ini adalah koreksi intentional.

---

### 🔑 `ownerAssignments` Import

Pastikan `ownerAssignments` di-export dari `@/lib/db`. Schema ada di `packages/db/src/schema/users.ts`. Verifikasi di `apps/backoffice/lib/db.ts` atau `packages/db/src/index.ts`.

---

### 🔑 `TransactionWithDetails` Perlu `shiftId`

Setelah Task 1, interface `TransactionWithDetails` akan memiliki `shiftId`. Komponen modal perlu di-update untuk menerima field ini. Karena `TransactionWithDetails extends TransactionListItem` dan `TransactionListItem` akan memiliki `shiftId`, field ini sudah otomatis tersedia di `transaction.shiftId` di dalam modal.

---

### ⚠️ Penanganan Status `PENDING_VOID`

Dari review story 10.2: status `PENDING_VOID` didukung (ditarik dari server). Untuk story 10.3:
- Tombol void harus **disabled** jika `localStatus === 'PENDING_VOID'`
- Kondisi `canVoid`: `localStatus === 'COMPLETED' && transaction.shiftId === activeShiftId`
- Status `PENDING_VOID` hanya muncul untuk transaksi offline yang sedang disinkronkan — jangan izinkan void pada status ini

---

### Checklist Anti-Regresi

- [ ] `/pos/history` tanpa searchParams masih tampil daftar transaksi (tidak crash akibat `shiftId`)
- [ ] Modal detail transaksi masih bisa dibuka normal
- [ ] Cetak ulang struk masih berfungsi dari modal
- [ ] Transaksi yang sudah VOIDED menampilkan badge VOID (sudah ada), tombol void tidak muncul lagi
- [ ] Navigasi Clone to Cart membawa items yang benar ke `/pos`
- [ ] Tidak ada `any` types di file baru

---

### Konvensi Wajib

- File names: **kebab-case**
- TypeScript: **strict mode**, tidak ada `any`
- Error messages user-facing: **Bahasa Indonesia**
- Semua operasi finansial/stok: gunakan `big.js` (StockService sudah menggunakan ini secara internal)
- Pessimistic locking: wajib `.for('update')` saat membaca stok yang akan diubah
- No silent failures: semua `catch` harus log atau rethrow

---

### Reference Files

- `apps/backoffice/app/api/auth/login/route.ts` — pola auth + argon2.verify (PIN validation)
- `apps/backoffice/app/api/bo/retur/route.ts` — pola API route dengan JWT auth + service call
- `apps/backoffice/lib/services/transaction-service.ts` — pola createTransaction + UOM conversion
- `apps/backoffice/lib/services/stock-service.ts` — `StockService.addStock()` signature
- `apps/backoffice/lib/services/retur-service.ts` — pola stock reversal (ReturService)
- `apps/backoffice/components/pos/transaction-detail-modal.tsx` — file yang dimodifikasi (baca dulu!)
- `apps/backoffice/components/pos/transaction-history-client.tsx` — file yang dimodifikasi (baca dulu!)
- `apps/backoffice/app/pos/(authenticated)/history/page.tsx` — file yang dimodifikasi (baca dulu!)
- `apps/backoffice/components/pos/cart-store.ts` — `CartItem` interface + `useCartStore.setState`
- `packages/db/src/schema/users.ts` — `ownerAssignments` table schema
- `packages/db/src/schema/transactions.ts` — `transactions.status` values
- `packages/db/src/schema/shifts.ts` — `shifts.status` values (OPEN | CLOSED | FORCE_CLOSED)
- `apps/pos-desktop/src/components/history/TransactionDetailDialog.tsx` — referensi UI pola Electron POS

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Completion Notes List

- Task 1: `history/page.tsx` — ditambahkan `shiftId: number` ke interface `TransactionListItem` dan `DbTransactionRow`. Kolom `shiftId: transactions.shiftId` ditambahkan ke kedua query SELECT (mode shift dan mode date). Field tersebar otomatis ke `transactionsWithDetails` via spread operator.
- Task 2: `api/pos/void/validate-pin/route.ts` — endpoint baru. Auth JWT via cookie, Zod validation, query `ownerAssignments` untuk branch kasir, verifikasi `pinHash` dengan argon2. Response 200 `{ valid: true }` atau 400/404 dengan pesan error Bahasa Indonesia.
- Task 3: `api/pos/transactions/[id]/void/route.ts` — endpoint baru. Auth JWT, security check `branchId`, cek status transaksi `COMPLETED`, cek shift `OPEN`. DB transaction dengan pessimistic lock `productStocks`, update status ke `VOIDED`, stock reversal via `StockService.addStock()` dengan konversi UOM ke base (mengikuti pola `TransactionService`), audit log.
- Task 4: `components/pos/void-pin-dialog.tsx` — komponen baru. Dialog modal dengan input PIN digit-only, two-step API call (validate-pin → void), error display, ESC+X close, semua touch target ≥ 44px, input ≥ 52px.
- Task 5: `components/pos/transaction-detail-modal.tsx` — diupdate dengan prop `activeShiftId`, state `localStatus` untuk optimistic update, logika `canVoid`/`isFromClosedShift`, tombol Void (disabled jika bukan shift aktif), pesan penjelasan shift tertutup, tombol Clone to Cart (muncul setelah void sukses), integrasi `VoidPinDialog`.
- Task 6: `components/pos/transaction-history-client.tsx` — prop `activeShiftId` diteruskan ke `TransactionDetailModal`.
- TypeScript `tsc --noEmit` bersih tanpa error di semua file baru dan yang dimodifikasi.
- ESLint error pre-existing (plugin `@typescript-eslint/no-unused-expressions` incompatible dengan ESLint 9) — sama seperti yang dicatat di story 10.2, bukan akibat perubahan story ini.

### File List

- `apps/backoffice/app/pos/(authenticated)/history/page.tsx` (dimodifikasi — tambah `shiftId` ke types + queries)
- `apps/backoffice/components/pos/transaction-detail-modal.tsx` (dimodifikasi — tambah void/clone-to-cart logic)
- `apps/backoffice/components/pos/transaction-history-client.tsx` (dimodifikasi — teruskan `activeShiftId` ke modal)
- `apps/backoffice/app/api/pos/void/validate-pin/route.ts` (BARU — endpoint validasi PIN Owner)
- `apps/backoffice/app/api/pos/transactions/[id]/void/route.ts` (BARU — endpoint eksekusi void transaksi)
- `apps/backoffice/components/pos/void-pin-dialog.tsx` (BARU — komponen dialog PIN challenge)
