import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const eq = vi.fn((field, value) => ({ type: "eq", field, value }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));
const inArray = vi.fn((field, values) => ({ type: "inArray", field, values }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const stockOpnames = { id: "stockOpnames.id", branchId: "stockOpnames.branchId" };
const stockOpnameItems = {
  id: "stockOpnameItems.id",
  soId: "stockOpnameItems.soId",
  productId: "stockOpnameItems.productId",
  uomId: "stockOpnameItems.uomId",
};
const productStocks = {
  productId: "productStocks.productId",
  branchId: "productStocks.branchId",
  uomId: "productStocks.uomId",
  qty: "productStocks.qty",
};
const productUomConversions = {
  productId: "productUomConversions.productId",
  uomId: "productUomConversions.uomId",
  ratio: "productUomConversions.ratio",
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/auth", () => ({ verifyAccessToken }));

const headerLimit = vi.fn();
const itemsWhere = vi.fn();
const stockRowsWhere = vi.fn();
const conversionsWhere = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table) => {
        if (table === stockOpnames) {
          return { where: vi.fn(() => ({ limit: headerLimit })) };
        }
        if (table === stockOpnameItems) {
          return { where: itemsWhere };
        }
        if (table === productStocks) {
          return { leftJoin: vi.fn(() => ({ where: stockRowsWhere })) };
        }
        if (table === productUomConversions) {
          return { where: conversionsWhere };
        }
        throw new Error(`unexpected table ${String(table)}`);
      }),
    })),
  },
  stockOpnames,
  stockOpnameItems,
  productStocks,
  productUomConversions,
  eq,
  and,
  inArray,
}));

function request() {
  return new NextRequest("http://localhost/api/bo/stock-opnames/5/current-stock");
}

function setPayload(overrides: Record<string, unknown> = {}) {
  const base = {
    userId: 7,
    userName: "Manager",
    branchId: 2,
    role: "MANAGER",
    ...overrides,
  } as Record<string, unknown>;
  const isGlobal = base.role === "OWNER" || base.role === "GM";
  const canRead = base.role !== "KASIR" && base.role !== "GUDANG" && base.role !== "FINANCE";
  verifyAccessToken.mockResolvedValue({
    ...base,
    permissions: base.permissions ?? (canRead ? ["stock_opname.read"] : []),
    branchScope: base.branchScope ?? (isGlobal ? "ALL" : "OWN"),
  });
}

describe("GET /api/bo/stock-opnames/[id]/current-stock", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cookieStore.get.mockImplementation((name: string) => (name === "accessToken" ? { value: "token" } : undefined));
    setPayload();
    headerLimit.mockResolvedValue([{ id: 5, branchId: 2 }]);
    itemsWhere.mockResolvedValue([
      { id: 101, productId: 11, uomId: 1 },
      { id: 102, productId: 12, uomId: 1 },
    ]);
    stockRowsWhere.mockResolvedValue([
      { productId: 11, qty: 42, ratio: null },
      { productId: 12, qty: 5, ratio: 6 },
    ]);
    conversionsWhere.mockResolvedValue([
      { productId: 11, uomId: 1, ratio: 1 },
      { productId: 12, uomId: 1, ratio: 1 },
    ]);
  });

  it("mengembalikan stok terkini live per item, bukan snapshot", async () => {
    const { GET } = await import("./route");

    const res = await GET(request(), { params: Promise.resolve({ id: "5" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toEqual([
      { itemId: 101, currentSystemQty: 42 },
      { itemId: 102, currentSystemQty: 30 },
    ]);
    expect(typeof data.fetchedAt).toBe("string");
  });

  it("menolak role tanpa izin stock_opname.read", async () => {
    setPayload({ role: "KASIR" });
    const { GET } = await import("./route");

    const res = await GET(request(), { params: Promise.resolve({ id: "5" }) });

    expect(res.status).toBe(403);
    expect(headerLimit).not.toHaveBeenCalled();
  });

  it("menolak manager lintas cabang", async () => {
    setPayload({ role: "MANAGER", branchId: 9 });
    const { GET } = await import("./route");

    const res = await GET(request(), { params: Promise.resolve({ id: "5" }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("cabang");
  });

  it("mengembalikan 404 bila stock opname tidak ditemukan", async () => {
    headerLimit.mockResolvedValue([]);
    const { GET } = await import("./route");

    const res = await GET(request(), { params: Promise.resolve({ id: "5" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("tidak ditemukan");
  });

  it("mengembalikan array kosong bila SO belum ada item", async () => {
    itemsWhere.mockResolvedValue([]);
    const { GET } = await import("./route");

    const res = await GET(request(), { params: Promise.resolve({ id: "5" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toEqual([]);
    expect(stockRowsWhere).not.toHaveBeenCalled();
  });
});
