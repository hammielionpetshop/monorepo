import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted shared state (semua harus di vi.hoisted agar tersedia saat vi.mock factory berjalan) ──
const { mockSelectResults, selectCallIdx, mockTrxDelete, mockTrxInsert, mockCookiesGet, mockVerify } = vi.hoisted(() => {
  const mockSelectResults: unknown[][] = []
  const selectCallIdx = { value: 0 }
  const mockTrxDelete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
  const mockTrxInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) })
  const mockCookiesGet = vi.fn()
  const mockVerify = vi.fn()
  return { mockSelectResults, selectCallIdx, mockTrxDelete, mockTrxInsert, mockCookiesGet, mockVerify }
})

// ── Module mocks ─────────────────────────────────────────────────────────────
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
  productPrices: { productId: 'pp.product_id', branchId: 'pp.branch_id', uomId: 'pp.uom_id', tierType: 'pp.tier_type' },
  eq: vi.fn().mockReturnValue('eq'),
  and: vi.fn().mockReturnValue('and'),
}))

import { GET, PUT } from './route'

// ── Test helpers ─────────────────────────────────────────────────────────────
const makeGetReq = (id: string, qs = '') =>
  new NextRequest(`http://localhost/api/bo/master-data/products/${id}/prices${qs}`)

const makePutReq = (id: string, body: object, contentType = 'application/json') =>
  new NextRequest(`http://localhost/api/bo/master-data/products/${id}/prices`, {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: JSON.stringify(body),
  })

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

const setAuth = (role: string | null) => {
  if (!role) {
    mockCookiesGet.mockReturnValue(undefined)
    mockVerify.mockResolvedValue(null)
  } else {
    mockCookiesGet.mockReturnValue({ value: 'tok' })
    mockVerify.mockResolvedValue({ userId: 1, role, branchId: 1 })
  }
}

// ── GET tests ─────────────────────────────────────────────────────────────────
describe('GET /api/bo/master-data/products/[id]/prices', () => {
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
    mockSelectResults.push([])
    const res = await GET(makeGetReq('1'), makeParams('1'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('branchId')
  })

  it('returns 400 untuk product ID non-numerik', async () => {
    setAuth('KASIR')
    const res = await GET(makeGetReq('abc', '?branchId=1'), makeParams('abc'))
    expect(res.status).toBe(400)
  })

  it('returns daftar harga untuk request valid (semua role)', async () => {
    setAuth('KASIR')
    const prices = [
      { uomId: 1, tierType: 'RETAIL', price: 10000 },
      { uomId: 1, tierType: 'GROSIR', price: 9500 },
    ]
    mockSelectResults.push(prices)
    const res = await GET(makeGetReq('1', '?branchId=1'), makeParams('1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(2)
    expect(body[0].tierType).toBe('RETAIL')
  })

  it('returns array kosong jika produk belum ada harga', async () => {
    setAuth('MANAGER')
    mockSelectResults.push([])
    const res = await GET(makeGetReq('99', '?branchId=1'), makeParams('99'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

// ── PUT tests ─────────────────────────────────────────────────────────────────
describe('PUT /api/bo/master-data/products/[id]/prices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectResults.length = 0
    selectCallIdx.value = 0
    mockTrxDelete.mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
    mockTrxInsert.mockReturnValue({ values: vi.fn().mockResolvedValue([]) })
  })

  it('returns 401 when no token', async () => {
    setAuth(null)
    const res = await PUT(makePutReq('1', { branchId: 1, prices: [] }), makeParams('1'))
    expect(res.status).toBe(401)
  })

  it('returns 403 untuk role KASIR', async () => {
    setAuth('KASIR')
    const res = await PUT(makePutReq('1', { branchId: 1, prices: [] }), makeParams('1'))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toContain('Owner dan GM')
  })

  it('returns 403 untuk role GUDANG', async () => {
    setAuth('GUDANG')
    const res = await PUT(makePutReq('1', { branchId: 1, prices: [] }), makeParams('1'))
    expect(res.status).toBe(403)
  })

  it('returns 403 untuk role MANAGER', async () => {
    setAuth('MANAGER')
    const res = await PUT(makePutReq('1', { branchId: 1, prices: [] }), makeParams('1'))
    expect(res.status).toBe(403)
  })

  it('returns 415 untuk content-type bukan JSON', async () => {
    setAuth('OWNER')
    const res = await PUT(makePutReq('1', { branchId: 1, prices: [] }, 'text/plain'), makeParams('1'))
    expect(res.status).toBe(415)
  })

  it('returns 400 untuk harga negatif', async () => {
    setAuth('OWNER')
    const body = { branchId: 1, prices: [{ uomId: 1, tierType: 'RETAIL', price: '-100' }] }
    const res = await PUT(makePutReq('1', body), makeParams('1'))
    expect(res.status).toBe(400)
  })

  it('returns 400 ketika harga melebihi batas maksimum', async () => {
    setAuth('GM')
    const body = { branchId: 1, prices: [{ uomId: 1, tierType: 'RETAIL', price: '99999999999' }] }
    const res = await PUT(makePutReq('1', body), makeParams('1'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('batas maksimum')
  })

  it('returns 400 untuk entri duplikat (uomId, tierType) dalam satu request', async () => {
    setAuth('OWNER')
    const body = {
      branchId: 1,
      prices: [
        { uomId: 1, tierType: 'RETAIL', price: '10000' },
        { uomId: 1, tierType: 'RETAIL', price: '9000' },
      ],
    }
    const res = await PUT(makePutReq('1', body), makeParams('1'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('duplikat')
  })

  it('returns 404 ketika cabang tidak ditemukan', async () => {
    setAuth('OWNER')
    mockSelectResults.push([]) // branch not found
    const body = { branchId: 999, prices: [{ uomId: 1, tierType: 'RETAIL', price: '10000' }] }
    const res = await PUT(makePutReq('1', body), makeParams('1'))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toContain('Cabang tidak ditemukan')
  })

  it('returns 404 ketika produk tidak ditemukan', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 1 }]) // branch found
    mockSelectResults.push([])          // product not found
    const body = { branchId: 1, prices: [{ uomId: 1, tierType: 'RETAIL', price: '10000' }] }
    const res = await PUT(makePutReq('1', body), makeParams('1'))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toContain('Produk tidak ditemukan')
  })

  it('berhasil simpan harga dengan request valid (OWNER)', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 1 }]) // branch found
    mockSelectResults.push([{ id: 1 }]) // product found
    const body = {
      branchId: 1,
      prices: [
        { uomId: 1, tierType: 'RETAIL', price: '10000' },
        { uomId: 1, tierType: 'GROSIR', price: '9000' },
      ],
    }
    const res = await PUT(makePutReq('1', body), makeParams('1'))
    expect(res.status).toBe(200)
    expect((await res.json()).message).toContain('berhasil disimpan')
  })

  it('berhasil simpan harga dengan request valid (GM)', async () => {
    setAuth('GM')
    mockSelectResults.push([{ id: 1 }])
    mockSelectResults.push([{ id: 1 }])
    const body = {
      branchId: 1,
      prices: [{ uomId: 1, tierType: 'RETAIL', price: '0' }],
    }
    const res = await PUT(makePutReq('1', body), makeParams('1'))
    expect(res.status).toBe(200)
  })

  it('berhasil simpan prices kosong (hapus semua harga produk)', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 1 }])
    mockSelectResults.push([{ id: 1 }])
    const body = { branchId: 1, prices: [] }
    const res = await PUT(makePutReq('1', body), makeParams('1'))
    expect(res.status).toBe(200)
  })
})
