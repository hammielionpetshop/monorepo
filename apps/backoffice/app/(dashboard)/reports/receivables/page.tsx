import Link from 'next/link'
import { db, customerDebts, customers, branches, transactions, paymentMethods, eq, notInArray, desc } from '@/lib/db'
import ReceivablesClient from './_components/receivables-client'
import type { ReceivableRow, PaymentMethod } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function ReceivablesPage() {
  let rows: ReceivableRow[] = []
  let pmData: PaymentMethod[] = []
  let error: string | null = null

  try {
    rows = await db
      .select({
        id: customerDebts.id,
        customerId: customerDebts.customerId,
        customerName: customers.name,
        customerCode: customers.code,
        trxNumber: transactions.trxNumber,
        branchName: branches.name,
        totalAmount: customerDebts.totalAmount,
        paidAmount: customerDebts.paidAmount,
        remainingAmount: customerDebts.remainingAmount,
        dueAt: customerDebts.dueAt,
        status: customerDebts.status,
        note: customerDebts.note,
        createdAt: customerDebts.createdAt,
      })
      .from(customerDebts)
      .innerJoin(customers, eq(customerDebts.customerId, customers.id))
      .leftJoin(branches, eq(customerDebts.branchId, branches.id))
      .leftJoin(transactions, eq(customerDebts.transactionId, transactions.id))
      .where(notInArray(customerDebts.status, ['PAID', 'VOIDED']))
      .orderBy(desc(customerDebts.createdAt))

    pmData = await db
      .select({ id: paymentMethods.id, name: paymentMethods.name, type: paymentMethods.type })
      .from(paymentMethods)
  } catch (e) {
    console.error('ReceivablesPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data piutang'
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-foreground">Laporan Piutang</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Daftar hutang customer yang belum lunas dari seluruh cabang.{' '}
        <Link href="/master-data/customers" className="text-primary hover:underline">
          Kelola per customer
        </Link>
      </p>
      <ReceivablesClient rows={rows} paymentMethods={pmData} />
    </div>
  )
}
