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

const db = {
  select: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/auth", () => ({
  verifyAccessToken,
}));

vi.mock("@/lib/db", () => ({
  db,
  products: {
    id: "products.id",
    sku: "products.sku",
    barcode: "products.barcode",
    name: "products.name",
    categoryId: "products.categoryId",
    brandId: "products.brandId",
    baseUomId: "products.baseUomId",
    weightGram: "products.weightGram",
    isActive: "products.isActive",
  },
  productStocks: {
    qty: "productStocks.qty",
    productId: "productStocks.productId",
    branchId: "productStocks.branchId",
    uomId: "productStocks.uomId",
  },
  productUomConversions: {
    id: "productUomConversions.id",
    productId: "productUomConversions.productId",
    uomId: "productUomConversions.uomId",
    ratio: "productUomConversions.ratio",
    weightGram: "productUomConversions.weightGram",
  },
  productPrices: { branchId: "productPrices.branchId" },
  productUomCosts: {
    id: "productUomCosts.id",
    productId: "productUomCosts.productId",
    branchId: "productUomCosts.branchId",
    uomId: "productUomCosts.uomId",
    costPrice: "productUomCosts.costPrice",
  },
  customers: { isActive: "customers.isActive" },
  unitsOfMeasure: { code: "unitsOfMeasure.code" },
  paymentMethods: {},
  categories: {},
  expenseCategories: {},
  suppliers: {},
  eq,
  and,
  sql: vi.fn(() => "sql"),
}));

function request(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  verifyAccessToken.mockResolvedValue({
    userId: 7,
    branchId: 2,
    role: "KASIR",
    permissions: [],
  });
  selectChain.from.mockReturnValue(selectChain);
  selectChain.leftJoin.mockReturnValue(selectChain);
  selectChain.where.mockResolvedValue([]);
  db.select.mockReturnValue(selectChain);
});

describe("GET /api/pos/bootstrap", () => {
  it("rejects spoofed branch query", async () => {
    const { GET } = await import("./route");

    const res = await GET(request("/api/pos/bootstrap?branchId=999"));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain("Cabang");
    expect(db.select).not.toHaveBeenCalled();
  });

  it("uses session branch when branch query is absent", async () => {
    const { GET } = await import("./route");

    const res = await GET(request("/api/pos/bootstrap"));

    expect(res.status).toBe(200);
    expect(eq).toHaveBeenCalledWith("productStocks.branchId", 2);
    expect(eq).toHaveBeenCalledWith("productPrices.branchId", 2);
  });
});
