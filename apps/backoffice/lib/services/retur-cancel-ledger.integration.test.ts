import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productStockBatches, roles, users, shifts, paymentMethods,
  transactionItems, returns, eq, and, sql,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { ReturService } from './retur-service'
import { stockLedgerUnion } from './stock-ledger'

// Mutasi Stok harus mencatat pembatalan retur pelanggan: RETURN_IN saat retur, RETURN_CANCEL_OUT
// saat retur itu dibatalkan — jumlah keduanya nol, sama seperti stoknya.
const run = randomUUID().slice(0, 8)
let toko: number
let userId: number
let pcs: number
let cashMethodId: number
let shiftId: number

async function stockOf(productId: number) {
  const rows = await db.select().from(productStockBatches)
    .where(and(eq(productStockBatches.productId, productId), eq(productStockBatches.branchId, toko)))
  return rows.reduce((sum, row) => sum + Number(row.qtyRemaining), 0)
}

const ledgerRows = async (productId: number) =>
  db.execute<{ movement_type: string; qty_change: number; reference_number: string; notes: string | null; created_at: string | null }>(
    sql`WITH sm AS (${stockLedgerUnion}) SELECT movement_type, qty_change, reference_number, notes, created_at FROM sm
        WHERE product_id = ${productId} AND branch_id = ${toko} AND movement_type IN ('RETURN_IN', 'RETURN_CANCEL_OUT')
        ORDER BY movement_type`,
  )

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `TB${run}`, name: `Toko Batal Retur ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `BR${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `BR${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `PB${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai BR ${run}`, type: 'CASH' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
})

describe('Mutasi Stok — pembatalan retur pelanggan (DB lokal)', () => {
  it('retur menambah RETURN_IN; batal retur menambah RETURN_CANCEL_OUT sebesar qty yang sama', async () => {
    const [p] = await db.insert(products).values({ name: `Batal Retur ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning()
    await db.transaction((tx) => StockService.addStock(tx, toko, p.id, pcs, '10', '1000'))

    const trx = await TransactionService.createTransaction({
      branchId: toko, cashierId: userId, shiftId, localTrxNumber: `BR-${randomUUID()}`,
      items: [{ productId: p.id, uomId: pcs, qty: 3, unitPrice: 2000, discountAmount: 0, subtotal: 6000, priceTier: 'ECERAN' }],
      payments: [{ paymentMethodId: cashMethodId, amount: 6000 }], totals: { subtotal: 6000, discountTotal: 0, grandTotal: 6000 }, amountPaid: 6000, change: 0,
    } as never) as { id: number }
    expect(await stockOf(p.id)).toBe(7)
    const [line] = await db.select().from(transactionItems).where(eq(transactionItems.transactionId, trx.id))

    const retur = await ReturService.processRetur({
      transactionId: trx.id, actorBranchId: toko, isPrivileged: false, processedById: userId,
      reason: 'tes: salah barang', items: [{ transactionItemId: line.id, qty: '2' }],
    })
    expect(await stockOf(p.id)).toBe(9)
    expect((await ledgerRows(p.id)).map(r => [r.movement_type, Number(r.qty_change)])).toEqual([['RETURN_IN', 2]])

    const [row] = await db.select().from(returns).where(eq(returns.returnNumber, retur.returnNumber))
    await ReturService.cancelReturn({ returnId: row.id, branchId: toko, cancelledById: userId, cancelReason: 'tes: retur salah input' })
    expect(await stockOf(p.id)).toBe(7)

    const ledger = await ledgerRows(p.id)
    expect(ledger.map(r => [r.movement_type, Number(r.qty_change), r.reference_number])).toEqual([
      ['RETURN_CANCEL_OUT', -2, retur.returnNumber],
      ['RETURN_IN', 2, retur.returnNumber],
    ])
    expect(ledger[0].notes).toBe('Batal retur — tes: retur salah input')
    expect(ledger[0].created_at).not.toBeNull()
  })
})
