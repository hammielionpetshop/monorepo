export const CATEGORY_BAYAR_HUTANG_INTERNAL = 'Bayar Hutang Internal'
export const CATEGORY_TERIMA_PIUTANG_INTERNAL = 'Terima Piutang Internal'

/**
 * Pelunasan hutang internal = uang pindah antar cabang: keluar dari cabang pembayar (debitur),
 * masuk ke cabang penerima (kreditur). Dicatat di Pendapatan & Pengeluaran kedua cabang supaya
 * jejak uangnya terlihat — bukan di Laba Rugi, karena ini pelunasan, bukan pendapatan/biaya baru.
 */
export function buildInterBranchPaymentCashEntries(input: {
  amount: number
  ibtNumber: string
  debtorBranchId: number
  debtorBranchName: string
  creditorBranchId: number
  creditorBranchName: string
  paymentMethodName: string
  referenceNumber?: string | null
}) {
  const ref = input.referenceNumber?.trim() ? ` · ref ${input.referenceNumber.trim()}` : ''
  const note = (direction: string) =>
    `${direction} ${input.ibtNumber} · ${input.paymentMethodName}${ref}`.slice(0, 255)
  return [
    {
      type: 'EXPENSE' as const,
      category: CATEGORY_BAYAR_HUTANG_INTERNAL,
      branchId: input.debtorBranchId,
      amount: input.amount,
      note: note(`Bayar hutang internal ke ${input.creditorBranchName},`),
    },
    {
      type: 'INCOME' as const,
      category: CATEGORY_TERIMA_PIUTANG_INTERNAL,
      branchId: input.creditorBranchId,
      amount: input.amount,
      note: note(`Terima piutang internal dari ${input.debtorBranchName},`),
    },
  ]
}
