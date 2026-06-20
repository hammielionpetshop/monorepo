/**
 * FIFO Costing Engine
 * Logic to deduct quantity from stock batches based on First-In-First-Out principle.
 */

export interface StockBatch {
  batchId: number;
  qtyRemaining: number; // In base UOM
  costPrice: number;     // Cost per base UOM
  receivedAt: Date;
}

export interface FifoDeductionResult {
  success: boolean;
  deductions: Array<{
    batchId: number;
    qtyDeducted: number;
    costPrice: number;
    totalCost: number;
  }>;
  totalCogs: number;     // Sum of all deduction costs
  batchesAfter: StockBatch[]; // Updated batches
  shortfallQty: number;  // Qty yang tidak tertutup batch (oversell) — dalam base UOM
  error?: string;
}

/**
 * Deducts quantity from batches using FIFO.
 *
 * @param batches Current stock batches
 * @param qtyToDeduct Quantity to deduct (in base UOM)
 * @param allowNegative Jika true, kekurangan stok tidak menggagalkan deduction;
 *   semua batch dikuras dan sisa kekurangan dikembalikan via `shortfallQty`.
 * @returns Deduction results and updated batches
 */
export function fifoDeduct(
  batches: StockBatch[],
  qtyToDeduct: number,
  allowNegative = false
): FifoDeductionResult {
  if (qtyToDeduct <= 0) {
    return {
      success: true,
      deductions: [],
      totalCogs: 0,
      batchesAfter: batches.map(b => ({ ...b })),
      shortfallQty: 0,
    };
  }

  // Sort batches by receivedAt ASC (Oldest first)
  const sortedBatches = [...batches].sort(
    (a, b) => a.receivedAt.getTime() - b.receivedAt.getTime()
  );

  const totalAvailable = sortedBatches.reduce((sum, b) => sum + b.qtyRemaining, 0);
  if (totalAvailable < qtyToDeduct && !allowNegative) {
    return {
      success: false,
      deductions: [],
      totalCogs: 0,
      batchesAfter: batches.map(b => ({ ...b })),
      shortfallQty: qtyToDeduct - totalAvailable,
      error: `Stok tidak cukup. Dibutuhkan ${qtyToDeduct}, tersedia ${totalAvailable}.`,
    };
  }

  const deductions = [];
  let remainingToDeduct = qtyToDeduct;
  let totalCogs = 0;
  const batchesAfter = [];

  for (const batch of sortedBatches) {
    if (remainingToDeduct <= 0) {
      batchesAfter.push({ ...batch });
      continue;
    }

    if (batch.qtyRemaining <= 0) {
      batchesAfter.push({ ...batch });
      continue;
    }

    const take = Math.min(batch.qtyRemaining, remainingToDeduct);
    const cost = take * batch.costPrice;

    deductions.push({
      batchId: batch.batchId,
      qtyDeducted: take,
      costPrice: batch.costPrice,
      totalCost: cost,
    });

    totalCogs += cost;
    remainingToDeduct -= take;

    batchesAfter.push({
      ...batch,
      qtyRemaining: batch.qtyRemaining - take,
    });
  }

  return {
    success: true,
    deductions,
    totalCogs,
    batchesAfter,
    shortfallQty: remainingToDeduct > 0 ? remainingToDeduct : 0,
  };
}
