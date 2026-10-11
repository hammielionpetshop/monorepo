import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productStocks, productStockBatches, stockShortfalls, roles, users,
  shifts, paymentMethods, transactions, transactionItems, returns, eq, and, sql,
} from '../db'
import { StockService } from './stock-service'
import { ServiceProductStockError } from './stock-validation'
import { TransactionService } from './transaction-service'
import { performVoid } from './void-service'
import { ReturService } from './retur-service'
import { TransactionEditService, TransactionEditError } from './transaction-edit-service'
import { stockLedgerUnion } from './stock-ledger'

// Jasa (J1): produk bertanda jasa tidak pernah menggerakkan stok — saat dijual, dibatalkan,
// diretur, maupun dikoreksi — dan ditolak di pintu stok mana pun. Nota LAMA (sebelum produknya
// ditandai jasa) tetap dibalik lewat stok, karena dulu memang memotong stok.
const run = randomUUID().slice(0, 8)
let toko: number
let userId: number
let pcs: number
let cashMethodId: number
let shiftId: number

async function stockState(productId: number) {
  const agg = await db.select().from(productStocks)
    .where(and(eq(productStocks.productId, productId), eq(productStocks.branchId, toko)))
  const batches = await db.select().from(productStockBatches)
    .where(and(eq(productStockBatches.productId, productId), eq(productStockBatches.branchId, toko)))
  const shortfalls = await db.select().from(stockShortfalls)
    .where(and(eq(stockShortfalls.productId, productId), eq(stockShortfalls.branchId, toko)))
  return {
    aggRows: agg.length,
    aggQty: agg.reduce((s, r) => s + Number(r.qty), 0),
    batchQty: batches.reduce((s, r) => s + Number(r.qtyRemaining), 0),
    batchRows: batches.length,
    shortfalls: shortfalls.length,
  }
}

const NOL = { aggRows: 0, aggQty: 0, batchQty: 0, batchRows: 0, shortfalls: 0 }

const ledgerRows = async (productId: number) =>
  db.execute<{ movement_type: string; qty_change: number }>(
    sql`WITH sm AS (${stockLedgerUnion}) SELECT movement_type, qty_change FROM sm
        WHERE product_id = ${productId} AND branch_id = ${toko} ORDER BY movement_type`,
  )

async function newService(nama: string) {
  const [p] = await db.insert(products).values({ name: `${nama} ${run}`, baseUomId: pcs, productKind: 'JASA_GROOMING' }).returning()
  return p.id
}

