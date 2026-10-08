import { describe, expect, it, vi } from 'vitest'

vi.mock('../db', () => ({ db: {}, openBills: {}, bulkSaleDrafts: {}, eq: vi.fn(), sql: vi.fn() }))
vi.mock('./ibt-bulk-sale-match', () => ({ loadUomRatios: vi.fn() }))

import { parseBulkSaleDraftLines, parseOpenBillLines, sumHeldBase } from './stock-reservation'

describe('parseOpenBillLines', () => {
  it('membaca format HoldBillDialog: string JSON berisi cartItems', () => {
    const items = [
      JSON.stringify({
        cartItems: [
          { productId: 2662, uomId: 7, qty: 1, unitPrice: '62900' },
          { productId: 2661, uomId: 7, qty: 3, unitPrice: '63500' },
        ],
        customer: { id: 108 },
      }),
    ]
    expect(parseOpenBillLines(items)).toEqual([
      { productId: 2662, uomId: 7, qty: 1 },
      { productId: 2661, uomId: 7, qty: 3 },
    ])
  })

  it('menerima baris item mentah dan objek { cartItems }', () => {
    expect(parseOpenBillLines([{ productId: 1, uomId: 2, qty: 4 }])).toEqual([{ productId: 1, uomId: 2, qty: 4 }])
    expect(parseOpenBillLines([{ cartItems: [{ productId: 1, uomId: 2, qty: 4 }] }])).toEqual([
      { productId: 1, uomId: 2, qty: 4 },
    ])
  })

  it('melewati isi rusak tanpa melempar', () => {
    expect(parseOpenBillLines(['{bukan json', null, { productId: 'x', uomId: 1, qty: 1 }, { productId: 1, uomId: 1, qty: 0 }])).toEqual([])
    expect(parseOpenBillLines('bukan array')).toEqual([])
  })
})

describe('parseBulkSaleDraftLines', () => {
  it('membaca payload.rows', () => {
    expect(parseBulkSaleDraftLines({ branchId: 2, rows: [{ id: '1', productId: 1814, uomId: 17, qty: 1 }] })).toEqual([
      { productId: 1814, uomId: 17, qty: 1 },
    ])
    expect(parseBulkSaleDraftLines(null)).toEqual([])
  })
})

describe('sumHeldBase', () => {
  it('menjumlah dalam satuan dasar lintas daftar tunggu & satuan', () => {
    const ratios = new Map([
      ['1-15', 1],
      ['1-17', 40],
    ])
    const result = sumHeldBase(
      [
        { productId: 1, uomId: 17, qty: 1 },
        { productId: 1, uomId: 15, qty: 5 },
        { productId: 1, uomId: 99, qty: 1 },
      ],
      ratios,
    )
    expect(result.get(1)).toBe(45)
  })
})
