import { beforeEach, describe, expect, it, vi } from 'vitest'

const { permission, state } = vi.hoisted(() => ({
  permission: vi.fn(),
  state: {
    poStatus: 'PARTIALLY_RECEIVED',
    payable: false,
    batch: false,
    deletes: [] as unknown[],
    updates: [] as Record<string, unknown>[],
    audits: [] as Record<string, unknown>[],
  },
}))

vi.mock('@/lib/authz', () => ({ requirePermission: permission }))
vi.mock('@/lib/db', async () => {
  const schema = await import('@petshop/db')
  const rowsFor = (table: unknown) => {
    if (table === schema.purchaseOrders) return [{ id: 7, poNumber: 'PO-7', branchId: 1, status: state.poStatus }]
    if (table === schema.supplierPayables) return state.payable ? [{ id: 1 }] : []
    if (table === schema.productStockBatches) return state.batch ? [{ id: 1 }] : []
    if (table === schema.purchaseOrderItems) return [{ id: 1, productId: 3, qtyReceived: 2, qtyDamaged: 0, invoiceUnitCost: 0 }]
    if (table === schema.poReceivingLogs) return [{ id: 11 }]
    return []
  }
  const select = () => ({
    from: (table: unknown) => {
      const rows = rowsFor(table)
      const chain: any = { where: () => chain, for: () => chain, limit: () => chain,
        then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject) }
      return chain
    },
  })
  const tx = {
    select,
    delete: (table: unknown) => ({ where: async () => { state.deletes.push(table) } }),
    update: () => ({ set: (v: Record<string, unknown>) => { state.updates.push(v); return { where: async () => [] } } }),
    insert: () => ({ values: async (v: Record<string, unknown>) => { state.audits.push(v) } }),
  }
  return { ...schema, db: { transaction: async (cb: any) => cb(tx) } }
})

import { POST } from './route'

function cancel(body: unknown = { reason: 'salah ketik qty' }) {
  return POST(
    new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: '7' }) },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(state, { poStatus: 'PARTIALLY_RECEIVED', payable: false, batch: false, deletes: [], updates: [], audits: [] })
  permission.mockResolvedValue({ userId: 5, branchId: 1, branchScope: 'ALL' })
})

describe('batalkan input penerimaan PO', () => {
  it('alasan wajib', async () => {
    expect((await cancel({ reason: ' ' })).status).toBe(400)
    expect(state.updates).toHaveLength(0)
  })

  it('PO yang penerimaannya sudah disetujui ditolak', async () => {
    state.poStatus = 'COMPLETED'
    expect((await cancel()).status).toBe(409)
    expect(state.deletes).toHaveLength(0)
  })

  it('stok/hutang sudah ada → ditolak tanpa menghapus apa pun', async () => {
    state.batch = true
    expect((await cancel()).status).toBe(409)
    expect(state.deletes).toHaveLength(0)
  })

  it('berhasil: catatan penerimaan dihapus, qty direset, PO kembali Disetujui, audit tercatat', async () => {
    expect((await cancel()).status).toBe(200)
    expect(state.deletes).toHaveLength(2)
    expect(state.updates).toContainEqual({ qtyReceived: 0, qtyDamaged: 0, expiryDate: null })
    expect(state.updates.some(u => u.status === 'APPROVED')).toBe(true)
    expect(state.audits[0]).toMatchObject({ action: 'PO_RECEIVING_CANCELLED', userId: 5, recordId: '7' })
    expect(JSON.parse(state.audits[0].newData as string)).toMatchObject({ reason: 'salah ketik qty' })
  })
})
