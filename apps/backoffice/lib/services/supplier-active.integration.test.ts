import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  db, branches, unitsOfMeasure, products, suppliers, roles, users, purchaseOrders, auditLogs, eq, and,
} from '../db'

vi.mock('@/lib/authz', () => ({
  requirePermission: async () => ({ userId, branchId, branchScope: 'ALL' }),
  getAuth: async () => ({ userId, branchId, branchScope: 'ALL' }),
  hasPermission: () => true,
}))

import { POST as createPoRoute } from '../../app/api/bo/purchase-orders/route'
import { PUT as updateSupplierRoute, DELETE as deleteSupplierRoute } from '../../app/api/bo/master-data/suppliers/[id]/route'
import { createSupplierReturnRequest } from './supplier-return-service'
import { listSupplierOptions } from './supplier-return-queries'

// RI1 — supplier aktif/nonaktif (docs/work/backlog/2026-10-11-retur-internal.md) di DB lokal.
const run = randomUUID().slice(0, 8)
let branchId: number
let userId: number
let pcs: number
let productId: number
let activeId: number
let inactiveId: number

const json = (body: unknown, method = 'POST') =>
  new Request('http://localhost', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const params = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
const poBody = (supplierId: number) => ({
  branchId, supplierId, items: [{ productId, uomId: pcs, qtyOrdered: 1, unitCost: 1_000 }],
})

beforeAll(async () => {
  branchId = (await db.insert(branches).values({ code: `SA${run}`, name: `Cabang Supplier ${run}` }).returning())[0].id
  const roleId = (await db.insert(roles).values({ name: `SA${run}` }).returning())[0].id
  userId = (await db.insert(users).values({ name: `SA${run}`, roleId, branchId }).returning())[0].id
  pcs = (await db.insert(unitsOfMeasure).values({ code: `A${run}`, name: 'PCS tes', isBase: true }).returning())[0].id
  productId = (await db.insert(products).values({ name: `Produk SA ${run}`, baseUomId: pcs, defaultCostPrice: 1_000 }).returning())[0].id
  activeId = (await db.insert(suppliers).values({ name: `Aktif ${run}` }).returning())[0].id
  inactiveId = (await db.insert(suppliers).values({ name: `Nonaktif ${run}`, isActive: false }).returning())[0].id
})

describe('Supplier aktif/nonaktif (DB lokal)', () => {
  it('1. supplier baru aktif secara bawaan', async () => {
    const [row] = await db.select({ isActive: suppliers.isActive }).from(suppliers).where(eq(suppliers.id, activeId))
    expect(row.isActive).toBe(true)
  })

  it('2. supplier nonaktif tidak muncul di pilihan Retur Supplier Luar dan pengajuannya ditolak', async () => {
    const ids = (await listSupplierOptions()).map(s => s.id)
    expect(ids).toContain(activeId)
    expect(ids).not.toContain(inactiveId)
    await expect(createSupplierReturnRequest({
      input: { supplierId: inactiveId, poId: null, reason: 'EXPIRED', notes: 'tes supplier nonaktif', items: [{ productId, uomId: pcs, qty: 1 }] },
      branchId, userId, source: 'BO',
    })).rejects.toThrow(/nonaktif/)
  })

  it('3. PO baru dengan supplier nonaktif ditolak; dengan supplier aktif berhasil', async () => {
    const denied = await createPoRoute(json(poBody(inactiveId)))
    expect(denied.status).toBe(400)
    expect((await denied.json()).error).toMatch(/nonaktif/)
    const ok = await createPoRoute(json(poBody(activeId)))
    expect([200, 201]).toContain(ok.status)
    const pos = await db.select({ id: purchaseOrders.id }).from(purchaseOrders)
      .where(and(eq(purchaseOrders.supplierId, activeId), eq(purchaseOrders.branchId, branchId)))
    expect(pos).toHaveLength(1)
  })

  it('4. nonaktifkan lewat Master Data tercatat di audit; PO lama tetap utuh', async () => {
    const res = await updateSupplierRoute(json({ isActive: false }, 'PUT') as never, params(activeId))
    expect(res.status).toBe(200)
    expect((await res.json()).isActive).toBe(false)
    const [audit] = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.tableName, 'suppliers'), eq(auditLogs.recordId, String(activeId)), eq(auditLogs.action, 'SUPPLIER_DEACTIVATE')))
    expect(audit).toBeDefined()
    const pos = await db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(eq(purchaseOrders.supplierId, activeId))
    expect(pos).toHaveLength(1)

    // Mengirim status yang sama tidak membuat catatan audit ganda.
    await updateSupplierRoute(json({ isActive: false }, 'PUT') as never, params(activeId))
    const audits = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.tableName, 'suppliers'), eq(auditLogs.recordId, String(activeId))))
    expect(audits).toHaveLength(1)

    const back = await updateSupplierRoute(json({ isActive: true }, 'PUT') as never, params(activeId))
    expect((await back.json()).isActive).toBe(true)
  })

  it('5. supplier tidak bisa dihapus (RI1b) — tetap ada di database', async () => {
    const res = await deleteSupplierRoute()
    expect(res.status).toBe(405)
    expect((await res.json()).error).toMatch(/Nonaktifkan/)
    const [row] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, inactiveId))
    expect(row).toBeDefined()
  })
})
