import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const transaction = vi.fn();
const applySOStockAdjustment = vi.fn();
const eq = vi.fn((field, value) => ({ type: "eq", field, value }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));
const inArray = vi.fn((field, values) => ({ type: "inArray", field, values }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const stockOpnames = {
  id: "stockOpnames.id",
  type: "stockOpnames.type",
  status: "stockOpnames.status",
  branchId: "stockOpnames.branchId",
};
const stockOpnameItems = {
  id: "stockOpnameItems.id",
  soId: "stockOpnameItems.soId",
  productId: "stockOpnameItems.productId",
  uomId: "stockOpnameItems.uomId",
  itemStatus: "stockOpnameItems.itemStatus",
};
const products = { id: "products.id", name: "products.name" };
const auditLogs = { id: "auditLogs.id" };

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));
vi.mock("@/lib/db", () => ({
  db: { transaction },
  stockOpnames,
  stockOpnameItems,
  products,
  auditLogs,
  eq,
  and,
  inArray,
}));
vi.mock("@/lib/stock-adjustment", () => ({ applySOStockAdjustment }));

// Kelas asli diuji di lib/services/stock-service.test.ts; di sini yang diuji adalah
// pemetaan error-nya oleh route, jadi cukup tiruan dengan bentuk yang sama.
vi.mock("@/lib/services/stock-service", () => {
  class InsufficientStockError extends Error {
    constructor(
      message: string,
      readonly productId: number,
      readonly shortfallQty: number
    ) {
      super(message);
      this.name = "InsufficientStockError";
    }
  }
  return { InsufficientStockError };
});

const soRow = { id: 5, type: "FULL", status: "PENDING", branchId: 2 };
let items: Record<string, unknown>[] = [];
let remaining: Record<string, unknown>[] = [];
const itemUpdates: Record<string, unknown>[] = [];
const soUpdates: Record<string, unknown>[] = [];
const insertedAuditLogs: Record<string, unknown>[] = [];

function buildTx() {
  return {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        if (table === stockOpnames) {
          return {
            where: vi.fn(() => ({
              for: vi.fn(() => ({ limit: vi.fn(async () => [soRow]) })),
            })),
          };
        }
        // stockOpnameItems dipakai dua kali: query utama (innerJoin products) dan
        // query "remaining" (where().limit()) untuk cek penutupan SO otomatis.
        return {
          innerJoin: vi.fn(() => ({ where: vi.fn(async () => items) })),
          where: vi.fn(() => ({ limit: vi.fn(async () => remaining) })),
        };
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: Record<string, unknown>) => {
        if (table === stockOpnameItems) itemUpdates.push(values);
        else soUpdates.push(values);
        return { where: vi.fn(async () => undefined) };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: Record<string, unknown>) => {
        insertedAuditLogs.push(values);
      }),
    })),
  };
}

function callDecide(decisions: unknown) {
  const req = new NextRequest("http://localhost/api/bo/stock-opnames/5/items/decide", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decisions }),
  });
  return { req, params: Promise.resolve({ id: "5" }) };
}

