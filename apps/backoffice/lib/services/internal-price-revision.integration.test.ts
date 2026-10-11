import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  db, branches, unitsOfMeasure, products, productUomConversions, productUomCosts, productStockBatches, roles, users, shifts, paymentMethods,
  interBranchTransfers, interBranchTransferItems, interBranchPayables, interBranchPayments, internalReturns, internalReturnItems,
  internalReturnBatchAdjustments, auditLogs, eq, and, sql,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'
import { stockLedgerUnion } from './stock-ledger'

vi.mock('@/lib/authz', () => ({
  requirePermission: async () => ({ userId, branchId: gudang, branchScope: 'ALL' }),
  getAuth: async () => ({ userId, branchId: gudang, branchScope: 'ALL' }),
  hasPermission: () => true,
}))

import { PATCH as transferStatus } from '../../app/api/bo/internal-transfers/[id]/status/route'
import {
  approveReturnedGoods,
  cancelReturnedGoods,
  createReturnedGoodsRequest,
  internalCreditBalance,
  rejectInternalReturn,
  withdrawInternalReturn,
  type InternalReturnActor,
} from './internal-return-service'
import {
  approvePriceRevision,
  cancelPriceRevision,
  createPriceRevisionRequest,
  loadRevisableTransferItems,
} from './internal-price-revision-service'
import { getInternalReturnPLAdjustments, getInternalReturnProductAdjustments } from './internal-return-report'
import { getSalesByProductReport } from './report-service'
import { getDailySummary } from './dashboard-service'

// RI8 — Retur Internal "Revisi Harga Beli" ke DB lokal (salinan produksi), alur asli:
// PO Internal → Bulk Sale pengirim → kirim → terima → ajukan revisi → setujui / tolak / tarik / batalkan.
// Satuan: PCS (dasar), BOX = 5 PCS. Harga nota 5.000/BOX (= 1.000/PCS di batch toko).
// Tiap tes memakai pasangan cabang sendiri supaya Saldo Internal & Laba Rugi tidak saling campur.
const run = randomUUID().slice(0, 8)
let gudang: number
let userId: number
let otherUserId: number
let pcs: number
let box: number
let debtMethodId: number
let branchSeq = 0
const shiftByBranch = new Map<number, number>()

const owner = (): InternalReturnActor => ({ userId, branchId: gudang, allBranches: true })
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())

async function newBranch(label: string) {
  branchSeq++
  return (await db.insert(branches).values({ code: `${label}${branchSeq}${run}`, name: `${label} RI8 ${branchSeq} ${run}` }).returning())[0].id
}

