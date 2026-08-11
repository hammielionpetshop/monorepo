import { describe, expect, it } from 'vitest'
import {
  buildSalesByProductItems,
  formatPriceRange,
  hasMeaningfulUomBreakdown,
  sumSalesTotals,
  type SalesProductRawRow,
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
