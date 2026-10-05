vi.mock('./services/stock-lock', () => ({ lockProductStocks: vi.fn().mockResolvedValue(undefined) }))
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { selectQueues, insertValues, updateSets, resolveCostMock, sqlMock, closeShortfallsMock } = vi.hoisted(() => {
  const selectQueues: unknown[][] = []
  const insertValues: unknown[] = []
  const updateSets: unknown[] = []
  const resolveCostMock = vi.fn().mockResolvedValue(0)
  const sqlMock = vi.fn().mockReturnValue('sql')
  const closeShortfallsMock = vi.fn().mockResolvedValue(undefined)
  return { selectQueues, insertValues, updateSets, resolveCostMock, sqlMock, closeShortfallsMock }
})

vi.mock('./services/stock-service', () => ({
  InsufficientStockError: class InsufficientStockError extends Error {
    productId: number
    shortfallQty: number
    constructor(message: string, productId: number, shortfallQty: number) {
      super(message)
      this.name = 'InsufficientStockError'
      this.productId = productId
      this.shortfallQty = shortfallQty
    }
  },
  resolveBatchCostPerBase: resolveCostMock,
  closeOpenShortfallsForRecount: closeShortfallsMock,
}))

vi.mock('./db', () => ({
  db: { transaction: vi.fn() },
  products: {
    id: 'products.id',
    baseUomId: 'products.base_uom_id',
  },
  productUomConversions: {
    productId: 'product_uom_conversions.product_id',
    uomId: 'product_uom_conversions.uom_id',
    ratio: 'product_uom_conversions.ratio',
  },
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
    costPrice: 'product_stock_batches.cost_price',
    receivedAt: 'product_stock_batches.received_at',
  },
  auditLogs: {},
  stockAdjustments: {},
  stockShortfalls: {
    productId: 'stock_shortfalls.product_id',
    branchId: 'stock_shortfalls.branch_id',
    qtyRemaining: 'stock_shortfalls.qty_remaining',
    closedAt: 'stock_shortfalls.closed_at',
  },
  productUomCosts: {
    productId: 'product_uom_costs.product_id',
    branchId: 'product_uom_costs.branch_id',
    uomId: 'product_uom_costs.uom_id',
    costPrice: 'product_uom_costs.cost_price',
  },
  eq: vi.fn().mockReturnValue('eq'),
  and: vi.fn().mockReturnValue('and'),
  isNull: vi.fn().mockReturnValue('isNull'),
  desc: vi.fn().mockReturnValue('desc'),
  asc: vi.fn().mockReturnValue('asc'),
  sql: sqlMock,
}))

import { applyManualStockAdjustment, applySOStockAdjustment, type Tx } from './stock-adjustment'

/**
 * `.for('update')` di kode nyata dipakai dua pola: langsung di-await apa adanya
 * (lock + baca agregat di `applyManualStockAdjustment` — tidak menarik antrean),
 * atau dirantai lagi dengan `.limit()` (lock + baca satu baris, dipakai rekonsiliasi
 * SO) — thenable manual ini melayani keduanya tanpa saling tabrak.
 */
let manualCurrentQty = 5
function forChain() {
  return {
    then(resolve: (value: unknown) => void) {
      resolve([{ id: 99, qty: manualCurrentQty }])
    },
    limit: vi.fn(() => Promise.resolve(selectQueues.shift() ?? [])),
  }
}

