/**
 * Bentuk baku nomor telepon untuk dibandingkan: hanya angka, awalan 62/+62 dijadikan 0.
 * "0812-3456 789", "+62 812 3456789", dan "62812 3456789" dianggap nomor yang sama.
 * Dipakai mencegah pemilik kucing terdaftar ganda.
 */
/**
 * Angka untuk mencocokkan nomor telepon dari kotak cari — HANYA bila yang diketik memang nomor
 * (angka, spasi, +, -, kurung). "Sari 12" adalah nama, bukan nomor: tanpa aturan ini angka di
 * dalam nama ikut dicocokkan ke nomor telepon orang lain.
 */
export function phoneSearchDigits(query: string | null | undefined): string {
  const q = (query ?? '').trim()
  if (!q || !/^[\d\s+()-]+$/.test(q)) return ''
  return normalizePhone(q)
}

export function normalizePhone(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '')
  if (digits.startsWith('62')) return `0${digits.slice(2)}`
  return digits
}
