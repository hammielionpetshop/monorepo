import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import { db, shifts, shiftCashierSessions, eq, and } from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";
import { TransactionService } from "@/lib/services/transaction-service";

const transactionSchema = z.object({
  branchId: z.number().int().positive(),
  shiftId: z.number().int().positive(),
  cashierId: z.number().int().positive(),
  customerId: z.number().int().nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        productName: z.string().optional(),
        uomId: z.number().int().positive(),
        uomCode: z.string().optional(),
        qty: z.number().int().positive(),
        unitPrice: z.number().int().nonnegative(),
        priceTier: z.string(),
        discountAmount: z.number().int().nonnegative(),
        subtotal: z.number().int().nonnegative(),
        isOwnerOverride: z.boolean().optional(),
      }),
    )
    .min(1),
  payments: z.array(
    z.object({
      paymentMethodId: z.number().int().positive(),
      amount: z.number().int().nonnegative(),
      referenceNumber: z.string().nullable().optional(),
    }),
  ),
  totals: z.object({
    subtotal: z.number().int().nonnegative(),
    discountTotal: z.number().int().nonnegative(),
    grandTotal: z.number().int().nonnegative(),
    itemCount: z.number().int().nonnegative().optional(),
  }),
  amountPaid: z.number().int().nonnegative(),
  change: z.number().int().nonnegative(),
  dueAt: z.string().nullable().optional(),
});

export const dynamic = "force-dynamic";

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
    const result = transactionSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error:
            result.error.issues[0]?.message ?? "Data transaksi tidak valid",
          details: result.error.format(),
        },
        { status: 400 },
      );
    }

    const effectiveBranchId = getPosBranchId(payload, cookieStore);
    if (result.data.branchId !== effectiveBranchId) {
      return NextResponse.json(
        { error: "Cabang transaksi tidak sesuai dengan sesi POS" },
        { status: 403 },
      );
    }

    if (result.data.cashierId !== payload.userId) {
      return NextResponse.json(
        { error: "ID kasir tidak sesuai dengan sesi login" },
        { status: 403 },
      );
    }

    const shift = await db.query.shifts.findFirst({
      where: and(
        eq(shifts.id, result.data.shiftId),
        eq(shifts.branchId, effectiveBranchId),
        eq(shifts.status, "OPEN"),
      ),
    });

    if (!shift) {
      return NextResponse.json(
        { error: "Shift tidak aktif untuk cabang POS ini" },
        { status: 400 },
      );
    }

    const activeSession = await db
      .select({ cashierId: shiftCashierSessions.cashierId })
      .from(shiftCashierSessions)
      .where(
        and(
          eq(shiftCashierSessions.shiftId, result.data.shiftId),
          eq(shiftCashierSessions.cashierId, payload.userId),
          eq(shiftCashierSessions.status, "ACTIVE"),
        ),
      )
      .limit(1);

    if (activeSession.length === 0) {
      return NextResponse.json(
        { error: "Kasir tidak aktif pada shift ini" },
        { status: 403 },
      );
    }

    const transaction = await TransactionService.createTransaction({
      ...result.data,
      branchId: effectiveBranchId,
      cashierId: payload.userId,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Transaksi berhasil disimpan",
        transaction,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Create transaction API error:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan transaksi" },
      { status: 500 },
    );
  }
}
