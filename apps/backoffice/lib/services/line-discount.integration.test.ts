import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productStocks, roles, users, shifts, paymentMethods,
  transactions, transactionItems, transactionItemDiscounts, eq, and,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { LineDiscountError } from './line-discount-service'
import { performVoid } from './void-service'
import { createGroomer } from './grooming-master-service'

// Diskon per barang (P1b): server memeriksa ulang diskon ketikan kasir dengan mesin diskon
// manual, mencatatnya di `transaction_item_discounts`, dan menolak nota yang angkanya tidak
// cocok. Nota cara lama (diskon total nota, tanpa diskon per barang) tetap tersimpan seperti
// dulu. Batal nota membalik stok seperti biasa; catatan potongannya tetap ada.
const run = randomUUID().slice(0, 8)
let toko: number
let userId: number
let pcs: number
let cashMethodId: number
let shiftId: number
let kurir: number

type Manual = { amount: number; reasonCode: string; reasonNote?: string | null }
type Line = {
  productId: number
  qty: number
  unitPrice: number
  manualDiscount?: Manual
  delivery?: { courierId: number; freeShipping?: boolean }
  discountAmount?: number
  subtotal?: number
}
type Totals = { subtotal: number; discountTotal: number; grandTotal: number }

const sale = (lines: Line[], totals?: Totals, extra: Record<string, unknown> = {}) => {
  const items = lines.map((l) => {
    const discountAmount = l.discountAmount ?? l.manualDiscount?.amount ?? 0
    return {
      productId: l.productId, uomId: pcs, qty: l.qty, unitPrice: l.unitPrice, priceTier: 'RETAIL',
      discountAmount, subtotal: l.subtotal ?? l.qty * l.unitPrice - discountAmount,
      ...(l.manualDiscount ? { manualDiscount: l.manualDiscount } : {}),
      ...(l.delivery ? { delivery: l.delivery } : {}),
    }
  })
  const sum = items.reduce((s, i) => s + i.subtotal, 0)
  const t = totals ?? { subtotal: sum, discountTotal: 0, grandTotal: sum }
  return TransactionService.createTransaction({
    branchId: toko, cashierId: userId, shiftId, localTrxNumber: `DB-${randomUUID()}`,
    items, payments: [{ paymentMethodId: cashMethodId, amount: t.grandTotal }],
    totals: t, amountPaid: t.grandTotal, change: 0, ...extra,
  } as never) as Promise<{ id: number; trxNumber: string }>
}

