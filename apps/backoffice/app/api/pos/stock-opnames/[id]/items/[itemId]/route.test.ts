import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const getPosBranchId = vi.fn();
const transaction = vi.fn();
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
  branchId: "stockOpnames.branchId",
  type: "stockOpnames.type",
  status: "stockOpnames.status",
};
const stockOpnameItems = {
  id: "stockOpnameItems.id",
  soId: "stockOpnameItems.soId",
  productId: "stockOpnameItems.productId",
  uomId: "stockOpnameItems.uomId",
  systemQty: "stockOpnameItems.systemQty",
  physicalQty: "stockOpnameItems.physicalQty",
  varianceQty: "stockOpnameItems.varianceQty",
  itemStatus: "stockOpnameItems.itemStatus",
};
const auditLogs = { id: "auditLogs.id" };

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));
vi.mock("@/lib/pos-branch", () => ({ getPosBranchId }));
vi.mock("@/lib/db", () => ({
  db: { transaction },
  stockOpnames,
  stockOpnameItems,
  auditLogs,
  eq,
  and,
}));

const soRow = { id: 10, branchId: 2, type: "FULL", status: "PENDING" };
let itemRow: Record<string, unknown> | undefined;
// Baris tersisa setelah penghapusan — kosong berarti item terakhir baru saja dibuang.
let remainingRows: Record<string, unknown>[] = [];
const deletedItemIds: unknown[] = [];
const soUpdates: Record<string, unknown>[] = [];
const insertedAuditLogs: Record<string, unknown>[] = [];

function buildTx() {
  return {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        if (table === stockOpnames) {
          return {
            where: vi.fn(() => ({ for: vi.fn(() => ({ limit: vi.fn(async () => [soRow]) })) })),
          };
        }
        // stockOpnameItems dipakai dua kali: ambil item yang dihapus (for update + limit)
        // dan cek sisa item setelahnya (where + limit saja).
        return {
          where: vi.fn(() => ({
            for: vi.fn(() => ({ limit: vi.fn(async () => (itemRow ? [itemRow] : [])) })),
            limit: vi.fn(async () => remainingRows),
          })),
        };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async (cond: { value?: unknown }) => {
        deletedItemIds.push(cond?.value);
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        soUpdates.push(values);
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

function callDelete() {
  const req = new NextRequest("http://localhost/api/pos/stock-opnames/10/items/44", {
    method: "DELETE",
  });
  return { req, params: Promise.resolve({ id: "10", itemId: "44" }) };
}

describe("DELETE /api/pos/stock-opnames/[id]/items/[itemId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    deletedItemIds.length = 0;
    soUpdates.length = 0;
    insertedAuditLogs.length = 0;
    remainingRows = [{ id: 45 }];
    soRow.branchId = 2;
    soRow.type = "FULL";
    soRow.status = "PENDING";
    itemRow = {
      id: 44,
      productId: 88,
      uomId: 3,
      systemQty: 10,
      physicalQty: 4,
      varianceQty: -6,
      itemStatus: "PENDING",
    };
    cookieStore.get.mockImplementation((name: string) =>
      name === "accessToken" ? { value: "token" } : undefined,
    );
    verifyAccessToken.mockResolvedValue({ userId: 7, branchId: 2, role: "KASIR" });
    getPosBranchId.mockReturnValue(2);
    transaction.mockImplementation(async (callback) => callback(buildTx()));
  });

  it("menghapus baris hitungan yang masih menunggu dan mencatat audit", async () => {
    const { DELETE } = await import("./route");
    const { req, params } = callDelete();

    const res = await DELETE(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true, soStatus: "PENDING" });
    expect(deletedItemIds).toEqual([44]);
    expect(insertedAuditLogs[0]).toMatchObject({
      action: "STOCK_OPNAME_ITEM_DELETE",
      tableName: "stock_opname_items",
      recordId: "44",
      userId: 7,
    });
    // Masih ada item lain — status SO tidak diutak-atik.
    expect(soUpdates).toHaveLength(0);
  });

  it("mengembalikan SO ke DRAFT ketika baris terakhir dibatalkan", async () => {
    remainingRows = [];
    const { DELETE } = await import("./route");
    const { req, params } = callDelete();

    const res = await DELETE(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.soStatus).toBe("DRAFT");
    expect(soUpdates[0]).toEqual({ status: "DRAFT" });
  });

  it("tidak menyentuh status SO yang memang masih DRAFT", async () => {
    soRow.status = "DRAFT";
    remainingRows = [];
    const { DELETE } = await import("./route");
    const { req, params } = callDelete();

    const res = await DELETE(req, { params });

    expect(res.status).toBe(200);
    expect(soUpdates).toHaveLength(0);
  });

  it("menolak menghapus item yang sudah diputuskan admin", async () => {
    itemRow = { ...itemRow, itemStatus: "APPROVED" };
    const { DELETE } = await import("./route");
    const { req, params } = callDelete();

    const res = await DELETE(req, { params });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("sudah diputuskan admin");
    expect(deletedItemIds).toHaveLength(0);
  });

  it("menolak item yang sudah ditolak admin", async () => {
    itemRow = { ...itemRow, itemStatus: "REJECTED" };
    const { DELETE } = await import("./route");
    const { req, params } = callDelete();

    const res = await DELETE(req, { params });

    expect(res.status).toBe(409);
    expect(deletedItemIds).toHaveLength(0);
  });

  it("menolak SO yang sudah selesai diproses", async () => {
    soRow.status = "APPROVED";
    const { DELETE } = await import("./route");
    const { req, params } = callDelete();

    const res = await DELETE(req, { params });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("sudah diproses");
    expect(deletedItemIds).toHaveLength(0);
  });

  it("menolak SO Harian", async () => {
    soRow.type = "DAILY";
    const { DELETE } = await import("./route");
    const { req, params } = callDelete();

    const res = await DELETE(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("SO Besar");
  });

  it("menolak SO milik cabang lain", async () => {
    getPosBranchId.mockReturnValue(9);
    const { DELETE } = await import("./route");
    const { req, params } = callDelete();

    const res = await DELETE(req, { params });

    expect(res.status).toBe(403);
    expect(deletedItemIds).toHaveLength(0);
  });

  it("menolak item yang bukan milik SO ini", async () => {
    itemRow = undefined;
    const { DELETE } = await import("./route");
    const { req, params } = callDelete();

    const res = await DELETE(req, { params });

    expect(res.status).toBe(404);
  });

  it("menolak tanpa sesi login", async () => {
    verifyAccessToken.mockResolvedValue(null);
    const { DELETE } = await import("./route");
    const { req, params } = callDelete();

    const res = await DELETE(req, { params });

    expect(res.status).toBe(401);
    expect(transaction).not.toHaveBeenCalled();
  });
});
