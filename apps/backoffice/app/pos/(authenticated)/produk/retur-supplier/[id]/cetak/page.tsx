import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { getPosBranchId } from '@/lib/pos-branch'
import { getSupplierReturn } from '@/lib/services/supplier-return-queries'
import { SupplierReturnPrint } from '@/components/supplier-returns/supplier-return-print'

export const dynamic = 'force-dynamic'

export default async function CetakReturSupplierPage({ params }: { params: Promise<{ id: string }> }) {
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
  const row = await getSupplierReturn(Number(id))
  if (!row || row.branchId !== getPosBranchId(payload, cookieStore)) notFound()

  return <SupplierReturnPrint row={row} />
}
