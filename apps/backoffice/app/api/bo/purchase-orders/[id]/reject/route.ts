import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import { db, purchaseOrders, eq, and } from "@/lib/db";

const GLOBAL_ROLES = ["OWNER", "GM"];
const PO_MUTATE_ROLES = ["OWNER", "GM", "MANAGER"];

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

    const cookieStore = await cookies();
    const token = cookieStore.get("accessToken")?.value;
    const payload = token ? await verifyAccessToken(token) : null;

    if (!payload) {
      return NextResponse.json(
        { error: "Sesi tidak valid, silakan login kembali" },
        { status: 401 },
      );
    }

    if (!PO_MUTATE_ROLES.includes(payload.role)) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses untuk menolak Purchase Order" },
        { status: 403 },
      );
    }

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

    const isGlobal = GLOBAL_ROLES.includes(payload.role);
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
