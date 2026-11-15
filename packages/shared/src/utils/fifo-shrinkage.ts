export interface BatchUsage {
  batchId: number;
  qtyUsed: number;
  costPrice: number;
  subtotal: number;
}

/**
 * Menghitung nilai HPP(Cost) untuk qty selisih (shrinkage/minus) berdasarkan batch FIFO
 * @param batches list of batches, MUST BE SORTED by receivedDate ASC
 * @param absVarianceQty nilai absolute dari selisih qty (selalu positif)
 */
export function calculateFIFOCost(
  batches: { id: number; qty: number; costPrice: number }[],
  absVarianceQty: number
): { totalCost: number; batchesUsed: BatchUsage[] } {
  if (absVarianceQty <= 0) {
    return { totalCost: 0, batchesUsed: [] };
  }

  let remaining = absVarianceQty;
  let totalCost = 0;
  const batchesUsed: BatchUsage[] = [];

  for (const batch of batches) {
    if (remaining <= 0) break;
    
    // Walaupun ada batch qty negative, kita abaikan saja.
    if (batch.qty <= 0) continue;

    const qtyToTake = Math.min(batch.qty, remaining);
    const subtotal = qtyToTake * batch.costPrice;
    
    batchesUsed.push({
      batchId: batch.id,
      qtyUsed: qtyToTake,
      costPrice: batch.costPrice,
      subtotal
    });
    
    totalCost += subtotal;
    remaining -= qtyToTake;
  }

  return { totalCost, batchesUsed };
}
