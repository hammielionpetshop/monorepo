import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productUomConversions, productUomCosts, productStocks, productStockBatches,
  suppliers, roles, users, purchaseOrders, purchaseOrderItems, supplierPayables, supplierPayablePayments,
  supplierReturns, supplierCreditEntries, auditLogs, eq, and, desc, sql,
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
import { POST as cancelRoute } from '../../app/api/bo/supplier-returns/[id]/cancel/route'
import {
  approveSupplierReturn,
  cancelSupplierReturn,
  createSupplierReturnRequest,
  supplierCreditBalance,
  withdrawSupplierReturn,
} from './supplier-return-service'
import { listSupplierReturns } from './supplier-return-queries'

// RI3b — Batalkan Retur Supplier Luar & tarik pengajuan, di DB lokal (salinan produksi).
// Satuan: PCS (dasar), SAK = 25 PCS.
const run = randomUUID().slice(0, 8)
let branchId: number
let userId: number
let otherUserId: number
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
async function receivedPo(productId: number, qty: number, price: number) {
  const [po] = await db.insert(purchaseOrders).values({
    poNumber: `PO-RB-${run}-${randomUUID().slice(0, 4)}`, branchId, supplierId, status: 'APPROVED', totalAmount: 0, createdById: userId,
  }).returning()
  const [item] = await db.insert(purchaseOrderItems).values({ poId: po.id, productId, uomId: sak, qtyOrdered: qty, unitCost: price }).returning()
  expect((await receiveRoute(json({ invoiceReceived: true, items: [{ poItemId: item.id, qtyReceived: qty, qtyDamaged: 0, unitPrice: price }] }), params(po.id))).status).toBe(200)
  expect((await approveReceivingRoute(new Request('http://localhost', { method: 'PATCH' }), params(po.id))).status).toBe(200)
  return { poId: po.id, poItemId: item.id }
}
const request = (
  poId: number | null,
  items: { productId: number; uomId: number; poItemId?: number; qty: number }[],
  requester = userId,
) =>
  createSupplierReturnRequest({
    input: { supplierId, poId, reason: 'RUSAK', notes: 'tes: barang rusak dari supplier', items },
    branchId, userId: requester, source: 'BO',
  })
const ledgerRows = async (productId: number, returnNumber: string) =>
  db.execute<{ movement_type: string; qty_change: number; cogs: number }>(
    sql`WITH sm AS (${stockLedgerUnion}) SELECT movement_type, qty_change, cogs FROM sm
        WHERE product_id = ${productId} AND reference_number = ${returnNumber} ORDER BY movement_type`,
  )

