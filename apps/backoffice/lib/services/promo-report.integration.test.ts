import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productPrices, productUomCosts, roles, users, shifts, paymentMethods,
  transactions, appSettings, eq,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { createPromo, setPromoEnabled, PROMO_SWITCH_SETTING_KEY } from './promo-service'
import { getPromoReport } from './promo-report-service'

// Laporan Promo (P2f): membaca nota berpromo sungguhan. Per promo jumlah nota/qty/omzet/potongan/
// laba benar; nota batal tak dihitung; peringkat toko & saringan cabang benar; pembanding membandingkan
// penjualan barang hadiah masa promo vs masa sebelumnya.
const run = randomUUID().slice(0, 8)
let toko: number
let userId: number
let pcs: number
let cashMethodId: number
let shiftId: number
let switchBefore: string | undefined

const NOW = new Date()
const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000)
const FROM = hours(-2)
const TO = hours(2)
const actor = () => ({ userId, branchId: toko })

let seq = 0
async function mkProduct(): Promise<number> {
  const id = (await db.insert(products).values({ name: `Barang LP ${run}-${seq++}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning())[0].id
  await db.transaction((tx) => StockService.addStock(tx, toko, id, pcs, '1000', '1000'))
  await db.insert(productPrices).values({ productId: id, branchId: toko, uomId: pcs, tierType: 'RETAIL', price: 25000 })
  await db.insert(productUomCosts).values({ productId: id, branchId: toko, uomId: pcs, costPrice: 1000 })
  return id
}

function mkPromo(productId: number, minQty: number, perPcs: number) {
  return createPromo({
    name: `Promo LP ${run}-${seq++}`, kind: 'POTONGAN', note: null, branchIds: [toko],
    startsAt: hours(-1).toISOString(), endsAt: hours(24).toISOString(), dailyStartMinute: null, dailyEndMinute: null,
    isMultiple: false, maxPerNote: null,
    conditions: [{ productId, uomId: pcs, minQty }],
    rewards: [{ productId, uomId: pcs, type: 'POTONG_PER_PCS', value: perPcs, qty: null }],
  }, actor()).then((r) => r.id)
}

type Line = { productId: number; qty: number; unitPrice: number; promo?: { promoId: number; amount: number } }

async function sale(lines: Line[], opts: { branchId?: number; shiftId?: number } = {}) {
  const items = lines.map((l) => {
    const discountAmount = l.promo?.amount ?? 0
    return {
      productId: l.productId, uomId: pcs, qty: l.qty, unitPrice: l.unitPrice, priceTier: 'RETAIL',
      discountAmount, subtotal: l.qty * l.unitPrice - discountAmount,
      ...(l.promo ? { promo: l.promo } : {}),
    }
  })
  const sum = items.reduce((s, i) => s + i.subtotal, 0)
  return TransactionService.createTransaction({
    branchId: opts.branchId ?? toko, cashierId: userId, shiftId: opts.shiftId ?? shiftId, localTrxNumber: `LP-${randomUUID()}`,
    items, payments: [{ paymentMethodId: cashMethodId, amount: sum }],
    totals: { subtotal: sum, discountTotal: 0, grandTotal: sum }, amountPaid: sum, change: 0,
  } as never) as Promise<{ id: number }>
}

const report = (branchId?: number) => getPromoReport({ from: FROM, to: TO, branchId })
const rowOf = async (promotionId: number, branchId?: number) =>
  (await report(branchId)).promos.find((p) => p.promotionId === promotionId)

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `LP${run}`, name: `Toko Laporan ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `LP${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `Kasir LP ${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `LP${run}`, name: 'Pcs tes', isBase: true }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai LP ${run}`, type: 'CASH' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
  switchBefore = row?.value
  await setPromoEnabled(true, actor())
})

afterAll(async () => {
  if (switchBefore === undefined) await db.delete(appSettings).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
  else await db.update(appSettings).set({ value: switchBefore }).where(eq(appSettings.key, PROMO_SWITCH_SETTING_KEY))
})

describe('Laporan Promo (DB lokal)', () => {
  it('per promo: jumlah nota, qty, omzet, potongan, dan laba benar', async () => {
    const barang = await mkProduct()
    const promoId = await mkPromo(barang, 2, 1000)
    await sale([{ productId: barang, qty: 3, unitPrice: 25000, promo: { promoId, amount: 3000 } }])
    await sale([{ productId: barang, qty: 2, unitPrice: 25000, promo: { promoId, amount: 2000 } }])

    const p = await rowOf(promoId)
    expect(p).toBeDefined()
    expect(p!.noteCount).toBe(2)
    expect(p!.qty).toBe(5)
    expect(p!.omzet).toBe(120000) // (75000−3000) + (50000−2000)
    expect(p!.discount).toBe(5000)
    expect(p!.cogs).toBe(5000) // 5 pcs × modal 1000
    expect(p!.profit).toBe(115000)
  })

  it('nota yang dibatalkan tidak dihitung', async () => {
    const barang = await mkProduct()
    const promoId = await mkPromo(barang, 2, 1000)
    await sale([{ productId: barang, qty: 2, unitPrice: 25000, promo: { promoId, amount: 2000 } }])
    const batal = await sale([{ productId: barang, qty: 4, unitPrice: 25000, promo: { promoId, amount: 4000 } }])
    await db.update(transactions).set({ status: 'VOIDED' }).where(eq(transactions.id, batal.id))

    const p = await rowOf(promoId)
    expect(p!.noteCount).toBe(1)
    expect(p!.qty).toBe(2)
    expect(p!.discount).toBe(2000)
  })

  it('peringkat toko & saringan cabang hanya menghitung cabang yang dipilih', async () => {
    const tokoLain = (await db.insert(branches).values({ code: `LX${run}`, name: `Toko Lain ${run}` }).returning())[0].id
    const shiftLain = (await db.insert(shifts).values({ branchId: tokoLain, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
    const barang = await mkProduct()
    await db.transaction((tx) => StockService.addStock(tx, tokoLain, barang, pcs, '1000', '1000'))
    await db.insert(productPrices).values({ productId: barang, branchId: tokoLain, uomId: pcs, tierType: 'RETAIL', price: 25000 })
    await db.insert(productUomCosts).values({ productId: barang, branchId: tokoLain, uomId: pcs, costPrice: 1000 })
    const promoId = (await createPromo({
      name: `Promo dua toko ${run}-${seq++}`, kind: 'POTONGAN', note: null, branchIds: [toko, tokoLain],
      startsAt: hours(-1).toISOString(), endsAt: hours(24).toISOString(), dailyStartMinute: null, dailyEndMinute: null,
      isMultiple: false, maxPerNote: null,
      conditions: [{ productId: barang, uomId: pcs, minQty: 2 }],
      rewards: [{ productId: barang, uomId: pcs, type: 'POTONG_PER_PCS', value: 1000, qty: null }],
    }, actor())).id
    await sale([{ productId: barang, qty: 2, unitPrice: 25000, promo: { promoId, amount: 2000 } }])
    await sale([{ productId: barang, qty: 3, unitPrice: 25000, promo: { promoId, amount: 3000 } }], { branchId: tokoLain, shiftId: shiftLain })

    const onlyLain = await report(tokoLain)
    const rankLain = onlyLain.branches.find((b) => b.branchId === tokoLain)
    expect(rankLain).toMatchObject({ noteCount: 1, qty: 3, discount: 3000 })
    expect(onlyLain.branches.find((b) => b.branchId === toko)).toBeUndefined()
    expect((await rowOf(promoId, tokoLain))!.qty).toBe(3)
  })

  it('pembanding: penjualan barang hadiah masa promo vs sebelum promo', async () => {
    const barang = await mkProduct()
    // Penjualan "sebelum promo" dibuat dulu (belum ada promo), lalu dimundurkan tanggalnya.
    const sebelum = await sale([{ productId: barang, qty: 5, unitPrice: 25000 }])
    await db.update(transactions).set({ createdAt: hours(-3) }).where(eq(transactions.id, sebelum.id))
    const promoId = await mkPromo(barang, 2, 1000)
    await sale([{ productId: barang, qty: 2, unitPrice: 25000, promo: { promoId, amount: 2000 } }])

    const p = await rowOf(promoId)
    expect(p!.comparison).toMatchObject({ periodQty: 2, beforeQty: 5, qtyDelta: -3, qtyChangePct: -60 })
  })
})
