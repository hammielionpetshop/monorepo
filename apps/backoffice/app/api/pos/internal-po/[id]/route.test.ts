import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyAccessToken = vi.fn()
const hasPermission = vi.fn()
const getPosBranchId = vi.fn()

const cookieStore = {
  get: vi.fn((name: string) => (name === 'accessToken' ? { value: 'token' } : undefined)),
}

// Antrean FIFO: tiap `await db.select()....` mengambil dataset berikutnya.
// Urutan di route: [header], [items], [conv], [stock], [price], [customer].
const queue: unknown[] = []
function makeChain() {
  const chain: Record<string, unknown> = {}
  for (const m of ['from', 'leftJoin', 'innerJoin', 'where', 'orderBy', 'limit']) {
    chain[m] = vi.fn(() => chain)
  }
  chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(queue.shift() ?? []).then(resolve, reject)
  return chain
}
const db = { select: vi.fn(() => makeChain()) }

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieStore) }))
vi.mock('@/lib/auth', () => ({ verifyAccessToken }))
vi.mock('@/lib/authz', () => ({ hasPermission }))
vi.mock('@/lib/pos-branch', () => ({ getPosBranchId }))
vi.mock('drizzle-orm/pg-core', () => ({ alias: (t: unknown) => t }))
vi.mock('@/lib/db', () => ({
  db,
  interBranchTransfers: {},
  interBranchTransferItems: {},
  branches: {},
  users: {},
  products: {},
  productPrices: {},
  productStocks: {},
  productUomConversions: {},
  unitsOfMeasure: {},
  customers: {},
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...c) => ({ and: c })),
  inArray: vi.fn((a, b) => ({ inArray: [a, b] })),
}))

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  queue.length = 0
  verifyAccessToken.mockResolvedValue({ userId: 7, branchId: 2, role: 'KASIR' })
  hasPermission.mockReturnValue(true)
  getPosBranchId.mockReturnValue(2)
  db.select.mockImplementation(() => makeChain())
})

describe('GET /api/pos/internal-po/[id]', () => {
  it('401 tanpa sesi', async () => {
    verifyAccessToken.mockResolvedValueOnce(null)
    const { GET } = await import('./route')
    const res = await GET({} as never, ctx('5'))
    expect(res.status).toBe(401)
  })

  it('403 tanpa permission', async () => {
    hasPermission.mockReturnValueOnce(false)
    const { GET } = await import('./route')
    const res = await GET({} as never, ctx('5'))
    expect(res.status).toBe(403)
  })

  it('400 bila id bukan angka', async () => {
    const { GET } = await import('./route')
    const res = await GET({} as never, ctx('abc'))
    expect(res.status).toBe(400)
  })

  it('404 bila PO tidak ditemukan', async () => {
    queue.push([]) // header kosong
    const { GET } = await import('./route')
    const res = await GET({} as never, ctx('5'))
    expect(res.status).toBe(404)
  })

  it('403 bila cabang pengirim PO bukan cabang sesi POS', async () => {
    queue.push([{ id: 5, ibtNumber: 'IBT-1', status: 'PENDING_APPROVAL', sourceBranchId: 99, destinationBranchId: 3 }])
    const { GET } = await import('./route')
    const res = await GET({} as never, ctx('5'))
    expect(res.status).toBe(403)
  })

  it('menghitung currentQty (base UOM) + insufficient + retailPrice per item', async () => {
    queue.push([
      {
        id: 5,
        ibtNumber: 'IBT-20260910-0001',
        status: 'PENDING_APPROVAL',
        sourceBranchId: 2,
        destinationBranchId: 3,
        destinationBranchName: 'Toko Depan',
        requestedByName: 'Budi',
        convertedTransactionId: null,
        notes: null,
        createdAt: new Date('2026-09-10T02:00:00Z'),
      },
    ])
    // items: produk 100 diminta 10 DUS (uom 9), base uom 8
    queue.push([
      { id: 1, productId: 100, productName: 'Produk A', productSku: 'A1', baseUomId: 8, uomId: 9, uomCode: 'DUS', qtyRequested: 10 },
      { id: 2, productId: 200, productName: 'Produk B', productSku: 'B1', baseUomId: 8, uomId: 8, uomCode: 'PCS', qtyRequested: 5 },
    ])
    // conv: 1 DUS = 12 base (produk 100). produk 200 pakai base langsung.
    queue.push([{ productId: 100, uomId: 9, ratio: 12 }])
    // stock (cabang 2): produk 100 -> 60 base (=5 DUS), produk 200 -> 5 base
    queue.push([
      { productId: 100, uomId: 8, qty: 60 },
      { productId: 200, uomId: 8, qty: 5 },
    ])
    // harga cabang 2 — produk A punya RETAIL + GROSIR, produk B hanya RETAIL
    queue.push([
      { productId: 100, uomId: 9, tierType: 'RETAIL', price: 120000 },
      { productId: 100, uomId: 9, tierType: 'GROSIR', price: 110000 },
      { productId: 200, uomId: 8, tierType: 'RETAIL', price: 8000 },
    ])
    // customer internal cabang tujuan
    queue.push([{ id: 77, name: 'Cabang Toko Depan' }])

    const { GET } = await import('./route')
    const res = await GET({} as never, ctx('5'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.destinationCustomerId).toBe(77)
    expect(json.items).toHaveLength(2)
    // Produk A: 60 base / 12 = 5 DUS tersedia, diminta 10 -> kurang. Semua tier ikut dibawa.
    expect(json.items[0]).toMatchObject({ currentQty: 5, qtyRequested: 10, insufficient: true, retailPrice: 120000 })
    expect(json.items[0].tierPrices).toEqual({ RETAIL: 120000, GROSIR: 110000 })
    // Produk B: 5 base tersedia, diminta 5 -> cukup
    expect(json.items[1]).toMatchObject({ currentQty: 5, qtyRequested: 5, insufficient: false, retailPrice: 8000 })
    expect(json.items[1].tierPrices).toEqual({ RETAIL: 8000 })
  })
})
