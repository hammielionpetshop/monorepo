import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productUomConversions, productPrices, productUomCosts, priceReviews,
  productCostSyncs, roles, users, auditLogs, and, eq, desc,
} from '../db'
import { syncCostFromInbound } from './cost-sync-service'
import { approvePriceReview, getOpenPriceReviews, keepPriceReview, PriceReviewError, rejectPriceReviewCost } from './price-review-service'
import { countOpenPriceReviewsForSource } from './price-review-record'

// Pemeriksaan Harga Jual (spec 2026-11-10 Tahap 2): modal naik dari barang masuk membuka Pemeriksaan
// per (cabang, produk); Setujui menulis harga ke Manajemen Harga (modal yang ditahan ikut disetujui),
// Tetap harga lama ditolak bila di bawah modal, Tolak modal menutupnya.
const run = randomUUID().slice(0, 8)
let gudang: number
let userId: number
let pcs: number
let dus: number
let seq = 0

async function makeProduct(cost: number, price: number) {
  const id = (await db.insert(products).values({ name: `Omega PR ${run} ${++seq}`, baseUomId: pcs }).returning())[0].id
  await db.insert(productUomConversions).values({ productId: id, uomId: dus, ratio: 12 })
  await db.insert(productUomCosts).values([
    { productId: id, branchId: gudang, uomId: pcs, costPrice: cost },
    { productId: id, branchId: gudang, uomId: dus, costPrice: cost * 12 },
  ])
  await db.insert(productPrices).values([
    { productId: id, branchId: gudang, uomId: pcs, tierType: 'RETAIL', price },
    { productId: id, branchId: gudang, uomId: dus, tierType: 'GROSIR', price: price * 11 },
  ])
  return id
}

const inbound = (productId: number, unitCost: number, sourceId: number, uomId = pcs) =>
  db.transaction(tx => syncCostFromInbound(tx, {
    branchId: gudang, productId, uomId, unitCost, sourceType: 'PO_RECEIVING', sourceId, sourceRef: `PO-${run}-${sourceId}`, actorUserId: userId,
  }))

const reviewOf = async (productId: number) =>
  (await db.select().from(priceReviews).where(and(eq(priceReviews.productId, productId), eq(priceReviews.branchId, gudang))).orderBy(desc(priceReviews.id)))[0]
const entryOf = async (productId: number) => (await getOpenPriceReviews({ branchId: gudang })).find(e => e.productId === productId)
const pricesOf = async (productId: number) =>
  Object.fromEntries((await db.select().from(productPrices).where(and(eq(productPrices.productId, productId), eq(productPrices.branchId, gudang))))
    .map(p => [`${p.uomId === pcs ? 'PCS' : 'DUS'}:${p.tierType}`, p.price]))
const costOf = async (productId: number) =>
  (await db.select().from(productUomCosts).where(and(eq(productUomCosts.productId, productId), eq(productUomCosts.branchId, gudang), eq(productUomCosts.uomId, pcs))))[0].costPrice
const errorOf = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)

beforeAll(async () => {
  gudang = (await db.insert(branches).values({ code: `PR${run}`, name: `Gudang Periksa ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `PR${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `Owner PR ${run}`, roleId, branchId: gudang }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `RP${run}`, name: 'Pcs tes', isBase: true }).returning())[0].id
  dus = (await db.insert(unitsOfMeasure).values({ code: `RD${run}`, name: 'Dus tes', isBase: false }).returning())[0].id
})

