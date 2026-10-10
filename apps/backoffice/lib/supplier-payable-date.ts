const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

export function todayWibDate(now: Date = new Date()): string {
  return new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10)
}

// Tanggal bayar bisa diisi mundur karena pembayaran lama (sebelum halaman hutang
// supplier ada) dicatat belakangan. Hari ini → jam sekarang; tanggal lampau →
// pukul 12.00 WIB hari itu; tanggal di masa depan / tidak valid → null.
export function resolvePaidAt(paidDate: string | undefined, now: Date): Date | null {
  if (!paidDate) return now
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) return null
  const today = todayWibDate(now)
  if (paidDate > today) return null
  if (paidDate === today) return now
  const parsed = new Date(`${paidDate}T12:00:00+07:00`)
  if (Number.isNaN(parsed.getTime())) return null
  // Tolak tanggal yang "digulung" (mis. 2026-02-31 → 3 Maret)
  return todayWibDate(parsed) === paidDate ? parsed : null
}
