import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  db, branches, unitsOfMeasure, products, productUomConversions, roles, users, shifts, paymentMethods,
  interBranchTransfers, interBranchTransferItems, interBranchPayables, interBranchPayments, internalReturns,
  internalCreditEntries, cashFlowEntries, auditLogs, eq, and, asc, inArray,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'

vi.mock('@/lib/authz', () => ({
  requirePermission: async () => ({ userId, branchId: gudang, branchScope: 'ALL' }),
  getAuth: async () => ({ userId, branchId: gudang, branchScope: 'ALL' }),
  hasPermission: () => true,
}))

import { PATCH as transferStatus } from '../../app/api/bo/internal-transfers/[id]/status/route'
import { approveReturnedGoods, cancelReturnedGoods, createReturnedGoodsRequest, type InternalReturnActor } from './internal-return-service'
import { internalCreditBalance, listInternalCreditBalances } from './internal-credit-service'

// RI7 — Saldo Internal otomatis ke DB lokal (salinan produksi). Tiap tes memakai toko sendiri supaya
// saldo & tagihan pasangan cabangnya tidak tercampur. Harga nota 5.000/BOX (BOX = 5 PCS).
const run = randomUUID().slice(0, 8)
let gudang: number
let userId: number
let pcs: number
let box: number
let debtMethodId: number
const shiftByBranch = new Map<number, number>()
const allBranchIds: number[] = []

const owner = (): InternalReturnActor => ({ userId, branchId: gudang, allBranches: true })

async function newToko(tag: string) {
  const [b] = await db.insert(branches).values({ code: `${tag}7${run}`, name: `Toko ${tag} RI7 ${run}` }).returning()
  allBranchIds.push(b.id)
  return b.id
}

