import { Suspense } from 'react'
import { AuditLogTable } from './_components/audit-log-table'

export const dynamic = 'force-dynamic'

export default function AuditLogPage() {
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
        <AuditLogTable />
      </Suspense>
    </div>
  )
}
