/**
 * Bentuk baku nomor telepon untuk dibandingkan: hanya angka, awalan 62/+62 dijadikan 0.
 * "0812-3456 789", "+62 812 3456789", dan "62812 3456789" dianggap nomor yang sama.
 * Dipakai mencegah pemilik kucing terdaftar ganda.
 */
export function normalizePhone(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '')
  if (digits.startsWith('62')) return `0${digits.slice(2)}`
  return digits
}
