import { describe, expect, it } from 'vitest'
import {
  applyFreeShipping, checkOngkirLine, freeShippingQty, isFreeOngkirItem, isOngkirItem, ongkirCartFields,
  ongkirReceiptRows, parseFreeShippingValue, receiptOngkirMark, receiptSavings, savingsText, summarizeDeliveries,
  validateFreeShippingValue, DEFAULT_FREE_SHIPPING_VALUE,
} from './ongkir'

const ongkir = { productKind: 'JASA_ONGKIR', qty: 15, unitPrice: '1000', discountAmount: '0', subtotal: '15000' }

describe('mesin ongkir — mengenali baris', () => {
  it('hanya produk berjenis JASA_ONGKIR; gratis dari tanda keranjang atau dari nota', () => {
    expect(isOngkirItem(ongkir)).toBe(true)
    expect(isOngkirItem({ productKind: 'BARANG' })).toBe(false)
    expect(isOngkirItem({ productKind: 'JASA_GROOMING' })).toBe(false)
    expect(isFreeOngkirItem({ ...ongkir, delivery: { freeShipping: true } })).toBe(true)
    expect(isFreeOngkirItem({ ...ongkir, ongkirFree: true })).toBe(true)
    expect(isFreeOngkirItem({ productKind: 'BARANG', ongkirFree: true })).toBe(false)
    expect(ongkirCartFields({ productKind: 'JASA_ONGKIR', ongkirFree: true })).toEqual({ productKind: 'JASA_ONGKIR', ongkirFree: true })
    expect(ongkirCartFields({ productKind: 'BARANG', ongkirFree: true })).toEqual({})
  })
})

describe('mesin ongkir — gratis ongkir = nilai standar', () => {
  it('qty diganti ke nilai standar ÷ harga dan dipotong penuh, berapa pun qty yang diisi kasir', () => {
    expect(applyFreeShipping(ongkir, 10000)).toMatchObject({ qty: 10, discountAmount: '10000', subtotal: '0', ongkirFree: true })
    expect(applyFreeShipping({ ...ongkir, qty: 8, subtotal: '8000' }, 10000)).toMatchObject({ qty: 10, discountAmount: '10000', subtotal: '0' })
    // data angka (bukan string) tetap angka
    expect(applyFreeShipping({ qty: 3, unitPrice: 1000, discountAmount: 0, subtotal: 3000 }, 10000)).toMatchObject({ qty: 10, discountAmount: 10000, subtotal: 0 })
  })

  it('harga ongkir yang tidak membagi pas ditolak', () => {
    expect(freeShippingQty(10000, '3000')).toBeNull()
    expect(freeShippingQty(10000, '0')).toBeNull()
    expect(() => applyFreeShipping({ ...ongkir, unitPrice: '3000' }, 10000)).toThrow(/tidak cocok/)
  })

  it('pengaturan: kosong/rusak → Rp 10.000; nilai baru harus kelipatan Rp 1.000', () => {
    expect(parseFreeShippingValue(null)).toBe(DEFAULT_FREE_SHIPPING_VALUE)
    expect(parseFreeShippingValue('abc')).toBe(10000)
    expect(parseFreeShippingValue('15000')).toBe(15000)
    expect(validateFreeShippingValue(12000)).toBeNull()
    expect(validateFreeShippingValue(12500)).toMatch(/kelipatan/)
    expect(validateFreeShippingValue(0)).toMatch(/lebih dari 0/)
  })

  it('pemeriksaan server', () => {
    expect(checkOngkirLine({ free: true, lineGross: 10000, lineTotal: 0, standardValue: 10000 })).toBeNull()
    expect(checkOngkirLine({ free: true, lineGross: 25000, lineTotal: 0, standardValue: 10000 })).toMatch(/Rp 10\.000/)
    expect(checkOngkirLine({ free: true, lineGross: 10000, lineTotal: 10000, standardValue: 10000 })).toMatch(/tidak boleh ditagih/)
    expect(checkOngkirLine({ free: false, lineGross: 15000, lineTotal: 15000, standardValue: 0 })).toBeNull()
    expect(checkOngkirLine({ free: false, lineGross: 15000, lineTotal: 0, standardValue: 0 })).toMatch(/Gratis ongkir/)
  })
})

describe('mesin ongkir — struk', () => {
  it('ongkir dibayar: satu baris "Ongkos kirim" tanpa qty × satuan', () => {
    expect(ongkirReceiptRows({ qty: 15, unitPrice: 1000, subtotal: 15000, ongkir: { free: false } })).toEqual([
      { label: 'Ongkos kirim', amount: 15000 },
    ])
  })

  it('gratis ongkir: "Ongkos kirim 10.000" lalu "GRATIS ONGKIR -10.000", dan "Anda hemat"', () => {
    const item = { qty: 10, unitPrice: 1000, subtotal: 0, ongkir: receiptOngkirMark({ productKind: 'JASA_ONGKIR', ongkirFree: true }) }
    expect(ongkirReceiptRows(item)).toEqual([
      { label: 'Ongkos kirim', amount: 10000 },
      { label: 'GRATIS ONGKIR', amount: -10000 },
    ])
    expect(receiptSavings([item, { qty: 2, unitPrice: 35000 }])).toBe(10000)
    expect(savingsText(10000)).toBe('Anda hemat Rp 10.000 (gratis ongkir)')
    expect(receiptSavings([{ qty: 2, unitPrice: 35000 }])).toBe(0)
  })
})

describe('mesin ongkir — ringkasan laporan', () => {
  it('berbayar dan gratis dipisah; yang dibatalkan tidak dihitung', () => {
    expect(summarizeDeliveries([
      { cancelled: false, free: false, netFee: 15000, freeValue: 0, bonus: 7500 },
      { cancelled: false, free: true, netFee: 0, freeValue: 10000, bonus: 0 },
      { cancelled: false, free: true, netFee: 0, freeValue: 10000, bonus: 0 },
      { cancelled: true, free: false, netFee: 20000, freeValue: 0, bonus: 10000 },
    ])).toEqual({ count: 3, paidCount: 1, freeCount: 2, cancelledCount: 1, netTotal: 15000, freeTotal: 20000, bonus: 7500 })
  })
})
