import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productStocks, roles, users, shifts, paymentMethods, customers,
  customerDebts, transactionItems, returns, returnItems, eq, and,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { ReturService } from './retur-service'
import { createGroomer } from './grooming-master-service'

// Retur mengikuti nilai yang benar-benar dibayar (P1c): uang kembali dihitung mesin nilai
// bersih baris — baris berdiskon, nota lama berdiskon total, dan gratis ongkir tidak pernah
// mengembalikan lebih dari yang dibayar pelanggan. Nota tanpa diskon tetap qty × harga.
const run = randomUUID().slice(0, 8)
let toko: number
let userId: number
let pcs: number
let cashMethodId: number
let debtMethodId: number
let shiftId: number
let pelanggan: number
let kurir: number

type Line = {
  productId: number
  qty: number
  unitPrice: number
  manualDiscount?: { amount: number; reasonCode: string }
  delivery?: { courierId: number; freeShipping?: boolean }
  discountAmount?: number
}

const sale = (lines: Line[], opts: { notaDiscount?: number; debt?: boolean } = {}) => {
  const items = lines.map((l) => {
    const discountAmount = l.discountAmount ?? l.manualDiscount?.amount ?? 0
    return {
      productId: l.productId, uomId: pcs, qty: l.qty, unitPrice: l.unitPrice, priceTier: 'RETAIL',
      discountAmount, subtotal: l.qty * l.unitPrice - discountAmount,
      ...(l.manualDiscount ? { manualDiscount: l.manualDiscount } : {}),
      ...(l.delivery ? { delivery: l.delivery } : {}),
    }
  })
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0)
  const grandTotal = subtotal - (opts.notaDiscount ?? 0)
  return TransactionService.createTransaction({
    branchId: toko, cashierId: userId, shiftId, localTrxNumber: `RN-${randomUUID()}`,
    customerId: opts.debt ? pelanggan : null,
    items, payments: [{ paymentMethodId: opts.debt ? debtMethodId : cashMethodId, amount: grandTotal }],
    totals: { subtotal, discountTotal: opts.notaDiscount ?? 0, grandTotal }, amountPaid: grandTotal, change: 0,
  } as never) as Promise<{ id: number; trxNumber: string }>
}

