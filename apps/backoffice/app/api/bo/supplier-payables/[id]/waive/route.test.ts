import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: 'token' }) })),
}))

const verifyAccessToken = vi.fn()
vi.mock('@/lib/auth', () => ({ verifyAccessToken }))

const loadPendingPriceEstimates = vi.fn()
vi.mock('@/lib/po-pending-estimate', () => ({ loadPendingPriceEstimates }))

const selectResult = vi.fn()
const transaction = vi.fn()
vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          leftJoin: () => ({
            where: () => ({ limit: async () => selectResult() }),
          }),
        }),
      }),
    }),
    transaction,
  },
  supplierPayables: {
    id: 'sp.id', poId: 'sp.poId', status: 'sp.status', totalAmount: 'sp.total', paidAmount: 'sp.paid', supplierId: 'sp.supplierId',
  },
  purchaseOrders: { id: 'po.id', poNumber: 'po.number', status: 'po.status', branchId: 'po.branchId' },
  suppliers: { id: 's.id', name: 's.name' },
  auditLogs: {},
  eq: vi.fn((left, right) => ({ left, right })),
  and: vi.fn((...c) => ({ c })),
}))

function patch(body: unknown) {
  return new Request('http://test.local', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const openPayable = {
  id: 7, poId: 70, status: 'UNPAID', totalAmount: 3_250_000, paidAmount: 0,
  poNumber: 'PO-20261111-0001', poStatus: 'COMPLETED', branchId: 1, supplierName: 'Rekan A',
}

const ctx = { params: Promise.resolve({ id: '7' }) }

async function callPatch(body: unknown) {
  const { PATCH } = await import('./route')
  return PATCH(patch(body) as never, ctx)
}

describe('PATCH bebaskan hutang supplier', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    verifyAccessToken.mockResolvedValue({
      userId: 9, branchId: 1, role: 'GM', branchScope: 'OWN', permissions: ['payable.supplier_waive'],
    })
    selectResult.mockReturnValue([openPayable])
    loadPendingPriceEstimates.mockResolvedValue(new Map())
  })

  it('menolak pengguna tanpa hak payable.supplier_waive', async () => {
    verifyAccessToken.mockResolvedValue({
      userId: 9, branchId: 1, role: 'MANAGER', branchScope: 'OWN', permissions: ['payable.pay'],
    })
    const res = await callPatch({ reason: 'barang retur rekan' })
    expect(res.status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('menolak tanpa alasan, sebelum menyentuh data', async () => {
    const res = await callPatch({ reason: '   ' })
    expect(res.status).toBe(400)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('menolak hutang milik cabang lain untuk pengguna non-global', async () => {
    selectResult.mockReturnValue([{ ...openPayable, branchId: 2 }])
    const res = await callPatch({ reason: 'barang retur rekan' })
    expect(res.status).toBe(403)
    expect(transaction).not.toHaveBeenCalled()
  })

  it.each([
    ['sudah dibayar sebagian', { status: 'PARTIAL', paidAmount: 1_000_000 }],
    ['sudah lunas', { status: 'PAID', paidAmount: 3_250_000 }],
    ['sudah dibebaskan', { status: 'WAIVED' }],
    ['PO belum Selesai', { poStatus: 'FULLY_RECEIVED' }],
  ])('menolak hutang yang %s', async (_label, patchData) => {
    selectResult.mockReturnValue([{ ...openPayable, ...patchData }])
    const res = await callPatch({ reason: 'barang retur rekan' })
    expect(res.status).toBe(409)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('menolak bila harga faktur belum lengkap', async () => {
    loadPendingPriceEstimates.mockResolvedValue(new Map([[70, { pendingItems: 2, extraEstimate: 0 }]]))
    const res = await callPatch({ reason: 'barang retur rekan' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('2 barang')
    expect(transaction).not.toHaveBeenCalled()
  })

  it('mengubah status ke WAIVED dan merekam alasan di audit SUPPLIER_PAYABLE_WAIVED', async () => {
    const updates: Record<string, unknown>[] = []
    const audits: Record<string, unknown>[] = []
    transaction.mockImplementation(async (cb) => cb({
      update: () => ({
        set: (v: Record<string, unknown>) => {
          updates.push(v)
          return { where: () => ({ returning: async () => [{ ...openPayable, status: 'WAIVED' }] }) }
        },
      }),
      insert: () => ({ values: async (v: Record<string, unknown>) => { audits.push(v) } }),
    }))

    const res = await callPatch({ reason: '  Barang retur modal owner ke rekan  ' })
    expect(res.status).toBe(200)
    expect(updates).toEqual([{ status: 'WAIVED' }])
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({
      action: 'SUPPLIER_PAYABLE_WAIVED', tableName: 'supplier_payables', recordId: '7', branchId: 1, userId: 9,
    })
    expect(JSON.parse(audits[0].newData as string)).toMatchObject({
      status: 'WAIVED', reason: 'Barang retur modal owner ke rekan', poNumber: 'PO-20261111-0001', waivedAmount: 3_250_000,
    })
  })

  it('409 tanpa audit bila status berubah bersamaan (mis. baru saja dibayar)', async () => {
    const audits: unknown[] = []
    transaction.mockImplementation(async (cb) => cb({
      update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
      insert: () => ({ values: async (v: unknown) => { audits.push(v) } }),
    }))
    const res = await callPatch({ reason: 'barang retur rekan' })
    expect(res.status).toBe(409)
    expect(audits).toHaveLength(0)
  })
})
