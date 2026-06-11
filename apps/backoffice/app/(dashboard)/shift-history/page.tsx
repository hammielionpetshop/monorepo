import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { db, branches, eq } from '@/lib/db'
import { Suspense } from 'react'
import { ShiftHistoryClient } from './_components/shift-history-client'

export const dynamic = 'force-dynamic'

export default async function ShiftHistoryPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload || !['OWNER', 'GM'].includes(payload.role)) {
    redirect('/dashboard')
  }

  const activeBranches = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(eq(branches.isActive, true))
    .orderBy(branches.name)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Riwayat Shift</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Rekap seluruh shift kasir beserta detail settlement dan pengeluaran
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
        <ShiftHistoryClient branches={activeBranches} />
      </Suspense>
    </div>
  )
}
