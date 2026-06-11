import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const eq = vi.fn((left, right) => ({ type: "eq", left, right }));
const or = vi.fn((...conditions) => ({ type: "or", conditions }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const selectChain = {
  from: vi.fn(),
  innerJoin: vi.fn(),
  where: vi.fn(),
};

const db = { select: vi.fn() };

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));
vi.mock("@/lib/db", () => ({
  db,
  users: {
    id: "users.id",
    name: "users.name",
    roleId: "users.roleId",
    branchId: "users.branchId",
  },
  roles: { id: "roles.id", name: "roles.name" },
  eq,
  or,
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
  selectChain.from.mockReturnValue(selectChain);
  selectChain.innerJoin.mockReturnValue(selectChain);
  selectChain.where.mockResolvedValue([]);
  db.select.mockReturnValue(selectChain);
});

describe("GET /api/pos/users", () => {
  it("rejects spoofed branch query without running users query", async () => {
    const { GET } = await import("./route");

    const res = await GET(
      new NextRequest("http://localhost/api/pos/users?branchId=999"),
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain("Cabang");
    expect(db.select).not.toHaveBeenCalled();
  });
});
