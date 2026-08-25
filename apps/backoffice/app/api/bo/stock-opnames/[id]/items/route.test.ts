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

const stockOpnames = {
  id: "stockOpnames.id",
  soNumber: "stockOpnames.soNumber",
  status: "stockOpnames.status",
  branchId: "stockOpnames.branchId",
  type: "stockOpnames.type",
};
const stockOpnameItems = {
  id: "stockOpnameItems.id",
  soId: "stockOpnameItems.soId",
  productId: "stockOpnameItems.productId",
  uomId: "stockOpnameItems.uomId",
  systemQty: "stockOpnameItems.systemQty",
  physicalQty: "stockOpnameItems.physicalQty",
  varianceQty: "stockOpnameItems.varianceQty",
  varianceCostValue: "stockOpnameItems.varianceCostValue",
  varianceReason: "stockOpnameItems.varianceReason",
  itemStatus: "stockOpnameItems.itemStatus",
};
const auditLogs = { id: "auditLogs.id" };

const headerLimit = vi.fn();
const itemsWhere = vi.fn();
const updateSet = vi.fn();
const insertValues = vi.fn();
const computeItemVariance = vi.fn();
// Sama seperti implementasi asli resolveItemStatus: cuma berarti untuk SO type FULL.
const resolveItemStatus = vi.fn((type: string, varianceQty: number) =>
  type !== "FULL" ? null : varianceQty === 0 ? "MATCHED" : "PENDING",
);

const tx = {
  select: vi.fn(() => ({
    from: vi.fn((table) => {
      if (table === stockOpnames) {
        return { where: vi.fn(() => ({ for: vi.fn(() => ({ limit: headerLimit })) })) };
      }
      if (table === stockOpnameItems) {
        return { where: itemsWhere };
      }
      throw new Error(`unexpected table ${String(table)}`);
    }),
  })),
  update: vi.fn(() => ({ set: updateSet })),
  insert: vi.fn(() => ({ values: insertValues })),
};

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));
vi.mock("@/lib/services/stock-opname", () => ({ computeItemVariance, resolveItemStatus }));

vi.mock("@/lib/db", () => ({
  db: { transaction: vi.fn(async (cb) => cb(tx)) },
  stockOpnames,
  stockOpnameItems,
  auditLogs,
  eq,
  and,
  inArray,
}));

