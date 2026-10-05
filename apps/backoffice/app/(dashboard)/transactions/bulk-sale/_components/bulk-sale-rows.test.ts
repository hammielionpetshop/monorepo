import { describe, expect, it } from "vitest";
import { applyTierToRows, incrementRowQty, mergeDuplicateRows } from "./bulk-sale-rows";
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

describe("applyTierToRows", () => {
  const prices = [
    { uomId: 1, priceTier: "RETAIL", price: 6000 },
    { uomId: 1, priceTier: "RESELLER", price: 5000 },
    { uomId: 1, priceTier: "GROSIR", price: 4500 },
  ];

  it("menghargai ulang baris ke tier terpilih, termasuk menimpa harga custom", () => {
    const [next] = applyTierToRows([row({ availablePrices: prices, unitPrice: 5200, subtotal: 10400 })], "GROSIR");
    expect(next).toMatchObject({ priceTier: "GROSIR", unitPrice: 4500, subtotal: 9000 });
  });

  it("membiarkan baris yang satuannya tidak punya harga di tier itu", () => {
    const untouched = row({ id: "2", productId: 11, availablePrices: [{ uomId: 1, priceTier: "RETAIL", price: 7000 }] });
    expect(applyTierToRows([untouched], "GROSIR")[0]).toEqual(untouched);
  });

  it("memangkas diskon item yang melebihi bruto baru", () => {
    const [next] = applyTierToRows([row({ availablePrices: prices, qty: 1, unitPrice: 6000, discountAmount: 5000, subtotal: 1000 })], "GROSIR");
    expect(next).toMatchObject({ discountAmount: 4500, subtotal: 0 });
  });

  it("menggabung baris yang jadi kembar setelah tier diseragamkan", () => {
    const merged = applyTierToRows(
      [
        row({ id: "1", priceTier: "RETAIL", unitPrice: 6000, availablePrices: prices }),
        row({ id: "2", priceTier: "RESELLER", availablePrices: prices, qty: 3 }),
      ],
      "GROSIR",
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ qty: 5, unitPrice: 4500, subtotal: 22500 });
  });
});
