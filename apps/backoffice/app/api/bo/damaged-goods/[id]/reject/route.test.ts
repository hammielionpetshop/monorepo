import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const { tables, requirePermission, db } = vi.hoisted(() => ({
  tables: {
    damagedGoods: {},
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
  and: vi.fn((...conditions) => ({ op: 'and', conditions })),
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

function makeTx(row: Record<string, unknown> | null, opts: { updates: Record<string, unknown>[]; inserts: { table: unknown; values: Record<string, unknown> }[] }) {
  return {
    select: () => ({ from: (table: unknown) => (table === tables.damagedGoods ? chain(row ? [row] : []) : chain([])) }),
    update: (table: unknown) => ({
      set: (payload: Record<string, unknown>) => ({
        where: () => {
          if (table === tables.damagedGoods) opts.updates.push(payload)
          return { returning: () => Promise.resolve([{ ...row, ...payload }]) }
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

describe('PATCH /api/bo/damaged-goods/[id]/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requirePermission.mockResolvedValue({ userId: 1, branchId: 2, branchScope: 'ALL' })
  })

  it('menolak laporan PENDING dengan alasan, mencatat audit log, stok tidak disentuh', async () => {
    const opts = { updates: [] as Record<string, unknown>[], inserts: [] as { table: unknown; values: Record<string, unknown> }[] }
    const row = { id: 5, branchId: 2, status: 'PENDING' }
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTx(row, opts)))

    const res = await PATCH(makeReq({ rejectionReason: 'barang ternyata masih layak jual' }), makeParams('5'))

    expect(res.status).toBe(200)
    expect(opts.updates[0]).toMatchObject({ status: 'REJECTED', resolvedById: 1, rejectionReason: 'barang ternyata masih layak jual' })
    expect(opts.updates[0].resolvedAt).toBeInstanceOf(Date)

    const auditInsert = opts.inserts.find((i) => i.table === tables.auditLogs)
    expect(auditInsert?.values).toMatchObject({ action: 'DAMAGED_GOODS_REJECT', branchId: 2, recordId: '5' })
  })

  it('menolak (400) kalau alasan kosong', async () => {
    const res = await PATCH(makeReq({ rejectionReason: '  ' }), makeParams('5'))
    expect(res.status).toBe(400)
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('menolak (404) kalau laporan tidak ditemukan', async () => {
    const opts = { updates: [] as Record<string, unknown>[], inserts: [] as { table: unknown; values: Record<string, unknown> }[] }
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTx(null, opts)))

    const res = await PATCH(makeReq({ rejectionReason: 'alasan' }), makeParams('999'))
    expect(res.status).toBe(404)
  })

  it('menolak (409) kalau laporan sudah diproses sebelumnya', async () => {
    const opts = { updates: [] as Record<string, unknown>[], inserts: [] as { table: unknown; values: Record<string, unknown> }[] }
    const row = { id: 5, branchId: 2, status: 'APPROVED' }
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTx(row, opts)))

    const res = await PATCH(makeReq({ rejectionReason: 'alasan' }), makeParams('5'))
    expect(res.status).toBe(409)
  })
})
