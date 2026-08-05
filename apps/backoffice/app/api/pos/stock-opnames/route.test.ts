import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const getPosBranchId = vi.fn();
const resolveSnapshotQty = vi.fn();
const transaction = vi.fn();
const insertValues = vi.fn();
const stockLimit = vi.fn();
const batchesOrderBy = vi.fn();
const soNumberLimit = vi.fn();
const txExecute = vi.fn();
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
  desc: vi.fn((field) => field),
  like: vi.fn((field, pattern) => ({ type: "like", field, pattern })),
  stockOpnames: {
    __table: "stockOpnames",
    id: "stockOpnames.id",
    branchId: "stockOpnames.branchId",
    soNumber: "stockOpnames.soNumber",
  },
  stockOpnameItems: { __table: "stockOpnameItems", id: "stockOpnameItems.id" },
  productStocks: {
    __table: "productStocks",
    productId: "productStocks.productId",
    branchId: "productStocks.branchId",
    uomId: "productStocks.uomId",
  },
  productStockBatches: {
    __table: "productStockBatches",
    productId: "productStockBatches.productId",
    branchId: "productStockBatches.branchId",
    uomId: "productStockBatches.uomId",
    qtyRemaining: "productStockBatches.qtyRemaining",
    receivedAt: "productStockBatches.receivedAt",
  },
  productUomConversions: {
    __table: "productUomConversions",
    productId: "productUomConversions.productId",
    uomId: "productUomConversions.uomId",
    ratio: "productUomConversions.ratio",
  },
}));

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/pos/stock-opnames", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    branchId: 999,
    createdById: 999,
    shiftId: 3,
    type: "DAILY",
    method: "MANUAL",
    notes: "cek pagi",
    items: [{ productId: 11, uomId: 1, physicalQty: 8, snapshotToken: "snap-token" }],
    ...overrides,
  };
}

describe("POST /api/pos/stock-opnames", () => {
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
    // Snapshot hitungan valid — systemQty 8, sama dengan physicalQty
    resolveSnapshotQty.mockResolvedValue(8);
    // Konversi UOM item tidak ada → ratio 1
    stockLimit.mockResolvedValue([]);
    batchesOrderBy.mockResolvedValue([
      { id: 1, qtyRemaining: "5", costPrice: "1000" },
    ]);
    // Belum ada SO hari ini → nomor urut mulai dari 0001
    soNumberLimit.mockResolvedValue([]);
    txExecute.mockResolvedValue(undefined);
    insertValues.mockReturnValue({ returning: vi.fn(async () => [{ id: 10 }]) });
    // Stok agregat = 8 (sama dengan physicalQty) → variance 0, alasan tidak wajib
    const stockRows = [{ uomId: 1, qty: "8", ratio: null }];
    transaction.mockImplementation(async (callback) => {
      // Tiap query punya bentuk rantai berbeda, jadi dispatch dari tabel yang
      // dilewatkan ke from(): nomor SO, stok, konversi item, dan batch FIFO.
      const thenable = (rows: unknown[]) => ({
        then: (onFulfilled: (r: unknown[]) => unknown, onRejected?: (e: unknown) => unknown) =>
          Promise.resolve(rows).then(onFulfilled, onRejected),
      });
      const fromChain = (table: { __table?: string }) => {
        if (table?.__table === "stockOpnames") {
          // generateSONumber: where(like).orderBy(desc).limit(1)
          return { where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: soNumberLimit })) })) };
        }
        if (table?.__table === "productStockBatches") {
          // batch FIFO: leftJoin().where().orderBy()
          return {
            leftJoin: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: batchesOrderBy })) })),
          };
        }
        if (table?.__table === "productUomConversions") {
          // ratio UOM item: where().limit(1)
          return { where: vi.fn(() => ({ limit: stockLimit })) };
        }
        // productStocks: leftJoin().where() di-await langsung
        return {
          leftJoin: vi.fn(() => ({ where: vi.fn(() => thenable(stockRows)) })),
          where: vi.fn(() => thenable(stockRows)),
        };
      };
      return callback({
        execute: txExecute,
        insert: vi.fn(() => ({ values: insertValues })),
        select: vi.fn(() => ({ from: vi.fn((table: { __table?: string }) => fromChain(table)) })),
      });
    });
  });

  it("menolak request tanpa sesi valid", async () => {
    verifyAccessToken.mockResolvedValue(null);
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validBody()));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: "Sesi tidak valid, silakan login kembali" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("mengabaikan branch dan user spoofed dari body", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validBody()));

    expect(res.status).toBe(201);
    expect(getPosBranchId).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7 }),
      cookieStore,
    );
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 2, createdById: 7 }),
    );
    expect(eq).toHaveBeenCalledWith("productStocks.branchId", 2);
  });

  it("menolak snapshot hitungan yang tidak valid", async () => {
    resolveSnapshotQty.mockResolvedValue(null);
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validBody()));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Snapshot hitungan tidak valid");
  });
});
