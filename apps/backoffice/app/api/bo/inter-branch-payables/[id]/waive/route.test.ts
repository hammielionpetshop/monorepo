import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: 'token' }) })),
}))

const verifyAccessToken = vi.fn()
vi.mock('@/lib/auth', () => ({ verifyAccessToken }))

const selectResult = vi.fn()
const transaction = vi.fn()
vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({ limit: async () => selectResult() }),
        }),
      }),
    }),
    transaction,
  },
  interBranchPayables: {
    id: 'ibp.id', status: 'ibp.status', creditorBranchId: 'ibp.creditor', debtorBranchId: 'ibp.debtor',
    totalAmount: 'ibp.total', paidAmount: 'ibp.paid', notes: 'ibp.notes', transferId: 'ibp.transferId',
  },
  interBranchTransfers: { id: 'ibt.id', ibtNumber: 'ibt.number' },
  auditLogs: {},
  eq: vi.fn((left, right) => ({ left, right })),
  and: vi.fn((...c) => ({ c })),
  sql: vi.fn(() => ({})),
}))

function patch(body: unknown) {
  return new Request('http://test.local', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const openPayable = {
  id: 5, status: 'UNPAID', creditorBranchId: 1, debtorBranchId: 2,
  totalAmount: 10150000, paidAmount: 0, notes: null, ibtNumber: 'IBT-1',
}

describe('PATCH hapus hutang internal', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    verifyAccessToken.mockResolvedValue({
      userId: 9, branchId: 1, role: 'GM', branchScope: 'OWN', permissions: ['payable.waive'],
    })
    selectResult.mockReturnValue([openPayable])
  })

  it('menolak tanpa alasan, sebelum menyentuh data', async () => {
    const { PATCH } = await import('./route')
    const res = await PATCH(patch({ reason: '  ' }) as never, { params: Promise.resolve({ id: '5' }) })
    expect(res.status).toBe(400)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('menolak cabang yang bukan pengirim (kreditur)', async () => {
    verifyAccessToken.mockResolvedValue({
      userId: 9, branchId: 2, role: 'GM', branchScope: 'OWN', permissions: ['payable.waive'],
    })
    const { PATCH } = await import('./route')
    const res = await PATCH(patch({ reason: 'salah satuan' }) as never, { params: Promise.resolve({ id: '5' }) })
    expect(res.status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('menyimpan alasan di catatan dan merekam audit IBP_WAIVED', async () => {
    const updates: Record<string, unknown>[] = []
    const audits: Record<string, unknown>[] = []
    transaction.mockImplementation(async (cb) => cb({
      update: () => ({
        set: (v: Record<string, unknown>) => {
          updates.push(v)
          return { where: () => ({ returning: async () => [{ id: 5, status: 'WAIVED' }] }) }
        },
      }),
      insert: () => ({ values: async (v: Record<string, unknown>) => { audits.push(v) } }),
    }))

    const { PATCH } = await import('./route')
    const res = await PATCH(patch({ reason: 'salah satuan' }) as never, { params: Promise.resolve({ id: '5' }) })

    expect(res.status).toBe(200)
    expect(updates[0]).toMatchObject({ status: 'WAIVED', notes: 'Dihapus: salah satuan' })
    expect(audits[0]).toMatchObject({ action: 'IBP_WAIVED', userId: 9, recordId: '5' })
    expect(JSON.parse(audits[0].newData as string)).toMatchObject({ reason: 'salah satuan', waivedAmount: 10150000 })
  })
})
