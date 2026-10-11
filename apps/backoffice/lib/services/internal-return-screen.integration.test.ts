import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import {
  db, branches, unitsOfMeasure, products, productUomConversions, productStockBatches, roles, users, shifts, paymentMethods,
  interBranchTransfers, interBranchTransferItems, interBranchPayables, eq, and,
} from '../db'
import { StockService } from './stock-service'
import { TransactionService } from './transaction-service'

// Sesi yang sedang "login" — diganti per langkah tes (Owner lintas cabang / kasir cabang).
let session: { userId: number; branchId: number; branchName: string; branchScope?: string; permissions: string[] }

// Owner (lintas cabang) punya semua izin; kasir tidak punya izin apa pun.
vi.mock('@/lib/authz', () => ({
  getAuth: async () => session,
  hasPermission: (payload: { permissions: string[] }) => payload.permissions.includes('*'),
  requirePermission: async () =>
    session.permissions.includes('*') ? session : NextResponse.json({ error: 'Akses ditolak untuk aksi ini' }, { status: 403 }),
}))

import { PATCH as transferStatus } from '../../app/api/bo/internal-transfers/[id]/status/route'
import { GET as listRoute, POST as createRoute } from '../../app/api/bo/internal-returns/route'
import { GET as lookupRoute } from '../../app/api/bo/internal-returns/lookup/route'
import { POST as approveRoute } from '../../app/api/bo/internal-returns/[id]/approve/route'
import { POST as rejectRoute } from '../../app/api/bo/internal-returns/[id]/reject/route'
import { POST as cancelRoute } from '../../app/api/bo/internal-returns/[id]/cancel/route'
import { POST as withdrawRoute } from '../../app/api/bo/internal-returns/[id]/withdraw/route'
import { getInternalReturn, internalReturnInvolvesBranch, listInternalReturns } from './internal-return-queries'
import { estimateInternalReturnSplit } from '../../components/internal-returns/types'

// RI6 — rute API & data layar Retur Internal "Barang Dikembalikan" ke DB lokal (salinan produksi).
// Satuan: PCS (dasar), BOX = 5 PCS. Harga nota 5.000/BOX.
const run = randomUUID().slice(0, 8)
let gudang: number
let toko: number
let tokoLain: number
let ownerId: number
let kasirId: number
let pcs: number
let box: number
let debtMethodId: number
const shiftByBranch = new Map<number, number>()

const asOwner = () => { session = { userId: ownerId, branchId: gudang, branchName: 'Gudang', branchScope: 'ALL', permissions: ['*'] } }
const asKasir = (branchId = toko) => { session = { userId: kasirId, branchId, branchName: 'Toko', permissions: [] } }

