export type CashFlowType = 'INCOME' | 'EXPENSE'

export interface CashFlowCategory {
  id: number
  name: string
  type: CashFlowType
}

export interface CashFlowCategoryFormData {
  name: string
  type: CashFlowType
}

export const TYPE_LABELS: Record<CashFlowType, string> = {
  INCOME: 'Pendapatan',
  EXPENSE: 'Pengeluaran',
}
