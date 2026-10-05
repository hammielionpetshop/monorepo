import { describe, expect, it } from "vitest";
import {
  compareTier,
  hasUsablePrice,
  internalRetailWarning,
  pickDefaultPriceOption,
  pickInternalDefaultPriceOption,
  pickInternalTierPrice,
  pickTierPrice,
  pricesForUom,
} from "./bulk-sale-pricing";
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

  it("mengurutkan tier RETAIL, RESELLER, GROSIR apa pun urutan dari DB", () => {
    const prices = [
      { uomId: 1, priceTier: "GROSIR", price: 8000 },
      { uomId: 1, priceTier: "RESELLER", price: 9000 },
      { uomId: 1, priceTier: "RETAIL", price: 10000 },
    ];

    expect(pricesForUom(prices, 1).map((price) => price.priceTier)).toEqual(["RETAIL", "RESELLER", "GROSIR"]);
  });

  it("menaruh tier di luar daftar baku setelahnya, urut abjad", () => {
    expect(["PLATINUM", "GROSIR", "AGEN", "RETAIL"].sort(compareTier)).toEqual(["RETAIL", "GROSIR", "AGEN", "PLATINUM"]);
  });

  it("menganggap satuan tanpa baris harga sebagai belum berharga", () => {
    expect(hasUsablePrice([{ uomId: 2, priceTier: "RETAIL", price: 5000 }], 1)).toBe(false);
  });
});

describe("pickDefaultPriceOption", () => {
  it("memakai satuan terbesar yang berharga walau satuan dasar juga berharga", () => {
    const product = makeProduct({
      prices: [
        { uomId: 1, priceTier: "RETAIL", price: 9000 },
        { uomId: 2, priceTier: "RETAIL", price: 100000 },
        { uomId: 3, priceTier: "RETAIL", price: 1000000 },
      ],
    });

    expect(pickDefaultPriceOption(product)).toEqual({
      price: { uomId: 3, priceTier: "RETAIL", price: 1000000 },
      uom: DUS,
    });
  });

  it("turun ke satuan berharga di bawahnya bila satuan terbesar belum punya harga", () => {
    const product = makeProduct({
      prices: [
        { uomId: 1, priceTier: "RETAIL", price: 9000 },
        { uomId: 2, priceTier: "RETAIL", price: 100000 },
        { uomId: 3, priceTier: "RETAIL", price: 0 },
      ],
    });

    expect(pickDefaultPriceOption(product)?.uom).toEqual(LSN);
  });

  it("baru memakai satuan dasar bila hanya satuan itu yang berharga", () => {
    const product = makeProduct({ prices: [{ uomId: 1, priceTier: "RETAIL", price: 9000 }] });

    expect(pickDefaultPriceOption(product)?.uom).toEqual(PCS);
  });

  it("tidak bergantung pada urutan satuan dari DB", () => {
    const product = makeProduct({
      availableUoms: [PCS, DUS, LSN],
      prices: [
        { uomId: 2, priceTier: "RETAIL", price: 100000 },
        { uomId: 3, priceTier: "RETAIL", price: 1000000 },
      ],
    });

    expect(pickDefaultPriceOption(product)?.uom).toEqual(DUS);
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

describe("pickTierPrice", () => {
  const prices = [
    { uomId: 1, priceTier: "RETAIL", price: 10000 },
    { uomId: 1, priceTier: "GROSIR", price: 8000 },
    { uomId: 1, priceTier: "RESELLER", price: 7000 },
  ];

  it("memakai tier yang diminta bila tersedia — bukan harga pertama yang kebetulan terbaca", () => {
    expect(pickTierPrice(prices, 1, "GROSIR")).toEqual({ uomId: 1, priceTier: "GROSIR", price: 8000 });
  });

  it("jatuh ke harga pertama bila tier yang diminta tidak tersedia untuk satuan itu", () => {
    expect(pickTierPrice(prices, 1, "PLATINUM")).toEqual({ uomId: 1, priceTier: "RETAIL", price: 10000 });
  });

  it("jatuh ke harga pertama bila tidak ada tier yang diminta (null/undefined)", () => {
    expect(pickTierPrice(prices, 1, null)).toEqual({ uomId: 1, priceTier: "RETAIL", price: 10000 });
    expect(pickTierPrice(prices, 1)).toEqual({ uomId: 1, priceTier: "RETAIL", price: 10000 });
  });

  it("mengembalikan null bila satuan itu sama sekali belum berharga", () => {
    expect(pickTierPrice(prices, 2, "GROSIR")).toBeNull();
  });
});

describe("pickInternalTierPrice — PO Internal (kanban #43)", () => {
  it("memakai GROSIR bila tersedia", () => {
    const prices = [
      { uomId: 1, priceTier: "RETAIL", price: 10000 },
      { uomId: 1, priceTier: "RESELLER", price: 9000 },
      { uomId: 1, priceTier: "GROSIR", price: 8000 },
    ];
    expect(pickInternalTierPrice(prices, 1)?.priceTier).toBe("GROSIR");
  });

  it("turun satu level ke RESELLER bila GROSIR belum diisi (harga 0 = belum diisi)", () => {
    const prices = [
      { uomId: 1, priceTier: "RETAIL", price: 10000 },
      { uomId: 1, priceTier: "RESELLER", price: 9000 },
      { uomId: 1, priceTier: "GROSIR", price: 0 },
    ];
    expect(pickInternalTierPrice(prices, 1)?.priceTier).toBe("RESELLER");
  });

  it("RETAIL hanya bila GROSIR & RESELLER sama-sama tidak ada", () => {
    expect(pickInternalTierPrice([{ uomId: 1, priceTier: "RETAIL", price: 10000 }], 1)?.priceTier).toBe("RETAIL");
  });

  it("null bila satuan itu belum berharga sama sekali", () => {
    expect(pickInternalTierPrice([{ uomId: 2, priceTier: "GROSIR", price: 5000 }], 1)).toBeNull();
  });

  it("produk baru di PO Internal: satuan terbesar berharga, tier termurah", () => {
    const product = makeProduct({
      prices: [
        { uomId: 3, priceTier: "RETAIL", price: 1000000 },
        { uomId: 3, priceTier: "RESELLER", price: 950000 },
        { uomId: 1, priceTier: "GROSIR", price: 6000 },
      ],
    });
    const picked = pickInternalDefaultPriceOption(product);
    expect(picked?.uom.uomCode).toBe("DUS");
    expect(picked?.price.priceTier).toBe("RESELLER");
  });
});

describe("internalRetailWarning", () => {
  it("tidak ada peringatan untuk tier selain RETAIL", () => {
    expect(internalRetailWarning([{ uomId: 1, priceTier: "GROSIR", price: 8000 }], 1, "GROSIR")).toBeNull();
  });

  it("RETAIL karena GROSIR/RESELLER belum diisi", () => {
    expect(internalRetailWarning([{ uomId: 1, priceTier: "RETAIL", price: 10000 }], 1, "RETAIL")).toMatch(/GROSIR\/RESELLER kosong/);
  });

  it("RETAIL dipilih manual padahal ada yang lebih murah", () => {
    const prices = [
      { uomId: 1, priceTier: "RETAIL", price: 10000 },
      { uomId: 1, priceTier: "GROSIR", price: 8000 },
    ];
    expect(internalRetailWarning(prices, 1, "RETAIL")).toBe("ada GROSIR lebih murah");
  });
});
