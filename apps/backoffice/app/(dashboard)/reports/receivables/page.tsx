import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/authz'
import { db, customerDebts, customers, branches, transactions, paymentMethods, and, eq, notInArray, desc } from '@/lib/db'
import ReceivablesClient from './_components/receivables-client'
import type { ReceivableRow, BranchOption, PaymentMethod } from './_components/types'

export const dynamic = 'force-dynamic'

const GLOBAL_ROLES = ['OWNER', 'GM']

export default async function ReceivablesPage() {
  const payload = await getAuth()
  if (!payload) redirect('/login')

  // Hanya role global yang boleh melihat lintas cabang; sisanya dikunci ke cabangnya sendiri
  // di level query, bukan sekadar disembunyikan di UI.
  const isGlobal = GLOBAL_ROLES.includes(payload.role)

  let rows: ReceivableRow[] = []
  let branchOptions: BranchOption[] = []
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
        trxCreatedAt: transactions.createdAt,
        branchId: customerDebts.branchId,
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
      .where(
        and(
          notInArray(customerDebts.status, ['PAID', 'VOIDED']),
          isGlobal ? undefined : eq(customerDebts.branchId, payload.branchId)
        )
      )
      .orderBy(desc(customerDebts.createdAt))

    if (isGlobal) {
      branchOptions = await db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(eq(branches.isActive, true))
        .orderBy(branches.name)
    }

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
        {isGlobal
          ? 'Daftar hutang customer yang belum lunas dari seluruh cabang. '
          : 'Daftar hutang customer yang belum lunas di cabang Anda. '}
        <Link href="/reports/debt-payments" className="text-primary hover:underline">
          Riwayat pelunasan
        </Link>
        {' · '}
        <Link href="/master-data/customers" className="text-primary hover:underline">
          Kelola per customer
        </Link>
      </p>
      <ReceivablesClient rows={rows} branches={branchOptions} paymentMethods={pmData} />
    </div>
  )
}
