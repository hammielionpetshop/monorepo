import { describe, expect, it } from "vitest";
import { describeStockShortage, findStockShortages } from "./bulk-sale-stock";

const PCS = { uomId: 1, uomCode: "PCS", conversionRate: 1 };
const DUS = { uomId: 3, uomCode: "DUS", conversionRate: 24 };
const uoms = [PCS, DUS];

function row(productId: number, uomId: number, qty: number) {
  return { productId, uomId, qty, availableUoms: uoms };
}

describe("findStockShortages", () => {
  it("menandai produk yang diminta melebihi sisa stok", () => {
    const shortages = findStockShortages([row(1, 1, 2)], new Map([[1, { stock: 1, baseUomCode: "PCS" }]]));

    expect(shortages.get(1)).toEqual({ productId: 1, neededBase: 2, stock: 1, baseUomCode: "PCS" });
  });

  it("tidak menandai bila qty pas sama dengan stok", () => {
    expect(findStockShortages([row(1, 1, 5)], new Map([[1, { stock: 5, baseUomCode: "PCS" }]])).size).toBe(0);
  });

  it("mengonversi satuan besar ke satuan dasar sebelum dibandingkan", () => {
    const shortages = findStockShortages([row(1, 3, 2)], new Map([[1, { stock: 30, baseUomCode: "PCS" }]]));

    expect(shortages.get(1)?.neededBase).toBe(48);
  });

  it("menjumlah baris DUS dan PCS untuk produk yang sama", () => {
    const stock = new Map([[1, { stock: 25, baseUomCode: "PCS" }]]);

    expect(findStockShortages([row(1, 3, 1)], stock).size).toBe(0);
    expect(findStockShortages([row(1, 3, 1), row(1, 1, 2)], stock).get(1)?.neededBase).toBe(26);
  });

  it("menandai stok minus walau qty diminta kecil", () => {
    expect(findStockShortages([row(1, 1, 1)], new Map([[1, { stock: -3, baseUomCode: "PCS" }]])).has(1)).toBe(true);
  });

  it("melewati produk yang stoknya belum termuat", () => {
    expect(findStockShortages([row(2, 1, 100)], new Map()).size).toBe(0);
  });
});

describe("describeStockShortage", () => {
  it("menyebut stok kosong bila sisa nol atau minus", () => {
    expect(describeStockShortage({ productId: 1, neededBase: 2, stock: 0, baseUomCode: "PCS" })).toBe(
      "Stok kosong (0 PCS), diminta 2 PCS",
    );
  });

  it("menyebut sisa dan permintaan bila stok masih ada", () => {
    expect(describeStockShortage({ productId: 1, neededBase: 2, stock: 1, baseUomCode: "PCS" })).toBe(
      "Stok kurang: sisa 1 PCS, diminta 2 PCS",
    );
  });
});
