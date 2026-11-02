import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CASHIER_VARIANCE_SETTINGS as S,
  allocateByCashShare,
  classifyVariance,
  monthRange,
  nameKey,
  parseCashierVarianceSettings,
  recapByCashier,
  validateCashierVarianceSettings,
} from './cashier-variance'

describe('allocateByCashShare', () => {
  it('membagi minus menurut porsi kas tunai, jumlah bagian persis sama dengan selisih', () => {
    // Shift 212 Oktober: Rizal 5.133.750, Iqbal 2.367.000, minus 217.800
    const parts = allocateByCashShare(-217_800, [
      { cashierId: 1, cash: 5_133_750 },
      { cashierId: 2, cash: 2_367_000 },
    ])
    expect(parts.map((p) => p.amount)).toEqual([-149_069, -68_731])
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(-217_800)
    expect(parts[0].sharePct).toBe(68.4)
  })

  it('sisa pembulatan dibagi ke pecahan terbesar sehingga tidak ada rupiah hilang', () => {
    const parts = allocateByCashShare(100, [
      { cashierId: 1, cash: 1 },
      { cashierId: 2, cash: 1 },
      { cashierId: 3, cash: 1 },
    ])
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(100)
    expect(parts.map((p) => p.amount).sort()).toEqual([33, 33, 34])
  })

  it('plus dibagi dengan cara yang sama (bernilai positif)', () => {
    expect(allocateByCashShare(1_000, [{ cashierId: 1, cash: 300 }, { cashierId: 2, cash: 700 }]).map((p) => p.amount))
      .toEqual([300, 700])
  })

  it('kasir tanpa kas tunai mendapat 0; kas negatif dianggap 0', () => {
    const parts = allocateByCashShare(-500, [{ cashierId: 1, cash: 1_000 }, { cashierId: 2, cash: -50 }])
    expect(parts.map((p) => p.amount)).toEqual([-500, 0])
  })

  it('tanpa kas tunai sama sekali → tak terbagi (kosong)', () => {
    expect(allocateByCashShare(-500, [{ cashierId: 1, cash: 0 }])).toEqual([])
    expect(allocateByCashShare(-500, [])).toEqual([])
  })
})

describe('classifyVariance', () => {
  it('memisahkan cocok, toleransi, minus, plus, dan tak wajar', () => {
    expect(classifyVariance(0, S)).toBe('MATCH')
    expect(classifyVariance(-4_999, S)).toBe('TOLERATED')
    expect(classifyVariance(4_999, S)).toBe('TOLERATED')
    expect(classifyVariance(-5_000, S)).toBe('MINUS')
    expect(classifyVariance(5_000, S)).toBe('PLUS')
    expect(classifyVariance(19_394_500, S)).toBe('ANOMALY')
    expect(classifyVariance(-1_000_000, S)).toBe('ANOMALY')
    expect(classifyVariance(null, S)).toBe('ANOMALY')
  })
})

describe('recapByCashier', () => {
  it('minus dan plus dijumlah terpisah, toleransi & tak wajar tidak dibebankan', () => {
    const recap = recapByCashier(
      [
        { shiftId: 1, variance: -10_000, shares: [{ cashierId: 1, cash: 600 }, { cashierId: 2, cash: 400 }] },
        { shiftId: 2, variance: 8_000, shares: [{ cashierId: 1, cash: 1 }] },
        { shiftId: 3, variance: -300, shares: [{ cashierId: 2, cash: 1 }] },
        { shiftId: 4, variance: 5_000_000, shares: [{ cashierId: 2, cash: 1 }] },
      ],
      S,
    )
    const a = recap.find((r) => r.key === '1')!
    const b = recap.find((r) => r.key === '2')!
    expect(a).toMatchObject({ shiftCount: 2, minus: -6_000, plus: 8_000, minusShiftCount: 1, plusShiftCount: 1 })
    expect(b).toMatchObject({ shiftCount: 3, minus: -4_000, plus: 0, minusShiftCount: 1, plusShiftCount: 0 })
  })

  it('gabung per nama: dua akun satu orang dijumlah, shift yang sama dihitung sekali', () => {
    // Rizal punya akun 30 (Toko Depan) dan 33 (Toko Pusat)
    const names: Record<number, string> = { 30: 'Rizal', 33: 'rizal ', 34: 'Iqbal' }
    const recap = recapByCashier(
      [
        { shiftId: 1, variance: -10_000, shares: [{ cashierId: 33, cash: 500 }, { cashierId: 34, cash: 500 }] },
        { shiftId: 2, variance: 20_000, shares: [{ cashierId: 30, cash: 1 }] },
        { shiftId: 3, variance: -6_000, shares: [{ cashierId: 30, cash: 100 }, { cashierId: 33, cash: 200 }] },
      ],
      S,
      (id) => nameKey(names[id]),
    )
    const rizal = recap.find((r) => r.key === 'rizal')!
    expect(rizal.cashierIds.sort()).toEqual([30, 33])
    expect(rizal).toMatchObject({ shiftCount: 3, minus: -11_000, plus: 20_000, minusShiftCount: 2, plusShiftCount: 1 })
    expect(recap).toHaveLength(2)
  })
})

describe('pengaturan', () => {
  it('nilai kosong/rusak kembali ke bawaan', () => {
    expect(parseCashierVarianceSettings(null)).toEqual(S)
    expect(parseCashierVarianceSettings('bukan json')).toEqual(S)
    expect(parseCashierVarianceSettings('{"tolerance":-1,"anomalyThreshold":10}')).toEqual(S)
    expect(parseCashierVarianceSettings('{"tolerance":2000,"anomalyThreshold":500000}')).toEqual({
      tolerance: 2_000,
      anomalyThreshold: 500_000,
    })
  })

  it('batas tak wajar wajib lebih besar dari toleransi', () => {
    expect(validateCashierVarianceSettings({ tolerance: 5_000, anomalyThreshold: 5_000 })).toMatch(/lebih besar/)
    expect(validateCashierVarianceSettings({ tolerance: 1.5, anomalyThreshold: 5_000 })).toMatch(/bulat/)
    expect(validateCashierVarianceSettings({ tolerance: 0, anomalyThreshold: 1 })).toBeNull()
  })
})

describe('monthRange', () => {
  it('menghasilkan awal bulan dan awal bulan berikutnya', () => {
    expect(monthRange('2026-10')).toEqual({ start: '2026-10-01', end: '2026-11-01' })
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', end: '2027-01-01' })
    expect(monthRange('2026-13')).toBeNull()
    expect(monthRange('okt')).toBeNull()
  })
})
