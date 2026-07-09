import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/authz'
import {
  db,
  voidRequests,
  transactions,
  branches,
  users,
  shifts,
  eq,
  desc,
  sql,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED']

export async function GET(req: Request) {
  const gate = await requirePermission('void.approve')
  if (gate instanceof NextResponse) return gate

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'PENDING'
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
  }

  try {
    const rows = await db
      .select({
        id: voidRequests.id,
        status: voidRequests.status,
        reason: voidRequests.reason,
        createdAt: voidRequests.createdAt,
        updatedAt: voidRequests.updatedAt,
        transactionId: transactions.id,
        trxNumber: transactions.trxNumber,
        transactionStatus: transactions.status,
        payableAmount: transactions.payableAmount,
        transactionDate: transactions.createdAt,
        branchId: transactions.branchId,
        branchName: branches.name,
        requestByName: users.name,
        // Shift sudah settle (atau transaksi tanpa shift) → refund harus dicatat manual di Keuangan
        shiftSettled: sql<boolean>`(${shifts.id} IS NULL OR ${shifts.status} <> 'OPEN')`,
      })
      .from(voidRequests)
      .innerJoin(transactions, eq(voidRequests.transactionId, transactions.id))
      .innerJoin(branches, eq(transactions.branchId, branches.id))
      .leftJoin(users, eq(voidRequests.requestById, users.id))
      .leftJoin(shifts, eq(transactions.shiftId, shifts.id))
      .where(eq(voidRequests.status, status))
      .orderBy(desc(voidRequests.createdAt))

    return NextResponse.json(
      rows.map((row) => ({
        ...row,
        requestByName: row.requestByName ?? 'Tidak diketahui',
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
        transactionDate:
          row.transactionDate instanceof Date
            ? row.transactionDate.toISOString()
            : String(row.transactionDate),
      })),
    )
  } catch (error) {
    console.error('[void-requests] GET error:', error)
    return NextResponse.json({ error: 'Gagal mengambil daftar pengajuan void' }, { status: 500 })
  }
}
