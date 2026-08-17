export interface ShiftExpense {
  id: number
  shiftId: number
  shiftNumber: number
  shiftStatus: string
  branchId: number
  branchName: string | null
  cashierId: number
  cashierName: string | null
  categoryId: number | null
  categoryName: string | null
  categoryCustom: string | null
  amount: number
  note: string
  proofImage: string | null
  createdAt: string
}

export interface Option {
  id: number
  name: string
}

export interface ExpenseFilters {
  startDate: string
  endDate: string
  branchId: string
  cashierId: string
  categoryId: string
  onlyOpenShift: boolean
  q: string
}

export const EMPTY_FILTERS: ExpenseFilters = {
  startDate: '',
  endDate: '',
  branchId: '',
  cashierId: '',
  categoryId: '',
  onlyOpenShift: false,
  q: '',
}
