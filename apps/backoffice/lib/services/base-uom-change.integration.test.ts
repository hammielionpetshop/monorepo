import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productUomConversions, productUomCosts, productPrices, productStocks,
  productStockBatches, stockAdjustments, stockOpnames, stockOpnameItems, users, auditLogs, eq, and,
} from '../db'
import { StockService } from './stock-service'
import { BaseUomChangeError, divideCost, executeBaseUomChange, previewBaseUomChange } from './base-uom-change-service'

// Ganti satuan dasar SAK → PCS (1 SAK = 25 PCS) ke DB lokal worktree, memakai StockService asli.
const run = randomUUID().slice(0, 6)
let sak: number
let pcs: number
let bal: number
let userId: number
let toko: number
let gudang: number

async function setupProduct(label: string) {
  const [p] = await db.insert(products)
    .values({ name: `Pakan ${label} ${run}`, baseUomId: sak, defaultCostPrice: 250_000, weightGram: 25_000 })
    .returning()
  await db.insert(productUomConversions).values({ productId: p.id, uomId: bal, ratio: 2 }) // 1 BAL = 2 SAK
  await db.transaction((tx) => StockService.addStock(tx, toko, p.id, sak, '4', '250010'))
  await db.transaction((tx) => StockService.addStock(tx, gudang, p.id, sak, '10', '240000'))
  await db.insert(productUomCosts).values([
    { productId: p.id, branchId: toko, uomId: sak, costPrice: 250_000 },
    { productId: p.id, branchId: toko, uomId: bal, costPrice: 500_000 },
  ])
  await db.insert(productPrices).values([
    { productId: p.id, branchId: toko, uomId: sak, tierType: 'RETAIL', price: 300_000 },
    { productId: p.id, branchId: toko, uomId: sak, tierType: 'GROSIR', price: 280_000 },
  ])
  await db.insert(stockAdjustments).values({ productId: p.id, branchId: toko, adjustedById: userId, previousQty: 3, newQty: 4, reason: 'tes' })
  return p.id
}

const input = (productId: number) => ({ productId, newBaseUomId: pcs, ratio: 25 })
const actor = () => ({ userId, branchId: toko })

beforeAll(async () => {
  const mk = async (code: string) => (await db.insert(unitsOfMeasure).values({ code: `${code}${run}`, name: `${code} ${run}` }).returning())[0].id
  sak = await mk('S')
  pcs = await mk('P')
  bal = await mk('B')
  toko = (await db.insert(branches).values({ code: `TK${run}`, name: `Toko BU ${run}` }).returning())[0].id
  gudang = (await db.insert(branches).values({ code: `GD${run}`, name: `Gudang BU ${run}` }).returning())[0].id
  const [u] = await db.select({ id: users.id }).from(users).limit(1)
  userId = u.id
})

