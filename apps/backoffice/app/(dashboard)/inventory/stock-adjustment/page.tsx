import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth'
import { getProductsWithStock, type ProductWithStock } from '@/lib/services/stock-service'
import AdjustmentForm from './_components/adjustment-form'

export default async function StockAdjustmentPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null
  // layout.tsx sudah redirect jika tidak ada token — payload tidak akan null di sini

  let products: ProductWithStock[] = []
  let error: string | null = null

  try {
    if (payload) {
      products = await getProductsWithStock(payload.branchId)
    }
  } catch {
    error = 'Gagal mengambil daftar produk. Silakan coba lagi.'
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
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-semibold text-foreground mb-1">Penyesuaian Stok</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Koreksi jumlah stok barang secara manual (barang hilang, rusak, atau selisih stock opname).
      </p>
      <AdjustmentForm products={products} />
    </div>
  )
}
