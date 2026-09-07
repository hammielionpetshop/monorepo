import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import { db, eq, and, stockOpnames, stockOpnameItems, auditLogs } from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
  itemId: z.coerce.number().int().positive(),
});

/**
 * Batalkan satu baris hitungan kasir dari SO Besar — untuk produk yang salah
 * dipindai/salah dihitung, yang tanpa ini cuma bisa dihitung ulang (recount) dan
 * tetap menyeret admin memutuskan baris yang sebetulnya tidak pernah dimaksud ada.
 */
export async function DELETE(
  _req: NextRequest,
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

    const branchId = getPosBranchId(payload, cookieStore);
    const currentUserId = Number(payload.userId);
    if (!Number.isInteger(currentUserId) || currentUserId <= 0) {
      return NextResponse.json(
        { error: "Sesi tidak valid, silakan login kembali" },
        { status: 401 },
      );
    }

    const soId = parsedParams.data.id;

    const result = await db.transaction(async (tx) => {
      const [so] = await tx
        .select({
          id: stockOpnames.id,
          branchId: stockOpnames.branchId,
          type: stockOpnames.type,
          status: stockOpnames.status,
        })
        .from(stockOpnames)
        .where(eq(stockOpnames.id, soId))
        .for("update")
        .limit(1);

      if (!so) throw new Error("SO_NOT_FOUND");
      if (so.branchId !== branchId) throw new Error("BRANCH_FORBIDDEN");
      if (so.type !== "FULL") throw new Error("NOT_FULL_SO");
      if (so.status !== "DRAFT" && so.status !== "PENDING") {
        throw new Error("ALREADY_PROCESSED");
      }

      const [item] = await tx
        .select({
          id: stockOpnameItems.id,
          productId: stockOpnameItems.productId,
          uomId: stockOpnameItems.uomId,
          systemQty: stockOpnameItems.systemQty,
          physicalQty: stockOpnameItems.physicalQty,
          varianceQty: stockOpnameItems.varianceQty,
          itemStatus: stockOpnameItems.itemStatus,
        })
        .from(stockOpnameItems)
        .where(
          and(eq(stockOpnameItems.id, parsedParams.data.itemId), eq(stockOpnameItems.soId, soId)),
        )
        .for("update")
        .limit(1);

      if (!item) throw new Error("ITEM_NOT_FOUND");
      // Sama seperti add-items: begitu admin memutuskan, stok sudah disesuaikan
      // berdasarkan angka baris ini — menghapusnya akan menghapus bukti penyesuaian
      // yang sudah terjadi.
      if (item.itemStatus === "APPROVED" || item.itemStatus === "REJECTED") {
        throw new Error("ITEM_DECIDED");
      }

      await tx.delete(stockOpnameItems).where(eq(stockOpnameItems.id, item.id));

      await tx.insert(auditLogs).values({
        branchId: so.branchId,
        userId: currentUserId,
        action: "STOCK_OPNAME_ITEM_DELETE",
        tableName: "stock_opname_items",
        recordId: String(item.id),
        oldData: JSON.stringify({
          soId,
          productId: item.productId,
          uomId: item.uomId,
          systemQty: item.systemQty,
          physicalQty: item.physicalQty,
          varianceQty: item.varianceQty,
          itemStatus: item.itemStatus,
        }),
        newData: null,
      });

      // Baris terakhir dihapus → SO kembali seperti belum pernah dihitung. Kebalikan
      // dari add-items yang menaikkan DRAFT → PENDING pada hitungan pertama; tanpa ini
      // SO nyangkut PENDING tanpa satu pun item untuk diputuskan admin.
      //
      // Sengaja TIDAK memanggil closeFullSoIfResolved: menghapus item PENDING terakhir
      // akan membuatnya menutup SO sebagai APPROVED, dan kasir tidak boleh menyetujui
      // SO cuma dengan menghapus baris.
      let soStatus = so.status;
      const [remaining] = await tx
        .select({ id: stockOpnameItems.id })
        .from(stockOpnameItems)
        .where(eq(stockOpnameItems.soId, soId))
        .limit(1);

      if (!remaining && so.status === "PENDING") {
        await tx.update(stockOpnames).set({ status: "DRAFT" }).where(eq(stockOpnames.id, soId));
        soStatus = "DRAFT";
      }

      return { soStatus };
    });

    return NextResponse.json({ success: true, soStatus: result.soStatus });
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
          { error: "Membatalkan baris hitungan cuma berlaku untuk SO Besar" },
          { status: 400 },
        );
      }
      if (error.message === "ALREADY_PROCESSED") {
        return NextResponse.json({ error: "Stock opname sudah diproses" }, { status: 409 });
      }
      if (error.message === "ITEM_NOT_FOUND") {
        return NextResponse.json(
          { error: "Item tidak ditemukan pada stock opname ini" },
          { status: 404 },
        );
      }
      if (error.message === "ITEM_DECIDED") {
        return NextResponse.json(
          { error: "Item ini sudah diputuskan admin, hitungannya tidak bisa dibatalkan lagi" },
          { status: 409 },
        );
      }
    }

    console.error("DELETE /api/pos/stock-opnames/[id]/items/[itemId] error:", error);
    return NextResponse.json(
      { error: "Gagal membatalkan hitungan produk ini" },
      { status: 500 },
    );
  }
}
