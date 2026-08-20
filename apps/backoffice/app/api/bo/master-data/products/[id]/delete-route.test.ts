import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockSelectResults, selectCallIdx, mockTrxDelete, mockCookiesGet, mockVerify } = vi.hoisted(() => {
  const mockSelectResults: unknown[][] = []
  const selectCallIdx = { value: 0 }
  const mockTrxDelete = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
  const mockCookiesGet = vi.fn()
  const mockVerify = vi.fn()
  return { mockSelectResults, selectCallIdx, mockTrxDelete, mockCookiesGet, mockVerify }
})

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookiesGet }),
}))

vi.mock('@/lib/auth', () => ({
  verifyAccessToken: mockVerify,
}))

vi.mock('@/lib/db', () => {
  const selectImpl = () => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(() => {
        const result = mockSelectResults[selectCallIdx.value++] ?? []
        return Object.assign(Promise.resolve(result), {
          limit: vi.fn().mockResolvedValue(result),
        })
      }),
    }),
  })

  return {
    db: {
      select: vi.fn().mockImplementation(selectImpl),
      transaction: vi.fn().mockImplementation(async (fn: (trx: object) => Promise<unknown>) =>
        fn({ select: vi.fn().mockImplementation(selectImpl), delete: mockTrxDelete })
      ),
    },
    products: { id: 'products.id' },
    unitsOfMeasure: { id: 'uom.id' },
    productStocks: { productId: 'ps.product_id', qty: 'ps.qty' },
    productStockBatches: { productId: 'psb.product_id' },
    productPrices: { productId: 'pp.product_id' },
    productUomCosts: { productId: 'puc.product_id' },
    productUomConversions: { productId: 'puc2.product_id' },
    productBarcodes: { productId: 'pb.product_id' },
    transactionItems: { productId: 'ti.product_id' },
    purchaseOrderItems: { productId: 'poi.product_id' },
    interBranchTransferItems: { productId: 'ibti.product_id' },
    stockAdjustments: { productId: 'sa.product_id' },
    stockAutoBreaks: { productId: 'sab.product_id' },
    stockOpnameItems: { productId: 'soi.product_id' },
    damagedGoodsItems: { productId: 'dgi.product_id' },
    ownerPriceOverrides: { productId: 'opo.product_id' },
    returnItems: { productId: 'ri.product_id' },
    customerOrderItems: { productId: 'coi.product_id' },
    customerCartItems: { productId: 'cci.product_id' },
    eq: vi.fn().mockReturnValue('eq'),
    and: vi.fn().mockReturnValue('and'),
    ne: vi.fn().mockReturnValue('ne'),
    gt: vi.fn().mockReturnValue('gt'),
    count: vi.fn().mockReturnValue('count'),
  }
})

import { DELETE } from './route'

const makeReq = (id: string) =>
  new NextRequest(`http://localhost/api/bo/master-data/products/${id}`, { method: 'DELETE' })

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

const setAuth = (role: string | null) => {
  if (!role) {
    mockCookiesGet.mockReturnValue(undefined)
    mockVerify.mockResolvedValue(null)
    return
  }
  mockCookiesGet.mockReturnValue({ value: 'tok' })
  mockVerify.mockResolvedValue({
    userId: 1,
    role,
    branchId: 1,
    permissions: role === 'OWNER' || role === 'GM' ? ['master.product.manage'] : [],
  })
}

// Urutan select di dalam transaction: [0] cek produk ada, lalu 12 hitungan guard
// (stok qty>0, transactionItems, purchaseOrderItems, interBranchTransferItems,
// productStockBatches, stockAdjustments, stockAutoBreaks, stockOpnameItems,
// damagedGoodsItems, ownerPriceOverrides, returnItems, customerOrderItems).
const pushCleanGuards = () => {
  mockSelectResults.push([{ id: 1 }]) // produk ada
  for (let i = 0; i < 12; i++) mockSelectResults.push([{ n: 0 }])
}

describe('DELETE /api/bo/master-data/products/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelectResults.length = 0
    selectCallIdx.value = 0
    mockTrxDelete.mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
  })

  it('returns 401 tanpa token', async () => {
    setAuth(null)

    const res = await DELETE(makeReq('1'), makeParams('1'))

    expect(res.status).toBe(401)
    expect((await res.json()).error).toContain('Sesi tidak valid')
  })

  it('returns 403 untuk role tanpa izin', async () => {
    setAuth('KASIR')

    const res = await DELETE(makeReq('1'), makeParams('1'))

    expect(res.status).toBe(403)
    expect((await res.json()).error).toContain('Akses ditolak')
  })

  it('returns 400 untuk ID tidak valid', async () => {
    setAuth('OWNER')

    const res = await DELETE(makeReq('abc'), makeParams('abc'))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('ID produk tidak valid')
  })

  it('returns 404 ketika produk tidak ditemukan', async () => {
    setAuth('OWNER')
    mockSelectResults.push([])

    const res = await DELETE(makeReq('1'), makeParams('1'))

    expect(res.status).toBe(404)
    expect((await res.json()).error).toContain('tidak ditemukan')
  })

  it('returns 409 dan menolak hapus ketika produk masih punya stok', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 1 }]) // produk ada
    mockSelectResults.push([{ n: 1 }]) // stok qty > 0
    for (let i = 0; i < 11; i++) mockSelectResults.push([{ n: 0 }])

    const res = await DELETE(makeReq('1'), makeParams('1'))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('masih memiliki stok')
    expect(body.error).toContain('Nonaktifkan')
    expect(mockTrxDelete).not.toHaveBeenCalled()
  })

  it('returns 409 dan menolak hapus ketika produk pernah punya riwayat transaksi', async () => {
    setAuth('GM')
    mockSelectResults.push([{ id: 1 }]) // produk ada
    mockSelectResults.push([{ n: 0 }]) // stok aman
    mockSelectResults.push([{ n: 3 }]) // transactionItems ada
    for (let i = 0; i < 10; i++) mockSelectResults.push([{ n: 0 }])

    const res = await DELETE(makeReq('1'), makeParams('1'))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('riwayat transaksi')
    expect(mockTrxDelete).not.toHaveBeenCalled()
  })

  it('returns 409 ketika produk pernah dipakai di purchase order', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 1 }])
    mockSelectResults.push([{ n: 0 }])
    mockSelectResults.push([{ n: 0 }])
    mockSelectResults.push([{ n: 2 }]) // purchaseOrderItems ada
    for (let i = 0; i < 9; i++) mockSelectResults.push([{ n: 0 }])

    const res = await DELETE(makeReq('1'), makeParams('1'))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('purchase order')
  })

  it('returns 409 ketika produk pernah ditransfer antar cabang', async () => {
    setAuth('OWNER')
    mockSelectResults.push([{ id: 1 }])
    mockSelectResults.push([{ n: 0 }])
    mockSelectResults.push([{ n: 0 }])
    mockSelectResults.push([{ n: 0 }])
    mockSelectResults.push([{ n: 1 }]) // interBranchTransferItems ada
    for (let i = 0; i < 8; i++) mockSelectResults.push([{ n: 0 }])

    const res = await DELETE(makeReq('1'), makeParams('1'))

    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('transfer antar cabang')
  })

  it('berhasil menghapus produk yang belum pernah dipakai', async () => {
    setAuth('OWNER')
    pushCleanGuards()

    const res = await DELETE(makeReq('1'), makeParams('1'))

    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    expect(mockTrxDelete).toHaveBeenCalled()
  })
})
