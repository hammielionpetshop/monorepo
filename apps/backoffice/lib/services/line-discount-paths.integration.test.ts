import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, roles, users, shifts, paymentMethods,
  transactions, transactionItems, transactionItemDiscounts, eq, and, sql,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { TransactionEditService, type EditItemInput } from './transaction-edit-service'
import { performVoid } from './void-service'
import { createGroomer } from './grooming-master-service'
import { computeLiveShiftBreakdown } from './shift-live-breakdown'
import { getProfitLossReport, getSalesByProductReport } from './report-service'

// Diskon per barang (P1e): jalur lain yang menyentuh angka nota tetap benar — Koreksi nota
// (baris berdiskon dikunci, cara tulis kepala nota dipertahankan, koreksi bukan pintu diskon),
// "Total Diskon" tutup shift, serta Penjualan per Produk dan Laba Rugi yang tetap cocok.
const run = randomUUID().slice(0, 8)
let toko: number
let userId: number
let pcs: number
let cashMethodId: number
let shiftId: number
let kurir: number
let ongkir: number

type Manual = { amount: number; reasonCode: string }
type Line = {
  productId: number
  qty: number
  unitPrice: number
  manualDiscount?: Manual
  delivery?: { courierId: number; freeShipping?: boolean }
}

const lineDiscount = (l: Line) => (l.delivery?.freeShipping ? l.qty * l.unitPrice : l.manualDiscount?.amount ?? 0)

/** `noteDiscount` = diskon total nota cara lama (tombol "+ Diskon" di layar bayar sebelum P1d). */
const sale = (lines: Line[], noteDiscount = 0) => {
  const items = lines.map((l) => ({
    productId: l.productId, uomId: pcs, qty: l.qty, unitPrice: l.unitPrice, priceTier: 'RETAIL',
    discountAmount: lineDiscount(l), subtotal: l.qty * l.unitPrice - lineDiscount(l),
    ...(l.manualDiscount ? { manualDiscount: l.manualDiscount } : {}),
    ...(l.delivery ? { delivery: l.delivery } : {}),
  }))
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0)
  const grandTotal = subtotal - noteDiscount
  return TransactionService.createTransaction({
    branchId: toko, cashierId: userId, shiftId, localTrxNumber: `JL-${randomUUID()}`,
    items, payments: [{ paymentMethodId: cashMethodId, amount: grandTotal }],
    totals: { subtotal, discountTotal: noteDiscount, grandTotal }, amountPaid: grandTotal, change: 0,
  } as never) as Promise<{ id: number; trxNumber: string }>
}

