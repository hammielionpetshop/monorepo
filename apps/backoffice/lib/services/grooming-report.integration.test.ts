import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, roles, users, shifts, paymentMethods,
  groomingOrders, groomingGroomerChanges, auditLogs, transactionItems, eq, and,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { performVoid } from './void-service'
import { ReturService } from './retur-service'
import { createGroomer, createPet, updateGroomer } from './grooming-master-service'
import { changeGroomer, listDeliveryHistory, listGroomingHistory, summarizeGrooming } from './grooming-report-service'

// Jasa grooming J4: Riwayat Grooming, bonus groomer 10% & pengantar 50% (sesudah diskon nota
// dibagi sebanding), dan Ganti Groomer yang berjejak.
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
let ongkir: number
let pakan: number
let dedi: number
let asep: number
let ujang: number
let rina: number
let mochi: number
let oyen: number
let actor: { userId: number; branchId: number }

type Line = {
  productId: number; qty?: number; unitPrice: number
  grooming?: { petId: number; groomerId: number; condition: string }
  delivery?: { courierId: number; address?: string }
}
/** `discount` = diskon NOTA (baris tidak dikurangi), seperti tombol "+ Diskon" di layar bayar. */
const sale = (lines: Line[], opts: { discount?: number; debt?: boolean } = {}) => {
  const subtotal = lines.reduce((s, l) => s + (l.qty ?? 1) * l.unitPrice, 0)
  const total = subtotal - (opts.discount ?? 0)
  return TransactionService.createTransaction({
    branchId: toko, cashierId: userId, shiftId, localTrxNumber: `GR-${randomUUID()}`, customerId: rina,
    items: lines.map((l) => ({
      productId: l.productId, uomId: ekor, qty: l.qty ?? 1, unitPrice: l.unitPrice, discountAmount: 0,
      subtotal: (l.qty ?? 1) * l.unitPrice, priceTier: 'RETAIL',
      ...(l.grooming ? { grooming: l.grooming } : {}), ...(l.delivery ? { delivery: l.delivery } : {}),
    })),
    payments: [{ paymentMethodId: opts.debt ? debtId : cashId, amount: total }],
    totals: { subtotal, discountTotal: opts.discount ?? 0, grandTotal: total }, amountPaid: opts.debt ? 0 : total, change: 0,
  } as never) as Promise<{ id: number; trxNumber: string }>
}
const groom = (petId: number, groomerId: number, unitPrice = 100000) => ({ productId: jasa, unitPrice, grooming: { petId, groomerId, condition: 'sehat' } })
const antar = (qty: number) => ({ productId: ongkir, qty, unitPrice: 1000, delivery: { courierId: ujang, address: 'Jl. Mawar 1' } })

