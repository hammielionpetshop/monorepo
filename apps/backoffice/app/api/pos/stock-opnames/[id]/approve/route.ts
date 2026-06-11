import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import { getPosBranchId } from "@/lib/pos-branch";
import { db, stockOpnames, stockOpnameItems, eq } from "@/lib/db";
import { applySOStockAdjustment } from "@/lib/stock-adjustment";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive("ID tidak valid"),
});

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    const payload = token ? await verifyAccessToken(token) : null;
    if (!payload) {
      return NextResponse.json({ error: "Sesi tidak valid, silakan login kembali" }, { status: 401 });
    }

    const branchId = getPosBranchId(payload, cookieStore);
    const actorId = Number(payload.userId);
    if (!Number.isInteger(actorId) || actorId <= 0) {
      return NextResponse.json({ error: "Sesi tidak valid, silakan login kembali" }, { status: 401 });
    }

    const paramParsed = paramsSchema.safeParse(await params);
    if (!paramParsed.success) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    const updatedSo = await db.transaction(async (tx) => {
      const soRows = await tx
        .select()
        .from(stockOpnames)
        .where(eq(stockOpnames.id, paramParsed.data.id))
        .for("update")
        .limit(1);

      const so = soRows[0];
      if (!so) throw new Error("SO_NOT_FOUND");
      if (so.branchId !== branchId) throw new Error("BRANCH_FORBIDDEN");
      if (so.status !== "PENDING") throw new Error("ALREADY_PROCESSED");

      const items = await tx
        .select()
        .from(stockOpnameItems)
        .where(eq(stockOpnameItems.soId, paramParsed.data.id));

      if (items.length === 0) throw new Error("SO_HAS_NO_ITEMS");

      for (const item of items) {
        await applySOStockAdjustment(tx, {
          productId: item.productId,
          branchId: so.branchId,
          uomId: item.uomId,
          systemQty: Number(item.systemQty),
          physicalQty: Number(item.physicalQty),
          currentUserId: actorId,
        });
      }

      const [updated] = await tx
        .update(stockOpnames)
        .set({
          status: "APPROVED",
          approvedById: actorId,
          approvedAt: new Date(),
          completedAt: new Date(),
        })
        .where(eq(stockOpnames.id, paramParsed.data.id))
        .returning();

      return updated;
    });

    return NextResponse.json({ success: true, so: updatedSo });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === "SO_NOT_FOUND") {
        return NextResponse.json({ error: "Stock opname tidak ditemukan" }, { status: 404 });
      }
      if (error.message === "BRANCH_FORBIDDEN") {
        return NextResponse.json({ error: "Stock opname bukan milik cabang ini" }, { status: 403 });
      }
      if (error.message === "ALREADY_PROCESSED") {
        return NextResponse.json({ error: "Stock opname sudah diproses" }, { status: 409 });
      }
      if (error.message === "SO_HAS_NO_ITEMS") {
        return NextResponse.json({ error: "Stock opname belum memiliki item" }, { status: 400 });
      }
    }

    console.error("PATCH /api/pos/stock-opnames/[id]/approve error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan saat menyetujui stock opname" }, { status: 500 });
  }
}
