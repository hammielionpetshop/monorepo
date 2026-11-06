import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productUomConversions, suppliers, roles, users,
  purchaseOrders, purchaseOrderItems, purchaseOrderAttachments, purchaseOrderUnloadings, eq,
} from '../db'
import { syncUnloading, UnloadingSyncError, type UnloadingSyncInput } from './po-unloading'

// Laporan Bongkaran HRIS → PO di DB lokal (spec 2026-11-06 §3.4).
const run = randomUUID().slice(0, 8)
let branchId: number
let userId: number
let supplierId: number
let otherSupplierId: number
let pcs: number
let sak: number
let productId: number
let product2Id: number
let reportSeq = 900_000 + Math.floor(Math.random() * 90_000)

const actor = () => ({ localUserId: userId, branchId })

function input(overrides: Partial<UnloadingSyncInput> = {}): UnloadingSyncInput {
  return {
    reportId: reportSeq, number: `LB-${run}`, version: 1, mode: 'DRAFT', supplierId,
    items: [{ productId, uomId: sak, qty: 10 }], weights: [], photos: [], ...overrides,
  }
}
const key = (i: UnloadingSyncInput) => `unloading:${i.reportId}:v${i.version}:${i.mode}`
const sync = (i: UnloadingSyncInput) => syncUnloading(i, actor(), key(i))
const itemsOf = (poId: number) => db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, poId))
const poOf = async (poId: number) => (await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)))[0]

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `BGK${run}`, name: `Gudang Bongkar ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `BGK${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `BGK${run}`, roleId, branchId }).returning())[0].id
  supplierId = (await db.insert(suppliers).values({ name: `Supplier Bongkar ${run}` }).returning())[0].id
  otherSupplierId = (await db.insert(suppliers).values({ name: `Supplier Lain ${run}` }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `P${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  sak = (await db.insert(unitsOfMeasure).values({ code: `S${run}`, name: 'SAK tes', isBase: false }).returning())[0].id
  productId = (await db.insert(products).values({ name: `Pakan Bongkar ${run}`, baseUomId: pcs, defaultCostPrice: 1_000 }).returning())[0].id
  product2Id = (await db.insert(products).values({ name: `Pasir Bongkar ${run}`, baseUomId: pcs, defaultCostPrice: 1_000 }).returning())[0].id
  await db.insert(productUomConversions).values({ productId, uomId: sak, ratio: 20, weightGram: 20_000 })
})

describe('Bongkaran → Draft PO (DB lokal)', () => {
  it('buat Draft; kiriman ulang kunci sama = jawaban sama, tidak lahir Draft kedua', async () => {
    reportSeq += 1
    const first = await sync(input({ photos: [{ url: '/uploads/a.jpg', kind: 'DELIVERY_NOTE', hrisFileId: `f-${run}-1` }] }))
    expect(first.action).toBe('CREATED')
    expect(first.status).toBe('DRAFT')
    const again = await sync(input())
    expect(again).toEqual(first)
    const po = await poOf(first.poId!)
    expect(po.branchId).toBe(branchId)
    expect(po.createdById).toBe(userId)
    expect(po.notes).toContain(`LB-${run}`)
    const [item] = await itemsOf(first.poId!)
    expect(item).toMatchObject({ qtyOrdered: 10, qtyUnloaded: 10, unitCost: 0 })
    expect(await db.select().from(purchaseOrderAttachments).where(eq(purchaseOrderAttachments.poId, first.poId!))).toHaveLength(1)
  })

  it('koreksi saat masih Draft: isi diganti, harga yang sudah diisi kantor dipertahankan', async () => {
    reportSeq += 1
    const created = await sync(input())
    await db.update(purchaseOrderItems).set({ unitCost: 150_000 }).where(eq(purchaseOrderItems.poId, created.poId!))
    const corrected = await sync(input({ version: 2, items: [{ productId, uomId: sak, qty: 12 }, { productId: product2Id, uomId: pcs, qty: 3 }] }))
    expect(corrected.action).toBe('REPLACED')
    expect(corrected.poId).toBe(created.poId)
    const items = await itemsOf(created.poId!)
    expect(items.find((i) => i.productId === productId)).toMatchObject({ qtyOrdered: 12, unitCost: 150_000 })
    expect(items.find((i) => i.productId === product2Id)).toMatchObject({ qtyOrdered: 3, unitCost: 0 })
    expect((await poOf(created.poId!)).totalAmount).toBe(12 * 150_000)
  })

  it('koreksi sesudah disetujui: PO tidak diubah, hanya tanda berubah; batal laporan = tanda juga', async () => {
    reportSeq += 1
    const created = await sync(input())
    await db.update(purchaseOrders).set({ status: 'APPROVED' }).where(eq(purchaseOrders.id, created.poId!))
    const corrected = await sync(input({ version: 2, items: [{ productId, uomId: sak, qty: 8 }] }))
    expect(corrected.action).toBe('FLAGGED')
    expect((await itemsOf(created.poId!))[0].qtyOrdered).toBe(10)
    const cancelled = await sync(input({ version: 3, mode: 'CANCEL', items: [] }))
    expect(cancelled.action).toBe('FLAGGED')
    expect((await poOf(created.poId!)).status).toBe('APPROVED')
    const flags = await db.select().from(purchaseOrderUnloadings).where(eq(purchaseOrderUnloadings.poId, created.poId!))
    expect(flags.filter((f) => f.changedAfterApprovalAt)).toHaveLength(2)
  })

  it('batal laporan saat Draft: Draft ikut batal', async () => {
    reportSeq += 1
    const created = await sync(input())
    const cancelled = await sync(input({ version: 2, mode: 'CANCEL', items: [] }))
    expect(cancelled.action).toBe('CANCELLED')
    expect((await poOf(created.poId!)).status).toBe('CANCELLED')
  })

  it('PO yang ada: jumlah bongkaran diisi ke baris PO; supplier beda ditolak', async () => {
    const [po] = await db.insert(purchaseOrders).values({
      poNumber: `PO-BGK-${run}`, branchId, supplierId, status: 'APPROVED', totalAmount: 0, createdById: userId,
    }).returning()
    await db.insert(purchaseOrderItems).values({ poId: po.id, productId, uomId: sak, qtyOrdered: 10, unitCost: 100 })
    reportSeq += 1
    await expect(sync(input({ mode: 'MATCHED', poId: po.id, supplierId: otherSupplierId }))).rejects.toBeInstanceOf(UnloadingSyncError)
    const matched = await sync(input({ mode: 'MATCHED', poId: po.id, items: [{ productId, uomId: sak, qty: 9 }] }))
    expect(matched.action).toBe('MATCHED')
    expect((await itemsOf(po.id))[0]).toMatchObject({ qtyOrdered: 10, qtyUnloaded: 9 })
  })

  it('berat: tersimpan ke POS; nilai POS yang berubah di tengah jalan ditolak', async () => {
    reportSeq += 1
    await sync(input({ weights: [{ productId, uomId: sak, gram: 25_000, expectedGram: 20_000 }, { productId: product2Id, uomId: pcs, gram: 1_500, expectedGram: null }] }))
    const [conv] = await db.select().from(productUomConversions).where(eq(productUomConversions.productId, productId))
    expect(conv.weightGram).toBe(25_000)
    expect((await db.select().from(products).where(eq(products.id, product2Id)))[0].weightGram).toBe(1_500)
    reportSeq += 1
    await expect(sync(input({ weights: [{ productId, uomId: sak, gram: 30_000, expectedGram: 20_000 }] }))).rejects.toThrow(/baru saja diubah/)
    expect((await db.select().from(productUomConversions).where(eq(productUomConversions.productId, productId)))[0].weightGram).toBe(25_000)
  })

  it('jumlah pecahan ditolak (PO memakai jumlah bulat)', async () => {
    reportSeq += 1
    await expect(sync(input({ items: [{ productId, uomId: sak, qty: 1.5 }] }))).rejects.toThrow(/bulat/)
  })
})
