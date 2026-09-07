import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const transaction = vi.fn();
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
  type: "stockOpnames.type",
  status: "stockOpnames.status",
  branchId: "stockOpnames.branchId",
};

const stockOpnameItems = {
  id: "stockOpnameItems.id",
  soId: "stockOpnameItems.soId",
  itemStatus: "stockOpnameItems.itemStatus",
};

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@/lib/auth", () => ({ verifyAccessToken }));
vi.mock("@/lib/db", () => ({ db: { transaction }, stockOpnames, stockOpnameItems, eq, and }));

const soRow = { id: 5, type: "DAILY", status: "PENDING", branchId: 2 };
// Item APPROVED yang ditemukan saat membatalkan SO Besar — kosong berarti belum ada
// keputusan admin, jadi pembatalan borongan boleh jalan.
let approvedItemRows: Record<string, unknown>[] = [];
const updatedValues: Record<string, unknown>[] = [];
const itemUpdates: Record<string, unknown>[] = [];

function buildTx() {
  return {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        if (table === stockOpnameItems) {
          return { where: vi.fn(() => ({ limit: vi.fn(async () => approvedItemRows) })) };
        }
        return {
          where: vi.fn(() => ({ for: vi.fn(() => ({ limit: vi.fn(async () => [soRow]) })) })),
        };
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: Record<string, unknown>) => {
        if (table === stockOpnameItems) itemUpdates.push(values);
        else updatedValues.push(values);
        return { where: vi.fn(async () => undefined) };
      }),
    })),
  };
}

function callReject(reason = "Salah hitung total") {
  const req = new NextRequest("http://localhost/api/bo/stock-opnames/5/reject", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  return { req, params: Promise.resolve({ id: "5" }) };
}

describe("PATCH /api/bo/stock-opnames/[id]/reject", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    updatedValues.length = 0;
    itemUpdates.length = 0;
    approvedItemRows = [];
    soRow.type = "DAILY";
    soRow.status = "PENDING";
    soRow.branchId = 2;
    cookieStore.get.mockImplementation((name: string) => (name === "accessToken" ? { value: "token" } : undefined));
    verifyAccessToken.mockResolvedValue({
      userId: 7,
      branchId: 2,
      role: "MANAGER",
      permissions: ["stock_opname.approve"],
      branchScope: "OWN",
    });
    transaction.mockImplementation(async (callback) => callback(buildTx()));
  });

  it("menolak SO Harian PENDING dan mengisi rejectionNote", async () => {
    const { PATCH } = await import("./route");
    const { req, params } = callReject("Stok memang minus, sudah dicek ulang");

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(updatedValues[0]).toMatchObject({
      status: "REJECTED",
      rejectedById: 7,
      rejectionNote: "Stok memang minus, sudah dicek ulang",
    });
    // SO Harian tidak punya status per item — tidak ada yang perlu ikut ditutup.
    expect(itemUpdates).toHaveLength(0);
  });

  it("mengizinkan membatalkan SO Besar yang masih DRAFT (belum ada item)", async () => {
    soRow.type = "FULL";
    soRow.status = "DRAFT";
    const { PATCH } = await import("./route");
    const { req, params } = callReject("Salah pilih kategori");

    const res = await PATCH(req, { params });

    expect(res.status).toBe(200);
    expect(updatedValues[0]).toMatchObject({ status: "REJECTED" });
  });

  it("membatalkan SO Besar PENDING dan ikut menutup item yang masih menunggu", async () => {
    soRow.type = "FULL";
    soRow.status = "PENDING";
    const { PATCH } = await import("./route");
    const { req, params } = callReject("Hitungan kacau, diulang besok");

    const res = await PATCH(req, { params });

    expect(res.status).toBe(200);
    expect(itemUpdates[0]).toMatchObject({
      itemStatus: "REJECTED",
      decidedById: 7,
      decisionNote: "Dibatalkan bersama SO: Hitungan kacau, diulang besok",
    });
    expect(updatedValues[0]).toMatchObject({ status: "REJECTED" });
  });

  it("menolak membatalkan SO Besar yang sudah punya item disetujui", async () => {
    soRow.type = "FULL";
    soRow.status = "PENDING";
    approvedItemRows = [{ id: 31 }];
    const { PATCH } = await import("./route");
    const { req, params } = callReject();

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("per item");
    expect(itemUpdates).toHaveLength(0);
    expect(updatedValues).toHaveLength(0);
  });

  it("menolak alasan kosong", async () => {
    const { PATCH } = await import("./route");
    const { req, params } = callReject("");

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("wajib diisi");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("menolak SO yang sudah diproses sebelumnya", async () => {
    soRow.status = "APPROVED";
    const { PATCH } = await import("./route");
    const { req, params } = callReject();

    const res = await PATCH(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("sudah diproses");
  });

  it("menolak MANAGER menolak SO cabang lain", async () => {
    soRow.branchId = 9;
    const { PATCH } = await import("./route");
    const { req, params } = callReject();

    const res = await PATCH(req, { params });

    expect(res.status).toBe(403);
    expect(updatedValues).toHaveLength(0);
  });

  it("menolak KASIR menolak SO", async () => {
    verifyAccessToken.mockResolvedValue({ userId: 4, branchId: 2, role: "KASIR", permissions: [], branchScope: "OWN" });
    const { PATCH } = await import("./route");
    const { req, params } = callReject();

    const res = await PATCH(req, { params });

    expect(res.status).toBe(403);
    expect(transaction).not.toHaveBeenCalled();
  });
});
