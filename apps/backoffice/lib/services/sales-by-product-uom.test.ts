import { describe, expect, it } from 'vitest'
import {
  applyPriceRevisionsToSalesRows,
  applyReturnsToSalesRows,
  buildProductTierRows,
  buildSalesByProductItems,
  formatPriceRange,
  hasMeaningfulUomBreakdown,
  sumSalesTotals,
  type ReturnTierRawRow,
  type SalesProductRawRow,
  type SalesTierRawRow,
  type SalesUomRawRow,
} from './sales-by-product-uom'

function productRow(overrides: Partial<SalesProductRawRow> = {}): SalesProductRawRow {
  return {
    productId: 1,
    productName: 'LOQY KLG TUNA',
    sku: 'SKU-1',
    baseUomCode: 'PCS',
    qtyBase: 240,
    transactionCount: 12,
    revenue: '1150000',
    cogs: '960000',
    masterBasePriceMin: 5000,
    masterBasePriceMax: 5000,
    ...overrides,
  }
}

function uomRow(overrides: Partial<SalesUomRawRow> = {}): SalesUomRawRow {
  return {
    productId: 1,
    uomId: 1,
    uomCode: 'PCS',
    uomName: 'Pieces',
    ratioToBase: 1,
    qty: 120,
    qtyBase: 120,
    transactionCount: 10,
    revenue: '600000',
    cogs: '480000',
    masterPriceMin: 5000,
    masterPriceMax: 5000,
    ...overrides,
  }
}

describe('buildSalesByProductItems', () => {
  it('menempelkan rincian satuan ke produk induknya', () => {
    const items = buildSalesByProductItems(
      [productRow()],
      [
        uomRow(),
        uomRow({ uomId: 2, uomCode: 'DUS', uomName: 'Dus', ratioToBase: 24, qty: 5, qtyBase: 120, transactionCount: 2, revenue: '550000', cogs: '480000', masterPriceMin: 110000, masterPriceMax: 110000 }),
      ]
    )

    expect(items).toHaveLength(1)
    expect(items[0]!.uoms.map((u) => u.uomCode)).toEqual(['DUS', 'PCS'])
  })

  it('mengurutkan rincian dari satuan terbesar ke terkecil', () => {
    const items = buildSalesByProductItems(
      [productRow()],
      [
        uomRow({ uomId: 3, uomCode: 'BAL', ratioToBase: 144, qty: 1, qtyBase: 144 }),
        uomRow(),
        uomRow({ uomId: 2, uomCode: 'DUS', ratioToBase: 24, qty: 5, qtyBase: 120 }),
      ]
    )

    expect(items[0]!.uoms.map((u) => u.ratioToBase)).toEqual([144, 24, 1])
  })

  it('qty satuan dasar adalah qty × ratio, bukan qty ÷ ratio', () => {
    const items = buildSalesByProductItems(
      [productRow({ qtyBase: 120 })],
      [uomRow({ uomCode: 'DUS', ratioToBase: 24, qty: 5, qtyBase: 120 })]
    )

    expect(items[0]!.uoms[0]!.qty).toBe(5)
    expect(items[0]!.uoms[0]!.qtyBase).toBe(120)
    expect(items[0]!.qtyBase).toBe(120)
  })

  it('harga realisasi per satuan dihitung dari qty satuan itu sendiri, bukan qty base', () => {
    const items = buildSalesByProductItems(
      [productRow({ qtyBase: 120, revenue: '550000' })],
      [uomRow({ uomCode: 'DUS', ratioToBase: 24, qty: 5, qtyBase: 120, revenue: '550000' })]
    )

    expect(items[0]!.uoms[0]!.realizedPrice).toBe('110000.00')
    expect(items[0]!.realizedPricePerBase).toBe('4583.33')
  })

  it('laba kotor = pendapatan − HPP di kedua tingkat', () => {
    const items = buildSalesByProductItems(
      [productRow({ revenue: '1150000', cogs: '960000' })],
      [uomRow({ revenue: '600000', cogs: '480000' })]
    )

    expect(items[0]!.grossProfit).toBe('190000')
    expect(items[0]!.uoms[0]!.grossProfit).toBe('120000')
  })

  it('tidak membagi dengan nol saat qty habis dikoreksi jadi 0', () => {
    const items = buildSalesByProductItems(
      [productRow({ qtyBase: 0, revenue: '0' })],
      [uomRow({ qty: 0, qtyBase: 0, revenue: '0' })]
    )

    expect(items[0]!.realizedPricePerBase).toBe('0')
    expect(items[0]!.uoms[0]!.realizedPrice).toBe('0')
  })

  it('mengelompokkan produk yang sudah dihapus (productId null) jadi satu', () => {
    const items = buildSalesByProductItems(
      [productRow({ productId: null, productName: 'Produk Dihapus', sku: null, baseUomCode: null })],
      [uomRow({ productId: null }), uomRow({ productId: null, uomId: 2, uomCode: 'DUS', ratioToBase: 24 })]
    )

    expect(items[0]!.uoms).toHaveLength(2)
  })

  it('produk tanpa rincian satuan tetap muncul dengan daftar kosong', () => {
    const items = buildSalesByProductItems([productRow({ productId: 9 })], [uomRow({ productId: 1 })])

    expect(items[0]!.uoms).toEqual([])
  })

  it('harga master yang tidak ada di daftar harga jadi null, bukan nol', () => {
    const items = buildSalesByProductItems(
      [productRow({ masterBasePriceMin: null, masterBasePriceMax: null })],
      [uomRow({ masterPriceMin: null, masterPriceMax: null })]
    )

    expect(items[0]!.masterPricePerBaseMin).toBeNull()
    expect(items[0]!.uoms[0]!.masterPriceMin).toBeNull()
  })

  it('satuan tanpa nama di master tetap tampil, tidak dibuang', () => {
    const items = buildSalesByProductItems([productRow()], [uomRow({ uomCode: null, uomName: null })])

    expect(items[0]!.uoms[0]!.uomCode).toBe('—')
  })
})

