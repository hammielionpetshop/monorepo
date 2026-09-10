import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyAccessToken = vi.fn()
const hasPermission = vi.fn()
const getPosBranchId = vi.fn()

const cookieStore = {
  get: vi.fn((name: string) => (name === 'accessToken' ? { value: 'token' } : undefined)),
}

const selectQueue: unknown[] = []
const updateQueue: unknown[] = []
function selectChain() {
  const c: Record<string, unknown> = {}
  for (const m of ['from', 'where', 'limit']) c[m] = vi.fn(() => c)
  c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(selectQueue.shift() ?? []).then(res, rej)
  return c
}
function updateChain() {
  const c: Record<string, unknown> = {}
  for (const m of ['set', 'where']) c[m] = vi.fn(() => c)
  c.returning = vi.fn(() => Promise.resolve(updateQueue.shift() ?? []))
  return c
}
const db = { select: vi.fn(() => selectChain()), update: vi.fn(() => updateChain()) }

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieStore) }))
vi.mock('@/lib/auth', () => ({ verifyAccessToken }))
vi.mock('@/lib/authz', () => ({ hasPermission }))
vi.mock('@/lib/pos-branch', () => ({ getPosBranchId }))
vi.mock('@/lib/db', () => ({
  db,
  interBranchTransfers: { id: 'ibt.id', sourceBranchId: 'ibt.src', status: 'ibt.status', convertedTransactionId: 'ibt.conv' },
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...c) => ({ and: c })),
  inArray: vi.fn((a, b) => ({ inArray: [a, b] })),
}))

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  selectQueue.length = 0
  updateQueue.length = 0
  verifyAccessToken.mockResolvedValue({ userId: 7, permissions: ['internal_transfer.process_pos'] })
  hasPermission.mockReturnValue(true)
  getPosBranchId.mockReturnValue(2)
  db.select.mockImplementation(() => selectChain())
  db.update.mockImplementation(() => updateChain())
})

describe('PATCH /api/pos/internal-po/[id]/cancel', () => {
  it('403 tanpa permission', async () => {
    hasPermission.mockReturnValueOnce(false)
    const { PATCH } = await import('./route')
    const res = await PATCH({} as never, ctx('5'))
    expect(res.status).toBe(403)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('404 bila PO tidak ada', async () => {
    selectQueue.push([])
    const { PATCH } = await import('./route')
    const res = await PATCH({} as never, ctx('5'))
    expect(res.status).toBe(404)
  })

  it('403 bila cabang pengirim bukan cabang sesi', async () => {
    selectQueue.push([{ id: 5, sourceBranchId: 99, status: 'PENDING_APPROVAL', convertedTransactionId: null }])
    const { PATCH } = await import('./route')
    const res = await PATCH({} as never, ctx('5'))
    expect(res.status).toBe(403)
  })

  it('409 bila sudah dikonversi jadi transaksi', async () => {
    selectQueue.push([{ id: 5, sourceBranchId: 2, status: 'APPROVED', convertedTransactionId: 88 }])
    const { PATCH } = await import('./route')
    const res = await PATCH({} as never, ctx('5'))
    expect(res.status).toBe(409)
    expect(db.update).not.toHaveBeenCalled()
  })

  it('409 bila status tidak lagi cancellable', async () => {
    selectQueue.push([{ id: 5, sourceBranchId: 2, status: 'IN_TRANSIT', convertedTransactionId: null }])
    const { PATCH } = await import('./route')
    const res = await PATCH({} as never, ctx('5'))
    expect(res.status).toBe(409)
  })

  it('membatalkan PO yang masih PENDING_APPROVAL', async () => {
    selectQueue.push([{ id: 5, sourceBranchId: 2, status: 'PENDING_APPROVAL', convertedTransactionId: null }])
    updateQueue.push([{ id: 5, status: 'CANCELLED' }])
    const { PATCH } = await import('./route')
    const res = await PATCH({} as never, ctx('5'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toMatchObject({ id: 5, status: 'CANCELLED' })
  })

  it('409 bila optimistic lock gagal (status keburu berubah)', async () => {
    selectQueue.push([{ id: 5, sourceBranchId: 2, status: 'PENDING_APPROVAL', convertedTransactionId: null }])
    updateQueue.push([]) // returning kosong
    const { PATCH } = await import('./route')
    const res = await PATCH({} as never, ctx('5'))
    expect(res.status).toBe(409)
  })
})
