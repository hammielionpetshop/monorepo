import { beforeEach, describe, expect, it, vi } from 'vitest'

const { approve, permission } = vi.hoisted(() => ({ approve: vi.fn(), permission: vi.fn() }))
vi.mock('@/lib/authz', () => ({ requirePermission: permission }))
vi.mock('@/lib/po-batch-updater', () => ({ applyPOReceivingBatches: approve }))
vi.mock('@/lib/db', async () => ({ ...(await import('@petshop/db')), db: { select: () => {
  const chain: any = { from: () => chain, where: () => chain, limit: async () => [{ id: 1 }] }
  return chain
} } }))
import { StockConflictError } from '@/lib/services/stock-validation'
import { PATCH } from './route'

beforeEach(() => { vi.clearAllMocks(); permission.mockResolvedValue({ userId: 1, branchId: 1, branchScope: 'ALL' }) })

describe('approval penerimaan PO HTTP', () => {
  it('persetujuan sukses memberi 200', async () => {
    approve.mockResolvedValue(undefined)
    expect((await PATCH(new Request('http://localhost'), { params: Promise.resolve({ id: '1' }) })).status).toBe(200)
  })
  it('approval ulang dan status tidak valid memberi 409', async () => {
    approve.mockRejectedValue(new StockConflictError('Penerimaan PO sudah disetujui'))
    const response = await PATCH(new Request('http://localhost'), { params: Promise.resolve({ id: '1' }) })
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Penerimaan PO sudah disetujui' })
  })
})