describe('ganti satuan dasar SAK → PCS', () => {
  it('pratinjau tidak mengubah apa pun dan menghitung angka yang benar', async () => {
    const productId = await setupProduct('pratinjau')
    const plan = await previewBaseUomChange(input(productId))

    expect(plan.blockers).toEqual([])
    expect(plan.stocks.map((s) => [s.oldQty, s.newQty]).sort()).toEqual([[10, 250], [4, 100]].sort())
    expect(plan.value.before).toBe(4 * 250_010 + 10 * 240_000)
    expect(plan.value.after).toBe(100 * 10_000 + 250 * 9_600)
    expect(plan.value.difference).toBe(-40) // 250.010/25 = 10.000,4 → 10.000
    expect(plan.missingPrices).toEqual([{ branchId: toko, branchName: `Toko BU ${run}`, tiers: ['Retail', 'Grosir'] }])

    const [prod] = await db.select().from(products).where(eq(products.id, productId))
    expect(prod.baseUomId).toBe(sak)
  })

  it('menjalankan semuanya dalam satu kali, dan stok tetap bisa dijual per PCS maupun per SAK', async () => {
    const productId = await setupProduct('jalan')
    const plan = await previewBaseUomChange(input(productId))
    await executeBaseUomChange({ ...input(productId), signature: plan.signature }, actor())

    const [prod] = await db.select().from(products).where(eq(products.id, productId))
    expect(prod.baseUomId).toBe(pcs)
    expect(prod.defaultCostPrice).toBe(10_000)
    expect(prod.weightGram).toBe(1_000)

    const stocks = await db.select().from(productStocks).where(eq(productStocks.productId, productId))
    expect(stocks.every((s) => s.uomId === pcs)).toBe(true)
    expect(stocks.find((s) => s.branchId === toko)?.qty).toBe(100)
    expect(stocks.find((s) => s.branchId === gudang)?.qty).toBe(250)

    const batches = await db.select().from(productStockBatches).where(eq(productStockBatches.productId, productId))
    const tokoBatch = batches.find((b) => b.branchId === toko)!
    expect(tokoBatch.qtyRemaining).toBe(100)
    expect(tokoBatch.qtyReceived).toBe(100)
    expect(tokoBatch.costPrice).toBe(divideCost(250_010, 25))
    expect(tokoBatch.uomId).toBe(sak) // jejak satuan pembelian tidak diubah

    const convs = await db.select().from(productUomConversions).where(eq(productUomConversions.productId, productId))
    expect(Object.fromEntries(convs.map((c) => [c.uomId, c.ratio]))).toEqual({ [bal]: 50, [sak]: 25 })

    const costs = await db.select().from(productUomCosts)
      .where(and(eq(productUomCosts.productId, productId), eq(productUomCosts.branchId, toko)))
    expect(Object.fromEntries(costs.map((c) => [c.uomId, c.costPrice]))).toEqual({ [sak]: 250_000, [bal]: 500_000, [pcs]: 10_000 })

    const prices = await db.select().from(productPrices).where(eq(productPrices.productId, productId))
    expect(prices.every((p) => p.uomId === sak)).toBe(true) // harga jual PCS sengaja kosong

    const [adj] = await db.select().from(stockAdjustments).where(eq(stockAdjustments.productId, productId))
    expect([adj.previousQty, adj.newQty]).toEqual([75, 100])

    const [audit] = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.action, 'BASE_UOM_CHANGE'), eq(auditLogs.recordId, String(productId))))
    expect(audit).toBeTruthy()

    // Jual 3 PCS dan 1 SAK sesudah migrasi
    await db.transaction((tx) => StockService.deductStock(tx, toko, productId, pcs, 3, false))
    await db.transaction((tx) => StockService.deductStock(tx, toko, productId, sak, 1, false))
    const [after] = await db.select().from(productStocks)
      .where(and(eq(productStocks.productId, productId), eq(productStocks.branchId, toko)))
    expect(after.qty).toBe(100 - 3 - 25)
  })

  it('menolak bila stok berubah sejak pratinjau', async () => {
    const productId = await setupProduct('basi')
    const plan = await previewBaseUomChange(input(productId))
    await db.transaction((tx) => StockService.deductStock(tx, toko, productId, sak, 1, false))
    await expect(executeBaseUomChange({ ...input(productId), signature: plan.signature }, actor()))
      .rejects.toBeInstanceOf(BaseUomChangeError)
    const [prod] = await db.select().from(products).where(eq(products.id, productId))
    expect(prod.baseUomId).toBe(sak)
  })

  it('menolak bila barang masih ada di Stock Opname yang belum selesai, dan rasio < 2', async () => {
    const productId = await setupProduct('so')
    const [so] = await db.insert(stockOpnames)
      .values({ soNumber: `SO-BU-${run}`, branchId: toko, type: 'DAILY', status: 'PENDING', createdById: userId })
      .returning()
    await db.insert(stockOpnameItems).values({ soId: so.id, productId, uomId: sak, systemQty: 4, physicalQty: 4, varianceQty: 0 })

    const plan = await previewBaseUomChange(input(productId))
    expect(plan.blockers.join(' ')).toContain(`SO-BU-${run}`)
    await expect(executeBaseUomChange({ ...input(productId), signature: plan.signature }, actor()))
      .rejects.toBeInstanceOf(BaseUomChangeError)

    const bad = await previewBaseUomChange({ ...input(productId), ratio: 1 })
    expect(bad.blockers.some((b) => b.includes('minimal 2'))).toBe(true)
  })
})
