import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import { db, eq, and, stockOpnames, stockOpnameItems, auditLogs } from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";
import { resolveSnapshotQty } from "@/lib/so-count-snapshot";
import { closeFullSoIfResolved } from "@/lib/services/stock-opname";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
  itemId: z.coerce.number().int().positive(),
});
const bodySchema = z.object({
  recountPhysicalQty: z.coerce.number().min(0),
  snapshotToken: z.string().min(1, "Snapshot hitungan wajib ada"),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
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

    const { id, itemId } = await params;
    const parsedParams = paramsSchema.safeParse({ id, itemId });
    if (!parsedParams.success) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    const body = await req.json();
    const parsedBody = bodySchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 },
      );
    }

    const branchId = getPosBranchId(payload, cookieStore);
    const soId = parsedParams.data.id;
    const currentUserId = Number(payload.userId);
    const { recountPhysicalQty, snapshotToken } = parsedBody.data;

    const result = await db.transaction(async (tx) => {
      const [so] = await tx
        .select({ id: stockOpnames.id, branchId: stockOpnames.branchId, type: stockOpnames.type })
        .from(stockOpnames)
        .where(eq(stockOpnames.id, soId))
        .for("update")
        .limit(1);

      if (!so) throw new Error("SO_NOT_FOUND");
      if (so.branchId !== branchId) throw new Error("BRANCH_FORBIDDEN");
      if (so.type !== "FULL") throw new Error("NOT_FULL_SO");

      const [item] = await tx
        .select({
          id: stockOpnameItems.id,
          productId: stockOpnameItems.productId,
          uomId: stockOpnameItems.uomId,
          itemStatus: stockOpnameItems.itemStatus,
        })
        .from(stockOpnameItems)
        .where(and(eq(stockOpnameItems.id, parsedParams.data.itemId), eq(stockOpnameItems.soId, soId)))
        .for("update")
        .limit(1);

      if (!item) throw new Error("ITEM_NOT_FOUND");
      if (item.itemStatus !== "PENDING") throw new Error("ITEM_NOT_PENDING");

      // Snapshot BARU, bukan systemQty hitungan pertama — stok bisa sudah bergerak
      // (penjualan) sejak hitungan awal, jadi hitung ulang dibandingkan ke stok saat ini.
      const recountSystemQty = await resolveSnapshotQty(snapshotToken, {
        branchId,
        productId: item.productId,
        uomId: item.uomId,
      });
      if (recountSystemQty === null) throw new Error("INVALID_SNAPSHOT");

      const recountVarianceQty = recountPhysicalQty - recountSystemQty;
      // Ternyata pas di hitungan kedua — selisih pertama cuma salah hitung, selesai
      // otomatis seperti hitungan awal yang pas. Kalau masih beda, tetap PENDING
      // menunggu keputusan admin.
      const resolvedNow = recountVarianceQty === 0;

      await tx
        .update(stockOpnameItems)
        .set({
          isRecounted: true,
          recountPhysicalQty,
          recountSystemQty,
          recountVarianceQty,
          recountedById: currentUserId,
          recountedAt: new Date(),
          itemStatus: resolvedNow ? "MATCHED" : "PENDING",
        })
        .where(eq(stockOpnameItems.id, item.id));

      await tx.insert(auditLogs).values({
        branchId: so.branchId,
        userId: currentUserId,
        action: "STOCK_OPNAME_ITEM_RECOUNT",
        tableName: "stock_opname_items",
        recordId: String(item.id),
        oldData: JSON.stringify({ itemStatus: "PENDING" }),
        newData: JSON.stringify({
          recountPhysicalQty,
          recountSystemQty,
          recountVarianceQty,
          itemStatus: resolvedNow ? "MATCHED" : "PENDING",
        }),
      });

      const soClosed = resolvedNow ? await closeFullSoIfResolved(tx, soId, currentUserId) : false;

      return { itemStatus: resolvedNow ? "MATCHED" : "PENDING", soClosed };
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === "SO_NOT_FOUND") {
        return NextResponse.json({ error: "Stock opname tidak ditemukan" }, { status: 404 });
      }
      if (error.message === "BRANCH_FORBIDDEN") {
        return NextResponse.json({ error: "Stock opname bukan milik cabang ini" }, { status: 403 });
      }
      if (error.message === "NOT_FULL_SO") {
        return NextResponse.json(
          { error: "Hitung ulang cuma berlaku untuk SO Besar" },
          { status: 400 },
        );
      }
      if (error.message === "ITEM_NOT_FOUND") {
        return NextResponse.json({ error: "Item tidak ditemukan pada stock opname ini" }, { status: 404 });
      }
      if (error.message === "ITEM_NOT_PENDING") {
        return NextResponse.json(
          { error: "Item ini sudah cocok atau sudah diputuskan, tidak perlu dihitung ulang" },
          { status: 409 },
        );
      }
      if (error.message === "INVALID_SNAPSHOT") {
        return NextResponse.json(
          { error: "Snapshot hitungan tidak valid atau kedaluwarsa, silakan hitung ulang produk tersebut" },
          { status: 400 },
        );
      }
    }
    console.error("PATCH /api/pos/stock-opnames/[id]/items/[itemId]/recount error:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan hasil hitung ulang" },
      { status: 500 },
    );
  }
}
