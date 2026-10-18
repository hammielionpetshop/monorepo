import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productPrices, productUomCosts, productStocks, roles, users, shifts,
  paymentMethods, transactions, transactionItems, transactionItemDiscounts, promoBranchUsage, appSettings, and, eq,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { performVoid } from './void-service'
import { PromoSaleError } from './promo-sale-service'
import { createPromo, setPromoEnabled, PROMO_SWITCH_SETTING_KEY } from './promo-service'

// Server sebagai hakim hadiah gratis (P4c): nota "beli X gratis Y" dikirim layar dengan baris
// hadiah tambahan (promo.gift). Server menghitung ulang hadiah dari baris berbayar, mencocokkan
// baris gratis kiriman, menolak bila beda (PROMO_CHANGED), lalu menyimpan baris gratis sebagai
// barang biasa (harga penuh, potongan penuh, tagihan 0, catatan PROMO, STOK DIPOTONG + modal
// dihitung). Baris syarat + hadiah dari satu kali pakai diberi nomor grup paket (retur utuh).
// Batal nota mengembalikan stok & jatah kuota termasuk baris gratisnya.
const run = randomUUID().slice(0, 8)
let toko: number
let userId: number
let pcs: number
let cashMethodId: number
let shiftId: number
let beli: number // barang syarat ("beli 2")
let hadiah: number // barang gratis
let promoId: number
let switchBefore: string | undefined

const NOW = new Date()
const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString()
const actor = () => ({ userId, branchId: toko })
const GIFT_PRICE = 10000
const QUOTA = 5

interface Line {
  productId: number
  qty: number
  unitPrice: number
  promo?: { promoId: number; amount: number; gift?: boolean }
}

const sale = (lines: Line[], extra: Record<string, unknown> = {}) => {
  const items = lines.map((l) => {
    const gift = l.promo?.gift === true
    const discountAmount = l.promo?.amount ?? 0
    return {
      productId: l.productId, uomId: pcs, qty: l.qty, unitPrice: l.unitPrice, priceTier: 'RETAIL',
      discountAmount, subtotal: gift ? 0 : l.qty * l.unitPrice - discountAmount,
      ...(l.promo ? { promo: l.promo } : {}),
    }
  })
  const sum = items.reduce((s, i) => s + i.subtotal, 0)
  return TransactionService.createTransaction({
    branchId: toko, cashierId: userId, shiftId, localTrxNumber: `PG-${randomUUID()}`,
    items, payments: [{ paymentMethodId: cashMethodId, amount: sum }],
    totals: { subtotal: sum, discountTotal: 0, grandTotal: sum }, amountPaid: sum, change: 0, ...extra,
  } as never) as Promise<{ id: number }>
}

