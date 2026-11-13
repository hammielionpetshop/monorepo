/**
 * Aturan murni Hitung Kas F2-6e-1 (spec docs/work/specs/2026-11-12-f2-6e-hitung-kas-design.md §0, §1).
 * Hitungan = uang nyata akhir hari tanggal hitung; Back Office tidak pernah menampilkan saldo sistem.
 */

export const CASH_COUNT_START = '2026-11-01'
/** Tunai/Rekening yang belum dihitung lebih dari sekian hari bertanda kuning (KEU-37). */
export const CASH_COUNT_STALE_DAYS = 7

export type AdjustmentDirection = 'SHORT' | 'OVER'

/** Kategori sistem penyesuaian (migrasi 0069). Kurang = Biaya, Lebih = Pendapatan lain. */
export const ADJUSTMENT_CATEGORY: Record<AdjustmentDirection, { name: string; type: 'EXPENSE' | 'INCOME' }> = {
  SHORT: { name: 'Selisih kas kurang', type: 'EXPENSE' },
  OVER: { name: 'Selisih kas lebih', type: 'INCOME' },
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

export interface CountRuleInput {
  place: { kind: string; isActive: boolean } | null
  countedOn: string
  today: string
  amount: number
}

/** Pesan galat pertama, atau null bila hitungan sah. */
export function checkCount({ place, countedOn, today, amount }: CountRuleInput): string | null {
  if (!place) return 'Tempat Uang tidak ditemukan'
  if (place.kind === 'DRAWER') return 'Laci kasir tidak dihitung di sini; uang laci dihitung tiap tutup shift'
  if (!place.isActive) return 'Tempat Uang sudah nonaktif'
  if (!validDate(countedOn)) return 'Tanggal hitung tidak valid'
  if (countedOn < CASH_COUNT_START) return 'Tanggal hitung paling awal 1 November 2026'
  if (countedOn > today) return 'Tanggal hitung tidak boleh melewati hari ini'
  if (!Number.isInteger(amount) || amount < 0) return 'Jumlah uang nyata harus angka bulat, 0 atau lebih'
  return null
}

export interface AdjustmentRuleInput {
  isCancelled: boolean
  hasActiveAdjustment: boolean
  amount: number
  reason: string
}

export function checkAdjustment({ isCancelled, hasActiveAdjustment, amount, reason }: AdjustmentRuleInput): string | null {
  if (isCancelled) return 'Hitungan ini sudah dibatalkan'
  if (hasActiveAdjustment) return 'Hitungan ini sudah punya penyesuaian; batalkan penyesuaiannya dulu bila salah'
  if (!Number.isInteger(amount) || amount <= 0) return 'Jumlah penyesuaian harus angka bulat lebih dari 0'
  if (reason.trim().length < 3) return 'Alasan penyesuaian wajib diisi (minimal 3 huruf)'
  return null
}

export type CountFreshness = 'NEVER' | 'STALE' | 'FRESH'

/** Tanda jadwal hitung: belum pernah sejak 1 Nov, atau terakhir dihitung > 7 hari lalu. */
export function countFreshness(lastCountedOn: string | null, today: string): CountFreshness {
  if (!lastCountedOn) return 'NEVER'
  return daysBetween(lastCountedOn, today) > CASH_COUNT_STALE_DAYS ? 'STALE' : 'FRESH'
}
