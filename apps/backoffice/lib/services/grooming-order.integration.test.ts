import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productStocks, roles, users, shifts, paymentMethods,
  transactions, transactionItems, customerDebts, groomingOrders, returns, eq,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { performVoid } from './void-service'
import { ReturService } from './retur-service'
import { createGroomer, createPet, updateGroomer, updatePet } from './grooming-master-service'
import { payCustomerDebtsAtPos } from './pos-debt-service'
import {
  GroomingOrderError, listGroomingOrders, listGroomingOrdersOfTransaction, markGroomingPickedUp, recordGroomingTicketPrint,
} from './grooming-order-service'

// Jasa grooming J3a: nota membawa data kucing & groomer per ekor → grooming_orders; grooming ikut
// batal saat notanya dibatalkan / barisnya diretur; daftar & serah terima per cabang.
const run = randomUUID().slice(0, 8)
const nomor = (n: number) => `08${(parseInt(run, 16) % 100000000).toString().padStart(8, '0')}${n}${n}`
let toko: number
let tokoLain: number
let userId: number
let ekor: number
let cashId: number
let debtId: number
let shiftId: number
let jasa: number
let pakan: number
let dedi: number
let asep: number
let rina: number
let mochi: number
let oyen: number
let actor: { userId: number; branchId: number }