const errorOf = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)
const countTrx = async () => (await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.branchId, toko))).length
const stockOf = async (productId: number) => {
  const [row] = await db.select({ qty: productStocks.qty }).from(productStocks)
    .where(and(eq(productStocks.productId, productId), eq(productStocks.branchId, toko)))
  return row?.qty ?? 0
}
const usedPcsOf = async (id: number) => {
  const [row] = await db.select({ usedPcs: promoBranchUsage.usedPcs }).from(promoBranchUsage)
    .where(and(eq(promoBranchUsage.promoId, id), eq(promoBranchUsage.branchId, toko)))
  return row?.usedPcs ?? 0
}

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `PG${run}`, name: `Toko Gratis ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `PG${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `Kasir PG ${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `PG${run}`, name: 'Pcs tes', isBase: true }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai PG ${run}`, type: 'CASH' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  beli = (await db.insert(products).values({ name: `Beli PG ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning())[0].id
  hadiah = (await db.insert(products).values({ name: `Hadiah PG ${run}`, baseUomId: pcs, defaultCostPrice: 2000 }).returning())[0].id
  for (const id of [beli, hadiah]) {
    await db.transaction((tx) => StockService.addStock(tx, toko, id, pcs, '100', String(id === hadiah ? 2000 : 1000)))
    await db.insert(productUomCosts).values({ productId: id, branchId: toko, uomId: pcs, costPrice: id === hadiah ? 2000 : 1000 })
  }
  await db.insert(productPrices).values({ productId: beli, branchId: toko, uomId: pcs, tierType: 'RETAIL', price: 25000 })
  await db.insert(productPrices).values({ productId: hadiah, branchId: toko, uomId: pcs, tierType: 'RETAIL', price: GIFT_PRICE })

  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
  switchBefore = row?.value
  await setPromoEnabled(true, actor())
  // Beli 2 "beli" → gratis 1 "hadiah". Kuota pcs hadiah 5 per cabang.
  promoId = (await createPromo({
    name: `Beli 2 gratis 1 ${run}`, kind: 'BELI_GRATIS', note: null, branchIds: [toko],
    startsAt: hours(-1), endsAt: hours(24), dailyStartMinute: null, dailyEndMinute: null,
    isMultiple: false, maxPerNote: null, quotaKind: 'PCS', quotaPerBranch: QUOTA, requireStock: false,
    conditions: [{ productId: beli, uomId: pcs, minQty: 2 }],
    rewards: [{ productId: hadiah, uomId: pcs, type: 'GRATIS', value: 0, qty: 1 }],
  }, actor(), { acceptLoss: true })).id // hadiah gratis = jual rugi (modal keluar tanpa pemasukan)
})

afterAll(async () => {
  if (switchBefore === undefined) await db.delete(appSettings).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
  else await db.update(appSettings).set({ value: switchBefore }).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
})

describe('Server sebagai hakim hadiah gratis (DB lokal)', () => {
  it('beli 2 gratis 1: baris hadiah tersimpan Rp0, stok dipotong, catatan PROMO, nomor grup paket', async () => {
    const giftStockBefore = await stockOf(hadiah)
    const usedBefore = await usedPcsOf(promoId)
    const trx = await sale([
      { productId: beli, qty: 2, unitPrice: 25000 },
      { productId: hadiah, qty: 1, unitPrice: GIFT_PRICE, promo: { promoId, amount: GIFT_PRICE, gift: true } },
    ])
    const [header] = await db.select().from(transactions).where(eq(transactions.id, trx.id))
    expect([header.totalAmount, header.discountAmount, header.payableAmount]).toEqual([50000, 0, 50000])

    const rows = await db.select().from(transactionItems).where(eq(transactionItems.transactionId, trx.id)).orderBy(transactionItems.id)
    const beliRow = rows.find((r) => r.productId === beli)!
    const giftRow = rows.find((r) => r.productId === hadiah)!
    // Baris hadiah: harga penuh, potongan penuh, tagihan 0, modal terhitung (stok dipotong).
    expect([giftRow.unitPrice, giftRow.discountAmount, giftRow.totalPrice]).toEqual([GIFT_PRICE, GIFT_PRICE, 0])
    expect(giftRow.cogs).toBeGreaterThan(0)
    expect(giftRow.isService).toBe(false)
    // Grup paket: baris syarat + baris hadiah segrup (nomor sama, bukan null).
    expect(giftRow.promoPackageNo).not.toBeNull()
    expect(beliRow.promoPackageNo).toBe(giftRow.promoPackageNo)

    const catatan = await db.select().from(transactionItemDiscounts).where(eq(transactionItemDiscounts.transactionId, trx.id))
    expect(catatan).toHaveLength(1)
    expect(catatan[0]).toMatchObject({ transactionItemId: giftRow.id, kind: 'PROMO', amount: GIFT_PRICE, promotionId: promoId })

    // Stok hadiah berkurang 1; jatah kuota pcs bertambah 1.
    expect(await stockOf(hadiah)).toBe(giftStockBefore - 1)
    expect(await usedPcsOf(promoId)).toBe(usedBefore + 1)
  })

  it('layar lama belum menambah baris hadiah → nota ditolak (409), tidak ada yang tersimpan', async () => {
    const before = await countTrx()
    const error = await errorOf(sale([{ productId: beli, qty: 2, unitPrice: 25000 }]))
    expect(error).toBeInstanceOf(PromoSaleError)
    expect(error).toMatchObject({ code: 'PROMO_CHANGED', status: 409 })
    expect(await countTrx()).toBe(before)
  })

  it('baris hadiah dengan qty/nilai ngawur → ditolak', async () => {
    const before = await countTrx()
    const error = await errorOf(sale([
      { productId: beli, qty: 2, unitPrice: 25000 },
      { productId: hadiah, qty: 2, unitPrice: GIFT_PRICE, promo: { promoId, amount: GIFT_PRICE * 2, gift: true } },
    ]))
    expect(error).toBeInstanceOf(PromoSaleError)
    expect(await countTrx()).toBe(before)
  })

  it('batal nota mengembalikan stok hadiah dan jatah kuota (baris gratis ikut)', async () => {
    const giftStockBefore = await stockOf(hadiah)
    const usedBefore = await usedPcsOf(promoId)
    const trx = await sale([
      { productId: beli, qty: 2, unitPrice: 25000 },
      { productId: hadiah, qty: 1, unitPrice: GIFT_PRICE, promo: { promoId, amount: GIFT_PRICE, gift: true } },
    ])
    expect(await stockOf(hadiah)).toBe(giftStockBefore - 1)
    expect(await usedPcsOf(promoId)).toBe(usedBefore + 1)

    const [header] = await db.select({ trxNumber: transactions.trxNumber }).from(transactions).where(eq(transactions.id, trx.id))
    await performVoid({ txId: trx.id, branchId: toko, trxNumber: header.trxNumber, actorUserId: userId })

    expect(await stockOf(hadiah)).toBe(giftStockBefore)
    expect(await usedPcsOf(promoId)).toBe(usedBefore)
  })
})
