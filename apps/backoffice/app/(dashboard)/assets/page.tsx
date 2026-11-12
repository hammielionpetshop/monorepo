import { redirect } from 'next/navigation'
import { getAuth } from '@/lib/authz'
import { todayWibDate } from '@/lib/payment-date'
import { db, moneyPlaces, branches, eq, ne, and, asc } from '@/lib/db'
import { canDisposeAssets, canRecordAssets, canViewAssets } from '@/lib/services/asset-access'
import AssetClient, { type PlaceOption } from './_components/asset-client'

export const dynamic = 'force-dynamic'

export default async function AssetsPage() {
  const payload = await getAuth()
  if (!payload) redirect('/login')
  if (!canViewAssets(payload)) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          Aset hanya untuk Owner, GM, dan Finance.
        </div>
      </div>
    )
  }

  const [places, branchOptions] = await Promise.all([
    db
      .select({ id: moneyPlaces.id, name: moneyPlaces.name, kind: moneyPlaces.kind })
      .from(moneyPlaces)
      .where(and(eq(moneyPlaces.isActive, true), ne(moneyPlaces.kind, 'DRAWER')))
      .orderBy(asc(moneyPlaces.kind), asc(moneyPlaces.sortOrder), asc(moneyPlaces.name)) as Promise<PlaceOption[]>,
    db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.isActive, true)).orderBy(asc(branches.name)),
  ])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Aset</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Barang tahan lama Rp1.000.000 ke atas (freezer, AC, rak, komputer, renovasi toko sewaan). Harganya tidak dihitung sebagai biaya
          satu bulan, tetapi dibagi rata per bulan selama umur pakainya (penyusutan) di Laba Rugi. Mencatat pembelian di sini sekaligus
          mencatat uang keluarnya di Pendapatan & Pengeluaran sebagai &quot;Beli aset&quot;.
        </p>
      </div>
      <AssetClient
        places={places}
        branches={branchOptions}
        canRecord={canRecordAssets(payload)}
        canDispose={canDisposeAssets(payload)}
        today={todayWibDate()}
      />
    </div>
  )
}
