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

const submitSchema = z.object({
  shiftId: z.coerce.number().int().positive().optional(),
  type: z.enum(["DAILY", "FULL"]),
  method: z.enum(["MANUAL", "BEST_SELLER", "SOLD_TODAY"]).optional(),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        uomId: z.coerce.number().int().positive(),
        physicalQty: z.coerce.number().min(0),
        varianceReason: z.string().max(255).optional(),
      }),
    )
    .min(1, "Minimal satu item harus dihitung"),
});

function generateSONumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `SO-${dateStr}-${random}`;
}

export async function POST(req: NextRequest) {
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

    const contentType = req.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type harus application/json" },
        { status: 415 },
      );
    }

    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 },
      );
    }

    const branchId = getPosBranchId(payload, cookieStore);
    const actorId = payload.userId;
    const { shiftId, type, method, notes, items } = parsed.data;

    const result = await db.transaction(async (tx) => {
      const soNum = generateSONumber();
      const [header] = await tx
        .insert(stockOpnames)
        .values({
          soNumber: soNum,
          branchId,
          shiftId: shiftId ?? null,
          type,
          method: method ?? null,
          status: "PENDING",
          createdById: actorId,
          notes: notes ?? null,
        })
        .returning();

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
            eq(productStocks.branchId, Number(branchId))
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
              eq(productStockBatches.branchId, Number(branchId)),
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

        await tx.insert(stockOpnameItems).values({
          soId: header.id,
          productId: item.productId,
          uomId: item.uomId,
          systemQty: Math.round(systemQty),
          physicalQty: Math.round(physicalQty),
          varianceQty: Math.round(varianceQty),
          varianceCostValue,
          varianceReason: item.varianceReason ?? null,
        });
      }

      return header;
    });

    return NextResponse.json(
      {
        success: true,
        so: result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POS stock opname submit error:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan stock opname" },
      { status: 500 },
    );
  }
}
