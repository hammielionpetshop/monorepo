import { describe, expect, it } from "vitest";
import { hasUsablePrice, pickDefaultPriceOption, pricesForUom } from "./bulk-sale-pricing";
import type { BulkSaleProduct } from "./types";

const PCS = { uomId: 1, uomCode: "PCS", conversionRate: 1, weightGram: 100 };
const LSN = { uomId: 2, uomCode: "LUSIN", conversionRate: 12, weightGram: 1200 };
const DUS = { uomId: 3, uomCode: "DUS", conversionRate: 144, weightGram: 14400 };

function makeProduct(overrides: Partial<BulkSaleProduct> = {}): BulkSaleProduct {
  return {
    id: 1,
    code: "SKU-1",
    name: "Produk Uji",
    barcode: null,
    baseUomId: 1,
    baseUomCode: "PCS",
    stock: 10,
    availableUoms: [PCS, LSN, DUS],
    prices: [],
    ...overrides,
  };
}

describe("pricesForUom", () => {
  it("membuang harga 0 karena itu harga yang belum diisi, bukan gratis", () => {
    const prices = [
      { uomId: 1, priceTier: "RETAIL", price: 0 },
      { uomId: 1, priceTier: "GROSIR", price: 9000 },
      { uomId: 2, priceTier: "RETAIL", price: 100000 },
    ];

    expect(pricesForUom(prices, 1)).toEqual([{ uomId: 1, priceTier: "GROSIR", price: 9000 }]);
    expect(hasUsablePrice(prices, 1)).toBe(true);
  });

  it("menganggap satuan tanpa baris harga sebagai belum berharga", () => {
    expect(hasUsablePrice([{ uomId: 2, priceTier: "RETAIL", price: 5000 }], 1)).toBe(false);
  });
});

describe("pickDefaultPriceOption", () => {
  it("memakai satuan dasar bila harganya ada", () => {
    const product = makeProduct({
      prices: [
        { uomId: 2, priceTier: "RETAIL", price: 100000 },
        { uomId: 1, priceTier: "RETAIL", price: 9000 },
      ],
    });

    expect(pickDefaultPriceOption(product)).toEqual({
      price: { uomId: 1, priceTier: "RETAIL", price: 9000 },
      uom: PCS,
    });
  });

  it("jatuh ke satuan berharga terkecil bila satuan dasar belum punya harga", () => {
    const product = makeProduct({
      prices: [
        { uomId: 3, priceTier: "RETAIL", price: 1000000 },
        { uomId: 2, priceTier: "RETAIL", price: 100000 },
      ],
    });

    expect(pickDefaultPriceOption(product)?.uom).toEqual(LSN);
  });

  it("melewati satuan dasar yang harganya 0", () => {
    const product = makeProduct({
      prices: [
        { uomId: 1, priceTier: "RETAIL", price: 0 },
        { uomId: 2, priceTier: "RETAIL", price: 100000 },
      ],
    });

    expect(pickDefaultPriceOption(product)?.uom).toEqual(LSN);
  });

  it("mengabaikan harga pada satuan yang tidak punya konversi — server menolaknya", () => {
    const product = makeProduct({
      availableUoms: [PCS],
      prices: [{ uomId: 2, priceTier: "RETAIL", price: 100000 }],
    });

    expect(pickDefaultPriceOption(product)).toBeNull();
  });

  it("mengembalikan null bila semua satuan belum berharga", () => {
    expect(pickDefaultPriceOption(makeProduct({ prices: [{ uomId: 1, priceTier: "RETAIL", price: 0 }] }))).toBeNull();
  });
});
