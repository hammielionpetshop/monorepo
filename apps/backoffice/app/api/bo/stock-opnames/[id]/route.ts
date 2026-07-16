import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
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
import { verifyAccessToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_READ_ROLES = ["OWNER", "GM", "MANAGER"];

const paramsSchema = z.object({
  id: z.string().regex(/^\d+$/, "ID tidak valid"),
});

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

    if (!ALLOWED_READ_ROLES.includes(payload.role)) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

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

    if (payload.role === "MANAGER" && payload.branchId !== header.branchId) {
      return NextResponse.json(
        { error: "Akses ditolak. Anda hanya dapat melihat stock opname cabang Anda sendiri." },
        { status: 403 },
      );
    }

    const items = await db
      .select({
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
