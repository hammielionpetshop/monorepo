import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productUomConversions, productUomCosts, productStockBatches,
  suppliers, roles, users, purchaseOrders, purchaseOrderItems, supplierPayables, eq, and,
} from '../db'

vi.mock('@/lib/authz', () => ({
  requirePermission: async () => ({ userId, branchId, branchScope: 'ALL', role: 'OWNER' }),
  getAuth: async () => ({ userId, branchId, branchScope: 'ALL', role: 'OWNER' }),
  hasPermission: () => true,
}))

import { POST as createPoRoute } from '../../app/api/bo/purchase-orders/route'
import { POST as receiveRoute } from '../../app/api/bo/purchase-orders/[id]/receive/route'
import { PATCH as approveReceivingRoute } from '../../app/api/bo/purchase-orders/[id]/approve-receiving/route'
import { PATCH as updateInvoiceRoute } from '../../app/api/bo/purchase-orders/[id]/update-invoice/route'
import { editPoItems, PoItemEditError } from './po-item-edit'
import { loadReturnablePoItems } from './supplier-return-service'

// Diskon rupiah atas total PO (owner 2026-11-25): PO 20 SAK × 50.000 = 1.000.000, diskon 200.000.
// Satuan: PCS (dasar), SAK = 25 PCS.
const run = randomUUID().slice(0, 8)
let branchId: number
let userId: number
let supplierId: number
let pcs: number
let sak: number
let productId: number

const json = (body: unknown) =>
  new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
const approve = (poId: number) => approveReceivingRoute(new Request('http://localhost', { method: 'PATCH' }), params(poId))
const actor = () => ({ userId, role: 'OWNER', branchScope: 'ALL', branchId })

async function createPo(discountAmount?: number) {
  const res = await createPoRoute(json({
    branchId, supplierId, items: [{ productId, uomId: sak, qtyOrdered: 20, unitCost: 50_000 }],
    ...(discountAmount !== undefined && { discountAmount }),
  }))
  const data = await res.json()
  return { res, poId: data.po?.id }
}
async function header(poId: number) {
  const [row] = await db.select({ total: purchaseOrders.totalAmount, discount: purchaseOrders.discountAmount })
    .from(purchaseOrders).where(eq(purchaseOrders.id, poId))
  return row
}
async function itemOf(poId: number) {
  const [row] = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, poId))
  return row
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
async function sakCost() {
  const [row] = await db.select({ cost: productUomCosts.costPrice }).from(productUomCosts)
    .where(and(eq(productUomCosts.productId, productId), eq(productUomCosts.branchId, branchId), eq(productUomCosts.uomId, sak)))
  return row?.cost ?? null
}

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `DS${run}`, name: `Gudang DS ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `DS${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `DS${run}`, roleId, branchId }).returning())[0].id
  supplierId = (await db.insert(suppliers).values({ name: `Rekan DS ${run}`, paymentTermDays: 0 }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `P${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  sak = (await db.insert(unitsOfMeasure).values({ code: `S${run}`, name: 'SAK tes' }).returning())[0].id
  const [p] = await db.insert(products).values({ name: `DS ${run}`, baseUomId: pcs }).returning()
  productId = p.id
  await db.insert(productUomConversions).values({ productId, uomId: sak, ratio: 25 })
})

describe('Diskon PO (DB lokal)', () => {
  it('buat PO: total disimpan sesudah diskon; diskon ≥ total ditolak', async () => {
    const { res, poId } = await createPo(200_000)
    expect(res.status).toBeLessThan(300)
    expect(await header(poId)).toEqual({ total: 800_000, discount: 200_000 })

    const tooBig = await createPo(1_000_000)
    expect(tooBig.res.status).toBe(400)
  })

  it('barang datang separuh → hutang & modal ikut persentase diskon; faktur bisa mengubah diskon', async () => {
    const { poId } = await createPo(200_000)
    await db.update(purchaseOrders).set({ status: 'APPROVED' }).where(eq(purchaseOrders.id, poId))
    const item = await itemOf(poId)
    const received = await receiveRoute(json({
      invoiceReceived: true, note: 'tes diskon',
      items: [{ poItemId: item.id, qtyReceived: 10, qtyDamaged: 0, unitPrice: 50_000 }],
    }), params(poId))
    expect(received.status).toBe(200)
    expect((await approve(poId)).status).toBe(200)

    // 10 SAK × 50.000 × 0,8 = 400.000; modal 40.000/SAK = 1.600/PCS
    expect(await payableTotal(poId)).toBe(400_000)
    expect(await batchCosts(poId)).toEqual([1_600])
    expect(await sakCost()).toBe(40_000)
    expect(await header(poId)).toEqual({ total: 800_000, discount: 200_000 })

    // Faktur: diskon ternyata 100.000 → faktor 0,9
    const inv = await updateInvoiceRoute(json({
      invoiceNumber: `INV-DS-${run}`, items: [{ id: item.id, invoiceUnitCost: 50_000 }], discountAmount: 100_000,
    }), params(poId))
    expect(inv.status).toBe(200)
    expect(await payableTotal(poId)).toBe(450_000)
    expect(await batchCosts(poId)).toEqual([1_800])
    expect(await header(poId)).toEqual({ total: 900_000, discount: 100_000 })

    // Harga klaim retur supplier ikut harga sesudah diskon
    const [returnable] = await loadReturnablePoItems(db, poId)
    expect(returnable.claimPrice).toBe(45_000)

    // Diskon tidak dikirim → diskon tersimpan dipertahankan
    const keep = await updateInvoiceRoute(json({
      invoiceNumber: `INV-DS-${run}`, items: [{ id: item.id, invoiceUnitCost: 50_000 }],
    }), params(poId))
    expect(keep.status).toBe(200)
    expect(await header(poId)).toEqual({ total: 900_000, discount: 100_000 })
  })

  it('edit isi PO: diskon dipertahankan bila tidak dikirim, ditolak bila ≥ total baru', async () => {
    const { poId } = await createPo(200_000)
    const items = [{ productId, uomId: sak, qtyOrdered: 30, unitCost: 50_000 }]
    await db.transaction(tx => editPoItems(tx, { poId, items, actor: actor() }))
    expect(await header(poId)).toEqual({ total: 1_300_000, discount: 200_000 })

    await db.transaction(tx => editPoItems(tx, { poId, items, discountAmount: 0, actor: actor() }))
    expect(await header(poId)).toEqual({ total: 1_500_000, discount: 0 })

    await expect(db.transaction(tx => editPoItems(tx, {
      poId, items: [{ productId, uomId: sak, qtyOrdered: 1, unitCost: 50_000 }], discountAmount: 50_000, actor: actor(),
    }))).rejects.toBeInstanceOf(PoItemEditError)
  })
})
