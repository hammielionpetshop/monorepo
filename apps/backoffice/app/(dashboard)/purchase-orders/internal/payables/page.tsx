import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db, interBranchPayables, interBranchTransfers, branches, eq, desc } from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { PayablesClient } from './_components/payables-client'

export default async function InterBranchPayablesPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) redirect('/login')

  const debtorBranch = alias(branches, 'debtor_branch')
  const creditorBranch = alias(branches, 'creditor_branch')

  const payables = await db
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
    })
    .from(interBranchPayables)
    .leftJoin(interBranchTransfers, eq(interBranchPayables.transferId, interBranchTransfers.id))
    .leftJoin(debtorBranch, eq(interBranchPayables.debtorBranchId, debtorBranch.id))
    .leftJoin(creditorBranch, eq(interBranchPayables.creditorBranchId, creditorBranch.id))
    .orderBy(desc(interBranchPayables.createdAt))

  const serialized = payables.map(p => ({
    ...p,
    dueAt: p.dueAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Hutang Piutang Transfer Internal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pencatatan hutang antar cabang dari transfer stok internal
        </p>
      </div>
      <PayablesClient payables={serialized} role={payload.role} />
    </div>
  )
}
