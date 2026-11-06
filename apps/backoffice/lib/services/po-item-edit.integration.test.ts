import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, suppliers, roles, users,
  purchaseOrders, purchaseOrderItems, poReceivingLogs, poReceivingItems, auditLogs, eq, and,
} from '../db'
import { editPoItems, PoItemEditError, type PoItemInput } from './po-item-edit'

// Ubah isi PO Supplier (spec 2026-11-06-po-edit-items): PO Disetujui kembali Menunggu Persetujuan,
// hanya OWNER/GM, baris yang sudah diterima terkunci, PO Selesai ditolak.
const run = randomUUID().slice(0, 8)
let branchId: number
let userId: number
let supplierId: number
let pcs: number
let productA: number
let productB: number
let seq = 0

const owner = () => ({ userId, role: 'OWNER', branchScope: 'ALL', branchId })

async function makePo(status: string, received = 0) {
  seq += 1
  const [po] = await db.insert(purchaseOrders).values({
    poNumber: `PO-UBH-${run}-${seq}`, branchId, supplierId, status, totalAmount: 10_000, createdById: userId,
    approvedById: status === 'APPROVED' ? userId : null, approvedAt: status === 'APPROVED' ? new Date() : null,
  }).returning()
  const [item] = await db.insert(purchaseOrderItems).values({
    poId: po.id, productId: productA, uomId: pcs, qtyOrdered: 10, qtyReceived: received, unitCost: 1_000,
  }).returning()
  if (received > 0) {
    const [log] = await db.insert(poReceivingLogs).values({ poId: po.id, receivedById: userId }).returning()
    await db.insert(poReceivingItems).values({ logId: log.id, poItemId: item.id, qtyReceived: received, qtyDamaged: 0 })
  }
  return { poId: po.id, itemId: item.id }
}

const edit = (poId: number, items: PoItemInput[], actor = owner()) =>
  db.transaction(tx => editPoItems(tx, { poId, items, actor }))

async function readPo(poId: number) {
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId))
  const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, poId))
  return { po, items }
}

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `UBH${run}`, name: `Gudang Ubah ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `UBH${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `UBH${run}`, roleId, branchId }).returning())[0].id
  supplierId = (await db.insert(suppliers).values({ name: `Supplier Ubah ${run}`, paymentTermDays: 30 }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `U${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  productA = (await db.insert(products).values({ name: `Barang A ${run}`, baseUomId: pcs, defaultCostPrice: 1_000 }).returning())[0].id
  productB = (await db.insert(products).values({ name: `Barang B ${run}`, baseUomId: pcs, defaultCostPrice: 2_000 }).returning())[0].id
})

describe('Ubah isi PO (DB lokal)', () => {
  it('PO Disetujui + barang tambahan → kembali Menunggu Persetujuan, total dihitung ulang, tercatat di audit', async () => {
    const { poId, itemId } = await makePo('APPROVED')
    const result = await edit(poId, [
      { productId: productA, uomId: pcs, qtyOrdered: 10, unitCost: 1_000 },
      { productId: productB, uomId: pcs, qtyOrdered: 3, unitCost: 2_500 },
    ])
    expect(result).toMatchObject({ changed: true, backToApproval: true, status: 'PENDING_APPROVAL', totalAmount: 17_500 })
    const { po, items } = await readPo(poId)
    expect(po.status).toBe('PENDING_APPROVAL')
    expect(po.approvedById).toBeNull()
    expect(po.totalAmount).toBe(17_500)
    expect(items.map(i => i.id)).toContain(itemId)
    expect(items).toHaveLength(2)
    const [audit] = await db.select().from(auditLogs).where(and(eq(auditLogs.action, 'PO_ITEMS_UPDATED'), eq(auditLogs.recordId, String(poId))))
    expect(JSON.parse(audit.oldData!).status).toBe('APPROVED')
  })

  it('tanpa perubahan → status tetap Disetujui', async () => {
    const { poId } = await makePo('APPROVED')
    const result = await edit(poId, [{ productId: productA, uomId: pcs, qtyOrdered: 10, unitCost: 1_000 }])
    expect(result.changed).toBe(false)
    expect((await readPo(poId)).po.status).toBe('APPROVED')
  })

  it('selain OWNER/GM ditolak untuk PO yang sudah disimpan', async () => {
    const { poId } = await makePo('PENDING_APPROVAL')
    await expect(edit(poId, [{ productId: productA, uomId: pcs, qtyOrdered: 5, unitCost: 1_000 }], { ...owner(), role: 'ADMIN' }))
      .rejects.toMatchObject({ status: 403 })
  })

  it('penerimaan berjalan: tambah barang boleh, status tetap; qty di bawah diterima & hapus baris diterima ditolak', async () => {
    const { poId } = await makePo('PARTIALLY_RECEIVED', 6)
    await expect(edit(poId, [{ productId: productA, uomId: pcs, qtyOrdered: 5, unitCost: 1_000 }])).rejects.toBeInstanceOf(PoItemEditError)
    await expect(edit(poId, [{ productId: productB, uomId: pcs, qtyOrdered: 1, unitCost: 2_000 }])).rejects.toThrow(/tidak bisa dihapus/)

    const result = await edit(poId, [
      { productId: productA, uomId: pcs, qtyOrdered: 12, unitCost: 1_000 },
      { productId: productB, uomId: pcs, qtyOrdered: 2, unitCost: 2_000 },
    ])
    expect(result).toMatchObject({ backToApproval: false, status: 'PARTIALLY_RECEIVED', totalAmount: 16_000 })
    const { items } = await readPo(poId)
    expect(items.find(i => i.productId === productA)).toMatchObject({ qtyOrdered: 12, qtyReceived: 6 })
  })

  it('PO Selesai ditolak dengan arahan PO Tambahan', async () => {
    const { poId } = await makePo('COMPLETED')
    await expect(edit(poId, [{ productId: productA, uomId: pcs, qtyOrdered: 11, unitCost: 1_000 }])).rejects.toThrow(/PO Tambahan/)
  })
})
