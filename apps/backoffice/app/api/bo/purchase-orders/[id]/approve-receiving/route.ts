import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { db, purchaseOrders, eq, and } from "@/lib/db";
import { applyPOReceivingBatches } from "@/lib/po-batch-updater";

const GLOBAL_ROLES = ["OWNER", "GM"];

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const poId = Number.parseInt(id, 10);

    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    const payload = token ? await verifyAccessToken(token) : null;

    if (!payload) {
      return NextResponse.json(
        { error: "Sesi tidak valid, silakan login kembali" },
        { status: 401 },
      );
    }

    if (!GLOBAL_ROLES.includes(payload.role)) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses untuk menyetujui penerimaan PO" },
        { status: 403 },
      );
    }

    if (!Number.isInteger(poId) || poId <= 0) {
      return NextResponse.json(
        { error: "ID Purchase Order tidak valid" },
        { status: 400 },
      );
    }

    const poWhere = eq(purchaseOrders.id, poId);
    const [po] = await db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(poWhere)
      .limit(1);

    if (!po) {
      return NextResponse.json(
        { error: "Purchase Order tidak ditemukan" },
        { status: 404 },
      );
    }

    const scopedWhere =
      payload.role === "GM"
        ? and(
            eq(purchaseOrders.id, poId),
            eq(purchaseOrders.branchId, payload.branchId),
          )
        : poWhere;
    const [scopedPo] = await db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(scopedWhere)
      .limit(1);

    if (!scopedPo) {
      return NextResponse.json(
        { error: "Purchase Order tidak ditemukan" },
        { status: 404 },
      );
    }

    await applyPOReceivingBatches(db, poId, payload.userId);

    return NextResponse.json({
      success: true,
      message:
        "Penerimaan PO disetujui, stok diperbarui, dan hutang supplier dibuat",
    });
  } catch (error) {
    console.error("Approve receiving PO error:", error);
    return NextResponse.json(
      { error: "Gagal menyetujui penerimaan PO" },
      { status: 500 },
    );
  }
}
