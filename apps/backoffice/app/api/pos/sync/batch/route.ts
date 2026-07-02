import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import { db, branches, shifts, shiftCashierSessions, eq, and } from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";
import { TransactionService } from "@/lib/services/transaction-service";

const syncItemSchema = z.object({
  id: z.string().min(1),
  payload: z.object({
    branchId: z.number().int().positive(),
    shiftId: z.number().int().positive(),
    cashierId: z.number().int().positive().nullable(),
    customerId: z.number().int().nullable().optional(),
    items: z
      .array(
        z.object({
          productId: z.number().int().positive(),
          productName: z.string(),
          uomId: z.number().int().positive(),
          uomCode: z.string(),
          qty: z.number().positive(),
          unitPrice: z.number().int().nonnegative(),
          priceTier: z.string(),
          discountAmount: z.number().int().nonnegative(),
          subtotal: z.number().int().nonnegative(),
          isOwnerOverride: z.boolean(),
        }),
      )
      .min(1),
    totals: z.object({
      subtotal: z.number().int().nonnegative(),
      discountTotal: z.number().int().nonnegative(),
      grandTotal: z.number().int().nonnegative(),
      itemCount: z.number().int().nonnegative().optional(),
    }),
    amountPaid: z.number().int().nonnegative(),
    change: z.number().int().nonnegative(),
    payments: z.array(
      z.object({
        paymentMethodId: z.number().int().positive(),
        amount: z.number().int().nonnegative(),
        referenceNumber: z.string().nullable().optional(),
      }),
    ),
    offlineAt: z.number().int().positive(),
    dueAt: z.string().nullable().optional(),
    localTrxNumber: z.string().optional(),
    authorizedOversell: z.boolean().optional(),
    oversellApprovedAt: z.number().optional(),
  }),
});

const batchSyncSchema = z.object({
  deviceId: z.string().min(1),
  transactions: z.array(syncItemSchema).min(1).max(100),
});

export const dynamic = "force-dynamic";

type SyncFailure = { id: string; reason: string };

async function hasOpenShift(shiftId: number, branchId: number) {
  const shift = await db.query.shifts.findFirst({
    where: and(
      eq(shifts.id, shiftId),
      eq(shifts.branchId, branchId),
      eq(shifts.status, "OPEN"),
    ),
  });

  return Boolean(shift);
}

async function hasActiveCashierSession(shiftId: number, cashierId: number) {
  const session = await db
    .select({ cashierId: shiftCashierSessions.cashierId })
    .from(shiftCashierSessions)
    .where(
      and(
        eq(shiftCashierSessions.shiftId, shiftId),
        eq(shiftCashierSessions.cashierId, cashierId),
        eq(shiftCashierSessions.status, "ACTIVE"),
      ),
    )
    .limit(1);

  return session.length > 0;
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
    const parsed = batchSyncSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Payload tidak valid", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const effectiveBranchId = getPosBranchId(payload, cookieStore);
    const { transactions } = parsed.data;
    const synced: string[] = [];
    const failed: SyncFailure[] = [];

    for (const item of transactions) {
      try {
        if (item.payload.branchId !== effectiveBranchId) {
          throw new Error(
            "Cabang transaksi offline tidak sesuai dengan sesi POS",
          );
        }

        if (item.payload.cashierId !== payload.userId) {
          throw new Error(
            "ID kasir transaksi offline tidak sesuai dengan sesi login",
          );
        }

        const shiftOpen = await hasOpenShift(
          item.payload.shiftId,
          effectiveBranchId,
        );
        if (!shiftOpen) {
          throw new Error("Shift tidak aktif untuk cabang POS ini");
        }

        const cashierActive = await hasActiveCashierSession(
          item.payload.shiftId,
          payload.userId,
        );
        if (!cashierActive) {
          throw new Error("Kasir tidak aktif pada shift ini");
        }

        const {
          authorizedOversell,
          oversellApprovedAt: _oversellApprovedAt,
          ...safePayload
        } = item.payload;

        await TransactionService.createTransaction({
          ...safePayload,
          branchId: effectiveBranchId,
          cashierId: payload.userId,
          localTrxNumber: item.payload.localTrxNumber,
          createdOffline: true,
          offlineTimestamp: new Date(item.payload.offlineAt),
          // Diteruskan agar audit log OVERSELL mencatat bahwa oversell sudah disetujui PIN di POS
          authorizedOversell: authorizedOversell === true,
        });
        synced.push(item.id);
      } catch (err: unknown) {
        console.error(`[Sync] Gagal memproses transaksi ${item.id}:`, err);
        failed.push({
          id: item.id,
          reason:
            err instanceof Error
              ? err.message
              : "Gagal memproses transaksi offline",
        });
      }
    }

    if (synced.length > 0) {
      try {
        await db
          .update(branches)
          .set({ lastSeenAt: new Date() })
          .where(eq(branches.id, effectiveBranchId));
      } catch (err) {
        console.error("[Sync] Gagal memperbarui lastSeenAt cabang:", err);
      }
    }

    return NextResponse.json({ synced, failed });
  } catch (error: unknown) {
    console.error("[Sync] Batch error:", error);
    return NextResponse.json(
      { error: "Gagal memproses batch sinkronisasi" },
      { status: 500 },
    );
  }
}
