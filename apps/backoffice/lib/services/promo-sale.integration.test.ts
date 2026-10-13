import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productPrices, productUomCosts, roles, users, shifts, paymentMethods, customers,
  transactions, transactionItems, transactionItemDiscounts, appSettings, eq,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { LineDiscountError } from './line-discount-service'
import { PromoSaleError } from './promo-sale-service'
import { createPromo, deactivatePromo, loadPromoRules, setPromoEnabled, PROMO_SWITCH_SETTING_KEY } from './promo-service'

// Server sebagai hakim promo (P2c): nota kasir dihitung ulang dengan mesin promo memakai jam
// server dan promo di database. Kiriman layar yang berbeda ditolak sebelum apa pun ditulis;
// yang cocok mencatat potongan PROMO + salinan aturannya. Grosir & pelanggan non-Retail di luar.
const run = randomUUID().slice(0, 8)
let toko: number
let tokoLain: number
let userId: number
let pcs: number
let cashMethodId: number
let shiftId: number
let pakan: number
let pasir: number
let promoId: number
let switchBefore: string | undefined

const NOW = new Date()
const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString()
const actor = () => ({ userId, branchId: toko })

type Line = { productId: number; qty: number; unitPrice: number; promo?: { promoId: number; amount: number }; manual?: number }

const sale = (lines: Line[], extra: Record<string, unknown> = {}) => {
  const items = lines.map((l) => {
    const discountAmount = l.promo?.amount ?? l.manual ?? 0
    return {
      productId: l.productId, uomId: pcs, qty: l.qty, unitPrice: l.unitPrice, priceTier: 'RETAIL',
      discountAmount, subtotal: l.qty * l.unitPrice - discountAmount,
      ...(l.promo ? { promo: l.promo } : {}),
      ...(l.manual ? { manualDiscount: { amount: l.manual, reasonCode: 'KEMASAN_RUSAK' } } : {}),
    }
  })
  const sum = items.reduce((s, i) => s + i.subtotal, 0)
  return TransactionService.createTransaction({
    branchId: toko, cashierId: userId, shiftId, localTrxNumber: `PS-${randomUUID()}`,
    items, payments: [{ paymentMethodId: cashMethodId, amount: sum }],
    totals: { subtotal: sum, discountTotal: 0, grandTotal: sum }, amountPaid: sum, change: 0, ...extra,
  } as never) as Promise<{ id: number }>
}

