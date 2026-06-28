import { db, cashFlowCategories } from '@/lib/db'
import CategoryClient from './_components/category-client'
import type { CashFlowCategory } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function CashFlowCategoriesPage() {
  let data: CashFlowCategory[] = []
  let error: string | null = null

  try {
    data = (await db
      .select({ id: cashFlowCategories.id, name: cashFlowCategories.name, type: cashFlowCategories.type })
      .from(cashFlowCategories)
      .orderBy(cashFlowCategories.type, cashFlowCategories.name)) as CashFlowCategory[]
  } catch (e) {
    console.error('CashFlowCategoriesPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data kategori'
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
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Kategori Pendapatan & Pengeluaran</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola kategori untuk mencatat arus kas</p>
      </div>
      <CategoryClient categories={data} />
    </div>
  )
}
