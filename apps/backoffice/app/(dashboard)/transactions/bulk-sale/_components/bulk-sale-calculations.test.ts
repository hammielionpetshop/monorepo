import { describe, expect, it } from "vitest";
import { allocateTransactionDiscount, calculateBulkSaleTotals, calculateRowSubtotal } from "./bulk-sale-calculations";
import type { BulkSaleRow } from "./types";

function row(overrides: Partial<BulkSaleRow> = {}): BulkSaleRow {
  return {
    id: "row-1",
    productId: 1,
    productCode: "SKU-1",
    productName: "Produk A",
    uomId: 1,
    uomCode: "PCS",
    availableUoms: [{ uomId: 1, uomCode: "PCS", conversionRate: 1 }],
    priceTier: "RETAIL",
    availablePrices: [{ uomId: 1, priceTier: "RETAIL", price: 10000 }],
    qty: 2,
    unitPrice: 10000,
    discountAmount: 3000,
    subtotal: 17000,
    ...overrides,
  };
}

describe("bulk sale calculations", () => {
  it("calculates row subtotal with nominal discount", () => {
    expect(calculateRowSubtotal({ qty: 2, unitPrice: 10000, discountAmount: 3000 })).toBe(17000);
  });

  it("rejects discount greater than gross row amount", () => {
    expect(() =>
      calculateRowSubtotal({ qty: 2, unitPrice: 10000, discountAmount: 25000 }),
    ).toThrow("Diskon tidak boleh lebih besar dari subtotal bruto");
  });

  it("calculates transaction totals and change", () => {
    expect(calculateBulkSaleTotals([row(), row({ id: "row-2", discountAmount: 0, subtotal: 20000 })], 50000)).toEqual({
      subtotal: 40000,
      discountTotal: 3000,
      transactionDiscount: 0,
      grandTotal: 37000,
      amountPaid: 50000,
      change: 13000,
      itemCount: 4,
    });
  });

  it("applies nominal transaction discount on top of item discount", () => {
    const rows = [row(), row({ id: "row-2", discountAmount: 0, subtotal: 20000 })];
    expect(calculateBulkSaleTotals(rows, 40000, 5000)).toEqual({
      subtotal: 40000,
      discountTotal: 3000,
      transactionDiscount: 5000,
      grandTotal: 32000,
      amountPaid: 40000,
      change: 8000,
      itemCount: 4,
    });
  });

  it("clamps transaction discount to net amount after item discount", () => {
    const totals = calculateBulkSaleTotals([row()], 0, 999999);
    // gross 20000 - item discount 3000 = 17000 max
    expect(totals.transactionDiscount).toBe(17000);
    expect(totals.grandTotal).toBe(0);
  });

  it("allocates transaction discount proportionally and sums exactly", () => {
    const rows = [
      { qty: 1, unitPrice: 10000, discountAmount: 0 },
      { qty: 1, unitPrice: 20000, discountAmount: 0 },
    ];
    const result = allocateTransactionDiscount(rows, 3000);
    // proportional to net 10000:20000 → 1000 : 2000
    expect(result).toEqual([1000, 2000]);
    expect(result[0] + result[1]).toBe(3000);
  });

  it("distributes rounding remainder without exceeding any row gross", () => {
    const rows = [
      { qty: 1, unitPrice: 100, discountAmount: 0 },
      { qty: 1, unitPrice: 100, discountAmount: 0 },
      { qty: 1, unitPrice: 100, discountAmount: 0 },
    ];
    const result = allocateTransactionDiscount(rows, 10);
    expect(result.reduce((sum, value) => sum + value, 0)).toBe(10);
    result.forEach((value) => expect(value).toBeLessThanOrEqual(100));
  });

  it("keeps existing item discounts when no transaction discount", () => {
    const rows = [{ qty: 2, unitPrice: 10000, discountAmount: 3000 }];
    expect(allocateTransactionDiscount(rows, 0)).toEqual([3000]);
  });
});
