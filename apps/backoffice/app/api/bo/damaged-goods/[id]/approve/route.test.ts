import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const { tables, requirePermission, db, deductStock, InsufficientStockError } = vi.hoisted(() => {
  class InsufficientStockError extends Error {
    constructor(message: string, readonly productId: number, readonly shortfallQty: number) {
      super(message)
      this.name = 'InsufficientStockError'
    }
  }
  return {
    tables: { damagedGoods: {}, damagedGoodsItems: {}, auditLogs: {} },
    requirePermission: vi.fn(),
    db: { transaction: vi.fn() },
    deductStock: vi.fn(),
    InsufficientStockError,
  }
})

vi.mock('@/lib/authz', () => ({ requirePermission }))
vi.mock('@/lib/db', () => ({
  db,
  ...tables,
  eq: vi.fn((left, right) => ({ op: 'eq', left, right })),
  and: vi.fn((...conditions) => ({ op: 'and', conditions })),
}))
vi.mock('@/lib/services/stock-service', () => ({
  StockService: { deductStock },
  InsufficientStockError,
}))

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

import { PATCH } from './route'

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function makeReq(body: unknown): NextRequest {
  return {
    headers: { get: (key: string) => (key === 'content-type' ? 'application/json' : null) },
    json: async () => body,
  } as unknown as NextRequest
}

function makeTx(
  header: Record<string, unknown> | null,
  items: Record<string, unknown>[],
  opts: { headerUpdates: Record<string, unknown>[]; itemUpdates: Record<string, unknown>[]; inserts: { table: unknown; values: Record<string, unknown> }[] },
) {
  return {
    select: () => ({
      from: (table: unknown) => {
        if (table === tables.damagedGoods) return chain(header ? [header] : [])
        if (table === tables.damagedGoodsItems) return chain(items)
        return chain([])
      },
    }),
    update: (table: unknown) => ({
      set: (payload: Record<string, unknown>) => ({
        where: () => {
          if (table === tables.damagedGoods) {
            opts.headerUpdates.push(payload)
            return { returning: () => Promise.resolve([{ ...header, ...payload }]) }
          }
          if (table === tables.damagedGoodsItems) opts.itemUpdates.push(payload)
          return Promise.resolve([])
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        opts.inserts.push({ table, values })
        return Promise.resolve([])
      },
    }),
  }
}

describe('PATCH /api/bo/damaged-goods/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requirePermission.mockResolvedValue({ userId: 1, branchId: 2, branchScope: 'ALL' })
  })

  it('memotong stok tiap item lewat StockService, update costPrice/lossValue nyata, approve laporan', async () => {
    const opts = { headerUpdates: [] as Record<string, unknown>[], itemUpdates: [] as Record<string, unknown>[], inserts: [] as { table: unknown; values: Record<string, unknown> }[] }
    const header = { id: 5, branchId: 2, status: 'PENDING' }
    const items = [{ id: 10, productId: 7, uomId: 1, qty: 3 }]
    deductStock.mockResolvedValue({ totalCogs: 9000 })
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTx(header, items, opts)))

    const res = await PATCH(makeReq({ resolutionAction: 'MUSNAHKAN', resolutionNotes: 'dibuang' }), makeParams('5'))

    expect(res.status).toBe(200)
    expect(deductStock).toHaveBeenCalledWith(expect.anything(), 2, 7, 1, 3, false)
    expect(opts.itemUpdates[0]).toMatchObject({ costPrice: 3000, lossValue: 9000 })
    expect(opts.headerUpdates[0]).toMatchObject({ status: 'APPROVED', resolvedById: 1, resolutionAction: 'MUSNAHKAN', totalLossValue: 9000 })

    const auditInsert = opts.inserts.find((i) => i.table === tables.auditLogs)
    expect(auditInsert?.values).toMatchObject({ action: 'DAMAGED_GOODS_APPROVE', branchId: 2, recordId: '5' })
  })

  it('menolak (409) kalau stok tidak lagi cukup saat approve', async () => {
    const opts = { headerUpdates: [] as Record<string, unknown>[], itemUpdates: [] as Record<string, unknown>[], inserts: [] as { table: unknown; values: Record<string, unknown> }[] }
    const header = { id: 5, branchId: 2, status: 'PENDING' }
    const items = [{ id: 10, productId: 7, uomId: 1, qty: 3 }]
    deductStock.mockRejectedValue(new InsufficientStockError('Stok tidak cukup', 7, 1))
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTx(header, items, opts)))

    const res = await PATCH(makeReq({ resolutionAction: 'MUSNAHKAN' }), makeParams('5'))
    expect(res.status).toBe(409)
    expect(opts.headerUpdates).toHaveLength(0)
  })

  it('menolak (400) kalau resolutionAction tidak valid', async () => {
    const res = await PATCH(makeReq({ resolutionAction: 'ENTAH' }), makeParams('5'))
    expect(res.status).toBe(400)
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('menolak (404) kalau laporan tidak ditemukan', async () => {
    const opts = { headerUpdates: [] as Record<string, unknown>[], itemUpdates: [] as Record<string, unknown>[], inserts: [] as { table: unknown; values: Record<string, unknown> }[] }
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTx(null, [], opts)))

    const res = await PATCH(makeReq({ resolutionAction: 'MUSNAHKAN' }), makeParams('999'))
    expect(res.status).toBe(404)
  })

  it('menolak (409) kalau laporan sudah diproses sebelumnya', async () => {
    const opts = { headerUpdates: [] as Record<string, unknown>[], itemUpdates: [] as Record<string, unknown>[], inserts: [] as { table: unknown; values: Record<string, unknown> }[] }
    const header = { id: 5, branchId: 2, status: 'REJECTED' }
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTx(header, [], opts)))

    const res = await PATCH(makeReq({ resolutionAction: 'MUSNAHKAN' }), makeParams('5'))
    expect(res.status).toBe(409)
  })
})
