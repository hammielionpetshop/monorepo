import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import { db, sql, eq, and, asc } from "@/lib/db";
import {
  stockOpnames,
  stockOpnameItems,
  productStocks,
  productStockBatches,
  productUomConversions,
} from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";
import { calculateFIFOCost } from "@petshop/shared/utils/fifo-shrinkage";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.coerce.number().int().positive() });
const addItemsSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        uomId: z.coerce.number().int().positive(),
        physicalQty: z.coerce.number().min(0),
        varianceReason: z.string().max(255).optional(),
      }),
    )
    .min(1, "Minimal satu item harus ditambahkan"),
});

export async function PATCH(
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
    const parsedParams = paramsSchema.safeParse({ id });
    if (!parsedParams.success) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    const body = await req.json();
    const parsedBody = addItemsSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 },
      );
    }

    const branchId = getPosBranchId(payload, cookieStore);
    const soId = parsedParams.data.id;
    const { items } = parsedBody.data;

    const result = await db.transaction(async (tx) => {
      const [so] = await tx
        .select()
        .from(stockOpnames)
        .where(eq(stockOpnames.id, soId))
        .for("update")
        .limit(1);

      if (!so) throw new Error("SO_NOT_FOUND");
      if (so.branchId !== branchId) throw new Error("BRANCH_FORBIDDEN");
      if (so.status !== "PENDING") throw new Error("ALREADY_PROCESSED");

      const trustedBranchId = so.branchId;

      const processedItems = [];

      for (const item of items) {
        // Agregasi semua UOM stok, konversi ke item.uomId untuk systemQty akurat
        const allStocks = await tx.select({
            uomId: productStocks.uomId,
            qty: productStocks.qty,
            ratio: productUomConversions.ratio,
          })
          .from(productStocks)
          .leftJoin(productUomConversions, and(
            eq(productUomConversions.productId, productStocks.productId),
            eq(productUomConversions.uomId, productStocks.uomId)
          ))
          .where(and(
            eq(productStocks.productId, item.productId),
            eq(productStocks.branchId, Number(trustedBranchId))
          ));

        const [itemConv] = await tx.select({ ratio: productUomConversions.ratio })
          .from(productUomConversions)
          .where(and(
            eq(productUomConversions.productId, item.productId),
            eq(productUomConversions.uomId, item.uomId)
          ))
          .limit(1);

        const itemUomRatio = itemConv?.ratio ?? 1;
        const totalBaseQty = allStocks.reduce((sum: number, s: { qty: unknown; ratio: number | null }) => sum + Number(s.qty) * (s.ratio ?? 1), 0);
        const systemQty = Math.floor(totalBaseQty / itemUomRatio);
        const physicalQty = parseFloat(String(item.physicalQty));
        const varianceQty = physicalQty - systemQty;

        let varianceCostValue: number = 0;
        if (varianceQty !== 0) {
          const allBatches = await tx.select({
              id: productStockBatches.id,
              qtyRemaining: productStockBatches.qtyRemaining,
              costPrice: productStockBatches.costPrice,
              receivedAt: productStockBatches.receivedAt,
              ratio: productUomConversions.ratio,
            })
            .from(productStockBatches)
            .leftJoin(productUomConversions, and(
              eq(productUomConversions.productId, productStockBatches.productId),
              eq(productUomConversions.uomId, productStockBatches.uomId)
            ))
            .where(and(
              eq(productStockBatches.productId, item.productId),
              eq(productStockBatches.branchId, Number(trustedBranchId)),
              sql`${productStockBatches.qtyRemaining} > 0`
            ))
            .orderBy(asc(productStockBatches.receivedAt));

          const mappedBatches = allBatches.map((b: { id: number; qtyRemaining: unknown; costPrice: unknown; ratio: number | null }) => {
            const r = b.ratio ?? 1;
            return {
              id: b.id,
              qty: Number(b.qtyRemaining) * r,
              costPrice: r > 1 ? Number(b.costPrice) / r : Number(b.costPrice),
            };
          });

          const varianceBase = Math.abs(varianceQty) * itemUomRatio;
          const fifoResult = calculateFIFOCost(mappedBatches, varianceBase);
          varianceCostValue = Math.round(fifoResult.totalCost);
        }

        const existingItems = await tx
          .select()
          .from(stockOpnameItems)
          .where(
            and(
              eq(stockOpnameItems.soId, soId),
              eq(stockOpnameItems.productId, item.productId),
              eq(stockOpnameItems.uomId, item.uomId),
            ),
          )
          .limit(1);

        if (existingItems.length > 0) {
          const [updated] = await tx
            .update(stockOpnameItems)
            .set({
              systemQty: Math.round(systemQty),
              physicalQty: Math.round(physicalQty),
              varianceQty: Math.round(varianceQty),
              varianceCostValue,
              varianceReason: item.varianceReason ?? existingItems[0].varianceReason,
            })
            .where(eq(stockOpnameItems.id, existingItems[0].id))
            .returning();
          processedItems.push(updated);
        } else {
          const [inserted] = await tx
            .insert(stockOpnameItems)
            .values({
              soId,
              productId: item.productId,
              uomId: item.uomId,
              systemQty: Math.round(systemQty),
              physicalQty: Math.round(physicalQty),
              varianceQty: Math.round(varianceQty),
              varianceCostValue,
              varianceReason: item.varianceReason ?? null,
            })
            .returning();
          processedItems.push(inserted);
        }
      }

      return processedItems;
    });

    return NextResponse.json({
      success: true,
      itemsCount: result.length,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === "SO_NOT_FOUND") {
        return NextResponse.json(
          { error: "Stock opname tidak ditemukan" },
          { status: 404 },
        );
      }
      if (error.message === "BRANCH_FORBIDDEN") {
        return NextResponse.json(
          { error: "Stock opname bukan milik cabang ini" },
          { status: 403 },
        );
      }
      if (error.message === "ALREADY_PROCESSED") {
        return NextResponse.json(
          { error: "Stock opname sudah diproses" },
          { status: 409 },
        );
      }
    }

    console.error("Add Items to SO API error:", error);
    return NextResponse.json(
      { error: "Gagal menambahkan item stock opname" },
      { status: 500 },
    );
  }
}
