import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/authz";
import { getLastBulkPrices } from "@/lib/services/last-bulk-price";

export const dynamic = "force-dynamic";

const MAX_PRODUCTS = 200;

function parsePositiveInteger(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(req: NextRequest) {
  const gate = await requirePermission("transaction.bulk_sale");
  if (gate instanceof NextResponse) return gate;
  const payload = gate;

  const { searchParams } = req.nextUrl;
  const branchId = parsePositiveInteger(searchParams.get("branchId"));
  const customerId = parsePositiveInteger(searchParams.get("customerId"));
  if (!branchId || !customerId) {
    return NextResponse.json(
      { error: "branchId dan customerId wajib diisi dengan angka positif" },
      { status: 400 },
    );
  }

  if (payload.branchScope !== "ALL" && branchId !== payload.branchId) {
    return NextResponse.json(
      { error: "Anda tidak memiliki akses ke cabang ini" },
      { status: 403 },
    );
  }

  const productIds = Array.from(
    new Set(
      (searchParams.get("productIds") ?? "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );
  if (productIds.length > MAX_PRODUCTS) {
    return NextResponse.json(
      { error: `Maksimal ${MAX_PRODUCTS} produk per permintaan` },
      { status: 400 },
    );
  }

  try {
    const prices = await getLastBulkPrices(branchId, customerId, productIds);
    return NextResponse.json({ prices });
  } catch (error) {
    console.error("[bulk-sales/last-prices]", error);
    return NextResponse.json(
      { error: "Gagal memuat harga terakhir" },
      { status: 500 },
    );
  }
}
