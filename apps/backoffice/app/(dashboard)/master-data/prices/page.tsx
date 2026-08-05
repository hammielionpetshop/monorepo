import { db, branches, categories } from '@/lib/db'
import { getAuth } from '@/lib/authz'
import PricesClient from './_components/prices-client'

export const dynamic = 'force-dynamic'

export default async function PricesPage() {
  const [payload, branchList, categoryList] = await Promise.all([
    getAuth(),
    db.select({ id: branches.id, name: branches.name }).from(branches).orderBy(branches.name),
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(categories.name),
  ])

  // Default ke cabang user, bukan cabang pertama menurut abjad — mencegah
  // harga terisi di cabang yang salah tanpa disadari
  const defaultBranchId = branchList.some(b => b.id === payload?.branchId)
    ? payload!.branchId
    : branchList[0]?.id ?? null

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Manajemen Harga</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Edit harga produk per cabang secara massal
          </p>
        </div>
      </div>

      <PricesClient
        branches={branchList}
        categories={categoryList}
        defaultBranchId={defaultBranchId}
      />
    </div>
  )
}
