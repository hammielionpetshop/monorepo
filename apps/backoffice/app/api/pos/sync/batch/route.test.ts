import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const createTransaction = vi.fn();
const eq = vi.fn((left, right) => ({ type: "eq", left, right }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));
const branchWhere = vi.fn();

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const db = {
  query: {
    shifts: {
      findFirst: vi.fn(),
    },
  },
  select: vi.fn(),
  update: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/auth", () => ({
  verifyAccessToken,
}));

vi.mock("@/lib/services/transaction-service", () => ({
  TransactionService: {
    createTransaction,
  },
}));

vi.mock("@/lib/db", () => ({
  db,
  branches: { id: "branches.id", lastSeenAt: "branches.lastSeenAt" },
  shifts: {
    id: "shifts.id",
    branchId: "shifts.branchId",
    status: "shifts.status",
  },
  shiftCashierSessions: {
    shiftId: "shiftCashierSessions.shiftId",
    cashierId: "shiftCashierSessions.cashierId",
    status: "shiftCashierSessions.status",
  },
  eq,
  and,
}));

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    branchId: 2,
    shiftId: 10,
    cashierId: 7,
    customerId: null,
    items: [
      {
        productId: 1,
        productName: "Produk A",
        uomId: 1,
        uomCode: "PCS",
        qty: 1,
        unitPrice: 10000,
        priceTier: "RETAIL",
        discountAmount: 0,
        subtotal: 10000,
        isOwnerOverride: false,
      },
    ],
    totals: {
      subtotal: 10000,
      discountTotal: 0,
      grandTotal: 10000,
      itemCount: 1,
    },
    amountPaid: 10000,
    change: 0,
    payments: [{ paymentMethodId: 1, amount: 10000, referenceNumber: null }],
    offlineAt: Date.now(),
    localTrxNumber: "LOCAL-1",
    authorizedOversell: true,
    ...overrides,
  };
}

function batchRequest(payload: unknown) {
  return new NextRequest("http://localhost/api/pos/sync/batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function batch(transactions: unknown[]) {
  return { deviceId: "device-1", transactions };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  cookieStore.get.mockImplementation((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  });
  verifyAccessToken.mockResolvedValue({
    userId: 7,
    userName: "Kasir",
    branchId: 2,
    branchName: "Pusat",
    role: "KASIR",
    permissions: [],
  });
  db.query.shifts.findFirst.mockResolvedValue({
    id: 10,
    branchId: 2,
    status: "OPEN",
  });
  db.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ cashierId: 7 }]),
      }),
    }),
  });
  db.update.mockReturnValue({
    set: vi.fn().mockReturnValue({ where: branchWhere }),
  });
  createTransaction.mockResolvedValue({ id: 99, trxNumber: "TRX-1" });
});

describe("POST /api/pos/sync/batch", () => {
  it("marks spoofed branch item failed without creating transaction", async () => {
    const { POST } = await import("./route");

    const res = await POST(
      batchRequest(
        batch([{ id: "op-1", payload: validPayload({ branchId: 999 }) }]),
      ),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.synced).toEqual([]);
    expect(json.failed[0]).toMatchObject({ id: "op-1" });
    expect(json.failed[0].reason.toLowerCase()).toContain("cabang");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("uses session branch and cashier, forwards authorizedOversell as boolean without oversellApprovedAt", async () => {
    const { POST } = await import("./route");

    const res = await POST(
      batchRequest(batch([{ id: "op-1", payload: validPayload() }])),
    );

    expect(res.status).toBe(200);
    // authorizedOversell diteruskan (untuk audit log OVERSELL), oversellApprovedAt tetap dibuang
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ authorizedOversell: true }),
    );
    expect(createTransaction).toHaveBeenCalledWith(
      expect.not.objectContaining({ oversellApprovedAt: expect.anything() }),
    );
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        branchId: 2,
        cashierId: 7,
        createdOffline: true,
      }),
    );
    expect(branchWhere).toHaveBeenCalledWith(eq("branches.id", 2));
  });
});
