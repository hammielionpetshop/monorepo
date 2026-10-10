import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productUomConversions, productUomCosts, productStockBatches,
  suppliers, roles, users, purchaseOrders, purchaseOrderItems, poReceivingLogs, supplierPayables,
  supplierPayablePayments, auditLogs, eq, and,
} from '../db'
import { pricePendingReceivedCount } from '../po-stage-sql'
import { poStage } from '../po-stage'
import { loadPendingPriceEstimates } from '../po-pending-estimate'

vi.mock('@/lib/authz', () => ({
  requirePermission: async () => ({ userId, branchId, branchScope: 'ALL' }),
  getAuth: async () => ({ userId, branchId, branchScope: 'ALL' }),
  hasPermission: () => true,
}))

import { POST as receiveRoute } from '../../app/api/bo/purchase-orders/[id]/receive/route'
import { POST as cancelReceivingRoute } from '../../app/api/bo/purchase-orders/[id]/cancel-receiving/route'
import { PATCH as approveReceivingRoute } from '../../app/api/bo/purchase-orders/[id]/approve-receiving/route'
import { PATCH as updateInvoiceRoute } from '../../app/api/bo/purchase-orders/[id]/update-invoice/route'
import { POST as payRoute } from '../../app/api/bo/supplier-payables/[id]/pay/route'

// Alur PO baru end-to-end di DB lokal (salinan produksi): terima barang dengan qty + harga,
// harga kosong = menunggu faktur, batalkan input penerimaan, setujui, isi faktur, bayar.
// Satuan: PCS (dasar), SAK = 25 PCS. Harga per SAK.
const run = randomUUID().slice(0, 8)
let branchId: number
let userId: number
let supplierId: number
let pcs: number
let sak: number
const product: Record<'A' | 'B' | 'C', number> = { A: 0, B: 0, C: 0 }
let poId: number
const itemId: Record<'A' | 'B' | 'C', number> = { A: 0, B: 0, C: 0 }

const json = (body: unknown, method = 'POST') =>
  new Request('http://localhost', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })

