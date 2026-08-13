import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessTokenCached } from '@/lib/auth-cache'
import { getPosBranchId, getPosBranchName } from '@/lib/pos-branch'
import { getReceiptStoreInfo } from '@/lib/receipt-info'
import {
  db,
  shifts,
  shiftCashierSessions,
  shiftExpenses,
  eq,
  and,
  sql,
} from '@/lib/db'
import { getCachedPaymentMethods, getCachedUnitsOfMeasure } from '@/lib/pos-master-data'
import PosClient from '@/components/pos/pos-client'

/**
 * Tanpa ini berlaku plafon Vercel 300 detik, dan request yang menggantung menahan slot
 * fungsi selama lima menit penuh — muncul sebagai `504 Task timed out after 300 seconds`.
 * Hang-nya bukan karena query lambat: yang menggantung adalah antrean pool postgres.js,
 * yang tidak punya batas waktu sama sekali (lihat `max_lifetime` di `packages/db/src/index.ts`).
 * Batas ini tidak menyembuhkan penyebabnya, hanya menghentikan satu request macet dari
 * menyandera kapasitas selama lima menit.
 */
export const maxDuration = 20

export default async function PosHomePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessTokenCached(token) : null

  if (!payload) {
    redirect('/pos/login')
  }

  const branchId = getPosBranchId(payload, cookieStore)
  const branchName = getPosBranchName(payload, cookieStore)
  const storeInfo = await getReceiptStoreInfo(branchId)

  // Shift aktif + total pengeluarannya digabung jadi SATU query lewat subquery skalar —
  // trik yang sama seperti di `nav-badges/route.ts`. Dua query terpisah yang dijalankan
  // serentak merebut dua slot pool sekaligus, dan pool-nya cuma berukuran 3.
  const [shiftRow] = await db
    .select({
      shift: shifts,
      expenseTotal: sql<number>`COALESCE((
        SELECT SUM(${shiftExpenses.amount})
        FROM ${shiftExpenses}
        WHERE ${shiftExpenses.shiftId} = ${shifts.id}
      ), 0)`,
    })
    .from(shifts)
    .where(and(eq(shifts.branchId, branchId), eq(shifts.status, 'OPEN')))
    .limit(1)

  const [uoms, payments] = await Promise.all([
    getCachedUnitsOfMeasure(),
    getCachedPaymentMethods(),
  ])

  const activeShift = shiftRow?.shift ?? null
  const expenseTotal = shiftRow?.expenseTotal ?? 0

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
      storeInfo={storeInfo}
      userRole={payload.role}
      totalExpenses={expenseTotal}
    />
  )
}

