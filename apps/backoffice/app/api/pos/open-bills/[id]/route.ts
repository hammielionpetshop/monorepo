import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { verifyAccessToken } from "@/lib/auth";
import { and, db, eq, openBills } from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";

export async function DELETE(
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

    const { id: billId } = await params;
    const id = Number(billId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Open bill tidak valid" },
        { status: 400 },
      );
    }

    const branchId = getPosBranchId(payload, cookieStore);
    const deleted = await db
      .delete(openBills)
      .where(and(eq(openBills.id, id), eq(openBills.branchId, branchId)));

    if (Array.isArray(deleted) && deleted.length === 0) {
      return NextResponse.json(
        { error: "Open bill tidak ditemukan" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[OpenBills] DELETE error:", err);
    return NextResponse.json(
      { error: "Gagal menghapus open bill" },
      { status: 500 },
    );
  }
}
