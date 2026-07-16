import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const transaction = vi.fn();
const applySOStockAdjustment = vi.fn();
const eq = vi.fn((field, value) => ({ type: "eq", field, value }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const stockOpnames = { id: "stockOpnames.id", status: "stockOpnames.status", branchId: "stockOpnames.branchId" };
const stockOpnameItems = { soId: "stockOpnameItems.soId", productId: "stockOpnameItems.productId" };
const products = { id: "products.id", name: "products.name" };

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));
vi.mock("@/lib/db", () => ({
  db: { transaction },
  stockOpnames,
  stockOpnameItems,
  products,
  eq,
}));
vi.mock("@/lib/stock-adjustment", () => ({ applySOStockAdjustment }));

// Kelas asli diuji di lib/services/stock-service.test.ts; di sini yang diuji adalah
// pemetaan error-nya oleh route, jadi cukup tiruan dengan bentuk yang sama.
vi.mock("@/lib/services/stock-service", () => {
  class InsufficientStockError extends Error {
    constructor(
      message: string,
      readonly productId: number,
      readonly shortfallQty: number
    ) {
      super(message);
      this.name = "InsufficientStockError";
    }
  }
  return { InsufficientStockError };
});

const soRow = { id: 5, status: "PENDING", branchId: 2 };
let items: Record<string, unknown>[] = [];
const updatedValues: Record<string, unknown>[] = [];

function buildTx() {
  return {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        if (table === stockOpnames) {
          return {
            where: vi.fn(() => ({
              for: vi.fn(() => ({ limit: vi.fn(async () => [soRow]) })),
            })),
          };
        }
        return {
          innerJoin: vi.fn(() => ({ where: vi.fn(async () => items) })),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updatedValues.push(values);
        return { where: vi.fn(async () => undefined) };
      }),
    })),
  };
}

function callApprove() {
  const req = new NextRequest("http://localhost/api/bo/stock-opnames/5/approve", { method: "PATCH" });
  return { req, params: Promise.resolve({ id: "5" }) };
}

describe("PATCH /api/bo/stock-opnames/[id]/approve", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    updatedValues.length = 0;
    items = [
      { productId: 11, uomId: 1, systemQty: 100, physicalQty: 90, varianceQty: -10, productName: "Royal Canin 1kg" },
    ];
    soRow.status = "PENDING";
    cookieStore.get.mockImplementation((name: string) => {
      if (name === "accessToken") return { value: "token" };
      return undefined;
    });
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      branchId: 2,
      role: "MANAGER",
      permissions: [],
    });
    applySOStockAdjustment.mockResolvedValue(undefined);
    transaction.mockImplementation(async (callback) => callback(buildTx()));
  });

  it("menyetujui SO dan mengisi approvedAt serta completedAt", async () => {
    const { PATCH } = await import("./route");
    const { req, params } = callApprove();

    const res = await PATCH(req, { params });

    expect(res.status).toBe(200);
    expect(applySOStockAdjustment).toHaveBeenCalledTimes(1);
    expect(updatedValues[0]).toMatchObject({ status: "APPROVED", approvedById: 7 });
    expect(updatedValues[0].completedAt).toBeInstanceOf(Date);
    expect(updatedValues[0].approvedAt).toBeInstanceOf(Date);
  });

  it("mengembalikan 422 dengan nama produk saat stok tidak cukup", async () => {
    const { InsufficientStockError } = await import("@/lib/services/stock-service");
    applySOStockAdjustment.mockRejectedValue(
      new InsufficientStockError("Stok tidak cukup. Dibutuhkan 10, tersedia 3.", 11, 7)
    );

    const { PATCH } = await import("./route");
    const { req, params } = callApprove();

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toContain("Royal Canin 1kg");
    expect(data.error).toContain("Dibutuhkan 10, tersedia 3");
    // SO tidak boleh berpindah status saat penyesuaian gagal
    expect(updatedValues).toHaveLength(0);
  });

  it("tetap 500 tanpa membocorkan error internal saat kegagalan bukan soal stok", async () => {
    applySOStockAdjustment.mockRejectedValue(new Error("token database rahasia"));

    const { PATCH } = await import("./route");
    const { req, params } = callApprove();

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({ error: "Terjadi kesalahan saat menyetujui stock opname" });
    expect(JSON.stringify(data)).not.toContain("rahasia");
  });

  it("mengizinkan GM menyetujui SO cabang mana pun", async () => {
    verifyAccessToken.mockResolvedValue({ userId: 3, branchId: 1, role: "GM", permissions: [] });
    const { PATCH } = await import("./route");
    const { req, params } = callApprove();

    // soRow.branchId = 2, sementara GM ada di cabang 1
    const res = await PATCH(req, { params });

    expect(res.status).toBe(200);
    expect(updatedValues[0]).toMatchObject({ status: "APPROVED", approvedById: 3 });
  });

  it("menolak KASIR menyetujui SO", async () => {
    verifyAccessToken.mockResolvedValue({ userId: 4, branchId: 2, role: "KASIR", permissions: [] });
    const { PATCH } = await import("./route");
    const { req, params } = callApprove();

    const res = await PATCH(req, { params });

    expect(res.status).toBe(403);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("menolak MANAGER menyetujui SO cabang lain", async () => {
    verifyAccessToken.mockResolvedValue({ userId: 5, branchId: 9, role: "MANAGER", permissions: [] });
    const { PATCH } = await import("./route");
    const { req, params } = callApprove();

    const res = await PATCH(req, { params });

    expect(res.status).toBe(403);
    expect(updatedValues).toHaveLength(0);
  });

  it("menolak approve SO yang masih DRAFT dengan pesan yang tepat", async () => {
    soRow.status = "DRAFT";
    const { PATCH } = await import("./route");
    const { req, params } = callApprove();

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("masih dihitung");
    expect(applySOStockAdjustment).not.toHaveBeenCalled();
    expect(updatedValues).toHaveLength(0);
  });

  it("melewati item tanpa selisih tanpa menyentuh stok", async () => {
    items = [
      { productId: 11, uomId: 1, systemQty: 100, physicalQty: 100, varianceQty: 0, productName: "Royal Canin 1kg" },
    ];

    const { PATCH } = await import("./route");
    const { req, params } = callApprove();

    const res = await PATCH(req, { params });

    expect(res.status).toBe(200);
    expect(applySOStockAdjustment).not.toHaveBeenCalled();
    expect(updatedValues[0]).toMatchObject({ status: "APPROVED" });
  });
});
