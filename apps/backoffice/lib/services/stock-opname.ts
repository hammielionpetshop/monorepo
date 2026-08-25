import {
  db,
  sql,
  eq,
  and,
  asc,
  productStocks,
  productStockBatches,
  productUomConversions,
  stockOpnames,
  stockOpnameItems,
} from '@/lib/db'
import { calculateFIFOCost } from '@petshop/shared/utils/fifo-shrinkage'

type DbOrTrx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Status per-item hanya berarti untuk SO Besar (type='FULL') — SO Harian tetap
 * disetujui satu header sekaligus, jadi kolomnya NULL di sana. varianceQty 0 selesai
 * otomatis (MATCHED); selain itu menunggu keputusan admin (PENDING).
 */
export function resolveItemStatus(soType: string, varianceQty: number): 'MATCHED' | 'PENDING' | null {
  if (soType !== 'FULL') return null
  return varianceQty === 0 ? 'MATCHED' : 'PENDING'
}

/**
 * Tutup SO Besar otomatis begitu tidak ada item PENDING tersisa — dipanggil dari
 * mana pun sebuah item bisa berpindah keluar dari PENDING (keputusan admin di
 * /items/decide, atau hitung ulang yang ternyata pas di /items/[itemId]/recount).
 * Satu tempat supaya syarat "kapan SO Besar selesai" tidak menyimpang antar jalur.
 */
export async function closeFullSoIfResolved(
  tx: DbOrTrx,
  soId: number,
  closedById: number
): Promise<boolean> {
  const remaining = await tx
    .select({ id: stockOpnameItems.id })
    .from(stockOpnameItems)
    .where(and(eq(stockOpnameItems.soId, soId), eq(stockOpnameItems.itemStatus, 'PENDING')))
    .limit(1)

  if (remaining.length > 0) return false

  const now = new Date()
  await tx
    .update(stockOpnames)
    .set({ status: 'APPROVED', approvedById: closedById, approvedAt: now, completedAt: now })
    .where(eq(stockOpnames.id, soId))

  return true
}

export interface VarianceInput {
  productId: number
  uomId: number
  physicalQty: number
  /**
   * systemQty hasil snapshot saat kasir menghitung (dari token bertanda tangan server).
   * Wajib diisi bila stok bisa bergerak antara menghitung dan submit — tanpa ini,
   * penjualan di sela hitung→submit memunculkan selisih palsu.
   */
  systemQtyOverride?: number
}

export interface VarianceResult {
  productId: number
  uomId: number
  systemQty: number
  physicalQty: number
  varianceQty: number
  varianceCostValue: number
}

/**
 * Baca systemQty produk saat ini, diagregasi dari seluruh UOM stok dan dikonversi
 * ke `uomId`. Mengembalikan rasio UOM juga karena pemanggil membutuhkannya untuk
 * mengonversi selisih ke base UOM.
 */
export async function readSystemQty(
  executor: DbOrTrx,
  branchId: number,
  productId: number,
  uomId: number
): Promise<{ systemQty: number; itemUomRatio: number }> {
  const allStocks = await executor
    .select({
      uomId: productStocks.uomId,
      qty: productStocks.qty,
      ratio: productUomConversions.ratio,
    })
    .from(productStocks)
    .leftJoin(
      productUomConversions,
      and(
        eq(productUomConversions.productId, productStocks.productId),
        eq(productUomConversions.uomId, productStocks.uomId)
      )
    )
    .where(
      and(
        eq(productStocks.productId, productId),
        eq(productStocks.branchId, Number(branchId))
      )
    )

  const [itemConv] = await executor
    .select({ ratio: productUomConversions.ratio })
    .from(productUomConversions)
    .where(
      and(
        eq(productUomConversions.productId, productId),
        eq(productUomConversions.uomId, uomId)
      )
    )
    .limit(1)

  const itemUomRatio = itemConv?.ratio ?? 1
  const totalBaseQty = allStocks.reduce(
    (sum: number, s: { qty: unknown; ratio: number | null }) =>
      sum + Number(s.qty) * (s.ratio ?? 1),
    0
  )

  return { systemQty: Math.floor(totalBaseQty / itemUomRatio), itemUomRatio }
}

/**
 * Hitung selisih stok untuk satu item SO tanpa menyimpan apa pun.
 * systemQty diambil dari `item.systemQtyOverride` (snapshot saat menghitung) bila ada,
 * selain itu dibaca dari stok saat ini.
 * varianceCostValue dihitung FIFO bila ada selisih.
 */
export async function computeItemVariance(
  executor: DbOrTrx,
  branchId: number,
  item: VarianceInput
): Promise<VarianceResult> {
  const { systemQty: currentSystemQty, itemUomRatio } = await readSystemQty(
    executor,
    branchId,
    item.productId,
    item.uomId
  )
  const systemQty = item.systemQtyOverride ?? currentSystemQty
  const physicalQty = parseFloat(String(item.physicalQty))
  const varianceQty = physicalQty - systemQty

  let varianceCostValue = 0
  if (varianceQty !== 0) {
    const allBatches = await executor
      .select({
        id: productStockBatches.id,
        qtyRemaining: productStockBatches.qtyRemaining,
        costPrice: productStockBatches.costPrice,
        receivedAt: productStockBatches.receivedAt,
        ratio: productUomConversions.ratio,
      })
      .from(productStockBatches)
      .leftJoin(
        productUomConversions,
        and(
          eq(productUomConversions.productId, productStockBatches.productId),
          eq(productUomConversions.uomId, productStockBatches.uomId)
        )
      )
      .where(
        and(
          eq(productStockBatches.productId, item.productId),
          eq(productStockBatches.branchId, Number(branchId)),
          sql`${productStockBatches.qtyRemaining} > 0`
        )
      )
      .orderBy(asc(productStockBatches.receivedAt))

    const mappedBatches = allBatches.map(
      (b: { id: number; qtyRemaining: unknown; costPrice: unknown; ratio: number | null }) => {
        const r = b.ratio ?? 1
        return {
          id: b.id,
          qty: Number(b.qtyRemaining) * r,
          costPrice: r > 1 ? Number(b.costPrice) / r : Number(b.costPrice),
        }
      }
    )

    const varianceBase = Math.abs(varianceQty) * itemUomRatio
    const fifoResult = calculateFIFOCost(mappedBatches, varianceBase)
    varianceCostValue = Math.round(fifoResult.totalCost)
  }

  return {
    productId: item.productId,
    uomId: item.uomId,
    systemQty: Math.round(systemQty),
    physicalQty: Math.round(physicalQty),
    varianceQty: Math.round(varianceQty),
    varianceCostValue,
  }
}
