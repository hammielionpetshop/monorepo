import Big from 'big.js'
import { monthIndex } from './cash-flow-rules'

/**
 * Aturan murni Biaya Rutin F2-5a (spec docs/work/specs/2026-11-11-f2-5-biaya-rutin-sewa-mobil-design.md §2).
 * Bulan ditulis "YYYY-MM"; tanggal "YYYY-MM-DD". Tidak menyentuh DB.
 */

/** Bayar di muka paling jauh sekian bulan sesudah bulan berjalan. */
export const PREPAY_MONTHS = 12
/** Tagihan berwarna kuning bila jatuh tempo tinggal sekian hari atau kurang. */
export const DUE_SOON_DAYS = 3

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export function isMonth(value: string): boolean {
  return MONTH_RE.test(value)
}

export function monthOf(index: number): string {
  const y = Math.floor(index / 12)
  const m = (index % 12) + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

export function addMonths(month: string, n: number): string {
  return monthOf(monthIndex(month) + n)
}

/** Daftar bulan dari `from` sampai `to` (inklusif); kosong bila from > to. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let i = monthIndex(from); i <= monthIndex(to); i++) out.push(monthOf(i))
  return out
}

/** Tanggal jatuh tempo bulan itu; tanggal di luar panjang bulan dipotong ke tanggal terakhir. */
export function dueDateFor(month: string, dueDay: number): string {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${month}-${String(Math.min(dueDay, lastDay)).padStart(2, '0')}`
}

export interface AmountStep {
  effectiveMonth: string // YYYY-MM
  amount: number
}

/** Jumlah tagihan bulan itu = langkah dengan bulan berlaku terbesar ≤ bulan itu. */
export function amountFor(steps: AmountStep[], month: string): number | null {
  let best: AmountStep | null = null
  for (const s of steps) {
    if (s.effectiveMonth <= month && (!best || s.effectiveMonth > best.effectiveMonth)) best = s
  }
  return best?.amount ?? null
}

export interface Schedule {
  startMonth: string
  endMonth: string | null
  isActive: boolean
}

/** Bulan bertagihan sampai `untilMonth` (biasanya bulan berjalan). Biaya nonaktif tidak bertagihan. */
export function billMonths(schedule: Schedule, untilMonth: string): string[] {
  if (!schedule.isActive) return []
  const last = schedule.endMonth && schedule.endMonth < untilMonth ? schedule.endMonth : untilMonth
  return monthsBetween(schedule.startMonth, last)
}

export type BillStatus = 'PAID' | 'OVERDUE' | 'DUE_SOON' | 'UNPAID'

function daysUntil(today: string, date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

export function billStatus(dueDate: string, today: string, paid: boolean): BillStatus {
  if (paid) return 'PAID'
  const left = daysUntil(today, dueDate)
  if (left < 0) return 'OVERDUE'
  if (left <= DUE_SOON_DAYS) return 'DUE_SOON'
  return 'UNPAID'
}

export interface PayCheckInput {
  schedule: Schedule
  fromMonth: string
  toMonth: string
  paidMonths: Set<string>
  currentMonth: string
  billed: { month: string; amount: number | null }[]
  amount: number
  differenceReason: string | null
}

/** Pesan galat pertama untuk Bayar beberapa bulan berurutan, atau null bila sah. */
export function checkPay(input: PayCheckInput): string | null {
  const { schedule } = input
  if (!isMonth(input.fromMonth) || !isMonth(input.toMonth)) return 'Bulan tagihan tidak valid'
  if (input.fromMonth > input.toMonth) return 'Bulan akhir tidak boleh sebelum bulan awal'
  if (!schedule.isActive) return 'Biaya Rutin ini sudah nonaktif'
  if (input.fromMonth < schedule.startMonth) return 'Bulan tagihan sebelum biaya ini berlaku'
  if (schedule.endMonth && input.toMonth > schedule.endMonth) return 'Bulan tagihan sesudah biaya ini berakhir'
  if (input.toMonth > addMonths(input.currentMonth, PREPAY_MONTHS)) {
    return `Bayar di muka paling jauh ${PREPAY_MONTHS} bulan sesudah bulan berjalan`
  }
  const paid = monthsBetween(input.fromMonth, input.toMonth).filter((m) => input.paidMonths.has(m))
  if (paid.length > 0) return `Tagihan ${paid.join(', ')} sudah dibayar`
  if (input.billed.some((b) => b.amount === null)) return 'Jumlah tagihan belum diatur untuk bulan itu'
  if (!Number.isInteger(input.amount) || input.amount <= 0) return 'Jumlah dibayar harus lebih dari 0'
  const total = input.billed.reduce((sum, b) => sum + (b.amount ?? 0), 0)
  if (input.amount < input.billed.length) return 'Jumlah dibayar terlalu kecil untuk dibagi ke semua bulan'
  if (input.amount !== total && !input.differenceReason?.trim()) {
    return 'Jumlah dibayar berbeda dari tagihan; alasan wajib diisi'
  }
  return null
}

/**
 * Bagi jumlah dibayar ke tiap bulan sebanding tagihannya (dibulatkan ke bawah; sisa pembulatan ke bulan terakhir).
 * Bila sama dengan total tagihan, setiap bulan = tagihannya.
 */
export function splitPaid(billed: number[], paid: number): number[] {
  const total = billed.reduce((s, b) => s + b, 0)
  if (paid === total) return [...billed]
  const parts = billed.map((b) => Number(new Big(b).times(paid).div(total).round(0, Big.roundDown)))
  const rest = paid - parts.reduce((s, p) => s + p, 0)
  parts[parts.length - 1] += rest
  return parts
}

export interface CostChangeInput {
  hasPayments: boolean
  lastPaidMonth: string | null
  current: { categoryId: number; branchId: number | null; startMonth: string }
  next: { categoryId: number; branchId: number | null; startMonth: string; endMonth: string | null; isActive: boolean; wasActive: boolean }
}

/** Kategori, cabang, dan bulan mulai hanya boleh diubah selama belum ada pembayaran. */
export function checkCostChange({ hasPayments, lastPaidMonth, current, next }: CostChangeInput): string | null {
  if (next.endMonth && next.endMonth < next.startMonth) return 'Berlaku sampai tidak boleh sebelum Berlaku mulai'
  if (!hasPayments) return null
  if (next.categoryId !== current.categoryId || next.branchId !== current.branchId) {
    return 'Kategori dan cabang tidak bisa diubah sesudah ada pembayaran; akhiri biaya ini lalu buat yang baru'
  }
  if (next.startMonth !== current.startMonth) return 'Berlaku mulai tidak bisa diubah sesudah ada pembayaran'
  if (next.wasActive && !next.isActive) return 'Biaya yang sudah pernah dibayar tidak bisa dinonaktifkan; isi Berlaku sampai'
  if (next.endMonth && lastPaidMonth && next.endMonth < lastPaidMonth) {
    return `Berlaku sampai tidak boleh sebelum bulan yang sudah dibayar (${lastPaidMonth})`
  }
  return null
}

/** Ubah jumlah mulai bulan X: tidak sebelum biaya berlaku, dan tidak mengubah bulan yang sudah dibayar. */
export function checkAmountChange(input: { effectiveMonth: string; startMonth: string; lastPaidMonth: string | null; amount: number }): string | null {
  if (!isMonth(input.effectiveMonth)) return 'Bulan berlaku tidak valid'
  if (!Number.isInteger(input.amount) || input.amount <= 0) return 'Jumlah harus lebih dari 0'
  if (input.effectiveMonth < input.startMonth) return 'Bulan berlaku jumlah baru tidak boleh sebelum biaya ini berlaku'
  if (input.lastPaidMonth && input.effectiveMonth <= input.lastPaidMonth) {
    return `Bulan ${input.lastPaidMonth} sudah dibayar; jumlah baru berlaku paling cepat bulan sesudahnya`
  }
  return null
}
