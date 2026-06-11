import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { getPosBranchId } from '@/lib/pos-branch'
import { db, shifts, shiftCashierSessions, eq, and } from '@/lib/db'
import ShiftDashboardClient from '@/components/pos/shift-dashboard-client'

export default async function ShiftPage() {
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

  let isCashierInShift = false
  if (activeShift) {
    const sessions = await db
      .select({ cashierId: shiftCashierSessions.cashierId })
      .from(shiftCashierSessions)
      .where(
        and(
          eq(shiftCashierSessions.shiftId, activeShift.id),
          eq(shiftCashierSessions.status, 'ACTIVE')
        )
      )
    isCashierInShift = sessions.some((s) => s.cashierId === payload.userId)
  }

  const shiftForClient =
    activeShift && isCashierInShift
      ? {
          id: activeShift.id,
          shiftNumber: activeShift.shiftNumber,
          openedAt: activeShift.openedAt,
          openingCash: activeShift.openingCash as unknown as number,
          targetEndTime: activeShift.targetEndTime,
        }
      : null

  return (
    <ShiftDashboardClient
      shift={shiftForClient}
      cashierId={payload.userId}
    />
  )
}
