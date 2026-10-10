import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { getPosBranchId } from '@/lib/pos-branch'
import ReturSupplierClient from './_components/retur-supplier-client'

export const dynamic = 'force-dynamic'

export default async function ReturSupplierPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value

  let payload: Awaited<ReturnType<typeof verifyAccessTokenCached>> | null = null
  try {
    payload = token ? await verifyAccessTokenCached(token) : null
  } catch {
    redirect('/pos/login')
  }

  if (!payload) {
    redirect('/pos/login')
  }

  return <ReturSupplierClient branchId={getPosBranchId(payload, cookieStore)} />
}
