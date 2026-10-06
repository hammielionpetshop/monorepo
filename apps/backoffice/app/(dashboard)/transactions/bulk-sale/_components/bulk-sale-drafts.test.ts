import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBulkSaleDraft,
  deleteBulkSaleDraft,
  draftToDeliveryNote,
  fetchBulkSaleDrafts,
  parseDrafts,
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

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body };
}

describe("fetchBulkSaleDrafts", () => {
  it("mengambil daftar draft dari server", async () => {
    fetchMock.mockResolvedValue(jsonResponse([makeDraft()]));
    const drafts = await fetchBulkSaleDrafts();
    expect(fetchMock).toHaveBeenCalledWith("/api/bo/bulk-sale-drafts");
    expect(drafts).toHaveLength(1);
  });

  it("mengembalikan daftar kosong saat request gagal", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await fetchBulkSaleDrafts()).toEqual([]);
  });
});

describe("createBulkSaleDraft", () => {
  it("mengirim POST dan mengembalikan draft yang tersimpan", async () => {
    fetchMock.mockResolvedValue(jsonResponse(makeDraft({ id: "draft-baru" })));

    const { savedAt: _savedAt, id: _id, ...input } = makeDraft();
    const result = await createBulkSaleDraft(input);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bo/bulk-sale-drafts",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.id).toBe("draft-baru");
  });

  it("melempar error saat server menolak", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Item tidak boleh kosong" }, false));
    const { savedAt: _savedAt, id: _id, ...input } = makeDraft();
    await expect(createBulkSaleDraft(input)).rejects.toThrow("Item tidak boleh kosong");
  });
});

describe("deleteBulkSaleDraft", () => {
  it("mengirim DELETE ke draft yang diminta", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await deleteBulkSaleDraft("draft-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/bo/bulk-sale-drafts/draft-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("tidak melempar error saat request gagal", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(deleteBulkSaleDraft("draft-1")).resolves.toBeUndefined();
  });
});

describe("draftToDeliveryNote", () => {
  it("surat jalan draf selalu tanpa harga dan bernomor DRAF", () => {
    const draft = makeDraft({ name: "Toko Sinar", customerName: "Budi" });
    const note = draftToDeliveryNote(draft, { transactionDate: "7 Oktober 2026", staffName: "Admin" });
    expect(note.withPrice).toBe(false);
    expect(note.grandTotal).toBeUndefined();
    expect(note.transactionNumber).toBe("DRAF Toko Sinar");
    expect(note.customerName).toBe("Budi");
    expect(note.items).toBe(draft.rows);
  });

  it("nama draf panjang dipotong, customer kosong jadi tanda strip", () => {
    const note = draftToDeliveryNote(makeDraft({ name: "x".repeat(60), customerName: "" }), {
      transactionDate: "-",
      staffName: "-",
    });
    expect(note.transactionNumber.length).toBe(28);
    expect(note.customerName).toBe("-");
  });
});
