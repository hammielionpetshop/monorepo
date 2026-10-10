export interface PayablePayment {
  id: number
  amount: number
  /** null = pembayaran lama sebelum metode bayar wajib dicatat (v1.107.48). */
  methodName: string | null
  referenceNumber: string | null
  notes: string | null
  paidAt: string
  paidByName: string | null
}

export interface WaiveInfo {
  byName: string | null
  at: string
  reason: string | null
}

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
  payments: PayablePayment[]
  /** Hanya untuk status WAIVED; null bila dihapus sebelum audit penghapusan ada. */
  waive: WaiveInfo | null
}

export interface BranchOption {
  id: number
  name: string
}
