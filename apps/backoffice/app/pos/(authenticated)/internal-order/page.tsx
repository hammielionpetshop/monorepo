import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { getPosBranchId } from '@/lib/pos-branch'
import {
  db,
  branches,
  interBranchTransfers,
  users,
  eq,
  and,
  desc,
} from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import InternalOrderClient from './_components/internal-order-client'

export const dynamic = 'force-dynamic'

export default async function InternalOrderPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null

  if (!payload) {
    redirect('/pos/login')
  }

  const currentBranchId = getPosBranchId(payload, cookieStore)

  const sourceBranchAlias = alias(branches, 'source_branch')
  const destBranchAlias = alias(branches, 'dest_branch')

  const [allBranches, transferRows] = await Promise.all([
    db
      .select({ id: branches.id, name: branches.name, code: branches.code })
      .from(branches)
      .where(and(eq(branches.isActive, true)))
      .orderBy(branches.name),
    db
      .select({
        id: interBranchTransfers.id,
        ibtNumber: interBranchTransfers.ibtNumber,
        sourceBranchId: interBranchTransfers.sourceBranchId,
        sourceBranchName: sourceBranchAlias.name,
        destinationBranchId: interBranchTransfers.destinationBranchId,
        destinationBranchName: destBranchAlias.name,
        status: interBranchTransfers.status,
        totalTransferValue: interBranchTransfers.totalTransferValue,
        notes: interBranchTransfers.notes,
        createdAt: interBranchTransfers.createdAt,
        requestedByName: users.name,
      })
      .from(interBranchTransfers)
      .leftJoin(sourceBranchAlias, eq(interBranchTransfers.sourceBranchId, sourceBranchAlias.id))
      .leftJoin(destBranchAlias, eq(interBranchTransfers.destinationBranchId, destBranchAlias.id))
      .leftJoin(users, eq(interBranchTransfers.requestedById, users.id))
      .where(eq(interBranchTransfers.destinationBranchId, currentBranchId))
      .orderBy(desc(interBranchTransfers.createdAt))
      .limit(50),
  ])

  const otherBranches = allBranches.filter((b) => b.id !== currentBranchId)

  const initialTransfers = transferRows.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }))

  return (
    <div className="p-4">
      <InternalOrderClient
        currentBranchId={currentBranchId}
        otherBranches={otherBranches}
        userRole={payload.role}
        allBranches={allBranches}
        initialTransfers={initialTransfers}
      />
    </div>
  )
}
