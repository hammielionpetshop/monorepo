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
    stockShortfalls: {
      id: 'stock_shortfalls.id',
      productId: 'stock_shortfalls.product_id',
      branchId: 'stock_shortfalls.branch_id',
      qtyRemaining: 'stock_shortfalls.qty_remaining',
      costPricePerUnit: 'stock_shortfalls.cost_price_per_unit',
      sourceTransactionItemId: 'stock_shortfalls.source_transaction_item_id',
      closedAt: 'stock_shortfalls.closed_at',
      writtenOffAt: 'stock_shortfalls.written_off_at',
      createdAt: 'stock_shortfalls.created_at',
    },
    stockShortfallClearings: {
      id: 'stock_shortfall_clearings.id',
      shortfallId: 'stock_shortfall_clearings.shortfall_id',
    },
    transactionItems: {
      id: 'transaction_items.id',
      cogs: 'transaction_items.cogs',
      originalCogs: 'transaction_items.original_cogs',
    },
    eq: vi.fn().mockReturnValue('eq'),
    and: vi.fn().mockReturnValue('and'),
    sql: vi.fn().mockReturnValue('sql'),
    asc: vi.fn().mockReturnValue('asc'),
    isNull: vi.fn().mockReturnValue('isNull'),
  }
})

vi.mock('@petshop/shared', () => ({
  fifoDeduct: vi.fn(),
}))

import { fifoDeduct } from '@petshop/shared'
import { sql, products, productStocks, productStockBatches, stockShortfalls, stockShortfallClearings, transactionItems } from '../db'
import { StockService, settleOpenShortfalls, closeOpenShortfallsForRecount } from './stock-service'

const fifoDeductMock = vi.mocked(fifoDeduct)
const sqlMock = vi.mocked(sql as unknown as (...args: unknown[]) => unknown)

function makeTx() {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
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
        // Dual-use: sebagian pemanggil cuma `await`, sebagian lagi rantai `.returning()`
        // (addStock butuh id batch yang baru diinsert untuk pengurangan qtyRemaining).
        return Object.assign(Promise.resolve([]), {
          returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        })
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

  // Baris agregat ditulis lewat sql`...${productStocks.qty} - ${n}...`, jadi nilai yang
  // benar-benar dipotong dibaca dari argumen template itu — bukan dari string SQL-nya.
  function aggregateSqlCall() {
    const call = sqlMock.mock.calls.find((args) => args[1] === 'product_stocks.qty')
    if (!call) return null
    const [, , operand] = call as [string[], unknown, number]
    return { operand }
  }

  // Varian tx yang mendukung insert(...).values(...).returning() — dipakai saat baris
  // agregat belum ada dan deductStock membuatnya.
  function makeDeductTx() {
    const tx = makeTx()
    tx.insert = vi.fn().mockReturnValue({
      values: vi.fn((value) => {
        insertValues.push(value)
        return { returning: vi.fn().mockResolvedValue([{ id: 123, ...(value as object) }]) }
      }),
    }) as unknown as typeof tx.insert
    return tx
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

  it('oversell memotong agregat penuh (bukan cuma coveredQty) — dilacak lewat stock_shortfalls, bukan dibuang', async () => {
    // Minta 5, batch cuma punya 3 → batch turun 3 (fisik nyata), tapi agregat turun 5 PENUH.
    // Selisih 2 (shortfall) sekarang berjejak lewat ledger, bukan hilang diam-diam seperti
    // sebelumnya — lihat komentar invarian di StockService.deductStock.
    fifoDeductMock.mockReturnValue(
      fifoResult({ deductions: [{ batchId: 1, qtyDeducted: 3, costPrice: 100, totalCost: 300 }], totalCogs: 300, shortfallQty: 2 })
    )
    const tx = makeTx()

    const res = await StockService.deductStock(tx, 2, 7, 10, 5, true, prefetched({
      batches: [{ id: 1, qtyRemaining: '3', costPrice: '100', receivedAt: new Date() }],
    }))

    expect(aggregateSqlCall()).toMatchObject({ operand: 5 })
    expect(res.shortfallQty).toBe(2)
  })

  it('stok cukup → agregat turun sebesar qty yang diminta', async () => {
    fifoDeductMock.mockReturnValue(
      fifoResult({ deductions: [{ batchId: 1, qtyDeducted: 5, costPrice: 100, totalCost: 500 }], totalCogs: 500, shortfallQty: 0 })
    )
    const tx = makeTx()

    await StockService.deductStock(tx, 2, 7, 10, 5, true, prefetched({
      batches: [{ id: 1, qtyRemaining: '9', costPrice: '100', receivedAt: new Date() }],
    }))

    expect(aggregateSqlCall()).toMatchObject({ operand: 5 })
  })

  it('qty dalam UOM besar → agregat turun dalam base UOM, bukan qty mentah', async () => {
    // 2 DUS × ratio 12 = 24 base; batch menutup semuanya.
    fifoDeductMock.mockReturnValue(
      fifoResult({ deductions: [{ batchId: 1, qtyDeducted: 24, costPrice: 100, totalCost: 2400 }], totalCogs: 2400, shortfallQty: 0 })
    )
    const tx = makeTx()

    await StockService.deductStock(tx, 2, 7, 20, 2, true, prefetched({
      ratio: 12,
      batches: [{ id: 1, qtyRemaining: '30', costPrice: '100', receivedAt: new Date() }],
    }))

    expect(aggregateSqlCall()).toMatchObject({ operand: 24 })
  })

  it('belum ada baris agregat, murni oversell → dibuat langsung minus (bukan 0)', async () => {
    fifoDeductMock.mockReturnValue(fifoResult({ shortfallQty: 5 }))
    const tx = makeDeductTx()

    await StockService.deductStock(tx, 2, 7, 10, 5, true, prefetched({ existingStock: null }))

    expect(insertValues[0]).toMatchObject({ productId: 7, branchId: 2, uomId: 10, qty: -5 })
  })

  it('stok kurang tanpa allowNegative → InsufficientStockError membawa shortfallQty', async () => {
    fifoDeductMock.mockReturnValue(
      fifoResult({
        success: false,
        shortfallQty: 7,
        error: 'Stok tidak cukup. Dibutuhkan 10, tersedia 3.',
      })
    )
    const tx = makeTx()

    await expect(
      StockService.deductStock(tx, 2, 7, 10, 10, false, prefetched())
    ).rejects.toMatchObject({
      name: 'InsufficientStockError',
      productId: 7,
      shortfallQty: 7,
      message: 'Stok tidak cukup. Dibutuhkan 10, tersedia 3.',
    })
  })
})

