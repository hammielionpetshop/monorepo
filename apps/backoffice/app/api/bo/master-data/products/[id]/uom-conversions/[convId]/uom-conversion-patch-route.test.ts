import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSelectResults, selectCallIdx, mockUpdateSet, mockCookiesGet, mockVerify } = vi.hoisted(() => {
  const mockSelectResults: unknown[][] = []
  const selectCallIdx = { value: 0 }
  const mockUpdateSet = vi.fn()
  const mockCookiesGet = vi.fn()
  const mockVerify = vi.fn()
  return { mockSelectResults, selectCallIdx, mockUpdateSet, mockCookiesGet, mockVerify }
})

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookiesGet }),
}))

vi.mock('@/lib/auth', () => ({
  verifyAccessToken: mockVerify,
}))

vi.mock('@/lib/db', () => {
  const del = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
  return {
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
      selectDistinct: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() =>
              Promise.resolve(mockSelectResults[selectCallIdx.value++] ?? [])
            ),
          }),
        }),
      })),
      update: vi.fn().mockImplementation(() => ({
        set: mockUpdateSet.mockImplementation((values: object) => ({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 5, productId: 1, uomId: 2, weightGram: 250, ...values }]),
          }),
        })),
      })),
      delete: del,
      transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => unknown) =>
        callback({ delete: del })
      ),
    },
    productUomConversions: {
      id: 'puc.id',
      productId: 'puc.product_id',
      uomId: 'puc.uom_id',
      ratio: 'puc.ratio',
      weightGram: 'puc.weight_gram',
    },
    productPrices: {
      productId: 'pp.product_id',
      branchId: 'pp.branch_id',
      uomId: 'pp.uom_id',
    },
    productUomCosts: {
      productId: 'puc2.product_id',
      uomId: 'puc2.uom_id',
    },
    branches: { id: 'b.id', name: 'b.name' },
    eq: vi.fn().mockReturnValue('eq'),
    and: vi.fn().mockReturnValue('and'),
  }
})

import { PATCH } from './route'

const makePatchReq = (id: string, convId: string, body: object) =>
  new NextRequest(`http://localhost/api/bo/master-data/products/${id}/uom-conversions/${convId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const makeParams = (id: string, convId: string) => ({ params: Promise.resolve({ id, convId }) })

const setAuth = (role: string | null) => {
  if (!role) {
    mockCookiesGet.mockReturnValue(undefined)
    mockVerify.mockResolvedValue(null)
    return
  }
  mockCookiesGet.mockReturnValue({ value: 'tok' })
  mockVerify.mockResolvedValue({ userId: 1, role, branchId: 1 })
}

describe('PATCH /api/bo/master-data/products/[id]/uom-conversions/[convId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectResults.length = 0
    selectCallIdx.value = 0
  })

  it('returns 401 tanpa token', async () => {
    setAuth(null)

    const res = await PATCH(makePatchReq('1', '5', { ratio: '12' }), makeParams('1', '5'))

    expect(res.status).toBe(401)
    expect((await res.json()).error).toContain('Sesi tidak valid')
  })

  it('returns 403 untuk role selain OWNER/GM', async () => {
    setAuth('MANAGER')

    const res = await PATCH(makePatchReq('1', '5', { ratio: '12' }), makeParams('1', '5'))

    expect(res.status).toBe(403)
    expect((await res.json()).error).toContain('Akses ditolak')
  })

  it('returns 400 ketika ratio tidak valid', async () => {
    setAuth('OWNER')

    const res = await PATCH(makePatchReq('1', '5', { ratio: '0' }), makeParams('1', '5'))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('Ratio harus lebih dari 0')
  })

  it('returns 404 ketika konversi tidak ditemukan', async () => {
    setAuth('OWNER')
    mockSelectResults.push([])

    const res = await PATCH(makePatchReq('1', '5', { ratio: '12' }), makeParams('1', '5'))

    expect(res.status).toBe(404)
    expect((await res.json()).error).toContain('tidak ditemukan')
  })

  it('returns 404 ketika konversi milik produk lain', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 5, productId: 99 }])

    const res = await PATCH(makePatchReq('1', '5', { ratio: '12' }), makeParams('1', '5'))

    expect(res.status).toBe(404)
    expect((await res.json()).error).toContain('tidak ditemukan')
  })

  it('memperbarui ratio & berat untuk request valid dari OWNER', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 5, productId: 1 }])

    const res = await PATCH(
      makePatchReq('1', '5', { ratio: '24', weightGram: '500' }),
      makeParams('1', '5')
    )

    expect(res.status).toBe(200)
    expect(mockUpdateSet).toHaveBeenCalledWith({ ratio: 24, weightGram: 500 })
    const json = await res.json()
    expect(json.ratio).toBe(24)
    expect(json.weightGram).toBe(500)
  })

  it('mengosongkan berat ketika weightGram null', async () => {
    setAuth('GM')
    mockSelectResults.push([{ id: 5, productId: 1 }])

    const res = await PATCH(makePatchReq('1', '5', { ratio: '2', weightGram: null }), makeParams('1', '5'))

    expect(res.status).toBe(200)
    expect(mockUpdateSet).toHaveBeenCalledWith({ ratio: 2, weightGram: null })
  })

  it('tidak menyentuh berat ketika weightGram tidak dikirim (edit ratio dari grid)', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 5, productId: 1 }])

    const res = await PATCH(makePatchReq('1', '5', { ratio: '50' }), makeParams('1', '5'))

    expect(res.status).toBe(200)
    expect(mockUpdateSet).toHaveBeenCalledWith({ ratio: 50 })
    expect((await res.json()).weightGram).toBe(250)
  })
})
