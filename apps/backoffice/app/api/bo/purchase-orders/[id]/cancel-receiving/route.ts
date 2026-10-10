import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import {
  db,
  purchaseOrders,
  purchaseOrderItems,
  poReceivingLogs,
  poReceivingItems,
  supplierPayables,
  productStockBatches,
  auditLogs,
  eq,
  and,
  inArray,
} from "@/lib/db";

export const dynamic = "force-dynamic";

// Input penerimaan yang BELUM disetujui = hanya catatan qty; stok & hutang baru dibuat saat
// "Setujui Penerimaan". Jadi membatalkannya cukup menghapus catatan itu dan mengembalikan PO
// ke Disetujui — tidak ada stok yang perlu dibalik. Setelah disetujui, pakai Batalkan Penerimaan.
const CANCELLABLE_STATUSES = ["PARTIALLY_RECEIVED", "FULLY_RECEIVED"];

const cancelSchema = z.object({
  reason: z
    .string({ message: "Alasan pembatalan wajib diisi" })
    .trim()
    .min(5, "Alasan pembatalan wajib diisi (minimal 5 huruf)")
    .max(500, "Alasan maksimal 500 karakter"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const poId = Number.parseInt(id, 10);

    const gate = await requirePermission("po.approve");
    if (gate instanceof NextResponse) return gate;
    const payload = gate;

    if (!Number.isInteger(poId) || poId <= 0) {
      return NextResponse.json({ error: "ID Purchase Order tidak valid" }, { status: 400 });
    }

    if (!req.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json({ error: "Content-Type harus application/json" }, { status: 415 });
    }

    const parsed = cancelSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 },
      );
    }
    const { reason } = parsed.data;

    const poWhere =
      payload.branchScope === "ALL"
        ? eq(purchaseOrders.id, poId)
        : and(eq(purchaseOrders.id, poId), eq(purchaseOrders.branchId, payload.branchId));

    await db.transaction(async (tx) => {
      const [po] = await tx.select().from(purchaseOrders).where(poWhere).for("update").limit(1);
      if (!po) throw new Error("PO_NOT_FOUND");
      if (!CANCELLABLE_STATUSES.includes(po.status)) throw new Error("STATUS_INVALID");

      // Penjaga ganda: kalau entah bagaimana stok/hutang sudah ada, pembatalan ini salah jalur.
      const [payable] = await tx
        .select({ id: supplierPayables.id })
        .from(supplierPayables)
        .where(eq(supplierPayables.poId, poId))
        .limit(1);
      const [batch] = await tx
        .select({ id: productStockBatches.id })
        .from(productStockBatches)
        .where(eq(productStockBatches.purchaseOrderId, poId))
        .limit(1);
      if (payable || batch) throw new Error("ALREADY_APPLIED");

      const items = await tx
        .select({
          id: purchaseOrderItems.id,
          productId: purchaseOrderItems.productId,
          qtyReceived: purchaseOrderItems.qtyReceived,
          qtyDamaged: purchaseOrderItems.qtyDamaged,
          invoiceUnitCost: purchaseOrderItems.invoiceUnitCost,
        })
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.poId, poId));

      const logs = await tx
        .select({ id: poReceivingLogs.id })
        .from(poReceivingLogs)
        .where(eq(poReceivingLogs.poId, poId));
      const logIds = logs.map((l) => l.id);

      if (logIds.length > 0) {
        await tx.delete(poReceivingItems).where(inArray(poReceivingItems.logId, logIds));
        await tx.delete(poReceivingLogs).where(inArray(poReceivingLogs.id, logIds));
      }

      // Harga faktur sengaja dibiarkan: bisa saja diisi lewat Cocokkan Faktur, dan form terima
      // berikutnya menampilkannya kembali untuk diperiksa.
      await tx
        .update(purchaseOrderItems)
        .set({ qtyReceived: 0, qtyDamaged: 0, expiryDate: null })
        .where(eq(purchaseOrderItems.poId, poId));

      await tx
        .update(purchaseOrders)
        .set({ status: "APPROVED", updatedAt: new Date() })
        .where(eq(purchaseOrders.id, poId));

      await tx.insert(auditLogs).values({
        branchId: po.branchId,
        userId: payload.userId,
        action: "PO_RECEIVING_CANCELLED",
        tableName: "purchase_orders",
        recordId: String(poId),
        oldData: JSON.stringify({ status: po.status, receivingLogIds: logIds, items }),
        newData: JSON.stringify({ status: "APPROVED", poNumber: po.poNumber, reason }),
      });
    });

    return NextResponse.json({
      success: true,
      message: "Input penerimaan dibatalkan. PO kembali ke tahap Disetujui.",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PO_NOT_FOUND")
        return NextResponse.json({ error: "Purchase Order tidak ditemukan" }, { status: 404 });
      if (error.message === "STATUS_INVALID")
        return NextResponse.json(
          { error: "Hanya input penerimaan yang belum disetujui yang bisa dibatalkan" },
          { status: 409 },
        );
      if (error.message === "ALREADY_APPLIED")
        return NextResponse.json(
          { error: "Stok atau hutang PO ini sudah dibuat — gunakan Batalkan Penerimaan" },
          { status: 409 },
        );
    }
    console.error("Cancel receiving PO error:", error);
    return NextResponse.json({ error: "Gagal membatalkan input penerimaan" }, { status: 500 });
  }
}
