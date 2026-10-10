import { db, productUomCosts, eq, and, inArray } from '@/lib/db'

/**
 * Modal terakhir per (produk, satuan) di cabang PO — dari Manajemen Harga, yang diperbarui setiap
 * barang masuk (sinkron modal). Dipakai sebagai pengingat "terakhir Rp X" di samping kolom harga.
 */
export async function loadLastCosts(
  branchId: number,
  items: { productId: number; uomId: number }[],
): Promise<Map<string, number>> {
  const productIds = [...new Set(items.map((i) => i.productId))]
  if (productIds.length === 0) return new Map()
  const rows = await db
    .select({
      productId: productUomCosts.productId,
      uomId: productUomCosts.uomId,
      costPrice: productUomCosts.costPrice,
    })
    .from(productUomCosts)
    .where(and(eq(productUomCosts.branchId, branchId), inArray(productUomCosts.productId, productIds)))
  return new Map(rows.map((r) => [lastCostKey(r.productId, r.uomId), r.costPrice]))
}

export function lastCostKey(productId: number, uomId: number) {
  return `${productId}:${uomId}`
}
