import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Hoisted shared state ─────────────────────────────────────────────────────
const { mockExecuteResults, executeCallIdx, mockCookiesGet, mockVerify } = vi.hoisted(() => {
  const mockExecuteResults: unknown[][] = []
  const executeCallIdx = { value: 0 }
  const mockCookiesGet = vi.fn()
  const mockVerify = vi.fn()
  return { mockExecuteResults, executeCallIdx, mockCookiesGet, mockVerify }
})

// ── Module mocks ─────────────────────────────────────────────────────────────
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookiesGet }),
}))

vi.mock('@/lib/auth', () => ({
  verifyAccessToken: mockVerify,
}))

vi.mock('@/lib/db', () => {
  const insert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue({ rowCount: 1 }),
    }),
  })
  return {
    db: {
      execute: vi.fn().mockImplementation(() => {
        const result = mockExecuteResults[executeCallIdx.value++] ?? []
        return Promise.resolve(result)
      }),
      insert,
      transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => unknown) =>
        callback({ insert })
      ),
    },
    productPrices: {
      productId: 'pp.product_id',
      branchId: 'pp.branch_id',
      uomId: 'pp.uom_id',
      tierType: 'pp.tier_type',
    },
    productUomCosts: {
      productId: 'puc.product_id',
      branchId: 'puc.branch_id',
      uomId: 'puc.uom_id',
      costPrice: 'puc.cost_price',
    },
  }
})

import { GET, PUT } from './route'

// ── Test helpers ─────────────────────────────────────────────────────────────
const makeGetReq = (qs = '') =>
  new NextRequest(`http://localhost/api/bo/master-data/prices${qs}`)

const makePutReq = (body: object, contentType = 'application/json') =>
  new NextRequest('http://localhost/api/bo/master-data/prices', {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: JSON.stringify(body),
  })

const setAuth = (role: string | null) => {
  if (!role) {
    mockCookiesGet.mockReturnValue(undefined)
    mockVerify.mockResolvedValue(null)
  } else {
    mockCookiesGet.mockReturnValue({ value: 'tok' })
    mockVerify.mockResolvedValue({ userId: 1, role, branchId: 1 })
  }
}

const makeValidChange = (overrides = {}) => ({
  productId: 1, uomId: 1, tierType: 'RETAIL', price: 10000,
  ...overrides,
})

// ── GET tests ─────────────────────────────────────────────────────────────────
describe('GET /api/bo/master-data/prices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExecuteResults.length = 0
    executeCallIdx.value = 0
  })

  it('returns 401 tanpa token', async () => {
    setAuth(null)
    const res = await GET(makeGetReq('?branchId=1'))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toContain('Sesi tidak valid')
  })

  it('returns 400 ketika branchId tidak ada', async () => {
    setAuth('KASIR')
    const res = await GET(makeGetReq())
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('branchId')
  })

  it('returns 400 ketika branchId bukan angka', async () => {
    setAuth('KASIR')
    const res = await GET(makeGetReq('?branchId=abc'))
    expect(res.status).toBe(400)
  })

  it('returns daftar harga dengan paginasi (semua role)', async () => {
    setAuth('KASIR')
    mockExecuteResults.push([{ total: '2' }]) // count query
    mockExecuteResults.push([                 // data query
      { product_id: 1, product_name: 'Produk A', uom_id: 1, uom_code: 'PCS', uom_name: 'Pcs', prices: { RETAIL: 10000 } },
      { product_id: 2, product_name: 'Produk B', uom_id: 1, uom_code: 'PCS', uom_name: 'Pcs', prices: { RETAIL: 20000 } },
    ])
    const res = await GET(makeGetReq('?branchId=1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(body).toHaveProperty('total')
    expect(body).toHaveProperty('page')
    expect(body).toHaveProperty('pageSize', 50)
    expect(body.total).toBe(2)
  })

  it('menggunakan halaman 1 secara default', async () => {
    setAuth('MANAGER')
    mockExecuteResults.push([{ total: '0' }])
    mockExecuteResults.push([])
    const res = await GET(makeGetReq('?branchId=1'))
    expect(res.status).toBe(200)
    expect((await res.json()).page).toBe(1)
  })

  it('menerima filter categoryId dan search', async () => {
    setAuth('OWNER')
    mockExecuteResults.push([{ total: '0' }])
    mockExecuteResults.push([])
    const res = await GET(makeGetReq('?branchId=1&categoryId=2&search=kucing&page=2'))
    expect(res.status).toBe(200)
    expect((await res.json()).page).toBe(2)
  })
})

