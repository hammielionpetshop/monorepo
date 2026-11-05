import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, roles, users, shifts, paymentMethods, groomingOrders, groomingHolds, eq,
} from '../db'
import { TransactionService } from './transaction-service'
import { createGroomer, createPet } from './grooming-master-service'
import { listGroomingOrdersOfTransaction } from './grooming-order-service'
import {
  cancelGroomingHold, createGroomingHold, listGroomingHolds, recordHoldTicketPrint, HOLD_STATUS,
} from './grooming-hold-service'

// Grooming Ditahan (docs/work/specs/2026-11-05-grooming-tahan-design.md): kucing diterima & karcis
// dicetak dulu tanpa nota; nota menyusul dan menutup tahanannya di transaksi DB yang sama.
const run = randomUUID().slice(0, 8)
const nomor = (n: number) => `08${(parseInt(run, 16) % 100000000).toString().padStart(8, '0')}${n}${n}`
let toko: number
let userId: number
let ekor: number
let cashId: number
let shiftId: number
let jasa: number
let dedi: number
let asep: number
let rina: number
let budi: number
let mochi: number
let oyen: number
let belang: number
let actor: { userId: number; branchId: number }

type Grooming = { petId: number; groomerId: number; condition: string; holdId?: number }
const sale = (customerId: number, lines: Grooming[]) => {
  const total = lines.length * 50000
  return TransactionService.createTransaction({
    branchId: toko, cashierId: userId, shiftId, localTrxNumber: `GH-${randomUUID()}`, customerId,
    items: lines.map((grooming) => ({
      productId: jasa, uomId: ekor, qty: 1, unitPrice: 50000, discountAmount: 0, subtotal: 50000, priceTier: 'RETAIL', grooming,
    })),
    payments: [{ paymentMethodId: cashId, amount: total }],
    totals: { subtotal: total, discountTotal: 0, grandTotal: total }, amountPaid: total, change: 0,
  } as never) as Promise<{ id: number; trxNumber: string }>
}
const holdOf = async (id: number) => (await db.select().from(groomingHolds).where(eq(groomingHolds.id, id)))[0]

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `GH${run}`, name: `Toko Tahan ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `GH${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `GH${run}`, roleId, branchId: toko }).returning())[0].id
  actor = { userId, branchId: toko }
  ekor = (await db.insert(unitsOfMeasure).values({ code: `EH${run}`, name: 'Ekor tes', isBase: true }).returning())[0].id
  cashId = (await db.insert(paymentMethods).values({ name: `Tunai GH ${run}`, type: 'CASH' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  jasa = (await db.insert(products).values({ name: `Grooming Tahan ${run}`, baseUomId: ekor, productKind: 'JASA_GROOMING' }).returning())[0].id
  dedi = (await createGroomer({ name: `Dedi GH ${run}` }, actor)).id
  asep = (await createGroomer({ name: `Asep GH ${run}` }, actor)).id
  const m = await createPet({ name: `Mochi GH ${run}`, species: 'Persia', color: 'putih', ageYears: 2, newOwner: { name: `Ibu Rina GH ${run}`, phone: nomor(3) } }, actor)
  mochi = m.id
  rina = m.customerId
  oyen = (await createPet({ name: `Oyen GH ${run}`, species: 'Domestik', color: 'oranye', ageMonths: 8, customerId: rina }, actor)).id
  const b = await createPet({ name: `Belang GH ${run}`, species: 'Domestik', color: 'belang', ageYears: 1, newOwner: { name: `Pak Budi GH ${run}`, phone: nomor(4) } }, actor)
  belang = b.id
  budi = b.customerId
})

describe('Grooming Ditahan (DB lokal)', () => {
  it('tahan dua ekor: tersimpan DITAHAN tanpa nota, nomor karcis TAHAN-<id>/1 dan /2, tampil & bisa dicari di daftar aktif', async () => {
    const hold = await createGroomingHold({
      customerId: rina,
      lines: [
        { petId: mochi, productId: jasa, groomerId: dedi, condition: ' telinga kotor ' },
        { petId: oyen, productId: jasa, groomerId: asep, condition: 'sehat' },
      ],
      delivery: null,
    }, actor)
    expect(hold.status).toBe(HOLD_STATUS.DITAHAN)
    expect(hold.lines.map((l) => l.ticketNumber)).toEqual([`TAHAN-${hold.id}/1`, `TAHAN-${hold.id}/2`])
    expect(hold.lines[0].condition).toBe('telinga kotor')
    expect((await holdOf(hold.id)).transactionId).toBeNull()

    const aktif = await listGroomingHolds({ branchId: toko, view: 'AKTIF' })
    expect(aktif.map((h) => h.id)).toContain(hold.id)
    const found = await listGroomingHolds({ branchId: toko, view: 'AKTIF', q: `TAHAN-${hold.id}` })
    expect(found.map((h) => h.id)).toEqual([hold.id])
  })

  it('isi tahanan diperiksa seperti nota grooming: kucing milik orang lain dan kucing ganda ditolak', async () => {
    await expect(createGroomingHold({
      customerId: rina, lines: [{ petId: belang, productId: jasa, groomerId: dedi, condition: 'sehat' }], delivery: null,
    }, actor)).rejects.toMatchObject({ code: 'PET_OWNER_MISMATCH' })
    await expect(createGroomingHold({
      customerId: rina,
      lines: [
        { petId: mochi, productId: jasa, groomerId: dedi, condition: 'sehat' },
        { petId: mochi, productId: jasa, groomerId: asep, condition: 'sehat' },
      ],
      delivery: null,
    }, actor)).rejects.toMatchObject({ code: 'HOLD_MISMATCH' })
  })

  it('Buat Nota: nota menutup tahanan (DIBUATKAN_NOTA), grooming_orders memakai waktu & penerima saat ditahan, karcis tetap TAHAN', async () => {
    const hold = await createGroomingHold({
      customerId: budi, lines: [{ petId: belang, productId: jasa, groomerId: dedi, condition: 'kutu' }], delivery: null,
    }, actor)
    const heldAt = (await holdOf(hold.id)).heldAt
    const trx = await sale(budi, [{ petId: belang, groomerId: dedi, condition: 'kutu', holdId: hold.id }])

    const after = await holdOf(hold.id)
    expect(after.status).toBe(HOLD_STATUS.DIBUATKAN_NOTA)
    expect(after.transactionId).toBe(trx.id)
    const [order] = await db.select().from(groomingOrders).where(eq(groomingOrders.transactionId, trx.id))
    expect(order.receivedAt.getTime()).toBe(heldAt.getTime())
    expect(order.receivedById).toBe(userId)
    const views = await listGroomingOrdersOfTransaction(trx.id, toko)
    expect(views.map((v) => v.ticketNumber)).toEqual([`TAHAN-${hold.id}/1`])
    expect((await listGroomingHolds({ branchId: toko, view: 'AKTIF' })).map((h) => h.id)).not.toContain(hold.id)

    // Tekan Buat Nota dua kali → yang kedua ditolak, tidak ada nota ganda.
    await expect(sale(budi, [{ petId: belang, groomerId: dedi, condition: 'kutu', holdId: hold.id }]))
      .rejects.toMatchObject({ code: 'HOLD_CLOSED' })
  })

  it('isi nota berbeda dengan karcis (groomer lain) ditolak dan tahanan tetap DITAHAN', async () => {
    const hold = await createGroomingHold({
      customerId: rina, lines: [{ petId: oyen, productId: jasa, groomerId: asep, condition: 'sehat' }], delivery: null,
    }, actor)
    await expect(sale(rina, [{ petId: oyen, groomerId: dedi, condition: 'sehat', holdId: hold.id }]))
      .rejects.toMatchObject({ code: 'HOLD_MISMATCH' })
    expect((await holdOf(hold.id)).status).toBe(HOLD_STATUS.DITAHAN)
    // Pelanggan nota bukan pemilik kucing di tahanan → ditolak juga.
    await expect(sale(budi, [{ petId: oyen, groomerId: asep, condition: 'sehat', holdId: hold.id }]))
      .rejects.toMatchObject({ code: 'HOLD_MISMATCH' })
  })

  it('karcis tahanan: cetakan pertama bukan ulang, kedua cetak ulang', async () => {
    const hold = await createGroomingHold({
      customerId: rina, lines: [{ petId: mochi, productId: jasa, groomerId: dedi, condition: 'sehat' }], delivery: null,
    }, actor)
    expect(await recordHoldTicketPrint(hold.id, actor)).toBe(1)
    expect(await recordHoldTicketPrint(hold.id, actor)).toBe(2)
  })

  it('batalkan: alasan wajib, status DIBATALKAN tampil di riwayat, lalu tidak bisa dibuatkan nota', async () => {
    const hold = await createGroomingHold({
      customerId: rina, lines: [{ petId: mochi, productId: jasa, groomerId: dedi, condition: 'sehat' }], delivery: null,
    }, actor)
    await expect(cancelGroomingHold(hold.id, '  ', actor)).rejects.toMatchObject({ code: 'REASON_REQUIRED' })
    const cancelled = await cancelGroomingHold(hold.id, 'konsumen batal', actor)
    expect(cancelled.status).toBe(HOLD_STATUS.DIBATALKAN)
    expect(cancelled.cancelReason).toBe('konsumen batal')
    expect((await listGroomingHolds({ branchId: toko, view: 'SELESAI' })).map((h) => h.id)).toContain(hold.id)
    await expect(sale(rina, [{ petId: mochi, groomerId: dedi, condition: 'sehat', holdId: hold.id }]))
      .rejects.toMatchObject({ code: 'HOLD_CLOSED' })
    await expect(cancelGroomingHold(hold.id, 'lagi', actor)).rejects.toMatchObject({ code: 'WRONG_STATUS' })
  })

  it('tahanan cabang lain tidak bisa disentuh', async () => {
    const hold = await createGroomingHold({
      customerId: rina, lines: [{ petId: mochi, productId: jasa, groomerId: dedi, condition: 'sehat' }], delivery: null,
    }, actor)
    await expect(cancelGroomingHold(hold.id, 'salah', { userId, branchId: toko + 100000 })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
