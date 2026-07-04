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

import { fifoDeduct } from '@petshop/shared'
import { StockService } from './stock-service'

const fifoDeductMock = vi.mocked(fifoDeduct)

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

describe('StockService.deductStock fallback HPP (G1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    calls.productUomCostSelects = 0
    selectQueues.length = 0
    insertValues.length = 0
  })

  function fifoResult(overrides: Partial<ReturnType<typeof fifoDeduct>> = {}) {
    return {
      success: true,
      deductions: [],
      totalCogs: 0,
      batchesAfter: [],
      shortfallQty: 0,
      ...overrides,
    }
  }

  function prefetched(overrides: Record<string, unknown> = {}) {
    return {
      product: { baseUomId: 10, defaultCostPrice: null },
      ratio: 1,
      batches: [],
      existingStock: { id: 99 },
      uomCosts: [],
      ...overrides,
    }
  }

  it('tanpa batch → HPP = qty × modal cost matrix UOM dasar', async () => {
    fifoDeductMock.mockReturnValue(fifoResult({ shortfallQty: 5 }))
    const tx = makeTx()

    const res = await StockService.deductStock(tx, 2, 7, 10, 5, true, prefetched({
      uomCosts: [{ uomId: 10, costPrice: 2000, ratio: 1 }],
    }))

    expect(res.totalCogs).toBe(10000)
  })

  it('modal hanya ada di UOM besar → dibagi ratio ke base UOM', async () => {
    fifoDeductMock.mockReturnValue(fifoResult({ shortfallQty: 24 }))
    const tx = makeTx()

    const res = await StockService.deductStock(tx, 2, 7, 10, 24, true, prefetched({
      uomCosts: [{ uomId: 20, costPrice: 62817, ratio: 24 }],
    }))

    expect(res.totalCogs).toBe(62817)
  })

  it('beberapa modal UOM besar → pakai ratio terbesar (satuan pembelian grosir)', async () => {
    fifoDeductMock.mockReturnValue(fifoResult({ shortfallQty: 100 }))
    const tx = makeTx()

    const res = await StockService.deductStock(tx, 2, 7, 10, 100, true, prefetched({
      uomCosts: [
        { uomId: 20, costPrice: 5000, ratio: 10 },
        { uomId: 21, costPrice: 40000, ratio: 100 },
      ],
    }))

    expect(res.totalCogs).toBe(40000)
  })

  it('tanpa cost matrix → fallback ke defaultCostPrice produk', async () => {
    fifoDeductMock.mockReturnValue(fifoResult({ shortfallQty: 4 }))
    const tx = makeTx()

    const res = await StockService.deductStock(tx, 2, 7, 10, 4, true, prefetched({
      product: { baseUomId: 10, defaultCostPrice: 1500 },
    }))

    expect(res.totalCogs).toBe(6000)
  })

  it('batch sebagian → HPP = FIFO + shortfall × fallback', async () => {
    fifoDeductMock.mockReturnValue(fifoResult({ totalCogs: 3000, shortfallQty: 2 }))
    const tx = makeTx()

    const res = await StockService.deductStock(tx, 2, 7, 10, 5, true, prefetched({
      uomCosts: [{ uomId: 10, costPrice: 2000, ratio: 1 }],
    }))

    expect(res.totalCogs).toBe(7000)
  })

  it('batch cukup tapi tanpa harga modal → HPP = covered × fallback', async () => {
    fifoDeductMock.mockReturnValue(fifoResult({ totalCogs: 0, shortfallQty: 0 }))
    const tx = makeTx()

    const res = await StockService.deductStock(tx, 2, 7, 10, 5, true, prefetched({
      uomCosts: [{ uomId: 10, costPrice: 2000, ratio: 1 }],
    }))

    expect(res.totalCogs).toBe(10000)
  })

  it('modal cost matrix bernilai 0 diabaikan → jatuh ke defaultCostPrice', async () => {
    fifoDeductMock.mockReturnValue(fifoResult({ shortfallQty: 3 }))
    const tx = makeTx()

    const res = await StockService.deductStock(tx, 2, 7, 10, 3, true, prefetched({
      product: { baseUomId: 10, defaultCostPrice: 1200 },
      uomCosts: [{ uomId: 10, costPrice: 0, ratio: 1 }],
    }))

    expect(res.totalCogs).toBe(3600)
  })

  it('tanpa sumber modal sama sekali → HPP tetap 0 (tidak error)', async () => {
    fifoDeductMock.mockReturnValue(fifoResult({ shortfallQty: 3 }))
    const tx = makeTx()

    const res = await StockService.deductStock(tx, 2, 7, 10, 3, true, prefetched())

    expect(res.totalCogs).toBe(0)
  })
})
