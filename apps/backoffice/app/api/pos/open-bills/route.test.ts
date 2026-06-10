import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const eq = vi.fn((left, right) => ({ type: "eq", left, right }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));
const desc = vi.fn((column) => ({ type: "desc", column }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const values = vi.fn();
const returning = vi.fn();
const selectChain = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn() };
const db = { select: vi.fn(), insert: vi.fn() };

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));
vi.mock("@/lib/db", () => ({
  db,
  openBills: {
    id: "openBills.id",
    branchId: "openBills.branchId",
    createdAt: "openBills.createdAt",
  },
  eq,
  and,
  desc,
}));

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/pos/open-bills", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    branchId: 2,
    shiftId: 10,
    billName: "Bill A",
    items: [{ productId: 1, qty: 1 }],
    customerId: null,
    totalAmount: 10000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  verifyAccessToken.mockResolvedValue({
    userId: 7,
    branchId: 2,
    role: "KASIR",
  });
  selectChain.from.mockReturnValue(selectChain);
  selectChain.where.mockReturnValue(selectChain);
  selectChain.orderBy.mockResolvedValue([]);
  db.select.mockReturnValue(selectChain);
  values.mockReturnValue({ returning });
  returning.mockResolvedValue([{ id: 1, branchId: 2 }]);
  db.insert.mockReturnValue({ values });
});

describe("/api/pos/open-bills", () => {
  it("rejects spoofed branch on create", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(payload({ branchId: 999 })));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain("Cabang");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("inserts open bill with session branch", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(payload()));

    expect(res.status).toBe(200);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 2 }),
    );
  });
});