function makeTx(): Tx {
  const tx = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          // Di-await langsung tanpa .limit()/.for() — dipakai SUM shortfall terbuka.
          then(resolve: (value: unknown) => void) {
            resolve(selectQueues.shift() ?? [])
          },
          for: vi.fn(() => forChain()),
          limit: vi.fn(() => Promise.resolve(selectQueues.shift() ?? [])),
          orderBy: vi.fn().mockReturnValue({
            for: vi.fn(() => Promise.resolve(selectQueues.shift() ?? [])),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn((value) => {
        insertValues.push(value)
        // Dipakai dua pola: di-await langsung (auditLogs, dst — resolve ke objek ini
        // apa adanya) atau dirantai `.returning()` (stockAdjustments, untuk dapat id-nya).
        return { returning: vi.fn(() => Promise.resolve([{ id: 1 }])) }
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn((value) => {
        updateSets.push(value)
        return { where: vi.fn(() => Object.assign(Promise.resolve([]), { returning: () => Promise.resolve([{ id: 1 }]) })) }
      }),
    }),
  }

  return tx as unknown as Tx
}

describe('applyManualStockAdjustment — rekonsiliasi batch ke qty baru', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectQueues.length = 0
    insertValues.length = 0
    updateSets.length = 0
    resolveCostMock.mockResolvedValue(0)
    sqlMock.mockReturnValue('sql')
    manualCurrentQty = 5
  })

  const batch = (id: number, qtyRemaining: number) => ({ id, qtyRemaining, costPrice: 11550, receivedAt: new Date(`2026-01-0${id}`) })
  const batchDeductions = () => sqlMock.mock.calls
    .filter((args) => args[1] === 'product_stock_batches.qty_remaining' && args[0][1] === ' - ')
    .map((args) => args[2])

  it('penambahan tanpa drift: batch ditambah sebesar selisih, memakai modal fallback per satuan dasar', async () => {
    resolveCostMock.mockResolvedValue(22000)
    selectQueues.push([{ baseUomId: 10 }], [batch(1, 5)])
    const tx = makeTx()

    await applyManualStockAdjustment(tx, {
      productId: 7, branchId: 2, uomId: 10, previousQty: '5', newQty: '8', reason: 'Koreksi stok masuk', adjustedById: 3,
    })

    expect(updateSets).toContainEqual({ qty: 8 })
    expect(insertValues).toContainEqual(expect.objectContaining({ qtyReceived: 3, qtyRemaining: 3, costPrice: 22000 }))
    expect(resolveCostMock).toHaveBeenCalledWith(tx, 2, 7, 10)
  })

  it('modal eksplisit 0 dianggap kosong → pakai modal fallback, batch tidak lahir bermodal 0', async () => {
    resolveCostMock.mockResolvedValue(15000)
    selectQueues.push([{ baseUomId: 10 }], [batch(1, 5)])
    const tx = makeTx()

    await applyManualStockAdjustment(tx, {
      productId: 7, branchId: 2, uomId: 10, previousQty: '5', newQty: '8', reason: 'SO', adjustedById: 3, costPricePerUnit: 0,
    })

    expect(insertValues).toContainEqual(expect.objectContaining({ qtyRemaining: 3, costPrice: 15000 }))
  })

  it('penambahan memakai modal eksplisit kalau diisi', async () => {
    selectQueues.push([{ baseUomId: 10 }], [batch(1, 5)])
    const tx = makeTx()

    await applyManualStockAdjustment(tx, {
      productId: 7, branchId: 2, uomId: 10, previousQty: '5', newQty: '8', reason: 'Koreksi stok masuk', adjustedById: 3, costPricePerUnit: 19000,
    })

    expect(insertValues).toContainEqual(expect.objectContaining({ qtyRemaining: 3, costPrice: 19000 }))
  })

  it('penambahan menutup shortfall terbuka dan agregat tepat = qty baru (tidak ditambah nilai yang dimaafkan)', async () => {
    closeShortfallsMock.mockResolvedValueOnce(3)
    manualCurrentQty = -3
    selectQueues.push([{ baseUomId: 10 }], [])
    const tx = makeTx()

    await applyManualStockAdjustment(tx, {
      productId: 7, branchId: 2, uomId: 10, previousQty: '-3', newQty: '4', reason: 'Stok fisik lebih banyak', adjustedById: 3,
    })

    expect(closeShortfallsMock).toHaveBeenCalledWith(tx, 2, 7, 'MANUAL_ADJUSTMENT', 1)
    expect(updateSets).toContainEqual({ qty: 4 })
    expect(insertValues).toContainEqual(expect.objectContaining({ qtyRemaining: 4 }))
  })

  it('kasus nyata Gudang: stok 35 → 0 dengan batch tersisa 755 — semua batch dihabiskan, bukan cuma 35', async () => {
    manualCurrentQty = 35
    selectQueues.push([{ baseUomId: 15 }], [{ qty: '0' }], [batch(1, 240), batch(2, 515)])
    const tx = makeTx()

    await applyManualStockAdjustment(tx, {
      productId: 1620, branchId: 2, uomId: 15, previousQty: '35', newQty: '0', reason: 'p', adjustedById: 3,
    })

    expect(updateSets).toContainEqual({ qty: 0 })
    expect(batchDeductions()).toEqual([240, 515])
    expect(insertValues).not.toContainEqual(expect.objectContaining({ qtyRemaining: expect.anything() }))
  })

  it('pengurangan TIDAK menutup shortfall; batch disisakan sebesar qty baru + shortfall terbuka', async () => {
    manualCurrentQty = 8
    selectQueues.push([{ baseUomId: 10 }], [{ qty: '4' }], [batch(1, 10)])
    const tx = makeTx()

    await applyManualStockAdjustment(tx, {
      productId: 7, branchId: 2, uomId: 10, previousQty: '8', newQty: '5', reason: 'Koreksi stok keluar', adjustedById: 3,
    })

    expect(closeShortfallsMock).not.toHaveBeenCalled()
    expect(updateSets).toContainEqual({ qty: 5 })
    expect(batchDeductions()).toEqual([1]) // target batch 5 + 4 = 9, dari 10
  })

  it('pengurangan saat batch kurang dari qty baru: batch koreksi ditambahkan, tidak melempar error', async () => {
    manualCurrentQty = 10
    resolveCostMock.mockResolvedValue(5000)
    selectQueues.push([{ baseUomId: 10 }], [{ qty: '0' }], [batch(1, 2)])
    const tx = makeTx()

    await applyManualStockAdjustment(tx, {
      productId: 7, branchId: 2, uomId: 10, previousQty: '10', newQty: '5', reason: 'Koreksi', adjustedById: 3,
    })

    expect(updateSets).toContainEqual({ qty: 5 })
    expect(insertValues).toContainEqual(expect.objectContaining({ qtyRemaining: 3, costPrice: 5000 }))
  })
})

