import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/authz'
import { db, branches, eq } from '@/lib/db'
import {
  getPromoEnabled, listPromoItemOptions, listPromos, PROMO_MANAGER_ROLES,
} from '@/lib/services/promo-service'
import { NewBadge } from '@/components/ui/new-badge'
import PromoClient from './_components/promo-client'
import { toPromoView, type BranchOption, type PromoItemOption, type PromoView } from './_components/types'

export const dynamic = 'force-dynamic'

/** Tanggal hari ini menurut WIB, bukan menurut jam server yang berjalan di UTC. */
function todayWIB(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

export default async function PromosPage() {
  const payload = await getAuth()
  if (!payload) redirect('/login')
  if (!PROMO_MANAGER_ROLES.includes(payload.role)) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Promo hanya bisa diatur Owner dan GM.
        </div>
      </div>
    )
  }

  const isGlobal = payload.branchScope === 'ALL'
  let promos: PromoView[] = []
  let enabled = true
  let items: PromoItemOption[] = []
  let branchOptions: BranchOption[] = []
  let error: string | null = null
  try {
    const [rows, switchOn, itemRows, branchRows] = await Promise.all([
      listPromos(isGlobal ? {} : { branchId: payload.branchId }),
      getPromoEnabled(),
      listPromoItemOptions(payload.branchId),
      isGlobal
        ? db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.isActive, true)).orderBy(branches.name)
        : Promise.resolve([{ id: payload.branchId, name: payload.branchName }]),
    ])
    promos = rows.map(toPromoView)
    enabled = switchOn
    items = itemRows
    branchOptions = branchRows
  } catch (e) {
    console.error('PromosPage error:', e)
    error = 'Terjadi kesalahan saat mengambil daftar promo'
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">
          Promo <NewBadge feature="/promos" />
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isGlobal ? 'Semua cabang. ' : 'Cabang Anda. '}
          Promo otomatis yang nanti dihitung sendiri di kasir untuk pelanggan umum / Retail. Promo tidak bisa diubah atau
          dihapus — bila keliru, nonaktifkan lalu buat promo baru. Harga di form = harga Retail cabang {payload.branchName}.
        </p>
      </div>
      {error ? (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">{error}</div>
      ) : (
        <PromoClient
          promos={promos}
          enabled={enabled}
          items={items}
          branches={branchOptions}
          today={todayWIB()}
          defaultBranchIds={[payload.branchId]}
        />
      )}
    </div>
  )
}
