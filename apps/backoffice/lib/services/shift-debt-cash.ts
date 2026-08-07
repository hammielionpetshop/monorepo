import { db, debtPayments, customerDebts, customers, paymentMethods, transactions, users, eq, and, isNull } from '@/lib/db'
import type { ShiftDebtPaymentReceived } from '@petshop/shared'

export interface ShiftDebtCash {
  payments: ShiftDebtPaymentReceived[]
  /** Hanya pelunasan tunai — inilah yang menambah isi laci dan masuk rekonsiliasi. */
  totalCash: number
}

// Pelunasan piutang yang diterima selama satu shift. Yang sudah di-void diabaikan agar
// pembatalan otomatis mengurangi kas yang harus ada, tanpa perlu koreksi manual.
export async function getShiftDebtCash(
  runner: Pick<typeof db, 'select'>,
  shiftId: number
): Promise<ShiftDebtCash> {
  const rows = await runner
    .select({
      createdAt: debtPayments.createdAt,
      amount: debtPayments.amount,
      paymentMethodName: paymentMethods.name,
      paymentMethodType: paymentMethods.type,
      customerName: customers.name,
      trxNumber: transactions.trxNumber,
      receivedByName: users.name,
    })
    .from(debtPayments)
    .innerJoin(paymentMethods, eq(debtPayments.paymentMethodId, paymentMethods.id))
    .innerJoin(customerDebts, eq(debtPayments.debtId, customerDebts.id))
    .leftJoin(customers, eq(customerDebts.customerId, customers.id))
    // Hutang bisa dicatat manual tanpa transaksi, jadi nota tidak selalu ada.
    .leftJoin(transactions, eq(customerDebts.transactionId, transactions.id))
    .leftJoin(users, eq(debtPayments.createdBy, users.id))
    .where(and(eq(debtPayments.shiftId, shiftId), isNull(debtPayments.voidedAt)))
    .orderBy(debtPayments.createdAt)

  let totalCash = 0
  const payments: ShiftDebtPaymentReceived[] = rows.map((r) => {
    const isCash = r.paymentMethodType === 'CASH'
    const amount = Number(r.amount)
    if (isCash) totalCash += amount
    return {
      createdAt: r.createdAt,
      amount,
      paymentMethodName: r.paymentMethodName,
      isCash,
      customerName: r.customerName ?? null,
      trxNumber: r.trxNumber ?? null,
      receivedByName: r.receivedByName ?? null,
    }
  })

  return { payments, totalCash }
}
