import { db, categories } from '@/lib/db'
import CategoryClient from './_components/category-client'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  let data: { id: number; name: string }[] = []
  let error: string | null = null

  try {
    data = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(categories.name)
  } catch (e) {
    console.error('CategoriesPage error:', e)
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
        <h1 className="text-xl font-semibold text-foreground">Manajemen Kategori</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola daftar kategori produk</p>
      </div>
      <CategoryClient categories={data} />
    </div>
  )
}
