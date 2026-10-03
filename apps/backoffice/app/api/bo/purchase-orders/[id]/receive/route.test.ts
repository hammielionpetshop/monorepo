import { beforeEach, describe, expect, it, vi } from 'vitest'
import { purchaseOrders } from '@petshop/db'
const { insert, permission } = vi.hoisted(() => ({ insert: vi.fn(), permission: vi.fn() }))
let lockedStatus = 'APPROVED'
let received = 0
vi.mock('@/lib/authz', () => ({ requirePermission: permission }))
vi.mock('@/lib/db', async () => {
  const schema = await import('@petshop/db')
  const select = (inside: boolean) => ({ from: (table: unknown) => {
    const rows = table === schema.purchaseOrders ? [{ id: 1, status: inside ? lockedStatus : 'APPROVED' }]
      : [{ id: 1, qtyOrdered: 5, qtyReceived: received, qtyDamaged: 0 }]
    const chain: any = { where: () => chain, for: () => chain, limit: () => chain,
      then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject) }
    return chain
  } })
  return { ...schema, db: { select: () => select(false), transaction: async (callback: any) => callback({ select: () => select(true),
    insert: () => ({ values: (...args: any[]) => { insert(...args); return { returning: async () => [{ id: 1 }] } } }),
    update: () => ({ set: () => ({ where: async () => [] }) }),
  }) } }
})
import { POST } from './route'

beforeEach(() => { vi.clearAllMocks(); lockedStatus = 'APPROVED'; received = 0; permission.mockResolvedValue({ userId: 1, branchId: 1, branchScope: 'ALL' }) })
async function receive() {
  return POST(new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: [{ poItemId: 1, qtyReceived: 2, qtyDamaged: 0 }] }) }), { params: Promise.resolve({ id: '1' }) })
}
describe('pencatatan penerimaan PO BO', () => {
  it('penerimaan valid tercatat', async () => { expect((await receive()).status).toBe(200) })
  it('approval di sela precheck ditolak tanpa membuat receiving log', async () => {
    lockedStatus = 'COMPLETED'
    expect((await receive()).status).toBe(409)
    expect(insert).not.toHaveBeenCalled()
  })
  it('qty terbaru pada header terkunci dipakai untuk validasi sisa', async () => {
    received = 4
    expect((await receive()).status).toBe(400)
  })
})
