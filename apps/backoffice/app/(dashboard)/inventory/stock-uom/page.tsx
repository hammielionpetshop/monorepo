import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyAccessToken } from '@/lib/auth'
import { hasPermission } from '@/lib/authz'
import { db, products, unitsOfMeasure, eq, and } from '@/lib/db'
import { NewBadge } from '@/components/ui/new-badge'
import BaseUomChangeClient from './_components/base-uom-change-client'

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
            Hanya Owner dan GM yang dapat mengganti satuan dasar barang.
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
      .where(and(eq(products.isActive, true), eq(products.productKind, 'BARANG')))
      .orderBy(products.name),
    db
      .select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code, name: unitsOfMeasure.name })
      .from(unitsOfMeasure)
      .orderBy(unitsOfMeasure.code),
  ])

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-foreground mb-1">
        Migrasi Satuan Stok <NewBadge feature="fitur/ganti-satuan-dasar" />
      </h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
        Ganti satuan dasar barang ke satuan yang lebih kecil (contoh: SAK → PCS). Stok, modal, dan
        konversi di semua cabang diubah sekaligus dalam 1 klik.
      </p>
      <BaseUomChangeClient products={productRows} uoms={uomRows} />
    </div>
  )
}