function request(body: unknown) {
  return new NextRequest("http://localhost/api/bo/stock-opnames/5/items", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setPayload(overrides: Record<string, unknown> = {}) {
  const base = {
    userId: 7,
    userName: "Owner",
    branchId: 2,
    role: "OWNER",
    ...overrides,
  } as Record<string, unknown>;
  const isGlobal = base.role === "OWNER" || base.role === "GM";
  verifyAccessToken.mockResolvedValue({
    ...base,
    permissions: base.permissions ?? (isGlobal ? ["stock_opname.edit_item"] : []),
    branchScope: base.branchScope ?? (isGlobal ? "ALL" : "OWN"),
  });
}

const validBody = { items: [{ id: 31, physicalQty: 90, varianceReason: "Hilang" }] };

describe("PATCH /api/bo/stock-opnames/[id]/items", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cookieStore.get.mockImplementation((name: string) =>
      name === "accessToken" ? { value: "token" } : undefined,
    );
    setPayload();
    headerLimit.mockResolvedValue([
      { id: 5, status: "PENDING", branchId: 2, soNumber: "SO-FULL-001" },
    ]);
    itemsWhere.mockResolvedValue([
      {
        id: 31,
        productId: 11,
        uomId: 1,
        systemQty: 100,
        physicalQty: 95,
        varianceQty: -5,
        varianceCostValue: 25000,
        varianceReason: "Rusak",
        itemStatus: null,
      },
    ]);
    computeItemVariance.mockResolvedValue({
      productId: 11,
      uomId: 1,
      systemQty: 100,
      physicalQty: 90,
      varianceQty: -10,
      varianceCostValue: 50000,
    });
    updateSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    insertValues.mockResolvedValue(undefined);
  });

  it("menyimpan koreksi & menghitung ulang selisih dari qty fisik", async () => {
    const { PATCH } = await import("./route");

    const res = await PATCH(request(validBody), { params: Promise.resolve({ id: "5" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toEqual([
      {
        id: 31,
        physicalQty: 90,
        varianceQty: -10,
        varianceCostValue: 50000,
        varianceReason: "Hilang",
        itemStatus: null, // SO tanpa type='FULL' di test ini — status per-item tidak berarti
      },
    ]);
    // systemQty snapshot dipertahankan supaya baseline tidak bergeser ke stok terkini.
    expect(computeItemVariance).toHaveBeenCalledWith(tx, 2, {
      productId: 11,
      uomId: 1,
      physicalQty: 90,
      systemQtyOverride: 100,
    });
    expect(updateSet).toHaveBeenCalledWith({
      physicalQty: 90,
      varianceQty: -10,
      varianceCostValue: 50000,
      varianceReason: "Hilang",
      itemStatus: null,
      isRecounted: false,
      recountPhysicalQty: null,
      recountSystemQty: null,
      recountVarianceQty: null,
      recountedById: null,
      recountedAt: null,
    });
  });

  it("SO Besar: menandai item MATCHED kalau koreksi menghilangkan selisih", async () => {
    headerLimit.mockResolvedValue([
      { id: 5, status: "PENDING", branchId: 2, soNumber: "SO-FULL-001", type: "FULL" },
    ]);
    computeItemVariance.mockResolvedValue({
      productId: 11,
      uomId: 1,
      systemQty: 100,
      physicalQty: 100,
      varianceQty: 0,
      varianceCostValue: 0,
    });
    const { PATCH } = await import("./route");

    const res = await PATCH(request({ items: [{ id: 31, physicalQty: 100 }] }), {
      params: Promise.resolve({ id: "5" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items[0].itemStatus).toBe("MATCHED");
  });

  it("menolak koreksi pada item yang sudah diputuskan admin", async () => {
    itemsWhere.mockResolvedValue([
      {
        id: 31,
        productId: 11,
        uomId: 1,
        systemQty: 100,
        physicalQty: 95,
        varianceQty: -5,
        varianceCostValue: 25000,
        varianceReason: "Rusak",
        itemStatus: "APPROVED",
      },
    ]);
    const { PATCH } = await import("./route");

    const res = await PATCH(request(validBody), { params: Promise.resolve({ id: "5" }) });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("sudah diputuskan admin");
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("mencatat audit log berisi nilai lama dan baru", async () => {
    const { PATCH } = await import("./route");

    await PATCH(request(validBody), { params: Promise.resolve({ id: "5" }) });

    expect(insertValues).toHaveBeenCalledTimes(1);
    const logged = insertValues.mock.calls[0][0];
    expect(logged).toMatchObject({
      branchId: 2,
      userId: 7,
      action: "STOCK_OPNAME_ITEM_EDIT",
      tableName: "stock_opname_items",
      recordId: "31",
    });
    expect(JSON.parse(logged.oldData)).toMatchObject({ physicalQty: 95, varianceReason: "Rusak" });
    expect(JSON.parse(logged.newData)).toMatchObject({ physicalQty: 90, varianceReason: "Hilang" });
  });

  it("menolak user tanpa permission stock_opname.edit_item", async () => {
    setPayload({ role: "MANAGER", permissions: ["stock_opname.approve"] });
    const { PATCH } = await import("./route");

    const res = await PATCH(request(validBody), { params: Promise.resolve({ id: "5" }) });

    expect(res.status).toBe(403);
    expect(headerLimit).not.toHaveBeenCalled();
  });

  it("menolak koreksi lintas cabang", async () => {
    setPayload({ role: "MANAGER", branchId: 9, permissions: ["stock_opname.edit_item"] });
    const { PATCH } = await import("./route");

    const res = await PATCH(request(validBody), { params: Promise.resolve({ id: "5" }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("cabang");
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("menolak koreksi pada SO yang sudah disetujui", async () => {
    headerLimit.mockResolvedValue([
      { id: 5, status: "APPROVED", branchId: 2, soNumber: "SO-FULL-001" },
    ]);
    const { PATCH } = await import("./route");

    const res = await PATCH(request(validBody), { params: Promise.resolve({ id: "5" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("sudah diproses");
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("menolak item milik stock opname lain", async () => {
    itemsWhere.mockResolvedValue([]);
    const { PATCH } = await import("./route");

    const res = await PATCH(request(validBody), { params: Promise.resolve({ id: "5" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("tidak ditemukan");
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("menolak qty fisik negatif", async () => {
    const { PATCH } = await import("./route");

    const res = await PATCH(request({ items: [{ id: 31, physicalQty: -1 }] }), {
      params: Promise.resolve({ id: "5" }),
    });

    expect(res.status).toBe(400);
    expect(updateSet).not.toHaveBeenCalled();
  });
});
