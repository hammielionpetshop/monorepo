import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, branches, unitsOfMeasure, products, customers, roles, users, transactions, transactionItems, eq, inArray } from '../db'
import { getLastBulkPrices } from './last-bulk-price'

// Kanban #57 ke DB worktree: harga terakhir per (produk, satuan), hanya nota BULK COMPLETED
// di cabang & customer yang sama.
const run = randomUUID().slice(0, 8)
let branchId: number
let otherBranchId: number
let customerId: number
let otherCustomerId: number
let userId: number
let roleId: number
let pcs: number
let dus: number
let productId: number
const trxIds: number[] = []

async function sale(opts: { branch?: number; customer?: number; saleType?: string; status?: string; createdAt: string; uom?: number; price: number; removed?: boolean }) {
  const [trx] = await db.insert(transactions).values({
    trxNumber: `LP${run}-${trxIds.length}`,
    branchId: opts.branch ?? branchId,
    shiftId: 0,
    cashierId: userId,
    customerId: opts.customer ?? customerId,
    totalAmount: opts.price,
    payableAmount: opts.price,
    paidAmount: opts.price,
    changeAmount: 0,
    status: opts.status ?? 'COMPLETED',
    saleType: opts.saleType ?? 'BULK',
    createdAt: new Date(opts.createdAt),
  }).returning()
  trxIds.push(trx.id)
  await db.insert(transactionItems).values({
    transactionId: trx.id,
    productId,
    uomId: opts.uom ?? dus,
    qty: opts.removed ? 0 : 2,
    unitPrice: opts.price,
    totalPrice: opts.price * 2,
    priceTier: 'GROSIR',
    isRemoved: opts.removed ?? false,
  })
}

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `LPA${run}`, name: `Gudang LP ${run}` }).returning())[0].id
  otherBranchId = (await db.insert(branches).values({ code: `LPB${run}`, name: `Toko LP ${run}` }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `LP${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  dus = (await db.insert(unitsOfMeasure).values({ code: `LD${run}`, name: 'DUS tes' }).returning())[0].id
  productId = (await db.insert(products).values({ name: `LP ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning())[0].id
  customerId = (await db.insert(customers).values({ name: `Cust LP ${run}` }).returning())[0].id
  otherCustomerId = (await db.insert(customers).values({ name: `Cust2 LP ${run}` }).returning())[0].id
  roleId = (await db.insert(roles).values({ name: `LP${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `LP${run}`, roleId, branchId }).returning())[0].id

  await sale({ createdAt: '2026-09-01T03:00:00Z', price: 100000 })
  await sale({ createdAt: '2026-09-10T03:00:00Z', price: 110000 }) // terbaru yang sah untuk DUS
  await sale({ createdAt: '2026-09-15T03:00:00Z', price: 999000, status: 'VOIDED' })
  await sale({ createdAt: '2026-09-16T03:00:00Z', price: 888000, status: 'PENDING_VOID' })
  await sale({ createdAt: '2026-09-17T03:00:00Z', price: 777000, saleType: 'RETAIL' })
  await sale({ createdAt: '2026-09-18T03:00:00Z', price: 666000, branch: otherBranchId })
  await sale({ createdAt: '2026-09-19T03:00:00Z', price: 555000, customer: otherCustomerId })
  await sale({ createdAt: '2026-09-20T03:00:00Z', price: 444000, removed: true })
  await sale({ createdAt: '2026-09-05T03:00:00Z', price: 5000, uom: pcs })
})

afterAll(async () => {
  if (trxIds.length > 0) {
    await db.delete(transactionItems).where(inArray(transactionItems.transactionId, trxIds))
    await db.delete(transactions).where(inArray(transactions.id, trxIds))
  }
  if (productId) await db.delete(products).where(eq(products.id, productId))
  if (customerId) await db.delete(customers).where(inArray(customers.id, [customerId, otherCustomerId]))
  if (userId) await db.delete(users).where(eq(users.id, userId))
  if (roleId) await db.delete(roles).where(eq(roles.id, roleId))
  await db.delete(unitsOfMeasure).where(inArray(unitsOfMeasure.id, [pcs, dus].filter(Boolean)))
  await db.delete(branches).where(inArray(branches.id, [branchId, otherBranchId].filter(Boolean)))
})

describe('getLastBulkPrices', () => {
  it('mengambil harga terbaru per satuan, melewati void/retail/cabang lain/customer lain/baris terhapus', async () => {
    const prices = await getLastBulkPrices(branchId, customerId, [productId])
    const byUom = new Map(prices.map((price) => [price.uomId, price]))
    expect(prices).toHaveLength(2)
    expect(byUom.get(dus)).toMatchObject({ unitPrice: 110000, qty: 2, trxNumber: `LP${run}-1`, soldAt: '2026-09-10T03:00:00Z' })
    expect(byUom.get(pcs)).toMatchObject({ unitPrice: 5000 })
  })

  it('kosong untuk daftar produk kosong', async () => {
    expect(await getLastBulkPrices(branchId, customerId, [])).toEqual([])
  })
})
