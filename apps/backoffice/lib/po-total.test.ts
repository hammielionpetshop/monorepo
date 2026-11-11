import { describe, expect, it } from 'vitest'
import { poLineQty, poTotalAmount } from './po-total'

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
