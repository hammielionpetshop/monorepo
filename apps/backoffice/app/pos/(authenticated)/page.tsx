import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { getPosBranchId, getPosBranchName } from '@/lib/pos-branch'
import {
  db,
  paymentMethods,
  unitsOfMeasure,
  shifts,
  shiftCashierSessions,
  shiftExpenses,
  eq,
  and,
  sql,
} from '@/lib/db'
import PosClient from '@/components/pos/pos-client'

export default async function PosHomePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null

  if (!payload) {
    redirect('/pos/login')
  }

  const branchId = getPosBranchId(payload, cookieStore)
  const branchName = getPosBranchName(payload, cookieStore)

  const [uoms, payments, activeShift, expResult] = await Promise.all([
    db.select().from(unitsOfMeasure),

    db.select().from(paymentMethods),

    db.query.shifts.findFirst({
      where: and(eq(shifts.branchId, branchId), eq(shifts.status, 'OPEN')),
    }),

    db
      .select({ total: sql<number>`COALESCE(SUM(${shiftExpenses.amount}), 0)` })
      .from(shiftExpenses)
      .innerJoin(shifts, eq(shiftExpenses.shiftId, shifts.id))
      .where(and(eq(shifts.branchId, branchId), eq(shifts.status, 'OPEN'))),
  ])

  const expenseTotal = expResult[0]?.total ?? 0

  let shiftWithSessions = null
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
    const joinedCashierIds = sessions.map((s) => s.cashierId)
    shiftWithSessions = {
      ...activeShift,
      assignedCashiers: (activeShift.assignedCashiers as number[]) ?? [],
      joinedCashierIds,
    }
    isCashierInShift = joinedCashierIds.includes(payload.userId)
  }

  return (
    <PosClient
      uoms={uoms}
      paymentMethods={payments}
      shift={shiftWithSessions}
      isCashierInShift={isCashierInShift}
      cashierId={payload.userId}
      cashierName={payload.userName}
      branchId={branchId}
      branchName={branchName}
      userRole={payload.role}
      totalExpenses={expenseTotal}
    />
  )
}