async function newGoods(nama: string, stok = 20) {
  const [p] = await db.insert(products).values({ name: `${nama} ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning()
  await db.transaction((tx) => StockService.addStock(tx, toko, p.id, pcs, String(stok), '1000'))
  return p.id
}

const stockOf = async (productId: number) =>
  (await db.select().from(productStocks).where(and(eq(productStocks.productId, productId), eq(productStocks.branchId, toko))))
    .reduce((s, r) => s + Number(r.qty), 0)

const linesOf = (trxId: number) =>
  db.select().from(transactionItems).where(eq(transactionItems.transactionId, trxId)).orderBy(transactionItems.id)

const retur = (trxId: number, items: { transactionItemId: number; qty: string }[]) =>
  ReturService.processRetur({
    transactionId: trxId, actorBranchId: toko, isPrivileged: false, processedById: userId, reason: 'tes: nilai retur', items,
  })

const returRow = async (returnNumber: string) => (await db.select().from(returns).where(eq(returns.returnNumber, returnNumber)))[0]

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `TR${run}`, name: `Toko Retur Bersih ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `RN${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `RN${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `PR${run}`, name: 'Pcs tes', isBase: true }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai RN ${run}`, type: 'CASH' }).returning())[0].id
  debtMethodId = (await db.insert(paymentMethods).values({ name: `Piutang RN ${run}`, type: 'DEBT' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  pelanggan = (await db.insert(customers).values({ name: `Pelanggan RN ${run}` }).returning())[0].id
  kurir = (await createGroomer({ name: `Kurir RN ${run}`, isGroomer: false, isCourier: true }, { userId, branchId: toko })).id
})

describe('Retur mengikuti nilai yang benar-benar dibayar (DB lokal)', () => {
  it('nota tanpa diskon: uang kembali tetap qty × harga', async () => {
    const pakan = await newGoods('Pakan Polos')
    const trx = await sale([{ productId: pakan, qty: 3, unitPrice: 20000 }])
    const [line] = await linesOf(trx.id)

    const hasil = await retur(trx.id, [{ transactionItemId: line.id, qty: '2' }])

    expect(hasil.totalRefundAmount).toBe(40000)
    expect(hasil.cashRefundAmount).toBe(40000)
    expect(await stockOf(pakan)).toBe(19)
  })

  it('baris berdiskon per barang: retur sebagian mengembalikan bagian sebanding; total semua retur = yang dibayar', async () => {
    const pakan = await newGoods('Pakan Diskon')
    // 3 × 10.000 dipotong 1.000 → dibayar 29.000 (tidak habis dibagi 3).
    const trx = await sale([{ productId: pakan, qty: 3, unitPrice: 10000, manualDiscount: { amount: 1000, reasonCode: 'KEMASAN_RUSAK' } }])
    const [line] = await linesOf(trx.id)

    const info = await ReturService.getTransactionByTrxNumber(trx.trxNumber, toko)
    expect(info?.items[0]).toMatchObject({ netAmount: 29000, returnedQty: 0, refundedAmount: 0 })

    const a = await retur(trx.id, [{ transactionItemId: line.id, qty: '1' }])
    const b = await retur(trx.id, [{ transactionItemId: line.id, qty: '1' }])
    const c = await retur(trx.id, [{ transactionItemId: line.id, qty: '1' }])

    expect([a.totalRefundAmount, b.totalRefundAmount, c.totalRefundAmount]).toEqual([9666, 9666, 9668])
    const rows = await db.select().from(returnItems).where(eq(returnItems.transactionItemId, line.id))
    expect(rows.reduce((s, r) => s + r.refundAmount, 0)).toBe(29000)
    // Harga satuan di catatan retur tetap harga nota; kepala retur = jumlah barisnya.
    expect(rows.every((r) => r.unitPrice === 10000)).toBe(true)
    expect((await returRow(c.returnNumber)).totalRefundAmount).toBe(9668)
    expect(await stockOf(pakan)).toBe(20)
  })

  it('nota lama berdiskon total nota: diskon dibagi sebanding nilai baris', async () => {
    const mahal = await newGoods('Pakan Mahal')
    const murah = await newGoods('Pasir Murah')
    // 60.000 + 40.000 = 100.000, diskon nota 10.000 → dibayar 90.000 (54.000 + 36.000).
    const trx = await sale([{ productId: mahal, qty: 2, unitPrice: 30000 }, { productId: murah, qty: 4, unitPrice: 10000 }], { notaDiscount: 10000 })
    const [a, b] = await linesOf(trx.id)

    const hasil = await retur(trx.id, [{ transactionItemId: a.id, qty: '1' }, { transactionItemId: b.id, qty: '4' }])

    expect(hasil.totalRefundAmount).toBe(27000 + 36000)
    const sisa = await retur(trx.id, [{ transactionItemId: a.id, qty: '1' }])
    expect(sisa.totalRefundAmount).toBe(27000)
  })

  it('gratis ongkir diretur: tidak ada uang yang kembali', async () => {
    const [ongkir] = await db.insert(products).values({ name: `Ongkir RN ${run}`, baseUomId: pcs, productKind: 'JASA_ONGKIR' }).returning()
    const pakan = await newGoods('Pakan Antar')
    const trx = await sale([
      { productId: pakan, qty: 1, unitPrice: 50000 },
      { productId: ongkir.id, qty: 10, unitPrice: 1000, discountAmount: 10000, delivery: { courierId: kurir, freeShipping: true } },
    ])
    const [, barisOngkir] = await linesOf(trx.id)

    const hasil = await retur(trx.id, [{ transactionItemId: barisOngkir.id, qty: '10' }])

    expect(hasil.totalRefundAmount).toBe(0)
    expect(hasil.cashRefundAmount).toBe(0)
  })

  it('penjualan kredit berdiskon: retur memotong piutang sebesar nilai bersih, bukan harga penuh', async () => {
    const pakan = await newGoods('Pakan Kredit')
    // 2 × 25.000 dipotong 5.000 → piutang 45.000.
    const trx = await sale([{ productId: pakan, qty: 2, unitPrice: 25000, manualDiscount: { amount: 5000, reasonCode: 'LANGGANAN' } }], { debt: true })
    const [line] = await linesOf(trx.id)

    const satu = await retur(trx.id, [{ transactionItemId: line.id, qty: '1' }])
    expect(satu).toMatchObject({ totalRefundAmount: 22500, debtReductionAmount: 22500, cashRefundAmount: 0 })
    const dua = await retur(trx.id, [{ transactionItemId: line.id, qty: '1' }])
    expect(dua).toMatchObject({ totalRefundAmount: 22500, debtReductionAmount: 22500, cashRefundAmount: 0 })

    const [debt] = await db.select().from(customerDebts).where(eq(customerDebts.transactionId, trx.id))
    expect(debt.remainingAmount).toBe(0)
  })

  it('batal retur: piutang & stok pulih, lalu barang yang sama bisa diretur lagi dengan nilai yang sama', async () => {
    const pakan = await newGoods('Pakan Batal Retur')
    const trx = await sale([{ productId: pakan, qty: 2, unitPrice: 25000, manualDiscount: { amount: 5000, reasonCode: 'LANGGANAN' } }], { debt: true })
    const [line] = await linesOf(trx.id)

    const pertama = await retur(trx.id, [{ transactionItemId: line.id, qty: '2' }])
    expect(pertama.totalRefundAmount).toBe(45000)
    expect(await stockOf(pakan)).toBe(20)

    const row = await returRow(pertama.returnNumber)
    await ReturService.cancelReturn({ returnId: row.id, branchId: toko, cancelledById: userId, cancelReason: 'tes: salah input' })
    expect(await stockOf(pakan)).toBe(18)
    const [pulih] = await db.select().from(customerDebts).where(eq(customerDebts.transactionId, trx.id))
    expect(pulih.remainingAmount).toBe(45000)

    const info = await ReturService.getTransactionByTrxNumber(trx.trxNumber, toko)
    expect(info?.items[0]).toMatchObject({ remainingQty: '2', returnedQty: 0, refundedAmount: 0 })

    const ulang = await retur(trx.id, [{ transactionItemId: line.id, qty: '2' }])
    expect(ulang).toMatchObject({ totalRefundAmount: 45000, debtReductionAmount: 45000 })
  })

  it('Penjualan Grosir berpotongan per barang (kepala nota = sebelum potongan): potongan tidak dihitung dua kali', async () => {
    const pakan = await newGoods('Pakan Grosir')
    // Bentuk simpan Bulk Sale: subtotal kepala = bruto 100.000, diskon = jumlah potongan baris.
    const trx = await TransactionService.createTransaction({
      branchId: toko, cashierId: userId, shiftId, localTrxNumber: `RN-${randomUUID()}`, saleType: 'BULK',
      items: [{ productId: pakan, uomId: pcs, qty: 4, unitPrice: 25000, priceTier: 'GROSIR', discountAmount: 8000, subtotal: 92000 }],
      payments: [{ paymentMethodId: cashMethodId, amount: 92000 }],
      totals: { subtotal: 100000, discountTotal: 8000, grandTotal: 92000 }, amountPaid: 92000, change: 0,
    } as never) as { id: number }
    const [line] = await linesOf(trx.id)

    const hasil = await retur(trx.id, [{ transactionItemId: line.id, qty: '1' }])

    expect(hasil.totalRefundAmount).toBe(23000)
  })

  it('qty melebihi sisa tetap ditolak', async () => {
    const pakan = await newGoods('Pakan Lebih')
    const trx = await sale([{ productId: pakan, qty: 2, unitPrice: 10000 }])
    const [line] = await linesOf(trx.id)
    await retur(trx.id, [{ transactionItemId: line.id, qty: '1' }])
    await expect(retur(trx.id, [{ transactionItemId: line.id, qty: '2' }])).rejects.toThrow(/melebihi sisa/)
  })
})
