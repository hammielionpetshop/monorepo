import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productUomConversions, productUomCosts, productStocks,
  suppliers, roles, users, purchaseOrders, purchaseOrderItems, supplierPayables, supplierPayablePayments,
  supplierReturns, supplierCreditEntries, damagedGoods, damagedGoodsItems, eq, and, sql,
} from '../db'
import { stockLedgerUnion } from './stock-ledger'

vi.mock('@/lib/authz', () => ({
  requirePermission: async () => ({ userId, branchId, branchScope: 'ALL' }),
  getAuth: async () => ({ userId, branchId, branchScope: 'ALL' }),
  hasPermission: () => true,
}))

import { POST as receiveRoute } from '../../app/api/bo/purchase-orders/[id]/receive/route'
import { PATCH as approveReceivingRoute } from '../../app/api/bo/purchase-orders/[id]/approve-receiving/route'
import { POST as payRoute } from '../../app/api/bo/supplier-payables/[id]/pay/route'
import {
  approveSupplierReturn,
  createSupplierReturnRequest,
  rejectSupplierReturn,
  supplierCreditBalance,
} from './supplier-return-service'

// Retur ke Supplier end-to-end di DB lokal (salinan produksi). Satuan: PCS (dasar), SAK = 25 PCS.
const run = randomUUID().slice(0, 8)
let branchId: number
let userId: number
let supplierId: number
let pcs: number
let sak: number
let productA: number
let productB: number

const json = (body: unknown, method = 'POST') =>
  new Request('http://localhost', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })

async function stockPcs(productId: number) {
  const [row] = await db.select({ qty: productStocks.qty }).from(productStocks)
    .where(and(eq(productStocks.productId, productId), eq(productStocks.branchId, branchId)))
  return row?.qty ?? 0
}
async function payableOf(poId: number) {
  const [row] = await db.select().from(supplierPayables).where(eq(supplierPayables.poId, poId))
  return row
}
/** PO A: qty SAK diterima dengan harga faktur per SAK, lalu disetujui → hutang + stok masuk. */
async function receivedPo(qty: number, price: number) {
  const [po] = await db.insert(purchaseOrders).values({
    poNumber: `PO-RS-${run}-${randomUUID().slice(0, 4)}`, branchId, supplierId, status: 'APPROVED', totalAmount: 0, createdById: userId,
  }).returning()
  const [item] = await db.insert(purchaseOrderItems).values({ poId: po.id, productId: productA, uomId: sak, qtyOrdered: qty, unitCost: price }).returning()
  expect((await receiveRoute(json({ invoiceReceived: true, items: [{ poItemId: item.id, qtyReceived: qty, qtyDamaged: 0, unitPrice: price }] }), params(po.id))).status).toBe(200)
  expect((await approveReceivingRoute(new Request('http://localhost', { method: 'PATCH' }), params(po.id))).status).toBe(200)
  return { poId: po.id, poItemId: item.id }
}
const request = (poId: number | null, items: { productId: number; uomId: number; poItemId?: number; qty: number }[]) =>
  createSupplierReturnRequest({
    input: { supplierId, poId, reason: 'EXPIRED', notes: 'tes: barang expired dari supplier', items },
    branchId, userId, source: 'BO',
  })

