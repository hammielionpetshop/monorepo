import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const getPosBranchId = vi.fn();
const select = vi.fn();
const eq = vi.fn((field, value) => ({ type: "eq", field, value }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));
const desc = vi.fn((value) => ({ type: "desc", value }));
const ilike = vi.fn((field, value) => ({ type: "ilike", field, value }));
const or = vi.fn((...conditions) => ({ type: "or", conditions }));
const sql = vi.fn((strings, ...values) => ({ type: "sql", strings, values }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const queryResult = [{ productId: 11, productName: "Pakan", currentStock: 5 }];
let queryFailure: Error | null = null;

function createQueryChain() {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    then: vi.fn((resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
      if (queryFailure) {
        return reject ? reject(queryFailure) : Promise.reject(queryFailure);
      }
      return resolve(queryResult);
    }),
  };
  return chain;
}

const db = {
  select,
  query: {
    shifts: {
      findFirst: vi.fn(),
    },
  },
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/auth", () => ({ verifyAccessToken }));

vi.mock("@/lib/pos-branch", () => ({ getPosBranchId }));

vi.mock("@/lib/db", () => ({
  db,
  sql,
  eq,
  and,
  desc,
  ilike,
  or,
  transactions: {
    id: "transactions.id",
    branchId: "transactions.branchId",
    shiftId: "transactions.shiftId",
    createdAt: "transactions.createdAt",
  },
  transactionItems: {
    transactionId: "transactionItems.transactionId",
    productId: "transactionItems.productId",
    qty: "transactionItems.qty",
  },
  products: {
    id: "products.id",
    name: "products.name",
    sku: "products.sku",
    barcode: "products.barcode",
    baseUomId: "products.baseUomId",
    isActive: "products.isActive",
  },
  productStocks: {
    productId: "productStocks.productId",
    branchId: "productStocks.branchId",
    uomId: "productStocks.uomId",
    qty: "productStocks.qty",
  },
  unitsOfMeasure: {
    id: "unitsOfMeasure.id",
    code: "unitsOfMeasure.code",
  },
  shifts: {
    id: "shifts.id",
    branchId: "shifts.branchId",
  },
}));

function request(query = "") {
  return new NextRequest(
    `http://localhost/api/pos/stock-opname/suggestions${query}`,
  );
}

describe("GET /api/pos/stock-opname/suggestions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    queryFailure = null;
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
    db.query.shifts.findFirst.mockResolvedValue({ id: 12, branchId: 2 });
    select.mockImplementation(() => createQueryChain());
  });

  it("menolak request tanpa sesi valid dan tidak query DB", async () => {
    verifyAccessToken.mockResolvedValue(null);
    const { GET } = await import("./route");

    const res = await GET(request("?branchId=2&method=MANUAL"));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: "Sesi tidak valid, silakan login kembali" });
    expect(select).not.toHaveBeenCalled();
    expect(db.query.shifts.findFirst).not.toHaveBeenCalled();
  });

  it("mengabaikan branchId query dan memakai cabang POS terpercaya", async () => {
    const { GET } = await import("./route");

    const res = await GET(request("?branchId=999&method=MANUAL&q=pakan"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual(queryResult);
    expect(getPosBranchId).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7 }),
      cookieStore,
    );
    expect(eq).toHaveBeenCalledWith("productStocks.branchId", 2);
    expect(eq).not.toHaveBeenCalledWith("productStocks.branchId", 999);
  });

  it("menolak method tidak valid dengan pesan Indonesia", async () => {
    const { GET } = await import("./route");

    const res = await GET(request("?branchId=999&method=DROP_TABLE"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data).toEqual({ error: "Metode saran tidak valid" });
    expect(select).not.toHaveBeenCalled();
  });

  it("menolak shift beda cabang sebelum query produk atau transaksi", async () => {
    db.query.shifts.findFirst.mockResolvedValue(null);
    const { GET } = await import("./route");

    const res = await GET(request("?branchId=999&method=SOLD_TODAY&shiftId=12"));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: "Shift tidak sesuai dengan cabang POS" });
    expect(eq).toHaveBeenCalledWith("shifts.id", 12);
    expect(eq).toHaveBeenCalledWith("shifts.branchId", 2);
    expect(select).not.toHaveBeenCalled();
  });

  it("mengembalikan pesan 500 aman tanpa membocorkan error internal", async () => {
    queryFailure = new Error("token database rahasia");
    const { GET } = await import("./route");

    const res = await GET(request("?branchId=2&method=MANUAL"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({ error: "Gagal mengambil saran stock opname" });
  });
});
