import { describe, expect, it } from 'vitest'
import { poLineQty, poReceivedNetQty, poReceivedTotal, poTotalAmount } from './po-total'

describe('poTotalAmount', () => {
  it('memakai qty pesan bila barang belum/kurang datang', () => {
    expect(poTotalAmount([
      { qtyOrdered: 10, qtyReceived: 0, unitCost: 5_000, invoiceUnitCost: null },
      { qtyOrdered: 4, qtyReceived: 2, unitCost: 2_500, invoiceUnitCost: 0 },
    ])).toBe(60_000)
  })

  it('memakai qty diterima bila barang datang melebihi pesanan', () => {
    expect(poLineQty({ qtyOrdered: 10, qtyReceived: 12 })).toBe(12)
    expect(poTotalAmount([{ qtyOrdered: 10, qtyReceived: 12, unitCost: 5_000, invoiceUnitCost: null }])).toBe(60_000)
  })

  it('harga faktur menggantikan harga PO bila sudah diisi', () => {
    expect(poTotalAmount([{ qtyOrdered: 3, qtyReceived: 5, unitCost: 1_000, invoiceUnitCost: 1_200 }])).toBe(6_000)
  })
})

describe('poReceivedTotal', () => {
  it('hanya menghitung barang yang diterima, bukan qty pesan', () => {
    // Kasus PO-20261124-0004: pesan 99, tercatat terima 2.
    expect(poReceivedTotal([
      { qtyOrdered: 99, qtyReceived: 2, qtyDamaged: 0, unitCost: 1_950, invoiceUnitCost: 3_500 },
      { qtyOrdered: 71, qtyReceived: 71, qtyDamaged: 0, unitCost: 1_950, invoiceUnitCost: 3_500 },
    ], 0)).toBe(255_500)
  })

  it('mengurangi barang rusak dan tidak minus', () => {
    expect(poReceivedNetQty({ qtyReceived: 5, qtyDamaged: 2 })).toBe(3)
    expect(poReceivedNetQty({ qtyReceived: 1, qtyDamaged: 3 })).toBe(0)
    expect(poReceivedTotal([{ qtyOrdered: 5, qtyReceived: 5, qtyDamaged: 2, unitCost: 1_000, invoiceUnitCost: null }], 0)).toBe(3_000)
  })

  it('ikut dipotong diskon PO secara proporsional seperti hutang supplier', () => {
    // Kotor 100.000, diskon 20.000 → faktor 0,8; diterima 5 × 10.000 × 0,8 = 40.000.
    expect(poReceivedTotal([{ qtyOrdered: 10, qtyReceived: 5, qtyDamaged: 0, unitCost: 10_000, invoiceUnitCost: null }], 20_000)).toBe(40_000)
  })
})
