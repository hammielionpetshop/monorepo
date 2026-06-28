export type CashFlowType = 'INCOME' | 'EXPENSE'

export interface CashFlowCategoryOption {
  id: number
  name: string
  type: CashFlowType
}

export interface CashFlowEntry {
  id: number
  type: CashFlowType
  categoryId: number
  categoryName: string | null
  amount: number
  note: string | null
  createdBy: number | null
  createdByName: string | null
  createdAt: string
}

export const TYPE_LABELS: Record<CashFlowType, string> = {
  INCOME: 'Pendapatan',
  EXPENSE: 'Pengeluaran',
}
