import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { hasPermission } from '@/lib/authz'
import { db, branches, eq } from '@/lib/db'
import { getResolutionQueueGroupedBySo, type SOResolutionGroupedRow } from '@/lib/services/stock-opname-resolution-report'
import ResolusiFilter from './_components/resolusi-filter'
import ResolusiSoListClient from './_components/resolusi-so-list-client'

export const dynamic = 'force-dynamic'

export interface EmployeeOption {
  id: number
  name: string
}

const DEFAULT_RANGE_DAYS = 90

function wibToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

function wibDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

export default async function StockOpnameResolusiPage({
  searchParams,
}: {
  searchParams: Promise<{ startDate?: string; endDate?: string; branchId?: string; q?: string }>
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

  const isGlobal = payload.branchScope === 'ALL'
  const params = await searchParams
  const startDate = params.startDate ?? wibDaysAgo(DEFAULT_RANGE_DAYS)
  const endDate = params.endDate ?? wibToday()
  const search = params.q?.trim() || null

  const parsedBranch = params.branchId ? Number(params.branchId) : null
  const branchId = isGlobal ? (Number.isInteger(parsedBranch) && parsedBranch! > 0 ? parsedBranch : null) : payload.branchId

  let rows: SOResolutionGroupedRow[] = []
  let error: string | null = null
  try {
    rows = await getResolutionQueueGroupedBySo({ branchId, startDate, endDate, search })
  } catch (e) {
    error = e instanceof Error ? e.message : 'Gagal memuat daftar SO'
  }

  const branchOptions = isGlobal
    ? await db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.isActive, true)).orderBy(branches.name)
    : []

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-foreground">Resolusi Selisih SO Besar</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Pilih SO yang masih punya item selisih untuk ditindaklanjuti: ternyata ditemukan, hangus jadi
        kerugian toko, dibebankan ke karyawan (bisa dibagi/sebagian), atau lebih dengan alasan tertentu.
      </p>

      <ResolusiFilter
        defaultStartDate={startDate}
        defaultEndDate={endDate}
        defaultBranchId={params.branchId}
        defaultSearch={params.q}
        branches={isGlobal ? branchOptions : undefined}
      />

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      <ResolusiSoListClient rows={rows} />
    </div>
  )
}
