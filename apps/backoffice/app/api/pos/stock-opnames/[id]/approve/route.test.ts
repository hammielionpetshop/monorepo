import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const getPosBranchId = vi.fn();
const transaction = vi.fn();
const applySOStockAdjustment = vi.fn();
const headerLimit = vi.fn();
const headerForUpdate = vi.fn(() => ({ limit: headerLimit }));
const itemsWhere = vi.fn();
const updateSet = vi.fn();
const eq = vi.fn((field, value) => ({ type: "eq", field, value }));

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

vi.mock("@/lib/stock-adjustment", () => ({ applySOStockAdjustment }));

vi.mock("@/lib/db", () => ({
  db: { transaction },
  eq,
  stockOpnames: {
    id: "stockOpnames.id",
    branchId: "stockOpnames.branchId",
    status: "stockOpnames.status",
  },
  stockOpnameItems: {
    soId: "stockOpnameItems.soId",
  },
}));

function request(body: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/pos/stock-opnames/10/approve", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setupTransaction() {
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn((table) => ({
        where: vi.fn(() => {
          if (table?.id === "stockOpnames.id") {
            return { for: headerForUpdate, limit: headerLimit };
          }
          return itemsWhere();
        }),
      })),
    })),
    update: vi.fn(() => ({ set: updateSet })),
  };

  transaction.mockImplementation(async (callback) => callback(tx));
}

describe("PATCH /api/pos/stock-opnames/[id]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
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
    headerLimit.mockResolvedValue([{ id: 10, branchId: 2, status: "PENDING" }]);
    itemsWhere.mockResolvedValue([
      { productId: 11, uomId: 1, systemQty: "5", physicalQty: "8" },
    ]);
    updateSet.mockReturnValue({
      where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 10 }]) })),
    });
    setupTransaction();
  });

  it("menolak approval tanpa sesi valid", async () => {
    verifyAccessToken.mockResolvedValue(null);
    const { PATCH } = await import("./route");

    const res = await PATCH(request({ approvedById: 999 }), {
      params: Promise.resolve({ id: "10" }),
    });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: "Sesi tidak valid, silakan login kembali" });
    expect(applySOStockAdjustment).not.toHaveBeenCalled();
  });

  it("menolak approval untuk stock opname cabang lain", async () => {
    headerLimit.mockResolvedValueOnce([{ id: 10, branchId: 9, status: "PENDING" }]);
    const { PATCH } = await import("./route");

    const res = await PATCH(request({ approvedById: 999 }), {
      params: Promise.resolve({ id: "10" }),
    });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: "Stock opname bukan milik cabang ini" });
    expect(applySOStockAdjustment).not.toHaveBeenCalled();
  });

  it("menolak approval stock opname yang sudah diproses", async () => {
    headerLimit.mockResolvedValueOnce([{ id: 10, branchId: 2, status: "APPROVED" }]);
    const { PATCH } = await import("./route");

    const res = await PATCH(request({ approvedById: 999 }), {
      params: Promise.resolve({ id: "10" }),
    });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data).toEqual({ error: "Stock opname sudah diproses" });
    expect(applySOStockAdjustment).not.toHaveBeenCalled();
  });

  it("menggunakan user JWT sebagai approvedById", async () => {
    const { PATCH } = await import("./route");

    const res = await PATCH(request({ approvedById: 999 }), {
      params: Promise.resolve({ id: "10" }),
    });

    expect(res.status).toBe(200);
    expect(headerForUpdate).toHaveBeenCalledWith("update");
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ approvedById: 7 }),
    );
    expect(applySOStockAdjustment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ branchId: 2, currentUserId: 7 }),
    );
  });
});
