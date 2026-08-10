export interface Payable {
  id: number
  transferId: number
  ibtNumber: string | null
  debtorBranchId: number
  debtorBranchName: string | null
  creditorBranchId: number
  creditorBranchName: string | null
  totalAmount: number
  paidAmount: number
  status: string
  notes: string | null
  dueAt: string | null
  createdAt: string
}

export interface BranchOption {
  id: number
  name: string
}
