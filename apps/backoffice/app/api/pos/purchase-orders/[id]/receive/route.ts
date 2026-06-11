import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import {
  db,
  purchaseOrders,
  purchaseOrderItems,
  poReceivingLogs,
  poReceivingItems,
  eq,
  and,
  sql,
} from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";

export const dynamic = "force-dynamic";

const RECEIVABLE_STATUSES = ["APPROVED", "IN_TRANSIT", "PARTIALLY_RECEIVED"];

const receivingSchema = z.object({
  receivedById: z.number().int().positive().optional(),
  invoiceReceived: z.boolean().optional(),
  note: z.string().max(1000).nullable().optional(),
  items: z
    .array(
      z.object({
        poItemId: z.number().int().positive(),
        qtyReceived: z.number().int().nonnegative(),
        qtyDamaged: z.number().int().nonnegative().default(0),
        expiryDate: z.string().date().nullable().optional(),
        note: z.string().max(500).nullable().optional(),
      }),
    )
    .min(1),
});

export async function POST(
  req: NextRequest,
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

    const { id } = await params;
    const poId = Number(id);
    if (!Number.isInteger(poId) || poId <= 0) {
      return NextResponse.json(
        { error: "ID Purchase Order tidak valid" },
        { status: 400 },
      );
    }

    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type harus application/json" },
        { status: 415 },
      );
    }

    const body = await req.json();
    const parsed = receivingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Data penerimaan tidak valid",
          details: parsed.error.format(),
        },
        { status: 400 },
      );
    }

    const branchId = getPosBranchId(payload, cookieStore);
    const po = await db.query.purchaseOrders.findFirst({
      where: and(
        eq(purchaseOrders.id, poId),
        eq(purchaseOrders.branchId, branchId),
      ),
    });

    if (!po) {
      return NextResponse.json(
        { error: "Purchase Order tidak ditemukan untuk cabang POS ini" },
        { status: 404 },
      );
    }

    if (!RECEIVABLE_STATUSES.includes(po.status)) {
      return NextResponse.json(
        { error: "Status Purchase Order belum bisa diterima" },
        { status: 409 },
      );
    }

    const result = await db.transaction(async (tx) => {
      const [log] = await tx
        .insert(poReceivingLogs)
        .values({
          poId,
          receivedById: payload.userId,
          invoiceReceived: parsed.data.invoiceReceived ?? false,
          note: parsed.data.note ?? null,
          receivedAt: new Date(),
        })
        .returning();

      for (const item of parsed.data.items) {
        if (item.qtyDamaged > item.qtyReceived) {
          throw new Error("DAMAGED_QTY_EXCEEDED");
        }

        const [poItem] = await tx
          .select()
          .from(purchaseOrderItems)
          .where(
            and(
              eq(purchaseOrderItems.id, item.poItemId),
              eq(purchaseOrderItems.poId, poId),
            ),
          )
          .limit(1);

        if (!poItem) {
          throw new Error("PO_ITEM_NOT_FOUND");
        }

        const remainingQty =
          Number(poItem.qtyOrdered) - Number(poItem.qtyReceived);
        if (item.qtyReceived > remainingQty) {
          throw new Error("RECEIVE_QTY_EXCEEDED");
        }

        await tx.insert(poReceivingItems).values({
          logId: log.id,
          poItemId: item.poItemId,
          qtyReceived: item.qtyReceived,
          qtyDamaged: item.qtyDamaged,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          note: item.note ?? null,
        });

        await tx
          .update(purchaseOrderItems)
          .set({
            qtyReceived: sql`${purchaseOrderItems.qtyReceived} + ${item.qtyReceived}`,
            qtyDamaged: sql`${purchaseOrderItems.qtyDamaged} + ${item.qtyDamaged}`,
            expiryDate: item.expiryDate
              ? new Date(item.expiryDate)
              : purchaseOrderItems.expiryDate,
          })
          .where(
            and(
              eq(purchaseOrderItems.id, item.poItemId),
              eq(purchaseOrderItems.poId, poId),
            ),
          );
      }

      await tx
        .update(purchaseOrders)
        .set({
          status: "PARTIALLY_RECEIVED",
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, poId));

      return log;
    });

    return NextResponse.json({
      success: true,
      message: "Penerimaan PO berhasil dicatat",
      log: result,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === "PO_ITEM_NOT_FOUND") {
        return NextResponse.json(
          { error: "Item PO tidak ditemukan" },
          { status: 404 },
        );
      }

      if (error.message === "RECEIVE_QTY_EXCEEDED") {
        return NextResponse.json(
          { error: "Qty diterima melebihi sisa item PO" },
          { status: 400 },
        );
      }

      if (error.message === "DAMAGED_QTY_EXCEEDED") {
        return NextResponse.json(
          { error: "Qty rusak tidak boleh melebihi qty diterima" },
          { status: 400 },
        );
      }
    }

    console.error("Receive PO error:", error);
    return NextResponse.json(
      { error: "Gagal mencatat penerimaan PO" },
      { status: 500 },
    );
  }
}
