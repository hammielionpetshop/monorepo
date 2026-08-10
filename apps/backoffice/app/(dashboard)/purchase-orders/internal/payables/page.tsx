import { redirect } from 'next/navigation'
import { getAuth, scopeFilterAny } from '@/lib/authz'
import { db, interBranchPayables, interBranchTransfers, branches, eq, desc } from '@/lib/db'
import { alias } from 'drizzle-orm/pg-core'
import { PayablesClient } from './_components/payables-client'

export const dynamic = 'force-dynamic'

export default async function InterBranchPayablesPage() {
  const payload = await getAuth()
  if (!payload) redirect('/login')

  const debtorBranch = alias(branches, 'debtor_branch')
  const creditorBranch = alias(branches, 'creditor_branch')

  // Pembatasan cabang di level query, bukan di UI: user non-global hanya melihat hutang
  // yang cabangnya jadi debitur ATAU kreditur. Dropdown cabang di client menyaring
  // di atas hasil ini, jadi ia mempersempit — tidak pernah melebarkan.
  const branchScope = scopeFilterAny(
    payload,
    interBranchPayables.debtorBranchId,
    interBranchPayables.creditorBranchId
  )

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
    .where(branchScope)
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
          {payload.branchScope === 'ALL'
            ? 'Pencatatan hutang antar cabang dari transfer stok internal, seluruh cabang'
            : `Pencatatan hutang antar cabang dari transfer stok internal yang melibatkan ${payload.branchName}`}
        </p>
      </div>
      <PayablesClient payables={serialized} role={payload.role} />
    </div>
  )
}
