import { formatWIB } from '@petshop/shared'

/** Bidang minimum yang dibutuhkan untuk mengelompokkan shift estafet. */
export interface GroupableShift {
  id: number
  branchId: number
  openedAt: string
  closedAt: string | null
  forceClosedAt: string | null
  status: string
  origin: string
  totalClosingCashExpected: number | null
  totalClosingCashReal: number | null
  totalVariance: number | null
  depositVerifiedAt: string | null
  depositVariance: number | null
}

/** Satu baris tabel: satu shift biasa, atau beberapa shift estafet di hari & cabang yang sama. */
export interface ShiftRowGroup<T extends GroupableShift> {
  key: string
  /** Urut dari shift pertama hari itu (#1, #2, ...). */
  shifts: T[]
}

export interface ShiftGroupTotals {
  openedAt: string
  /** Null selama shift terakhir masih berjalan. */
  closedAt: string | null
  status: 'OPEN' | 'CLOSED' | 'FORCE_CLOSED'
  expected: number | null
  real: number | null
  variance: number | null
  /** Shift yang setorannya perlu diverifikasi finance (sudah tutup, bukan shift backoffice). */
  depositEligible: number
  depositVerified: number
  depositVariance: number
}

function wibDay(iso: string): string {
  return formatWIB(iso, { year: 'numeric', month: '2-digit', day: '2-digit' })
}

/**
 * Kelompokkan shift kasir cabang yang dibuka di hari WIB yang sama (estafet). Shift buatan
 * backoffice (penjualan grosir) bukan laci kasir, jadi selalu berdiri sendiri. Urutan baris
 * mengikuti data masuk (terbaru dulu); kelompok menempati posisi shift terbarunya.
 */
export function groupEstafetShifts<T extends GroupableShift>(rows: T[]): ShiftRowGroup<T>[] {
  const groups: ShiftRowGroup<T>[] = []
  const byKey = new Map<string, ShiftRowGroup<T>>()
  for (const row of rows) {
    if (row.origin === 'BACKOFFICE') {
      groups.push({ key: `s${row.id}`, shifts: [row] })
      continue
    }
    const key = `d${row.branchId}-${wibDay(row.openedAt)}`
    const existing = byKey.get(key)
    if (existing) {
      existing.shifts.push(row)
    } else {
      const group = { key, shifts: [row] }
      byKey.set(key, group)
      groups.push(group)
    }
  }
  for (const g of groups) {
    g.shifts.sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime())
  }
  return groups
}

function sumKnown(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v != null)
  return known.length > 0 ? known.reduce((a, b) => a + b, 0) : null
}

export function groupTotals(shifts: GroupableShift[]): ShiftGroupTotals {
  const last = shifts[shifts.length - 1]
  const status = shifts.some((s) => s.status === 'OPEN')
    ? 'OPEN'
    : shifts.some((s) => s.status === 'FORCE_CLOSED')
      ? 'FORCE_CLOSED'
      : 'CLOSED'
  const eligible = shifts.filter((s) => s.status !== 'OPEN' && s.origin !== 'BACKOFFICE')
  const verified = eligible.filter((s) => s.depositVerifiedAt != null)
  return {
    openedAt: shifts[0].openedAt,
    closedAt: last.status === 'OPEN' ? null : (last.closedAt ?? last.forceClosedAt),
    status,
    expected: sumKnown(shifts.map((s) => s.totalClosingCashExpected)),
    real: sumKnown(shifts.map((s) => s.totalClosingCashReal)),
    variance: sumKnown(shifts.map((s) => s.totalVariance)),
    depositEligible: eligible.length,
    depositVerified: verified.length,
    depositVariance: verified.reduce((sum, s) => sum + (s.depositVariance ?? 0), 0),
  }
}