async function product(name: string, branch: number, stockPcs: number) {
  const [p] = await db.insert(products).values({ name: `${name} ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning()
  await db.insert(productUomConversions).values({ productId: p.id, uomId: box, ratio: 5 })
  await db.transaction((tx) => StockService.addStock(tx, branch, p.id, pcs, String(stockPcs), '1000'))
  return p.id
}

const batchesOf = (productId: number, branch: number) =>
  db.select().from(productStockBatches)
    .where(and(eq(productStockBatches.productId, productId), eq(productStockBatches.branchId, branch)))
    .orderBy(productStockBatches.id)

async function stockPcs(productId: number, branch: number) {
  return (await batchesOf(productId, branch)).reduce((sum, row) => sum + Number(row.qtyRemaining), 0)
}

/** Simulasi barang terjual / terpakai di toko: stok keluar FIFO. */
const sell = (productId: number, branch: number, qtyPcs: number) =>
  db.transaction((tx) => StockService.deductStock(tx, branch, productId, pcs, qtyPcs, false))

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
async function receivedIbt(productId: number, qtyBox: number, source: number, destination: number) {
  const [ibt] = await db.insert(interBranchTransfers).values({
    ibtNumber: `IBT-RI8-${randomUUID().slice(0, 12)}`, sourceBranchId: source, destinationBranchId: destination, requestedById: userId, status: 'PENDING_APPROVAL',
  }).returning()
  await db.insert(interBranchTransferItems).values({ transferId: ibt.id, productId, uomId: box, qtyRequested: qtyBox, costPriceAtTransfer: 1 })
  const total = qtyBox * 5000
  const trx = await TransactionService.createTransaction({
    branchId: source, cashierId: userId, shiftId: await shiftOf(source), localTrxNumber: `RI8-${randomUUID()}`, saleType: 'BULK', sourceIbtId: ibt.id,
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

const revise = (transferId: number, transferItemId: number, proposedUnitPrice: number, actor = owner()) =>
  createPriceRevisionRequest({
    input: { transferId, notes: 'tes: gudang salah pakai harga retail', items: [{ transferItemId, proposedUnitPrice }] },
    actor, source: 'BO',
  })
const returnGoods = (transferId: number, transferItemId: number, qty: number) =>
  createReturnedGoodsRequest({
    input: { transferId, reason: 'TIDAK_DATANG', notes: 'tes: barang tidak datang', items: [{ transferItemId, qty }] },
    actor: owner(), source: 'BO',
  })
const payableOf = async (id: number) => (await db.select().from(interBranchPayables).where(eq(interBranchPayables.id, id)))[0]
const itemsOf = (returnId: number) => db.select().from(internalReturnItems).where(eq(internalReturnItems.internalReturnId, returnId))
const plOf = async (branchId: number) =>
  (await getInternalReturnPLAdjustments(today(), today())).find(r => r.branchId === branchId) ?? { branchId, revenueCorrection: 0, costAdjustment: 0 }
const costOf = async (productId: number, branch: number, uomId: number) =>
  (await db.select().from(productUomCosts)
    .where(and(eq(productUomCosts.productId, productId), eq(productUomCosts.branchId, branch), eq(productUomCosts.uomId, uomId))))[0]?.costPrice

beforeAll(async () => {
  gudang = await newBranch('G8')
  const roleId = (await db.insert(roles).values({ name: `RI8${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `RI8${run}`, roleId, branchId: gudang }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `P8${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  box = (await db.insert(unitsOfMeasure).values({ code: `B8${run}`, name: 'BOX tes' }).returning())[0].id
  debtMethodId = (await db.insert(paymentMethods).values({ name: `Hutang RI8 ${run}`, type: 'DEBT' }).returning())[0].id
  const tokoUser = await newBranch('U8')
  otherUserId = (await db.insert(users).values({ name: `RI8b${run}`, roleId, branchId: tokoUser }).returning())[0].id
})

describe('Retur Internal — Revisi Harga Beli (RI8, DB lokal)', () => {
  it('1. harga turun, sebagian sudah terjual: stok diam, modal sisa batch dibetulkan, Penyesuaian Modal, hutang dipotong; batalkan membalik', async () => {
    const sender = await newBranch('S8')
    const toko = await newBranch('T8')
    const p = await product('Turun', sender, 100)
    const { ibt, itemId, payable } = await receivedIbt(p, 4, sender, toko)
    expect(payable.totalAmount).toBe(20_000)
    expect((await batchesOf(p, toko)).map(b => [b.qtyRemaining, b.costPrice, b.transferItemId])).toEqual([[20, 1000, itemId]])
    expect(await costOf(p, toko, box)).toBe(5000)

    await sell(p, toko, 5) // 1 BOX sudah terjual sebelum harga dibetulkan

    const revisable = await loadRevisableTransferItems(db, ibt.id)
    expect(revisable.map(i => [i.unitPrice, i.notaUnitPrice, i.revisableQty, i.hasPendingRevision])).toEqual([[5000, 5000, 4, false]])
    await expect(revise(ibt.id, itemId, 5000)).rejects.toThrow(/sama dengan harga sekarang/)

    const header = await revise(ibt.id, itemId, 4000)
    expect([header.kind, header.status, header.reason, header.totalValue]).toEqual(['REVISI_HARGA', 'PENDING', 'SALAH_HARGA', 4_000])
    // Menunggu: belum ada yang berubah; barang yang sama tidak bisa diajukan dua kali.
    expect((await batchesOf(p, toko))[0].costPrice).toBe(1000)
    expect((await payableOf(payable.id)).paidAmount).toBe(0)
    await expect(revise(ibt.id, itemId, 4500)).rejects.toThrow(/menunggu persetujuan/)

    const approved = await approvePriceRevision({ id: header.id, userId })
    expect(approved.status).toBe('APPROVED')
    expect([approved.totalValue, approved.payableDeduction, approved.creditAmount, approved.cogsAdjustment]).toEqual([4_000, 4_000, 0, 1_000])

    // Stok tidak bergerak; modal sisa 15 PCS jadi 800.
    expect((await batchesOf(p, toko)).map(b => [b.qtyRemaining, b.costPrice])).toEqual([[15, 800]])
    expect(await stockPcs(p, sender)).toBe(80)
    const [item] = await itemsOf(header.id)
    expect([item.qty, item.oldUnitPrice, item.proposedUnitPrice, item.finalUnitPrice, item.lineValue, item.qtyConsumed, item.cogsAdjustment])
      .toEqual([4, 5000, 4000, 4000, 4_000, 5, 1_000])
    const adjustments = await db.select().from(internalReturnBatchAdjustments).where(eq(internalReturnBatchAdjustments.internalReturnId, header.id))
    expect(adjustments.map(a => [a.oldCostPrice, a.newCostPrice, a.qtyRemaining])).toEqual([[1000, 800, 15]])
    const ledger = await db.execute(sql`WITH sm AS (${stockLedgerUnion}) SELECT 1 FROM sm WHERE reference_number = ${header.returnNumber}`)
    expect(ledger).toHaveLength(0)

    // Hutang dipotong lewat baris RETUR_INTERNAL — bukan uang kas.
    const pay = await payableOf(payable.id)
    expect([pay.totalAmount, pay.paidAmount, pay.status]).toEqual([20_000, 4_000, 'PARTIAL'])
    const [payment] = await db.select().from(interBranchPayments).where(eq(interBranchPayments.id, approved.payablePaymentId!))
    expect([payment.amount, payment.sourceType, payment.paymentMethodId, payment.referenceNumber]).toEqual([4_000, 'RETUR_INTERNAL', null, header.returnNumber])
    expect(payment.notes).toContain('Revisi Harga Beli')

    // Modal terbaru toko ikut dibetulkan (selisih < 30%).
    expect([await costOf(p, toko, box), await costOf(p, toko, pcs)]).toEqual([4000, 800])

    // Laba Rugi: omzet pengirim turun 4.000, Penyesuaian Modal toko +1.000.
    expect(await plOf(sender)).toMatchObject({ revenueCorrection: 4_000, costAdjustment: 0 })
    expect(await plOf(toko)).toMatchObject({ revenueCorrection: 0, costAdjustment: 1_000 })

    // Penjualan per Produk & Dashboard cabang pengirim ikut terkoreksi (RI8b); qty tetap.
    const period = { startDate: today(), endDate: today() }
    expect(await getInternalReturnProductAdjustments({ ...period, branchId: sender })).toEqual([
      expect.objectContaining({ productId: p, uomId: box, ratioToBase: 5, revenueCorrection: 4_000 }),
    ])
    expect(await getInternalReturnProductAdjustments({ ...period, branchId: toko })).toEqual([])
    expect(await getInternalReturnProductAdjustments({ ...period, branchId: sender, priceTier: 'RETAIL' })).toEqual([])
    const sales = await getSalesByProductReport({ ...period, branchId: sender, productIds: [p], priceTier: 'GROSIR' })
    expect(sales.items).toHaveLength(1)
    expect(sales.items[0]).toMatchObject({ qtyBase: 20, revenue: '16000', priceRevisionRevenue: '4000' })
    expect(sales.items[0].uoms.map(u => [u.uomId, u.qty, u.revenue])).toEqual([[box, 4, '16000']])
    expect(sales.totalRevenue).toBe('16000')
    expect((await getDailySummary(sender)).totalRevenue).toBe('16000')
    const tokoToday = await getDailySummary(toko)
    expect([tokoToday.totalRevenue, tokoToday.grossProfitEstimate]).toEqual(['0', '1000'])

    await expect(approvePriceRevision({ id: header.id, userId })).rejects.toThrow(/sudah diproses/)
    expect((await loadRevisableTransferItems(db, ibt.id))[0].unitPrice).toBe(4000)

    // Batalkan (stok belum berubah sejak revisi): semuanya kembali.
    const cancelled = await cancelPriceRevision({ id: header.id, userId, reason: 'tes: ternyata harga lama benar' })
    expect([cancelled.status, cancelled.cancellationReason]).toEqual(['CANCELLED', 'tes: ternyata harga lama benar'])
    expect((await batchesOf(p, toko)).map(b => [b.qtyRemaining, b.costPrice])).toEqual([[15, 1000]])
    const after = await payableOf(payable.id)
    expect([after.totalAmount, after.paidAmount, after.status]).toEqual([20_000, 0, 'UNPAID'])
    const payments = await db.select().from(interBranchPayments).where(eq(interBranchPayments.payableId, payable.id))
    expect(payments.map(r => [r.sourceType, r.amount]).sort()).toEqual([['BATAL_RETUR', -4_000], ['RETUR_INTERNAL', 4_000]])
    expect(await costOf(p, toko, box)).toBe(5000)
    expect(await plOf(sender)).toMatchObject({ revenueCorrection: 0 })
    expect(await plOf(toko)).toMatchObject({ costAdjustment: 0 })
    expect((await getSalesByProductReport({ ...period, branchId: sender, productIds: [p] })).items[0])
      .toMatchObject({ revenue: '20000', priceRevisionRevenue: '0' })
    expect((await getDailySummary(sender)).totalRevenue).toBe('20000')
    expect((await loadRevisableTransferItems(db, ibt.id))[0].unitPrice).toBe(5000)

    const actions = await db.select({ action: auditLogs.action }).from(auditLogs)
      .where(and(eq(auditLogs.tableName, 'internal_returns'), eq(auditLogs.recordId, String(header.id))))
    expect(actions.map(a => a.action).sort()).toEqual(['INTERNAL_RETURN_APPROVE', 'INTERNAL_RETURN_CANCEL', 'INTERNAL_RETURN_REQUEST'])
    await expect(cancelPriceRevision({ id: header.id, userId, reason: 'dua kali' })).rejects.toThrow(/Disetujui/)
  })

  it('2. harga naik + penyetuju mengubah harga final: tagihan bertambah, modal batch naik; batalkan; ditolak bila kenaikan sudah dibayar', async () => {
    const sender = await newBranch('S8')
    const toko = await newBranch('T8')
    const p = await product('Naik', sender, 100)
    const { ibt, itemId, payable } = await receivedIbt(p, 4, sender, toko)

    const header = await revise(ibt.id, itemId, 6000)
    expect(header.totalValue).toBe(-4_000)
    const [line] = await itemsOf(header.id)
    await expect(approvePriceRevision({ id: header.id, userId, finalPrices: [{ itemId: line.id + 999_999, finalUnitPrice: 5500 }] }))
      .rejects.toThrow(/bukan bagian dokumen/)
    await expect(approvePriceRevision({ id: header.id, userId, finalPrices: [{ itemId: line.id, finalUnitPrice: 5000 }] }))
      .rejects.toThrow(/sama dengan harga sekarang/)

    const approved = await approvePriceRevision({ id: header.id, userId, finalPrices: [{ itemId: line.id, finalUnitPrice: 5500 }] })
    expect([approved.totalValue, approved.payableDeduction, approved.creditAmount, approved.cogsAdjustment, approved.payablePaymentId])
      .toEqual([-2_000, -2_000, 0, 0, null])
    const [item] = await itemsOf(header.id)
    expect([item.proposedUnitPrice, item.finalUnitPrice, item.lineValue, item.qtyConsumed, item.cogsAdjustment]).toEqual([6000, 5500, -2_000, 0, 0])
    expect((await batchesOf(p, toko)).map(b => [b.qtyRemaining, b.costPrice])).toEqual([[20, 1100]])
    let pay = await payableOf(payable.id)
    expect([pay.totalAmount, pay.paidAmount, pay.status]).toEqual([22_000, 0, 'UNPAID'])
    expect(await plOf(sender)).toMatchObject({ revenueCorrection: -2_000 })

    const cancelled = await cancelPriceRevision({ id: header.id, userId, reason: 'tes: batal naik' })
    expect(cancelled.status).toBe('CANCELLED')
    pay = await payableOf(payable.id)
    expect([pay.totalAmount, pay.paidAmount, pay.status]).toEqual([20_000, 0, 'UNPAID'])
    expect((await batchesOf(p, toko))[0].costPrice).toBe(1000)

    // Revisi naik lagi, lalu tagihannya dilunasi penuh → kenaikan tidak bisa dibalik bersih.
    const again = await revise(ibt.id, itemId, 5500)
    await approvePriceRevision({ id: again.id, userId })
    await db.update(interBranchPayables).set({ paidAmount: 22_000, status: 'PAID' }).where(eq(interBranchPayables.id, payable.id))
    await expect(cancelPriceRevision({ id: again.id, userId, reason: 'tes' })).rejects.toThrow(/sudah dibayar/)
    expect((await db.select().from(internalReturns).where(eq(internalReturns.id, again.id)))[0].status).toBe('APPROVED')
  })

  it('3. hutang kiriman sudah lunas: selisih jadi Saldo Internal yang langsung memotong tagihan lain; batalkan ditolak karena saldo terpakai', async () => {
    const sender = await newBranch('S8')
    const toko = await newBranch('T8')
    const pA = await product('Lunas A', sender, 100)
    const pB = await product('Lunas B', sender, 100)
    const a = await receivedIbt(pA, 4, sender, toko)
    await db.update(interBranchPayables).set({ paidAmount: 20_000, status: 'PAID' }).where(eq(interBranchPayables.id, a.payable.id))
    const b = await receivedIbt(pB, 4, sender, toko)

    const header = await revise(a.ibt.id, a.itemId, 4000)
    const approved = await approvePriceRevision({ id: header.id, userId })
    expect([approved.totalValue, approved.payableDeduction, approved.creditAmount]).toEqual([4_000, 0, 4_000])
    // Saldo tidak mengendap: tagihan kiriman B terpotong, bukan uang kas.
    const payB = await payableOf(b.payable.id)
    expect([payB.paidAmount, payB.status]).toEqual([4_000, 'PARTIAL'])
    const paymentsB = await db.select().from(interBranchPayments).where(eq(interBranchPayments.payableId, b.payable.id))
    expect(paymentsB.map(r => [r.sourceType, r.amount, r.referenceNumber])).toEqual([['SALDO_INTERNAL', 4_000, header.returnNumber]])
    expect(await internalCreditBalance(db, toko, sender)).toBe(0)

    await expect(cancelPriceRevision({ id: header.id, userId, reason: 'tes' })).rejects.toThrow(/sudah terpakai/)
    expect((await batchesOf(pA, toko))[0].costPrice).toBe(800) // transaksi pembatalan dibatalkan utuh
  })

  it('4. kiriman lama (batch belum tertaut): batch dicocokkan lewat cabang/produk/satuan/modal/waktu; batch produk lain tidak tersentuh', async () => {
    const sender = await newBranch('S8')
    const toko = await newBranch('T8')
    const p = await product('Lama', sender, 100)
    // Stok lama toko dengan modal yang sama tapi jauh sebelum kiriman — tidak boleh ikut direvisi.
    await db.transaction((tx) => StockService.addStock(tx, toko, p, box, '2', '5000', new Date(Date.now() - 86_400_000)))
    const { ibt, itemId } = await receivedIbt(p, 4, sender, toko)
    await db.update(productStockBatches).set({ transferItemId: null }).where(eq(productStockBatches.transferItemId, itemId))

    const header = await revise(ibt.id, itemId, 4000)
    const approved = await approvePriceRevision({ id: header.id, userId })
    expect(approved.cogsAdjustment).toBe(0)
    expect((await batchesOf(p, toko)).map(b => [b.qtyRemaining, b.costPrice])).toEqual([[10, 1000], [20, 800]])
    const [item] = await itemsOf(header.id)
    expect([item.qtyConsumed, item.cogsAdjustment]).toEqual([0, 0])
  })

  it('5. stok sudah terjual setelah revisi → batalkan ditolak; jalan keluarnya revisi baru yang menghitung ulang bagian terpakai', async () => {
    const sender = await newBranch('S8')
    const toko = await newBranch('T8')
    const p = await product('Rantai', sender, 100)
    const { ibt, itemId, payable } = await receivedIbt(p, 4, sender, toko)

    const first = await revise(ibt.id, itemId, 4000)
    await approvePriceRevision({ id: first.id, userId })
    await sell(p, toko, 5)
    await expect(cancelPriceRevision({ id: first.id, userId, reason: 'tes' })).rejects.toThrow(/sudah berubah sejak revisi/)

    // Revisi kedua mengembalikan harga: harga lama = harga final revisi pertama.
    const second = await revise(ibt.id, itemId, 5000)
    expect(second.totalValue).toBe(-4_000)
    const approved = await approvePriceRevision({ id: second.id, userId })
    const [item] = await itemsOf(second.id)
    // 5 PCS terjual dengan modal 800 padahal seharusnya 1.000 → Penyesuaian Modal −1.000.
    expect([item.oldUnitPrice, item.finalUnitPrice, item.lineValue, item.qtyConsumed, item.cogsAdjustment]).toEqual([4000, 5000, -4_000, 5, -1_000])
    expect(approved.cogsAdjustment).toBe(-1_000)
    expect((await batchesOf(p, toko)).map(b => [b.qtyRemaining, b.costPrice])).toEqual([[15, 1000]])
    // Hutang: dipotong 4.000 oleh revisi pertama, tagihan naik 4.000 oleh revisi kedua → sisa tetap 20.000.
    const pay = await payableOf(payable.id)
    expect([pay.totalAmount, pay.paidAmount, pay.totalAmount - pay.paidAmount]).toEqual([24_000, 4_000, 20_000])
    expect(await plOf(sender)).toMatchObject({ revenueCorrection: 0 })
    expect(await plOf(toko)).toMatchObject({ costAdjustment: -1_000 })

    await expect(cancelPriceRevision({ id: first.id, userId, reason: 'tes' })).rejects.toThrow(/direvisi lagi/)
  })

  it('6. bersama Barang Dikembalikan: retur setelah revisi memakai harga baru & omzet pengirim tidak terpotong dua kali; pembatalan silang ditolak', async () => {
    const sender = await newBranch('S8')
    const toko = await newBranch('T8')
    const p = await product('Campur', sender, 100)
    const { ibt, itemId, payable } = await receivedIbt(p, 4, sender, toko)

    // Retur 1 BOX dulu (harga lama), lalu revisi untuk 3 BOX sisanya.
    const goodsBefore = await returnGoods(ibt.id, itemId, 1)
    expect((await approveReturnedGoods({ id: goodsBefore.id, userId })).totalValue).toBe(5_000)
    expect((await loadRevisableTransferItems(db, ibt.id))[0].revisableQty).toBe(3)
    const revision = await revise(ibt.id, itemId, 4000)
    const approved = await approvePriceRevision({ id: revision.id, userId })
    expect([approved.totalValue, approved.cogsAdjustment]).toEqual([3_000, 0])
    expect((await batchesOf(p, toko)).map(b => [b.qtyRemaining, b.costPrice])).toEqual([[15, 800]])
    await expect(cancelReturnedGoods({ id: goodsBefore.id, userId, reason: 'tes' })).rejects.toThrow(/sudah direvisi/)

    // Retur 1 BOX lagi setelah revisi: nilainya harga baru 4.000.
    const goodsAfter = await returnGoods(ibt.id, itemId, 1)
    expect(goodsAfter.totalValue).toBe(4_000)
    const goodsApproved = await approveReturnedGoods({ id: goodsAfter.id, userId })
    expect([goodsApproved.totalValue, goodsApproved.payableDeduction]).toEqual([4_000, 4_000])
    const pay = await payableOf(payable.id)
    // 20.000 − 5.000 (retur) − 3.000 (revisi) − 4.000 (retur harga baru) = sisa 8.000 = 2 BOX × 4.000.
    expect(pay.totalAmount - pay.paidAmount).toBe(8_000)
    // Omzet pengirim: revisi −3.000, retur nota kedua memotong 5.000 padahal seharusnya 4.000 → +1.000.
    expect(await plOf(sender)).toMatchObject({ revenueCorrection: 2_000 })
    // Penjualan per Produk: 4 BOX × 5.000 − 2 retur nota × 5.000 − koreksi 2.000 = 8.000 = 2 BOX × 4.000.
    const [sold] = (await getSalesByProductReport({ startDate: today(), endDate: today(), branchId: sender, productIds: [p] })).items
    expect(sold).toMatchObject({ qtyBase: 10, revenue: '8000', returnRevenue: '10000', priceRevisionRevenue: '2000' })

    await expect(cancelPriceRevision({ id: revision.id, userId, reason: 'tes' })).rejects.toThrow(/sudah dikembalikan dengan harga hasil revisi/)
  })

  it('7. tolak & tarik tidak mengubah apa pun; pengaju cabang lain ditolak; kiriman diputihkan ditolak', async () => {
    const sender = await newBranch('S8')
    const toko = await newBranch('T8')
    const p = await product('Tolak', sender, 100)
    const { ibt, itemId, payable } = await receivedIbt(p, 4, sender, toko)

    await expect(revise(ibt.id, itemId, 4000, { userId: otherUserId, branchId: gudang, allBranches: false })).rejects.toThrow(/bukan dari \/ ke cabang Anda/)

    const toReject = await revise(ibt.id, itemId, 4000, { userId: otherUserId, branchId: toko, allBranches: false })
    expect(toReject.requestBranchId).toBe(toko)
    expect((await rejectInternalReturn({ id: toReject.id, userId, rejectionReason: 'tes: harga sudah benar' })).status).toBe('REJECTED')
    const toWithdraw = await revise(ibt.id, itemId, 4500, { userId: otherUserId, branchId: toko, allBranches: false })
    await expect(withdrawInternalReturn({ id: toWithdraw.id, userId })).rejects.toThrow(/Hanya pengaju/)
    expect((await withdrawInternalReturn({ id: toWithdraw.id, userId: otherUserId })).status).toBe('WITHDRAWN')
    await expect(approvePriceRevision({ id: toReject.id, userId })).rejects.toThrow(/sudah diproses/)

    expect((await batchesOf(p, toko)).map(b => [b.qtyRemaining, b.costPrice])).toEqual([[20, 1000]])
    expect((await payableOf(payable.id)).paidAmount).toBe(0)
    expect(await plOf(sender)).toMatchObject({ revenueCorrection: 0 })

    // Dokumen Barang Dikembalikan tidak bisa diproses lewat jalur revisi, dan sebaliknya.
    const goods = await returnGoods(ibt.id, itemId, 1)
    await expect(approvePriceRevision({ id: goods.id, userId })).rejects.toThrow(/bukan Revisi Harga Beli/)
    const pending = await revise(ibt.id, itemId, 4000)
    await expect(approveReturnedGoods({ id: pending.id, userId })).rejects.toThrow(/bukan Barang Dikembalikan/)

    await db.update(interBranchPayables).set({ status: 'WAIVED' }).where(eq(interBranchPayables.id, payable.id))
    await expect(approvePriceRevision({ id: pending.id, userId })).rejects.toThrow(/diputihkan/)
  })
})