async function product(name: string, branch: number, stockPcs: number) {
  const [p] = await db.insert(products).values({ name: `${name} ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning()
  await db.insert(productUomConversions).values({ productId: p.id, uomId: box, ratio: 5 })
  await db.transaction((tx) => StockService.addStock(tx, branch, p.id, pcs, String(stockPcs), '1000'))
  return p.id
}

async function shiftOf(branch: number) {
  if (!shiftByBranch.has(branch)) {
    const [s] = await db.insert(shifts).values({ branchId: branch, openedById: userId, shiftNumber: 1, assignedCashiers: [userId], openingCash: 0 }).returning()
    shiftByBranch.set(branch, s.id)
  }
  return shiftByBranch.get(branch)!
}

function patch(ibtId: number, body: Record<string, unknown>) {
  return transferStatus(
    new NextRequest('http://localhost', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: String(ibtId) }) },
  )
}

/** Kiriman lengkap: PO Internal qty BOX → Bulk Sale 5.000/BOX → kirim → terima penuh. */
async function receivedIbt(productId: number, qtyBox: number, destination: number, source = gudang) {
  const [ibt] = await db.insert(interBranchTransfers).values({
    ibtNumber: `IBT-RI7-${randomUUID().slice(0, 12)}`, sourceBranchId: source, destinationBranchId: destination, requestedById: userId, status: 'PENDING_APPROVAL',
  }).returning()
  await db.insert(interBranchTransferItems).values({ transferId: ibt.id, productId, uomId: box, qtyRequested: qtyBox, costPriceAtTransfer: 1 })
  const total = qtyBox * 5000
  const trx = await TransactionService.createTransaction({
    branchId: source, cashierId: userId, shiftId: await shiftOf(source), localTrxNumber: `RI7-${randomUUID()}`, saleType: 'BULK', sourceIbtId: ibt.id,
    items: [{ productId, uomId: box, qty: qtyBox, unitPrice: 5000, discountAmount: 0, subtotal: total, priceTier: 'GROSIR' }],
    payments: [{ paymentMethodId: debtMethodId, amount: total }], totals: { subtotal: total, discountTotal: 0, grandTotal: total }, amountPaid: total, change: 0,
  } as never)
  expect((await patch(ibt.id, { action: 'prepare' })).status).toBe(200)
  const rows = await db.select().from(interBranchTransferItems).where(eq(interBranchTransferItems.transferId, ibt.id))
  expect((await patch(ibt.id, { action: 'ship', items: rows.map((i) => ({ itemId: i.id, qty: 0 })) })).status).toBe(200)
  const shipped = await db.select().from(interBranchTransferItems).where(eq(interBranchTransferItems.transferId, ibt.id))
  expect((await patch(ibt.id, { action: 'receive', items: shipped.map((i) => ({ itemId: i.id, qty: i.qtyShipped })) })).status).toBe(200)
  const [payable] = await db.select().from(interBranchPayables).where(eq(interBranchPayables.transferId, ibt.id))
  return { ibt, trx: trx as { id: number; trxNumber: string }, itemId: shipped[0].id, payable }
}


const request = (transferId: number, transferItemId: number, qty: number) =>
  createReturnedGoodsRequest({
    input: { transferId, reason: 'TIDAK_DATANG', notes: 'tes: barang tidak datang', items: [{ transferItemId, qty }] },
    actor: owner(), source: 'BO',
  })
const payableOf = async (id: number) => (await db.select().from(interBranchPayables).where(eq(interBranchPayables.id, id)))[0]
const paymentsOf = async (payableId: number) =>
  (await db.select().from(interBranchPayments).where(eq(interBranchPayments.payableId, payableId)).orderBy(asc(interBranchPayments.id)))
    .map(p => [p.sourceType, p.amount, p.referenceNumber, p.paymentMethodId])
const markPaid = (payableId: number, paidAmount: number, status: string) =>
  db.update(interBranchPayables).set({ paidAmount, status }).where(eq(interBranchPayables.id, payableId))
const cashEntryCount = async () => (await db.select({ id: cashFlowEntries.id }).from(cashFlowEntries).where(inArray(cashFlowEntries.branchId, allBranchIds))).length
const statusOf = async (returnId: number) => (await db.select().from(internalReturns).where(eq(internalReturns.id, returnId)))[0].status

beforeAll(async () => {
  gudang = (await db.insert(branches).values({ code: `G7${run}`, name: `Gudang RI7 ${run}` }).returning())[0].id
  allBranchIds.push(gudang)
  const roleId = (await db.insert(roles).values({ name: `RI7${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `RI7${run}`, roleId, branchId: gudang }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `P7${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  box = (await db.insert(unitsOfMeasure).values({ code: `B7${run}`, name: 'BOX tes' }).returning())[0].id
  debtMethodId = (await db.insert(paymentMethods).values({ name: `Hutang RI7 ${run}`, type: 'DEBT' }).returning())[0].id
})

describe('Saldo Internal otomatis (RI7, DB lokal)', () => {
  it('1. saldo baru langsung memotong tagihan terbuka TERTUA pasangan cabang itu; cabang lain tidak tersentuh; jejak lengkap; bukan kas', async () => {
    const toko = await newToko('A')
    const tokoLain = await newToko('B')
    const p = await product('Tertua', gudang, 100)
    const a = await receivedIbt(p, 1, toko)
    const b = await receivedIbt(p, 4, toko)
    const c = await receivedIbt(p, 4, toko)
    const x = await receivedIbt(p, 1, tokoLain)
    await markPaid(c.payable.id, 18_000, 'PARTIAL')

    const header = await request(c.ibt.id, c.itemId, 3)
    const approved = await approveReturnedGoods({ id: header.id, userId })
    // Nilai 15.000: 2.000 melunasi kiriman itu sendiri, 13.000 jadi saldo → A lunas 5.000, B dipotong 8.000.
    expect([approved.payableDeduction, approved.creditAmount]).toEqual([2_000, 13_000])
    expect((await payableOf(c.payable.id)).status).toBe('PAID')
    const [pa, pb, px] = [await payableOf(a.payable.id), await payableOf(b.payable.id), await payableOf(x.payable.id)]
    expect([pa.paidAmount, pa.status]).toEqual([5_000, 'PAID'])
    expect([pb.paidAmount, pb.status]).toEqual([8_000, 'PARTIAL'])
    expect([px.paidAmount, px.status]).toEqual([0, 'UNPAID'])
    expect(await internalCreditBalance(db, toko, gudang)).toBe(0)

    // Riwayat pembayaran: baris SALDO INTERNAL menunjuk dokumen retur, tanpa metode bayar.
    expect(await paymentsOf(a.payable.id)).toEqual([['SALDO_INTERNAL', 5_000, header.returnNumber, null]])
    expect(await paymentsOf(b.payable.id)).toEqual([['SALDO_INTERNAL', 8_000, header.returnNumber, null]])
    // Keterangan menyebut asal saldo lengkap: nomor retur, nomor IBT, dan nomor nota Bulk Sale-nya.
    const [payRow] = await db.select().from(interBranchPayments).where(eq(interBranchPayments.payableId, a.payable.id))
    for (const nomor of [header.returnNumber, c.ibt.ibtNumber, c.trx.trxNumber]) expect(payRow.notes).toContain(nomor)
    const entries = await db.select().from(internalCreditEntries)
      .where(eq(internalCreditEntries.internalReturnId, header.id)).orderBy(asc(internalCreditEntries.id))
    expect(entries.map(e => [e.sourceType, e.amount, e.payableId])).toEqual([
      ['RETUR_INTERNAL', 13_000, c.payable.id],
      ['PAKAI', -5_000, a.payable.id],
      ['PAKAI', -8_000, b.payable.id],
    ])
    expect(entries.slice(1).every(e => e.paymentId != null)).toBe(true)
    const audits = await db.select().from(auditLogs).where(and(
      eq(auditLogs.action, 'INTERNAL_CREDIT_APPLY'),
      inArray(auditLogs.recordId, [String(a.payable.id), String(b.payable.id)]),
    ))
    expect(audits).toHaveLength(2)
    expect(await cashEntryCount()).toBe(0)
  })

  it('2. tidak ada tagihan terbuka → saldo menunggu; tagihan BARU saat terima kiriman langsung dipotong; saldo terpakai → batal ditolak', async () => {
    const toko = await newToko('C')
    const p = await product('Baru', gudang, 100)
    const c = await receivedIbt(p, 4, toko)
    await markPaid(c.payable.id, 20_000, 'PAID')

    const header = await request(c.ibt.id, c.itemId, 2)
    const approved = await approveReturnedGoods({ id: header.id, userId })
    expect([approved.payableDeduction, approved.creditAmount]).toEqual([0, 10_000])
    expect(await internalCreditBalance(db, toko, gudang)).toBe(10_000)
    expect((await listInternalCreditBalances()).find(r => r.debtorBranchId === toko)).toMatchObject({ creditorBranchId: gudang, balance: 10_000 })

    // Kiriman baru 5.000 → langsung lunas dari saldo.
    const d = await receivedIbt(p, 1, toko)
    expect([d.payable.totalAmount, d.payable.paidAmount, d.payable.status]).toEqual([5_000, 5_000, 'PAID'])
    expect(await internalCreditBalance(db, toko, gudang)).toBe(5_000)
    // Kiriman berikutnya 20.000 → dipotong sisa saldo 5.000, sisanya tetap hutang.
    const e = await receivedIbt(p, 4, toko)
    expect([e.payable.totalAmount, e.payable.paidAmount, e.payable.status]).toEqual([20_000, 5_000, 'PARTIAL'])
    expect(await internalCreditBalance(db, toko, gudang)).toBe(0)
    expect(await paymentsOf(e.payable.id)).toEqual([['SALDO_INTERNAL', 5_000, header.returnNumber, null]])
    // Kiriman setelah saldo habis: hutang biasa.
    const f = await receivedIbt(p, 1, toko)
    expect([f.payable.paidAmount, f.payable.status]).toEqual([0, 'UNPAID'])
    expect(await cashEntryCount()).toBe(0)

    await expect(cancelReturnedGoods({ id: header.id, userId, reason: 'tes batal' })).rejects.toThrow(/sudah terpakai/)
    expect(await statusOf(header.id)).toBe('APPROVED')
    expect((await payableOf(d.payable.id)).paidAmount).toBe(5_000)
  })

  it('3. batal retur yang membuka hutang lagi → hutang itu dipotong saldo dari retur lain; retur lain itu jadi tidak bisa dibatalkan', async () => {
    const toko = await newToko('D')
    const p = await product('Batal', gudang, 100)
    const f = await receivedIbt(p, 4, toko)
    const r1 = await request(f.ibt.id, f.itemId, 1)
    await approveReturnedGoods({ id: r1.id, userId })
    expect((await payableOf(f.payable.id)).paidAmount).toBe(5_000)
    await markPaid(f.payable.id, 20_000, 'PAID')

    const g = await receivedIbt(p, 4, toko)
    await markPaid(g.payable.id, 20_000, 'PAID')
    const r2 = await request(g.ibt.id, g.itemId, 1)
    await approveReturnedGoods({ id: r2.id, userId })
    expect(await internalCreditBalance(db, toko, gudang)).toBe(5_000)

    await cancelReturnedGoods({ id: r1.id, userId, reason: 'tes batal' })
    expect(await statusOf(r1.id)).toBe('CANCELLED')
    const pf = await payableOf(f.payable.id)
    expect([pf.paidAmount, pf.status]).toEqual([20_000, 'PAID'])
    expect(await paymentsOf(f.payable.id)).toEqual([
      ['RETUR_INTERNAL', 5_000, r1.returnNumber, null],
      ['BATAL_RETUR', -5_000, r1.returnNumber, null],
      ['SALDO_INTERNAL', 5_000, r2.returnNumber, null],
    ])
    expect(await internalCreditBalance(db, toko, gudang)).toBe(0)
    await expect(cancelReturnedGoods({ id: r2.id, userId, reason: 'tes batal' })).rejects.toThrow(/sudah terpakai/)
    expect(await cashEntryCount()).toBe(0)
  })

  it('4. saldo yang belum terpakai masih bisa dibatalkan bersih', async () => {
    const toko = await newToko('E')
    const p = await product('Bersih', gudang, 100)
    const h = await receivedIbt(p, 4, toko)
    await markPaid(h.payable.id, 20_000, 'PAID')
    const header = await request(h.ibt.id, h.itemId, 1)
    await approveReturnedGoods({ id: header.id, userId })
    expect(await internalCreditBalance(db, toko, gudang)).toBe(5_000)

    await cancelReturnedGoods({ id: header.id, userId, reason: 'tes batal' })
    expect(await statusOf(header.id)).toBe('CANCELLED')
    expect(await internalCreditBalance(db, toko, gudang)).toBe(0)
    expect((await payableOf(h.payable.id)).paidAmount).toBe(20_000)
  })

  it('5. dua retur disetujui bersamaan untuk pasangan cabang yang sama: saldo tidak terpakai dobel dan tidak macet', async () => {
    const toko = await newToko('F')
    const p = await product('Bersamaan', gudang, 100)
    const a = await receivedIbt(p, 4, toko)
    const c1 = await receivedIbt(p, 4, toko)
    const c2 = await receivedIbt(p, 4, toko)
    await markPaid(c1.payable.id, 20_000, 'PAID')
    await markPaid(c2.payable.id, 20_000, 'PAID')
    const r1 = await request(c1.ibt.id, c1.itemId, 1)
    const r2 = await request(c2.ibt.id, c2.itemId, 1)

    await Promise.all([approveReturnedGoods({ id: r1.id, userId }), approveReturnedGoods({ id: r2.id, userId })])
    const pa = await payableOf(a.payable.id)
    expect([pa.paidAmount, pa.status]).toEqual([10_000, 'PARTIAL'])
    expect(await internalCreditBalance(db, toko, gudang)).toBe(0)
    expect((await paymentsOf(a.payable.id)).map(row => [row[0], row[1]])).toEqual([['SALDO_INTERNAL', 5_000], ['SALDO_INTERNAL', 5_000]])
  })
})
