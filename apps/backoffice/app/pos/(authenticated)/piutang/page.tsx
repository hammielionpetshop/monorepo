import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { hasPermission } from '@/lib/authz'
import { getPosBranchId } from '@/lib/pos-branch'
import { getCachedPaymentMethods } from '@/lib/pos-master-data'
import { db } from '@/lib/db'
import { findOpenShiftId } from '@/lib/services/shift-resolver'
import PiutangClient from './_components/piutang-client'

export const dynamic = 'force-dynamic'

export default async function PiutangPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null
  if (!payload) redirect('/pos/login')

  if (!hasPermission(payload, 'debt.pay')) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Anda tidak punya akses untuk menerima pelunasan piutang.
      </div>
    )
  }

  const branchId = getPosBranchId(payload, cookieStore)
  const [methods, openShiftId] = await Promise.all([
    getCachedPaymentMethods(),
    findOpenShiftId(db, branchId).catch(() => null),
  ])

  const { customerId } = await searchParams
  const initialCustomerId = customerId && /^\d+$/.test(customerId) ? Number(customerId) : null

  return (
    <PiutangClient
      paymentMethods={methods
        .filter((m) => m.type !== 'DEBT')
        .map((m) => ({ id: m.id, name: m.name, type: m.type }))}
      hasOpenShift={openShiftId !== null}
      initialCustomerId={initialCustomerId}
    />
  )
}
