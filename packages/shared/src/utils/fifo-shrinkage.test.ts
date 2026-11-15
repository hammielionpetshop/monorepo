import { describe, it, expect } from 'vitest';
import { calculateFIFOCost } from './fifo-shrinkage';

describe('calculateFIFOCost', () => {
  it('should return 0 when absVarianceQty is 0', () => {
    const batches = [{ id: 1, qty: 10, costPrice: 1000 }];
    const result = calculateFIFOCost(batches, 0);
    
    expect(result.totalCost).toBe(0);
    expect(result.batchesUsed.length).toBe(0);
  });

  it('should deduct completely from the first batch if sufficient', () => {
    const batches = [
      { id: 1, qty: 10, costPrice: 1000 },
      { id: 2, qty: 20, costPrice: 1200 }
    ];
    
    const result = calculateFIFOCost(batches, 5);
    
    expect(result.totalCost).toBe(5000); // 5 * 1000
    expect(result.batchesUsed).toEqual([
      { batchId: 1, qtyUsed: 5, costPrice: 1000, subtotal: 5000 }
    ]);
  });

  it('should span multiple batches if needed', () => {
    const batches = [
      { id: 1, qty: 5, costPrice: 1000 },
      { id: 2, qty: 10, costPrice: 1200 },
      { id: 3, qty: 20, costPrice: 1500 }
    ];
    
    const result = calculateFIFOCost(batches, 12);
    
    // batch 1: 5 * 1000 = 5000
    // batch 2: 7 * 1200 = 8400
    // total: 13400
    expect(result.totalCost).toBe(13400);
    expect(result.batchesUsed).toEqual([
      { batchId: 1, qtyUsed: 5, costPrice: 1000, subtotal: 5000 },
      { batchId: 2, qtyUsed: 7, costPrice: 1200, subtotal: 8400 }
    ]);
  });

  it('should skip batches with zero or negative qty', () => {
    const batches = [
      { id: 1, qty: 0, costPrice: 1000 },
      { id: 2, qty: -5, costPrice: 1100 },
      { id: 3, qty: 5, costPrice: 1200 }
    ];
    
    const result = calculateFIFOCost(batches, 3);
    
    expect(result.totalCost).toBe(3600); // 3 * 1200
    expect(result.batchesUsed).toEqual([
      { batchId: 3, qtyUsed: 3, costPrice: 1200, subtotal: 3600 }
    ]);
  });

  it('should stop when batches are exhausted even if remaining is > 0', () => {
     // Estimasi terbaik adalah sebatas qty di table
     const batches = [
      { id: 1, qty: 5, costPrice: 1000 }
    ];
    
    const result = calculateFIFOCost(batches, 10);
    
    expect(result.totalCost).toBe(5000);
    expect(result.batchesUsed).toEqual([
      { batchId: 1, qtyUsed: 5, costPrice: 1000, subtotal: 5000 }
    ]);
  });
});
