import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { db, branches, eq, sql } from '@/lib/db'
import StockLogsClient from './_components/stock-logs-client'
import { fetchStockLedger, type StockLogEntry } from '@/lib/services/stock-ledger'

export const dynamic = 'force-dynamic'

export type BranchOption = { id: number; name: string }

// Harus sama dengan GLOBAL_ROLES di GET /api/bo/inventory/stock-logs
const GLOBAL_ROLES = ['OWNER', 'GM']

export default async function StockLogsPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) redirect('/login')

  const isGlobal = GLOBAL_ROLES.includes(payload.role)

  const branchOptions: BranchOption[] = isGlobal
    ? await db
        .select({ id: branches.id, name: branches.name })
        .from(branches)
        .where(eq(branches.isActive, true))
        .orderBy(branches.name)
    : []

  const today = new Date()
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 7)
  const defaultFrom = sevenDaysAgo.toISOString().split('T')[0]
  const defaultTo = today.toISOString().split('T')[0]

  const filters = [
    sql`sm.created_at >= ${defaultFrom + 'T00:00:00.000Z'}`,
    sql`sm.created_at <= ${defaultTo + 'T23:59:59.999Z'}`,
  ]
  if (!isGlobal) filters.push(sql`sm.branch_id = ${payload.branchId}`)

  let initialData: StockLogEntry[] = []
  let initialError: string | null = null

  try {
    initialData = await fetchStockLedger(filters)
  } catch (e) {
    console.error('StockLogsPage error:', e)
    initialError = 'Terjadi kesalahan saat memuat data mutasi stok'
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-foreground mb-1">Mutasi Stok</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Riwayat semua pergerakan stok: penjualan, void penjualan, penerimaan PO, penyesuaian, stock opname, pecah satuan, retur, barang rusak, dan transfer antar cabang.
      </p>
      <StockLogsClient
        initialData={initialData}
        initialError={initialError}
        branches={branchOptions}
        defaultFrom={defaultFrom}
        defaultTo={defaultTo}
        isGlobal={isGlobal}
      />
    </div>
  )
}
