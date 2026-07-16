import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSelectResults, selectCallIdx, mockInsert, mockCookiesGet, mockVerify } = vi.hoisted(() => {
  const mockSelectResults: unknown[][] = []
  const selectCallIdx = { value: 0 }
  const mockInsert = vi.fn()
  const mockCookiesGet = vi.fn()
  const mockVerify = vi.fn()
  return { mockSelectResults, selectCallIdx, mockInsert, mockCookiesGet, mockVerify }
})

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookiesGet }),
}))

vi.mock('@/lib/auth', () => ({
  verifyAccessToken: mockVerify,
}))

vi.mock('@/lib/db', () => {
  const nextSelectResult = () => {
    const result = mockSelectResults[selectCallIdx.value++] ?? []
    return Object.assign(Promise.resolve(result), {
      limit: vi.fn().mockResolvedValue(result),
    })
  }
  return {
    db: {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(nextSelectResult),
        }),
      })),
      transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => unknown) =>
        callback({ insert: mockInsert })
      ),
    },
    products: { id: 'p.id', name: 'p.name', baseUomId: 'p.base_uom_id' },
    productPrices: {
      productId: 'pp.product_id', branchId: 'pp.branch_id', uomId: 'pp.uom_id',
      tierType: 'pp.tier_type', price: 'pp.price',
    },
    productUomCosts: {
      productId: 'puc.product_id', branchId: 'puc.branch_id', uomId: 'puc.uom_id',
      costPrice: 'puc.cost_price',
    },
    productUomConversions: {
      uomId: 'conv.uom_id', productId: 'conv.product_id', ratio: 'conv.ratio', weightGram: 'conv.weight_gram',
    },
    unitsOfMeasure: { id: 'u.id', code: 'u.code', name: 'u.name' },
    eq: vi.fn().mockReturnValue('eq'),
    and: vi.fn().mockReturnValue('and'),
    inArray: vi.fn().mockReturnValue('inArray'),
  }
})

import { POST } from './route'

const makeReq = (body: object, preview = false) =>
  new NextRequest(`http://localhost/api/bo/master-data/prices/copy-product${preview ? '?preview=1' : ''}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const setAuth = (role: string | null) => {
  if (!role) {
    mockCookiesGet.mockReturnValue(undefined)
    mockVerify.mockResolvedValue(null)
    return
  }
  mockCookiesGet.mockReturnValue({ value: 'tok' })
  mockVerify.mockResolvedValue({ userId: 1, role, branchId: 1, permissions: role === 'OWNER' || role === 'GM' ? ['master.product.manage', 'master.price.manage'] : [] })
}

const validBody = { sourceProductId: 10, targetProductId: 20, branchId: 1 }

// Isi antrian hasil select sesuai urutan query buildPreview:
// source, target, srcPrices, srcCosts, srcConversions, tgtConversions, uoms
function seedPreview(opts: { tgtRatio?: number | null; srcCost?: number | null } = {}) {
  mockSelectResults.push([{ id: 10, name: 'Produk A', baseUomId: 1 }])
  mockSelectResults.push([{ id: 20, name: 'Produk B', baseUomId: 1 }])
  mockSelectResults.push([{ uomId: 2, tierType: 'RETAIL', price: 100000 }])
  mockSelectResults.push(opts.srcCost != null ? [{ uomId: 2, costPrice: opts.srcCost }] : [])
  mockSelectResults.push([{ uomId: 2, ratio: 10, weightGram: null }])
  mockSelectResults.push(opts.tgtRatio != null ? [{ uomId: 2, ratio: opts.tgtRatio }] : [])
  mockSelectResults.push([{ id: 2, code: 'DUS', name: 'Dus' }])
}

describe('POST /api/bo/master-data/prices/copy-product', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectResults.length = 0
    selectCallIdx.value = 0
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue(
        Object.assign(Promise.resolve([]), {
          onConflictDoUpdate: vi.fn().mockResolvedValue([]),
        })
      ),
    })
  })

  it('returns 401 tanpa token', async () => {
    setAuth(null)
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 untuk role MANAGER', async () => {
    setAuth('MANAGER')
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(403)
  })

  it('returns 400 ketika produk sumber = tujuan', async () => {
    setAuth('OWNER')
    const res = await POST(makeReq({ ...validBody, targetProductId: 10 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('tidak boleh sama')
  })

  it('returns 404 ketika produk tidak ditemukan', async () => {
    setAuth('OWNER')
    mockSelectResults.push([]) // source kosong
    mockSelectResults.push([{ id: 20, name: 'Produk B', baseUomId: 1 }])
    const res = await POST(makeReq(validBody, true))
    expect(res.status).toBe(404)
  })

  it('preview menandai konflik ratio sebagai tidak dapat disalin', async () => {
    setAuth('OWNER')
    seedPreview({ tgtRatio: 50 })
    const res = await POST(makeReq(validBody, true))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rows).toHaveLength(1)
    expect(body.rows[0].copyable).toBe(false)
    expect(body.rows[0].blockReason).toContain('Ratio bentrok')
  })

  it('returns 409 ketika mengeksekusi salin satuan yang bentrok', async () => {
    setAuth('OWNER')
    seedPreview({ tgtRatio: 50 })
    const res = await POST(makeReq({ ...validBody, uomIds: [2] }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('DUS')
  })

  it('returns 400 ketika eksekusi tanpa uomIds', async () => {
    setAuth('GM')
    seedPreview()
    const res = await POST(makeReq(validBody))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('minimal satu')
  })

  it('menyalin konversi + harga + modal untuk request valid', async () => {
    setAuth('OWNER')
    seedPreview({ srcCost: 80000 })
    const res = await POST(makeReq({ ...validBody, uomIds: [2] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.createdConversions).toBe(1)
    expect(body.copiedPrices).toBe(1)
    expect(body.copiedCosts).toBe(1)
    expect(mockInsert).toHaveBeenCalledTimes(3)
  })

  it('tidak membuat konversi ulang bila ratio target sudah sama', async () => {
    setAuth('OWNER')
    seedPreview({ tgtRatio: 10 })
    const res = await POST(makeReq({ ...validBody, uomIds: [2] }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.createdConversions).toBe(0)
    expect(body.copiedPrices).toBe(1)
  })
})