let po1: { poId: number; poItemId: number }

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `RS${run}`, name: `Gudang Retur ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `RS${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `RS${run}`, roleId, branchId }).returning())[0].id
  supplierId = (await db.insert(suppliers).values({ name: `Supplier Retur ${run}`, paymentTermDays: 30 }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `P${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  sak = (await db.insert(unitsOfMeasure).values({ code: `S${run}`, name: 'SAK tes' }).returning())[0].id
  for (const key of ['A', 'B'] as const) {
    const [p] = await db.insert(products).values({ name: `${key} retur ${run}`, baseUomId: pcs, defaultCostPrice: 400 }).returning()
    await db.insert(productUomConversions).values({ productId: p.id, uomId: sak, ratio: 25 })
    await db.insert(productUomCosts).values([
      { productId: p.id, branchId, uomId: sak, costPrice: 10_000 },
      { productId: p.id, branchId, uomId: pcs, costPrice: 400 },
    ])
    if (key === 'A') productA = p.id
    else productB = p.id
  }
  po1 = await receivedPo(10, 12_000)
})

describe('Retur ke Supplier (DB lokal)', () => {
  it('1. pengajuan dengan PO asal: PENDING, harga dari faktur, stok & tagihan belum berubah', async () => {
    const before = await stockPcs(productA)
    const header = await request(po1.poId, [{ productId: productA, uomId: sak, poItemId: po1.poItemId, qty: 2 }])
    expect(header.status).toBe('PENDING')
    expect(header.returnNumber).toMatch(/^RS-\d{8}-\d{4}$/)
    expect(header.totalValue).toBe(24_000)
    expect(await stockPcs(productA)).toBe(before)
    expect((await payableOf(po1.poId)).paidAmount).toBe(0)
  })

  it('2. qty melebihi sisa PO (termasuk yang masih menunggu) ditolak', async () => {
    await expect(request(po1.poId, [{ productId: productA, uomId: sak, poItemId: po1.poItemId, qty: 9 }]))
      .rejects.toThrow(/maks 8/)
  })

  it('3. disetujui: stok keluar FIFO, tagihan PO dipotong (metode RETUR), tampil di Mutasi Stok', async () => {
    const [pending] = await db.select().from(supplierReturns).where(and(eq(supplierReturns.poId, po1.poId), eq(supplierReturns.status, 'PENDING')))
    const before = await stockPcs(productA)
    const approved = await approveSupplierReturn({ id: pending.id, userId })
    expect(approved.status).toBe('APPROVED')
    expect(approved.payableDeduction).toBe(24_000)
    expect(approved.creditAmount).toBe(0)
    expect(approved.totalCogs).toBe(24_000) // modal batch = harga faktur 12.000/SAK
    expect(await stockPcs(productA)).toBe(before - 50)

    const payable = await payableOf(po1.poId)
    expect(payable.paidAmount).toBe(24_000)
    expect(payable.status).toBe('PARTIAL')
    const payments = await db.select().from(supplierPayablePayments).where(eq(supplierPayablePayments.payableId, payable.id))
    expect(payments).toHaveLength(1)
    expect(payments[0].method).toBe('RETUR')
    expect(payments[0].referenceNumber).toBe(pending.returnNumber)

    const ledger = await db.execute<{ movement_type: string; qty_change: number; reference_number: string }>(
      sql`WITH sm AS (${stockLedgerUnion}) SELECT movement_type, qty_change, reference_number FROM sm WHERE product_id = ${productA} AND movement_type = 'SUPPLIER_RETURN_OUT'`,
    )
    expect(ledger.map(r => [r.qty_change, r.reference_number])).toEqual([[-2, pending.returnNumber]])

    await expect(approveSupplierReturn({ id: pending.id, userId })).rejects.toThrow(/sudah diproses/)
  })

  it('4. PO sudah lunas → seluruh nilai retur jadi saldo supplier', async () => {
    const payable = await payableOf(po1.poId)
    expect((await payRoute(json({ amount: payable.totalAmount - payable.paidAmount, method: 'TRANSFER' }), params(payable.id))).status).toBe(201)
    expect((await payableOf(po1.poId)).status).toBe('PAID')

    const header = await request(po1.poId, [{ productId: productA, uomId: sak, poItemId: po1.poItemId, qty: 1 }])
    const approved = await approveSupplierReturn({ id: header.id, userId })
    expect(approved.payableDeduction).toBe(0)
    expect(approved.creditAmount).toBe(12_000)
    expect(await supplierCreditBalance(db, supplierId)).toBe(12_000)
    expect((await payableOf(po1.poId)).paidAmount).toBe(payable.totalAmount) // tidak berubah
  })

  it('5. tanpa PO asal: harga modal terakhir, penyetuju boleh ubah, semua jadi saldo', async () => {
    // Stok B masuk lewat PO lain dulu (barang lama).
    const [po] = await db.insert(purchaseOrders).values({
      poNumber: `PO-RS-${run}-B`, branchId, supplierId, status: 'APPROVED', totalAmount: 0, createdById: userId,
    }).returning()
    const [item] = await db.insert(purchaseOrderItems).values({ poId: po.id, productId: productB, uomId: sak, qtyOrdered: 4, unitCost: 10_000 }).returning()
    await receiveRoute(json({ invoiceReceived: true, items: [{ poItemId: item.id, qtyReceived: 4, qtyDamaged: 0, unitPrice: 10_000 }] }), params(po.id))
    await approveReceivingRoute(new Request('http://localhost', { method: 'PATCH' }), params(po.id))

    const header = await request(null, [{ productId: productB, uomId: sak, qty: 1 }])
    expect(header.totalValue).toBe(10_000) // modal terakhir SAK
    const [itemRow] = await db.execute<{ id: number }>(sql`SELECT id FROM petshop.supplier_return_items WHERE supplier_return_id = ${header.id}`)
    const approved = await approveSupplierReturn({ id: header.id, userId, prices: [{ itemId: itemRow.id, unitPrice: 9_000 }] })
    expect(approved.totalValue).toBe(9_000)
    expect(approved.creditAmount).toBe(9_000)
    expect(await supplierCreditBalance(db, supplierId)).toBe(21_000)
  })

  it('6. ditolak: stok, tagihan, saldo tidak berubah', async () => {
    const before = await stockPcs(productA)
    const header = await request(po1.poId, [{ productId: productA, uomId: sak, poItemId: po1.poItemId, qty: 1 }])
    const rejected = await rejectSupplierReturn({ id: header.id, userId, rejectionReason: 'tes: barang masih bagus' })
    expect(rejected.status).toBe('REJECTED')
    expect(await stockPcs(productA)).toBe(before)
    expect(await supplierCreditBalance(db, supplierId)).toBe(21_000)
  })

  it('7. bayar tagihan berikutnya dari saldo supplier: tidak boleh melebihi saldo, saldo berkurang', async () => {
    const po2 = await receivedPo(2, 15_000) // tagihan 30.000
    const payable = await payableOf(po2.poId)

    const tooMuch = await payRoute(json({ amount: 25_000, method: 'x', useSupplierCredit: true }), params(payable.id))
    expect(tooMuch.status).toBe(400)

    const ok = await payRoute(json({ amount: 21_000, method: 'x', useSupplierCredit: true }), params(payable.id))
    expect(ok.status).toBe(201)
    const after = await payableOf(po2.poId)
    expect(after.paidAmount).toBe(21_000)
    expect(after.status).toBe('PARTIAL')
    const [payment] = await db.select().from(supplierPayablePayments).where(eq(supplierPayablePayments.payableId, payable.id))
    expect(payment.method).toBe('SALDO SUPPLIER')
    expect(await supplierCreditBalance(db, supplierId)).toBe(0)
    const entries = await db.select().from(supplierCreditEntries).where(eq(supplierCreditEntries.supplierId, supplierId))
    expect(entries.map(e => e.amount).sort((a, b) => a - b)).toEqual([-21_000, 9_000, 12_000])

    // Metode sistem tidak boleh diketik manual.
    expect((await payRoute(json({ amount: 1_000, method: 'RETUR' }), params(payable.id))).status).toBe(400)
  })

  it('8. Mutasi Stok: laporan Barang Rusak yang ditolak/menunggu tidak tampil sebagai stok keluar', async () => {
    for (const status of ['REJECTED', 'PENDING', 'APPROVED']) {
      const [dg] = await db.insert(damagedGoods).values({
        branchId, reportedById: userId, reason: 'RUSAK', totalLossValue: 400, status,
        resolvedAt: status === 'PENDING' ? null : new Date(),
      }).returning()
      await db.insert(damagedGoodsItems).values({ damagedGoodsId: dg.id, productId: productB, uomId: pcs, qty: 1, costPrice: 400, lossValue: 400 })
    }
    const rows = await db.execute<{ n: number }>(
      sql`WITH sm AS (${stockLedgerUnion}) SELECT CAST(COUNT(*) AS INTEGER) AS n FROM sm WHERE product_id = ${productB} AND movement_type = 'DAMAGED_OUT'`,
    )
    expect(Number(rows[0].n)).toBe(1)
  })
})
