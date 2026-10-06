import { db, shifts, eq, and } from '@/lib/db'
import { AUTO_CLOSE_REASON, isShiftOverdue } from '@/lib/shift-auto-close-time'
import { forceCloseShift, ShiftNotOpenError } from './shift-force-close'

/**
 * Hanya jalan di produksi, atau bila `SHIFT_AUTO_CLOSE=true`. Worktree utama memakai
 * DATABASE_URL produksi — server dev di sana tidak boleh diam-diam menutup shift toko.
 */
export function isShiftAutoCloseEnabled(): boolean {
  if (process.env.SHIFT_AUTO_CLOSE === 'false') return false
  return process.env.NODE_ENV === 'production' || process.env.SHIFT_AUTO_CLOSE === 'true'
}

/**
 * Tutup paksa setiap shift OPEN yang sudah lewat 23.59 WIB pada hari dibukanya (kanban #53).
 * Idempoten: shift yang sudah tertutup dilewati, jadi aman dipanggil tiap menit dan dari
 * beberapa tempat sekaligus (timer server + saat halaman kasir dibuka).
 */
export async function autoCloseOverdueShifts(options: { branchId?: number; now?: Date } = {}): Promise<number[]> {
  const now = options.now ?? new Date()
  const openShifts = await db
    .select({ id: shifts.id, openedAt: shifts.openedAt })
    .from(shifts)
    .where(options.branchId ? and(eq(shifts.status, 'OPEN'), eq(shifts.branchId, options.branchId)) : eq(shifts.status, 'OPEN'))

  const closed: number[] = []
  for (const shift of openShifts) {
    if (!isShiftOverdue(shift.openedAt, now)) continue
    try {
      await forceCloseShift(shift.id, { forceClosedById: null, reason: AUTO_CLOSE_REASON, recordRealCashZero: true })
      closed.push(shift.id)
    } catch (error) {
      if (error instanceof ShiftNotOpenError) continue
      console.error(`[shift-auto-close] gagal menutup shift ${shift.id}:`, error)
    }
  }
  if (closed.length > 0) console.info(`[shift-auto-close] ditutup otomatis: ${closed.join(', ')}`)
  return closed
}

const TIMER_KEY = Symbol.for('hammielion.shiftAutoCloseTimer')

/** Pemeriksa tiap menit; satu per proses (aman bila dipanggil ulang saat hot reload). */
export function startShiftAutoCloseTimer(): void {
  const g = globalThis as unknown as Record<symbol, NodeJS.Timeout | undefined>
  if (g[TIMER_KEY] || !isShiftAutoCloseEnabled()) return
  g[TIMER_KEY] = setInterval(() => {
    autoCloseOverdueShifts().catch(error => console.error('[shift-auto-close] error:', error))
  }, 60_000)
  g[TIMER_KEY]?.unref?.()
}
