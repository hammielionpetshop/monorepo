import { redirect } from 'next/navigation'
import { getAuth, hasPermission } from '@/lib/authz'
import { db, branches, eq } from '@/lib/db'
import ReturTabs from '../_components/retur-tabs'
import ReturHistoryClient from '../_components/retur-history-client'
import type { BranchOption } from '../_components/types'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ReturHistoryPage({ searchParams }: Props) {
  const payload = await getAuth()
  if (!payload) redirect('/login')

  const sp = await searchParams
  const isPrivileged = payload.branchScope === 'ALL'

  const branchOptions: BranchOption[] = isPrivileged
    ? await db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(eq(branches.isActive, true))
        .orderBy(branches.name)
    : []

  const initialFilters = {
    page: Math.max(1, parseInt(String(sp.page ?? '1'), 10) || 1),
    q: String(sp.q ?? ''),
    status: String(sp.status ?? ''),
    branchId: isPrivileged ? String(sp.branchId ?? '') : '',
    dateFrom: String(sp.dateFrom ?? ''),
    dateTo: String(sp.dateTo ?? ''),
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-foreground">Manajemen Retur</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Riwayat pengembalian barang beserta nilai refund dan jejak pembatalannya.
        </p>
      </div>

      <div className="mb-6">
        <ReturTabs />
      </div>

      <ReturHistoryClient
        branches={branchOptions}
        isPrivileged={isPrivileged}
        canCancel={hasPermission(payload, 'return.cancel')}
        activeBranchId={payload.branchId}
        activeBranchName={payload.branchName}
        initialFilters={initialFilters}
      />
    </div>
  )
}
