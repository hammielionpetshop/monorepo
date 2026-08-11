import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { db, branches, eq, and, inArray } from '@/lib/db'
import { allowedBranchIds, canSwitchBranch } from '@/lib/active-branch'
import BranchPickerClient from './_components/branch-picker-client'

export default async function SelectBranchPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null

  if (!payload) {
    redirect('/pos/login')
  }

  // Yang menentukan bukan role lagi, melainkan berapa cabang yang ditugaskan kepadanya.
  // Staf bercabang tunggal tidak punya yang bisa dipilih — layar ini kosong baginya.
  if (!canSwitchBranch(payload)) {
    redirect('/pos')
  }

  const allowed = allowedBranchIds(payload)

  const activeBranches = await db
    .select({ id: branches.id, name: branches.name, code: branches.code })
    .from(branches)
    .where(
      allowed === 'ALL'
        ? eq(branches.isActive, true)
        : and(eq(branches.isActive, true), inArray(branches.id, allowed)),
    )
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
