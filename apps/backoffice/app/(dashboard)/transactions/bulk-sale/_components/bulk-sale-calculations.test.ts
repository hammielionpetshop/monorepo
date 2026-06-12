import { describe, expect, it } from "vitest";
import { calculateBulkSaleTotals, calculateRowSubtotal } from "./bulk-sale-calculations";
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
      grandTotal: 37000,
      amountPaid: 50000,
      change: 13000,
      itemCount: 4,
    });
  });
});
