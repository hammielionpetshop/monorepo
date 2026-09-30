import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { getPosBranchId } from '@/lib/pos-branch'
import { db, transactions, customerDebts, eq, and, ne, gte, notInArray, sql } from '@/lib/db'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }

  const { id } = await params
  const customerId = Number(id)
  if (!Number.isInteger(customerId) || customerId <= 0) {
    return NextResponse.json({ error: 'ID pelanggan tidak valid' }, { status: 400 })
  }

  // Keranjang POS hanya menampilkan piutang cabang kasir (lihat /pos/piutang); pemanggil lain
  // (Bulk Sale backoffice) tetap melihat total lintas cabang.
  const posBranchId =
    new URL(req.url).searchParams.get('scope') === 'pos' ? getPosBranchId(payload, cookieStore) : null

  const since = new Date()
  since.setDate(since.getDate() - 30)

  const [[row], [debtRow]] = await Promise.all([
    db
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.payableAmount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.customerId, customerId),
          ne(transactions.status, 'VOIDED'),
          gte(transactions.createdAt, since)
        )
      ),
    db
      .select({
        outstanding: sql<number>`COALESCE(SUM(${customerDebts.remainingAmount}), 0)`,
      })
      .from(customerDebts)
      .where(
        and(
          eq(customerDebts.customerId, customerId),
          notInArray(customerDebts.status, ['PAID', 'VOIDED']),
          posBranchId !== null ? eq(customerDebts.branchId, posBranchId) : undefined
        )
      ),
  ])

  return NextResponse.json({
    customerId,
    days: 30,
    total: row?.total ?? 0,
    transactionCount: Number(row?.count ?? 0),
    outstandingDebt: debtRow?.outstanding ?? 0,
  })
}
