export interface PeriodRange {
  label: string
  getRange: () => { start: string; end: string }
}

export function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function today(): string {
  return toLocalISO(new Date())
}

function yesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toLocalISO(d)
}

/** Minggu dimulai hari Senin. */
function startOfWeek(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toLocalISO(d)
}

function startOfMonth(): string {
  const d = new Date()
  d.setDate(1)
  return toLocalISO(d)
}

/** Preset periode yang dipakai di laporan & riwayat transaksi, supaya labelnya seragam. */
export const PERIOD_RANGES: PeriodRange[] = [
  { label: 'Hari Ini', getRange: () => { const t = today(); return { start: t, end: t } } },
  { label: 'Kemarin', getRange: () => { const y = yesterday(); return { start: y, end: y } } },
  { label: 'Minggu Ini', getRange: () => ({ start: startOfWeek(), end: today() }) },
  { label: 'Bulan Ini', getRange: () => ({ start: startOfMonth(), end: today() }) },
]
