export interface ReceivableRow {
  id: number
  customerId: number
  customerName: string
  customerCode: string | null
  trxNumber: string | null
  branchId: number | null
  branchName: string | null
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  dueAt: Date | string | null
  status: string
  note: string | null
  createdAt: Date | string
}

export interface BranchOption {
  id: number
  name: string
}

export interface PaymentMethod {
  id: number
  name: string
  type: string
}
