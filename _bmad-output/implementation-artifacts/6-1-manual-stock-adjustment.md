# Story 6.1: Manual Stock Adjustment

Status: done

## Story

As an Owner,
I want menyesuaikan jumlah stok barang secara manual,
so that saya dapat mengoreksi selisih stok (barang hilang/rusak) yang ditemukan saat stock opname fisik tanpa harus memanipulasi transaksi penjualan.

## Acceptance Criteria

1. **Given** Owner berada di modul Inventory di Backoffice
   **When** halaman `/inventory/stock-adjustment` dimuat
   **Then** layar menampilkan form penyesuaian stok dengan dropdown produk aktif (beserta stok saat ini), input kuantitas baru, dan input alasan wajib diisi
   **And** halaman harus dimuat dalam waktu < 3 detik (NFR-P2)

2. **Given** form penyesuaian stok ditampilkan
   **When** Owner memilih produk dan mengisi kuantitas baru dan alasan dengan valid
   **Then** tombol "Simpan Penyesuaian" dapat diklik

3. **Given** Owner mengisi form dengan lengkap dan valid
   **When** Owner menekan "Simpan Penyesuaian"
   **Then** sistem mencatat entri penyesuaian di tabel `stock_adjustments` dengan `reason` wajib tidak kosong
   **And** `productStocks` dan `productStockBatches` diperbarui sesuai delta (newQty - previousQty)
   **And** entri dicatat di `audit_logs` (action: `'MANUAL_STOCK_ADJUSTMENT'`)
   **And** form menampilkan pesan sukses "Penyesuaian stok berhasil disimpan"
   **And** form di-reset ke kondisi awal setelah sukses

4. **Given** Owner tidak mengisi alasan (reason kosong)
   **When** Owner menekan "Simpan Penyesuaian"
   **Then** form menampilkan error "Alasan penyesuaian wajib diisi"
   **And** tidak ada perubahan di database

5. **Given** Owner memasukkan kuantitas baru yang sama dengan stok saat ini
   **When** Owner menekan "Simpan Penyesuaian"
   **Then** sistem menampilkan error "Kuantitas baru sama dengan stok saat ini, tidak ada perubahan"
   **And** tidak ada perubahan di database

6. **Given** Owner mengakses dashboard tanpa sesi aktif
   **When** mengakses `/inventory/stock-adjustment`
   **Then** diarahkan ke `/login` (auth existing via layout.tsx tidak berubah)

## Tasks / Subtasks