describe('Pemeriksaan Harga Jual (DB lokal)', () => {
  it('modal naik < 30%: modal langsung berlaku, Pemeriksaan terbuka dengan usulan dibulatkan ke 100', async () => {
    const id = await makeProduct(4000, 5000)
    expect(await inbound(id, 4500, 1)).toBe('APPLIED')
    const entry = await entryOf(id)
    expect(entry).toMatchObject({ oldCostPerBase: 4000, newCostPerBase: 4500, costPending: false, changePercent: 12.5 })
    // 5.000 × 4.500/4.000 = 5.625 → 5.700; DUS grosir 55.000 × 1,125 = 61.875 → 61.900.
    expect(entry!.lines.map(l => [l.tierType, l.unitCost, l.suggested])).toEqual([['RETAIL', 4500, 5700], ['GROSIR', 54000, 61900]])
    expect(await countOpenPriceReviewsForSource(['PO_RECEIVING', 'PO_INVOICE'], 1)).toBeGreaterThanOrEqual(1)

    await db.transaction(tx => approvePriceReview(tx, { id: entry!.id, userId, prices: null }))
    expect(await pricesOf(id)).toEqual({ 'PCS:RETAIL': 5700, 'DUS:GROSIR': 61900 })
    expect((await reviewOf(id)).status).toBe('APPROVED')
    const [log] = await db.select().from(auditLogs).where(and(eq(auditLogs.branchId, gudang), eq(auditLogs.action, 'PRICE_COST_SYNC'))).orderBy(desc(auditLogs.id)).limit(1)
    expect(String(log.newData)).toContain('Periksa harga jual')
  })

  it('modal naik ≥ 30% (ditahan): Setujui ikut menyetujui modal lalu menulis harga yang diketik', async () => {
    const id = await makeProduct(3750, 5000)
    expect(await inbound(id, 5000, 2)).toBe('PENDING')
    const entry = await entryOf(id)
    expect(entry).toMatchObject({ costPending: true, newCostPerBase: 5000 })
    expect(entry!.lines[0].suggested).toBe(6700)
    expect(await costOf(id)).toBe(3750)

    await db.transaction(tx => approvePriceReview(tx, { id: entry!.id, userId, prices: [
      { uomId: pcs, tierType: 'RETAIL', price: 7000 },
      { uomId: dus, tierType: 'GROSIR', price: 75000 },
    ] }))
    expect(await costOf(id)).toBe(5000)
    expect(await pricesOf(id)).toEqual({ 'PCS:RETAIL': 7000, 'DUS:GROSIR': 75000 })
    const [sync] = await db.select().from(productCostSyncs).where(eq(productCostSyncs.id, entry!.costSyncId!))
    expect(sync.status).toBe('APPROVED')
  })

  it('harga diketik di bawah modal baru ditolak, tidak ada yang berubah', async () => {
    const id = await makeProduct(4000, 5000)
    await inbound(id, 4500, 3)
    const entry = await entryOf(id)
    const err = await errorOf(db.transaction(tx => approvePriceReview(tx, { id: entry!.id, userId, prices: [
      { uomId: pcs, tierType: 'RETAIL', price: 4400 },
      { uomId: dus, tierType: 'GROSIR', price: 60000 },
    ] })))
    expect(err).toBeInstanceOf(PriceReviewError)
    expect((err as Error).message).toContain('di bawah modal')
    expect((await reviewOf(id)).status).toBe('OPEN')
  })

  it('barang masuk kedua sebelum diperiksa: baris yang sama, modal pembanding tetap modal pertama', async () => {
    const id = await makeProduct(4000, 5000)
    await inbound(id, 4400, 4)
    await inbound(id, 4800, 5)
    const rows = await db.select().from(priceReviews).where(eq(priceReviews.productId, id))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ oldCostPerBase: 4000, newCostPerBase: 4800 })
    expect(rows[0].sources.map(s => s.id)).toEqual([4, 5])
  })

  it('Tetap harga lama: ditolak bila di bawah modal baru; alasan wajib; diterima bila masih di atas modal', async () => {
    const low = await makeProduct(4000, 4600)
    await inbound(low, 4800, 6)
    const lowEntry = await entryOf(low)
    expect(await errorOf(db.transaction(tx => keepPriceReview(tx, { id: lowEntry!.id, userId, reason: 'stok lama' })))).toBeInstanceOf(PriceReviewError)

    const ok = await makeProduct(4000, 6000)
    await inbound(ok, 4400, 7)
    const okEntry = await entryOf(ok)
    expect(await errorOf(db.transaction(tx => keepPriceReview(tx, { id: okEntry!.id, userId, reason: '  ' })))).toBeInstanceOf(PriceReviewError)
    await db.transaction(tx => keepPriceReview(tx, { id: okEntry!.id, userId, reason: 'margin masih cukup' }))
    expect(await reviewOf(ok)).toMatchObject({ status: 'KEPT', note: 'margin masih cukup' })
    expect(await pricesOf(ok)).toEqual({ 'PCS:RETAIL': 6000, 'DUS:GROSIR': 66000 })
  })

  it('Tolak modal yang ditahan: modal tidak berubah dan Pemeriksaan tertutup', async () => {
    const id = await makeProduct(3750, 5000)
    await inbound(id, 5000, 8)
    const entry = await entryOf(id)
    await db.transaction(tx => rejectPriceReviewCost(tx, { id: entry!.id, userId, reason: 'salah ketik harga transfer' }))
    expect(await costOf(id)).toBe(3750)
    expect((await reviewOf(id)).status).toBe('CLOSED')
  })

  it('modal turun lagi ke semula sebelum diperiksa: Pemeriksaan tertutup sendiri', async () => {
    const id = await makeProduct(4000, 5000)
    await inbound(id, 4400, 9)
    await inbound(id, 4000, 10)
    expect((await reviewOf(id)).status).toBe('CLOSED')
  })

  it('modal turun tidak membuka Pemeriksaan', async () => {
    const id = await makeProduct(4000, 5000)
    await inbound(id, 3800, 11)
    expect(await reviewOf(id)).toBeUndefined()
  })
})