type Line = { productId: number; qty?: number; unitPrice: number; grooming?: { petId: number; groomerId: number; condition: string } }
const sale = (lines: Line[], extra: Record<string, unknown> = {}, payDebt = false) => {
  const total = lines.reduce((s, l) => s + (l.qty ?? 1) * l.unitPrice, 0)
  return TransactionService.createTransaction({
    branchId: toko, cashierId: userId, shiftId, localTrxNumber: `GO-${randomUUID()}`, customerId: rina,
    items: lines.map((l) => ({
      productId: l.productId, uomId: ekor, qty: l.qty ?? 1, unitPrice: l.unitPrice, discountAmount: 0,
      subtotal: (l.qty ?? 1) * l.unitPrice, priceTier: 'RETAIL', ...(l.grooming ? { grooming: l.grooming } : {}),
    })),
    payments: [{ paymentMethodId: payDebt ? debtId : cashId, amount: total }],
    totals: { subtotal: total, discountTotal: 0, grandTotal: total }, amountPaid: payDebt ? 0 : total, change: 0,
    ...extra,
  } as never) as Promise<{ id: number; trxNumber: string }>
}
const g = (petId: number, groomerId: number, condition = 'sehat') => ({ petId, groomerId, condition })
const ordersOf = (trxId: number) => db.select().from(groomingOrders).where(eq(groomingOrders.transactionId, trxId)).orderBy(groomingOrders.sequence)

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `GO${run}`, name: `Toko Grooming ${run}` }).returning())[0].id
  tokoLain = (await db.insert(branches).values({ code: `GL${run}`, name: `Toko Lain ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `GO${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `GO${run}`, roleId, branchId: toko }).returning())[0].id
  actor = { userId, branchId: toko }
  ekor = (await db.insert(unitsOfMeasure).values({ code: `EK${run}`, name: 'Ekor tes', isBase: true }).returning())[0].id
  cashId = (await db.insert(paymentMethods).values({ name: `Tunai GO ${run}`, type: 'CASH' }).returning())[0].id
  debtId = (await db.insert(paymentMethods).values({ name: `Piutang GO ${run}`, type: 'DEBT' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  jasa = (await db.insert(products).values({ name: `Grooming Sehat ${run}`, baseUomId: ekor, productKind: 'JASA_GROOMING' }).returning())[0].id
  pakan = (await db.insert(products).values({ name: `Pakan ${run}`, baseUomId: ekor, defaultCostPrice: 1000 }).returning())[0].id
  await db.transaction((tx) => StockService.addStock(tx, toko, pakan, ekor, '10', '1000'))
  dedi = (await createGroomer({ name: `Dedi GO ${run}` }, actor)).id
  asep = (await createGroomer({ name: `Asep GO ${run}` }, actor)).id
  const m = await createPet({ name: `Mochi ${run}`, species: 'Persia', color: 'putih', ageYears: 2, newOwner: { name: `Ibu Rina GO ${run}`, phone: nomor(7) } }, actor)
  mochi = m.id
  rina = m.customerId
  oyen = (await createPet({ name: `Oyen ${run}`, species: 'Domestik', color: 'oranye', ageMonths: 8, customerId: rina }, actor)).id
})

describe('Nota grooming → grooming_orders (DB lokal)', () => {
  it('dua ekor + pakan dalam satu nota: satu grooming per ekor dengan groomer masing-masing, urutan karcis 1 dan 2, pakan tetap memotong stok', async () => {
    const trx = await sale([
      { productId: jasa, unitPrice: 50000, grooming: g(mochi, dedi, 'luka kecil di telinga kiri') },
      { productId: pakan, qty: 2, unitPrice: 2000 },
      { productId: jasa, unitPrice: 50000, grooming: g(oyen, asep) },
    ])
    const orders = await ordersOf(trx.id)
    expect(orders.map((o) => [o.sequence, o.petId, o.groomerId, o.status, o.customerId, o.branchId])).toEqual([
      [1, mochi, dedi, 'DIKERJAKAN', rina, toko],
      [2, oyen, asep, 'DIKERJAKAN', rina, toko],
    ])
    expect(orders[0].condition).toBe('luka kecil di telinga kiri')
    expect(orders[0].receivedById).toBe(userId)

    const lines = await db.select().from(transactionItems).where(eq(transactionItems.transactionId, trx.id))
    expect(lines).toHaveLength(3) // dua baris jasa TIDAK digabung jadi qty 2
    const [stok] = await db.select().from(productStocks).where(eq(productStocks.productId, pakan))
    expect(Number(stok.qty)).toBe(8)

    const view = await listGroomingOrdersOfTransaction(trx.id, toko)
    expect(view.map((v) => v.ticketNumber)).toEqual([`${trx.trxNumber}/1`, `${trx.trxNumber}/2`])
    expect(view[0]).toMatchObject({ price: 50000, isPaid: true, debtRemaining: 0, serviceName: `Grooming Sehat ${run}` })
    expect(view[0].pet).toMatchObject({ name: `Mochi ${run}`, species: 'Persia' })
    expect(view[0].owner).toMatchObject({ id: rina, phone: nomor(7) })
    expect(view[0].groomer.name).toBe(`Dedi GO ${run}`)
  })

  it('data tidak sah membatalkan SELURUH nota: tanpa pelanggan, kucing orang lain, groomer nonaktif, kucing nonaktif, qty 2, barang diberi data kucing', async () => {
    const before = (await db.select().from(transactions).where(eq(transactions.branchId, toko))).length
    const lain = await createPet({ name: `Kucing Lain ${run}`, species: 'x', color: 'x', ageYears: 1, newOwner: { name: `Orang Lain ${run}`, phone: nomor(8) } }, actor)
    const off = await createGroomer({ name: `Off ${run}` }, actor)
    await updateGroomer(off.id, { isActive: false }, actor)
    const mati = await createPet({ name: `Mati ${run}`, species: 'x', color: 'x', ageYears: 1, customerId: rina }, actor)
    await updatePet(mati.id, { isActive: false }, actor)

    const kasus: [string, () => Promise<unknown>][] = [
      ['CUSTOMER_REQUIRED', () => sale([{ productId: jasa, unitPrice: 50000, grooming: g(mochi, dedi) }], { customerId: null })],
      ['PET_OWNER_MISMATCH', () => sale([{ productId: jasa, unitPrice: 50000, grooming: g(lain.id, dedi) }])],
      ['GROOMER_INACTIVE', () => sale([{ productId: jasa, unitPrice: 50000, grooming: g(mochi, off.id) }])],
      ['PET_INACTIVE', () => sale([{ productId: jasa, unitPrice: 50000, grooming: g(mati.id, dedi) }])],
      ['QTY_NOT_ONE', () => sale([{ productId: jasa, qty: 2, unitPrice: 50000, grooming: g(mochi, dedi) }])],
      ['NOT_GROOMING_SERVICE', () => sale([{ productId: pakan, unitPrice: 2000, grooming: g(mochi, dedi) }])],
      ['PET_NOT_FOUND', () => sale([{ productId: pakan, qty: 1, unitPrice: 2000 }, { productId: jasa, unitPrice: 50000, grooming: g(99999999, dedi) }])],
    ]
    for (const [code, attempt] of kasus) {
      const err = await attempt().catch((e: unknown) => e) as GroomingOrderError
      expect(err, code).toBeInstanceOf(GroomingOrderError)
      expect(err.code).toBe(code)
    }
    expect((await db.select().from(transactions).where(eq(transactions.branchId, toko))).length).toBe(before)
    const [stok] = await db.select().from(productStocks).where(eq(productStocks.productId, pakan))
    expect(Number(stok.qty)).toBe(8) // pakan pada nota yang gagal tidak ikut terpotong
  })

  it('jasa grooming tanpa data kucing ditolak (J3c: hanya dijual lewat tab Grooming) — seluruh nota batal, barang tidak terpotong', async () => {
    const before = (await db.select().from(transactions).where(eq(transactions.branchId, toko))).length
    const [stokAwal] = await db.select().from(productStocks).where(eq(productStocks.productId, pakan))
    const kasus: (() => Promise<unknown>)[] = [
      () => sale([{ productId: jasa, unitPrice: 50000 }], { customerId: null }),
      () => sale([{ productId: pakan, unitPrice: 2000 }, { productId: jasa, unitPrice: 50000 }]),
      // satu kucing berdata, satu baris jasa lagi tanpa data → tetap ditolak
      () => sale([{ productId: jasa, unitPrice: 50000, grooming: g(mochi, dedi) }, { productId: jasa, unitPrice: 50000 }]),
    ]
    for (const attempt of kasus) {
      const err = await attempt().catch((e: unknown) => e) as GroomingOrderError
      expect(err).toBeInstanceOf(GroomingOrderError)
      expect(err.code).toBe('GROOMING_DATA_REQUIRED')
    }
    expect((await db.select().from(transactions).where(eq(transactions.branchId, toko))).length).toBe(before)
    const [stok] = await db.select().from(productStocks).where(eq(productStocks.productId, pakan))
    expect(Number(stok.qty)).toBe(Number(stokAwal.qty))
  })
})

describe('Bayar saat ambil, serah terima, batal (DB lokal)', () => {
  it('bayar saat ambil = piutang: tampil BELUM LUNAS; boleh diambil; setelah dilunasi tampil lunas', async () => {
    const trx = await sale([{ productId: jasa, unitPrice: 100000, grooming: g(mochi, dedi) }], {}, true)
    const [debt] = await db.select().from(customerDebts).where(eq(customerDebts.transactionId, trx.id))
    expect(debt).toMatchObject({ remainingAmount: 100000, status: 'UNPAID', customerId: rina })

    const aktif = await listGroomingOrders({ branchId: toko, view: 'AKTIF', q: trx.trxNumber })
    expect(aktif).toHaveLength(1)
    expect(aktif[0]).toMatchObject({ isPaid: false, debtRemaining: 100000, status: 'DIKERJAKAN' })

    const diambil = await markGroomingPickedUp(aktif[0].id, actor)
    expect(diambil).toMatchObject({ status: 'DIAMBIL', isPaid: false })
    expect(diambil.pickedUpAt).not.toBeNull()
    await expect(markGroomingPickedUp(aktif[0].id, actor)).rejects.toMatchObject({ code: 'WRONG_STATUS', status: 409 })

    expect(await listGroomingOrders({ branchId: toko, view: 'AKTIF', q: trx.trxNumber })).toHaveLength(0)
    const selesai = await listGroomingOrders({ branchId: toko, view: 'SELESAI', q: trx.trxNumber })
    expect(selesai[0]).toMatchObject({ status: 'DIAMBIL', isPaid: false, debtRemaining: 100000 })

    // pelunasan lewat jalur piutang yang sudah ada → daftar ikut berubah
    await db.update(customerDebts).set({ paidAmount: 100000, remainingAmount: 0, status: 'PAID' }).where(eq(customerDebts.id, debt.id))
    expect((await listGroomingOrders({ branchId: toko, view: 'SELESAI', q: trx.trxNumber }))[0]).toMatchObject({ isPaid: true, debtRemaining: 0 })
  })

  it('Bayar & Ambil: pelunasan diarahkan ke nota grooming itu, bukan ke piutang lama pelanggan', async () => {
    // Pelanggan sudah punya piutang LAMA (nota lain) yang lebih tua.
    const lama = await sale([{ productId: pakan, qty: 1, unitPrice: 2000 }], {}, true)
    const grooming = await sale([{ productId: jasa, unitPrice: 75000, grooming: g(mochi, dedi) }], {}, true)
    const sisa = async (trxId: number) => (await db.select().from(customerDebts).where(eq(customerDebts.transactionId, trxId)))[0].remainingAmount

    const hasil = await payCustomerDebtsAtPos({
      customerId: rina, amount: 75000, paymentMethodId: cashId, note: 'tes grooming', branchId: toko, shiftId, userId,
      transactionId: grooming.id,
    })
    expect(hasil).toMatchObject({ totalPaid: 75000, settledCount: 1, touchedCount: 1 })
    expect(await sisa(grooming.id)).toBe(0) // nota grooming lunas
    expect(await sisa(lama.id)).toBe(2000) // piutang lama tidak tersentuh
    expect((await listGroomingOrdersOfTransaction(grooming.id, toko))[0]).toMatchObject({ isPaid: true })

    // nominal melebihi tagihan nota itu ditolak walau pelanggan masih punya piutang lain
    await expect(payCustomerDebtsAtPos({
      customerId: rina, amount: 1, paymentMethodId: cashId, note: null, branchId: toko, shiftId, userId, transactionId: grooming.id,
    })).rejects.toThrow('NO_ACTIVE_DEBT')

    // tanpa transactionId perilaku lama tetap: piutang tertua dulu
    await payCustomerDebtsAtPos({ customerId: rina, amount: 2000, paymentMethodId: cashId, note: null, branchId: toko, shiftId, userId })
    expect(await sisa(lama.id)).toBe(0)
  })

  it('cabang lain tidak bisa melihat atau menyerahkan; cari lewat nama kucing, pemilik, nomor HP', async () => {
    const trx = await sale([{ productId: jasa, unitPrice: 50000, grooming: g(oyen, asep) }])
    const [order] = await ordersOf(trx.id)

    expect(await listGroomingOrders({ branchId: tokoLain, view: 'AKTIF' })).toHaveLength(0)
    await expect(markGroomingPickedUp(order.id, { userId, branchId: tokoLain })).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })

    for (const q of [`oyen ${run}`, `rina go ${run}`, nomor(7).slice(2)]) {
      const hasil = await listGroomingOrders({ branchId: toko, view: 'AKTIF', q })
      expect(hasil.map((h) => h.id), q).toContain(order.id)
    }
    expect(await listGroomingOrders({ branchId: toko, view: 'AKTIF', q: 'tidak-ada-yang-begini' })).toHaveLength(0)
  })

  it('karcis: cetak pertama lalu cetak ulang terhitung', async () => {
    const trx = await sale([{ productId: jasa, unitPrice: 50000, grooming: g(mochi, dedi) }])
    const [order] = await ordersOf(trx.id)
    expect(await recordGroomingTicketPrint(order.id, actor)).toBe(1)
    expect(await recordGroomingTicketPrint(order.id, actor)).toBe(2)
  })

  it('nota dibatalkan → semua grooming di nota itu batal, keluar dari daftar aktif', async () => {
    const trx = await sale([
      { productId: jasa, unitPrice: 50000, grooming: g(mochi, dedi) },
      { productId: jasa, unitPrice: 50000, grooming: g(oyen, asep) },
    ])
    await performVoid({ txId: trx.id, branchId: toko, trxNumber: trx.trxNumber, actorUserId: userId })
    const orders = await ordersOf(trx.id)
    expect(orders.map((o) => [o.status, o.cancelSource, o.cancelReason])).toEqual([
      ['DIBATALKAN', 'VOID', 'Nota dibatalkan'],
      ['DIBATALKAN', 'VOID', 'Nota dibatalkan'],
    ])
    expect(await listGroomingOrders({ branchId: toko, view: 'AKTIF', q: trx.trxNumber })).toHaveLength(0)
    expect((await listGroomingOrders({ branchId: toko, view: 'SELESAI', q: trx.trxNumber })).map((v) => v.status)).toEqual(['DIBATALKAN', 'DIBATALKAN'])
    await expect(markGroomingPickedUp(orders[0].id, actor)).rejects.toMatchObject({ code: 'WRONG_STATUS' })
  })

  it('retur satu baris jasa → hanya grooming itu yang batal; retur dibatalkan → pulih ke keadaan semula', async () => {
    const trx = await sale([
      { productId: jasa, unitPrice: 50000, grooming: g(mochi, dedi) },
      { productId: jasa, unitPrice: 50000, grooming: g(oyen, asep) },
    ])
    const [o1, o2] = await ordersOf(trx.id)
    await markGroomingPickedUp(o1.id, actor) // Mochi sudah diambil sebelum komplain

    const retur = await ReturService.processRetur({
      transactionId: trx.id, actorBranchId: toko, isPrivileged: false, processedById: userId,
      reason: 'tes: hasil grooming dikomplain', items: [{ transactionItemId: o1.transactionItemId, qty: '1' }],
    })
    let orders = await ordersOf(trx.id)
    expect(orders[0]).toMatchObject({ status: 'DIBATALKAN', cancelSource: 'RETUR', cancelReason: `Jasa diretur (${retur.returnNumber})` })
    expect(orders[1]).toMatchObject({ id: o2.id, status: 'DIKERJAKAN', cancelSource: null })

    const [row] = await db.select().from(returns).where(eq(returns.returnNumber, retur.returnNumber))
    await ReturService.cancelReturn({ returnId: row.id, branchId: toko, cancelledById: userId, cancelReason: 'tes: retur salah input' })
    orders = await ordersOf(trx.id)
    expect(orders[0]).toMatchObject({ status: 'DIAMBIL', cancelSource: null, cancelReason: null, cancelledAt: null }) // pulih ke DIAMBIL, bukan DIKERJAKAN
    expect(orders[1].status).toBe('DIKERJAKAN')
  })

  it('grooming yang batal karena notanya dibatalkan tidak dihidupkan lagi oleh pembatalan retur', async () => {
    const trx = await sale([{ productId: jasa, unitPrice: 50000, grooming: g(mochi, dedi) }, { productId: pakan, qty: 1, unitPrice: 2000 }])
    const [o1] = await ordersOf(trx.id)
    const lines = await db.select().from(transactionItems).where(eq(transactionItems.transactionId, trx.id))
    const pakanLine = lines.find((l) => l.productId === pakan)!
    const retur = await ReturService.processRetur({
      transactionId: trx.id, actorBranchId: toko, isPrivileged: false, processedById: userId,
      reason: 'tes: pakan salah', items: [{ transactionItemId: pakanLine.id, qty: '1' }],
    })
    expect((await ordersOf(trx.id))[0].status).toBe('DIKERJAKAN') // retur barang tidak menyentuh grooming
    const [row] = await db.select().from(returns).where(eq(returns.returnNumber, retur.returnNumber))
    await ReturService.cancelReturn({ returnId: row.id, branchId: toko, cancelledById: userId, cancelReason: 'tes' })
    await performVoid({ txId: trx.id, branchId: toko, trxNumber: trx.trxNumber, actorUserId: userId })
    expect((await ordersOf(trx.id))[0]).toMatchObject({ id: o1.id, status: 'DIBATALKAN', cancelSource: 'VOID' })
  })
})
