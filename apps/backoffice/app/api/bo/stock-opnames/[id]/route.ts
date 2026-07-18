import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  and,
  branches,
  db,
  eq,
  products,
  sql,
  stockOpnameItems,
  stockOpnames,
  unitsOfMeasure,
  users,
} from "@/lib/db";
import { requirePermission } from "@/lib/authz";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, "ID tidak valid"),
});

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

    const soRows = await db
      .select({
        id: stockOpnames.id,
        soNumber: stockOpnames.soNumber,
        type: stockOpnames.type,
        status: stockOpnames.status,
        branchId: stockOpnames.branchId,
        branchName: branches.name,
        createdByName: sql<string>`COALESCE(${users.name}, 'User dihapus')`,
        createdAt: stockOpnames.createdAt,
        notes: stockOpnames.notes,
      })
      .from(stockOpnames)
      .innerJoin(branches, eq(stockOpnames.branchId, branches.id))
      .leftJoin(users, eq(stockOpnames.createdById, users.id))
      .where(eq(stockOpnames.id, soId))
      .limit(1);

    if (soRows.length === 0) {
      return NextResponse.json(
        { error: "Stock opname tidak ditemukan" },
        { status: 404 },
      );
    }

    const header = soRows[0];

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
        productName: products.name,
        uomId: stockOpnameItems.uomId,
        uomCode: unitsOfMeasure.code,
        systemQty: stockOpnameItems.systemQty,
        physicalQty: stockOpnameItems.physicalQty,
        varianceQty: stockOpnameItems.varianceQty,
        varianceCostValue: stockOpnameItems.varianceCostValue,
        varianceReason: stockOpnameItems.varianceReason,
      })
      .from(stockOpnameItems)
      .innerJoin(products, eq(stockOpnameItems.productId, products.id))
      .innerJoin(unitsOfMeasure, eq(stockOpnameItems.uomId, unitsOfMeasure.id))
      .where(and(eq(stockOpnameItems.soId, soId)));

    return NextResponse.json({
      header: {
        id: header.id,
        soNumber: header.soNumber,
        type: header.type,
        status: header.status,
        branchName: header.branchName,
        createdByName: header.createdByName,
        createdAt: header.createdAt,
        notes: header.notes,
        itemCount: items.length,
      },
      items,
    });
  } catch (error) {
    console.error("GET /api/bo/stock-opnames/[id] error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengambil detail stock opname" },
      { status: 500 },
    );
  }
}
