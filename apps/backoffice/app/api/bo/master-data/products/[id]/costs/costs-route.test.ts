import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSelectResults, selectCallIdx, mockTrxDelete, mockTrxInsert, mockCookiesGet, mockVerify } = vi.hoisted(() => {
  const mockSelectResults: unknown[][] = []
  const selectCallIdx = { value: 0 }
  const mockTrxDelete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
  const mockTrxInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) })
  const mockCookiesGet = vi.fn()
  const mockVerify = vi.fn()
  return { mockSelectResults, selectCallIdx, mockTrxDelete, mockTrxInsert, mockCookiesGet, mockVerify }
})

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookiesGet }),
}))

vi.mock('@/lib/auth', () => ({
  verifyAccessToken: mockVerify,
}))

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          const result = mockSelectResults[selectCallIdx.value++] ?? []
          return Object.assign(Promise.resolve(result), {
            limit: vi.fn().mockResolvedValue(result),
          })
        }),
      }),
    })),
    transaction: vi.fn().mockImplementation(async (fn: (trx: object) => Promise<void>) =>
      fn({ delete: mockTrxDelete, insert: mockTrxInsert })
    ),
  },
  products: { id: 'products.id' },
  branches: { id: 'branches.id' },
  productUomCosts: {
    productId: 'puc.product_id',
    branchId: 'puc.branch_id',
    uomId: 'puc.uom_id',
    costPrice: 'puc.cost_price',
  },
  eq: vi.fn().mockReturnValue('eq'),
  and: vi.fn().mockReturnValue('and'),
}))

import { GET, PUT } from './route'

const makeGetReq = (id: string, qs = '') =>
  new NextRequest(`http://localhost/api/bo/master-data/products/${id}/costs${qs}`)

const makePutReq = (id: string, body: object, contentType = 'application/json') =>
  new NextRequest(`http://localhost/api/bo/master-data/products/${id}/costs`, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: JSON.stringify(body),
  })

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

const setAuth = (role: string | null) => {
  if (!role) {
    mockCookiesGet.mockReturnValue(undefined)
    mockVerify.mockResolvedValue(null)
    return
  }

  mockCookiesGet.mockReturnValue({ value: 'tok' })
  mockVerify.mockResolvedValue({ userId: 1, role, branchId: 1, permissions: role === 'OWNER' || role === 'GM' ? ['master.product.manage', 'master.price.manage'] : [] })
}

describe('GET /api/bo/master-data/products/[id]/costs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectResults.length = 0
    selectCallIdx.value = 0
    mockTrxDelete.mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
    mockTrxInsert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) })
  })

  it('returns 401 when no access token', async () => {
    setAuth(null)

    const res = await GET(makeGetReq('1', '?branchId=1'), makeParams('1'))

    expect(res.status).toBe(401)
    expect((await res.json()).error).toContain('Sesi tidak valid')
  })

  it('returns 400 when branchId tidak ada', async () => {
    setAuth('KASIR')

    const res = await GET(makeGetReq('1'), makeParams('1'))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('branchId')
  })

  it('returns daftar harga modal untuk request valid', async () => {
    setAuth('MANAGER')
    mockSelectResults.push([
      { uomId: 1, costPrice: 10000 },
      { uomId: 2, costPrice: 95000 },
    ])

    const res = await GET(makeGetReq('1', '?branchId=1'), makeParams('1'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      { uomId: 1, costPrice: 10000 },
      { uomId: 2, costPrice: 95000 },
    ])
  })
})

describe('PUT /api/bo/master-data/products/[id]/costs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectResults.length = 0
    selectCallIdx.value = 0
    mockTrxDelete.mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
    mockTrxInsert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) })
  })

  it('returns 403 untuk role KASIR', async () => {
    setAuth('KASIR')

    const res = await PUT(makePutReq('1', { branchId: 1, costs: [] }), makeParams('1'))

    expect(res.status).toBe(403)
    expect((await res.json()).error).toContain('Akses ditolak')
  })

  it('returns 400 untuk harga modal negatif', async () => {
    setAuth('OWNER')

    const res = await PUT(
      makePutReq('1', { branchId: 1, costs: [{ uomId: 1, costPrice: '-100' }] }),
      makeParams('1')
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Harga modal tidak valid')
  })

  it('returns 400 ketika harga modal melebihi batas maksimum', async () => {
    setAuth('GM')

    const res = await PUT(
      makePutReq('1', { branchId: 1, costs: [{ uomId: 1, costPrice: '99999999999' }] }),
      makeParams('1')
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('batas maksimum')
  })

  it('returns 400 untuk entri duplikat uomId dalam satu request', async () => {
    setAuth('OWNER')

    const res = await PUT(
      makePutReq('1', {
        branchId: 1,
        costs: [
          { uomId: 1, costPrice: '10000' },
          { uomId: 1, costPrice: '9000' },
        ],
      }),
      makeParams('1')
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('duplikat')
  })

  it('returns 404 ketika cabang tidak ditemukan', async () => {
    setAuth('OWNER')
    mockSelectResults.push([])

    const res = await PUT(
      makePutReq('1', { branchId: 999, costs: [{ uomId: 1, costPrice: '10000' }] }),
      makeParams('1')
    )

    expect(res.status).toBe(404)
    expect((await res.json()).error).toContain('Cabang tidak ditemukan')
  })

  it('returns 404 ketika produk tidak ditemukan', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 1 }])
    mockSelectResults.push([])

    const res = await PUT(
      makePutReq('1', { branchId: 1, costs: [{ uomId: 1, costPrice: '10000' }] }),
      makeParams('1')
    )

    expect(res.status).toBe(404)
    expect((await res.json()).error).toContain('Produk tidak ditemukan')
  })

  it('berhasil simpan harga modal dengan request valid', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 1 }])
    mockSelectResults.push([{ id: 1 }])

    const res = await PUT(
      makePutReq('1', {
        branchId: 1,
        costs: [
          { uomId: 1, costPrice: '10000' },
          { uomId: 2, costPrice: '95000' },
        ],
      }),
      makeParams('1')
    )

    expect(res.status).toBe(200)
    expect((await res.json()).message).toContain('Harga modal berhasil disimpan')
    expect(mockTrxDelete).toHaveBeenCalled()
    expect(mockTrxInsert).toHaveBeenCalled()
  })
})
