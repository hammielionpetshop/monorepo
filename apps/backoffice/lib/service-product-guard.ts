import { db, products, inArray } from '@/lib/db'
import { isServiceKind } from './product-kind'

/**
 * Penolakan dini saat dokumen stok DIBUAT (PO, penyesuaian stok, stock opname, barang rusak):
 * kembalikan pesan bila ada produk jasa, atau null bila aman. Penjaga terakhirnya tetap
 * `assertStockProduct` di StockService; yang ini supaya pengguna langsung tahu sebabnya, dan
 * menutup jalur yang mengubah stok tanpa lewat StockService.
 */
export async function serviceProductMessage(productIds: number[]): Promise<string | null> {
  const ids = Array.from(new Set(productIds.filter((id) => Number.isInteger(id) && id > 0)))
  if (ids.length === 0) return null
  const rows = await db
    .select({ name: products.name, productKind: products.productKind })
    .from(products)
    .where(inArray(products.id, ids))
  const service = rows.find((r) => isServiceKind(r.productKind))
  return service
    ? `${service.name} adalah produk jasa — tidak punya stok, jadi tidak bisa dimasukkan ke dokumen ini`
    : null
}
