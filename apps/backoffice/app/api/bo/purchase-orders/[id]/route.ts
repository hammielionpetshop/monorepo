import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth, requirePermission } from "@/lib/authz";
import {
  db,
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
  branches,
  products,
  unitsOfMeasure,
  eq,
  and,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const patchPOSchema = z.object({
  notes: z.string().max(1000).nullable().optional(),
  targetDeliveryDate: z.string().datetime().nullable().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const poId = Number.parseInt(id, 10);

    const payload = await getAuth();

    if (!payload) {
      return NextResponse.json(
        { error: "Sesi tidak valid, silakan login kembali" },
        { status: 401 },
      );
    }

    if (!Number.isInteger(poId) || poId <= 0) {
      return NextResponse.json(
        { error: "ID Purchase Order tidak valid" },
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

    const [poRows, itemRows] = await Promise.all([
      db
        .select({
          id: purchaseOrders.id,
          poNumber: purchaseOrders.poNumber,
          status: purchaseOrders.status,
          totalAmount: purchaseOrders.totalAmount,
          notes: purchaseOrders.notes,
          rejectionNote: purchaseOrders.rejectionNote,
          invoiceNumber: purchaseOrders.invoiceNumber,
          targetDeliveryDate: purchaseOrders.targetDeliveryDate,
          approvedAt: purchaseOrders.approvedAt,
          createdAt: purchaseOrders.createdAt,
          updatedAt: purchaseOrders.updatedAt,
          supplierId: purchaseOrders.supplierId,
          supplierName: suppliers.name,
          supplierPhone: suppliers.phone,
          branchId: purchaseOrders.branchId,
          branchName: branches.name,
        })
        .from(purchaseOrders)
        .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
        .leftJoin(branches, eq(purchaseOrders.branchId, branches.id))
        .where(poWhere)
        .limit(1),
      db
        .select({
          id: purchaseOrderItems.id,
          poId: purchaseOrderItems.poId,
          productId: purchaseOrderItems.productId,
          productName: products.name,
          productSku: products.sku,
          uomId: purchaseOrderItems.uomId,
          uomCode: unitsOfMeasure.code,
          qtyOrdered: purchaseOrderItems.qtyOrdered,
          qtyReceived: purchaseOrderItems.qtyReceived,
          qtyDamaged: purchaseOrderItems.qtyDamaged,
          unitCost: purchaseOrderItems.unitCost,
          invoiceUnitCost: purchaseOrderItems.invoiceUnitCost,
          expiryDate: purchaseOrderItems.expiryDate,
        })
        .from(purchaseOrderItems)
        .leftJoin(products, eq(purchaseOrderItems.productId, products.id))
        .leftJoin(
          unitsOfMeasure,
          eq(purchaseOrderItems.uomId, unitsOfMeasure.id),
        )
        .where(eq(purchaseOrderItems.poId, poId)),
    ]);

    if (!poRows[0]) {
      return NextResponse.json(
        { error: "Purchase Order tidak ditemukan" },
        { status: 404 },
      );
    }

    const po = {
      ...poRows[0],
      supplier: {
        id: poRows[0].supplierId,
        name: poRows[0].supplierName ?? "-",
        phone: poRows[0].supplierPhone,
      },
      branch: { id: poRows[0].branchId, name: poRows[0].branchName ?? "-" },
      items: itemRows,
    };

    return NextResponse.json(po);
  } catch (error) {
    console.error("Detail BO PO error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil detail Purchase Order" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const poId = Number.parseInt(id, 10);

    const gate = await requirePermission("po.manage");
    if (gate instanceof NextResponse) return gate;
    const payload = gate;

    if (!Number.isInteger(poId) || poId <= 0) {
      return NextResponse.json(
        { error: "ID Purchase Order tidak valid" },
        { status: 400 },
      );
    }

    if (!req.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type harus application/json" },
        { status: 415 },
      );
    }

    const parsed = patchPOSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            "Data Purchase Order tidak valid",
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
    const changes: Partial<typeof purchaseOrders.$inferInsert> = {
      updatedAt: new Date(),
    };

    if ("notes" in parsed.data) changes.notes = parsed.data.notes ?? null;
    if ("targetDeliveryDate" in parsed.data) {
      changes.targetDeliveryDate = parsed.data.targetDeliveryDate
        ? new Date(parsed.data.targetDeliveryDate)
        : null;
    }

    const result = await db
      .update(purchaseOrders)
      .set(changes)
      .where(poWhere)
      .returning();

    if (!result[0]) {
      return NextResponse.json(
        { error: "Purchase Order tidak ditemukan" },
        { status: 404 },
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Update BO PO error:", error);
    return NextResponse.json(
      { error: "Gagal mengubah Purchase Order" },
      { status: 500 },
    );
  }
}
