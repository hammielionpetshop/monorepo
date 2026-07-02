import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
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

const APPROVER_ROLES = ['OWNER', 'GM']
const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED']

export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
  }

  if (!APPROVER_ROLES.includes(payload.role)) {
    return NextResponse.json({ error: 'Anda tidak memiliki akses ke pengajuan void' }, { status: 403 })
  }

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
