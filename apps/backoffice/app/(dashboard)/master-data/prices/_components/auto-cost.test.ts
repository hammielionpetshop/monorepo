import { describe, expect, it } from 'vitest'
import { deriveCosts, suggestCosts } from './auto-cost'

describe('deriveCosts', () => {
  it('modal SAK → satuan dasar yang kosong dibagi rasio', () => {
    expect(deriveCosts(250000, 25, [{ uomId: 1, ratio: 1, fillable: true }])).toEqual({ 1: 10000 })
  })

  it('modal satuan dasar → SAK dikali rasio', () => {
    expect(deriveCosts(10000, 1, [{ uomId: 2, ratio: 25, fillable: true }])).toEqual({ 2: 250000 })
  })

  it('antar satuan non-dasar lewat satuan dasar, dibulatkan ke rupiah', () => {
    expect(deriveCosts(100000, 3, [{ uomId: 1, ratio: 1, fillable: true }, { uomId: 3, ratio: 2, fillable: true }]))
      .toEqual({ 1: 33333, 3: 66667 })
  })

  it('satuan yang sudah bermodal / tanpa konversi tidak disentuh', () => {
    expect(deriveCosts(250000, 25, [
      { uomId: 1, ratio: 1, fillable: false },
      { uomId: 4, ratio: null, fillable: true },
    ])).toEqual({})
  })

  it('sumber tanpa rasio tidak menghasilkan apa-apa', () => {
    expect(deriveCosts(250000, null, [{ uomId: 1, ratio: 1, fillable: true }])).toEqual({})
  })
})

describe('suggestCosts', () => {
  it('modal SAK sudah ada → saran untuk KG yang kosong', () => {
    expect(suggestCosts([
      { uomId: 1, ratio: 1, cost: null, isAuto: false },
      { uomId: 2, ratio: 25, cost: 250000, isAuto: false },
    ])).toEqual({ 1: 10000 })
  })

  it('sumber = satuan terbesar yang bermodal; yang sudah bermodal tidak disarankan', () => {
    expect(suggestCosts([
      { uomId: 1, ratio: 1, cost: 9000, isAuto: false },
      { uomId: 2, ratio: 25, cost: 250000, isAuto: false },
      { uomId: 3, ratio: 5, cost: 0, isAuto: false },
    ])).toEqual({ 3: 50000 })
  })

  it('isian otomatis tidak dipakai sebagai sumber', () => {
    expect(suggestCosts([
      { uomId: 1, ratio: 1, cost: null, isAuto: false },
      { uomId: 2, ratio: 25, cost: 250000, isAuto: true },
    ])).toEqual({})
  })
})
