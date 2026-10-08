import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const requirePermission = vi.fn();
const getLastBulkPrices = vi.fn();

vi.mock("@/lib/authz", () => ({ requirePermission }));
vi.mock("@/lib/services/last-bulk-price", () => ({ getLastBulkPrices }));

const { GET } = await import("./route");

function request(query: string) {
  return new NextRequest(`http://localhost/api/bo/bulk-sales/last-prices?${query}`);
}

describe("GET /api/bo/bulk-sales/last-prices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermission.mockResolvedValue({ userId: 1, branchId: 7, branchScope: "OWN" });
    getLastBulkPrices.mockResolvedValue([]);
  });

  it("meneruskan penolakan permission", async () => {
    requirePermission.mockResolvedValue(NextResponse.json({ error: "x" }, { status: 403 }));
    const response = await GET(request("branchId=7&customerId=3&productIds=1"));
    expect(response.status).toBe(403);
    expect(getLastBulkPrices).not.toHaveBeenCalled();
  });

  it("menolak tanpa customerId", async () => {
    const response = await GET(request("branchId=7&productIds=1"));
    expect(response.status).toBe(400);
  });

  it("menolak cabang lain bila scope bukan ALL", async () => {
    const response = await GET(request("branchId=8&customerId=3&productIds=1"));
    expect(response.status).toBe(403);
    expect(getLastBulkPrices).not.toHaveBeenCalled();
  });

  it("membuang id tidak valid & duplikat lalu mengembalikan harga", async () => {
    const prices = [{ productId: 1, uomId: 2, unitPrice: 125000, discountAmount: 0, qty: 3, trxNumber: "TRX-1", soldAt: "2026-10-01T03:00:00Z" }];
    getLastBulkPrices.mockResolvedValue(prices);
    const response = await GET(request("branchId=7&customerId=3&productIds=1,abc,1,-4,5"));
    expect(response.status).toBe(200);
    expect(getLastBulkPrices).toHaveBeenCalledWith(7, 3, [1, 5]);
    expect(await response.json()).toEqual({ prices });
  });

  it("menolak terlalu banyak produk", async () => {
    const ids = Array.from({ length: 201 }, (_, index) => index + 1).join(",");
    const response = await GET(request(`branchId=7&customerId=3&productIds=${ids}`));
    expect(response.status).toBe(400);
  });
});
