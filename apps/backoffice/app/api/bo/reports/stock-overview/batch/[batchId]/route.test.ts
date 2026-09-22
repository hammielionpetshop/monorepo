import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const { tables, requirePermission, db } = vi.hoisted(() => ({
  tables: {
    productStockBatches: {},
    auditLogs: {},
  },
  requirePermission: vi.fn(),
  db: { transaction: vi.fn() },
}))

vi.mock('@/lib/authz', () => ({ requirePermission }))
vi.mock('@/lib/db', () => ({
  db,
  ...tables,
  eq: vi.fn((left, right) => ({ op: 'eq', left, right })),
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

function makeParams(batchId: string) {
  return { params: Promise.resolve({ batchId }) }
}

function makeReq(body: unknown): NextRequest {
  return {
    headers: { get: (key: string) => (key === 'content-type' ? 'application/json' : null) },
    json: async () => body,
  } as unknown as NextRequest
}

function makeTx(row: Record<string, unknown> | null, opts: { updates: { table: unknown; payload: Record<string, unknown> }[]; inserts: { table: unknown; values: Record<string, unknown> }[] }) {
  return {
    select: () => ({ from: (table: unknown) => (table === tables.productStockBatches ? chain(row ? [row] : []) : chain([])) }),
    update: (table: unknown) => ({
      set: (payload: Record<string, unknown>) => ({
        where: () => {
          opts.updates.push({ table, payload })
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

describe('PATCH /api/bo/reports/stock-overview/batch/[batchId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requirePermission.mockResolvedValue({ userId: 1, branchId: 2, branchScope: 'ALL' })
  })

  it('mengubah modal/unit batch dan mencatat audit log', async () => {
    const opts = { updates: [] as { table: unknown; payload: Record<string, unknown> }[], inserts: [] as { table: unknown; values: Record<string, unknown> }[] }
    const row = { id: 5, productId: 7, branchId: 2, qtyRemaining: 10, costPrice: 5000 }
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTx(row, opts)))

    const res = await PATCH(makeReq({ costPrice: 5200, reason: 'koreksi hasil audit HPP' }), makeParams('5'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ id: 5, costPrice: 5200 })

    const batchUpdate = opts.updates.find((u) => u.table === tables.productStockBatches)
    expect(batchUpdate?.payload).toEqual({ costPrice: 5200 })

    const auditInsert = opts.inserts.find((i) => i.table === tables.auditLogs)
    expect(auditInsert?.values).toMatchObject({ action: 'STOCK_BATCH_CORRECT_COST', branchId: 2, recordId: '5' })
    expect(JSON.parse(auditInsert!.values.oldData as string)).toEqual({ costPrice: 5000 })
    expect(JSON.parse(auditInsert!.values.newData as string)).toMatchObject({ costPrice: 5200, reason: 'koreksi hasil audit HPP' })
  })

  it('menolak (400) kalau alasan kosong', async () => {
    const res = await PATCH(makeReq({ costPrice: 5200, reason: '  ' }), makeParams('5'))
    expect(res.status).toBe(400)
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('menolak (400) kalau costPrice tidak dikirim', async () => {
    const res = await PATCH(makeReq({ reason: 'alasan' }), makeParams('5'))
    expect(res.status).toBe(400)
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('menolak (400) kalau nilai baru sama dengan yang lama', async () => {
    const opts = { updates: [], inserts: [] } as { updates: { table: unknown; payload: Record<string, unknown> }[]; inserts: { table: unknown; values: Record<string, unknown> }[] }
    const row = { id: 5, productId: 7, branchId: 2, qtyRemaining: 10, costPrice: 5000 }
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTx(row, opts)))

    const res = await PATCH(makeReq({ costPrice: 5000, reason: 'alasan' }), makeParams('5'))
    expect(res.status).toBe(400)
  })

  it('menolak (404) kalau batch tidak ditemukan', async () => {
    const opts = { updates: [], inserts: [] } as { updates: { table: unknown; payload: Record<string, unknown> }[]; inserts: { table: unknown; values: Record<string, unknown> }[] }
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTx(null, opts)))

    const res = await PATCH(makeReq({ costPrice: 5200, reason: 'alasan' }), makeParams('999'))
    expect(res.status).toBe(404)
  })

  it('menolak (403) kalau batch milik cabang lain (user tidak global)', async () => {
    requirePermission.mockResolvedValue({ userId: 1, branchId: 2, branchScope: 'SINGLE' })
    const opts = { updates: [], inserts: [] } as { updates: { table: unknown; payload: Record<string, unknown> }[]; inserts: { table: unknown; values: Record<string, unknown> }[] }
    const row = { id: 5, productId: 7, branchId: 99, qtyRemaining: 10, costPrice: 5000 }
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTx(row, opts)))

    const res = await PATCH(makeReq({ costPrice: 5200, reason: 'alasan' }), makeParams('5'))
    expect(res.status).toBe(403)
  })
})
