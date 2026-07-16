import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import { db, sql, eq, stockOpnames, stockOpnameItems, products } from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const parsedParams = paramsSchema.safeParse({ id });
    if (!parsedParams.success) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    const branchId = getPosBranchId(payload, cookieStore);
    const soId = parsedParams.data.id;

    const [so] = await db
      .select({ id: stockOpnames.id, branchId: stockOpnames.branchId })
      .from(stockOpnames)
      .where(eq(stockOpnames.id, soId))
      .limit(1);

    if (!so) {
      return NextResponse.json(
        { error: "Stock opname tidak ditemukan" },
        { status: 404 },
      );
    }
    if (so.branchId !== branchId) {
      return NextResponse.json(
        { error: "Stock opname bukan milik cabang ini" },
        { status: 403 },
      );
    }

    const counted = await db
      .selectDistinct({ productId: stockOpnameItems.productId })
      .from(stockOpnameItems)
      .where(eq(stockOpnameItems.soId, soId));

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.isActive, true));

    return NextResponse.json({
      countedProductIds: counted.map((c) => c.productId),
      totalActiveProducts: total,
    });
  } catch (error) {
    console.error("POS stock opname progress error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil progres stock opname" },
      { status: 500 },
    );
  }
}
