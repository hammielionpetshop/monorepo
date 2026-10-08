import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { db, branches, unitsOfMeasure, products, productUomConversions, productUomCosts, productCostSyncs, productStocks, productStockBatches, stockShortfalls, roles, users, shifts, paymentMethods, transactions, transactionItems, transactionPayments, auditLogs, interBranchTransfers, interBranchTransferItems, interBranchPayables, returns, returnItems, eq, and, inArray } from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
vi.mock('@/lib/authz', () => ({ requirePermission: async () => ({ userId, branchId, branchScope: 'ALL' }), getAuth: async () => ({ userId, branchId, branchScope: 'ALL' }), hasPermission: () => true }))
import { PATCH as transferStatus } from '../../app/api/bo/internal-transfers/[id]/status/route'

// Skenario kanban #42/#43 end-to-end ke DB worktree: PO Internal → Bulk Sale → kirim → terima,
// lalu batal & proses ulang. Satuan: PCS (dasar), BOX = 5 PCS, SAK = 25 PCS.
const run = randomUUID().slice(0, 8)
let branchId: number
let destinationBranchId: number
let pcs: number
let box: number
let sak: number
let roleId: number
let userId: number
let shiftId: number
let debtMethodId: number
const productIds: number[] = []
const transferIds: number[] = []

