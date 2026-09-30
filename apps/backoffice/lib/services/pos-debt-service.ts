import {
  db,
  customers,
  customerDebts,
  debtPayments,
  paymentMethods,
  transactions,
  branches,
  users,
  eq,
  and,
  or,
  ilike,
  notInArray,
  asc,
  desc,
  sql,
} from '@/lib/db'
import { alokasiPembayaranHutang } from '@/lib/debt-payment-alloc'

const STATUS_TIDAK_AKTIF = ['PAID', 'VOIDED']

const piutangAktif = (customerId?: number) =>
  and(
    notInArray(customerDebts.status, STATUS_TIDAK_AKTIF),
    sql`${customerDebts.remainingAmount} > 0`,
    customerId !== undefined ? eq(customerDebts.customerId, customerId) : undefined,
  )

export interface PosDebtor {
  customerId: number
  name: string
  phone: string | null
  outstanding: number
  debtCount: number
  oldestAt: string
}

export async function listDebtors(q: string, limit = 50): Promise<PosDebtor[]> {
  const cari = q.trim()
  const outstanding = sql<number>`SUM(${customerDebts.remainingAmount})::int`

  const rows = await db
    .select({
      customerId: customers.id,
      name: customers.name,
      phone: customers.phone,
      outstanding,
      debtCount: sql<number>`COUNT(*)::int`,
      oldestAt: sql<Date>`MIN(${customerDebts.createdAt})`.mapWith(customerDebts.createdAt),
    })
    .from(customerDebts)
    .innerJoin(customers, eq(customerDebts.customerId, customers.id))
    .where(
      and(
        piutangAktif(),
        cari ? or(ilike(customers.name, `%${cari}%`), ilike(customers.phone, `%${cari}%`)) : undefined,
      ),
    )
    .groupBy(customers.id, customers.name, customers.phone)
    .orderBy(desc(outstanding))
    .limit(limit)

  return rows.map((r) => ({
    customerId: r.customerId,
    name: r.name,
    phone: r.phone ?? null,
    outstanding: Number(r.outstanding),
    debtCount: Number(r.debtCount),
    oldestAt: new Date(r.oldestAt).toISOString(),
  }))
}

export interface PosDebtRow {
  id: number
  createdAt: string
  dueAt: string | null
  trxNumber: string | null
  branchName: string | null
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  status: string
  note: string | null
}

export interface PosDebtPaymentRow {
  id: number
  createdAt: string
  amount: number
  paymentMethodName: string
  branchName: string | null
  receivedByName: string | null
  trxNumber: string | null
  note: string | null
  voided: boolean
}

export interface PosCustomerDebtDetail {
  customer: { id: number; name: string; phone: string | null }
  outstanding: number
  debts: PosDebtRow[]
  recentPayments: PosDebtPaymentRow[]
}

export async function getCustomerDebtDetail(customerId: number): Promise<PosCustomerDebtDetail | null> {
  const [customer] = await db
    .select({ id: customers.id, name: customers.name, phone: customers.phone })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1)
  if (!customer) return null

  const [debtRows, paymentRows] = await Promise.all([
    db
      .select({
        id: customerDebts.id,
        createdAt: customerDebts.createdAt,
        dueAt: customerDebts.dueAt,
        trxNumber: transactions.trxNumber,
        branchName: branches.name,
        totalAmount: customerDebts.totalAmount,
        paidAmount: customerDebts.paidAmount,
        remainingAmount: customerDebts.remainingAmount,
        status: customerDebts.status,
        note: customerDebts.note,
      })
      .from(customerDebts)
      .leftJoin(transactions, eq(customerDebts.transactionId, transactions.id))
      .leftJoin(branches, eq(customerDebts.branchId, branches.id))
      .where(piutangAktif(customerId))
      .orderBy(asc(customerDebts.createdAt), asc(customerDebts.id)),
    db
      .select({
        id: debtPayments.id,
        createdAt: debtPayments.createdAt,
        amount: debtPayments.amount,
        paymentMethodName: paymentMethods.name,
        branchName: branches.name,
        receivedByName: users.name,
        trxNumber: transactions.trxNumber,
        note: debtPayments.note,
        voidedAt: debtPayments.voidedAt,
      })
      .from(debtPayments)
      .innerJoin(customerDebts, eq(debtPayments.debtId, customerDebts.id))
      .innerJoin(paymentMethods, eq(debtPayments.paymentMethodId, paymentMethods.id))
      .leftJoin(branches, eq(debtPayments.branchId, branches.id))
      .leftJoin(users, eq(debtPayments.createdBy, users.id))
      .leftJoin(transactions, eq(customerDebts.transactionId, transactions.id))
      .where(eq(customerDebts.customerId, customerId))
      .orderBy(desc(debtPayments.createdAt), desc(debtPayments.id))
      .limit(15),
  ])

  const debts: PosDebtRow[] = debtRows.map((d) => ({
    id: d.id,
    createdAt: d.createdAt.toISOString(),
    dueAt: d.dueAt ? d.dueAt.toISOString() : null,
    trxNumber: d.trxNumber ?? null,
    branchName: d.branchName ?? null,
    totalAmount: d.totalAmount,
    paidAmount: d.paidAmount,
    remainingAmount: d.remainingAmount,
    status: d.status,
    note: d.note ?? null,
  }))

  return {
    customer: { id: customer.id, name: customer.name, phone: customer.phone ?? null },
    outstanding: debts.reduce((n, d) => n + d.remainingAmount, 0),
    debts,
    recentPayments: paymentRows.map((p) => ({
      id: p.id,
      createdAt: p.createdAt.toISOString(),
      amount: p.amount,
      paymentMethodName: p.paymentMethodName,
      branchName: p.branchName ?? null,
      receivedByName: p.receivedByName ?? null,
      trxNumber: p.trxNumber ?? null,
      note: p.note ?? null,
      voided: p.voidedAt !== null,
    })),
  }
}

