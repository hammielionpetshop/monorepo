import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productPrices, productUomCosts, roles, users, shifts, paymentMethods,
  transactionItems, transactionItemDiscounts, returnItems, eq,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { TransactionEditService, type EditItemInput } from './transaction-edit-service'
import { ReturService } from './retur-service'
import { computeLiveShiftBreakdown } from './shift-live-breakdown'
import { listDiscountHistory } from './discount-history-service'
import { createPromo, setPromoEnabled } from './promo-service'
import { createGroomer, createPet } from './grooming-master-service'
import { listGroomingHistory, summarizeGrooming, listDeliveryHistory } from './grooming-report-service'
import { GROOMER_BONUS_PERCENT } from '../grooming-bonus'

// Promo di jalur lain (P2e): sesudah server mencatat potongan PROMO di `transaction_item_discounts`
// (sama seperti diskon manual), jalur-jalur yang membaca potongan itu tetap benar —
// Koreksi mengunci baris promo, "Total Diskon" tutup shift ikut menghitung promo, retur
// mengembalikan nilai sesudah promo, Riwayat Diskon menampilkannya sebagai jenis Promo dengan
// nama promonya, dan bonus groomer dihitung dari harga sesudah promo.
const run = randomUUID().slice(0, 8)
let toko: number
let userId: number
let pcs: number
let cashMethodId: number
let shiftId: number
let pakan: number
let pasir: number
let jasa: number
let groomerId: number
let rina: number
let mochi: number
let promoPakan: number
let promoGrooming: number

const NOW = new Date()
const hours = (h: number) => new Date(NOW.getTime() + h * 3600_000).toISOString()
const actor = () => ({ userId, branchId: toko })

type Line = {
  productId: number
  qty: number
  unitPrice: number
  promo?: { promoId: number; amount: number }
  grooming?: { petId: number; groomerId: number; condition: string }
}

const sale = (lines: Line[], extra: Record<string, unknown> = {}) => {
  const items = lines.map((l) => {
    const discountAmount = l.promo?.amount ?? 0
    return {
      productId: l.productId, uomId: pcs, qty: l.qty, unitPrice: l.unitPrice, priceTier: 'RETAIL',
      discountAmount, subtotal: l.qty * l.unitPrice - discountAmount,
      ...(l.promo ? { promo: l.promo } : {}),
      ...(l.grooming ? { grooming: l.grooming } : {}),
    }
  })
  const sum = items.reduce((s, i) => s + i.subtotal, 0)
  return TransactionService.createTransaction({
    branchId: toko, cashierId: userId, shiftId, localTrxNumber: `PJ-${randomUUID()}`,
    customerId: (extra.customerId as number | undefined) ?? null,
    items, payments: [{ paymentMethodId: cashMethodId, amount: sum }],
    totals: { subtotal: sum, discountTotal: 0, grandTotal: sum }, amountPaid: sum, change: 0, ...extra,
  } as never) as Promise<{ id: number; trxNumber: string }>
}

const linesOf = (trxId: number) =>
  db.select().from(transactionItems).where(eq(transactionItems.transactionId, trxId)).orderBy(transactionItems.id)

async function editPayload(trxId: number, change: (line: EditItemInput, index: number) => EditItemInput | null) {
  const lines = (await linesOf(trxId)).filter((l) => !l.isRemoved)
  return lines
    .map((l, index) => change({
      transactionItemId: l.id, productId: l.productId as number, uomId: l.uomId, qty: l.qty,
      unitPrice: l.unitPrice, discountAmount: l.discountAmount, priceTier: l.priceTier,
    }, index))
    .filter((l): l is EditItemInput => l != null)
}

const koreksi = (trxId: number, items: EditItemInput[], paid: number) =>
  TransactionEditService.editTransaction({
    txId: trxId, branchId: toko, actorUserId: userId, approvedById: userId, reason: 'Tes koreksi promo',
    items, payments: [{ paymentMethodId: cashMethodId, amount: paid }],
  })

