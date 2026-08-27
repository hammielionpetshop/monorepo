import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const transaction = vi.fn();
const applyManualStockAdjustment = vi.fn();
const eq = vi.fn((field, value) => ({ type: "eq", field, value }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));
const inArray = vi.fn((field, values) => ({ type: "inArray", field, values }));
const isNull = vi.fn((field) => ({ type: "isNull", field }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const stockOpnames = { id: "stockOpnames.id" };
const stockOpnameItems = {
  id: "stockOpnameItems.id",
  soId: "stockOpnameItems.soId",
  productId: "stockOpnameItems.productId",
  uomId: "stockOpnameItems.uomId",
};
const products = { id: "products.id", baseUomId: "products.baseUomId" };
const productUomConversions = { productId: "productUomConversions.productId", uomId: "productUomConversions.uomId", ratio: "productUomConversions.ratio" };
const productStocks = { productId: "productStocks.productId", branchId: "productStocks.branchId", uomId: "productStocks.uomId", qty: "productStocks.qty" };
const users = { id: "users.id", isActive: "users.isActive" };
const soVarianceResolutions = { id: "soVarianceResolutions.id", soItemId: "soVarianceResolutions.soItemId", voidedAt: "soVarianceResolutions.voidedAt" };
const soResolutionEmployeeCharges = { resolutionId: "soResolutionEmployeeCharges.resolutionId" };
const auditLogs = { id: "auditLogs.id" };

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));
vi.mock("@/lib/db", () => ({
  db: { transaction },
  stockOpnames,
  stockOpnameItems,
  products,
  productUomConversions,
  productStocks,
  users,
  soVarianceResolutions,
  soResolutionEmployeeCharges,
  auditLogs,
  eq,
  and,
  inArray,
  isNull,
}));
vi.mock("@/lib/stock-adjustment", () => ({ applyManualStockAdjustment }));

const baseItem = {
  itemId: 31,
  productId: 11,
  uomId: 1,
  baseUomId: 1,
  itemStatus: "APPROVED",
  varianceQty: -10,
  varianceCostValue: 1000,
  soId: 5,
  soNumber: "SO-FULL-20260827-000001",
  soType: "FULL",
  soStatus: "APPROVED",
  branchId: 2,
};

let itemRow: Record<string, unknown> | null = { ...baseItem };
let existingResolution: Record<string, unknown>[] = [];
let activeUsers: Record<string, unknown>[] = [];
let convRatio: Record<string, unknown>[] = [];
let stockAgg: Record<string, unknown>[] = [];
const insertedResolutions: Record<string, unknown>[] = [];
const insertedCharges: Record<string, unknown>[] = [];
const insertedAuditLogs: Record<string, unknown>[] = [];

function buildTx() {
  return {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        if (table === stockOpnameItems) {
          return {
            innerJoin: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                where: vi.fn(() => ({
                  for: vi.fn(() => ({ limit: vi.fn(async () => (itemRow ? [itemRow] : [])) })),
                })),
              })),
            })),
          };
        }
        if (table === soVarianceResolutions) {
          return {
            where: vi.fn(() => ({
              for: vi.fn(() => ({ limit: vi.fn(async () => existingResolution) })),
            })),
          };
        }
        if (table === users) {
          return { where: vi.fn(async () => activeUsers) };
        }
        if (table === productUomConversions) {
          return { where: vi.fn(() => ({ limit: vi.fn(async () => convRatio) })) };
        }
        if (table === productStocks) {
          return { where: vi.fn(() => ({ for: vi.fn(() => ({ limit: vi.fn(async () => stockAgg) })) })) };
        }
        throw new Error("unexpected table in select().from()");
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        if (table === soVarianceResolutions) {
          insertedResolutions.push(values as Record<string, unknown>);
          return { returning: vi.fn(async () => [{ id: 501, ...(values as Record<string, unknown>) }]) };
        }
        if (table === soResolutionEmployeeCharges) {
          const arr = Array.isArray(values) ? values : [values];
          insertedCharges.push(...(arr as Record<string, unknown>[]));
          return Promise.resolve(undefined);
        }
        insertedAuditLogs.push(values as Record<string, unknown>);
        return Promise.resolve(undefined);
      }),
    })),
  };
}

