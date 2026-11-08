import Big from 'big.js'

// Mesin laporan Minus Kasir — logika murni tanpa DB supaya aturan pembagiannya bisa dites.
//
// Selisih resmi satu shift = uang yang diterima & diverifikasi finance − kas menurut sistem.
// Selisih itu dibagi ke kasir menurut porsi kas tunai yang diterima masing-masing di shift
// itu (penjualan tunai bersih kembalian + pelunasan piutang tunai). Minus dan plus dicatat
// berdampingan, tidak saling mengurangi — penyelesaiannya diputuskan owner.

export const CASHIER_VARIANCE_SETTING_KEY = 'cashier_variance_settings'

/** Toleransi memengaruhi siapa yang dibebani minus — hanya Owner/GM yang boleh mengubah. */
export const CASHIER_VARIANCE_SETTINGS_ROLES: readonly string[] = ['OWNER', 'GM']

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

const MAX_SETTING_VALUE = 1_000_000_000

export function parseCashierVarianceSettings(raw: string | null | undefined): CashierVarianceSettings {
  if (!raw) return { ...DEFAULT_CASHIER_VARIANCE_SETTINGS }
  try {
    const parsed = JSON.parse(raw) as Partial<CashierVarianceSettings>
    const settings = {
      tolerance: Number(parsed.tolerance),
      anomalyThreshold: Number(parsed.anomalyThreshold),
    }
    return validateCashierVarianceSettings(settings) ? { ...DEFAULT_CASHIER_VARIANCE_SETTINGS } : settings
  } catch {
    return { ...DEFAULT_CASHIER_VARIANCE_SETTINGS }
  }
}

/** Pesan kesalahan berbahasa Indonesia, atau null bila valid. */
export function validateCashierVarianceSettings(s: CashierVarianceSettings): string | null {
  for (const [label, v] of [['Batas toleransi', s.tolerance], ['Batas tak wajar', s.anomalyThreshold]] as const) {
    if (!Number.isInteger(v) || v < 0) return `${label} harus bilangan bulat rupiah ≥ 0`
    if (v > MAX_SETTING_VALUE) return `${label} terlalu besar`
  }
  if (s.anomalyThreshold <= s.tolerance) return 'Batas tak wajar harus lebih besar dari batas toleransi'
  return null
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
  /** Porsi dalam persen (0–100), untuk tampilan. */
  sharePct: number
  amount: number
}

/**
 * Bagi `amount` (rupiah bulat, boleh negatif) menurut porsi kas tunai. Pembulatan memakai
 * sisa terbesar sehingga jumlah bagian selalu persis sama dengan selisih shift.
 * Bila tidak ada kas tunai sama sekali, hasilnya kosong — selisih itu tak terbagi.
 */
export function allocateByCashShare(amount: number, shares: CashShare[]): Allocation[] {
  const rows = shares.map((s) => ({ cashierId: s.cashierId, cash: Math.max(0, Math.round(s.cash)) }))
  const total = rows.reduce((sum, r) => sum + r.cash, 0)
  if (total === 0 || rows.length === 0) return []

  const sign = amount < 0 ? -1 : 1
  const abs = Math.abs(Math.round(amount))
  const exact = rows.map((r) => new Big(abs).times(r.cash).div(total))
  const floors = exact.map((v) => Number(v.round(0, Big.roundDown)))
  let remainder = abs - floors.reduce((a, b) => a + b, 0)
  const order = exact
    .map((v, i) => ({ i, frac: v.minus(floors[i]), cash: rows[i].cash }))
    .sort((a, b) => b.frac.cmp(a.frac) || b.cash - a.cash || a.i - b.i)
  for (const o of order) {
    if (remainder <= 0) break
    floors[o.i] += 1
    remainder -= 1
  }

  return rows.map((r, i) => ({
    cashierId: r.cashierId,
    cash: r.cash,
    sharePct: Number(new Big(r.cash).times(100).div(total).round(1)),
    amount: floors[i] === 0 ? 0 : sign * floors[i],
  }))
}