const json = (body: unknown) =>
  new NextRequest('http://localhost/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const idParams = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })

async function product(name: string, stock: number) {
  const [p] = await db.insert(products).values({ name: `${name} ${run}`, baseUomId: pcs, defaultCostPrice: 1000 }).returning()
  await db.insert(productUomConversions).values({ productId: p.id, uomId: box, ratio: 5 })
  await db.transaction((tx) => StockService.addStock(tx, gudang, p.id, pcs, String(stock), '1000'))
  return p.id
}

async function stockPcs(productId: number, branch: number) {
  const rows = await db.select().from(productStockBatches)
    .where(and(eq(productStockBatches.productId, productId), eq(productStockBatches.branchId, branch)))
  return rows.reduce((sum, row) => sum + Number(row.qtyRemaining), 0)
}

async function shiftOf(branch: number) {
  if (!shiftByBranch.has(branch)) {
    const [s] = await db.insert(shifts).values({ branchId: branch, openedById: ownerId, shiftNumber: 1, assignedCashiers: [ownerId], openingCash: 0 }).returning()
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

/** Kiriman lengkap Gudang → Toko: PO Internal qty BOX → Bulk Sale 5.000/BOX → kirim → terima penuh. */
async function receivedIbt(productId: number, qtyBox: number) {
  asOwner()
  const [ibt] = await db.insert(interBranchTransfers).values({
    ibtNumber: `IBT-RI6-${randomUUID().slice(0, 12)}`, sourceBranchId: gudang, destinationBranchId: toko, requestedById: ownerId, status: 'PENDING_APPROVAL',
  }).returning()
  await db.insert(interBranchTransferItems).values({ transferId: ibt.id, productId, uomId: box, qtyRequested: qtyBox, costPriceAtTransfer: 1 })
  const total = qtyBox * 5000
  const trx = await TransactionService.createTransaction({
    branchId: gudang, cashierId: ownerId, shiftId: await shiftOf(gudang), localTrxNumber: `RI6-${randomUUID()}`, saleType: 'BULK', sourceIbtId: ibt.id,
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

const lookup = (code: string) => lookupRoute(new NextRequest(`http://localhost/api/bo/internal-returns/lookup?code=${encodeURIComponent(code)}`))
const create = (transferId: number, transferItemId: number, qty: number, notes = 'tes: 1 box tidak datang') =>
  createRoute(json({ transferId, reason: 'TIDAK_DATANG', notes, items: [{ transferItemId, qty }] }))

beforeAll(async () => {
  gudang = (await db.insert(branches).values({ code: `G6${run}`, name: `Gudang RI6 ${run}` }).returning())[0].id
  toko = (await db.insert(branches).values({ code: `T6${run}`, name: `Toko RI6 ${run}` }).returning())[0].id
  tokoLain = (await db.insert(branches).values({ code: `L6${run}`, name: `Toko Lain RI6 ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `RI6${run}` }).returning())[0].id
  ownerId = (await db.insert(users).values({ name: `Owner RI6 ${run}`, roleId, branchId: gudang }).returning())[0].id
  kasirId = (await db.insert(users).values({ name: `Kasir RI6 ${run}`, roleId, branchId: toko }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `P6${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  box = (await db.insert(unitsOfMeasure).values({ code: `B6${run}`, name: 'BOX tes' }).returning())[0].id
  debtMethodId = (await db.insert(paymentMethods).values({ name: `Hutang RI6 ${run}`, type: 'DEBT' }).returning())[0].id
})

describe('Retur Internal — layar Barang Dikembalikan (RI6, DB lokal)', () => {
  it('1. cari kode transaksi: kasir cabang penerima boleh, cabang lain ditolak, kode salah 404', async () => {
    const p = await product('Cari', 100)
    const { ibt, trx } = await receivedIbt(p, 4)

    asKasir()
    const found = await lookup(trx.trxNumber)
    expect(found.status).toBe(200)
    const body = await found.json()
    expect(body.transfer.ibtNumber).toBe(ibt.ibtNumber)
    expect([body.transfer.senderBranchId, body.transfer.receiverBranchId]).toEqual([gudang, toko])
    expect(body.payable.totalAmount).toBe(20_000)
    expect(body.items.map((i: { returnableQty: number; unitPrice: number }) => [i.returnableQty, i.unitPrice])).toEqual([[4, 5000]])

    asKasir(tokoLain)
    expect((await lookup(ibt.ibtNumber)).status).toBe(403)
    asKasir()
    expect((await lookup(`TIDAK-ADA-${run}`)).status).toBe(404)
    expect((await lookup('')).status).toBe(400)
  })

  it('2. ajukan dari layar → tampil di antrean penyetuju & riwayat cabang terlibat saja; validasi isian', async () => {
    const p = await product('Ajukan', 100)
    const { ibt, trx, itemId } = await receivedIbt(p, 4)

    asKasir()
    expect((await create(ibt.id, itemId, 1, 'x')).status).toBe(400) // penjelasan terlalu pendek
    expect((await create(ibt.id, itemId, 9)).status).toBe(400) // melebihi yang diterima
    expect((await createRoute(new NextRequest('http://localhost/api', { method: 'POST', body: 'x' }))).status).toBe(415)

    const res = await create(ibt.id, itemId, 1)
    expect(res.status).toBe(201)
    const header = await res.json()
    expect(header.returnNumber).toMatch(/^RI-\d{8}-\d{4}$/)
    expect([header.status, header.source, header.requestBranchId]).toEqual(['PENDING', 'BO', toko])

    const view = (await getInternalReturn(header.id))!
    expect([view.ibtNumber, view.saleTrxNumber]).toEqual([ibt.ibtNumber, trx.trxNumber])
    expect([view.receiverBranchName, view.senderBranchName]).toEqual([`Toko RI6 ${run}`, `Gudang RI6 ${run}`])
    expect([view.totalValue, view.payableRemaining]).toEqual([5_000, 20_000])
    expect(view.items.map(i => [i.qty, i.unitPrice, i.lineValue])).toEqual([[1, 5000, 5000]])
    expect(estimateInternalReturnSplit(view)).toEqual({ payableDeduction: 5_000, creditAmount: 0 })
    expect(estimateInternalReturnSplit({ totalValue: 5_000, payableRemaining: 2_000 })).toEqual({ payableDeduction: 2_000, creditAmount: 3_000 })
    expect(estimateInternalReturnSplit({ totalValue: 5_000, payableRemaining: null })).toEqual({ payableDeduction: 0, creditAmount: 5_000 })

    // Riwayat: cabang penerima & pengirim melihat, cabang lain tidak.
    const ids = async (branchId: number | null) => (await listInternalReturns({ branchId })).map(r => r.id)
    expect(await ids(toko)).toContain(header.id)
    expect(await ids(gudang)).toContain(header.id)
    expect(await ids(tokoLain)).not.toContain(header.id)
    expect([internalReturnInvolvesBranch(view, toko), internalReturnInvolvesBranch(view, tokoLain)]).toEqual([true, false])

    // Kasir (tanpa izin penyetuju) hanya melihat dokumen cabangnya; penyetuju melihat semua.
    asKasir(tokoLain)
    const mine = await (await listRoute(new NextRequest('http://localhost/api/bo/internal-returns?status=PENDING'))).json()
    expect(mine.data.map((r: { id: number }) => r.id)).not.toContain(header.id)
    asOwner()
    const queue = await (await listRoute(new NextRequest('http://localhost/api/bo/internal-returns?status=PENDING'))).json()
    expect(queue.data.map((r: { id: number }) => r.id)).toContain(header.id)
    expect((await listRoute(new NextRequest('http://localhost/api/bo/internal-returns?status=NGAWUR'))).status).toBe(400)
  })

  it('3. setujui & batalkan hanya penyetuju; tarik hanya pengaju; tolak wajib beralasan', async () => {
    const p = await product('Setujui', 100)
    const { ibt, itemId, payable } = await receivedIbt(p, 4)

    asKasir()
    const first = await (await create(ibt.id, itemId, 1)).json()
    expect((await approveRoute(json({}), idParams(first.id))).status).toBe(403)
    expect((await cancelRoute(json({ reason: 'tes: coba batal' }), idParams(first.id))).status).toBe(403)

    asOwner()
    expect((await withdrawRoute(json({}), idParams(first.id))).status).toBe(403) // bukan pengaju
    const approved = await approveRoute(json({}), idParams(first.id))
    expect(approved.status).toBe(200)
    expect((await approved.json()).data.payableDeduction).toBe(5_000)
    expect(await stockPcs(p, toko)).toBe(15)
    expect(await stockPcs(p, gudang)).toBe(85)
    const afterApprove = (await getInternalReturn(first.id))!
    expect([afterApprove.status, afterApprove.payableDeduction, afterApprove.creditAmount, afterApprove.payableRemaining]).toEqual(['APPROVED', 5_000, 0, 15_000])
    expect(afterApprove.resolvedByName).toBe(`Owner RI6 ${run}`)
    expect((await approveRoute(json({}), idParams(first.id))).status).toBe(409)

    expect((await cancelRoute(json({ reason: 'x' }), idParams(first.id))).status).toBe(400)
    expect((await cancelRoute(json({ reason: 'tes: ternyata barangnya ada' }), idParams(first.id))).status).toBe(200)
    const afterCancel = (await getInternalReturn(first.id))!
    expect([afterCancel.status, afterCancel.cancellationReason, afterCancel.payableRemaining]).toEqual(['CANCELLED', 'tes: ternyata barangnya ada', 20_000])
    expect(await stockPcs(p, toko)).toBe(20)
    expect((await db.select().from(interBranchPayables).where(eq(interBranchPayables.id, payable.id)))[0].paidAmount).toBe(0)

    // Tolak & tarik: tidak ada yang berubah.
    asKasir()
    const second = await (await create(ibt.id, itemId, 2)).json()
    const third = await (await create(ibt.id, itemId, 1)).json()
    expect((await withdrawRoute(json({}), idParams(third.id))).status).toBe(200)
    asOwner()
    expect((await rejectRoute(json({ rejectionReason: '' }), idParams(second.id))).status).toBe(400)
    expect((await rejectRoute(json({ rejectionReason: 'tes: bukti kurang' }), idParams(second.id))).status).toBe(200)
    const statuses = (await listInternalReturns({ branchId: null, ids: [second.id, third.id] })).map(r => [r.id, r.status, r.rejectionReason])
    expect(statuses).toEqual(expect.arrayContaining([[second.id, 'REJECTED', 'tes: bukti kurang'], [third.id, 'WITHDRAWN', null]]))
    expect(await stockPcs(p, toko)).toBe(20)
    expect((await approveRoute(json({}), idParams(999_999_999))).status).toBe(404)
    expect((await approveRoute(json({}), idParams(Number.NaN))).status).toBe(400)
  })
})
