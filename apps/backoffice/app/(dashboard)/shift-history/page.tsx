import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { db, branches, eq, and } from '@/lib/db'
import { hasPermission, scopeFilter } from '@/lib/authz'
import { Suspense } from 'react'
import { ShiftHistoryClient } from './_components/shift-history-client'

export const dynamic = 'force-dynamic'

export default async function ShiftHistoryPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null

  const canRead = !!payload && hasPermission(payload, 'shift.read')
  const canVerify = !!payload && hasPermission(payload, 'shift.deposit.verify')
  if (!payload || (!canRead && !canVerify)) {
    redirect('/dashboard')
  }

  const activeBranches = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(and(eq(branches.isActive, true), scopeFilter(payload, branches.id)))
    .orderBy(branches.name)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Riwayat Shift</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Rekap seluruh shift kasir beserta detail settlement, pengeluaran, dan verifikasi setoran
        </p>
      </div>
      <Suspense
        fallback={
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        }
      >
        <ShiftHistoryClient
          branches={activeBranches}
          canVerify={canVerify}
          canCorrect={canVerify && ['OWNER', 'GM'].includes(payload.role)}
        />
      </Suspense>
    </div>
  )
}
