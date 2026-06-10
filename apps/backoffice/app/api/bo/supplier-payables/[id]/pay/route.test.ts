import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: "token" }) })),
}));

const verifyAccessToken = vi.fn();
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));

const transaction = vi.fn();
vi.mock("@/lib/db", () => ({
  db: { transaction },
  supplierPayables: {
    id: "supplierPayables.id",
    poId: "supplierPayables.poId",
    paidAmount: "supplierPayables.paidAmount",
    totalAmount: "supplierPayables.totalAmount",
    status: "supplierPayables.status",
  },
  purchaseOrders: {
    id: "purchaseOrders.id",
    branchId: "purchaseOrders.branchId",
  },
  supplierPayablePayments: {},
  eq: vi.fn((left, right) => ({ left, right, op: "eq" })),
  and: vi.fn((...conditions) => ({ conditions, op: "and" })),
  sql: vi.fn((strings, ...values) => ({ strings, values, op: "sql" })),
}));

describe("POST supplier payable payment", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      branchId: 2,
      role: "FINANCE",
      permissions: [],
    });
  });

  it("rejects non-positive amount before transaction", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://test.local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: 0, method: "CASH", paidById: 999 }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "10" }) });

    expect(res.status).toBe(400);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("uses JWT userId instead of paidById from body", async () => {
    const { POST } = await import("./route");
    const insertedValues: unknown[] = [];

    transaction.mockImplementation(async (callback) =>
      callback({
        select: () => ({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: async () => [
                  {
                    id: 10,
                    branchId: 2,
                    status: "UNPAID",
                    totalAmount: 100000,
                    paidAmount: 0,
                  },
                ],
              }),
            }),
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => ({
              returning: async () => [
                { id: 10, paidAmount: 25000, status: "PARTIAL" },
              ],
            }),
          }),
        }),
        insert: () => ({
          values: (values: Record<string, unknown>) => {
            insertedValues.push(values);
            return { returning: async () => [{ id: 1, ...values }] };
          },
        }),
      }),
    );

    const req = new Request("http://test.local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amount: 25000, method: "CASH", paidById: 999 }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "10" }) });

    expect(res.status).toBe(201);
    expect(insertedValues[0]).toMatchObject({ paidById: 7 });
  });
});