async function newGoods(nama: string, stok = 10) {
  const [p] = await db.insert(products).values({ name: `${nama} ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning()
  await db.transaction((tx) => StockService.addStock(tx, toko, p.id, pcs, String(stok), '1000'))
  return p.id
}

type Line = { productId: number; qty: number; unitPrice: number }
const sale = (lines: Line[], extra: Record<string, unknown> = {}) => {
  const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  return TransactionService.createTransaction({
    branchId: toko, cashierId: userId, shiftId, localTrxNumber: `JS-${randomUUID()}`,
    items: lines.map((l) => ({ productId: l.productId, uomId: pcs, qty: l.qty, unitPrice: l.unitPrice, discountAmount: 0, subtotal: l.qty * l.unitPrice, priceTier: 'RETAIL' })),
    payments: [{ paymentMethodId: cashMethodId, amount: total }],
    totals: { subtotal: total, discountTotal: 0, grandTotal: total }, amountPaid: total, change: 0,
    ...extra,
  } as never) as Promise<{ id: number; trxNumber: string }>
}

const linesOf = (trxId: number) =>
  db.select().from(transactionItems).where(eq(transactionItems.transactionId, trxId)).orderBy(transactionItems.id)

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `TJ${run}`, name: `Toko Jasa ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `JS${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `JS${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `PJ${run}`, name: 'Ekor tes', isBase: true }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai JS ${run}`, type: 'CASH' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
})

describe('Jasa tidak memotong stok (DB lokal)', () => {
  it('menjual jasa: nota tersimpan, tanpa stok/batch/utang stok, modal 0, tidak muncul di Mutasi Stok', async () => {
    const jasa = await newService('Grooming Uji')
    const trx = await sale([{ productId: jasa, qty: 2, unitPrice: 50000 }])

    const [line] = await linesOf(trx.id)
    expect(line.isService).toBe(true)
    expect(line.cogs).toBe(0)
    expect(line.totalPrice).toBe(100000)
    expect(await stockState(jasa)).toEqual(NOL)
    expect(await ledgerRows(jasa)).toHaveLength(0)
  })

  it('nota campuran: barang terpotong seperti biasa, jasa tidak', async () => {
    const jasa = await newService('Grooming Campur')
    const pakan = await newGoods('Pakan Campur')
    const trx = await sale([{ productId: jasa, qty: 1, unitPrice: 75000 }, { productId: pakan, qty: 3, unitPrice: 2000 }])

    const lines = await linesOf(trx.id)
    expect(lines.map((l) => l.isService)).toEqual([true, false])
    expect(await stockState(jasa)).toEqual(NOL)
    expect((await stockState(pakan)).batchQty).toBe(7)
    expect((await stockState(pakan)).aggQty).toBe(7)
  })

  it('batal nota campuran: stok barang kembali, jasa tetap tanpa stok', async () => {
    const jasa = await newService('Grooming Batal')
    const pakan = await newGoods('Pakan Batal')
    const trx = await sale([{ productId: jasa, qty: 1, unitPrice: 40000 }, { productId: pakan, qty: 4, unitPrice: 2000 }])
    expect((await stockState(pakan)).aggQty).toBe(6)

    await performVoid({ txId: trx.id, branchId: toko, trxNumber: trx.trxNumber, actorUserId: userId })

    const [header] = await db.select().from(transactions).where(eq(transactions.id, trx.id))
    expect(header.status).toBe('VOIDED')
    expect(await stockState(jasa)).toEqual(NOL)
    expect((await stockState(pakan)).aggQty).toBe(10)
    expect(await ledgerRows(jasa)).toHaveLength(0)
  })

  it('batal nota yang isinya hanya jasa tetap bisa', async () => {
    const jasa = await newService('Grooming Batal Saja')
    const trx = await sale([{ productId: jasa, qty: 1, unitPrice: 40000 }])
    await performVoid({ txId: trx.id, branchId: toko, trxNumber: trx.trxNumber, actorUserId: userId })
    expect((await db.select().from(transactions).where(eq(transactions.id, trx.id)))[0].status).toBe('VOIDED')
    expect(await stockState(jasa)).toEqual(NOL)
  })

  it('retur baris jasa lalu batal retur: uang tercatat, stok tidak bergerak', async () => {
    const jasa = await newService('Grooming Retur')
    const trx = await sale([{ productId: jasa, qty: 1, unitPrice: 100000 }])
    const [line] = await linesOf(trx.id)

    const retur = await ReturService.processRetur({
      transactionId: trx.id, actorBranchId: toko, isPrivileged: false, processedById: userId,
      reason: 'tes: pelanggan komplain', items: [{ transactionItemId: line.id, qty: '1' }],
    })
    const [row] = await db.select().from(returns).where(eq(returns.returnNumber, retur.returnNumber))
    expect(row.totalRefundAmount).toBe(100000)
    expect(await stockState(jasa)).toEqual(NOL)

    await ReturService.cancelReturn({ returnId: row.id, branchId: toko, cancelledById: userId, cancelReason: 'tes: salah input' })
    expect(await stockState(jasa)).toEqual(NOL)
    expect(await ledgerRows(jasa)).toHaveLength(0)
  })

  it('koreksi nota: baris jasa dikunci, baris barang pada nota yang sama tetap bisa dikoreksi', async () => {
    const jasa = await newService('Grooming Koreksi')
    const pakan = await newGoods('Pakan Koreksi')
    const trx = await sale([{ productId: jasa, qty: 1, unitPrice: 50000 }, { productId: pakan, qty: 2, unitPrice: 2000 }])
    const [jasaLine, pakanLine] = await linesOf(trx.id)
    const asInput = (l: typeof jasaLine, qty = l.qty) => ({
      transactionItemId: l.id, productId: l.productId as number, uomId: l.uomId, qty,
      unitPrice: l.unitPrice, discountAmount: l.discountAmount, priceTier: l.priceTier,
    })
    const edit = (items: ReturnType<typeof asInput>[], total: number) =>
      TransactionEditService.editTransaction({
        txId: trx.id, branchId: toko, actorUserId: userId, approvedById: userId, reason: 'tes koreksi',
        items, payments: [{ paymentMethodId: cashMethodId, amount: total }],
      })

    // ubah qty jasa → ditolak
    await expect(edit([asInput(jasaLine, 2), asInput(pakanLine)], 104000)).rejects.toMatchObject({ code: 'SERVICE_ITEM_LOCKED' })
    // hapus baris jasa → ditolak
    await expect(edit([asInput(pakanLine)], 4000)).rejects.toBeInstanceOf(TransactionEditError)
    expect((await stockState(pakan)).aggQty).toBe(8)

    // koreksi baris barang saja → berhasil, stok barang menyesuaikan, jasa utuh
    await edit([asInput(jasaLine), asInput(pakanLine, 1)], 52000)
    expect((await stockState(pakan)).aggQty).toBe(9)
    expect(await stockState(jasa)).toEqual(NOL)
    const after = await linesOf(trx.id)
    expect(after[0]).toMatchObject({ qty: 1, isService: true, totalPrice: 50000 })
  })

  it('nota LAMA (dijual saat masih barang) tetap dibalik lewat stok setelah produknya ditandai jasa', async () => {
    // Tanpa stok awal, seperti produk grooming sebelum ditandai jasa.
    const id = (await db.insert(products).values({ name: `Grooming Lama ${run}`, baseUomId: pcs }).returning())[0].id
    const trx = await sale([{ productId: id, qty: 1, unitPrice: 50000 }])
    const [line] = await linesOf(trx.id)
    expect(line.isService).toBe(false)
    expect((await stockState(id)).aggQty).toBe(-1) // perilaku lama: stok minus + utang stok
    expect((await stockState(id)).shortfalls).toBe(1)

    await db.update(products).set({ productKind: 'JASA_GROOMING' }).where(eq(products.id, id))
    await performVoid({ txId: trx.id, branchId: toko, trxNumber: trx.trxNumber, actorUserId: userId })

    expect((await stockState(id)).aggQty).toBe(0) // dikembalikan — konsisten dengan baris Mutasi Stok-nya
    const ledger = await ledgerRows(id)
    expect(ledger.map((r) => [r.movement_type, Number(r.qty_change)])).toEqual([['SALE_OUT', -1], ['SALE_VOID', 1]])
  })

  it('penjaga satu pintu: dokumen stok apa pun untuk produk jasa ditolak', async () => {
    const jasa = await newService('Grooming Penjaga')
    await expect(db.transaction((tx) => StockService.addStock(tx, toko, jasa, pcs, '5', '1000'))).rejects.toBeInstanceOf(ServiceProductStockError)
    await expect(db.transaction((tx) => StockService.deductStock(tx, toko, jasa, pcs, 1, true))).rejects.toBeInstanceOf(ServiceProductStockError)
    expect(await stockState(jasa)).toEqual(NOL)
  })

  it('jasa tidak bisa dijual lewat Bulk Sale — seluruh nota dibatalkan', async () => {
    const jasa = await newService('Grooming Bulk')
    const pakan = await newGoods('Pakan Bulk')
    await expect(sale([{ productId: pakan, qty: 1, unitPrice: 2000 }, { productId: jasa, qty: 1, unitPrice: 50000 }], { saleType: 'BULK' }))
      .rejects.toBeInstanceOf(ServiceProductStockError)
    expect((await stockState(pakan)).aggQty).toBe(10) // rollback: barang tidak ikut terpotong
  })
})
