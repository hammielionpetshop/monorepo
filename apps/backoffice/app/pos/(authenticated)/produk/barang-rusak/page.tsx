import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { getPosBranchId } from '@/lib/pos-branch'
import BarangRusakClient from './_components/barang-rusak-client'

export const dynamic = 'force-dynamic'

export default async function BarangRusakPage() {
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

  const branchId = getPosBranchId(payload, cookieStore)

  return <BarangRusakClient branchId={branchId} />
}
