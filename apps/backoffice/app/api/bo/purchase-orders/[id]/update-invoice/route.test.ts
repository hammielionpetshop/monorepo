import { beforeEach, describe, expect, it, vi } from 'vitest'

const { permission, poWhere } = vi.hoisted(() => ({ permission: vi.fn(), poWhere: vi.fn() }))

vi.mock('@/lib/authz', () => ({ requirePermission: permission }))
vi.mock('@/lib/services/cost-sync-service', () => ({ syncCostFromInbound: vi.fn() }))
vi.mock('@/lib/db', async () => {
  const schema = await import('@petshop/db')
  const tx = {
    update: (table: unknown) => ({
      set: () => ({
        where: (cond: unknown) => {
          if (table === schema.purchaseOrders) poWhere(cond)
          const result = Promise.resolve([]) as unknown as Promise<unknown[]> & { returning: () => Promise<unknown[]> }
          result.returning = async () =>
            table === schema.purchaseOrders ? [{ id: 1, branchId: 3, poNumber: 'PO-1' }] : [{ id: 11 }]
          return result
        },
      }),
    }),
    query: { purchaseOrderItems: { findMany: async () => [] } },
  }
  return {
    ...schema,
    eq: (col: { name?: string }, value: unknown) => ({ eq: [col?.name, value] }),
    and: (...conds: unknown[]) => ({ and: conds }),
    db: { transaction: async (cb: (t: typeof tx) => unknown) => cb(tx) },
  }
})

import { PATCH } from './route'

function call() {
  return PATCH(
    new Request('http://localhost', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invoiceNumber: 'INV-9', items: [{ id: 11, invoiceUnitCost: 420000 }] }),
    }),
    { params: Promise.resolve({ id: '1' }) },
  )
}

beforeEach(() => vi.clearAllMocks())

describe('PATCH update-invoice — cakupan cabang', () => {
  it('OWNER/GM (scope ALL) boleh PO cabang mana pun — tidak dibatasi ke cabang di token', async () => {
    permission.mockResolvedValue({ userId: 1, branchId: 1, branchScope: 'ALL' })
    expect((await call()).status).toBe(200)
    expect(poWhere).toHaveBeenCalledWith({ eq: ['id', 1] })
  })

  it('staf cabang (scope OWN) hanya PO cabangnya sendiri', async () => {
    permission.mockResolvedValue({ userId: 2, branchId: 3, branchScope: 'OWN' })
    expect((await call()).status).toBe(200)
    expect(poWhere).toHaveBeenCalledWith({ and: [{ eq: ['id', 1] }, { eq: ['branch_id', 3] }] })
  })
})