async function newGoods(nama: string, stok = 10) {
  const [p] = await db.insert(products).values({ name: `${nama} ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning()
  await db.transaction((tx) => StockService.addStock(tx, toko, p.id, pcs, String(stok), '1000'))
  return p.id
}

const stockOf = async (productId: number) =>
  (await db.select().from(productStocks).where(and(eq(productStocks.productId, productId), eq(productStocks.branchId, toko))))
    .reduce((s, r) => s + Number(r.qty), 0)

const linesOf = (trxId: number) =>
  db.select().from(transactionItems).where(eq(transactionItems.transactionId, trxId)).orderBy(transactionItems.id)

const discountsOf = (trxId: number) =>
  db.select().from(transactionItemDiscounts).where(eq(transactionItemDiscounts.transactionId, trxId)).orderBy(transactionItemDiscounts.id)

const countTrx = async () => (await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.branchId, toko))).length

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `TD${run}`, name: `Toko Diskon ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `DB${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `DB${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `PD${run}`, name: 'Pcs tes', isBase: true }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai DB ${run}`, type: 'CASH' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  kurir = (await createGroomer({ name: `Kurir DB ${run}`, isGroomer: false, isCourier: true }, { userId, branchId: toko })).id
})

describe('Diskon per barang di server (DB lokal)', () => {
  it('nota berdiskon per barang: baris, kepala nota, dan catatan potongan tersimpan cocok', async () => {
    const pakan = await newGoods('Pakan Diskon')
    const pasir = await newGoods('Pasir Polos')
    const trx = await sale([
      { productId: pakan, qty: 2, unitPrice: 25000, manualDiscount: { amount: 5000, reasonCode: 'KEMASAN_RUSAK' } },
      { productId: pasir, qty: 1, unitPrice: 10000 },
    ])

    const [header] = await db.select().from(transactions).where(eq(transactions.id, trx.id))
    expect(header.totalAmount).toBe(55000)
    expect(header.discountAmount).toBe(0)
    expect(header.payableAmount).toBe(55000)

    const [a, b] = await linesOf(trx.id)
    expect([a.discountAmount, a.totalPrice]).toEqual([5000, 45000])
    expect([b.discountAmount, b.totalPrice]).toEqual([0, 10000])

    const catatan = await discountsOf(trx.id)
    expect(catatan).toHaveLength(1)
    expect(catatan[0]).toMatchObject({
      transactionItemId: a.id, kind: 'MANUAL', amount: 5000, reasonCode: 'KEMASAN_RUSAK', reasonNote: null,
      promotionId: null, createdById: userId,
    })
    expect(await stockOf(pakan)).toBe(8)
  })

  it('alasan "Lainnya" menyimpan ketikan kasir', async () => {
    const pakan = await newGoods('Pakan Lainnya')
    const trx = await sale([{ productId: pakan, qty: 1, unitPrice: 20000, manualDiscount: { amount: 2000, reasonCode: 'LAINNYA', reasonNote: '  teman owner ' } }])
    const [catatan] = await discountsOf(trx.id)
    expect(catatan).toMatchObject({ reasonCode: 'LAINNYA', reasonNote: 'teman owner', amount: 2000 })
  })

  it('nota cara lama (diskon total nota) tetap diterima dan tidak membuat catatan potongan', async () => {
    const pakan = await newGoods('Pakan Lama')
    const trx = await sale([{ productId: pakan, qty: 2, unitPrice: 25000 }], { subtotal: 50000, discountTotal: 5000, grandTotal: 45000 })
    const [header] = await db.select().from(transactions).where(eq(transactions.id, trx.id))
    expect([header.totalAmount, header.discountAmount, header.payableAmount]).toEqual([50000, 5000, 45000])
    expect(await discountsOf(trx.id)).toHaveLength(0)
  })

  it('angka tidak cocok / alasan tidak sah / digabung diskon nota: nota ditolak utuh, stok tidak bergerak', async () => {
    const pakan = await newGoods('Pakan Tolak')
    const before = await countTrx()
    const manual = { amount: 5000, reasonCode: 'LANGGANAN' }

    await expect(sale([{ productId: pakan, qty: 2, unitPrice: 25000, manualDiscount: manual, discountAmount: 5000, subtotal: 40000 }]))
      .rejects.toBeInstanceOf(LineDiscountError)
    await expect(sale([{ productId: pakan, qty: 2, unitPrice: 25000, manualDiscount: { amount: 5000, reasonCode: 'ASAL' } }]))
      .rejects.toThrow('Pilih alasan diskon')
    await expect(sale([{ productId: pakan, qty: 2, unitPrice: 25000, manualDiscount: { amount: 5000, reasonCode: 'LAINNYA' } }]))
      .rejects.toThrow(/wajib diketik/)
    await expect(sale([{ productId: pakan, qty: 1, unitPrice: 25000, manualDiscount: { amount: 30000, reasonCode: 'LANGGANAN' }, subtotal: 0 }]))
      .rejects.toThrow(/melebihi harga/)
    await expect(sale([{ productId: pakan, qty: 2, unitPrice: 25000, manualDiscount: manual }], { subtotal: 45000, discountTotal: 5000, grandTotal: 40000 }))
      .rejects.toThrow(/tidak bisa digabung/)
    await expect(sale([{ productId: pakan, qty: 2, unitPrice: 25000, manualDiscount: manual }], { subtotal: 50000, discountTotal: 0, grandTotal: 50000 }))
      .rejects.toThrow(/Total nota tidak cocok/)

    expect(await countTrx()).toBe(before)
    expect(await stockOf(pakan)).toBe(10)
  })

  it('nota PO Internal berdiskon per barang ditolak sebelum apa pun ditulis', async () => {
    const pakan = await newGoods('Pakan PO Internal')
    const before = await countTrx()
    await expect(sale(
      [{ productId: pakan, qty: 2, unitPrice: 25000, manualDiscount: { amount: 5000, reasonCode: 'LANGGANAN' } }],
      undefined,
      { saleType: 'BULK', sourceIbtId: 999999999 },
    )).rejects.toThrow(/PO Internal/)
    expect(await countTrx()).toBe(before)
    expect(await stockOf(pakan)).toBe(10)
  })

  it('gratis ongkir tidak bisa didiskon manual lagi; gratis ongkir saja tidak dicatat sebagai potongan manual', async () => {
    const [ongkir] = await db.insert(products).values({ name: `Ongkir ${run}`, baseUomId: pcs, productKind: 'JASA_ONGKIR' }).returning()
    const gratis = { productId: ongkir.id, qty: 10, unitPrice: 1000, discountAmount: 10000, subtotal: 0, delivery: { courierId: kurir, freeShipping: true } }

    await expect(sale([{ ...gratis, manualDiscount: { amount: 10000, reasonCode: 'LANGGANAN' } }]))
      .rejects.toThrow(/sudah mendapat promo/)

    const trx = await sale([gratis])
    expect(await discountsOf(trx.id)).toHaveLength(0)
  })

  it('batal nota berdiskon: stok kembali, nota VOIDED, catatan potongan tetap ada', async () => {
    const pakan = await newGoods('Pakan Batal Diskon')
    const trx = await sale([{ productId: pakan, qty: 3, unitPrice: 20000, manualDiscount: { amount: 6000, reasonCode: 'HAMPIR_KEDALUWARSA' } }])
    expect(await stockOf(pakan)).toBe(7)

    await performVoid({ txId: trx.id, branchId: toko, trxNumber: trx.trxNumber, actorUserId: userId })

    const [header] = await db.select().from(transactions).where(eq(transactions.id, trx.id))
    expect(header.status).toBe('VOIDED')
    expect(await stockOf(pakan)).toBe(10)
    const catatan = await discountsOf(trx.id)
    expect(catatan).toHaveLength(1)
    expect(catatan[0].amount).toBe(6000)
  })
})
