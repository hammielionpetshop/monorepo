export type CashFlowType = 'INCOME' | 'EXPENSE'
export type ReportKind = 'COST' | 'NON_COST' | 'INCOME' | 'NON_INCOME'

export interface CashFlowCategoryOption {
  id: number
  name: string
  type: CashFlowType
  reportKind: ReportKind | null
  isActive: boolean
  isSystem: boolean
  ownerOnly: boolean
  noteRequired: boolean
}

export interface MoneyPlaceOption {
  id: number
  name: string
  kind: 'CASH' | 'BANK'
  branchName: string | null
}

export interface BranchOption {
  id: number
  name: string
}

export interface CashFlowEntry {
  id: number
  type: CashFlowType
  categoryId: number
  categoryName: string | null
  categoryIsSystem: boolean | null
  reportKind: ReportKind | null
  amount: number
  note: string | null
  branchId: number | null
  branchName: string | null
  moneyPlaceId: number | null
  moneyPlaceName: string | null
  occurredOn: string
  forMonth: string
  proofPhotoUrl: string | null
  createdBy: number | null
  createdByName: string | null
  createdAt: string
  cancelledAt: string | null
  cancelledByName: string | null
  cancelReason: string | null
  canCancel: boolean
}

export const TYPE_LABELS: Record<CashFlowType, string> = {
  INCOME: 'Pendapatan',
  EXPENSE: 'Pengeluaran',
}

export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  COST: 'Biaya',
  NON_COST: 'Bukan biaya',
  INCOME: 'Pendapatan lain',
  NON_INCOME: 'Bukan pendapatan',
}

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

/** "2026-10-01" / "2026-10" → "Oktober 2026". */
export function monthLabel(value: string): string {
  const [y, m] = value.split('-')
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`
}

/** Daftar "YYYY-MM" dari 12 bulan sebelum s.d. 12 bulan sesudah bulan tanggal uang. */
export function monthChoices(occurredOn: string): string[] {
  const [y, m] = occurredOn.split('-').map(Number)
  const base = y * 12 + (m - 1)
  const out: string[] = []
  for (let i = base + 12; i >= base - 12; i--) {
    out.push(`${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`)
  }
  return out
}
