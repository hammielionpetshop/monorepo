import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { branches, db, eq, paymentMethods } from '@/lib/db'
import BulkSaleClient from './_components/bulk-sale-client'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['OWNER', 'GM', 'MANAGER']
const GLOBAL_ROLES = ['OWNER', 'GM']

export default async function BulkSalePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload) redirect('/login')

  if (!ALLOWED_ROLES.includes(payload.role)) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">Akses Ditolak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hanya Owner, GM, dan Manager yang dapat membuat bulk sale.
          </p>
        </div>
      </div>
    )
  }

  const isGlobalRole = GLOBAL_ROLES.includes(payload.role)
  const branchRows = isGlobalRole
    ? await db
        .select({ id: branches.id, name: branches.name, code: branches.code })
        .from(branches)
        .where(eq(branches.isActive, true))
        .orderBy(branches.name)
    : [{ id: payload.branchId, name: payload.branchName, code: String(payload.branchId) }]

  const paymentMethodRows = await db
    .select({ id: paymentMethods.id, name: paymentMethods.name, type: paymentMethods.type })
    .from(paymentMethods)
    .orderBy(paymentMethods.name)

  return (
    <div className="p-6">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Memuat...</div>}>
        <BulkSaleClient
          currentUser={{
            userId: payload.userId,
            userName: payload.userName,
            branchId: payload.branchId,
            branchName: payload.branchName,
            role: payload.role,
          }}
          branches={branchRows}
          paymentMethods={paymentMethodRows}
        />
      </Suspense>
    </div>
  )
}
