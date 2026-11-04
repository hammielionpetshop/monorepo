import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import type { JWTPayload } from '@petshop/shared'
import {
  db, branches, unitsOfMeasure, products, roles, users, shifts, paymentMethods, customers,
  transactions, deliveryMethodChanges, eq, sql,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { changeTransactionDeliveryMethod } from '../delivery-method-server'

// Ubah cara kirim nota (Logistik Tahap 1 bagian kasir): tercatat di riwayat yang tidak bisa
// dihapus, dibatasi cabang asal + 7 hari untuk non Owner/GM.
const run = randomUUID().slice(0, 8)
let toko: number
let lain: number
let userId: number
let pcs: number
let cashMethodId: number
let shiftId: number
let customerId: number
let productId: number

const kasir = (branchId: number): JWTPayload =>
  ({ userId, role: 'CASHIER', branchId, branchScope: 'OWN', permissions: [] }) as unknown as JWTPayload
const owner = (): JWTPayload =>
  ({ userId, role: 'OWNER', branchId: lain, branchScope: 'ALL', permissions: [] }) as unknown as JWTPayload

const sale = (deliveryMethod: string | null) =>
  TransactionService.createTransaction({
    branchId: toko, cashierId: userId, shiftId, customerId, deliveryMethod,
    items: [{ productId, uomId: pcs, qty: 1, unitPrice: 2000, discountAmount: 0, subtotal: 2000, priceTier: 'ECERAN' }],
    payments: [{ paymentMethodId: cashMethodId, amount: 2000 }], totals: { subtotal: 2000, discountTotal: 0, grandTotal: 2000 }, amountPaid: 2000, change: 0,
  } as never) as Promise<{ id: number; trxNumber: string; deliveryMethod: string | null }>

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `DM${run}`, name: `Toko Kirim ${run}` }).returning())[0].id
  lain = (await db.insert(branches).values({ code: `DL${run}`, name: `Toko Lain ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `DM${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `DM${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `PD${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai DM ${run}`, type: 'CASH' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  customerId = (await db.insert(customers).values({ name: `Toko Maju ${run}` }).returning())[0].id
  const [p] = await db.insert(products).values({ name: `Pakan ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning()
  productId = p.id
  await db.transaction((tx) => StockService.addStock(tx, toko, p.id, pcs, '10', '1000'))
})

describe('cara kirim nota', () => {
  it('tersimpan di nota', async () => {
    const trx = await sale('TRUCK')
    const [row] = await db.select({ m: transactions.deliveryMethod }).from(transactions).where(eq(transactions.id, trx.id))
    expect(row.m).toBe('TRUCK')
  })

  it('cabang asal mengubah truk → ambil sendiri, tercatat di riwayat', async () => {
    const trx = await sale('TRUCK')
    await changeTransactionDeliveryMethod(kasir(toko), { transactionId: trx.id, newMethod: 'PICKUP', reason: 'Toko datang ambil' })
    const [row] = await db.select({ m: transactions.deliveryMethod }).from(transactions).where(eq(transactions.id, trx.id))
    expect(row.m).toBe('PICKUP')
    const log = await db.select().from(deliveryMethodChanges).where(eq(deliveryMethodChanges.documentId, trx.id))
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ documentType: 'TRANSACTION', oldMethod: 'TRUCK', newMethod: 'PICKUP', reason: 'Toko datang ambil', changedById: userId })
  })

  it('cabang lain ditolak, Owner/GM boleh', async () => {
    const trx = await sale('PICKUP')
    await expect(changeTransactionDeliveryMethod(kasir(lain), { transactionId: trx.id, newMethod: 'TRUCK', reason: 'x' })).rejects.toThrow(/cabang asal/)
    await changeTransactionDeliveryMethod(owner(), { transactionId: trx.id, newMethod: 'TRUCK', reason: 'Salah tandai' })
    const [row] = await db.select({ m: transactions.deliveryMethod }).from(transactions).where(eq(transactions.id, trx.id))
    expect(row.m).toBe('TRUCK')
  })

  it('lewat 7 hari hanya Owner/GM', async () => {
    const trx = await sale('TRUCK')
    await db.update(transactions).set({ createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) }).where(eq(transactions.id, trx.id))
    await expect(changeTransactionDeliveryMethod(kasir(toko), { transactionId: trx.id, newMethod: 'PICKUP', reason: 'telat' })).rejects.toThrow(/7 hari/)
    await changeTransactionDeliveryMethod(owner(), { transactionId: trx.id, newMethod: 'PICKUP', reason: 'telat' })
  })

  it('riwayat tidak bisa diubah atau dihapus', async () => {
    const trx = await sale('TRUCK')
    await changeTransactionDeliveryMethod(kasir(toko), { transactionId: trx.id, newMethod: 'PICKUP', reason: 'uji hapus' })
    await expect(db.execute(sql`delete from petshop.delivery_method_changes where document_id = ${trx.id}`)).rejects.toThrow()
    await expect(db.execute(sql`update petshop.delivery_method_changes set reason = 'x' where document_id = ${trx.id}`)).rejects.toThrow()
  })

  it('nilai di luar daftar ditolak database', async () => {
    const trx = await sale(null)
    await expect(db.update(transactions).set({ deliveryMethod: 'DRONE' }).where(eq(transactions.id, trx.id))).rejects.toThrow()
  })
})
