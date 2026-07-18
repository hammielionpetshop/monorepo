import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { hasPermission } from '@/lib/authz'
import { db, stockOpnames, stockOpnameItems, branches, users, eq, and, inArray, sql, count, desc } from '@/lib/db'
import SOClient from './_components/so-client'

export const dynamic = 'force-dynamic'

const VIEW_ROLES = ['OWNER', 'GM', 'MANAGER']
const PRIVILEGED_ROLES = ['OWNER', 'GM']

export interface SOListItem {
  id: number
  soNumber: string
  type: string
  status: string
  branchName: string
  createdByName: string
  createdAt: Date | string
  itemCount: number
}

export interface SOReviewHeader {
  id: number
  soNumber: string
  type: string
  status: string
  branchName: string
  createdByName: string
  createdAt: Date | string
  notes: string | null
  itemCount: number
}

export interface SOReviewItem {
  id: number
  productId: number
  productName: string
  uomId: number
  uomCode: string
  systemQty: number
  physicalQty: number
  varianceQty: number
  varianceCostValue: number | null
  varianceReason: string | null
}

export interface SOReviewData {
  header: SOReviewHeader
  items: SOReviewItem[]
}

export default async function StockOpnamePage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string }>
}) {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  if (!payload) redirect('/login')

  if (!VIEW_ROLES.includes(payload.role)) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">Akses Ditolak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hanya Owner, GM, dan Manager yang dapat melihat persetujuan stock opname.
          </p>
        </div>
      </div>
    )
  }

  const params = await searchParams
  const showSuccess = params?.success === '1'

  let soList: SOListItem[] = []
  let error: string | null = null

  try {
    // DRAFT ikut ditampilkan (tanpa tombol Setujui) supaya SO yang masih dihitung
    // terlihat, dan SO Besar yang salah dibuat bisa dibatalkan — kalau disembunyikan,
    // SO itu tersangkut selamanya sekaligus memblokir pembuatan SO baru di cabangnya.
    const pendingConditions = [inArray(stockOpnames.status, ['DRAFT', 'PENDING'])]
    if (!PRIVILEGED_ROLES.includes(payload.role)) {
      pendingConditions.push(eq(stockOpnames.branchId, payload.branchId))
    }

    const soHeaders = await db
      .select({
        id: stockOpnames.id,
        soNumber: stockOpnames.soNumber,
        type: stockOpnames.type,
        status: stockOpnames.status,
        branchName: branches.name,
        createdByName: sql<string>`COALESCE(${users.name}, 'User dihapus')`,
        createdAt: stockOpnames.createdAt,
      })
      .from(stockOpnames)
      .innerJoin(branches, eq(stockOpnames.branchId, branches.id))
      .leftJoin(users, eq(stockOpnames.createdById, users.id))
      .where(and(...pendingConditions))
      .orderBy(desc(stockOpnames.status), stockOpnames.createdAt)

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
        <div className="flex items-center gap-2">
          <a
            href="/reports/stock-opname"
            className="px-3 py-1.5 text-xs font-medium border border-border text-muted-foreground rounded-md hover:bg-accent hover:text-foreground transition-colors"
          >
            Lihat Riwayat &amp; Hasil
          </a>
          <a
            href="/inventory/stock-opname/new"
            className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            + Mulai SO Besar
          </a>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Stock opname yang menunggu persetujuan &mdash; setujui untuk memperbarui stok, atau tolak dengan alasan.
        Yang berstatus <span className="font-medium">Dihitung</span> masih diisi kasir di POS dan belum bisa disetujui.
      </p>

      {showSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm mb-4">
          Stock Opname Besar berhasil dibuat dan kini menunggu persetujuan.
        </div>
      )}

      <SOClient initialData={soList} canEditItems={hasPermission(payload, 'stock_opname.edit_item')} />
    </div>
  )
}
