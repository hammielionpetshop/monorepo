import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const { tables, requirePermission, db } = vi.hoisted(() => ({
  tables: {
    purchaseOrders: {},
    purchaseOrderItems: {},
    supplierPayables: {},
    productStocks: {},
    stockShortfallClearings: {},
    auditLogs: {},
    users: {},
    ownerAssignments: {},
  },
  requirePermission: vi.fn(),
  db: { select: vi.fn(), transaction: vi.fn() },
}))

vi.mock('@/lib/authz', () => ({ requirePermission }))
vi.mock('argon2', () => ({ verify: vi.fn(async () => true) }))
vi.mock('@/lib/services/stock-service', () => ({
  StockService: { deductStock: vi.fn().mockResolvedValue({ totalCogs: 0 }) },
}))
vi.mock('@/lib/db', () => ({
  db,
  ...tables,
  eq: vi.fn((left, right) => ({ op: 'eq', left, right })),
  and: vi.fn((...conditions) => ({ op: 'and', conditions })),
  inArray: vi.fn((left, values) => ({ op: 'inArray', left, values })),
  isNull: vi.fn((left) => ({ op: 'isNull', left })),
}))

// Chain generik: from/where/limit/for semua mengembalikan diri sendiri, resolve lewat
// `then` ke hasil yang sudah ditentukan — cocok untuk query select apa pun.
function chain(result: unknown[]) {
  const c: Record<string, unknown> = {
    from: () => c,
    where: () => c,
    limit: () => c,
    for: () => c,
    then: (resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return c
}

import { POST } from './route'

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeReq(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

// Urutan db.select (di luar transaction) di route ini: ownerAssignments, users (owner PIN),
// purchaseOrders, supplierPayables, purchaseOrderItems, lalu (baru) stockShortfallClearings.
function mockOuterSelects(overrides: { priorClearings?: unknown[] } = {}) {
  const sequence = [
    [{ userId: 9 }], // ownerAssignments
    [{ pinHash: 'hash' }], // users (owner)
    [{ id: 5, poNumber: 'PO-1', branchId: 2, status: 'COMPLETED' }], // purchaseOrders
    [], // supplierPayables — belum ada
    [{ productId: 7, uomId: 1, qtyReceived: 10, qtyDamaged: 0, unitCost: 1000, invoiceUnitCost: null }], // purchaseOrderItems
    overrides.priorClearings ?? [], // stockShortfallClearings
  ]
  let call = 0
  db.select.mockImplementation(() => {
    const result = sequence[call] ?? []
    call += 1
    return chain(result)
  })
}

describe('POST /api/bo/purchase-orders/[id]/reverse-receiving — guard shortfall', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requirePermission.mockResolvedValue({ userId: 1, branchId: 2 })
  })

  it('menolak (409) kalau PO ini sudah pernah melunasi shortfall', async () => {
    mockOuterSelects({ priorClearings: [{ id: 1 }] })

    const res = await POST(makeReq({ pin: '1234', reason: 'salah input' }), makeParams('5'))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/melunasi utang stok/)
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('tetap berjalan normal kalau PO ini tidak pernah melunasi shortfall apa pun', async () => {
    mockOuterSelects({ priorClearings: [] })
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        select: () => chain([]),
        update: () => ({ set: () => ({ where: async () => [] }) }),
        delete: () => ({ where: async () => [] }),
        insert: () => ({ values: async () => [] }),
      }),
    )

    const res = await POST(makeReq({ pin: '1234', reason: 'salah input' }), makeParams('5'))

    expect(res.status).toBe(200)
    expect(db.transaction).toHaveBeenCalledTimes(1)
  })
})