let po1: { poId: number; poItemId: number }

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `RB${run}`, name: `Gudang Batal ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `RB${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `RB${run}`, roleId, branchId }).returning())[0].id
  otherUserId = (await db.insert(users).values({ name: `RB2${run}`, roleId, branchId }).returning())[0].id
  supplierId = (await db.insert(suppliers).values({ name: `Supplier Batal ${run}`, paymentTermDays: 30 }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `Q${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  sak = (await db.insert(unitsOfMeasure).values({ code: `K${run}`, name: 'SAK tes' }).returning())[0].id
  for (const key of ['A', 'B'] as const) {
    const [p] = await db.insert(products).values({ name: `${key} batal ${run}`, baseUomId: pcs, defaultCostPrice: 400 }).returning()
    await db.insert(productUomConversions).values({ productId: p.id, uomId: sak, ratio: 25 })
    await db.insert(productUomCosts).values([
      { productId: p.id, branchId, uomId: sak, costPrice: 10_000 },
      { productId: p.id, branchId, uomId: pcs, costPrice: 400 },
    ])
    if (key === 'A') productA = p.id
    else productB = p.id
  }
  po1 = await receivedPo(productA, 10, 12_500) // tagihan 125.000, modal 500/PCS
})

describe('Batalkan Retur Supplier Luar & tarik pengajuan (RI3b, DB lokal)', () => {
  it('1. batal retur ber-PO: stok masuk lagi (modal sama), tagihan kembali, jejak pembayaran negatif, Mutasi Stok dua baris', async () => {
    const stock0 = await stockPcs(productA)
    const header = await request(po1.poId, [{ productId: productA, uomId: sak, poItemId: po1.poItemId, qty: 2 }])
    const approved = await approveSupplierReturn({ id: header.id, userId })
    expect(approved.payableDeduction).toBe(25_000)
    expect(await stockPcs(productA)).toBe(stock0 - 50)

    // Sisa tagihan dilunasi tunai SETELAH retur — pembatalan harus mengembalikan tagihan 25.000.
    const payable = await payableOf(po1.poId)
    expect((await payRoute(json({ amount: payable.totalAmount - payable.paidAmount, method: 'TRANSFER' }), params(payable.id))).status).toBe(201)
    expect((await payableOf(po1.poId)).status).toBe('PAID')

    const cancelled = await cancelSupplierReturn({ id: header.id, userId, reason: 'tes: ternyata supplier menolak retur' })
    expect(cancelled.status).toBe('CANCELLED')
    expect(cancelled.cancelledById).toBe(userId)
    expect(cancelled.cancellationReason).toBe('tes: ternyata supplier menolak retur')
    // Angka hasil persetujuan tidak dihapus — tetap jadi jejak.
    expect(cancelled.payableDeduction).toBe(25_000)

    expect(await stockPcs(productA)).toBe(stock0)
    const [batch] = await db.select().from(productStockBatches)
      .where(and(eq(productStockBatches.productId, productA), eq(productStockBatches.branchId, branchId)))
      .orderBy(desc(productStockBatches.id)).limit(1)
    expect(Number(batch.qtyRemaining)).toBe(50)
    expect(Number(batch.costPrice)).toBe(500)

    const after = await payableOf(po1.poId)
    expect(after.paidAmount).toBe(after.totalAmount - 25_000)
    expect(after.status).toBe('PARTIAL')
    const payments = await db.select().from(supplierPayablePayments).where(eq(supplierPayablePayments.payableId, payable.id))
    expect(payments.map(p => [p.method, p.amount]).sort()).toEqual(
      [['BATAL RETUR', -25_000], ['RETUR', 25_000], ['TRANSFER', payable.totalAmount - 25_000]].sort(),
    )

    const ledger = await ledgerRows(productA, header.returnNumber)
    expect(ledger.map(r => [r.movement_type, Number(r.qty_change), Number(r.cogs)])).toEqual([
      ['SUPPLIER_RETURN_CANCEL_IN', 2, 25_000],
      ['SUPPLIER_RETURN_OUT', -2, 25_000],
    ])

    const [audit] = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.tableName, 'supplier_returns'), eq(auditLogs.recordId, String(header.id)), eq(auditLogs.action, 'SUPPLIER_RETURN_CANCEL')))
    expect(audit).toBeTruthy()

    const [view] = await listSupplierReturns({ branchId: null, ids: [header.id] })
    expect(view).toMatchObject({ status: 'CANCELLED', cancellationReason: 'tes: ternyata supplier menolak retur', cancelledByName: `RB${run}` })

    // Tidak bisa dibatalkan dua kali; qty PO-nya bebas diretur lagi.
    await expect(cancelSupplierReturn({ id: header.id, userId, reason: 'tes: dua kali' })).rejects.toThrow(/Disetujui/)
    const again = await request(po1.poId, [{ productId: productA, uomId: sak, poItemId: po1.poItemId, qty: 10 }])
    expect(again.status).toBe('PENDING')
    await withdrawSupplierReturn({ id: again.id, userId })
  })

  it('2. batal retur yang jadi saldo supplier: saldo dikurangi lewat entri BATAL_RETUR', async () => {
    await receivedPo(productB, 4, 10_000)
    const header = await request(null, [{ productId: productB, uomId: sak, qty: 1 }])
    const approved = await approveSupplierReturn({ id: header.id, userId })
    expect(approved.creditAmount).toBe(10_000)
    const balance = await supplierCreditBalance(db, supplierId)

    await cancelSupplierReturn({ id: header.id, userId, reason: 'tes: salah pilih barang' })
    expect(await supplierCreditBalance(db, supplierId)).toBe(balance - 10_000)
    const entries = await db.select().from(supplierCreditEntries).where(eq(supplierCreditEntries.supplierReturnId, header.id))
    expect(entries.map(e => [e.sourceType, e.amount]).sort()).toEqual([['BATAL_RETUR', -10_000], ['RETUR', 10_000]].sort())
  })

  it('3. ditolak bila saldo dari retur itu sudah terpakai — stok, tagihan, status tidak berubah', async () => {
    const header = await request(null, [{ productId: productB, uomId: sak, qty: 1 }])
    await approveSupplierReturn({ id: header.id, userId })
    const balance = await supplierCreditBalance(db, supplierId)
    expect(balance).toBe(10_000)

    const po2 = await receivedPo(productA, 1, 20_000)
    const payable = await payableOf(po2.poId)
    expect((await payRoute(json({ amount: 4_000, method: 'x', useSupplierCredit: true }), params(payable.id))).status).toBe(201)

    const stockBefore = await stockPcs(productB)
    await expect(cancelSupplierReturn({ id: header.id, userId, reason: 'tes: saldo sudah dipakai' })).rejects.toThrow(/sudah terpakai/)
    expect(await stockPcs(productB)).toBe(stockBefore)
    expect(await supplierCreditBalance(db, supplierId)).toBe(6_000)
    const [row] = await db.select().from(supplierReturns).where(eq(supplierReturns.id, header.id))
    expect(row.status).toBe('APPROVED')

    // Lewat API: alasan wajib, penolakan saldo → 409.
    expect((await cancelRoute(json({ reason: '' }), params(header.id))).status).toBe(400)
    expect((await cancelRoute(json({ reason: 'tes: lewat API' }), params(header.id))).status).toBe(409)
  })

  it('4. tarik pengajuan: hanya pengaju, hanya selama menunggu, tanpa efek; tidak bisa disetujui setelahnya', async () => {
    const stockBefore = await stockPcs(productB)
    const header = await request(null, [{ productId: productB, uomId: sak, qty: 1 }])

    await expect(withdrawSupplierReturn({ id: header.id, userId: otherUserId })).rejects.toThrow(/Hanya pengaju/)
    const withdrawn = await withdrawSupplierReturn({ id: header.id, userId })
    expect(withdrawn.status).toBe('WITHDRAWN')
    expect(withdrawn.resolvedById).toBe(userId)
    expect(await stockPcs(productB)).toBe(stockBefore)
    await expect(approveSupplierReturn({ id: header.id, userId })).rejects.toThrow(/sudah diproses/)
    await expect(withdrawSupplierReturn({ id: header.id, userId })).rejects.toThrow(/sudah diproses/)
    await expect(cancelSupplierReturn({ id: header.id, userId, reason: 'tes: bukan disetujui' })).rejects.toThrow(/Disetujui/)
  })

  it('5. metode BATAL RETUR tidak boleh diketik manual di Bayar Hutang Supplier', async () => {
    const payable = await payableOf(po1.poId)
    expect((await payRoute(json({ amount: 1_000, method: 'BATAL RETUR' }), params(payable.id))).status).toBe(400)
  })
})
