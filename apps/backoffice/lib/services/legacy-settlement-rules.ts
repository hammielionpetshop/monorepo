// F2-3b-1 Pratinjau utang antar cabang lama — aturan murni (tanpa DB), baca saja.
// Spec: docs/work/specs/2026-11-08-f2-3b-utang-lama-design.md. Tidak ada yang disimpan: hasilnya
// hanya simulasi "kalau dilunasi" memakai aturan alokasi berantai yang sama dengan F2-3.
import Big from 'big.js'
import { planSettlement, type OpenPayable } from './deposit-settlement-rules'

export const LEGACY_REVIEW_ROLES: readonly string[] = ['OWNER', 'GM']
/** Verifikasi setoran kas cara lama ada sejak migrasi 0029; diketik dua kali sejak 1.107.90. */
export const LEGACY_QUICK_DATES = [
  { date: '2026-10-04', label: '4 Okt (awal verifikasi)' },
  { date: '2026-10-24', label: '24 Okt (verifikasi ketat)' },
] as const

export interface LegacyPayable {
  id: number
  debtorBranchId: number
  creditorBranchId: number
  /** Sisa utang sekarang (total − sudah dibayar). */
  remaining: number
}

export interface BranchMoney {
  branchId: number
  verifiedCash: number
  noncash: number
  manualPaid: number
}

export interface LegacyOptions {
  includeNoncash: boolean
  subtractManual: boolean
}

export interface LegacyBranchResult {
  branchId: number
  /** Uang tersedia mentah — bisa minus bila pelunasan manual melebihi setoran. */
  available: number
  /** Yang dipakai simulasi (tidak pernah minus). */
  usable: number
  /** Uang yang diterima dari rantai (setoran cabang lain yang diteruskan ke cabang ini). */
  receivedFromChain: number
  freeAmount: number
}

export interface LegacyPayableResult {
  id: number
  settled: number
  remainingAfter: number
  result: 'PAID' | 'PARTIAL' | 'OPEN'
}

export interface LegacySimulationStep {
  /** Cabang yang setorannya memulai rantai ini. */
  originBranchId: number
  parent: number | null
  level: number
  payerBranchId: number
  payableId: number | null
  amount: number
}

export interface LegacySimulation {
  branches: LegacyBranchResult[]
  payables: LegacyPayableResult[]
  steps: LegacySimulationStep[]
}

/**
 * Simulasi pelunasan susulan (spec §2): per cabang, uang tersedia = kas terverifikasi (+ non-tunai bila
 * dicentang) − pelunasan manual (bila dicentang); lalu dialokasikan berantai ke utang LAMA saja, paling
 * lama dulu. `payables` harus sudah urut paling lama dulu. Cabang diproses urut id supaya hasilnya tetap
 * sama setiap kali dibuka; urutan ini hanya memengaruhi siapa yang tercatat punya setoran bebas, bukan
 * tagihan mana yang lunas.
 */
