import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productUomConversions, productPrices, productUomCosts, roles, users, shifts,
  paymentMethods, transactions, auditLogs, and, eq,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { BelowCostSaleError } from '../below-cost'

// Larangan jual di bawah modal (spec 2026-11-10 periksa harga jual, Tahap 1): modal dibaca dari
// product_uom_costs cabang di dalam transaksi. Kasir ditolak tanpa menulis apa pun; Bulk Sale yang
// sudah dikonfirmasi tersimpan dan tercatat audit BELOW_COST_SALE.
const run = randomUUID().slice(0, 8)
let toko: number
let userId: number
let pcs: number
let dus: number
let cashMethodId: number
let shiftId: number
let omega: number

type Line = { uomId?: number; qty: number; unitPrice: number; manual?: number; promo?: { promoId: number; amount: number } }

const sale = (lines: Line[], extra: Record<string, unknown> = {}) => {
  const items = lines.map((l) => {
    const discountAmount = l.manual ?? 0
    return {
      productId: omega, uomId: l.uomId ?? pcs, qty: l.qty, unitPrice: l.unitPrice, priceTier: 'RETAIL',
      discountAmount, subtotal: l.qty * l.unitPrice - discountAmount,
      ...(l.manual ? { manualDiscount: { amount: l.manual, reasonCode: 'KEMASAN_RUSAK' } } : {}),
    }
  })
  const sum = items.reduce((s, i) => s + i.subtotal, 0)
  return TransactionService.createTransaction({
    branchId: toko, cashierId: userId, shiftId, localTrxNumber: `BC-${randomUUID()}`,
    items, payments: [{ paymentMethodId: cashMethodId, amount: sum }],
    totals: { subtotal: sum, discountTotal: 0, grandTotal: sum }, amountPaid: sum, change: 0, ...extra,
  } as never) as Promise<{ id: number; trxNumber: string }>
}

const errorOf = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)
const countTrx = async () => (await db.select({ id: transactions.id }).from(transactions).where(eq(transactions.branchId, toko))).length

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `BC${run}`, name: `Toko Modal ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `BC${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `Kasir BC ${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `BP${run}`, name: 'Pcs tes', isBase: true }).returning())[0].id
  dus = (await db.insert(unitsOfMeasure).values({ code: `BD${run}`, name: 'Dus tes', isBase: false }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai BC ${run}`, type: 'CASH' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  omega = (await db.insert(products).values({ name: `Omega BC ${run}`, baseUomId: pcs, defaultCostPrice: 5000 }).returning())[0].id
  await db.insert(productUomConversions).values({ productId: omega, uomId: dus, ratio: 12 })
  await db.transaction((tx) => StockService.addStock(tx, toko, omega, pcs, '500', '5000'))
  await db.insert(productPrices).values({ productId: omega, branchId: toko, uomId: pcs, tierType: 'RETAIL', price: 5500 })
  // Modal hanya di satuan dasar: modal DUS = 5.000 × 12 = 60.000.
  await db.insert(productUomCosts).values({ productId: omega, branchId: toko, uomId: pcs, costPrice: 5000 })
})

describe('Larangan jual di bawah modal (DB lokal)', () => {
  it('kasir: harga di atas modal tersimpan biasa', async () => {
    await expect(sale([{ qty: 2, unitPrice: 5500 }])).resolves.toMatchObject({ id: expect.any(Number) })
  })

  it('kasir: harga di bawah modal ditolak, tidak ada nota tertulis', async () => {
    const before = await countTrx()
    const err = await errorOf(sale([{ qty: 2, unitPrice: 4500 }]))
    expect(err).toBeInstanceOf(BelowCostSaleError)
    expect((err as BelowCostSaleError).lines[0]).toMatchObject({ unitCost: 5000, netUnitPrice: 4500, loss: 1000 })
    expect(await countTrx()).toBe(before)
  })

  it('kasir: diskon manual yang menembus modal ditolak', async () => {
    const err = await errorOf(sale([{ qty: 2, unitPrice: 5500, manual: 2000 }]))
    expect(err).toBeInstanceOf(BelowCostSaleError)
  })

  it('satuan besar tanpa baris modal memakai modal dasar × rasio', async () => {
    const err = await errorOf(sale([{ uomId: dus, qty: 1, unitPrice: 59000 }]))
    expect((err as BelowCostSaleError).lines[0]).toMatchObject({ unitCost: 60000, loss: 1000 })
    await expect(sale([{ uomId: dus, qty: 1, unitPrice: 60000 }])).resolves.toBeTruthy()
  })

  it('Bulk Sale yang sudah 2× dikonfirmasi tersimpan dan tercatat audit', async () => {
    const trx = await sale([{ qty: 3, unitPrice: 4000 }], { saleType: 'BULK', belowCostPolicy: 'CONFIRMED' })
    const [log] = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.action, 'BELOW_COST_SALE'), eq(auditLogs.recordId, String(trx.id))))
    const data = JSON.parse(String(log.newData))
    expect(data).toMatchObject({ policy: 'CONFIRMED', totalLoss: 3000, trxNumber: trx.trxNumber })
  })
})
