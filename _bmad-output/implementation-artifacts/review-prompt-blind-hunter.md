You are a Blind Hunter adversarial code reviewer. You receive NO project context and NO spec. Your task is to find bugs, security vulnerabilities, and code quality issues based ONLY on the provided diff.

### DIFF OUTPUT

```diff
diff --git a/packages/db/src/schema/inventory.ts b/packages/db/src/schema/inventory.ts
index 24e424d..b4c0fcc 100644
--- a/packages/db/src/schema/inventory.ts
+++ b/packages/db/src/schema/inventory.ts
@@ -1,8 +1,9 @@
-import { serial, integer, decimal, timestamp, varchar } from 'drizzle-orm/pg-core';
+import { serial, integer, decimal, timestamp, varchar, text } from 'drizzle-orm/pg-core';
 import { petshop } from './_schema';
 import { products } from './products';
 import { branches } from './branches';
 import { unitsOfMeasure } from './master';
+import { users } from './users';
 
 export const productStocks = petshop.table('product_stocks', {
   id: serial('id').primaryKey(),
@@ -34,3 +35,14 @@ export const stockAutoBreaks = petshop.table('stock_auto_breaks', {
   qtyGained: decimal('qty_gained', { precision: 12, scale: 2 }).notNull(), // Qty of Small
   createdAt: timestamp('created_at').defaultNow().notNull(),
 });
+
+export const stockAdjustments = petshop.table('stock_adjustments', {
+  id: serial('id').primaryKey(),
+  productId: integer('product_id').references(() => products.id).notNull(),
+  branchId: integer('branch_id').references(() => branches.id).notNull(),
+  adjustedById: integer('adjusted_by_id').references(() => users.id).notNull(),
+  previousQty: decimal('previous_qty', { precision: 12, scale: 2 }).notNull(),
+  newQty: decimal('new_qty', { precision: 12, scale: 2 }).notNull(),
+  reason: text('reason').notNull(),
+  createdAt: timestamp('created_at').defaultNow().notNull(),
+});
diff --git a/apps/backoffice/lib/services/stock-service.ts b/apps/backoffice/lib/services/stock-service.ts
index 1017c6a..d9b400a 100644
--- a/apps/backoffice/lib/services/stock-service.ts
+++ b/apps/backoffice/lib/services/stock-service.ts
@@ -1,6 +1,38 @@
-import { db, productStocks, productStockBatches, eq, and, sql } from '../db';
+import { db, productStocks, productStockBatches, products, eq, and, sql, asc } from '../db';
 import { fifoDeduct } from '@petshop/shared';
 
+export interface ProductWithStock {
+  productId: number
+  productName: string
+  sku: string | null
+  baseUomId: number
+  currentQty: string  // decimal string, '0' jika tidak ada stok
+}
+
+export async function getProductsWithStock(branchId: number): Promise<ProductWithStock[]> {
+  const rows = await db
+    .select({
+      productId: products.id,
+      productName: products.name,
+      sku: products.sku,
+      baseUomId: products.baseUomId,
+      currentQty: sql<string>`COALESCE(${productStocks.qty}, '0')`,
+    })
+    .from(products)
+    .leftJoin(
+      productStocks,
+      and(
+        eq(productStocks.productId, products.id),
+        eq(productStocks.branchId, branchId),
+        eq(productStocks.uomId, products.baseUomId)
+      )
+    )
+    .where(eq(products.isActive, true))
+    .orderBy(asc(products.name))
+
+  return rows
+}
+
 export class StockService {
   /**
    * Deduct stock from a branch using FIFO.
diff --git a/apps/backoffice/lib/stock-adjustment.ts b/apps/backoffice/lib/stock-adjustment.ts
index 9acf089..7cdfca2 100644
--- a/apps/backoffice/lib/stock-adjustment.ts
+++ b/apps/backoffice/lib/stock-adjustment.ts
@@ -1,9 +1,163 @@
-import { db, eq, and, desc, asc, sql, productStocks, productStockBatches, auditLogs } from './db';
-
+import Big from 'big.js'
+import { db, eq, and, desc, asc, sql, productStocks, productStockBatches, auditLogs, stockAdjustments } from './db';
 
 // Extract the transaction type from db
 export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
 
+export interface ManualAdjustmentItem {
+  productId: number
+  branchId: number
+  uomId: number         // baseUomId produk
+  previousQty: string   // qty saat ini dari productStocks (decimal string)
+  newQty: string        // qty baru yang diinput owner (decimal string)
+  reason: string        // wajib tidak kosong
+  adjustedById: number  // userId dari JWT payload
+}
+
+export async function applyManualStockAdjustment(tx: Tx, item: ManualAdjustmentItem): Promise<void> {
+  const prev = new Big(item.previousQty)
+  const next = new Big(item.newQty)
+  const delta = next.minus(prev)
+
+  if (delta.eq(0)) {
+    throw new Error('Kuantitas baru sama dengan stok saat ini, tidak ada perubahan')
+  }
+
+  // WAJIB: Pessimistic lock sebelum mutasi stok
+  await tx
+    .select({ id: productStocks.id })
+    .from(productStocks)
+    .where(
+      and(
+        eq(productStocks.productId, item.productId),
+        eq(productStocks.branchId, item.branchId),
+        eq(productStocks.uomId, item.uomId)
+      )
+    )
+    .for('update')
+
+  const absChange = delta.abs()
+
+  if (delta.lt(0)) {
+    // Kurangi dari batch FIFO tertua
+    let remaining = absChange
+
+    const batches = await tx
+      .select()
+      .from(productStockBatches)
+      .where(
+        and(
+          eq(productStockBatches.productId, item.productId),
+          eq(productStockBatches.branchId, item.branchId),
+          sql`${productStockBatches.qtyRemaining} > 0`
+        )
+      )
+      .orderBy(asc(productStockBatches.receivedAt))
+
+    for (const batch of batches) {
+      if (remaining.lte(0)) break
+      const batchQty = new Big(batch.qtyRemaining)
+      const deduct = remaining.gt(batchQty) ? batchQty : remaining
+
+      await tx
+        .update(productStockBatches)
+        .set({ qtyRemaining: sql`${productStockBatches.qtyRemaining} - ${deduct.toString()}` })
+        .where(eq(productStockBatches.id, batch.id))
+
+      remaining = remaining.minus(deduct)
+    }
+
+    // Update aggregate
+    await tx
+      .update(productStocks)
+      .set({ qty: sql`${productStocks.qty} - ${absChange.toString()}` })
+      .where(
+        and(
+          eq(productStocks.productId, item.productId),
+          eq(productStocks.branchId, item.branchId),
+          eq(productStocks.uomId, item.uomId)
+        )
+      )
+  } else {
+    // Tambah ke batch terbaru
+    const latestBatches = await tx
+      .select()
+      .from(productStockBatches)
+      .where(
+        and(
+          eq(productStockBatches.productId, item.productId),
+          eq(productStockBatches.branchId, item.branchId)
+        )
+      )
+      .orderBy(desc(productStockBatches.receivedAt))
+      .limit(1)
+
+    if (latestBatches.length > 0) {
+      await tx
+        .update(productStockBatches)
+        .set({ qtyRemaining: sql`${productStockBatches.qtyRemaining} + ${delta.toString()}` })
+        .where(eq(productStockBatches.id, latestBatches[0].id))
+    } else {
+      // Buat batch baru dengan costPrice = '0' (tidak ada info harga beli)
+      await tx.insert(productStockBatches).values({
+        productId: item.productId,
+        branchId: item.branchId,
+        uomId: item.uomId,
+        qtyReceived: delta.toString(),
+        qtyRemaining: delta.toString(),
+        costPrice: '0',
+      })
+    }
+
+    // Update atau buat aggregate
+    const existingStocks = await tx
+      .select()
+      .from(productStocks)
+      .where(
+        and(
+          eq(productStocks.productId, item.productId),
+          eq(productStocks.branchId, item.branchId),
+          eq(productStocks.uomId, item.uomId)
+        )
+      )
+      .limit(1)
+
+    if (existingStocks.length > 0) {
+      await tx
+        .update(productStocks)
+        .set({ qty: sql`${productStocks.qty} + ${delta.toString()}` })
+        .where(eq(productStocks.id, existingStocks[0].id))
+    } else {
+      await tx.insert(productStocks).values({
+        productId: item.productId,
+        branchId: item.branchId,
+        uomId: item.uomId,
+        qty: delta.toString(),
+      })
+    }
+  }
+
+  // Catat di stockAdjustments (immutable record)
+  await tx.insert(stockAdjustments).values({
+    productId: item.productId,
+    branchId: item.branchId,
+    adjustedById: item.adjustedById,
+    previousQty: item.previousQty,
+    newQty: item.newQty,
+    reason: item.reason,
+  })
+
+  // Catat di auditLogs (immutable audit trail per arsitektur)
+  await tx.insert(auditLogs).values({
+    branchId: item.branchId,
+    userId: item.adjustedById,
+    action: 'MANUAL_STOCK_ADJUSTMENT',
+    tableName: 'product_stocks',
+    oldData: JSON.stringify({ qty: item.previousQty }),
+    newData: JSON.stringify({ qty: item.newQty, reason: item.reason }),
+  })
+}
+
 interface SOItem {
   productId: number;
   branchId: number;
diff --git a/apps/backoffice/app/(dashboard)/layout.tsx b/apps/backoffice/app/(dashboard)/layout.tsx
index 32ad0dd..43ca96d 100644
--- a/apps/backoffice/app/(dashboard)/layout.tsx
+++ b/apps/backoffice/app/(dashboard)/layout.tsx
@@ -52,6 +52,13 @@ export default async function DashboardLayout({
             <span>📦</span>
             Laporan Nilai Stok
           </a>
+          <a
+            href="/inventory/stock-adjustment"
+            className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-primary transition-colors"
+          >
+            <span>🔧</span>
+            Penyesuaian Stok
+          </a>
         </nav>
       </aside>
```

### NEW FILES

**apps/backoffice/app/(dashboard)/inventory/stock-adjustment/page.tsx**
```tsx
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { getProductsWithStock, type ProductWithStock } from '@/lib/services/stock-service'
import AdjustmentForm from './_components/adjustment-form'

export default async function StockAdjustmentPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null

  let products: ProductWithStock[] = []
  let error: string | null = null

  try {
    if (payload) {
      products = await getProductsWithStock(payload.branchId)
    }
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

**apps/backoffice/app/(dashboard)/inventory/stock-adjustment/_components/adjustment-form.tsx**
```tsx
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

**apps/backoffice/app/api/bo/inventory/stock-adjustment/route.ts**
```ts
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
      const message = parsed.error.issues[0]?.message ?? 'Data tidak valid'
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

Output findings as a Markdown list. Each finding should have a clear title and explanation of the issue.
