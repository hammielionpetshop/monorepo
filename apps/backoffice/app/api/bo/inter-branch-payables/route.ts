import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { alias } from 'drizzle-orm/pg-core'
import {
  db,
  interBranchPayables,
  branches,
  interBranchTransfers,
  eq,
  or,
  desc,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

const GLOBAL_ROLES = ['OWNER', 'GM']

export async function GET(_req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('accessToken')?.value
    const payload = token ? await verifyAccessToken(token) : null
    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 })
    }

    const debtorBranch = alias(branches, 'debtor_branch')
    const creditorBranch = alias(branches, 'creditor_branch')

    const rows = await db
      .select({
        id: interBranchPayables.id,
        transferId: interBranchPayables.transferId,
        ibtNumber: interBranchTransfers.ibtNumber,
        debtorBranchId: interBranchPayables.debtorBranchId,
        debtorBranchName: debtorBranch.name,
        creditorBranchId: interBranchPayables.creditorBranchId,
        creditorBranchName: creditorBranch.name,
        totalAmount: interBranchPayables.totalAmount,
        paidAmount: interBranchPayables.paidAmount,
        status: interBranchPayables.status,
        notes: interBranchPayables.notes,
        dueAt: interBranchPayables.dueAt,
        createdAt: interBranchPayables.createdAt,
        updatedAt: interBranchPayables.updatedAt,
      })
      .from(interBranchPayables)
      .leftJoin(interBranchTransfers, eq(interBranchPayables.transferId, interBranchTransfers.id))
      .leftJoin(debtorBranch, eq(interBranchPayables.debtorBranchId, debtorBranch.id))
      .leftJoin(creditorBranch, eq(interBranchPayables.creditorBranchId, creditorBranch.id))
      .where(
        GLOBAL_ROLES.includes(payload.role)
          ? undefined
          : or(
              eq(interBranchPayables.debtorBranchId, payload.branchId),
              eq(interBranchPayables.creditorBranchId, payload.branchId)
            )
      )
      .orderBy(desc(interBranchPayables.createdAt))

    return NextResponse.json(rows)
  } catch (error) {
    console.error('GET inter-branch-payables error:', error)
    return NextResponse.json({ error: 'Gagal mengambil data hutang piutang' }, { status: 500 })
  }
}
