import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const verifyAccessToken = vi.fn();
const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const insertValues = vi.fn();
const updateWhere = vi.fn();
const transaction = vi.fn();
const findPo = vi.fn();
const selectLimit = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/auth", () => ({ verifyAccessToken }));

vi.mock("@/lib/pos-branch", () => ({
  getPosBranchId: vi.fn(() => 2),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      purchaseOrders: { findFirst: findPo },
    },
    transaction,
  },
  purchaseOrders: {
    id: "purchaseOrders.id",
    branchId: "purchaseOrders.branchId",
    status: "purchaseOrders.status",
    updatedAt: "purchaseOrders.updatedAt",
  },
  purchaseOrderItems: {
    id: "purchaseOrderItems.id",
    poId: "purchaseOrderItems.poId",
    qtyReceived: "purchaseOrderItems.qtyReceived",
    qtyDamaged: "purchaseOrderItems.qtyDamaged",
    expiryDate: "purchaseOrderItems.expiryDate",
  },
  poReceivingLogs: "poReceivingLogs",
  poReceivingItems: "poReceivingItems",
  eq: vi.fn((field, value) => ({ type: "eq", field, value })),
  and: vi.fn((...conditions) => ({ type: "and", conditions })),
  sql: vi.fn((strings, ...values) => ({ strings, values })),
}));

function request(body: Record<string, unknown>) {
  return new NextRequest(
    "http://localhost/api/pos/purchase-orders/10/receive",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    receivedById: 999,
    invoiceReceived: true,
    note: "diterima",
    items: [
      {
        poItemId: 50,
        qtyReceived: 2,
        qtyDamaged: 0,
        expiryDate: null,
        note: null,
      },
    ],
    ...overrides,
  };
}

describe("POST /api/pos/purchase-orders/[id]/receive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      branchId: 2,
      role: "MANAGER",
      permissions: [],
    });
    findPo.mockResolvedValue({ id: 10, branchId: 2, status: "APPROVED" });
    selectLimit.mockResolvedValue([
      { id: 50, poId: 10, qtyOrdered: 5, qtyReceived: 1, qtyDamaged: 0 },
    ]);
    insertValues.mockReturnValue({
      returning: vi.fn(async () => [{ id: 123 }]),
    });
    updateWhere.mockResolvedValue(undefined);
    transaction.mockImplementation(async (callback) =>
      callback({
        insert: vi.fn(() => ({ values: insertValues })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: selectLimit })),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: updateWhere })),
        })),
      }),
    );
  });

  it("uses JWT userId instead of body receivedById", async () => {
    const { POST } = await import("./route");

    const res = await POST(request(validBody()), {
      params: Promise.resolve({ id: "10" }),
    });

    expect(res.status).toBe(200);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ poId: 10, receivedById: 7 }),
    );
  });

  it("rejects item that does not belong to the route PO", async () => {
    selectLimit.mockResolvedValueOnce([]);
    const { POST } = await import("./route");

    const res = await POST(request(validBody()), {
      params: Promise.resolve({ id: "10" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("Item PO");
    expect(updateWhere).not.toHaveBeenCalled();
  });

  it("rejects quantity above remaining item quantity", async () => {
    const { POST } = await import("./route");

    const res = await POST(
      request(
        validBody({
          items: [{ poItemId: 50, qtyReceived: 10, qtyDamaged: 0 }],
        }),
      ),
      { params: Promise.resolve({ id: "10" }) },
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("melebihi sisa");
    expect(updateWhere).not.toHaveBeenCalled();
  });
});
