import { describe, expect, it } from 'vitest'
import { parseAutoSettlementSettings, payableAgeBucket, planSettlement, type OpenPayable } from './deposit-settlement-rules'

// Cabang contoh spec F2-3 §2: 1 = Toko A, 2 = Toko Pusat, 3 = Gudang.
const A = 1, PUSAT = 2, GUDANG = 3

function book(map: Record<number, OpenPayable[]>) {
  return (b: number) => map[b] ?? []
}

describe('planSettlement (F2-3 pelunasan otomatis berantai)', () => {
  it('contoh spec: paling lama dulu lintas pemasok, diteruskan ke Gudang, sisa = setoran bebas tiap tingkat', () => {
    const steps = planSettlement(A, 5_000_000, book({
      [A]: [
        { id: 11, creditorBranchId: PUSAT, remaining: 3_000_000 },
        { id: 12, creditorBranchId: GUDANG, remaining: 1_000_000 },
      ],
      [PUSAT]: [{ id: 21, creditorBranchId: GUDANG, remaining: 2_000_000 }],
    }))
    expect(steps).toEqual([
      { parent: null, level: 1, payerBranchId: A, payableId: 11, amount: 3_000_000 },
      { parent: 0, level: 2, payerBranchId: PUSAT, payableId: 21, amount: 2_000_000 },
      { parent: 1, level: 3, payerBranchId: GUDANG, payableId: null, amount: 2_000_000 },
      { parent: 0, level: 2, payerBranchId: PUSAT, payableId: null, amount: 1_000_000 },
      { parent: null, level: 1, payerBranchId: A, payableId: 12, amount: 1_000_000 },
      { parent: 4, level: 2, payerBranchId: GUDANG, payableId: null, amount: 1_000_000 },
      { parent: null, level: 1, payerBranchId: A, payableId: null, amount: 1_000_000 },
    ])
    // Jumlah setoran bebas semua tingkat = uang yang disetor.
    expect(steps.filter((s) => s.payableId == null).reduce((t, s) => t + s.amount, 0)).toBe(5_000_000)
  })

  it('setoran kurang: melunasi sebagian tagihan paling lama, tanpa setoran bebas', () => {
    const steps = planSettlement(A, 500_000, book({ [A]: [{ id: 11, creditorBranchId: GUDANG, remaining: 800_000 }] }))
    expect(steps).toEqual([
      { parent: null, level: 1, payerBranchId: A, payableId: 11, amount: 500_000 },
      { parent: 0, level: 2, payerBranchId: GUDANG, payableId: null, amount: 500_000 },
    ])
  })

  it('penjaga putaran: rantai kembali ke cabang penyetor menjadi setoran bebas cabang itu', () => {
    const steps = planSettlement(A, 100, book({
      [A]: [{ id: 11, creditorBranchId: PUSAT, remaining: 100 }],
      [PUSAT]: [{ id: 21, creditorBranchId: A, remaining: 100 }],
    }))
    expect(steps.at(-1)).toEqual({ parent: 1, level: 3, payerBranchId: A, payableId: null, amount: 100 })
  })

  it('utang yang sama tidak dilunasi dua kali lewat dua jalur', () => {
    const steps = planSettlement(A, 300, book({
      [A]: [
        { id: 11, creditorBranchId: PUSAT, remaining: 100 },
        { id: 12, creditorBranchId: PUSAT, remaining: 100 },
      ],
      [PUSAT]: [{ id: 21, creditorBranchId: GUDANG, remaining: 150 }],
    }))
    const paid21 = steps.filter((s) => s.payableId === 21).reduce((t, s) => t + s.amount, 0)
    expect(paid21).toBe(150)
  })

  it('nominal nol tidak menghasilkan apa pun', () => {
    expect(planSettlement(A, 0, book({}))).toEqual([])
  })
})

describe('pengaturan & umur', () => {
  it('pengaturan rusak memakai bawaan', () => {
    expect(parseAutoSettlementSettings('xx', '2026-11-08')).toEqual({ startDate: '2026-11-08', redAgeDays: 30 })
    expect(parseAutoSettlementSettings('{"startDate":"2026-11-01","redAgeDays":45}', '2026-11-08')).toEqual({ startDate: '2026-11-01', redAgeDays: 45 })
  })
  it('kelompok umur', () => {
    expect(payableAgeBucket(7)).toBe('0-7')
    expect(payableAgeBucket(8)).toBe('8-30')
    expect(payableAgeBucket(31)).toBe('>30')
  })
})