async function newGoods(nama: string) {
  const [p] = await db.insert(products).values({ name: `${nama} ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning()
  await db.transaction((tx) => StockService.addStock(tx, toko, p.id, pcs, '50', '1000'))
  return p.id
}

const headerOf = async (trxId: number) => (await db.select().from(transactions).where(eq(transactions.id, trxId)))[0]
const linesOf = (trxId: number) =>
  db.select().from(transactionItems).where(eq(transactionItems.transactionId, trxId)).orderBy(transactionItems.id)
const discountsOf = (trxId: number) =>
  db.select().from(transactionItemDiscounts).where(eq(transactionItemDiscounts.transactionId, trxId))

/** Muatan Koreksi = isi nota sekarang, dengan perubahan per baris (null = baris dihapus). */
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
    txId: trxId, branchId: toko, actorUserId: userId, approvedById: userId, reason: 'Tes koreksi diskon per barang',
    items, payments: [{ paymentMethodId: cashMethodId, amount: paid }],
  })

const shiftDiscount = async () => (await computeLiveShiftBreakdown(db, shiftId, [userId])).totalDiscount

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `TJ${run}`, name: `Toko Jalur ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `JL${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `JL${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `PJ${run}`, name: 'Pcs tes', isBase: true }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai JL ${run}`, type: 'CASH' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  kurir = (await createGroomer({ name: `Kurir JL ${run}`, isGroomer: false, isCourier: true }, { userId, branchId: toko })).id
  ongkir = (await db.insert(products).values({ name: `Ongkir JL ${run}`, baseUomId: pcs, productKind: 'JASA_ONGKIR' }).returning())[0].id
})

describe('Diskon per barang di jalur lain (DB lokal)', () => {
  it('koreksi baris lain: baris berdiskon, catatan potongan, dan cara tulis kepala nota tidak berubah', async () => {
    const pakan = await newGoods('Pakan Diskon')
    const pasir = await newGoods('Pasir Polos')
    const trx = await sale([
      { productId: pakan, qty: 2, unitPrice: 25000, manualDiscount: { amount: 10000, reasonCode: 'LANGGANAN' } },
      { productId: pasir, qty: 3, unitPrice: 10000 },
    ])

    await koreksi(trx.id, await editPayload(trx.id, (l, i) => (i === 1 ? { ...l, qty: 2 } : l)), 60000)

    // Kepala nota tetap cara kasir: jumlah baris sesudah potongan, diskon nota 0.
    expect(await headerOf(trx.id)).toMatchObject({ totalAmount: 60000, discountAmount: 0, payableAmount: 60000, revision: 2 })
    const [a, b] = await linesOf(trx.id)
    expect(a).toMatchObject({ qty: 2, discountAmount: 10000, totalPrice: 40000 })
    expect(b).toMatchObject({ qty: 2, discountAmount: 0, totalPrice: 20000 })
    const notes = await discountsOf(trx.id)
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({ transactionItemId: a.id, amount: 10000, reasonCode: 'LANGGANAN' })
  })

  it('baris berdiskon dikunci: qty, harga, atau menghapusnya ditolak dan nota tidak tersentuh', async () => {
    const pakan = await newGoods('Pakan Kunci')
    const pasir = await newGoods('Pasir Kunci')
    const trx = await sale([
      { productId: pakan, qty: 2, unitPrice: 25000, manualDiscount: { amount: 10000, reasonCode: 'LANGGANAN' } },
      { productId: pasir, qty: 1, unitPrice: 10000 },
    ])
    const locked = { code: 'DISCOUNT_ITEM_LOCKED' }

    await expect(koreksi(trx.id, await editPayload(trx.id, (l, i) => (i === 0 ? { ...l, qty: 1 } : l)), 25000)).rejects.toMatchObject(locked)
    await expect(koreksi(trx.id, await editPayload(trx.id, (l, i) => (i === 0 ? { ...l, unitPrice: 20000 } : l)), 40000)).rejects.toMatchObject(locked)
    await expect(koreksi(trx.id, await editPayload(trx.id, (l, i) => (i === 0 ? { ...l, discountAmount: 0 } : l)), 60000)).rejects.toMatchObject(locked)
    await expect(koreksi(trx.id, await editPayload(trx.id, (l, i) => (i === 0 ? null : l)), 10000)).rejects.toMatchObject(locked)
    // Ganti barang = hapus + tambah → juga ditolak.
    await expect(koreksi(trx.id, await editPayload(trx.id, (l, i) => (i === 0 ? { ...l, productId: pasir } : l)), 50000)).rejects.toMatchObject(locked)

    expect(await headerOf(trx.id)).toMatchObject({ totalAmount: 50000, discountAmount: 0, payableAmount: 50000, revision: 1 })
    expect((await linesOf(trx.id))[0]).toMatchObject({ qty: 2, discountAmount: 10000, totalPrice: 40000, isRemoved: false })
  })

  it('koreksi bukan pintu diskon: menambah potongan di baris lama atau di barang baru ditolak', async () => {
    const pakan = await newGoods('Pakan Pintu')
    const pasir = await newGoods('Pasir Pintu')
    const trx = await sale([{ productId: pakan, qty: 2, unitPrice: 25000 }])
    const refused = { code: 'DISCOUNT_NOT_ALLOWED' }

    await expect(koreksi(trx.id, await editPayload(trx.id, (l) => ({ ...l, discountAmount: 5000 })), 45000)).rejects.toMatchObject(refused)
    const withNew = [
      ...(await editPayload(trx.id, (l) => l)),
      { transactionItemId: null, productId: pasir, uomId: pcs, qty: 1, unitPrice: 10000, discountAmount: 4000, priceTier: 'RETAIL' },
    ]
    await expect(koreksi(trx.id, withNew, 56000)).rejects.toMatchObject(refused)

    expect(await headerOf(trx.id)).toMatchObject({ payableAmount: 50000, revision: 1 })
    expect(await discountsOf(trx.id)).toHaveLength(0)
  })

  it('nota lama: gratis ongkir + diskon total nota → diskon nota tidak hilang saat dikoreksi', async () => {
    const pasir = await newGoods('Pasir Lama')
    const trx = await sale([
      { productId: ongkir, qty: 10, unitPrice: 1000, delivery: { courierId: kurir, freeShipping: true } },
      { productId: pasir, qty: 5, unitPrice: 10000 },
    ], 3000)
    expect(await headerOf(trx.id)).toMatchObject({ totalAmount: 50000, discountAmount: 3000, payableAmount: 47000 })

    await koreksi(trx.id, await editPayload(trx.id, (l, i) => (i === 1 ? { ...l, qty: 4 } : l)), 37000)

    // Rumus lama menganggap diskon nota "sudah termasuk" potongan ongkir → diskon 3.000 hilang.
    expect(await headerOf(trx.id)).toMatchObject({ totalAmount: 40000, discountAmount: 3000, payableAmount: 37000 })
  })

  it('Total Diskon tutup shift = diskon nota + diskon per barang; nota batal & gratis ongkir tidak dihitung', async () => {
    const pakan = await newGoods('Pakan Shift')
    const before = await shiftDiscount()

    await sale([{ productId: pakan, qty: 2, unitPrice: 25000, manualDiscount: { amount: 10000, reasonCode: 'LANGGANAN' } }])
    await sale([{ productId: pakan, qty: 1, unitPrice: 25000 }], 3000)
    await sale([{ productId: ongkir, qty: 10, unitPrice: 1000, delivery: { courierId: kurir, freeShipping: true } }, { productId: pakan, qty: 1, unitPrice: 25000 }])
    const batal = await sale([{ productId: pakan, qty: 1, unitPrice: 25000, manualDiscount: { amount: 4000, reasonCode: 'LANGGANAN' } }])
    await performVoid({ txId: batal.id, branchId: toko, trxNumber: batal.trxNumber, actorUserId: userId })

    expect((await shiftDiscount()) - before).toBe(13000)
  })

  it('Penjualan per Produk dan Laba Rugi tetap cocok: selisihnya hanya diskon total nota', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
    const completed = and(eq(transactions.branchId, toko), eq(transactions.status, 'COMPLETED'))
    const [lines] = await db.select({ total: sql<number>`COALESCE(SUM(${transactionItems.totalPrice}), 0)::integer` })
      .from(transactionItems)
      .innerJoin(transactions, eq(transactions.id, transactionItems.transactionId))
      .where(and(completed, eq(transactionItems.isRemoved, false)))
    const [head] = await db.select({
      payable: sql<number>`COALESCE(SUM(${transactions.payableAmount}), 0)::integer`,
      noteDiscount: sql<number>`COALESCE(SUM(${transactions.discountAmount}), 0)::integer`,
    }).from(transactions).where(completed)

    const perProduk = await getSalesByProductReport({ startDate: today, endDate: today, branchId: toko })
    const labaRugi = (await getProfitLossReport({ startDate: today, endDate: today })).items.find((i) => i.branchId === toko)

    expect(lines.total).toBeGreaterThan(0)
    // Penjualan per Produk = yang ditagih per baris (potongan per barang sudah di dalamnya).
    expect(Number(perProduk.totalRevenue)).toBe(lines.total)
    // Laba Rugi = yang dibayar; berbeda dari Penjualan per Produk hanya sebesar diskon total nota.
    expect(Number(labaRugi?.revenue)).toBe(head.payable)
    expect(lines.total - head.payable).toBe(head.noteDiscount)
  })
})
