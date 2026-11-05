import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { db, branches, unitsOfMeasure, products, productStocks, productStockBatches, stockShortfalls, stockShortfallClearings, eq, and, sql } from '../db'
import { StockService } from './stock-service'

// Migrasi 0051: utang stok terbuka s.d. 31 Okt dibersihkan tanpa mengubah stok kasir —
// bagian yang tertutup batch dilunasi (batch berkurang), sisanya write-off; utang November tidak disentuh.
const migration = readFileSync(
  fileURLToPath(new URL('../../../../packages/db/src/migrations/0051_bersihkan_utang_stok_oktober.sql', import.meta.url)),
  'utf8',
)
const run = randomUUID().slice(0, 8)
let branchId: number
let uomId: number

async function productWithDebt(stockIn: number, sold: number, createdAt: Date) {
  const [product] = await db.insert(products).values({ name: `BRS ${run}`, baseUomId: uomId, defaultCostPrice: 100 }).returning()
  await db.transaction(async tx => {
    const result = await StockService.deductStock(tx, branchId, product.id, uomId, sold, true)
    await tx.insert(stockShortfalls).values({
      productId: product.id, branchId, qtyShort: result.shortfallQty, qtyRemaining: result.shortfallQty,
      costPricePerUnit: 100, sourceType: 'SALE', createdAt,
    })
  })
  // Barang masuk sesudahnya tanpa melunasi utang (perilaku kiriman lama) → batch "hantu".
  if (stockIn > 0) await db.transaction(tx => StockService.addStock(tx, branchId, product.id, uomId, String(stockIn), '300'))
  return product.id
}

async function state(productId: number) {
  const [agg] = await db.select({ qty: productStocks.qty }).from(productStocks)
    .where(and(eq(productStocks.productId, productId), eq(productStocks.branchId, branchId)))
  const [batch] = await db.select({ qty: sql<number>`COALESCE(SUM(${productStockBatches.qtyRemaining}), 0)::int` })
    .from(productStockBatches).where(and(eq(productStockBatches.productId, productId), eq(productStockBatches.branchId, branchId)))
  const [debt] = await db.select().from(stockShortfalls).where(eq(stockShortfalls.productId, productId))
  return { agg: agg.qty, batch: batch.qty, debt }
}

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `BRS${run}`, name: `Toko Bersih ${run}` }).returning())[0].id
  uomId = (await db.insert(unitsOfMeasure).values({ code: `R${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
})

describe('migrasi 0051 bersihkan utang stok Oktober (DB lokal)', () => {
  it('lunas lewat batch, write-off sisa, November tetap terbuka, stok kasir tidak berubah', async () => {
    const october = new Date('2026-10-20T03:00:00Z')
    const covered = await productWithDebt(5, 2, october) // stok 3, batch 5, utang 2
    const partial = await productWithDebt(1, 4, october) // stok −3, batch 1, utang 4
    const november = await productWithDebt(5, 2, new Date('2026-11-02T03:00:00Z'))
    const before = await Promise.all([covered, partial, november].map(state))

    await db.execute(sql.raw(migration))

    const [c, p, n] = await Promise.all([covered, partial, november].map(state))
    expect([c.agg, p.agg, n.agg]).toEqual(before.map(s => s.agg))

    expect(c.debt).toMatchObject({ qtyRemaining: 0, writtenOffAt: null })
    expect(c.debt.closedAt).not.toBeNull()
    expect(c.batch).toBe(3)
    const [clearing] = await db.select().from(stockShortfallClearings).where(eq(stockShortfallClearings.shortfallId, c.debt.id))
    expect(clearing).toMatchObject({ qtyCleared: 2, referenceType: 'CLEANUP', costPriceAtClearing: 300 })

    expect(p.debt.qtyRemaining).toBe(3)
    expect(p.debt.writtenOffAt).not.toBeNull()
    expect(p.debt.writeOffReason).toContain('Pembersihan utang stok')
    expect(p.batch).toBe(0)

    expect(n.debt).toMatchObject({ qtyRemaining: 2, closedAt: null, writtenOffAt: null })
    expect(n.batch).toBe(5)

    // Invarian stok tetap: qty = batch − utang belum lunas (write-off masih dihitung).
    expect(c.agg).toBe(c.batch - 0)
    expect(p.agg).toBe(p.batch - p.debt.qtyRemaining)
  })

  it('dijalankan ulang tidak mengubah apa pun', async () => {
    const before = await db.select({ n: sql<number>`COUNT(*)::int` }).from(stockShortfallClearings)
    await db.execute(sql.raw(migration))
    const after = await db.select({ n: sql<number>`COUNT(*)::int` }).from(stockShortfallClearings)
    expect(after[0].n).toBe(before[0].n)
  })
})
