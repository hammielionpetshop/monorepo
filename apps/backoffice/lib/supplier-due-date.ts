import { todayWibDate } from './payment-date'

const DAY_MS = 24 * 60 * 60 * 1000
export const DUE_SOON_DAYS = 7

/**
 * Jatuh tempo hutang supplier (YYYY-MM-DD, kalender WIB).
 *
 * `due_at` yang tersimpan menang bila ada. Selain itu dihitung dari tanggal hutang dibuat
 * (penerimaan PO disetujui) + termin supplier SAAT INI — sengaja tidak disimpan, supaya
 * mengatur termin supplier langsung berlaku untuk tagihan lamanya juga. Termin null →
 * tanpa jatuh tempo (null).
 */
export function supplierDueDate(
  createdAt: Date,
  paymentTermDays: number | null,
  storedDueAt: Date | null = null,
): string | null {
  if (storedDueAt) return todayWibDate(storedDueAt)
  if (paymentTermDays == null || paymentTermDays < 0) return null
  const startWib = todayWibDate(createdAt)
  const due = new Date(Date.parse(`${startWib}T00:00:00Z`) + paymentTermDays * DAY_MS)
  return due.toISOString().slice(0, 10)
}

/** Selisih hari kalender `dueDate` − `today` (negatif = terlambat). */
export function daysUntilDue(dueDate: string, today: string): number {
  return Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS)
}

export type DueState = 'NONE' | 'OVERDUE' | 'SOON' | 'LATER'

export function dueState(dueDate: string | null, today: string): DueState {
  if (!dueDate) return 'NONE'
  const days = daysUntilDue(dueDate, today)
  if (days < 0) return 'OVERDUE'
  if (days <= DUE_SOON_DAYS) return 'SOON'
  return 'LATER'
}
