import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const transaction = vi.fn();
const eq = vi.fn((field, value) => ({ type: "eq", field, value }));
const and = vi.fn((...conditions) => ({ type: "and", conditions }));
const isNull = vi.fn((field) => ({ type: "isNull", field }));

const cookieStore = {
  get: vi.fn((name: string) => {
    if (name === "accessToken") return { value: "token" };
    return undefined;
  }),
};

const soVarianceResolutions = {
  id: "soVarianceResolutions.id",
  branchId: "soVarianceResolutions.branchId",
  voidedAt: "soVarianceResolutions.voidedAt",
};
const auditLogs = { id: "auditLogs.id" };

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));
vi.mock("@/lib/db", () => ({
  db: { transaction },
  soVarianceResolutions,
  auditLogs,
  eq,
  and,
  isNull,
}));

let resolutionRow: Record<string, unknown> | null = {
  id: 501,
  branchId: 2,
  disposition: "WRITTEN_OFF",
  stockAdjustmentId: null,
};
const updates: Record<string, unknown>[] = [];
const insertedAuditLogs: Record<string, unknown>[] = [];

function buildTx() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ for: vi.fn(() => ({ limit: vi.fn(async () => (resolutionRow ? [resolutionRow] : [])) })) })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        updates.push(values);
        return { where: vi.fn(async () => undefined) };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: Record<string, unknown>) => {
        insertedAuditLogs.push(values);
      }),
    })),
  };
}

function callVoid(body: unknown, resolutionId = "501") {
  const req = new NextRequest(`http://localhost/api/bo/stock-opnames/resolutions/${resolutionId}/void`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { req, params: Promise.resolve({ resolutionId }) };
}

describe("POST /api/bo/stock-opnames/resolutions/[resolutionId]/void", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resolutionRow = { id: 501, branchId: 2, disposition: "WRITTEN_OFF", stockAdjustmentId: null };
    updates.length = 0;
    insertedAuditLogs.length = 0;
    cookieStore.get.mockImplementation((name: string) => {
      if (name === "accessToken") return { value: "token" };
      return undefined;
    });
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      branchId: 2,
      role: "OWNER",
      permissions: ["stock_opname.resolve"],
      branchScope: "OWN",
    });
    transaction.mockImplementation(async (callback) => callback(buildTx()));
  });

  it("mem-void resolusi dengan alasan", async () => {
    const { POST } = await import("./route");
    const { req, params } = callVoid({ reason: "Salah pilih disposisi" });

    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(updates[0]).toMatchObject({ voidedBy: 7, voidReason: "Salah pilih disposisi" });
    expect(insertedAuditLogs[0]).toMatchObject({ action: "SO_VARIANCE_RESOLUTION_VOID" });
    expect(data).toMatchObject({ id: 501, hadStockAdjustment: false });
  });

  it("menolak void resolusi yang tidak ditemukan atau sudah pernah di-void", async () => {
    resolutionRow = null;
    const { POST } = await import("./route");
    const { req, params } = callVoid({});

    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("tidak ditemukan");
  });

  it("menolak void resolusi cabang lain", async () => {
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      branchId: 9,
      role: "OWNER",
      permissions: ["stock_opname.resolve"],
      branchScope: "OWN",
    });
    const { POST } = await import("./route");
    const { req, params } = callVoid({});

    const res = await POST(req, { params });

    expect(res.status).toBe(403);
    expect(updates).toHaveLength(0);
  });
});
