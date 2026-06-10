import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import {
  db,
  purchaseOrders,
  purchaseOrderItems,
  supplierPayables,
  eq,
  and,
} from "@/lib/db";

const PO_FINANCIAL_ROLES = ["OWNER", "GM"];

const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1, "Nomor invoice wajib diisi").max(100),
  items: z
    .array(
      z.object({
        id: z.number().int().positive(),
        invoiceUnitCost: z.number().int().nonnegative(),
      }),
    )
    .min(1, "Item invoice wajib diisi"),
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

    if (!PO_FINANCIAL_ROLES.includes(payload.role)) {
      return NextResponse.json(
        {
          error:
            "Anda tidak memiliki akses untuk mengubah invoice Purchase Order",
        },
        { status: 403 },
      );
    }

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

    const parsed = invoiceSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Data invoice tidak valid",
        },
        { status: 400 },
      );
    }

    const { invoiceNumber, items } = parsed.data;

    const result = await db.transaction(async (tx) => {
      const poWhere =
        payload.role === "GM"
          ? and(
              eq(purchaseOrders.id, poId),
              eq(purchaseOrders.branchId, payload.branchId),
            )
          : eq(purchaseOrders.id, poId);
      const [updatedPO] = await tx
        .update(purchaseOrders)
        .set({
          invoiceNumber,
          invoiceUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(poWhere)
        .returning({ id: purchaseOrders.id });

      if (!updatedPO) throw new Error("PO_NOT_FOUND");

      for (const item of items) {
        const [updatedItem] = await tx
          .update(purchaseOrderItems)
          .set({
            invoiceUnitCost: item.invoiceUnitCost,
          })
          .where(
            and(
              eq(purchaseOrderItems.id, item.id),
              eq(purchaseOrderItems.poId, poId),
            ),
          )
          .returning({ id: purchaseOrderItems.id });

        if (!updatedItem) throw new Error("PO_ITEM_NOT_FOUND");
      }

      const allItems = await tx.query.purchaseOrderItems.findMany({
        where: eq(purchaseOrderItems.poId, poId),
      });

      let newTotalAmount = 0;
      for (const item of allItems) {
        const cost = item.invoiceUnitCost || item.unitCost;
        newTotalAmount += Number(item.qtyReceived) * Number(cost);
      }

      await tx
        .update(supplierPayables)
        .set({
          totalAmount: Math.round(newTotalAmount),
        })
        .where(eq(supplierPayables.poId, poId));

      return { success: true, newTotalAmount };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PO_NOT_FOUND")
        return NextResponse.json(
          { error: "Purchase Order tidak ditemukan" },
          { status: 404 },
        );
      if (error.message === "PO_ITEM_NOT_FOUND")
        return NextResponse.json(
          { error: "Item Purchase Order tidak ditemukan" },
          { status: 404 },
        );
    }

    console.error("Update invoice error:", error);
    return NextResponse.json(
      { error: "Gagal mengubah invoice Purchase Order" },
      { status: 500 },
    );
  }
}
