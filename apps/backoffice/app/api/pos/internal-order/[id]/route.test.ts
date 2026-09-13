import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const verifyAccessToken = vi.fn()
const getPosBranchId = vi.fn()

const { tables } = vi.hoisted(() => ({
  tables: {
    interBranchTransfers: {},
    interBranchTransferItems: {},
    products: {},
    productUomConversions: {},
    productUomCosts: {},
  },
}))

const db = {
  select: vi.fn(),
  transaction: vi.fn(),
}

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: 'token' }) })),
}))

vi.mock('@/lib/auth', () => ({ verifyAccessToken }))
vi.mock('@/lib/pos-branch', () => ({ getPosBranchId }))

vi.mock('@/lib/db', () => ({
  db,
  ...tables,
  eq: vi.fn((left, right) => ({ op: 'eq', left, right })),
  and: vi.fn((...conditions) => ({ op: 'and', conditions })),
  inArray: vi.fn((left, values) => ({ op: 'inArray', left, values })),
}))

function selectChain(result: unknown[]) {
  const chain: Record<string, unknown> = {
    from: () => chain,
    where: () => chain,
    limit: async () => result,
    then: (resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

function makeTx({
  lockedResult = [{ id: 1 }],
  finalUpdateResult = [{ id: 1, status: 'PENDING_APPROVAL' }] as unknown[],
}: { lockedResult?: unknown[]; finalUpdateResult?: unknown[] } = {}) {
  const deletedTables: unknown[] = []

  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => lockedResult,
        }),
      }),
    }),
    delete: (table: unknown) => {
      deletedTables.push(table)
      return { where: async () => undefined }
    },
    update: () => ({
      set: () => ({
        where: () => ({
          returning: async () => finalUpdateResult,
        }),
      }),
    }),
    insert: () => ({ values: async () => undefined }),
  }

  return { tx, deletedTables }
}

function patchRequest(body: unknown) {
  return new Request('http://test.local/api/pos/internal-order/1', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

const params = Promise.resolve({ id: '1' })

const baseTransfer = {
  id: 1,
  ibtNumber: 'IBT-1',
  sourceBranchId: 2,
  destinationBranchId: 3,
  status: 'PENDING_APPROVAL',
}

const existingItemRows = [{ id: 10, productId: 100, uomId: 1, costPriceAtTransfer: 5000 }]

beforeEach(() => {
  verifyAccessToken.mockReset()
  getPosBranchId.mockReset()
  db.select.mockReset()
  db.transaction.mockReset()
  verifyAccessToken.mockResolvedValue({ userId: 7, branchId: 3, role: 'KASIR', branchScope: 'OWN' })
  getPosBranchId.mockReturnValue(3)
})

describe('PATCH /api/pos/internal-order/[id]', () => {
  it('401 tanpa sesi', async () => {
    verifyAccessToken.mockResolvedValueOnce(null)
    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ items: [{ id: 10, qtyRequested: 5 }] }), { params })
    expect(res.status).toBe(401)
  })

  it('404 bila PO tidak ditemukan', async () => {
    db.select.mockReturnValueOnce(selectChain([]))
    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ items: [{ id: 10, qtyRequested: 5 }] }), { params })
    expect(res.status).toBe(404)
  })

  it('403 bila PO bukan milik cabang sesi POS', async () => {
    getPosBranchId.mockReturnValue(99)
    db.select.mockReturnValueOnce(selectChain([baseTransfer]))
    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ items: [{ id: 10, qtyRequested: 5 }] }), { params })
    const json = await res.json()
    expect(res.status).toBe(403)
    expect(json.error).toMatch(/bukan milik cabang/i)
  })

  it('409 bila status sudah diproses cabang pengirim (APPROVED)', async () => {
    db.select.mockReturnValueOnce(selectChain([{ ...baseTransfer, status: 'APPROVED' }]))
    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ items: [{ id: 10, qtyRequested: 5 }] }), { params })
    const json = await res.json()
    expect(res.status).toBe(409)
    expect(json.error).toMatch(/sudah diproses cabang pengirim/i)
  })

  it('400 bila items kosong', async () => {
    db.select.mockReturnValueOnce(selectChain([baseTransfer]))
    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ items: [] }), { params })
    expect(res.status).toBe(400)
  })

  it('sukses tambah item baru', async () => {
    db.select
      .mockReturnValueOnce(selectChain([baseTransfer])) // transfer lookup
      .mockReturnValueOnce(selectChain(existingItemRows)) // existing items lookup
      .mockReturnValueOnce(selectChain([{ id: 200, baseUomId: 1, defaultCostPrice: 1000 }])) // products
      .mockReturnValueOnce(selectChain([])) // productUomConversions
      .mockReturnValueOnce(selectChain([])) // productUomCosts

    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const { tx } = makeTx()
      return cb(tx)
    })

    const { PATCH } = await import('./route')
    const res = await PATCH(
      patchRequest({
        items: [
          { id: 10, qtyRequested: 5 },
          { productId: 200, uomId: 1, qtyRequested: 3 },
        ],
      }),
      { params }
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('PENDING_APPROVAL')
  })

  it('sukses ubah qty item lama', async () => {
    db.select
      .mockReturnValueOnce(selectChain([baseTransfer]))
      .mockReturnValueOnce(selectChain(existingItemRows))

    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const { tx } = makeTx()
      return cb(tx)
    })

    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ items: [{ id: 10, qtyRequested: 20 }] }), { params })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('PENDING_APPROVAL')
  })

  it('sukses hapus item lama', async () => {
    db.select.mockReturnValueOnce(selectChain([baseTransfer])).mockReturnValueOnce(
      selectChain([...existingItemRows, { id: 11, productId: 101, uomId: 1, costPriceAtTransfer: 2000 }])
    )

    let capturedDeletes: unknown[] = []
    db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const { tx, deletedTables } = makeTx()
      const result = await cb(tx)
      capturedDeletes = deletedTables
      return result
    })

    const { PATCH } = await import('./route')
    const res = await PATCH(patchRequest({ items: [{ id: 10, qtyRequested: 5 }] }), { params })

    expect(res.status).toBe(200)
    expect(capturedDeletes).toContain(tables.interBranchTransferItems)
  })
})
