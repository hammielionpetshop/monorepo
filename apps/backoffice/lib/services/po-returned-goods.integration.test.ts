import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productUomConversions, productUomCosts, productStockBatches,
  productCostSyncs, suppliers, roles, users, purchaseOrders, purchaseOrderItems, supplierPayables, eq, and,
} from '../db'

vi.mock('@/lib/authz', () => ({
  requirePermission: async () => ({ userId, branchId, branchScope: 'ALL' }),
  getAuth: async () => ({ userId, branchId, branchScope: 'ALL' }),
  hasPermission: () => true,
}))

import { POST as receiveRoute } from '../../app/api/bo/purchase-orders/[id]/receive/route'
import { PATCH as approveReceivingRoute } from '../../app/api/bo/purchase-orders/[id]/approve-receiving/route'
import { PATCH as updateInvoiceRoute } from '../../app/api/bo/purchase-orders/[id]/update-invoice/route'

// PO "Barang kembali" (keep_current_cost) + Total PO saat barang datang melebihi pesanan.
// Satuan: PCS (dasar), SAK = 25 PCS. Modal cabang 10.000/SAK (= 400/PCS).
const run = randomUUID().slice(0, 8)
let branchId: number
let userId: number
let supplierId: number
let pcs: number
let sak: number
let withCost: number
let noCost: number

const json = (body: unknown) =>
  new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
const approve = (poId: number) => approveReceivingRoute(new Request('http://localhost', { method: 'PATCH' }), params(poId))

async function createPo(productId: number, keepCurrentCost: boolean, qtyOrdered: number, unitCost: number) {
  const [po] = await db.insert(purchaseOrders).values({
    poNumber: `PO-BK-${run}-${keepCurrentCost ? 'K' : 'N'}-${productId}`, branchId, supplierId, status: 'APPROVED',
    totalAmount: qtyOrdered * unitCost, createdById: userId, keepCurrentCost,
  }).returning()
  const [item] = await db.insert(purchaseOrderItems).values({ poId: po.id, productId, uomId: sak, qtyOrdered, unitCost }).returning()
  return { poId: po.id, itemId: item.id }
}
async function receive(poId: number, itemId: number, qty: number, unitPrice: number) {
  return receiveRoute(json({
    invoiceReceived: true,
    note: 'tes: datang lebih',
    items: [{ poItemId: itemId, qtyReceived: qty, qtyDamaged: 0, unitPrice }],
  }), params(poId))
}
async function sakCost(productId: number) {
  const [row] = await db.select({ cost: productUomCosts.costPrice }).from(productUomCosts)
    .where(and(eq(productUomCosts.productId, productId), eq(productUomCosts.branchId, branchId), eq(productUomCosts.uomId, sak)))
  return row?.cost ?? null
}
async function poTotal(poId: number) {
  const [row] = await db.select({ total: purchaseOrders.totalAmount }).from(purchaseOrders).where(eq(purchaseOrders.id, poId))
  return row.total
}
async function payableTotal(poId: number) {
  const [row] = await db.select({ total: supplierPayables.totalAmount }).from(supplierPayables).where(eq(supplierPayables.poId, poId))
  return row?.total ?? null
}
async function batchCosts(poId: number) {
  const rows = await db.select({ cost: productStockBatches.costPrice }).from(productStockBatches)
    .where(eq(productStockBatches.purchaseOrderId, poId))
  return rows.map(r => r.cost)
}

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `BK${run}`, name: `Gudang BK ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `BK${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `BK${run}`, roleId, branchId }).returning())[0].id
  supplierId = (await db.insert(suppliers).values({ name: `Rekan BK ${run}`, paymentTermDays: 0 }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `P${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  sak = (await db.insert(unitsOfMeasure).values({ code: `S${run}`, name: 'SAK tes' }).returning())[0].id

  for (const [key, cost] of [['with', 10_000], ['none', null]] as const) {
    const [p] = await db.insert(products).values({ name: `BK ${key} ${run}`, baseUomId: pcs }).returning()
    await db.insert(productUomConversions).values({ productId: p.id, uomId: sak, ratio: 25 })
    if (cost) {
      await db.insert(productUomCosts).values([
        { productId: p.id, branchId, uomId: sak, costPrice: cost },
        { productId: p.id, branchId, uomId: pcs, costPrice: cost / 25 },
      ])
      withCost = p.id
    } else {
      noCost = p.id
    }
  }
})

describe('PO Barang kembali (DB lokal)', () => {
  it('hutang & total memakai harga sebenarnya, HPP batch = modal cabang, modal tidak berubah', async () => {
    const { poId, itemId } = await createPo(withCost, true, 10, 12_000)
    expect((await receive(poId, itemId, 12, 12_000)).status).toBe(200)
    expect((await approve(poId)).status).toBe(200)

    expect(await payableTotal(poId)).toBe(144_000)
    expect(await poTotal(poId)).toBe(144_000) // 12 SAK (lebih dari pesanan 10) × 12.000
    expect(await batchCosts(poId)).toEqual([400]) // modal cabang per PCS, bukan 12.000/25
    expect(await sakCost(withCost)).toBe(10_000)
    const syncs = await db.select().from(productCostSyncs).where(eq(productCostSyncs.productId, withCost))
    expect(syncs).toHaveLength(0)

    // Harga faktur diubah: hutang & total ikut, HPP batch dan modal tetap.
    const res = await updateInvoiceRoute(json({ invoiceNumber: `INV-BK-${run}`, items: [{ id: itemId, invoiceUnitCost: 13_000 }] }), params(poId))
    expect(res.status).toBe(200)
    expect(await payableTotal(poId)).toBe(156_000)
    expect(await poTotal(poId)).toBe(156_000)
    expect(await batchCosts(poId)).toEqual([400])
    expect(await sakCost(withCost)).toBe(10_000)
  })

  it('menolak persetujuan bila barang belum punya modal di cabang', async () => {
    const { poId, itemId } = await createPo(noCost, true, 2, 5_000)
    expect((await receive(poId, itemId, 2, 5_000)).status).toBe(200)
    const res = await approve(poId)
    expect(res.status).toBe(409)
    expect(await batchCosts(poId)).toEqual([])
    expect(await payableTotal(poId)).toBeNull()
  })

  it('PO biasa yang datang melebihi pesanan: Total PO ikut qty diterima', async () => {
    const { poId, itemId } = await createPo(withCost, false, 4, 10_000)
    expect((await receive(poId, itemId, 6, 10_000)).status).toBe(200)
    expect((await approve(poId)).status).toBe(200)
    expect(await poTotal(poId)).toBe(60_000)
    expect(await payableTotal(poId)).toBe(60_000)
  })
})