export function simulateLegacySettlement(
  payables: LegacyPayable[],
  money: BranchMoney[],
  options: LegacyOptions,
): LegacySimulation {
  const used = new Map<number, number>()
  const byDebtor = new Map<number, LegacyPayable[]>()
  for (const p of payables) {
    const list = byDebtor.get(p.debtorBranchId) ?? []
    list.push(p)
    byDebtor.set(p.debtorBranchId, list)
  }
  const openOf = (branchId: number): OpenPayable[] =>
    (byDebtor.get(branchId) ?? []).map((p) => ({
      id: p.id,
      creditorBranchId: p.creditorBranchId,
      remaining: p.remaining - (used.get(p.id) ?? 0),
    }))

  const results = new Map<number, LegacyBranchResult>()
  const resultOf = (branchId: number) => {
    let r = results.get(branchId)
    if (!r) {
      r = { branchId, available: 0, usable: 0, receivedFromChain: 0, freeAmount: 0 }
      results.set(branchId, r)
    }
    return r
  }

  const steps: LegacySimulationStep[] = []
  for (const m of [...money].sort((a, b) => a.branchId - b.branchId)) {
    let available = new Big(m.verifiedCash)
    if (options.includeNoncash) available = available.plus(m.noncash)
    if (options.subtractManual) available = available.minus(m.manualPaid)
    const row = resultOf(m.branchId)
    row.available = available.toNumber()
    row.usable = Math.max(row.available, 0)
    if (row.usable <= 0) continue

    const offset = steps.length
    for (const s of planSettlement(m.branchId, row.usable, openOf)) {
      steps.push({ ...s, originBranchId: m.branchId, parent: s.parent == null ? null : s.parent + offset })
      if (s.payableId != null) used.set(s.payableId, (used.get(s.payableId) ?? 0) + s.amount)
      if (s.level > 1 && s.payableId != null) {
        // Tingkat > 1: cabang ini membayar memakai uang yang diterimanya dari rantai.
        resultOf(s.payerBranchId).receivedFromChain += s.amount
      }
      if (s.payableId == null) {
        const r = resultOf(s.payerBranchId)
        r.freeAmount += s.amount
        if (s.level > 1) r.receivedFromChain += s.amount
      }
    }
  }

  const payableResults = payables.map((p): LegacyPayableResult => {
    const settled = used.get(p.id) ?? 0
    const remainingAfter = p.remaining - settled
    return { id: p.id, settled, remainingAfter, result: remainingAfter <= 0 ? 'PAID' : settled > 0 ? 'PARTIAL' : 'OPEN' }
  })

  return {
    branches: [...results.values()].sort((a, b) => a.branchId - b.branchId),
    payables: payableResults,
    steps,
  }
}

/** F2-3b-2: Jalankan & Batalkan pelunasan susulan hanya Owner (spec §9 no.5). */
export const LEGACY_RUN_ROLES: readonly string[] = ['OWNER']

export interface BranchMoneySummary extends BranchMoney {
  verifiedShifts: number
  unverifiedCash: number
  unverifiedShifts: number
  manualCount: number
}

/**
 * Ringkas uang per cabang dari data pratinjau. Dipakai layar DAN server saat Jalankan, supaya hitungan
 * yang dijalankan persis sama dengan yang dilihat Owner. Shift belum terverifikasi tidak masuk
 * `verifiedCash` (hanya info); non-tunai dihitung dari semua shift (angka sistem).
 */
export function summarizeBranchMoney(input: {
  payables: { debtorBranchId: number }[]
  shifts: { branchId: number; verified: boolean; cash: number; noncash: number }[]
  manualPayments: { debtorBranchId: number; amount: number }[]
}): BranchMoneySummary[] {
  const total = (xs: number[]) => xs.reduce((t, x) => t.plus(x), new Big(0)).toNumber()
  const ids = new Set<number>([
    ...input.payables.map((p) => p.debtorBranchId),
    ...input.shifts.map((s) => s.branchId),
    ...input.manualPayments.map((m) => m.debtorBranchId),
  ])
  return [...ids].sort((a, b) => a - b).map((branchId) => {
    const shifts = input.shifts.filter((s) => s.branchId === branchId)
    const verified = shifts.filter((s) => s.verified)
    const unverified = shifts.filter((s) => !s.verified)
    const manual = input.manualPayments.filter((m) => m.debtorBranchId === branchId)
    return {
      branchId,
      verifiedCash: total(verified.map((s) => s.cash)),
      verifiedShifts: verified.length,
      unverifiedCash: total(unverified.map((s) => s.cash)),
      unverifiedShifts: unverified.length,
      noncash: total(shifts.map((s) => s.noncash)),
      manualPaid: total(manual.map((m) => m.amount)),
      manualCount: manual.length,
    }
  })
}

/** Total dilunasi + sidik hasil (tagihan:jumlah) untuk memastikan server menjalankan yang dilihat. */
export function simulationTotals(sim: LegacySimulation): { settled: number; payablesCount: number; free: number; fingerprint: string } {
  const touched = sim.payables.filter((p) => p.settled > 0).sort((a, b) => a.id - b.id)
  return {
    settled: touched.reduce((t, p) => t.plus(p.settled), new Big(0)).toNumber(),
    payablesCount: touched.length,
    free: sim.steps.filter((s) => s.payableId == null).reduce((t, s) => t.plus(s.amount), new Big(0)).toNumber(),
    fingerprint: touched.map((p) => `${p.id}:${p.settled}`).join(','),
  }
}
