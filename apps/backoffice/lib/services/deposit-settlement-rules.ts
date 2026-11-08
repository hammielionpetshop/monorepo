// F2-3 Pelunasan Otomatis — aturan murni (tanpa DB).
// Spec: docs/work/specs/2026-11-08-f2-3-pelunasan-otomatis-design.md.

export const AUTO_SETTLEMENT_SETTINGS_KEY = 'auto_settlement_settings'

export interface AutoSettlementSettings {
  /** 'YYYY-MM-DD' WIB: utang yang lahir sebelum tanggal ini tidak dilunasi otomatis (pilihan A). */
  startDate: string
  /** Umur utang (hari) yang ditandai merah di Utang Internal. */
  redAgeDays: number
}

export function parseAutoSettlementSettings(raw: string | null | undefined, today: string): AutoSettlementSettings {
  const fallback: AutoSettlementSettings = { startDate: today, redAgeDays: 30 }
  if (!raw) return fallback
  try {
    const v = JSON.parse(raw) as Partial<AutoSettlementSettings>
    return {
      startDate: typeof v.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.startDate) ? v.startDate : fallback.startDate,
      redAgeDays: Number.isInteger(v.redAgeDays) && (v.redAgeDays as number) > 0 ? (v.redAgeDays as number) : fallback.redAgeDays,
    }
  } catch {
    return fallback
  }
}

export interface OpenPayable {
  id: number
  creditorBranchId: number
  remaining: number
}

export interface SettlementStep {
  /** Indeks langkah induk di daftar yang sama (null = tingkat 1). */
  parent: number | null
  level: number
  payerBranchId: number
  /** null = setoran bebas. */
  payableId: number | null
  amount: number
}

/**
 * Susun alokasi berantai satu setoran (spec §2–§3): utang paling lama dulu siapa pun pemasoknya,
 * uang yang diterima pemasok diteruskan ke utang pemasok itu, sisa tiap tingkat = setoran bebas.
 * `openPayables(branchId)` harus mengembalikan utang terbuka urut paling lama dulu; sisa yang sudah
 * terpakai di langkah sebelumnya dikurangi di sini, jadi satu utang tidak terlunasi dua kali.
 */
export function planSettlement(
  branchId: number,
  amount: number,
  openPayables: (branchId: number) => OpenPayable[],
): SettlementStep[] {
  const steps: SettlementStep[] = []
  const used = new Map<number, number>()

  function allocate(payer: number, money: number, parent: number | null, level: number, visited: Set<number>) {
    let left = money
    for (const p of openPayables(payer)) {
      if (left <= 0) break
      const remaining = p.remaining - (used.get(p.id) ?? 0)
      if (remaining <= 0) continue
      const take = Math.min(remaining, left)
      used.set(p.id, (used.get(p.id) ?? 0) + take)
      left -= take
      steps.push({ parent, level, payerBranchId: payer, payableId: p.id, amount: take })
      const index = steps.length - 1
      if (visited.has(p.creditorBranchId)) {
        // Penjaga putaran: rantai kembali ke cabang yang sudah dilewati → setoran bebas cabang itu.
        steps.push({ parent: index, level: level + 1, payerBranchId: p.creditorBranchId, payableId: null, amount: take })
      } else {
        allocate(p.creditorBranchId, take, index, level + 1, new Set([...visited, p.creditorBranchId]))
      }
    }
    if (left > 0) steps.push({ parent, level, payerBranchId: payer, payableId: null, amount: left })
  }

  if (amount > 0) allocate(branchId, amount, null, 1, new Set([branchId]))
  return steps
}

/** Kelompok umur utang (spec §6.2). */
export function payableAgeBucket(ageDays: number): '0-7' | '8-30' | '>30' {
  if (ageDays <= 7) return '0-7'
  if (ageDays <= 30) return '8-30'
  return '>30'
}
