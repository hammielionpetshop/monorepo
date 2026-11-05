import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productStocks, productStockBatches, suppliers, roles, users,
  purchaseOrders, purchaseOrderItems, poReceivingLogs, poReceivingItems, supplierPayables, supplierReturns,
  auditLogs, eq, and, sql,
} from '../db'
import { applyPOReceivingBatches } from '../po-batch-updater'
import { StockService } from './stock-service'
import { buildStockLedgerQuery } from './stock-ledger'
import {
  PoCancelError,
  cancelCompletedPurchaseOrder,
  cancelOpenPurchaseOrder,
  checkCompletedCancellation,
} from './po-cancel-service'

// Batalkan PO di DB lokal: PO belum menyentuh stok cukup ganti status; PO Selesai menarik stok
// dari batch miliknya sendiri, hutang Dihapus, dan ditolak bila sudah dibayar/diretur/terpakai.
const run = randomUUID().slice(0, 8)
let branchId: number
let userId: number
let supplierId: number
let pcs: number
let productId: number
let seq = 0

async function stockQty() {
  const [row] = await db.select({ qty: productStocks.qty }).from(productStocks)
    .where(and(eq(productStocks.productId, productId), eq(productStocks.branchId, branchId), eq(productStocks.uomId, pcs)))
  return row?.qty ?? 0
}
async function poStatus(poId: number) {
  const [row] = await db.select({ status: purchaseOrders.status }).from(purchaseOrders).where(eq(purchaseOrders.id, poId))
  return row.status
}

