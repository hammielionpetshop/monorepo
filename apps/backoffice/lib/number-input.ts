/**
 * Bantu input nominal rupiah: pengguna mengetik angka, tampilannya dikelompokkan ribuan
 * ("1.250.000") supaya tidak ambigu, tapi yang dikirim ke API tetap integer polos.
 */

/** Buang semua non-digit dari teks input. */
export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * Parse teks input bernominal (mis. "1.250.000") menjadi integer rupiah.
 * String kosong / bukan angka → 0. Di atas batas aman → 0.
 */
export function parseRupiahInput(raw: string): number {
  const d = digitsOnly(raw)
  if (!d) return 0
  const n = Number(d)
  return Number.isSafeInteger(n) ? n : 0
}

/**
 * Format teks/angka menjadi berkelompok ribuan gaya id-ID ("1250000" → "1.250.000").
 * Input kosong tetap kosong supaya placeholder muncul.
 */
export function formatRupiahInput(raw: string | number): string {
  const d = typeof raw === 'number' ? String(Math.trunc(Math.abs(raw))) : digitsOnly(raw)
  if (!d) return ''
  return Number(d).toLocaleString('id-ID')
}
