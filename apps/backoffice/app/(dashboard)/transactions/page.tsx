import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { db, branches, paymentMethods, customers, eq } from '@/lib/db'
import TransactionListClient from './_components/transaction-list-client'
import type { BranchOption, PaymentMethodOption } from './_components/types'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function TransactionsPage({ searchParams }: Props) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) redirect('/login')

  const sp = await searchParams
  const isPrivileged = ['OWNER', 'GM'].includes(payload.role)

  const page = Math.max(1, parseInt(String(sp.page ?? '1'), 10) || 1)
  const q = String(sp.q ?? '')
  const status = String(sp.status ?? '')
  const saleType = String(sp.saleType ?? '')
  const branchId = isPrivileged ? String(sp.branchId ?? '') : ''
  const dateFrom = String(sp.dateFrom ?? '')
  const dateTo = String(sp.dateTo ?? '')
  const customerId = String(sp.customerId ?? '')
  const paymentMethodId = String(sp.paymentMethodId ?? '')

  let customerName = ''
  const customerIdNum = parseInt(customerId, 10)
  if (customerId && !isNaN(customerIdNum)) {
    const found = await db
      .select({ name: customers.name })
      .from(customers)
      .where(eq(customers.id, customerIdNum))
      .limit(1)
    customerName = found[0]?.name ?? ''
  }

  const [branchOptions, paymentMethodOptions] = await Promise.all([
    isPrivileged
      ? db
          .select({ id: branches.id, name: branches.name })
          .from(branches)
          .where(eq(branches.isActive, true))
          .orderBy(branches.name)
      : Promise.resolve([] as BranchOption[]),
    db
      .select({ id: paymentMethods.id, name: paymentMethods.name })
      .from(paymentMethods)
      .orderBy(paymentMethods.name),
  ])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Riwayat Transaksi</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Daftar semua transaksi penjualan beserta status dan aksi void.
        </p>
      </div>
      <TransactionListClient
        branches={branchOptions}
        paymentMethodsList={paymentMethodOptions}
        isPrivileged={isPrivileged}
        initialPage={page}
        initialQ={q}
        initialStatus={status}
        initialSaleType={saleType}
        initialBranchId={branchId}
        initialDateFrom={dateFrom}
        initialDateTo={dateTo}
        initialCustomerId={customerId}
        initialCustomerName={customerName}
        initialPaymentMethodId={paymentMethodId}
      />
    </div>
  )
}
