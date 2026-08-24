import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const getPosBranchId = vi.fn();
const eq = vi.fn((field, value) => ({ type: "eq", field, value }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const stockOpnames = { id: "stockOpnames.id", branchId: "stockOpnames.branchId", type: "stockOpnames.type" };
const stockOpnameItems = {
  id: "stockOpnameItems.id",
  soId: "stockOpnameItems.soId",
  productId: "stockOpnameItems.productId",
  uomId: "stockOpnameItems.uomId",
  itemStatus: "stockOpnameItems.itemStatus",
};
const products = { id: "products.id", name: "products.name", sku: "products.sku" };
const unitsOfMeasure = { id: "unitsOfMeasure.id", code: "unitsOfMeasure.code" };

const headerLimit = vi.fn();
const itemsWhere = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));
vi.mock("@/lib/pos-branch", () => ({ getPosBranchId }));
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        if (table === stockOpnames) {
          return { where: vi.fn(() => ({ limit: headerLimit })) };
        }
        return {
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({ where: itemsWhere })),
          })),
        };
      }),
    })),
  },
  stockOpnames,
  stockOpnameItems,
  products,
  unitsOfMeasure,
  eq,
  and,
}));

function request(soId = "10") {
  return new NextRequest(`http://localhost/api/pos/stock-opnames/${soId}/pending-items`);
}

describe("GET /api/pos/stock-opnames/[id]/pending-items", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cookieStore.get.mockImplementation((name: string) => (name === "accessToken" ? { value: "token" } : undefined));
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      branchId: 2,
      role: "KASIR",
      permissions: [],
    });
    getPosBranchId.mockReturnValue(2);
    headerLimit.mockResolvedValue([{ id: 10, branchId: 2, type: "FULL" }]);
    itemsWhere.mockResolvedValue([
      { itemId: 31, productId: 11, productName: "Royal Canin 1kg", sku: "RC-1", uomId: 1, uomCode: "PCS", isRecounted: false },
    ]);
  });

  it("menolak request tanpa sesi valid", async () => {
    verifyAccessToken.mockResolvedValue(null);
    const { GET } = await import("./route");

    const res = await GET(request(), { params: Promise.resolve({ id: "10" }) });

    expect(res.status).toBe(401);
  });

  it("menolak SO milik cabang lain", async () => {
    headerLimit.mockResolvedValue([{ id: 10, branchId: 9, type: "FULL" }]);
    const { GET } = await import("./route");

    const res = await GET(request(), { params: Promise.resolve({ id: "10" }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("bukan milik cabang");
  });

  it("mengembalikan daftar kosong untuk SO Harian (bukan FULL)", async () => {
    headerLimit.mockResolvedValue([{ id: 10, branchId: 2, type: "DAILY" }]);
    const { GET } = await import("./route");

    const res = await GET(request(), { params: Promise.resolve({ id: "10" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([]);
  });

  it("mengembalikan item PENDING tanpa systemQty/varianceQty (review buta)", async () => {
    const { GET } = await import("./route");

    const res = await GET(request(), { params: Promise.resolve({ id: "10" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([
      { itemId: 31, productId: 11, productName: "Royal Canin 1kg", sku: "RC-1", uomId: 1, uomCode: "PCS", isRecounted: false },
    ]);
    expect(JSON.stringify(data)).not.toContain("systemQty");
    expect(JSON.stringify(data)).not.toContain("varianceQty");
  });
});
