import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const getPosBranchId = vi.fn();
const resolveSnapshotQty = vi.fn();
const transaction = vi.fn();
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
const auditLogs = { id: "auditLogs.id" };

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));
vi.mock("@/lib/pos-branch", () => ({ getPosBranchId }));
vi.mock("@/lib/so-count-snapshot", () => ({ resolveSnapshotQty }));
vi.mock("@/lib/db", () => ({
  db: { transaction },
  stockOpnames,
  stockOpnameItems,
  auditLogs,
  eq,
  and,
}));

const soRow = { id: 10, branchId: 2, type: "FULL" };
let itemRow: Record<string, unknown> | undefined;
let remainingPendingRows: Record<string, unknown>[] = [];
const itemUpdates: Record<string, unknown>[] = [];
const soUpdates: Record<string, unknown>[] = [];
const insertedAuditLogs: Record<string, unknown>[] = [];

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
        // stockOpnameItems dipakai dua kali: ambil item yang direcount (for update +
        // limit), dan query "remaining" dari closeFullSoIfResolved (where + limit saja).
        return {
          where: vi.fn(() => ({
            for: vi.fn(() => ({ limit: vi.fn(async () => (itemRow ? [itemRow] : [])) })),
            limit: vi.fn(async () => remainingPendingRows),
          })),
        };
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: Record<string, unknown>) => {
        if (table === stockOpnameItems) itemUpdates.push(values);
        else soUpdates.push(values);
        return { where: vi.fn(async () => undefined) };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: Record<string, unknown>) => {
        insertedAuditLogs.push(values);
      }),
    })),
  };
}

function callRecount(body: Record<string, unknown>, ids: { id?: string; itemId?: string } = {}) {
  const req = new NextRequest("http://localhost/api/pos/stock-opnames/10/items/31/recount", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    req,
    params: Promise.resolve({ id: ids.id ?? "10", itemId: ids.itemId ?? "31" }),
  };
}

function validBody(overrides: Record<string, unknown> = {}) {
  return { recountPhysicalQty: 95, snapshotToken: "fresh-token", ...overrides };
}

describe("PATCH /api/pos/stock-opnames/[id]/items/[itemId]/recount", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    itemUpdates.length = 0;
    soUpdates.length = 0;
    insertedAuditLogs.length = 0;
    soRow.branchId = 2;
    soRow.type = "FULL";
    itemRow = { id: 31, productId: 11, uomId: 1, itemStatus: "PENDING" };
    remainingPendingRows = [];
    cookieStore.get.mockImplementation((name: string) => (name === "accessToken" ? { value: "token" } : undefined));
    verifyAccessToken.mockResolvedValue({ userId: 7, branchId: 2, role: "KASIR", permissions: [] });
    getPosBranchId.mockReturnValue(2);
    resolveSnapshotQty.mockResolvedValue(95); // sama dengan recountPhysicalQty di validBody = pas
    transaction.mockImplementation(async (callback) => callback(buildTx()));
  });

  it("menandai item MATCHED begitu hitung ulang ternyata pas, dan menutup SO", async () => {
    remainingPendingRows = []; // tidak ada item pending lain
    const { PATCH } = await import("./route");
    const { req, params } = callRecount(validBody());

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ itemStatus: "MATCHED", soClosed: true });
    expect(itemUpdates[0]).toMatchObject({
      isRecounted: true,
      recountPhysicalQty: 95,
      recountSystemQty: 95,
      recountVarianceQty: 0,
      itemStatus: "MATCHED",
    });
    expect(soUpdates[0]).toMatchObject({ status: "APPROVED" });
    expect(insertedAuditLogs[0]).toMatchObject({ action: "STOCK_OPNAME_ITEM_RECOUNT" });
  });

  it("tidak menutup SO kalau masih ada item pending lain setelah MATCHED", async () => {
    remainingPendingRows = [{ id: 99 }];
    const { PATCH } = await import("./route");
    const { req, params } = callRecount(validBody());

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(data.soClosed).toBe(false);
    expect(soUpdates).toHaveLength(0);
  });

  it("tetap PENDING kalau hitung ulang masih beda dari sistem, tidak menutup SO", async () => {
    resolveSnapshotQty.mockResolvedValue(80); // fisik 95 vs sistem 80 = masih selisih 15
    const { PATCH } = await import("./route");
    const { req, params } = callRecount(validBody());

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ itemStatus: "PENDING", soClosed: false });
    expect(itemUpdates[0]).toMatchObject({
      recountVarianceQty: 15,
      itemStatus: "PENDING",
    });
    expect(soUpdates).toHaveLength(0);
  });

  it("menolak snapshot tidak valid/kedaluwarsa", async () => {
    resolveSnapshotQty.mockResolvedValue(null);
    const { PATCH } = await import("./route");
    const { req, params } = callRecount(validBody());

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("hitung ulang");
    expect(itemUpdates).toHaveLength(0);
  });

  it("menolak SO Harian (bukan FULL)", async () => {
    soRow.type = "DAILY";
    const { PATCH } = await import("./route");
    const { req, params } = callRecount(validBody());

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("SO Besar");
  });

  it("menolak item yang bukan milik cabang ini", async () => {
    soRow.branchId = 9;
    const { PATCH } = await import("./route");
    const { req, params } = callRecount(validBody());

    const res = await PATCH(req, { params });

    expect(res.status).toBe(403);
    expect(itemUpdates).toHaveLength(0);
  });

  it("menolak item yang sudah tidak PENDING", async () => {
    itemRow = { id: 31, productId: 11, uomId: 1, itemStatus: "APPROVED" };
    const { PATCH } = await import("./route");
    const { req, params } = callRecount(validBody());

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("tidak perlu dihitung ulang");
  });

  it("menolak item yang tidak ditemukan pada SO ini", async () => {
    itemRow = undefined;
    const { PATCH } = await import("./route");
    const { req, params } = callRecount(validBody());

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("tidak ditemukan");
  });

  it("menolak request tanpa sesi valid", async () => {
    verifyAccessToken.mockResolvedValue(null);
    const { PATCH } = await import("./route");
    const { req, params } = callRecount(validBody());

    const res = await PATCH(req, { params });

    expect(res.status).toBe(401);
    expect(transaction).not.toHaveBeenCalled();
  });
});
