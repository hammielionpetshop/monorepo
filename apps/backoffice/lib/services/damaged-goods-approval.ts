import { alias } from 'drizzle-orm/pg-core'
import { db, damagedGoods, damagedGoodsItems, branches, products, unitsOfMeasure, users, eq, inArray, asc, desc } from '@/lib/db'

export type DamagedGoodsQueueStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface DamagedGoodsQueueItem {
  productName: string
  sku: string | null
  uomCode: string
  qty: number
  lossValue: number
  photoUrl: string | null
}

export interface DamagedGoodsQueueEntry {
  id: number
  branchId: number
  branchName: string
  reason: string
  notes: string | null
  totalLossValue: number
  reportedAt: string
  reportedByName: string
  status: DamagedGoodsQueueStatus
  resolvedByName: string | null
  resolvedAt: string | null
  resolutionAction: string | null
  resolutionNotes: string | null
  rejectionReason: string | null
  items: DamagedGoodsQueueItem[]
}

/**
 * Laporan barang rusak per status — PENDING (belum diputuskan, stok belum tersentuh),
 * APPROVED (stok sudah dipotong nilai FIFO nyata), atau REJECTED (stok tidak pernah
 * tersentuh). PENDING diurutkan tertua dulu (antrean); APPROVED/REJECTED terbaru dulu
 * (riwayat).
 */
export async function getDamagedGoodsByStatus(status: DamagedGoodsQueueStatus): Promise<DamagedGoodsQueueEntry[]> {
  const resolvedBy = alias(users, 'damaged_goods_resolved_by')

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
      status: damagedGoods.status,
      resolvedByName: resolvedBy.name,
      resolvedAt: damagedGoods.resolvedAt,
      resolutionAction: damagedGoods.resolutionAction,
      resolutionNotes: damagedGoods.resolutionNotes,
      rejectionReason: damagedGoods.rejectionReason,
    })
    .from(damagedGoods)
    .innerJoin(branches, eq(damagedGoods.branchId, branches.id))
    .leftJoin(users, eq(damagedGoods.reportedById, users.id))
    .leftJoin(resolvedBy, eq(damagedGoods.resolvedById, resolvedBy.id))
    .where(eq(damagedGoods.status, status))
    .orderBy(status === 'PENDING' ? asc(damagedGoods.reportedAt) : desc(damagedGoods.resolvedAt))
    .limit(200)

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

  const itemsByHeader = new Map<number, DamagedGoodsQueueItem[]>()
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
    status: h.status as DamagedGoodsQueueStatus,
    resolvedByName: h.resolvedByName,
    resolvedAt: h.resolvedAt ? (h.resolvedAt instanceof Date ? h.resolvedAt.toISOString() : String(h.resolvedAt)) : null,
    resolutionAction: h.resolutionAction,
    resolutionNotes: h.resolutionNotes,
    rejectionReason: h.rejectionReason,
    items: itemsByHeader.get(h.id) ?? [],
  }))
}
