export interface ReceivableRow {
  id: number
  customerId: number
  customerName: string
  customerCode: string | null
  trxNumber: string | null
  trxCreatedAt: Date | string | null
  branchId: number | null
  branchName: string | null
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  dueAt: Date | string | null
  status: string
  note: string | null
  createdAt: Date | string
  /** Nota piutang ini berisi jasa grooming ("Bayar saat ambil" di tab Grooming). */
  isGrooming: boolean
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
