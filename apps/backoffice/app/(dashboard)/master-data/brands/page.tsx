import { db, brands } from '@/lib/db'
import BrandClient from './_components/brand-client'

export const dynamic = 'force-dynamic'

export default async function BrandsPage() {
  let data: { id: number; name: string }[] = []
  let error: string | null = null

  try {
    data = await db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(brands.name)
  } catch (e) {
    console.error('BrandsPage error:', e)
    error = 'Terjadi kesalahan saat mengambil data brand'
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
        <h1 className="text-xl font-semibold text-foreground">Manajemen Brand</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kelola daftar brand produk</p>
      </div>
      <BrandClient brands={data} />
    </div>
  )
}
