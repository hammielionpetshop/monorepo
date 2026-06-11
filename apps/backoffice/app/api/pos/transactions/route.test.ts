import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const createTransaction = vi.fn();
const eq = vi.fn((left, right) => ({ type: "eq", left, right }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    if (name === "posBranchId") return { value: "2" };
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
      },
    ],
    payments: [{ paymentMethodId: 1, amount: 10000, referenceNumber: null }],
    totals: {
      subtotal: 10000,
      discountTotal: 0,
      grandTotal: 10000,
      itemCount: 1,
    },
    amountPaid: 10000,
    change: 0,
    ...overrides,
  };
}

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/pos/transactions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.get.mockImplementation((name: string) => {
    if (name === "accessToken") return { value: "token" };
    if (name === "posBranchId") return { value: "2" };
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
  createTransaction.mockResolvedValue({ id: 99, trxNumber: "TRX-1" });
});

describe("POST /api/pos/transactions", () => {
  it("rejects spoofed cashierId from request body", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload({ cashierId: 999 })));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain("kasir");
    expect(createTransaction).not.toHaveBeenCalled();
  });

  it("uses JWT cashierId and POS session branchId for valid payload", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validPayload()));

    expect(res.status).toBe(201);
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 2, cashierId: 7 }),
    );
  });
});
