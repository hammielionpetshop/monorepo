import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { db, branches, unitsOfMeasure, products, roles, users, shifts, paymentMethods, transactions, eq } from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { TransactionEditService } from './transaction-edit-service'
import { performVoid } from './void-service'
import { createGroomer } from './grooming-master-service'
import { listDiscountHistory } from './discount-history-service'
import { buildDiscountHistory } from '../discount-history'

// Laporan Riwayat Diskon (P1f): empat sumber potongan terbaca dengan benar dari nota sungguhan —
// diskon kasir beralasan, potongan Penjualan Grosir, diskon nota cara lama — dan yang bukan
// diskon (gratis ongkir, nota batal, baris yang dikeluarkan lewat Koreksi) tidak ikut.
const run = randomUUID().slice(0, 8)
let toko: number
let tokoLain: number
let userId: number
let pcs: number
let cashMethodId: number
let shiftId: number
let shiftLain: number
let kurir: number
let ongkir: number

type Line = {
  productId: number
  qty: number
  unitPrice: number
  manualDiscount?: { amount: number; reasonCode: string; reasonNote?: string }
  /** Potongan baris tanpa catatan (cara Penjualan Grosir). */
  plainDiscount?: number
  delivery?: { courierId: number; freeShipping?: boolean }
}

const lineDiscount = (l: Line) => (l.delivery?.freeShipping ? l.qty * l.unitPrice : l.manualDiscount?.amount ?? l.plainDiscount ?? 0)

const toItems = (lines: Line[], priceTier: string) =>
  lines.map((l) => ({
    productId: l.productId, uomId: pcs, qty: l.qty, unitPrice: l.unitPrice, priceTier,
    discountAmount: lineDiscount(l), subtotal: l.qty * l.unitPrice - lineDiscount(l),
    ...(l.manualDiscount ? { manualDiscount: l.manualDiscount } : {}),
    ...(l.delivery ? { delivery: l.delivery } : {}),
  }))

/** Nota kasir. `noteDiscount` = diskon total nota cara lama. */
const sale = (lines: Line[], opts: { noteDiscount?: number; branchId?: number; shiftId?: number } = {}) => {
  const items = toItems(lines, 'RETAIL')
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0)
  const noteDiscount = opts.noteDiscount ?? 0
  const grandTotal = subtotal - noteDiscount
  return TransactionService.createTransaction({
    branchId: opts.branchId ?? toko, cashierId: userId, shiftId: opts.shiftId ?? shiftId, localTrxNumber: `RD-${randomUUID()}`,
    items, payments: [{ paymentMethodId: cashMethodId, amount: grandTotal }],
    totals: { subtotal, discountTotal: noteDiscount, grandTotal }, amountPaid: grandTotal, change: 0,
  } as never) as Promise<{ id: number; trxNumber: string }>
}

/** Penjualan Grosir: kepala nota = jumlah SEBELUM potongan baris, diskon = potongan baris + diskon transaksi. */
const bulkSale = (lines: Line[], trxDiscount = 0) => {
  const items = toItems(lines, 'GROSIR')
  const gross = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  const lineDiscounts = items.reduce((s, i) => s + i.discountAmount, 0)
  const grandTotal = gross - lineDiscounts - trxDiscount
  return TransactionService.createTransaction({
    branchId: toko, cashierId: userId, shiftId, localTrxNumber: `RD-${randomUUID()}`, saleType: 'BULK',
    items, payments: [{ paymentMethodId: cashMethodId, amount: grandTotal }],
    totals: { subtotal: gross, discountTotal: lineDiscounts + trxDiscount, grandTotal }, amountPaid: grandTotal, change: 0,
  } as never) as Promise<{ id: number; trxNumber: string }>
}

