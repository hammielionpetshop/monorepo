import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const select = vi.fn();
const eq = vi.fn((field, value) => ({ type: "eq", field, value }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));
const desc = vi.fn((field) => ({ type: "desc", field }));
const sql = vi.fn((strings, ...values) => ({ type: "sql", strings, values }));

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
  shiftId: "stockOpnames.shiftId",
  type: "stockOpnames.type",
  status: "stockOpnames.status",
  createdById: "stockOpnames.createdById",
  createdAt: "stockOpnames.createdAt",
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/auth", () => ({ verifyAccessToken }));

vi.mock("@/lib/db", () => ({
  db: { select },
  stockOpnames,
  eq,
  and,
  desc,
  sql,
}));

function request(query = "") {
  return new NextRequest(
    `http://localhost/api/bo/stock-opnames/history${query}`,
  );
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
    permissions: base.permissions ?? ["stock_opname.read"],
    branchScope: base.branchScope ?? (isGlobal ? "ALL" : "OWN"),
  });
}

function setupSelect(result: unknown[] = [{ id: 10, branchId: 2 }]) {
  const limit = vi.fn(async () => result);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  select.mockReturnValue({ from });
  return { from, where, orderBy, limit };
}

describe("GET /api/bo/stock-opnames/history", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    cookieStore.get.mockImplementation((name: string) => {
      if (name === "accessToken") return { value: "token" };
      return undefined;
    });
    setPayload();
    setupSelect();
  });

  it("menolak manager membaca riwayat cabang lain", async () => {
    const { GET } = await import("./route");

    const res = await GET(request("?branchId=3"));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({
      error: "Anda hanya dapat melihat riwayat stock opname cabang sendiri",
    });
    expect(select).not.toHaveBeenCalled();
  });

  it("memakai cabang token untuk manager dan mempertahankan filter shift serta status", async () => {
    const { GET } = await import("./route");

    const res = await GET(request("?shiftId=5&status=PENDING"));

    expect(res.status).toBe(200);
    // Scope cabang MANAGER kini via scopeFilter (drizzle eq internal, di-unit-test di authz),
    // jadi tak tampak di mock eq @/lib/db. Yang penting: filter shift & status tetap jalan,
    // dan tak ada kebocoran ke cabang lain yang diminta.
    expect(eq).toHaveBeenCalledWith("stockOpnames.shiftId", 5);
    expect(eq).toHaveBeenCalledWith("stockOpnames.status", "PENDING");
    expect(eq).not.toHaveBeenCalledWith("stockOpnames.branchId", 3);
  });

  it("mengizinkan owner memfilter cabang pilihan", async () => {
    setPayload({ role: "OWNER", branchId: 1, userId: 11 });
    const { GET } = await import("./route");

    const res = await GET(request("?branchId=4&status=APPROVED"));

    expect(res.status).toBe(200);
    expect(eq).toHaveBeenCalledWith("stockOpnames.branchId", 4);
    expect(eq).toHaveBeenCalledWith("stockOpnames.status", "APPROVED");
  });

  it("mengizinkan GM memfilter cabang pilihan", async () => {
    setPayload({ role: "GM", branchId: 1, userId: 9 });
    const { GET } = await import("./route");

    const res = await GET(request("?branchId=5&status=REJECTED"));

    expect(res.status).toBe(200);
    expect(eq).toHaveBeenCalledWith("stockOpnames.branchId", 5);
    expect(eq).toHaveBeenCalledWith("stockOpnames.status", "REJECTED");
  });

  it("mengembalikan pesan 500 aman tanpa membocorkan error internal", async () => {
    const limit = vi.fn(async () => {
      throw new Error("password db produksi bocor");
    });
    select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({ limit })),
        })),
      })),
    });
    const { GET } = await import("./route");

    const res = await GET(request());
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({ error: "Gagal mengambil riwayat stock opname" });
  });
});
