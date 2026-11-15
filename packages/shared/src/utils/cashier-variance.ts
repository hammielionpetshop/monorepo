// Aturan pembagian laporan Minus Kasir POS (rilis 1.107.105), dipakai bersama backoffice dan HRIS
// (spec HRIS L4c §3.3, PRD 06 §3.1a) supaya potongan minus kas di slip = angka laporan POS.
// Hitungan memakai BigInt (pasti, tanpa pecahan desimal), hasilnya sama dengan versi big.js di backoffice.

export interface CashierVarianceSettings {
  /** Selisih dengan nilai mutlak DI BAWAH angka ini tidak dibebankan ke kasir. */
  tolerance: number
  /** Selisih dengan nilai mutlak SEBESAR ini atau lebih dianggap tak wajar (kemungkinan salah ketik). */
  anomalyThreshold: number
}

export const DEFAULT_CASHIER_VARIANCE_SETTINGS: CashierVarianceSettings = {
  tolerance: 5_000,
  anomalyThreshold: 1_000_000,
}

export type VarianceCategory = 'MATCH' | 'TOLERATED' | 'MINUS' | 'PLUS' | 'ANOMALY'

export function classifyVariance(amount: number | null, settings: CashierVarianceSettings): VarianceCategory {
  // Tanpa kas sistem tidak ada angka resmi yang bisa dibagi — perlakukan sebagai tak wajar.
  if (amount == null) return 'ANOMALY'
  if (amount === 0) return 'MATCH'
  const abs = Math.abs(amount)
  if (abs >= settings.anomalyThreshold) return 'ANOMALY'
  if (abs < settings.tolerance) return 'TOLERATED'
  return amount < 0 ? 'MINUS' : 'PLUS'
}

export interface CashShare {
  cashierId: number
  /** Kas tunai yang diterima kasir di shift itu; nilai negatif diperlakukan nol. */
  cash: number
}

export interface Allocation {
  cashierId: number
  cash: number
  /** Porsi dalam persen (0–100, satu angka di belakang koma), untuk tampilan. */
  sharePct: number
  amount: number
}

/**
 * Bagi `amount` (rupiah bulat, boleh negatif) menurut porsi kas tunai. Pembulatan memakai sisa terbesar
 * sehingga jumlah bagian selalu persis sama dengan selisih shift. Tanpa kas tunai sama sekali → kosong.
 */
export function allocateByCashShare(amount: number, shares: CashShare[]): Allocation[] {
  const rows = shares.map((s) => ({ cashierId: s.cashierId, cash: Math.max(0, Math.round(s.cash)) }))
  const total = rows.reduce((sum, r) => sum + r.cash, 0)
  if (total === 0 || rows.length === 0) return []

  const sign = amount < 0 ? -1 : 1
  const abs = BigInt(Math.abs(Math.round(amount)))
  const bigTotal = BigInt(total)
  const exact = rows.map((r) => abs * BigInt(r.cash))
  const floors = exact.map((v) => Number(v / bigTotal))
  // Pecahan = sisa bagi (dibanding pada penyebut yang sama).
  const fracs = exact.map((v) => v % bigTotal)
  let remainder = Number(abs) - floors.reduce((a, b) => a + b, 0)
  const order = rows
    .map((r, i) => ({ i, frac: fracs[i], cash: r.cash }))
    .sort((a, b) => (a.frac === b.frac ? b.cash - a.cash || a.i - b.i : a.frac > b.frac ? -1 : 1))
  for (const o of order) {
    if (remainder <= 0) break
    floors[o.i] += 1
    remainder -= 1
  }

  return rows.map((r, i) => ({
    cashierId: r.cashierId,
    cash: r.cash,
    sharePct: roundHalfUpTenths(BigInt(r.cash) * BigInt(1000), bigTotal),
    amount: floors[i] === 0 ? 0 : sign * floors[i],
  }))
}

/** n ÷ d dibulatkan setengah ke atas ke bilangan bulat, lalu ÷ 10 (persen satu angka di belakang koma). */
function roundHalfUpTenths(n: bigint, d: bigint): number {
  const q = n / d
  const rounded = (n % d) * BigInt(2) >= d ? q + BigInt(1) : q
  return Number(rounded) / 10
}

/** Pengaturan laporan Minus Kasir (`app_settings`); nilai kosong/rusak kembali ke bawaan. */
export function parseCashierVarianceSettings(raw: string | null | undefined): CashierVarianceSettings {
  if (!raw) return { ...DEFAULT_CASHIER_VARIANCE_SETTINGS }
  try {
    const parsed = JSON.parse(raw) as Partial<CashierVarianceSettings>
    const settings = { tolerance: Number(parsed.tolerance), anomalyThreshold: Number(parsed.anomalyThreshold) }
    const valid = [settings.tolerance, settings.anomalyThreshold].every((v) => Number.isInteger(v) && v >= 0)
      && settings.anomalyThreshold > settings.tolerance
    return valid ? settings : { ...DEFAULT_CASHIER_VARIANCE_SETTINGS }
  } catch {
    return { ...DEFAULT_CASHIER_VARIANCE_SETTINGS }
  }
}