/** PO dengan 1 barang yang sudah diinput terima (belum disetujui). */
async function receivedPo(qty: number) {
  seq += 1
  const [po] = await db.insert(purchaseOrders).values({
    poNumber: `PO-BTL-${run}-${seq}`, branchId, supplierId, status: 'PARTIALLY_RECEIVED', totalAmount: qty * 1_000, createdById: userId,
  }).returning()
  const [item] = await db.insert(purchaseOrderItems).values({
    poId: po.id, productId, uomId: pcs, qtyOrdered: qty, qtyReceived: qty, unitCost: 1_000, invoiceUnitCost: 1_000,
  }).returning()
  const [log] = await db.insert(poReceivingLogs).values({ poId: po.id, receivedById: userId }).returning()
  await db.insert(poReceivingItems).values({ logId: log.id, poItemId: item.id, qtyReceived: qty, qtyDamaged: 0 })
  return po.id
}
async function completedPo(qty: number) {
  const poId = await receivedPo(qty)
  await applyPOReceivingBatches(db, poId, userId)
  return poId
}
const cancelCompleted = (poId: number) =>
  db.transaction(tx => cancelCompletedPurchaseOrder(tx, { poId, actorUserId: userId, reason: 'tes: salah input', scopeBranchId: null }))

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `BTL${run}`, name: `Gudang Batal ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `BTL${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `BTL${run}`, roleId, branchId }).returning())[0].id
  supplierId = (await db.insert(suppliers).values({ name: `Supplier Batal ${run}`, paymentTermDays: 30 }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `B${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  productId = (await db.insert(products).values({ name: `Barang Batal ${run}`, baseUomId: pcs, defaultCostPrice: 1_000 }).returning())[0].id
})

describe('Batalkan PO (DB lokal)', () => {
  it('PO Disetujui dibatalkan tanpa menyentuh stok', async () => {
    const [po] = await db.insert(purchaseOrders).values({
      poNumber: `PO-BTL-${run}-A`, branchId, supplierId, status: 'APPROVED', totalAmount: 0, createdById: userId,
    }).returning()
    await db.transaction(tx => cancelOpenPurchaseOrder(tx, { poId: po.id, actorUserId: userId, reason: 'tes: PO dobel', scopeBranchId: null }))
    expect(await poStatus(po.id)).toBe('CANCELLED')
    expect(await stockQty()).toBe(0)
    const [audit] = await db.select().from(auditLogs).where(and(eq(auditLogs.action, 'PO_CANCELLED'), eq(auditLogs.recordId, String(po.id))))
    expect(JSON.parse(audit.newData!).reason).toBe('tes: PO dobel')
  })

  it('PO Diterima (belum disetujui) dibatalkan: input penerimaan ikut bersih', async () => {
    const poId = await receivedPo(4)
    await db.transaction(tx => cancelOpenPurchaseOrder(tx, { poId, actorUserId: userId, reason: 'tes: salah supplier', scopeBranchId: null }))
    expect(await poStatus(poId)).toBe('CANCELLED')
    expect(await db.select().from(poReceivingLogs).where(eq(poReceivingLogs.poId, poId))).toHaveLength(0)
    const [item] = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, poId))
    expect(item.qtyReceived).toBe(0)
  })

  it('jalur PO belum-stok menolak PO Selesai; PO lain cabang ditolak bila cabang dibatasi', async () => {
    const poId = await completedPo(1)
    await expect(db.transaction(tx => cancelOpenPurchaseOrder(tx, { poId, actorUserId: userId, reason: 'tes: salah', scopeBranchId: null })))
      .rejects.toBeInstanceOf(PoCancelError)
    await expect(db.transaction(tx => cancelCompletedPurchaseOrder(tx, { poId, actorUserId: userId, reason: 'tes: salah', scopeBranchId: branchId + 100_000 })))
      .rejects.toThrow('tidak ditemukan')
    await cancelCompleted(poId)
  })

  it('PO Selesai dibatalkan: stok batch PO ditarik, hutang Dihapus, Mutasi Stok minus', async () => {
    const before = await stockQty()
    const poId = await completedPo(10)
    expect(await stockQty()).toBe(before + 10)
    expect((await db.transaction(tx => checkCompletedCancellation(tx, poId, null))).blockers).toEqual([])

    await cancelCompleted(poId)

    expect(await poStatus(poId)).toBe('CANCELLED')
    expect(await stockQty()).toBe(before)
    const [batch] = await db.select().from(productStockBatches).where(eq(productStockBatches.purchaseOrderId, poId))
    expect(batch.qtyRemaining).toBe(0)
    expect(batch.qtyReceived).toBe(10)
    const [payable] = await db.select().from(supplierPayables).where(eq(supplierPayables.poId, poId))
    expect(payable.status).toBe('WAIVED')

    const ledger = (await db.execute(buildStockLedgerQuery([sql`sm.reference_id = ${String(poId)}`, sql`sm.id LIKE 'PO_%'`]))) as Record<string, unknown>[]
    const qtys = ledger.filter(r => r.movement_type === 'PO_IN').map(r => Number(r.qty_change)).sort((a, b) => a - b)
    expect(qtys).toEqual([-10, 10])
    expect(ledger.find(r => Number(r.qty_change) === -10)?.notes).toBe('Batal PO: tes: salah input')
  })

  it('ditolak bila barang dari PO sudah terpakai — stok tidak berubah', async () => {
    const poId = await completedPo(6)
    // Jual habis semua stok lama (FIFO) + 2 dari batch PO ini.
    const qtyNow = await stockQty()
    await db.transaction(tx => StockService.deductStock(tx, branchId, productId, pcs, qtyNow - 4))
    const check = await db.transaction(tx => checkCompletedCancellation(tx, poId, null))
    expect(check.blockers.map(b => b.kind)).toEqual(['USED'])
    expect(check.blockers[0].message).toContain('masuk 6')
    expect(check.blockers[0].message).toContain('tersisa 4')

    const stock = await stockQty()
    await expect(cancelCompleted(poId)).rejects.toBeInstanceOf(PoCancelError)
    expect(await stockQty()).toBe(stock)
    expect(await poStatus(poId)).toBe('COMPLETED')
  })

  it('ditolak bila hutang sudah dibayar atau ada retur supplier aktif', async () => {
    const poId = await completedPo(3)
    await db.update(supplierPayables).set({ paidAmount: 1_000, status: 'PARTIAL' }).where(eq(supplierPayables.poId, poId))
    await db.insert(supplierReturns).values({
      returnNumber: `RS-BTL-${run}`, branchId, supplierId, poId, reason: 'RUSAK', notes: 'tes', source: 'BO',
      status: 'PENDING', totalValue: 1_000, requestedById: userId,
    })

    const check = await db.transaction(tx => checkCompletedCancellation(tx, poId, null))
    expect(check.blockers.map(b => b.kind)).toEqual(['PAID', 'RETURN'])
    await expect(cancelCompleted(poId)).rejects.toBeInstanceOf(PoCancelError)
    expect(await poStatus(poId)).toBe('COMPLETED')
  })
})
