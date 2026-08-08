import Link from 'next/link'
import { redirect } from 'next/navigation'
import { alias } from 'drizzle-orm/pg-core'
import { getAuth, hasPermission } from '@/lib/authz'
import {
  db,
  debtPayments,
  customerDebts,
  customers,
  branches,
  transactions,
  paymentMethods,
  shifts,
  users,
  and,
  eq,
  sql,
  desc,
} from '@/lib/db'
import DebtPaymentsClient from './_components/debt-payments-client'
import type { DebtPaymentRow, BranchOption } from './_components/types'

export const dynamic = 'force-dynamic'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const GLOBAL_ROLES = ['OWNER', 'GM']
const DEFAULT_RANGE_DAYS = 30

/** Tanggal hari ini menurut WIB, bukan menurut jam server yang berjalan di UTC. */
function todayWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

function shiftDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default async function DebtPaymentsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string }>
}) {
  const payload = await getAuth()
  if (!payload) redirect('/login')

  // Sumbu SCOPE dipisah dari sumbu CAPABILITY: siapa yang boleh melihat lintas cabang
  // bukan orang yang sama dengan yang boleh membatalkan pelunasan.
  const isGlobal = GLOBAL_ROLES.includes(payload.role)
  const canVoidPayment = hasPermission(payload, 'debt.payment_void')

  const params = await searchParams
  const today = todayWIB()
  const endDate = params.endDate && DATE_REGEX.test(params.endDate) ? params.endDate : today
  const startDate =
    params.startDate && DATE_REGEX.test(params.startDate)
      ? params.startDate
      : shiftDays(endDate, -(DEFAULT_RANGE_DAYS - 1))

  let rows: DebtPaymentRow[] = []
  let branchOptions: BranchOption[] = []
  let error: string | null = null

  try {
    // Cabang pembayaran bisa kosong pada hutang lama, jadi dipakai fallback ke cabang
    // hutangnya — sama seperti yang dilakukan Laporan Laba Rugi.
    const effectiveBranchId = sql<number | null>`COALESCE(${debtPayments.branchId}, ${customerDebts.branchId})`
    // Dua peran berbeda dari tabel users yang sama: yang menerima uang dan yang membatalkan.
    const receiver = alias(users, 'debt_payment_receiver')
    const voider = alias(users, 'debt_payment_voider')

    rows = await db
      .select({
        id: debtPayments.id,
        debtId: debtPayments.debtId,
        customerId: customerDebts.customerId,
        customerName: customers.name,
        customerCode: customers.code,
        trxNumber: transactions.trxNumber,
        debtNote: customerDebts.note,
        branchId: effectiveBranchId,
        branchName: branches.name,
        amount: debtPayments.amount,
        paymentMethodName: paymentMethods.name,
        isCash: sql<boolean>`${paymentMethods.type} = 'CASH'`,
        note: debtPayments.note,
        createdAt: debtPayments.createdAt,
        receivedByName: receiver.name,
        debtRemainingAmount: customerDebts.remainingAmount,
        debtStatus: customerDebts.status,
        shiftId: debtPayments.shiftId,
        shiftStatus: shifts.status,
        shiftNumber: shifts.shiftNumber,
        voidedAt: debtPayments.voidedAt,
        voidedByName: voider.name,
        voidReason: debtPayments.voidReason,
      })
      .from(debtPayments)
      .innerJoin(customerDebts, eq(debtPayments.debtId, customerDebts.id))
      .innerJoin(customers, eq(customerDebts.customerId, customers.id))
      .leftJoin(paymentMethods, eq(debtPayments.paymentMethodId, paymentMethods.id))
      .leftJoin(branches, eq(effectiveBranchId, branches.id))
      // Hutang bisa dicatat manual tanpa transaksi, jadi nota tidak selalu ada.
      .leftJoin(transactions, eq(customerDebts.transactionId, transactions.id))
      .leftJoin(shifts, eq(debtPayments.shiftId, shifts.id))
      .leftJoin(receiver, eq(debtPayments.createdBy, receiver.id))
      .leftJoin(voider, eq(debtPayments.voidedBy, voider.id))
      .where(
        and(
          sql`(${debtPayments.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date >= ${startDate}::date`,
          sql`(${debtPayments.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta')::date <= ${endDate}::date`,
          // Role non-global dikunci ke cabangnya di level query, bukan disembunyikan di UI.
          isGlobal ? undefined : eq(effectiveBranchId, payload.branchId)
        )
      )
      .orderBy(desc(debtPayments.createdAt))

    if (isGlobal) {
      branchOptions = await db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(eq(branches.isActive, true))
        .orderBy(branches.name)
    }
  } catch (e) {
    console.error('DebtPaymentsReportPage error:', e)
    error = 'Terjadi kesalahan saat mengambil riwayat pelunasan'
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
      <h1 className="text-xl font-semibold text-foreground mb-1">Riwayat Pelunasan Piutang</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {isGlobal
          ? 'Semua pelunasan hutang customer yang tercatat dari seluruh cabang. '
          : 'Pelunasan hutang customer yang tercatat di cabang Anda. '}
        <Link href="/reports/receivables" className="text-primary hover:underline">
          Lihat piutang yang belum lunas
        </Link>
      </p>
      <DebtPaymentsClient
        rows={rows}
        branches={branchOptions}
        canVoidPayment={canVoidPayment}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  )
}
