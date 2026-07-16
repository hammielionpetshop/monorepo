import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const eq = vi.fn((field, value) => ({ type: "eq", field, value }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const stockOpnames = {
  id: "stockOpnames.id",
  soNumber: "stockOpnames.soNumber",
  type: "stockOpnames.type",
  status: "stockOpnames.status",
  branchId: "stockOpnames.branchId",
  notes: "stockOpnames.notes",
  createdAt: "stockOpnames.createdAt",
  createdById: "stockOpnames.createdById",
};
const stockOpnameItems = {
  soId: "stockOpnameItems.soId",
  productId: "stockOpnameItems.productId",
  uomId: "stockOpnameItems.uomId",
  systemQty: "stockOpnameItems.systemQty",
  physicalQty: "stockOpnameItems.physicalQty",
  varianceQty: "stockOpnameItems.varianceQty",
  varianceCostValue: "stockOpnameItems.varianceCostValue",
  varianceReason: "stockOpnameItems.varianceReason",
};
const branches = { id: "branches.id", name: "branches.name" };
const users = { id: "users.id", name: "users.name" };
const products = { id: "products.id", name: "products.name" };
const unitsOfMeasure = { id: "unitsOfMeasure.id", code: "unitsOfMeasure.code" };
const sql = vi.fn((strings, ...values) => ({ strings, values }));

const headerLimit = vi.fn();
const itemWhere = vi.fn();
const itemRows = [
  {
    productId: 11,
    productName: "Royal Canin 1kg",
    uomId: 1,
    uomCode: "PCS",
    systemQty: 100,
    physicalQty: 95,
    varianceQty: -5,
    varianceCostValue: 25000,
    varianceReason: "Rusak",
  },
];

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/auth", () => ({ verifyAccessToken }));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn((selection) => ({
      from: vi.fn((table) => {
        if (table === stockOpnames) {
          return {
            innerJoin: vi.fn(() => ({
              leftJoin: vi.fn(() => ({
                where: vi.fn(() => ({ limit: headerLimit })),
              })),
            })),
          };
        }

        if (table === stockOpnameItems) {
          return {
            innerJoin: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                where: itemWhere,
              })),
            })),
          };
        }

        throw new Error(`unexpected table ${String(table)}`);
      }),
    })),
  },
  stockOpnames,
  stockOpnameItems,
  branches,
  users,
  products,
  unitsOfMeasure,
  eq,
  and,
  sql,
}));

function request() {
  return new NextRequest("http://localhost/api/bo/stock-opnames/5");
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

describe("GET /api/bo/stock-opnames/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cookieStore.get.mockImplementation((name: string) => {
      if (name === "accessToken") return { value: "token" };
      return undefined;
    });
    setPayload();
    headerLimit.mockResolvedValue([
      {
        id: 5,
        soNumber: "SO-FULL-001",
        type: "FULL",
        status: "PENDING",
        branchId: 2,
        branchName: "Cabang 2",
        createdByName: "Budi",
        createdAt: new Date("2026-07-16T08:00:00.000Z"),
        notes: "Hitung pagi",
      },
    ]);
    itemWhere.mockResolvedValue(itemRows);
  });

  it("mengembalikan header dan item detail untuk approver valid", async () => {
    const { GET } = await import("./route");

    const res = await GET(request(), { params: Promise.resolve({ id: "5" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.header).toMatchObject({
      id: 5,
      soNumber: "SO-FULL-001",
      branchName: "Cabang 2",
      createdByName: "Budi",
      notes: "Hitung pagi",
      itemCount: 1,
    });
    expect(data.items).toEqual(itemRows);
  });

  it("menolak role di luar owner/gm/manager", async () => {
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
});