// ── PUT tests ─────────────────────────────────────────────────────────────────
describe('PUT /api/bo/master-data/prices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockExecuteResults.length = 0
    executeCallIdx.value = 0
  })

  it('returns 401 tanpa token', async () => {
    setAuth(null)
    const res = await PUT(makePutReq({ branchId: 1, changes: [makeValidChange()] }))
    expect(res.status).toBe(401)
  })

  it('returns 403 untuk role KASIR', async () => {
    setAuth('KASIR')
    const res = await PUT(makePutReq({ branchId: 1, changes: [makeValidChange()] }))
    expect(res.status).toBe(403)
    expect((await res.json()).error).toContain('Owner dan GM')
  })

  it('returns 403 untuk role FINANCE', async () => {
    setAuth('FINANCE')
    const res = await PUT(makePutReq({ branchId: 1, changes: [makeValidChange()] }))
    expect(res.status).toBe(403)
  })

  it('returns 415 untuk content-type bukan JSON', async () => {
    setAuth('OWNER')
    const res = await PUT(makePutReq({ branchId: 1, changes: [makeValidChange()] }, 'text/plain'))
    expect(res.status).toBe(415)
  })

  it('returns 400 ketika changes kosong', async () => {
    setAuth('OWNER')
    const res = await PUT(makePutReq({ branchId: 1, changes: [] }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Tidak ada perubahan')
  })

  it('returns 400 ketika changes melebihi 500 item', async () => {
    setAuth('OWNER')
    const tooMany = Array.from({ length: 501 }, (_, i) => makeValidChange({ productId: i + 1 }))
    const res = await PUT(makePutReq({ branchId: 1, changes: tooMany }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('500')
  })

  it('returns 400 ketika harga negatif', async () => {
    setAuth('GM')
    const res = await PUT(makePutReq({ branchId: 1, changes: [makeValidChange({ price: -1 })] }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('negatif')
  })

  it('returns 400 ketika harga melebihi batas maksimum', async () => {
    setAuth('OWNER')
    const res = await PUT(makePutReq({ branchId: 1, changes: [makeValidChange({ price: 99999999999 })] }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('batas maksimum')
  })

  it('returns 400 ketika tierType tidak valid', async () => {
    setAuth('OWNER')
    const res = await PUT(makePutReq({ branchId: 1, changes: [makeValidChange({ tierType: 'INVALID_TIER' })] }))
    expect(res.status).toBe(400)
  })

  it('berhasil update harga bulk dengan request valid', async () => {
    setAuth('OWNER')
    const changes = [
      makeValidChange({ tierType: 'RETAIL', price: 10000 }),
      makeValidChange({ tierType: 'GROSIR', price: 9000 }),
      makeValidChange({ productId: 2, tierType: 'RETAIL', price: 20000 }),
    ]
    const res = await PUT(makePutReq({ branchId: 1, changes }))
    expect(res.status).toBe(200)
    expect((await res.json()).updated).toBe(3)
  })

  it('berhasil update dengan role GM', async () => {
    setAuth('GM')
    const changes = [makeValidChange({ price: 0 })]
    const res = await PUT(makePutReq({ branchId: 1, changes }))
    expect(res.status).toBe(200)
    expect((await res.json()).updated).toBe(1)
  })

  it('accepts semua 6 tier type yang valid', async () => {
    setAuth('OWNER')
    const tiers = ['RETAIL', 'GROSIR', 'MEMBER', 'DISTRIBUTOR', 'RESELLER', 'PROMO']
    const changes = tiers.map((tierType, i) => makeValidChange({ productId: 1, uomId: 1, tierType, price: (i + 1) * 1000 }))
    const res = await PUT(makePutReq({ branchId: 1, changes }))
    expect(res.status).toBe(200)
    expect((await res.json()).updated).toBe(6)
  })
})
