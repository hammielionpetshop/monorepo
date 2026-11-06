import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/authz";
import { db, purchaseOrders, eq, and } from "@/lib/db";

const OWNER_APPROVAL_THRESHOLD = 5000000;

export async function PATCH(
  req: Request,
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

    const body = await req.json();
    const notes = typeof body.notes === "string" ? body.notes : undefined;

    const isGlobal = payload.branchScope === "ALL";
    const poWhere = isGlobal
      ? eq(purchaseOrders.id, poId)
      : and(
          eq(purchaseOrders.id, poId),
          eq(purchaseOrders.branchId, payload.branchId),
        );

    const po = await db.query.purchaseOrders.findFirst({
      where: poWhere,
    });

    if (!po) {
      return NextResponse.json(
        { error: "Purchase Order tidak ditemukan" },
        { status: 404 },
      );
    }

    // Hanya rencana (Draft / Menunggu persetujuan) yang bisa disetujui; dulu status tidak diperiksa.
    if (po.status !== "DRAFT" && po.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: "Purchase Order ini sudah tidak menunggu persetujuan" },
        { status: 409 },
      );
    }

    const totalAmount = Number(po.totalAmount);

    if (totalAmount >= OWNER_APPROVAL_THRESHOLD && payload.role !== "OWNER") {
      return NextResponse.json(
        {
          error:
            "Persetujuan PO di atas Rp 5.000.000 hanya dapat dilakukan oleh Owner.",
        },
        { status: 403 },
      );
    }

    const [updatedPO] = await db
      .update(purchaseOrders)
      .set({
        status: "APPROVED",
        approvedById: payload.userId,
        approvedAt: new Date(),
        notes: notes ?? po.notes,
        updatedAt: new Date(),
      })
      .where(and(poWhere, eq(purchaseOrders.status, po.status)))
      .returning();

    if (!updatedPO) {
      return NextResponse.json(
        { error: "Purchase Order baru saja berubah, muat ulang halaman" },
        { status: 409 },
      );
    }

    return NextResponse.json(updatedPO);
  } catch (error) {
    console.error("Approve PO error:", error);
    return NextResponse.json(
      { error: "Gagal menyetujui Purchase Order" },
      { status: 500 },
    );
  }
}
