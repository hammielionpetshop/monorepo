import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authz";
import { db, purchaseOrders, eq, and } from "@/lib/db";
import { applyPOReceivingBatches } from "@/lib/po-batch-updater";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const poId = Number.parseInt(id, 10);

    const gate = await requirePermission("po.approve");
    if (gate instanceof NextResponse) return gate;
    const payload = gate;

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
      payload.branchScope === "ALL"
        ? poWhere
        : and(
            eq(purchaseOrders.id, poId),
            eq(purchaseOrders.branchId, payload.branchId),
          );
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
