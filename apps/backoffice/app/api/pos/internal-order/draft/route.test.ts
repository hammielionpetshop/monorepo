import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyAccessToken = vi.fn()
const eq = vi.fn((left, right) => ({ type: 'eq', left, right }))
const and = vi.fn((...conditions) => ({ type: 'and', conditions }))

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === 'accessToken') return { value: 'token' }
    return undefined
  }),
}

const selectChain = { from: vi.fn(), where: vi.fn(), limit: vi.fn() }
const insertChain = { values: vi.fn(), onConflictDoUpdate: vi.fn(), returning: vi.fn() }
const deleteChain = { where: vi.fn() }
const db = { select: vi.fn(), insert: vi.fn(), delete: vi.fn() }

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieStore) }))
vi.mock('@/lib/auth', () => ({ verifyAccessToken }))
vi.mock('@/lib/db', () => ({
  db,
  internalOrderDrafts: {
    branchId: 'internalOrderDrafts.branchId',
    createdById: 'internalOrderDrafts.createdById',
    destinationBranchId: 'internalOrderDrafts.destinationBranchId',
    sourceBranchId: 'internalOrderDrafts.sourceBranchId',
    notes: 'internalOrderDrafts.notes',
    items: 'internalOrderDrafts.items',
    updatedAt: 'internalOrderDrafts.updatedAt',
  },
  eq,
  and,
}))

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    productId: 10,
    productName: 'Produk Uji',
    productCode: 'SKU-1',
    uomId: 1,
    uomName: 'Base',
    availableUoms: [{ id: 1, name: 'Base', ratio: 1 }],
    baseDefaultCostPrice: 5000,
    qtyRequested: 3,
    costPrice: 5000,
    ...overrides,
  }
}

function putRequest(body: unknown) {
  return new NextRequest('http://localhost/api/pos/internal-order/draft', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function putPayload(overrides: Record<string, unknown> = {}) {
  return {
    destinationBranchId: 7,
    sourceBranchId: 2,
    notes: 'stok menipis',
    items: [makeItem()],
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  verifyAccessToken.mockResolvedValue({ userId: 9, branchId: 2, role: 'KASIR' })

  selectChain.from.mockReturnValue(selectChain)
  selectChain.where.mockReturnValue(selectChain)
  selectChain.limit.mockResolvedValue([])
  db.select.mockReturnValue(selectChain)

  insertChain.values.mockReturnValue(insertChain)
  insertChain.onConflictDoUpdate.mockReturnValue(insertChain)
  insertChain.returning.mockResolvedValue([{ updatedAt: new Date('2026-09-17T00:00:00.000Z') }])
  db.insert.mockReturnValue(insertChain)

  deleteChain.where.mockResolvedValue([])
  db.delete.mockReturnValue(deleteChain)
})

describe('GET /api/pos/internal-order/draft', () => {
  it('menolak tanpa sesi valid', async () => {
    verifyAccessToken.mockResolvedValue(null)
    const { GET } = await import('./route')

    const res = await GET()

    expect(res.status).toBe(401)
  })

  it('mengembalikan null saat tidak ada draft tersimpan', async () => {
    const { GET } = await import('./route')

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toBeNull()
  })

  it('mengembalikan draft milik (branchId, userId) sesi', async () => {
    selectChain.limit.mockResolvedValue([
      {
        destinationBranchId: 7,
        sourceBranchId: 2,
        notes: 'stok menipis',
        items: [makeItem()],
        updatedAt: new Date('2026-09-17T00:00:00.000Z'),
      },
    ])
    const { GET } = await import('./route')

    const res = await GET()
    const json = await res.json()

    expect(json.destinationBranchId).toBe(7)
    expect(json.items).toHaveLength(1)
    expect(json.savedAt).toBeDefined()
  })
})

describe('PUT /api/pos/internal-order/draft', () => {
  it('menolak tanpa sesi valid', async () => {
    verifyAccessToken.mockResolvedValue(null)
    const { PUT } = await import('./route')

    const res = await PUT(putRequest(putPayload()))

    expect(res.status).toBe(401)
  })

  it('menolak Content-Type bukan application/json', async () => {
    const { PUT } = await import('./route')
    const req = new NextRequest('http://localhost/api/pos/internal-order/draft', {
      method: 'PUT',
      body: JSON.stringify(putPayload()),
    })

    const res = await PUT(req)

    expect(res.status).toBe(415)
  })

  it('menolak body tidak valid', async () => {
    const { PUT } = await import('./route')

    const res = await PUT(putRequest({ items: [] }))

    expect(res.status).toBe(400)
  })

  it('item kosong menghapus draft (bukan menyimpan form kosong)', async () => {
    const { PUT } = await import('./route')

    const res = await PUT(putRequest(putPayload({ items: [] })))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ cleared: true })
    expect(db.delete).toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('upsert di-scope ke branchId & userId sesi, bukan dari body', async () => {
    const { PUT } = await import('./route')

    await PUT(putRequest(putPayload()))

    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 2, createdById: 9, destinationBranchId: 7 }),
    )
    expect(insertChain.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: ['internalOrderDrafts.branchId', 'internalOrderDrafts.createdById'],
      }),
    )
  })
})

describe('DELETE /api/pos/internal-order/draft', () => {
  it('menolak tanpa sesi valid', async () => {
    verifyAccessToken.mockResolvedValue(null)
    const { DELETE } = await import('./route')

    const res = await DELETE()

    expect(res.status).toBe(401)
  })

  it('menghapus draft milik sesi', async () => {
    const { DELETE } = await import('./route')

    const res = await DELETE()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ deleted: true })
    expect(db.delete).toHaveBeenCalled()
  })
})