describe('applySOStockAdjustment — rekonsiliasi batch ke agregat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectQueues.length = 0
    insertValues.length = 0
    updateSets.length = 0
    resolveCostMock.mockResolvedValue(0)
    sqlMock.mockReturnValue('sql')
  })

  it('selisih positif tanpa drift lama: batch ditambah sebesar variance saja', async () => {
    // products.baseUomId sama dengan uomId hitungan → lewati lookup rasio konversi
    selectQueues.push(
      [{ baseUomId: 10 }], // products
      [{ id: 55, qty: 5 }], // productStocks (aggBefore = 5)
      [{ id: 1, qtyRemaining: 5, costPrice: 1000, receivedAt: new Date('2026-01-01') }], // productStockBatches (batchBefore = 5, selaras dengan agregat)
    )
    const tx = makeTx()

    await applySOStockAdjustment(tx, {
      productId: 7,
      branchId: 2,
      uomId: 10,
      systemQty: 5,
      physicalQty: 8, // variance = +3
      currentUserId: 3,
    })

    expect(updateSets).toContainEqual({ qty: 8 }) // targetAgg = 5 + 3
    expect(insertValues).toContainEqual(
      expect.objectContaining({ qtyReceived: 3, qtyRemaining: 3 })
    )
  })

  it('batch hasil SO memakai modal fallback per satuan dasar (mis. modal SAK ÷ rasio), bukan 0', async () => {
    resolveCostMock.mockResolvedValue(23126)
    selectQueues.push(
      [{ baseUomId: 10 }],
      [{ id: 55, qty: 0 }],
      [],
    )
    const tx = makeTx()

    await applySOStockAdjustment(tx, { productId: 7, branchId: 2, uomId: 10, systemQty: 0, physicalQty: 40, currentUserId: 3 })

    expect(resolveCostMock).toHaveBeenCalledWith(tx, 2, 7, 10)
    expect(insertValues).toContainEqual(expect.objectContaining({ qtyRemaining: 40, costPrice: 23126 }))
  })

  it('SO selalu menutup shortfall terbuka produk itu, apa pun tanda variance-nya — termasuk selisih 0', async () => {
    selectQueues.push(
      [{ baseUomId: 10 }],
      [{ id: 55, qty: 5 }],
      [{ id: 1, qtyRemaining: 5, costPrice: 1000, receivedAt: new Date('2026-01-01') }],
    )
    const tx = makeTx()

    await applySOStockAdjustment(tx, {
      productId: 7,
      branchId: 2,
      uomId: 10,
      systemQty: 5,
      physicalQty: 5, // variance = 0
      currentUserId: 3,
      soId: 321,
    })

    expect(closeShortfallsMock).toHaveBeenCalledWith(tx, 2, 7, 'STOCK_OPNAME', 321)
  })

  it('selisih positif DENGAN drift lama (stok minus tanpa batch): batch direkonsiliasi ke target agregat, bukan cuma ditambah variance', async () => {
    // Kasus nyata: product_stocks sudah -2 tanpa batch pendukung sama sekali.
    // Hitung fisik = 5, systemQty snapshot = 0 → variance = +5.
    // Agregat sesudah = -2 + 5 = 3 (benar). Batch HARUS ikut jadi 3, bukan 0 + 5 = 5.
    selectQueues.push(
      [{ baseUomId: 9 }], // products, baseUomId sama dengan item.uomId
      [{ id: 88, qty: -2 }], // productStocks (aggBefore = -2)
      [], // productStockBatches (batchBefore = 0, tidak ada batch sama sekali)
    )
    const tx = makeTx()

    await applySOStockAdjustment(tx, {
      productId: 1572,
      branchId: 1,
      uomId: 9,
      systemQty: 0,
      physicalQty: 5,
      currentUserId: 3,
    })

    expect(updateSets).toContainEqual({ qty: 3 }) // targetAgg = -2 + 5
    // Batch koreksi harus 3 (menyamai agregat), BUKAN 5 (variance mentah) —
    // ini persis bug yang bikin Nilai Stok (5) beda dari POS (3).
    expect(insertValues).toContainEqual(
      expect.objectContaining({ qtyReceived: 3, qtyRemaining: 3 })
    )
    expect(insertValues.some((v) => (v as { qtyReceived?: number }).qtyReceived === 5)).toBe(false)
  })

  it('selisih negatif: batch dikurangi FIFO sampai sejumlah kebutuhan rekonsiliasi', async () => {
    // aggBefore=10, batchBefore=12 (drift +2), variance=-4 → targetAgg=6, batchDelta=6-12=-6
    selectQueues.push(
      [{ baseUomId: 9 }],
      [{ id: 12, qty: 10 }],
      [
        { id: 201, qtyRemaining: 12, costPrice: 1000, receivedAt: new Date('2026-01-01') },
      ],
    )
    const tx = makeTx()

    await applySOStockAdjustment(tx, {
      productId: 50,
      branchId: 1,
      uomId: 9,
      systemQty: 10,
      physicalQty: 6, // variance = -4
      currentUserId: 3,
    })

    expect(updateSets).toContainEqual({ qty: 6 })
    // Deduksi FIFO lewat sql`` — cek argumen kedua (qtyDeducted) yang dikirim ke tag sql
    const deductCall = sqlMock.mock.calls.find((call) => call[2] === 6)
    expect(deductCall).toBeDefined()
  })

  it('selisih 0 dengan batch kelebihan: batch tetap dipangkas ke agregat, tidak dilewati', async () => {
    // Inti bug lama: hitungan fisik cocok (variance 0) → item di-skip, padahal justru
    // di sinilah agregat terbukti benar dan batch yang menyimpang harus mengikuti.
    // aggBefore=10, batchBefore=25 → targetAgg tetap 10, batch dipangkas 15.
    selectQueues.push(
      [{ baseUomId: 9 }],
      [{ id: 12, qty: 10 }],
      [{ id: 201, qtyRemaining: 25, costPrice: 1000, receivedAt: new Date('2026-01-01') }],
    )
    const tx = makeTx()

    await applySOStockAdjustment(tx, {
      productId: 50,
      branchId: 1,
      uomId: 9,
      systemQty: 10,
      physicalQty: 10, // variance = 0
      currentUserId: 3,
    })

    expect(updateSets).toContainEqual({ qty: 10 })
    expect(sqlMock.mock.calls.find((call) => call[2] === 15)).toBeDefined()
  })

  it('selisih 0 dan sudah sejajar: tidak menyentuh batch maupun log audit', async () => {
    selectQueues.push(
      [{ baseUomId: 9 }],
      [{ id: 12, qty: 10 }],
      [{ id: 201, qtyRemaining: 10, costPrice: 1000, receivedAt: new Date('2026-01-01') }],
    )
    const tx = makeTx()

    await applySOStockAdjustment(tx, {
      productId: 50,
      branchId: 1,
      uomId: 9,
      systemQty: 10,
      physicalQty: 10,
      currentUserId: 3,
    })

    expect(insertValues).toHaveLength(0)
  })

  it('selisih 0 dengan agregat minus warisan: tidak melempar, agregat disamakan ke batch', async () => {
    // aggBefore=-5 tanpa batch sama sekali. Kalau ini dilempar, SATU produk bisa
    // membatalkan approval seluruh SO — padahal justru inilah yang perlu dibersihkan.
    selectQueues.push(
      [{ baseUomId: 9 }],
      [{ id: 12, qty: -5 }],
      [],
    )
    const tx = makeTx()

    await applySOStockAdjustment(tx, {
      productId: 50,
      branchId: 1,
      uomId: 9,
      systemQty: -5,
      physicalQty: -5, // variance = 0
      currentUserId: 3,
    })

    // targetAgg awalnya -5, lalu disamakan ke sisa batch (0) karena batch tak sanggup turun
    expect(updateSets).toContainEqual({ qty: 0 })
  })

  it('selisih negatif tapi batch tidak cukup untuk menutup rekonsiliasi: lempar InsufficientStockError', async () => {
    // aggBefore=3, variance=-10 → targetAgg=-7 (fisik ternyata kosong/minus setelah
    // dikurangi pergerakan). Batch cuma nyimpan 2 — tidak mungkin dikurangi sampai
    // negatif, jadi rekonsiliasi ini wajib gagal, bukan diam-diam melampaui 0.
    selectQueues.push(
      [{ baseUomId: 9 }],
      [{ id: 12, qty: 3 }],
      [{ id: 201, qtyRemaining: 2, costPrice: 1000, receivedAt: new Date('2026-01-01') }],
    )
    const tx = makeTx()

    await expect(
      applySOStockAdjustment(tx, {
        productId: 50,
        branchId: 1,
        uomId: 9,
        systemQty: 13,
        physicalQty: 3,
        currentUserId: 3,
      })
    ).rejects.toThrow(/Stok tidak cukup/)
  })
})