describe("PATCH /api/bo/stock-opnames/[id]/items/decide", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    itemUpdates.length = 0;
    soUpdates.length = 0;
    insertedAuditLogs.length = 0;
    soRow.type = "FULL";
    soRow.status = "PENDING";
    items = [
      {
        id: 31,
        productId: 11,
        productName: "Royal Canin 1kg",
        uomId: 1,
        itemStatus: "PENDING",
        systemQty: 100,
        physicalQty: 90,
        isRecounted: false,
        recountSystemQty: null,
        recountPhysicalQty: null,
      },
    ];
    remaining = []; // default: tidak ada item PENDING lain, SO ditutup
    cookieStore.get.mockImplementation((name: string) => {
      if (name === "accessToken") return { value: "token" };
      return undefined;
    });
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      branchId: 2,
      role: "MANAGER",
      permissions: ["stock_opname.approve"],
      branchScope: "OWN",
    });
    applySOStockAdjustment.mockResolvedValue(undefined);
    transaction.mockImplementation(async (callback) => callback(buildTx()));
  });

  it("menyetujui item pakai qty hitungan pertama kalau belum direcount", async () => {
    const { PATCH } = await import("./route");
    const { req, params } = callDecide([{ itemId: 31, action: "APPROVE" }]);

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(applySOStockAdjustment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ productId: 11, uomId: 1, systemQty: 100, physicalQty: 90 }),
    );
    expect(itemUpdates[0]).toMatchObject({ itemStatus: "APPROVED", decidedById: 7 });
    expect(insertedAuditLogs[0]).toMatchObject({ action: "STOCK_OPNAME_ITEM_APPROVE" });
    expect(data.decided).toEqual([{ id: 31, itemStatus: "APPROVED" }]);
  });

  it("menyetujui item pakai qty hitungan ulang kalau sudah direcount", async () => {
    items[0] = { ...items[0], isRecounted: true, recountSystemQty: 80, recountPhysicalQty: 79 };
    const { PATCH } = await import("./route");
    const { req, params } = callDecide([{ itemId: 31, action: "APPROVE" }]);

    const res = await PATCH(req, { params });

    expect(res.status).toBe(200);
    expect(applySOStockAdjustment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ systemQty: 80, physicalQty: 79 }),
    );
  });

  it("menolak item dengan catatan, tanpa menyentuh stok", async () => {
    const { PATCH } = await import("./route");
    const { req, params } = callDecide([{ itemId: 31, action: "REJECT", note: "Cuma salah hitung" }]);

    const res = await PATCH(req, { params });

    expect(res.status).toBe(200);
    expect(applySOStockAdjustment).not.toHaveBeenCalled();
    expect(itemUpdates[0]).toMatchObject({
      itemStatus: "REJECTED",
      decisionNote: "Cuma salah hitung",
    });
    expect(insertedAuditLogs[0]).toMatchObject({ action: "STOCK_OPNAME_ITEM_REJECT" });
  });

  it("menolak reject tanpa catatan", async () => {
    const { PATCH } = await import("./route");
    const { req, params } = callDecide([{ itemId: 31, action: "REJECT" }]);

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Alasan wajib");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("menutup SO otomatis begitu tidak ada item PENDING tersisa", async () => {
    remaining = [];
    const { PATCH } = await import("./route");
    const { req, params } = callDecide([{ itemId: 31, action: "APPROVE" }]);

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.soClosed).toBe(true);
    expect(soUpdates[0]).toMatchObject({ status: "APPROVED", approvedById: 7 });
    expect(soUpdates[0].completedAt).toBeInstanceOf(Date);
  });

  it("tidak menutup SO kalau masih ada item PENDING lain", async () => {
    remaining = [{ id: 99 }];
    const { PATCH } = await import("./route");
    const { req, params } = callDecide([{ itemId: 31, action: "APPROVE" }]);

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.soClosed).toBe(false);
    expect(soUpdates).toHaveLength(0);
  });

  it("menolak SO yang bukan tipe FULL", async () => {
    soRow.type = "DAILY";
    const { PATCH } = await import("./route");
    const { req, params } = callDecide([{ itemId: 31, action: "APPROVE" }]);

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("SO Besar");
    expect(applySOStockAdjustment).not.toHaveBeenCalled();
  });

  it("menolak keputusan pada item yang sudah tidak PENDING", async () => {
    items[0] = { ...items[0], itemStatus: "MATCHED" };
    const { PATCH } = await import("./route");
    const { req, params } = callDecide([{ itemId: 31, action: "APPROVE" }]);

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("sudah cocok otomatis atau sudah diputuskan");
    expect(applySOStockAdjustment).not.toHaveBeenCalled();
  });

  it("menolak SO yang masih DRAFT", async () => {
    soRow.status = "DRAFT";
    const { PATCH } = await import("./route");
    const { req, params } = callDecide([{ itemId: 31, action: "APPROVE" }]);

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("masih dihitung");
  });

  it("mengembalikan 422 dengan nama produk saat stok tidak cukup", async () => {
    const { InsufficientStockError } = await import("@/lib/services/stock-service");
    applySOStockAdjustment.mockRejectedValue(
      new InsufficientStockError("Stok tidak cukup. Dibutuhkan 10, tersedia 3.", 11, 7),
    );
    const { PATCH } = await import("./route");
    const { req, params } = callDecide([{ itemId: 31, action: "APPROVE" }]);

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toContain("Royal Canin 1kg");
    expect(itemUpdates).toHaveLength(0);
  });

  it("menolak KASIR memutuskan item", async () => {
    verifyAccessToken.mockResolvedValue({
      userId: 4,
      branchId: 2,
      role: "KASIR",
      permissions: [],
      branchScope: "OWN",
    });
    const { PATCH } = await import("./route");
    const { req, params } = callDecide([{ itemId: 31, action: "APPROVE" }]);

    const res = await PATCH(req, { params });

    expect(res.status).toBe(403);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("menolak MANAGER memutuskan item SO cabang lain", async () => {
    verifyAccessToken.mockResolvedValue({
      userId: 5,
      branchId: 9,
      role: "MANAGER",
      permissions: ["stock_opname.approve"],
      branchScope: "OWN",
    });
    const { PATCH } = await import("./route");
    const { req, params } = callDecide([{ itemId: 31, action: "APPROVE" }]);

    const res = await PATCH(req, { params });

    expect(res.status).toBe(403);
    expect(itemUpdates).toHaveLength(0);
  });

  it("menolak item duplikat dalam satu permintaan", async () => {
    const { PATCH } = await import("./route");
    const { req, params } = callDecide([
      { itemId: 31, action: "APPROVE" },
      { itemId: 31, action: "REJECT", note: "dobel" },
    ]);

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("duplikat");
    expect(transaction).not.toHaveBeenCalled();
  });
});
