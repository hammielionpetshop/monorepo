import { randomUUID } from 'node:crypto'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productStockBatches, roles, users, shifts, paymentMethods,
  transactions, transactionItems, transactionPayments, eq, and, like,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService, isTrxNumberCollision } from './transaction-service'

// Nomor transaksi acak 4 angka bisa kembar. Simpan transaksi harus mencoba lagi dengan nomor baru
// tanpa mencatat apa pun dua kali, dan TIDAK boleh mengulang untuk tabrakan kunci idempotensi
// (kasir menekan Bayar dua kali / internet lambat) — itu memang harus ditolak.
const run = randomUUID().slice(0, 8)
let toko: number
let userId: number
let pcs: number
let cashMethodId: number
let shiftId: number

/** Nilai Math.random yang menghasilkan 4 angka tertentu di generateTrxNumber. */
const acak = (empatAngka: number) => (empatAngka + 0.5) / 10000

async function stockOf(productId: number) {
  const rows = await db.select().from(productStockBatches)
    .where(and(eq(productStockBatches.productId, productId), eq(productStockBatches.branchId, toko)))
  return rows.reduce((sum, row) => sum + Number(row.qtyRemaining), 0)
}

async function newProduct(nama: string) {
  const [p] = await db.insert(products).values({ name: `${nama} ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning()
  await db.transaction((tx) => StockService.addStock(tx, toko, p.id, pcs, '10', '1000'))
  return p.id
}

const sale = (productId: number, extra: Record<string, unknown> = {}) =>
  TransactionService.createTransaction({
    branchId: toko, cashierId: userId, shiftId,
    items: [{ productId, uomId: pcs, qty: 1, unitPrice: 2000, discountAmount: 0, subtotal: 2000, priceTier: 'ECERAN' }],
    payments: [{ paymentMethodId: cashMethodId, amount: 2000 }], totals: { subtotal: 2000, discountTotal: 0, grandTotal: 2000 }, amountPaid: 2000, change: 0,
    ...extra,
  } as never) as Promise<{ id: number; trxNumber: string }>

/** Empat angka yang belum dipakai hari ini di DB uji (yang berisi transaksi asli). */
async function nomorKosong(jumlah: number) {
  const awalan = `TRX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-`
  const terpakai = new Set((await db.select({ n: transactions.trxNumber }).from(transactions).where(like(transactions.trxNumber, `${awalan}%`))).map(r => r.n))
  const hasil: number[] = []
  for (let i = 9999; i >= 0 && hasil.length < jumlah; i--) if (!terpakai.has(`${awalan}${String(i).padStart(4, '0')}`)) hasil.push(i)
  return { awalan, angka: hasil }
}

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `TN${run}`, name: `Toko Nomor ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `TN${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `TN${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `PN${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai TN ${run}`, type: 'CASH' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
})

afterEach(() => vi.restoreAllMocks())

describe('Nomor transaksi kembar — coba ulang otomatis (DB lokal)', () => {
  it('nomor kembar: transaksi tetap tersimpan dengan nomor baru, stok & pembayaran tercatat sekali', async () => {
    const p = await newProduct('Kembar')
    const { awalan, angka: [a, b] } = await nomorKosong(2)
    const fmt = (n: number) => `${awalan}${String(n).padStart(4, '0')}`

    vi.spyOn(Math, 'random').mockReturnValue(acak(a))
    const pertama = await sale(p)
    expect(pertama.trxNumber).toBe(fmt(a))
    expect(await stockOf(p)).toBe(9)

    // Percobaan pertama mendapat nomor yang sama, percobaan kedua nomor lain.
    const random = vi.spyOn(Math, 'random').mockReturnValueOnce(acak(a)).mockReturnValue(acak(b))
    const kedua = await sale(p)
    expect(kedua.trxNumber).toBe(fmt(b))
    expect(random).toHaveBeenCalledTimes(2)

    expect(await stockOf(p)).toBe(8) // bukan 7: percobaan yang gagal tidak memotong stok
    const baris = await db.select().from(transactionItems).where(eq(transactionItems.productId, p))
    expect(baris).toHaveLength(2)
    const bayar = await db.select().from(transactionPayments).where(eq(transactionPayments.transactionId, kedua.id))
    expect(bayar.map(r => r.amount)).toEqual([2000])
    expect(await db.select().from(transactions).where(eq(transactions.trxNumber, fmt(a)))).toHaveLength(1)
  })

  it('kunci idempotensi (Bayar ditekan dua kali) TIDAK dicoba ulang — transaksi kedua ditolak, tidak jadi dobel', async () => {
    const p = await newProduct('Idempoten')
    const kunci = `uji-${randomUUID()}`
    await sale(p, { clientRequestId: kunci })
    expect(await stockOf(p)).toBe(9)

    const random = vi.spyOn(Math, 'random')
    const galat = await sale(p, { clientRequestId: kunci }).then(() => null, (e: unknown) => e)
    expect(galat).not.toBeNull()
    expect(isTrxNumberCollision(galat)).toBe(false)
    expect(random).toHaveBeenCalledTimes(1) // satu percobaan saja
    expect(await stockOf(p)).toBe(9)
    expect(await db.select().from(transactions).where(eq(transactions.clientRequestId, kunci))).toHaveLength(1)
  })

  it('nomor terus kembar: berhenti setelah 5 percobaan dan melempar galat, tanpa mencatat apa pun', async () => {
    const p = await newProduct('Buntu')
    const { angka: [a] } = await nomorKosong(1)
    vi.spyOn(Math, 'random').mockReturnValue(acak(a))
    await sale(p)
    const random = vi.spyOn(Math, 'random').mockReturnValue(acak(a))
    const galat = await sale(p).then(() => null, (e: unknown) => e)
    expect(isTrxNumberCollision(galat)).toBe(true)
    expect(random).toHaveBeenCalledTimes(5)
    expect(await stockOf(p)).toBe(9)
  })

  it('nomor kiriman klien yang kembar tidak diganti diam-diam', async () => {
    const p = await newProduct('Klien')
    const nomor = `UJI-${run}-${randomUUID().slice(0, 6)}`
    await sale(p, { localTrxNumber: nomor })
    const galat = await sale(p, { localTrxNumber: nomor }).then(() => null, (e: unknown) => e)
    expect(isTrxNumberCollision(galat)).toBe(true)
    expect(await stockOf(p)).toBe(9)
  })
})
