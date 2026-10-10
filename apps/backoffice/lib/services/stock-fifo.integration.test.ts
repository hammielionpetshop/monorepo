import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import * as argon2 from 'argon2'
import { db, branches, unitsOfMeasure, products, productUomConversions, productUomCosts, productCostSyncs, productStocks, productStockBatches, stockShortfalls, stockShortfallClearings, roles, users, ownerAssignments, shifts, transactions, transactionItems, transactionPayments, auditLogs, suppliers, purchaseOrders, purchaseOrderItems, supplierPayables, interBranchTransfers, interBranchTransferItems, interBranchPayables, eq, sql } from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { performVoidWithinTx } from './void-service'
import { applySOStockAdjustment } from '../stock-adjustment'
import { applyPOReceivingBatches } from '../po-batch-updater'
vi.mock('@/lib/authz', () => ({ requirePermission: async () => ({ userId, branchId, branchScope: 'ALL' }), getAuth: async () => ({ userId, branchId, branchScope: 'ALL' }), hasPermission: () => true }))
import { POST as reverseReceiving } from '../../app/api/bo/purchase-orders/[id]/reverse-receiving/route'
import { PATCH as transferStatus } from '../../app/api/bo/internal-transfers/[id]/status/route'
import { PATCH as writeOffShortfall } from '../../app/api/bo/inventory/stock-shortfalls/[id]/write-off/route'
import { getStockOverviewReport, getStockOverviewDetail } from './report-service'
import { getOpenShortfalls } from './stock-shortfall-report'

const run = randomUUID().slice(0, 8)
let branchId: number
let destinationBranchId: number
let uomId: number
let otherUomId: number
let roleId: number
let userId: number
let shiftId: number
let supplierId: number
const poIds: number[] = []
const transferIds: number[] = []
const productIds: number[] = []

