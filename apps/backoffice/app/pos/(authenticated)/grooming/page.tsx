import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { hasPermission } from '@/lib/authz'
import { getPosBranchId, getPosBranchName } from '@/lib/pos-branch'
import { getReceiptStoreInfo } from '@/lib/receipt-info'
import { getCachedPaymentMethods } from '@/lib/pos-master-data'
import { db, shiftCashierSessions, eq, and } from '@/lib/db'
import { findOpenShiftId } from '@/lib/services/shift-resolver'
import GroomingClient from './_components/grooming-client'

export const dynamic = 'force-dynamic'

export default async function GroomingPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null
  if (!payload) redirect('/pos/login')

  if (!hasPermission(payload, 'grooming.order.manage')) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Anda belum punya akses ke tab Grooming. Bila izinnya baru diberikan, keluar lalu masuk lagi.
      </div>
    )
  }

  const branchId = getPosBranchId(payload, cookieStore)
  const [methods, storeInfo, shiftId] = await Promise.all([
    getCachedPaymentMethods(),
    getReceiptStoreInfo(branchId),
    findOpenShiftId(db, branchId).catch(() => null),
  ])

  let isCashierInShift = false
  if (shiftId !== null) {
    const [session] = await db
      .select({ cashierId: shiftCashierSessions.cashierId })
      .from(shiftCashierSessions)
      .where(and(
        eq(shiftCashierSessions.shiftId, shiftId),
        eq(shiftCashierSessions.cashierId, payload.userId),
        eq(shiftCashierSessions.status, 'ACTIVE'),
      ))
      .limit(1)
    isCashierInShift = Boolean(session)
  }

  return (
    <GroomingClient
      paymentMethods={methods.map((m) => ({ id: m.id, name: m.name, type: m.type }))}
      shiftId={shiftId}
      isCashierInShift={isCashierInShift}
      cashierId={payload.userId}
      cashierName={payload.userName}
      branchId={branchId}
      branchName={getPosBranchName(payload, cookieStore)}
      storeInfo={storeInfo}
      canReceiveDebtPayment={hasPermission(payload, 'debt.pay')}
    />
  )
}
