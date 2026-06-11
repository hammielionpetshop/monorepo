import { beforeEach, describe, expect, it, vi } from 'vitest'

const { selectQueues, insertValues, stockServiceCalls } = vi.hoisted(() => {
  const selectQueues: unknown[][] = []
  const insertValues: unknown[] = []
  const stockServiceCalls: unknown[][] = []
  return { selectQueues, insertValues, stockServiceCalls }
})

vi.mock('./services/stock-service', () => ({
  StockService: {
    addStock: vi.fn((...args: unknown[]) => {
      stockServiceCalls.push(args)
      return Promise.resolve()
    }),
    deductStock: vi.fn(),
  },
}))

vi.mock('./db', () => ({
  db: { transaction: vi.fn() },
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
    qtyRemaining: 'product_stock_batches.qty_remaining',
    receivedAt: 'product_stock_batches.received_at',
  },
  auditLogs: {},
  stockAdjustments: {},
  productUomCosts: {
    productId: 'product_uom_costs.product_id',
    branchId: 'product_uom_costs.branch_id',
    uomId: 'product_uom_costs.uom_id',
    costPrice: 'product_uom_costs.cost_price',
  },
  eq: vi.fn().mockReturnValue('eq'),
  and: vi.fn().mockReturnValue('and'),
  desc: vi.fn().mockReturnValue('desc'),
  asc: vi.fn().mockReturnValue('asc'),
  sql: vi.fn().mockReturnValue('sql'),
}))

import { applyManualStockAdjustment, applySOStockAdjustment, type Tx } from './stock-adjustment'

function makeTx(): Tx {
  const tx = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          for: vi.fn().mockResolvedValue([]),
          limit: vi.fn().mockResolvedValue(selectQueues.shift() ?? []),
        }),
        orderBy: vi.fn().mockReturnValue({
          for: vi.fn().mockResolvedValue(selectQueues.shift() ?? []),
        }),
      }),
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

  return tx as unknown as Tx
}

describe('stock adjustment default UOM costs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectQueues.length = 0
    insertValues.length = 0
    stockServiceCalls.length = 0
  })

  it('stock opname positive variance opts in to default UOM cost', async () => {
    const tx = makeTx()

    await applySOStockAdjustment(tx, {
      productId: 7,
      branchId: 2,
      uomId: 10,
      systemQty: 5,
      physicalQty: 8,
      currentUserId: 3,
    })

    expect(stockServiceCalls[0]).toEqual([
      tx,
      2,
      7,
      10,
      '3',
      '0',
      undefined,
      undefined,
      { useDefaultUomCost: true },
    ])
  })

  it('manual stock addition uses default UOM cost when explicit cost is omitted', async () => {
    selectQueues.push([{ costPrice: 22000 }], [])
    const tx = makeTx()

    await applyManualStockAdjustment(tx, {
      productId: 7,
      branchId: 2,
      uomId: 10,
      previousQty: '5',
      newQty: '8',
      reason: 'Koreksi stok masuk',
      adjustedById: 3,
    })

    expect(insertValues[0]).toMatchObject({ costPrice: 22000 })
  })

  it('manual stock addition keeps explicit cost when provided', async () => {
    selectQueues.push([])
    const tx = makeTx()

    await applyManualStockAdjustment(tx, {
      productId: 7,
      branchId: 2,
      uomId: 10,
      previousQty: '5',
      newQty: '8',
      reason: 'Koreksi stok masuk',
      adjustedById: 3,
      costPricePerUnit: 19000,
    })

    expect(insertValues[0]).toMatchObject({ costPrice: 19000 })
  })
})
