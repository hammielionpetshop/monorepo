export interface DebtPaymentRow {
  id: number
  debtId: number
  customerId: number
  customerName: string
  customerCode: string | null
  trxNumber: string | null
  debtNote: string | null
  branchId: number | null
  branchName: string | null
  amount: number
  paymentMethodName: string | null
  isCash: boolean
  note: string | null
  createdAt: Date | string
  receivedByName: string | null
  /** Sisa hutang saat ini — dipakai untuk menerangkan dampak pembatalan. */
  debtRemainingAmount: number
  debtStatus: string
  shiftId: number | null
  /** OPEN | CLOSED | FORCE_CLOSED — shift yang sudah tutup berarti kasnya sudah disetorkan. */
  shiftStatus: string | null
  shiftNumber: number | null
  voidedAt: Date | string | null
  voidedByName: string | null
  voidReason: string | null
}

export interface BranchOption {
  id: number
  name: string
}
