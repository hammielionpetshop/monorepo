import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/authz'
import { db, customerDebts, debtPayments, auditLogs, eq, and, isNull, sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  reason: z.string().trim().max(255, 'Alasan maksimal 255 karakter').optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; debtId: string; paymentId: string }> }
) {
  try {
    const gate = await requirePermission('debt.payment_void')
    if (gate instanceof NextResponse) return gate
    const payload = gate

    const { id, debtId, paymentId } = await params
    if (!/^\d+$/.test(id) || !/^\d+$/.test(debtId) || !/^\d+$/.test(paymentId)) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const customerId = Number(id)
    const debtIdNum = Number(debtId)
    const paymentIdNum = Number(paymentId)

    let reason: string | undefined
    const contentType = req.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      const body = await req.json().catch(() => ({}))
      const parsed = bodySchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' }, { status: 400 })
      }
      reason = parsed.data.reason
    }

    const updated = await db.transaction(async (trx) => {
      const [debt] = await trx
        .select()
        .from(customerDebts)
        .where(eq(customerDebts.id, debtIdNum))
        .for('update')
        .limit(1)

      if (!debt || debt.customerId !== customerId) throw new Error('DEBT_NOT_FOUND')
      if (debt.status === 'VOIDED') throw new Error('DEBT_VOIDED')

      const [payment] = await trx
        .select({ id: debtPayments.id, amount: debtPayments.amount, debtId: debtPayments.debtId, voidedAt: debtPayments.voidedAt })
        .from(debtPayments)
        .where(eq(debtPayments.id, paymentIdNum))
        .limit(1)

      if (!payment || payment.debtId !== debtIdNum) throw new Error('PAYMENT_NOT_FOUND')
      if (payment.voidedAt) throw new Error('PAYMENT_ALREADY_VOIDED')

      await trx
        .update(debtPayments)
        .set({ voidedAt: new Date(), voidedBy: payload.userId, voidReason: reason ?? null })
        .where(eq(debtPayments.id, paymentIdNum))

      // Recompute dari sum pembayaran yang masih aktif (bukan sekadar mengurangi, agar tahan drift)
      const [{ paid }] = await trx
        .select({ paid: sql<number>`COALESCE(SUM(${debtPayments.amount}), 0)` })
        .from(debtPayments)
        .where(and(eq(debtPayments.debtId, debtIdNum), isNull(debtPayments.voidedAt)))

      const newPaid = Number(paid)
      const newRemaining = debt.totalAmount - newPaid
      const newStatus = newPaid <= 0 ? 'UNPAID' : newRemaining <= 0 ? 'PAID' : 'PARTIAL'

      const [updatedDebt] = await trx
        .update(customerDebts)
        .set({ paidAmount: newPaid, remainingAmount: newRemaining, status: newStatus })
        .where(eq(customerDebts.id, debtIdNum))
        .returning()

      await trx.insert(auditLogs).values({
        branchId: debt.branchId ?? payload.branchId,
        userId: payload.userId,
        action: 'VOID_DEBT_PAYMENT',
        tableName: 'debt_payments',
        recordId: String(paymentIdNum),
        newData: JSON.stringify({ debtId: debtIdNum, amount: payment.amount, reason: reason ?? null, voidedBy: payload.userId }),
      })

      return updatedDebt
    })

    return NextResponse.json(updated)
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'DEBT_NOT_FOUND') {
        return NextResponse.json({ error: 'Data hutang tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'DEBT_VOIDED') {
        return NextResponse.json({ error: 'Hutang ini sudah dibatalkan' }, { status: 409 })
      }
      if (error.message === 'PAYMENT_NOT_FOUND') {
        return NextResponse.json({ error: 'Data pembayaran tidak ditemukan' }, { status: 404 })
      }
      if (error.message === 'PAYMENT_ALREADY_VOIDED') {
        return NextResponse.json({ error: 'Pembayaran ini sudah dibatalkan sebelumnya' }, { status: 409 })
      }
    }
    console.error('POST /api/bo/customers/[id]/debts/[debtId]/payments/[paymentId]/void error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat membatalkan pembayaran hutang' }, { status: 500 })
  }
}
