const WIB_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const CLOSE_AT_MS = (23 * 60 + 59) * 60 * 1000

/** Saat shift ditutup otomatis: pukul 23.59 WIB pada tanggal (WIB) shift itu dibuka. */
export function shiftAutoCloseAt(openedAt: Date): Date {
  return new Date(wibDayStart(openedAt).getTime() + CLOSE_AT_MS)
}

/** Awal hari (00.00 WIB) dari instan `now`, sebagai instan absolut. */
export function wibDayStart(now: Date = new Date()): Date {
  const wibMs = now.getTime() + WIB_OFFSET_MS
  return new Date(Math.floor(wibMs / DAY_MS) * DAY_MS - WIB_OFFSET_MS)
}

export function isShiftOverdue(openedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= shiftAutoCloseAt(openedAt).getTime()
}

export const AUTO_CLOSE_REASON =
  'Ditutup otomatis sistem pukul 23.59 WIB karena shift belum ditutup — kas tidak dihitung (dicatat Rp 0).'
