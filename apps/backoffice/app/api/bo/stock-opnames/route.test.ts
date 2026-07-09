import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const transaction = vi.fn();
const select = vi.fn();
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
  branchId: "stockOpnames.branchId",
  status: "stockOpnames.status",
};

const insertedValues: Record<string, unknown>[] = [];

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/auth", () => ({ verifyAccessToken }));

vi.mock("@/lib/db", () => ({
  db: { transaction, select },
  stockOpnames,
  eq,
  and,
}));

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/bo/stock-opnames", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    branchId: 2,
    categoryScope: [1, 2],
    assignedUserIds: [7],
    notes: "cek bulanan",
    ...overrides,
  };
}

function setPayload(overrides: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    userId: 7,
    userName: "Manager",
    staffNumber: "M-001",
    branchId: 2,
    branchName: "Cabang 2",
    role: "MANAGER",
    ...overrides,
  };
  const isGlobal = base.role === "OWNER" || base.role === "GM";
  verifyAccessToken.mockResolvedValue({
    ...base,
    permissions: base.permissions ?? ["stock_opname.create", "stock_opname.read", "stock_opname.approve"],
    branchScope: base.branchScope ?? (isGlobal ? "ALL" : "OWN"),
  });
}

describe("POST /api/bo/stock-opnames", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    insertedValues.length = 0;
    cookieStore.get.mockImplementation((name: string) => {
      if (name === "accessToken") return { value: "token" };
      return undefined;
    });
    setPayload();
    select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
      })),
    });
    transaction.mockImplementation(async (callback) =>
      callback({
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        })),
        insert: vi.fn(() => ({
          values: vi.fn((values: Record<string, unknown>) => {
            insertedValues.push(values);
            return {
              returning: vi.fn(async () => [
                { id: 10, soNumber: "SO-FULL-20260611-000001" },
              ]),
            };
          }),
        })),
      }),
    );
  });

  it("menolak manager membuat stock opname untuk cabang lain", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validBody({ branchId: 3 })));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({
      error: "Anda hanya dapat membuat stock opname untuk cabang sendiri",
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("membuat stock opname manager dengan cabang sendiri dan actor dari token", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validBody({ branchId: 2 })));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual({
      success: true,
      so: { id: 10, soNumber: "SO-FULL-20260611-000001" },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(insertedValues[0]).toMatchObject({ branchId: 2, createdById: 7 });
  });

  it("mengizinkan GM membuat stock opname untuk cabang pilihan", async () => {
    setPayload({ role: "GM", branchId: 1, userId: 9 });
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validBody({ branchId: 4 })));

    expect(res.status).toBe(201);
    expect(insertedValues[0]).toMatchObject({ branchId: 4, createdById: 9 });
  });

  it("mengizinkan owner membuat stock opname untuk cabang pilihan", async () => {
    setPayload({ role: "OWNER", branchId: 1, userId: 11 });
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validBody({ branchId: 5 })));

    expect(res.status).toBe(201);
    expect(insertedValues[0]).toMatchObject({ branchId: 5, createdById: 11 });
  });
});
