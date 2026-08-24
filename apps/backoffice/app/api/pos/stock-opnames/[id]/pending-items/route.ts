import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import { db, eq, and, stockOpnames, stockOpnameItems, products, unitsOfMeasure } from "@/lib/db";
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
      .select({ id: stockOpnames.id, branchId: stockOpnames.branchId, type: stockOpnames.type })
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

    // Bukan error keras — cabang lama sebelum fitur ini cuma tidak akan punya item
    // PENDING, jadi hasilnya kosong secara alami untuk SO Harian.
    if (so.type !== "FULL") {
      return NextResponse.json([]);
    }

    // Review buta seperti hitungan pertama: kasir cuma lihat nama produk yang perlu
    // dihitung ulang, bukan systemQty/varianceQty — supaya tidak "menyesuaikan" hitungan.
    const items = await db
      .select({
        itemId: stockOpnameItems.id,
        productId: stockOpnameItems.productId,
        productName: products.name,
        sku: products.sku,
        uomId: stockOpnameItems.uomId,
        uomCode: unitsOfMeasure.code,
        isRecounted: stockOpnameItems.isRecounted,
      })
      .from(stockOpnameItems)
      .innerJoin(products, eq(stockOpnameItems.productId, products.id))
      .innerJoin(unitsOfMeasure, eq(stockOpnameItems.uomId, unitsOfMeasure.id))
      .where(and(eq(stockOpnameItems.soId, soId), eq(stockOpnameItems.itemStatus, "PENDING")));

    return NextResponse.json(items);
  } catch (error) {
    console.error("POS stock opname pending-items error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil daftar item yang perlu dihitung ulang" },
      { status: 500 },
    );
  }
}
