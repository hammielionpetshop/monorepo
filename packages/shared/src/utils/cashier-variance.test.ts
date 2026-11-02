import { describe, expect, it } from 'vitest'
import { allocateByCashShare, classifyVariance, parseCashierVarianceSettings } from './cashier-variance'

// Kasus sama dengan apps/backoffice/lib/cashier-variance.test.ts: hasil harus identik dengan laporan POS.
const S = { tolerance: 5_000, anomalyThreshold: 1_000_000 }

describe('allocateByCashShare (sama dengan laporan Minus Kasir POS)', () => {
  it('membagi minus menurut porsi kas tunai, jumlah bagian persis sama dengan selisih', () => {
    // Shift 212 Oktober: Rizal 5.133.750, Iqbal 2.367.000, minus 217.800
    const parts = allocateByCashShare(-217_800, [{ cashierId: 1, cash: 5_133_750 }, { cashierId: 2, cash: 2_367_000 }])
    expect(parts.map((p) => p.amount)).toEqual([-149_069, -68_731])
    expect(parts[0].sharePct).toBe(68.4)
  })
  it('sisa pembulatan dibagi ke pecahan terbesar sehingga tidak ada rupiah hilang', () => {
    const parts = allocateByCashShare(100, [{ cashierId: 1, cash: 1 }, { cashierId: 2, cash: 1 }, { cashierId: 3, cash: 1 }])
    expect(parts.map((p) => p.amount)).toEqual([34, 33, 33])
    expect(parts.map((p) => p.sharePct)).toEqual([33.3, 33.3, 33.3])
  })
  it('plus dibagi dengan cara yang sama (bernilai positif)', () => {
    expect(allocateByCashShare(1_000, [{ cashierId: 1, cash: 300 }, { cashierId: 2, cash: 700 }]).map((p) => p.amount)).toEqual([300, 700])
  })
  it('kasir tanpa kas tunai mendapat 0; kas negatif dianggap 0', () => {
    const parts = allocateByCashShare(-500, [{ cashierId: 1, cash: 1_000 }, { cashierId: 2, cash: -50 }])
    expect(parts.map((p) => p.amount)).toEqual([-500, 0])
  })
  it('tanpa kas tunai sama sekali → tak terbagi (kosong)', () => {
    expect(allocateByCashShare(-500, [{ cashierId: 1, cash: 0 }])).toEqual([])
    expect(allocateByCashShare(-500, [])).toEqual([])
  })
  it('angka besar tetap pasti (tidak kehilangan rupiah)', () => {
    const parts = allocateByCashShare(-999_999, [{ cashierId: 1, cash: 987_654_321 }, { cashierId: 2, cash: 123_456_789 }])
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(-999_999)
  })
})

describe('classifyVariance', () => {
  it('memisahkan cocok, toleransi, minus, plus, dan tak wajar', () => {
    expect(classifyVariance(0, S)).toBe('MATCH')
    expect(classifyVariance(-4_999, S)).toBe('TOLERATED')
    expect(classifyVariance(-5_000, S)).toBe('MINUS')
    expect(classifyVariance(5_000, S)).toBe('PLUS')
    expect(classifyVariance(-1_000_000, S)).toBe('ANOMALY')
    expect(classifyVariance(null, S)).toBe('ANOMALY')
  })
})

describe('parseCashierVarianceSettings', () => {
  it('nilai kosong/rusak kembali ke bawaan', () => {
    expect(parseCashierVarianceSettings(null)).toEqual(S)
    expect(parseCashierVarianceSettings('rusak')).toEqual(S)
    expect(parseCashierVarianceSettings('{"tolerance":10000,"anomalyThreshold":5000}')).toEqual(S)
    expect(parseCashierVarianceSettings('{"tolerance":10000,"anomalyThreshold":2000000}')).toEqual({ tolerance: 10_000, anomalyThreshold: 2_000_000 })
  })
})
