import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAccessToken } from "@/lib/auth";
import { db, notifications, stockOpnames, shifts, eq, and } from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";

export const dynamic = "force-dynamic";

const skipStockOpnameSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Alasan minimal 3 karakter")
    .max(500, "Alasan maksimal 500 karakter"),
  shiftId: z.number().int().positive("Shift tidak valid").nullable().optional(),
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
    const parsed = skipStockOpnameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 },
      );
    }

    const branchId = getPosBranchId(payload, cookieStore);
    const shiftId = parsed.data.shiftId ?? null;

    if (shiftId !== null) {
      const shift = await db.query.shifts.findFirst({
        where: and(eq(shifts.id, shiftId), eq(shifts.branchId, branchId)),
      });

      if (!shift) {
        return NextResponse.json(
          { error: "Shift tidak sesuai dengan cabang POS" },
          { status: 403 },
        );
      }
    }

    const result = await db.transaction(async (tx) => {
      const [header] = await tx
        .insert(stockOpnames)
        .values({
          soNumber: generateSONumber(),
          branchId,
          shiftId,
          type: "DAILY",
          status: "APPROVED",
          isSkipped: true,
          skipReason: parsed.data.reason,
          createdById: payload.userId,
        })
        .returning();

      await tx.insert(notifications).values({
        type: "SO_SKIPPED",
        branchId,
        title: "Stock Opname Harian Dilewati",
        message: `Kasir melewatkan Stock Opname harian. Alasan: ${parsed.data.reason}`,
        metadata: {
          soId: header.id,
          shiftId,
          cashierId: payload.userId,
        },
      });

      return header;
    });

    return NextResponse.json(
      {
        success: true,
        so: result,
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Skip Stock Opname API error:", error);
    return NextResponse.json(
      { error: "Gagal melewati stock opname" },
      { status: 500 },
    );
  }
}