beforeAll(async () => {
  const [source] = await db.insert(branches).values({ code: `IBS${run}`, name: `Gudang tes ${run}` }).returning()
  branchId = source.id
  const [dest] = await db.insert(branches).values({ code: `IBD${run}`, name: `Toko tes ${run}` }).returning()
  destinationBranchId = dest.id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `P${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  box = (await db.insert(unitsOfMeasure).values({ code: `B${run}`, name: 'BOX tes' }).returning())[0].id
  sak = (await db.insert(unitsOfMeasure).values({ code: `S${run}`, name: 'SAK tes' }).returning())[0].id
  roleId = (await db.insert(roles).values({ name: `IBT${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `IBT${run}`, roleId, branchId }).returning())[0].id
  debtMethodId = (await db.insert(paymentMethods).values({ name: `Hutang ${run}`, type: 'DEBT' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
})

afterAll(async () => {
  const touchedBranches = [branchId, destinationBranchId].filter(Boolean)
  if (touchedBranches.length > 0) {
    const trxs = await db.select({ id: transactions.id }).from(transactions).where(inArray(transactions.branchId, touchedBranches))
    for (const trx of trxs) {
      const rets = await db.select({ id: returns.id }).from(returns).where(eq(returns.transactionId, trx.id))
      for (const ret of rets) await db.delete(returnItems).where(eq(returnItems.returnId, ret.id))
      await db.delete(returns).where(eq(returns.transactionId, trx.id))
      await db.delete(transactionPayments).where(eq(transactionPayments.transactionId, trx.id))
      await db.delete(transactionItems).where(eq(transactionItems.transactionId, trx.id))
    }
    for (const id of transferIds) {
      await db.delete(interBranchPayables).where(eq(interBranchPayables.transferId, id))
      await db.delete(interBranchTransferItems).where(eq(interBranchTransferItems.transferId, id))
    }
    if (transferIds.length > 0) {
      await db.update(interBranchTransfers).set({ convertedTransactionId: null }).where(inArray(interBranchTransfers.id, transferIds))
    }
    await db.delete(transactions).where(inArray(transactions.branchId, touchedBranches))
    if (transferIds.length > 0) await db.delete(interBranchTransfers).where(inArray(interBranchTransfers.id, transferIds))
    await db.delete(auditLogs).where(inArray(auditLogs.branchId, touchedBranches))
    await db.delete(stockShortfalls).where(inArray(stockShortfalls.branchId, touchedBranches))
    await db.delete(productCostSyncs).where(inArray(productCostSyncs.branchId, touchedBranches))
    await db.delete(productUomCosts).where(inArray(productUomCosts.branchId, touchedBranches))
    await db.delete(productStockBatches).where(inArray(productStockBatches.branchId, touchedBranches))
    await db.delete(productStocks).where(inArray(productStocks.branchId, touchedBranches))
  }
  for (const id of productIds) {
    await db.delete(productUomConversions).where(eq(productUomConversions.productId, id))
    await db.delete(products).where(eq(products.id, id))
  }
  if (debtMethodId) await db.delete(paymentMethods).where(eq(paymentMethods.id, debtMethodId))
  if (shiftId) await db.delete(shifts).where(eq(shifts.id, shiftId))
  if (userId) await db.delete(users).where(eq(users.id, userId))
  if (roleId) await db.delete(roles).where(eq(roles.id, roleId))
  for (const id of [pcs, box, sak]) if (id) await db.delete(unitsOfMeasure).where(eq(unitsOfMeasure.id, id))
  for (const id of [branchId, destinationBranchId]) if (id) await db.delete(branches).where(eq(branches.id, id))
  await db.$client.end()
})

async function product(name: string, stockPcs: number) {
  const [p] = await db.insert(products).values({ name: `${name} ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning()
  productIds.push(p.id)
  await db.insert(productUomConversions).values([
    { productId: p.id, uomId: box, ratio: 5 },
    { productId: p.id, uomId: sak, ratio: 25 },
  ])
  await db.transaction((tx) => StockService.addStock(tx, branchId, p.id, pcs, String(stockPcs), '1000'))
  return p
}

async function stockPcs(productId: number, branch: number) {
  const rows = await db.select().from(productStockBatches).where(and(eq(productStockBatches.productId, productId), eq(productStockBatches.branchId, branch)))
  return rows.reduce((sum, row) => sum + Number(row.qtyRemaining), 0)
}

async function newIbt(lines: { productId: number; uomId: number; qty: number }[]) {
  const [ibt] = await db.insert(interBranchTransfers).values({ ibtNumber: `IBT-T-${randomUUID()}`, sourceBranchId: branchId, destinationBranchId, requestedById: userId, status: 'PENDING_APPROVAL' }).returning()
  transferIds.push(ibt.id)
  await db.insert(interBranchTransferItems).values(lines.map((l) => ({ transferId: ibt.id, productId: l.productId, uomId: l.uomId, qtyRequested: l.qty, costPriceAtTransfer: 1 })))
  return ibt
}

type Line = { productId: number; uomId: number; qty: number; unitPrice: number; discountAmount?: number }
function bulkSale(sourceIbtId: number, lines: Line[]) {
  const items = lines.map((l) => {
    const discountAmount = l.discountAmount ?? 0
    return { productId: l.productId, uomId: l.uomId, qty: l.qty, unitPrice: l.unitPrice, discountAmount, subtotal: l.qty * l.unitPrice - discountAmount, priceTier: 'GROSIR' }
  })
  const grandTotal = items.reduce((sum, i) => sum + i.subtotal, 0)
  return TransactionService.createTransaction({
    branchId, cashierId: userId, shiftId, localTrxNumber: `IBT-${randomUUID()}`, saleType: 'BULK', sourceIbtId,
    items, payments: [{ paymentMethodId: debtMethodId, amount: grandTotal }], totals: { subtotal: grandTotal, discountTotal: 0, grandTotal }, amountPaid: grandTotal, change: 0,
  } as never)
}

function patch(ibtId: number, body: Record<string, unknown>) {
  return transferStatus(
    new NextRequest('http://localhost', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: String(ibtId) }) },
  )
}

async function itemsOf(ibtId: number) {
  return db.select().from(interBranchTransferItems).where(eq(interBranchTransferItems.transferId, ibtId))
}

describe('PO Internal → Bulk Sale → kirim → terima: piutang = nota (kanban #43)', () => {
  it('beda satuan (A), produk tambahan (B), satuan lebih kecil (C) dan diskon semuanya tertagih persis', async () => {
    const a = await product('A dipesan PCS dijual SAK', 100)
    const c = await product('C dipesan SAK dijual BOX', 100)
    const b = await product('B tambahan di nota', 100)
    const d = await product('D diskon', 100)
    const ibt = await newIbt([
      { productId: a.id, uomId: pcs, qty: 1 },
      { productId: c.id, uomId: sak, qty: 1 },
      { productId: d.id, uomId: pcs, qty: 3 },
    ])
    const trx = await bulkSale(ibt.id, [
      { productId: a.id, uomId: sak, qty: 1, unitPrice: 406000 },
      { productId: c.id, uomId: box, qty: 2, unitPrice: 51000 },
      { productId: b.id, uomId: sak, qty: 2, unitPrice: 482500 },
      { productId: d.id, uomId: pcs, qty: 3, unitPrice: 10000, discountAmount: 3000 },
    ])
    expect(trx.payableAmount).toBe(406000 + 102000 + 965000 + 27000)

    const afterSale = await itemsOf(ibt.id)
    expect(afterSale.find((i) => i.productId === a.id)?.costPriceAtTransfer).toBe(16240)
    expect(afterSale.find((i) => i.productId === d.id)?.costPriceAtTransfer).toBe(9000)
    expect(afterSale.filter((i) => i.qtyRequested === 0).map((i) => [i.productId, i.uomId]).sort()).toEqual(
      [[b.id, sak], [c.id, pcs]].sort(),
    )

    expect((await patch(ibt.id, { action: 'prepare' })).status).toBe(200)
    const shipRes = await patch(ibt.id, { action: 'ship', items: afterSale.map((i) => ({ itemId: i.id, qty: 0 })) })
    expect(shipRes.status).toBe(200)
    const shipped = await itemsOf(ibt.id)
    const receiveRes = await patch(ibt.id, { action: 'receive', items: shipped.map((i) => ({ itemId: i.id, qty: i.qtyShipped })) })
    expect(receiveRes.status).toBe(200)

    const [payable] = await db.select().from(interBranchPayables).where(eq(interBranchPayables.transferId, ibt.id))
    expect(payable.totalAmount).toBe(trx.payableAmount)

    // Stok pindah utuh ke toko tujuan (PCS): A 25, C 10, B 50, D 3.
    expect(await stockPcs(a.id, destinationBranchId)).toBe(25)
    expect(await stockPcs(c.id, destinationBranchId)).toBe(10)
    expect(await stockPcs(b.id, destinationBranchId)).toBe(50)
    expect(await stockPcs(d.id, destinationBranchId)).toBe(3)
    // Modal per PCS di toko tujuan tidak berlipat.
    const [batchA] = await db.select().from(productStockBatches).where(and(eq(productStockBatches.productId, a.id), eq(productStockBatches.branchId, destinationBranchId)))
    expect(Number(batchA.costPrice)).toBe(16240)
  })
})

describe('Batalkan & Proses Ulang PO Internal saat Disiapkan (kanban #42)', () => {
  it('batal: nota di-void, stok gudang kembali, baris tambahan dibuang, transfer CANCELLED', async () => {
    const p = await product('Batal', 100)
    const extra = await product('Batal tambahan', 100)
    const ibt = await newIbt([{ productId: p.id, uomId: pcs, qty: 10 }])
    const trx = await bulkSale(ibt.id, [
      { productId: p.id, uomId: pcs, qty: 10, unitPrice: 5000 },
      { productId: extra.id, uomId: pcs, qty: 4, unitPrice: 5000 },
    ])
    expect(await stockPcs(p.id, branchId)).toBe(90)
    expect((await patch(ibt.id, { action: 'prepare' })).status).toBe(200)

    expect((await patch(ibt.id, { action: 'cancel' })).status).toBe(400)
    const res = await patch(ibt.id, { action: 'cancel', reason: 'salah order' })
    expect(res.status).toBe(200)

    const [ibtAfter] = await db.select().from(interBranchTransfers).where(eq(interBranchTransfers.id, ibt.id))
    expect(ibtAfter.status).toBe('CANCELLED')
    expect(ibtAfter.convertedTransactionId).toBeNull()
    const [trxAfter] = await db.select().from(transactions).where(eq(transactions.id, trx.id))
    expect(trxAfter.status).toBe('VOIDED')
    expect(await stockPcs(p.id, branchId)).toBe(100)
    expect(await stockPcs(extra.id, branchId)).toBe(100)
    expect((await itemsOf(ibt.id)).map((i) => i.productId)).toEqual([p.id])

    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.tableName, 'inter_branch_transfers'), eq(auditLogs.recordId, String(ibt.id))))
    expect(logs.map((l) => l.action)).toContain('IBT_CANCELLED')
    const voidLog = await db.select().from(auditLogs).where(and(eq(auditLogs.tableName, 'transactions'), eq(auditLogs.recordId, String(trx.id))))
    expect(voidLog.map((l) => l.action)).toContain('VOID_TRANSACTION')
  })

  it('proses ulang: transfer kembali ke Menunggu Persetujuan dan bisa dijual lagi', async () => {
    const p = await product('Proses ulang', 100)
    const ibt = await newIbt([{ productId: p.id, uomId: pcs, qty: 10 }])
    await bulkSale(ibt.id, [{ productId: p.id, uomId: pcs, qty: 10, unitPrice: 9000 }])
    expect((await patch(ibt.id, { action: 'reprocess', reason: 'salah tier' })).status).toBe(200)

    const [ibtAfter] = await db.select().from(interBranchTransfers).where(eq(interBranchTransfers.id, ibt.id))
    expect(ibtAfter.status).toBe('PENDING_APPROVAL')
    expect(ibtAfter.convertedTransactionId).toBeNull()
    expect(await stockPcs(p.id, branchId)).toBe(100)

    const again = await bulkSale(ibt.id, [{ productId: p.id, uomId: pcs, qty: 10, unitPrice: 8000 }])
    const [ibtAgain] = await db.select().from(interBranchTransfers).where(eq(interBranchTransfers.id, ibt.id))
    expect(ibtAgain.convertedTransactionId).toBe(again.id)
    expect((await itemsOf(ibt.id))[0].costPriceAtTransfer).toBe(8000)
  })

  it('transfer yang sudah dikirim tidak bisa dibatalkan', async () => {
    const p = await product('Sudah kirim', 100)
    const ibt = await newIbt([{ productId: p.id, uomId: pcs, qty: 2 }])
    await bulkSale(ibt.id, [{ productId: p.id, uomId: pcs, qty: 2, unitPrice: 1000 }])
    await patch(ibt.id, { action: 'prepare' })
    const rows = await itemsOf(ibt.id)
    expect((await patch(ibt.id, { action: 'ship', items: rows.map((i) => ({ itemId: i.id, qty: 0 })) })).status).toBe(200)
    expect((await patch(ibt.id, { action: 'cancel', reason: 'telat' })).status).toBe(409)
  })
})

describe('Selisih terima kembali ke stok pengirim (kanban #56)', () => {
  it('IBT hasil Bulk Sale: selisih diretur dari nota, stok pengirim balik, hutang = nota setelah retur', async () => {
    const p = await product('Selisih nota', 100)
    const ibt = await newIbt([{ productId: p.id, uomId: box, qty: 2 }])
    const trx = await bulkSale(ibt.id, [{ productId: p.id, uomId: box, qty: 2, unitPrice: 5000 }])
    expect(await stockPcs(p.id, branchId)).toBe(90)

    await patch(ibt.id, { action: 'prepare' })
    const rows = await itemsOf(ibt.id)
    expect((await patch(ibt.id, { action: 'ship', items: rows.map((i) => ({ itemId: i.id, qty: 0 })) })).status).toBe(200)
    const shipped = await itemsOf(ibt.id)
    const res = await patch(ibt.id, { action: 'receive', items: shipped.map((i) => ({ itemId: i.id, qty: 1, notes: 'kurang dari sana nya' })) })
    expect(res.status).toBe(200)

    const [ibtAfter] = await db.select().from(interBranchTransfers).where(eq(interBranchTransfers.id, ibt.id))
    expect(ibtAfter.status).toBe('PARTIALLY_RECEIVED')
    expect(await stockPcs(p.id, destinationBranchId)).toBe(5)
    expect(await stockPcs(p.id, branchId)).toBe(95)

    const rets = await db.select().from(returns).where(eq(returns.transactionId, trx.id))
    expect(rets).toHaveLength(1)
    expect(rets[0].branchId).toBe(branchId)
    expect(rets[0].totalRefundAmount).toBe(5000)
    const [payable] = await db.select().from(interBranchPayables).where(eq(interBranchPayables.transferId, ibt.id))
    expect(payable.totalAmount).toBe(trx.payableAmount - rets[0].totalRefundAmount)
  })

  it('IBT manual: selisih langsung ditambahkan balik ke stok pengirim', async () => {
    const p = await product('Selisih manual', 100)
    const ibt = await newIbt([{ productId: p.id, uomId: pcs, qty: 4 }])
    expect((await patch(ibt.id, { action: 'approve' })).status).toBe(200)
    expect((await patch(ibt.id, { action: 'prepare' })).status).toBe(200)
    const rows = await itemsOf(ibt.id)
    expect((await patch(ibt.id, { action: 'ship', items: rows.map((i) => ({ itemId: i.id, qty: 4 })) })).status).toBe(200)
    expect(await stockPcs(p.id, branchId)).toBe(96)

    const res = await patch(ibt.id, { action: 'receive', items: rows.map((i) => ({ itemId: i.id, qty: 3, notes: 'kurang 1' })) })
    expect(res.status).toBe(200)
    expect(await stockPcs(p.id, destinationBranchId)).toBe(3)
    expect(await stockPcs(p.id, branchId)).toBe(97)
  })

  it('terima penuh: tidak ada retur', async () => {
    const p = await product('Terima penuh', 100)
    const ibt = await newIbt([{ productId: p.id, uomId: pcs, qty: 2 }])
    const trx = await bulkSale(ibt.id, [{ productId: p.id, uomId: pcs, qty: 2, unitPrice: 1000 }])
    await patch(ibt.id, { action: 'prepare' })
    const rows = await itemsOf(ibt.id)
    await patch(ibt.id, { action: 'ship', items: rows.map((i) => ({ itemId: i.id, qty: 0 })) })
    const shipped = await itemsOf(ibt.id)
    expect((await patch(ibt.id, { action: 'receive', items: shipped.map((i) => ({ itemId: i.id, qty: i.qtyShipped })) })).status).toBe(200)
    expect(await db.select().from(returns).where(eq(returns.transactionId, trx.id))).toHaveLength(0)
    expect(await stockPcs(p.id, branchId)).toBe(98)
  })
})
