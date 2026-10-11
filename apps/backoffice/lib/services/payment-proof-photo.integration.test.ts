import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  db, branches, roles, users, suppliers, customers, paymentMethods, purchaseOrders,
  supplierPayables, supplierPayablePayments, customerDebts, debtPayments, eq,
} from '../db'

vi.mock('@/lib/authz', () => ({
  requirePermission: async () => ({ userId, branchId, branchScope: 'ALL' }),
  getAuth: async () => ({ userId, branchId, branchScope: 'ALL' }),
  hasPermission: () => true,
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'token' }) }) }))
vi.mock('@/lib/auth', () => ({ verifyAccessToken: async () => ({ userId, branchId, role: 'OWNER', branchScope: 'ALL', permissions: [] }) }))

import { POST as supplierPayRoute } from '../../app/api/bo/supplier-payables/[id]/pay/route'
import { POST as debtPayRoute } from '../../app/api/bo/customers/[id]/debts/[debtId]/pay/route'
import { POST as debtBulkRoute } from '../../app/api/bo/customers/[id]/debts/pay-bulk/route'

// Foto bukti transfer opsional (keputusan owner 2026-10-11): tersimpan untuk pembayaran non-tunai,
// diabaikan untuk tunai, dan pembayaran tanpa foto tetap berjalan seperti biasa.
const run = randomUUID().slice(0, 8)
const PHOTO = `/uploads/${randomUUID()}.jpg`
let branchId: number
let userId: number
let supplierId: number
let customerId: number
let transferMethodId: number
let cashMethodId: number

const json = (body: unknown) =>
  new NextRequest('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

async function payable(total: number) {
  const [po] = await db.insert(purchaseOrders).values({
    poNumber: `PO-FB-${run}-${randomUUID().slice(0, 4)}`, branchId, supplierId, status: 'RECEIVED', totalAmount: total, createdById: userId,
  }).returning()
  const [row] = await db.insert(supplierPayables).values({ poId: po.id, supplierId, totalAmount: total }).returning()
  return row.id
}
async function debt(total: number) {
  const [row] = await db.insert(customerDebts).values({ customerId, branchId, totalAmount: total, remainingAmount: total, createdBy: userId }).returning()
  return row.id
}

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `FB${run}`, name: `Toko Foto Bukti ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `FB${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `FB${run}`, roleId, branchId }).returning())[0].id
  supplierId = (await db.insert(suppliers).values({ name: `Supplier Foto ${run}` }).returning())[0].id
  customerId = (await db.insert(customers).values({ name: `Pelanggan Foto ${run}` }).returning())[0].id
  transferMethodId = (await db.insert(paymentMethods).values({ name: `Transfer FB ${run}`, type: 'BANK_TRANSFER' }).returning())[0].id
  cashMethodId = (await db.insert(paymentMethods).values({ name: `Tunai FB ${run}`, type: 'CASH' }).returning())[0].id
})

describe('Foto bukti transfer di pembayaran manual (DB lokal)', () => {
  it('bayar hutang supplier: foto tersimpan; tanpa foto tetap bisa; alamat foto asing ditolak', async () => {
    const id = await payable(30_000)
    const params = { params: Promise.resolve({ id: String(id) }) }

    expect((await supplierPayRoute(json({ amount: 10_000, method: 'TRANSFER', proofPhotoUrl: PHOTO }), params)).status).toBe(201)
    expect((await supplierPayRoute(json({ amount: 10_000, method: 'TRANSFER' }), params)).status).toBe(201)
    const bad = await supplierPayRoute(json({ amount: 10_000, method: 'TRANSFER', proofPhotoUrl: 'https://contoh.test/x.jpg' }), params)
    expect(bad.status).toBe(400)

    const rows = await db.select().from(supplierPayablePayments).where(eq(supplierPayablePayments.payableId, id)).orderBy(supplierPayablePayments.id)
    expect(rows.map(r => [r.amount, r.proofPhotoUrl])).toEqual([[10_000, PHOTO], [10_000, null]])
    const [after] = await db.select().from(supplierPayables).where(eq(supplierPayables.id, id))
    expect([after.paidAmount, after.status]).toEqual([20_000, 'PARTIAL'])
  })

  it('pelunasan piutang pelanggan: foto tersimpan untuk transfer, diabaikan untuk tunai', async () => {
    const id = await debt(30_000)
    const params = { params: Promise.resolve({ id: String(customerId), debtId: String(id) }) }

    expect((await debtPayRoute(json({ amount: 10_000, paymentMethodId: transferMethodId, proofPhotoUrl: PHOTO }), params)).status).toBe(201)
    expect((await debtPayRoute(json({ amount: 5_000, paymentMethodId: transferMethodId }), params)).status).toBe(201)
    expect((await debtPayRoute(json({ amount: 5_000, paymentMethodId: cashMethodId, proofPhotoUrl: PHOTO }), params)).status).toBe(201)
    expect((await debtPayRoute(json({ amount: 1_000, paymentMethodId: transferMethodId, proofPhotoUrl: '../rahasia' }), params)).status).toBe(400)

    const rows = await db.select().from(debtPayments).where(eq(debtPayments.debtId, id)).orderBy(debtPayments.id)
    expect(rows.map(r => [r.amount, r.proofPhotoUrl])).toEqual([[10_000, PHOTO], [5_000, null], [5_000, null]])
    const [after] = await db.select().from(customerDebts).where(eq(customerDebts.id, id))
    expect([after.remainingAmount, after.status]).toEqual([10_000, 'PARTIAL'])
  })

  it('lunasi sekaligus: satu foto menempel ke semua baris pelunasan yang terbentuk', async () => {
    const [pelanggan] = await db.insert(customers).values({ name: `Pelanggan Sekaligus ${run}` }).returning()
    const ids: number[] = []
    for (const total of [4_000, 6_000]) {
      const [row] = await db.insert(customerDebts).values({ customerId: pelanggan.id, branchId, totalAmount: total, remainingAmount: total, createdBy: userId }).returning()
      ids.push(row.id)
    }
    const res = await debtBulkRoute(
      json({ amount: 10_000, paymentMethodId: transferMethodId, proofPhotoUrl: PHOTO }),
      { params: Promise.resolve({ id: String(pelanggan.id) }) },
    )
    expect(res.status).toBe(201)
    for (const id of ids) {
      const rows = await db.select().from(debtPayments).where(eq(debtPayments.debtId, id))
      expect(rows.map(r => r.proofPhotoUrl)).toEqual([PHOTO])
    }
  })
})
