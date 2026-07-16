import { NextRequest } from "next/server";
import { sql as realSql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyAccessToken = vi.fn();
const fetchStockLedger = vi.fn();

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

vi.mock("@/lib/db", () => ({ db: {}, sql: realSql }));

vi.mock("@/lib/services/stock-ledger", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/stock-ledger")
  >("@/lib/services/stock-ledger");
  return { ...actual, fetchStockLedger };
});

function request(query = "") {
  return new NextRequest(
    `http://localhost/api/bo/inventory/stock-logs${query}`,
  );
}

function setPayload(overrides: Record<string, unknown> = {}) {
  const base = {
    userId: 7,
    userName: "Manager",
    staffNumber: "M-001",
    branchId: 2,
    branchName: "Cabang 2",
    role: "MANAGER",
    permissions: [],
    ...overrides,
  } as Record<string, unknown>;
  const isGlobal = base.role === "OWNER" || base.role === "GM";
  verifyAccessToken.mockResolvedValue({
    ...base,
    branchScope: base.branchScope ?? (isGlobal ? "ALL" : "OWN"),
  });
}

/** Filter yang diterima fetchStockLedger, dirender jadi SQL + params. */
function capturedFilters() {
  const filters = fetchStockLedger.mock.calls[0][0] as ReturnType<
    typeof realSql
  >[];
  const dialect = new PgDialect();
  return filters.map((f) => dialect.sqlToQuery(f));
}

describe("GET /api/bo/inventory/stock-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.get.mockImplementation((name: string) => {
      if (name === "accessToken") return { value: "token" };
      return undefined;
    });
    setPayload();
    fetchStockLedger.mockResolvedValue([]);
  });

  it("menolak request tanpa sesi valid dan tidak query DB", async () => {
    verifyAccessToken.mockResolvedValue(null);
    const { GET } = await import("./route");

    const res = await GET(request());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data).toEqual({ error: "Sesi tidak valid, silakan login kembali" });
    expect(fetchStockLedger).not.toHaveBeenCalled();
  });

  it("mengunci peran non-global ke cabangnya sendiri walau minta cabang lain", async () => {
    const { GET } = await import("./route");

    const res = await GET(request("?branchId=999"));

    expect(res.status).toBe(200);
    const rendered = capturedFilters();
    expect(rendered).toHaveLength(1);
    expect(rendered[0].sql).toBe("sm.branch_id = $1");
    expect(rendered[0].params).toEqual([2]);
  });

  it("mengizinkan GM melihat semua cabang saat tanpa filter cabang", async () => {
    // GM adalah peran global (keputusan 2026-07-16) — sebelumnya ikut terkunci
    // ke satu cabang karena pengecekan hanya `role === 'OWNER'`.
    setPayload({ role: "GM", branchId: 1 });
    const { GET } = await import("./route");

    const res = await GET(request());

    expect(res.status).toBe(200);
    expect(capturedFilters()).toHaveLength(0);
  });

  it("mengizinkan GM memilih cabang tertentu", async () => {
    setPayload({ role: "GM", branchId: 1 });
    const { GET } = await import("./route");

    await GET(request("?branchId=4"));

    const rendered = capturedFilters();
    expect(rendered[0].sql).toBe("sm.branch_id = $1");
    expect(rendered[0].params).toEqual([4]);
  });

  it("mengizinkan owner melihat semua cabang", async () => {
    setPayload({ role: "OWNER", branchId: 1 });
    const { GET } = await import("./route");

    await GET(request());

    expect(capturedFilters()).toHaveLength(0);
  });

  it("menerima DAMAGED_OUT sebagai jenis mutasi", async () => {
    setPayload({ role: "OWNER", branchId: 1 });
    const { GET } = await import("./route");

    const res = await GET(request("?movementType=DAMAGED_OUT"));

    expect(res.status).toBe(200);
    const rendered = capturedFilters();
    expect(rendered[0].sql).toBe("sm.movement_type = $1");
    expect(rendered[0].params).toEqual(["DAMAGED_OUT"]);
  });

  it("menolak jenis mutasi yang tidak dikenal", async () => {
    const { GET } = await import("./route");

    const res = await GET(request("?movementType=DROP_TABLE"));

    expect(res.status).toBe(400);
    expect(fetchStockLedger).not.toHaveBeenCalled();
  });

  it("mencari produk terhapus lewat snapshot nama di item transaksi", async () => {
    setPayload({ role: "OWNER", branchId: 1 });
    const { GET } = await import("./route");

    await GET(request("?q=whiskas"));

    // Produk boleh dihapus (SET NULL) — pencarian tidak boleh hanya melihat
    // products.name, atau mutasi produk terhapus mustahil ditemukan.
    const rendered = capturedFilters();
    expect(rendered[0].sql).toContain("sm.product_name_snapshot");
    expect(rendered[0].sql).toContain("sm.product_sku_snapshot");
  });

  it("menolak rentang tanggal terbalik", async () => {
    const { GET } = await import("./route");

    const res = await GET(request("?startDate=2026-07-16&endDate=2026-07-01"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("startDate tidak boleh lebih besar");
    expect(fetchStockLedger).not.toHaveBeenCalled();
  });

  it("memparameterkan kata kunci pencarian, bukan menyisipkannya ke SQL", async () => {
    setPayload({ role: "OWNER", branchId: 1 });
    const { GET } = await import("./route");

    await GET(request("?q=%27%3B+DROP+TABLE+products--"));

    const rendered = capturedFilters();
    expect(rendered[0].sql).not.toContain("DROP TABLE");
    expect(rendered[0].params).toEqual([
      "%'; DROP TABLE products--%",
      "%'; DROP TABLE products--%",
    ]);
  });

  it("mengembalikan pesan 500 aman tanpa membocorkan error internal", async () => {
    fetchStockLedger.mockRejectedValue(new Error("password db produksi bocor"));
    const { GET } = await import("./route");

    const res = await GET(request());
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data).toEqual({ error: "Gagal mengambil data mutasi stok" });
  });
});
