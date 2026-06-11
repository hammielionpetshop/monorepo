import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { getPosBranchId } from '@/lib/pos-branch'
import { db, branches, eq, and } from '@/lib/db'
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

  const allBranches = await db
    .select({ id: branches.id, name: branches.name, code: branches.code })
    .from(branches)
    .where(and(eq(branches.isActive, true)))
    .orderBy(branches.name)

  const otherBranches = allBranches.filter((b) => b.id !== currentBranchId)

  return (
    <div className="p-4">
      <InternalOrderClient
        currentBranchId={currentBranchId}
        otherBranches={otherBranches}
        userRole={payload.role}
        allBranches={allBranches}
      />
    </div>
  )
}