describe('sumSalesTotals', () => {
  it('menjumlahkan uang lintas produk', () => {
    const items = buildSalesByProductItems(
      [productRow(), productRow({ productId: 2, revenue: '1120000', cogs: '800000' })],
      []
    )

    expect(sumSalesTotals(items)).toEqual({
      totalRevenue: '2270000',
      totalCogs: '1760000',
      totalGrossProfit: '510000',
    })
  })

  it('tanpa produk hasilnya nol, bukan NaN', () => {
    expect(sumSalesTotals([])).toEqual({
      totalRevenue: '0',
      totalCogs: '0',
      totalGrossProfit: '0',
    })
  })
})

describe('hasMeaningfulUomBreakdown', () => {
  it('satu satuan yang sama dengan satuan dasar tidak perlu dibuka', () => {
    const items = buildSalesByProductItems([productRow()], [uomRow()])
    expect(hasMeaningfulUomBreakdown(items[0]!)).toBe(false)
  })

  it('terjual hanya dalam DUS tetap perlu dibuka karena induknya sudah dinormalkan', () => {
    const items = buildSalesByProductItems(
      [productRow()],
      [uomRow({ uomCode: 'DUS', ratioToBase: 24, qty: 5, qtyBase: 120 })]
    )
    expect(hasMeaningfulUomBreakdown(items[0]!)).toBe(true)
  })

  it('lebih dari satu satuan selalu perlu dibuka', () => {
    const items = buildSalesByProductItems(
      [productRow()],
      [uomRow(), uomRow({ uomId: 2, uomCode: 'DUS', ratioToBase: 24 })]
    )
    expect(hasMeaningfulUomBreakdown(items[0]!)).toBe(true)
  })
})

describe('formatPriceRange', () => {
  const fmt = (v: string) => `Rp${v}`

  it('menampilkan satu angka bila semua cabang sama', () => {
    expect(formatPriceRange('5000', '5000', fmt)).toBe('Rp5000')
  })

  it('menampilkan rentang bila harga antar cabang berbeda', () => {
    expect(formatPriceRange('5000', '5500', fmt)).toBe('Rp5000 – Rp5500')
  })

  it('menampilkan strip bila produk tidak punya harga master', () => {
    expect(formatPriceRange(null, null, fmt)).toBe('—')
    expect(formatPriceRange('5000', null, fmt)).toBe('—')
  })
})

