import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import {
  db,
  purchaseOrders,
  supplierPayables,
  supplierPayablePayments,
  eq,
  and,
  sql,
} from "@/lib/db";

const paySchema = z.object({
  amount: z
    .number()
    .int()
    .positive({ message: "Jumlah pembayaran harus lebih dari 0" }),
  method: z.string().min(1, "Metode pembayaran wajib diisi").max(50),
  referenceNumber: z.string().max(100).optional(),
  note: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payableId = Number.parseInt(id, 10);

    const gate = await requirePermission("payable.pay");
    if (gate instanceof NextResponse) return gate;
    const payload = gate;

    if (!Number.isInteger(payableId) || payableId <= 0) {
      return NextResponse.json(
        { error: "ID hutang supplier tidak valid" },
        { status: 400 },
      );
    }

    if (!req.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type harus application/json" },
        { status: 415 },
      );
    }

    const parsed = paySchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ?? "Data pembayaran tidak valid",
        },
        { status: 400 },
      );
    }

    const { amount, method, referenceNumber, note } = parsed.data;

    const result = await db.transaction(async (tx) => {
      const [payable] = await tx
        .select({
          id: supplierPayables.id,
          totalAmount: supplierPayables.totalAmount,
          paidAmount: supplierPayables.paidAmount,
          status: supplierPayables.status,
          branchId: purchaseOrders.branchId,
        })
        .from(supplierPayables)
        .innerJoin(purchaseOrders, eq(supplierPayables.poId, purchaseOrders.id))
        .where(eq(supplierPayables.id, payableId))
        .limit(1);

      if (!payable) throw new Error("PAYABLE_NOT_FOUND");

      const isGlobal = payload.branchScope === "ALL";
      if (!isGlobal && payable.branchId !== payload.branchId)
        throw new Error("PAYABLE_FORBIDDEN");
      if (payable.status === "PAID" || payable.status === "WAIVED")
        throw new Error("PAYABLE_CLOSED");

      const remaining =
        Number(payable.totalAmount) - Number(payable.paidAmount);
      if (amount > remaining) throw new Error("PAYMENT_EXCEEDS_REMAINING");

      const [updated] = await tx
        .update(supplierPayables)
        .set({
          paidAmount: sql`${supplierPayables.paidAmount} + ${amount}`,
          status: sql`CASE WHEN ${supplierPayables.paidAmount} + ${amount} >= ${supplierPayables.totalAmount} THEN 'PAID' ELSE 'PARTIAL' END`,
        })
        .where(
          and(
            eq(supplierPayables.id, payableId),
            sql`${supplierPayables.status} NOT IN ('PAID', 'WAIVED')`,
            sql`${supplierPayables.paidAmount} + ${amount} <= ${supplierPayables.totalAmount}`,
          ),
        )
        .returning();

      if (!updated) throw new Error("PAYMENT_CONFLICT");

      const [payment] = await tx
        .insert(supplierPayablePayments)
        .values({
          payableId,
          amount,
          method,
          referenceNumber: referenceNumber ?? null,
          note: note ?? null,
          paidById: payload.userId,
          paidAt: new Date(),
        })
        .returning();

      return payment;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Pembayaran supplier berhasil dicatat",
        payment: result,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PAYABLE_NOT_FOUND")
        return NextResponse.json(
          { error: "Data hutang supplier tidak ditemukan" },
          { status: 404 },
        );
      if (error.message === "PAYABLE_FORBIDDEN")
        return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
      if (error.message === "PAYABLE_CLOSED")
        return NextResponse.json(
          { error: "Hutang supplier sudah lunas atau ditutup" },
          { status: 409 },
        );
      if (error.message === "PAYMENT_EXCEEDS_REMAINING")
        return NextResponse.json(
          { error: "Jumlah pembayaran melebihi sisa tagihan" },
          { status: 400 },
        );
      if (error.message === "PAYMENT_CONFLICT")
        return NextResponse.json(
          { error: "Sisa hutang sudah berubah, silakan refresh halaman" },
          { status: 409 },
        );
    }

    console.error("Record payment error:", error);
    return NextResponse.json(
      { error: "Gagal mencatat pembayaran supplier" },
      { status: 500 },
    );
  }
}
