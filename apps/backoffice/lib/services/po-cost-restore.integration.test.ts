import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productUomConversions, productUomCosts, productStockBatches,
  priceReviews, suppliers, roles, users, purchaseOrders, purchaseOrderItems, supplierPayables, auditLogs, eq, and,
} from '../db'

vi.mock('@/lib/authz', () => ({
  requirePermission: async () => ({ userId, branchId, branchScope: 'ALL' }),
  getAuth: async () => ({ userId, branchId, branchScope: 'ALL' }),
  hasPermission: () => true,
}))

import { POST as receiveRoute } from '../../app/api/bo/purchase-orders/[id]/receive/route'
import { PATCH as approveReceivingRoute } from '../../app/api/bo/purchase-orders/[id]/approve-receiving/route'
import { PATCH as updateInvoiceRoute } from '../../app/api/bo/purchase-orders/[id]/update-invoice/route'
import { POST as restoreCostRoute } from '../../app/api/bo/purchase-orders/[id]/restore-cost/route'

// Kembalikan Modal dari PO Selesai. Satuan PCS (dasar), SAK = 25 PCS.
// A: modal 10.000/SAK, PO 12.000 (naik 20% → langsung berlaku).
// B: modal 10.000/SAK, PO 15.000 (naik 50% → ditahan di Tinjauan Modal).
// C: belum bermodal sebelum PO, PO 8.000.
const run = randomUUID().slice(0, 8)
let branchId: number
let userId: number
let pcs: number
let sak: number
let poId: number
const product: Record<'A' | 'B' | 'C', number> = { A: 0, B: 0, C: 0 }
const itemId: Record<'A' | 'B' | 'C', number> = { A: 0, B: 0, C: 0 }

const json = (body: unknown) =>
  new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })

async function cost(productId: number, uomId: number) {
  const [row] = await db.select({ cost: productUomCosts.costPrice }).from(productUomCosts)
    .where(and(eq(productUomCosts.productId, productId), eq(productUomCosts.branchId, branchId), eq(productUomCosts.uomId, uomId)))
  return row?.cost ?? null
}
async function openReviews(productId: number) {
  const rows = await db.select({ id: priceReviews.id }).from(priceReviews)
    .where(and(eq(priceReviews.productId, productId), eq(priceReviews.branchId, branchId), eq(priceReviews.status, 'OPEN')))
  return rows.length
}

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `KM${run}`, name: `Gudang KM ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `KM${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `KM${run}`, roleId, branchId }).returning())[0].id
  const supplierId = (await db.insert(suppliers).values({ name: `Rekan KM ${run}`, paymentTermDays: 0 }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `P${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  sak = (await db.insert(unitsOfMeasure).values({ code: `S${run}`, name: 'SAK tes' }).returning())[0].id

  for (const [key, oldCost] of [['A', 10_000], ['B', 10_000], ['C', null]] as const) {
    const [p] = await db.insert(products).values({ name: `KM ${key} ${run}`, baseUomId: pcs }).returning()
    product[key] = p.id
    await db.insert(productUomConversions).values({ productId: p.id, uomId: sak, ratio: 25 })
    if (oldCost) {
      await db.insert(productUomCosts).values([
        { productId: p.id, branchId, uomId: sak, costPrice: oldCost },
        { productId: p.id, branchId, uomId: pcs, costPrice: oldCost / 25 },
      ])
    }
  }

  const [po] = await db.insert(purchaseOrders).values({
    poNumber: `PO-KM-${run}`, branchId, supplierId, status: 'APPROVED', totalAmount: 0, createdById: userId,
  }).returning()
  poId = po.id
  for (const [key, price] of [['A', 12_000], ['B', 15_000], ['C', 8_000]] as const) {
    const [item] = await db.insert(purchaseOrderItems).values({ poId, productId: product[key], uomId: sak, qtyOrdered: 2, unitCost: price }).returning()
    itemId[key] = item.id
  }

  const received = await receiveRoute(json({
    invoiceReceived: true,
    items: (['A', 'B', 'C'] as const).map(k => ({ poItemId: itemId[k], qtyReceived: 2, qtyDamaged: 0, unitPrice: k === 'A' ? 12_000 : k === 'B' ? 15_000 : 8_000 })),
  }), params(poId))
  expect(received.status).toBe(200)
  expect((await approveReceivingRoute(new Request('http://localhost', { method: 'PATCH' }), params(poId))).status).toBe(200)
})

describe('Kembalikan Modal dari PO (DB lokal)', () => {
  it('sebelum: modal A naik, B ditahan, C terisi dari PO', async () => {
    expect(await cost(product.A, sak)).toBe(12_000)
    expect(await cost(product.B, sak)).toBe(10_000)
    expect(await cost(product.C, sak)).toBe(8_000)
    expect(await openReviews(product.A)).toBe(1)
  })

  it('menolak tanpa alasan', async () => {
    expect((await restoreCostRoute(json({ reason: ' ' }), params(poId))).status).toBe(400)
  })

  it('mengembalikan modal ke sebelum PO; harga PO, hutang, dan HPP batch tetap', async () => {
    const [payableBefore] = await db.select({ total: supplierPayables.totalAmount }).from(supplierPayables).where(eq(supplierPayables.poId, poId))
    const batchesBefore = await db.select({ id: productStockBatches.id, cost: productStockBatches.costPrice }).from(productStockBatches)
      .where(eq(productStockBatches.purchaseOrderId, poId))

    const res = await restoreCostRoute(json({ reason: 'harga beli rekan, bukan modal' }), params(poId))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.restored).toEqual([`KM A ${run}`])
    expect(body.pendingClosed).toEqual([`KM B ${run}`])
    expect(body.skipped).toEqual([{ name: `KM C ${run}`, reason: 'NO_OLD' }])

    expect(await cost(product.A, sak)).toBe(10_000)
    expect(await cost(product.A, pcs)).toBe(400)
    expect(await cost(product.B, sak)).toBe(10_000)
    expect(await cost(product.C, sak)).toBe(8_000)
    expect(await openReviews(product.A)).toBe(0)
    expect(await openReviews(product.B)).toBe(0)

    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId))
    expect(po.keepCurrentCost).toBe(true)
    const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, poId))
    expect(items.find(i => i.id === itemId.A)!.invoiceUnitCost).toBe(12_000)
    const [payableAfter] = await db.select({ total: supplierPayables.totalAmount }).from(supplierPayables).where(eq(supplierPayables.poId, poId))
    expect(payableAfter.total).toBe(payableBefore.total)
    const batchesAfter = await db.select({ id: productStockBatches.id, cost: productStockBatches.costPrice }).from(productStockBatches)
      .where(eq(productStockBatches.purchaseOrderId, poId))
    expect(batchesAfter).toEqual(expect.arrayContaining(batchesBefore))

    const [audit] = await db.select().from(auditLogs).where(and(eq(auditLogs.action, 'PO_COST_RESTORED'), eq(auditLogs.recordId, String(poId))))
    expect(JSON.parse(audit.newData!).reason).toBe('harga beli rekan, bukan modal')
  })

  it('sesudahnya harga faktur diubah tidak menaikkan modal lagi; tombol tidak bisa dipakai dua kali', async () => {
    const res = await updateInvoiceRoute(json({ invoiceNumber: `INV-KM-${run}`, items: [{ id: itemId.A, invoiceUnitCost: 13_000 }] }), params(poId))
    expect(res.status).toBe(200)
    expect(await cost(product.A, sak)).toBe(10_000)
    expect((await restoreCostRoute(json({ reason: 'kedua kali' }), params(poId))).status).toBe(409)
  })
})
