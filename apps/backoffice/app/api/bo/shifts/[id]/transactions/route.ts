import { NextResponse } from 'next/server'
import {
  db, shifts, transactions, transactionPayments, paymentMethods, customers, users,
  eq, and, inArray, desc,
} from '@/lib/db'
import { requireShiftAccess } from '../../_access'

export const dynamic = 'force-dynamic'

/**
 * Daftar nota (transaksi COMPLETED) satu shift — dipakai popup "klik angka Trx" di
 * Breakdown Kasir Riwayat Shift. Filter sengaja disamakan dengan penghitung Trx di
 * `aggregateShiftBreakdown` (shiftId + cashierId + status COMPLETED), supaya jumlah
 * baris popup persis sama dengan angka yang diklik.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireShiftAccess()
    if (gate instanceof NextResponse) return gate

    const { id } = await params
    const shiftId = parseInt(id)
    if (isNaN(shiftId)) {
      return NextResponse.json({ error: 'ID shift tidak valid' }, { status: 400 })
    }

    const url = new URL(req.url)
    const cashierParam = url.searchParams.get('cashierId')
    const cashierId = cashierParam != null ? parseInt(cashierParam) : null
    if (cashierParam != null && isNaN(cashierId as number)) {
      return NextResponse.json({ error: 'ID kasir tidak valid' }, { status: 400 })
    }

    const shiftData = await db.query.shifts.findFirst({ where: eq(shifts.id, shiftId) })
    if (!shiftData || (gate.branchScope !== 'ALL' && shiftData.branchId !== gate.branchId)) {
      return NextResponse.json({ error: 'Shift tidak ditemukan' }, { status: 404 })
    }

    const where = cashierId != null
      ? and(eq(transactions.shiftId, shiftId), eq(transactions.status, 'COMPLETED'), eq(transactions.cashierId, cashierId))
      : and(eq(transactions.shiftId, shiftId), eq(transactions.status, 'COMPLETED'))

    const trxRows = await db
      .select({
        id: transactions.id,
        trxNumber: transactions.trxNumber,
        createdAt: transactions.createdAt,
        cashierId: transactions.cashierId,
        customerId: transactions.customerId,
        payableAmount: transactions.payableAmount,
        changeAmount: transactions.changeAmount,
      })
      .from(transactions)
      .where(where)
      .orderBy(desc(transactions.createdAt))

    const trxIds = trxRows.map((t) => t.id)
    const customerIds = [...new Set(trxRows.map((t) => t.customerId).filter((v): v is number => v != null))]
    const cashierIds = [...new Set(trxRows.map((t) => t.cashierId))]

    const [paymentRows, customerRows, cashierRows] = await Promise.all([
      trxIds.length > 0
        ? db
            .select({
              transactionId: transactionPayments.transactionId,
              amount: transactionPayments.amount,
              methodName: paymentMethods.name,
              type: paymentMethods.type,
            })
            .from(transactionPayments)
            .innerJoin(paymentMethods, eq(transactionPayments.paymentMethodId, paymentMethods.id))
            .where(inArray(transactionPayments.transactionId, trxIds))
        : Promise.resolve([] as { transactionId: number; amount: number; methodName: string; type: string }[]),
      customerIds.length > 0
        ? db.select({ id: customers.id, name: customers.name }).from(customers).where(inArray(customers.id, customerIds))
        : Promise.resolve([] as { id: number; name: string }[]),
      cashierIds.length > 0
        ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, cashierIds))
        : Promise.resolve([] as { id: number; name: string }[]),
    ])

    const customerMap = Object.fromEntries(customerRows.map((c) => [c.id, c.name]))
    const cashierMap = Object.fromEntries(cashierRows.map((u) => [u.id, u.name]))

    const paymentsByTrx: Record<number, { methodName: string; type: string; amount: number }[]> = {}
    for (const p of paymentRows) {
      ;(paymentsByTrx[p.transactionId] ??= []).push({
        methodName: p.methodName,
        type: p.type,
        amount: Number(p.amount),
      })
    }

    const items = trxRows.map((t) => {
      const payments = paymentsByTrx[t.id] ?? []
      const hasDebt = payments.some((p) => p.type === 'DEBT')
      const hasCash = payments.some((p) => p.type === 'CASH')
      const hasNonCash = payments.some((p) => p.type !== 'CASH' && p.type !== 'DEBT')
      // Jenis bayar untuk pencarian cepat: campuran bila lebih dari satu golongan.
      const kinds = [hasCash && 'CASH', hasNonCash && 'NONCASH', hasDebt && 'DEBT'].filter(Boolean) as string[]
      const paymentKind = kinds.length === 1 ? kinds[0] : kinds.length === 0 ? 'NONE' : 'MIXED'
      return {
        id: t.id,
        trxNumber: t.trxNumber,
        createdAt: t.createdAt,
        cashierName: cashierMap[t.cashierId] ?? null,
        customerName: t.customerId != null ? (customerMap[t.customerId] ?? null) : null,
        payableAmount: Number(t.payableAmount),
        paymentKind,
        payments,
      }
    })

    return NextResponse.json({ transactions: items })
  } catch (error: unknown) {
    console.error('[bo/shifts/[id]/transactions] GET error:', error)
    return NextResponse.json({ error: 'Gagal mengambil daftar transaksi shift' }, { status: 500 })
  }
}
