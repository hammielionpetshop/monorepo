import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { verifyAccessToken } from '@/lib/auth'
import { hasPermission } from '@/lib/authz'
import { db, users, branches, stockOpnames, eq } from '@/lib/db'
import { getResolutionQueue } from '@/lib/services/stock-opname-resolution-report'
import ResolusiClient from '../_components/resolusi-client'

export const dynamic = 'force-dynamic'

export default async function StockOpnameResolusiSoPage({
  params,
}: {
  params: Promise<{ soId: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) redirect('/login')

  if (!hasPermission(payload, 'stock_opname.resolve')) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">Akses Ditolak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hanya Owner dan GM yang dapat meresolusi selisih SO Besar.
          </p>
        </div>
      </div>
    )
  }

  const { soId } = await params
  const soIdNum = Number(soId)
  if (!Number.isInteger(soIdNum) || soIdNum <= 0) notFound()

  const [header] = await db
    .select({
      id: stockOpnames.id,
      soNumber: stockOpnames.soNumber,
      branchId: stockOpnames.branchId,
      branchName: branches.name,
      notes: stockOpnames.notes,
      createdAt: stockOpnames.createdAt,
    })
    .from(stockOpnames)
    .innerJoin(branches, eq(stockOpnames.branchId, branches.id))
    .where(eq(stockOpnames.id, soIdNum))
    .limit(1)

  if (!header) notFound()

  if (payload.branchScope !== 'ALL' && payload.branchId !== header.branchId) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">Akses Ditolak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Anda hanya dapat meresolusi stock opname cabang Anda sendiri.
          </p>
        </div>
      </div>
    )
  }

  const [queue, employeeOptions] = await Promise.all([
    getResolutionQueue({ soId: soIdNum }),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.isActive, true)).orderBy(users.name),
  ])

  return (
    <div className="p-6">
      <Link
        href="/inventory/stock-opname/resolusi"
        className="text-sm text-muted-foreground hover:underline mb-3 inline-block"
      >
        &larr; Kembali ke Daftar SO
      </Link>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-foreground font-mono">{header.soNumber}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {header.branchName}
        {header.notes ? ` · ${header.notes}` : ''}
      </p>

      {queue.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Semua item selisih SO ini sudah diresolusi.
        </div>
      ) : (
        <ResolusiClient initialQueue={queue} employeeOptions={employeeOptions} />
      )}
    </div>
  )
}
