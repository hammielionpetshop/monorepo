import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSelectResults, selectCallIdx, mockExecuteResults, executeCallIdx, mockCookiesGet, mockVerify } = vi.hoisted(() => {
  const mockSelectResults: unknown[][] = []
  const selectCallIdx = { value: 0 }
  const mockExecuteResults: unknown[][] = []
  const executeCallIdx = { value: 0 }
  const mockCookiesGet = vi.fn()
  const mockVerify = vi.fn()
  return { mockSelectResults, selectCallIdx, mockExecuteResults, executeCallIdx, mockCookiesGet, mockVerify }
})

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookiesGet }),
}))

vi.mock('@/lib/auth', () => ({
  verifyAccessToken: mockVerify,
}))

vi.mock('@/lib/db', () => {
  const select = vi.fn().mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(() => {
        const result = mockSelectResults[selectCallIdx.value++] ?? []
        return Object.assign(Promise.resolve(result), {
          limit: vi.fn().mockResolvedValue(result),
        })
      }),
    }),
  }))

  // Dipakai applyPriceBulk (upsert per-sel + hapus per-sel + audit log)
  const insert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue({ rowCount: 1 }),
    }),
  })
  const del = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
  const execute = vi.fn().mockImplementation(() => {
    const result = mockExecuteResults[executeCallIdx.value++] ?? []
    return Promise.resolve(result)
  })

  return {
    db: {
      select,
      insert,
      delete: del,
      execute,
      transaction: vi.fn().mockImplementation(async (fn: (trx: object) => Promise<void>) =>
        fn({ insert, delete: del, execute })
      ),
    },
    products: { id: 'products.id' },
    branches: { id: 'branches.id' },
    productPrices: {
      id: 'pp.id',
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
    auditLogs: { id: 'al.id' },
    eq: vi.fn().mockReturnValue('eq'),
    and: vi.fn().mockReturnValue('and'),
  }
})

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

const resetMocks = () => {
  vi.clearAllMocks()
  mockSelectResults.length = 0
  selectCallIdx.value = 0
  mockExecuteResults.length = 0
  executeCallIdx.value = 0
}

describe('GET /api/bo/master-data/products/[id]/costs', () => {
  beforeEach(resetMocks)

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
  beforeEach(resetMocks)

  it('returns 403 untuk role KASIR', async () => {
    setAuth('KASIR')

    const res = await PUT(makePutReq('1', { branchId: 1, changes: [] }), makeParams('1'))

    expect(res.status).toBe(403)
    expect((await res.json()).error).toContain('Akses ditolak')
  })

  it('returns 400 ketika changes dan deletes kosong dua-duanya', async () => {
    setAuth('OWNER')

    const res = await PUT(makePutReq('1', { branchId: 1, changes: [], deletes: [] }), makeParams('1'))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Tidak ada perubahan')
  })

  it('returns 400 untuk harga modal negatif', async () => {
    setAuth('OWNER')

    const res = await PUT(
      makePutReq('1', { branchId: 1, changes: [{ uomId: 1, costPrice: '-100' }] }),
      makeParams('1')
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Harga modal tidak valid')
  })

  it('returns 400 ketika harga modal melebihi batas maksimum', async () => {
    setAuth('GM')

    const res = await PUT(
      makePutReq('1', { branchId: 1, changes: [{ uomId: 1, costPrice: '99999999999' }] }),
      makeParams('1')
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('batas maksimum')
  })

  it('returns 400 untuk entri duplikat uomId di antara changes & deletes', async () => {
    setAuth('OWNER')

    const res = await PUT(
      makePutReq('1', {
        branchId: 1,
        changes: [{ uomId: 1, costPrice: '10000' }],
        deletes: [{ uomId: 1 }],
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
      makePutReq('1', { branchId: 999, changes: [{ uomId: 1, costPrice: '10000' }] }),
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
      makePutReq('1', { branchId: 1, changes: [{ uomId: 1, costPrice: '10000' }] }),
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
        changes: [
          { uomId: 1, costPrice: '10000' },
          { uomId: 2, costPrice: '95000' },
        ],
      }),
      makeParams('1')
    )

    expect(res.status).toBe(200)
    expect((await res.json()).message).toContain('Harga modal berhasil disimpan')
  })

  it('hanya mengirim sel yang dihapus (deletes), tidak menyentuh sel lain', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 1 }])
    mockSelectResults.push([{ id: 1 }])

    const res = await PUT(
      makePutReq('1', { branchId: 1, deletes: [{ uomId: 1 }] }),
      makeParams('1')
    )

    expect(res.status).toBe(200)
  })
})
