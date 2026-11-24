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
import { poTotalAmount } from "@/lib/po-total";
import { poDiscountError, poDiscountFactor, poNetTotal } from "@/lib/po-discount";
import { isPricePending } from "@/lib/po-stage";
import Big from "big.js";
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
  // Diskon rupiah atas total faktur; kosong = diskon PO yang tersimpan dipertahankan.
  discountAmount: z.number().int().nonnegative("Diskon tidak boleh minus").optional(),
});

class InvoiceDiscountError extends Error {}

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
          keepCurrentCost: purchaseOrders.keepCurrentCost,
          discountAmount: purchaseOrders.discountAmount,
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
      // = max(qty pesan, qty diterima) × harga efektif − diskon. Diskon dibagi rata persentasenya.
      const grossAmount = poTotalAmount(allItems);
      const discountAmount = parsed.data.discountAmount ?? updatedPO.discountAmount ?? 0;
      const discountError = poDiscountError(discountAmount, grossAmount);
      if (discountError) throw new InvoiceDiscountError(discountError);
      const discountFactor = poDiscountFactor(grossAmount, discountAmount);
      const discountedCost = (cost: number) => Number(new Big(cost).times(discountFactor).round(0));

      let payableGross = new Big(0);
      for (const item of allItems) {
        const cost = Number(item.invoiceUnitCost || item.unitCost);
        payableGross = payableGross.plus(new Big(Math.max(Number(item.qtyReceived) - Number(item.qtyDamaged), 0)).times(cost));
      }
      const newTotalAmount = Number(payableGross.times(discountFactor).round(0));
      await tx
        .update(purchaseOrders)
        .set({ totalAmount: poNetTotal(grossAmount, discountAmount), discountAmount })
        .where(eq(purchaseOrders.id, poId));

      // Harga faktur menggantikan harga PO sebagai modal, tapi hanya untuk barang yang sudah masuk
      // stok; waktu penerimaannya jadi pembanding supaya faktur lama tidak menimpa PO yang lebih baru.
      // PO Barang kembali: harga faktur hanya mengubah nilai/hutang — HPP batch tetap modal cabang
      // dan modal Manajemen Harga tidak disentuh.
      for (const item of updatedPO.keepCurrentCost ? [] : allItems) {
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

        // Modal batch dari PO ini ikut diganti ke harga faktur sesudah diskon — termasuk batch
        // "harga menyusul" yang tadinya memakai modal terakhir sebagai perkiraan. Porsi yang sudah
        // terjual sebelum faktur diisi tetap ber-HPP perkiraan (tidak ada jejak batch per penjualan).
        // Barang tanpa harga faktur memakai harga PO, supaya perubahan diskon ikut ke modalnya.
        const invoiceCost = isPricePending(item)
          ? 0
          : discountedCost(Number(item.invoiceUnitCost || item.unitCost));
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
                invoiceUnitCost: Number(item.invoiceUnitCost),
                discountAmount,
                unitCostAfterDiscount: invoiceCost,
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
          unitCost: discountedCost(Number(item.invoiceUnitCost || item.unitCost)),
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
          totalAmount: newTotalAmount,
          // Total berubah setelah ada pembayaran → status ikut dihitung ulang, supaya
          // hutang yang tadinya LUNAS bisa dibayar lagi bila faktur ternyata lebih besar.
          status: sql`CASE
            WHEN ${supplierPayables.status} = 'WAIVED' THEN 'WAIVED'
            WHEN ${supplierPayables.paidAmount} <= 0 THEN 'UNPAID'
            WHEN ${supplierPayables.paidAmount} >= ${newTotalAmount} THEN 'PAID'
            ELSE 'PARTIAL' END`,
        })
        .where(eq(supplierPayables.poId, poId));

      return { success: true, newTotalAmount };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvoiceDiscountError)
      return NextResponse.json({ error: error.message }, { status: 400 });
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
