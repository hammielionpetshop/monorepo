import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyAccessToken } from "@/lib/auth";
import { and, db, desc, eq, openBills } from "@/lib/db";
import { getPosBranchId } from "@/lib/pos-branch";

export const dynamic = "force-dynamic";

const openBillSchema = z.object({
  branchId: z.number().int().positive("Cabang tidak valid"),
  shiftId: z.number().int().positive("Shift tidak valid"),
  billName: z.string().trim().max(100).optional().nullable(),
  holdName: z.string().trim().max(100).optional().nullable(),
  items: z.array(z.unknown()).min(1, "Item tidak boleh kosong"),
  customerId: z.number().int().positive().nullable().optional(),
  totalAmount: z.coerce.number().int().nonnegative("Total tidak valid"),
});

async function requirePosSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;
  const payload = token ? await verifyAccessToken(token) : null;

  if (!payload) return null;

  return { payload, branchId: getPosBranchId(payload, cookieStore) };
}

function rejectBranchMismatch(
  requestedBranchId: number | null,
  branchId: number,
) {
  if (requestedBranchId !== null && requestedBranchId !== branchId) {
    return NextResponse.json(
      { error: "Cabang POS tidak sesuai dengan sesi" },
      { status: 403 },
    );
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requirePosSession();
    if (!session) {
      return NextResponse.json(
        { error: "Sesi tidak valid, silakan login kembali" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const requestedBranchId = searchParams.get("branchId")
      ? Number(searchParams.get("branchId"))
      : null;
    const branchError = rejectBranchMismatch(
      requestedBranchId,
      session.branchId,
    );
    if (branchError) return branchError;

    const result = await db
      .select()
      .from(openBills)
      .where(eq(openBills.branchId, session.branchId))
      .orderBy(desc(openBills.createdAt));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[OpenBills] GET error:", err);
    return NextResponse.json(
      { error: "Gagal mengambil open bill" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePosSession();
    if (!session) {
      return NextResponse.json(
        { error: "Sesi tidak valid, silakan login kembali" },
        { status: 401 },
      );
    }

    if (!req.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type harus application/json" },
        { status: 415 },
      );
    }

    const body = await req.json();
    const parsed = openBillSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 },
      );
    }

    const branchError = rejectBranchMismatch(
      parsed.data.branchId,
      session.branchId,
    );
    if (branchError) return branchError;

    const [newBill] = await db
      .insert(openBills)
      .values({
        branchId: session.branchId,
        shiftId: parsed.data.shiftId,
        billName:
          parsed.data.billName ||
          parsed.data.holdName ||
          `Bill ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })}`,
        items: JSON.stringify(parsed.data.items),
        customerId: parsed.data.customerId ?? null,
        totalAmount: parsed.data.totalAmount,
      })
      .returning();

    return NextResponse.json(newBill);
  } catch (err) {
    console.error("[OpenBills] POST error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan open bill" },
      { status: 500 },
    );
  }
}
