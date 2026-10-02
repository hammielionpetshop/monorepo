import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, branches, unitsOfMeasure, products, productUomConversions, productStocks, productStockBatches, stockShortfalls, stockShortfallClearings, roles, users, shifts, transactions, transactionItems, transactionPayments, auditLogs, eq, sql } from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { performVoidWithinTx } from './void-service'
import { applySOStockAdjustment } from '../stock-adjustment'

const run = randomUUID().slice(0, 8)
let branchId: number
let uomId: number
let otherUomId: number
let roleId: number
let userId: number
let shiftId: number
const productIds: number[] = []

beforeAll(async () => {
  const [branch] = await db.insert(branches).values({ code: `FIFO${run}`, name: `Tes FIFO ${run}` }).returning()
  branchId = branch.id
  const [uom] = await db.insert(unitsOfMeasure).values({ code: run, name: 'Satuan tes FIFO', isBase: true }).returning()
  uomId = uom.id
  const [otherUom] = await db.insert(unitsOfMeasure).values({ code: `X${run}`, name: 'Dus tes FIFO' }).returning()
  otherUomId = otherUom.id
  const [role] = await db.insert(roles).values({ name: `FIFO${run}` }).returning()
  roleId = role.id
  const [user] = await db.insert(users).values({ name: `FIFO${run}`, roleId, branchId }).returning()
  userId = user.id
  const [shift] = await db.insert(shifts).values({ branchId, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning()
  shiftId = shift.id
})

afterAll(async () => {
  if (branchId) {
    const shortfalls = await db.select().from(stockShortfalls).where(eq(stockShortfalls.branchId, branchId))
    for (const row of shortfalls) await db.delete(stockShortfallClearings).where(eq(stockShortfallClearings.shortfallId, row.id))
    await db.delete(stockShortfalls).where(eq(stockShortfalls.branchId, branchId))
    const trxs = await db.select().from(transactions).where(eq(transactions.branchId, branchId))
    for (const trx of trxs) {
      await db.delete(transactionPayments).where(eq(transactionPayments.transactionId, trx.id))
      await db.delete(transactionItems).where(eq(transactionItems.transactionId, trx.id))
    }
    await db.delete(transactions).where(eq(transactions.branchId, branchId))
    await db.delete(auditLogs).where(eq(auditLogs.branchId, branchId))
    await db.delete(productStockBatches).where(eq(productStockBatches.branchId, branchId))
    await db.delete(productStocks).where(eq(productStocks.branchId, branchId))
  }
  for (const id of productIds) {
    await db.delete(productUomConversions).where(eq(productUomConversions.productId, id))
    await db.delete(products).where(eq(products.id, id))
  }
  if (shiftId) await db.delete(shifts).where(eq(shifts.id, shiftId))
  if (userId) await db.delete(users).where(eq(users.id, userId))
  if (roleId) await db.delete(roles).where(eq(roles.id, roleId))
  if (branchId) await db.delete(branches).where(eq(branches.id, branchId))
  if (uomId) await db.delete(unitsOfMeasure).where(eq(unitsOfMeasure.id, uomId))
  if (otherUomId) await db.delete(unitsOfMeasure).where(eq(unitsOfMeasure.id, otherUomId))
  await db.$client.end()
})

async function fixture(qty: number) {
  const [product] = await db.insert(products).values({ name: `FIFO ${run}`, baseUomId: uomId, defaultCostPrice: 200 }).returning()
  productIds.push(product.id)
  if (qty > 0) await db.transaction(tx => StockService.addStock(tx, branchId, product.id, uomId, String(qty), '100'))
  return product
}

function checkout(productId: number, quantities: number[]) {
  return TransactionService.createTransaction({ branchId, cashierId: userId, shiftId, localTrxNumber: `FIFO-${randomUUID()}`,
    items: quantities.map(qty => ({ productId, uomId, qty, unitPrice: 0, subtotal: 0, discountAmount: 0, priceTier: 'RETAIL' })),
    payments: [], totals: { subtotal: 0, discountTotal: 0, grandTotal: 0 }, amountPaid: 0, change: 0,
  })
}

async function contend(productId: number, operations: (() => Promise<unknown>)[]) {
  let unlock!: () => void
  let held!: () => void
  const release = new Promise<void>(resolve => { unlock = resolve })
  const acquired = new Promise<void>(resolve => { held = resolve })
  const blocker = db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('stock:' || ${branchId} || ':' || ${productId}))`)
    held()
    await release
  })
  await acquired
  const pending = Promise.allSettled(operations.map(operation => operation()))
  try {
    const deadline = Date.now() + 5000
    let waiting = 0
    while (Date.now() < deadline) {
      const rows = await db.execute(sql`SELECT COUNT(*) AS count FROM pg_locks WHERE locktype = 'advisory' AND NOT granted
        AND objid::bigint = (hashtext('stock:' || ${branchId} || ':' || ${productId})::bigint & 4294967295)`)
      waiting = Number(rows[0].count)
      if (waiting === operations.length) break
    }
    expect(waiting).toBe(operations.length)
  } finally {
    unlock()
    await blocker
  }
  const results = await pending
  for (const result of results) if (result.status === 'rejected') throw result.reason
}

async function invariant(productId: number, expected: number) {
  const rows = await db.execute(sql`
    SELECT
      (SELECT COALESCE(SUM(qty_remaining), 0) FROM petshop.product_stock_batches WHERE product_id = ${productId} AND branch_id = ${branchId}) AS batch,
      (SELECT COALESCE(SUM(qty_remaining), 0) FROM petshop.stock_shortfalls WHERE product_id = ${productId} AND branch_id = ${branchId} AND closed_at IS NULL) AS deficit,
      (SELECT COALESCE(SUM(qty), 0) FROM petshop.product_stocks WHERE product_id = ${productId} AND branch_id = ${branchId}) AS aggregate,
      (SELECT COUNT(*) FROM petshop.product_stock_batches WHERE product_id = ${productId} AND branch_id = ${branchId} AND qty_remaining < 0) AS negative
  `)
  expect(Number(rows[0].aggregate)).toBe(expected)
  expect(Number(rows[0].aggregate)).toBe(Number(rows[0].batch) - Number(rows[0].deficit))
  expect(Number(rows[0].negative)).toBe(0)
  return rows[0]
}

async function sell(product: typeof products.$inferSelect, qty: number, stale?: unknown) {
  return db.transaction(async tx => {
    const result = await StockService.deductStock(tx, branchId, product.id, uomId, qty, true, stale as any)
    if (result.shortfallQty > 0) await tx.insert(stockShortfalls).values({
      productId: product.id, branchId, qtyShort: result.shortfallQty, qtyRemaining: result.shortfallQty,
      costPricePerUnit: result.shortfallCostPricePerUnit ?? 0, sourceType: 'SALE',
    })
    return result
  })
}

describe('FIFO PostgreSQL lokal', () => {
  it('mengabaikan cache batch 10 saat saldo aktual 4, jual 8 menyisakan defisit 4', async () => {
    const product = await fixture(4)
    const [batch] = await db.select().from(productStockBatches).where(eq(productStockBatches.productId, product.id))
    const result = await sell(product, 8, { product, ratio: 1, batches: [{ ...batch, qtyRemaining: 10 }] })
    expect(result.shortfallQty).toBe(4)
    expect(result.totalCogs).toBe(4 * 100 + 4 * 200)
    const state = await invariant(product.id, -4)
    expect(Number(state.batch)).toBe(0)
    expect(Number(state.deficit)).toBe(4)
  })

  it.each([0, -1])('memaksa rasio base 1 walaupun metadata cache memakai %s', async ratio => {
    const product = await fixture(1)
    await expect(sell(product, 1, { product, ratio, uomCosts: [] })).resolves.toMatchObject({ shortfallQty: 0 })
    // Rasio base selalu 1, termasuk metadata cache yang rusak.
    await invariant(product.id, 0)
  })

  it('dua checkout 6 dan 8 pada stok 10 menghasilkan defisit 4', async () => {
    const product = await fixture(10)
    await contend(product.id, [() => checkout(product.id, [6]), () => checkout(product.id, [8])])
    const state = await invariant(product.id, -4)
    expect(Number(state.deficit)).toBe(4)
    const items = await db.select().from(transactionItems).where(eq(transactionItems.productId, product.id))
    expect(items.reduce((sum, item) => sum + (item.cogs ?? 0), 0)).toBe(1800)
  })

  it('dua checkout produk tanpa stok membuat satu agregat dan defisit penuh', async () => {
    const product = await fixture(0)
    await contend(product.id, [() => checkout(product.id, [6]), () => checkout(product.id, [8])])
    await invariant(product.id, -14)
    expect(await db.select().from(productStocks).where(eq(productStocks.productId, product.id))).toHaveLength(1)
  })

  it('dua item produk sama membaca sisa batch hasil item sebelumnya', async () => {
    const product = await fixture(10)
    await checkout(product.id, [6, 8])
    await invariant(product.id, -4)
  })

  it('checkout versus penerimaan supplier menjaga batch dan pelunasan shortfall', async () => {
    const product = await fixture(10)
    await contend(product.id, [() => checkout(product.id, [12]), () => db.transaction(tx => StockService.addStock(tx, branchId, product.id, uomId, '5', '150', undefined, undefined, { settleShortfalls: true }))])
    await invariant(product.id, 3)
  })

  it('checkout versus void memakai urutan lock yang sama tanpa drift', async () => {
    const product = await fixture(10)
    const trx = await checkout(product.id, [2])
    await contend(product.id, [() => checkout(product.id, [4]), () => db.transaction(tx => performVoidWithinTx(tx, {
      txId: trx.id, branchId, trxNumber: trx.trxNumber, actorUserId: userId,
    }))])
    await invariant(product.id, 6)
  })

  it('checkout versus opname selesai tanpa drift', async () => {
    const product = await fixture(10)
    await contend(product.id, [() => checkout(product.id, [4]), () => db.transaction(tx => applySOStockAdjustment(tx, {
      productId: product.id, branchId, uomId, systemQty: 10, physicalQty: 12,
    }))])
    await invariant(product.id, 8)
  })

  it('konversi hilang atau nonpositif dan qty pecahan membatalkan seluruh checkout', async () => {
    const product = await fixture(10)
    for (const ratio of [undefined, 0, -1]) {
      if (ratio !== undefined) await db.insert(productUomConversions).values({ productId: product.id, uomId: otherUomId, ratio })
      await expect(db.transaction(tx => StockService.addStock(tx, branchId, product.id, otherUomId, '2', '100'))).rejects.toThrow('Konversi')
      await db.delete(productUomConversions).where(eq(productUomConversions.productId, product.id))
      await invariant(product.id, 10)
    }
    await expect(checkout(product.id, [2, 0.5])).rejects.toThrow('bilangan bulat')
    await invariant(product.id, 10)
    expect(await db.select().from(transactionItems).where(eq(transactionItems.productId, product.id))).toHaveLength(0)
  })
})