function callResolve(body: unknown, itemId = "31") {
  const req = new NextRequest(`http://localhost/api/bo/stock-opnames/items/${itemId}/resolution`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { req, params: Promise.resolve({ itemId }) };
}

describe("POST /api/bo/stock-opnames/items/[itemId]/resolution", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    itemRow = { ...baseItem };
    existingResolution = [];
    activeUsers = [];
    convRatio = [];
    stockAgg = [{ qty: 50 }];
    insertedResolutions.length = 0;
    insertedCharges.length = 0;
    insertedAuditLogs.length = 0;
    cookieStore.get.mockImplementation((name: string) => {
      if (name === "accessToken") return { value: "token" };
      return undefined;
    });
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      branchId: 2,
      role: "OWNER",
      permissions: ["stock_opname.resolve"],
      branchScope: "OWN",
    });
    applyManualStockAdjustment.mockResolvedValue({ stockAdjustmentId: 999 });
    transaction.mockImplementation(async (callback) => callback(buildTx()));
  });

  it("meresolusi FOUND dan mengoreksi stok balik lewat applyManualStockAdjustment", async () => {
    const { POST } = await import("./route");
    const { req, params } = callResolve({ disposition: "FOUND", note: "Ketemu di gudang belakang" });

    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(applyManualStockAdjustment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        productId: 11,
        branchId: 2,
        uomId: 1,
        previousQty: "50",
        newQty: "60",
        costPricePerUnit: 100,
        adjustedById: 7,
      })
    );
    expect(insertedResolutions[0]).toMatchObject({
      soItemId: 31,
      disposition: "FOUND",
      varianceCostValue: 1000,
      stockAdjustmentId: 999,
    });
    expect(insertedAuditLogs[0]).toMatchObject({ action: "SO_VARIANCE_RESOLUTION_CREATE" });
    expect(data.resolution).toMatchObject({ id: 501 });
  });

  it("meresolusi WRITTEN_OFF tanpa menyentuh stok", async () => {
    const { POST } = await import("./route");
    const { req, params } = callResolve({ disposition: "WRITTEN_OFF", note: "Dianggap hilang, kerugian toko" });

    const res = await POST(req, { params });

    expect(res.status).toBe(201);
    expect(applyManualStockAdjustment).not.toHaveBeenCalled();
    expect(insertedResolutions[0]).toMatchObject({ disposition: "WRITTEN_OFF", stockAdjustmentId: null });
  });

  it("meresolusi EMPLOYEE_CHARGE sebagian, sisanya otomatis jadi kerugian toko", async () => {
    const { POST } = await import("./route");
    const { req, params } = callResolve({
      disposition: "EMPLOYEE_CHARGE",
      note: "Ditagih ke 2 kasir shift itu",
      employeeCharges: [
        { employeeName: "Budi", amount: 600 },
        { employeeName: "Siti (tidak punya akun)", amount: 200 },
      ],
    });

    const res = await POST(req, { params });

    expect(res.status).toBe(201);
    expect(insertedResolutions[0]).toMatchObject({ disposition: "EMPLOYEE_CHARGE", employeeChargedTotal: 800 });
    expect(insertedCharges).toHaveLength(2);
    expect(insertedCharges[0]).toMatchObject({ employeeName: "Budi", amount: 600, employeeId: null });
  });

  it("menolak EMPLOYEE_CHARGE kalau total melebihi nilai selisih", async () => {
    const { POST } = await import("./route");
    const { req, params } = callResolve({
      disposition: "EMPLOYEE_CHARGE",
      note: "Terlalu besar",
      employeeCharges: [{ employeeName: "Budi", amount: 1500 }],
    });

    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("tidak boleh melebihi");
    expect(insertedResolutions).toHaveLength(0);
  });

  it("menolak employeeId yang bukan user aktif", async () => {
    activeUsers = [];
    const { POST } = await import("./route");
    const { req, params } = callResolve({
      disposition: "EMPLOYEE_CHARGE",
      note: "Link ke akun yang salah",
      employeeCharges: [{ employeeName: "Budi", employeeId: 99, amount: 500 }],
    });

    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("tidak aktif atau tidak ditemukan");
  });

  it("menolak EMPLOYEE_CHARGE tanpa daftar karyawan", async () => {
    const { POST } = await import("./route");
    const { req, params } = callResolve({ disposition: "EMPLOYEE_CHARGE", note: "Lupa isi" });

    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Minimal satu karyawan");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("meresolusi OVERAGE_EXPLAINED untuk selisih plus", async () => {
    itemRow = { ...baseItem, varianceQty: 5, varianceCostValue: 200 };
    const { POST } = await import("./route");
    const { req, params } = callResolve({ disposition: "OVERAGE_EXPLAINED", note: "Salah input satuan minggu lalu" });

    const res = await POST(req, { params });

    expect(res.status).toBe(201);
    expect(insertedResolutions[0]).toMatchObject({ disposition: "OVERAGE_EXPLAINED", varianceQty: 5 });
  });

  it("menolak FOUND untuk selisih plus", async () => {
    itemRow = { ...baseItem, varianceQty: 5 };
    const { POST } = await import("./route");
    const { req, params } = callResolve({ disposition: "FOUND", note: "Salah disposisi" });

    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("selisih minus");
  });

  it("menolak OVERAGE_EXPLAINED untuk selisih minus", async () => {
    const { POST } = await import("./route");
    const { req, params } = callResolve({ disposition: "OVERAGE_EXPLAINED", note: "Salah disposisi" });

    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("selisih plus");
  });

  it("menolak item yang belum memenuhi syarat (bukan SO Besar)", async () => {
    itemRow = { ...baseItem, soType: "DAILY" };
    const { POST } = await import("./route");
    const { req, params } = callResolve({ disposition: "WRITTEN_OFF", note: "x" });

    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("belum memenuhi syarat");
  });

  it("menolak item yang sudah pernah diresolusi", async () => {
    existingResolution = [{ id: 1 }];
    const { POST } = await import("./route");
    const { req, params } = callResolve({ disposition: "WRITTEN_OFF", note: "x" });

    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("sudah pernah diresolusi");
  });

  it("menolak akses ke SO cabang lain", async () => {
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      branchId: 9,
      role: "OWNER",
      permissions: ["stock_opname.resolve"],
      branchScope: "OWN",
    });
    const { POST } = await import("./route");
    const { req, params } = callResolve({ disposition: "WRITTEN_OFF", note: "x" });

    const res = await POST(req, { params });

    expect(res.status).toBe(403);
    expect(insertedResolutions).toHaveLength(0);
  });

  it("menolak user tanpa permission stock_opname.resolve", async () => {
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      branchId: 2,
      role: "MANAGER",
      permissions: ["stock_opname.approve"],
      branchScope: "OWN",
    });
    const { POST } = await import("./route");
    const { req, params } = callResolve({ disposition: "WRITTEN_OFF", note: "x" });

    const res = await POST(req, { params });

    expect(res.status).toBe(403);
    expect(transaction).not.toHaveBeenCalled();
  });
});
