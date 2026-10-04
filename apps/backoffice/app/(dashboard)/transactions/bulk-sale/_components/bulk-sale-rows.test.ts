import { describe, expect, it } from "vitest";
import { incrementRowQty, mergeDuplicateRows } from "./bulk-sale-rows";
import type { BulkSaleRow } from "./types";

const row = (over: Partial<BulkSaleRow> = {}): BulkSaleRow => ({
  id: "1",
  productId: 10,
  productCode: "P10",
  productName: "WHISKAS JUNIOR",
  uomId: 1,
  uomCode: "PCS",
  availableUoms: [],
  priceTier: "RESELLER",
  availablePrices: [],
  qty: 2,
  unitPrice: 5000,
  discountAmount: 0,
  subtotal: 10000,
  ...over,
});

describe("incrementRowQty", () => {
  it("menambah qty dan menghitung ulang subtotal dengan diskon item", () => {
    const next = incrementRowQty(row({ discountAmount: 1000, subtotal: 9000 }));
    expect(next.qty).toBe(3);
    expect(next.subtotal).toBe(14000);
  });
});

describe("mergeDuplicateRows", () => {
  it("menggabung produk + satuan + tier yang sama ke baris pertama", () => {
    const merged = mergeDuplicateRows([
      row({ id: "1", qty: 2 }),
      row({ id: "2", productId: 20, productName: "BOLT" }),
      row({ id: "3", qty: 5, discountAmount: 500 }),
    ]);
    expect(merged.map((r) => r.id)).toEqual(["1", "2"]);
    expect(merged[0].qty).toBe(7);
    expect(merged[0].discountAmount).toBe(500);
    expect(merged[0].subtotal).toBe(34500);
  });

  it("satuan atau tier berbeda tetap baris terpisah", () => {
    const merged = mergeDuplicateRows([
      row({ id: "1" }),
      row({ id: "2", uomId: 2, uomCode: "SAK" }),
      row({ id: "3", priceTier: "RETAIL" }),
    ]);
    expect(merged).toHaveLength(3);
  });

  it("tidak mengubah daftar tanpa kembar", () => {
    const rows = [row({ id: "1" }), row({ id: "2", productId: 20 })];
    expect(mergeDuplicateRows(rows)).toEqual(rows);
  });
});
