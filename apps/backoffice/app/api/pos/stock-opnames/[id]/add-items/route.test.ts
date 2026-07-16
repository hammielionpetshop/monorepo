import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const getPosBranchId = vi.fn();
const resolveSnapshotQty = vi.fn();
const transaction = vi.fn();
const headerLimit = vi.fn();
const headerForUpdate = vi.fn(() => ({ limit: headerLimit }));
const stockLimit = vi.fn();
const existingItemLimit = vi.fn();
const batchesOrderBy = vi.fn();
const insertValues = vi.fn();
const updateSet = vi.fn();
const eq = vi.fn((field, value) => ({ type: "eq", field, value }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/auth", () => ({ verifyAccessToken }));

vi.mock("@/lib/pos-branch", () => ({ getPosBranchId }));

vi.mock("@/lib/so-count-snapshot", () => ({ resolveSnapshotQty }));

vi.mock("@petshop/shared/utils/fifo-shrinkage", () => ({
  calculateFIFOCost: vi.fn(() => ({ totalCost: 5000 })),
}));

vi.mock("@/lib/db", () => ({
  db: { transaction },
  sql: vi.fn((strings, ...values) => ({ strings, values })),
  eq,
  and,
  asc: vi.fn((field) => field),
  stockOpnames: {
    id: "stockOpnames.id",
    branchId: "stockOpnames.branchId",
    status: "stockOpnames.status",
  },
  stockOpnameItems: {
    id: "stockOpnameItems.id",
    soId: "stockOpnameItems.soId",
    productId: "stockOpnameItems.productId",
    uomId: "stockOpnameItems.uomId",
  },
  productStocks: {
    productId: "productStocks.productId",
    branchId: "productStocks.branchId",
    uomId: "productStocks.uomId",
  },
  productStockBatches: {
    productId: "productStockBatches.productId",
    branchId: "productStockBatches.branchId",
    uomId: "productStockBatches.uomId",
    qtyRemaining: "productStockBatches.qtyRemaining",
    receivedAt: "productStockBatches.receivedAt",
  },
  productUomConversions: {
    productId: "productUomConversions.productId",
    uomId: "productUomConversions.uomId",
    ratio: "productUomConversions.ratio",
  },
}));

function request(body: Record<string, unknown>) {
  return new NextRequest(
    "http://localhost/api/pos/stock-opnames/10/add-items",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    branchId: 999,
    items: [{ productId: 11, uomId: 1, physicalQty: 8, snapshotToken: "snap-token" }],
    ...overrides,
  };
}

describe("PATCH /api/pos/stock-opnames/[id]/add-items", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.get.mockImplementation((name: string) => {
      if (name === "accessToken") return { value: "token" };
      return undefined;
    });
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      userName: "Kasir",
      staffNumber: "K-001",
      branchId: 2,
      branchName: "Cabang 2",
      role: "KASIR",
      permissions: [],
    });
    getPosBranchId.mockReturnValue(2);
    // systemQty berasal dari snapshot saat menghitung, bukan stok saat submit
    resolveSnapshotQty.mockResolvedValue(5);
    headerLimit.mockResolvedValue([{ id: 10, branchId: 2, status: "PENDING" }]);
    stockLimit.mockResolvedValue([{ qty: "5" }]);
    existingItemLimit.mockResolvedValue([]);
    batchesOrderBy.mockResolvedValue([
      { id: 1, qtyRemaining: "5", costPrice: "1000" },
    ]);
    insertValues.mockReturnValue({ returning: vi.fn(async () => [{ id: 100 }]) });
    updateSet.mockReturnValue({
      where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 100 }]) })),
    });
    // Stok agregat = 5 (via leftJoin konversi, di-await langsung tanpa .limit)
    const stockRows = [{ uomId: 1, qty: "5", ratio: null }];
    transaction.mockImplementation(async (callback) => {
      // where() harus thenable (query stok di-await langsung) sekaligus punya
      // .limit (query konversi UOM item) dan .orderBy (query batch)
      const afterWhere = {
        limit: stockLimit,
        orderBy: batchesOrderBy,
        then: (onFulfilled: (rows: unknown[]) => unknown, onRejected?: (err: unknown) => unknown) =>
          Promise.resolve(stockRows).then(onFulfilled, onRejected),
      };
      return callback({
        select: vi.fn(() => ({
          from: vi.fn((table) => {
            if (table?.id === "stockOpnames.id") {
              return { where: vi.fn(() => ({ for: headerForUpdate, limit: headerLimit })) };
            }
            if (table?.id === "stockOpnameItems.id") {
              return { where: vi.fn(() => ({ limit: existingItemLimit })) };
            }
            return {
              leftJoin: vi.fn(() => ({ where: vi.fn(() => afterWhere) })),
              where: vi.fn(() => afterWhere),
            };
          }),
        })),
        insert: vi.fn(() => ({ values: insertValues })),
        update: vi.fn(() => ({ set: updateSet })),
      });
    });
  });

  it("menolak stock opname dari branch lain", async () => {
    headerLimit.mockResolvedValueOnce([{ id: 10, branchId: 9, status: "PENDING" }]);
    const { PATCH } = await import("./route");

    const res = await PATCH(request(validBody({ branchId: 2 })), {
      params: Promise.resolve({ id: "10" }),
    });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: "Stock opname bukan milik cabang ini" });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("menghitung stok memakai branch header stock opname, bukan body", async () => {
    const { PATCH } = await import("./route");

    const res = await PATCH(request(validBody({ branchId: 999 })), {
      params: Promise.resolve({ id: "10" }),
    });

    expect(res.status).toBe(200);
    expect(getPosBranchId).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7 }),
      cookieStore,
    );
    expect(headerForUpdate).toHaveBeenCalledWith("update");
    expect(eq).toHaveBeenCalledWith("productStocks.branchId", 2);
    expect(eq).not.toHaveBeenCalledWith("productStocks.branchId", 999);
    expect(resolveSnapshotQty).toHaveBeenCalledWith(
      "snap-token",
      expect.objectContaining({ branchId: 2, productId: 11, uomId: 1 }),
    );
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ soId: 10, systemQty: 5, physicalQty: 8 }),
    );
  });

  it("memakai systemQty dari snapshot, bukan stok saat submit", async () => {
    // Stok agregat saat submit = 5 (lihat beforeEach), tetapi saat kasir menghitung
    // stoknya masih 12 — selisih harus dihitung terhadap 12.
    resolveSnapshotQty.mockResolvedValue(12);
    const { PATCH } = await import("./route");

    const res = await PATCH(request(validBody()), {
      params: Promise.resolve({ id: "10" }),
    });

    expect(res.status).toBe(200);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ systemQty: 12, physicalQty: 8, varianceQty: -4 }),
    );
  });

  it("menolak item dengan snapshot tidak valid atau kedaluwarsa", async () => {
    resolveSnapshotQty.mockResolvedValue(null);
    const { PATCH } = await import("./route");

    const res = await PATCH(request(validBody()), {
      params: Promise.resolve({ id: "10" }),
    });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("hitung ulang");
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("menolak stock opname yang tidak PENDING", async () => {
    headerLimit.mockResolvedValueOnce([{ id: 10, branchId: 2, status: "APPROVED" }]);
    const { PATCH } = await import("./route");

    const res = await PATCH(request(validBody()), {
      params: Promise.resolve({ id: "10" }),
    });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data).toEqual({ error: "Stock opname sudah diproses" });
    expect(insertValues).not.toHaveBeenCalled();
  });
});
