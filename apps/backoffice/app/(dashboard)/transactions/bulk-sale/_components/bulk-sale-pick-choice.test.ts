import { describe, expect, it } from "vitest";
import {
  changeChoiceUom,
  defaultPickChoice,
  parsePickQty,
  pricedUoms,
  resolvePickChoice,
} from "./bulk-sale-pick-choice";
import type { BulkSaleProduct } from "./types";

const PCS = { uomId: 1, uomCode: "PCS", conversionRate: 1 };
const DUS = { uomId: 3, uomCode: "DUS", conversionRate: 24 };

const product: BulkSaleProduct = {
  id: 7,
  code: "SKU-7",
  name: "Produk Uji",
  barcode: null,
  baseUomId: 1,
  baseUomCode: "PCS",
  stock: 100,
  availableUoms: [PCS, DUS],
  prices: [
    { uomId: 1, priceTier: "RETAIL", price: 5000 },
    { uomId: 1, priceTier: "GROSIR", price: 4500 },
    { uomId: 3, priceTier: "RETAIL", price: 115000 },
  ],
};

describe("defaultPickChoice", () => {
  it("bawaan = satuan terbesar yang berharga, qty 1", () => {
    expect(defaultPickChoice(product, false)).toEqual({ uomId: 3, priceTier: "RETAIL", qty: 1 });
  });

  it("tanpa harga sama sekali → null", () => {
    expect(defaultPickChoice({ ...product, prices: [] }, false)).toBeNull();
  });
});

describe("changeChoiceUom", () => {
  it("tier lama dipertahankan bila satuan baru punya harganya", () => {
    const next = changeChoiceUom(product, { uomId: 3, priceTier: "RETAIL", qty: 4 }, 1, false);
    expect(next).toEqual({ uomId: 1, priceTier: "RETAIL", qty: 4 });
  });

  it("tier lama tak tersedia → jatuh ke tier yang ada", () => {
    const next = changeChoiceUom(product, { uomId: 1, priceTier: "GROSIR", qty: 2 }, 3, false);
    expect(next).toEqual({ uomId: 3, priceTier: "RETAIL", qty: 2 });
  });

  it("PO Internal jatuh ke tier termurah (GROSIR)", () => {
    const next = changeChoiceUom(product, { uomId: 3, priceTier: "RETAIL", qty: 1 }, 1, true);
    expect(next.priceTier).toBe("RETAIL");
    const fromMissing = changeChoiceUom(product, { uomId: 3, priceTier: "RESELLER", qty: 1 }, 1, true);
    expect(fromMissing.priceTier).toBe("GROSIR");
  });

  it("satuan tanpa harga tidak mengubah pilihan", () => {
    const choice = { uomId: 3, priceTier: "RETAIL", qty: 1 };
    expect(changeChoiceUom(product, choice, 99, false)).toBe(choice);
  });
});

describe("pricedUoms & resolvePickChoice", () => {
  it("hanya satuan berharga yang ditawarkan", () => {
    expect(pricedUoms({ ...product, prices: product.prices.filter((p) => p.uomId === 1) }).map((u) => u.uomCode)).toEqual(["PCS"]);
  });

  it("pilihan valid → satuan & harga; tier tak ada → null", () => {
    expect(resolvePickChoice(product, { uomId: 1, priceTier: "GROSIR", qty: 1 })?.price.price).toBe(4500);
    expect(resolvePickChoice(product, { uomId: 3, priceTier: "GROSIR", qty: 1 })).toBeNull();
  });
});

describe("parsePickQty", () => {
  it("bilangan bulat ≥ 1 diterima", () => {
    expect(parsePickQty("5")).toBe(5);
    expect(parsePickQty(" 12 ")).toBe(12);
  });

  it("kosong, nol, minus, pecahan ditolak", () => {
    for (const value of ["", "0", "-1", "1.5", "abc"]) expect(parsePickQty(value)).toBeNull();
  });
});