beforeAll(async () => {
  const [branch] = await db.insert(branches).values({ code: `FIFO${run}`, name: `Tes FIFO ${run}` }).returning()
  branchId = branch.id
  const [destination] = await db.insert(branches).values({ code: `DST${run}`, name: `Tujuan FIFO ${run}` }).returning()
  destinationBranchId = destination.id
  const [uom] = await db.insert(unitsOfMeasure).values({ code: run, name: 'Satuan tes FIFO', isBase: true }).returning()
  uomId = uom.id
  const [otherUom] = await db.insert(unitsOfMeasure).values({ code: `X${run}`, name: 'Dus tes FIFO' }).returning()
  otherUomId = otherUom.id
  const [role] = await db.insert(roles).values({ name: `FIFO${run}` }).returning()
  roleId = role.id
  const [user] = await db.insert(users).values({ name: `FIFO${run}`, roleId, branchId, pinHash: await argon2.hash('1234') }).returning()
  userId = user.id
  await db.insert(ownerAssignments).values({ userId, branchId })
  const [shift] = await db.insert(shifts).values({ branchId, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning()
  shiftId = shift.id
  const [supplier] = await db.insert(suppliers).values({ name: `FIFO ${run}` }).returning()
  supplierId = supplier.id
})

afterAll(async () => {
  if (branchId) {
    const shortfalls = await db.select().from(stockShortfalls).where(eq(stockShortfalls.branchId, branchId))
    for (const row of shortfalls) await db.delete(stockShortfallClearings).where(eq(stockShortfallClearings.shortfallId, row.id))
    await db.delete(stockShortfalls).where(eq(stockShortfalls.branchId, branchId))
    await db.delete(productCostSyncs).where(eq(productCostSyncs.branchId, branchId))
    await db.delete(productUomCosts).where(eq(productUomCosts.branchId, branchId))
    const trxs = await db.select().from(transactions).where(eq(transactions.branchId, branchId))
    for (const trx of trxs) {
      await db.delete(transactionPayments).where(eq(transactionPayments.transactionId, trx.id))
      await db.delete(transactionItems).where(eq(transactionItems.transactionId, trx.id))
    }
    await db.delete(transactions).where(eq(transactions.branchId, branchId))
    await db.delete(auditLogs).where(eq(auditLogs.branchId, branchId))
    await db.delete(productStockBatches).where(eq(productStockBatches.branchId, branchId))
    await db.delete(productStocks).where(eq(productStocks.branchId, branchId))
    await db.delete(productCostSyncs).where(eq(productCostSyncs.branchId, destinationBranchId))
    await db.delete(productUomCosts).where(eq(productUomCosts.branchId, destinationBranchId))
    await db.delete(auditLogs).where(eq(auditLogs.branchId, destinationBranchId))
    await db.delete(productStockBatches).where(eq(productStockBatches.branchId, destinationBranchId))
    await db.delete(productStocks).where(eq(productStocks.branchId, destinationBranchId))
    for (const id of transferIds) {
      await db.delete(interBranchPayables).where(eq(interBranchPayables.transferId, id))
      await db.delete(interBranchTransferItems).where(eq(interBranchTransferItems.transferId, id))
      await db.delete(interBranchTransfers).where(eq(interBranchTransfers.id, id))
    }
    for (const id of poIds) {
      await db.delete(supplierPayables).where(eq(supplierPayables.poId, id))
      await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.poId, id))
      await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id))
    }
  }
  for (const id of productIds) {
    await db.delete(productUomConversions).where(eq(productUomConversions.productId, id))
    await db.delete(products).where(eq(products.id, id))
  }
  if (shiftId) await db.delete(shifts).where(eq(shifts.id, shiftId))
  if (userId) {
    await db.delete(ownerAssignments).where(eq(ownerAssignments.userId, userId))
    await db.delete(users).where(eq(users.id, userId))
  }
  if (roleId) await db.delete(roles).where(eq(roles.id, roleId))
  if (supplierId) await db.delete(suppliers).where(eq(suppliers.id, supplierId))
  if (branchId) await db.delete(branches).where(eq(branches.id, branchId))
  if (destinationBranchId) await db.delete(branches).where(eq(branches.id, destinationBranchId))
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
  it('FIFO lintas satuan mengikuti tanggal, tie ID, modal aktual dan expiry pertama yang dipotong', async () => {
    const product = await fixture(0)
    await db.insert(productUomConversions).values({ productId: product.id, uomId: otherUomId, ratio: 4 })
    await db.transaction(async tx => {
      await StockService.addStock(tx, branchId, product.id, uomId, '2', '100', new Date('2026-05-02T00:00:00Z'))
      await StockService.addStock(tx, branchId, product.id, uomId, '3', '200', new Date('2026-05-01T00:00:00Z'), new Date('2027-05-01T00:00:00Z'))
      await StockService.addStock(tx, branchId, product.id, otherUomId, '1', '1200', new Date('2026-05-01T00:00:00Z'), new Date('2028-05-01T00:00:00Z'))
    })
    const batches = await db.select().from(productStockBatches).where(eq(productStockBatches.productId, product.id))
    const older = batches.find(batch => batch.costPrice === 200)!
    const tied = batches.find(batch => batch.costPrice === 300)!
    const result = await sell(product, 6)
    expect(result.deductions.map(deduction => deduction.batchId)).toEqual([older.id, tied.id])
    expect(result.totalCogs).toBe(1500)
    expect(result.firstExpiryDate).toEqual(new Date('2027-05-01T00:00:00Z'))
    await invariant(product.id, 3)
  })

  it('audit snapshot tidak fan-out dan menemukan batch/defisit tanpa agregat', async () => {
    const product = await fixture(6)
    await db.transaction(tx => StockService.addStock(tx, branchId, product.id, uomId, '4', '200'))
    await db.insert(stockShortfalls).values([1, 2].map(qty => ({ productId: product.id, branchId, qtyShort: qty, qtyRemaining: qty, costPricePerUnit: 100, sourceType: 'SALE' })))
    await db.delete(productStocks).where(eq(productStocks.productId, product.id))
    const script = readFileSync(new URL('../../../../docs/work/plans/sql/2026-10-03-stock-invariant-audit.sql', import.meta.url), 'utf8')
    const query = script.slice(script.indexOf('WITH\n'), script.lastIndexOf('ROLLBACK;')).trim()
    const audit = await db.transaction(async tx => {
      await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`)
      const rows = await tx.execute(sql.raw(query))
      return rows[0].jsonb_build_object as { read_only: string; isolation: string; findings: { category: string; detail: Record<string, unknown> }[] }
    })
    expect(audit.read_only).toBe('on')
    expect(audit.isolation).toBe('repeatable read')
    const finding = audit.findings.find(row => row.category === 'BALANCE_DRIFT' && row.detail.product_id === product.id && row.detail.branch_id === branchId)
    expect(finding?.detail).toMatchObject({ batch_qty: 10, active_deficit: 3, aggregate_qty: 0, expected_qty: 7, missing_aggregate: true })
    expect(finding?.detail.batch_ids).toHaveLength(2)
    expect(finding?.detail.shortfall_ids).toHaveLength(2)
    await expect(db.transaction(async tx => {
      await tx.execute(sql`SET TRANSACTION READ ONLY`)
      await tx.update(products).set({ defaultCostPrice: 999 }).where(eq(products.id, product.id))
    })).rejects.toMatchObject({ cause: { code: '25006' } })
    expect((await db.select().from(products).where(eq(products.id, product.id)))[0].defaultCostPrice).toBe(200)
  })
  it('write-off residual 3 tetap mengurangi saldo, tampil di laporan, dan recount menutup tanpa menghapus histori', async () => {
    const product = await fixture(0)
    await sell(product, 5)
    await db.transaction(tx => StockService.addStock(tx, branchId, product.id, uomId, '2', '100', undefined, undefined, { settleShortfalls: true }))
    await invariant(product.id, -3)
    const [shortfall] = await db.select().from(stockShortfalls).where(eq(stockShortfalls.productId, product.id))
    const response = await writeOffShortfall(new NextRequest('http://localhost', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'Hasil audit fixture lokal' }) }), { params: Promise.resolve({ id: String(shortfall.id) }) })
    expect(response.status).toBe(200)
    await invariant(product.id, -3)
    const [writtenOff] = await db.select().from(stockShortfalls).where(eq(stockShortfalls.id, shortfall.id))
    expect(writtenOff.qtyRemaining).toBe(3)
    expect(writtenOff.writtenOffAt).not.toBeNull()
    expect((await getOpenShortfalls({ branchId })).some(row => row.id === shortfall.id)).toBe(false)
    const overview = await getStockOverviewReport({ branchId })
    expect(overview.items.find(row => row.productId === product.id)).toMatchObject({ shortfallQty: '3', activeShortfallQty: '0', writtenOffQty: '3', totalQty: '0' })
    expect((await getStockOverviewDetail(product.id, branchId))?.branches[0]).toMatchObject({ shortfallQty: '3', writtenOffQty: '3' })
    // Supplier does not settle a written-off debt; it remains until physical recount.
    await db.transaction(tx => StockService.addStock(tx, branchId, product.id, uomId, '4', '100', undefined, undefined, { settleShortfalls: true }))
    await invariant(product.id, 1)
    await db.transaction(tx => applySOStockAdjustment(tx, { branchId, productId: product.id, uomId, physicalQty: 2, systemQty: 1, currentUserId: userId, soId: undefined }))
    await invariant(product.id, 2)
    const [closed] = await db.select().from(stockShortfalls).where(eq(stockShortfalls.id, shortfall.id))
    expect(closed.qtyRemaining).toBe(0)
    expect(closed.closedAt).not.toBeNull()
    expect(closed.writtenOffAt).toEqual(writtenOff.writtenOffAt)
  })

  it('write-off konkuren dengan supplier dan opname tidak membuat drift atau clearing ganda', async () => {
    for (const receiving of [true, false]) {
      const product = await fixture(0)
      await sell(product, 3)
      const [shortfall] = await db.select().from(stockShortfalls).where(eq(stockShortfalls.productId, product.id))
      await contend(product.id, [
        async () => {
          const response = await writeOffShortfall(new NextRequest('http://localhost', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'Audit fixture' }) }), { params: Promise.resolve({ id: String(shortfall.id) }) })
          expect([200, 409]).toContain(response.status)
        },
        () => db.transaction(tx => receiving
          ? StockService.addStock(tx, branchId, product.id, uomId, '5', '100', undefined, undefined, { settleShortfalls: true })
          : applySOStockAdjustment(tx, { branchId, productId: product.id, uomId, physicalQty: 2, systemQty: -3, currentUserId: userId })),
      ])
      await invariant(product.id, 2)
    }
  })

  it('write-off lama ditutup recount dan write-off ganda hanya mencatat satu audit', async () => {
    const product = await fixture(0)
    await sell(product, 3)
    const [shortfall] = await db.select().from(stockShortfalls).where(eq(stockShortfalls.productId, product.id))
    const writeOff = () => writeOffShortfall(new NextRequest('http://localhost', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'Audit fixture' }) }), { params: Promise.resolve({ id: String(shortfall.id) }) })
    const statuses: number[] = []
    await contend(product.id, [async () => { statuses.push((await writeOff()).status) }, async () => { statuses.push((await writeOff()).status) }])
    expect(statuses.sort()).toEqual([200, 409])
    const legacyDate = new Date('2025-01-01T00:00:00Z')
    await db.update(stockShortfalls).set({ writtenOffAt: legacyDate }).where(eq(stockShortfalls.id, shortfall.id))
    await db.transaction(tx => applySOStockAdjustment(tx, { branchId, productId: product.id, uomId, physicalQty: 0, systemQty: -3, currentUserId: userId }))
    await invariant(product.id, 0)
    const [closed] = await db.select().from(stockShortfalls).where(eq(stockShortfalls.id, shortfall.id))
    expect(closed.writtenOffAt).toEqual(legacyDate)
    const logs = await db.execute(sql`SELECT COUNT(*) count FROM petshop.audit_logs WHERE branch_id = ${branchId} AND action = 'STOCK_SHORTFALL_WRITE_OFF' AND record_id = ${String(shortfall.id)}`)
    expect(Number(logs[0].count)).toBe(1)
  })
  it('bypass transfer mengurangi penuh, menerima harga transfer, lalu supplier melunasi defisit', async () => {
    const product = await fixture(2)
    const expiry = new Date('2027-01-20T00:00:00Z')
    await db.update(productStockBatches).set({ expiryDate: expiry }).where(eq(productStockBatches.productId, product.id))
    const [transfer] = await db.insert(interBranchTransfers).values({ ibtNumber: `FIFO-${randomUUID()}`, sourceBranchId: branchId, destinationBranchId, requestedById: userId, status: 'PREPARING' }).returning()
    transferIds.push(transfer.id)
    const [item] = await db.insert(interBranchTransferItems).values({ transferId: transfer.id, productId: product.id, uomId, qtyRequested: 5, costPriceAtTransfer: 300 }).returning()
    const request = (action: string, pin?: string) => new NextRequest('http://localhost', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ownerPin: pin, items: [{ itemId: item.id, qty: 5 }] }) })
    expect((await transferStatus(request('ship', '1234'), { params: Promise.resolve({ id: String(transfer.id) }) })).status).toBe(200)
    await invariant(product.id, -3)
    const [deficit] = await db.select().from(stockShortfalls).where(eq(stockShortfalls.sourceTransferItemId, item.id))
    expect(deficit).toMatchObject({ qtyRemaining: 3, sourceType: 'TRANSFER', sourceTransferId: transfer.id })
    const [shipped] = await db.select().from(interBranchTransferItems).where(eq(interBranchTransferItems.id, item.id))
    expect(shipped.expiryDate).toBe('2027-01-20')
    expect((await transferStatus(request('receive'), { params: Promise.resolve({ id: String(transfer.id) }) })).status).toBe(200)
    const [receivedBatch] = await db.select().from(productStockBatches).where(eq(productStockBatches.branchId, destinationBranchId))
    expect(receivedBatch).toMatchObject({ qtyRemaining: 5, costPrice: 300 })
    expect(receivedBatch.expiryDate?.toISOString()).toBe(expiry.toISOString())
    await invariant(product.id, -3)
    await db.transaction(tx => StockService.addStock(tx, branchId, product.id, uomId, '4', '100', undefined, undefined, { settleShortfalls: true }))
    await invariant(product.id, 1)
    const [settled] = await db.select().from(stockShortfalls).where(eq(stockShortfalls.id, deficit.id))
    expect(settled.qtyRemaining).toBe(0)
  })

  it('dua ship identik yang menunggu header hanya memotong FIFO sekali', async () => {
    const product = await fixture(10)
    const [transfer] = await db.insert(interBranchTransfers).values({ ibtNumber: `FIFO-${randomUUID()}`, sourceBranchId: branchId, destinationBranchId, requestedById: userId, status: 'PREPARING' }).returning()
    transferIds.push(transfer.id)
    const [item] = await db.insert(interBranchTransferItems).values({ transferId: transfer.id, productId: product.id, uomId, qtyRequested: 3, costPriceAtTransfer: 300 }).returning()
    let release!: () => void
    let signal!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const acquired = new Promise<void>(resolve => { signal = resolve })
    const blocker = db.transaction(async tx => { await tx.select().from(interBranchTransfers).where(eq(interBranchTransfers.id, transfer.id)).for('update'); signal(); await gate })
    await acquired
    const ship = () => transferStatus(new NextRequest('http://localhost', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'ship', items: [{ itemId: item.id, qty: 3 }] }) }), { params: Promise.resolve({ id: String(transfer.id) }) })
    const pending = Promise.all([ship(), ship()])
    try {
      let waiting = 0
      const deadline = Date.now() + 5000
      while (Date.now() < deadline) {
        const rows = await db.execute(sql`SELECT COUNT(*) AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%inter_branch_transfers%'`)
        waiting = Number(rows[0].count)
        if (waiting === 2) break
      }
      expect(waiting).toBe(2)
    } finally { release(); await blocker }
    const responses = await pending
    expect(responses.map(response => response.status).sort()).toEqual([200, 409])
    await invariant(product.id, 7)
  })

  it('transfer manual 3 PCS memotong batch berlabel DUS dalam qty base', async () => {
    const product = await fixture(10)
    await db.insert(productUomConversions).values({ productId: product.id, uomId: otherUomId, ratio: 10 })
    await db.update(productStockBatches).set({ uomId: otherUomId }).where(eq(productStockBatches.productId, product.id))
    const [transfer] = await db.insert(interBranchTransfers).values({ ibtNumber: `FIFO-${randomUUID()}`, sourceBranchId: branchId, destinationBranchId, requestedById: userId, status: 'PREPARING' }).returning()
    transferIds.push(transfer.id)
    const [item] = await db.insert(interBranchTransferItems).values({ transferId: transfer.id, productId: product.id, uomId, qtyRequested: 3, costPriceAtTransfer: 300 }).returning()
    const response = await transferStatus(new NextRequest('http://localhost', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'ship', items: [{ itemId: item.id, qty: 3 }] }) }), { params: Promise.resolve({ id: String(transfer.id) }) })
    expect(response.status).toBe(200)
    await invariant(product.id, 7)
  })
  it('dua approval PO konkuren hanya membuat satu batch dan satu payable', async () => {
    const product = await fixture(0)
    const [po] = await db.insert(purchaseOrders).values({ poNumber: `FIFO-${randomUUID()}`, branchId, supplierId, totalAmount: 200, createdById: userId, status: 'PARTIALLY_RECEIVED' }).returning()
    poIds.push(po.id)
    await db.insert(purchaseOrderItems).values({ poId: po.id, productId: product.id, uomId, qtyOrdered: 2, qtyReceived: 2, unitCost: 100 })
    let release!: () => void
    let signal!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const locked = new Promise<void>(resolve => { signal = resolve })
    const blocker = db.transaction(async tx => {
      await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, po.id)).for('update')
      signal(); await gate
    })
    await locked
    const approvals = Promise.allSettled([applyPOReceivingBatches(db, po.id, userId), applyPOReceivingBatches(db, po.id, userId)])
    try {
      let waiting = 0
      const deadline = Date.now() + 5000
      while (Date.now() < deadline) {
        const rows = await db.execute(sql`SELECT COUNT(*) AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%purchase_orders%'`)
        waiting = Number(rows[0].count)
        if (waiting === 2) break
      }
      expect(waiting).toBe(2)
    } finally { release(); await blocker }
    const results = await approvals
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    await invariant(product.id, 2)
    expect(await db.select().from(productStockBatches).where(eq(productStockBatches.purchaseOrderId, po.id))).toHaveLength(1)
    expect(await db.select().from(supplierPayables).where(eq(supplierPayables.poId, po.id))).toHaveLength(1)
    await expect(applyPOReceivingBatches(db, po.id, userId)).rejects.toThrow('sudah disetujui')
    await invariant(product.id, 2)
    const reversed = await reverseReceiving(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ pin: '1234', reason: 'Tes reversal PO' }) }), { params: Promise.resolve({ id: String(po.id) }) })
    expect(reversed.status).toBe(200)
    await invariant(product.id, 0)
    expect(await db.select().from(supplierPayables).where(eq(supplierPayables.poId, po.id))).toHaveLength(0)
    await applyPOReceivingBatches(db, po.id, userId)
    await invariant(product.id, 2)
    expect(await db.select().from(supplierPayables).where(eq(supplierPayables.poId, po.id))).toHaveLength(1)
  })

  it('kegagalan item PO kedua rollback batch, cost sync, payable dan status', async () => {
    const first = await fixture(0)
    const second = await fixture(0)
    const [po] = await db.insert(purchaseOrders).values({ poNumber: `FIFO-${randomUUID()}`, branchId, supplierId, totalAmount: 400, createdById: userId, status: 'PARTIALLY_RECEIVED' }).returning()
    poIds.push(po.id)
    await db.insert(purchaseOrderItems).values([
      { poId: po.id, productId: first.id, uomId, qtyOrdered: 2, qtyReceived: 2, unitCost: 100 },
      { poId: po.id, productId: second.id, uomId: otherUomId, qtyOrdered: 2, qtyReceived: 2, unitCost: 100 },
    ])
    await expect(applyPOReceivingBatches(db, po.id, userId)).rejects.toThrow('Konversi')
    await invariant(first.id, 0)
    expect(await db.select().from(productCostSyncs).where(eq(productCostSyncs.productId, first.id))).toHaveLength(0)
    expect(await db.select().from(productUomCosts).where(eq(productUomCosts.productId, first.id))).toHaveLength(0)
    expect(await db.select().from(supplierPayables).where(eq(supplierPayables.poId, po.id))).toHaveLength(0)
    expect((await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, po.id)))[0].status).toBe('PARTIALLY_RECEIVED')
  })
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

  it('void nota yang digantikan nota pengganti melunasi defisit pengganti (kasus Beauty Premium)', async () => {
    const product = await fixture(60)
    const original = await checkout(product.id, [60])
    const replacement = await checkout(product.id, [40])
    await invariant(product.id, -40)
    await db.transaction(tx => performVoidWithinTx(tx, {
      txId: original.id, branchId, trxNumber: original.trxNumber, actorUserId: userId,
    }))
    const state = await invariant(product.id, 20)
    expect(Number(state.batch)).toBe(20)
    expect(Number(state.deficit)).toBe(0)
    const [shortfall] = await db.select().from(stockShortfalls).where(eq(stockShortfalls.productId, product.id))
    const clearings = await db.select().from(stockShortfallClearings).where(eq(stockShortfallClearings.shortfallId, shortfall.id))
    expect(clearings).toHaveLength(1)
    expect(clearings[0]).toMatchObject({ qtyCleared: 40, referenceType: 'VOID_REVERSAL', referenceId: original.id })
    const [replacementItem] = await db.select().from(transactionItems).where(eq(transactionItems.transactionId, replacement.id))
    expect(replacementItem.cogs).toBe(40 * 100)
  })

  it('void yang mengembalikan lebih sedikit dari defisit menyisakan defisit tanpa batch', async () => {
    const product = await fixture(20)
    const original = await checkout(product.id, [20])
    await checkout(product.id, [40])
    await db.transaction(tx => performVoidWithinTx(tx, {
      txId: original.id, branchId, trxNumber: original.trxNumber, actorUserId: userId,
    }))
    const state = await invariant(product.id, -20)
    expect(Number(state.batch)).toBe(0)
    expect(Number(state.deficit)).toBe(20)
  })

  it('void nota yang dulu oversell melunasi defisitnya sendiri, bukan menambah batch hantu', async () => {
    const product = await fixture(10)
    const original = await checkout(product.id, [30])
    await invariant(product.id, -20)
    await db.transaction(tx => performVoidWithinTx(tx, {
      txId: original.id, branchId, trxNumber: original.trxNumber, actorUserId: userId,
    }))
    const state = await invariant(product.id, 10)
    expect(Number(state.batch)).toBe(10)
    expect(Number(state.deficit)).toBe(0)
  })

  it('void tanpa defisit terbuka tetap mengembalikan seluruh qty ke batch', async () => {
    const product = await fixture(10)
    const original = await checkout(product.id, [4])
    await db.transaction(tx => performVoidWithinTx(tx, {
      txId: original.id, branchId, trxNumber: original.trxNumber, actorUserId: userId,
    }))
    const state = await invariant(product.id, 10)
    expect(Number(state.batch)).toBe(10)
    expect(await db.select().from(stockShortfalls).where(eq(stockShortfalls.productId, product.id))).toHaveLength(0)
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
