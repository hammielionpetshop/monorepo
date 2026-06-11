import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const eq = vi.fn((left, right) => ({ type: "eq", left, right }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const selectChain = {
  from: vi.fn(),
  leftJoin: vi.fn(),
  where: vi.fn(),
};

const db = { select: vi.fn() };

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));
vi.mock("@/lib/db", () => ({
  db,
  products: {
    id: "products.id",
    isActive: "products.isActive",
    baseUomId: "products.baseUomId",
  },
  productStocks: {
    qty: "productStocks.qty",
    productId: "productStocks.productId",
    branchId: "productStocks.branchId",
    uomId: "productStocks.uomId",
  },
  eq,
  and,
  sql: vi.fn(() => "sql"),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  verifyAccessToken.mockResolvedValue({
    userId: 7,
    branchId: 2,
    role: "KASIR",
  });
  selectChain.from.mockReturnValue(selectChain);
  selectChain.leftJoin.mockReturnValue(selectChain);
  selectChain.where.mockResolvedValue([]);
  db.select.mockReturnValue(selectChain);
});

describe("GET /api/pos/stock-snapshot", () => {
  it("uses session branch when branch query is absent", async () => {
    const { GET } = await import("./route");

    const res = await GET(
      new NextRequest("http://localhost/api/pos/stock-snapshot"),
    );

    expect(res.status).toBe(200);
    expect(eq).toHaveBeenCalledWith("productStocks.branchId", 2);
  });
});
