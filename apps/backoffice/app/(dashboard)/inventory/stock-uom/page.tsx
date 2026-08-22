import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { hasPermission } from '@/lib/authz'
import { db, products, unitsOfMeasure, eq } from '@/lib/db'
import StockUomClient from './_components/stock-uom-client'

export const dynamic = 'force-dynamic'

export default async function StockUomPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('accessToken')?.value
  const payload = token ? await verifyAccessToken(token) : null

  if (!payload) redirect('/login')

  if (!hasPermission(payload, 'master.product.manage')) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-semibold text-foreground">Akses Ditolak</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hanya Owner dan GM yang dapat mengelola stok lintas satuan.
          </p>
        </div>
      </div>
    )
  }

  const [productRows, uomRows] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, sku: products.sku, baseUomId: products.baseUomId, baseUomCode: unitsOfMeasure.code })
      .from(products)
      .leftJoin(unitsOfMeasure, eq(products.baseUomId, unitsOfMeasure.id))
      .orderBy(products.name),
    db
      .select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code, name: unitsOfMeasure.name })
      .from(unitsOfMeasure)
      .orderBy(unitsOfMeasure.name),
  ])

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-foreground mb-1">Migrasi Satuan Stok</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        Lihat baris stok &amp; batch stok per cabang/satuan untuk satu produk, lalu bereskan
        yang menghalangi ganti satuan dasar: hapus baris yang sudah kosong, atau pindahkan
        stok nyata ke satuan lain lengkap dengan konversi qty &amp; harga modalnya.
      </p>
      <StockUomClient products={productRows} uoms={uomRows} />
    </div>
  )
}