describe('applyReturnsToSalesRows — retur mengurangi penjualan', () => {
  it('qty, omzet, dan HPP produk & satuannya berkurang; jumlah retur tercatat', () => {
    const { productRows, uomRows } = applyReturnsToSalesRows(
      [productRow()],
      [uomRow()],
      [{ productId: 1, productName: 'LOQY KLG TUNA', sku: 'SKU-1', baseUomCode: 'PCS', qtyBase: 10, revenue: '50000', cogs: '40000' }],
      [{ productId: 1, uomId: 1, uomCode: 'PCS', uomName: 'Pieces', ratioToBase: 1, qty: 10, qtyBase: 10, revenue: '50000', cogs: '40000' }],
    )
    const [item] = buildSalesByProductItems(productRows, uomRows)
    expect(item).toMatchObject({ qtyBase: 230, revenue: '1100000', cogs: '920000', grossProfit: '180000', returnQtyBase: 10, returnRevenue: '50000' })
    expect(item.uoms[0]).toMatchObject({ qty: 110, qtyBase: 110, revenue: '550000', cogs: '440000' })
  })

  it('produk yang hanya diretur dalam periode muncul negatif, total ikut turun', () => {
    const { productRows, uomRows } = applyReturnsToSalesRows(
      [productRow()],
      [uomRow()],
      [{ productId: 2, productName: 'CRYSTAL', sku: 'C', baseUomCode: 'KG', qtyBase: 25, revenue: '420000', cogs: '400000' }],
      [{ productId: 2, uomId: 7, uomCode: 'SAK', uomName: 'Sak', ratioToBase: 25, qty: 1, qtyBase: 25, revenue: '420000', cogs: '400000' }],
    )
    const items = buildSalesByProductItems(productRows, uomRows)
    const crystal = items.find((i) => i.productId === 2)!
    expect(crystal).toMatchObject({ qtyBase: -25, revenue: '-420000', transactionCount: 0, returnRevenue: '420000' })
    expect(crystal.uoms[0]).toMatchObject({ uomCode: 'SAK', qty: -1 })
    expect(sumSalesTotals(items).totalRevenue).toBe('730000')
    expect(items.at(-1)!.productId).toBe(2)
  })

  it('tanpa retur → baris tidak berubah', () => {
    const { productRows } = applyReturnsToSalesRows([productRow()], [uomRow()], [], [])
    expect(buildSalesByProductItems(productRows, [])[0]).toMatchObject({ qtyBase: 240, revenue: '1150000', returnQtyBase: 0, returnRevenue: '0' })
  })
})

describe('applyPriceRevisionsToSalesRows — Revisi Harga Beli mengoreksi omzet', () => {
  const revision = (over: Record<string, unknown> = {}) => ({
    productId: 1, productName: 'LOQY KLG TUNA', sku: 'SKU-1', baseUomCode: 'PCS',
    uomId: 1, uomCode: 'PCS', uomName: 'Pieces', ratioToBase: 1, revenueCorrection: 50000, ...over,
  })

  it('omzet produk & satuannya turun sebesar selisih; qty dan HPP tidak berubah', () => {
    const { productRows, uomRows } = applyPriceRevisionsToSalesRows([productRow()], [uomRow()], [revision()])
    const [item] = buildSalesByProductItems(productRows, uomRows)
    expect(item).toMatchObject({ qtyBase: 240, revenue: '1100000', cogs: '960000', grossProfit: '140000', priceRevisionRevenue: '50000', returnRevenue: '0' })
    expect(item.uoms[0]).toMatchObject({ qty: 120, revenue: '550000', cogs: '480000' })
  })

  it('harga direvisi naik → omzet bertambah; produk yang hanya direvisi dalam periode tetap muncul', () => {
    const { productRows, uomRows } = applyPriceRevisionsToSalesRows(
      [productRow()],
      [uomRow()],
      [revision({ revenueCorrection: -20000 }), revision({ productId: 2, productName: 'CRYSTAL', sku: 'C', baseUomCode: 'KG', uomId: 7, uomCode: 'SAK', uomName: 'Sak', ratioToBase: 25, revenueCorrection: 30000 })],
    )
    const items = buildSalesByProductItems(productRows, uomRows)
    expect(items.find((i) => i.productId === 1)).toMatchObject({ revenue: '1170000', priceRevisionRevenue: '-20000' })
    const crystal = items.find((i) => i.productId === 2)!
    expect(crystal).toMatchObject({ qtyBase: 0, revenue: '-30000', cogs: '0', transactionCount: 0, priceRevisionRevenue: '30000' })
    expect(crystal.uoms[0]).toMatchObject({ uomCode: 'SAK', qty: 0, revenue: '-30000' })
    expect(sumSalesTotals(items).totalRevenue).toBe('1140000')
  })

  it('tanpa revisi → baris tidak berubah', () => {
    const rows = [productRow()]
    expect(applyPriceRevisionsToSalesRows(rows, [uomRow()], []).productRows).toBe(rows)
    expect(buildSalesByProductItems(rows, [])[0]).toMatchObject({ revenue: '1150000', priceRevisionRevenue: '0' })
  })
})

