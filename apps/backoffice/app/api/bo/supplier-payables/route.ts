import { NextResponse } from "next/server";
import { getAuth } from "@/lib/authz";
import {
  db,
  supplierPayables,
  purchaseOrders,
  suppliers,
  eq,
  and,
  desc,
  inArray,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const payload = await getAuth();

    if (!payload) {
      return NextResponse.json(
        { error: "Sesi tidak valid, silakan login kembali" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get("supplierId");
    const status = searchParams.get("status");
    const branchId = Number.parseInt(searchParams.get("branchId") ?? "", 10);

    const conditions = [];
    if (supplierId) {
      conditions.push(
        eq(supplierPayables.supplierId, Number.parseInt(supplierId, 10)),
      );
    }
    if (status) {
      conditions.push(inArray(supplierPayables.status, status.split(",")));
    }

    const isGlobal = payload.branchScope === "ALL";
    const effectiveBranchId =
      isGlobal && Number.isInteger(branchId) && branchId > 0
        ? branchId
        : payload.branchId;

    if (effectiveBranchId) {
      conditions.push(eq(purchaseOrders.branchId, effectiveBranchId));
    }

    const payables = await db
      .select({
        id: supplierPayables.id,
        poId: supplierPayables.poId,
        supplierId: supplierPayables.supplierId,
        totalAmount: supplierPayables.totalAmount,
        paidAmount: supplierPayables.paidAmount,
        dueAt: supplierPayables.dueAt,
        status: supplierPayables.status,
        createdAt: supplierPayables.createdAt,
        supplierName: suppliers.name,
        poNumber: purchaseOrders.poNumber,
        branchId: purchaseOrders.branchId,
      })
      .from(supplierPayables)
      .leftJoin(suppliers, eq(supplierPayables.supplierId, suppliers.id))
      .innerJoin(purchaseOrders, eq(supplierPayables.poId, purchaseOrders.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(supplierPayables.createdAt));

    return NextResponse.json(payables);
  } catch (error) {
    console.error("List payables error:", error);
    return NextResponse.json(
      { error: "Gagal menampilkan hutang supplier" },
      { status: 500 },
    );
  }
}
