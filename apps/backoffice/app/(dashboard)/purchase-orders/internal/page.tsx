import { db, interBranchTransfers, branches, users, desc, eq } from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { InternalTransferListClient } from './_components/internal-transfer-list-client'
import type { InternalTransfer, Branch } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function InternalTransferPage() {
  let transfers: InternalTransfer[] = []
  let branchesList: Branch[] = []
  let error: string | null = null

  try {
    const sourceBranchAlias = alias(branches, 'source_branch')
    const destBranchAlias = alias(branches, 'dest_branch')

    ;[transfers, branchesList] = await Promise.all([
      db
        .select({
          id: interBranchTransfers.id,
          ibtNumber: interBranchTransfers.ibtNumber,
          sourceBranchId: interBranchTransfers.sourceBranchId,
          destinationBranchId: interBranchTransfers.destinationBranchId,
          requestedById: interBranchTransfers.requestedById,
          approvedById: interBranchTransfers.approvedById,
          status: interBranchTransfers.status,
          totalTransferValue: interBranchTransfers.totalTransferValue,
          notes: interBranchTransfers.notes,
          createdAt: interBranchTransfers.createdAt,
          updatedAt: interBranchTransfers.updatedAt,
          sourceBranchName: sourceBranchAlias.name,
          destinationBranchName: destBranchAlias.name,
          requestedByName: users.name,
        })
        .from(interBranchTransfers)
        .leftJoin(sourceBranchAlias, eq(interBranchTransfers.sourceBranchId, sourceBranchAlias.id))
        .leftJoin(destBranchAlias, eq(interBranchTransfers.destinationBranchId, destBranchAlias.id))
        .leftJoin(users, eq(interBranchTransfers.requestedById, users.id))
        .orderBy(desc(interBranchTransfers.createdAt))
        .limit(100) as unknown as Promise<InternalTransfer[]>,

      db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(eq(branches.isActive, true))
        .orderBy(branches.name),
    ])
  } catch (e) {
    console.error('InternalTransferPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data transfer internal'
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
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Transfer Internal</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Kelola permintaan transfer stok antar cabang
        </p>
      </div>
      <InternalTransferListClient
        transfers={transfers}
        branches={branchesList}
      />
    </div>
  )
}