const retur = (trxId: number, items: { transactionItemId: number; qty: string }[]) =>
  ReturService.processRetur({
    transactionId: trxId, actorBranchId: toko, isPrivileged: false, processedById: userId, reason: 'tes retur promo', items,
  })

const shiftDiscount = async () => (await computeLiveShiftBreakdown(db, shiftId, [userId])).totalDiscount
const range = () => ({ from: new Date(Date.now() - 3600_000), to: new Date(Date.now() + 3600_000) })

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `PJ${run}`, name: `Toko Promo Jalur ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `PJ${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `Kasir PJ ${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `PJ${run}`, name: 'Pcs tes', isBase: true }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai PJ ${run}`, type: 'CASH' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  pakan = (await db.insert(products).values({ name: `Pakan PJ ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning())[0].id
  pasir = (await db.insert(products).values({ name: `Pasir PJ ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning())[0].id
  jasa = (await db.insert(products).values({ name: `Grooming PJ ${run}`, baseUomId: pcs, productKind: 'JASA_GROOMING' }).returning())[0].id
  for (const id of [pakan, pasir]) {
    await db.transaction((tx) => StockService.addStock(tx, toko, id, pcs, '100', '1000'))
    await db.insert(productPrices).values({ productId: id, branchId: toko, uomId: pcs, tierType: 'RETAIL', price: 25000 })
    await db.insert(productUomCosts).values({ productId: id, branchId: toko, uomId: pcs, costPrice: 1000 })
  }
  groomerId = (await createGroomer({ name: `Groomer PJ ${run}`, isGroomer: true, isCourier: false }, actor())).id
  const pet = await createPet({ name: `Mochi PJ ${run}`, species: 'Persia', color: 'putih', ageYears: 2, newOwner: { name: `Ibu PJ ${run}`, phone: `0812${Date.now()}` } }, actor())
  mochi = pet.id
  rina = pet.customerId
  await setPromoEnabled(true, actor())
  // Pakan: mulai 2 pcs, potong Rp 1.000 per pcs.
  promoPakan = (await createPromo({
    name: `Promo Pakan ${run}`, kind: 'POTONGAN', note: null, branchIds: [toko],
    startsAt: hours(-1), endsAt: hours(24), dailyStartMinute: null, dailyEndMinute: null, isMultiple: false, maxPerNote: null,
    conditions: [{ productId: pakan, uomId: pcs, minQty: 2 }],
    rewards: [{ productId: pakan, uomId: pcs, type: 'POTONG_PER_PCS', value: 1000, qty: null }],
  }, actor())).id
  // Grooming: potong Rp 10.000 per ekor (mulai 1).
  promoGrooming = (await createPromo({
    name: `Promo Grooming ${run}`, kind: 'POTONGAN', note: null, branchIds: [toko],
    startsAt: hours(-1), endsAt: hours(24), dailyStartMinute: null, dailyEndMinute: null, isMultiple: false, maxPerNote: null,
    conditions: [{ productId: jasa, uomId: pcs, minQty: 1 }],
    rewards: [{ productId: jasa, uomId: pcs, type: 'POTONG_PER_PCS', value: 10000, qty: null }],
  }, actor())).id
})

describe('Promo di jalur lain (DB lokal)', () => {
  it('Riwayat Diskon mencatat potongan sebagai jenis Promo dengan nama promonya', async () => {
    const trx = await sale([
      { productId: pakan, qty: 3, unitPrice: 25000, promo: { promoId: promoPakan, amount: 3000 } },
      { productId: pasir, qty: 1, unitPrice: 25000 },
    ])
    const [pakanLine] = await linesOf(trx.id)
    const rows = await listDiscountHistory({ ...range(), branchId: toko })
    const promoRow = rows.find((r) => r.transactionId === trx.id && r.productId === pakan)
    expect(promoRow).toBeDefined()
    expect(promoRow).toMatchObject({ source: 'PROMO', reason: `Promo Pakan ${run}`, amount: 3000, qty: 3 })
    // Barang tanpa promo tidak muncul sebagai potongan.
    expect(rows.some((r) => r.transactionId === trx.id && r.productId === pasir)).toBe(false)
    expect(pakanLine).toMatchObject({ discountAmount: 3000, totalPrice: 72000 })
  })

  it('"Total Diskon" tutup shift ikut menghitung potongan promo', async () => {
    const before = await shiftDiscount()
    await sale([{ productId: pakan, qty: 2, unitPrice: 25000, promo: { promoId: promoPakan, amount: 2000 } }])
    expect((await shiftDiscount()) - before).toBe(2000)
  })

  it('Koreksi nota mengunci baris promo; baris lain tetap bisa dikoreksi', async () => {
    const trx = await sale([
      { productId: pakan, qty: 2, unitPrice: 25000, promo: { promoId: promoPakan, amount: 2000 } },
      { productId: pasir, qty: 2, unitPrice: 25000 },
    ])
    const locked = { code: 'DISCOUNT_ITEM_LOCKED' }
    // Ubah qty / hapus baris promo → ditolak.
    await expect(koreksi(trx.id, await editPayload(trx.id, (l, i) => (i === 0 ? { ...l, qty: 3 } : l)), 73000)).rejects.toMatchObject(locked)
    await expect(koreksi(trx.id, await editPayload(trx.id, (l, i) => (i === 0 ? null : l)), 50000)).rejects.toMatchObject(locked)
    // Koreksi baris non-promo (pasir) tetap jalan; baris promo utuh.
    await koreksi(trx.id, await editPayload(trx.id, (l, i) => (i === 1 ? { ...l, qty: 1 } : l)), 73000)
    const [pakanLine, pasirLine] = await linesOf(trx.id)
    expect(pakanLine).toMatchObject({ qty: 2, discountAmount: 2000, totalPrice: 48000 })
    expect(pasirLine).toMatchObject({ qty: 1, totalPrice: 25000 })
    const catatan = await db.select().from(transactionItemDiscounts).where(eq(transactionItemDiscounts.transactionId, trx.id))
    expect(catatan).toHaveLength(1)
    expect(catatan[0]).toMatchObject({ kind: 'PROMO', amount: 2000 })
  })

  it('Retur mengembalikan nilai sesudah promo, bukan harga penuh', async () => {
    const trx = await sale([{ productId: pakan, qty: 3, unitPrice: 25000, promo: { promoId: promoPakan, amount: 3000 } }])
    const [line] = await linesOf(trx.id)
    const info = await ReturService.getTransactionByTrxNumber(trx.trxNumber, toko)
    expect(info?.items[0]).toMatchObject({ netAmount: 72000, returnedQty: 0 })
    const hasil = await retur(trx.id, [{ transactionItemId: line.id, qty: '3' }])
    expect(hasil.totalRefundAmount).toBe(72000)
    const rows = await db.select().from(returnItems).where(eq(returnItems.transactionItemId, line.id))
    expect(rows.reduce((s, r) => s + r.refundAmount, 0)).toBe(72000)
  })

  it('Bonus groomer dihitung dari harga grooming sesudah promo', async () => {
    const trx = await sale([
      { productId: jasa, qty: 1, unitPrice: 100000, promo: { promoId: promoGrooming, amount: 10000 }, grooming: { petId: mochi, groomerId, condition: 'sehat' } },
    ], { customerId: rina })
    const [line] = await linesOf(trx.id)
    expect(line).toMatchObject({ discountAmount: 10000, totalPrice: 90000, isService: true })
    const rows = (await listGroomingHistory({ branchId: toko, ...range() })).filter((r) => r.transactionId === trx.id)
    expect(rows).toHaveLength(1)
    // Harga dasar bonus = 90.000 (sesudah promo), bonus 10% = 9.000.
    expect(rows[0]).toMatchObject({ netPrice: 90000, bonus: Math.round(90000 * GROOMER_BONUS_PERCENT / 100) })
    const summary = summarizeGrooming(rows, await listDeliveryHistory({ branchId: toko, ...range() }).then((d) => d.filter((x) => x.transactionId === trx.id)))
    expect(summary.grooming.netTotal).toBe(90000)
  })
})
