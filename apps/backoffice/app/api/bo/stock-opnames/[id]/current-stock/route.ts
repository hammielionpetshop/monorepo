import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  and,
  db,
  eq,
  inArray,
  productStocks,
  productUomConversions,
  stockOpnameItems,
  stockOpnames,
} from "@/lib/db";
import { requirePermission } from "@/lib/authz";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, "ID tidak valid"),
});

/**
 * Stok sistem yang tersimpan di stockOpnameItems.systemQty adalah snapshot saat
 * item dihitung — bisa basi kalau ada transaksi lain (penjualan, PO, adjustment)
 * di cabang yang sama selagi SO menunggu persetujuan. Endpoint ini membaca stok
 * live dari productStocks agar approver bisa membandingkan sebelum menyetujui,
 * tanpa mengubah snapshot yang sudah dipakai untuk hitung selisih.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const gate = await requirePermission("stock_opname.read");
    if (gate instanceof NextResponse) return gate;
    const payload = gate;

    const { id } = await params;
    const parsed = paramsSchema.safeParse({ id });
    if (!parsed.success) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    const soId = Number(parsed.data.id);

    const [header] = await db
      .select({ id: stockOpnames.id, branchId: stockOpnames.branchId })
      .from(stockOpnames)
      .where(eq(stockOpnames.id, soId))
      .limit(1);

    if (!header) {
      return NextResponse.json(
        { error: "Stock opname tidak ditemukan" },
        { status: 404 },
      );
    }

    if (payload.branchScope !== "ALL" && payload.branchId !== header.branchId) {
      return NextResponse.json(
        { error: "Akses ditolak. Anda hanya dapat melihat stock opname cabang Anda sendiri." },
        { status: 403 },
      );
    }

    const items = await db
      .select({
        id: stockOpnameItems.id,
        productId: stockOpnameItems.productId,
        uomId: stockOpnameItems.uomId,
      })
      .from(stockOpnameItems)
      .where(eq(stockOpnameItems.soId, soId));

    if (items.length === 0) {
      return NextResponse.json({ items: [], fetchedAt: new Date().toISOString() });
    }

    const productIds = [...new Set(items.map((item) => item.productId))];

    const stockRows = await db
      .select({
        productId: productStocks.productId,
        qty: productStocks.qty,
        ratio: productUomConversions.ratio,
      })
      .from(productStocks)
      .leftJoin(
        productUomConversions,
        and(
          eq(productUomConversions.productId, productStocks.productId),
          eq(productUomConversions.uomId, productStocks.uomId),
        ),
      )
      .where(
        and(
          inArray(productStocks.productId, productIds),
          eq(productStocks.branchId, header.branchId),
        ),
      );

    const baseQtyByProduct = new Map<number, number>();
    for (const row of stockRows) {
      const add = Number(row.qty) * (row.ratio ?? 1);
      baseQtyByProduct.set(row.productId, (baseQtyByProduct.get(row.productId) ?? 0) + add);
    }

    const conversions = await db
      .select({
        productId: productUomConversions.productId,
        uomId: productUomConversions.uomId,
        ratio: productUomConversions.ratio,
      })
      .from(productUomConversions)
      .where(inArray(productUomConversions.productId, productIds));

    const ratioByKey = new Map(
      conversions.map((c) => [`${c.productId}:${c.uomId}`, c.ratio]),
    );

    const result = items.map((item) => {
      const itemUomRatio = ratioByKey.get(`${item.productId}:${item.uomId}`) ?? 1;
      const totalBaseQty = baseQtyByProduct.get(item.productId) ?? 0;
      return {
        itemId: item.id,
        currentSystemQty: Math.floor(totalBaseQty / itemUomRatio),
      };
    });

    return NextResponse.json({ items: result, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error("GET /api/bo/stock-opnames/[id]/current-stock error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengambil stok terkini" },
      { status: 500 },
    );
  }
}
