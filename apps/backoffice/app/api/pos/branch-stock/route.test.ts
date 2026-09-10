import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyAccessToken = vi.fn()

const cookieStore = {
  get: vi.fn((name: string) => (name === 'accessToken' ? { value: 'token' } : undefined)),
}

const queue: unknown[] = []
function makeChain() {
  const chain: Record<string, unknown> = {}
  for (const m of ['from', 'leftJoin', 'where']) {
    chain[m] = vi.fn(() => chain)
  }
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(queue.shift() ?? []).then(resolve, reject)
  return chain
}
const db = { select: vi.fn(() => makeChain()) }

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieStore) }))
vi.mock('@/lib/auth', () => ({ verifyAccessToken }))
vi.mock('@/lib/db', () => ({
  db,
  products: { id: 'products.id', baseUomId: 'products.baseUomId' },
  productStocks: { productId: 'ps.productId', uomId: 'ps.uomId', qty: 'ps.qty', branchId: 'ps.branchId' },
  productUomConversions: { productId: 'puc.productId', uomId: 'puc.uomId', ratio: 'puc.ratio' },
  unitsOfMeasure: { id: 'uom.id', code: 'uom.code' },
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...c) => ({ and: c })),
  inArray: vi.fn((a, b) => ({ inArray: [a, b] })),
}))

function makeReq(qs: string) {
  return { nextUrl: new URL(`http://localhost/api/pos/branch-stock${qs}`) } as unknown as Parameters<
    typeof import('./route').GET
  >[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  queue.length = 0
  verifyAccessToken.mockResolvedValue({ userId: 7, branchId: 2, role: 'KASIR' })
  db.select.mockImplementation(() => makeChain())
})

describe('GET /api/pos/branch-stock', () => {
  it('401 bila tidak ada sesi', async () => {
    verifyAccessToken.mockResolvedValueOnce(null)
    const { GET } = await import('./route')
    const res = await GET(makeReq('?branchId=3&productIds=1'))
    expect(res.status).toBe(401)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('400 bila branchId tidak valid', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeReq('?branchId=abc&productIds=1'))
    expect(res.status).toBe(400)
  })

  it('400 bila productIds kosong', async () => {
    const { GET } = await import('./route')
    const res = await GET(makeReq('?branchId=3'))
    expect(res.status).toBe(400)
  })

  it('meringkas stok lintas satuan ke base UOM', async () => {
    queue.push([{ id: 1, baseUomId: 10, baseUomCode: 'PCS' }]) // products
    queue.push([{ productId: 1, uomId: 20, ratio: 12 }]) // conversions: 1 DUS = 12 PCS
    queue.push([
      { productId: 1, uomId: 10, qty: 5 }, // 5 PCS
      { productId: 1, uomId: 20, qty: 3 }, // 3 DUS = 36 PCS
    ]) // stocks

    const { GET } = await import('./route')
    const res = await GET(makeReq('?branchId=3&productIds=1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.branchId).toBe(3)
    expect(json.stocks['1']).toEqual({ baseQty: 41, baseUomCode: 'PCS' })
  })

  it('produk tanpa baris stok tetap dikembalikan sebagai 0', async () => {
    queue.push([{ id: 1, baseUomId: 10, baseUomCode: 'PCS' }])
    queue.push([])
    queue.push([])

    const { GET } = await import('./route')
    const res = await GET(makeReq('?branchId=3&productIds=1,1,2'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.stocks['1']).toEqual({ baseQty: 0, baseUomCode: 'PCS' })
    expect(json.stocks['2']).toEqual({ baseQty: 0, baseUomCode: null })
  })

  it('baseQty null bila ada satuan stok yang tak terdefinisi di konversi', async () => {
    queue.push([{ id: 1, baseUomId: 10, baseUomCode: 'PCS' }])
    queue.push([])
    queue.push([{ productId: 1, uomId: 99, qty: 4 }]) // uom 99 tak dikenal

    const { GET } = await import('./route')
    const res = await GET(makeReq('?branchId=3&productIds=1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.stocks['1']).toEqual({ baseQty: null, baseUomCode: 'PCS' })
  })
})
