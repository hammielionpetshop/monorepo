import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  db, branches, unitsOfMeasure, products, productUomConversions, productStockBatches, roles, users, shifts, paymentMethods,
  interBranchTransfers, interBranchTransferItems, interBranchPayables, interBranchPayments, internalReturns, internalReturnItems,
  internalCreditEntries, returns, auditLogs, eq, and, sql,
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
  findReturnableTransfer,
  listReturnableTransfers,
  internalCreditBalance,
  rejectInternalReturn,
  withdrawInternalReturn,
  type InternalReturnActor,
} from './internal-return-service'

// RI5 — Retur Internal "Barang Dikembalikan" ke DB lokal (salinan produksi), alur asli:
// PO Internal → Bulk Sale pengirim → kirim → terima → ajukan → setujui / tolak / tarik / batalkan.
// Satuan: PCS (dasar), BOX = 5 PCS. Harga nota 5.000/BOX, modal Gudang 1.000/PCS.
const run = randomUUID().slice(0, 8)
let gudang: number
let toko: number
let tokoLain: number
let userId: number
let otherUserId: number
let pcs: number
let box: number
let debtMethodId: number
const shiftByBranch = new Map<number, number>()

const owner = (): InternalReturnActor => ({ userId, branchId: gudang, allBranches: true })

