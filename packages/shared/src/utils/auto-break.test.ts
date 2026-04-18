import { describe, it, expect } from 'vitest';
import { processSaleWithAutoBreak, StockState } from './auto-break';

describe('processSaleWithAutoBreak', () => {
  const defaultStock: StockState = {
    qtyBesar: 9,
    qtyKecil: 20,
    conversionRatio: 50, // 1 Sak = 50 Pcs
  };

  it('Case 1: Jual Pcs, stok kecil cukup (no break)', () => {
    const result = processSaleWithAutoBreak(defaultStock, 'kecil', 1);
    expect(result.success).toBe(true);
    expect(result.newStock.qtyBesar).toBe(9);
    expect(result.newStock.qtyKecil).toBe(19);
    expect(result.autoBreakTriggered).toBe(false);
  });

  it('Case 2: Jual Pcs, stok habis pas (no break)', () => {
    const result = processSaleWithAutoBreak(defaultStock, 'kecil', 20);
    expect(result.success).toBe(true);
    expect(result.newStock.qtyBesar).toBe(9);
    expect(result.newStock.qtyKecil).toBe(0);
    expect(result.autoBreakTriggered).toBe(false);
  });

  it('Case 3: Jual Pcs, butuh pecah 1 Sak (deficit < ratio)', () => {
    const result = processSaleWithAutoBreak(defaultStock, 'kecil', 25);
    // Deficit = 25 - 20 = 5. Break 1 Sak.
    // New Pcs = 20 + 50 - 25 = 45.
    expect(result.success).toBe(true);
    expect(result.newStock.qtyBesar).toBe(8);
    expect(result.newStock.qtyKecil).toBe(45);
    expect(result.autoBreakTriggered).toBe(true);
    expect(result.sacsBroken).toBe(1);
  });

  it('Case 4: Jual Pcs, butuh pecah 1 Sak (deficit == ratio)', () => {
    const result = processSaleWithAutoBreak(defaultStock, 'kecil', 70);
    // Deficit = 70 - 20 = 50. Break 1 Sak.
    // New Pcs = 20 + 50 - 70 = 0.
    expect(result.success).toBe(true);
    expect(result.newStock.qtyBesar).toBe(8);
    expect(result.newStock.qtyKecil).toBe(0);
    expect(result.sacsBroken).toBe(1);
  });

  it('Case 5: Jual Pcs, butuh pecah 2 Sak (ratio=30)', () => {
    const stock30 = { ...defaultStock, conversionRatio: 30 };
    const result = processSaleWithAutoBreak(stock30, 'kecil', 51);
    // Deficit = 51 - 20 = 31. Break CEIL(31/30) = 2 Sak.
    // New Sak = 9 - 2 = 7.
    // New Pcs = 20 + (2 * 30) - 51 = 20 + 60 - 51 = 29.
    expect(result.success).toBe(true);
    expect(result.newStock.qtyBesar).toBe(7);
    expect(result.newStock.qtyKecil).toBe(29);
    expect(result.autoBreakTriggered).toBe(true);
    expect(result.sacsBroken).toBe(2);
  });

  it('Case 6: Jual Pcs, stok total tidak cukup', () => {
    const result = processSaleWithAutoBreak(defaultStock, 'kecil', 500);
    // Total Pcs = 20 + (9 * 50) = 470. 500 > 470 -> FAIL.
    expect(result.success).toBe(false);
    expect(result.error).toContain('tidak mencukupi');
  });

  it('Case 7: Jual Sak langsung', () => {
    const result = processSaleWithAutoBreak(defaultStock, 'besar', 2);
    expect(result.success).toBe(true);
    expect(result.newStock.qtyBesar).toBe(7);
    expect(result.newStock.qtyKecil).toBe(20);
    expect(result.autoBreakTriggered).toBe(false);
  });

  it('Case 8: Jual Sak stok tidak cukup', () => {
    const result = processSaleWithAutoBreak(defaultStock, 'besar', 10);
    expect(result.success).toBe(false);
    expect(result.error).toContain('UOM Besar tidak mencukupi');
  });
});
