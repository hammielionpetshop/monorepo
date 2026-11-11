import {
  db,
  interBranchPayables,
  interBranchPayments,
  interBranchTransfers,
  cashFlowCategories,
  cashFlowEntries,
  legacySettlementRuns,
  auditLogs,
  eq,
  and,
  inArray,
  isNull,
  sql,
} from '@/lib/db'
import Big from 'big.js'
import { CATEGORY_BAYAR_HUTANG_INTERNAL, CATEGORY_TERIMA_PIUTANG_INTERNAL } from '@/lib/inter-branch-payment-cash'
import { applyInternalCredit, lockInternalCreditPair } from './internal-credit-service'
import { lockSettlement } from './deposit-settlement-service'
import { todayWibDate } from '@/lib/payment-date'

// Batalkan pembayaran manual Utang Internal (spec docs/work/specs/2026-11-11-ibp-payment-cancel-design.md).
// Pembayaran asal tidak diubah: pembatalan = baris BATAL_BAYAR negatif + catatan Arus Kas asal
// ditandai Batal (pola F2-4) + audit. Saldo Internal pasangan cabang langsung memotong lagi.

export const PAYMENT_CANCEL_SOURCE = 'BATAL_BAYAR'

export class PaymentCancelError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message)
    this.name = 'PaymentCancelError'
  }
}

export interface CancelPaymentInput {
  payableId: number
  paymentId: number
  reason: string
  userId: number
  now?: Date
}

