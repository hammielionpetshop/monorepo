import { describe, expect, it } from 'vitest'
import { applyPoDiscount, poDiscountError, poDiscountFactor, poDiscountFactorFromHeader, poNetTotal } from './po-discount'

describe('diskon PO', () => {
  it('tanpa diskon tidak mengubah nilai', () => {
    expect(applyPoDiscount(50_000, 1_000_000, 0)).toBe(50_000)
    expect(poDiscountFactor(0, 0).toNumber()).toBe(1)
  })

  it('contoh owner: 1 juta diskon 200 ribu → semua harga × 0,8', () => {
    expect(poNetTotal(1_000_000, 200_000)).toBe(800_000)
    expect(applyPoDiscount(50_000, 1_000_000, 200_000)).toBe(40_000)
  })

  it('barang datang separuh → diskon ikut separuh', () => {
    // barang bagus senilai 500 ribu dari PO 1 juta diskon 200 ribu → hutang 400 ribu
    expect(applyPoDiscount(500_000, 1_000_000, 200_000)).toBe(400_000)
  })

  it('pembulatan ke rupiah terdekat', () => {
    // 333.333 × (300.000 / 1.000.000 sisa 0,7) = 233.333,1
    expect(applyPoDiscount(333_333, 1_000_000, 300_000)).toBe(233_333)
    expect(applyPoDiscount(15_001, 100_000, 50_000)).toBe(7_501)
  })

  it('faktor dari header PO tersimpan sama dengan dari total kotor', () => {
    const fromHeader = poDiscountFactorFromHeader({ totalAmount: 800_000, discountAmount: 200_000 })
    expect(fromHeader.eq(poDiscountFactor(1_000_000, 200_000))).toBe(true)
  })

  it('validasi diskon', () => {
    expect(poDiscountError(0, 0)).toBeNull()
    expect(poDiscountError(200_000, 1_000_000)).toBeNull()
    expect(poDiscountError(1_000_000, 1_000_000)).toMatch(/lebih kecil/)
    expect(poDiscountError(-1, 1_000_000)).toMatch(/minus/)
    expect(poDiscountError(1.5, 1_000_000)).toMatch(/rupiah/)
  })
})
