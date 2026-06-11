import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const getPosBranchId = vi.fn();
const transaction = vi.fn();
const headerLimit = vi.fn();
const headerForUpdate = vi.fn(() => ({ limit: headerLimit }));
const updateSet = vi.fn();
const eq = vi.fn((field, value) => ({ type: "eq", field, value }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/auth", () => ({ verifyAccessToken }));

vi.mock("@/lib/pos-branch", () => ({ getPosBranchId }));

vi.mock("@/lib/db", () => ({
  db: { transaction },
  eq,
  stockOpnames: {
    id: "stockOpnames.id",
    branchId: "stockOpnames.branchId",
    status: "stockOpnames.status",
  },
}));

function jsonRequest(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/pos/stock-opnames/10/reject", {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

function setupTransaction() {
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ for: headerForUpdate, limit: headerLimit })),
      })),
    })),
    update: vi.fn(() => ({ set: updateSet })),
  };

  transaction.mockImplementation(async (callback) => callback(tx));
}

describe("PATCH /api/pos/stock-opnames/[id]/reject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    cookieStore.get.mockImplementation((name: string) => {
      if (name === "accessToken") return { value: "token" };
      return undefined;
    });
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      userName: "Kasir",
      staffNumber: "K-001",
      branchId: 2,
      branchName: "Cabang 2",
      role: "KASIR",
      permissions: [],
    });
    getPosBranchId.mockReturnValue(2);
    headerLimit.mockResolvedValue([{ id: 10, branchId: 2, status: "PENDING" }]);
    updateSet.mockReturnValue({
      where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 10 }]) })),
    });
    setupTransaction();
  });

  it("menolak request tanpa content-type JSON", async () => {
    const { PATCH } = await import("./route");

    const res = await PATCH(jsonRequest({ reason: "Salah hitung" }), {
      params: Promise.resolve({ id: "10" }),
    });
    const data = await res.json();

    expect(res.status).toBe(415);
    expect(data).toEqual({ error: "Content-Type harus application/json" });
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("menolak reject untuk stock opname cabang lain", async () => {
    headerLimit.mockResolvedValueOnce([{ id: 10, branchId: 9, status: "PENDING" }]);
    const { PATCH } = await import("./route");

    const res = await PATCH(
      jsonRequest({ rejectedById: 999, reason: "Salah hitung" }, { "content-type": "application/json" }),
      { params: Promise.resolve({ id: "10" }) },
    );
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: "Stock opname bukan milik cabang ini" });
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("menggunakan user JWT sebagai rejectedById", async () => {
    const { PATCH } = await import("./route");

    const res = await PATCH(
      jsonRequest({ rejectedById: 999, reason: "Salah hitung" }, { "content-type": "application/json" }),
      { params: Promise.resolve({ id: "10" }) },
    );

    expect(res.status).toBe(200);
    expect(getPosBranchId).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7 }),
      cookieStore,
    );
    expect(headerForUpdate).toHaveBeenCalledWith("update");
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ rejectedById: 7, rejectionNote: "Salah hitung" }),
    );
  });
});
