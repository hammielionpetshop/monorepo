import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const transaction = vi.fn();
const closeFullSoIfResolved = vi.fn();
const eq = vi.fn((field, value) => ({ type: "eq", field, value }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));
const sql = vi.fn(() => ({ type: "sql" }));

const cookieStore = {
  get: vi.fn((name: string) => (name === "accessToken" ? { value: "token" } : undefined)),
};

const stockOpnames = {
  id: "stockOpnames.id",
  type: "stockOpnames.type",
  status: "stockOpnames.status",
  branchId: "stockOpnames.branchId",
};
const stockOpnameItems = { soId: "stockOpnameItems.soId", itemStatus: "stockOpnameItems.itemStatus" };

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));
vi.mock("@/lib/db", () => ({
  db: { transaction },
  stockOpnames,
  stockOpnameItems,
  eq,
  and,
  sql,
}));
vi.mock("@/lib/services/stock-opname", () => ({ closeFullSoIfResolved }));
vi.mock("@/lib/services/stock-service", () => {
  class InsufficientStockError extends Error {
    constructor(message: string, readonly productId: number, readonly shortfallQty: number) {
      super(message);
      this.name = "InsufficientStockError";
    }
  }
  return { InsufficientStockError };
});
vi.mock("@/lib/services/stock-validation", () => {
  class StockConflictError extends Error {}
  return { StockConflictError };
});

const soRow = { id: 5, type: "FULL", status: "PENDING", branchId: 2 };
let counts = { total: 3, pending: 0 };
const soUpdates: Record<string, unknown>[] = [];

function buildTx() {
  return {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        if (table === stockOpnames) {
          return {
            where: vi.fn(() => ({ for: vi.fn(() => ({ limit: vi.fn(async () => [soRow]) })) })),
          };
        }
        // Query hitungan item (total & pending) — di-await langsung.
        return { where: vi.fn(async () => [counts]) };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        soUpdates.push(values);
        return { where: vi.fn(async () => undefined) };
      }),
    })),
  };
}

function callFinish(id = "5") {
  const req = new NextRequest(`http://localhost/api/bo/stock-opnames/${id}/finish`, { method: "POST" });
  return { req, params: Promise.resolve({ id }) };
}

describe("POST /api/bo/stock-opnames/[id]/finish", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    soUpdates.length = 0;
    soRow.type = "FULL";
    soRow.status = "PENDING";
    soRow.branchId = 2;
    counts = { total: 3, pending: 0 };
    cookieStore.get.mockImplementation((name: string) => (name === "accessToken" ? { value: "token" } : undefined));
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      branchId: 2,
      role: "MANAGER",
      permissions: ["stock_opname.approve"],
      branchScope: "OWN",
    });
    closeFullSoIfResolved.mockResolvedValue(true);
    transaction.mockImplementation(async (callback) => callback(buildTx()));
  });

  it("menutup SO saat semua item sudah diputuskan", async () => {
    const { POST } = await import("./route");
    const { req, params } = callFinish();

    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(closeFullSoIfResolved).toHaveBeenCalledWith(expect.anything(), 5, 7);
  });

  it("menolak kalau masih ada item menunggu keputusan", async () => {
    counts = { total: 5, pending: 2 };
    const { POST } = await import("./route");
    const { req, params } = callFinish();

    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("2 item");
    expect(closeFullSoIfResolved).not.toHaveBeenCalled();
  });

  it("menolak kalau SO belum punya item", async () => {
    counts = { total: 0, pending: 0 };
    const { POST } = await import("./route");
    const { req, params } = callFinish();

    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("belum memiliki item");
    expect(closeFullSoIfResolved).not.toHaveBeenCalled();
  });

  it("menolak SO bukan tipe FULL", async () => {
    soRow.type = "DAILY";
    const { POST } = await import("./route");
    const { req, params } = callFinish();

    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("SO Besar");
  });

  it("menolak SO yang masih DRAFT", async () => {
    soRow.status = "DRAFT";
    const { POST } = await import("./route");
    const { req, params } = callFinish();

    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("masih dihitung");
  });

  it("menolak SO yang sudah diproses", async () => {
    soRow.status = "APPROVED";
    const { POST } = await import("./route");
    const { req, params } = callFinish();

    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("sudah selesai");
  });

  it("menolak MANAGER menyelesaikan SO cabang lain", async () => {
    verifyAccessToken.mockResolvedValue({
      userId: 5,
      branchId: 9,
      role: "MANAGER",
      permissions: ["stock_opname.approve"],
      branchScope: "OWN",
    });
    const { POST } = await import("./route");
    const { req, params } = callFinish();

    const res = await POST(req, { params });

    expect(res.status).toBe(403);
    expect(closeFullSoIfResolved).not.toHaveBeenCalled();
  });

  it("menolak KASIR menyelesaikan SO", async () => {
    verifyAccessToken.mockResolvedValue({
      userId: 4,
      branchId: 2,
      role: "KASIR",
      permissions: [],
      branchScope: "OWN",
    });
    const { POST } = await import("./route");
    const { req, params } = callFinish();

    const res = await POST(req, { params });

    expect(res.status).toBe(403);
    expect(transaction).not.toHaveBeenCalled();
  });
});
