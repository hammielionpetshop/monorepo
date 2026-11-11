import Big from 'big.js'

// Aturan murni F2-2 Setoran (spec docs/work/specs/2026-11-08-f2-2-setoran-design.md) — tanpa DB
// supaya bisa dites. Semua angka uang rupiah bulat.

export const DEPOSIT_SETTINGS_KEY = 'deposit_settings'

/** Hanya Owner/GM yang boleh mengubah pengaturan & mengoreksi setoran terverifikasi. */
export const DEPOSIT_CORRECTOR_ROLES: readonly string[] = ['OWNER', 'GM']

export interface DepositSettings {
  /** 'YYYY-MM-DD' WIB. Shift yang ditutup sejak tanggal ini masuk alur Setoran. */
  startDate: string
  /** Peringatan tunai belum disetor: umur shift tertua (hari) … */
  warnDays: number
  /** … atau total tunai belum disetor (rupiah), mana lebih dulu. */
  warnAmount: number
  /** Dana non-tunai belum cair dianggap terlambat sesudah sekian hari. */
  awaitingFundsDays: number
}

/**
 * Shift lama (ditutup sebelum tanggal mulai) yang belum diverifikasi cara lama hanya ikut Setoran Tunai
 * bila ditutup sejak tanggal ini. Owner 2026-11-08: "data sebelum november di biarkan saja".
 * Non-tunai tetap mulai dari tanggal mulai Setoran.
 */
export const LEGACY_DEPOSIT_FROM = '2026-11-01'

