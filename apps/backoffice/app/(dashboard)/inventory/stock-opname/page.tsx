import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { db, stockOpnames, stockOpnameItems, branches, users, eq, inArray, sql, count } from '@/lib/db'
import SOClient from './_components/so-client'

export const dynamic = 'force-dynamic'

export interface SOListItem {
  id: number
  soNumber: string
  type: string
  branchName: string
  createdByName: string
  createdAt: Date | string
  itemCount: number
}

export default async function StockOpnamePage({
  searchParams,
}: {
  searchParams?: { success?: string }
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) redirect('/login')

  const showSuccess = searchParams?.success === '1'

  let soList: SOListItem[] = []
  let error: string | null = null

  try {
    const soHeaders = await db
      .select({
        id: stockOpnames.id,
        soNumber: stockOpnames.soNumber,
        type: stockOpnames.type,
        branchName: branches.name,
        createdByName: sql<string>`COALESCE(${users.name}, 'User dihapus')`,
        createdAt: stockOpnames.createdAt,
      })
      .from(stockOpnames)
      .innerJoin(branches, eq(stockOpnames.branchId, branches.id))
      .leftJoin(users, eq(stockOpnames.createdById, users.id))
      .where(eq(stockOpnames.status, 'PENDING'))
      .orderBy(stockOpnames.createdAt)

    const soIds = soHeaders.map((so) => so.id)

    if (soIds.length > 0) {
      const itemCounts = await db
        .select({
          soId: stockOpnameItems.soId,
          itemCount: count(),
        })
        .from(stockOpnameItems)
        .where(inArray(stockOpnameItems.soId, soIds))
        .groupBy(stockOpnameItems.soId)

      const countMap = new Map(itemCounts.map((r) => [r.soId, r.itemCount]))
      soList = soHeaders.map((so) => ({
        ...so,
        itemCount: countMap.get(so.id) ?? 0,
      }))
    } else {
      soList = []
    }
  } catch (e) {
    console.error('StockOpnamePage error:', e)
    error = 'Terjadi kesalahan saat mengambil data stock opname'
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-foreground">Stock Opname — Persetujuan</h1>
        <a
          href="/inventory/stock-opname/new"
          className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          + Mulai SO Besar
        </a>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Daftar stock opname yang menunggu persetujuan. Setujui untuk memperbarui stok atau tolak dengan alasan.
      </p>

      {showSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm mb-4">
          Stock Opname Besar berhasil dibuat dan kini menunggu persetujuan.
        </div>
      )}

      <SOClient initialData={soList} />
    </div>
  )
}
