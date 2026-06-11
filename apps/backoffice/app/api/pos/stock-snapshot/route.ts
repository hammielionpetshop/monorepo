import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { verifyAccessToken } from "@/lib/auth";
import { and, db, eq, productStocks, products, sql } from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    const payload = token ? await verifyAccessToken(token) : null;

    if (!payload) {
      return NextResponse.json(
        { error: "Sesi tidak valid, silakan login kembali" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const requestedBranchId = searchParams.get("branchId")
      ? Number(searchParams.get("branchId"))
      : null;
    const branchId = getPosBranchId(payload, cookieStore);

    if (requestedBranchId !== null && requestedBranchId !== branchId) {
      return NextResponse.json(
        { error: "Cabang POS tidak sesuai dengan sesi" },
        { status: 403 },
      );
    }

    const snapshot = await db
      .select({
        id: products.id,
        stock: sql<string>`COALESCE(${productStocks.qty}, '0')`,
      })
      .from(products)
      .leftJoin(
        productStocks,
        and(
          eq(productStocks.productId, products.id),
          eq(productStocks.branchId, branchId),
          eq(productStocks.uomId, products.baseUomId),
        ),
      )
      .where(eq(products.isActive, true));

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("[Stock Snapshot] Error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil snapshot stok" },
      { status: 500 },
    );
  }
}
