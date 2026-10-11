import { notFound, redirect } from 'next/navigation'
import { getAuth, hasPermission } from '@/lib/authz'
import { getInternalReturn, internalReturnInvolvesBranch } from '@/lib/services/internal-return-queries'
import { InternalReturnPrint } from '@/components/internal-returns/internal-return-print'

export const dynamic = 'force-dynamic'

export default async function CetakReturInternalPage({ params }: { params: Promise<{ id: string }> }) {
  const payload = await getAuth()
  if (!payload) redirect('/login')

  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const row = await getInternalReturn(Number(id))
  if (!row) notFound()
  const allBranches = payload.branchScope === 'ALL' || hasPermission(payload, 'void.approve')
  if (!allBranches && !internalReturnInvolvesBranch(row, payload.branchId)) notFound()

  return <InternalReturnPrint row={row} />
}
