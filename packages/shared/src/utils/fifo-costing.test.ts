import { describe, it, expect } from 'vitest';
import { fifoDeduct, StockBatch } from './fifo-costing';

describe('fifoDeduct', () => {
  const date1 = new Date('2026-01-01');
  const date2 = new Date('2026-01-05');
  const date3 = new Date('2026-01-10');

  const sampleBatches: StockBatch[] = [
    { batchId: 1, qtyRemaining: 10, costPrice: 1000, receivedAt: date1 },
    { batchId: 2, qtyRemaining: 20, costPrice: 1100, receivedAt: date2 },
    { batchId: 3, qtyRemaining: 30, costPrice: 1050, receivedAt: date3 },
  ];

  it('Case 1: Single batch, qty cukup', () => {
    const result = fifoDeduct(sampleBatches, 5);
    expect(result.success).toBe(true);
    expect(result.deductions).toHaveLength(1);
    expect(result.deductions[0]).toMatchObject({
      batchId: 1,
      qtyDeducted: 5,
      costPrice: 1000,
      totalCost: 5000,
    });
    expect(result.totalCogs).toBe(5000);
    expect(result.batchesAfter[0].qtyRemaining).toBe(5);
    expect(result.batchesAfter[1].qtyRemaining).toBe(20);
  });

  it('Case 2: Single batch, qty habis pas', () => {
    const result = fifoDeduct(sampleBatches, 10);
    expect(result.success).toBe(true);
    expect(result.deductions).toHaveLength(1);
    expect(result.batchesAfter[0].qtyRemaining).toBe(0);
    expect(result.totalCogs).toBe(10000);
  });

  it('Case 3: Multi-batch, span 2 batches', () => {
    const result = fifoDeduct(sampleBatches, 15);
    // Batch 1: 10 * 1000 = 10000
    // Batch 2: 5 * 1100 = 5500
    // Total COGS = 15500
    expect(result.success).toBe(true);
    expect(result.deductions).toHaveLength(2);
    expect(result.totalCogs).toBe(15500);
    expect(result.batchesAfter[0].qtyRemaining).toBe(0);
    expect(result.batchesAfter[1].qtyRemaining).toBe(15);
    expect(result.batchesAfter[2].qtyRemaining).toBe(30);
  });

  it('Case 4: Multi-batch, 3+ batches', () => {
    const result = fifoDeduct(sampleBatches, 40);
    // Batch 1: 10 * 1000 = 10000
    // Batch 2: 20 * 1100 = 22000
    // Batch 3: 10 * 1050 = 10500
    // Total COGS = 42500
    expect(result.success).toBe(true);
    expect(result.deductions).toHaveLength(3);
    expect(result.totalCogs).toBe(42500);
    expect(result.batchesAfter[0].qtyRemaining).toBe(0);
    expect(result.batchesAfter[1].qtyRemaining).toBe(0);
    expect(result.batchesAfter[2].qtyRemaining).toBe(20);
  });

  it('Case 5: Qty melebihi total stock', () => {
    const result = fifoDeduct(sampleBatches, 100);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Stok tidak cukup');
  });

  it('Case 6: Empty batches', () => {
    const result = fifoDeduct([], 10);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Stok tidak cukup');
  });

  it('Case 7: Qty Zero', () => {
    const result = fifoDeduct(sampleBatches, 0);
    expect(result.success).toBe(true);
    expect(result.deductions).toHaveLength(0);
    expect(result.totalCogs).toBe(0);
  });
});
