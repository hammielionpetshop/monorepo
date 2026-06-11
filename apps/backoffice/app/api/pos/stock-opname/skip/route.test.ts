import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const getPosBranchId = vi.fn();
const transaction = vi.fn();
const insertValues = vi.fn();
const eq = vi.fn((field, value) => ({ type: "eq", field, value }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));

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
  transaction,
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/auth", () => ({ verifyAccessToken }));

vi.mock("@/lib/pos-branch", () => ({ getPosBranchId }));

vi.mock("@/lib/db", () => ({
  db,
  stockOpnames: { id: "stockOpnames.id" },
  notifications: { id: "notifications.id" },
  shifts: {
    id: "shifts.id",
    branchId: "shifts.branchId",
  },
  eq,
  and,
}));

function jsonRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/pos/stock-opname/skip", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    branchId: 999,
    cashierId: 999,
    shiftId: 12,
    reason: "Stok sudah dicek manual sebelum tutup shift",
    ...overrides,
  };
}

describe("POST /api/pos/stock-opname/skip", () => {
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
    db.query.shifts.findFirst.mockResolvedValue({ id: 12, branchId: 2 });
    insertValues.mockImplementation((values: unknown) => ({
      returning: vi.fn(async () => [{ id: 88, values }]),
    }));
    transaction.mockImplementation(async (callback) =>
      callback({
        insert: vi.fn(() => ({ values: insertValues })),
      }),
    );
  });

  it("menolak request tanpa sesi valid dan tidak insert", async () => {
    verifyAccessToken.mockResolvedValue(null);
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validBody()));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: "Sesi tidak valid, silakan login kembali" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("menolak request tanpa content-type JSON dan tidak insert", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/pos/stock-opname/skip", {
      method: "POST",
      body: JSON.stringify(validBody()),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(415);
    expect(data).toEqual({ error: "Content-Type harus application/json" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("menolak reason terlalu pendek dan tidak insert", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validBody({ reason: "  ok " })));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Alasan minimal 3 karakter");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("mengabaikan branchId dan cashierId spoofed saat membuat opname dan notifikasi", async () => {
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validBody()));

    expect(res.status).toBe(201);
    expect(getPosBranchId).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7 }),
      cookieStore,
    );
    expect(insertValues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        branchId: 2,
        createdById: 7,
        shiftId: 12,
        skipReason: "Stok sudah dicek manual sebelum tutup shift",
        type: "DAILY",
        status: "APPROVED",
        isSkipped: true,
      }),
    );
    expect(insertValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        branchId: 2,
        type: "SO_SKIPPED",
        metadata: expect.objectContaining({
          cashierId: 7,
          shiftId: 12,
        }),
      }),
    );
  });

  it("menolak shift beda cabang sebelum insert", async () => {
    db.query.shifts.findFirst.mockResolvedValue(null);
    const { POST } = await import("./route");

    const res = await POST(jsonRequest(validBody()));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data).toEqual({ error: "Shift tidak sesuai dengan cabang POS" });
    expect(eq).toHaveBeenCalledWith("shifts.id", 12);
    expect(eq).toHaveBeenCalledWith("shifts.branchId", 2);
    expect(transaction).not.toHaveBeenCalled();
  });
});
