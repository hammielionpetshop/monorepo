/** Batas idle tampilan Web POS — perangkat bersama yang sering ditinggal terbuka. */
export const POS_IDLE_TIMEOUT_MS = 10 * 60_000
/** Batas idle backoffice. */
export const BACKOFFICE_IDLE_TIMEOUT_MS = 30 * 60_000
/** Peringatan muncul selama ini sebelum keluar otomatis. */
export const IDLE_WARNING_MS = 60_000

export const LAST_ACTIVITY_STORAGE_KEY = 'hl_last_activity_at'

/**
 * Sisa waktu (ms) sebelum sesi dianggap idle; ≤ 0 berarti sudah lewat.
 *
 * Aktivitas terakhir = yang paling baru antara catatan aktivitas di browser dan saat token
 * diterbitkan. Waktu terbit ikut dihitung supaya catatan basi dari sesi sebelumnya di
 * perangkat yang sama tidak langsung menendang orang yang baru saja login.
 */
export function idleRemainingMs(params: {
  now: number
  lastActivityAt: number | null
  sessionStartedAt: number
  timeoutMs: number
}): number {
  const last = Math.max(params.lastActivityAt ?? 0, params.sessionStartedAt)
  return last + params.timeoutMs - params.now
}

export function readLastActivity(): number | null {
  try {
    const value = Number(window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export function writeLastActivity(at: number): void {
  try {
    window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(at))
  } catch {
    // Penyimpanan diblokir (mode privat dsb.) — timer di memori tetap berjalan.
  }
}