export interface PayAtPosInput {
  customerId: number
  amount: number
  paymentMethodId: number
  note: string | null
  branchId: number
  shiftId: number
  userId: number
}

export interface PayAtPosResult {
  totalPaid: number
  settledCount: number
  touchedCount: number
  remainingOutstanding: number
  paymentIds: number[]
}

/**
 * Pelunasan dari kasir dialokasikan FIFO seperti pay-bulk backoffice, dengan satu beda:
 * semua baris pembayaran dicatat ke cabang & shift kasir yang menerima uangnya — bukan cabang
 * asal hutang — karena uang fisiknya masuk laci di sini dan harus ikut settlement shift ini.
 */
export async function payCustomerDebtsAtPos(input: PayAtPosInput): Promise<PayAtPosResult> {
  return db.transaction(async (trx) => {
    const locked = await trx
      .select({
        id: customerDebts.id,
        createdAt: customerDebts.createdAt,
        totalAmount: customerDebts.totalAmount,
        paidAmount: customerDebts.paidAmount,
        remainingAmount: customerDebts.remainingAmount,
        status: customerDebts.status,
      })
      .from(customerDebts)
      .where(piutangAktif(input.customerId))
      .orderBy(asc(customerDebts.createdAt), asc(customerDebts.id))
      .for('update')

    const outstanding = locked.reduce((n, d) => n + d.remainingAmount, 0)
    if (locked.length === 0) throw new Error('NO_ACTIVE_DEBT')
    if (input.amount > outstanding) throw new Error('AMOUNT_EXCEEDS_REMAINING')

    const { alokasi } = alokasiPembayaranHutang(locked, input.amount)
    if (alokasi.length === 0) throw new Error('NO_ACTIVE_DEBT')

    const inserted = await trx
      .insert(debtPayments)
      .values(
        alokasi.map((a) => ({
          debtId: a.debtId,
          branchId: input.branchId,
          shiftId: input.shiftId,
          amount: a.bayar,
          paymentMethodId: input.paymentMethodId,
          note: input.note,
          createdBy: input.userId,
        })),
      )
      .returning({ id: debtPayments.id })

    for (const a of alokasi) {
      await trx
        .update(customerDebts)
        .set({ paidAmount: a.paidAmountBaru, remainingAmount: a.remainingAmountBaru, status: a.statusBaru })
        .where(eq(customerDebts.id, a.debtId))
    }

    const totalPaid = alokasi.reduce((n, a) => n + a.bayar, 0)
    return {
      totalPaid,
      settledCount: alokasi.filter((a) => a.statusBaru === 'PAID').length,
      touchedCount: alokasi.length,
      remainingOutstanding: outstanding - totalPaid,
      paymentIds: inserted.map((p) => p.id),
    }
  })
}

export async function getPaymentMethodForDebt(paymentMethodId: number) {
  const [method] = await db
    .select({ id: paymentMethods.id, type: paymentMethods.type })
    .from(paymentMethods)
    .where(eq(paymentMethods.id, paymentMethodId))
    .limit(1)
  return method ?? null
}
