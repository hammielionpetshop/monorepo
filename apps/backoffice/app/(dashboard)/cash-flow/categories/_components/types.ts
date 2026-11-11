export type CashFlowType = 'INCOME' | 'EXPENSE'
export type ReportKind = 'COST' | 'NON_COST' | 'INCOME' | 'NON_INCOME'

export interface CashFlowCategory {
  id: number
  name: string
  type: CashFlowType
  reportKind: ReportKind | null
  isActive: boolean
  isSystem: boolean
  ownerOnly: boolean
  noteRequired: boolean
  /** Jumlah catatan Arus Kas yang memakai kategori ini. */
  usedCount: number
}

export interface CashFlowCategoryFormData {
  name: string
  type: CashFlowType
  reportKind: ReportKind | null
  isActive: boolean
  ownerOnly: boolean
  noteRequired: boolean
}

export interface ExpenseLink {
  id: number
  name: string
  cashFlowCategoryId: number | null
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

export const REPORT_KIND_HINTS: Record<ReportKind, string> = {
  COST: 'mengurangi laba (listrik, air, perbaikan, …)',
  NON_COST: 'uang keluar tapi tidak mengurangi laba (diambil Owner, cicilan pinjaman)',
  INCOME: 'menambah laba (rebate supplier, jual barang bekas)',
  NON_INCOME: 'uang masuk tapi bukan laba (modal Owner, pinjaman)',
}

export function reportKindsFor(type: CashFlowType): ReportKind[] {
  return type === 'EXPENSE' ? ['COST', 'NON_COST'] : ['INCOME', 'NON_INCOME']
}
