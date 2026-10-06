import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { getPosBranchId } from '@/lib/pos-branch'
import { getReceiptStoreInfo } from '@/lib/receipt-info'
import { db, shifts, eq, and } from '@/lib/db'
import SettlementClient from '@/components/pos/settlement-client'
import { revokeSession } from '@/lib/services/user-session'

export default async function SettlementPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null

  if (!payload) {
    redirect('/pos/login')
  }

  const branchId = getPosBranchId(payload, cookieStore)

  const activeShift = await db.query.shifts.findFirst({
    where: and(eq(shifts.branchId, branchId), eq(shifts.status, 'OPEN')),
  })

  if (!activeShift) {
    redirect('/pos')
  }

  const storeInfo = await getReceiptStoreInfo(branchId)
  const sessionId = payload.sessionId

  // Serah terima = keluar seperti tombol Keluar di header, tapi cabang kasir tetap diingat
  // supaya kasir berikutnya langsung login ke cabang yang sama.
  async function handoverAction() {
    'use server'
    if (sessionId !== undefined) await revokeSession(sessionId, 'LOGOUT')
    const cs = await cookies()
    cs.delete('accessToken')
    redirect('/pos/login')
  }

  return (
    <SettlementClient
      shiftId={activeShift.id}
      shiftNumber={activeShift.shiftNumber}
      cashierId={payload.userId}
      branchName={payload.branchName}
      storeInfo={storeInfo}
      cashierName={payload.userName}
      openingCash={Number(activeShift.openingCash)}
      handoverAction={handoverAction}
    />
  )
}
