import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { db, branches, eq } from '@/lib/db'
import BranchPickerClient from './_components/branch-picker-client'

export default async function SelectBranchPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null

  if (!payload) {
    redirect('/pos/login')
  }

  if (!['OWNER', 'GM', 'MANAGER'].includes(payload.role)) {
    redirect('/pos')
  }

  const activeBranches = await db
    .select({ id: branches.id, name: branches.name, code: branches.code })
    .from(branches)
    .where(eq(branches.isActive, true))
    .orderBy(branches.name)

  const currentBranchIdRaw = cookieStore.get('posBranchId')?.value
  const currentBranchId = currentBranchIdRaw ? parseInt(currentBranchIdRaw) : null

  return (
    <BranchPickerClient
      branches={activeBranches}
      userName={payload.userName}
      currentBranchId={currentBranchId}
    />
  )
}
