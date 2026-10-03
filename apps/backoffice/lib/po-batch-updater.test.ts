vi.mock('./db', async () => ({ ...(await import('@petshop/db')), db: {} }))
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { purchaseOrders, purchaseOrderItems } from '@petshop/db'

const { addStock, syncCost } = vi.hoisted(() => ({ addStock: vi.fn(), syncCost: vi.fn() }))
vi.mock('./services/stock-service', () => ({ StockService: { addStock } }))
vi.mock('./services/cost-sync-service', () => ({ syncCostFromInbound: syncCost }))
vi.mock('./services/stock-lock', () => ({ lockProductStocks: vi.fn().mockResolvedValue(undefined) }))
import { applyPOReceivingBatches } from './po-batch-updater'

function fixture(status: string) {
  const events: string[] = []
  const tx = {
    select: () => ({ from: (table: unknown) => {
      const rows = table === purchaseOrders ? [{ id: 1, branchId: 2, status, supplierId: 3, poNumber: 'PO-TES' }]
        : table === purchaseOrderItems ? [{ productId: 1, uomId: 1, qtyReceived: 2, qtyDamaged: 0, unitCost: 100 }] : []
      const chain: any = { where: () => chain, limit: () => chain, for: () => { events.push('header-lock'); return chain },
        then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject) }
      return chain
    } }),
    insert: () => ({ values: async () => { events.push('insert') } }),
    update: () => ({ set: () => ({ where: async () => { events.push('update') } }) }),
  }
  return { db: { transaction: async (callback: any) => callback(tx) }, events }
}

beforeEach(() => { vi.clearAllMocks() })

describe('approval penerimaan PO', () => {
  it.each(['COMPLETED', 'FULLY_RECEIVED', 'DRAFT', 'CANCELLED', 'APPROVED', 'IN_TRANSIT'])('status %s ditolak sebelum menambah stok/payable', async status => {
    const { db, events } = fixture(status)
    await expect(applyPOReceivingBatches(db, 1, 1)).rejects.toThrow()
    expect(addStock).not.toHaveBeenCalled()
    expect(events).toEqual(['header-lock'])
  })
  it('PARTIALLY_RECEIVED valid, header dikunci dan cost sync tetap di transaksi', async () => {
    const { db, events } = fixture('PARTIALLY_RECEIVED')
    await applyPOReceivingBatches(db, 1, 1)
    expect(events[0]).toBe('header-lock')
    expect(addStock).toHaveBeenCalledTimes(1)
    expect(syncCost).toHaveBeenCalledTimes(1)
  })
})
