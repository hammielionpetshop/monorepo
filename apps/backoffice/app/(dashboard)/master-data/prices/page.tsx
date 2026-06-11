import { db, branches, categories } from '@/lib/db'
import PricesClient from './_components/prices-client'

export const dynamic = 'force-dynamic'

export default async function PricesPage() {
  const [branchList, categoryList] = await Promise.all([
    db.select({ id: branches.id, name: branches.name }).from(branches).orderBy(branches.name),
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(categories.name),
  ])

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

      <PricesClient branches={branchList} categories={categoryList} />
    </div>
  )
}
