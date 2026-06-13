import { notFound } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { db, customers, transactions, customerDebts, paymentMethods, eq, desc } from '@/lib/db'
import { verifyAccessToken } from '@/lib/auth'
import CustomerDetailClient from './_components/customer-detail-client'
import type { TransactionSummary, CustomerDebt, PaymentMethod } from '../_components/types'

export const dynamic = 'force-dynamic'

const DEBT_ALLOWED_ROLES = ['OWNER', 'GM', 'MANAGER', 'FINANCE']

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const customerId = Number(id)

  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  const userRole = payload?.role ?? ''

  const customerResult = await db
    .select({
      id: customers.id,
      code: customers.code,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      address: customers.address,
      isActive: customers.isActive,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1)

  if (customerResult.length === 0) notFound()

  const customer = customerResult[0]

  let trxData: TransactionSummary[] = []
  let debtData: CustomerDebt[] = []
  let pmData: PaymentMethod[] = []
  let error: string | null = null

  try {
    trxData = await db
      .select({
        id: transactions.id,
        trxNumber: transactions.trxNumber,
        totalAmount: transactions.totalAmount,
        payableAmount: transactions.payableAmount,
        status: transactions.status,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(eq(transactions.customerId, customerId))
      .orderBy(desc(transactions.createdAt))
      .limit(50)
  } catch (e) {
    console.error('CustomerDetailPage trx error:', e)
    error = 'Terjadi kesalahan saat mengambil riwayat transaksi'
  }

  if (!error && DEBT_ALLOWED_ROLES.includes(userRole)) {
    try {
      const debtRows = await db
        .select({
          id: customerDebts.id,
          customerId: customerDebts.customerId,
          transactionId: customerDebts.transactionId,
          totalAmount: customerDebts.totalAmount,
          paidAmount: customerDebts.paidAmount,
          remainingAmount: customerDebts.remainingAmount,
          dueAt: customerDebts.dueAt,
          status: customerDebts.status,
          note: customerDebts.note,
          createdAt: customerDebts.createdAt,
        })
        .from(customerDebts)
        .where(eq(customerDebts.customerId, customerId))
        .orderBy(desc(customerDebts.createdAt))

      const trxMap = new Map(trxData.map((t) => [t.id, t.trxNumber]))

      debtData = debtRows.map((d) => ({
        ...d,
        trxNumber: d.transactionId ? (trxMap.get(d.transactionId) ?? null) : null,
      }))

      pmData = await db
        .select({
          id: paymentMethods.id,
          name: paymentMethods.name,
          type: paymentMethods.type,
        })
        .from(paymentMethods)
    } catch (e) {
      console.error('CustomerDetailPage debt error:', e)
      error = 'Terjadi kesalahan saat mengambil data hutang'
    }
  }

  if (error) {
    return (
      <div className="p-6">
        <Link
          href="/master-data/customers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          ← Kembali ke Daftar Customer
        </Link>
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <CustomerDetailClient
        customer={customer}
        transactions={trxData}
        debts={debtData}
        paymentMethods={pmData}
        canViewDebts={DEBT_ALLOWED_ROLES.includes(userRole)}
      />
    </div>
  )
}
