// Umur kucing diisi kasir dalam tahun & bulan, tetapi disimpan sebagai perkiraan tanggal lahir
// (pets.birth_date) supaya umurnya bertambah sendiri di kunjungan berikutnya.

const pad = (n: number) => String(n).padStart(2, '0')

/** Perkiraan tanggal lahir (YYYY-MM-DD) dari umur. null bila umur tidak diisi. */
export function birthDateFromAge(years: number | null | undefined, months: number | null | undefined, today = new Date()): string | null {
  const y = Math.max(0, Math.floor(Number(years ?? 0)))
  const m = Math.max(0, Math.floor(Number(months ?? 0)))
  if (!Number.isFinite(y) || !Number.isFinite(m) || (y === 0 && m === 0)) return null
  const total = today.getUTCFullYear() * 12 + today.getUTCMonth() - (y * 12 + m)
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}-01`
}

/** Umur (tahun, bulan) dari tanggal lahir tersimpan. null bila kosong / tidak valid. */
export function ageFromBirthDate(birthDate: string | Date | null | undefined, today = new Date()): { years: number; months: number } | null {
  if (!birthDate) return null
  const d = typeof birthDate === 'string' ? new Date(`${birthDate.slice(0, 10)}T00:00:00Z`) : birthDate
  if (Number.isNaN(d.getTime())) return null
  const total = today.getUTCFullYear() * 12 + today.getUTCMonth() - (d.getUTCFullYear() * 12 + d.getUTCMonth())
  if (total < 0) return { years: 0, months: 0 }
  return { years: Math.floor(total / 12), months: total % 12 }
}

/** "2 th 3 bln", "5 bln", "1 th", atau "-" bila tidak diketahui. */
export function formatPetAge(birthDate: string | Date | null | undefined, today = new Date()): string {
  const age = ageFromBirthDate(birthDate, today)
  if (!age) return '-'
  if (age.years === 0 && age.months === 0) return '< 1 bln'
  return [age.years > 0 ? `${age.years} th` : '', age.months > 0 ? `${age.months} bln` : ''].filter(Boolean).join(' ')
}
