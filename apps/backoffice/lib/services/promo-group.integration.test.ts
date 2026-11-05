import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productPrices, productUomCosts, roles, users, shifts,
  paymentMethods, transactionItems, appSettings, eq,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { PromoSaleError } from './promo-sale-service'
import { createPromo, loadPromoRules, setPromoEnabled, PROMO_SWITCH_SETTING_KEY } from './promo-service'

// Kelompok campur (migrasi 0052): pasir 10 L dua aroma satu kelompok, minimal 3 pcs campur →
// sekop gratis 1. Disimpan & dibaca ulang dengan nomor kelompok, dan server (hakim nota)
// menghitung total kelompok — 2 Lavender + 1 Apel lolos, 2 Lavender saja ditolak.
const run = randomUUID().slice(0, 8)
let toko: number
let userId: number
let pcs: number
let cashMethodId: number
let shiftId: number
let lavender: number
let apel: number
let sekop: number
let promoId: number
let switchBefore: string | undefined

const NOW = new Date()
const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString()
const actor = () => ({ userId, branchId: toko })
const SAND_PRICE = 90000
const GIFT_PRICE = 15000

interface Line { productId: number; qty: number; unitPrice: number; promo?: { promoId: number; amount: number; gift?: boolean } }

const sale = (lines: Line[]) => {
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
    branchId: toko, cashierId: userId, shiftId, localTrxNumber: `PK-${randomUUID()}`,
    items, payments: [{ paymentMethodId: cashMethodId, amount: sum }],
    totals: { subtotal: sum, discountTotal: 0, grandTotal: sum }, amountPaid: sum, change: 0,
  } as never) as Promise<{ id: number }>
}

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `PK${run}`, name: `Toko Campur ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `PK${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `Kasir PK ${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `PK${run}`, name: 'Pcs tes', isBase: true }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai PK ${run}`, type: 'CASH' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  const product = async (name: string, price: number) => {
    const id = (await db.insert(products).values({ name: `${name} ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning())[0].id
    await db.transaction((tx) => StockService.addStock(tx, toko, id, pcs, '50', '1000'))
    await db.insert(productUomCosts).values({ productId: id, branchId: toko, uomId: pcs, costPrice: 1000 })
    await db.insert(productPrices).values({ productId: id, branchId: toko, uomId: pcs, tierType: 'RETAIL', price })
    return id
  }
  lavender = await product('Pasir 10L Lavender', SAND_PRICE)
  apel = await product('Pasir 10L Apel', SAND_PRICE)
  sekop = await product('Sekop', GIFT_PRICE)

  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
  switchBefore = row?.value
  await setPromoEnabled(true, actor())
  promoId = (await createPromo({
    name: `Pasir 3 campur gratis sekop ${run}`, kind: 'BELI_GRATIS', note: null, branchIds: [toko],
    startsAt: hours(-1), endsAt: hours(24), dailyStartMinute: null, dailyEndMinute: null,
    isMultiple: false, maxPerNote: null, quotaKind: null, quotaPerBranch: null, requireStock: false,
    conditions: [
      { productId: lavender, uomId: pcs, minQty: 3, groupNo: 1 },
      { productId: apel, uomId: pcs, minQty: 3, groupNo: 1 },
    ],
    rewards: [{ productId: sekop, uomId: pcs, type: 'GRATIS', value: 0, qty: 1 }],
  }, actor(), { acceptLoss: true })).id
})

afterAll(async () => {
  if (switchBefore === undefined) await db.delete(appSettings).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
  else await db.update(appSettings).set({ value: switchBefore }).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
})

describe('promo kelompok campur (DB lokal)', () => {
  it('tersimpan dan terbaca ulang dengan nomor kelompok', async () => {
    const rule = (await loadPromoRules(toko, new Date())).find((r) => r.id === promoId)!
    expect(rule.conditions.map((c) => [c.productId, c.minQty, c.groupNo])).toEqual([[lavender, 3, 1], [apel, 3, 1]])
  })

  it('2 Lavender + 1 Apel → server menerima sekop gratis, satu paket', async () => {
    const trx = await sale([
      { productId: lavender, qty: 2, unitPrice: SAND_PRICE },
      { productId: apel, qty: 1, unitPrice: SAND_PRICE },
      { productId: sekop, qty: 1, unitPrice: GIFT_PRICE, promo: { promoId, amount: GIFT_PRICE, gift: true } },
    ])
    const rows = await db.select().from(transactionItems).where(eq(transactionItems.transactionId, trx.id))
    const gift = rows.find((r) => r.productId === sekop)!
    expect(gift.totalPrice).toBe(0)
    expect(gift.promoPackageNo).not.toBeNull()
    expect(rows.every((r) => r.promoPackageNo === gift.promoPackageNo)).toBe(true)
  })

  it('2 Lavender saja (total kurang dari 3) → hadiah ditolak server', async () => {
    const error = await sale([
      { productId: lavender, qty: 2, unitPrice: SAND_PRICE },
      { productId: sekop, qty: 1, unitPrice: GIFT_PRICE, promo: { promoId, amount: GIFT_PRICE, gift: true } },
    ]).then(() => null, (e: unknown) => e)
    expect(error).toBeInstanceOf(PromoSaleError)
    expect(error).toMatchObject({ code: 'PROMO_CHANGED' })
  })
})