export interface ShiftVarianceInput {
  shiftId: number
  variance: number | null
  shares: CashShare[]
  /** Nama cabang shift — untuk rincian minus/plus per cabang. */
  branchName?: string
  /**
   * Pembagian yang sudah ditentukan (alur Setoran F2-2: Finance memilih kasir). Bila diisi,
   * dipakai menggantikan pembagian porsi kas; jumlahnya harus sama dengan `variance`.
   */
  allocations?: { cashierId: number; amount: number }[]
}

export interface CashierBranchRecap {
  branchName: string
  shiftCount: number
  minus: number
  plus: number
}

export interface CashierRecap {
  /** Kunci pengelompokan (bawaan: id akun; laporan memakai nama — satu orang bisa punya beberapa akun). */
  key: string
  cashierIds: number[]
  /** Shift terverifikasi yang diikuti kasir ini (punya kas tunai > 0). */
  shiftCount: number
  minus: number
  plus: number
  minusShiftCount: number
  plusShiftCount: number
  /** Rincian per cabang, urut nama cabang; jumlahnya selalu sama dengan total di atas. */
  byBranch: CashierBranchRecap[]
}

/**
 * Rekap per kasir: minus dan plus dijumlah terpisah. Hanya shift berkategori MINUS/PLUS
 * yang dibebankan; shift dalam toleransi, cocok, dan tak wajar tetap dihitung sebagai
 * shift yang diikuti tetapi tidak menambah minus/plus.
 */
export function recapByCashier(
  shifts: ShiftVarianceInput[],
  settings: CashierVarianceSettings,
  keyOf: (cashierId: number) => string = String,
): CashierRecap[] {
  const byKey = new Map<string, CashierRecap>()
  const get = (cashierId: number) => {
    const key = keyOf(cashierId)
    let r = byKey.get(key)
    if (!r) {
      r = { key, cashierIds: [], shiftCount: 0, minus: 0, plus: 0, minusShiftCount: 0, plusShiftCount: 0, byBranch: [] }
      byKey.set(key, r)
    }
    if (!r.cashierIds.includes(cashierId)) r.cashierIds.push(cashierId)
    return r
  }
  const branchOf = (r: CashierRecap, branchName: string) => {
    let b = r.byBranch.find((x) => x.branchName === branchName)
    if (!b) {
      b = { branchName, shiftCount: 0, minus: 0, plus: 0 }
      r.byBranch.push(b)
    }
    return b
  }

  for (const s of shifts) {
    const branchName = s.branchName ?? '-'
    // Satu orang dengan dua akun di shift yang sama tetap dihitung satu shift.
    const joined = new Set<CashierRecap>()
    for (const share of s.shares) if (share.cash > 0) joined.add(get(share.cashierId))
    for (const r of joined) {
      r.shiftCount += 1
      branchOf(r, branchName).shiftCount += 1
    }

    const category = classifyVariance(s.variance, settings)
    if (category !== 'MINUS' && category !== 'PLUS') continue
    const charged = new Map<CashierRecap, number>()
    for (const a of s.allocations ?? allocateByCashShare(s.variance as number, s.shares)) {
      if (a.amount === 0) continue
      const r = get(a.cashierId)
      charged.set(r, (charged.get(r) ?? 0) + a.amount)
    }
    for (const [r, amount] of charged) {
      const b = branchOf(r, branchName)
      if (category === 'MINUS') {
        r.minus += amount
        r.minusShiftCount += 1
        b.minus += amount
      } else {
        r.plus += amount
        r.plusShiftCount += 1
        b.plus += amount
      }
    }
  }

  for (const r of byKey.values()) r.byBranch.sort((a, b) => a.branchName.localeCompare(b.branchName))
  return [...byKey.values()].sort((a, b) => a.minus - b.minus || b.plus - a.plus || a.key.localeCompare(b.key))
}

/** Kunci gabung per nama: abaikan huruf besar/kecil dan spasi berlebih ("Rizal" = "rizal "). */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Rentang bulan 'YYYY-MM' → batas tanggal WIB [awal, awal bulan berikutnya). */
export function monthRange(month: string): { start: string; end: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return null
  const year = Number(m[1])
  const mon = Number(m[2])
  if (mon < 1 || mon > 12) return null
  const next = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`
  return { start: `${month}-01`, end: `${next}-01` }
}
