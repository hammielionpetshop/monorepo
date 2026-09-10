import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyAccessToken = vi.fn()
const hasPermission = vi.fn()
const getPosBranchId = vi.fn()

const cookieStore = {
  get: vi.fn((name: string) => (name === 'accessToken' ? { value: 'token' } : undefined)),
}

// Chain drizzle: setiap metode mengembalikan chain yang sama; `await` mengambil
// dataset berikutnya dari antrean FIFO `queue`.
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
vi.mock('@/lib/ibt-transfer-value', () => ({ ibtTransferValueSql: () => 'ibt_value_sql' }))
vi.mock('drizzle-orm/pg-core', () => ({ alias: (t: unknown) => t }))
vi.mock('@/lib/db', () => ({
  db,
  interBranchTransfers: { id: 'ibt.id', sourceBranchId: 'ibt.src', status: 'ibt.status', convertedTransactionId: 'ibt.conv', requestedById: 'ibt.reqBy', destinationBranchId: 'ibt.dst', ibtNumber: 'ibt.no', notes: 'ibt.notes', createdAt: 'ibt.createdAt' },
  interBranchTransferItems: { transferId: 'ibti.transferId' },
  branches: { id: 'branches.id', name: 'branches.name' },
  users: { id: 'users.id', name: 'users.name' },
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  and: vi.fn((...c) => ({ and: c })),
  inArray: vi.fn((a, b) => ({ inArray: [a, b] })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray) => ({ sql: strings.join('?') })),
    { raw: (s: string) => ({ raw: s }) },
  ),
  desc: vi.fn((c) => ({ desc: c })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  queue.length = 0
  verifyAccessToken.mockResolvedValue({ userId: 7, branchId: 2, role: 'KASIR' })
  hasPermission.mockReturnValue(true)
  getPosBranchId.mockReturnValue(2)
  db.select.mockImplementation(() => makeChain())
})

describe('GET /api/pos/internal-po', () => {
  it('401 bila tidak ada sesi', async () => {
    verifyAccessToken.mockResolvedValueOnce(null)
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(401)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('403 bila tidak punya permission internal_transfer.process_pos', async () => {
    hasPermission.mockReturnValueOnce(false)
    const { GET } = await import('./route')
    const res = await GET()
    expect(res.status).toBe(403)
    expect(db.select).not.toHaveBeenCalled()
  })

  it('mengembalikan daftar PO Internal masuk untuk cabang sesi', async () => {
    queue.push([
      {
        id: 11,
        ibtNumber: 'IBT-20260910-0001',
        status: 'PENDING_APPROVAL',
        destinationBranchId: 3,
        destinationBranchName: 'Toko Depan',
        requestedByName: 'Budi',
        notes: null,
        createdAt: new Date('2026-09-10T02:00:00Z'),
        totalValue: 150000,
        itemCount: 4,
      },
    ])
    const { GET } = await import('./route')
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(getPosBranchId).toHaveBeenCalled()
    expect(json).toHaveLength(1)
    expect(json[0]).toMatchObject({ id: 11, ibtNumber: 'IBT-20260910-0001', itemCount: 4, totalValue: 150000 })
  })
})