const errorOf = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)
const countTrx = async () => (await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.branchId, toko))).length
const discountsOf = (trxId: number) =>
  db.select().from(transactionItemDiscounts).where(eq(transactionItemDiscounts.transactionId, trxId)).orderBy(transactionItemDiscounts.id)

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `PS${run}`, name: `Toko Promo Kasir ${run}` }).returning())[0].id
  tokoLain = (await db.insert(branches).values({ code: `PT${run}`, name: `Toko Lain Kasir ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `PS${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `Kasir PS ${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `PS${run}`, name: 'Pcs tes', isBase: true }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai PS ${run}`, type: 'CASH' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  pakan = (await db.insert(products).values({ name: `Pakan PS ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning())[0].id
  pasir = (await db.insert(products).values({ name: `Pasir PS ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning())[0].id
  for (const id of [pakan, pasir]) {
    await db.transaction((tx) => StockService.addStock(tx, toko, id, pcs, '100', '1000'))
    await db.insert(productPrices).values({ productId: id, branchId: toko, uomId: pcs, tierType: 'RETAIL', price: 25000 })
    await db.insert(productUomCosts).values({ productId: id, branchId: toko, uomId: pcs, costPrice: 1000 })
  }
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
  switchBefore = row?.value
  await setPromoEnabled(true, actor())
  // Pakan: mulai 2 pcs, potong Rp 1.000 per pcs.
  promoId = (await createPromo({
    name: `Pakan hemat ${run}`, kind: 'POTONGAN', note: null, branchIds: [toko],
    startsAt: hours(-1), endsAt: hours(24), dailyStartMinute: null, dailyEndMinute: null, isMultiple: false, maxPerNote: null,
    conditions: [{ productId: pakan, uomId: pcs, minQty: 2 }],
    rewards: [{ productId: pakan, uomId: pcs, type: 'POTONG_PER_PCS', value: 1000, qty: null }],
  }, actor())).id
})

afterAll(async () => {
  if (switchBefore === undefined) await db.delete(appSettings).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
  else await db.update(appSettings).set({ value: switchBefore }).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
})

describe('Server sebagai hakim promo (DB lokal)', () => {
  it('kiriman promo yang cocok: baris dipotong, potongan PROMO + salinan aturan tercatat', async () => {
    const trx = await sale([
      { productId: pakan, qty: 3, unitPrice: 25000, promo: { promoId, amount: 3000 } },
      { productId: pasir, qty: 1, unitPrice: 25000 },
    ])
    const [header] = await db.select().from(transactions).where(eq(transactions.id, trx.id))
    expect([header.totalAmount, header.discountAmount, header.payableAmount]).toEqual([97000, 0, 97000])
    const [a, b] = await db.select().from(transactionItems).where(eq(transactionItems.transactionId, trx.id)).orderBy(transactionItems.id)
    expect([a.discountAmount, a.totalPrice, b.discountAmount]).toEqual([3000, 72000, 0])
    const catatan = await discountsOf(trx.id)
    expect(catatan).toHaveLength(1)
    expect(catatan[0]).toMatchObject({
      transactionItemId: a.id, kind: 'PROMO', amount: 3000, promotionId: promoId, promotionName: `Pakan hemat ${run}`,
      reasonCode: null, createdById: userId,
    })
    expect(catatan[0].promotionSnapshot).toMatchObject({ id: promoId, kind: 'POTONGAN', units: 3, rewards: [{ type: 'POTONG_PER_PCS', value: 1000 }] })
  })

  it('layar tidak mengirim promo padahal berlaku → nota ditolak (409), tidak ada yang tersimpan', async () => {
    const before = await countTrx()
    const error = await errorOf(sale([{ productId: pakan, qty: 2, unitPrice: 25000 }]))
    expect(error).toBeInstanceOf(PromoSaleError)
    expect(error).toMatchObject({ code: 'PROMO_CHANGED', status: 409 })
    expect(await countTrx()).toBe(before)
  })

  it('nota tanpa barang promo tetap tersimpan seperti dulu (tanpa catatan potongan)', async () => {
    const trx = await sale([{ productId: pakan, qty: 1, unitPrice: 25000 }, { productId: pasir, qty: 2, unitPrice: 25000 }])
    expect(await discountsOf(trx.id)).toHaveLength(0)
  })

  it('baris promo tidak bisa sekaligus diberi diskon manual', async () => {
    const error = await errorOf(sale([{ productId: pakan, qty: 2, unitPrice: 25000, promo: { promoId, amount: 2000 }, manual: 2000 }]))
    expect(error).toBeInstanceOf(LineDiscountError)
    // Diskon manual di barang bukan promo tetap boleh di nota berpromo.
    const trx = await sale([
      { productId: pakan, qty: 2, unitPrice: 25000, promo: { promoId, amount: 2000 } },
      { productId: pasir, qty: 1, unitPrice: 25000, manual: 5000 },
    ])
    expect((await discountsOf(trx.id)).map((d) => d.kind)).toEqual(['PROMO', 'MANUAL'])
  })

  it('saklar darurat dimatikan: kiriman promo ditolak, nota biasa diterima tanpa promo', async () => {
    await setPromoEnabled(false, actor())
    try {
      expect(await errorOf(sale([{ productId: pakan, qty: 2, unitPrice: 25000, promo: { promoId, amount: 2000 } }]))).toMatchObject({ code: 'PROMO_CHANGED' })
      const trx = await sale([{ productId: pakan, qty: 2, unitPrice: 25000 }])
      expect(await discountsOf(trx.id)).toHaveLength(0)
    } finally {
      await setPromoEnabled(true, actor())
    }
  })

  it('pelanggan Reseller dan Penjualan Grosir di luar promo', async () => {
    const reseller = (await db.insert(customers).values({ name: `Reseller PS ${run}`, defaultTierType: 'RESELLER' }).returning())[0].id
    const trx = await sale([{ productId: pakan, qty: 2, unitPrice: 25000 }], { customerId: reseller })
    expect(await discountsOf(trx.id)).toHaveLength(0)
    const bulk = await sale([{ productId: pakan, qty: 2, unitPrice: 25000 }], { saleType: 'BULK' })
    expect(await discountsOf(bulk.id)).toHaveLength(0)
    expect(await errorOf(sale([{ productId: pakan, qty: 2, unitPrice: 25000, promo: { promoId, amount: 2000 } }], { saleType: 'BULK' })))
      .toMatchObject({ code: 'PROMO_INVALID', status: 400 })
  })

  it('promo untuk kasir: hanya promo aktif cabang itu yang belum berakhir', async () => {
    const lain = (await createPromo({
      name: `Promo toko lain ${run}`, kind: 'POTONGAN', note: null, branchIds: [tokoLain],
      startsAt: hours(-1), endsAt: hours(24), dailyStartMinute: null, dailyEndMinute: null, isMultiple: false, maxPerNote: null,
      conditions: [{ productId: pasir, uomId: pcs, minQty: 1 }],
      rewards: [{ productId: pasir, uomId: pcs, type: 'POTONG_PER_PCS', value: 500, qty: null }],
    }, actor())).id
    const nanti = (await createPromo({
      name: `Promo besok ${run}`, kind: 'FLASH_SALE', note: null, branchIds: [toko],
      startsAt: hours(20), endsAt: hours(22), dailyStartMinute: null, dailyEndMinute: null, isMultiple: false, maxPerNote: null,
      conditions: [{ productId: pasir, uomId: pcs, minQty: 1 }],
      rewards: [{ productId: pasir, uomId: pcs, type: 'HARGA_JADI', value: 20000, qty: null }],
    }, actor())).id
    const ids = (await loadPromoRules(toko, new Date())).map((r) => r.id)
    expect(ids).toContain(promoId)
    expect(ids).toContain(nanti)
    expect(ids).not.toContain(lain)
    await deactivatePromo(nanti, actor())
    expect((await loadPromoRules(toko, new Date())).map((r) => r.id)).not.toContain(nanti)
    expect((await loadPromoRules(toko, new Date(Date.now() + 48 * 3600_000))).map((r) => r.id)).not.toContain(promoId)
  })
})