function saleTier(overrides: Partial<SalesTierRawRow> = {}): SalesTierRawRow {
  return { productId: 1, priceTier: 'RETAIL', qtyBase: 40, transactionCount: 4, revenue: '600000', cogs: '440000', ...overrides }
}

function returnTier(overrides: Partial<ReturnTierRawRow> = {}): ReturnTierRawRow {
  return { productId: 1, priceTier: 'RETAIL', qtyBase: 0, revenue: '0', cogs: '0', ...overrides }
}

describe('buildProductTierRows', () => {
  it('gabung penjualan per tier, hitung laba kotor & margin, urut Retail→Reseller→Grosir', () => {
    const map = buildProductTierRows(
      [
        saleTier({ priceTier: 'GROSIR', qtyBase: 300, transactionCount: 3, revenue: '36000000', cogs: '33000000' }),
        saleTier({ priceTier: 'RETAIL', qtyBase: 40, transactionCount: 4, revenue: '6000000', cogs: '4400000' }),
        saleTier({ priceTier: 'RESELLER', qtyBase: 120, transactionCount: 6, revenue: '15600000', cogs: '13200000' }),
      ],
      [],
    )
    const rows = map.get('1')!
    expect(rows.map((r) => r.tier)).toEqual(['RETAIL', 'RESELLER', 'GROSIR'])
    expect(rows[0]).toMatchObject({ tierLabel: 'Retail', grossProfit: '1600000', marginPercent: '26.67' })
    expect(rows[2]).toMatchObject({ tierLabel: 'Grosir', grossProfit: '3000000', marginPercent: '8.33' })
  })

  it('retur per tier mengurangi omzet, qty, dan HPP tier itu', () => {
    const map = buildProductTierRows(
      [saleTier({ priceTier: 'RETAIL', qtyBase: 40, revenue: '600000', cogs: '440000' })],
      [returnTier({ priceTier: 'RETAIL', qtyBase: 10, revenue: '150000', cogs: '110000' })],
    )
    const retail = map.get('1')!.find((r) => r.tier === 'RETAIL')!
    expect(retail).toMatchObject({ qtyBase: 30, revenue: '450000', cogs: '330000', grossProfit: '120000', returnQtyBase: 10, returnRevenue: '150000' })
  })

  it('tier tak dikenal memakai kodenya sendiri sebagai label dan ditaruh paling akhir', () => {
    const map = buildProductTierRows(
      [saleTier({ priceTier: 'KHUSUS', revenue: '100000', cogs: '80000' }), saleTier({ priceTier: 'RETAIL' })],
      [],
    )
    const rows = map.get('1')!
    expect(rows.map((r) => r.tier)).toEqual(['RETAIL', 'KHUSUS'])
    expect(rows.find((r) => r.tier === 'KHUSUS')!.tierLabel).toBe('KHUSUS')
  })

  it('omzet 0 → margin null (tak membagi nol)', () => {
    const map = buildProductTierRows([saleTier({ revenue: '0', cogs: '0', qtyBase: 0 })], [])
    expect(map.get('1')![0]!.marginPercent).toBeNull()
  })

  it('melekat ke item lewat buildSalesByProductItems', () => {
    const tiers = buildProductTierRows([saleTier()], [])
    const items = buildSalesByProductItems([productRow()], [uomRow()], tiers)
    expect(items[0]!.tiers.map((t) => t.tier)).toEqual(['RETAIL'])
  })
})
