import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import { db, purchaseOrders, eq, and } from "@/lib/db";

const rejectSchema = z.object({
  rejectionNote: z.string().max(500).optional(),
});

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

    const parsed = rejectSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Data penolakan tidak valid",
        },
        { status: 400 },
      );
    }

    const isGlobal = payload.branchScope === "ALL";
    const poWhere = isGlobal
      ? eq(purchaseOrders.id, poId)
      : and(
          eq(purchaseOrders.id, poId),
          eq(purchaseOrders.branchId, payload.branchId),
        );

    const [updatedPO] = await db
      .update(purchaseOrders)
      .set({
        status: "PENDING_APPROVAL",
        rejectedById: payload.userId,
        rejectedAt: new Date(),
        rejectionNote: parsed.data.rejectionNote ?? null,
        updatedAt: new Date(),
      })
      .where(poWhere)
      .returning();

    if (!updatedPO) {
      return NextResponse.json(
        { error: "Purchase Order tidak ditemukan" },
        { status: 404 },
      );
    }

    return NextResponse.json(updatedPO);
  } catch (error) {
    console.error("Reject PO error:", error);
    return NextResponse.json(
      { error: "Gagal menolak Purchase Order" },
      { status: 500 },
    );
  }
}
