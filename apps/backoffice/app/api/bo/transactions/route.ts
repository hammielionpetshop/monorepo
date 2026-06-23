import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { db, transactions, branches, users, customers, transactionPayments, paymentMethods, eq, and, ilike, gte, lte, desc, sql, count } from '@/lib/db'
import type { SQL } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))
    const q = searchParams.get('q')?.trim() ?? ''
    const status = searchParams.get('status') ?? ''
    const dateFrom = searchParams.get('dateFrom') ?? ''
    const dateTo = searchParams.get('dateTo') ?? ''
    const cashierIdParam = searchParams.get('cashierId') ?? ''
    const customerIdParam = searchParams.get('customerId') ?? ''
    const paymentMethodIdParam = searchParams.get('paymentMethodId') ?? ''

    const isPrivileged = ['OWNER', 'GM'].includes(payload.role)
    const branchIdParam = searchParams.get('branchId') ?? ''
    const effectiveBranchId = isPrivileged
      ? (branchIdParam ? parseInt(branchIdParam, 10) || null : null)
      : payload.branchId

    if (dateFrom && !ISO_DATE_RE.test(dateFrom)) {
      return NextResponse.json({ error: 'Format dateFrom tidak valid (gunakan YYYY-MM-DD)' }, { status: 400 })
    }
    if (dateTo && !ISO_DATE_RE.test(dateTo)) {
      return NextResponse.json({ error: 'Format dateTo tidak valid (gunakan YYYY-MM-DD)' }, { status: 400 })
    }
    if (status && !['COMPLETED', 'VOIDED', 'PENDING_VOID'].includes(status)) {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

    const conditions: SQL<unknown>[] = []
    if (q) conditions.push(ilike(transactions.trxNumber, `%${q}%`))
    if (status) conditions.push(eq(transactions.status, status))
    if (effectiveBranchId) conditions.push(eq(transactions.branchId, effectiveBranchId))
    if (cashierIdParam) {
      const cid = parseInt(cashierIdParam, 10)
      if (!isNaN(cid)) conditions.push(eq(transactions.cashierId, cid))
    }
    if (dateFrom) conditions.push(gte(transactions.createdAt, new Date(dateFrom + 'T00:00:00.000+07:00')))
    if (dateTo) {
      const end = new Date(dateTo + 'T23:59:59.999+07:00')
      conditions.push(lte(transactions.createdAt, end))
    }
    if (customerIdParam) {
      const custId = parseInt(customerIdParam, 10)
      if (!isNaN(custId)) conditions.push(eq(transactions.customerId, custId))
    }
    if (paymentMethodIdParam) {
      const pmId = parseInt(paymentMethodIdParam, 10)
      if (!isNaN(pmId)) {
        conditions.push(
          sql`EXISTS (SELECT 1 FROM ${transactionPayments} WHERE ${transactionPayments.transactionId} = ${transactions.id} AND ${transactionPayments.paymentMethodId} = ${pmId})`,
        )
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [totalResult, rows] = await Promise.all([
      db
        .select({ total: count() })
        .from(transactions)
        .where(whereClause),
      db
        .select({
          id: transactions.id,
          trxNumber: transactions.trxNumber,
          branchName: branches.name,
          cashierName: users.name,
          customerName: customers.name,
          payableAmount: transactions.payableAmount,
          status: transactions.status,
          createdAt: transactions.createdAt,
        })
        .from(transactions)
        .leftJoin(branches, eq(transactions.branchId, branches.id))
        .leftJoin(users, eq(transactions.cashierId, users.id))
        .leftJoin(customers, eq(transactions.customerId, customers.id))
        .where(whereClause)
        .orderBy(desc(transactions.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
    ])

    const total = totalResult[0]?.total ?? 0
    const totalPages = Math.max(1, Math.ceil(Number(total) / limit))

    if (rows.length === 0) {
      return NextResponse.json({ data: [], total: Number(total), page, totalPages })
    }

    const transactionIds = rows.map(r => r.id)

    const paymentRows = await db
      .select({
        transactionId: transactionPayments.transactionId,
        methodName: paymentMethods.name,
      })
      .from(transactionPayments)
      .leftJoin(paymentMethods, eq(transactionPayments.paymentMethodId, paymentMethods.id))
      .where(sql`${transactionPayments.transactionId} = ANY(ARRAY[${sql.join(transactionIds.map(id => sql`${id}`), sql`, `)}]::int[])`)

    const paymentMap = new Map<number, string[]>()
    for (const p of paymentRows) {
      if (p.methodName) {
        const arr = paymentMap.get(p.transactionId) ?? []
        arr.push(p.methodName)
        paymentMap.set(p.transactionId, arr)
      }
    }

    const data = rows.map(r => ({
      id: r.id,
      trxNumber: r.trxNumber,
      branchName: r.branchName ?? '-',
      cashierName: r.cashierName ?? '-',
      customerName: r.customerName ?? null,
      paymentMethods: (paymentMap.get(r.id) ?? []).join(', ') || '-',
      payableAmount: r.payableAmount,
      status: r.status,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }))

    return NextResponse.json({ data, total: Number(total), page, totalPages })
  } catch (error: unknown) {
    console.error('[transactions] GET error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengambil data transaksi' }, { status: 500 })
  }
}
