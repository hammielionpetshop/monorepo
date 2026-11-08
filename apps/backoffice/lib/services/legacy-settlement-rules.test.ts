import { describe, expect, it } from 'vitest'
import { simulateLegacySettlement, simulationTotals, summarizeBranchMoney, type BranchMoney, type LegacyPayable } from './legacy-settlement-rules'

// 1 = Toko A, 2 = Toko Pusat, 3 = Gudang (contoh spec F2-3 §2).
const A = 1, PUSAT = 2, GUDANG = 3

const payables: LegacyPayable[] = [
  { id: 11, debtorBranchId: A, creditorBranchId: PUSAT, remaining: 3_000_000 },
  { id: 21, debtorBranchId: PUSAT, creditorBranchId: GUDANG, remaining: 2_000_000 },
  { id: 12, debtorBranchId: A, creditorBranchId: GUDANG, remaining: 1_000_000 },
]
const money = (m: Partial<BranchMoney> & { branchId: number }): BranchMoney => ({ verifiedCash: 0, noncash: 0, manualPaid: 0, ...m })

describe('simulateLegacySettlement (F2-3b pratinjau utang lama)', () => {
  it('kas terverifikasi melunasi berantai, sisa jadi setoran bebas di tiap tingkat', () => {
    const sim = simulateLegacySettlement(payables, [money({ branchId: A, verifiedCash: 5_000_000 })], { includeNoncash: false, subtractManual: true })
    expect(sim.payables.map((p) => [p.id, p.result])).toEqual([[11, 'PAID'], [21, 'PAID'], [12, 'PAID']])
    const byId = new Map(sim.branches.map((b) => [b.branchId, b]))
    expect(byId.get(A)).toMatchObject({ available: 5_000_000, usable: 5_000_000, freeAmount: 1_000_000, receivedFromChain: 0 })
    expect(byId.get(PUSAT)).toMatchObject({ receivedFromChain: 3_000_000, freeAmount: 1_000_000 })
    expect(byId.get(GUDANG)).toMatchObject({ receivedFromChain: 3_000_000, freeAmount: 3_000_000 })
  })

  it('pelunasan manual dikurangi dulu; bila melebihi setoran, uang tersedia minus dan tidak ada yang dilunasi', () => {
    const sim = simulateLegacySettlement(payables, [money({ branchId: A, verifiedCash: 1_000_000, manualPaid: 1_500_000 })], { includeNoncash: false, subtractManual: true })
    expect(sim.branches[0]).toMatchObject({ available: -500_000, usable: 0 })
    expect(sim.payables.every((p) => p.result === 'OPEN')).toBe(true)
    expect(sim.steps).toEqual([])
  })

  it('non-tunai hanya ikut bila dicentang; pelunasan manual tidak dikurangi bila tidak dicentang', () => {
    const m = [money({ branchId: A, verifiedCash: 1_000_000, noncash: 2_000_000, manualPaid: 500_000 })]
    expect(simulateLegacySettlement(payables, m, { includeNoncash: false, subtractManual: true }).branches[0].available).toBe(500_000)
    expect(simulateLegacySettlement(payables, m, { includeNoncash: true, subtractManual: true }).branches[0].available).toBe(2_500_000)
    expect(simulateLegacySettlement(payables, m, { includeNoncash: false, subtractManual: false }).branches[0].available).toBe(1_000_000)
  })

  it('uang kurang: tagihan paling lama sebagian, sisanya tetap terbuka', () => {
    const sim = simulateLegacySettlement(payables, [money({ branchId: A, verifiedCash: 2_000_000 })], { includeNoncash: false, subtractManual: true })
    expect(sim.payables.find((p) => p.id === 11)).toMatchObject({ settled: 2_000_000, remainingAfter: 1_000_000, result: 'PARTIAL' })
    expect(sim.payables.find((p) => p.id === 12)).toMatchObject({ settled: 0, result: 'OPEN' })
    // Rantai: 2 jt yang diterima Toko Pusat melunasi utang lamanya ke Gudang.
    expect(sim.payables.find((p) => p.id === 21)).toMatchObject({ result: 'PAID' })
  })

  it('setoran beberapa cabang tidak melunasi satu tagihan dua kali', () => {
    const sim = simulateLegacySettlement(payables, [
      money({ branchId: A, verifiedCash: 3_000_000 }),
      money({ branchId: PUSAT, verifiedCash: 4_000_000 }),
    ], { includeNoncash: false, subtractManual: true })
    const p21 = sim.payables.find((p) => p.id === 21)!
    expect(p21).toMatchObject({ settled: 2_000_000, result: 'PAID' })
    // Toko Pusat: utangnya sudah lunas dari rantai Toko A, jadi seluruh 4 jt setorannya + 1 jt sisa rantai = bebas.
    expect(sim.branches.find((b) => b.branchId === PUSAT)!.freeAmount).toBe(5_000_000)
    const settledTotal = sim.payables.reduce((t, p) => t + p.settled, 0)
    const free = sim.branches.filter((b) => b.branchId !== GUDANG).reduce((t, b) => t + b.freeAmount, 0)
    expect(settledTotal).toBeLessThanOrEqual(6_000_000)
    expect(free).toBeGreaterThan(0)
  })
})

describe('summarizeBranchMoney + simulationTotals (F2-3b-2 jalankan = pratinjau)', () => {
  it('shift belum terverifikasi tidak masuk kas; non-tunai dari semua shift; sidik urut id tagihan', () => {
    const summary = summarizeBranchMoney({
      payables: [{ debtorBranchId: A }],
      shifts: [
        { branchId: A, verified: true, cash: 4_000_000, noncash: 100 },
        { branchId: A, verified: false, cash: 9_000_000, noncash: 200 },
      ],
      manualPayments: [{ debtorBranchId: A, amount: 500_000 }],
    })
    expect(summary).toEqual([{
      branchId: A, verifiedCash: 4_000_000, verifiedShifts: 1, unverifiedCash: 9_000_000, unverifiedShifts: 1,
      noncash: 300, manualPaid: 500_000, manualCount: 1,
    }])
    const sim = simulateLegacySettlement(payables, summary, { includeNoncash: false, subtractManual: true })
    // 3,5 jt: #11 lunas 3 jt (Pusat teruskan 2 jt ke #21), #12 sebagian 0,5 jt; bebas = Pusat 1 jt + Gudang 2,5 jt.
    expect(simulationTotals(sim)).toEqual({ settled: 5_500_000, payablesCount: 3, free: 3_500_000, fingerprint: '11:3000000,12:500000,21:2000000' })
  })
})
