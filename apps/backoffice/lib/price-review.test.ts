import { describe, expect, it } from 'vitest'
import { costChangePercent, roundUpPrice, suggestSellPrice } from './price-review'

describe('roundUpPrice', () => {
  it('dibulatkan ke atas ke 100, kelipatan pas tetap', () => {
    expect(roundUpPrice(6666.67)).toBe(6700)
    expect(roundUpPrice(6601)).toBe(6700)
    expect(roundUpPrice(6700)).toBe(6700)
  })
})

describe('suggestSellPrice', () => {
  it('persentase untung lama dipertahankan (contoh owner: modal 3.750 → 5.000, jual 5.000)', () => {
    expect(suggestSellPrice({ price: 5000, oldCostPerBase: 3750, newCostPerBase: 5000, unitCost: 5000 })).toBe(6700)
  })

  it('satuan besar memakai rasio yang sama (DUS isi 12)', () => {
    expect(suggestSellPrice({ price: 58000, oldCostPerBase: 3750, newCostPerBase: 5000, unitCost: 60000 })).toBe(77400)
  })

  it('harga lama yang sudah di bawah modal: usulan minimal modal baru dibulatkan ke atas', () => {
    expect(suggestSellPrice({ price: 3000, oldCostPerBase: 3750, newCostPerBase: 5000, unitCost: 5050 })).toBe(5100)
  })

  it('tanpa modal lama: harga lama, dinaikkan ke modal bila kurang', () => {
    expect(suggestSellPrice({ price: 8000, oldCostPerBase: null, newCostPerBase: 5000, unitCost: 5000 })).toBe(8000)
    expect(suggestSellPrice({ price: 4000, oldCostPerBase: 0, newCostPerBase: 5000, unitCost: 5000 })).toBe(5000)
  })
})

describe('costChangePercent', () => {
  it('3.750 → 5.000 = +33,3%; 1.600 → 2.300 = +43,8%', () => {
    expect(costChangePercent(3750, 5000)).toBe(33.3)
    expect(costChangePercent(1600, 2300)).toBe(43.8)
  })
  it('tanpa modal lama → null', () => {
    expect(costChangePercent(null, 5000)).toBeNull()
  })
})
