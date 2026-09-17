import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyAccessToken = vi.fn()
const hasPermission = vi.fn()
const getPosBranchId = vi.fn()
const resolveBulkSaleQtyByItem = vi.fn()

const cookieStore = {
  get: vi.fn((name: string) => (name === 'accessToken' ? { value: 'token' } : undefined)),
}

const outerSelectQueue: unknown[] = []
const txSelectQueue: unknown[] = []
const txUpdateReturningQueue: unknown[] = []
const itemUpdates: Record<string, unknown>[] = []

function outerSelectChain() {
  const c: Record<string, unknown> = {}
  for (const m of ['from', 'where', 'limit']) c[m] = vi.fn(() => c)
  c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(outerSelectQueue.shift() ?? []).then(res, rej)
  return c
}

function txSelectChain() {
  const c: Record<string, unknown> = {}
  for (const m of ['from', 'where', 'limit']) c[m] = vi.fn(() => c)
  c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(txSelectQueue.shift() ?? []).then(res, rej)
  return c
}

function txUpdateChain() {
  const c: Record<string, unknown> = {}
  let lastSet: Record<string, unknown> = {}
  c.set = vi.fn((v: Record<string, unknown>) => {
    lastSet = v
    return c
  })
  c.where = vi.fn(() => c)
  c.returning = vi.fn(() => Promise.resolve(txUpdateReturningQueue.shift() ?? []))
  c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
    if ('qtyShipped' in lastSet) itemUpdates.push(lastSet)
    return Promise.resolve(undefined).then(res, rej)
  }
  return c
}

const db = {
  select: vi.fn(() => outerSelectChain()),
  transaction: vi.fn(),
}

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieStore) }))
vi.mock('@/lib/auth', () => ({ verifyAccessToken }))
vi.mock('@/lib/authz', () => ({ hasPermission }))
vi.mock('@/lib/pos-branch', () => ({ getPosBranchId }))
vi.mock('@/lib/services/ibt-bulk-sale-match', () => ({ resolveBulkSaleQtyByItem }))
vi.mock('@/lib/db', () => ({
  db,
  interBranchTransfers: { id: 'ibt.id', sourceBranchId: 'ibt.src', status: 'ibt.status', convertedTransactionId: 'ibt.conv' },
  interBranchTransferItems: { id: 'ibti.id', transferId: 'ibti.transferId', productId: 'ibti.productId', uomId: 'ibti.uomId' },
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...c) => ({ and: c })),
}))

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

function makeTx() {
  return { select: vi.fn(() => txSelectChain()), update: vi.fn(() => txUpdateChain()) }
}

beforeEach(() => {
  vi.clearAllMocks()
  outerSelectQueue.length = 0
  txSelectQueue.length = 0
  txUpdateReturningQueue.length = 0
  itemUpdates.length = 0
  verifyAccessToken.mockResolvedValue({ userId: 7, permissions: ['internal_transfer.process_pos'] })
  hasPermission.mockReturnValue(true)
  getPosBranchId.mockReturnValue(2)
  db.select.mockImplementation(() => outerSelectChain())
  db.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(makeTx()))
})

describe('PATCH /api/pos/internal-po/[id]/ship', () => {
  it('401 tanpa sesi', async () => {
    verifyAccessToken.mockResolvedValueOnce(null)
    const { PATCH } = await import('./route')
    const res = await PATCH({} as never, ctx('5'))
    expect(res.status).toBe(401)
  })

  it('403 tanpa permission', async () => {
    hasPermission.mockReturnValueOnce(false)
    const { PATCH } = await import('./route')
    const res = await PATCH({} as never, ctx('5'))
    expect(res.status).toBe(403)
  })

  it('400 id tidak valid', async () => {
    const { PATCH } = await import('./route')
    const res = await PATCH({} as never, ctx('abc'))
    expect(res.status).toBe(400)
  })

  it('404 bila PO tidak ada', async () => {
    outerSelectQueue.push([])
    const { PATCH } = await import('./route')
    const res = await PATCH({} as never, ctx('5'))
    expect(res.status).toBe(404)
  })

  it('403 bila cabang pengirim bukan cabang sesi', async () => {
    outerSelectQueue.push([{ id: 5, sourceBranchId: 99, status: 'APPROVED', convertedTransactionId: 88 }])
    const { PATCH } = await import('./route')
    const res = await PATCH({} as never, ctx('5'))
    expect(res.status).toBe(403)
  })

  it('409 bila belum diproses jadi transaksi (convertedTransactionId kosong)', async () => {
    outerSelectQueue.push([{ id: 5, sourceBranchId: 2, status: 'APPROVED', convertedTransactionId: null }])
    const { PATCH } = await import('./route')
    const res = await PATCH({} as never, ctx('5'))
    expect(res.status).toBe(409)
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('409 bila status bukan APPROVED', async () => {
    outerSelectQueue.push([{ id: 5, sourceBranchId: 2, status: 'IN_TRANSIT', convertedTransactionId: 88 }])
    const { PATCH } = await import('./route')
    const res = await PATCH({} as never, ctx('5'))
    expect(res.status).toBe(409)
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('409 bila optimistic lock gagal (status keburu berubah)', async () => {
    outerSelectQueue.push([{ id: 5, sourceBranchId: 2, status: 'APPROVED', convertedTransactionId: 88 }])
    txSelectQueue.push([]) // lock check kosong = status sudah berubah
    const { PATCH } = await import('./route')
    const res = await PATCH({} as never, ctx('5'))
    expect(res.status).toBe(409)
  })

  it('mengunci qtyShipped dari resolveBulkSaleQtyByItem & menaikkan status ke IN_TRANSIT', async () => {
    outerSelectQueue.push([{ id: 5, sourceBranchId: 2, status: 'APPROVED', convertedTransactionId: 88 }])
    txSelectQueue.push([{ id: 5 }]) // lock check lolos
    txSelectQueue.push([
      { id: 1, productId: 10, uomId: 1 },
      { id: 2, productId: 20, uomId: 1 },
    ])
    resolveBulkSaleQtyByItem.mockResolvedValue(new Map([[1, 3], [2, 0]]))
    txUpdateReturningQueue.push([{ id: 5, status: 'IN_TRANSIT' }])

    const { PATCH } = await import('./route')
    const res = await PATCH({} as never, ctx('5'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({ id: 5, status: 'IN_TRANSIT' })
    expect(resolveBulkSaleQtyByItem).toHaveBeenCalledWith(
      expect.anything(),
      88,
      [{ id: 1, productId: 10, uomId: 1 }, { id: 2, productId: 20, uomId: 1 }],
    )
    expect(itemUpdates).toEqual([{ qtyShipped: 3 }, { qtyShipped: 0 }])
  })
})