const range = () => ({ from: new Date(Date.now() - 3600_000), to: new Date(Date.now() + 3600_000) })
const history = (extra: Record<string, unknown> = {}) => listGroomingHistory({ branchId: toko, ...range(), ...extra })
const deliveries = () => listDeliveryHistory({ branchId: toko, ...range() })
const ofTrx = async (trxId: number) => (await history()).filter((r) => r.transactionId === trxId).sort((a, b) => a.id - b.id)
const admin = () => ({ userId, branchId: toko, allBranches: false })

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `GR${run}`, name: `Toko Laporan ${run}` }).returning())[0].id
  tokoLain = (await db.insert(branches).values({ code: `GX${run}`, name: `Toko Lain ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `GR${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `GR${run}`, roleId, branchId: toko }).returning())[0].id
  actor = { userId, branchId: toko }
  ekor = (await db.insert(unitsOfMeasure).values({ code: `ER${run}`, name: 'Satuan tes', isBase: true }).returning())[0].id
  cashId = (await db.insert(paymentMethods).values({ name: `Tunai GR ${run}`, type: 'CASH' }).returning())[0].id
  debtId = (await db.insert(paymentMethods).values({ name: `Piutang GR ${run}`, type: 'DEBT' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  jasa = (await db.insert(products).values({ name: `Grooming GR ${run}`, baseUomId: ekor, productKind: 'JASA_GROOMING' }).returning())[0].id
  ongkir = (await db.insert(products).values({ name: `Ongkir GR ${run}`, baseUomId: ekor, productKind: 'JASA_ONGKIR' }).returning())[0].id
  pakan = (await db.insert(products).values({ name: `Pakan GR ${run}`, baseUomId: ekor, defaultCostPrice: 1000 }).returning())[0].id
  await db.transaction((tx) => StockService.addStock(tx, toko, pakan, ekor, '50', '1000'))
  dedi = (await createGroomer({ name: `Dedi GR ${run}` }, actor)).id
  asep = (await createGroomer({ name: `Asep GR ${run}` }, actor)).id
  ujang = (await createGroomer({ name: `Ujang GR ${run}`, isGroomer: false, isCourier: true }, actor)).id
  const m = await createPet({ name: `Mochi GR ${run}`, species: 'Persia', color: 'putih', ageYears: 2, newOwner: { name: `Ibu Rina GR ${run}`, phone: nomor(4) } }, actor)
  mochi = m.id
  rina = m.customerId
  oyen = (await createPet({ name: `Oyen GR ${run}`, species: 'Domestik', color: 'oranye', ageMonths: 8, customerId: rina }, actor)).id
})

describe('Riwayat Grooming & bonus (DB lokal)', () => {
  it('tanpa diskon: bonus groomer 10% dari harga jasa, bonus pengantar 50% dari ongkir', async () => {
    const trx = await sale([groom(mochi, dedi), groom(oyen, asep, 60000), antar(15)])
    const rows = await ofTrx(trx.id)
    expect(rows.map((r) => [r.groomerId, r.price, r.netPrice, r.bonus, r.isPaid, r.status])).toEqual([
      [dedi, 100000, 100000, 10000, true, 'DIKERJAKAN'],
      [asep, 60000, 60000, 6000, true, 'DIKERJAKAN'],
    ])
    expect(rows[0].ticketNumber).toBe(`${trx.trxNumber}/1`)
    const d = (await deliveries()).find((x) => x.transactionId === trx.id)
    expect(d).toMatchObject({ courierId: ujang, fee: 15000, netFee: 15000, bonus: 7500, status: 'DIPROSES' })
  })

  it('contoh owner: jasa 100 ribu didiskon jadi 80 ribu → bonus 8 ribu', async () => {
    const trx = await sale([groom(mochi, dedi)], { discount: 20000 })
    expect((await ofTrx(trx.id))[0]).toMatchObject({ price: 100000, netPrice: 80000, bonus: 8000 })
  })

  it('nota campuran (Tambah belanja) berdiskon: diskon nota dibagi sebanding ke jasa, ongkir, dan barang', async () => {
    // jasa 60.000 + ongkir 20.000 + pakan 120.000 = 200.000; diskon nota 20.000 → dibayar 180.000 (90%)
    const trx = await sale([groom(mochi, dedi, 60000), antar(20), { productId: pakan, qty: 3, unitPrice: 40000 }], { discount: 20000 })
    expect((await ofTrx(trx.id))[0]).toMatchObject({ price: 60000, netPrice: 54000, bonus: 5400 })
    const d = (await deliveries()).find((x) => x.transactionId === trx.id)
    expect(d).toMatchObject({ fee: 20000, netFee: 18000, bonus: 9000 })
  })

  it('bayar saat ambil (piutang): bonus tetap dihitung, tetapi bertanda belum lunas dan bisa disaring', async () => {
    const trx = await sale([groom(oyen, asep)], { debt: true })
    const [row] = await ofTrx(trx.id)
    expect(row).toMatchObject({ bonus: 10000, isPaid: false, debtRemaining: 100000 })
    expect((await history({ payment: 'BELUM' })).some((r) => r.id === row.id)).toBe(true)
    expect((await history({ payment: 'LUNAS' })).some((r) => r.id === row.id)).toBe(false)
  })

  it('nota dibatalkan atau baris jasa diretur → tetap tampil di riwayat sebagai Dibatalkan, bonus 0 dan tidak masuk ringkasan', async () => {
    const batal = await sale([groom(mochi, dedi), antar(10)])
    await performVoid({ txId: batal.id, branchId: toko, trxNumber: batal.trxNumber, actorUserId: userId })
    const retur = await sale([groom(mochi, dedi), groom(oyen, asep)])
    const [o1] = await db.select().from(groomingOrders).where(and(eq(groomingOrders.transactionId, retur.id), eq(groomingOrders.sequence, 1)))
    await ReturService.processRetur({
      transactionId: retur.id, actorBranchId: toko, isPrivileged: false, processedById: userId,
      reason: 'tes: hasil grooming dikomplain', items: [{ transactionItemId: o1.transactionItemId, qty: '1' }],
    })

    expect((await ofTrx(batal.id)).map((r) => [r.status, r.bonus])).toEqual([['DIBATALKAN', 0]])
    expect((await ofTrx(retur.id)).map((r) => [r.status, r.bonus])).toEqual([['DIBATALKAN', 0], ['DIKERJAKAN', 10000]])
    const dBatal = (await deliveries()).find((x) => x.transactionId === batal.id)
    expect(dBatal).toMatchObject({ status: 'DIBATALKAN', bonus: 0 })

    const rows = (await history()).filter((r) => r.transactionId === batal.id || r.transactionId === retur.id)
    const sum = summarizeGrooming(rows, dBatal ? [dBatal] : [])
    expect(sum.grooming).toMatchObject({ count: 1, cancelledCount: 2, bonus: 10000, netTotal: 100000 })
    expect(sum.byGroomer.map((g) => [g.key, g.count, g.bonus])).toEqual([[String(asep), 1, 10000]])
    expect(sum.delivery).toMatchObject({ count: 0, cancelledCount: 1, bonus: 0 })
    expect(sum.byCourier).toEqual([])
  })

  it('ringkasan: per groomer, per jasa, per cabang, dan bagian yang belum lunas', async () => {
    const a = await sale([groom(mochi, dedi, 50000), groom(oyen, dedi, 70000)])
    const b = await sale([groom(mochi, asep, 30000)], { debt: true })
    const rows = (await history()).filter((r) => r.transactionId === a.id || r.transactionId === b.id)
    const sum = summarizeGrooming(rows, [])
    expect(sum.grooming).toMatchObject({ count: 3, netTotal: 150000, bonus: 15000, unpaidCount: 1 })
    expect(sum.byGroomer.map((g) => [g.key, g.count, g.netTotal, g.bonus, g.unpaidCount, g.unpaidBonus])).toEqual([
      [String(dedi), 2, 120000, 12000, 0, 0],
      [String(asep), 1, 30000, 3000, 1, 3000],
    ])
    expect(sum.byService).toHaveLength(1)
    expect(sum.byService[0]).toMatchObject({ label: `Grooming GR ${run}`, count: 3, bonus: 15000 })
    expect(sum.byBranch.map((g) => [g.key, g.count])).toEqual([[String(toko), 3]])
  })

  it('antar barang dari tab Kasir ikut laporan bonus pengantar (50% ongkir sesudah diskon), bertanda Antar barang', async () => {
    // pakan 80.000 + ongkir 20.000 = 100.000; diskon nota 10.000 → ongkir bersih 18.000 → bonus 9.000
    const trx = await sale([{ productId: pakan, qty: 2, unitPrice: 40000 }, { productId: ongkir, qty: 20, unitPrice: 1000, delivery: { courierId: ujang } }], { discount: 10000 })
    const d = (await deliveries()).find((x) => x.transactionId === trx.id)
    expect(d).toMatchObject({ kind: 'BARANG', courierId: ujang, fee: 20000, netFee: 18000, bonus: 9000, status: 'SELESAI', address: null })
    const g = (await deliveries()).find((x) => x.address != null)
    expect(g?.kind).toBe('GROOMING')
    const sum = summarizeGrooming([], d ? [d] : [])
    expect(sum.byCourier.map((c) => [c.key, c.count, c.bonus])).toEqual([[String(ujang), 1, 9000]])
  })

  it('saringan groomer & cari; cabang lain tidak melihat apa pun', async () => {
    const trx = await sale([groom(mochi, dedi), groom(oyen, asep)])
    expect((await history({ groomerId: asep })).filter((r) => r.transactionId === trx.id).map((r) => r.groomerId)).toEqual([asep])
    expect((await history({ q: `Oyen GR ${run}` })).every((r) => r.petName === `Oyen GR ${run}`)).toBe(true)
    expect((await history({ q: trx.trxNumber })).map((r) => r.transactionId)).toEqual([trx.id, trx.id])
    expect(await listGroomingHistory({ branchId: tokoLain, ...range() })).toEqual([])
    expect(await listGroomingHistory({ branchScope: eq(groomingOrders.branchId, tokoLain), ...range(), q: trx.trxNumber })).toEqual([])
  })
})

describe('Ganti Groomer (DB lokal)', () => {
  it('groomer berganti, bonus ikut pindah, jejak & audit tercatat; baris nota tidak disentuh', async () => {
    const trx = await sale([groom(mochi, dedi)])
    const [before] = await ofTrx(trx.id)
    const [lineBefore] = await db.select().from(transactionItems).where(eq(transactionItems.transactionId, trx.id))

    await changeGroomer(before.id, { groomerId: asep, reason: '  kasir salah pilih, yang mengerjakan Asep  ' }, admin())

    const [after] = await ofTrx(trx.id)
    expect(after).toMatchObject({ groomerId: asep, groomerName: `Asep GR ${run}`, bonus: 10000, price: 100000 })
    expect(after.changes).toHaveLength(1)
    expect(after.changes[0]).toMatchObject({ from: `Dedi GR ${run}`, to: `Asep GR ${run}`, by: `GR${run}`, reason: 'kasir salah pilih, yang mengerjakan Asep' })

    const sum = summarizeGrooming([after], [])
    expect(sum.byGroomer.map((g) => g.key)).toEqual([String(asep)])

    const [log] = await db.select().from(auditLogs).where(and(eq(auditLogs.action, 'GROOMING_GROOMER_CHANGE'), eq(auditLogs.recordId, String(before.id))))
    expect(JSON.parse(log.oldData as string)).toEqual({ groomerId: dedi })
    expect(JSON.parse(log.newData as string)).toMatchObject({ groomerId: asep })
    const [lineAfter] = await db.select().from(transactionItems).where(eq(transactionItems.transactionId, trx.id))
    expect(lineAfter).toEqual(lineBefore)

    // diganti balik → dua jejak, berurutan
    await changeGroomer(before.id, { groomerId: dedi, reason: 'ternyata benar Dedi' }, admin())
    expect((await ofTrx(trx.id))[0].changes.map((c) => [c.from, c.to])).toEqual([
      [`Dedi GR ${run}`, `Asep GR ${run}`],
      [`Asep GR ${run}`, `Dedi GR ${run}`],
    ])
  })

  it('ditolak: tanpa alasan, groomer sama, groomer nonaktif, pengantar, grooming dibatalkan, cabang lain — tanpa jejak baru', async () => {
    const trx = await sale([groom(mochi, dedi)])
    const [row] = await ofTrx(trx.id)
    const off = await createGroomer({ name: `Off GR ${run}` }, actor)
    await updateGroomer(off.id, { isActive: false }, actor)
    const batal = await sale([groom(oyen, dedi)])
    const [rowBatal] = await ofTrx(batal.id)
    await performVoid({ txId: batal.id, branchId: toko, trxNumber: batal.trxNumber, actorUserId: userId })

    const kasus: [string, () => Promise<unknown>][] = [
      ['REASON_REQUIRED', () => changeGroomer(row.id, { groomerId: asep, reason: '   ' }, admin())],
      ['REASON_REQUIRED', () => changeGroomer(row.id, { groomerId: asep, reason: 'x'.repeat(301) }, admin())],
      ['SAME_GROOMER', () => changeGroomer(row.id, { groomerId: dedi, reason: 'alasan cukup' }, admin())],
      ['GROOMER_INACTIVE', () => changeGroomer(row.id, { groomerId: off.id, reason: 'alasan cukup' }, admin())],
      ['GROOMER_ROLE', () => changeGroomer(row.id, { groomerId: ujang, reason: 'alasan cukup' }, admin())],
      ['GROOMER_NOT_FOUND', () => changeGroomer(row.id, { groomerId: 99999999, reason: 'alasan cukup' }, admin())],
      ['WRONG_STATUS', () => changeGroomer(rowBatal.id, { groomerId: asep, reason: 'alasan cukup' }, admin())],
      ['NOT_FOUND', () => changeGroomer(row.id, { groomerId: asep, reason: 'alasan cukup' }, { userId, branchId: tokoLain, allBranches: false })],
    ]
    for (const [code, attempt] of kasus) {
      await expect(attempt(), code).rejects.toMatchObject({ code })
    }
    expect(await db.select().from(groomingGroomerChanges).where(eq(groomingGroomerChanges.groomingOrderId, row.id))).toHaveLength(0)
    expect((await ofTrx(trx.id))[0].groomerId).toBe(dedi)

    // Owner/GM (lintas cabang) boleh walau sedang berada di cabang lain
    await changeGroomer(row.id, { groomerId: asep, reason: 'alasan cukup' }, { userId, branchId: tokoLain, allBranches: true })
    expect((await ofTrx(trx.id))[0].groomerId).toBe(asep)
  })
})
