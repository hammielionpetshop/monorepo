import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { db, purchaseOrders, eq, and } from "@/lib/db";

const GLOBAL_ROLES = ["OWNER", "GM"];
const PO_MUTATE_ROLES = ["OWNER", "GM", "MANAGER"];
const OWNER_APPROVAL_THRESHOLD = 5000000;

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
        { error: "Anda tidak memiliki akses untuk menyetujui Purchase Order." },
        { status: 403 },
      );
    }

    if (!Number.isInteger(poId) || poId <= 0) {
      return NextResponse.json(
        { error: "ID Purchase Order tidak valid" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const notes = typeof body.notes === "string" ? body.notes : undefined;

    const isGlobal = GLOBAL_ROLES.includes(payload.role);
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
      .where(poWhere)
      .returning();

    return NextResponse.json(updatedPO);
  } catch (error) {
    console.error("Approve PO error:", error);
    return NextResponse.json(
      { error: "Gagal menyetujui Purchase Order" },
      { status: 500 },
    );
  }
}
