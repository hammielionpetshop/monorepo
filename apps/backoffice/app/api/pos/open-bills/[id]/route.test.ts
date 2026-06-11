import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const eq = vi.fn((left, right) => ({ type: "eq", left, right }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const where = vi.fn();
const db = { delete: vi.fn() };

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));
vi.mock("@/lib/db", () => ({
  db,
  openBills: { id: "openBills.id", branchId: "openBills.branchId" },
  eq,
  and,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  verifyAccessToken.mockResolvedValue({
    userId: 7,
    branchId: 2,
    role: "KASIR",
  });
  where.mockResolvedValue([{ id: 5 }]);
  db.delete.mockReturnValue({ where });
});

describe("DELETE /api/pos/open-bills/[id]", () => {
  it("deletes by id and session branch", async () => {
    const { DELETE } = await import("./route");

    const res = await DELETE(
      new NextRequest("http://localhost/api/pos/open-bills/5", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "5" }) },
    );

    expect(res.status).toBe(200);
    expect(where).toHaveBeenCalledWith(
      and(eq("openBills.id", 5), eq("openBills.branchId", 2)),
    );
  });
});
