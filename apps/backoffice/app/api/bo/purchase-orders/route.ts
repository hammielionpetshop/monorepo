import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuth, requirePermission } from "@/lib/authz";
import {
  db,
  purchaseOrders,
  purchaseOrderItems,
  suppliers,
  branches,
  desc,
  eq,
  and,
  inArray,
  sql,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const createPOSchema = z.object({
  branchId: z.number().int().positive(),
  supplierId: z.number().int().positive(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        uomId: z.number().int().positive(),
        qtyOrdered: z.number().int().positive(),
        unitCost: z.number().int().nonnegative(),
      }),
    )
    .min(1, "Item Purchase Order wajib diisi"),
  notes: z.string().max(1000).optional(),
  targetDeliveryDate: z.string().datetime().optional(),
});

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
    const requestedBranchId = Number.parseInt(
      searchParams.get("branchId") ?? "",
      10,
    );
    const status = searchParams.get("status");

    const conditions = [];
    const isGlobal = payload.branchScope === "ALL";
    const effectiveBranchId =
      isGlobal && Number.isInteger(requestedBranchId) && requestedBranchId > 0
        ? requestedBranchId
        : payload.branchId;

    if (effectiveBranchId) {
      conditions.push(eq(purchaseOrders.branchId, effectiveBranchId));
    }

    if (status) {
      conditions.push(inArray(purchaseOrders.status, status.split(",")));
    }

    const rows = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        status: purchaseOrders.status,
        totalAmount: purchaseOrders.totalAmount,
        notes: purchaseOrders.notes,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
        targetDeliveryDate: purchaseOrders.targetDeliveryDate,
        invoiceNumber: purchaseOrders.invoiceNumber,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        branchId: purchaseOrders.branchId,
        branchName: branches.name,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(branches, eq(purchaseOrders.branchId, branches.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(purchaseOrders.createdAt));

    const pos = rows.map((r) => ({
      ...r,
      supplier: { id: r.supplierId, name: r.supplierName ?? "-" },
      branch: { id: r.branchId, name: r.branchName ?? "-" },
    }));

    return NextResponse.json(pos);
  } catch (error) {
    console.error("List BO PO error:", error);
    return NextResponse.json(
      { error: "Gagal menampilkan Purchase Order" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requirePermission("po.manage");
    if (gate instanceof NextResponse) return gate;
    const payload = gate;

    if (!req.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type harus application/json" },
        { status: 415 },
      );
    }

    const parsed = createPOSchema.safeParse(await req.json());

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

    const { supplierId, items, notes, targetDeliveryDate } = parsed.data;
    const isGlobal = payload.branchScope === "ALL";
    const branchId = isGlobal ? parsed.data.branchId : payload.branchId;

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

    const [countRow] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.branchId, branchId),
          sql`DATE(${purchaseOrders.createdAt}) = CURRENT_DATE`,
        ),
      );

    const increment = ((Number(countRow?.count) || 0) + 1)
      .toString()
      .padStart(4, "0");
    const poNumber = `PO-${dateStr}-${increment}`;

    let totalAmount = 0;
    for (const item of items) {
      totalAmount += Number(item.qtyOrdered) * Number(item.unitCost);
    }

    const result = await db.transaction(async (tx) => {
      const [newPO] = await tx
        .insert(purchaseOrders)
        .values({
          poNumber,
          branchId,
          supplierId,
          createdById: payload.userId,
          totalAmount: Math.round(totalAmount),
          notes: notes || null,
          targetDeliveryDate: targetDeliveryDate
            ? new Date(targetDeliveryDate)
            : null,
          status: "PENDING_APPROVAL",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const poItems = items.map((item) => ({
        poId: newPO.id,
        productId: item.productId,
        uomId: item.uomId,
        qtyOrdered: Number(item.qtyOrdered),
        qtyReceived: 0,
        qtyDamaged: 0,
        unitCost: Number(item.unitCost),
      }));

      await tx.insert(purchaseOrderItems).values(poItems);

      return newPO;
    });

    return NextResponse.json({ success: true, po: result }, { status: 201 });
  } catch (error) {
    console.error("BO Create PO error:", error);
    return NextResponse.json(
      { error: "Gagal membuat Purchase Order" },
      { status: 500 },
    );
  }
}