async function newGoods(nama: string, branchId = toko) {
  const [p] = await db.insert(products).values({ name: `${nama} ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning()
  await db.transaction((tx) => StockService.addStock(tx, branchId, p.id, pcs, '50', '1000'))
  return p.id
}

const from = new Date(Date.now() - 60 * 60 * 1000)
const to = () => new Date(Date.now() + 60 * 60 * 1000)
/** Laporan untuk satu cabang tes; `branchScope` meniru pengguna yang hanya boleh melihat cabangnya. */
const report = (branchId = toko) => listDiscountHistory({ branchScope: eq(transactions.branchId, branchId), from, to: to() })
const ofNote = async (trxId: number, branchId = toko) => (await report(branchId)).filter((r) => r.transactionId === trxId)

beforeAll(async () => {
  toko = (await db.insert(branches).values({ code: `RD${run}`, name: `Toko Diskon ${run}` }).returning())[0].id
  tokoLain = (await db.insert(branches).values({ code: `RL${run}`, name: `Toko Lain ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `RD${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `Kasir RD ${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `PD${run}`, name: 'Pcs tes', isBase: true }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai RD ${run}`, type: 'CASH' }).returning())[0].id
  shiftId = (await db.insert(shifts).values({ branchId: toko, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  shiftLain = (await db.insert(shifts).values({ branchId: tokoLain, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning())[0].id
  kurir = (await createGroomer({ name: `Kurir RD ${run}`, isGroomer: false, isCourier: true }, { userId, branchId: toko })).id
  ongkir = (await db.insert(products).values({ name: `Ongkir RD ${run}`, baseUomId: pcs, productKind: 'JASA_ONGKIR' }).returning())[0].id
})

describe('Laporan Riwayat Diskon (DB lokal)', () => {
  it('diskon kasir: tampil per barang dengan alasan, kasir, cabang, qty × harga; barang tanpa diskon tidak tampil', async () => {
    const pakan = await newGoods('Pakan Riwayat')
    const pasir = await newGoods('Pasir Riwayat')
    const trx = await sale([
      { productId: pakan, qty: 2, unitPrice: 25000, manualDiscount: { amount: 10000, reasonCode: 'KEMASAN_RUSAK' } },
      { productId: pasir, qty: 1, unitPrice: 10000, manualDiscount: { amount: 1500, reasonCode: 'LAINNYA', reasonNote: 'Titipan owner' } },
      { productId: pasir, qty: 3, unitPrice: 10000 },
    ])

    const rows = await ofNote(trx.id)
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.productId === pakan)).toMatchObject({
      source: 'MANUAL', trxNumber: trx.trxNumber, amount: 10000, reason: 'Kemasan rusak', qty: 2, unitPrice: 25000,
      byName: `Kasir RD ${run}`, branchName: `Toko Diskon ${run}`, saleType: 'RETAIL', productName: `Pakan Riwayat ${run}`,
    })
    expect(rows.find((r) => r.productId === pasir)).toMatchObject({ source: 'MANUAL', amount: 1500, reason: 'Titipan owner' })
  })

  it('Penjualan Grosir: potongan per barang tampil tanpa alasan; diskon transaksinya tampil sebagai diskon nota', async () => {
    const pakan = await newGoods('Pakan Grosir')
    const pasir = await newGoods('Pasir Grosir')
    const trx = await bulkSale([
      { productId: pakan, qty: 10, unitPrice: 20000, plainDiscount: 15000 },
      { productId: pasir, qty: 5, unitPrice: 10000 },
    ], 5000)

    const rows = await ofNote(trx.id)
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.source === 'GROSIR')).toMatchObject({
      productId: pakan, amount: 15000, reason: 'Potongan Penjualan Grosir', saleType: 'BULK', qty: 10,
    })
    expect(rows.find((r) => r.source === 'NOTA')).toMatchObject({ productId: null, amount: 5000, reason: 'Diskon transaksi Penjualan Grosir' })
  })

  it('Penjualan Grosir yang hanya berpotongan per barang tidak memunculkan diskon nota (tidak dihitung dua kali)', async () => {
    const pakan = await newGoods('Pakan Grosir Saja')
    const trx = await bulkSale([{ productId: pakan, qty: 4, unitPrice: 20000, plainDiscount: 8000 }])

    const rows = await ofNote(trx.id)
    expect(rows.map((r) => [r.source, r.amount])).toEqual([['GROSIR', 8000]])
  })

  it('nota lama berdiskon total: tampil sebagai "diskon nota (tidak per barang)", bukan per barang', async () => {
    const pakan = await newGoods('Pakan Nota Lama')
    const trx = await sale([{ productId: pakan, qty: 2, unitPrice: 25000 }], { noteDiscount: 7000 })

    const rows = await ofNote(trx.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ source: 'NOTA', productId: null, productName: 'Diskon nota (tidak per barang)', amount: 7000, reason: 'Diskon nota (cara lama)' })
    expect(buildDiscountHistory(rows)).toMatchObject({ products: [], summary: { total: 7000, noteCount: 1 } })
  })

  it('gratis ongkir bukan diskon: tidak tampil, walau satu nota dengan barang berdiskon', async () => {
    const pakan = await newGoods('Pakan Ongkir')
    const trx = await sale([
      { productId: pakan, qty: 1, unitPrice: 30000, manualDiscount: { amount: 2000, reasonCode: 'LANGGANAN' } },
      { productId: ongkir, qty: 10, unitPrice: 1000, delivery: { courierId: kurir, freeShipping: true } },
    ])

    const rows = await ofNote(trx.id)
    expect(rows.map((r) => [r.source, r.productId, r.amount])).toEqual([['MANUAL', pakan, 2000]])
  })

  it('nota yang dibatalkan hilang dari laporan', async () => {
    const pakan = await newGoods('Pakan Batal')
    const trx = await sale([{ productId: pakan, qty: 1, unitPrice: 30000, manualDiscount: { amount: 3000, reasonCode: 'LANGGANAN' } }])
    expect(await ofNote(trx.id)).toHaveLength(1)

    await performVoid({ txId: trx.id, branchId: toko, trxNumber: trx.trxNumber, actorUserId: userId })
    expect(await ofNote(trx.id)).toHaveLength(0)
  })

  it('baris Grosir berpotongan yang dikeluarkan lewat Koreksi tidak lagi tampil', async () => {
    const pakan = await newGoods('Pakan Koreksi')
    const pasir = await newGoods('Pasir Koreksi')
    const trx = await bulkSale([
      { productId: pakan, qty: 2, unitPrice: 20000, plainDiscount: 4000 },
      { productId: pasir, qty: 1, unitPrice: 10000 },
    ])
    expect((await ofNote(trx.id)).map((r) => r.amount)).toEqual([4000])

    const lines = await db.query.transactionItems.findMany({ where: (t, { eq: is }) => is(t.transactionId, trx.id), orderBy: (t, { asc }) => asc(t.id) })
    const keep = lines[1]
    await TransactionEditService.editTransaction({
      txId: trx.id, branchId: toko, actorUserId: userId, approvedById: userId, reason: 'Tes koreksi riwayat diskon',
      items: [{ transactionItemId: keep.id, productId: keep.productId as number, uomId: keep.uomId, qty: keep.qty, unitPrice: keep.unitPrice, discountAmount: 0, priceTier: keep.priceTier }],
      payments: [{ paymentMethodId: cashMethodId, amount: 10000 }],
    })
    expect(await ofNote(trx.id)).toHaveLength(0)
  })

  it('batas cabang dan batas tanggal dipatuhi', async () => {
    const pakanLain = await newGoods('Pakan Cabang Lain', tokoLain)
    const trx = await sale(
      [{ productId: pakanLain, qty: 1, unitPrice: 30000, manualDiscount: { amount: 1000, reasonCode: 'LANGGANAN' } }],
      { branchId: tokoLain, shiftId: shiftLain },
    )

    expect(await ofNote(trx.id, toko)).toHaveLength(0)
    expect(await ofNote(trx.id, tokoLain)).toHaveLength(1)
    // Pilihan cabang di saringan mempersempit lagi di dalam hak akses.
    const picked = await listDiscountHistory({ branchId: tokoLain, from, to: to() })
    expect(picked.every((r) => r.branchId === tokoLain)).toBe(true)
    expect(picked.some((r) => r.transactionId === trx.id)).toBe(true)
    // Di luar rentang tanggal → kosong.
    const kemarin = await listDiscountHistory({ branchId: tokoLain, from: new Date(Date.now() - 48 * 3600 * 1000), to: new Date(Date.now() - 24 * 3600 * 1000) })
    expect(kemarin).toHaveLength(0)
  })
})
