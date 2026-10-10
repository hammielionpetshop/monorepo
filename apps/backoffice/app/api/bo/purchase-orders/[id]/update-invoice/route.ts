import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import {
  db,
  purchaseOrders,
  purchaseOrderItems,
  supplierPayables,
  productStockBatches,
  auditLogs,
  eq,
  and,
  ne,
  sql,
} from "@/lib/db";
import { syncCostFromInbound } from "@/lib/services/cost-sync-service";
import { resolveStockUom } from "@/lib/services/stock-validation";

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

    const gate = await requirePermission("po.financial");
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
      // Pemegang scope ALL (OWNER/GM) boleh semua cabang; selain itu hanya cabangnya sendiri.
      // Dulu terbalik: OWNER dibatasi ke cabang di tokennya, staf cabang bebas ke PO mana pun.
      const poWhere =
        payload.branchScope === "ALL"
          ? eq(purchaseOrders.id, poId)
          : and(
              eq(purchaseOrders.id, poId),
              eq(purchaseOrders.branchId, payload.branchId),
            );
      const [updatedPO] = await tx
        .update(purchaseOrders)
        .set({
          invoiceNumber,
          invoiceUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(poWhere)
        .returning({
          id: purchaseOrders.id,
          branchId: purchaseOrders.branchId,
          poNumber: purchaseOrders.poNumber,
        });

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

      // Hutang = barang bagus yang masuk stok (sama seperti approve-receiving); Total PO di header
      // = qty pesan × harga efektif, sama dengan subtotal per baris di halaman detail.
      let newTotalAmount = 0;
      let newPoTotal = 0;
      for (const item of allItems) {
        const cost = Number(item.invoiceUnitCost || item.unitCost);
        newTotalAmount += Math.max(Number(item.qtyReceived) - Number(item.qtyDamaged), 0) * cost;
        newPoTotal += Number(item.qtyOrdered) * cost;
      }
      await tx
        .update(purchaseOrders)
        .set({ totalAmount: Math.round(newPoTotal) })
        .where(eq(purchaseOrders.id, poId));

      // Harga faktur menggantikan harga PO sebagai modal, tapi hanya untuk barang yang sudah masuk
      // stok; waktu penerimaannya jadi pembanding supaya faktur lama tidak menimpa PO yang lebih baru.
      for (const item of allItems) {
        if (!items.some((i) => i.id === item.id)) continue;
        if (Number(item.qtyReceived) - Number(item.qtyDamaged) <= 0) continue;
        const [received] = await tx
          .select({ at: sql<Date | null>`MAX(${productStockBatches.receivedAt})`.mapWith(productStockBatches.receivedAt) })
          .from(productStockBatches)
          .where(
            and(
              eq(productStockBatches.purchaseOrderId, poId),
              eq(productStockBatches.productId, item.productId),
            ),
          );
        if (!received?.at) continue;

        // Modal batch dari PO ini ikut diganti ke harga faktur — termasuk batch "harga menyusul"
        // yang tadinya memakai modal terakhir sebagai perkiraan. Porsi yang sudah terjual
        // sebelum faktur diisi tetap ber-HPP perkiraan (tidak ada jejak batch per penjualan).
        const invoiceCost = Number(item.invoiceUnitCost);
        if (invoiceCost > 0) {
          const { ratio } = await resolveStockUom(tx, item.productId, item.uomId);
          const costPerBase = Math.round(invoiceCost / Number(ratio));
          const batchWhere = and(
            eq(productStockBatches.purchaseOrderId, poId),
            eq(productStockBatches.productId, item.productId),
            eq(productStockBatches.uomId, item.uomId),
            ne(productStockBatches.costPrice, costPerBase),
          );
          const changedBatches = await tx
            .select({ id: productStockBatches.id, costPrice: productStockBatches.costPrice })
            .from(productStockBatches)
            .where(batchWhere);
          if (changedBatches.length > 0) {
            await tx
              .update(productStockBatches)
              .set({ costPrice: costPerBase })
              .where(batchWhere);
            await tx.insert(auditLogs).values({
              userId: payload.userId,
              action: "PO_INVOICE_BATCH_COST",
              branchId: updatedPO.branchId,
              tableName: "product_stock_batches",
              recordId: String(poId),
              oldData: JSON.stringify(changedBatches),
              newData: JSON.stringify({
                poNumber: updatedPO.poNumber,
                productId: item.productId,
                invoiceUnitCost: invoiceCost,
                costPerBase,
              }),
              createdAt: new Date(),
            });
          }
        }

        await syncCostFromInbound(tx, {
          branchId: updatedPO.branchId,
          productId: item.productId,
          uomId: item.uomId,
          unitCost: Number(item.invoiceUnitCost || item.unitCost),
          sourceType: "PO_INVOICE",
          sourceId: poId,
          sourceRef: `Faktur ${updatedPO.poNumber}`,
          actorUserId: payload.userId,
          effectiveAt: received.at,
        });
      }

      await tx
        .update(supplierPayables)
        .set({
          totalAmount: Math.round(newTotalAmount),
          // Total berubah setelah ada pembayaran → status ikut dihitung ulang, supaya
          // hutang yang tadinya LUNAS bisa dibayar lagi bila faktur ternyata lebih besar.
          status: sql`CASE
            WHEN ${supplierPayables.status} = 'WAIVED' THEN 'WAIVED'
            WHEN ${supplierPayables.paidAmount} <= 0 THEN 'UNPAID'
            WHEN ${supplierPayables.paidAmount} >= ${Math.round(newTotalAmount)} THEN 'PAID'
            ELSE 'PARTIAL' END`,
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
