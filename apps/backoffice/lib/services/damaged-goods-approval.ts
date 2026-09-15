import { db, damagedGoods, damagedGoodsItems, branches, products, unitsOfMeasure, users, eq, inArray, asc } from '@/lib/db'

export interface PendingDamagedGoodsItem {
  productName: string
  sku: string | null
  uomCode: string
  qty: number
  lossValue: number
  photoUrl: string | null
}

export interface PendingDamagedGoods {
  id: number
  branchId: number
  branchName: string
  reason: string
  notes: string | null
  totalLossValue: number
  reportedAt: string
  reportedByName: string
  items: PendingDamagedGoodsItem[]
}

/** Laporan barang rusak yang masih menunggu approval OWNER/GM — stok belum tersentuh. */
export async function getPendingDamagedGoods(): Promise<PendingDamagedGoods[]> {
  const headerRows = await db
    .select({
      id: damagedGoods.id,
      branchId: damagedGoods.branchId,
      branchName: branches.name,
      reason: damagedGoods.reason,
      notes: damagedGoods.notes,
      totalLossValue: damagedGoods.totalLossValue,
      reportedAt: damagedGoods.reportedAt,
      reportedByName: users.name,
    })
    .from(damagedGoods)
    .innerJoin(branches, eq(damagedGoods.branchId, branches.id))
    .leftJoin(users, eq(damagedGoods.reportedById, users.id))
    .where(eq(damagedGoods.status, 'PENDING'))
    .orderBy(asc(damagedGoods.reportedAt))

  const ids = headerRows.map((h) => h.id)
  const itemRows = ids.length
    ? await db
        .select({
          damagedGoodsId: damagedGoodsItems.damagedGoodsId,
          productName: products.name,
          sku: products.sku,
          uomCode: unitsOfMeasure.code,
          qty: damagedGoodsItems.qty,
          lossValue: damagedGoodsItems.lossValue,
          photoUrl: damagedGoodsItems.photoUrl,
        })
        .from(damagedGoodsItems)
        .leftJoin(products, eq(damagedGoodsItems.productId, products.id))
        .leftJoin(unitsOfMeasure, eq(damagedGoodsItems.uomId, unitsOfMeasure.id))
        .where(inArray(damagedGoodsItems.damagedGoodsId, ids))
    : []

  const itemsByHeader = new Map<number, PendingDamagedGoodsItem[]>()
  for (const row of itemRows) {
    const list = itemsByHeader.get(row.damagedGoodsId) ?? []
    list.push({
      productName: row.productName ?? 'Produk Dihapus',
      sku: row.sku,
      uomCode: row.uomCode ?? '-',
      qty: row.qty,
      lossValue: row.lossValue,
      photoUrl: row.photoUrl,
    })
    itemsByHeader.set(row.damagedGoodsId, list)
  }

  return headerRows.map((h) => ({
    id: h.id,
    branchId: h.branchId,
    branchName: h.branchName,
    reason: h.reason,
    notes: h.notes,
    totalLossValue: h.totalLossValue,
    reportedAt: h.reportedAt instanceof Date ? h.reportedAt.toISOString() : String(h.reportedAt),
    reportedByName: h.reportedByName ?? '-',
    items: itemsByHeader.get(h.id) ?? [],
  }))
}