- [x] Task 1: DB Schema Extension (AC: #3)
  - [x] Buka `packages/db/src/schema/inventory.ts`
  - [x] Tambahkan `text` ke import dari `'drizzle-orm/pg-core'`
  - [x] Tambahkan `import { users } from './users';`
  - [x] Tambahkan tabel `stockAdjustments` — lihat Dev Notes untuk definisi lengkap
  - [x] `export * from './inventory'` di `packages/db/src/schema/index.ts` sudah ada — TIDAK perlu modifikasi
  - [x] Jalankan `pnpm --filter @petshop/db db:generate` untuk membuat migration file baru
  - [x] Jalankan `pnpm db:migrate` untuk apply migration ke database

- [x] Task 2: Service Function — `getProductsWithStock()` (AC: #1)
  - [x] Buka file yang sudah ada: `apps/backoffice/lib/services/stock-service.ts`
  - [x] Tambahkan imports: `products`, `branches`, `asc`, `sql`, `leftJoin` (cek apakah sudah ada di `'../db'`)
  - [x] Tambahkan interface `ProductWithStock` dan fungsi `getProductsWithStock(branchId: number)`
  - [x] Query: `products` LEFT JOIN `productStocks` (on productId + branchId + uomId = baseUomId)
  - [x] Filter: `products.isActive = true`
  - [x] COALESCE qty to `'0'` untuk produk tanpa stok
  - [x] Order by `products.name ASC`
  - [x] Return: `id, name, sku, baseUomId, currentQty` per produk — lihat Dev Notes untuk query lengkap

- [x] Task 3: Adjustment Function — `applyManualStockAdjustment()` (AC: #3, #5)
  - [x] Buka file yang sudah ada: `apps/backoffice/lib/stock-adjustment.ts`
  - [x] Tambahkan `import Big from 'big.js'` di baris atas
  - [x] Tambahkan `stockAdjustments` ke imports dari `'./db'`
  - [x] Tambahkan interface `ManualAdjustmentItem` — lihat Dev Notes
  - [x] Implementasikan fungsi `applyManualStockAdjustment(tx: Tx, item: ManualAdjustmentItem): Promise<void>`
  - [x] WAJIB: `.for('update')` pessimistic lock pada SELECT productStocks
  - [x] Gunakan `Big` untuk semua kalkulasi qty — bukan `Number()` atau `parseFloat()`
  - [x] Jika delta = 0: `throw new Error('Kuantitas baru sama dengan stok saat ini, tidak ada perubahan')`
  - [x] Jika delta < 0: FIFO deduction dari batch tertua (ikuti pola `applySOStockAdjustment`)
  - [x] Jika delta > 0: tambah ke batch terbaru (atau buat batch baru jika kosong)
  - [x] Update `productStocks` aggregate
  - [x] INSERT ke `stockAdjustments` tabel
  - [x] INSERT ke `auditLogs` (action: `'MANUAL_STOCK_ADJUSTMENT'`)
  - [x] Lihat Dev Notes untuk implementasi lengkap

- [x] Task 4: API Route — POST /api/bo/inventory/stock-adjustment (AC: #3, #4, #5)
  - [x] Buat `apps/backoffice/app/api/bo/inventory/stock-adjustment/route.ts`
  - [x] Auth check: verifikasi cookies `accessToken` — ambil `userId` dan `branchId` dari payload JWT
  - [x] Tambahkan `export const dynamic = 'force-dynamic'`
  - [x] Validasi input dengan Zod: `productId` (number), `newQty` (string/number ≥ 0), `reason` (string non-empty min 1)
  - [x] Ambil `currentQty` dari `productStocks` untuk product + branch + baseUomId
  - [x] Jalankan `applyManualStockAdjustment()` dalam `db.transaction()`
  - [x] Return 200 `{ success: true }` atau error response dalam Bahasa Indonesia
  - [x] Error messages user-facing dalam Bahasa Indonesia
  - [x] Lihat Dev Notes untuk implementasi lengkap

- [x] Task 5: UI Page + Form Component (AC: #1, #2, #3, #4, #5, #6)
  - [x] Buat direktori `apps/backoffice/app/(dashboard)/inventory/stock-adjustment/`
  - [x] Buat `apps/backoffice/app/(dashboard)/inventory/stock-adjustment/page.tsx`
    - [x] Async Server Component
    - [x] Baca JWT dari cookies (`accessToken`) untuk mendapatkan `branchId`
    - [x] Panggil `getProductsWithStock(branchId)` dari service layer langsung (bukan internal HTTP fetch)
    - [x] Pass `products` dan `branchName` ke `<AdjustmentForm />`
    - [x] Error state jika query gagal — tampilkan banner merah dengan pesan Indonesia
  - [x] Buat direktori `apps/backoffice/app/(dashboard)/inventory/stock-adjustment/_components/`
  - [x] Buat `apps/backoffice/app/(dashboard)/inventory/stock-adjustment/_components/adjustment-form.tsx`
    - [x] `'use client'` directive di baris pertama
    - [x] Props: `products: ProductWithStock[]`
    - [x] State: `selectedProductId`, `newQty`, `reason`, `isSubmitting`, `successMsg`, `errorMsg`
    - [x] Dropdown produk: tampilkan `${product.name} (SKU: ${product.sku ?? '-'}) — Stok: ${product.currentQty}`
    - [x] Input kuantitas baru: `type="number"`, `min="0"`, `step="0.01"` — tampilkan stok saat ini di bawahnya
    - [x] Textarea alasan: `required`, placeholder "Contoh: Barang hilang saat stock opname"
    - [x] Tombol "Simpan Penyesuaian": `disabled` saat `isSubmitting`
    - [x] Client-side validation sebelum submit: reason tidak kosong, newQty != currentQty
    - [x] Submit via `fetch('/api/bo/inventory/stock-adjustment', { method: 'POST', ... })`
    - [x] Setelah sukses: tampilkan pesan sukses + reset form ke kondisi awal
    - [x] Semua pesan error/sukses dalam Bahasa Indonesia

- [x] Task 6: Navigasi Sidebar (AC: #1)
  - [x] Modifikasi `apps/backoffice/app/(dashboard)/layout.tsx`
  - [x] Tambahkan link "Penyesuaian Stok" di sidebar nav (di bawah link "Laporan Nilai Stok")
  - [x] Gunakan ikon 🔧 dan className konsisten dengan link sidebar yang sudah ada

## Dev Notes

### Task 1: DB Schema — `stockAdjustments`

Tambahkan ke file yang sudah ada: `packages/db/src/schema/inventory.ts`

```typescript
// Tambahkan ke imports di baris atas:
import { serial, integer, decimal, timestamp, varchar, text } from 'drizzle-orm/pg-core';
import { users } from './users';

// Tambahkan di bawah stockAutoBreaks:
export const stockAdjustments = petshop.table('stock_adjustments', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  branchId: integer('branch_id').references(() => branches.id).notNull(),
  adjustedById: integer('adjusted_by_id').references(() => users.id).notNull(),
  previousQty: decimal('previous_qty', { precision: 12, scale: 2 }).notNull(),
  newQty: decimal('new_qty', { precision: 12, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Command untuk generate & migrate:**
```bash
# Di root monorepo:
pnpm --filter @petshop/db db:generate
pnpm db:migrate
```

### Task 2: `getProductsWithStock()`

Tambahkan ke file yang sudah ada: `apps/backoffice/lib/services/stock-service.ts`

```typescript
// Tambahkan imports jika belum ada (cek import yang sudah ada di file ini):
import {
  db,
  products,
  productStocks,
  eq,
  and,
  asc,
  sql,
} from '../db'

export interface ProductWithStock {
  productId: number
  productName: string
  sku: string | null
  baseUomId: number
  currentQty: string  // decimal string, '0' jika tidak ada stok
}

export async function getProductsWithStock(branchId: number): Promise<ProductWithStock[]> {
  const rows = await db
    .select({
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      baseUomId: products.baseUomId,
      currentQty: sql<string>`COALESCE(${productStocks.qty}, '0')`,
    })
    .from(products)
    .leftJoin(
      productStocks,
      and(
        eq(productStocks.productId, products.id),
        eq(productStocks.branchId, branchId),
        eq(productStocks.uomId, products.baseUomId)
      )
    )
    .where(eq(products.isActive, true))
    .orderBy(asc(products.name))

  return rows
}
```

**Kenapa LEFT JOIN:** Produk yang belum pernah punya stok tidak akan muncul di `productStocks`. LEFT JOIN memastikan semua produk aktif tampil, dengan qty = '0' jika belum ada record.

**Kenapa `eq(productStocks.uomId, products.baseUomId)`:** Kita hanya ingin stok dalam base UOM. Drizzle mendukung `eq(column, column)` antar dua kolom tabel berbeda.

### Task 3: `applyManualStockAdjustment()`

Tambahkan ke file yang sudah ada: `apps/backoffice/lib/stock-adjustment.ts`

```typescript
// Tambahkan di baris atas (tambahkan ke imports yang sudah ada):
import Big from 'big.js'
import { db, eq, and, asc, desc, sql, productStocks, productStockBatches, auditLogs, stockAdjustments } from './db';
// Catatan: Tx type sudah ada di file ini

export interface ManualAdjustmentItem {
  productId: number
  branchId: number
  uomId: number         // baseUomId produk
  previousQty: string   // qty saat ini dari productStocks (decimal string)
  newQty: string        // qty baru yang diinput owner (decimal string)
  reason: string        // wajib tidak kosong
  adjustedById: number  // userId dari JWT payload
}

export async function applyManualStockAdjustment(tx: Tx, item: ManualAdjustmentItem): Promise<void> {
  const prev = new Big(item.previousQty)
  const next = new Big(item.newQty)
  const delta = next.minus(prev)

  if (delta.eq(0)) {
    throw new Error('Kuantitas baru sama dengan stok saat ini, tidak ada perubahan')
  }

  // WAJIB: Pessimistic lock sebelum mutasi stok
  await tx
    .select({ id: productStocks.id })
    .from(productStocks)
    .where(
      and(
        eq(productStocks.productId, item.productId),
        eq(productStocks.branchId, item.branchId),
        eq(productStocks.uomId, item.uomId)
      )
    )
    .for('update')

  const absChange = delta.abs()

  if (delta.lt(0)) {
    // Kurangi dari batch FIFO tertua
    let remaining = absChange

    const batches = await tx
      .select()
      .from(productStockBatches)
      .where(
        and(
          eq(productStockBatches.productId, item.productId),
          eq(productStockBatches.branchId, item.branchId),
          sql`${productStockBatches.qtyRemaining} > 0`
        )
      )
      .orderBy(asc(productStockBatches.receivedAt))

    for (const batch of batches) {
      if (remaining.lte(0)) break
      const batchQty = new Big(batch.qtyRemaining)
      const deduct = remaining.gt(batchQty) ? batchQty : remaining

      await tx
        .update(productStockBatches)
        .set({ qtyRemaining: sql`${productStockBatches.qtyRemaining} - ${deduct.toString()}` })
        .where(eq(productStockBatches.id, batch.id))

      remaining = remaining.minus(deduct)
    }

    // Update aggregate
    await tx
      .update(productStocks)
      .set({ qty: sql`${productStocks.qty} - ${absChange.toString()}` })
      .where(
        and(
          eq(productStocks.productId, item.productId),
          eq(productStocks.branchId, item.branchId),
          eq(productStocks.uomId, item.uomId)
        )
      )
  } else {
    // Tambah ke batch terbaru
    const latestBatches = await tx
      .select()
      .from(productStockBatches)
      .where(
        and(
          eq(productStockBatches.productId, item.productId),
          eq(productStockBatches.branchId, item.branchId)
        )
      )
      .orderBy(desc(productStockBatches.receivedAt))
      .limit(1)

    if (latestBatches.length > 0) {
      await tx
        .update(productStockBatches)
        .set({ qtyRemaining: sql`${productStockBatches.qtyRemaining} + ${delta.toString()}` })
        .where(eq(productStockBatches.id, latestBatches[0].id))
    } else {
      // Buat batch baru dengan costPrice = '0' (tidak ada info harga beli)
      await tx.insert(productStockBatches).values({
        productId: item.productId,
        branchId: item.branchId,
        uomId: item.uomId,
        qtyReceived: delta.toString(),
        qtyRemaining: delta.toString(),
        costPrice: '0',
      })
    }

    // Update atau buat aggregate
    const existingStocks = await tx
      .select()
      .from(productStocks)
      .where(
        and(
          eq(productStocks.productId, item.productId),
          eq(productStocks.branchId, item.branchId),
          eq(productStocks.uomId, item.uomId)
        )
      )
      .limit(1)

    if (existingStocks.length > 0) {
      await tx
        .update(productStocks)
        .set({ qty: sql`${productStocks.qty} + ${delta.toString()}` })
        .where(eq(productStocks.id, existingStocks[0].id))
    } else {
      await tx.insert(productStocks).values({
        productId: item.productId,
        branchId: item.branchId,
        uomId: item.uomId,
        qty: delta.toString(),
      })
    }
  }

  // Catat di stockAdjustments (immutable record)
  await tx.insert(stockAdjustments).values({
    productId: item.productId,
    branchId: item.branchId,
    adjustedById: item.adjustedById,
    previousQty: item.previousQty,
    newQty: item.newQty,
    reason: item.reason,
  })

  // Catat di auditLogs (immutable audit trail per arsitektur)
  await tx.insert(auditLogs).values({
    branchId: item.branchId,
    userId: item.adjustedById,
    action: 'MANUAL_STOCK_ADJUSTMENT',
    tableName: 'product_stocks',
    oldData: JSON.stringify({ qty: item.previousQty }),
    newData: JSON.stringify({ qty: item.newQty, reason: item.reason }),
  })
}
```

**Kenapa pessimistic lock (`.for('update')`):** Arsitektur mewajibkan ini untuk semua mutasi stok — mencegah race condition jika dua adjustment berjalan bersamaan.

**Kenapa `Big` untuk semua kalkulasi:** Kolom `decimal` Drizzle dikembalikan sebagai `string`. `Number()` atau `parseFloat()` bisa menyebabkan floating-point error. `Big` memastikan precision penuh.

**Anti-pattern dari `applySOStockAdjustment` yang TIDAK boleh diulang:** File lama menggunakan `Number()` dan `Math.abs()` serta tidak ada pessimistic lock. Story ini harus menggunakan `Big` dan `.for('update')`.

### Task 4: API Route

```typescript
// apps/backoffice/app/api/bo/inventory/stock-adjustment/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { verifyAccessToken } from '@/lib/auth'
import { db, products, productStocks, eq, and } from '@/lib/db'
import { applyManualStockAdjustment } from '@/lib/stock-adjustment'

export const dynamic = 'force-dynamic'

const adjustmentSchema = z.object({
  productId: z.number().int().positive(),
  newQty: z.string().regex(/^\d+(\.\d+)?$/, 'Kuantitas tidak valid').or(z.number().min(0)),
  reason: z.string().min(1, 'Alasan penyesuaian wajib diisi'),
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
    const parsed = adjustmentSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? 'Data tidak valid'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { productId, reason } = parsed.data
    const newQty = parsed.data.newQty.toString()
    const { userId, branchId } = payload

    // Ambil baseUomId dari produk
    const productRows = await db
      .select({ baseUomId: products.baseUomId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1)

    if (productRows.length === 0) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
    }

    const { baseUomId } = productRows[0]

    // Ambil currentQty
    const stockRows = await db
      .select({ qty: productStocks.qty })
      .from(productStocks)
      .where(
        and(
          eq(productStocks.productId, productId),
          eq(productStocks.branchId, branchId),
          eq(productStocks.uomId, baseUomId)
        )
      )
      .limit(1)

    const previousQty = stockRows.length > 0 ? stockRows[0].qty : '0'

    await db.transaction(async (tx) => {
      await applyManualStockAdjustment(tx, {
        productId,
        branchId,
        uomId: baseUomId,
        previousQty,
        newQty,
        reason,
        adjustedById: userId,
      })
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal menyimpan penyesuaian stok'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

**Pattern auth:** Sama dengan export API routes di Story 5.3 dan 5.4 — verifikasi cookies `accessToken`.

**Zod validation:** `z.string().regex()` untuk newQty agar konsisten menerima baik string maupun number dari client.

### Task 5: UI Page + Form Component

```typescript
// apps/backoffice/app/(dashboard)/inventory/stock-adjustment/page.tsx
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { getProductsWithStock } from '@/lib/services/stock-service'
import AdjustmentForm from './_components/adjustment-form'

export default async function StockAdjustmentPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  // layout.tsx sudah redirect jika tidak ada token — payload tidak akan null di sini

  let products = []
  let error: string | null = null

  try {
    products = await getProductsWithStock(payload!.branchId)
  } catch {
    error = 'Gagal mengambil daftar produk. Silakan coba lagi.'
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-semibold text-foreground mb-1">Penyesuaian Stok</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Koreksi jumlah stok barang secara manual (barang hilang, rusak, atau selisih stock opname).
      </p>
      <AdjustmentForm products={products} />
    </div>
  )
}
```

```typescript
// apps/backoffice/app/(dashboard)/inventory/stock-adjustment/_components/adjustment-form.tsx
'use client'

import { useState } from 'react'
import type { ProductWithStock } from '@/lib/services/stock-service'

interface Props {
  products: ProductWithStock[]
}

export default function AdjustmentForm({ products }: Props) {
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [newQty, setNewQty] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const selectedProduct = products.find((p) => p.productId.toString() === selectedProductId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!reason.trim()) {
      setErrorMsg('Alasan penyesuaian wajib diisi')
      return
    }
    if (selectedProduct && newQty === selectedProduct.currentQty) {
      setErrorMsg('Kuantitas baru sama dengan stok saat ini, tidak ada perubahan')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/bo/inventory/stock-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: Number(selectedProductId),
          newQty,
          reason: reason.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Gagal menyimpan penyesuaian stok')
        return
      }
      setSuccessMsg('Penyesuaian stok berhasil disimpan')
      // Reset form
      setSelectedProductId('')
      setNewQty('')
      setReason('')
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Produk</label>
        <select
          value={selectedProductId}
          onChange={(e) => { setSelectedProductId(e.target.value); setNewQty('') }}
          required
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">-- Pilih produk --</option>
          {products.map((p) => (
            <option key={p.productId} value={p.productId.toString()}>
              {p.productName}{p.sku ? ` (SKU: ${p.sku})` : ''} — Stok: {p.currentQty}
            </option>
          ))}
        </select>
      </div>

      {selectedProduct && (
        <p className="text-xs text-muted-foreground">
          Stok saat ini: <span className="font-medium">{selectedProduct.currentQty}</span>
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Kuantitas Baru</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={newQty}
          onChange={(e) => setNewQty(e.target.value)}
          required
          placeholder="Masukkan jumlah stok yang sebenarnya"
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Alasan Penyesuaian <span className="text-destructive">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={3}
          placeholder="Contoh: Barang hilang saat stock opname, barang rusak tidak layak jual"
          className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting || !selectedProductId}
        className="w-full py-2 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Menyimpan...' : 'Simpan Penyesuaian'}
      </button>
    </form>
  )
}
```

### Task 6: Sidebar Navigation

```tsx
// Di dalam <nav> di apps/backoffice/app/(dashboard)/layout.tsx — setelah link "Laporan Nilai Stok":
<a
  href="/inventory/stock-adjustment"
  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
>
  <span>🔧</span>
  Penyesuaian Stok
</a>
```

### Architecture Compliance

- **big.js WAJIB** untuk semua kalkulasi qty di `applyManualStockAdjustment` — bukan `Number()`, `parseFloat()`, atau operator `+`/`-`/`*` langsung
- **Pessimistic locking WAJIB** — `.for('update')` pada SELECT productStocks sebelum mutasi
- **db.transaction()** untuk semua mutasi stok — atomicity
- **auditLogs WAJIB** — setiap mutasi stok dicatat (action: `'MANUAL_STOCK_ADJUSTMENT'`)
- **stockAdjustments** — tabel baru untuk record adjustments yang bisa di-query
- **Drizzle ORM** untuk semua DB access — bukan raw SQL string
- **Zod validation** untuk semua input API
- **Auth check WAJIB** di API route via cookies `accessToken`
- **`export const dynamic = 'force-dynamic'`** di API route
- **`branchId` dari JWT payload** — bukan dari request body (security)
- **Client Component** untuk form — halaman ini butuh state interaktif
- **Server Component** untuk page wrapper — fetch produk list di server
- **Tailwind CSS 4** untuk styling — konsisten dengan komponen yang sudah ada
- **Error messages user-facing dalam Bahasa Indonesia**

### Anti-Patterns (DILARANG)

- JANGAN gunakan `Number()` atau `parseFloat()` untuk kalkulasi qty — wajib `Big` dari big.js
- JANGAN skip pessimistic lock (`.for('update')`) — ini BERBEDA dari `applySOStockAdjustment` yang lama (pre-existing bug)
- JANGAN ambil `branchId` dari request body — ambil dari JWT payload (security)
- JANGAN panggil API route dari Server Component — panggil service function langsung di `page.tsx`
- JANGAN buat API route tanpa auth check — selalu verifikasi `accessToken` dari cookies
- JANGAN gunakan `Math.abs()` atau operator `+`/`-` langsung pada qty decimal — wajib `Big`
- JANGAN ignore kasus `previousQty = '0'` untuk delta negatif — validasi di service sudah handle ini (tidak ada batch = tidak bisa kurangi)
- JANGAN hardcode `branchId` atau `userId` di client — semua datang dari server via JWT
- JANGAN buat file baru untuk service — extend yang sudah ada (`stock-adjustment.ts` dan `stock-service.ts`)

### Sinkronisasi ke POS

Story ini memperbarui `productStocks` dan `productStockBatches` di PostgreSQL server. POS desktop sync secara periodik dengan server mengambil data terbaru — tidak ada pekerjaan tambahan yang dibutuhkan. Perubahan akan otomatis tersinkronisasi pada siklus sync berikutnya (bootstrap/pull dari server).

### Previous Story Intelligence (Story 5.4)

- **Auth pattern**: layout.tsx melindungi semua route `(dashboard)/` — tidak perlu auth di page level, tapi WAJIB ada di API route
- **Auth di API**: Ambil `accessToken` dari cookies → `verifyAccessToken()` → cek payload null
- **Server Component page**: Baca JWT dari cookies sendiri (tidak bergantung pada props dari layout)
- **`@/lib/db` exports semua**: `db`, semua tabel, semua operators (termasuk `stockAdjustments` setelah migration)
- **big.js import**: `import Big from 'big.js'` — sudah ada di `backoffice/package.json`
- **error instanceof Error**: Gunakan `error instanceof Error` bukan `error: any` (TypeScript strict)
- **Client Component**: Gunakan `'use client'` directive di baris PERTAMA file (sebelum imports)
- **Tailwind classes**: Gunakan className yang sama dengan halaman lain untuk konsistensi (lihat profit-loss/page.tsx)
- **`_components/` subfolder**: Pattern yang sudah digunakan di `dashboard/_components/` — ikuti pola ini

### Project Structure

File yang akan dibuat/dimodifikasi:
```
packages/db/src/schema/inventory.ts                                                             ← MODIFIKASI (tambah stockAdjustments table)
packages/db/src/migrations/                                                                     ← BARU (migration file via db:generate)
apps/backoffice/lib/stock-adjustment.ts                                                         ← MODIFIKASI (tambah applyManualStockAdjustment)
apps/backoffice/lib/services/stock-service.ts                                                   ← MODIFIKASI (tambah getProductsWithStock)
apps/backoffice/app/api/bo/inventory/stock-adjustment/route.ts                                  ← BARU
apps/backoffice/app/(dashboard)/inventory/stock-adjustment/page.tsx                             ← BARU
apps/backoffice/app/(dashboard)/inventory/stock-adjustment/_components/adjustment-form.tsx      ← BARU
apps/backoffice/app/(dashboard)/layout.tsx                                                      ← MODIFIKASI (tambah nav link)
```

### References

- [Epic 6, Story 6.1 — FR22](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/_bmad-output/planning-artifacts/epics.md)
- [Schema: inventory.ts — productStocks + productStockBatches](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/packages/db/src/schema/inventory.ts)
- [Schema: audit.ts — auditLogs](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/packages/db/src/schema/audit.ts)
- [stock-adjustment.ts — Fungsi adjustment yang WAJIB diextend](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/apps/backoffice/lib/stock-adjustment.ts)
- [stock-service.ts — Service layer yang WAJIB diextend](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/apps/backoffice/lib/services/stock-service.ts)
- [layout.tsx — Sidebar yang dimodifikasi](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/apps/backoffice/app/(dashboard)/layout.tsx)
- [JWTPayload type — userId, branchId tersedia](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/packages/shared/src/types/user.ts)
- [Story 5.4 — Pola auth + Server Component + Client fetch](file:///c:/Users/cundus/Documents/Project/hammielion/hammielion-monorepo/_bmad-output/implementation-artifacts/5-4-fifo-stock-valuation-report.md)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

### Review Findings

- [x] [Review][Patch] Data Mismatch pada FIFO (Gagal potong jika ketersediaan batch < selisih) [apps/backoffice/lib/stock-adjustment.ts]
- [x] [Review][Patch] Missing Locking pada Batches [apps/backoffice/lib/stock-adjustment.ts]
- [x] [Review][Patch] Validasi Saldo Negatif di API & Service [apps/backoffice/app/api/bo/inventory/stock-adjustment/route.ts]
- [x] [Review][Patch] Resiliensi Client Fetch Handling [apps/backoffice/app/(dashboard)/inventory/stock-adjustment/_components/adjustment-form.tsx]
- [x] [Review][Defer] Audit Log Data Format Consistency — deferred, pre-existing
- [x] [Review][Defer] Cost Price '0' on New Stock Addition — deferred, pre-existing (sesuai spek namun perlu audit trail)
