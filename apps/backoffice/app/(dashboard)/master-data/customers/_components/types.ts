export interface Customer {
  id: number
  code: string | null
  name: string
  phone: string | null
  email: string | null
  address: string | null
  isActive: boolean
  createdAt: Date | string
}

export interface CustomerFormData {
  code: string
  name: string
  phone: string
  email: string
  address: string
}

export interface TransactionSummary {
  id: number
  trxNumber: string
  totalAmount: number
  payableAmount: number
  status: string
  createdAt: Date | string
}

export interface DebtPayment {
  id: number
  debtId: number
  amount: number
  paymentMethodId: number
  createdAt: Date | string
}

export interface CustomerDebt {
  id: number
  customerId: number
  transactionId: number | null
  trxNumber: string | null
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  dueAt: Date | string | null
  status: string
  note: string | null
  createdAt: Date | string
}

export interface PaymentMethod {
  id: number
  name: string
  type: string
}
