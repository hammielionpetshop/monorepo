export interface TransactionRow {
  id: number
  trxNumber: string
  branchName: string
  cashierName: string
  customerName: string | null
  paymentMethods: string
  payableAmount: number
  status: string
  createdAt: string
}

export interface TransactionListResponse {
  data: TransactionRow[]
  total: number
  page: number
  totalPages: number
}

export interface BranchOption {
  id: number
  name: string
}

export interface PaymentMethodOption {
  id: number
  name: string
}

export interface CustomerOption {
  id: number
  name: string
  phone: string | null
}
