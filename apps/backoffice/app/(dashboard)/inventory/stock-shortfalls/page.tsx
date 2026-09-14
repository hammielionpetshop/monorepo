import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { hasPermission } from '@/lib/authz'
import { db, branches, eq } from '@/lib/db'
import { getOpenShortfalls, type StockShortfallListItem } from '@/lib/services/stock-shortfall-report'
import StockShortfallFilter from './_components/stock-shortfall-filter'
import StockShortfallListClient from './_components/stock-shortfall-list-client'

export const dynamic = 'force-dynamic'

export default async function StockShortfallsPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; q?: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) redirect('/login')

  if (!hasPermission(payload, 'inventory.stock_shortfall.manage')) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">Akses Ditolak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hanya Owner dan GM yang dapat mengelola utang stok (shortfall).
          </p>
        </div>
      </div>
    )
  }

  const isGlobal = payload.branchScope === 'ALL'
  const params = await searchParams
  const search = params.q?.trim() || null
  const parsedBranch = params.branchId ? Number(params.branchId) : null
  const branchId = isGlobal ? (Number.isInteger(parsedBranch) && parsedBranch! > 0 ? parsedBranch : null) : payload.branchId

  let rows: StockShortfallListItem[] = []
  let error: string | null = null
  try {
    rows = await getOpenShortfalls({ branchId, search })
  } catch (e) {
    error = e instanceof Error ? e.message : 'Gagal memuat daftar shortfall'
  }

  const branchOptions = isGlobal
    ? await db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.isActive, true)).orderBy(branches.name)
    : []

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-foreground">Utang Stok (Oversell)</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Daftar kekurangan stok akibat penjualan/koreksi nota yang melebihi stok tercatat, yang
        masih belum lunas. Dilunasi otomatis (FIFO) oleh penerimaan PO produk yang sama —
        tutup manual hanya untuk kasus barang terbukti hilang/rusak, bukan sekadar telat input.
      </p>

      <StockShortfallFilter defaultBranchId={params.branchId} defaultSearch={params.q} branches={isGlobal ? branchOptions : undefined} />

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      <StockShortfallListClient initialRows={rows} />
    </div>
  )
}
