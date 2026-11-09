import { db, cashFlowCategories, expenseCategories, asc } from '@/lib/db'
import { categorySelect } from '@/lib/services/cash-flow-sql'
import CategoryClient from './_components/category-client'
import type { CashFlowCategory, ExpenseLink } from './_components/types'

export const dynamic = 'force-dynamic'

export default async function CashFlowCategoriesPage() {
  let data: CashFlowCategory[] = []
  let links: ExpenseLink[] = []
  let error: string | null = null

  try {
    data = (await db
      .select(categorySelect)
      .from(cashFlowCategories)
      .orderBy(cashFlowCategories.type, cashFlowCategories.name)) as CashFlowCategory[]
    links = await db
      .select({ id: expenseCategories.id, name: expenseCategories.name, cashFlowCategoryId: expenseCategories.cashFlowCategoryId })
      .from(expenseCategories)
      .orderBy(asc(expenseCategories.name))
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
        <p className="text-sm text-muted-foreground mt-0.5">
          Kelola kategori untuk mencatat arus kas. Setiap kategori punya jenis laporan: Biaya atau Bukan biaya (pengeluaran),
          Pendapatan lain atau Bukan pendapatan (pemasukan).
        </p>
      </div>
      <CategoryClient categories={data} expenseLinks={links} />
    </div>
  )
}
