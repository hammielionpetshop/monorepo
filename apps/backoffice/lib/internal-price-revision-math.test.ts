import { describe, expect, it } from 'vitest'
import { estimatePriceRevisionLine } from './internal-price-revision-math'

describe('estimatePriceRevisionLine', () => {
  it('harga turun, sebagian sudah terjual: koreksi stok + penyesuaian modal = perubahan tagihan', () => {
    const r = estimatePriceRevisionLine({ qty: 10, ratio: 1, oldUnitPrice: 50_000, finalUnitPrice: 45_000, remainingBase: 3 })
    expect(r).toEqual({ lineValue: 50_000, qtyBase: 10, qtyConsumedBase: 7, stockCorrection: 15_000, cogsAdjustment: 35_000 })
    expect(r.stockCorrection + r.cogsAdjustment).toBe(r.lineValue)
  })

  it('harga naik: semua angka negatif (tagihan & modal bertambah)', () => {
    const r = estimatePriceRevisionLine({ qty: 4, ratio: 5, oldUnitPrice: 5_000, finalUnitPrice: 6_000, remainingBase: 20 })
    expect(r).toEqual({ lineValue: -4_000, qtyBase: 20, qtyConsumedBase: 0, stockCorrection: -4_000, cogsAdjustment: 0 })
  })

  it('pembulatan harga per satuan dasar masuk ke penyesuaian modal, bukan hilang', () => {
    // 10.000 / 3 = 3.333, 9.000 / 3 = 3.000 → selisih per satuan dasar 333.
    const r = estimatePriceRevisionLine({ qty: 2, ratio: 3, oldUnitPrice: 10_000, finalUnitPrice: 9_000, remainingBase: 6 })
    expect(r).toEqual({ lineValue: 2_000, qtyBase: 6, qtyConsumedBase: 0, stockCorrection: 1_998, cogsAdjustment: 2 })
  })

  it('stok tidak ditemukan (dianggap terpakai semua): seluruh selisih jadi penyesuaian modal', () => {
    const r = estimatePriceRevisionLine({ qty: 4, ratio: 5, oldUnitPrice: 5_000, finalUnitPrice: 4_500, remainingBase: 0 })
    expect(r).toEqual({ lineValue: 2_000, qtyBase: 20, qtyConsumedBase: 20, stockCorrection: 0, cogsAdjustment: 2_000 })
  })
})
