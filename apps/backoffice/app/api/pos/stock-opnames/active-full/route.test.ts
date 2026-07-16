import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const getPosBranchId = vi.fn();
const select = vi.fn();
const eq = vi.fn((field, value) => ({ type: "eq", field, value }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));
const inArray = vi.fn((field, values) => ({ type: "inArray", field, values }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const db = { select };
const from = vi.fn();
const where = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/auth", () => ({ verifyAccessToken }));

vi.mock("@/lib/pos-branch", () => ({ getPosBranchId }));

vi.mock("@/lib/db", () => ({
  db,
  stockOpnames: {
    branchId: "stockOpnames.branchId",
    type: "stockOpnames.type",
    status: "stockOpnames.status",
    isSkipped: "stockOpnames.isSkipped",
  },
  eq,
  and,
  inArray,
}));

function request(query = "") {
  return new NextRequest(
    `http://localhost/api/pos/stock-opnames/active-full${query}`,
  );
}

describe("GET /api/pos/stock-opnames/active-full", () => {
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
      staffNumber: "K-001",
      branchId: 2,
      branchName: "Cabang 2",
      role: "KASIR",
      permissions: [],
    });
    getPosBranchId.mockReturnValue(2);
    where.mockResolvedValue([{ id: 10, branchId: 2 }]);
    from.mockReturnValue({ where });
    select.mockReturnValue({ from });
  });

  it("menolak request tanpa sesi valid dan tidak query DB", async () => {
    verifyAccessToken.mockResolvedValue(null);
    const { GET } = await import("./route");

    const res = await GET(request("?branchId=2"));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: "Sesi tidak valid, silakan login kembali" });
    expect(select).not.toHaveBeenCalled();
  });

  it("mengabaikan branchId query dan memakai cabang POS terpercaya", async () => {
    const { GET } = await import("./route");

    const res = await GET(request("?branchId=999"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual([{ id: 10, branchId: 2 }]);
    expect(getPosBranchId).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7 }),
      cookieStore,
    );
    expect(eq).toHaveBeenCalledWith("stockOpnames.branchId", 2);
    expect(eq).toHaveBeenCalledWith("stockOpnames.type", "FULL");
    // POS harus menemukan SO Besar yang belum dihitung (DRAFT) maupun yang sudah
    // ada hitungannya tapi belum disetujui (PENDING, submit bertahap)
    expect(inArray).toHaveBeenCalledWith("stockOpnames.status", ["DRAFT", "PENDING"]);
    expect(eq).toHaveBeenCalledWith("stockOpnames.isSkipped", false);
    expect(eq).not.toHaveBeenCalledWith("stockOpnames.branchId", 999);
  });

  it("mengembalikan pesan 500 aman tanpa membocorkan error internal", async () => {
    where.mockRejectedValue(new Error("password db produksi bocor"));
    const { GET } = await import("./route");

    const res = await GET(request("?branchId=2"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({ error: "Gagal mengambil stock opname aktif" });
  });
});
