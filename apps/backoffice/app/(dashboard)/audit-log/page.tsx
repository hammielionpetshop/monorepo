import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/authz'
import { db, auditLogs, branches, eq } from '@/lib/db'
import { AuditLogTable, type BranchOption } from './_components/audit-log-table'

export const dynamic = 'force-dynamic'

export default async function AuditLogPage() {
  const payload = await getAuth()
  if (!payload) redirect('/login')

  const [branchOptions, actionRows] = await Promise.all([
    payload.branchScope === 'ALL'
      ? db
          .select({ id: branches.id, name: branches.name })
          .from(branches)
          .where(eq(branches.isActive, true))
          .orderBy(branches.name)
      : Promise.resolve([] as BranchOption[]),
    db.selectDistinct({ action: auditLogs.action }).from(auditLogs),
  ])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Riwayat aktivitas penyesuaian stok dan perubahan data penting
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
        <AuditLogTable branches={branchOptions} dbActions={actionRows.map((r) => r.action)} />
      </Suspense>
    </div>
  )
}
