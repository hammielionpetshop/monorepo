import { describe, expect, it } from "vitest";
import {
  MAX_BULK_SALE_DRAFTS,
  parseDrafts,
  removeDraft,
  upsertDraft,
  type BulkSaleDraft,
} from "./bulk-sale-drafts";
import type { BulkSaleRow } from "./types";

const row: BulkSaleRow = {
  id: "1",
  productId: 1,
  productCode: "SKU-1",
  productName: "Produk Uji",
  uomId: 1,
  uomCode: "PCS",
  availableUoms: [{ uomId: 1, uomCode: "PCS", conversionRate: 1, weightGram: 100 }],
  priceTier: "RETAIL",
  availablePrices: [{ uomId: 1, priceTier: "RETAIL", price: 9000 }],
  qty: 2,
  unitPrice: 9000,
  discountAmount: 0,
  subtotal: 18000,
};

function makeDraft(overrides: Partial<BulkSaleDraft> = {}): BulkSaleDraft {
  return {
    id: "draft-1",
    name: "Toko Sebelah",
    savedAt: "2026-08-16T03:00:00.000Z",
    branchId: 1,
    branchName: "Gudang",
    customerId: 7,
    customerName: "Toko Sebelah",
    customerPhone: null,
    paymentMethodId: 2,
    dpMethodId: 1,
    amountPaid: 0,
    transactionDiscount: 0,
    dueAt: "",
    rows: [row],
    grandTotal: 18000,
    itemCount: 2,
    source: null,
    ...overrides,
  };
}

describe("parseDrafts", () => {
  it("membaca daftar dari JSON string", () => {
    const drafts = parseDrafts(JSON.stringify([makeDraft()]));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].name).toBe("Toko Sebelah");
  });

  it("mengembalikan daftar kosong untuk JSON rusak atau bentuk tak terduga", () => {
    expect(parseDrafts("{bukan json")).toEqual([]);
    expect(parseDrafts(null)).toEqual([]);
    expect(parseDrafts({ drafts: [] })).toEqual([]);
  });

  it("membuang draf tanpa id atau tanpa item", () => {
    const drafts = parseDrafts([makeDraft(), { ...makeDraft(), id: 5 }, { ...makeDraft(), rows: [] }]);
    expect(drafts).toHaveLength(1);
  });

  it("mempertahankan tautan sumber Internal PO / Order", () => {
    const source = { kind: "IBT" as const, id: 9, number: "IBT-9", destinationBranchName: "Toko Pusat" };
    expect(parseDrafts([makeDraft({ source })])[0].source).toEqual(source);
  });

  it("membuang tautan sumber yang jenisnya tidak dikenal", () => {
    const drafts = parseDrafts([makeDraft({ source: { kind: "LAIN", id: 9, number: "X" } as never })]);
    expect(drafts[0].source).toBeNull();
  });
});

describe("upsertDraft", () => {
  it("menaruh draf terbaru di atas", () => {
    const older = makeDraft({ id: "draft-1" });
    const newer = makeDraft({ id: "draft-2", name: "Toko Depan" });
    expect(upsertDraft([older], newer).map((draft) => draft.id)).toEqual(["draft-2", "draft-1"]);
  });

  it("menimpa draf dengan id sama, bukan menggandakannya", () => {
    const drafts = upsertDraft([makeDraft()], makeDraft({ name: "Nama Baru" }));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].name).toBe("Nama Baru");
  });

  it("membuang draf terlama saat melewati batas", () => {
    const existing = Array.from({ length: MAX_BULK_SALE_DRAFTS }, (_, index) =>
      makeDraft({ id: `draft-${index}` }),
    );
    const drafts = upsertDraft(existing, makeDraft({ id: "draft-baru" }));

    expect(drafts).toHaveLength(MAX_BULK_SALE_DRAFTS);
    expect(drafts[0].id).toBe("draft-baru");
    expect(drafts.some((draft) => draft.id === `draft-${MAX_BULK_SALE_DRAFTS - 1}`)).toBe(false);
  });
});

describe("removeDraft", () => {
  it("menghapus hanya draf dengan id yang diminta", () => {
    const drafts = removeDraft([makeDraft({ id: "a" }), makeDraft({ id: "b" })], "a");
    expect(drafts.map((draft) => draft.id)).toEqual(["b"]);
  });
});
