import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const eq = vi.fn((field, value) => ({ type: "eq", field, value }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));
const inArray = vi.fn((field, values) => ({ type: "inArray", field, values }));

const cookieStore = {
  get: vi.fn((name: string) => (name === "accessToken" ? { value: "token" } : undefined)),
};

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));

const stockOpnames = {
  id: "stockOpnames.id",
  branchId: "stockOpnames.branchId",
  type: "stockOpnames.type",
  categoryScope: "stockOpnames.categoryScope",
};
const stockOpnameItems = { soId: "stockOpnameItems.soId" };
const productStocks = { productId: "productStocks.productId", branchId: "productStocks.branchId", uomId: "productStocks.uomId", qty: "productStocks.qty" };
const productUomConversions = { productId: "productUomConversions.productId", uomId: "productUomConversions.uomId", ratio: "productUomConversions.ratio" };
const products = { id: "products.id", name: "products.name", sku: "products.sku", baseUomId: "products.baseUomId", categoryId: "products.categoryId", isActive: "products.isActive" };
const unitsOfMeasure = { id: "unitsOfMeasure.id", code: "unitsOfMeasure.code" };

const headerLimit = vi.fn();
const existingItemsWhere = vi.fn();
const stockRowsWhere = vi.fn();
const activeProductsWhere = vi.fn();
const productRowsWhere = vi.fn();
const uomRowsWhere = vi.fn();
const conversionRowsWhere = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn((table) => {
        if (table === stockOpnames) return { where: vi.fn(() => ({ limit: headerLimit })) };
        if (table === stockOpnameItems) return { where: existingItemsWhere };
        if (table === productStocks) return { leftJoin: vi.fn(() => ({ where: stockRowsWhere })) };
        if (table === products) return { where: vi.fn((cond) => (isActiveFilter(cond) ? activeProductsWhere(cond) : productRowsWhere(cond))) };
        if (table === unitsOfMeasure) return { where: uomRowsWhere };
        if (table === productUomConversions) return { where: conversionRowsWhere };
        throw new Error(`unexpected table ${String(table)}`);
      }),
    })),
  },
  stockOpnames,
  stockOpnameItems,
  productStocks,
  productUomConversions,
  products,
  unitsOfMeasure,
  eq,
  and,
  inArray,
}));

function isActiveFilter(cond: { type: string; field?: unknown; conditions?: { field?: unknown }[] }) {
  if (cond.type === "eq") return cond.field === products.isActive;
  return cond.type === "and" && cond.conditions?.[0]?.field === products.isActive;
}

function request() {
  return new NextRequest("http://localhost/api/bo/stock-opnames/5/candidates");
}

function setPayload(overrides: Record<string, unknown> = {}) {
  const base = { userId: 7, userName: "Manager", branchId: 2, role: "MANAGER", ...overrides } as Record<string, unknown>;
  const isGlobal = base.role === "OWNER" || base.role === "GM";
  const canRead = base.role !== "KASIR" && base.role !== "GUDANG" && base.role !== "FINANCE";
  verifyAccessToken.mockResolvedValue({
    ...base,
    permissions: base.permissions ?? (canRead ? ["stock_opname.read"] : []),
    branchScope: base.branchScope ?? (isGlobal ? "ALL" : "OWN"),
  });
}

describe("GET /api/bo/stock-opnames/[id]/candidates", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cookieStore.get.mockImplementation((name: string) => (name === "accessToken" ? { value: "token" } : undefined));
    setPayload();
    headerLimit.mockResolvedValue([
      { id: 5, branchId: 2, type: "FULL", categoryScope: null },
    ]);
    existingItemsWhere.mockResolvedValue([]); // belum ada item tersimpan
    stockRowsWhere.mockResolvedValue([{ productId: 12, qty: 5, ratio: null }]); // hanya produk 12 punya stok
    activeProductsWhere.mockResolvedValue([{ id: 11 }, { id: 12 }]);
    productRowsWhere.mockResolvedValue([
      { id: 11, name: "Produk Stok Nol", sku: "SKU-11", baseUomId: 1 },
      { id: 12, name: "Produk Stok", sku: "SKU-12", baseUomId: 1 },
    ]);
    uomRowsWhere.mockResolvedValue([{ id: 1, code: "PCS" }]);
    conversionRowsWhere.mockResolvedValue([]);
  });

  it("menampilkan semua produk aktif termasuk yang stok sistemnya 0", async () => {
    const { GET } = await import("./route");

    const res = await GET(request(), { params: Promise.resolve({ id: "5" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(activeProductsWhere).toHaveBeenCalledWith({ type: "eq", field: products.isActive, value: true });
    expect(data.items).toHaveLength(2);
    const byId = new Map(data.items.map((i: { productId: number }) => [i.productId, i]));
    expect(byId.get(11)).toMatchObject({ productId: 11, productName: "Produk Stok Nol", systemQty: 0, soItemId: null });
    expect(byId.get(12)).toMatchObject({ productId: 12, productName: "Produk Stok", systemQty: 5, soItemId: null });
  });

  it("membatasi ke categoryScope bila SO dibuat per kategori", async () => {
    headerLimit.mockResolvedValue([{ id: 5, branchId: 2, type: "FULL", categoryScope: [3, 4] }]);
    activeProductsWhere.mockResolvedValue([{ id: 12 }]);
    const { GET } = await import("./route");

    const res = await GET(request(), { params: Promise.resolve({ id: "5" }) });

    expect(res.status).toBe(200);
    expect(activeProductsWhere).toHaveBeenCalledWith({
      type: "and",
      conditions: [
        { type: "eq", field: products.isActive, value: true },
        { type: "inArray", field: products.categoryId, values: [3, 4] },
      ],
    });
    expect(productRowsWhere).toHaveBeenCalledWith({ type: "inArray", field: products.id, values: [12] });
  });

  it("selalu menyertakan produk yang sudah punya item SO walau kini nonaktif", async () => {
    activeProductsWhere.mockResolvedValue([]);
    stockRowsWhere.mockResolvedValue([]);
    existingItemsWhere.mockResolvedValue([
      {
        id: 900,
        productId: 13,
        uomId: 1,
        systemQty: 20,
        physicalQty: 18,
        varianceQty: -2,
        varianceCostValue: 4000,
        varianceReason: "Rusak",
        itemStatus: "PENDING",
        isRecounted: false,
        recountPhysicalQty: null,
        recountVarianceQty: null,
        decisionNote: null,
      },
    ]);
    productRowsWhere.mockResolvedValue([{ id: 13, name: "Produk Lama", sku: "SKU-13", baseUomId: 1 }]);

    const { GET } = await import("./route");
    const res = await GET(request(), { params: Promise.resolve({ id: "5" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toEqual([
      expect.objectContaining({
        productId: 13,
        soItemId: 900,
        physicalQty: 18,
        varianceQty: -2,
        itemStatus: "PENDING",
      }),
    ]);
  });

  it("menolak SO tipe DAILY (bukan SO Besar)", async () => {
    headerLimit.mockResolvedValue([
      { id: 5, branchId: 2, type: "DAILY", categoryScope: null },
    ]);
    const { GET } = await import("./route");

    const res = await GET(request(), { params: Promise.resolve({ id: "5" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("SO Besar");
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

  it("mengembalikan array kosong bila tidak ada produk aktif maupun item SO", async () => {
    activeProductsWhere.mockResolvedValue([]);
    const { GET } = await import("./route");

    const res = await GET(request(), { params: Promise.resolve({ id: "5" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toEqual([]);
    expect(productRowsWhere).not.toHaveBeenCalled();
  });
});
