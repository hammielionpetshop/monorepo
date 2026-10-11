import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { getPosBranchId } from '@/lib/pos-branch'
import { getInternalReturn, internalReturnInvolvesBranch } from '@/lib/services/internal-return-queries'
import { InternalReturnPrint } from '@/components/internal-returns/internal-return-print'

export const dynamic = 'force-dynamic'

export default async function CetakReturInternalPage({ params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  let payload: Awaited<ReturnType<typeof verifyAccessTokenCached>> | null = null
  try {
    payload = token ? await verifyAccessTokenCached(token) : null
  } catch {
    redirect('/pos/login')
  }
  if (!payload) redirect('/pos/login')

  const { id } = await params
  if (!/^\d+$/.test(id)) notFound()
  const row = await getInternalReturn(Number(id))
  if (!row || !internalReturnInvolvesBranch(row, getPosBranchId(payload, cookieStore))) notFound()

  return <InternalReturnPrint row={row} />
}
