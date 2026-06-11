import { beforeEach, describe, expect, it, vi } from 'vitest'

const { calls, selectQueues, insertValues } = vi.hoisted(() => {
  const calls = {
    productUomCostSelects: 0,
  }
  const selectQueues: unknown[][] = []
  const insertValues: unknown[] = []
  return { calls, selectQueues, insertValues }
})

vi.mock('../db', () => {
  const productUomCosts = {
    productId: 'product_uom_costs.product_id',
    branchId: 'product_uom_costs.branch_id',
    uomId: 'product_uom_costs.uom_id',
    costPrice: 'product_uom_costs.cost_price',
  }

  return {
    db: {},
    productStocks: {
      id: 'product_stocks.id',
      productId: 'product_stocks.product_id',
      branchId: 'product_stocks.branch_id',
      uomId: 'product_stocks.uom_id',
      qty: 'product_stocks.qty',
    },
    productStockBatches: {
      id: 'product_stock_batches.id',
      productId: 'product_stock_batches.product_id',
      branchId: 'product_stock_batches.branch_id',
      uomId: 'product_stock_batches.uom_id',
      qtyRemaining: 'product_stock_batches.qty_remaining',
      receivedAt: 'product_stock_batches.received_at',
    },
    products: {
      id: 'products.id',
      baseUomId: 'products.base_uom_id',
    },
    productUomConversions: {
      productId: 'product_uom_conversions.product_id',
      uomId: 'product_uom_conversions.uom_id',
      ratio: 'product_uom_conversions.ratio',
    },
    productUomCosts,
    eq: vi.fn().mockReturnValue('eq'),
    and: vi.fn().mockReturnValue('and'),
    sql: vi.fn().mockReturnValue('sql'),
    asc: vi.fn().mockReturnValue('asc'),
  }
})

vi.mock('@petshop/shared', () => ({
  fifoDeduct: vi.fn(),
}))

import { StockService } from './stock-service'

function makeTx() {
  return {
    select: vi.fn((shape?: Record<string, unknown>) => {
      if (shape?.costPrice === 'product_uom_costs.cost_price') {
        calls.productUomCostSelects += 1
      }

      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(selectQueues.shift() ?? []),
          }),
        }),
      }
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn((value) => {
        insertValues.push(value)
        return Promise.resolve([])
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  }
}

describe('StockService.addStock default UOM cost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    calls.productUomCostSelects = 0
    selectQueues.length = 0
    insertValues.length = 0
  })

  it('uses branch UOM cost when opted in and provided cost is zero', async () => {
    selectQueues.push([{ baseUomId: 10 }], [{ costPrice: 25000 }], [])
    const tx = makeTx()

    await StockService.addStock(tx, 2, 7, 10, '3', '0', undefined, undefined, { useDefaultUomCost: true })

    expect(calls.productUomCostSelects).toBe(1)
    expect(insertValues[0]).toMatchObject({ costPrice: 25000 })
  })

  it('keeps explicit non-zero cost even when opted in', async () => {
    selectQueues.push([{ baseUomId: 10 }], [])
    const tx = makeTx()

    await StockService.addStock(tx, 2, 7, 10, '3', '18000', undefined, undefined, { useDefaultUomCost: true })

    expect(calls.productUomCostSelects).toBe(0)
    expect(insertValues[0]).toMatchObject({ costPrice: 18000 })
  })

  it('keeps zero cost when not opted in', async () => {
    selectQueues.push([{ baseUomId: 10 }], [])
    const tx = makeTx()

    await StockService.addStock(tx, 2, 7, 10, '3', '0')

    expect(calls.productUomCostSelects).toBe(0)
    expect(insertValues[0]).toMatchObject({ costPrice: 0 })
  })
})
