import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, productStocks, stockShortfalls, roles, users, shifts, paymentMethods, customers,
  transactions, transactionItems, serviceDeliveries, auditLogs, returns, eq, and,
} from '../db'
import { TransactionService } from './transaction-service'
import { performVoid } from './void-service'
import { ReturService } from './retur-service'
import { GroomingMasterError, createGroomer, createPet, listGroomers, updateGroomer } from './grooming-master-service'
import { GroomingOrderError, listGroomingOrdersOfTransaction, markGroomingPickedUp } from './grooming-order-service'

// Jasa grooming J3a2: delivery antar-jemput. Ongkir = jasa (Rp 1.000 × qty), satu per nota,
// alamat & pengantar wajib; pengantar dipilih dari daftar yang sama dengan groomer.
const run = randomUUID().slice(0, 8)
const nomor = (n: number) => `08${(parseInt(run, 16) % 100000000).toString().padStart(8, '0')}${n}${n}`
let toko: number
let userId: number
let ekor: number
let cashId: number
let shiftId: number
let jasa: number
let ongkir: number
let dedi: number // groomer saja
let ujang: number // pengantar saja
let rina: number
let mochi: number
let oyen: number
let actor: { userId: number; branchId: number }

type Line = {
  productId: number; qty?: number; unitPrice: number
  grooming?: { petId: number; groomerId: number; condition: string }
  delivery?: { courierId: number; address?: string }
}
const sale = (lines: Line[], extra: Record<string, unknown> = {}) => {
  const total = lines.reduce((s, l) => s + (l.qty ?? 1) * l.unitPrice, 0)
  return TransactionService.createTransaction({
    branchId: toko, cashierId: userId, shiftId, localTrxNumber: `GD-${randomUUID()}`, customerId: rina,
    items: lines.map((l) => ({
      productId: l.productId, uomId: ekor, qty: l.qty ?? 1, unitPrice: l.unitPrice, discountAmount: 0,
      subtotal: (l.qty ?? 1) * l.unitPrice, priceTier: 'RETAIL',
      ...(l.grooming ? { grooming: l.grooming } : {}), ...(l.delivery ? { delivery: l.delivery } : {}),
    })),
    payments: [{ paymentMethodId: cashId, amount: total }],
    totals: { subtotal: total, discountTotal: 0, grandTotal: total }, amountPaid: total, change: 0,
    ...extra,
  } as never) as Promise<{ id: number; trxNumber: string }>
}
const groom = (petId: number) => ({ productId: jasa, unitPrice: 50000, grooming: { petId, groomerId: dedi, condition: 'sehat' } })
const antar = (qty: number, courierId: number, address: string) => ({ productId: ongkir, qty, unitPrice: 1000, delivery: { courierId, address } })
const deliveryOf = async (trxId: number) => (await db.select().from(serviceDeliveries).where(eq(serviceDeliveries.transactionId, trxId)))[0]

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `GD${run}`, name: `Toko Delivery ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `GD${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `GD${run}`, roleId, branchId: toko }).returning())[0].id
  actor = { userId, branchId: toko }
  ekor = (await db.insert(unitsOfMeasure).values({ code: `ED${run}`, name: 'Satuan tes', isBase: true }).returning())[0].id
  cashId = (await db.insert(paymentMethods).values({ name: `Tunai GD ${run}`, type: 'CASH' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  jasa = (await db.insert(products).values({ name: `Grooming GD ${run}`, baseUomId: ekor, productKind: 'JASA_GROOMING' }).returning())[0].id
  ongkir = (await db.insert(products).values({ name: `Ongkir GD ${run}`, baseUomId: ekor, productKind: 'JASA_ONGKIR' }).returning())[0].id
  dedi = (await createGroomer({ name: `Dedi GD ${run}` }, actor)).id
  ujang = (await createGroomer({ name: `Ujang GD ${run}`, isGroomer: false, isCourier: true }, actor)).id
  const m = await createPet({ name: `Mochi GD ${run}`, species: 'Persia', color: 'putih', ageYears: 2, newOwner: { name: `Ibu Rina GD ${run}`, phone: nomor(5) } }, actor)
  mochi = m.id
  rina = m.customerId
  oyen = (await createPet({ name: `Oyen GD ${run}`, species: 'Domestik', color: 'oranye', ageMonths: 8, customerId: rina }, actor)).id
})

describe('Groomer & pengantar satu daftar (DB lokal)', () => {
  it('bawaan = groomer; bisa pengantar saja atau keduanya; tanpa tugas ditolak; daftar bisa disaring per tugas', async () => {
    const dua = await createGroomer({ name: `Dua Tugas ${run}`, isGroomer: true, isCourier: true }, actor)
    await expect(createGroomer({ name: `Tanpa Tugas ${run}`, isGroomer: false, isCourier: false }, actor)).rejects.toMatchObject({ code: 'ROLE_REQUIRED' })
    await expect(updateGroomer(dedi, { isGroomer: false }, actor)).rejects.toBeInstanceOf(GroomingMasterError)

    const groomerIds = (await listGroomers({ activeOnly: true, role: 'groomer' })).map((g) => g.id)
    const courierIds = (await listGroomers({ activeOnly: true, role: 'courier' })).map((g) => g.id)
    expect(groomerIds).toContain(dedi)
    expect(groomerIds).toContain(dua.id)
    expect(groomerIds).not.toContain(ujang)
    expect(courierIds).toContain(ujang)
    expect(courierIds).toContain(dua.id)
    expect(courierIds).not.toContain(dedi)
  })
})

describe('Delivery pada nota grooming (DB lokal)', () => {
  it('dua ekor + ongkir 15 × 1.000: satu delivery per nota, ongkir tanpa stok, alamat tersalin ke data pelanggan', async () => {
    const trx = await sale([groom(mochi), groom(oyen), antar(15, ujang, '  Jl. Cikupang  ')])

    const d = await deliveryOf(trx.id)
    expect(d).toMatchObject({ status: 'DIPROSES', courierId: ujang, address: 'Jl. Cikupang', customerId: rina, branchId: toko })

    const lines = await db.select().from(transactionItems).where(eq(transactionItems.transactionId, trx.id))
    const ongkirLine = lines.find((l) => l.productId === ongkir)!
    expect(ongkirLine).toMatchObject({ qty: 15, unitPrice: 1000, totalPrice: 15000, isService: true, cogs: 0 })
    expect(await db.select().from(productStocks).where(eq(productStocks.productId, ongkir))).toHaveLength(0)
    expect(await db.select().from(stockShortfalls).where(eq(stockShortfalls.productId, ongkir))).toHaveLength(0)

    const [owner] = await db.select().from(customers).where(eq(customers.id, rina))
    expect(owner.address).toBe('Jl. Cikupang')

    const view = await listGroomingOrdersOfTransaction(trx.id, toko)
    expect(view).toHaveLength(2)
    for (const v of view) {
      expect(v.delivery).toMatchObject({ status: 'DIPROSES', address: 'Jl. Cikupang', fee: 15000, courier: { id: ujang, name: `Ujang GD ${run}` } })
    }
  })

  it('kunjungan berikutnya: alamat dilengkapi → data pelanggan ikut diperbarui dan berjejak', async () => {
    const trx = await sale([groom(mochi), antar(15, ujang, 'Jl. Cikupang no. 12, depan masjid')])
    const [owner] = await db.select().from(customers).where(eq(customers.id, rina))
    expect(owner.address).toBe('Jl. Cikupang no. 12, depan masjid')
    const jejak = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.action, 'CUSTOMER_ADDRESS_UPDATE'), eq(auditLogs.recordId, String(rina))))
      .orderBy(auditLogs.id)
    expect(jejak.length).toBeGreaterThanOrEqual(2)
    expect(JSON.parse(jejak[jejak.length - 1].newData ?? '{}')).toMatchObject({ transactionId: trx.id })
  })

  it('delivery selesai saat kucing terakhir di nota diserahkan', async () => {
    const trx = await sale([groom(mochi), groom(oyen), antar(10, ujang, 'Jl. Cikupang no. 12, depan masjid')])
    const [a, b] = await listGroomingOrdersOfTransaction(trx.id, toko)
    await markGroomingPickedUp(a.id, actor)
    expect((await deliveryOf(trx.id)).status).toBe('DIPROSES')
    const last = await markGroomingPickedUp(b.id, actor)
    const d = await deliveryOf(trx.id)
    expect(d.status).toBe('SELESAI')
    expect(d.completedAt).not.toBeNull()
    expect(last.delivery).toMatchObject({ status: 'SELESAI' })
  })

  it('yang tidak sah membatalkan seluruh nota: pengantar bukan pengantar / nonaktif, alamat kosong di nota grooming, dua baris ongkir, data pengantaran di baris grooming, ongkir tanpa pengantar', async () => {
    const before = (await db.select().from(transactions).where(eq(transactions.branchId, toko))).length
    const off = await createGroomer({ name: `Kurir Off ${run}`, isGroomer: false, isCourier: true }, actor)
    await updateGroomer(off.id, { isActive: false }, actor)

    const kasus: [string, () => Promise<unknown>][] = [
      ['COURIER_ROLE', () => sale([groom(mochi), antar(15, dedi, 'Jl. A')])],
      ['COURIER_INACTIVE', () => sale([groom(mochi), antar(15, off.id, 'Jl. A')])],
      ['COURIER_NOT_FOUND', () => sale([groom(mochi), antar(15, 99999999, 'Jl. A')])],
      ['ADDRESS_REQUIRED', () => sale([groom(mochi), antar(15, ujang, '   ')])],
      ['DELIVERY_DUPLICATE', () => sale([groom(mochi), antar(15, ujang, 'Jl. A'), antar(5, ujang, 'Jl. A')])],
      ['ADDRESS_REQUIRED', () => sale([groom(mochi), { productId: ongkir, qty: 15, unitPrice: 1000, delivery: { courierId: ujang } }])],
      ['DELIVERY_DUPLICATE', () => sale([antar(15, ujang, ''), antar(5, ujang, '')], { customerId: null })],
      ['NOT_DELIVERY_SERVICE', () => sale([{ ...groom(mochi), delivery: { courierId: ujang, address: 'Jl. A' } }])],
      ['COURIER_REQUIRED', () => sale([{ productId: ongkir, qty: 25, unitPrice: 1000 }], { customerId: null })],
      ['COURIER_ROLE', () => sale([antar(25, dedi, '')], { customerId: null })],
      ['GROOMER_ROLE', () => sale([{ productId: jasa, unitPrice: 50000, grooming: { petId: mochi, groomerId: ujang, condition: 'sehat' } }])],
    ]
    for (const [code, attempt] of kasus) {
      const err = (await attempt().catch((e: unknown) => e)) as GroomingOrderError
      expect(err, code).toBeInstanceOf(GroomingOrderError)
      expect(err.code).toBe(code)
    }
    expect((await db.select().from(transactions).where(eq(transactions.branchId, toko))).length).toBe(before)
  })

  it('antar barang dari tab Kasir: cukup pengantar — tanpa pelanggan & alamat, langsung selesai, alamat pelanggan tidak disentuh', async () => {
    const trx = await sale([{ productId: ongkir, qty: 25, unitPrice: 1000, delivery: { courierId: ujang } }], { customerId: null })
    expect(await deliveryOf(trx.id)).toMatchObject({ courierId: ujang, customerId: null, address: null, status: 'SELESAI' })
    expect((await deliveryOf(trx.id)).completedAt).not.toBeNull()

    // dengan pelanggan: alamat apa pun yang terkirim diabaikan, data pelanggan tidak berubah
    const [before] = await db.select({ address: customers.address }).from(customers).where(eq(customers.id, rina))
    const trx2 = await sale([{ productId: ongkir, qty: 10, unitPrice: 1000, delivery: { courierId: ujang, address: 'Jl. Lain 9' } }])
    expect(await deliveryOf(trx2.id)).toMatchObject({ customerId: rina, address: null, status: 'SELESAI' })
    const [after] = await db.select({ address: customers.address }).from(customers).where(eq(customers.id, rina))
    expect(after.address).toBe(before.address)
  })

  it('antar barang: void → batal; retur ongkir → batal; batal retur → kembali SELESAI', async () => {
    const batal = await sale([{ productId: ongkir, qty: 20, unitPrice: 1000, delivery: { courierId: ujang } }], { customerId: null })
    await performVoid({ txId: batal.id, branchId: toko, trxNumber: batal.trxNumber, actorUserId: userId })
    expect(await deliveryOf(batal.id)).toMatchObject({ status: 'DIBATALKAN', cancelSource: 'VOID' })

    const trx = await sale([{ productId: ongkir, qty: 20, unitPrice: 1000, delivery: { courierId: ujang } }], { customerId: null })
    const [line] = await db.select().from(transactionItems).where(eq(transactionItems.transactionId, trx.id))
    const retur = await ReturService.processRetur({
      transactionId: trx.id, actorBranchId: toko, isPrivileged: false, processedById: userId,
      reason: 'tes: batal diantar', items: [{ transactionItemId: line.id, qty: '20' }],
    })
    expect(await deliveryOf(trx.id)).toMatchObject({ status: 'DIBATALKAN', cancelSource: 'RETUR' })
    const [row] = await db.select().from(returns).where(eq(returns.returnNumber, retur.returnNumber))
    await ReturService.cancelReturn({ returnId: row.id, branchId: toko, cancelledById: userId, cancelReason: 'tes: retur salah input' })
    expect(await deliveryOf(trx.id)).toMatchObject({ status: 'SELESAI', cancelSource: null })
  })

  it('nota dibatalkan → delivery batal; retur baris ongkir → delivery batal, grooming tetap; batal retur → pulih', async () => {
    const batal = await sale([groom(mochi), antar(15, ujang, 'Jl. Cikupang no. 12, depan masjid')])
    await performVoid({ txId: batal.id, branchId: toko, trxNumber: batal.trxNumber, actorUserId: userId })
    expect(await deliveryOf(batal.id)).toMatchObject({ status: 'DIBATALKAN', cancelSource: 'VOID' })
    expect((await listGroomingOrdersOfTransaction(batal.id, toko))[0].delivery).toBeNull()

    const trx = await sale([groom(mochi), antar(15, ujang, 'Jl. Cikupang no. 12, depan masjid')])
    const lines = await db.select().from(transactionItems).where(eq(transactionItems.transactionId, trx.id))
    const ongkirLine = lines.find((l) => l.productId === ongkir)!
    const retur = await ReturService.processRetur({
      transactionId: trx.id, actorBranchId: toko, isPrivileged: false, processedById: userId,
      reason: 'tes: tidak jadi diantar', items: [{ transactionItemId: ongkirLine.id, qty: '15' }],
    })
    expect(retur.totalRefundAmount).toBe(15000)
    expect(await deliveryOf(trx.id)).toMatchObject({ status: 'DIBATALKAN', cancelSource: 'RETUR', cancelReason: `Ongkir diretur (${retur.returnNumber})` })
    const [order] = await listGroomingOrdersOfTransaction(trx.id, toko)
    expect(order).toMatchObject({ status: 'DIKERJAKAN', delivery: null }) // grooming-nya sendiri tidak ikut batal

    const [row] = await db.select().from(returns).where(eq(returns.returnNumber, retur.returnNumber))
    await ReturService.cancelReturn({ returnId: row.id, branchId: toko, cancelledById: userId, cancelReason: 'tes: retur salah' })
    expect(await deliveryOf(trx.id)).toMatchObject({ status: 'DIPROSES', cancelSource: null, cancelledAt: null })
  })
})