async function sakCost(productId: number) {
  const [row] = await db.select({ cost: productUomCosts.costPrice }).from(productUomCosts)
    .where(and(eq(productUomCosts.productId, productId), eq(productUomCosts.branchId, branchId), eq(productUomCosts.uomId, sak)))
  return row?.cost ?? null
}
async function pendingCount() {
  const [row] = await db.select({ n: pricePendingReceivedCount(purchaseOrders.id) }).from(purchaseOrders).where(eq(purchaseOrders.id, poId))
  return row.n
}
async function poStatus() {
  const [row] = await db.select({ status: purchaseOrders.status }).from(purchaseOrders).where(eq(purchaseOrders.id, poId))
  return row.status
}
async function receiveAll() {
  return receiveRoute(json({
    invoiceReceived: true,
    items: [
      { poItemId: itemId.A, qtyReceived: 10, qtyDamaged: 0, unitPrice: 12_000 },
      { poItemId: itemId.B, qtyReceived: 5, qtyDamaged: 0, unitPrice: 0 },
      { poItemId: itemId.C, qtyReceived: 2, qtyDamaged: 0, unitPrice: 0 },
    ],
  }), params(poId))
}

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `POA${run}`, name: `Gudang PO ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `POA${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `POA${run}`, roleId, branchId }).returning())[0].id
  supplierId = (await db.insert(suppliers).values({ name: `Supplier PO ${run}`, paymentTermDays: 30 }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `P${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  sak = (await db.insert(unitsOfMeasure).values({ code: `S${run}`, name: 'SAK tes' }).returning())[0].id

  // Modal lama (Manajemen Harga) per SAK: A 9.500, B 20.000, C 25.000.
  for (const [key, oldCost] of [['A', 9_500], ['B', 20_000], ['C', 25_000]] as const) {
    const [p] = await db.insert(products).values({ name: `${key} ${run}`, baseUomId: pcs, defaultCostPrice: oldCost / 25 }).returning()
    product[key] = p.id
    await db.insert(productUomConversions).values({ productId: p.id, uomId: sak, ratio: 25 })
    await db.insert(productUomCosts).values([
      { productId: p.id, branchId, uomId: sak, costPrice: oldCost },
      { productId: p.id, branchId, uomId: pcs, costPrice: oldCost / 25 },
    ])
  }

  // PO disetujui. Harga rencana: A 10.000, B kosong (menyusul), C 30.000.
  const [po] = await db.insert(purchaseOrders).values({
    poNumber: `PO-TES-${run}`, branchId, supplierId, status: 'APPROVED', totalAmount: 0, createdById: userId,
  }).returning()
  poId = po.id
  for (const [key, plan, qty] of [['A', 10_000, 10], ['B', 0, 5], ['C', 30_000, 2]] as const) {
    const [item] = await db.insert(purchaseOrderItems).values({
      poId, productId: product[key], uomId: sak, qtyOrdered: qty, unitCost: plan,
    }).returning()
    itemId[key] = item.id
  }
})

describe('alur PO baru (DB lokal)', () => {
  it('1. terima barang: harga diketik jadi harga faktur, kosong = 0 (menunggu faktur)', async () => {
    expect((await receiveAll()).status).toBe(200)
    const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, poId))
    const by = (id: number) => items.find(i => i.id === id)!
    expect(by(itemId.A).invoiceUnitCost).toBe(12_000)
    expect(by(itemId.B).invoiceUnitCost).toBe(0)
    expect(by(itemId.C).invoiceUnitCost).toBe(0)
    expect(poStage(await poStatus(), await pendingCount())).toBe('DITERIMA')
  })

  it('2. batalkan input penerimaan: qty kembali 0, log terhapus, PO Disetujui, tanpa stok', async () => {
    const res = await cancelReceivingRoute(json({ reason: 'tes: salah hitung' }), params(poId))
    expect(res.status).toBe(200)
    expect(await poStatus()).toBe('APPROVED')
    const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, poId))
    expect(items.every(i => i.qtyReceived === 0)).toBe(true)
    expect(await db.select().from(poReceivingLogs).where(eq(poReceivingLogs.poId, poId))).toHaveLength(0)
    expect(await db.select().from(productStockBatches).where(eq(productStockBatches.purchaseOrderId, poId))).toHaveLength(0)
    const [audit] = await db.select().from(auditLogs).where(and(eq(auditLogs.action, 'PO_RECEIVING_CANCELLED'), eq(auditLogs.recordId, String(poId))))
    expect(JSON.parse(audit.newData!).reason).toBe('tes: salah hitung')
  })

  it('3. terima ulang lalu setujui: stok masuk, hutang perkiraan, modal lama C tidak tertimpa harga rencana', async () => {
    expect((await receiveAll()).status).toBe(200)
    expect((await approveReceivingRoute(new Request('http://localhost', { method: 'PATCH' }), params(poId))).status).toBe(200)

    expect(await poStatus()).toBe('COMPLETED')
    expect(await pendingCount()).toBe(2) // B & C
    expect(poStage('COMPLETED', await pendingCount())).toBe('BELUM_HARGA')

    // Hutang: A 10×12.000 + B 5×0 (rencana kosong) + C 2×30.000 (rencana sbg perkiraan)
    const [payable] = await db.select().from(supplierPayables).where(eq(supplierPayables.poId, poId))
    expect(payable.totalAmount).toBe(180_000)
    // Perkiraan tambahan B dari modal lama: 5 × 20.000
    const est = (await loadPendingPriceEstimates([poId])).get(poId)!
    expect(est).toEqual({ pendingItems: 2, extraEstimate: 100_000 })

    // Modal batch: A dari harga faktur, B dari modal lama, C dari harga rencana (perkiraan); per PCS
    const batches = await db.select().from(productStockBatches).where(eq(productStockBatches.purchaseOrderId, poId))
    const batchCost = (pid: number) => batches.find(b => b.productId === pid)!.costPrice
    expect(batchCost(product.A)).toBe(480)
    expect(batchCost(product.B)).toBe(800)
    expect(batchCost(product.C)).toBe(1_200)

    // Manajemen Harga: A ikut harga faktur; B & C TIDAK berubah sebelum faktur diisi
    expect(await sakCost(product.A)).toBe(12_000)
    expect(await sakCost(product.B)).toBe(20_000)
    expect(await sakCost(product.C)).toBe(25_000)
  })

  it('4. isi harga faktur: hutang lengkap, PO Selesai, modal diperbarui', async () => {
    const res = await updateInvoiceRoute(json({
      invoiceNumber: `INV-${run}`,
      items: [
        { id: itemId.A, invoiceUnitCost: 12_000 },
        { id: itemId.B, invoiceUnitCost: 21_000 },
        { id: itemId.C, invoiceUnitCost: 31_000 },
      ],
    }, 'PATCH'), params(poId))
    expect(res.status).toBe(200)
    expect(await pendingCount()).toBe(0)
    expect(poStage(await poStatus(), 0)).toBe('SELESAI')

    const [payable] = await db.select().from(supplierPayables).where(eq(supplierPayables.poId, poId))
    expect(payable.totalAmount).toBe(10 * 12_000 + 5 * 21_000 + 2 * 31_000)
    expect(payable.status).toBe('UNPAID')
    expect(await sakCost(product.B)).toBe(21_000)
    expect(await sakCost(product.C)).toBe(31_000)
  })

  it('5. bayar lunas dengan tanggal mundur → Lunas, tanggal bayar sesuai', async () => {
    const [payable] = await db.select().from(supplierPayables).where(eq(supplierPayables.poId, poId))
    const res = await payRoute(json({ amount: payable.totalAmount, method: 'TRANSFER BCA', paidDate: '2026-10-01' }), params(payable.id))
    expect(res.status).toBe(201)
    const [after] = await db.select().from(supplierPayables).where(eq(supplierPayables.id, payable.id))
    expect(after.status).toBe('PAID')
    const [payment] = await db.select().from(supplierPayablePayments).where(eq(supplierPayablePayments.payableId, payable.id))
    expect(payment.paidAt.toISOString()).toBe('2026-10-01T05:00:00.000Z')
  })

  it('6. input penerimaan yang sudah disetujui tidak bisa dibatalkan lewat jalur ini', async () => {
    const res = await cancelReceivingRoute(json({ reason: 'tes: harus ditolak' }), params(poId))
    expect(res.status).toBe(409)
  })
})