describe('StockService.addStock settleShortfalls + ledger shortfall (G2)', () => {
  // Chain generik: from/where/orderBy/limit/for semua mengembalikan diri sendiri, resolve
  // lewat `then` ke hasil yang sudah ditentukan — cocok untuk query select apa pun tanpa
  // peduli urutan pemanggilan method chain-nya.
  function chain(result: unknown[]) {
    const c: Record<string, unknown> = {
      from: () => c,
      where: () => c,
      orderBy: () => c,
      limit: () => c,
      for: () => c,
      then: (resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
    }
    return c
  }

  function makeSettleTx(opts: {
    openShortfalls?: Record<string, unknown>[]
    transactionItemByTable?: Record<number, Record<string, unknown>>
    existingAgg?: Record<string, unknown>
  }) {
    const inserts: { table: unknown; values: Record<string, unknown> }[] = []
    const updates: { table: unknown; payload: Record<string, unknown> }[] = []

    return {
      inserts,
      updates,
      tx: {
        execute: vi.fn().mockResolvedValue(undefined),
        select: () => ({
          from: (table: unknown) => {
            if (table === products) return chain([{ baseUomId: 10 }])
            if (table === productStocks) return chain(opts.existingAgg !== undefined ? [opts.existingAgg] : [])
            if (table === productStockBatches) return chain([])
            if (table === stockShortfalls) return chain(opts.openShortfalls ?? [])
            if (table === transactionItems) {
              // Diasumsikan hanya satu lookup transactionItems per test di sini.
              const rows = Object.values(opts.transactionItemByTable ?? {})
              return chain(rows.length > 0 ? [rows[0]] : [])
            }
            return chain([])
          },
        }),
        insert: (table: unknown) => ({
          values: (values: Record<string, unknown>) => {
            inserts.push({ table, values })
            return Object.assign(Promise.resolve([{ id: 1 }]), {
              returning: () => Promise.resolve([{ id: 1 }]),
            })
          },
        }),
        update: (table: unknown) => ({
          set: (payload: Record<string, unknown>) => ({
            where: () => {
              updates.push({ table, payload })
              return Promise.resolve([])
            },
          }),
        }),
      },
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('melunasi shortfall tertua dulu (FIFO), sisa jadi qty baru — bukan qty penuh', async () => {
    // Mock select mengembalikan array apa adanya (orderBy DB sungguhan tidak disimulasikan
    // di sini) — array di bawah merepresentasikan hasil yang SUDAH terurut createdAt ASC
    // dari query nyata; yang diuji adalah settleOpenShortfalls berjalan urut dari situ, FIFO.
    const older = { id: 1, qtyRemaining: 4, costPricePerUnit: 1000, sourceTransactionItemId: null, createdAt: new Date('2026-01-01') }
    const newer = { id: 2, qtyRemaining: 10, costPricePerUnit: 1000, sourceTransactionItemId: null, createdAt: new Date('2026-01-02') }
    const { tx, inserts, updates } = makeSettleTx({ openShortfalls: [older, newer] })

    const cleared = await settleOpenShortfalls(tx, 2, 7, 6, 1000, 'PO_RECEIVING', 55)

    // 4 dari shortfall #1/tertua (habis) + 2 dari shortfall #2 (sisa 8) = 6 total dilunasi.
    expect(cleared).toBe(6)

    const shortfallUpdates = updates.filter((u) => u.table === stockShortfalls)
    expect(shortfallUpdates).toHaveLength(2)
    expect(shortfallUpdates[0].payload).toMatchObject({ qtyRemaining: 0 }) // #1 habis duluan
    expect(shortfallUpdates[1].payload).toMatchObject({ qtyRemaining: 8 }) // #2 sisa 10-2

    const clearingInserts = inserts.filter((i) => i.table === stockShortfallClearings)
    expect(clearingInserts).toHaveLength(2)
    expect(clearingInserts[0].values).toMatchObject({ shortfallId: 1, qtyCleared: 4 })
    expect(clearingInserts[1].values).toMatchObject({ shortfallId: 2, qtyCleared: 2 })
  })

  it('COGS true-up: harga pelunas beda dari estimasi shortfall → cogs nota asal disesuaikan', async () => {
    const shortfall = {
      id: 1,
      qtyRemaining: 5,
      costPricePerUnit: 1000, // estimasi saat oversell
      sourceTransactionItemId: 42,
      createdAt: new Date('2026-01-01'),
    }
    const originalItem = { cogs: 5000, originalCogs: null }
    const { tx, inserts, updates } = makeSettleTx({
      openShortfalls: [shortfall],
      transactionItemByTable: { 42: originalItem },
    })

    const cleared = await settleOpenShortfalls(tx, 2, 7, 5, 1200, 'PO_RECEIVING', 55) // harga real 1200, bukan 1000

    expect(cleared).toBe(5)

    const shortfallUpdate = updates.find((u) => u.table === stockShortfalls)
    expect(shortfallUpdate?.payload).toMatchObject({ qtyRemaining: 0 })
    expect(shortfallUpdate?.payload.closedAt).toBeInstanceOf(Date)

    const clearingInsert = inserts.find((i) => i.table === stockShortfallClearings)
    expect(clearingInsert?.values).toMatchObject({
      shortfallId: 1,
      qtyCleared: 5,
      costPriceAtClearing: 1200,
      referenceType: 'PO_RECEIVING',
      referenceId: 55,
    })

    // true-up: (1200 - 1000) * 5 = 1000 tambahan cogs, originalCogs di-snapshot dari cogs lama.
    const itemUpdate = updates.find((u) => u.table === transactionItems)
    expect(itemUpdate?.payload.originalCogs).toBe(5000)
  })

  it('harga pelunas sama dengan estimasi → tidak ada true-up (tidak update transactionItems)', async () => {
    const shortfall = {
      id: 1,
      qtyRemaining: 5,
      costPricePerUnit: 1000,
      sourceTransactionItemId: 42,
      createdAt: new Date('2026-01-01'),
    }
    const { tx, updates } = makeSettleTx({
      openShortfalls: [shortfall],
      transactionItemByTable: { 42: { cogs: 5000, originalCogs: null } },
    })

    await settleOpenShortfalls(tx, 2, 7, 5, 1000, 'PO_RECEIVING', 55)

    expect(updates.some((u) => u.table === transactionItems)).toBe(false)
  })

  it('tidak ada shortfall terbuka → tidak melunasi apa pun, qtyBase penuh jadi stok baru', async () => {
    const { tx } = makeSettleTx({ openShortfalls: [] })

    const cleared = await settleOpenShortfalls(tx, 2, 7, 8, 1000, 'PO_RECEIVING', 55)

    expect(cleared).toBe(0)
  })

  it('closeOpenShortfallsForRecount: menutup SEMUA shortfall terbuka tanpa syarat qty, tanpa true-up', async () => {
    const shortfallA = { id: 1, qtyRemaining: 3, costPricePerUnit: 1000, sourceTransactionItemId: null }
    const shortfallB = { id: 2, qtyRemaining: 9, costPricePerUnit: 1500, sourceTransactionItemId: null }
    const { tx, inserts, updates } = makeSettleTx({ openShortfalls: [shortfallA, shortfallB] })

    await closeOpenShortfallsForRecount(tx, 2, 7, 'STOCK_OPNAME', 99)

    const shortfallUpdates = updates.filter((u) => u.table === stockShortfalls)
    expect(shortfallUpdates).toHaveLength(2)
    for (const u of shortfallUpdates) {
      expect(u.payload).toMatchObject({ qtyRemaining: 0 })
      expect(u.payload.closedAt).toBeInstanceOf(Date)
    }

    const clearingInserts = inserts.filter((i) => i.table === stockShortfallClearings)
    expect(clearingInserts).toHaveLength(2)
    expect(clearingInserts[0].values).toMatchObject({ costPriceAtClearing: 1000, referenceType: 'STOCK_OPNAME', referenceId: 99 })
    expect(clearingInserts[1].values).toMatchObject({ costPriceAtClearing: 1500 })
  })

  it('addStock({settleShortfalls:true}) end-to-end: invarian qty = SUM(batch) - SUM(shortfall terbuka) tetap konsisten', async () => {
    // State AWAL (hasil oversell sebelumnya, disimulasikan langsung — bukan dihitung ulang di
    // sini): batch lama sudah habis (0), shortfall terbuka 6, agregat -6. Invarian: 0-6=-6 ✓.
    const shortfall = { id: 1, qtyRemaining: 6, costPricePerUnit: 1000, sourceTransactionItemId: null, createdAt: new Date('2026-01-01') }
    const { tx, inserts, updates } = makeSettleTx({ openShortfalls: [shortfall], existingAgg: { id: 55, qty: -6 } })

    // PO datang 10 pcs — 6 melunasi shortfall, sisa 4 (bukan 10, bukan hasil sebelumnya yang salah: 4) jadi stok baru bersih.
    await StockService.addStock(tx, 2, 7, 10, '10', '1000', new Date(), null, {
      settleShortfalls: true,
      settleShortfallsReferenceId: 999,
    })

    const batchInsert = inserts.find((i) => i.table === productStockBatches)
    expect(batchInsert?.values).toMatchObject({ qtyReceived: 10, qtyRemaining: 10 }) // qtyReceived SELALU penuh (laporan pembelian)

    // Batch yang baru diinsert itu sendiri yang dikurangi porsi pelunasan (bukan diam-diam
    // dibiarkan penuh sambil agregat dipotong ganda — itu bug lama yang sudah diperbaiki).
    const batchQtyRemainingUpdate = sqlMock.mock.calls.find((args) => args[1] === 'product_stock_batches.qty_remaining')
    expect(batchQtyRemainingUpdate?.[2]).toBe(6) // clearedQty

    const clearingInsert = inserts.find((i) => i.table === stockShortfallClearings)
    expect(clearingInsert?.values).toMatchObject({ shortfallId: 1, qtyCleared: 6 })

    // Agregat SELALU ditambah qtyBase PENUH (10), apa pun clearedQty-nya — pelunasan sudah
    // "netral" lewat pengurangan batch di atas, jadi tidak boleh dipotong lagi di sini.
    const aggUpdate = updates.find((u) => u.table === productStocks)
    const aggOperand = sqlMock.mock.calls.find((args) => args[1] === 'product_stocks.qty')?.[2]
    expect(aggOperand).toBe(10)
    expect(aggUpdate).toBeTruthy()

    // Verifikasi invarian langsung: SUM(batch) sesudah = 10 (baru) - 6 (dikurangi pelunasan) = 4.
    // SUM(shortfall terbuka) sesudah = 0 (lunas). Target = 4 - 0 = 4.
    // Kode: agg = agg_lama(-6) + qtyBase(10) = 4. Cocok.
  })

  it('addStock tanpa settleShortfalls (default): shortfall terbuka tidak disentuh', async () => {
    const shortfall = { id: 1, qtyRemaining: 6, costPricePerUnit: 1000, sourceTransactionItemId: null, createdAt: new Date('2026-01-01') }
    const { tx, inserts } = makeSettleTx({ openShortfalls: [shortfall] })

    await StockService.addStock(tx, 2, 7, 10, '10', '1000')

    expect(inserts.some((i) => i.table === stockShortfallClearings)).toBe(false)
    const aggInsert = inserts.find((i) => i.table === productStocks)
    expect(aggInsert?.values).toMatchObject({ qty: 10 }) // qtyBase penuh, tidak dipotong shortfall
  })
})