async function product(name: string, branch: number, stockPcs: number) {
  const [p] = await db.insert(products).values({ name: `${name} ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning()
  await db.insert(productUomConversions).values({ productId: p.id, uomId: box, ratio: 5 })
  await db.transaction((tx) => StockService.addStock(tx, branch, p.id, pcs, String(stockPcs), '1000'))
  return p.id
}

async function stockPcs(productId: number, branch: number) {
  const rows = await db.select().from(productStockBatches)
    .where(and(eq(productStockBatches.productId, productId), eq(productStockBatches.branchId, branch)))
  return rows.reduce((sum, row) => sum + Number(row.qtyRemaining), 0)
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
async function receivedIbt(productId: number, qtyBox: number, source = gudang, destination = toko) {
  const [ibt] = await db.insert(interBranchTransfers).values({
    ibtNumber: `IBT-RI5-${randomUUID().slice(0, 12)}`, sourceBranchId: source, destinationBranchId: destination, requestedById: userId, status: 'PENDING_APPROVAL',
  }).returning()
  await db.insert(interBranchTransferItems).values({ transferId: ibt.id, productId, uomId: box, qtyRequested: qtyBox, costPriceAtTransfer: 1 })
  const total = qtyBox * 5000
  const trx = await TransactionService.createTransaction({
    branchId: source, cashierId: userId, shiftId: await shiftOf(source), localTrxNumber: `RI5-${randomUUID()}`, saleType: 'BULK', sourceIbtId: ibt.id,
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

const request = (transferId: number, transferItemId: number, qty: number, actor = owner()) =>
  createReturnedGoodsRequest({
    input: { transferId, reason: 'TIDAK_DATANG', notes: 'tes: barang tidak datang', items: [{ transferItemId, qty }] },
    actor, source: 'BO',
  })
const payableOf = async (id: number) => (await db.select().from(interBranchPayables).where(eq(interBranchPayables.id, id)))[0]
const ledgerRows = async (productId: number, returnNumber: string) =>
  db.execute<{ movement_type: string; qty_change: number; branch_id: number; cogs: number }>(
    sql`WITH sm AS (${stockLedgerUnion}) SELECT movement_type, qty_change, branch_id, cogs FROM sm
        WHERE product_id = ${productId} AND reference_number = ${returnNumber} ORDER BY movement_type`,
  )

beforeAll(async () => {
  gudang = (await db.insert(branches).values({ code: `G5${run}`, name: `Gudang RI5 ${run}` }).returning())[0].id
  toko = (await db.insert(branches).values({ code: `T5${run}`, name: `Toko RI5 ${run}` }).returning())[0].id
  tokoLain = (await db.insert(branches).values({ code: `L5${run}`, name: `Toko Lain RI5 ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `RI5${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `RI5${run}`, roleId, branchId: gudang }).returning())[0].id
  otherUserId = (await db.insert(users).values({ name: `RI5b${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `P5${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  box = (await db.insert(unitsOfMeasure).values({ code: `B5${run}`, name: 'BOX tes' }).returning())[0].id
  debtMethodId = (await db.insert(paymentMethods).values({ name: `Hutang RI5 ${run}`, type: 'DEBT' }).returning())[0].id
})

describe('Retur Internal — Barang Dikembalikan (RI5, DB lokal)', () => {
  it('1. ajukan: stok & hutang belum berubah; qty melebihi sisa ditolak; cari lewat nomor nota', async () => {
    const p = await product('Ajukan', gudang, 100)
    const { ibt, trx, itemId, payable } = await receivedIbt(p, 4)
    expect(payable.totalAmount).toBe(20_000)

    const found = await findReturnableTransfer(trx.trxNumber.toLowerCase(), owner())
    expect(found.transfer.id).toBe(ibt.id)
    expect(found.items.map(i => [i.qtyReceived, i.returnableQty, i.unitPrice])).toEqual([[4, 4, 5000]])

    const header = await request(ibt.id, itemId, 1)
    expect(header.status).toBe('PENDING')
    expect(header.totalValue).toBe(5_000)
    expect([header.receiverBranchId, header.senderBranchId]).toEqual([toko, gudang])
    expect(await stockPcs(p, toko)).toBe(20)
    expect((await payableOf(payable.id)).paidAmount).toBe(0)

    // 1 BOX sedang diajukan → sisa 3.
    await expect(request(ibt.id, itemId, 4)).rejects.toThrow(/maks 3/)
    expect((await findReturnableTransfer(ibt.ibtNumber, owner())).items[0].returnableQty).toBe(3)
  })

  it('2. setujui (hutang belum lunas): stok penerima keluar, stok pengirim masuk modal nota, nota diretur, hutang dipotong; lalu batalkan membalik semuanya', async () => {
    const p = await product('Setujui', gudang, 100)
    const { ibt, trx, itemId, payable } = await receivedIbt(p, 4)
    expect(await stockPcs(p, gudang)).toBe(80)
    expect(await stockPcs(p, toko)).toBe(20)

    const header = await request(ibt.id, itemId, 1)
    const approved = await approveReturnedGoods({ id: header.id, userId })
    expect(approved.status).toBe('APPROVED')
    expect([approved.totalValue, approved.payableDeduction, approved.creditAmount]).toEqual([5_000, 5_000, 0])
    expect(await stockPcs(p, toko)).toBe(15)
    expect(await stockPcs(p, gudang)).toBe(85)

    const [item] = await db.select().from(internalReturnItems).where(eq(internalReturnItems.internalReturnId, header.id))
    expect(item.cogs).toBe(5_000) // batch toko bermodal harga nota 5.000/BOX
    expect(item.saleItemId).not.toBeNull()

    const [saleReturn] = await db.select().from(returns).where(eq(returns.id, approved.saleReturnId!))
    expect(saleReturn.transactionId).toBe(trx.id)
    expect(saleReturn.branchId).toBe(gudang)
    expect(saleReturn.totalRefundAmount).toBe(5_000)

    const pay = await payableOf(payable.id)
    expect([pay.paidAmount, pay.status]).toEqual([5_000, 'PARTIAL'])
    const [payment] = await db.select().from(interBranchPayments).where(eq(interBranchPayments.id, approved.payablePaymentId!))
    expect([payment.amount, payment.sourceType, payment.paymentMethodId, payment.referenceNumber]).toEqual([5_000, 'RETUR_INTERNAL', null, header.returnNumber])

    await expect(approveReturnedGoods({ id: header.id, userId })).rejects.toThrow(/sudah diproses/)

    // Batalkan: semua dibalik sebagai catatan baru.
    const cancelled = await cancelReturnedGoods({ id: header.id, userId, reason: 'tes: ternyata barangnya ada' })
    expect(cancelled.status).toBe('CANCELLED')
    expect(cancelled.cancellationReason).toBe('tes: ternyata barangnya ada')
    expect(await stockPcs(p, toko)).toBe(20)
    expect(await stockPcs(p, gudang)).toBe(80)
    const after = await payableOf(payable.id)
    expect([after.paidAmount, after.status]).toEqual([0, 'UNPAID'])
    const payments = await db.select().from(interBranchPayments).where(eq(interBranchPayments.payableId, payable.id))
    expect(payments.map(r => [r.sourceType, r.amount]).sort()).toEqual([['BATAL_RETUR', -5_000], ['RETUR_INTERNAL', 5_000]])
    const [saleReturnAfter] = await db.select().from(returns).where(eq(returns.id, approved.saleReturnId!))
    expect(saleReturnAfter.cancelledAt).not.toBeNull()

    const ledger = await ledgerRows(p, header.returnNumber)
    expect(ledger.map(r => [r.movement_type, Number(r.qty_change), Number(r.branch_id)])).toEqual([
      ['INTERNAL_RETURN_CANCEL_IN', 1, toko],
      ['INTERNAL_RETURN_CANCEL_OUT', -1, gudang],
      ['INTERNAL_RETURN_IN', 1, gudang],
      ['INTERNAL_RETURN_OUT', -1, toko],
    ])
    // Retur nota ini tidak ikut tercatat dua kali sebagai RETURN_IN biasa.
    const plain = await db.execute(sql`WITH sm AS (${stockLedgerUnion}) SELECT 1 FROM sm WHERE movement_type = 'RETURN_IN' AND reference_number = ${saleReturn.returnNumber}`)
    expect(plain).toHaveLength(0)

    const actions = await db.select({ action: auditLogs.action }).from(auditLogs)
      .where(and(eq(auditLogs.tableName, 'internal_returns'), eq(auditLogs.recordId, String(header.id))))
    expect(actions.map(a => a.action).sort()).toEqual(['INTERNAL_RETURN_APPROVE', 'INTERNAL_RETURN_CANCEL', 'INTERNAL_RETURN_REQUEST'])

    await expect(cancelReturnedGoods({ id: header.id, userId, reason: 'dua kali' })).rejects.toThrow(/Disetujui/)
    // Setelah dibatalkan, qty-nya bisa diajukan lagi.
    expect((await findReturnableTransfer(ibt.ibtNumber, owner())).items[0].returnableQty).toBe(4)
  })

  it('3. hutang hampir lunas: sisa hutang dipotong, kelebihan jadi Saldo Internal; batal ditolak bila saldo sudah terpakai', async () => {
    const p = await product('Saldo', gudang, 100)
    const { ibt, itemId, payable } = await receivedIbt(p, 4)
    await db.update(interBranchPayables).set({ paidAmount: 18_000, status: 'PARTIAL' }).where(eq(interBranchPayables.id, payable.id))
    const balance0 = await internalCreditBalance(db, toko, gudang)

    const header = await request(ibt.id, itemId, 1)
    const approved = await approveReturnedGoods({ id: header.id, userId })
    expect([approved.payableDeduction, approved.creditAmount]).toEqual([2_000, 3_000])
    expect((await payableOf(payable.id)).status).toBe('PAID')
    expect(await internalCreditBalance(db, toko, gudang)).toBe(balance0)
    const [entry] = await db.select().from(internalCreditEntries).where(eq(internalCreditEntries.internalReturnId, header.id))
    expect([entry.sourceType, entry.amount, entry.debtorBranchId, entry.creditorBranchId]).toEqual(['RETUR_INTERNAL', 3_000, toko, gudang])

    // RI7: saldo 3.000 langsung memotong tagihan terbuka tertua toko → gudang (dari tes sebelumnya),
    // jadi sudah terpakai dan retur ini tidak bisa dibatalkan bersih. (Batal saldo utuh: tes RI7 #4.)
    const used = await db.select().from(internalCreditEntries)
      .where(and(eq(internalCreditEntries.internalReturnId, header.id), eq(internalCreditEntries.sourceType, 'PAKAI')))
    expect(used.reduce((sum, e) => sum + e.amount, 0)).toBe(-3_000)
    await expect(cancelReturnedGoods({ id: header.id, userId, reason: 'tes batal' })).rejects.toThrow(/sudah terpakai/)
    expect((await db.select().from(internalReturns).where(eq(internalReturns.id, header.id)))[0].status).toBe('APPROVED')
    expect(await stockPcs(p, toko)).toBe(15)
    expect((await payableOf(payable.id)).paidAmount).toBe(20_000)
  })

  it('4. tolak & tarik: tidak ada yang berubah; hanya pengaju yang boleh menarik', async () => {
    const p = await product('Tolak', gudang, 100)
    const { ibt, itemId, payable } = await receivedIbt(p, 2)

    const rejected = await request(ibt.id, itemId, 1)
    const r = await rejectInternalReturn({ id: rejected.id, userId, rejectionReason: 'tes: barangnya ada' })
    expect([r.status, r.rejectionReason]).toEqual(['REJECTED', 'tes: barangnya ada'])
    await expect(approveReturnedGoods({ id: rejected.id, userId })).rejects.toThrow(/sudah diproses/)

    const pending = await request(ibt.id, itemId, 2, { userId: otherUserId, branchId: toko, allBranches: false })
    await expect(withdrawInternalReturn({ id: pending.id, userId })).rejects.toThrow(/Hanya pengaju/)
    const w = await withdrawInternalReturn({ id: pending.id, userId: otherUserId })
    expect(w.status).toBe('WITHDRAWN')
    await expect(cancelReturnedGoods({ id: pending.id, userId, reason: 'x' })).rejects.toThrow(/Disetujui/)

    expect(await stockPcs(p, toko)).toBe(10)
    expect((await payableOf(payable.id)).paidAmount).toBe(0)
    expect((await findReturnableTransfer(ibt.ibtNumber, owner())).items[0].returnableQty).toBe(2)
  })

  it('5. stok penerima sudah tidak ada → persetujuan ditolak; stok pengirim habis → pembatalan ditolak', async () => {
    const p = await product('Stok habis', gudang, 20)
    const { ibt, itemId } = await receivedIbt(p, 2) // gudang sisa 10 PCS, toko 10 PCS

    const header = await request(ibt.id, itemId, 1)
    await db.transaction((tx) => StockService.deductStock(tx, toko, p, pcs, 8, false)) // terjual, sisa 2 PCS
    await expect(approveReturnedGoods({ id: header.id, userId })).rejects.toThrow(/cabang penerima tidak cukup/)
    expect((await db.select().from(internalReturns).where(eq(internalReturns.id, header.id)))[0].status).toBe('PENDING')
    expect(await stockPcs(p, gudang)).toBe(10)

    await db.transaction((tx) => StockService.addStock(tx, toko, p, pcs, '8', '1000'))
    await approveReturnedGoods({ id: header.id, userId })
    expect(await stockPcs(p, gudang)).toBe(15)
    await db.transaction((tx) => StockService.deductStock(tx, gudang, p, pcs, 15, false)) // gudang habis terjual
    await expect(cancelReturnedGoods({ id: header.id, userId, reason: 'tes batal' })).rejects.toThrow(/cabang pengirim sudah tidak cukup/)
    expect((await db.select().from(internalReturns).where(eq(internalReturns.id, header.id)))[0].status).toBe('APPROVED')
  })

  it('6. kiriman toko → toko: barang kembali ke toko pengirim; cabang lain tidak boleh mengajukan', async () => {
    const p = await product('Toko ke toko', tokoLain, 50)
    const { ibt, itemId, payable } = await receivedIbt(p, 3, tokoLain, toko)
    expect(payable.creditorBranchId).toBe(tokoLain)

    const outsider: InternalReturnActor = { userId: otherUserId, branchId: gudang, allBranches: false }
    await expect(findReturnableTransfer(ibt.ibtNumber, outsider)).rejects.toThrow(/bukan dari \/ ke cabang Anda/)
    await expect(request(ibt.id, itemId, 1, outsider)).rejects.toThrow(/bukan dari \/ ke cabang Anda/)

    const header = await request(ibt.id, itemId, 1, { userId: otherUserId, branchId: toko, allBranches: false })
    expect(header.requestBranchId).toBe(toko)
    const approved = await approveReturnedGoods({ id: header.id, userId })
    expect([approved.senderBranchId, approved.payableDeduction]).toEqual([tokoLain, 5_000])
    expect(await stockPcs(p, tokoLain)).toBe(40)
    expect(await stockPcs(p, toko)).toBe(10)
  })

  it('7. daftar pilih kiriman: terbaru di atas, hanya kiriman cabang sendiri, hutang yang diputihkan tidak ikut', async () => {
    const p = await product('Daftar', gudang, 100)
    const lama = await receivedIbt(p, 1)
    const baru = await receivedIbt(p, 1)
    const kasirToko: InternalReturnActor = { userId: otherUserId, branchId: toko, allBranches: false }

    const list = await listReturnableTransfers(kasirToko, 500)
    const ids = list.map(r => r.transferId)
    expect(ids).toContain(lama.ibt.id)
    expect(ids.indexOf(baru.ibt.id)).toBeLessThan(ids.indexOf(lama.ibt.id))
    const row = list.find(r => r.transferId === baru.ibt.id)!
    expect([row.ibtNumber, row.trxNumber, row.total]).toEqual([baru.ibt.ibtNumber, baru.trx.trxNumber, 5_000])
    expect(row.receivedAt).not.toBeNull()

    // Cabang yang tidak terlibat tidak melihatnya; akun lintas cabang melihatnya.
    const cabangLain = await listReturnableTransfers({ userId: otherUserId, branchId: tokoLain, allBranches: false }, 500)
    expect(cabangLain.some(r => r.transferId === baru.ibt.id)).toBe(false)
    expect((await listReturnableTransfers(owner(), 500)).some(r => r.transferId === baru.ibt.id)).toBe(true)

    await db.update(interBranchPayables).set({ status: 'WAIVED' }).where(eq(interBranchPayables.id, lama.payable.id))
    expect((await listReturnableTransfers(kasirToko, 500)).some(r => r.transferId === lama.ibt.id)).toBe(false)
  })
})