export const DEFAULT_DEPOSIT_SETTINGS: Omit<DepositSettings, 'startDate'> = {
  warnDays: 5,
  warnAmount: 25_000_000,
  awaitingFundsDays: 2,
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** Pesan kesalahan berbahasa Indonesia, atau null bila valid. */
export function validateDepositSettings(s: DepositSettings): string | null {
  if (!isIsoDate(s.startDate)) return 'Tanggal mulai Setoran tidak valid'
  if (!Number.isInteger(s.warnDays) || s.warnDays < 1 || s.warnDays > 60) return 'Batas hari peringatan harus 1–60 hari'
  if (!Number.isInteger(s.warnAmount) || s.warnAmount < 1 || s.warnAmount > 10_000_000_000) {
    return 'Batas nominal peringatan harus bilangan bulat rupiah > 0'
  }
  if (!Number.isInteger(s.awaitingFundsDays) || s.awaitingFundsDays < 1 || s.awaitingFundsDays > 30) {
    return 'Batas dana belum cair harus 1–30 hari'
  }
  return null
}

/** `fallbackStartDate` dipakai bila pengaturan belum ada/rusak (migrasi 0056 selalu mengisinya). */
export function parseDepositSettings(raw: string | null | undefined, fallbackStartDate: string): DepositSettings {
  const base: DepositSettings = { startDate: fallbackStartDate, ...DEFAULT_DEPOSIT_SETTINGS }
  if (!raw) return base
  try {
    const p = JSON.parse(raw) as Partial<DepositSettings>
    const merged: DepositSettings = {
      startDate: typeof p.startDate === 'string' ? p.startDate : base.startDate,
      warnDays: p.warnDays != null ? Number(p.warnDays) : base.warnDays,
      warnAmount: p.warnAmount != null ? Number(p.warnAmount) : base.warnAmount,
      awaitingFundsDays: p.awaitingFundsDays != null ? Number(p.awaitingFundsDays) : base.awaitingFundsDays,
    }
    return validateDepositSettings(merged) ? base : merged
  } catch {
    return base
  }
}

/**
 * Kas tunai shift yang harus disetor (di luar modal): hitungan kasir untuk shift POS yang ditutup
 * normal; kas sistem untuk tutup paksa (tutup otomatis mencatat hitungan Rp0) dan shift Bulk Sale.
 */
export function shiftDepositCash(shift: {
  origin: string
  status: string
  totalClosingCashReal: number | null
  totalClosingCashExpected: number | null
}): number {
  if (shift.origin === 'POS' && shift.status === 'CLOSED' && shift.totalClosingCashReal != null) {
    return shift.totalClosingCashReal
  }
  return shift.totalClosingCashExpected ?? 0
}

/** Selisih kasir saat tutup shift (hitungan − sistem); hanya shift POS yang ditutup normal. */
export function shiftSettleVariance(shift: {
  origin: string
  status: string
  totalClosingCashReal: number | null
  totalClosingCashExpected: number | null
}): number {
  if (shift.origin !== 'POS' || shift.status !== 'CLOSED') return 0
  if (shift.totalClosingCashReal == null || shift.totalClosingCashExpected == null) return 0
  return shift.totalClosingCashReal - shift.totalClosingCashExpected
}

/** STN-<kode cabang>-<YYMMDD>-<urut 2 digit>. `date` = 'YYYY-MM-DD'. */
export function depositNumberPrefix(branchCode: string, date: string): string {
  return `STN-${branchCode.toUpperCase()}-${date.slice(2, 4)}${date.slice(5, 7)}${date.slice(8, 10)}-`
}

export function formatDepositNumber(prefix: string, sequence: number): string {
  return `${prefix}${String(sequence).padStart(2, '0')}`
}

export type CashVarianceCause = 'BANK_FEE' | 'CASHIER_SHORT' | 'CASHIER_OVER' | 'OTHER'

export const CASH_VARIANCE_CAUSE_LABELS: Record<CashVarianceCause, string> = {
  BANK_FEE: 'Biaya setor bank',
  CASHIER_SHORT: 'Kurang dari kasir',
  CASHIER_OVER: 'Lebih dari kasir',
  OTHER: 'Lainnya',
}

export interface CashVarianceLine {
  amount: number
  cause: CashVarianceCause
  shiftId?: number | null
  cashierId?: number | null
  note?: string | null
}

/**
 * Periksa rincian sebab selisih setoran tunai. `variance` = diterima − Σ kas shift.
 * `shiftCashiers` = kasir yang boleh dipilih per shift di dalam setoran.
 */
export function validateCashVarianceLines(
  variance: number,
  lines: CashVarianceLine[],
  shiftCashiers: Map<number, Set<number>>,
): string | null {
  if (variance === 0) return lines.length === 0 ? null : 'Tidak ada selisih — rincian sebab tidak perlu diisi'
  if (lines.length === 0) return 'Ada selisih — rincian sebab wajib diisi'
  let total = new Big(0)
  for (const l of lines) {
    if (!Number.isInteger(l.amount) || l.amount === 0) return 'Nominal tiap sebab harus rupiah bulat dan tidak nol'
    if ((l.cause === 'BANK_FEE' || l.cause === 'CASHIER_SHORT') && l.amount > 0) {
      return `${CASH_VARIANCE_CAUSE_LABELS[l.cause]} harus bernilai minus (uang diterima lebih sedikit)`
    }
    if (l.cause === 'CASHIER_OVER' && l.amount < 0) return 'Lebih dari kasir harus bernilai plus'
    if (l.cause === 'CASHIER_SHORT' || l.cause === 'CASHIER_OVER') {
      if (!l.shiftId || !l.cashierId) return `${CASH_VARIANCE_CAUSE_LABELS[l.cause]}: pilih shift dan kasirnya`
      const cashiers = shiftCashiers.get(l.shiftId)
      if (!cashiers) return 'Shift yang dipilih tidak termasuk setoran ini'
      if (!cashiers.has(l.cashierId)) return 'Kasir yang dipilih tidak bertugas di shift itu'
    }
    if (l.cause === 'OTHER' && !l.note?.trim()) return 'Sebab Lainnya wajib diberi catatan'
    total = total.plus(l.amount)
  }
  if (!total.eq(variance)) {
    return `Jumlah rincian sebab (${total.toFixed(0)}) harus sama dengan selisih (${variance})`
  }
  return null
}

export type NoncashCause = 'BANK_FEE' | 'CASHIER_INPUT' | 'OTHER'

export const NONCASH_CAUSE_LABELS: Record<NoncashCause | 'AWAITING_FUNDS', string> = {
  BANK_FEE: 'Potongan bank',
  AWAITING_FUNDS: 'Dana belum cair',
  CASHIER_INPUT: 'Salah input kasir',
  OTHER: 'Lainnya',
}

export function validateNoncashCause(variance: number, cause: NoncashCause | null | undefined, note: string | null | undefined): string | null {
  if (variance === 0) return null
  if (!cause) return 'Ada selisih — pilih sebabnya'
  if (cause === 'BANK_FEE' && variance > 0) return 'Potongan bank hanya untuk uang diterima lebih sedikit'
  if (cause === 'OTHER' && !note?.trim()) return 'Sebab Lainnya wajib diberi catatan'
  return null
}

/** Umur (hari kalender WIB) dari `fromDate` ke `today`, keduanya 'YYYY-MM-DD'. */
export function ageInDays(fromDate: string, today: string): number {
  const a = Date.parse(`${fromDate}T00:00:00Z`)
  const b = Date.parse(`${today}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

export type UndepositedLevel = 'OK' | 'WARN' | 'OVER'

/**
 * Tanda tunai belum disetor: OVER (merah) bila shift tertua ≥ batas hari atau total ≥ batas nominal;
 * WARN (jingga) bila sudah lewat 80% salah satu batas.
 */
export function undepositedLevel(oldestAgeDays: number, total: number, s: Pick<DepositSettings, 'warnDays' | 'warnAmount'>): UndepositedLevel {
  if (total <= 0) return 'OK'
  if (oldestAgeDays >= s.warnDays || total >= s.warnAmount) return 'OVER'
  if (oldestAgeDays >= Math.ceil(s.warnDays * 0.8) || total >= s.warnAmount * 0.8) return 'WARN'
  return 'OK'
}