export async function cancelInterBranchPayment(input: CancelPaymentInput) {
  const reason = input.reason.trim()
  if (reason.length < 5) throw new PaymentCancelError('Alasan pembatalan wajib diisi (minimal 5 huruf)')
  const now = input.now ?? new Date()

  return db.transaction(async (tx) => {
    const [head] = await tx
      .select({ debtorBranchId: interBranchPayables.debtorBranchId, creditorBranchId: interBranchPayables.creditorBranchId })
      .from(interBranchPayables)
      .where(eq(interBranchPayables.id, input.payableId))
    if (!head) throw new PaymentCancelError('Data hutang tidak ditemukan', 404)

    // Urutan kunci sama dengan pelunasan susulan (settlement dulu) dan Retur Internal (pasangan
    // cabang sebelum baris utang), supaya tidak saling menunggu.
    await lockSettlement(tx)
    await lockInternalCreditPair(tx, head.debtorBranchId, head.creditorBranchId)

    const [payable] = await tx
      .select()
      .from(interBranchPayables)
      .where(eq(interBranchPayables.id, input.payableId))
      .for('update')
    if (!payable) throw new PaymentCancelError('Data hutang tidak ditemukan', 404)
    const [transfer] = await tx
      .select({ ibtNumber: interBranchTransfers.ibtNumber })
      .from(interBranchTransfers)
      .where(eq(interBranchTransfers.id, payable.transferId))
    const ibtNumber = transfer?.ibtNumber ?? null
    if (payable.status === 'WAIVED') {
      throw new PaymentCancelError('Hutang yang sudah dihapuskan tidak bisa dibatalkan pembayarannya', 409)
    }

    const [payment] = await tx
      .select()
      .from(interBranchPayments)
      .where(and(eq(interBranchPayments.id, input.paymentId), eq(interBranchPayments.payableId, input.payableId)))
    if (!payment) throw new PaymentCancelError('Pembayaran tidak ditemukan', 404)
    if (payment.sourceType !== null) {
      throw new PaymentCancelError('Hanya pembayaran manual yang bisa dibatalkan di sini. Baris otomatis dibatalkan dari dokumen asalnya.', 409)
    }
    if (payment.amount <= 0) throw new PaymentCancelError('Nominal pembayaran ini tidak bisa dibatalkan', 409)

    const [already] = await tx
      .select({ id: interBranchPayments.id })
      .from(interBranchPayments)
      .where(eq(interBranchPayments.reversalOfPaymentId, payment.id))
    if (already) throw new PaymentCancelError('Pembayaran ini sudah dibatalkan', 409)

    const paidDate = todayWibDate(payment.paidAt)
    const payableDate = todayWibDate(payable.createdAt)
    const [legacyRun] = await tx
      .select({ id: legacySettlementRuns.id })
      .from(legacySettlementRuns)
      .where(and(
        eq(legacySettlementRuns.status, 'ACTIVE'),
        eq(legacySettlementRuns.subtractManual, true),
        sql`${legacySettlementRuns.fromDate} <= ${paidDate}`,
        sql`${legacySettlementRuns.cutoffDate} > ${payableDate}`,
      ))
      .limit(1)
    if (legacyRun) {
      throw new PaymentCancelError(
        `Pembayaran ini ikut dihitung pelunasan susulan SUSULAN-${legacyRun.id} yang masih berlaku. Batalkan pelunasan susulan dulu, lalu batalkan pembayaran ini.`,
        409,
      )
    }

    const newPaid = new Big(payable.paidAmount).minus(payment.amount).toNumber()
    if (newPaid < 0) throw new PaymentCancelError('Jumlah dibayar menjadi minus — data hutang tidak konsisten. Hubungi admin.', 409)
    const newStatus = newPaid === 0 ? 'UNPAID' : 'PARTIAL'

    // Catatan Arus Kas yang dibuat bersama pembayaran ini (hanya pembayaran bermetode, sejak migrasi 0030).
    // Kunci pasangan: kategori sistem + cabang + nominal + waktu catat = waktu bayar. Bila ada dua catatan
    // kembar (dua pembayaran sama persis), keduanya setara; yang dipakai cukup yang belum dibatalkan.
    let cashEntryIds: number[] = []
    if (payment.paymentMethodId !== null) {
      const categories = await tx
        .select({ id: cashFlowCategories.id, name: cashFlowCategories.name, type: cashFlowCategories.type })
        .from(cashFlowCategories)
        .where(inArray(cashFlowCategories.name, [CATEGORY_BAYAR_HUTANG_INTERNAL, CATEGORY_TERIMA_PIUTANG_INTERNAL]))
      const expenseCat = categories.find((c) => c.name === CATEGORY_BAYAR_HUTANG_INTERNAL && c.type === 'EXPENSE')
      const incomeCat = categories.find((c) => c.name === CATEGORY_TERIMA_PIUTANG_INTERNAL && c.type === 'INCOME')
      if (!expenseCat || !incomeCat) throw new PaymentCancelError('Kategori kas Utang Internal tidak ditemukan. Hubungi admin.', 500)

      const findEntry = async (categoryId: number, branchId: number) => {
        const [row] = await tx
          .select({ id: cashFlowEntries.id })
          .from(cashFlowEntries)
          .where(and(
            eq(cashFlowEntries.categoryId, categoryId),
            eq(cashFlowEntries.branchId, branchId),
            eq(cashFlowEntries.amount, payment.amount),
            eq(cashFlowEntries.createdAt, payment.paidAt),
            isNull(cashFlowEntries.cancelledAt),
          ))
          .orderBy(cashFlowEntries.id)
          .limit(1)
          .for('update')
        return row?.id
      }
      const expenseId = await findEntry(expenseCat.id, payable.debtorBranchId)
      const incomeId = await findEntry(incomeCat.id, payable.creditorBranchId)
      if (!expenseId || !incomeId) {
        throw new PaymentCancelError('Catatan Arus Kas pembayaran ini tidak ditemukan atau sudah dibatalkan. Hubungi admin.', 409)
      }
      cashEntryIds = [expenseId, incomeId]
    }

    const [reversal] = await tx.insert(interBranchPayments).values({
      payableId: payable.id,
      amount: -payment.amount,
      paidByUserId: input.userId,
      paymentMethodId: null,
      sourceType: PAYMENT_CANCEL_SOURCE,
      referenceNumber: payment.referenceNumber,
      notes: `Batal bayar #${payment.id} (${paidDate}): ${reason}`.slice(0, 500),
      paidAt: now,
      reversalOfPaymentId: payment.id,
    }).returning({ id: interBranchPayments.id })

    await tx.update(interBranchPayables)
      .set({ paidAmount: newPaid, status: newStatus, updatedAt: now })
      .where(eq(interBranchPayables.id, payable.id))

    if (cashEntryIds.length > 0) {
      await tx.update(cashFlowEntries)
        .set({ cancelledAt: now, cancelledBy: input.userId, cancelReason: `Batal bayar utang internal: ${reason}` })
        .where(inArray(cashFlowEntries.id, cashEntryIds))
    }

    await tx.insert(auditLogs).values({
      branchId: payable.creditorBranchId,
      userId: input.userId,
      action: 'IBP_PAYMENT_CANCELLED',
      tableName: 'inter_branch_payments',
      recordId: String(payment.id),
      oldData: JSON.stringify({ status: payable.status, paidAmount: payable.paidAmount }),
      newData: JSON.stringify({
        payableId: payable.id,
        ibtNumber,
        reversalPaymentId: reversal.id,
        amount: payment.amount,
        paidAt: payment.paidAt.toISOString(),
        reason,
        status: newStatus,
        paidAmount: newPaid,
        cashFlowEntryIds: cashEntryIds,
      }),
    })

    // Saldo Internal pasangan ini (bila ada) langsung memotong tagihan yang terbuka lagi.
    const creditUsages = await applyInternalCredit(tx, {
      debtorBranchId: payable.debtorBranchId,
      creditorBranchId: payable.creditorBranchId,
      userId: input.userId,
      now,
    })

    return {
      reversalPaymentId: reversal.id,
      status: newStatus,
      paidAmount: newPaid,
      cashEntriesCancelled: cashEntryIds.length,
      creditApplied: creditUsages.reduce((sum, u) => sum.plus(u.amount), new Big(0)).toNumber(),
    }
  })
}
